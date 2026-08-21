import AsyncStorage from '@react-native-async-storage/async-storage';
import {CatalogItem} from '../../data/models';
import {PreferencesStorage} from './preferences.storage';

export interface UserProfile {
  id: string;
  name: string;
  avatarText?: string;
  avatarId?: string;
  createdAt: string;
  updatedAt: string;
}

export class LibraryStorage {
  private static readonly PROFILE_KEY = '@user_profile';
  private static readonly WATCHLIST_KEY = '@watchlist';
  private static readonly FAVORITES_KEY = '@favorites';
  private static readonly HISTORY_KEY = '@watch_history';
  private static readonly CONTINUE_WATCHING_KEY = '@continue_watching';

  private static generateId(): string {
    return (
      'profile_' +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 7)
    );
  }

  public static async getProfile(): Promise<UserProfile> {
    try {
      const raw = await AsyncStorage.getItem(this.PROFILE_KEY);
      if (raw) {
        const profile = JSON.parse(raw);
        // Migration check: ensure stable ID exists
        if (!profile.id) {
          profile.id = this.generateId();
          profile.createdAt = profile.createdAt || new Date().toISOString();
          profile.updatedAt = new Date().toISOString();
          await this.saveProfile(profile);
        }
        return profile;
      }
    } catch (e) {
      console.error('Failed to get profile', e);
    }

    // Default first launch profile
    const defaultProfile: UserProfile = {
      id: this.generateId(),
      name: 'Movie Fan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await this.saveProfile(defaultProfile);
    } catch (e) {
      console.error('Failed to save default profile', e);
    }
    return defaultProfile;
  }

  public static async saveProfile(profile: UserProfile): Promise<void> {
    try {
      profile.updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(this.PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  }

  public static async getWatchlist(): Promise<CatalogItem[]> {
    try {
      const raw = await AsyncStorage.getItem(this.WATCHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to get watchlist', e);
      return [];
    }
  }

  public static async saveWatchlist(watchlist: CatalogItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch (e) {
      console.error('Failed to save watchlist', e);
    }
  }

  public static async getFavorites(): Promise<CatalogItem[]> {
    try {
      const raw = await AsyncStorage.getItem(this.FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to get favorites', e);
      return [];
    }
  }

  public static async saveFavorites(favorites: CatalogItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  }

  public static async getWatchHistory(): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(this.HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to get watch history', e);
      return [];
    }
  }

  public static async saveWatchHistory(history: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save watch history', e);
    }
  }

  public static async getContinueWatching(): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(this.CONTINUE_WATCHING_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to get continue watching', e);
      return [];
    }
  }

  public static async saveContinueWatching(
    continueWatching: any[],
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.CONTINUE_WATCHING_KEY,
        JSON.stringify(continueWatching),
      );
    } catch (e) {
      console.error('Failed to save continue watching', e);
    }
  }

  /**
   * Export all user data as a JSON string
   */
  public static async exportBackup(): Promise<string> {
    try {
      const profile = await this.getProfile();
      const watchlist = await this.getWatchlist();
      const favorites = await this.getFavorites();
      const history = await this.getWatchHistory();
      const continueWatching = await this.getContinueWatching();
      
      const videoQuality = await PreferencesStorage.getVideoQuality();
      const downloadQuality = await PreferencesStorage.getDownloadQuality();
      const wifiOnly = await PreferencesStorage.getWifiOnly();

      const backup = {
        version: 1,
        profile,
        watchlist,
        favorites,
        history,
        continueWatching,
        preferences: {
          videoQuality,
          downloadQuality,
          wifiOnly,
        },
        timestamp: Date.now(),
      };

      return JSON.stringify(backup);
    } catch (e) {
      console.error('Failed to export backup', e);
      throw e;
    }
  }

  /**
   * Import all user data from a JSON string backup
   */
  public static async importBackup(backupStr: string): Promise<void> {
    try {
      const backup = JSON.parse(backupStr);
      if (backup && backup.version === 1) {
        if (backup.profile) {
          await this.saveProfile(backup.profile);
        }
        if (backup.watchlist) {
          await this.saveWatchlist(backup.watchlist);
        }
        if (backup.favorites) {
          await this.saveFavorites(backup.favorites);
        }
        if (backup.history) {
          await this.saveWatchHistory(backup.history);
        }
        if (backup.continueWatching) {
          await this.saveContinueWatching(backup.continueWatching);
        }
        if (backup.preferences) {
          if (backup.preferences.videoQuality) {
            await PreferencesStorage.saveVideoQuality(backup.preferences.videoQuality);
          }
          if (backup.preferences.downloadQuality) {
            await PreferencesStorage.saveDownloadQuality(backup.preferences.downloadQuality);
          }
          if (backup.preferences.wifiOnly !== undefined) {
            await PreferencesStorage.saveWifiOnly(backup.preferences.wifiOnly);
          }
        }
      } else {
        throw new Error('Invalid backup version');
      }
    } catch (e) {
      console.error('Failed to import backup', e);
      throw e;
    }
  }
}
