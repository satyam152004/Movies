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
import Icon from 'react-native-vector-icons/Ionicons';
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
            'rgba(9, 9, 11, 0.4)',
            'rgba(9, 9, 11, 0.95)',
          ]}
          locations={[0, 0.45, 1]}
          style={styles.gradientOverlay}
        />

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.year ? `${item.year} • ` : ''}
            {item.resolution
              ? item.resolution.toUpperCase() === '2160P'
                ? '4K'
                : item.resolution.toUpperCase() === '1080P'
                ? '1080P'
                : item.resolution.toUpperCase()
              : 'HD'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F0F13',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  defaultWidth: {
    width: '100%',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 2 / 3,
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
    fontSize: 28,
  },
  badgeRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    zIndex: 5,
  },
  badgeItem: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(9, 9, 11, 0.8)',
  },
  badgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: typography.weights.bold,
  },
  badge4K: {
    backgroundColor: '#06B6D4',
  },
  badge1080: {
    backgroundColor: '#3B82F6',
  },
  badgeDual: {
    backgroundColor: '#10B981',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    zIndex: 2,
  },
  cardInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    gap: 2,
    zIndex: 3,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    lineHeight: 15,
  },
  cardSubtitle: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
});
