import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {colors, spacing, typography} from '../../theme';

interface SectionHeaderProps {
  title: string;
  onPressSeeAll?: () => void;
  seeAllText?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onPressSeeAll,
  seeAllText = 'View All',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onPressSeeAll && (
        <TouchableOpacity
          onPress={onPressSeeAll}
          activeOpacity={0.7}
          style={styles.seeAllBtn}>
          <Text style={styles.seeAll}>{seeAllText}</Text>
          <Icon
            name="chevron-forward"
            size={14}
            color={colors.primary}
            style={styles.chevron}
          />
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
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  chevron: {
    marginTop: 1.5,
  },
});
