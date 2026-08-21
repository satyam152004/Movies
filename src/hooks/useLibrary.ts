import {useState, useEffect, useCallback} from 'react';
import {LibraryStorage} from '../services/storage/library.storage';
import {DownloadService, DownloadRecord} from '../services/download.service';
import {CatalogItem} from '../data/models';

export function useLibrary() {
  const [watchlist, setWatchlist] = useState<CatalogItem[]>([]);
  const [favorites, setFavorites] = useState<CatalogItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const wl = await LibraryStorage.getWatchlist();
      const fav = await LibraryStorage.getFavorites();
      const hist = await LibraryStorage.getWatchHistory();
      const cont = await LibraryStorage.getContinueWatching();

      setWatchlist(wl);
      setFavorites(fav);
      setHistory(hist);
      setContinueWatching(cont);
    } catch (e) {
      console.error('Failed to load library data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to DownloadService
    const downloadService = DownloadService.getInstance();
    const unsubscribeDownloads = (recs: DownloadRecord[]) => {
      setDownloads(recs);
    };

    downloadService.addListener(unsubscribeDownloads);
    return () => {
      downloadService.removeListener(unsubscribeDownloads);
    };
  }, [loadData]);

  const counts = {
    favorites: favorites.length,
    watchlist: watchlist.length,
    history: history.length,
    continueWatching: continueWatching.length,
    downloads: downloads.length,
  };

  return {
    watchlist,
    favorites,
    history,
    continueWatching,
    downloads,
    counts,
    isLoading,
    refreshLibrary: loadData,
  };
}
