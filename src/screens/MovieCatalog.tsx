import React, {useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {CatalogItem} from '../model/movie.model';

interface MovieCatalogProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onBack: () => void;
}

export const MovieCatalog: React.FC<MovieCatalogProps> = ({
  items,
  onSelectItem,
  onBack,
}) => {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Compute catalog stats
  const totalCount = items.length;
  const dualAudioCount = items.filter(
    i => i.title.toLowerCase().includes('dual') || i.title.toLowerCase().includes('hindi'),
  ).length;
  const highDefCount = items.filter(
    i => i.title.toLowerCase().includes('1080p') || i.title.toLowerCase().includes('2160p') || i.title.toLowerCase().includes('4k'),
  ).length;

  const renderCard = ({item}: {item: CatalogItem}) => {
    const titleLower = item.title.toLowerCase();
    const isDual = titleLower.includes('dual') || titleLower.includes('hindi');
    const isHEVC = titleLower.includes('hevc') || titleLower.includes('x265') || titleLower.includes('10bit');
    const is4K = titleLower.includes('2160p') || titleLower.includes('4k');
    const is1080p = titleLower.includes('1080p');

    // Extract cleaner title (remove year/quality suffix if possible, or display gracefully)
    let displayTitle = item.title;
    // Clean common release details to keep card titles concise
    const cleanRegex = /\s(1080p|720p|480p|hevc|webrip|bluray|x264|x265|10bit|dual|audio|hindi|english|full|movie).*/i;
    const match = displayTitle.match(cleanRegex);
    if (match && match.index && match.index > 5) {
      displayTitle = displayTitle.substring(0, match.index).trim();
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectItem(item)}
        activeOpacity={0.85}>
        <View style={styles.imageWrapper}>
          {item.imageUrl ? (
            <Image
              source={{uri: item.imageUrl}}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterFallback}>
              <Text style={styles.fallbackIcon}>🎬</Text>
            </View>
          )}

          {/* Floating Top Specifications Badges */}
          <View style={styles.floatingBadgesContainer}>
            {is4K ? (
              <View style={[styles.badgeItem, styles.badge4K]}>
                <Text style={styles.badgeItemText}>4K</Text>
              </View>
            ) : is1080p ? (
              <View style={[styles.badgeItem, styles.badge1080]}>
                <Text style={styles.badgeItemText}>FHD</Text>
              </View>
            ) : null}

            {isHEVC && (
              <View style={[styles.badgeItem, styles.badgeHEVC]}>
                <Text style={styles.badgeItemText}>HEVC</Text>
              </View>
            )}
          </View>

          {/* Bottom Audio Info Badge */}
          {isDual && (
            <View style={styles.audioBadge}>
              <Text style={styles.audioBadgeText}>🎙️ DUAL AUDIO</Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {is4K ? '2160p UHD' : is1080p ? '1080p FHD' : '720p HD'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>◀ DASHBOARD</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scraped Collection</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredItems.length} ITEMS</Text>
        </View>
      </View>

      {/* Catalog Search & Stats */}
      <View style={styles.searchAndStatsContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search titles, qualities, years..."
            placeholderTextColor="#64748B"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{totalCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Dual Audio</Text>
            <Text style={[styles.statValue, {color: '#06B6D4'}]}>{dualAudioCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>High Def</Text>
            <Text style={[styles.statValue, {color: '#10B981'}]}>{highDefCount}</Text>
          </View>
        </View>
      </View>

      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No matching results</Text>
          <Text style={styles.emptyText}>
            Try adjusting your search terms or running another crawler scan.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.url}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#101014',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  countText: {
    color: '#8B5CF6',
    fontSize: 9,
    fontWeight: '800',
  },
  searchAndStatsContainer: {
    backgroundColor: '#101014',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  searchBar: {},
  searchInput: {
    backgroundColor: '#08080A',
    borderWidth: 1,
    borderColor: '#2D2D34',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: '48%',
    backgroundColor: 'rgba(22, 22, 28, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 230,
    backgroundColor: '#08080A',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16161B',
  },
  fallbackIcon: {
    fontSize: 32,
  },
  floatingBadgesContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  badgeItem: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  badgeItemText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '950',
  },
  badge4K: {
    backgroundColor: '#EF4444',
  },
  badge1080: {
    backgroundColor: '#06B6D4',
  },
  badgeHEVC: {
    backgroundColor: '#8B5CF6',
  },
  audioBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(8, 8, 10, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  audioBadgeText: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '800',
  },
  cardInfo: {
    padding: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default MovieCatalog;
