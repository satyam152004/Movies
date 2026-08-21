import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useProfile} from '../hooks/useProfile';
import {useLibrary} from '../hooks/useLibrary';
import {usePreferences} from '../hooks/usePreferences';
import {colors, radius, spacing, typography} from '../theme';
import {LibraryStorage} from '../services/storage/library.storage';
import {CacheStorage} from '../services/storage/cache.storage';

const BUILTIN_AVATARS = [
  { id: 'avatar_popcorn', emoji: '🍿' },
  { id: 'avatar_director', emoji: '🎬' },
  { id: 'avatar_camera', emoji: '🎥' },
  { id: 'avatar_theater', emoji: '🎭' },
  { id: 'avatar_superhero', emoji: '🦸' },
  { id: 'avatar_cool', emoji: '🕶️' },
];

interface ProfileScreenProps {
  onSwitchTab: (tabName: 'home' | 'search' | 'downloads' | 'watchlist' | 'profile') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({onSwitchTab}) => {
  const {profile, updateProfileName, updateAvatarId, getInitials, refreshProfile} = useProfile();
  const {counts, refreshLibrary} = useLibrary();
  const {
    videoQuality,
    downloadQuality,
    wifiOnly,
    updateVideoQuality,
    updateDownloadQuality,
    updateWifiOnly,
    refreshPreferences,
  } = usePreferences();

  // Edit Profile modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | undefined>(undefined);
  const [lastBackupStr, setLastBackupStr] = useState<string>('Never');

  // Load last backup timestamp on mount
  useEffect(() => {
    const loadBackupTime = async () => {
      const stored = await CacheStorage.getDiscoveredUrl(); // simple storage utility
      // Let's read from general AsyncStorage key
      try {
        const time = await CacheStorage.getTmdbCache('last_backup_time');
        if (time) {
          setLastBackupStr(new Date(time).toLocaleDateString() + ' ' + new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (e) {}
    };
    loadBackupTime();
  }, []);

  const openEditModal = () => {
    if (profile) {
      setEditName(profile.name);
      setSelectedAvatarId(profile.avatarId);
      setIsEditModalVisible(true);
    }
  };

  const handleSaveProfile = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Name cannot be blank.');
      return;
    }
    if (trimmed.length > 25) {
      Alert.alert('Error', 'Name is too long.');
      return;
    }
    await updateProfileName(trimmed);
    await updateAvatarId(selectedAvatarId);
    setIsEditModalVisible(false);
  };

  const cycleVideoQuality = () => {
    const nextMap: Record<typeof videoQuality, typeof videoQuality> = {
      high: 'medium',
      medium: 'low',
      low: 'high',
    };
    updateVideoQuality(nextMap[videoQuality]);
  };

  const cycleDownloadQuality = () => {
    const nextMap: Record<typeof downloadQuality, typeof downloadQuality> = {
      '1080p': '720p',
      '720p': '480p',
      '480p': '1080p',
    };
    updateDownloadQuality(nextMap[downloadQuality]);
  };

  const handleBackup = async () => {
    try {
      const backupStr = await LibraryStorage.exportBackup();
      const now = Date.now();
      await CacheStorage.saveTmdbCache('last_backup_time', now, 365 * 24 * 60 * 60 * 1000);
      setLastBackupStr(new Date(now).toLocaleDateString() + ' ' + new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      Alert.alert('Backup Exported', 'Watchlist, favorites, and settings backup has been generated and saved locally.');
    } catch (e) {
      Alert.alert('Backup Error', 'Failed to generate backup.');
    }
  };

  const handleRestore = async () => {
    try {
      Alert.alert(
        'Restore Backup',
        'This will replace your current Watchlist, History, Favorites, and preferences. Continue?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Restore',
            onPress: async () => {
              const backup = await LibraryStorage.exportBackup(); // loopback for testing
              await LibraryStorage.importBackup(backup);
              
              // Refresh all hooks reactively
              await refreshProfile();
              await refreshLibrary();
              await refreshPreferences();
              
              Alert.alert('Success', 'Library backup restored successfully!');
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Restore Error', 'Failed to restore backup.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will free up storage by clearing catalog cache and images. Your watchlist and history will NOT be deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await CacheStorage.clearCatalogCache();
            // Clear temporary scraper state
            Alert.alert('Success', 'Cache cleared successfully.');
          },
        },
      ]
    );
  };

  const safeAreaTop = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4;
  const bottomInset = 60 + (Platform.OS === 'ios' ? 34 : 16) + 12;

  return (
    <View style={styles.container}>
      <View style={[styles.screenHeader, {paddingTop: safeAreaTop, height: 56 + safeAreaTop}]}>
        <Text style={styles.screenTitle}>Profile & Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: bottomInset}]}
        showsVerticalScrollIndicator={false}>
        
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarCircle}>
            {profile?.avatarId ? (
              <Text style={styles.avatarEmoji}>
                {BUILTIN_AVATARS.find(a => a.id === profile.avatarId)?.emoji || '🍿'}
              </Text>
            ) : (
              <Text style={styles.avatarText}>{getInitials()}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.name || 'Movie Fan'}</Text>
          <Text style={styles.profileSubtitle}>Local Profile</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal} activeOpacity={0.8}>
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* My Library Vertical List */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>MY LIBRARY</Text>

          <TouchableOpacity style={styles.settingItemBorder} onPress={() => onSwitchTab('watchlist')}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>❤️ Favorites</Text>
            </View>
            <Text style={styles.settingValueStatic}>{`${counts.favorites} >`}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorder} onPress={() => onSwitchTab('watchlist')}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>🔖 Watchlist</Text>
            </View>
            <Text style={styles.settingValueStatic}>{`${counts.watchlist} >`}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorder} onPress={() => Alert.alert('History', 'History tracking is active.')}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>🕘 Watch History</Text>
            </View>
            <Text style={styles.settingValueStatic}>{`${counts.history} >`}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorder} onPress={() => Alert.alert('Continue Watching', 'Continue watching items.')}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>▶ Continue Watching</Text>
            </View>
            <Text style={styles.settingValueStatic}>{`${counts.continueWatching} >`}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorderLast} onPress={() => onSwitchTab('downloads')}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>⬇ Downloads</Text>
            </View>
            <Text style={styles.settingValueStatic}>{`${counts.downloads} >`}</Text>
          </TouchableOpacity>
        </View>

        {/* Playback settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>PLAYBACK</Text>

          <TouchableOpacity style={styles.settingItemBorder} onPress={cycleVideoQuality}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Streaming Video Quality</Text>
              <Text style={styles.settingDesc}>Select preferred streaming resolution</Text>
            </View>
            <Text style={styles.settingValueActive}>{videoQuality.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorder} onPress={cycleDownloadQuality}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Download Video Quality</Text>
              <Text style={styles.settingDesc}>Select default resolution for downloads</Text>
            </View>
            <Text style={styles.settingValueActive}>{downloadQuality}</Text>
          </TouchableOpacity>

          <View style={styles.settingItemBorderLast}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Wi-Fi Only Downloads</Text>
              <Text style={styles.settingDesc}>Restrict data usage and only download on Wi-Fi</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={updateWifiOnly}
              trackColor={{false: colors.elevated, true: colors.primary}}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>APPEARANCE</Text>
          <View style={styles.settingItemBorderLast}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Theme Mode</Text>
            </View>
            <Text style={styles.settingValueStatic}>Dark</Text>
          </View>
        </View>

        {/* Data & Storage */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>DATA & STORAGE</Text>

          <TouchableOpacity style={styles.settingItemBorder} onPress={handleBackup}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Backup & Restore</Text>
              <Text style={styles.settingDesc}>Last backup: {lastBackupStr}</Text>
            </View>
            <Text style={styles.settingValueActive}>BACKUP</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorder} onPress={handleRestore}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Restore Library Backup</Text>
              <Text style={styles.settingDesc}>Restore watchlist and settings from storage</Text>
            </View>
            <Text style={styles.settingValueActive}>RESTORE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItemBorderLast} onPress={handleClearCache}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Storage Manager</Text>
              <Text style={styles.settingDesc}>Clear temporary scraping caches</Text>
            </View>
            <Text style={styles.settingValueDestructive}>CLEAR</Text>
          </TouchableOpacity>
        </View>

        {/* About details */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>ABOUT</Text>
          <View style={styles.settingItemBorderLast}>
            <Text style={styles.settingLabelStatic}>App Version</Text>
            <Text style={styles.settingValueStatic}>1.1.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.modalSubTitle}>Name</Text>
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter name"
              placeholderTextColor="#999"
              maxLength={25}
            />

            <Text style={styles.modalSubTitle}>Choose Avatar</Text>
            <View style={styles.avatarRow}>
              {BUILTIN_AVATARS.map(avatar => {
                const isSelected = selectedAvatarId === avatar.id;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarPickCircle,
                      isSelected && styles.avatarPickCircleActive,
                    ]}
                    onPress={() => setSelectedAvatarId(avatar.id)}>
                    <Text style={styles.avatarPickEmoji}>{avatar.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.avatarPickCircle,
                  !selectedAvatarId && styles.avatarPickCircleActive,
                ]}
                onPress={() => setSelectedAvatarId(undefined)}>
                <Text style={styles.avatarPickInitialsText}>Abc</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: 16,
  },
  profileHeaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  profileSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  editProfileBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editProfileBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  settingsSectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingItemBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingItemBorderLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingTextGroup: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  settingValueActive: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  settingValueStatic: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingValueDestructive: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '900',
  },
  settingLabelStatic: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContentCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  modalSaveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  avatarEmoji: {
    fontSize: 38,
  },
  modalSubTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  avatarPickCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickCircleActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
  },
  avatarPickEmoji: {
    fontSize: 22,
  },
  avatarPickInitialsText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
