import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated} from 'react-native';
import {movieTheme} from './theme';

export const MovieSkeleton: React.FC = () => {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [shimmerAnim]);

  const style = {opacity: shimmerAnim};

  return (
    <View style={styles.container}>
      {/* Hero Header Skeleton */}
      <Animated.View style={[styles.heroSkeleton, style]}>
        <View style={styles.headerButtons}>
          <View style={styles.circleBtn} />
          <View style={styles.row}>
            <View style={styles.circleBtn} />
            <View style={styles.circleBtn} />
            <View style={styles.circleBtn} />
          </View>
        </View>
      </Animated.View>

      {/* Content wrapper */}
      <View style={styles.content}>
        {/* Info & Floating Poster Section */}
        <View style={styles.floatingHeader}>
          <Animated.View style={[styles.posterSkeleton, style]} />
          <View style={styles.titleMetaSkeleton}>
            <Animated.View style={[styles.titleLine, style]} />
            <Animated.View style={[styles.metaRow, style]} />
          </View>
        </View>

        {/* Action Buttons Skeleton */}
        <View style={styles.actionsSkeleton}>
          <Animated.View style={[styles.largeButton, style]} />
          <Animated.View
            style={[
              styles.largeButton,
              {backgroundColor: 'rgba(139, 92, 246, 0.2)'},
              style,
            ]}
          />
          <View style={styles.smallButtonsRow}>
            <Animated.View style={[styles.smallButton, style]} />
            <Animated.View style={[styles.smallButton, style]} />
            <Animated.View style={[styles.smallButton, style]} />
          </View>
        </View>

        {/* Story Section */}
        <View style={styles.section}>
          <Animated.View style={[styles.sectionTitle, style]} />
          <Animated.View style={[styles.textLine, {width: '100%'}, style]} />
          <Animated.View style={[styles.textLine, {width: '95%'}, style]} />
          <Animated.View style={[styles.textLine, {width: '60%'}, style]} />
        </View>

        {/* Cast Section */}
        <View style={styles.section}>
          <Animated.View style={[styles.sectionTitle, {width: 80}, style]} />
          <View style={styles.horizontalRow}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.castCard}>
                <Animated.View style={[styles.castAvatar, style]} />
                <Animated.View
                  style={[
                    styles.textLine,
                    {width: 50, height: 10, marginTop: 8},
                    style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.textLine,
                    {width: 40, height: 8, marginTop: 4},
                    style,
                  ]}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Downloads Section */}
        <View style={styles.section}>
          <Animated.View style={[styles.sectionTitle, {width: 180}, style]} />
          <View style={styles.downloadsRow}>
            {[1, 2].map(i => (
              <Animated.View key={i} style={[styles.downloadCard, style]} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: movieTheme.colors.background,
  },
  heroSkeleton: {
    height: 380,
    backgroundColor: '#1E1E24',
    justifyContent: 'flex-start',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
  },
  content: {
    paddingHorizontal: 16,
    marginTop: -80,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  posterSkeleton: {
    width: 120,
    height: 180,
    borderRadius: movieTheme.radius.lg,
    backgroundColor: '#2A2A35',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  titleMetaSkeleton: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 10,
  },
  titleLine: {
    height: 28,
    backgroundColor: '#2A2A35',
    borderRadius: 6,
    width: '90%',
    marginBottom: 10,
  },
  metaRow: {
    height: 18,
    backgroundColor: '#2A2A35',
    borderRadius: 4,
    width: '70%',
  },
  actionsSkeleton: {
    marginVertical: 24,
    gap: 12,
  },
  largeButton: {
    height: 48,
    borderRadius: movieTheme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  smallButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  smallButton: {
    flex: 1,
    height: 40,
    borderRadius: movieTheme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    height: 20,
    backgroundColor: '#2A2A35',
    borderRadius: 4,
    width: 120,
    marginBottom: 14,
  },
  textLine: {
    height: 14,
    backgroundColor: '#2A2A35',
    borderRadius: 4,
    marginVertical: 4,
  },
  horizontalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  castCard: {
    width: 70,
    alignItems: 'center',
  },
  castAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2A2A35',
  },
  downloadsRow: {
    gap: 10,
  },
  downloadCard: {
    height: 60,
    borderRadius: movieTheme.radius.md,
    backgroundColor: '#1E1E24',
  },
});
