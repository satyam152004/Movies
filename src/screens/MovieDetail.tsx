import React, {useState, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ImageStyle,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {MovieDetail, DownloadLink} from '../data/models';
import {ScraperService} from '../services/scraper.service';
import {colors, radius, spacing, typography} from '../theme';

interface MovieDetailProps {
  movie: MovieDetail;
  onBack: () => void;
  onStartDownload: (title: string, size: string, url: string) => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
}

export const MovieDetailScreen: React.FC<MovieDetailProps> = ({
  movie,
  onBack,
  onStartDownload,
  isWatchlisted = false,
  onToggleWatchlist,
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
  const [, _setPreservedQualityLabel] = useState<string>('Unknown Quality');

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  const interactiveWebViewRef = useRef<any>(null);

  const handleInteractiveDownloadCandidate = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return;
    }

    const sessionId = resolutionSessionIdRef.current;
    if (sessionId !== resolutionSessionIdRef.current) {
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
    scraper.log(
      '[InteractiveBrowser] Direct download candidate confirmed',
      'success',
    );

    onStartDownload(movie.title, preservedSize || 'Unknown Size', url);
    handleClose();
  };

  const openInteractiveBrowser = (
    url: string,
    size?: string,
    label?: string,
  ) => {
    if (interactiveBrowserTriggered.current) {
      return;
    }
    interactiveBrowserTriggered.current = true;

    setPreservedSize(size || 'Unknown Size');
    _setPreservedQualityLabel(label || 'Unknown Quality');

    const scraper = ScraperService.getInstance();
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
    handleInteractiveDownloadCandidate(navState.url);

    if (!navState.loading) {
      scraper.log('[InteractiveBrowser] Navigation completed', 'info');
    }
  };

  const handleLoadStart = (event: any) => {
    setIsBrowserLoading(true);
    const scraper = ScraperService.getInstance();
    const safeUrl = event.nativeEvent.url.split('?')[0];
    scraper.log(
      `[InteractiveBrowser] Navigation started for: ${safeUrl}`,
      'info',
    );
  };

  const handleShouldStartLoadWithRequest = (request: any) => {
    const {url} = request;
    handleInteractiveDownloadCandidate(url);

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }

    const scraper = ScraperService.getInstance();
    if (url.startsWith('intent://')) {
      try {
        const parts = url.split('#Intent;');
        const mainPart = parts[0].replace('intent://', '');
        let scheme = 'https';
        if (parts.length > 1) {
          const params = parts[1].split(';');
          const schemeParam = params.find((p: string) =>
            p.startsWith('scheme='),
          );
          if (schemeParam) {
            scheme = schemeParam.split('=')[1];
          }
        }
        const reconstructedUrl = `${scheme}://${mainPart}`;
        openExternalBrowserOnce(reconstructedUrl);
      } catch (e: any) {
        scraper.log(
          `[InteractiveBrowser] Failed to convert intent URI: ${e.message}`,
          'error',
        );
      }
    } else {
      Linking.canOpenURL(url)
        .then(supported => {
          if (supported) {
            openExternalBrowserOnce(url);
          }
        })
        .catch(err => {
          scraper.log(
            `[InteractiveBrowser] Error checking scheme: ${err.message}`,
            'error',
          );
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

    if (link.type === 'watch') {
      Linking.canOpenURL(link.url).then(supported => {
        if (supported) {
          Linking.openURL(link.url);
        }
      });
      return;
    }

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

    try {
      const scrapedMirrors = await scraper.scrapeDownloadPage(
        originalPortalUrl,
      );
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (scrapedMirrors && scrapedMirrors.length > 0) {
        setMirrors(prev => ({...prev, [originalPortalUrl]: scrapedMirrors}));
      } else {
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(
            movie.title,
            link.size || 'Unknown Size',
            originalPortalUrl,
          );
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (
        err &&
        (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
          err.type === 'EXTERNAL_BROWSER_REQUIRED')
      ) {
        openInteractiveBrowser(originalPortalUrl, link.size, link.label);
      } else {
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(
            movie.title,
            link.size || 'Unknown Size',
            originalPortalUrl,
          );
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
      Linking.canOpenURL(mirror.url).then(supported => {
        if (supported) {
          Linking.openURL(mirror.url);
        }
      });
      return;
    }

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

    try {
      const scrapedDirect = await scraper.scrapeDirectDownloadPage(
        originalPortalUrl,
      );
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (scrapedDirect && scrapedDirect.length > 0) {
        setDirectLinks(prev => ({...prev, [originalPortalUrl]: scrapedDirect}));
      } else {
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, 'Unknown Size', originalPortalUrl);
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (
        err &&
        (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
          err.type === 'EXTERNAL_BROWSER_REQUIRED')
      ) {
        openInteractiveBrowser(originalPortalUrl, 'Unknown Size', mirror.label);
      } else {
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
    const isGenerator =
      item.url.includes('gamerxyt') ||
      item.url.includes('hubcloud.php') ||
      /generate/i.test(item.label);

    if (!isGenerator) {
      onStartDownload(movie.title, size, item.url);
      return;
    }

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

    try {
      const scrapedFinal = await scraper.scrapeDirectDownloadPage(
        originalPortalUrl,
      );
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (scrapedFinal && scrapedFinal.length > 0) {
        setFinalDirectLinks(prev => ({
          ...prev,
          [originalPortalUrl]: scrapedFinal,
        }));
      } else {
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, size, originalPortalUrl);
        } else {
          Linking.openURL(originalPortalUrl);
        }
      }
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (
        err &&
        (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
          err.type === 'EXTERNAL_BROWSER_REQUIRED')
      ) {
        openInteractiveBrowser(originalPortalUrl, size, item.label);
      } else {
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

    let resolvedDirect: string | null = null;
    let errorOccurred = false;

    try {
      resolvedDirect = await scraper.scrapeDirectFileHost(originalPortalUrl);
    } catch (err: any) {
      if (sessionId !== resolutionSessionIdRef.current) {
        return;
      }
      if (
        err &&
        (err.type === 'INTERACTIVE_BROWSER_REQUIRED' ||
          err.type === 'EXTERNAL_BROWSER_REQUIRED')
      ) {
        openInteractiveBrowser(originalPortalUrl, size, item.label);
      } else {
        if (scraper.isDirectFileUrl(originalPortalUrl)) {
          onStartDownload(movie.title, size, originalPortalUrl);
        } else {
          openExternalBrowserOnce(originalPortalUrl);
        }
      }
      errorOccurred = true;
    }

    if (sessionId !== resolutionSessionIdRef.current) {
      return;
    }

    if (errorOccurred) {
      setResolvingServerUrl(null);
      return;
    }

    if (resolvedDirect) {
      setResolvingServerUrl(null);
      onStartDownload(movie.title, size, resolvedDirect);
    } else {
      if (scraper.isDirectFileUrl(originalPortalUrl)) {
        onStartDownload(movie.title, size, originalPortalUrl);
      } else {
        openExternalBrowserOnce(originalPortalUrl);
      }
      setResolvingServerUrl(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full Image Preview Modal */}
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
            <Image
              source={{uri: fullImageUrl}}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.imageCloseBtn}
            onPress={() => setFullImageUrl(null)}>
            <Text style={styles.imageCloseBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Interactive WebView Modal */}
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
                ]}
                disabled={!canGoBack}
                onPress={handleBack}>
                <Text style={styles.browserHeaderBtnText}>◀ Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.browserHeaderBtn}
                onPress={handleReload}>
                <Text style={styles.browserHeaderBtnText}>🔄 Reload</Text>
              </TouchableOpacity>

              {isBrowserLoading && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.loaderIcon}
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.browserHeaderBtn}
              onPress={handleOpenExternal}>
              <Text style={styles.browserHeaderBtnText}>🌐 Browser</Text>
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
                onNavigationStateChange={handleNavigationStateChange}
                onLoadStart={handleLoadStart}
                onLoadEnd={() => setIsBrowserLoading(false)}
                onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                onHttpError={() => setIsBrowserLoading(false)}
                onFileDownload={syntheticEvent => {
                  const {nativeEvent} = syntheticEvent;
                  handleInteractiveDownloadCandidate(nativeEvent.downloadUrl);
                }}
                onError={syntheticEvent => {
                  setIsBrowserLoading(false);
                  const {nativeEvent} = syntheticEvent;
                  openExternalBrowserOnce(nativeEvent.url || interactiveUrl);
                }}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}>
          <Text style={styles.backBtnText}>◀ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Movie Detail
        </Text>
        {onToggleWatchlist ? (
          <TouchableOpacity
            style={[
              styles.watchlistHeaderBtn,
              isWatchlisted && styles.watchlistHeaderBtnActive,
            ]}
            onPress={onToggleWatchlist}>
            <Text style={styles.watchlistHeaderBtnText}>
              {isWatchlisted ? '❤️ Saved' : '🤍 Save'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.spacerWidth} />
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          {movie.imageUrl ? (
            <Image
              source={{uri: movie.imageUrl}}
              style={styles.heroBackdrop as ImageStyle}
              blurRadius={10}
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
                  style={styles.poster as ImageStyle}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.posterFallback}>
                <Text style={styles.fallbackIcon}>🎬</Text>
              </View>
            )}

            <View style={styles.heroMeta}>
              <Text style={styles.movieTitle} numberOfLines={3}>
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
                    <Text style={styles.metaBadgeText}>
                      ⭐ {movie.imdbRating}
                    </Text>
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

        {movie.categories.length > 0 && (
          <View style={styles.badgeRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryBadgeRow}>
              {movie.categories.map((cat, idx) => (
                <View key={idx} style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{cat}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {movie.storyline && (
          <View style={[styles.glassCard, styles.storylineCard]}>
            <Text style={styles.sectionTitle}>Storyline</Text>
            <Text style={styles.storyText}>{movie.storyline}</Text>
          </View>
        )}

        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>Technical Specifications</Text>
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
            <View style={[styles.specRow, styles.borderBottomNone]}>
              <Text style={styles.specName}>Genres</Text>
              <Text style={styles.specVal}>{movie.genres.join(', ')}</Text>
            </View>
          )}
        </View>

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
                    style={styles.screenshot as ImageStyle}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stepper Progress Loader */}
        {isAnyResolving && (
          <View style={styles.stepperCard}>
            <Text style={styles.stepperTitle}>
              ⚡ BYPASSING DOMAIN VERIFICATION
            </Text>
            <View style={styles.stepperSteps}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotCompleted]} />
                <Text style={styles.stepTextCompleted}>Portal Connect</Text>
              </View>
              <View style={styles.stepLineCompleted} />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    resolvingMirrorUrl ||
                    resolvingFinalUrl ||
                    resolvingServerUrl
                      ? styles.stepDotCompleted
                      : styles.stepDotActive,
                  ]}
                />
                <Text
                  style={
                    resolvingMirrorUrl ||
                    resolvingFinalUrl ||
                    resolvingServerUrl
                      ? styles.stepTextCompleted
                      : styles.stepTextActive
                  }>
                  Bypass Mirror
                </Text>
              </View>
              <View
                style={
                  resolvingFinalUrl || resolvingServerUrl
                    ? styles.stepLineCompleted
                    : styles.stepLinePending
                }
              />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    resolvingFinalUrl || resolvingServerUrl
                      ? styles.stepDotCompleted
                      : resolvingMirrorUrl
                      ? styles.stepDotActive
                      : styles.stepDotPending,
                  ]}
                />
                <Text
                  style={
                    resolvingFinalUrl || resolvingServerUrl
                      ? styles.stepTextCompleted
                      : resolvingMirrorUrl
                      ? styles.stepTextActive
                      : styles.stepTextPending
                  }>
                  Parse File
                </Text>
              </View>
              <View
                style={
                  resolvingServerUrl
                    ? styles.stepLineCompleted
                    : styles.stepLinePending
                }
              />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    resolvingServerUrl
                      ? styles.stepDotActive
                      : styles.stepDotPending,
                  ]}
                />
                <Text
                  style={
                    resolvingServerUrl
                      ? styles.stepTextActive
                      : styles.stepTextPending
                  }>
                  Enqueuing
                </Text>
              </View>
            </View>
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loaderSpacing}
            />
          </View>
        )}

        {/* Accordions */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>Bypass Download Qualities</Text>
          {movie.downloadLinks.length === 0 ? (
            <Text style={styles.emptyLinksText}>
              No accessible stream or download pathways resolved.
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
                      link.type === 'watch'
                        ? styles.watchLink
                        : styles.downloadLink,
                      hasMirrors && styles.linkRowActive,
                      isAnyResolving && styles.disabledRow,
                    ]}
                    onPress={() => handleLinkPress(link)}
                    disabled={isAnyResolving}
                    activeOpacity={0.85}>
                    <Text style={styles.linkIcon}>
                      {link.type === 'watch' ? '▶️' : '📥'}
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
                      <ActivityIndicator size="small" color={colors.primary} />
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
                                  color={colors.secondary}
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
                                            color={colors.success}
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

                                      {hasFinalLinks && (
                                        <View style={styles.finalLinksBox}>
                                          <Text style={styles.finalLinksHeader}>
                                            🚀 SELECT CLOUD SERVER
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
                                                      color={colors.primary}
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
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.weights.heavy,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: typography.weights.heavy,
    flex: 1,
    textAlign: 'center',
  },
  watchlistHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.2)',
  },
  watchlistHeaderBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  watchlistHeaderBtnText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.heavy,
  },
  spacerWidth: {
    width: 60,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.md,
    gap: 16,
    paddingBottom: 40,
  },
  heroSection: {
    height: 240,
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 16,
  },
  posterWrapper: {
    width: 110,
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: 110,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: typography.weights.heavy,
    lineHeight: 22,
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  metaBadgeQuality: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  metaBadgeText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: typography.weights.heavy,
  },
  metaLanguage: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  badgeRowWrapper: {
    marginHorizontal: -16,
  },
  categoryBadgeRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: 'rgba(144, 97, 249, 0.08)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.15)',
  },
  categoryBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  glassCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  specName: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    width: 80,
  },
  specVal: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  borderBottomNone: {
    borderBottomWidth: 0,
  },
  storylineCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  storyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: typography.weights.medium,
  },
  screenshotRow: {
    gap: 8,
  },
  screenshot: {
    width: 140,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperCard: {
    backgroundColor: 'rgba(144, 97, 249, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.2)',
    borderRadius: radius.card,
    padding: 14,
  },
  stepperTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: typography.weights.heavy,
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
    backgroundColor: colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  stepTextPending: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: typography.weights.semibold,
  },
  stepTextActive: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
  },
  stepTextCompleted: {
    color: colors.success,
    fontSize: 8,
    fontWeight: typography.weights.semibold,
  },
  stepLinePending: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: 4,
    marginTop: -16,
  },
  stepLineCompleted: {
    flex: 1,
    height: 2,
    backgroundColor: colors.success,
    marginHorizontal: 4,
    marginTop: -16,
  },
  emptyLinksText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  linkContainer: {
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 12,
  },
  linkRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: colors.primary,
  },
  disabledRow: {
    opacity: 0.6,
  },
  watchLink: {
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  downloadLink: {
    borderColor: colors.border,
  },
  linkIcon: {
    fontSize: 18,
  },
  linkTextWrapper: {
    flex: 1,
    gap: 4,
  },
  linkLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  linkBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  resBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  resBadgeText: {
    color: colors.secondary,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
  },
  sizeBadge: {
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  sizeBadgeText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
  },
  linkArrow: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  linkArrowActive: {
    color: colors.primary,
  },
  mirrorsBox: {
    backgroundColor: '#0F0F13',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: 10,
    gap: 8,
  },
  mirrorsHeader: {
    color: colors.secondary,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
    letterSpacing: 1,
    marginBottom: 2,
  },
  mirrorContainer: {
    marginBottom: 6,
  },
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 8,
    gap: 8,
  },
  mirrorRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: colors.secondary,
  },
  mirrorIcon: {
    fontSize: 12,
  },
  mirrorLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  mirrorArrow: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  mirrorArrowActive: {
    color: colors.secondary,
  },
  directLinksBox: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.secondary,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    padding: 8,
    gap: 6,
  },
  directLinksHeader: {
    color: colors.success,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  directContainer: {
    marginBottom: 4,
  },
  directRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 6,
    gap: 6,
  },
  directRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: colors.success,
  },
  directIcon: {
    fontSize: 12,
  },
  directLabel: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  directArrow: {
    color: colors.success,
    fontSize: 10,
  },
  directArrowActive: {
    color: colors.success,
  },
  finalLinksBox: {
    backgroundColor: '#0F0F13',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.success,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    padding: 6,
    gap: 4,
  },
  finalLinksHeader: {
    color: colors.primary,
    fontSize: 7,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
  },
  serverContainer: {
    marginBottom: 2,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 6,
    gap: 6,
  },
  finalRowActive: {
    backgroundColor: colors.elevated,
  },
  finalIcon: {
    fontSize: 10,
  },
  finalLabel: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '500',
    flex: 1,
  },
  finalArrow: {
    color: colors.primary,
    fontSize: 9,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '95%',
    height: '80%',
  },
  imageCloseBtn: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radius.button,
  },
  imageCloseBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: typography.weights.heavy,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  browserHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  browserHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  browserHeaderBtnDisabled: {
    opacity: 0.3,
  },
  browserHeaderBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
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
  loaderSpacing: {
    marginTop: 12,
  },
});
export default MovieDetailScreen;
