import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, radius, typography} from '../../theme';

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 40,
}) => {
  // Mock circular progress container via borders
  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <View
        style={[
          styles.ring,
          {borderColor: progress >= 100 ? colors.success : colors.primary},
        ]}
      />
      <Text style={styles.text}>{Math.round(progress)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.round,
    borderWidth: 3,
    opacity: 0.85,
  },
  text: {
    fontSize: 9,
    fontWeight: typography.weights.heavy,
    color: colors.textPrimary,
  },
});
