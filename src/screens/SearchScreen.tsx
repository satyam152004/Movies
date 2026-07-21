import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Text,
  TextInput,
  Image,
  Animated,
  Platform,
  StatusBar,
  ImageStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatalogItem } from '../data/models';
import { colors as themeColors, radius as themeRadius, spacing as themeSpacing, typography } from '../theme';
import { MovieCard } from '../components/cards/MovieCard';
import { ScraperService } from '../services/scraper.service';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDisplayTitle } from '../utils/formatDisplayTitle';

interface SearchScreenProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onExplorePress?: () => void;
  onViewAllPress?: (title: string, items: CatalogItem[], type: string) => void;
}

type FilterType = 'all' | '4k' | '1080p' | 'dual' | 'hevc';

// Premium OTT Design Tokens (Layered Depth Backgrounds)
const colors = {
  background: '#050506', // Base screen bg
  headerBg: '#050506', // Opaque sticky header bg
  card: '#121218', // Card elevated bg
  primary: '#8B5CF6', // Purple Accent
  text: '#FFFFFF',
  secondaryText: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.06)',
};

const BROWSE_CATEGORIES = [
  { label: 'Action', keyword: 'Action', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80' },
  { label: 'Sci-Fi', keyword: 'Sci-Fi', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80' },
  { label: 'Comedy', keyword: 'Comedy', image: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=400&q=80' },
  { label: 'Anime', keyword: 'Animated', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80' },
  { label: 'Horror', keyword: 'Horror', image: 'https://images.unsplash.com/photo-1505635339358-30582854bdac?w=400&q=80' },
  { label: 'Romance', keyword: 'Romance', image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&q=80' },
  { label: 'Thriller', keyword: 'Thriller', image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&q=80' },
];

// Custom spring-scale interactive component for premium press effects
const ScalePressable: React.FC<{
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}> = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      speed: 50,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 50,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Dedicated 130x195 Horizontal Movie Poster Card (prevents layout stretching)
const HorizontalPosterCard: React.FC<{
  item: CatalogItem;
  onPress: () => void;
}> = ({ item, onPress }) => {
  return (
    <ScalePressable onPress={onPress} style={styles.horizontalCardContainer}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.horizontalCardPoster} />
      ) : (
        <View style={[styles.horizontalCardPoster, styles.posterFallback]} />
      )}
      <View style={styles.horizontalCardMeta}>
        <Text style={styles.horizontalCardTitle} numberOfLines={1}>
          {formatDisplayTitle(item.title)}
        </Text>
        <View style={styles.horizontalCardMetaRow}>
          <Text style={styles.horizontalCardSubText}>{item.year || '2026'}</Text>
          {item.rating && (
            <Text style={styles.horizontalCardRatingText}>★ {item.rating}</Text>
          )}
        </View>
      </View>
    </ScalePressable>
  );
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

export const SearchScreen: React.FC<SearchScreenProps> = ({
  items,
  onSelectItem,
  onExplorePress,
  onViewAllPress,
}) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [isSearchingMore, setIsSearchingMore] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const searchScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  // Load recent searches on mount
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const stored = await AsyncStorage.getItem('@search_recents');
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load recent searches', e);
      }
    };
    loadRecents();
  }, []);

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
      saveRecentSearch(search);
    }, 600); // 600ms debounce

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

  const saveRecentSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    try {
      const filtered = recentSearches.filter(s => s.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 10);
      setRecentSearches(updated);
      await AsyncStorage.setItem('@search_recents', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save search term', e);
    }
  };

  const deleteRecentSearch = async (term: string) => {
    try {
      const updated = recentSearches.filter(s => s !== term);
      setRecentSearches(updated);
      await AsyncStorage.setItem('@search_recents', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete search term', e);
    }
  };

  const clearAllRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem('@search_recents');
    } catch (e) {
      console.error('Failed to clear recent searches', e);
    }
  };

  const displayItems = search ? searchResults : items;

  const filteredItems = displayItems;

  const topMatchItem = useMemo(() => {
    if (!search.trim() || filteredItems.length === 0) return null;
    return filteredItems[0];
  }, [search, filteredItems]);

  const gridResults = useMemo(() => {
    if (!search.trim() || filteredItems.length === 0) return filteredItems;
    return filteredItems.slice(1);
  }, [search, filteredItems]);

  const trendingItems = useMemo(() => {
    return items.slice(0, 6);
  }, [items]);

  const continueWatchingItems = useMemo(() => items.slice(6, 12), [items]);
  const popularItems = useMemo(() => items.slice(12, 18), [items]);

  const renderGridCard = ({ item }: { item: CatalogItem }) => (
    <View style={styles.gridCardWrapper}>
      <MovieCard item={item} onPress={() => onSelectItem(item)} />
    </View>
  );

  const highlightText = (text: string, query: string) => {
    if (!query) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text style={styles.suggestionTitleText}>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={i} style={styles.highlightText}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const renderSuggestions = () => {
    const suggestions = searchResults.slice(0, 6);
    return (
      <View style={styles.suggestionsContainer}>
        <View style={styles.titleWithSubtitle}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
        </View>
        {suggestions.map((item, index) => (
          <TouchableOpacity
            key={`${item.url}-${index}`}
            style={styles.suggestionItem}
            activeOpacity={0.85}
            onPress={() => onSelectItem(item)}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.suggestionPoster} />
            ) : (
              <View style={[styles.suggestionPoster, styles.posterFallback]} />
            )}
            <View style={styles.suggestionDetails}>
              {highlightText(formatDisplayTitle(item.title), search)}
              <Text style={styles.suggestionMeta}>
                {item.year ? `${item.year}` : 'Movie'}
                {item.resolution ? ` • ${item.resolution}` : ''}
              </Text>
            </View>
            <Icon name="arrow-forward-outline" size={18} color={colors.secondaryText} style={styles.suggestionArrow} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFooter = () => {
    if (!isSearchingMore) {
      return <View style={{ height: 40 }} />;
    }
    return (
      <View style={styles.footerLoader}>
        <Icon name="ellipsis-horizontal" size={24} color={colors.primary} />
        <Text style={styles.loadingText}>Loading more search results...</Text>
      </View>
    );
  };

  const renderIdleState = () => (
    <View style={styles.idleStateContainer}>
      {/* Recent Searches (Netflix Style list) */}
      {recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithSubtitle}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
            </View>
            <TouchableOpacity onPress={clearAllRecentSearches}>
              <Text style={styles.clearAllBtn}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentList}>
            {recentSearches.map((term, index) => (
              <View key={`${term}-${index}`} style={styles.recentItem}>
                <TouchableOpacity
                  style={styles.recentItemLeft}
                  activeOpacity={0.8}
                  onPress={() => setSearch(term)}>
                  <Icon name="time-outline" size={18} color={colors.secondaryText} style={styles.clockIcon} />
                  <Text style={styles.recentText} numberOfLines={1}>{term}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.recentDeleteBtn}
                  onPress={() => deleteRecentSearch(term)}>
                  <Icon name="close" size={18} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Trending Searches Rank Cards */}
      {trendingItems.length > 0 && (
        <View style={styles.trendingSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithSubtitle}>
              <Text style={styles.sectionTitle}>Trending Today</Text>
              <Text style={styles.sectionSubtitle}>Most searched this week</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScroll}>
            {trendingItems.map((item, index) => (
              <ScalePressable
                key={item.url}
                onPress={() => onSelectItem(item)}
                style={styles.trendingCard}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.trendingPoster} />
                ) : (
                  <View style={[styles.trendingPoster, styles.posterFallback]} />
                )}
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.trendingMeta}>
                  <Text style={styles.trendingTitle} numberOfLines={1}>
                    {formatDisplayTitle(item.title)}
                  </Text>
                  <View style={styles.trendingMetaRow}>
                    <Text style={styles.trendingSubtitleText}>
                      {item.year || '2026'}
                    </Text>
                    {item.rating && (
                      <Text style={styles.trendingRating}>
                        ★ {item.rating}
                      </Text>
                    )}
                  </View>
                </View>
              </ScalePressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Browse Categories */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithSubtitle}>
            <Text style={styles.sectionTitle}>Browse</Text>
            <Text style={styles.sectionSubtitle}>Discover movies by genre</Text>
          </View>
          {onViewAllPress && (
            <TouchableOpacity onPress={() => onViewAllPress('All Movie Catalog', items, 'latest')}>
              <Text style={styles.clearAllBtn}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}>
          {BROWSE_CATEGORIES.map(cat => (
            <ScalePressable
              key={cat.label}
              onPress={() => setSearch(cat.keyword)}
              style={styles.categoryCard}>
              <Image
                source={{ uri: cat.image }}
                style={styles.categoryImage as ImageStyle}
                resizeMode="cover"
              />
              <View style={styles.categoryOverlay} />
              <Text style={styles.categoryText}>{cat.label}</Text>
            </ScalePressable>
          ))}
        </ScrollView>
      </View>

      {/* Continue Watching Section */}
      {continueWatchingItems.length > 0 && (
        <View style={styles.trendingSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithSubtitle}>
              <Text style={styles.sectionTitle}>Continue Watching</Text>
              <Text style={styles.sectionSubtitle}>Pick up where you left off</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScroll}>
            {continueWatchingItems.map(item => (
              <HorizontalPosterCard
                key={item.url}
                item={item}
                onPress={() => onSelectItem(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Popular This Week Section */}
      {popularItems.length > 0 && (
        <View style={styles.trendingSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithSubtitle}>
              <Text style={styles.sectionTitle}>Popular This Week</Text>
              <Text style={styles.sectionSubtitle}>Top rated movies globally</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScroll}>
            {popularItems.map(item => (
              <HorizontalPosterCard
                key={item.url}
                item={item}
                onPress={() => onSelectItem(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderTopMatch = () => {
    if (!topMatchItem) return null;
    const title = formatDisplayTitle(topMatchItem.title);
    return (
      <View style={styles.topMatchSection}>
        <View style={styles.topMatchBadge}>
          <Text style={styles.topMatchBadgeText}>TOP MATCH</Text>
        </View>
        <TouchableOpacity
          style={styles.topMatchCard}
          activeOpacity={0.9}
          onPress={() => onSelectItem(topMatchItem)}>
          {topMatchItem.imageUrl ? (
            <Image source={{ uri: topMatchItem.imageUrl }} style={styles.topMatchPoster} />
          ) : (
            <View style={[styles.topMatchPoster, styles.posterFallback]} />
          )}
          <View style={styles.topMatchDetails}>
            <Text style={styles.topMatchTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.topMatchBadgesRow}>
              {topMatchItem.rating && (
                <View style={styles.yellowBadge}>
                  <Text style={styles.yellowBadgeText}>★ {topMatchItem.rating.includes('/10') ? topMatchItem.rating : `${topMatchItem.rating}/10`}</Text>
                </View>
              )}
              {topMatchItem.resolution && (
                <View style={styles.borderBadge}>
                  <Text style={styles.borderBadgeText}>
                    {topMatchItem.resolution.toUpperCase() === '2160P' ? '4K' : topMatchItem.resolution.toUpperCase()}
                  </Text>
                </View>
              )}
              {topMatchItem.isDualAudio && (
                <View style={styles.borderBadge}>
                  <Text style={styles.borderBadgeText}>DUAL</Text>
                </View>
              )}
            </View>
            <Text style={styles.topMatchDescription} numberOfLines={3}>
              Click to view complete details, synopsis, high-quality download links, and cast reviews for {title}.
            </Text>
            <View style={styles.topMatchActions}>
              <TouchableOpacity style={styles.topMatchPlayBtn} activeOpacity={0.8} onPress={() => onSelectItem(topMatchItem)}>
                <Icon name="play" size={16} color={colors.text} style={styles.playIcon} />
                <Text style={styles.playText}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.topMatchMoreBtn} activeOpacity={0.8} onPress={() => onSelectItem(topMatchItem)}>
                <Text style={styles.moreText}>More Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResults = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map(idx => (
            <View key={idx} style={styles.gridCardWrapper}>
              <Shimmer style={styles.skeletonCardGrid} />
            </View>
          ))}
        </View>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Icon name="search-outline" size={54} color={colors.secondaryText} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try searching for other movies, series, actors, or genres.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => setSearch('')}>
            <Text style={styles.exploreBtnText}>Explore Trending</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeaderRow}>
          <Text style={styles.resultsCount}>
            {filteredItems.length} {filteredItems.length === 1 ? 'Result' : 'Results'}
          </Text>
          <Text style={styles.sortByText}>Sorted by Relevance</Text>
        </View>
        {renderTopMatch()}
        {gridResults.length > 0 && (
          <FlatList
            data={gridResults}
            keyExtractor={(item, index) => `${item.url}-${index}`}
            renderItem={renderGridCard}
            numColumns={2}
            columnWrapperStyle={styles.gridRowWrapper}
            contentContainerStyle={styles.gridListContent}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreSearch}
            onEndReachedThreshold={3.0}
            ListFooterComponent={renderFooter}
            scrollEnabled={false} // Nested inside parent ScrollView
          />
        )}
      </View>
    );
  };

  const isTypingState = search.length > 0 && isLoading;
  const safeAreaTop = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24);

  const HEADER_HEIGHT = safeAreaTop + 54 + 58 + 32;

  return (
    <View style={styles.container}>
      {/* 
        PREMIUM STICKY HEADER CONTAINER (Fixed top vertical block)
        Keeps Header and Search Bar strictly sticky and fixed.
        Opaque background (#050506) completely covers background content.
      */}
      <View style={[styles.stickyHeaderBlock, { height: HEADER_HEIGHT, paddingTop: safeAreaTop }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>C</Text>
          </View>
        </View>

        {/* Search Bar Container */}
        <View style={styles.searchBarWrapper}>
          <Animated.View style={[styles.searchBar, { transform: [{ scale: searchScale }] }, isFocused && styles.searchBarFocused]}>
            <Icon name="search-outline" size={22} color={colors.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search movies, series, actors..."
              placeholderTextColor={colors.secondaryText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                <Icon name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <Icon name="mic-outline" size={20} color={colors.secondaryText} style={styles.micIcon} />
            )}
          </Animated.View>
        </View>
      </View>

      {/* Main Scroll Content (Starts exactly below the sticky header blocks) */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: HEADER_HEIGHT,
            paddingBottom: 100,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Search Screen States Switch */}
        {search.length === 0
          ? renderIdleState()
          : isTypingState
          ? renderSuggestions()
          : renderResults()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    paddingBottom: 100, // Bottom navigation padding
  },
  stickyHeaderBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#050506',
    zIndex: 999,
    elevation: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    height: 54,
    paddingHorizontal: 20,
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 30, // Premium 30px Extra Bold title
    fontWeight: '900',
  },
  avatarCircle: {
    width: 42, // Vertically centered 42px avatar
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  searchBarWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  searchBar: {
    height: 58, // Fixed 58px search height
    borderRadius: 30, // 30px border radius
    backgroundColor: 'rgba(20, 20, 26, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBarFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  micIcon: {
    marginLeft: 10,
  },
  clearBtn: {
    padding: 4,
  },
  idleStateContainer: {
    paddingTop: 24,
  },
  recentSection: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 12, // Gap between title and cards
  },
  titleWithSubtitle: {
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22, // 22px Bold section titles
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    color: colors.secondaryText,
    fontSize: 13, // 13px Gray subtitle
    fontWeight: '600',
  },
  clearAllBtn: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  recentList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'space-between',
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clockIcon: {
    marginRight: 10,
  },
  recentText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recentDeleteBtn: {
    padding: 6,
  },
  trendingSection: {
    marginBottom: 32,
  },
  trendingScroll: {
    paddingHorizontal: 20,
  },
  trendingCard: {
    width: 150, // 150px poster width
    backgroundColor: colors.card,
    borderRadius: 20, // 20px poster radius
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    marginRight: 16,
  },
  trendingPoster: {
    width: 150,
    height: 220, // 220px poster height
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: themeColors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  rankText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  trendingMeta: {
    padding: 10,
    gap: 4,
  },
  trendingTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  trendingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendingSubtitleText: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '600',
  },
  trendingRating: {
    color: '#FFC107',
    fontSize: 10,
    fontWeight: '800',
  },
  categoriesSection: {
    marginBottom: 32,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
  },
  categoryCard: {
    width: 150,
    height: 90,
    borderRadius: 20, // 20px rounded corners
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 16,
  },
  categoryImage: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  categoryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    zIndex: 2,
  },
  horizontalCardContainer: {
    width: 130, // Fixed 130px width for horizontal cards
    backgroundColor: colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 16,
  },
  horizontalCardPoster: {
    width: 130,
    height: 195, // Fixed 195px height for horizontal cards (130x195)
  },
  horizontalCardMeta: {
    padding: 8,
    gap: 2,
  },
  horizontalCardTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalCardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horizontalCardSubText: {
    color: colors.secondaryText,
    fontSize: 10,
    fontWeight: '600',
  },
  horizontalCardRatingText: {
    color: '#FFC107',
    fontSize: 10,
    fontWeight: '800',
  },
  suggestionsContainer: {
    paddingHorizontal: 20,
    gap: 14,
    paddingTop: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionPoster: {
    width: 40,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  suggestionDetails: {
    flex: 1,
    gap: 4,
  },
  suggestionTitleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  highlightText: {
    color: colors.primary,
    fontWeight: '900',
  },
  suggestionMeta: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionArrow: {
    marginRight: 4,
  },
  resultsContainer: {
    gap: 12,
    paddingTop: 16,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  resultsCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  sortByText: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  topMatchSection: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  topMatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  topMatchBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topMatchCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topMatchPoster: {
    width: 130, // 130px Top Match Poster
    height: 190, // 190px Top Match Poster
    borderRadius: 12,
    marginRight: 16,
  },
  topMatchDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topMatchTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  topMatchBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  yellowBadge: {
    backgroundColor: '#FFC107',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  yellowBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  borderBadge: {
    borderWidth: 1,
    borderColor: colors.secondaryText,
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  borderBadgeText: {
    color: colors.secondaryText,
    fontSize: 9,
    fontWeight: '800',
  },
  topMatchDescription: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 6,
  },
  topMatchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  topMatchPlayBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    marginRight: 4,
  },
  playText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  topMatchMoreBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  gridListContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18, // 18px spacing between rows
  },
  gridCardWrapper: {
    flex: 1,
    paddingHorizontal: 9, // 18px horizontal gap (9px on each side)
    alignItems: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 12,
  },
  skeletonCardGrid: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
  },
  footerLoader: {
    paddingVertical: themeSpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
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
  exploreBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  exploreBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default SearchScreen;
