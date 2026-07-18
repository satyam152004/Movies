import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View, FlatList, ActivityIndicator, Text} from 'react-native';
import {CatalogItem} from '../data/models';
import {colors, spacing} from '../theme';
import {HeroBanner} from '../components/media/HeroBanner';
import {SectionHeader} from '../components/layout/SectionHeader';
import {MovieCard} from '../components/cards/MovieCard';
import {EmptyState} from '../components/feedback/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';

interface HomeScreenProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onExplorePress?: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isLoading?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  onSelectItem,
  onExplorePress,
  onLoadMore,
  isLoadingMore = false,
  isLoading = false,
}) => {
  const featuredMovie = useMemo(
    () => (items.length > 0 ? items[0] : null),
    [items],
  );

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
  if (isLoading && items.length === 0) {
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
      {featuredMovie && (
        <HeroBanner
          title={featuredMovie.title}
          imageUrl={featuredMovie.imageUrl}
          subtitle="Action • Science Fiction • Premium Release"
          onPlayPress={() => onSelectItem(featuredMovie)}
          onInfoPress={() => onSelectItem(featuredMovie)}
        />
      )}

      <View style={styles.content}>
        {sections.map(section => (
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
          <SectionHeader title="Latest Releases" />
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
    paddingBottom: 20,
    backgroundColor: colors.background,
    marginTop: -30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: spacing.md,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  horizontalScroll: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  sectionHeaderSpacing: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: -10,
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
