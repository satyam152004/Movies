import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { CatalogItem } from '../data/models';
import { colors, spacing, radius, typography } from '../theme';
import { SearchInput } from '../components/inputs/SearchInput';
import { MovieCard } from '../components/cards/MovieCard';
import { EmptyState } from '../components/feedback/EmptyState';
import { ScraperService } from '../services/scraper.service';
import Icon from 'react-native-vector-icons/Ionicons';

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
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const fetchSearchPage = async (
    query: string,
    pageNum: number,
    append: boolean,
    signal?: AbortSignal,
  ) => {
    try {
      const results = await ScraperService.getInstance().searchMovies(
        query,
        pageNum,
        signal,
      );
      if (results.length < 15) {
        setHasMoreSearch(false);
      }
      if (append) {
        setSearchResults(prev => [...prev, ...results]);
      } else {
        setSearchResults(results);
      }
    } catch (err: any) {
      // Avoid printing cancellation errors to console
      if (err.name === 'AbortError' || err.message === 'canceled' || err.message?.includes('aborted')) {
        return;
      }
      console.error('Live search error:', err);
    }
  };

  // Debounced live search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setSearchPage(1);
      setHasMoreSearch(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchPage(1);
    setHasMoreSearch(true);

    const controller = new AbortController();

    const delayDebounceFn = setTimeout(async () => {
      await fetchSearchPage(search, 1, false, controller.signal);
      setIsLoading(false);
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [search]);

  const loadMoreSearch = async () => {
    if (isLoading || isSearchingMore || !hasMoreSearch || !search.trim()) {
      return;
    }
    setIsSearchingMore(true);
    const nextPage = searchPage + 1;
    await fetchSearchPage(search, nextPage, true);
    setSearchPage(nextPage);
    setIsSearchingMore(false);
  };

  const displayItems = search ? searchResults : items;

  const filteredItems = useMemo(() => {
    let result = displayItems;

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
  }, [displayItems, filter]);

  const renderGridCard = ({ item }: { item: CatalogItem }) => (
    <View style={styles.gridCardWrapper}>
      <MovieCard item={item} onPress={() => onSelectItem(item)} />
    </View>
  );

  const renderFooter = () => {
    if (!isSearchingMore) {
      return <View style={{ height: 40 }} />;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more search results...</Text>
      </View>
    );
  };

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

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map(idx => (
            <View key={idx} style={styles.gridCardWrapper}>
              <View style={styles.skeletonCardGrid} />
            </View>
          ))}
        </View>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Icon name="search-outline" size={54} color={colors.primary} />}
          title="No Matching Movies"
          description="Try modifying your keyword search or select a different specification filter."
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={renderGridCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRowWrapper}
          contentContainerStyle={styles.gridListContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreSearch}
          onEndReachedThreshold={3.0}
          ListFooterComponent={renderFooter}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: 16,
    marginTop: spacing.md,
  },
  skeletonCardGrid: {
    width: '100%',
    height: 240,
    backgroundColor: '#1E1E24',
    borderRadius: 12,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
});
export default SearchScreen;
