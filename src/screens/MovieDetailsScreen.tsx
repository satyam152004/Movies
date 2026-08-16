import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Animated,
  Modal,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
  Share,
} from 'react-native';
import {WebView} from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {movieTheme} from '../components/movie/theme';
import {MovieHero} from '../components/movie/MovieHero';
import {MovieInfo} from '../components/movie/MovieInfo';
import {MovieActionButtons} from '../components/movie/MovieActionButtons';
import {MovieCast} from '../components/movie/MovieCast';
import {MovieCrew} from '../components/movie/MovieCrew';
import {MovieDownloads} from '../components/movie/MovieDownloads';
import {MovieGallery} from '../components/movie/MovieGallery';
import {MovieRecommendations} from '../components/movie/MovieRecommendations';
import {MovieSkeleton} from '../components/movie/MovieSkeleton';

import {MovieDetail, DownloadLink, CatalogItem} from '../data/models';
import {ScraperService} from '../services/scraper.service';
import {formatDisplayTitle} from '../utils/formatDisplayTitle';
import {BackButton} from '../components/navigation/BackButton';

interface MovieDetailsScreenProps {
  movie: MovieDetail;
  onBack: () => void;
  onStartDownload: (title: string, size: string, url: string) => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  isLoading?: boolean;
}

export const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  movie,
  onBack,
  onStartDownload,
  isWatchlisted = false,
  onToggleWatchlist,
  isLoading = false,
}) => {
  console.info(`[UI Debug] During render() for: "${movie.title}"`, {
    backdropUrl: movie.backdropUrl,
    castCount: movie.enrichedCast?.length,
    crewCount: movie.enrichedCrew?.length,
  });
  // Scraper State Preservation & Downloads Visibility
  const [isDownloadsVisible, setIsDownloadsVisible] = useState<boolean>(false);
  const [resolvingUrl, setResolvingUrl] = useState<string | null>(null);
  const [resolvingMirrorUrl, setResolvingMirrorUrl] = useState<string | null>(
    null,
  );
  const [resolvingFinalUrl, setResolvingFinalUrl] = useState<string | null>(
    null,
  );
  const [resolvingServerUrl, setResolvingServerUrl] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [lastSelectedLink, setLastSelectedLink] = useState<DownloadLink | null>(
    null,
  );

  const browserFallbackTriggered = useRef<boolean>(false);
  const interactiveBrowserTriggered = useRef<boolean>(false);
  const interactiveDownloadTriggeredRef = useRef<boolean>(false);
  const resolutionSessionIdRef = useRef<number>(0);

  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isBrowserLoading, setIsBrowserLoading] = useState<boolean>(false);
  const [preservedSize, setPreservedSize] = useState<string>('Unknown Size');

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [allCatalogItems, setAllCatalogItems] = useState<CatalogItem[]>([]);
  const [renderRecommendations, setRenderRecommendations] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderRecommendations(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const interactiveWebViewRef = useRef<any>(null);

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [60, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${movie.title}" on CineApp!\n${movie.url}`,
        title: movie.title,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // Load all catalog items for related recommendations
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const storedCatalog = await AsyncStorage.getItem('@catalog_cache');
        if (storedCatalog) {
          setAllCatalogItems(JSON.parse(storedCatalog));
        }
      } catch (err) {
        console.log('Failed loading catalog cache', err);
      }
    };
    loadCatalog();
  }, []);

  const handleScroll = Animated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        lastScrollY.current = currentY;
      },
    },
  );

  const isAnyResolving = !!(
    resolvingUrl ||
    resolvingMirrorUrl ||
    resolvingFinalUrl ||
    resolvingServerUrl
  );

  // Scraper core operations
  const handleClose = useCallback(() => {
    setInteractiveUrl(null);
    interactiveBrowserTriggered.current = false;
    interactiveDownloadTriggeredRef.current = false;
  }, []);

  const openInteractiveBrowser = useCallback(
    (url: string, size?: string, _label?: string) => {
      if (interactiveBrowserTriggered.current) {
        return;
      }
      interactiveBrowserTriggered.current = true;

      setPreservedSize(size || 'Unknown Size');
      setInteractiveUrl(url);
      setCurrentUrl(url);
      setCanGoBack(false);
    },
    [],
  );

  const openExternalBrowserOnce = useCallback((originalUrl: string) => {
    if (browserFallbackTriggered.current) {
      return;
    }
    browserFallbackTriggered.current = true;
    Linking.openURL(originalUrl);
  }, []);

  // Scraper core operations
  const handleInteractiveDownloadCandidate = useCallback(
    (url: string) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return;
      }
      if (interactiveDownloadTriggeredRef.current) {
        return;
      }

      const scraper = ScraperService.getInstance();
      if (!scraper.isDirectFileUrl(url)) {
        return;
      }

      interactiveDownloadTriggeredRef.current = true;
      scraper.log(
        '[InteractiveBrowser] Direct download candidate confirmed',
        'success',
      );

      onStartDownload(movie.title, preservedSize || 'Unknown Size', url);
      handleClose();
    },
    [movie.title, preservedSize, onStartDownload, handleClose],
  );

  const handleBack = useCallback(() => {
    if (canGoBack && interactiveWebViewRef.current) {
      interactiveWebViewRef.current.goBack();
    }
  }, [canGoBack]);

  const handleReload = useCallback(() => {
    interactiveWebViewRef.current?.reload();
  }, []);

  const handleOpenExternal = useCallback(() => {
    const urlToOpen = currentUrl || interactiveUrl || '';
    if (urlToOpen) {
      openExternalBrowserOnce(urlToOpen);
    }
  }, [currentUrl, interactiveUrl, openExternalBrowserOnce]);

  const handleLinkPress = useCallback(
    async (link: DownloadLink) => {
      if (isAnyResolving) {
        return;
      }

      if (link.type === 'watch') {
        Linking.canOpenURL(link.url).then(supported => {
          if (supported) {
            Linking.openURL(link.url);
          }
        });
        return;
      }

      setDownloadError(null);
      setLastSelectedLink(link);
      browserFallbackTriggered.current = false;
      interactiveBrowserTriggered.current = false;
      interactiveDownloadTriggeredRef.current = false;
      resolutionSessionIdRef.current += 1;
      const sessionId = resolutionSessionIdRef.current;

      const originalPortalUrl = link.url;
      setResolvingUrl(originalPortalUrl);
      const scraper = ScraperService.getInstance();
      const size = link.size || 'Unknown Size';

      try {
        // Step 1: Resolve mirrors page
        const scrapedMirrors = await scraper.scrapeDownloadPage(
          originalPortalUrl,
        );
        if (sessionId !== resolutionSessionIdRef.current) {
          return;
        }

        if (!scrapedMirrors || scrapedMirrors.length === 0) {
          if (scraper.isDirectFileUrl(originalPortalUrl)) {
            onStartDownload(movie.title, size, originalPortalUrl);
            setIsDownloadsVisible(false);
          } else {
            Linking.openURL(originalPortalUrl);
            setIsDownloadsVisible(false);
          }
          setResolvingUrl(null);
          return;
        }

        // Step 2: Grab first mirror and resolve direct links page
        const mirror = scrapedMirrors[0];
        setResolvingUrl(null);
        setResolvingMirrorUrl(mirror.url);

        const isScrapable =
          mirror.url.includes('hubcloud') ||
          mirror.url.includes('gamerxyt') ||
          mirror.url.includes('pixeldrain') ||
          mirror.url.includes('buzz');

        if (!isScrapable) {
          if (scraper.isDirectFileUrl(mirror.url)) {
            onStartDownload(movie.title, size, mirror.url);
            setIsDownloadsVisible(false);
          } else {
            Linking.openURL(mirror.url);
            setIsDownloadsVisible(false);
          }
          setResolvingMirrorUrl(null);
          return;
        }

        const scrapedDirect = await scraper.scrapeDirectDownloadPage(
          mirror.url,
        );
        if (sessionId !== resolutionSessionIdRef.current) {
          return;
        }

        if (!scrapedDirect || scrapedDirect.length === 0) {
          if (scraper.isDirectFileUrl(mirror.url)) {
            onStartDownload(movie.title, size, mirror.url);
            setIsDownloadsVisible(false);
          } else {
            Linking.openURL(mirror.url);
            setIsDownloadsVisible(false);
          }
          setResolvingMirrorUrl(null);
          return;
        }

        // Step 3: Grab first direct link
        const directLink = scrapedDirect[0];
        setResolvingMirrorUrl(null);
        setResolvingFinalUrl(directLink.url);

        const isGenerator =
          directLink.url.includes('gamerxyt') ||
          directLink.url.includes('hubcloud.php') ||
          /generate/i.test(directLink.label);

        if (!isGenerator) {
          onStartDownload(movie.title, size, directLink.url);
          setIsDownloadsVisible(false);
          setResolvingFinalUrl(null);
          return;
        }

        // Step 4: Resolve final cloud servers from generator page
        const scrapedFinal = await scraper.scrapeDirectDownloadPage(
          directLink.url,
        );
        if (sessionId !== resolutionSessionIdRef.current) {
          return;
        }

        if (!scrapedFinal || scrapedFinal.length === 0) {
          if (scraper.isDirectFileUrl(directLink.url)) {
            onStartDownload(movie.title, size, directLink.url);
            setIsDownloadsVisible(false);
          } else {
            Linking.openURL(directLink.url);
            setIsDownloadsVisible(false);
          }
          setResolvingFinalUrl(null);
          return;
        }

        // Step 5: Resolve final direct file host URL
        const serverLink = scrapedFinal[0];
        setResolvingFinalUrl(null);
        setResolvingServerUrl(serverLink.url);

        let resolvedDirect: string | null = null;
        try {
          resolvedDirect = await scraper.scrapeDirectFileHost(serverLink.url);
        } catch (err: any) {
          if (sessionId !== resolutionSessionIdRef.current) {
            return;
          }
          if (
            err &&
            (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
              err.type === 'EXTERNAL_BROWSER_REQUIRED')
          ) {
            setIsDownloadsVisible(false);
            openInteractiveBrowser(serverLink.url, size, serverLink.label);
          } else {
            if (scraper.isDirectFileUrl(serverLink.url)) {
              onStartDownload(movie.title, size, serverLink.url);
              setIsDownloadsVisible(false);
            } else {
              openExternalBrowserOnce(serverLink.url);
              setIsDownloadsVisible(false);
            }
          }
          setResolvingServerUrl(null);
          return;
        }

        if (sessionId !== resolutionSessionIdRef.current) {
          return;
        }

        if (resolvedDirect) {
          onStartDownload(movie.title, size, resolvedDirect);
          setIsDownloadsVisible(false);
        } else {
          if (scraper.isDirectFileUrl(serverLink.url)) {
            onStartDownload(movie.title, size, serverLink.url);
            setIsDownloadsVisible(false);
          } else {
            openExternalBrowserOnce(serverLink.url);
            setIsDownloadsVisible(false);
          }
        }
        setResolvingServerUrl(null);
      } catch (err: any) {
        if (sessionId !== resolutionSessionIdRef.current) {
          return;
        }

        const failedUrl =
          resolvingServerUrl ||
          resolvingFinalUrl ||
          resolvingMirrorUrl ||
          originalPortalUrl;
        if (
          err &&
          (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
            err.type === 'EXTERNAL_BROWSER_REQUIRED')
        ) {
          setIsDownloadsVisible(false);
          openInteractiveBrowser(failedUrl, size, link.label);
        } else {
          setDownloadError(
            err.message || 'Unable to resolve the selected download source.',
          );
        }
        setResolvingUrl(null);
        setResolvingMirrorUrl(null);
        setResolvingFinalUrl(null);
        setResolvingServerUrl(null);
      }
    },
    [
      isAnyResolving,
      movie.title,
      onStartDownload,
      openInteractiveBrowser,
      openExternalBrowserOnce,
      resolvingMirrorUrl,
      resolvingFinalUrl,
      resolvingServerUrl,
    ],
  );

  if (isLoading) {
    return <MovieSkeleton />;
  }

  const handleSelectItemRepresentation = (item: CatalogItem) => {
    // Trigger catalog navigation or movie change
    movie.title = item.title;
    movie.url = item.url;
    movie.imageUrl = item.imageUrl;
    onBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Screen Scrolling Core */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}>
        {/* Parallax Hero Banner */}
        <MovieHero movie={movie} scrollY={scrollY} />

        {/* Info & Expandable story */}
        <MovieInfo
          movie={movie}
          onPosterPress={() => setFullImageUrl(movie.imageUrl || null)}
        />

        {/* Pressable scale action buttons */}
        <MovieActionButtons
          movie={movie}
          isWatchlisted={isWatchlisted}
          onToggleWatchlist={onToggleWatchlist || (() => {})}
          onDownloadPress={() => setIsDownloadsVisible(true)}
        />

        {/* Cast listing (Horizontal Scroll) */}
        <MovieCast stars={movie.stars} enrichedCast={movie.enrichedCast} />

        {/* Production Crew chips */}
        <MovieCrew
          crew={movie.enrichedCrew}
          fallbackDirector={movie.director}
        />

        {/* Screenshots Gallery */}
        <MovieGallery
          screenshots={movie.screenshots}
          onScreenshotPress={url => setFullImageUrl(url)}
        />

        {/* Bottom Sheet Download Selector Modal */}
        <MovieDownloads
          visible={isDownloadsVisible}
          onClose={() => setIsDownloadsVisible(false)}
          movie={movie}
          isAnyResolving={isAnyResolving}
          resolvingUrl={resolvingUrl}
          resolvingMirrorUrl={resolvingMirrorUrl}
          resolvingFinalUrl={resolvingFinalUrl}
          resolvingServerUrl={resolvingServerUrl}
          handleLinkPress={handleLinkPress}
          error={downloadError}
          onRetry={() => lastSelectedLink && handleLinkPress(lastSelectedLink)}
          onClearError={() => setDownloadError(null)}
        />

        {/* More Like This Carousel */}
        {renderRecommendations && (
          <MovieRecommendations
            currentMovie={movie}
            allCatalogItems={allCatalogItems}
            onSelectItem={handleSelectItemRepresentation}
          />
        )}
      </ScrollView>

      {/* Floating Header Overlay */}
      <View style={styles.floatingHeader}>
        <Animated.View style={[styles.headerBg, {opacity: headerBgOpacity}]} />
        <Animated.View
          style={[styles.headerBorder, {opacity: headerBorderOpacity}]}
        />
        <View style={styles.headerContent}>
          <BackButton onPress={onBack} color={movieTheme.colors.text} />

          {/* Header Title (Fades in on scroll) */}
          <Animated.Text
            style={[styles.headerTitle, {opacity: titleOpacity}]}
            numberOfLines={1}>
            {formatDisplayTitle(movie.title)}
          </Animated.Text>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityLabel="Share Movie">
              <Icon
                name="share-social-outline"
                size={20}
                color={movieTheme.colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerButton,
                isWatchlisted && styles.headerButtonActive,
              ]}
              onPress={onToggleWatchlist}
              activeOpacity={0.7}
              accessibilityLabel="Add to Watchlist">
              <Icon
                name={isWatchlisted ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={
                  isWatchlisted
                    ? movieTheme.colors.primary
                    : movieTheme.colors.text
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Full Image Preview Zoom Modal */}
      <Modal
        visible={fullImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageUrl(null)}>
        <TouchableOpacity
          style={styles.imageModalContainer}
          activeOpacity={1}
          onPress={() => setFullImageUrl(null)}>
          {fullImageUrl ? (
            <Animated.Image
              source={{uri: fullImageUrl}}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.imageCloseBtn}
            onPress={() => setFullImageUrl(null)}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Interactive WebView Scraper Modal */}
      <Modal
        visible={interactiveUrl !== null}
        animationType="slide"
        onRequestClose={handleClose}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.browserHeader}>
            <TouchableOpacity
              style={styles.browserHeaderBtn}
              onPress={handleClose}>
              <Text style={styles.browserHeaderBtnText}>✕ Close</Text>
            </TouchableOpacity>

            <View style={styles.browserHeaderNav}>
              <TouchableOpacity
                style={[
                  styles.browserHeaderBtn,
                  !canGoBack && styles.browserHeaderBtnDisabled,
                  {marginLeft: 12},
                ]}
                disabled={!canGoBack}
                onPress={handleBack}
                hitSlop={{top: 12, bottom: 12, left: 4, right: 20}}>
                <View
                  style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="chevron-back" size={14} color="#FFFFFF" />
                  <Text style={styles.browserHeaderBtnText}>Back</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.browserHeaderBtn}
                onPress={handleReload}>
                <View
                  style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="reload" size={12} color="#FFFFFF" />
                  <Text style={styles.browserHeaderBtnText}>Reload</Text>
                </View>
              </TouchableOpacity>

              {isBrowserLoading && (
                <ActivityIndicator
                  size="small"
                  color={movieTheme.colors.primary}
                  style={styles.loaderIcon}
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.browserHeaderBtn}
              onPress={handleOpenExternal}>
              <View
                style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Icon name="globe-outline" size={12} color="#FFFFFF" />
                <Text style={styles.browserHeaderBtnText}>Browser</Text>
              </View>
            </TouchableOpacity>
          </View>

          {interactiveUrl ? (
            <View style={styles.webViewWrapper}>
              <WebView
                ref={interactiveWebViewRef}
                style={styles.flexOne}
                source={{uri: interactiveUrl}}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                mixContentMode="always"
                onNavigationStateChange={navState => {
                  setCanGoBack(navState.canGoBack);
                  setCurrentUrl(navState.url);
                  setIsBrowserLoading(navState.loading);
                  handleInteractiveDownloadCandidate(navState.url);
                }}
                onLoadStart={event => {
                  setIsBrowserLoading(true);
                  handleInteractiveDownloadCandidate(event.nativeEvent.url);
                }}
                onLoadEnd={() => setIsBrowserLoading(false)}
                onShouldStartLoadWithRequest={request => {
                  handleInteractiveDownloadCandidate(request.url);
                  return true;
                }}
                onHttpError={() => setIsBrowserLoading(false)}
                onFileDownload={syntheticEvent => {
                  handleInteractiveDownloadCandidate(
                    syntheticEvent.nativeEvent.downloadUrl,
                  );
                }}
                onError={syntheticEvent => {
                  setIsBrowserLoading(false);
                  openExternalBrowserOnce(
                    syntheticEvent.nativeEvent.url || interactiveUrl,
                  );
                }}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: movieTheme.colors.background,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 56,
    zIndex: 10,
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090B',
  },
  headerBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerContent: {
    flex: 1,
    paddingTop:
      Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: movieTheme.colors.text,
    fontSize: 17,
    fontWeight: movieTheme.typography.weights.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: movieTheme.colors.primary,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 90,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  imageCloseBtn: {
    position: 'absolute',
    top: 45,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: movieTheme.colors.background,
  },
  browserHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: movieTheme.colors.card,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: movieTheme.colors.border,
  },
  browserHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: movieTheme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  browserHeaderBtnDisabled: {
    opacity: 0.3,
  },
  browserHeaderBtnText: {
    color: movieTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  browserHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loaderIcon: {
    marginLeft: 8,
  },
  webViewWrapper: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
});
export default MovieDetailsScreen;
