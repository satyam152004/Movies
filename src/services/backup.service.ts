import {NativeModules, Platform} from 'react-native';
import {LibraryStorage} from './storage/library.storage';
import {DownloadService} from './download.service';

const {BackupModule} = NativeModules;

export class BackupService {
  /**
   * Orchestrates the backup creation and triggers Android document picker.
   */
  public static async runExport(): Promise<boolean> {
    try {
      const backupStr = await LibraryStorage.exportBackup();
      if (Platform.OS === 'android' && BackupModule) {
        return await BackupModule.exportBackup(backupStr);
      }
      throw new Error('BackupModule is not supported on this platform');
    } catch (e) {
      console.error('[BackupService] Export process failed', e);
      throw e;
    }
  }

  /**
   * Triggers file picker and returns parsed backup details for confirmation.
   */
  public static async runImport(): Promise<{backupStr: string; timestamp?: number} | null> {
    try {
      if (Platform.OS === 'android' && BackupModule) {
        const backupStr = await BackupModule.importBackup();
        if (!backupStr) {
          return null;
        }

        // Schema validation
        const backup = JSON.parse(backupStr);
        if (!backup || backup.version !== 1) {
          throw new Error('Invalid backup version or format');
        }

        return {
          backupStr,
          timestamp: backup.timestamp,
        };
      }
      throw new Error('BackupModule is not supported on this platform');
    } catch (e) {
      console.error('[BackupService] Import process failed', e);
      throw e;
    }
  }

  /**
   * Applies the backup string data to local storage.
   */
  public static async applyImport(backupStr: string): Promise<void> {
    await LibraryStorage.importBackup(backupStr);
    try {
      await DownloadService.getInstance().reloadDownloads();
    } catch (err) {
      console.error('Failed to reload downloads service after backup import', err);
    }
  }
}
