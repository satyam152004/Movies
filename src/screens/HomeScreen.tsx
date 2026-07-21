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
} from 'react-native';
import {CatalogItem} from '../data/models';
import {colors, spacing, typography} from '../theme';
import {HeroBanner} from '../components/media/HeroBanner';
import {SectionHeader} from '../components/layout/SectionHeader';
import {MovieCard} from '../components/cards/MovieCard';
import {EmptyState} from '../components/feedback/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';
import {formatDisplayTitle} from '../utils/formatDisplayTitle';

export interface CategoryFilter {
  label: string;
  path: string | null;
}

const CATEGORIES: CategoryFilter[] = [
  { label: 'All', path: null },
  { label: 'Bollywood', path: 'category/bollywood-movies/' },
  { label: 'Hollywood', path: 'category/hollywood-movies/' },
  { label: 'Hindi Dubbed', path: 'category/hindi-dubbed/' },
  { label: 'South Hindi', path: 'category/south-hindi-movies/' },
  { label: 'Web Series', path: 'category/web-series/' },
  { label: '18+', path: 'category/adult/' },
  { label: 'Action', path: 'category/action-movies/' },
  { label: 'Adventure', path: 'category/adventure/' },
  { label: 'Animation', path: 'category/animated-movies/' },
  { label: 'Comedy', path: 'category/comedy-movies/' },
  { label: 'Horror', path: 'category/horror-movies/' },
  { label: 'Sci-Fi', path: 'category/sci-fi/' },
  { label: 'Thriller', path: 'category/thriller/' },
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
}) => {
  const scrollY = useRef(new Animated.Value(0)).current;

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

  // curating list feeds
  const trendingList = useMemo(() => items.slice(0, 8), [items]);
  const hdList = useMemo(
    () =>
      items
        .filter(
          i =>
            i.title.toLowerCase().includes('1080p') ||
            i.title.toLowerCase().includes('2160p') ||
            i.title.toLowerCase().includes('4k'),
        )
        .slice(0, 8),
    [items],
  );
  const dualAudioList = useMemo(
    () =>
      items
        .filter(
          i =>
            i.title.toLowerCase().includes('dual') ||
            i.title.toLowerCase().includes('hindi'),
        )
        .slice(0, 8),
    [items],
  );

  const sections = useMemo(() => {
    return [
      {id: 'trending', title: 'Trending Today', data: trendingList},
      {id: 'hd', title: 'Premium UHD / FHD', data: hdList},
      {id: 'dual', title: 'Dual Audio Releases', data: dualAudioList},
    ].filter(s => s.data.length > 0);
  }, [trendingList, hdList, dualAudioList]);

  // Render Skeleton Loading UI when fetching page 1
  if (isLoading) {
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
            {[1, 2, 3, 4].map(idx => (
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

  const headerHeight = Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 56;
  const bannerHeight = 550;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {featuredMovie && !selectedCategory && (
        <View style={styles.bannerWrapper}>
          <HeroBanner
            title={formatDisplayTitle(featuredMovie.title)}
            imageUrl={featuredMovie.imageUrl}
            rating={featuredMovie.rating}
            year={featuredMovie.year}
            resolution={featuredMovie.resolution}
            isDualAudio={featuredMovie.isDualAudio}
            onPlayPress={() => onSelectItem(featuredMovie)}
            onInfoPress={() => onSelectItem(featuredMovie)}
            isWatchlisted={isFeaturedWatchlisted}
            onWatchlistPress={onToggleWatchlist ? () => onToggleWatchlist(featuredMovie) : undefined}
          />
        </View>
      )}

      {/* Spacer/Placeholder for category chips so they don't cover content when sticky */}
      <View style={[
        styles.filterBarPlaceholder,
        selectedCategory ? { height: headerHeight + 60 } : null
      ]} />

      <View style={styles.content}>
        {!selectedCategory && sections.map(section => (
          <View key={section.id} style={styles.section}>
            <SectionHeader
              title={section.title}
              seeAllText="View All"
              onPressSeeAll={onExplorePress}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}>
              {section.data.map(item => (
                <MovieCard
                  key={item.url}
                  item={item}
                  onPress={() => onSelectItem(item)}
                  width={130}
                />
              ))}
            </ScrollView>
          </View>
        ))}

        <View style={styles.sectionHeaderSpacing}>
          <SectionHeader
            title={
              selectedCategory
                ? CATEGORIES.find(c => c.path === selectedCategory)?.label + ' Catalog'
                : 'Latest Releases'
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

  // Animated Transitions
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

  const stickyTop = selectedCategory ? headerHeight : bannerHeight;
  const categoryTranslateY = selectedCategory
    ? 0
    : scrollY.interpolate({
        inputRange: [0, bannerHeight - headerHeight],
        outputRange: [0, -(bannerHeight - headerHeight)],
        extrapolateRight: 'clamp',
      });

  const categoryBgOpacity = selectedCategory
    ? 1
    : scrollY.interpolate({
        inputRange: [bannerHeight - headerHeight - 40, bannerHeight - headerHeight],
        outputRange: [0, 1],
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
            <MovieCard item={item} onPress={() => onSelectItem(item)} />
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.gridRowWrapper}
        contentContainerStyle={styles.gridListContent}
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
      />

      {/* Sticky Category Filter Bar */}
      <Animated.View
        style={[
          styles.stickyCategoryContainer,
          {
            top: stickyTop,
            transform: [{translateY: categoryTranslateY}],
          },
        ]}>
        <Animated.View style={[styles.categoryBg, {opacity: categoryBgOpacity}]} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}>
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
        <Animated.View style={[styles.headerBorder, {opacity: headerBorderOpacity}]} />
        <View style={styles.headerContent}>
          <Text style={styles.logoText}>
            Cine<Text style={styles.logoTextPurple}>App</Text>
          </Text>
          <View style={styles.floatingHeaderRight}>
            <TouchableOpacity
              onPress={onSearchPress}
              style={styles.iconButton}
              activeOpacity={0.7}>
              <Icon name="search-outline" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onProfilePress}
              style={styles.avatarButton}
              activeOpacity={0.7}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>C</Text>
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
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  logoText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
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
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButton: {
    width: 44,
    height: 44,
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
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  stickyCategoryContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 60,
    zIndex: 9,
    justifyContent: 'center',
  },
  categoryBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090B',
  },
  filterBarPlaceholder: {
    height: 60,
    width: '100%',
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  section: {
    gap: spacing.sm,
  },
  horizontalScroll: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  sectionHeaderSpacing: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  gridListContent: {
    backgroundColor: colors.background,
    paddingBottom: 40,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 11,
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
    height: 240,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
  },
});
