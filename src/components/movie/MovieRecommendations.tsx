import React, {useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {movieTheme} from './theme';
import {MovieCard} from '../cards/MovieCard';
import {CatalogItem, MovieDetail} from '../../data/models';
import {formatDisplayTitle} from '../../utils/formatDisplayTitle';
import {typography} from '../../theme';

interface MovieRecommendationsProps {
  currentMovie: MovieDetail;
  allCatalogItems: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
}

export const MovieRecommendations: React.FC<MovieRecommendationsProps> = ({
  currentMovie,
  allCatalogItems = [],
  onSelectItem,
}) => {
  const similarMovies = useMemo(() => {
    if (!allCatalogItems || allCatalogItems.length === 0) {
      // Mock list if no catalog is loaded
      return [];
    }

    // Filter out current movie, and match based on title keywords, categories, or random curation
    const currentTitle = formatDisplayTitle(currentMovie.title).toLowerCase();
    const filtered = allCatalogItems.filter(item => {
      const itemTitle = formatDisplayTitle(item.title).toLowerCase();
      if (itemTitle === currentTitle || item.url === currentMovie.url) {
        return false;
      }
      return true;
    });

    // Score movies based on categories or keywords matching
    const currentCats = currentMovie.categories.map(c => c.toLowerCase());
    const currentGenres = currentMovie.genres.map(g => g.toLowerCase());

    return filtered
      .map(item => {
        let score = 0;
        const itemTitle = item.title.toLowerCase();

        // Match genres in title
        currentGenres.forEach(genre => {
          if (itemTitle.includes(genre)) {
            score += 3;
          }
        });

        // Match categories in title
        currentCats.forEach(cat => {
          if (itemTitle.includes(cat)) {
            score += 2;
          }
        });

        return {item, score};
      })
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 10);
  }, [currentMovie, allCatalogItems]);

  if (similarMovies.length === 0) {
    return null; // Don't show section if empty
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>More Like This</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast">
        {similarMovies.map((item, idx) => (
          <View key={idx} style={styles.cardWrapper}>
            <MovieCard
              item={item}
              onPress={() => onSelectItem(item)}
              width={120}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    ...typography.tokens.button,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardWrapper: {
    marginRight: 0,
  },
});
