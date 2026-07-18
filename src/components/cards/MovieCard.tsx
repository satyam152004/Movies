import React from 'react';
import {
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import {CatalogItem} from '../../data/models';
import {colors, radius, spacing, typography} from '../../theme';

interface MovieCardProps {
  item: CatalogItem;
  onPress: () => void;
  width?: number;
}

export const MovieCard: React.FC<MovieCardProps> = ({item, onPress, width}) => {
  const getCleanTitle = (title: string) => {
    let displayTitle = title;
    const cleanRegex =
      /\s(1080p|720p|480p|hevc|webrip|bluray|x264|x265|10bit|dual|audio|hindi|english|full|movie).*/i;
    const match = displayTitle.match(cleanRegex);
    if (match && match.index && match.index > 5) {
      displayTitle = displayTitle.substring(0, match.index).trim();
    }
    return displayTitle;
  };

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
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {getCleanTitle(item.title)}
        </Text>
        <Text style={styles.cardSubtitle}>
          {item.year ? `${item.year} • ` : ''}
          {item.resolution ? `${item.resolution}` : 'HD'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
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
  cardInfo: {
    padding: spacing.sm,
    gap: 4,
  },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    lineHeight: 16,
    height: 32,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xxs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
});
