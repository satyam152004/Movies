import React, {useEffect, useRef} from 'react';
import {Animated, View, StyleSheet, ViewStyle} from 'react-native';
import {colors, radius, spacing} from '../../theme';

interface SkeletonBaseProps {
  style?: ViewStyle;
}

const ShimmerBase: React.FC<SkeletonBaseProps> = ({style}) => {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.base,
        style,
        {
          opacity: opacityAnim,
        },
      ]}
    />
  );
};

export const SkeletonHero: React.FC = () => {
  return <ShimmerBase style={styles.hero} />;
};

export const SkeletonPoster: React.FC = () => {
  return (
    <View style={styles.posterContainer}>
      <ShimmerBase style={styles.posterImage} />
      <ShimmerBase style={styles.posterTitle} />
      <ShimmerBase style={styles.posterSubtitle} />
    </View>
  );
};

export const SkeletonGrid: React.FC = () => {
  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <SkeletonPoster />
        <SkeletonPoster />
      </View>
      <View style={styles.gridRow}>
        <SkeletonPoster />
        <SkeletonPoster />
      </View>
    </View>
  );
};

export const SkeletonList: React.FC = () => {
  return (
    <View style={styles.list}>
      <ShimmerBase style={styles.listItem} />
      <ShimmerBase style={styles.listItem} />
      <ShimmerBase style={styles.listItem} />
    </View>
  );
};

export const SkeletonDownload: React.FC = () => {
  return (
    <View style={styles.downloadCard}>
      <View style={styles.flexRow}>
        <ShimmerBase style={styles.squareIcon} />
        <View style={styles.flexOne}>
          <ShimmerBase style={styles.shortLine} />
          <ShimmerBase style={styles.midLine} />
        </View>
      </View>
      <ShimmerBase style={styles.barLine} />
    </View>
  );
};

export const SkeletonMovieDetail: React.FC = () => {
  return (
    <View style={styles.detail}>
      <ShimmerBase style={styles.detailHero} />
      <ShimmerBase style={styles.paragraphLine} />
      <ShimmerBase style={styles.paragraphLine} />
      <ShimmerBase style={styles.paragraphLineShort} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.elevated,
    borderRadius: radius.sm,
  },
  hero: {
    height: 380,
    width: '100%',
    borderRadius: 0,
  },
  posterContainer: {
    width: '48%',
    gap: 8,
  },
  posterImage: {
    height: 220,
    width: '100%',
    borderRadius: radius.card,
  },
  posterTitle: {
    height: 14,
    width: '80%',
  },
  posterSubtitle: {
    height: 10,
    width: '40%',
  },
  grid: {
    gap: 16,
    padding: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  list: {
    gap: 12,
    padding: spacing.md,
  },
  listItem: {
    height: 72,
    width: '100%',
    borderRadius: radius.card,
  },
  downloadCard: {
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  flexRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  flexOne: {
    flex: 1,
    gap: 6,
  },
  squareIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  shortLine: {
    height: 12,
    width: '70%',
  },
  midLine: {
    height: 8,
    width: '40%',
  },
  barLine: {
    height: 8,
    width: '100%',
  },
  detail: {
    gap: 16,
    padding: spacing.md,
  },
  detailHero: {
    height: 240,
    width: '100%',
    borderRadius: radius.card,
  },
  paragraphLine: {
    height: 12,
    width: '100%',
  },
  paragraphLineShort: {
    height: 12,
    width: '60%',
  },
});
