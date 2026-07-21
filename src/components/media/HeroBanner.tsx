import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, radius, spacing, typography} from '../../theme';

interface HeroBannerProps {
  title: string;
  imageUrl?: string;
  rating?: string;
  year?: string;
  resolution?: string;
  isDualAudio?: boolean;
  onPlayPress?: () => void;
  onInfoPress?: () => void;
  isWatchlisted?: boolean;
  onWatchlistPress?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title,
  imageUrl,
  rating,
  year,
  resolution,
  isDualAudio,
  onPlayPress,
  onInfoPress,
  isWatchlisted = false,
  onWatchlistPress,
}) => {
  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image
          source={{uri: imageUrl}}
          style={styles.image as ImageStyle}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.fallback]} />
      )}
      <LinearGradient
        colors={[
          'rgba(9, 9, 11, 0.4)',
          'rgba(9, 9, 11, 0.1)',
          'rgba(9, 9, 11, 0.65)',
          colors.background,
        ]}
        locations={[0, 0.3, 0.75, 1]}
        style={styles.gradientOverlay}
      />

      <View style={styles.details}>
        {/* Featured Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🔥 FEATURED</Text>
        </View>

        {/* Movie Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Metadata Row */}
        <View style={styles.metadataRow}>
          {/* IMDb Rating Badge */}
          <View style={styles.imdbBadge}>
            <Text style={styles.imdbTextBold}>IMDb</Text>
            <Text style={styles.imdbTextNormal}> {rating ? `${rating}/10` : 'x/10'}</Text>
          </View>

          {/* Year */}
          {year && <Text style={styles.metaText}>{year}</Text>}

          {/* Resolution Badge */}
          {resolution && (
            <View style={styles.resolutionBadge}>
              <Text style={styles.resolutionText}>
                {resolution.toLowerCase() === '2160p' || resolution.toLowerCase() === '4k'
                  ? '4K'
                  : resolution.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Dual Audio Text */}
          {isDualAudio && <Text style={styles.metaText}>Dual Audio</Text>}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {onPlayPress && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={onPlayPress}
              activeOpacity={0.85}>
              <Icon name="play" size={18} color={colors.black} style={styles.buttonIcon} />
              <Text style={styles.playBtnText}>Play Now</Text>
            </TouchableOpacity>
          )}
          {onInfoPress && (
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={onInfoPress}
              activeOpacity={0.85}>
              <Icon name="information-circle-outline" size={20} color={colors.white} style={styles.buttonIcon} />
              <Text style={styles.infoBtnText}>More Info</Text>
            </TouchableOpacity>
          )}
          {onWatchlistPress && (
            <TouchableOpacity
              style={styles.watchlistBtn}
              onPress={onWatchlistPress}
              activeOpacity={0.85}>
              <Icon
                name={isWatchlisted ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={colors.white}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 550,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F0F13',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.elevated,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  details: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    gap: 12,
  },
  badge: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: typography.weights.heavy,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
    lineHeight: 34,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 4,
  },
  imdbBadge: {
    flexDirection: 'row',
    backgroundColor: '#E1B12C',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  imdbTextBold: {
    color: colors.black,
    fontWeight: typography.weights.heavy,
    fontSize: 10,
  },
  imdbTextNormal: {
    color: colors.black,
    fontWeight: typography.weights.bold,
    fontSize: 10,
  },
  metaText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  resolutionBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 4,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
  },
  resolutionText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  playBtn: {
    flex: 1,
    backgroundColor: colors.white,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnText: {
    color: colors.black,
    fontWeight: typography.weights.bold,
    fontSize: 14,
  },
  infoBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBtnText: {
    color: colors.white,
    fontWeight: typography.weights.bold,
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 6,
  },
  watchlistBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
