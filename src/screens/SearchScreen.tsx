import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { CatalogItem } from '../data/models';
import { colors, spacing, radius, typography } from '../theme';
import { SearchInput } from '../components/inputs/SearchInput';
import { MovieCard } from '../components/cards/MovieCard';
import { EmptyState } from '../components/feedback/EmptyState';

interface SearchScreenProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
}

type FilterType = 'all' | '4k' | '1080p' | 'dual' | 'hevc';

export const SearchScreen: React.FC<SearchScreenProps> = ({
  items,
  onSelectItem,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredItems = useMemo(() => {
    let result = items;
    if (search) {
      result = result.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (filter === '4k') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return titleLower.includes('2160p') || titleLower.includes('4k');
      });
    } else if (filter === '1080p') {
      result = result.filter(item =>
        item.title.toLowerCase().includes('1080p'),
      );
    } else if (filter === 'dual') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return titleLower.includes('dual') || titleLower.includes('hindi');
      });
    } else if (filter === 'hevc') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return (
          titleLower.includes('hevc') ||
          titleLower.includes('x265') ||
          titleLower.includes('10bit')
        );
      });
    }
    return result;
  }, [items, search, filter]);

  const renderGridCard = ({ item }: { item: CatalogItem }) => (
    <MovieCard item={item} onPress={() => onSelectItem(item)} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search movie catalog..."
          onClear={() => setSearch('')}
        />
      </View>

      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}>
          {(['all', '4k', '1080p', 'dual', 'hevc'] as FilterType[]).map(
            type => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, filter === type && styles.chipActive]}
                onPress={() => setFilter(type)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    filter === type && styles.chipTextActive,
                  ]}>
                  {type === 'all'
                    ? 'All'
                    : type === '4k'
                      ? '4K UHD'
                      : type === '1080p'
                        ? '1080p FHD'
                        : type === 'dual'
                          ? 'Dual Audio'
                          : 'HEVC'}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </ScrollView>
      </View>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No Matching Movies"
          description="Try modifying your keyword search or select a different specification filter."
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.url}
          renderItem={renderGridCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRowWrapper}
          contentContainerStyle={styles.gridListContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  chipsWrapper: {
    height: 48,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  chipsContainer: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  chipTextActive: {
    color: colors.white,
  },
  gridListContent: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
export default SearchScreen;
