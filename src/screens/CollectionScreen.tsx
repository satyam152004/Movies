import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { CatalogItem } from '../data/models';
import { MovieCard } from '../components/cards/MovieCard';
import { colors as themeColors, spacing as themeSpacing, radius as themeRadius } from '../theme';
import { formatDisplayTitle } from '../utils/formatDisplayTitle';

interface CollectionScreenProps {
  title: string;
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onBack: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

type FilterType = 'all' | 'movies' | 'tv' | '4k' | 'dual';
type SortType = 'popular' | 'latest' | 'rating' | 'az';

const colors = {
  background: '#050506',
  headerBg: '#050506',
  card: '#121218',
  primary: '#8B5CF6',
  text: '#FFFFFF',
  secondaryText: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.06)',
};

const Shimmer: React.FC<{ style?: any }> = ({ style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.6],
  });

  return <Animated.View style={[style, { opacity, backgroundColor: '#1E1E24' }]} />;
};

export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  title,
  items,
  onSelectItem,
  onBack,
  onLoadMore,
  isLoadingMore,
}) => {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('popular');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Header elevation interpolation
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    // Search query local filtering
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => item.title.toLowerCase().includes(q));
    }

    // Filter Chips
    if (filter === 'movies') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return (
          !titleLower.includes('s01') &&
          !titleLower.includes('s02') &&
          !titleLower.includes('s03') &&
          !titleLower.includes('season') &&
          !titleLower.includes('series') &&
          !titleLower.includes('complete')
        );
      });
    } else if (filter === 'tv') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return (
          titleLower.includes('s01') ||
          titleLower.includes('s02') ||
          titleLower.includes('s03') ||
          titleLower.includes('season') ||
          titleLower.includes('series') ||
          titleLower.includes('complete')
        );
      });
    } else if (filter === '4k') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return titleLower.includes('2160p') || titleLower.includes('4k');
      });
    } else if (filter === 'dual') {
      result = result.filter(item => {
        const titleLower = item.title.toLowerCase();
        return titleLower.includes('dual') || titleLower.includes('hindi');
      });
    }

    // Sorting
    const sorted = [...result];
    if (sortBy === 'latest') {
      sorted.sort((a, b) => {
        const yA = parseInt(a.year || '0', 10);
        const yB = parseInt(b.year || '0', 10);
        return yB - yA;
      });
    } else if (sortBy === 'rating') {
      sorted.sort((a, b) => {
        const rA = parseFloat(a.rating || '0');
        const rB = parseFloat(b.rating || '0');
        return rB - rA;
      });
    } else if (sortBy === 'az') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }

    return sorted;
  }, [items, search, filter, sortBy]);

  const renderCard = ({ item }: { item: CatalogItem }) => (
    <View style={styles.gridCardWrapper}>
      <MovieCard item={item} onPress={() => onSelectItem(item)} />
    </View>
  );

  const renderHeader = () => {
    const safeAreaTop = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24);
    return (
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            paddingTop: safeAreaTop,
          },
        ]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {!showSearch ? (
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.headerSubtitle}>{filteredItems.length} Results</Text>
            </View>
          ) : (
            <View style={styles.searchBarWrapper}>
              <Icon name="search-outline" size={18} color={colors.secondaryText} style={styles.searchBarIcon} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search in collection..."
                placeholderTextColor={colors.secondaryText}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={16} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              if (showSearch) {
                setSearch('');
              }
              setShowSearch(!showSearch);
            }}
            style={styles.iconBtn}
            activeOpacity={0.8}>
            <Icon name={showSearch ? "close" : "search-outline"} size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Sticky Filters row */}
        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {(['all', 'movies', 'tv', '4k', 'dual'] as FilterType[]).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filter === type && styles.filterChipActive]}
                onPress={() => setFilter(type)}
                activeOpacity={0.85}>
                <Text style={[styles.filterChipText, filter === type && styles.filterChipTextActive]}>
                  {type === 'all'
                    ? 'All'
                    : type === 'movies'
                    ? 'Movies'
                    : type === 'tv'
                    ? 'TV Shows'
                    : type === '4k'
                    ? '4K UHD'
                    : 'Dual Audio'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sorting header row */}
        <View style={styles.sortHeaderRow}>
          <TouchableOpacity
            onPress={() => setShowSortDropdown(!showSortDropdown)}
            style={styles.sortDropdownSelector}
            activeOpacity={0.8}>
            <Text style={styles.sortDropdownLabel}>
              Sort: {sortBy === 'popular' ? 'Popularity' : sortBy === 'latest' ? 'Latest' : sortBy === 'rating' ? 'Rating' : 'A-Z'}
            </Text>
            <Icon name="chevron-down" size={14} color={colors.secondaryText} style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Sort Dropdown Popup */}
        {showSortDropdown && (
          <View style={styles.sortDropdownMenu}>
            {(['popular', 'latest', 'rating', 'az'] as SortType[]).map(sortOption => (
              <TouchableOpacity
                key={sortOption}
                style={[styles.sortOptionItem, sortBy === sortOption && styles.sortOptionItemActive]}
                onPress={() => {
                  setSortBy(sortOption);
                  setShowSortDropdown(false);
                }}
                activeOpacity={0.85}>
                <Text style={[styles.sortOptionText, sortBy === sortOption && styles.sortOptionTextActive]}>
                  {sortOption === 'popular' ? 'Popularity' : sortOption === 'latest' ? 'Latest Releases' : sortOption === 'rating' ? 'Top Ratings' : 'Alphabetical (A-Z)'}
                </Text>
                {sortBy === sortOption && <Icon name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Animated.View
          style={[
            styles.headerBorderLine,
            {
              opacity: headerBorderOpacity,
            },
          ]}
        />
      </Animated.View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) {
      return <View style={styles.footerSpacing} />;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerLoaderText}>Loading more titles...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      {renderHeader()}

      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="film-outline" size={54} color={colors.secondaryText} />
          <Text style={styles.emptyTitle}>No matching results</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your search queries or filter categories.</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={filteredItems}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRowWrapper}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Platform.OS === 'ios' ? 240 : 220 }
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
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
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.headerBg,
    zIndex: 999,
  },
  headerTopRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  searchBarWrapper: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: 10,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  iconBtn: {
    padding: 6,
  },
  filtersWrapper: {
    height: 48,
    marginTop: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.text,
  },
  sortHeaderRow: {
    height: 44,
    borderTopWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sortDropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  sortDropdownLabel: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  chevronIcon: {
    marginLeft: 4,
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 164 : 144,
    left: 16,
    right: 16,
    backgroundColor: '#161622',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  sortOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sortOptionItemActive: {
    backgroundColor: 'rgba(144, 97, 249, 0.08)',
  },
  sortOptionText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  sortOptionTextActive: {
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: 6,
  },
  footerSpacing: {
    height: 40,
  },
  footerLoader: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptySubtitle: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  headerBorderLine: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
