import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../../theme';
import {AppCard} from './AppCard';

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  progress?: number; // 0 to 1
  progressColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subLabel,
  progress,
  progressColor = colors.secondary,
}) => {
  return (
    <AppCard style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}

      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, progress * 100)}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
        </View>
      )}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xxs,
    fontWeight: typography.weights.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    marginTop: 2,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xxs,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
