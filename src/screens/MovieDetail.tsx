import React, {useState, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {MovieDetail, DownloadLink} from '../model/movie.model';
import {ScraperService} from '../services/scraper.service';

interface MovieDetailProps {
  movie: MovieDetail;
  onBack: () => void;
  onStartDownload: (title: string, size: string, url: string) => void;
}

export const MovieDetailScreen: React.FC<MovieDetailProps> = ({
  movie,
  onBack,
  onStartDownload,
}) => {
  const [resolvingUrl, setResolvingUrl] = useState<string | null>(null);
  const [mirrors, setMirrors] = useState<{
    [url: string]: {label: string; url: string}[];
  }>({});
  const [resolvingMirrorUrl, setResolvingMirrorUrl] = useState<string | null>(
    null,
  );
  const [directLinks, setDirectLinks] = useState<{
    [url: string]: {label: string; url: string}[];
  }>({});
  const [resolvingFinalUrl, setResolvingFinalUrl] = useState<string | null>(
    null,
  );
  const [finalDirectLinks, setFinalDirectLinks] = useState<{
    [url: string]: {label: string; url: string}[];
  }>({});
  const [resolvingServerUrl, setResolvingServerUrl] = useState<string | null>(
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
  const [preservedQualityLabel, setPreservedQualityLabel] = useState<string>('Unknown Quality');

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  const interactiveWebViewRef = useRef<any>(null);

  const handleInteractiveDownloadCandidate = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return;
    }

    const sessionId = resolutionSessionIdRef.current;
    if (sessionId !== resolutionSessionIdRef.current) {
      console.log('[InteractiveBrowser] Ignoring stale download candidate');
      return;
    }

    if (interactiveDownloadTriggeredRef.current) {
      return;
    }

    const scraper = ScraperService.getInstance();
    const isDirect = scraper.isDirectFileUrl(url);
    if (!isDirect) {
      return;
    }

    interactiveDownloadTriggeredRef.current = true;

    console.log('[InteractiveBrowser] User interaction completed through normal page flow');
    console.log('[InteractiveBrowser] Download candidate observed');
    console.log(`[InteractiveBrowser] Direct download candidate confirmed: ${url.split('?')[0]}`);
    console.log('[InteractiveBrowser] Handing URL to existing download pipeline');

    scraper.log('[InteractiveBrowser] User interaction completed through normal page flow', 'success');
    scraper.log('[InteractiveBrowser] Download candidate observed', 'info');
    scraper.log('[InteractiveBrowser] Direct download candidate confirmed', 'success');
    scraper.log('[InteractiveBrowser] Handing URL to existing download pipeline', 'info');

    onStartDownload(movie.title, preservedSize || 'Unknown Size', url);

    console.log('[InteractiveBrowser] Closing interactive browser');
    scraper.log('[InteractiveBrowser] Closing interactive browser', 'info');

    handleClose();
  };

  const openInteractiveBrowser = (url: string, size?: string, label?: string) => {
    if (interactiveBrowserTriggered.current) {
      console.log('[InteractiveBrowser] Interactive browser already active');
      return;
    }
    interactiveBrowserTriggered.current = true;
    
    setPreservedSize(size || 'Unknown Size');
    setPreservedQualityLabel(label || 'Unknown Quality');
    
    const scraper = ScraperService.getInstance();
    console.log('[InteractiveBrowser] Opening original portal URL');
    console.log('[InteractiveBrowser] User interaction flow active');
    console.log(`[InteractiveBrowser] [DEBUG] Modal visible state set to: true`);
    console.log(`[InteractiveBrowser] [DEBUG] interactiveBrowserTriggered value: ${interactiveBrowserTriggered.current}`);
    console.log(`[InteractiveBrowser] [DEBUG] original URL preserved: ${url ? 'yes' : 'no'}`);
    
    scraper.log('[InteractiveBrowser] Opening original portal URL', 'info');
    scraper.log('[InteractiveBrowser] User interaction flow active', 'warn');
    
    setInteractiveUrl(url);
    setCurrentUrl(url);
    setCanGoBack(false);
  };

  const openExternalBrowserOnce = (originalUrl: string) => {
    if (browserFallbackTriggered.current) {
      return;
    }
    browserFallbackTriggered.current = true;
    const scraper = ScraperService.getInstance();
    scraper.log('Opening original portal URL in external browser', 'info');
    Linking.openURL(originalUrl);
  };

  const handleClose = () => {
    setInteractiveUrl(null);
    interactiveBrowserTriggered.current = false;
    interactiveDownloadTriggeredRef.current = false;
  };

  const handleBack = () => {
    if (canGoBack && interactiveWebViewRef.current) {
      interactiveWebViewRef.current.goBack();
    }
  };

  const handleReload = () => {
    if (interactiveWebViewRef.current) {
      interactiveWebViewRef.current.reload();
    }
  };

  const handleOpenExternal = () => {
    const urlToOpen = currentUrl || interactiveUrl || '';
    if (urlToOpen) {
      openExternalBrowserOnce(urlToOpen);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCurrentUrl(navState.url);
    setIsBrowserLoading(navState.loading);

    const scraper = ScraperService.getInstance();
    const safeUrl = navState.url.split('?')[0];
    scraper.log(`[InteractiveBrowser] URL changed to: ${safeUrl}`, 'info');
    console.log(`[InteractiveBrowser] [DEBUG] WebView canGoBack state: ${navState.canGoBack}`);

    handleInteractiveDownloadCandidate(navState.url);

    if (!navState.loading) {
      scraper.log('[InteractiveBrowser] Navigation completed', 'info');
    }
  };

  const handleLoadStart = (event: any) => {
    setIsBrowserLoading(true);
    const scraper = ScraperService.getInstance();
    const safeUrl = event.nativeEvent.url.split('?')[0];
    scraper.log(`[InteractiveBrowser] Navigation started for: ${safeUrl}`, 'info');
  };

  const handleShouldStartLoadWithRequest = (request: any) => {
    const { url } = request;

    handleInteractiveDownloadCandidate(url);

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    const scraper = ScraperService.getInstance();
    scraper.log(`[InteractiveBrowser] Detected custom/unsupported URL scheme: ${url.split('?')[0]}`, 'warn');

    if (url.startsWith('intent://')) {
      try {
        const parts = url.split('#Intent;');
        const mainPart = parts[0].replace('intent://', '');
        
        let scheme = 'https';
        if (parts.length > 1) {
          const params = parts[1].split(';');
          const schemeParam = params.find((p: string) => p.startsWith('scheme='));
          if (schemeParam) {
            scheme = schemeParam.split('=')[1];
          }
        }
        
        const reconstructedUrl = `${scheme}://${mainPart}`;
        scraper.log(`[InteractiveBrowser] Converted intent URI to URL: ${reconstructedUrl.split('?')[0]}`, 'info');
        openExternalBrowserOnce(reconstructedUrl);
      } catch (e: any) {
        scraper.log(`[InteractiveBrowser] Failed to convert intent URI: ${e.message}`, 'error');
      }
    } else {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          openExternalBrowserOnce(url);
        } else {
          scraper.log(`[InteractiveBrowser] Scheme not supported by device: ${url.split(':')[0]}`, 'error');
        }
      }).catch(err => {
        scraper.log(`[InteractiveBrowser] Error checking scheme: ${err.message}`, 'error');
      });
    }
    
    return false;
  };

  const isAnyResolving = !!(
    resolvingUrl ||
    resolvingMirrorUrl ||
    resolvingFinalUrl ||
    resolvingServerUrl
  );

  const handleLinkPress = async (link: DownloadLink) => {
    if (isAnyResolving) {
      return;
    }

    // If it's a watch link, open directly
    if (link.type === 'watch') {
      Linking.canOpenURL(link.url).then(supported => {
        if (supported) {
          Linking.openURL(link.url);
        } else {
          Alert.alert(
            'Cannot Open Link',
            `Unable to open stream URL: ${link.url}`,
          );
        }
      });
      return;
    }

    // Toggle collapse if already resolved
    if (mirrors[link.url]) {
      const updated = {...mirrors};
      delete updated[link.url];
      setMirrors(updated);
      return;
    }

    browserFallbackTriggered.current = false;
    interactiveBrowserTriggered.current = false;
    interactiveDownloadTriggeredRef.current = false;
    resolutionSessionIdRef.current += 1;
    const sessionId = resolutionSessionIdRef.current;

    const originalPortalUrl = link.url;
    setResolvingUrl(originalPortalUrl);
    const scraper = ScraperService.getInstance();
    scraper.log(`Resolving download portal: "${link.label}"`, 'info');

    try {
      const scrapedMirrors = await scraper.scrapeDownloadPage(originalPortalUrl);
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (scrapedMirrors && scrapedMirrors.length > 0) {
        setMirrors(prev => ({...prev, [originalPortalUrl]: scrapedMirrors}));
        scraper.log(
          `Successfully bypassed portal and extracted ${scrapedMirrors.length} mirrors.`,
          'success',
        );
      } else {
        scraper.log(
          'No mirror links parsed on portal. Opening portal URL directly.',
          'warn',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, link.size || 'Unknown Size', originalPortalUrl);
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (err && (err.type === 'INTERACTIVE_BROWSER_REQUIRED' || err.type === 'EXTERNAL_BROWSER_REQUIRED')) {
        openInteractiveBrowser(originalPortalUrl, link.size || 'Unknown Size', link.label || 'Unknown Quality');
      } else {
        scraper.log(
          `Failed to bypass portal: ${err.message || JSON.stringify(err)}. Opening page in browser.`,
          'error',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, link.size || 'Unknown Size', originalPortalUrl);
        } else {
          openExternalBrowserOnce(originalPortalUrl);
        }
      }
    } finally {
      if (sessionId === resolutionSessionIdRef.current) {
        setResolvingUrl(null);
      }
    }
  };

  const handleMirrorClick = async (mirror: {label: string; url: string}) => {
    if (isAnyResolving) {
      return;
    }

    const scraper = ScraperService.getInstance();
    const isScrapable =
      mirror.url.includes('hubcloud') ||
      mirror.url.includes('gamerxyt') ||
      mirror.url.includes('pixeldrain') ||
      mirror.url.includes('buzz');

    if (!isScrapable) {
      if (scraper.isDirectFileUrl(mirror.url)) {
        onStartDownload(movie.title, 'Unknown Size', mirror.url);
        return;
      }
      // Direct opening for GDrive or unsupported links
      Linking.canOpenURL(mirror.url).then(supported => {
        if (supported) {
          Linking.openURL(mirror.url);
        } else {
          Alert.alert(
            'Cannot Open Link',
            `Unable to load mirror URL: ${mirror.url}`,
          );
        }
      });
      return;
    }

    // Toggle collapse if already resolved
    if (directLinks[mirror.url]) {
      const updated = {...directLinks};
      delete updated[mirror.url];
      setDirectLinks(updated);
      return;
    }

    resolutionSessionIdRef.current += 1;
    const sessionId = resolutionSessionIdRef.current;

    const originalPortalUrl = mirror.url;
    setResolvingMirrorUrl(originalPortalUrl);
    scraper.log(`Resolving download mirrors for: "${mirror.label}"`, 'info');

    try {
      const scrapedDirect = await scraper.scrapeDirectDownloadPage(originalPortalUrl);
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (scrapedDirect && scrapedDirect.length > 0) {
        setDirectLinks(prev => ({...prev, [originalPortalUrl]: scrapedDirect}));
        scraper.log(
          `Successfully parsed direct mirrors: Found ${scrapedDirect.length} endpoints.`,
          'success',
        );
      } else {
        scraper.log(
          'No direct files parsed on landing page. Opening mirror directly.',
          'warn',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, 'Unknown Size', originalPortalUrl);
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (err && (err.type === 'INTERACTIVE_BROWSER_REQUIRED' || err.type === 'EXTERNAL_BROWSER_REQUIRED')) {
        openInteractiveBrowser(originalPortalUrl, 'Unknown Size', mirror.label || 'Unknown Quality');
      } else {
        scraper.log(
          `Failed to bypass landing page: ${err.message || JSON.stringify(err)}. Opening mirror page in browser.`,
          'error',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, 'Unknown Size', originalPortalUrl);
        } else {
          openExternalBrowserOnce(originalPortalUrl);
        }
      }
    } finally {
      if (sessionId === resolutionSessionIdRef.current) {
        setResolvingMirrorUrl(null);
      }
    }
  };

  const handleFinalLinkClick = async (
    item: {label: string; url: string},
    size: string,
  ) => {
    if (isAnyResolving) {
      return;
    }

    const scraper = ScraperService.getInstance();
    // Check if it's a link generator portal
    const isGenerator =
      item.url.includes('gamerxyt') ||
      item.url.includes('hubcloud.php') ||
      /generate/i.test(item.label);

    if (!isGenerator) {
      onStartDownload(movie.title, size, item.url);
      return;
    }

    // Toggle collapse
    if (finalDirectLinks[item.url]) {
      const updated = {...finalDirectLinks};
      delete updated[item.url];
      setFinalDirectLinks(updated);
      return;
    }

    resolutionSessionIdRef.current += 1;
    const sessionId = resolutionSessionIdRef.current;

    const originalPortalUrl = item.url;
    setResolvingFinalUrl(originalPortalUrl);
    scraper.log(`Bypassing download generator: "${item.label}"`, 'info');

    try {
      const scrapedFinal = await scraper.scrapeDirectDownloadPage(originalPortalUrl);
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (scrapedFinal && scrapedFinal.length > 0) {
        setFinalDirectLinks(prev => ({...prev, [originalPortalUrl]: scrapedFinal}));
        scraper.log(
          `Successfully parsed final direct download servers: Found ${scrapedFinal.length} mirrors.`,
          'success',
        );
      } else {
        scraper.log(
          'No direct final download links resolved. Opening URL in browser.',
          'warn',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, size, originalPortalUrl);
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (err && (err.type === 'INTERACTIVE_BROWSER_REQUIRED' || err.type === 'EXTERNAL_BROWSER_REQUIRED')) {
        openInteractiveBrowser(originalPortalUrl, size || 'Unknown Size', item.label || 'Unknown Quality');
      } else {
        scraper.log(
          `Failed to bypass generator: ${err.message || JSON.stringify(err)}. Opening page in browser.`,
          'error',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, size, originalPortalUrl);
        } else {
          openExternalBrowserOnce(originalPortalUrl);
        }
      }
    } finally {
      if (sessionId === resolutionSessionIdRef.current) {
        setResolvingFinalUrl(null);
      }
    }
  };

  const handleServerLinkClick = async (
    item: {label: string; url: string},
    size: string,
  ) => {
    if (isAnyResolving) {
      return;
    }

    resolutionSessionIdRef.current += 1;
    const sessionId = resolutionSessionIdRef.current;

    const originalPortalUrl = item.url;
    setResolvingServerUrl(originalPortalUrl);
    const scraper = ScraperService.getInstance();
    scraper.log(
      `Extracting direct download link from host: "${item.label}"`,
      'info',
    );

    let resolvedDirect: string | null = null;
    let errorOccurred = false;

    try {
      resolvedDirect = await scraper.scrapeDirectFileHost(originalPortalUrl);
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        console.log('[InteractiveBrowser] Ignoring stale resolution session');
        return;
      }
      if (err && (err.type === 'INTERACTIVE_BROWSER_REQUIRED' || err.type === 'EXTERNAL_BROWSER_REQUIRED')) {
        openInteractiveBrowser(originalPortalUrl, size || 'Unknown Size', item.label || 'Unknown Quality');
      } else {
        scraper.log(
          `Failed to parse file host: ${err.message || JSON.stringify(err)}. Redirecting to browser...`,
          'error',
        );
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, size, originalPortalUrl);
        } else {
          openExternalBrowserOnce(originalPortalUrl);
        }
      }
      errorOccurred = true;
    }

    if (sessionId !== resolutionSessionIdRef.current) {
      console.log('[InteractiveBrowser] Ignoring stale resolution session');
      return;
    }

    if (errorOccurred) {
      setResolvingServerUrl(null);
      return;
    }

    if (resolvedDirect) {
      scraper.log(
        'Direct download link resolved! Starting download via system manager...',
        'success',
      );
      setResolvingServerUrl(null);
      onStartDownload(movie.title, size, resolvedDirect);
    } else {
      scraper.log(
        'Direct download resolution failed. Redirecting to external page...',
        'warn',
      );
      if (scraper.isDirectFileUrl(originalPortalUrl)) {
        onStartDownload(movie.title, size, originalPortalUrl);
      } else {
        openExternalBrowserOnce(originalPortalUrl);
      }
      setResolvingServerUrl(null);
    }
  };

  const getLinkIcon = (type: string) => {
    if (type === 'watch') {
      return '▶️';
    }
    if (type === 'download') {
      return '📥';
    }
    return '🔗';
  };

  return (
    <View style={styles.container}>
      {/* Full Image Preview Modal */}
      <Modal
        visible={fullImageUrl !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.imageModalContainer}
          activeOpacity={1}
          onPress={() => setFullImageUrl(null)}
        >
          {fullImageUrl ? (
            <Image
              source={{ uri: fullImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.imageCloseBtn}
            onPress={() => setFullImageUrl(null)}
          >
            <Text style={styles.imageCloseBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Interactive Browser Modal */}
      <Modal
        visible={interactiveUrl !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Browser Controls */}
          <View style={styles.browserHeader}>
            <TouchableOpacity style={styles.browserHeaderBtn} onPress={handleClose}>
              <Text style={styles.browserHeaderBtnText}>✕ Close</Text>
            </TouchableOpacity>
            
            <View style={styles.browserHeaderNav}>
              <TouchableOpacity
                style={[styles.browserHeaderBtn, !canGoBack && styles.browserHeaderBtnDisabled]}
                disabled={!canGoBack}
                onPress={handleBack}
              >
                <Text style={styles.browserHeaderBtnText}>◀ Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.browserHeaderBtn} onPress={handleReload}>
                <Text style={styles.browserHeaderBtnText}>🔄 Reload</Text>
              </TouchableOpacity>

              {isBrowserLoading && (
                <ActivityIndicator size="small" color="#8b5cf6" style={{ marginLeft: 8 }} />
              )}
            </View>

            <TouchableOpacity style={styles.browserHeaderBtn} onPress={handleOpenExternal}>
              <Text style={styles.browserHeaderBtnText}>🌐 Open in Browser</Text>
            </TouchableOpacity>
          </View>

          {/* Web View */}
          {interactiveUrl ? (
            <View style={styles.webViewWrapper}>
              <WebView
                ref={interactiveWebViewRef}
                style={{ flex: 1 }}
                source={{ uri: interactiveUrl }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                mixContentMode="always"
                onNavigationStateChange={handleNavigationStateChange}
                onLoadStart={handleLoadStart}
                onLoadEnd={() => setIsBrowserLoading(false)}
                onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                onHttpError={() => setIsBrowserLoading(false)}
                onFileDownload={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  const scraper = ScraperService.getInstance();
                  scraper.log(`[InteractiveBrowser] File download event fired: ${nativeEvent.downloadUrl.split('?')[0]}`, 'info');
                  handleInteractiveDownloadCandidate(nativeEvent.downloadUrl);
                }}
                onError={(syntheticEvent) => {
                  setIsBrowserLoading(false);
                  const { nativeEvent } = syntheticEvent;
                  const scraper = ScraperService.getInstance();
                  scraper.log(`[InteractiveBrowser] Error loading page: ${nativeEvent.description}`, 'error');
                  openExternalBrowserOnce(nativeEvent.url || interactiveUrl);
                }}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>◀ CATALOG</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Specifications
        </Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Netflix-style Hero backdrop */}
        <View style={styles.heroSection}>
          {movie.imageUrl ? (
            <Image
              source={{uri: movie.imageUrl}}
              style={styles.heroBackdrop}
              blurRadius={15}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.heroOverlay} />

          <View style={styles.heroContent}>
            {movie.imageUrl ? (
              <TouchableOpacity
                style={styles.posterWrapper}
                onPress={() => setFullImageUrl(movie.imageUrl || null)}
                activeOpacity={0.9}>
                <Image
                  source={{uri: movie.imageUrl}}
                  style={styles.poster}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.posterFallback}>
                <Text style={styles.fallbackIcon}>🎬</Text>
              </View>
            )}

            <View style={styles.heroMeta}>
              <Text style={styles.movieTitle} numberOfLines={2}>
                {movie.title}
              </Text>
              
              <View style={styles.metaBadgeRow}>
                {movie.date && (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>{movie.date}</Text>
                  </View>
                )}
                {movie.imdbRating && (
                  <View style={[styles.metaBadge, styles.metaBadgeRating]}>
                    <Text style={styles.metaBadgeText}>⭐ {movie.imdbRating}</Text>
                  </View>
                )}
                {movie.quality && (
                  <View style={[styles.metaBadge, styles.metaBadgeQuality]}>
                    <Text style={styles.metaBadgeText}>{movie.quality}</Text>
                  </View>
                )}
              </View>

              {movie.language ? (
                <Text style={styles.metaLanguage} numberOfLines={2}>
                  🌐 {movie.language}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Categories Badges */}
        {movie.categories.length > 0 && (
          <View style={styles.badgeRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeRow}>
              {movie.categories.map((cat, idx) => (
                <View key={idx} style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{cat}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Technical Details Sheet */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>Technical Details</Text>

          {movie.director && (
            <View style={styles.specRow}>
              <Text style={styles.specName}>Director</Text>
              <Text style={styles.specVal}>{movie.director}</Text>
            </View>
          )}

          {movie.stars.length > 0 && (
            <View style={styles.specRow}>
              <Text style={styles.specName}>Starring</Text>
              <Text style={styles.specVal}>{movie.stars.join(', ')}</Text>
            </View>
          )}

          {movie.genres.length > 0 && (
            <View style={[styles.specRow, {borderBottomWidth: 0}]}>
              <Text style={styles.specName}>Genres</Text>
              <Text style={styles.specVal}>{movie.genres.join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Storyline */}
        {movie.storyline && (
          <View style={[styles.glassCard, styles.storylineCard]}>
            <Text style={styles.sectionTitle}>Storyline</Text>
            <Text style={styles.storyText}>{movie.storyline}</Text>
          </View>
        )}

        {/* Screenshots */}
        {movie.screenshots.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Screenshots</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.screenshotRow}>
              {movie.screenshots.map((src, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setFullImageUrl(src)}
                  activeOpacity={0.8}>
                  <Image
                    source={{uri: src}}
                    style={styles.screenshot}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Active Scraper Stepper Progress */}
        {isAnyResolving && (
          <View style={styles.stepperCard}>
            <Text style={styles.stepperTitle}>🔎 RESOLVING MIRRORS PATHWAY</Text>
            <View style={styles.stepperSteps}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotCompleted]} />
                <Text style={styles.stepTextCompleted}>Connected</Text>
              </View>
              <View style={styles.stepLineCompleted} />
              
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  (resolvingMirrorUrl || resolvingFinalUrl || resolvingServerUrl) ? styles.stepDotCompleted : styles.stepDotActive
                ]} />
                <Text style={(resolvingMirrorUrl || resolvingFinalUrl || resolvingServerUrl) ? styles.stepTextCompleted : styles.stepTextActive}>
                  Bypass Mirror
                </Text>
              </View>
              <View style={(resolvingFinalUrl || resolvingServerUrl) ? styles.stepLineCompleted : styles.stepLinePending} />

              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  (resolvingFinalUrl || resolvingServerUrl) ? styles.stepDotCompleted : resolvingMirrorUrl ? styles.stepDotActive : styles.stepDotPending
                ]} />
                <Text style={(resolvingFinalUrl || resolvingServerUrl) ? styles.stepTextCompleted : resolvingMirrorUrl ? styles.stepTextActive : styles.stepTextPending}>
                  Direct File
                </Text>
              </View>
              <View style={resolvingServerUrl ? styles.stepLineCompleted : styles.stepLinePending} />

              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  resolvingServerUrl ? styles.stepDotActive : styles.stepDotPending
                ]} />
                <Text style={resolvingServerUrl ? styles.stepTextActive : styles.stepTextPending}>
                  Enqueuing
                </Text>
              </View>
            </View>
            <ActivityIndicator size="small" color="#8B5CF6" style={{marginTop: 12}} />
          </View>
        )}

        {/* Download links */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>Download & Watch Links</Text>
          {movie.downloadLinks.length === 0 ? (
            <Text style={styles.emptyLinksText}>
              No active download or player links found on page.
            </Text>
          ) : (
            movie.downloadLinks.map((link, idx) => {
              const isResolving = resolvingUrl === link.url;
              const hasMirrors = !!mirrors[link.url];
              const mirrorList = mirrors[link.url] || [];

              return (
                <View key={idx} style={styles.linkContainer}>
                  <TouchableOpacity
                    style={[
                      styles.linkRow,
                      link.type === 'watch' ? styles.watchLink : styles.downloadLink,
                      hasMirrors && styles.linkRowActive,
                      isAnyResolving && styles.disabledRow,
                    ]}
                    onPress={() => handleLinkPress(link)}
                    disabled={isAnyResolving}
                    activeOpacity={0.85}>
                    <Text style={styles.linkIcon}>
                      {getLinkIcon(link.type)}
                    </Text>
                    <View style={styles.linkTextWrapper}>
                      <Text style={styles.linkLabel} numberOfLines={2}>
                        {link.label}
                      </Text>
                      <View style={styles.linkBadges}>
                        {link.resolution && (
                          <View style={styles.resBadge}>
                            <Text style={styles.resBadgeText}>
                              {link.resolution}
                            </Text>
                          </View>
                        )}
                        {link.size && (
                          <View style={styles.sizeBadge}>
                            <Text style={styles.sizeBadgeText}>
                              {link.size}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {isResolving ? (
                      <ActivityIndicator size="small" color="#8B5CF6" />
                    ) : (
                      <Text
                        style={[
                          styles.linkArrow,
                          hasMirrors && styles.linkArrowActive,
                        ]}>
                        {link.type === 'watch' ? '▶' : hasMirrors ? '▼' : '▶'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Collapsible Scraped Mirrors List */}
                  {hasMirrors && (
                    <View style={styles.mirrorsBox}>
                      <Text style={styles.mirrorsHeader}>
                        🔑 BYPASSED ACCESS NODES
                      </Text>
                      {mirrorList.map((m, mIdx) => {
                        const isResolvingMirror = resolvingMirrorUrl === m.url;
                        const hasDirectLinks = !!directLinks[m.url];
                        const directList = directLinks[m.url] || [];

                        return (
                          <View key={mIdx} style={styles.mirrorContainer}>
                            <TouchableOpacity
                              style={[
                                styles.mirrorRow,
                                hasDirectLinks && styles.mirrorRowActive,
                                isAnyResolving && styles.disabledRow,
                              ]}
                              onPress={() => handleMirrorClick(m)}
                              disabled={isAnyResolving}
                              activeOpacity={0.85}>
                              <Text style={styles.mirrorIcon}>🔗</Text>
                              <Text
                                style={styles.mirrorLabel}
                                numberOfLines={1}>
                                {m.label}
                              </Text>
                              {isResolvingMirror ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#06B6D4"
                                />
                              ) : (
                                <Text
                                  style={[
                                    styles.mirrorArrow,
                                    hasDirectLinks && styles.mirrorArrowActive,
                                  ]}>
                                  {hasDirectLinks ? '▼' : '▶'}
                                </Text>
                              )}
                            </TouchableOpacity>

                            {/* Render Direct Final Download Links */}
                            {hasDirectLinks && (
                              <View style={styles.directLinksBox}>
                                <Text style={styles.directLinksHeader}>
                                  ⚡ DIRECT PATHS (CLICK TO DOWNLOAD)
                                </Text>
                                {directList.map((d, dIdx) => {
                                  const isResolvingFinal =
                                    resolvingFinalUrl === d.url;
                                  const hasFinalLinks =
                                    !!finalDirectLinks[d.url];
                                  const finalList =
                                    finalDirectLinks[d.url] || [];

                                  return (
                                    <View
                                      key={dIdx}
                                      style={styles.directContainer}>
                                      <TouchableOpacity
                                        style={[
                                          styles.directRow,
                                          hasFinalLinks &&
                                            styles.directRowActive,
                                          isAnyResolving && styles.disabledRow,
                                        ]}
                                        onPress={() =>
                                          handleFinalLinkClick(
                                            d,
                                            link.size || 'Unknown Size',
                                          )
                                        }
                                        disabled={isAnyResolving}
                                        activeOpacity={0.8}>
                                        <Text style={styles.directIcon}>
                                          💾
                                        </Text>
                                        <Text
                                          style={styles.directLabel}
                                          numberOfLines={2}>
                                          {d.label}
                                        </Text>
                                        {isResolvingFinal ? (
                                          <ActivityIndicator
                                            size="small"
                                            color="#10B981"
                                          />
                                        ) : (
                                          <Text
                                            style={[
                                              styles.directArrow,
                                              hasFinalLinks &&
                                                styles.directArrowActive,
                                            ]}>
                                            {hasFinalLinks ? '▼' : '📥'}
                                          </Text>
                                        )}
                                      </TouchableOpacity>

                                      {/* Render Level 4 Final Download Servers */}
                                      {hasFinalLinks && (
                                        <View style={styles.finalLinksBox}>
                                          <Text style={styles.finalLinksHeader}>
                                            🚀 CLOUD PROVIDER SELECTION
                                          </Text>
                                          {finalList.map((f, fIdx) => {
                                            const isResolvingServer =
                                              resolvingServerUrl === f.url;

                                            return (
                                              <View
                                                key={fIdx}
                                                style={styles.serverContainer}>
                                                <TouchableOpacity
                                                  style={[
                                                    styles.finalRow,
                                                    isResolvingServer &&
                                                      styles.finalRowActive,
                                                    isAnyResolving &&
                                                      styles.disabledRow,
                                                  ]}
                                                  onPress={() =>
                                                    handleServerLinkClick(
                                                      f,
                                                      link.size ||
                                                        'Unknown Size',
                                                    )
                                                  }
                                                  disabled={isAnyResolving}
                                                  activeOpacity={0.75}>
                                                  <Text
                                                    style={styles.finalIcon}>
                                                    ⚡
                                                  </Text>
                                                  <Text
                                                    style={styles.finalLabel}
                                                    numberOfLines={2}>
                                                    {f.label}
                                                  </Text>
                                                  {isResolvingServer ? (
                                                    <ActivityIndicator
                                                      size="small"
                                                      color="#8B5CF6"
                                                    />
                                                  ) : (
                                                    <Text
                                                      style={styles.finalArrow}>
                                                      📥
                                                    </Text>
                                                  )}
                                                </TouchableOpacity>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#101014',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroSection: {
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 10, 0.4)',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  posterWrapper: {
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: 110,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackIcon: {
    fontSize: 32,
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  movieTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  metaBadgeRating: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  metaBadgeQuality: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  metaBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
  },
  metaLanguage: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeRowWrapper: {
    marginHorizontal: -16,
  },
  badgeRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  categoryBadgeText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '700',
  },
  glassCard: {
    backgroundColor: 'rgba(22, 22, 28, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'flex-start',
  },
  specName: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    width: 80,
  },
  specVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  storylineCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#06B6D4',
  },
  storyText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  screenshotRow: {
    gap: 8,
  },
  screenshot: {
    width: 140,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepperCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 16,
    padding: 14,
  },
  stepperTitle: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  stepperSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    width: 65,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  stepDotPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepDotActive: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
  },
  stepTextPending: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '600',
  },
  stepTextActive: {
    color: '#8B5CF6',
    fontSize: 8,
    fontWeight: '800',
  },
  stepTextCompleted: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '600',
  },
  stepLinePending: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepLineCompleted: {
    flex: 1,
    height: 2,
    backgroundColor: '#10B981',
  },
  emptyLinksText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  linkContainer: {
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#22222b',
    borderRadius: 12,
    padding: 12,
  },
  downloadLink: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#8B5CF6',
  },
  watchLink: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#06B6D4',
  },
  linkRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  linkIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  linkTextWrapper: {
    flex: 1,
    gap: 4,
  },
  linkLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  linkBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  resBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  resBadgeText: {
    color: '#06B6D4',
    fontSize: 8,
    fontWeight: '800',
  },
  sizeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  sizeBadgeText: {
    color: '#8B5CF6',
    fontSize: 8,
    fontWeight: '800',
  },
  linkArrow: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
  linkArrowActive: {
    transform: [{rotate: '90deg'}],
    color: '#8B5CF6',
  },
  mirrorsBox: {
    backgroundColor: '#0A0A0C',
    borderWidth: 1,
    borderColor: '#22222b',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 12,
    gap: 8,
  },
  mirrorsHeader: {
    color: '#8B5CF6',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  mirrorContainer: {
    marginBottom: 8,
  },
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#22222b',
    borderRadius: 10,
    padding: 10,
  },
  mirrorRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  mirrorIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  mirrorLabel: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  mirrorArrow: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 6,
  },
  mirrorArrowActive: {
    transform: [{rotate: '90deg'}],
    color: '#06B6D4',
  },
  directLinksBox: {
    backgroundColor: '#0F0F13',
    borderWidth: 1,
    borderColor: '#22222b',
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 10,
    gap: 6,
  },
  directLinksHeader: {
    color: '#06B6D4',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  directContainer: {
    marginBottom: 6,
  },
  directRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: '#22222b',
    borderRadius: 8,
    padding: 8,
  },
  directRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  directIcon: {
    fontSize: 12,
    marginRight: 8,
  },
  directLabel: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  directArrow: {
    color: '#10B981',
    fontSize: 10,
    marginLeft: 6,
  },
  directArrowActive: {
    transform: [{rotate: '90deg'}],
    color: '#10B981',
  },
  finalLinksBox: {
    backgroundColor: '#0A0A0C',
    borderWidth: 1,
    borderColor: '#22222b',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
    gap: 6,
  },
  finalLinksHeader: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  serverContainer: {
    marginBottom: 5,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#22222b',
    borderRadius: 6,
    padding: 8,
  },
  finalRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  finalIcon: {
    fontSize: 10,
    marginRight: 6,
  },
  finalLabel: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  finalArrow: {
    color: '#8B5CF6',
    fontSize: 10,
    marginLeft: 4,
  },
  disabledRow: {
    opacity: 0.45,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  browserHeader: {
    height: 52,
    backgroundColor: '#101014',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  browserHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browserHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  browserHeaderBtnDisabled: {
    opacity: 0.3,
  },
  browserHeaderBtnText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
  imageCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imageCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
});
export default MovieDetailScreen;
