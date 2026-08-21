import {ScraperService} from '../scraper.service';
import {UrlDiscoveryService} from '../urlDiscovery.service';
import {CacheStorage, CatalogCache} from '../storage/cache.storage';
import {CatalogItem} from '../../data/models';

export type CatalogListener = (data: CatalogItem[]) => void;

export class CatalogService {
  private static instance: CatalogService;
  private scraper = ScraperService.getInstance();
  private activeRequests: Map<string, Promise<CatalogItem[]>> = new Map();
  private listeners: Set<CatalogListener> = new Set();
  
  // Stale threshold is 10 minutes
  private static readonly STALE_THRESHOLD_MS = 10 * 60 * 1000;

  private constructor() {}

  public static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  public subscribe(listener: CatalogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(data: CatalogItem[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (e) {
        console.error('Error notifying catalog listener', e);
      }
    });
  }

  /**
   * Helper to format request key
   */
  private getRequestKey(categoryPath: string | null, pageNum: number): string {
    return `${categoryPath || 'all'}_page_${pageNum}`;
  }

  /**
   * Check if cache is stale
   */
  public isCacheStale(cachedAt: number): boolean {
    return Date.now() - cachedAt > CatalogService.STALE_THRESHOLD_MS;
  }

  /**
   * Retrieve cached catalog data
   */
  public async getCachedCatalog(): Promise<CatalogCache | null> {
    return await CacheStorage.getCatalogCache();
  }

  /**
   * Fetch from Scraper with duplicate request coordination
   */
  public async fetchCatalog(
    categoryPath: string | null,
    pageNum: number,
    forceRefresh: boolean = false
  ): Promise<CatalogItem[]> {
    const requestKey = this.getRequestKey(categoryPath, pageNum);

    // 1. Check for existing active promise (Deduplication)
    const activePromise = this.activeRequests.get(requestKey);
    if (activePromise) {
      console.info(`[CatalogService] Returning existing active request for: ${requestKey}`);
      return activePromise;
    }

    // 2. Perform network request
    const promise = (async () => {
      try {
        const activeUrl = await UrlDiscoveryService.getInstance().getActiveUrl();
        if (!activeUrl) {
          throw new Error('No active scraper URL discovered');
        }

        const targetUrl = categoryPath
          ? `${activeUrl.replace(/\/$/, '')}/${categoryPath.replace(/^\//, '')}`
          : activeUrl;

        this.scraper.log(
          `[CatalogService] Scraping path: ${targetUrl} (page ${pageNum})...`,
          'info'
        );

        const result = await this.scraper.scrapeCatalogPage(targetUrl, false, pageNum);
        
        // 3. Cache Validation
        if (result && Array.isArray(result.items) && result.items.length > 0) {
          // Verify items have basic valid structures
          const validItems = result.items.filter(item => item && item.title && item.url);
          if (validItems.length > 0) {
            // Write to cache only on page 1 of 'All' / category-less fetches
            // to keep the main offline landing page correct without mixing pagination pages
            if (pageNum === 1 && !categoryPath) {
              await CacheStorage.saveCatalogCache({
                data: validItems,
                cachedAt: Date.now(),
              });
              this.notifyListeners(validItems);
            }
            return validItems;
          }
        }
        throw new Error('Scraped response is empty or invalid');
      } catch (err) {
        this.scraper.log(`[CatalogService] Scrape failed: ${(err as any).message}`, 'error');
        throw err;
      } finally {
        // Clear active request tracker when request resolves or fails
        this.activeRequests.delete(requestKey);
      }
    })();

    this.activeRequests.set(requestKey, promise);
    return promise;
  }
}
