import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {movieTheme} from './theme';
import {MovieDetail} from '../../data/models';

interface MovieMetadataProps {
  movie: MovieDetail;
}

export const MovieMetadata: React.FC<MovieMetadataProps> = ({movie}) => {
  const is4K =
    movie.quality?.toLowerCase().includes('2160p') ||
    movie.quality?.toLowerCase().includes('4k');
  const isHDR = movie.quality?.toLowerCase().includes('hdr');
  const is1080p = movie.quality?.toLowerCase().includes('1080p');
  const isHEVC =
    movie.quality?.toLowerCase().includes('hevc') ||
    movie.quality?.toLowerCase().includes('x265');
  const isDual =
    movie.language?.toLowerCase().includes('dual') ||
    movie.language?.toLowerCase().includes('multi');

  return (
    <View style={styles.container}>
      {/* Prime row of highlights */}
      <View style={styles.badgeRow}>
        {is4K && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>4K UHD</Text>
          </View>
        )}

        {isHDR && (
          <View style={[styles.badge, styles.hdrBadge]}>
            <Text style={styles.hdrText}>HDR</Text>
          </View>
        )}

        {is1080p && !is4K && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>1080p FHD</Text>
          </View>
        )}

        {isHEVC && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>10-bit HEVC</Text>
          </View>
        )}

        {isDual && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Dual Audio</Text>
          </View>
        )}

        {movie.date && (
          <View style={[styles.badge, styles.yearBadge]}>
            <Text style={styles.badgeText}>{movie.date}</Text>
          </View>
        )}

        {movie.runtime ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {movie.runtime > 60
                ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
                : `${movie.runtime} min`}
            </Text>
          </View>
        ) : null}

        {movie.certification ? (
          <View style={[styles.badge, styles.certBadge]}>
            <Text style={styles.certText}>{movie.certification}</Text>
          </View>
        ) : null}

        {movie.country ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{movie.country.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    color: movieTheme.colors.secondary,
    fontSize: movieTheme.typography.sizes.badge,
    fontWeight: movieTheme.typography.weights.semibold,
  },

  hdrBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  hdrText: {
    color: movieTheme.colors.primary,
    fontSize: movieTheme.typography.sizes.badge,
    fontWeight: movieTheme.typography.weights.bold,
  },
  yearBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  certBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  certText: {
    color: '#FFFFFF',
    fontSize: movieTheme.typography.sizes.badge,
    fontWeight: movieTheme.typography.weights.bold,
  },
});
