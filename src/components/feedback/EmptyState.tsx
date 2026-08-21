import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, radius, spacing, typography} from '../../theme';
import {AppButton} from '../buttons/AppButton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  onAction?: () => void;
  actionTitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  onAction,
  actionTitle = 'Retry',
}) => {
  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconWrapper}>
          {typeof icon === 'string' ? (
            <Text style={{fontSize: 54}}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      )}
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
  iconWrapper: {
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    ...typography.tokens.bodyMedium,

    color: colors.textPrimary,
    
    fontWeight: typography.weights.heavy,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    ...typography.tokens.caption,

    color: colors.textSecondary,
    
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  btn: {
    minWidth: 150,
    borderRadius: radius.round,
  },
});
