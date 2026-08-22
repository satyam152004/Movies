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
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useProfile} from '../hooks/useProfile';
import {useLibrary} from '../hooks/useLibrary';
import {usePreferences} from '../hooks/usePreferences';
import {colors, radius, spacing, typography} from '../theme';
import {CacheStorage} from '../services/storage/cache.storage';
import {BackupService} from '../services/backup.service';

const BUILTIN_AVATARS = [
  {id: 'avatar_popcorn', emoji: '🍿'},
  {id: 'avatar_director', emoji: '🎬'},
  {id: 'avatar_camera', emoji: '🎥'},
  {id: 'avatar_theater', emoji: '🎭'},
  {id: 'avatar_superhero', emoji: '🦸'},
  {id: 'avatar_cool', emoji: '🕶️'},
];

interface ProfileScreenProps {
  onSwitchTab: (
    tabName: 'home' | 'search' | 'downloads' | 'watchlist' | 'profile',
  ) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({onSwitchTab}) => {
  const {
    profile,
    updateProfileName,
    updateAvatarId,
    getInitials,
    refreshProfile,
  } = useProfile();
  const {counts, refreshLibrary} = useLibrary();
  const {refreshPreferences} = usePreferences();

  // Edit Profile modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | undefined>(
    undefined,
  );
  const [lastBackupStr, setLastBackupStr] = useState<string>('Never');

  // Load last backup timestamp on mount
  useEffect(() => {
    const loadBackupTime = async () => {
      const stored = await CacheStorage.getDiscoveredUrl(); // simple storage utility
      // Let's read from general AsyncStorage key
      try {
        const time = await CacheStorage.getTmdbCache('last_backup_time');
        if (time) {
          setLastBackupStr(
            new Date(time).toLocaleDateString() +
              ' ' +
              new Date(time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
          );
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


  const handleBackup = async () => {
    try {
      // Orchestrated Native File Export
      const success = await BackupService.runExport();
      if (!success) return;

      const now = Date.now();
      await CacheStorage.saveTmdbCache(
        'last_backup_time',
        now,
        365 * 24 * 60 * 60 * 1000,
      );
      setLastBackupStr(
        new Date(now).toLocaleDateString() +
          ' ' +
          new Date(now).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
      );
      Alert.alert('Success', 'Backup file saved successfully!');
    } catch (e: any) {
      if (e.message && e.message.includes('cancelled')) return;
      Alert.alert('Backup Error', 'Failed to generate and save backup file.');
    }
  };

  const handleRestore = async () => {
    try {
      // Orchestrated Native File Import
      const importResult = await BackupService.runImport();
      if (!importResult) return;

      const {backupStr, timestamp} = importResult;
      const backupDate = timestamp 
        ? new Date(timestamp).toLocaleDateString() 
        : 'Unknown Date';

      Alert.alert(
        'Confirm Restore',
        `Restore backup generated on ${backupDate}?\n\nThis will overwrite your current Watchlist, History, Favorites, and Playback Preferences.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Restore',
            onPress: async () => {
              try {
                await BackupService.applyImport(backupStr);
                
                // Refresh all hooks reactively
                await refreshProfile();
                await refreshLibrary();
                await refreshPreferences();
                
                Alert.alert('Success', 'Library backup restored successfully!');
              } catch (err) {
                Alert.alert('Error', 'Failed to apply restore.');
              }
            },
          },
        ],
      );
    } catch (e: any) {
      if (e.message && e.message.includes('cancelled')) return;
      Alert.alert('Restore Error', 'Failed to read or parse backup file.');
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
      ],
    );
  };

  const safeAreaTop =
    Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4;
  const bottomInset = 60 + (Platform.OS === 'ios' ? 34 : 16) + 12;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.screenHeader,
          {paddingTop: safeAreaTop, height: 56 + safeAreaTop},
        ]}>
        <View style={styles.headerContent}>
          <Text style={styles.screenTitle}>Profile</Text>
          <TouchableOpacity onPress={openEditModal} activeOpacity={0.7}>
            <Icon name="settings-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: bottomInset},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {profile?.avatarId ? (
                <Text style={styles.avatarEmoji}>
                  {BUILTIN_AVATARS.find(a => a.id === profile.avatarId)?.emoji ||
                    '🍿'}
                </Text>
              ) : (
                <Text style={styles.avatarText}>{getInitials()}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.avatarEditBadge} onPress={openEditModal}>
              <Icon name="pencil" size={10} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{profile?.name || 'Satyam Patel'}</Text>
          <Text style={styles.profileEmail}>
            {profile?.name
              ? profile.name.toLowerCase().replace(/\s+/g, '.') + '@email.com'
              : 'satyam@email.com'}
          </Text>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{counts.history}</Text>
            <Text style={styles.statLabel}>Movies</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{counts.downloads}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{counts.watchlist}</Text>
            <Text style={styles.statLabel}>Watchlist</Text>
          </View>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={openEditModal}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrapper, {backgroundColor: colors.primary}]}>
                <Icon name="settings" size={18} color={colors.white} />
              </View>
              <Text style={styles.menuLabel}>Settings</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Theme', 'App theme is locked to premium dark mode.')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrapper, {backgroundColor: colors.success}]}>
                <Icon name="color-palette" size={18} color={colors.white} />
              </View>
              <Text style={styles.menuLabel}>Theme</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={styles.menuValue}>Auto</Text>
              <Icon name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

        </View>

      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitle}>Profile Settings</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight: 400}}>
              <Text style={styles.modalSubTitle}>Profile Name</Text>
              <TextInput
                style={styles.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                placeholderTextColor={colors.textMuted}
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

              <Text style={styles.modalSubTitle}>Data & Backup</Text>
              
              <TouchableOpacity style={styles.modalActionButton} onPress={handleBackup}>
                <Icon name="cloud-upload" size={16} color={colors.white} />
                <Text style={styles.modalActionButtonText}>Backup Library</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalActionButton} onPress={handleRestore}>
                <Icon name="cloud-download" size={16} color={colors.white} />
                <Text style={styles.modalActionButtonText}>Restore Backup</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalActionButton, {backgroundColor: colors.elevated}]} onPress={handleClearCache}>
                <Icon name="trash-bin" size={16} color={colors.white} />
                <Text style={styles.modalActionButtonText}>Clear Scraper Cache</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalBackupDesc}>Last backup: {lastBackupStr}</Text>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}>
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  screenTitle: {
    color: colors.textPrimary,
    ...typography.tokens.bodyMedium,
    fontSize: 20,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.elevated,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
  },
  avatarEmoji: {
    fontSize: 42,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statsDivider: {
    width: 1,
    backgroundColor: colors.border,
    height: '60%',
  },
  menuContainer: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  menuValue: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 10,
    gap: 8,
  },
  logoutBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    fontWeight: '800',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.elevated,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  avatarPickCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickCircleActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}26`,
  },
  avatarPickEmoji: {
    fontSize: 20,
  },
  avatarPickInitialsText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackupDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
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
});
