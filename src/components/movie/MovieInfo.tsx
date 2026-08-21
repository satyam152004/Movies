import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {movieTheme} from './theme';
import {movieStyles} from './styles';
import {MovieDetail} from '../../data/models';
import {MovieMetadata} from './MovieMetadata';
import {formatDisplayTitle} from '../../utils/formatDisplayTitle';
import {
  sanitizeStoryline,
  isValidStoryline,
} from '../../services/detail.parser';
import {typography} from '../../theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MovieInfoProps {
  movie: MovieDetail;
  onPosterPress: () => void;
}

export const MovieInfo: React.FC<MovieInfoProps> = ({movie, onPosterPress}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const displayTitle = formatDisplayTitle(movie.title);
  const cleanStory = movie.storyline ? sanitizeStoryline(movie.storyline) : '';
  const displayStory = isValidStoryline(cleanStory, movie.title)
    ? cleanStory
    : '';

  return (
    <View style={styles.container}>
      {/* Poster & Title Row */}
      <View style={styles.heroContentRow}>
        {/* Floating Netflix-style Poster */}
        <TouchableOpacity
          style={styles.posterWrapper}
          onPress={onPosterPress}
          activeOpacity={0.9}>
          {movie.imageUrl ? (
            <Image
              source={{uri: movie.imageUrl}}
              style={styles.posterImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterPlaceholderText}>🎬</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title and main metadata */}
        <View style={styles.metaContainer}>
          <Text style={styles.title} numberOfLines={3}>
            {displayTitle}
          </Text>

          {movie.language ? (
            <Text style={styles.languages} numberOfLines={1}>
              {movie.language}
            </Text>
          ) : null}

          {movie.director ? (
            <Text style={styles.director} numberOfLines={1}>
              Director: <Text style={styles.boldText}>{movie.director}</Text>
            </Text>
          ) : null}
        </View>
      </View>

      {/* Premium Pill Metadata Grid */}
      <MovieMetadata movie={movie} />

      {/* Expandable Storyline */}
      {displayStory ? (
        <View style={styles.storyContainer}>
          <Text style={movieStyles.sectionTitle}>Storyline</Text>
          <Text
            style={styles.storyText}
            numberOfLines={isExpanded ? undefined : 4}>
            {displayStory}
          </Text>
          <TouchableOpacity
            onPress={toggleExpand}
            style={styles.readMoreBtn}
            activeOpacity={0.7}>
            <Text style={styles.readMoreText}>
              {isExpanded ? 'Read Less ▲' : 'Read More ▼'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: -80,
    zIndex: 2,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  posterWrapper: {
    width: 110,
    height: 165,
    borderRadius: movieTheme.radius.cardControl,
    overflow: 'hidden',
    backgroundColor: movieTheme.colors.card,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...movieTheme.shadows.premium,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A35',
  },
  posterPlaceholderText: {
    fontSize: 28,
  },
  metaContainer: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 6,
  },
  title: {
    ...typography.tokens.h2,

    color: movieTheme.colors.text,
    
    fontWeight: movieTheme.typography.weights.bold,
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  languages: {
    color: movieTheme.colors.secondary,
    fontSize: movieTheme.typography.sizes.meta,
    fontWeight: movieTheme.typography.weights.medium,
    marginBottom: 4,
  },
  director: {
    color: movieTheme.colors.secondary,
    fontSize: movieTheme.typography.sizes.meta,
    fontWeight: movieTheme.typography.weights.regular,
  },
  boldText: {
    color: movieTheme.colors.text,
    fontWeight: movieTheme.typography.weights.semibold,
  },
  storyContainer: {
    marginTop: 24,
  },
  storyText: {
    ...typography.tokens.secondary,

    color: movieTheme.colors.secondary,
    
    lineHeight: 20,
    fontWeight: movieTheme.typography.weights.regular,
  },
  readMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginTop: 4,
  },
  readMoreText: {
    color: movieTheme.colors.primary,
    fontWeight: movieTheme.typography.weights.semibold,
    fontSize: movieTheme.typography.sizes.meta,
  },
});
