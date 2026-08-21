import React from 'react';
import {View, StyleSheet, Image, Animated, Dimensions} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {MovieDetail} from '../../data/models';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.5;

interface MovieHeroProps {
  movie: MovieDetail;
  scrollY: Animated.Value;
}

export const MovieHero: React.FC<MovieHeroProps> = ({movie, scrollY}) => {
  // Parallax backdrop scale
  const scale = scrollY.interpolate({
    inputRange: [-100, 0, HERO_HEIGHT],
    outputRange: [1.15, 1.08, 1.0],
    extrapolate: 'clamp',
  });

  // Parallax translate
  const translateY = scrollY.interpolate({
    inputRange: [-100, 0, HERO_HEIGHT],
    outputRange: [-20, 0, HERO_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.heroContainer}>
      {/* Parallax Backdrop Image */}
      <Animated.View
        style={[
          styles.backdropWrapper,
          {
            transform: [{translateY}, {scale}],
          },
        ]}>
        {movie.backdropUrl || movie.imageUrl ? (
          <Image
            source={{uri: movie.backdropUrl || movie.imageUrl}}
            style={styles.backdropImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.backdropPlaceholder} />
        )}
      </Animated.View>

      {/* Cinematic Layered Gradients */}
      {/* Top Overlay for header contrast */}
      <LinearGradient
        colors={[
          'rgba(9, 9, 11, 0.5)',
          'rgba(9, 9, 11, 0.1)',
          'rgba(9, 9, 11, 0)',
        ]}
        style={styles.gradientTop}
      />
      {/* Bottom Overlay blending to backdrop background */}
      <LinearGradient
        colors={[
          'rgba(9, 9, 11, 0)',
          'rgba(9, 9, 11, 0.4)',
          'rgba(9, 9, 11, 0.85)',
          '#09090B',
        ]}
        locations={[0, 0.45, 0.85, 1]}
        style={styles.gradientBottom}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#09090B',
  },
  backdropWrapper: {
    ...StyleSheet.absoluteFillObject,
    height: HERO_HEIGHT,
  },
  backdropImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E1E24',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.75,
  },
});
export default MovieHero;
