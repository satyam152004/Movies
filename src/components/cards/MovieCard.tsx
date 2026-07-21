import React from 'react';
import {
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {CatalogItem} from '../../data/models';
import {colors, radius, spacing, typography} from '../../theme';
import {formatDisplayTitle} from '../../utils/formatDisplayTitle';

interface MovieCardProps {
  item: CatalogItem;
  onPress: () => void;
  width?: number;
}

export const MovieCard: React.FC<MovieCardProps> = ({item, onPress, width}) => {
  const displayTitle = formatDisplayTitle(item.title);

  return (
    <TouchableOpacity
      style={[styles.card, width ? {width} : styles.defaultWidth]}
      onPress={onPress}
      activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        {item.imageUrl ? (
          <Image
            source={{uri: item.imageUrl}}
            style={styles.poster as ImageStyle}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.fallbackIcon}>🎬</Text>
          </View>
        )}

        <View style={styles.badgeRow}>
          {item.rating && (
            <View style={[styles.badgeItem, styles.badgeRating]}>
              <Text style={styles.badgeText}>⭐ {item.rating}</Text>
            </View>
          )}
          {item.resolution === '2160p' && (
            <View style={[styles.badgeItem, styles.badge4K]}>
              <Text style={styles.badgeText}>4K</Text>
            </View>
          )}
          {item.resolution === '1080p' && (
            <View style={[styles.badgeItem, styles.badge1080]}>
              <Text style={styles.badgeText}>FHD</Text>
            </View>
          )}
          {item.isDualAudio && (
            <View style={[styles.badgeItem, styles.badgeDual]}>
              <Text style={styles.badgeText}>DUAL</Text>
            </View>
          )}
        </View>

        <LinearGradient
          colors={[
            'rgba(9, 9, 11, 0)',
            'rgba(9, 9, 11, 0.35)',
            'rgba(9, 9, 11, 0.92)',
          ]}
          locations={[0, 0.45, 1]}
          style={styles.gradientOverlay}
        />

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={styles.cardSubtitle}>
            {item.year ? `${item.year} • ` : ''}
            {item.resolution ? `${item.resolution.toUpperCase()}` : 'HD'}
            {item.rating ? ` • ⭐ ${item.rating}` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  defaultWidth: {
    width: '100%',
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: colors.elevated,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.elevated,
  },
  fallbackIcon: {
    fontSize: 32,
  },
  badgeRow: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    gap: 4,
  },
  badgeItem: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
  },
  badge4K: {
    backgroundColor: colors.danger,
  },
  badge1080: {
    backgroundColor: colors.secondary,
  },
  badgeDual: {
    backgroundColor: colors.success,
  },
  badgeRating: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cardInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    gap: 2,
  },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xxs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
});
