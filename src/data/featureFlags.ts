import AsyncStorage from '@react-native-async-storage/async-storage';
import {FeatureFlags} from './models';

const DEFAULT_FLAGS: FeatureFlags = {
  heroBannerV2: true,
  downloadsV2: true,
  developerMode: false,
  experimentalAnimations: false,
};

export const getFeatureFlags = async (): Promise<FeatureFlags> => {
  try {
    const raw = await AsyncStorage.getItem('@feature_flags');
    if (raw !== null) {
      return {...DEFAULT_FLAGS, ...JSON.parse(raw)};
    }
  } catch (e) {
    console.error('Failed to load feature flags', e);
  }
  return DEFAULT_FLAGS;
};

export const saveFeatureFlags = async (flags: FeatureFlags): Promise<void> => {
  try {
    await AsyncStorage.setItem('@feature_flags', JSON.stringify(flags));
  } catch (e) {
    console.error('Failed to save feature flags', e);
  }
};
