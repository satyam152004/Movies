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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    <View style={styles.gridCard}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={styles.gridPosterWrapper}>
          {task.imageUrl ? (
            <Image
              source={{uri: task.imageUrl}}
              style={styles.gridPoster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.gridPosterPlaceholder}>
              <Icon name="film-outline" size={32} color={colors.textMuted} />
            </View>
          )}
          {/* Downloaded Check Indicator Overlay */}
          <View style={styles.checkIndicator}>
            <Icon name="checkmark-circle" size={18} color={colors.success} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.gridInfo}>
        <View style={styles.gridTitleRow}>
          <Text style={styles.gridMovieTitle} numberOfLines={1}>
            {task.movieTitle}
          </Text>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            style={styles.gridMoreBtn}
            accessibilityLabel="Delete download"
            accessibilityRole="button">
            <Icon name="trash-outline" size={13} color={colors.danger} />
          </TouchableOpacity>
        </View>
        <Text style={styles.gridMetaText}>
          {task.resolution} • {task.fileSize}
        </Text>
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
        const stored = await AsyncStorage.getItem('@catalog_cache');
        if (stored) {
          setCatalogCache(JSON.parse(stored));
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
    const localUrl = `file:///storage/emulated/0/Download/CineApp/${task.fileName}`;
    try {
      const canOpen = await Linking.canOpenURL(localUrl);
      if (canOpen) {
        await Linking.openURL(localUrl);
      } else {
        await Linking.openURL(task.downloadUrl);
      }
    } catch (e) {
      await Linking.openURL(task.downloadUrl);
    }
  };

  // Map Service Record to Domain Task type
  const mapRecordToTask = (record: DownloadRecord) => {
    const matchedItem = catalogCache.find(item => {
      const cleanRecordTitle = record.movieTitle.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const cleanItemTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
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
      imageUrl: matchedItem?.imageUrl,
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

  // State 1 — No downloads (Empty State Layout)
  if (downloads.length === 0) {
    return (
      <Container style={styles.container}>
        {/* Header - Sits directly below SafeArea, no back button */}
        <View
          style={[
            styles.header,
            {paddingTop: safeAreaTop, height: 68 + safeAreaTop},
          ]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Downloads</Text>
            <Text style={styles.headerSubtitle}>Your offline library</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
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
        </View>

        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.emptyStateContainer}>
            {/* Visual Hero Art */}
            <View style={styles.emptyIconCircle}>
              <Icon name="download-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              Your downloads are waiting here
            </Text>
            <Text style={styles.emptyDesc}>
              Download movies and shows to watch them anytime, even without an
              internet connection.
            </Text>

            <TouchableOpacity
              style={styles.browseBtn}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityLabel="Browse Movies"
              accessibilityRole="button">
              <Text style={styles.browseBtnText}>Browse Movies</Text>
            </TouchableOpacity>

            {/* Why download info section */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Why download?</Text>

              <View style={styles.infoRow}>
                <Icon
                  name="play-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoRowTitle}>Watch offline</Text>
                  <Text style={styles.infoRowDesc}>
                    Enjoy your favorite movies anywhere.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Icon name="wifi-outline" size={20} color={colors.primary} />
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoRowTitle}>Save data</Text>
                  <Text style={styles.infoRowDesc}>
                    Download over Wi-Fi and save mobile data.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Icon name="heart-outline" size={20} color={colors.primary} />
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoRowTitle}>Keep favorites</Text>
                  <Text style={styles.infoRowDesc}>
                    Keep downloaded movies available offline.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </Container>
    );
  }

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
                    <Icon name="chevron-forward" size={14} color={colors.primary} />
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
                ScraperService.getInstance().log(`Download Tab clicked: "${tab}" at ${clickTime}`, 'info');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`${tab} filter`}
              accessibilityRole="tab">
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab] || 0})
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
        // Only show completed 2-column grid
        <FlatList
          key="completed-grid"
          data={filterBySearch(completedTasks)}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRowWrapper}
          contentContainerStyle={styles.gridListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => (
            <DownloadedMovieCard
              task={item}
              onPress={() => handlePlayOffline(item)}
              onRemove={() => handleRemove(item.id)}
            />
          )}
        />
      ) : (
        // "All" tab: Combined Layout (Downloading list + Completed 2-column grid)
        <FlatList
          key="all-grid"
          data={filterBySearch(completedTasks)}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRowWrapper}
          contentContainerStyle={styles.gridListContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
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
    borderRadius: radius.cardControl,
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
    paddingTop: 8,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  listContent: {
    padding: spacing.md,
    gap: 16,
    paddingBottom: 40,
  },
  gridListContent: {
    paddingVertical: spacing.md,
    paddingBottom: 40,
  },
  gridCard: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  gridPosterWrapper: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: colors.elevated,
    position: 'relative',
  },
  gridPoster: {
    width: '100%',
    height: '100%',
  },
  gridPosterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    borderRadius: 12,
    padding: 2,
  },
  gridInfo: {
    padding: 8,
    gap: 2,
  },
  gridTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridMovieTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.weights.semibold,
    flex: 1,
    marginRight: 4,
  },
  gridMoreBtn: {
    padding: 2,
  },
  gridMetaText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  gridRowWrapper: {
    paddingHorizontal: 8,
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
