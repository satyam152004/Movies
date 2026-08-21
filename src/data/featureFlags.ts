import {FeatureFlags} from './models';
import {PreferencesStorage} from '../services/storage/preferences.storage';

export const getFeatureFlags = async (): Promise<FeatureFlags> => {
  return PreferencesStorage.getFeatureFlags();
};

export const saveFeatureFlags = async (flags: FeatureFlags): Promise<void> => {
  return PreferencesStorage.saveFeatureFlags(flags);
};
