import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import {colors, radius, spacing, typography} from '../../theme';

interface HeroBannerProps {
  title: string;
  imageUrl?: string;
  subtitle?: string;
  onPlayPress?: () => void;
  onInfoPress?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title,
  imageUrl,
  subtitle = 'Curated Cinema',
  onPlayPress,
  onInfoPress,
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
      <View style={styles.overlay} />

      <View style={styles.details}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🔥 FEATURED</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.actions}>
          {onPlayPress && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={onPlayPress}
              activeOpacity={0.8}>
              <Text style={styles.playBtnText}>▶ Play Now</Text>
            </TouchableOpacity>
          )}
          {onInfoPress && (
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={onInfoPress}
              activeOpacity={0.8}>
              <Text style={styles.infoBtnText}>ℹ️ Detail</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 380,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F0F13',
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.65,
  },
  fallback: {
    backgroundColor: colors.elevated,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
  },
  details: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: 8,
  },
  badge: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    borderRadius: radius.xs,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  playBtn: {
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.button,
  },
  playBtnText: {
    color: colors.black,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.xs,
  },
  infoBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.button,
  },
  infoBtnText: {
    color: colors.white,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.xs,
  },
});
