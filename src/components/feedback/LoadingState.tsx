import React from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {colors, typography} from '../../theme';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading media catalog...',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.text}>{message.charAt(0).toUpperCase() + message.slice(1)}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 16,
  },
  text: {
    ...typography.tokens.label,

    color: colors.primary,
    
    fontWeight: typography.weights.heavy,
    letterSpacing: 1.5,
  },
});
