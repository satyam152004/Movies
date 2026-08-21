import React, {useState, useEffect, useMemo} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  FlatList,
  Image,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {PreferencesStorage} from './src/services/storage/preferences.storage';
import {LibraryStorage} from './src/services/storage/library.storage';
import {useCatalog} from './src/hooks/useCatalog';
import {HomeScreen} from './src/screens/HomeScreen';
import {SearchScreen} from './src/screens/SearchScreen';
import {MovieDetailScreen} from './src/screens/MovieDetail';
import {CollectionScreen} from './src/screens/CollectionScreen';
import {DownloadManagerScreen} from './src/screens/DownloadManager';
import {ProfileScreen} from './src/screens/ProfileScreen';
import {HiddenWebView} from './src/components/HiddenWebView';
import {CatalogItem, MovieDetail} from './src/data/models';
import {ScraperService} from './src/services/scraper.service';
import {DownloadService} from './src/services/download.service';
import {UrlDiscoveryService} from './src/services/urlDiscovery.service';
import {TmdbService} from './src/services/tmdb.service';
import {colors, radius, spacing, zIndex} from './src/theme';
import {MovieCard} from './src/components/cards/MovieCard';
import {EmptyState} from './src/components/feedback/EmptyState';

type ActiveTab = 'home' | 'search' | 'downloads' | 'watchlist' | 'profile';
type ActiveScreen = 'main' | 'detail' | 'collection';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [screen, setScreen] = useState<ActiveScreen>('main');
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null);
  const [collectionParams, setCollectionParams] = useState<{
    title: string;
    items: CatalogItem[];
    type: string;
  } | null>(null);
  const [isConsoleVisible, setIsConsoleVisible] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [watchlist, setWatchlist] = useState<CatalogItem[]>([]);
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>(
    'high',
  );
  const [downloadQuality, setDownloadQuality] = useState<
    '1080p' | '720p' | '480p'
  >('1080p');
  const [wifiOnly, setWifiOnly] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // useCatalog SWR hook
  const {
    movies: catalogItems,
    status: catalogStatus,
    isRefreshing: isCatalogRefreshing,
    error: catalogError,
    isOffline: isCatalogOffline,
    lastUpdatedMessage,
    refresh: refreshCatalog,
    loadMore: loadMoreCatalog,
  } = useCatalog(selectedCategory);

  const [isDomainResolving, setIsDomainResolving] = useState(true);
  useEffect(() => {
    if (catalogStatus !== 'idle' && catalogStatus !== 'loading') {
      setIsDomainResolving(false);
    }
  }, [catalogStatus]);

  // Track catalog page locally for loadMoreCatalogHook pagination
  const [catalogPage, setCatalogPage] = useState(1);
  useEffect(() => {
    setCatalogPage(1);
  }, [selectedCategory]);

  const loadMoreCatalogHook = async () => {
    if (catalogStatus === 'loading' || isCatalogRefreshing) {
      return;
    }
    const nextPage = catalogPage + 1;
    await loadMoreCatalog(nextPage);
    setCatalogPage(nextPage);
  };

  // Initialize download service
  DownloadService.getInstance();
  const scraper = ScraperService.getInstance();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedWatchlist = await LibraryStorage.getWatchlist();
        setWatchlist(storedWatchlist);

        const storedVideo = await PreferencesStorage.getVideoQuality();
        setVideoQuality(storedVideo);

        const storedDownload = await PreferencesStorage.getDownloadQuality();
        setDownloadQuality(storedDownload);

        const storedWifi = await PreferencesStorage.getWifiOnly();
        setWifiOnly(storedWifi);
      } catch (e) {
        console.error('Failed to load initial settings', e);
      }
    };
    loadSettings();
  }, []);

  const handleUpdateVideoQuality = async (val: 'high' | 'medium' | 'low') => {
    setVideoQuality(val);
    await PreferencesStorage.saveVideoQuality(val);
  };

  const handleUpdateDownloadQuality = async (
    val: '1080p' | '720p' | '480p',
  ) => {
    setDownloadQuality(val);
    await PreferencesStorage.saveDownloadQuality(val);
  };

  const handleToggleWifiOnly = async (val: boolean) => {
    setWifiOnly(val);
    await PreferencesStorage.saveWifiOnly(val);
  };

  useEffect(() => {
    const handleBackPress = () => {
      if (screen === 'detail') {
        setScreen('main');
        return true;
      }
      if (screen === 'collection') {
        setScreen('main');
        setCollectionParams(null);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => backHandler.remove();
  }, [screen]);

  const handleSelectItem = async (item: CatalogItem) => {
    scraper.log(
      `Selected item: "${item.title}". Fetching details in background...`,
      'info',
    );

    // Set a partial representation in state and navigate to details instantly!
    const partialMovie: MovieDetail = {
      title: item.title,
      url: item.url,
      imageUrl: item.imageUrl,
      date: '',
      quality: '',
      language: '',
      storyline: '',
      director: '',
      stars: [],
      genres: [],
      screenshots: [],
      categories: [],
      downloadLinks: [],
    };
    setSelectedMovie(partialMovie);
    setScreen('detail');
    setIsDetailLoading(true);
    try {
      const detail = await scraper.scrapeMovieDetail(item.url);
      if (!detail.imageUrl && item.imageUrl) {
        detail.imageUrl = item.imageUrl;
      }
      // Keep watchlist/active state representation valid but update details
      setSelectedMovie(detail);

      // Hydrate with TMDB details progressively in background
      console.info(`[App Debug] Before enrichment for: "${detail.title}"`);
      TmdbService.getInstance()
        .enrichMovie(detail)
        .then(enrichedDetail => {
          console.info('[App Debug] After enrichment. Enriched properties:', {
            backdropUrl: enrichedDetail.backdropUrl,
            castCount: enrichedDetail.enrichedCast?.length,
            crewCount: enrichedDetail.enrichedCrew?.length,
          });
          console.info('[App Debug] Before setMovie() state update');
          setSelectedMovie(prev => {
            if (prev && prev.url === item.url) {
              // Preserve working imageUrl if enriched response doesn't have it
              if (!enrichedDetail.imageUrl && prev.imageUrl) {
                enrichedDetail.imageUrl = prev.imageUrl;
              }
              return enrichedDetail;
            }
            return prev;
          });
        })
        .catch(e => {
          console.warn('TMDb enrichment background error', e);
        });
    } catch (err: any) {
      scraper.log(
        `Failed to fetch details for: ${item.title}. Error: ${err.message}`,
        'error',
      );
      Alert.alert('Error', `Failed to load details: ${err.message}`);
      setScreen('main');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleToggleWatchlist = async (item: CatalogItem) => {
    try {
      let updatedWatchlist = [...watchlist];
      const isAlreadyAdded = watchlist.some(w => w.url === item.url);

      if (isAlreadyAdded) {
        updatedWatchlist = watchlist.filter(w => w.url !== item.url);
      } else {
        updatedWatchlist.push(item);
      }

      setWatchlist(updatedWatchlist);
      await LibraryStorage.saveWatchlist(updatedWatchlist);
      scraper.log(
        `${isAlreadyAdded ? 'Removed from' : 'Added to'} watchlist: ${
          item.title
        }`,
        'info',
      );
    } catch (e) {
      scraper.log('Failed to save watchlist change', 'error');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            items={catalogItems}
            onSelectItem={handleSelectItem}
            onExplorePress={() => setActiveTab('search')}
            onLoadMore={loadMoreCatalogHook}
            isLoading={catalogStatus === 'loading'}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSearchPress={() => setActiveTab('search')}
            onProfilePress={() => setActiveTab('profile')}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onViewAllPress={(title, items, type) => {
              setCollectionParams({title, items, type});
              setScreen('collection');
            }}
            isRefreshing={isCatalogRefreshing}
            onRefresh={refreshCatalog}
            lastUpdatedMessage={lastUpdatedMessage}
            isOffline={isCatalogOffline}
            error={catalogError}
          />
        );
      case 'search':
        return (
          <SearchScreen
            items={catalogItems}
            onSelectItem={handleSelectItem}
            onViewAllPress={(title, items, type) => {
              setCollectionParams({title, items, type});
              setScreen('collection');
            }}
          />
        );
      case 'downloads':
        return (
          <DownloadManagerScreen
            onBack={() => {
              setActiveTab('home');
            }}
            onSelectItem={handleSelectItem}
          />
        );
      case 'watchlist':
        return renderWatchlistScreen();
      case 'profile':
        return renderProfileScreen();
      default:
        return null;
    }
  };

  const renderWatchlistScreen = () => {
    const safeAreaTop =
      Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4;
    return (
      <View style={styles.tabContainer}>
        <View
          style={[
            styles.screenHeader,
            {paddingTop: safeAreaTop, height: 56 + safeAreaTop},
          ]}>
          <Text style={styles.screenTitle}>My Watchlist</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{watchlist.length} ITEMS</Text>
          </View>
        </View>

        {watchlist.length === 0 ? (
          <EmptyState
            icon={
              <Icon name="heart-outline" size={54} color={colors.primary} />
            }
            title="Your watchlist is empty"
            description="Save movies and shows you want to watch later."
          />
        ) : (
          <FlatList
            data={watchlist}
            keyExtractor={item => item.url}
            renderItem={({item}) => (
              <View style={styles.gridCardWrapper}>
                <MovieCard item={item} onPress={() => handleSelectItem(item)} />
              </View>
            )}
            numColumns={2}
            columnWrapperStyle={styles.gridRowWrapper}
            contentContainerStyle={styles.gridListContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  const renderProfileScreen = () => {
    return <ProfileScreen onSwitchTab={setActiveTab} />;
  };

  const renderContent = () => {
    if (screen === 'detail' && selectedMovie) {
      const isAlreadyWatchlist = watchlist.some(
        w => w.url === selectedMovie.url,
      );
      const catalogItemRepresentation: CatalogItem = {
        title: selectedMovie.title,
        url: selectedMovie.url,
        imageUrl: selectedMovie.imageUrl || '',
      };

      return (
        <MovieDetailScreen
          movie={selectedMovie}
          onBack={() => {
            setScreen('main');
          }}
          onStartDownload={async (title, size, url) => {
            try {
              await DownloadService.getInstance().startDownload(
                title,
                size,
                url,
                selectedMovie.imageUrl,
              );
              setActiveTab('downloads');
              setScreen('main');
            } catch (err: any) {
              Alert.alert(
                'Download Error',
                `Failed to enqueue download: ${err.message}`,
              );
            }
          }}
          isWatchlisted={isAlreadyWatchlist}
          onToggleWatchlist={() =>
            handleToggleWatchlist(catalogItemRepresentation)
          }
          isLoading={isDetailLoading}
        />
      );
    }

    if (screen === 'collection' && collectionParams) {
      const handleLoadMoreCollection = () => {
        if (collectionParams.type === 'latest') {
          loadMoreCatalogHook();
        }
      };

      const collectionItems =
        collectionParams.type === 'latest'
          ? catalogItems
          : collectionParams.items;

      return (
        <CollectionScreen
          title={collectionParams.title}
          items={collectionItems}
          onSelectItem={handleSelectItem}
          onBack={() => {
            setScreen('main');
            setCollectionParams(null);
          }}
          onLoadMore={handleLoadMoreCollection}
          isLoadingMore={catalogStatus === 'loading' && catalogPage > 1}
        />
      );
    }

    return renderTabContent();
  };

  if (isDomainResolving) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent={true}
        />
        <View style={styles.splashContent}>
          <Image
            source={require('./src/assets/images/logo.png')}
            style={styles.splashIcon}
            resizeMode="contain"
          />
        </View>
        <HiddenWebView />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Primary Content Render */}
      <View style={styles.screenWrapper}>{renderContent()}</View>

      {/* Always Visible Bottom Tab Navigation */}
      <View style={styles.bottomTabBar}>
        {(
          ['home', 'search', 'downloads', 'watchlist', 'profile'] as ActiveTab[]
        ).map(tab => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => {
                setScreen('main');
                setActiveTab(tab);
              }}
              activeOpacity={0.85}>
              <View
                style={[
                  styles.iconContainer,
                  isActive && styles.iconContainerActive,
                ]}>
                <Icon
                  name={
                    tab === 'home'
                      ? isActive
                        ? 'home'
                        : 'home-outline'
                      : tab === 'search'
                      ? isActive
                        ? 'search'
                        : 'search-outline'
                      : tab === 'downloads'
                      ? isActive
                        ? 'arrow-down'
                        : 'arrow-down-outline'
                      : tab === 'watchlist'
                      ? isActive
                        ? 'heart'
                        : 'heart-outline'
                      : isActive
                      ? 'person'
                      : 'person-outline'
                  }
                  size={22}
                  color={isActive ? colors.white : 'rgba(255, 255, 255, 0.6)'}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Headless WebView crawler engine */}
      <HiddenWebView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 16,
  },
  splashLogo: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  splashIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  splashSubtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 40,
  },
  splashLoader: {
    alignItems: 'center',
    gap: 12,
  },
  splashLoadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  topNav: {
    height: 56,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  primaryText: {
    color: colors.primary,
  },
  consoleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.2)',
  },
  consoleBtnText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  screenWrapper: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  spacerWidth: {
    width: 60,
  },
  tabContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    height: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  countBadge: {
    backgroundColor: 'rgba(144, 97, 249, 0.15)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  countText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '900',
  },
  gridListContent: {
    padding: spacing.md,
    paddingBottom: 110,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: 6,
  },
  profileScroll: {
    padding: spacing.md,
    gap: 16,
    paddingBottom: 110,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  profileMeta: {
    justifyContent: 'center',
    gap: 2,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  profileTier: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 12,
  },
  settingsSectionTitle: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  storageBarContainer: {
    height: 6,
    backgroundColor: colors.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    width: '45%',
    backgroundColor: colors.secondary,
  },
  storageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: 16,
    gap: 2,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingDesc: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  devDashboardBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.control,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  devDashboardBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  settingItemBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  settingItemBorderLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabelStatic: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingValueStatic: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  settingValueActive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  devHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  devBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  devBackBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '900',
  },
  devHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 24,
    right: 24,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(23, 23, 28, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainerActive: {
    backgroundColor: colors.primary,
    borderRadius: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: zIndex.loader,
    gap: 16,
  },
  loadingText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  topNavSafeArea: {
    backgroundColor: colors.surface,
  },
  safeContentWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default App;
