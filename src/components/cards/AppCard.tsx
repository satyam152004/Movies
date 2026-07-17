import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {colors, radius, spacing, shadows} from '../../theme';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'flat' | 'elevated' | 'premium';
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  variant = 'flat',
}) => {
  const getCardStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          ...styles.elevated,
          ...shadows.md,
        };
      case 'premium':
        return {
          ...styles.premium,
          ...shadows.premium,
        };
      case 'flat':
      default:
        return styles.flat;
    }
  };

  return <View style={[styles.base, getCardStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flat: {
    backgroundColor: colors.surface,
  },
  elevated: {
    backgroundColor: colors.elevated,
  },
  premium: {
    backgroundColor: colors.elevated,
    borderColor: colors.primary,
  },
});
