import {useState, useEffect, useCallback} from 'react';
import {LibraryStorage, UserProfile} from '../services/storage/library.storage';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await LibraryStorage.getProfile();
      setProfile(p);
    } catch (e) {
      console.error('Failed loading profile in hook', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfileName = async (newName: string) => {
    if (!newName || !newName.trim()) {
      return;
    }
    const cleanName = newName.trim();

    setProfile(prev => {
      if (!prev) {
        return null;
      }
      const updated = {...prev, name: cleanName};
      LibraryStorage.saveProfile(updated);
      return updated;
    });
  };

  const updateAvatarId = async (id: string | undefined) => {
    setProfile(prev => {
      if (!prev) {
        return null;
      }
      const updated = {...prev, avatarId: id};
      LibraryStorage.saveProfile(updated);
      return updated;
    });
  };

  const getInitials = useCallback(() => {
    if (!profile || !profile.name) {
      return 'MF';
    }
    if (profile.avatarText) {
      return profile.avatarText;
    }

    const parts = profile.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || 'MF';
  }, [profile]);

  return {
    profile,
    isLoading,
    updateProfileName,
    updateAvatarId,
    getInitials,
    refreshProfile: loadProfile,
  };
}
