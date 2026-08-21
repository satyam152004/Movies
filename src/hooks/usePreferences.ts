import {useState, useEffect, useCallback} from 'react';
import {PreferencesStorage} from '../services/storage/preferences.storage';

export function usePreferences() {
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [downloadQuality, setDownloadQuality] = useState<'1080p' | '720p' | '480p'>('1080p');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      const vq = await PreferencesStorage.getVideoQuality();
      const dq = await PreferencesStorage.getDownloadQuality();
      const wo = await PreferencesStorage.getWifiOnly();
      setVideoQuality(vq);
      setDownloadQuality(dq);
      setWifiOnly(wo);
    } catch (e) {
      console.error('Failed to load preferences in hook', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const updateVideoQuality = async (val: 'high' | 'medium' | 'low') => {
    setVideoQuality(val);
    await PreferencesStorage.saveVideoQuality(val);
  };

  const updateDownloadQuality = async (val: '1080p' | '720p' | '480p') => {
    setDownloadQuality(val);
    await PreferencesStorage.saveDownloadQuality(val);
  };

  const updateWifiOnly = async (val: boolean) => {
    setWifiOnly(val);
    await PreferencesStorage.saveWifiOnly(val);
  };

  return {
    videoQuality,
    downloadQuality,
    wifiOnly,
    isLoading,
    updateVideoQuality,
    updateDownloadQuality,
    updateWifiOnly,
    refreshPreferences: loadPreferences,
  };
}
