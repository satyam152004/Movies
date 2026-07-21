import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {colors, spacing, typography} from '../../theme';

interface SectionHeaderProps {
  title: string;
  onPressSeeAll?: () => void;
  seeAllText?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onPressSeeAll,
  seeAllText = 'See All',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onPressSeeAll && (
        <TouchableOpacity onPress={onPressSeeAll} activeOpacity={0.7}>
          <Text style={styles.seeAll}>{seeAllText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
  },
  seeAll: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
