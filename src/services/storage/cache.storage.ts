import AsyncStorage from '@react-native-async-storage/async-storage';
import {CatalogItem} from '../../data/models';

export interface CatalogCache {
  data: CatalogItem[];
  cachedAt: number;
  source?: string;
  version?: number;
}

export interface TmdbCacheObject {
  expiresAt: number;
  data: any;
}

export class CacheStorage {
  private static readonly CATALOG_CACHE_KEY = '@catalog_cache';
  private static readonly SEARCH_RECENTS_KEY = '@search_recents';
  private static readonly DISCOVERED_URL_KEY = '@hdhub4u_discovered_url';
  private static readonly TMDB_PREFIX = 'movie_enrichment_';

  public static async getCatalogCache(): Promise<CatalogCache | null> {
    try {
      const raw = await AsyncStorage.getItem(this.CATALOG_CACHE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to get catalog cache', e);
    }
    return null;
  }

  public static async saveCatalogCache(cache: CatalogCache): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CATALOG_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('Failed to save catalog cache', e);
    }
  }

  public static async clearCatalogCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CATALOG_CACHE_KEY);
    } catch (e) {
      console.error('Failed to clear catalog cache', e);
    }
  }

  public static async getTmdbCache(movieUrl: string): Promise<any | null> {
    try {
      const cacheKey = this.TMDB_PREFIX + encodeURIComponent(movieUrl);
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const cached: TmdbCacheObject = JSON.parse(raw);
        if (cached.expiresAt && Date.now() < cached.expiresAt) {
          return cached.data;
        }
      }
    } catch (e) {
      console.warn('TMDB Cache read error', e);
    }
    return null;
  }

  public static async saveTmdbCache(movieUrl: string, data: any, ttlMs: number): Promise<void> {
    try {
      const cacheKey = this.TMDB_PREFIX + encodeURIComponent(movieUrl);
      const cacheObject: TmdbCacheObject = {
        expiresAt: Date.now() + ttlMs,
        data,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheObject));
    } catch (e) {
      console.warn('TMDB Cache write error', e);
    }
  }

  public static async getSearchRecents(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(this.SEARCH_RECENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to get search recents', e);
      return [];
    }
  }

  public static async saveSearchRecents(recents: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SEARCH_RECENTS_KEY, JSON.stringify(recents));
    } catch (e) {
      console.error('Failed to save search recents', e);
    }
  }

  public static async removeSearchRecents(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SEARCH_RECENTS_KEY);
    } catch (e) {
      console.error('Failed to remove search recents', e);
    }
  }

  public static async getDiscoveredUrl(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.DISCOVERED_URL_KEY);
    } catch (e) {
      console.error('Failed to get discovered url', e);
      return null;
    }
  }

  public static async saveDiscoveredUrl(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.DISCOVERED_URL_KEY, url);
    } catch (e) {
      console.error('Failed to save discovered url', e);
    }
  }
}
