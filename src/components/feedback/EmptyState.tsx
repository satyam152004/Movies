import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../../theme';
import {AppButton} from '../buttons/AppButton';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  onAction?: () => void;
  actionTitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📂',
  title,
  description,
  onAction,
  actionTitle = 'Retry',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {onAction && (
        <AppButton
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.btn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  icon: {
    fontSize: 54,
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.heavy,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  btn: {
    minWidth: 150,
  },
});
