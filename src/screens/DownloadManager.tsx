import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  FlatList,
  Platform,
  StatusBar,
  Image,
  TextInput,
  Linking,
  NativeModules,
} from 'react-native';
import {CacheStorage} from '../services/storage/cache.storage';
import {DownloadService, DownloadRecord} from '../services/download.service';
import {ScraperService} from '../services/scraper.service';
import {colors, radius, spacing, typography} from '../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {DownloadCard} from '../components/cards/DownloadCard';
import {Container} from '../components/layout/Container';
import {CatalogItem} from '../data/models';

interface DownloadManagerProps {
  onBack: () => void;
  onSelectItem?: (item: CatalogItem) => void;
}

type TabType = 'all' | 'downloading' | 'completed' | 'failed';

interface DownloadedMovieCardProps {
  task: any;
  onPress: () => void;
  onRemove: () => void;
}

const DownloadedMovieCard: React.FC<DownloadedMovieCardProps> = ({
  task,
  onPress,
  onRemove,
}) => {
  return (
    <View style={styles.horizontalCard}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.cardMainClickable}>
        {/* Left: Image Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {task.imageUrl ? (
            <Image
              source={{uri: task.imageUrl}}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Icon
                name="film-outline"
                size={24}
                color={colors.textSecondary}
              />
            </View>
          )}
          {/* Small check overlay in corner */}
          <View style={styles.thumbnailCheckBadge}>
            <Icon name="checkmark" size={10} color="#FFFFFF" />
          </View>
        </View>

        {/* Middle: Info Content */}
        <View style={styles.infoContainer}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {task.movieTitle}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {task.resolution} • {task.fileSize}
          </Text>
          <Text style={styles.cardDetails}>
            Offline Library • {task.year || '2024'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Right: Actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          onPress={onPress}
          style={styles.playButton}
          activeOpacity={0.7}>
          <Icon name="play-circle-outline" size={30} color="#00F5FF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRemove}
          style={styles.deleteButton}
          activeOpacity={0.7}
          accessibilityLabel="Delete download"
          accessibilityRole="button">
          <Icon name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const DownloadManagerScreen: React.FC<DownloadManagerProps> = ({
  onBack,
  onSelectItem,
}) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [catalogCache, setCatalogCache] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const service = DownloadService.getInstance();
    const unsubscribe = (list: DownloadRecord[]) => {
      setDownloads(list);
    };

    service.addListener(unsubscribe);

    const loadCatalogCache = async () => {
      try {
        const cache = await CacheStorage.getCatalogCache();
        if (cache && cache.data) {
          setCatalogCache(cache.data);
        }
      } catch (e) {
        console.log('Failed to load catalog cache in downloads screen', e);
      }
    };
    loadCatalogCache();

    const backAction = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      service.removeListener(unsubscribe);
      backHandler.remove();
    };
  }, [onBack]);

  const handlePause = (id: string) => {
    DownloadService.getInstance().pauseDownload(id);
  };

  const handleResume = (id: string) => {
    DownloadService.getInstance().resumeDownload(id);
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes',
          onPress: () => {
            DownloadService.getInstance().cancelDownload(id);
          },
        },
      ],
    );
  };

  const handleRemove = (id: string) => {
    Alert.alert(
      'Delete download?',
      'This will remove the downloaded file from your device.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            DownloadService.getInstance().removeDownloadRecord(id);
          },
        },
      ],
    );
  };

  const handlePlayOffline = async (task: any) => {
    try {
      if (Platform.OS === 'android') {
        const {DownloadModule} = NativeModules;
        await DownloadModule.playVideo(task.fileName);
      } else {
        const localUrl = `file:///storage/emulated/0/Download/CineApp/${task.fileName}`;
        await Linking.openURL(localUrl);
      }
    } catch (e: any) {
      console.log('Error opening local video:', e);
      Alert.alert(
        'Playback Error',
        'Could not open the local file with any video player. Would you like to stream/download it online instead?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Stream Online',
            onPress: () => {
              Linking.openURL(task.downloadUrl).catch(err =>
                console.error('Failed to open URL:', err),
              );
            },
          },
        ],
      );
    }
  };

  // Map Service Record to Domain Task type
  const mapRecordToTask = (record: DownloadRecord) => {
    const matchedItem = catalogCache.find(item => {
      const cleanRecordTitle = record.movieTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
      const cleanItemTitle = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
      return (
        cleanRecordTitle.startsWith(cleanItemTitle) ||
        cleanItemTitle.startsWith(cleanRecordTitle)
      );
    });

    return {
      id: record.id,
      movieTitle: record.movieTitle,
      fileSize: record.fileSize,
      downloadUrl: record.downloadUrl,
      fileName: record.fileName,
      progress: record.progress,
      status: record.status as any,
      downloadSpeed: record.downloadSpeed,
      downloadedSize: record.downloadedSize,
      eta: record.eta,
      logs: record.logs,
      imageUrl: record.imageUrl || matchedItem?.imageUrl,
      resolution: matchedItem?.resolution || 'HD',
    };
  };

  const allTasks = downloads.map(mapRecordToTask);

  const downloadingTasks = allTasks.filter(
    task =>
      task.status === 'downloading' ||
      task.status === 'paused' ||
      task.status === 'pending',
  );

  const completedTasks = allTasks.filter(task => task.status === 'completed');

  const failedTasks = allTasks.filter(
    task => task.status === 'failed' || task.status === 'cancelled',
  );

  const counts = {
    all: downloads.length,
    downloading: downloadingTasks.length,
    completed: completedTasks.length,
    failed: failedTasks.length,
  };

  // Status bar offset calculation
  const safeAreaTop =
    Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4;

  const handleSelectCatalogItem = (movieTitle: string) => {
    const matchedItem = catalogCache.find(
      item =>
        item.title.toLowerCase().trim() === movieTitle.toLowerCase().trim(),
    );
    if (matchedItem && onSelectItem) {
      onSelectItem(matchedItem);
    }
  };

  // Search Filter utility
  const filterBySearch = (tasks: any[]) => {
    if (!searchQuery.trim()) {
      return tasks;
    }
    const q = searchQuery.toLowerCase();
    return tasks.filter(task => task.movieTitle.toLowerCase().includes(q));
  };

  const renderEmptyState = (message: string) => {
    return (
      <View style={styles.emptyTabContainer}>
        <View style={styles.emptyIconCircle}>
          <Icon name="arrow-down-outline" size={32} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No downloads</Text>
        <Text style={styles.emptyDesc}>{message}</Text>
      </View>
    );
  };

  // Render components for list header (Downloading tasks & headers)
  const renderListHeader = () => {
    const activeDownloading = filterBySearch(downloadingTasks);
    const activeCompleted = filterBySearch(completedTasks);

    return (
      <View style={styles.listHeaderContainer}>
        {/* Render Downloading Section if items exist and "All" or "Downloading" filter is active */}
        {(activeTab === 'all' || activeTab === 'downloading') &&
          activeDownloading.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Downloading</Text>
                {activeTab === 'all' && (
                  <TouchableOpacity
                    onPress={() => setActiveTab('downloading')}
                    style={styles.viewAllBtn}
                    activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                    <Icon
                      name="chevron-forward"
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sectionListGap}>
                {activeDownloading.map(task => (
                  <DownloadCard
                    key={task.id}
                    task={task}
                    onPause={() => handlePause(task.id)}
                    onResume={() => handleResume(task.id)}
                    onCancel={() => handleCancel(task.id)}
                    onRemove={() => handleRemove(task.id)}
                    onToggleLogs={() =>
                      setExpandedLogId(
                        expandedLogId === task.id ? null : task.id,
                      )
                    }
                    isLogsExpanded={expandedLogId === task.id}
                  />
                ))}
              </View>
            </View>
          )}

        {/* Section Header for Completed items */}
        {activeTab === 'all' && activeCompleted.length > 0 && (
          <Text style={styles.sectionHeaderDownloaded}>Downloaded</Text>
        )}
      </View>
    );
  };

  return (
    <Container style={styles.container}>
      {/* Header with workable search toggle */}
      <View
        style={[
          styles.header,
          {paddingTop: safeAreaTop, height: 68 + safeAreaTop},
        ]}>
        {isSearching ? (
          <>
            <View style={styles.headerLeft}>
              <TextInput
                style={styles.headerSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search downloads..."
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Close search"
                accessibilityRole="button">
                <Icon
                  name="close-outline"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Downloads</Text>
              <Text style={styles.headerSubtitle}>Your offline library</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setIsSearching(true)}
                activeOpacity={0.7}
                accessibilityLabel="Search downloads"
                accessibilityRole="button">
                <Icon
                  name="search-outline"
                  size={22}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Filter Tabs (Only shown if downloads exist) */}
      <View style={styles.tabsWrapper}>
        {(['all', 'downloading', 'completed', 'failed'] as TabType[]).map(
          tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                activeTab === tab && styles.tabItemActive,
              ]}
              onPress={() => {
                setActiveTab(tab);
                const clickTime = new Date().toLocaleTimeString();
                ScraperService.getInstance().log(
                  `Download Tab clicked: "${tab}" at ${clickTime}`,
                  'info',
                );
              }}
              activeOpacity={0.7}
              accessibilityLabel={`${tab} filter`}
              accessibilityRole="tab">
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab] || 0}
                )
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      {/* Populated State Renderer */}
      {activeTab === 'downloading' ? (
        // Only show downloading list
        <FlatList
          key="downloading-list"
          data={filterBySearch(downloadingTasks)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState(
            'You do not have any active downloads right now.',
          )}
          renderItem={({item}) => (
            <DownloadCard
              task={item}
              onPause={() => handlePause(item.id)}
              onResume={() => handleResume(item.id)}
              onCancel={() => handleCancel(item.id)}
              onRemove={() => handleRemove(item.id)}
              onToggleLogs={() =>
                setExpandedLogId(expandedLogId === item.id ? null : item.id)
              }
              isLogsExpanded={expandedLogId === item.id}
            />
          )}
        />
      ) : activeTab === 'failed' ? (
        // Only show failed list
        <FlatList
          key="failed-list"
          data={filterBySearch(failedTasks)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState(
            'No failed or cancelled downloads found.',
          )}
          renderItem={({item}) => (
            <DownloadCard
              task={item}
              onPause={() => handlePause(item.id)}
              onResume={() => handleResume(item.id)}
              onCancel={() => handleCancel(item.id)}
              onRemove={() => handleRemove(item.id)}
              onToggleLogs={() =>
                setExpandedLogId(expandedLogId === item.id ? null : item.id)
              }
              isLogsExpanded={expandedLogId === item.id}
            />
          )}
        />
      ) : activeTab === 'completed' ? (
        // Only show completed list
        <FlatList
          key="completed-list"
          data={filterBySearch(completedTasks)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState(
            'Download movies and shows to watch them offline.',
          )}
          renderItem={({item}) => (
            <DownloadedMovieCard
              task={item}
              onPress={() => handlePlayOffline(item)}
              onRemove={() => handleRemove(item.id)}
            />
          )}
        />
      ) : (
        // "All" tab: Combined Layout (Downloading list + Completed list)
        <FlatList
          key="all-list"
          data={filterBySearch(completedTasks)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            downloadingTasks.length === 0
              ? renderEmptyState(
                  'Download movies and shows to watch them offline.',
                )
              : null
          }
          renderItem={({item}) => (
            <DownloadedMovieCard
              task={item}
              onPress={() => handlePlayOffline(item)}
              onRemove={() => handleRemove(item.id)}
            />
          )}
        />
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSearchInput: {
    color: '#FFFFFF',
    fontSize: 16,
    padding: 0,
    fontWeight: typography.weights.semibold,
  },
  tabsWrapper: {
    height: 48,
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  emptyScroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 48,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.2)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: typography.weights.bold,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseBtn: {
    height: 44,
    paddingHorizontal: 28,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.weights.semibold,
  },
  infoSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 24,
    gap: 16,
  },
  infoSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.weights.semibold,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
  infoRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.weights.semibold,
  },
  infoRowDesc: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  listHeaderContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: 2,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  sectionListGap: {
    gap: 12,
  },
  emptyTabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.md,
    gap: 16,
    paddingBottom: 40,
  },
  gridListContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingBottom: 40,
  },
  horizontalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#171923',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardMainClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 100,
    height: 60,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailCheckBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    borderRadius: 8,
    padding: 2,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  cardDetails: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 8,
  },
  sectionHeaderDownloaded: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: typography.weights.semibold,
    marginBottom: 12,
    marginTop: 8,
  },
});

export default DownloadManagerScreen;
