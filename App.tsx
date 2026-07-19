import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import {HomeScreen} from './src/screens/HomeScreen';
import {SearchScreen} from './src/screens/SearchScreen';
import {MovieDetailScreen} from './src/screens/MovieDetail';
import {DownloadManagerScreen} from './src/screens/DownloadManager';
import {HiddenWebView} from './src/components/HiddenWebView';
import {CatalogItem, MovieDetail} from './src/data/models';
import {ScraperService} from './src/services/scraper.service';
import {DownloadService} from './src/services/download.service';
import {UrlDiscoveryService} from './src/services/urlDiscovery.service';
import {colors, radius, spacing, zIndex} from './src/theme';
import {MovieCard} from './src/components/cards/MovieCard';
import {EmptyState} from './src/components/feedback/EmptyState';

type ActiveTab = 'home' | 'search' | 'downloads' | 'watchlist' | 'profile';
type ActiveScreen = 'main' | 'detail';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [screen, setScreen] = useState<ActiveScreen>('main');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null);
  const [isConsoleVisible, setIsConsoleVisible] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isDomainResolving, setIsDomainResolving] = useState(true);
  const [catalogPage, setCatalogPage] = useState(1);
  const [isCatalogLoadingMore, setIsCatalogLoadingMore] = useState(false);
  const [watchlist, setWatchlist] = useState<CatalogItem[]>([]);

  // Initialize download service
  DownloadService.getInstance();
  const scraper = ScraperService.getInstance();

  useEffect(() => {
    // Load Developer Mode settings & Watchlist on startup
    const loadSettings = async () => {
      try {
        const storedWatchlist = await AsyncStorage.getItem('@watchlist');
        if (storedWatchlist !== null) {
          setWatchlist(JSON.parse(storedWatchlist));
        }
      } catch (e) {
        console.error('Failed to load initial settings', e);
      }
    };
    loadSettings();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchCatalog = async (
    categoryPath: string | null,
    pageNum: number,
    append: boolean,
  ) => {
    if (pageNum === 1) {
      setIsCatalogLoading(true);
    } else {
      setIsCatalogLoadingMore(true);
    }
    try {
      const activeUrl = await UrlDiscoveryService.getInstance().getActiveUrl();
      if (activeUrl) {
        const targetUrl = categoryPath
          ? `${activeUrl.replace(/\/$/, '')}/${categoryPath.replace(/^\//, '')}`
          : activeUrl;
        scraper.log(`Scraping catalog from targetUrl: ${targetUrl} (page ${pageNum})...`, 'info');
        const result = await scraper.scrapeCatalogPage(targetUrl, false, pageNum);
        if (append) {
          setCatalogItems(prev => [...prev, ...result.items]);
        } else {
          setCatalogItems(result.items);
        }
        scraper.log(
          `Successfully loaded ${result.items.length} items from page ${pageNum}.`,
          'success',
        );
      }
    } catch (err: any) {
      scraper.log(`Catalog scraping failed: ${err.message}`, 'error');
    } finally {
      setIsCatalogLoading(false);
      setIsCatalogLoadingMore(false);
      // Dismiss splash screen after the initial load (page 1) regardless of success/failure
      if (pageNum === 1 && !append) {
        setIsDomainResolving(false);
      }
    }
  };

  useEffect(() => {
    setCatalogPage(1);
    fetchCatalog(selectedCategory, 1, false);
  }, [selectedCategory]);

  const loadMoreCatalog = async () => {
    if (isCatalogLoading || isCatalogLoadingMore) {
      return;
    }
    const nextPage = catalogPage + 1;
    await fetchCatalog(selectedCategory, nextPage, true);
    setCatalogPage(nextPage);
  };

  const handleSelectItem = async (item: CatalogItem) => {
    scraper.log(`Selected item: "${item.title}". Fetching details in background...`, 'info');
    
    // Set a partial representation in state and navigate to details instantly!
    const partialMovie: MovieDetail = {
      title: item.title,
      url: item.url,
      imageUrl: item.imageUrl,
      date: '',
      quality: '',
      imdbRating: '',
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
      // Keep watchlist/active state representation valid but update details
      setSelectedMovie(detail);
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
      await AsyncStorage.setItem(
        '@watchlist',
        JSON.stringify(updatedWatchlist),
      );
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
            onLoadMore={loadMoreCatalog}
            isLoadingMore={isCatalogLoadingMore}
            isLoading={isCatalogLoading}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        );
      case 'search':
        return (
          <SearchScreen items={catalogItems} onSelectItem={handleSelectItem} />
        );
      case 'downloads':
        return (
          <DownloadManagerScreen
            onBack={() => {
              setActiveTab('home');
            }}
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
    return (
      <View style={styles.tabContainer}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>My Watchlist</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{watchlist.length} ITEMS</Text>
          </View>
        </View>

        {watchlist.length === 0 ? (
          <EmptyState
            icon={<Icon name="heart-outline" size={54} color={colors.primary} />}
            title="Your Watchlist is Empty"
            description="Explore movie catalogs and add titles to your personal watchlist to watch later."
          />
        ) : (
          <FlatList
            data={watchlist}
            keyExtractor={item => item.url}
            renderItem={({item}) => (
              <MovieCard item={item} onPress={() => handleSelectItem(item)} />
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
    return (
      <ScrollView
        style={styles.tabContainer}
        contentContainerStyle={styles.profileScroll}
        showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>Cine Enthusiast</Text>
            <Text style={styles.profileTier}>Premium Member</Text>
          </View>
        </View>

        {/* Storage Stats */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>Storage Overview</Text>
          <View style={styles.storageBarContainer}>
            <View style={styles.storageBarFill} />
          </View>
          <View style={styles.storageLabelRow}>
            <Text style={styles.storageLabel}>Used: 24.5 GB</Text>
            <Text style={styles.storageLabel}>Free: 38.2 GB</Text>
          </View>
        </View>

        {/* Settings Links */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsSectionTitle}>Application Settings</Text>

          <View style={styles.settingItemBorder}>
            <Text style={styles.settingLabelStatic}>Appearance</Text>
            <Text style={styles.settingValueStatic}>Dark Theme (Default)</Text>
          </View>

          <View style={styles.settingItemBorderLast}>
            <Text style={styles.settingLabelStatic}>App Version</Text>
            <Text style={styles.settingValueStatic}>v1.1.0-Premium</Text>
          </View>
        </View>
      </ScrollView>
    );
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

    return (
      <View style={styles.flexOne}>
        {/* Main Content Area */}
        <View style={styles.screenWrapper}>{renderTabContent()}</View>

        {/* Bottom Tab Navigation */}
        <View style={styles.bottomTabBar}>
          {(
            [
              'home',
              'search',
              'downloads',
              'watchlist',
              'profile',
            ] as ActiveTab[]
          ).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                activeTab === tab && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab(tab)}>
              <Icon
                name={
                  tab === 'home'
                    ? activeTab === tab ? 'home' : 'home-outline'
                    : tab === 'search'
                    ? activeTab === tab ? 'search' : 'search-outline'
                    : tab === 'downloads'
                    ? activeTab === tab ? 'download' : 'download-outline'
                    : tab === 'watchlist'
                    ? activeTab === tab ? 'heart' : 'heart-outline'
                    : activeTab === tab ? 'person' : 'person-outline'
                }
                size={22}
                color={activeTab === tab ? colors.primary : colors.textSecondary}
                style={styles.tabIconSpacing}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab && styles.tabLabelActive,
                ]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (isDomainResolving) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.splashContent}>
          <Image
            source={require('./src/assets/images/logo.png')}
            style={styles.splashIcon}
            resizeMode="contain"
          />
        </View>
        <HiddenWebView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top Premium Header */}
      {screen === 'main' && (
        <View style={styles.topNav}>
          <Text style={styles.navTitle}>
             <Text style={styles.primaryText}>Cine</Text>App
          </Text>
        </View>
      )}

      {/* Primary Content Render */}
      <View style={styles.screenWrapper}>{renderContent()}</View>

      {/* Headless WebView crawler engine */}
      <HiddenWebView />
    </SafeAreaView>
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
    paddingBottom: 40,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  profileScroll: {
    padding: spacing.md,
    gap: 16,
    paddingBottom: 40,
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
    color: colors.secondary,
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
    borderRadius: radius.button,
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
    height: 60,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabIconSpacing: {
    marginBottom: 2,
  },
  tabLabel: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: colors.primary,
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
});

export default App;
