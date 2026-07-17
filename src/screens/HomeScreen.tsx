import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {CatalogItem} from '../data/models';
import {colors, spacing} from '../theme';
import {HeroBanner} from '../components/media/HeroBanner';
import {SectionHeader} from '../components/layout/SectionHeader';
import {MovieCard} from '../components/cards/MovieCard';
import {EmptyState} from '../components/feedback/EmptyState';

interface HomeScreenProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onExplorePress?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  onSelectItem,
  onExplorePress,
}) => {
  const featuredMovie = items[0];

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

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🎬"
        title="Movie Library Ready"
        description="Go to Profile -> Settings and toggle Developer Mode to start the scraper and sync movie catalogs."
        onAction={onExplorePress}
        actionTitle="Go to Browse"
      />
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
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
});
export default HomeScreen;
