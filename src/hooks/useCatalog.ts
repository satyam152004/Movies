import {useState, useEffect, useCallback, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {CatalogService} from '../services/catalog/catalog.service';
import {CatalogItem} from '../data/models';

export type DataState = 'idle' | 'loading' | 'refreshing' | 'success' | 'error' | 'offline';

export function useCatalog(categoryPath: string | null) {
  const [movies, setMovies] = useState<CatalogItem[]>([]);
  const [status, setStatus] = useState<DataState>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [lastUpdatedMessage, setLastUpdatedMessage] = useState<string>('');

  const catalogService = CatalogService.getInstance();
  const isMountedRef = useRef(true);

  // Keep track of parameters using refs to avoid re-triggering hooks on prop changes incorrectly
  const categoryPathRef = useRef(categoryPath);
  categoryPathRef.current = categoryPath;

  // Format dynamic 'last updated' message
  const updateLastUpdatedMessage = useCallback((timestamp: number | null) => {
    if (!timestamp) {
      setLastUpdatedMessage('');
      return;
    }
    const diffMins = Math.floor((Date.now() - timestamp) / 60000);
    if (diffMins < 1) {
      setLastUpdatedMessage('Updated just now');
    } else if (diffMins === 1) {
      setLastUpdatedMessage('Updated 1 min ago');
    } else if (diffMins < 60) {
      setLastUpdatedMessage(`Updated ${diffMins} min ago`);
    } else {
      const diffHours = Math.floor(diffMins / 60);
      setLastUpdatedMessage(`Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`);
    }
  }, []);

  // Sync isMounted
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update elapsed time label periodically
  useEffect(() => {
    if (!cachedAt) return;
    updateLastUpdatedMessage(cachedAt);
    const interval = setInterval(() => {
      if (isMountedRef.current && cachedAt) {
        updateLastUpdatedMessage(cachedAt);
      }
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [cachedAt, updateLastUpdatedMessage]);

  /**
   * Main load/refresh controller
   */
  const loadData = useCallback(async (isForced: boolean = false, page: number = 1, append: boolean = false) => {
    if (!isMountedRef.current) return;

    try {
      // 1. If page 1, try reading local cache first (SWR implementation)
      if (page === 1 && !categoryPathRef.current) {
        const cache = await catalogService.getCachedCatalog();
        if (cache && cache.data && cache.data.length > 0) {
          setMovies(cache.data);
          setCachedAt(cache.cachedAt);
          setStatus('success');

          // If cache is fresh and not forced, we can skip the immediate network request
          const stale = catalogService.isCacheStale(cache.cachedAt);
          if (!stale && !isForced) {
            console.log('[useCatalog] Cache is fresh, skipping background network revalidation');
            return;
          }

          // If stale, proceed to trigger background revalidation silently
          setIsRefreshing(true);
        } else {
          // No cache available at all, set to primary loading state
          setStatus('loading');
        }
      } else if (page === 1) {
        // Categories do not cache, load directly
        setStatus('loading');
      }

      // 2. Fetch fresh content from scraper
      const freshMovies = await catalogService.fetchCatalog(categoryPathRef.current, page, isForced);
      
      if (!isMountedRef.current) return;

      if (append) {
        setMovies(prev => [...prev, ...freshMovies]);
      } else {
        setMovies(freshMovies);
        if (!categoryPathRef.current) {
          setCachedAt(Date.now());
        }
      }
      setError(null);
      setIsOffline(false);
      setStatus('success');
    } catch (err: any) {
      if (!isMountedRef.current) return;

      const errMsg = err.message || 'Failed to fetch movies';
      setError(errMsg);

      const isNetErr = errMsg.toLowerCase().includes('network') ||
                       errMsg.toLowerCase().includes('timeout') ||
                       errMsg.toLowerCase().includes('dns') ||
                       errMsg.toLowerCase().includes('connection') ||
                       errMsg.toLowerCase().includes('unreachable');
      
      if (isNetErr) {
        setIsOffline(true);
      }

      // If we failed but already have cached data, don't show full-screen error
      if (movies.length > 0) {
        setStatus('success');
      } else {
        setStatus(isNetErr ? 'offline' : 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [catalogService, movies.length]);

  // Pull to refresh trigger
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData(true, 1, false);
  }, [loadData]);

  // Load more pages (pagination)
  const handleLoadMore = useCallback(async (nextPage: number) => {
    await loadData(false, nextPage, true);
  }, [loadData]);

  // Background refresh when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const cache = await catalogService.getCachedCatalog();
        if (cache && catalogService.isCacheStale(cache.cachedAt)) {
          console.info('[useCatalog] App returned to foreground with stale cache. Revalidating...');
          handleRefresh();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [catalogService, handleRefresh]);

  // Initial trigger when category changes
  useEffect(() => {
    loadData(false, 1, false);
  }, [categoryPath]);

  return {
    movies,
    status,
    isRefreshing,
    error,
    isOffline,
    lastUpdatedMessage,
    refresh: handleRefresh,
    loadMore: handleLoadMore,
  };
}
