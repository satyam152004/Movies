import React, {useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {ScraperDashboard} from './src/screens/ScraperDashboard';
import {MovieCatalog} from './src/screens/MovieCatalog';
import {MovieDetailScreen} from './src/screens/MovieDetail';
import {DownloadManagerScreen} from './src/screens/DownloadManager';
import {LogConsole} from './src/components/LogConsole';
import {HiddenWebView} from './src/components/HiddenWebView';
import {CatalogItem, MovieDetail} from './src/model/movie.model';
import {ScraperService} from './src/services/scraper.service';
import {DownloadService} from './src/services/download.service';

type ActiveScreen = 'dashboard' | 'catalog' | 'detail' | 'download';

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ActiveScreen>('dashboard');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null);
  const [isConsoleVisible, setIsConsoleVisible] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Initialize download service
  DownloadService.getInstance();

  const scraper = ScraperService.getInstance();

  const handleSelectItem = async (item: CatalogItem) => {
    scraper.log(`Selected item: "${item.title}". Fetching details...`, 'info');
    setIsDetailLoading(true);

    try {
      const detail = await scraper.scrapeMovieDetail(item.url);
      setSelectedMovie(detail);
      setScreen('detail');
    } catch (err: any) {
      scraper.log(
        `Failed to fetch details for: ${item.title}. Error: ${err.message}`,
        'error',
      );
      Alert.alert('Error', `Failed to load details: ${err.message}`);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const renderActiveScreen = () => {
    switch (screen) {
      case 'catalog':
        return (
          <MovieCatalog
            items={catalogItems}
            onSelectItem={handleSelectItem}
            onBack={() => setScreen('dashboard')}
          />
        );
      case 'detail':
        if (selectedMovie) {
          return (
            <MovieDetailScreen
              movie={selectedMovie}
              onBack={() => {
                if (catalogItems.length > 0) {
                  setScreen('catalog');
                } else {
                  setScreen('dashboard');
                }
              }}
              onStartDownload={async (title, size, url) => {
                try {
                  await DownloadService.getInstance().startDownload(
                    title,
                    size,
                    url,
                  );
                  setScreen('download');
                } catch (err: any) {
                  Alert.alert(
                    'Download Error',
                    `Failed to enqueue download: ${err.message}`,
                  );
                }
              }}
            />
          );
        }
        setScreen('dashboard');
        return null;
      case 'download':
        return (
          <DownloadManagerScreen
            onBack={() => {
              if (selectedMovie) {
                setScreen('detail');
              } else {
                setScreen('dashboard');
              }
            }}
          />
        );
      case 'dashboard':
      default:
        return (
          <ScraperDashboard
            onCatalogLoaded={items => {
              setCatalogItems(items);
            }}
            onSingleMovieLoaded={movie => {
              setSelectedMovie(movie);
            }}
            navigateToCatalog={() => setScreen('catalog')}
            navigateToDetail={() => setScreen('detail')}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#08080A" />

      {/* Top Banner */}
      <View style={styles.topNav}>
        <Text style={styles.navTitle}>
          🎬 <Text style={{color: '#8B5CF6'}}>Cine</Text>App
        </Text>
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={[
              styles.navBtn,
              screen === 'dashboard' && styles.navBtnActive,
            ]}
            onPress={() => setScreen('dashboard')}>
            <Text style={styles.navBtnText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.navBtn,
              screen === 'catalog' && styles.navBtnActive,
              catalogItems.length === 0 && styles.navBtnDisabled,
            ]}
            disabled={catalogItems.length === 0}
            onPress={() => setScreen('catalog')}>
            <Text style={styles.navBtnText}>Catalog</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.navBtn,
              screen === 'download' && styles.navBtnActive,
            ]}
            onPress={() => setScreen('download')}>
            <Text style={styles.navBtnText}>Downloads</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Render */}
      <View style={styles.screenWrapper}>{renderActiveScreen()}</View>

      {/* Console Toggle */}
      <TouchableOpacity
        style={styles.consoleToggle}
        onPress={() => setIsConsoleVisible(!isConsoleVisible)}>
        <Text style={styles.consoleToggleText}>
          {isConsoleVisible ? '▼ HIDE SYSTEM CONSOLE' : '▲ SHOW SYSTEM CONSOLE'}
        </Text>
      </TouchableOpacity>

      {/* Real-time System Console */}
      {isConsoleVisible && <LogConsole />}

      {/* Headless WebView crawler engine */}
      <HiddenWebView />

      {isDetailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>RESOLVING METADATA SECURELY...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  topNav: {
    height: 60,
    backgroundColor: '#101014',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  navTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  navBtnActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#7C3AED',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  navBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  screenWrapper: {
    flex: 1,
  },
  consoleToggle: {
    backgroundColor: '#101014',
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  consoleToggleText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 10, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 18,
  },
});

export default App;
