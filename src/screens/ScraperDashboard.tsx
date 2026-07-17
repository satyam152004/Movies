import React, {useState, useEffect, useRef} from 'react';
import {UrlDiscoveryService} from '../services/urlDiscovery.service';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Animated,
  Clipboard,
} from 'react-native';
import {ScraperService} from '../services/scraper.service';
import {CatalogItem, MovieDetail} from '../data/models';
import {colors as COLORS, spacing as SPACING, radius as RADIUS} from '../theme';

interface ScraperDashboardProps {
  onCatalogLoaded: (items: CatalogItem[]) => void;
  onSingleMovieLoaded: (movie: MovieDetail) => void;
  navigateToCatalog: () => void;
  navigateToDetail: () => void;
}

export const ScraperDashboard: React.FC<ScraperDashboardProps> = ({
  onCatalogLoaded,
  onSingleMovieLoaded,
  navigateToCatalog,
  navigateToDetail,
}) => {
  const [url, setUrl] = useState('');
  const [discoveredDomain, setDiscoveredDomain] = useState(
    'https://new3.hdhub4u.cl',
  );
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<'catalog' | 'single'>('catalog');
  const [forceDynamic, setForceDynamic] = useState(false);
  const [maxPages, setMaxPages] = useState('1');
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('Engine Standby');
  const scraper = ScraperService.getInstance();
  const discoveryService = UrlDiscoveryService.getInstance();

  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }),
    ).start();
  }, [pulseAnim, radarAnim]);

  useEffect(() => {
    const resolveDomain = async () => {
      setIsDiscovering(true);
      setStatusText('Resolving active domain...');
      try {
        const activeUrl = await discoveryService.getActiveUrl();
        setDiscoveredDomain(activeUrl);
        setUrl(`${activeUrl}/?utm=gs`);
        setStatusText('Active domain resolved.');
      } catch (err: any) {
        scraper.log(`Failed to resolve active domain: ${err.message}`, 'error');
        setStatusText('Failed to resolve active domain. Using fallback.');
        const fallback = 'https://new3.hdhub4u.cl';
        setDiscoveredDomain(fallback);
        setUrl(`${fallback}/?utm=gs`);
      } finally {
        setIsDiscovering(false);
      }
    };
    resolveDomain();
  }, [discoveryService, scraper]);

  const handleRefreshDomain = async () => {
    if (isRunning || isDiscovering) {
      return;
    }
    setIsDiscovering(true);
    setStatusText('Re-discovering active domain...');
    try {
      const activeUrl = await discoveryService.getActiveUrl(true);
      setDiscoveredDomain(activeUrl);
      if (scrapeMode === 'single') {
        setUrl(`${activeUrl}/mortal-kombat-ii-2026-webrip-hindi-full-movie/`);
      } else {
        setUrl(`${activeUrl}/?utm=gs`);
      }
      setStatusText(`Domain resolved: ${activeUrl}`);
    } catch (err: any) {
      scraper.log(`Failed to resolve active domain: ${err.message}`, 'error');
      setStatusText('Failed to resolve active domain.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleStartScrape = async () => {
    if (isRunning) {
      return;
    }
    setIsRunning(true);
    scraper.log(
      `=== Starting Scraping Job (${scrapeMode.toUpperCase()} Mode) ===`,
      'info',
    );

    try {
      if (scrapeMode === 'single') {
        setStatusText('Fetching single movie details...');
        scraper.log(`Scraping single detail page: ${url}`, 'info');

        const detail = await scraper.scrapeMovieDetail(url, forceDynamic);
        onSingleMovieLoaded(detail);

        scraper.log(`Successfully parsed: "${detail.title}"`, 'success');
        setStatusText('Completed single movie scrape.');
        navigateToDetail();
      } else {
        setStatusText('Fetching catalog listing...');
        scraper.log(`Starting catalog scraper: ${url}`, 'info');

        let currentTargetUrl: string | null = url;
        const pagesToScrape = parseInt(maxPages, 10) || 1;
        const allCatalogItems: CatalogItem[] = [];

        for (let page = 1; page <= pagesToScrape && currentTargetUrl; page++) {
          setStatusText(`Fetching catalog page ${page}/${pagesToScrape}...`);
          scraper.log(
            `Crawling catalog page ${page}: ${currentTargetUrl}`,
            'info',
          );

          const result = await scraper.scrapeCatalogPage(
            currentTargetUrl,
            forceDynamic,
          );
          allCatalogItems.push(...result.items);

          currentTargetUrl = result.nextPageUrl;
          if (!currentTargetUrl && page < pagesToScrape) {
            scraper.log(
              `No pagination URL found after page ${page}. Stopping.`,
              'warn',
            );
            break;
          }

          if (page < pagesToScrape) {
            scraper.log(
              'Waiting 2s rate limit delay before next page...',
              'info',
            );
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (allCatalogItems.length === 0) {
          throw new Error('No catalog items extracted. Check selectors.');
        }

        onCatalogLoaded(allCatalogItems);
        setStatusText(
          `Successfully scraped ${allCatalogItems.length} catalog posts.`,
        );
        navigateToCatalog();
      }
    } catch (err: any) {
      scraper.log(`Job failed with error: ${err.message}`, 'error');
      setStatusText(`Scraper Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handlePaste = async () => {
    try {
      const content = await Clipboard.getString();
      if (content) {
        setUrl(content);
      }
    } catch (e) {}
  };

  const radarScale = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.2],
  });

  const radarOpacity = radarAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}>
      {/* Domain Discovery Card */}
      <View style={styles.radarCard}>
        <View style={styles.radarHeader}>
          <View style={styles.radarInfo}>
            <Text style={styles.radarTitle}>Domain Discovery</Text>
            <Text style={styles.radarSub}>
              Active HDHub4U Domain DNS Resolver
            </Text>
          </View>
          <Animated.View style={[styles.pulseDot, {opacity: pulseAnim}]} />
        </View>

        <View style={styles.radarVisualContainer}>
          <Animated.View
            style={[
              styles.radarRing,
              {
                transform: [{scale: radarScale}],
                opacity: radarOpacity,
              },
            ]}
          />
          <View style={styles.domainIndicator}>
            <Text style={styles.domainLabel}>ACTIVE DOMAIN</Text>
            <Text style={styles.domainValue} numberOfLines={1}>
              {discoveredDomain}
            </Text>
          </View>
        </View>

        <View style={styles.radarFooter}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {isDiscovering ? 'SCANNING' : 'ONLINE'}
            </Text>
          </View>
          {!isRunning && (
            <TouchableOpacity
              style={styles.btnDiscover}
              onPress={handleRefreshDomain}
              disabled={isDiscovering}
              activeOpacity={0.7}>
              <Text style={styles.btnDiscoverText}>
                {isDiscovering ? '🔄 SCANNING...' : '🔄 REDISCOVER'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Target Parameters Card */}
      <View style={styles.glassCard}>
        <Text style={styles.sectionHeader}>Target Parameters</Text>

        <Text style={styles.inputLabel}>Seed / Target URL</Text>
        <View style={styles.premiumInputWrapper}>
          <Text style={styles.inputIcon}>🔗</Text>
          <TextInput
            style={styles.premiumInput}
            value={url}
            onChangeText={setUrl}
            placeholder="Enter target webpage URL"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />
          <View style={styles.inputActions}>
            {url.length > 0 && (
              <TouchableOpacity
                onPress={() => setUrl('')}
                style={styles.inputActionBtn}>
                <Text style={styles.inputActionText}>✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handlePaste}
              style={styles.inputActionBtn}>
              <Text style={[styles.inputActionText, {color: COLORS.secondary}]}>
                PASTE
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.inputLabel}>Scraping Mode Strategy</Text>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              scrapeMode === 'catalog' && styles.segmentBtnActive,
            ]}
            onPress={() => {
              setScrapeMode('catalog');
              if (url.includes('-movie/') || url.includes('-episodes/')) {
                setUrl(`${discoveredDomain}/?utm=gs`);
              }
            }}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.segmentText,
                scrapeMode === 'catalog' && styles.segmentTextActive,
              ]}>
              📁 Catalog / List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              scrapeMode === 'single' && styles.segmentBtnActive,
            ]}
            onPress={() => {
              setScrapeMode('single');
              setUrl(
                `${discoveredDomain}/mortal-kombat-ii-2026-webrip-hindi-full-movie/`,
              );
            }}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.segmentText,
                scrapeMode === 'single' && styles.segmentTextActive,
              ]}>
              🎬 Single Movie
            </Text>
          </TouchableOpacity>
        </View>

        {scrapeMode === 'catalog' && (
          <View style={styles.configContainer}>
            <View style={styles.configRow}>
              <View style={styles.configInfo}>
                <Text style={styles.configLabel}>Page Crawl Limit</Text>
                <Text style={styles.configDesc}>
                  Number of index pages to traverse
                </Text>
              </View>
              <TextInput
                style={styles.numericInput}
                value={maxPages}
                onChangeText={setMaxPages}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        )}

        <View style={styles.switchRow}>
          <View style={styles.configInfo}>
            <Text style={styles.configLabel}>Force Dynamic (WebView)</Text>
            <Text style={styles.configDesc}>
              Use headless engine script execution for heavy portals
            </Text>
          </View>
          <Switch
            value={forceDynamic}
            onValueChange={setForceDynamic}
            trackColor={{false: '#1e1e24', true: COLORS.primary}}
            thumbColor={forceDynamic ? COLORS.secondary : '#94A3B8'}
          />
        </View>
      </View>

      {/* Engine Status Box */}
      <View style={styles.glassCard}>
        <Text style={styles.sectionHeader}>Engine Controller</Text>
        <View style={styles.statusBox}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    isRunning || isDiscovering ? COLORS.danger : COLORS.success,
                },
              ]}
            />
            <Text style={styles.statusValueText} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        </View>

        {isRunning ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingBoxText}>
              SCRAPING TARGET PATHWAY...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={handleStartScrape}
            activeOpacity={0.8}>
            <Text style={styles.startBtnText}>START CRAWLER ENGINE</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: SPACING.md,
    gap: 16,
    paddingBottom: 40,
  },
  radarCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  radarInfo: {
    flex: 1,
  },
  radarTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  radarSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  radarVisualContainer: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  radarRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  domainIndicator: {
    backgroundColor: COLORS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '90%',
  },
  domainLabel: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  domainValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  radarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusChipText: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  btnDiscover: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnDiscoverText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  sectionHeader: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  premiumInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  premiumInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    padding: 0,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  inputActionText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.input,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: COLORS.primary,
  },
  configContainer: {
    marginBottom: 16,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
  },
  configInfo: {
    flex: 1,
    marginRight: 10,
  },
  configLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  configDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  numericInput: {
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    width: 60,
    height: 38,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    padding: 0,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 6,
  },
  statusBox: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusValueText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  loadingBoxText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 10,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  startBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
