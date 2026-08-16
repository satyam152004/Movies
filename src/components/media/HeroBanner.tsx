import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageStyle,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, radius, spacing, typography} from '../../theme';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const HERO_HEIGHT = Math.min(Math.max(SCREEN_HEIGHT * 0.46, 360), 460);

interface HeroBannerProps {
  title: string;
  imageUrl?: string;
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
          {/* Year */}
          {year && <Text style={styles.metaText}>{year}</Text>}

          {/* Resolution Badge */}
          {resolution && (
            <View style={styles.resolutionBadge}>
              <Text style={styles.resolutionText}>
                {resolution.toLowerCase() === '2160p' ||
                resolution.toLowerCase() === '4k'
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
              <Icon
                name="play"
                size={18}
                color={colors.black}
                style={styles.buttonIcon}
              />
              <Text style={styles.playBtnText}>Play Now</Text>
            </TouchableOpacity>
          )}
          {onInfoPress && (
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={onInfoPress}
              activeOpacity={0.85}>
              <Icon
                name="information-circle-outline"
                size={18}
                color={colors.white}
                style={styles.buttonIcon}
              />
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
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: '#09090B',
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
    bottom: 20,
    left: 16,
    right: 16,
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(144, 97, 249, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.25)',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: typography.weights.heavy,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
    lineHeight: 30,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 2,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  resolutionBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  resolutionText: {
    color: colors.textSecondary,
    fontSize: 9,
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
