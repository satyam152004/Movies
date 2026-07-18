import {NativeModules} from 'react-native';
import {ScraperService} from './scraper.service';

const {DownloadModule} = NativeModules;

export interface DownloadRecord {
  id: string; // Native DownloadManager ID
  movieTitle: string;
  fileSize: string;
  downloadUrl: string;
  fileName: string;
  progress: number;
  downloadSpeed: string;
  downloadedSize: string;
  eta: string;
  status:
    | 'pending'
    | 'downloading'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'failed';
  logs: string[];
  addedAt: number;
  lastBytesDownloaded: number;
  lastUpdated: number;
}

type DownloadListener = (records: DownloadRecord[]) => void;

export class DownloadService {
  private static instance: DownloadService;
  private downloads: DownloadRecord[] = [];
  private listeners = new Set<DownloadListener>();
  private syncTimer: NodeJS.Timeout | null = null;
  private scraper = ScraperService.getInstance();

  private constructor() {
    this.init();
  }

  public static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  private async init() {
    try {
      this.scraper.log('Initializing DownloadService...', 'info');
      const data = await DownloadModule.loadDownloadsData();
      if (data) {
        this.downloads = JSON.parse(data);
        this.scraper.log(
          `Loaded ${this.downloads.length} downloads from persistent storage`,
          'success',
        );
      } else {
        this.downloads = [];
      }
      this.notifyListeners();

      // Start background sync interval
      this.startSync();
    } catch (e: any) {
      this.scraper.log(
        `Failed to initialize DownloadService: ${e.message}`,
        'error',
      );
      this.downloads = [];
    }
  }

  public addListener(listener: DownloadListener) {
    this.listeners.add(listener);
    // Send initial update
    listener(this.downloads);
  }

  public removeListener(listener: DownloadListener) {
    this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener([...this.downloads]);
      } catch (err: any) {
        this.scraper.log(
          `Listener notification error: ${err.message}`,
          'error',
        );
      }
    });
  }

  private async persist() {
    try {
      const data = JSON.stringify(this.downloads);
      await DownloadModule.saveDownloadsData(data);
    } catch (err: any) {
      this.scraper.log(
        `Failed to persist downloads state: ${err.message}`,
        'error',
      );
    }
  }

  public getDownloads(): DownloadRecord[] {
    return [...this.downloads];
  }

  public getDownloadByUrl(url: string): DownloadRecord | undefined {
    return this.downloads.find(d => d.downloadUrl === url);
  }

  public async startDownload(
    movieTitle: string,
    fileSize: string,
    downloadUrl: string,
  ): Promise<string> {
    // 1. Prevent duplicates for active tasks
    const existing = this.downloads.find(d => d.downloadUrl === downloadUrl);
    if (existing) {
      if (
        existing.status === 'downloading' ||
        existing.status === 'pending' ||
        existing.status === 'paused'
      ) {
        this.scraper.log(
          `Download already active for "${movieTitle}". Directing to current task.`,
          'warn',
        );
        return existing.id;
      }
      // If failed/cancelled, we retry/remove first
      this.downloads = this.downloads.filter(
        d => d.downloadUrl !== downloadUrl,
      );
    }

    // 2. Clean filename
    const sanitizedTitle = movieTitle
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const extension = this.getFileExtension(downloadUrl);
    const fileName = `${sanitizedTitle}_${fileSize.replace(
      /\s+/g,
      '',
    )}${extension}`;

    this.scraper.log(
      `Enqueuing download via system manager: ${fileName}`,
      'info',
    );

    // 3. Normalize protocol-relative URLs (e.g. //site.com -> https://site.com)
    let finalUrl = downloadUrl;
    if (finalUrl.startsWith('//')) {
      finalUrl = 'https:' + finalUrl;
    }

    // 4. Trigger native enqueue
    try {
      const id = await DownloadModule.enqueueDownload(
        finalUrl,
        movieTitle,
        fileName,
      );
      const newRecord: DownloadRecord = {
        id,
        movieTitle,
        fileSize,
        downloadUrl: finalUrl,
        fileName,
        progress: 0,
        downloadSpeed: '0.0 MB/s',
        downloadedSize: '0.0 MB',
        eta: '--:--',
        status: 'pending',
        logs: [
          `[${new Date().toLocaleTimeString()}] Download enqueued via system DownloadManager (ID: ${id})`,
        ],
        addedAt: Date.now(),
        lastBytesDownloaded: 0,
        lastUpdated: Date.now(),
      };

      this.downloads = [newRecord, ...this.downloads];
      await this.persist();
      this.notifyListeners();
      return id;
    } catch (err: any) {
      this.scraper.log(`Native enqueue failed: ${err.message}`, 'error');
      throw err;
    }
  }

  public async pauseDownload(id: string) {
    const record = this.downloads.find(d => d.id === id);
    if (!record || record.status === 'paused') {
      return;
    }

    this.scraper.log(`Pausing download: "${record.movieTitle}"`, 'info');
    try {
      // System DownloadManager doesn't pause programmatically, so we cancel the system task
      // and keep the current progress state in JS to support resuming.
      await DownloadModule.cancelDownload(id);
      record.status = 'paused';
      record.downloadSpeed = '0.0 MB/s';
      record.eta = 'Paused';
      record.logs.unshift(
        `[${new Date().toLocaleTimeString()}] Download paused (system task removed, tracking progress for resume)`,
      );

      await this.persist();
      this.notifyListeners();
    } catch (err: any) {
      this.scraper.log(
        `Failed to pause download task: ${err.message}`,
        'error',
      );
    }
  }

  public async resumeDownload(id: string) {
    const record = this.downloads.find(d => d.id === id);
    if (
      !record ||
      (record.status !== 'paused' &&
        record.status !== 'cancelled' &&
        record.status !== 'failed')
    ) {
      return;
    }

    const actionText = record.status === 'paused' ? 'Resuming' : 'Retrying';
    this.scraper.log(`${actionText} download: "${record.movieTitle}"`, 'info');
    try {
      // Re-enqueue the download URL
      const newId = await DownloadModule.enqueueDownload(
        record.downloadUrl,
        record.movieTitle,
        record.fileName,
      );
      record.id = newId;
      record.status = 'pending';
      record.lastBytesDownloaded = 0;
      record.lastUpdated = Date.now();
      record.logs.unshift(
        `[${new Date().toLocaleTimeString()}] ${actionText} download. New system task enqueued (ID: ${newId})`,
      );

      await this.persist();
      this.notifyListeners();
    } catch (err: any) {
      this.scraper.log(
        `Failed to resume download task: ${err.message}`,
        'error',
      );
    }
  }

  public async cancelDownload(id: string) {
    const record = this.downloads.find(d => d.id === id);
    if (!record) {
      return;
    }

    this.scraper.log(`Cancelling download: "${record.movieTitle}"`, 'info');
    try {
      await DownloadModule.cancelDownload(id);
      record.status = 'cancelled';
      record.progress = 0;
      record.downloadSpeed = '0.0 MB/s';
      record.eta = '--:--';
      record.logs.unshift(
        `[${new Date().toLocaleTimeString()}] Download cancelled by user.`,
      );

      await this.persist();
      this.notifyListeners();
    } catch (err: any) {
      this.scraper.log(
        `Failed to cancel download task: ${err.message}`,
        'error',
      );
    }
  }

  public async removeDownloadRecord(id: string) {
    const record = this.downloads.find(d => d.id === id);
    if (record) {
      try {
        // Always attempt to cancel/remove the task natively from the system DownloadManager database,
        // which deletes the associated file (even if completed or paused).
        await DownloadModule.cancelDownload(id);
      } catch (e) {}
    }
    this.downloads = this.downloads.filter(d => d.id !== id);
    await this.persist();
    this.notifyListeners();
  }

  private startSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.syncTimer = setInterval(() => this.syncStatus(), 2000);
  }

  private async syncStatus() {
    let changed = false;

    for (const record of this.downloads) {
      if (
        record.status === 'completed' ||
        record.status === 'failed' ||
        record.status === 'cancelled' ||
        record.status === 'paused'
      ) {
        continue;
      }

      try {
        const nativeStatus = await DownloadModule.getDownloadStatus(record.id);
        
        // Anti-race condition check: verify if the record was paused, cancelled, completed,
        // or deleted during the asynchronous native status call.
        const currentRecord = this.downloads.find(d => d.id === record.id);
        if (
          !currentRecord ||
          currentRecord.status === 'completed' ||
          currentRecord.status === 'failed' ||
          currentRecord.status === 'cancelled' ||
          currentRecord.status === 'paused'
        ) {
          continue;
        }

        const now = Date.now();
        const timeDiffSec = (now - record.lastUpdated) / 1000;

        if (nativeStatus.status === 'RUNNING') {
          record.status = 'downloading';
          const totalBytes = nativeStatus.bytesTotal;
          const currentBytes = nativeStatus.bytesDownloaded;

          if (totalBytes > 0) {
            record.progress = (currentBytes / totalBytes) * 100;
          }

          // Calculate speed
          if (timeDiffSec > 0.5) {
            const bytesDiff = Math.max(
              0,
              currentBytes - record.lastBytesDownloaded,
            );
            const speedBytesPerSec = bytesDiff / timeDiffSec;

            // Format speed
            if (speedBytesPerSec > 1024 * 1024) {
              record.downloadSpeed = `${(
                speedBytesPerSec /
                (1024 * 1024)
              ).toFixed(1)} MB/s`;
            } else {
              record.downloadSpeed = `${(speedBytesPerSec / 1024).toFixed(
                1,
              )} KB/s`;
            }

            // Calculate ETA
            if (speedBytesPerSec > 1000) {
              const remainingBytes = Math.max(0, totalBytes - currentBytes);
              const remainingSec = remainingBytes / speedBytesPerSec;
              const minutes = Math.floor(remainingSec / 60);
              const seconds = Math.floor(remainingSec % 60);
              record.eta = `${minutes.toString().padStart(2, '0')}:${seconds
                .toString()
                .padStart(2, '0')}`;
            } else {
              record.eta = '--:--';
            }

            record.lastBytesDownloaded = currentBytes;
            record.lastUpdated = now;
          }

          record.downloadedSize = `${(currentBytes / (1024 * 1024)).toFixed(
            1,
          )} MB`;
          changed = true;
        } else if (nativeStatus.status === 'SUCCESSFUL') {
          record.status = 'completed';
          record.progress = 100;
          record.downloadSpeed = '0.0 MB/s';
          record.eta = 'Finished';

          const totalSizeMb =
            nativeStatus.bytesTotal > 0
              ? (nativeStatus.bytesTotal / (1024 * 1024)).toFixed(1)
              : 'Unknown';
          record.downloadedSize = `${totalSizeMb} MB`;
          record.logs.unshift(
            `[${new Date().toLocaleTimeString()}] Download completed successfully!`,
          );

          changed = true;
        } else if (nativeStatus.status === 'FAILED') {
          record.status = 'failed';
          record.downloadSpeed = '0.0 MB/s';
          record.eta = '--:--';
          record.logs.unshift(
            `[${new Date().toLocaleTimeString()}] Download task failed natively (Reason code: ${
              nativeStatus.reason
            })`,
          );

          changed = true;
        } else if (nativeStatus.status === 'PENDING') {
          record.status = 'pending';
          record.downloadSpeed = '0.0 MB/s';
          record.eta = 'Waiting...';
          changed = true;
        } else if (nativeStatus.status === 'PAUSED') {
          record.status = 'paused';
          record.downloadSpeed = '0.0 MB/s';
          record.eta = 'Waiting for network...';
          changed = true;
        } else if (nativeStatus.status === 'UNKNOWN') {
          // If it was downloading/pending but native says UNKNOWN (meaning removed or deleted), mark it failed
          record.status = 'failed';
          record.logs.unshift(
            `[${new Date().toLocaleTimeString()}] Download cancelled or disappeared from system queue.`,
          );
          changed = true;
        }
      } catch (err: any) {
        this.scraper.log(
          `Failed to sync download ID ${record.id}: ${err.message}`,
          'error',
        );
      }
    }

    if (changed) {
      await this.persist();
      this.notifyListeners();
    }
  }

  private getFileExtension(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.mp4')) {
      return '.mp4';
    }
    if (lowerUrl.includes('.mkv')) {
      return '.mkv';
    }
    if (lowerUrl.includes('.avi')) {
      return '.avi';
    }
    if (lowerUrl.includes('.zip')) {
      return '.zip';
    }
    return '.mkv'; // Default movie fallback
  }
}
