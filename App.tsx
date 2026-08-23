import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {PreferencesStorage} from './src/services/storage/preferences.storage';
import {LibraryStorage} from './src/services/storage/library.storage';
import {useCatalog} from './src/hooks/useCatalog';
import {HomeScreen} from './src/screens/HomeScreen';
import {SearchScreen} from './src/screens/SearchScreen';
import {MovieDetailScreen} from './src/screens/MovieDetail';
// @ts-ignore
import {TMDB_API_KEY} from '@env';
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
import {typography} from './src/theme';

type ActiveTab = 'home' | 'search' | 'downloads' | 'watchlist' | 'profile';
type ActiveScreen = 'main' | 'detail' | 'collection';
interface NavigationEntry {
  activeTab: ActiveTab;
  screen: ActiveScreen;
  selectedMovie: MovieDetail | null;
  collectionParams: {
    title: string;
    items: CatalogItem[];
    type: string;
  } | null;
}

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [screen, setScreen] = useState<ActiveScreen>('main');
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null);
  const [collectionParams, setCollectionParams] = useState<{
    title: string;
    items: CatalogItem[];
    type: string;
  } | null>(null);

  // Navigation History Stack
  const [history, setHistory] = useState<NavigationEntry[]>([]);
  const historyRef = useRef<NavigationEntry[]>([]);
  historyRef.current = history;

  // Ref to allow child screens (like MovieDetailsScreen) to intercept Back press
  const childBackHandlerRef = useRef<(() => boolean) | null>(null);

  const navigateTo = (nextState: Partial<NavigationEntry>) => {
    // Current state to be pushed to history
    const currentState: NavigationEntry = {
      activeTab,
      screen,
      selectedMovie: selectedMovie ? { ...selectedMovie } : null,
      collectionParams: collectionParams ? { ...collectionParams } : null,
    };

    // Determine if this is tab switching or tab tapping
    if (nextState.activeTab !== undefined) {
      if (nextState.activeTab !== activeTab) {
        // Tab changed: clear history
        setHistory([]);
        historyRef.current = [];
      } else if (nextState.screen === 'main') {
        // Active tab tapped again: pop to root
        setHistory([]);
        historyRef.current = [];
      }
    } else {
      // Push current state to history before changing screens
      const lastEntry = historyRef.current[historyRef.current.length - 1];
      const targetTab = nextState.activeTab ?? activeTab;
      const targetScreen = nextState.screen ?? screen;
      const targetMovieUrl = nextState.selectedMovie !== undefined ? nextState.selectedMovie?.url : selectedMovie?.url;
      const targetCollectionTitle = nextState.collectionParams !== undefined ? nextState.collectionParams?.title : collectionParams?.title;

      const isDuplicate = lastEntry &&
        lastEntry.activeTab === targetTab &&
        lastEntry.screen === targetScreen &&
        lastEntry.selectedMovie?.url === targetMovieUrl &&
        lastEntry.collectionParams?.title === targetCollectionTitle;

      if (!isDuplicate) {
        setHistory(prev => {
          const updated = [...prev, currentState];
          historyRef.current = updated;
          return updated;
        });
      }
    }

    // Apply the navigation target states
    if (nextState.activeTab !== undefined) {
      setActiveTab(nextState.activeTab);
    }
    if (nextState.screen !== undefined) {
      setScreen(nextState.screen);
    }
    if (nextState.selectedMovie !== undefined) {
      setSelectedMovie(nextState.selectedMovie);
    }
    if (nextState.collectionParams !== undefined) {
      setCollectionParams(nextState.collectionParams);
    }
  };

  const goBack = useCallback(() => {
    // 1. Check if child screen intercepts back press (modals, sheet, etc.)
    if (childBackHandlerRef.current && childBackHandlerRef.current()) {
      return true;
    }

    // 2. Check if history stack has entries
    if (historyRef.current.length > 0) {
      setHistory(prev => {
        const updated = [...prev];
        const prevState = updated.pop();
        historyRef.current = updated;

        if (prevState) {
          setActiveTab(prevState.activeTab);
          setScreen(prevState.screen);
          setSelectedMovie(prevState.selectedMovie);
          setCollectionParams(prevState.collectionParams);
        }
        return updated;
      });
      return true;
    }

    // 3. Fallback: if not on root home screen, go back to home tab root
    if (activeTab !== 'home' || screen !== 'main') {
      setActiveTab('home');
      setScreen('main');
      setHistory([]);
      historyRef.current = [];
      return true;
    }

    // 4. Let app exit
    return false;
  }, [activeTab, screen]);

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
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

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
  } = useCatalog(selectedCategory, isConfigLoaded);

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
        console.info('[Config] Resolving runtime environment variables...');
        // Safe check to seed environment TMDB API key override at runtime
        const processEnv = process.env as any;
        const envKey = processEnv.TMDB_API_KEY || processEnv.REACT_APP_TMDB_API_KEY || TMDB_API_KEY;
        console.info(`[Config Debug] process.env.TMDB_API_KEY: "${processEnv.TMDB_API_KEY || 'undefined'}"`);
        console.info(`[Config Debug] Imported TMDB_API_KEY from @env: "${TMDB_API_KEY || 'undefined'}"`);
        if (envKey && envKey.trim().length > 0) {
          await AsyncStorage.setItem('@tmdb_api_key_override', envKey.trim());
          console.info('[Config] TMDb configuration override key written.');
        } else {
          console.info('[Config Debug] No envKey found to write to AsyncStorage override.');
        }

        const storedWatchlist = await LibraryStorage.getWatchlist();
        setWatchlist(storedWatchlist);

        const storedVideo = await PreferencesStorage.getVideoQuality();
        setVideoQuality(storedVideo);

        const storedDownload = await PreferencesStorage.getDownloadQuality();
        setDownloadQuality(storedDownload);

        const storedWifi = await PreferencesStorage.getWifiOnly();
        setWifiOnly(storedWifi);

        console.info('[Config] Runtime configuration initialized.');
      } catch (e) {
        console.error('Failed to load initial settings', e);
      } finally {
        setIsConfigLoaded(true);
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
    const handleHardwareBack = () => {
      return goBack();
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBack,
    );

    return () => backHandler.remove();
  }, [goBack]);

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
    navigateTo({
      screen: 'detail',
      selectedMovie: partialMovie,
    });
    setIsDetailLoading(true);
    try {
      const detail = await scraper.scrapeMovieDetail(item.url);
      if (!detail.imageUrl && item.imageUrl) {
        detail.imageUrl = item.imageUrl;
      }
      detail.enrichmentPending = true;
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
          enrichedDetail.enrichmentPending = false;
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
          setSelectedMovie(prev => {
            if (prev && prev.url === item.url) {
              return {
                ...prev,
                enrichmentPending: false,
              };
            }
            return prev;
          });
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
              navigateTo({
                screen: 'collection',
                collectionParams: {title, items, type},
              });
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
            onProfilePress={() => setActiveTab('profile')}
            onViewAllPress={(title, items, type) => {
              navigateTo({
                screen: 'collection',
                collectionParams: {title, items, type},
              });
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
                <MovieCard
                  item={item}
                  onPress={() => handleSelectItem(item)}
                  isWatchlisted={true}
                  onWatchlistPress={() => handleToggleWatchlist(item)}
                />
              </View>
            )}
            numColumns={3}
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
          onBack={goBack}
          onSelectItem={handleSelectItem}
          childBackHandlerRef={childBackHandlerRef}
          onStartDownload={async (title, size, url) => {
            try {
              await DownloadService.getInstance().startDownload(
                title,
                size,
                url,
                selectedMovie.imageUrl,
              );
              // Downloads screen is tab-level, so reset/clear history when moving to it
              setHistory([]);
              historyRef.current = [];
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
          onBack={goBack}
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
                navigateTo({
                  screen: 'main',
                  activeTab: tab,
                });
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
                        ? 'bookmark'
                        : 'bookmark-outline'
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
    ...typography.tokens.display,
    fontSize: 36, // Keep visual 36px splash logo

    color: colors.textPrimary,
    
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  splashIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  splashSubtitle: {
    ...typography.tokens.bodyMedium,

    color: colors.textSecondary,
    
    fontWeight: '500',
    marginBottom: 40,
  },
  splashLoader: {
    alignItems: 'center',
    gap: 12,
  },
  splashLoadingText: {
    ...typography.tokens.button,

    color: colors.textSecondary,
    
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
    ...typography.tokens.h3,
    fontSize: 20, // Keep 20px header

    color: colors.textPrimary,
    
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
    ...typography.tokens.label,

    color: colors.primary,
    
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  screenTitle: {
    ...typography.tokens.body,
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
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
    marginBottom: 12,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: 4,
    maxWidth: '33.33%',
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
    ...typography.tokens.body,

    color: colors.textPrimary,
    
    fontWeight: '900',
  },
  profileTier: {
    ...typography.tokens.label,

    color: colors.primary,
    
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
    ...typography.tokens.label,
    fontSize: 9, // Small section header

    color: colors.textSecondary,
    
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
    ...typography.tokens.label,

    color: colors.textMuted,
    
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
    ...typography.tokens.secondary,

    color: colors.textPrimary,
    
    fontWeight: '700',
  },
  settingDesc: {
    ...typography.tokens.label,

    color: colors.textSecondary,
    
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
    ...typography.tokens.label,
    fontSize: 11,

    color: colors.white,
    
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
    ...typography.tokens.secondary,

    color: colors.textPrimary,
    
    fontWeight: '700',
  },
  settingValueStatic: {
    ...typography.tokens.label,
    fontSize: 11,

    color: colors.textSecondary,
    
    fontWeight: '600',
  },
  settingValueActive: {
    ...typography.tokens.caption,

    color: colors.primary,
    
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
    ...typography.tokens.label,

    color: colors.textSecondary,
    
    fontWeight: '900',
  },
  devHeaderTitle: {
    ...typography.tokens.body,

    color: colors.textPrimary,
    
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
    ...typography.tokens.label,

    color: colors.primary,
    
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
