import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlags} from '../../data/models';

const DEFAULT_FLAGS: FeatureFlags = {
  heroBannerV2: true,
  downloadsV2: true,
  developerMode: false,
  experimentalAnimations: false,
};

export class PreferencesStorage {
  public static async getVideoQuality(): Promise<'high' | 'medium' | 'low'> {
    try {
      const val = await AsyncStorage.getItem('@pref_video_quality');
      return (val as 'high' | 'medium' | 'low') || 'high';
    } catch (e) {
      console.error('Failed to get video quality', e);
      return 'high';
    }
  }

  public static async saveVideoQuality(quality: 'high' | 'medium' | 'low'): Promise<void> {
    try {
      await AsyncStorage.setItem('@pref_video_quality', quality);
    } catch (e) {
      console.error('Failed to save video quality', e);
    }
  }

  public static async getDownloadQuality(): Promise<'1080p' | '720p' | '480p'> {
    try {
      const val = await AsyncStorage.getItem('@pref_download_quality');
      return (val as '1080p' | '720p' | '480p') || '1080p';
    } catch (e) {
      console.error('Failed to get download quality', e);
      return '1080p';
    }
  }

  public static async saveDownloadQuality(quality: '1080p' | '720p' | '480p'): Promise<void> {
    try {
      await AsyncStorage.setItem('@pref_download_quality', quality);
    } catch (e) {
      console.error('Failed to save download quality', e);
    }
  }

  public static async getWifiOnly(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem('@pref_wifi_only');
      return val !== null ? JSON.parse(val) : true;
    } catch (e) {
      console.error('Failed to get wifi only preference', e);
      return true;
    }
  }

  public static async saveWifiOnly(val: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('@pref_wifi_only', JSON.stringify(val));
    } catch (e) {
      console.error('Failed to save wifi only preference', e);
    }
  }

  public static async getFeatureFlags(): Promise<FeatureFlags> {
    try {
      const raw = await AsyncStorage.getItem('@feature_flags');
      if (raw !== null) {
        return {...DEFAULT_FLAGS, ...JSON.parse(raw)};
      }
    } catch (e) {
      console.error('Failed to load feature flags', e);
    }
    return DEFAULT_FLAGS;
  }

  public static async saveFeatureFlags(flags: FeatureFlags): Promise<void> {
    try {
      await AsyncStorage.setItem('@feature_flags', JSON.stringify(flags));
    } catch (e) {
      console.error('Failed to save feature flags', e);
    }
  }
}
