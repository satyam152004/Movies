import React, {useMemo, useState, useRef} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Animated,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
  RefreshControl,
  Image,
} from 'react-native';
import {CatalogItem} from '../data/models';
import {colors, radius, spacing, typography} from '../theme';
import {HeroBanner} from '../components/media/HeroBanner';
import {SectionHeader} from '../components/layout/SectionHeader';
import {MovieCard} from '../components/cards/MovieCard';
import {EmptyState} from '../components/feedback/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';
import {formatDisplayTitle} from '../utils/formatDisplayTitle';
import {useProfile} from '../hooks/useProfile';
import {MovieGroup, MovieSection, SectionConfig, WatchProgress} from '../models/movie.types';
import {groupCatalogItems} from '../utils/movieGrouping';
import {TmdbService} from '../services/tmdb.service';
import {MovieMetadataResolver} from '../services/movieMetadataResolver';

const BUILTIN_AVATARS = [
  {id: 'avatar_popcorn', emoji: '🍿'},
  {id: 'avatar_director', emoji: '🎬'},
  {id: 'avatar_camera', emoji: '🎥'},
  {id: 'avatar_theater', emoji: '🎭'},
  {id: 'avatar_superhero', emoji: '🦸'},
  {id: 'avatar_cool', emoji: '🕶️'},
];

export interface CategoryFilter {
  label: string;
  path: string | null;
}

const CATEGORIES: CategoryFilter[] = [
  {label: 'All', path: null},
  {label: 'Bollywood', path: 'category/bollywood-movies/'},
  {label: 'Hollywood', path: 'category/hollywood-movies/'},
  {label: 'Hindi Dubbed', path: 'category/hindi-dubbed/'},
  {label: 'South Hindi', path: 'category/south-hindi-movies/'},
  {label: 'Web Series', path: 'category/web-series/'},
  {label: '18+', path: 'category/adult/'},
  {label: 'Action', path: 'category/action-movies/'},
  {label: 'Adventure', path: 'category/adventure/'},
  {label: 'Animation', path: 'category/animated-movies/'},
  {label: 'Comedy', path: 'category/comedy-movies/'},
  {label: 'Horror', path: 'category/horror-movies/'},
  {label: 'Sci-Fi', path: 'category/sci-fi/'},
  {label: 'Thriller', path: 'category/thriller/'},
];

const HOME_SECTION_CONFIG: SectionConfig[] = [
  { id: 'continue-watching', title: 'Continue Watching', layout: 'landscape' },
  { id: 'trending', title: 'Trending Now', layout: 'poster' },
  { id: 'top10', title: 'Top 10', layout: 'numbered' },
  { id: 'latest', title: 'Latest Releases', layout: 'poster' },
  { id: 'action', title: 'Action Movies', layout: 'poster', genreFilter: 'Action' },
  { id: 'comedy', title: 'Comedy Hits', layout: 'poster', genreFilter: 'Comedy' },
  { id: 'recommended', title: 'Recommended For You', layout: 'poster' },
  { id: 'collections', title: 'Movie Collections', layout: 'featured' },
];

interface HomeScreenProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onExplorePress?: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isLoading?: boolean;
  selectedCategory: string | null;
  onSelectCategory: (categoryPath: string | null) => void;
  onSearchPress?: () => void;
  onProfilePress?: () => void;
  watchlist?: CatalogItem[];
  onToggleWatchlist?: (item: CatalogItem) => void;
  onViewAllPress?: (title: string, items: CatalogItem[], type: string) => void;
  // SWR fields:
  isRefreshing?: boolean;
  onRefresh?: () => void;
  lastUpdatedMessage?: string;
  isOffline?: boolean;
  error?: string | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  onSelectItem,
  onExplorePress,
  onLoadMore,
  isLoadingMore = false,
  isLoading = false,
  selectedCategory,
  onSelectCategory,
  onSearchPress,
  onProfilePress,
  watchlist = [],
  onToggleWatchlist,
  onViewAllPress,
  isRefreshing = false,
  onRefresh,
  lastUpdatedMessage = '',
  isOffline = false,
  error = null,
}) => {
  const {profile, getInitials} = useProfile();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mock watch progress for demo curation logic
  const [watchProgress] = useState<WatchProgress[]>([
    { movieId: '7-dogs-2026', position: 1200, duration: 7200, updatedAt: Date.now() },
  ]);

  const featuredMovie = useMemo(
    () => (items.length > 0 ? items[0] : null),
    [items],
  );

  const isFeaturedWatchlisted = useMemo(() => {
    if (!featuredMovie) {
      return false;
    }
    return watchlist.some(w => w.url === featuredMovie.url);
  }, [featuredMovie, watchlist]);

  const [trendingSectionMovies, setTrendingSectionMovies] = useState<MovieGroup[]>([]);
  const [top10SectionMovies, setTop10SectionMovies] = useState<MovieGroup[]>([]);
  const [actionSectionMovies, setActionSectionMovies] = useState<MovieGroup[]>([]);
  const [comedySectionMovies, setComedySectionMovies] = useState<MovieGroup[]>([]);
  const [collectionsSectionMovies, setCollectionsSectionMovies] = useState<MovieGroup[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(true);

  React.useEffect(() => {
    let active = true;
    const loadHomeSections = async () => {
      setIsDiscoveryLoading(true);
      try {
        const tmdb = TmdbService.getInstance();

        // 1. Fetch TMDB candidates concurrently
        const [trendingList, topRatedList, actionList, comedyList, collectionsList] = await Promise.all([
          tmdb.getTrendingMovies(),
          tmdb.getTopRatedMovies(),
          tmdb.getDiscoverMovies({ withGenres: [28], sortBy: 'popularity.desc' }),
          tmdb.getDiscoverMovies({ withGenres: [35], sortBy: 'popularity.desc' }),
          tmdb.getDiscoverMovies({ sortBy: 'revenue.desc' }),
        ]);

        if (!active) return;

        // 2. Resolve candidates against targeted catalog searches
        const [trending, top10, action, comedy, collections] = await Promise.all([
          MovieMetadataResolver.resolveDiscoverySection(trendingList, 10),
          MovieMetadataResolver.resolveDiscoverySection(topRatedList, 10),
          MovieMetadataResolver.resolveDiscoverySection(actionList, 10),
          MovieMetadataResolver.resolveDiscoverySection(comedyList, 10),
          MovieMetadataResolver.resolveDiscoverySection(collectionsList, 5),
        ]);

        if (!active) return;

        setTrendingSectionMovies(trending);
        setTop10SectionMovies(top10);
        setActionSectionMovies(action);
        setComedySectionMovies(comedy);
        setCollectionsSectionMovies(collections);
      } catch (err) {
        console.warn('[HomeScreen] Failed to prepare targeted discovery sections', err);
      } finally {
        if (active) {
          setIsDiscoveryLoading(false);
        }
      }
    };

    loadHomeSections();
    return () => {
      active = false;
    };
  }, []);

  const latestMovies = useMemo(() => {
    return groupCatalogItems(items).slice(0, 10);
  }, [items]);

  const continueWatchingMovies = useMemo(() => {
    const continueWatchingProgress = watchProgress
      .filter(p => p.position > 0 && p.duration > 0 && p.position < p.duration * 0.90)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    const catalogGroups = groupCatalogItems(items);
    const resolved = continueWatchingProgress
      .map(p => catalogGroups.find(m => m.movieId === p.movieId) || 
                trendingSectionMovies.find(m => m.movieId === p.movieId) ||
                top10SectionMovies.find(m => m.movieId === p.movieId))
      .filter((m): m is MovieGroup => !!m);

    const unique = new Map<string, MovieGroup>();
    for (const m of resolved) {
      if (!unique.has(m.movieId)) {
        unique.set(m.movieId, m);
      }
    }
    return Array.from(unique.values());
  }, [items, watchProgress, trendingSectionMovies, top10SectionMovies]);

  const recommendedMovies = useMemo(() => {
    const watchedGenres = new Set<string>();
    continueWatchingMovies.forEach(m => {
      m.genres?.forEach(g => watchedGenres.add(g));
    });
    if (watchedGenres.size > 0) {
      const allScraperGroups = [
        ...groupCatalogItems(items),
        ...trendingSectionMovies,
        ...top10SectionMovies,
        ...actionSectionMovies,
        ...comedySectionMovies,
        ...collectionsSectionMovies
      ];
      const uniqueGroupsMap = new Map<string, MovieGroup>();
      allScraperGroups.forEach(g => uniqueGroupsMap.set(g.movieId, g));
      const uniqueGroups = Array.from(uniqueGroupsMap.values());

      return uniqueGroups
        .filter(m => !continueWatchingMovies.some(cw => cw.movieId === m.movieId))
        .filter(m => m.genres?.some(g => watchedGenres.has(g)))
        .slice(0, 8);
    }
    return [];
  }, [items, continueWatchingMovies, trendingSectionMovies, top10SectionMovies, actionSectionMovies, comedySectionMovies, collectionsSectionMovies]);

  const sections = useMemo(() => {
    const resultSections: MovieSection[] = [];

    for (const config of HOME_SECTION_CONFIG) {
      let sectionMovies: MovieGroup[] = [];

      switch (config.id) {
        case 'continue-watching':
          sectionMovies = continueWatchingMovies;
          break;
        case 'trending':
          sectionMovies = trendingSectionMovies;
          break;
        case 'top10':
          sectionMovies = top10SectionMovies;
          break;
        case 'latest':
          sectionMovies = latestMovies;
          break;
        case 'recommended':
          sectionMovies = recommendedMovies;
          break;
        case 'collections':
          sectionMovies = collectionsSectionMovies;
          break;
        case 'action':
          sectionMovies = actionSectionMovies;
          break;
        case 'comedy':
          sectionMovies = comedySectionMovies;
          break;
        default:
          break;
      }

      if (sectionMovies.length > 0) {
        resultSections.push({
          id: config.id,
          title: config.title,
          layout: config.layout,
          movies: sectionMovies,
        });
      }
    }

    return resultSections;
  }, [
    continueWatchingMovies,
    trendingSectionMovies,
    top10SectionMovies,
    latestMovies,
    recommendedMovies,
    collectionsSectionMovies,
    actionSectionMovies,
    comedySectionMovies,
  ]);

  // Show skeleton during initial catalog page load OR while discovery search is resolving
  const isSkeletonActive = (isLoading && items.length === 0) || isDiscoveryLoading;
  if (isSkeletonActive) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Banner Skeleton */}
        <View style={styles.skeletonBanner} />

        <View style={styles.content}>
          {/* Horizontal Section 1 Skeleton */}
          <View style={styles.section}>
            <View style={styles.skeletonTitle} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3, 4].map(idx => (
                <View key={idx} style={styles.skeletonCardHorizontal} />
              ))}
            </ScrollView>
          </View>

          {/* Horizontal Section 2 Skeleton */}
          <View style={styles.section}>
            <View style={styles.skeletonTitle} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3, 4].map(idx => (
                <View key={idx} style={styles.skeletonCardHorizontal} />
              ))}
            </ScrollView>
          </View>

          {/* Vertical Grid Section Skeleton */}
          <View style={styles.sectionHeaderSpacing}>
            <View style={styles.skeletonTitle} />
          </View>
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4, 5, 6].map(idx => (
              <View key={idx} style={styles.gridCardWrapper}>
                <View style={styles.skeletonCardGrid} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  if (items.length === 0) {
    if (isOffline || error) {
      return (
        <EmptyState
          icon={
            <Icon
              name="cloud-offline-outline"
              size={54}
              color={colors.primary}
            />
          }
          title={isOffline ? 'Connection Offline' : "Couldn't load movies"}
          description={
            isOffline
              ? 'Check your connection and try again'
              : error || 'An error occurred while loading catalog.'
          }
          onAction={onRefresh}
          actionTitle="Retry"
        />
      );
    }

    return (
      <EmptyState
        icon={<Icon name="film-outline" size={54} color={colors.primary} />}
        title="Movie Library Ready"
        description="Go to Profile -> Settings and toggle Developer Mode to start the scraper and sync movie catalogs."
        onAction={onExplorePress}
        actionTitle="Go to Browse"
      />
    );
  }

  const headerHeight =
    Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 56;
  const bannerHeight = Math.min(
    Math.max(Dimensions.get('window').height * 0.58, 450),
    550,
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {featuredMovie && !selectedCategory && (
        <View style={styles.bannerWrapper}>
          <HeroBanner
            title={formatDisplayTitle(featuredMovie.title)}
            imageUrl={featuredMovie.imageUrl}
            year={featuredMovie.year}
            resolution={featuredMovie.resolution}
            isDualAudio={featuredMovie.isDualAudio}
            onPlayPress={() => onSelectItem(featuredMovie)}
            onInfoPress={() => onSelectItem(featuredMovie)}
            isWatchlisted={isFeaturedWatchlisted}
            onWatchlistPress={
              onToggleWatchlist
                ? () => onToggleWatchlist(featuredMovie)
                : undefined
            }
          />
        </View>
      )}

      {/* Categories placeholder to preserve layout space in FlatList */}
      <View style={{height: 60, backgroundColor: 'transparent'}} />

      {/* SWR Status Banner */}
      {(isOffline || error) && (
        <View style={styles.statusBanner}>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOffline
                    ? '#EF4444'
                    : error
                    ? '#F59E0B'
                    : '#10B981',
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.content}>
        {!selectedCategory &&
          sections.map(section => (
            <View key={section.id} style={styles.section}>
              <SectionHeader
                title={section.title}
                seeAllText="View All"
                onPressSeeAll={() => {
                  const rawList = section.movies.map(m => m.representativeItem);
                  onViewAllPress?.(section.title, rawList, section.id);
                }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}>
                {section.movies.map((movie, index) => {
                  if (section.layout === 'numbered') {
  return (
    <View key={movie.movieId} style={styles.numberedCardContainer}>
      <MovieCard
        item={movie.representativeItem}
        onPress={() => onSelectItem(movie.representativeItem)}
        width={130}
        isWatchlisted={watchlist.some(
          w => w.url === movie.representativeItem.url,
        )}
        onWatchlistPress={
          onToggleWatchlist
            ? () => onToggleWatchlist(movie.representativeItem)
            : undefined
        }
      />

      <View style={styles.numberBadge}>
        <Text style={styles.numberBadgeText}>
          {index + 1}
        </Text>
      </View>
    </View>
  );
}

                  if (section.layout === 'landscape') {
                    // Render Continue Watching Landscape Layout
                    const progress = watchProgress.find(p => p.movieId === movie.movieId);
                    const percent = progress ? (progress.position / progress.duration) * 100 : 0;
                    return (
                      <TouchableOpacity
                        key={movie.movieId}
                        style={styles.landscapeCard}
                        onPress={() => onSelectItem(movie.representativeItem)}
                        activeOpacity={0.8}>
                        <Image source={{ uri: movie.imageUrl }} style={styles.landscapeImage} />
                        <View style={styles.landscapeTitleContainer}>
                          <Text numberOfLines={1} style={styles.landscapeTitle}>
                            {movie.title}
                          </Text>
                          {movie.year && <Text style={styles.landscapeYear}>{movie.year}</Text>}
                        </View>
                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                          <View style={[styles.progressBar, { width: `${percent}%` }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  if (section.layout === 'featured') {
                    // Match card layout width with the standard lists
                    return (
                      <MovieCard
                        key={movie.movieId}
                        item={movie.representativeItem}
                        onPress={() => onSelectItem(movie.representativeItem)}
                        width={130}
                        isWatchlisted={watchlist.some(w => w.url === movie.representativeItem.url)}
                        onWatchlistPress={onToggleWatchlist ? () => onToggleWatchlist(movie.representativeItem) : undefined}
                      />
                    );
                  }

                  // Default Poster layouts (e.g. Trending, Genres, etc)
                  return (
                    <MovieCard
                      key={movie.movieId}
                      item={movie.representativeItem}
                      onPress={() => onSelectItem(movie.representativeItem)}
                      width={130}
                      isWatchlisted={watchlist.some(w => w.url === movie.representativeItem.url)}
                      onWatchlistPress={onToggleWatchlist ? () => onToggleWatchlist(movie.representativeItem) : undefined}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ))}

        <View style={styles.sectionHeaderSpacing}>
          <SectionHeader
            title={
              selectedCategory
                ? CATEGORIES.find(c => c.path === selectedCategory)?.label +
                  ' Catalog'
                : 'Browse All'
            }
          />
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) {
      return <View style={styles.footerSpacing} />;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more movies...</Text>
      </View>
    );
  };

  // Animated Transitions for top header blending on scroll
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const currentBannerHeight = featuredMovie && !selectedCategory ? bannerHeight : 0;
  const startTranslateY = Math.max(currentBannerHeight - headerHeight, 0);

  const categoryTranslateY = scrollY.interpolate({
    inputRange: [0, Math.max(startTranslateY, 1)],
    outputRange: [startTranslateY, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Animated.FlatList
        style={styles.container}
        data={items}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        renderItem={({item}) => (
          <View style={styles.gridCardWrapper}>
            <MovieCard
              item={item}
              onPress={() => onSelectItem(item)}
              isWatchlisted={watchlist.some(w => w.url === item.url)}
              onWatchlistPress={onToggleWatchlist ? () => onToggleWatchlist(item) : undefined}
            />
          </View>
        )}
        numColumns={3}
        columnWrapperStyle={styles.gridRowWrapper}
        contentContainerStyle={[
          styles.gridListContent,
          selectedCategory ? {paddingTop: headerHeight + 12} : null,
        ]}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={onLoadMore}
        onEndReachedThreshold={3.0}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      />

      {/* Sticky Categories Filter Bar */}
      <Animated.View
        style={[
          styles.stickyCategoryContainer,
          {
            transform: [{translateY: categoryTranslateY}],
          },
        ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          keyboardShouldPersistTaps="handled">
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.label}
              style={[
                styles.chip,
                selectedCategory === cat.path && styles.chipActive,
              ]}
              onPress={() => onSelectCategory(cat.path)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat.path && styles.chipTextActive,
                ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Floating Header */}
      <View style={styles.floatingHeader}>
        <Animated.View style={[styles.headerBg, {opacity: headerBgOpacity}]} />
        <Animated.View
          style={[styles.headerBorder, {opacity: headerBorderOpacity}]}
        />
        <View style={styles.headerContent}>
          <Text style={styles.logoText}>
            Cine<Text style={styles.logoTextPurple}>App</Text>
          </Text>
          <View style={styles.floatingHeaderRight}>
            <TouchableOpacity
              onPress={onSearchPress}
              style={styles.iconButton}
              activeOpacity={0.7}>
              <Icon name="search-outline" size={22} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onProfilePress}
              style={styles.avatarButton}
              activeOpacity={0.7}>
              <View style={styles.avatarCircle}>
                {profile?.avatarId ? (
                  <Text style={styles.avatarEmoji}>
                    {BUILTIN_AVATARS.find(a => a.id === profile.avatarId)?.emoji || '🍿'}
                  </Text>
                ) : (
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.background,
  },
  bannerWrapper: {
    position: 'relative',
    width: '100%',
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
    paddingHorizontal: spacing.md,
  },
  logoText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logoTextPurple: {
    color: colors.primary,
  },
  floatingHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.tokens.button,

    color: colors.white,
    
  },
  avatarEmoji: {
    fontSize: 18,
  },
  content: {
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    paddingTop: spacing.xs,
    gap: 20,
  },
  categoryContainer: {
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  stickyCategoryContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 56,
    height: 60,
    backgroundColor: colors.background,
    zIndex: 9,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.tokens.navigation,
    color: '#A1A1AA',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  section: {
    gap: 12,
  },
  horizontalScroll: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  sectionHeaderSpacing: {
    paddingHorizontal: 0,
    marginTop: 0,
    marginBottom: -8,
  },
  gridListContent: {
    backgroundColor: colors.background,
    paddingBottom: 40,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    maxWidth: '33.33%',
  },
  gridRowWrapper: {
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
    paddingHorizontal: 8,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    ...typography.tokens.caption,
    fontSize: 11,

    color: colors.textSecondary,
    
    fontWeight: '700',
  },
  footerSpacing: {
    height: 40,
  },
  skeletonBanner: {
    height: 280,
    backgroundColor: '#1E1E24',
    width: '100%',
  },
  skeletonTitle: {
    height: 18,
    width: 120,
    backgroundColor: '#1E1E24',
    borderRadius: 4,
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
  },
  skeletonCardHorizontal: {
    width: 130,
    height: 190,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: 16,
    marginTop: spacing.md,
  },
  skeletonCardGrid: {
     width: '100%',
    height: 190,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
  },
  statusBanner: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    marginHorizontal: spacing.md,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.tokens.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
numberedCardContainer: {
  position: 'relative',
  width: 130,
  marginRight: spacing.sm,
},
numberBadge: {
  position: 'absolute',
  top: 7,
  left: 7,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: 'rgba(0, 0, 0, 0.78)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.25)',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
},

numberBadgeText: {
  color: colors.white,
  fontSize: 12,
  fontWeight: '800',
  lineHeight: 14,
},
  landscapeCard: {
    width: 180,
    backgroundColor: '#17171C',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  landscapeImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  landscapeTitleContainer: {
    padding: spacing.xs,
  },
  landscapeTitle: {
    ...typography.tokens.button,
    color: colors.white,
    fontSize: 12,
  },
  landscapeYear: {
    ...typography.tokens.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
