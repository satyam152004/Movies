import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View, FlatList, ActivityIndicator, Text, TouchableOpacity} from 'react-native';
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
}) => {
  const featuredMovie = useMemo(
    () => (items.length > 0 ? items[0] : null),
    [items],
  );

  const bannerSubtitle = useMemo(() => {
    if (!featuredMovie) {
      return '';
    }
    const parts: string[] = [];
    if (featuredMovie.year) {
      parts.push(featuredMovie.year);
    }
    if (featuredMovie.resolution) {
      parts.push(featuredMovie.resolution);
    }
    if (featuredMovie.isDualAudio) {
      parts.push('Dual Audio');
    }
    if (featuredMovie.rating) {
      parts.push(`⭐ ${featuredMovie.rating}`);
    }
    return parts.join(' • ') || 'Featured Movie';
  }, [featuredMovie]);

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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {featuredMovie && !selectedCategory && (
        <HeroBanner
          title={formatDisplayTitle(featuredMovie.title)}
          imageUrl={featuredMovie.imageUrl}
          subtitle={bannerSubtitle}
          onPlayPress={() => onSelectItem(featuredMovie)}
          onInfoPress={() => onSelectItem(featuredMovie)}
        />
      )}

      {/* Category Horizontal Filter Bar */}
      <View style={styles.filterBarContainer}>
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
      </View>

      <View style={styles.content}>
        {!selectedCategory && sections.map(section => (
          <View key={section.id} style={styles.section}>
            <SectionHeader title={section.title} />
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

  return (
    <FlatList
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
    />
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
  content: {
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  filterBarContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
export default HomeScreen;
