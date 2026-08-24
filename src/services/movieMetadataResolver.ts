import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatalogItem } from '../data/models';
import { MovieGroup, MovieRelease } from '../models/movie.types';
import { TmdbService } from './tmdb.service';
import { createCanonicalMovieId, extractYear, groupCatalogItems } from '../utils/movieGrouping';
import { ScraperService } from './scraper.service';

const RESOLVER_CACHE_PREFIX = 'tmdb_metadata_resolve_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const globalDiscoveryStats = {
  candidatesChecked: 0,
  scraperSearches: 0,
  cacheHits: 0,
  negativeCacheHits: 0,
  matches: 0,
  skipped: 0,
  totalSearchTimeMs: 0,
  averageSearchTimeMs: 0,
  totalPrepTimeMs: 0
};

interface ResolvedMetadata {
  tmdbId?: number;
  imdbId?: string;
  rating?: number;
  popularity?: number;
  genres?: string[];
  collectionId?: number;
  collectionName?: string;
  backdropUrl?: string;
  unmatched?: boolean;
}

export class MovieMetadataResolver {
  /**
   * Safe chunking helper for concurrency limits
   */
  private static async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += limit) {
      const chunk = items.slice(i, i + limit);
      const chunkPromises = chunk.map(fn);
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }
    return results;
  }

  /**
   * Resolves raw CatalogItems into enriched MovieGroups using TMDb details and caching
   */
  public static async resolveGroups(items: CatalogItem[]): Promise<MovieGroup[]> {
    // 1. Group catalog items naturally to preserve release formats
    const initialGroups = groupCatalogItems(items);

    const tmdb = TmdbService.getInstance();
    const apiKey = await tmdb.getApiKey();

    // Diagnostics trackers
    let enrichedCount = 0;
    let unmatchedCount = 0;

    // Batch load cached metadata from AsyncStorage to avoid sequential lookups
    const cacheKeys = initialGroups.map(g => RESOLVER_CACHE_PREFIX + encodeURIComponent(g.movieId));
    const cacheMap = new Map<string, ResolvedMetadata | null>();
    try {
      const cachedPairs = await AsyncStorage.multiGet(cacheKeys);
      for (const [key, value] of cachedPairs) {
        if (value) {
          try {
            const cachedParsed = JSON.parse(value);
            if (cachedParsed && cachedParsed.expiresAt && Date.now() < cachedParsed.expiresAt) {
              cacheMap.set(key, cachedParsed.data);
            }
          } catch (e) {
            console.warn(`[MovieMetadataResolver] Failed to parse cache for key ${key}`, e);
          }
        }
      }
    } catch (e) {
      console.warn('[MovieMetadataResolver] AsyncStorage.multiGet failed', e);
    }

    const enrichedGroups = await this.runWithConcurrency(
      initialGroups,
      5, // limit requests to 5 at a time
      async (group): Promise<MovieGroup> => {
        try {
          const cacheKey = RESOLVER_CACHE_PREFIX + encodeURIComponent(group.movieId);
          let meta: ResolvedMetadata | null = cacheMap.get(cacheKey) || null;

          if (meta && meta.unmatched) {
            unmatchedCount++;
            return group;
          }

          if (!meta && apiKey) {
            // Find Candidate
            const match = await tmdb.findTmdbMovie(
              { title: group.title },
              apiKey
            );

            let isMatched = false;
            if (match && match.confidence >= 70) {
              // Verify Year match if both exist
              const searchDetails = await tmdb.getTmdbDetails(match.id, match.type, apiKey);
              if (searchDetails) {
                const tmdbDate = match.type === 'movie' ? searchDetails.release_date : searchDetails.first_air_date;
                const tmdbYear = tmdbDate ? tmdbDate.substring(0, 4) : undefined;
                const scraperYear = group.year || extractYear(group.representativeItem.title);

                const isYearMatch = !scraperYear || !tmdbYear || scraperYear === tmdbYear;
                if (isYearMatch) {
                  isMatched = true;
                  // Valid candidate, construct meta
                  const backdropUrl = searchDetails.backdrop_path
                    ? `https://image.tmdb.org/t/p/w780${searchDetails.backdrop_path}`
                    : undefined;

                  const genres = searchDetails.genres
                    ? searchDetails.genres.map((g: any) => g.name)
                    : [];

                  let collectionId: number | undefined;
                  let collectionName: string | undefined;

                  if (searchDetails.belongs_to_collection) {
                    collectionId = searchDetails.belongs_to_collection.id;
                    collectionName = searchDetails.belongs_to_collection.name;
                  }

                  meta = {
                    tmdbId: match.id,
                    imdbId: searchDetails.imdb_id || undefined,
                    rating: searchDetails.vote_average || undefined,
                    popularity: searchDetails.popularity || undefined,
                    genres,
                    collectionId,
                    collectionName,
                    backdropUrl,
                  };

                  // Cache the result
                  await AsyncStorage.setItem(
                    cacheKey,
                    JSON.stringify({
                      expiresAt: Date.now() + CACHE_TTL_MS,
                      data: meta,
                    })
                  );
                }
              }
            }

            if (!isMatched) {
              // Store a negative cache (unmatched) entry so we don't hit the API again
              meta = { unmatched: true };
              await AsyncStorage.setItem(
                cacheKey,
                JSON.stringify({
                  expiresAt: Date.now() + CACHE_TTL_MS,
                  data: meta,
                })
              );
            }
          }

          if (meta && !meta.unmatched) {
            enrichedCount++;
            return {
              ...group,
              tmdbId: meta.tmdbId,
              imdbId: meta.imdbId,
              rating: meta.rating ?? group.rating,
              popularity: meta.popularity,
              genres: meta.genres,
              collectionId: meta.collectionId,
              collectionName: meta.collectionName,
              backdropUrl: meta.backdropUrl,
            };
          }
        } catch (err) {
          console.warn(`[MovieMetadataResolver] Failed resolving: "${group.title}"`, err);
        }

        unmatchedCount++;
        return group; // Return original group unmodified if match failed
      }
    );

    // Development Runtime diagnostics (Safe logging)
    console.info(`[Diagnostics] Catalog items: ${items.length}`);
    console.info(`[Diagnostics] MovieGroups: ${initialGroups.length}`);
    console.info(`[Diagnostics] TMDb enriched: ${enrichedCount}`);
    console.info(`[Diagnostics] TMDb unmatched: ${unmatchedCount}`);

    return enrichedGroups;
  }

  /**
   * Resolves a TMDB list to a scraper MovieGroup list by searching the catalog directly.
   */
  public static async resolveDiscoverySection(
    externalList: any[],
    targetCount: number = 10
  ): Promise<MovieGroup[]> {
    const startTime = Date.now();
    const scraper = ScraperService.getInstance();
    const tmdb = TmdbService.getInstance();
    const apiKey = await tmdb.getApiKey();

    const matchedGroups: (MovieGroup | null)[] = new Array(externalList.length).fill(null);
    let matchedCount = 0;

    const concurrencyLimit = 5;
    let nextIndex = 0;

    const processCandidate = async (index: number): Promise<void> => {
      const candidate = externalList[index];
      if (!candidate) return;

      globalDiscoveryStats.candidatesChecked++;

      const cacheKey = `tmdb:${candidate.id}:scraper-match`;
      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cachedParsed = JSON.parse(cachedRaw);
          if (cachedParsed && cachedParsed.expiresAt && Date.now() < cachedParsed.expiresAt) {
            if (cachedParsed.data && cachedParsed.data.unmatched) {
              globalDiscoveryStats.negativeCacheHits++;
              globalDiscoveryStats.skipped++;
              return;
            } else if (cachedParsed.data && cachedParsed.data.group) {
              globalDiscoveryStats.cacheHits++;
              globalDiscoveryStats.matches++;
              matchedGroups[index] = cachedParsed.data.group;
              matchedCount++;
              return;
            }
          }
        }
      } catch (e) {
        console.warn(`[MovieMetadataResolver] Cache read error for candidate ${candidate.id}`, e);
      }

      const title = candidate.title || candidate.name;
      if (!title) {
        globalDiscoveryStats.skipped++;
        return;
      }

      let scraperItems: CatalogItem[] = [];
      let page = 1;
      let matchedGroup: MovieGroup | undefined = undefined;

      const extDate = candidate.release_date || candidate.first_air_date || '';
      const extYear = extDate ? extDate.substring(0, 4) : undefined;
      const canonicalExtId = createCanonicalMovieId(title, extYear);

      while (page <= 2 && !matchedGroup) {
        const searchStartTime = Date.now();
        globalDiscoveryStats.scraperSearches++;
        try {
          const results = await scraper.searchMovies(title, page);
          globalDiscoveryStats.totalSearchTimeMs += (Date.now() - searchStartTime);
          if (!results || results.length === 0) {
            break;
          }
          scraperItems.push(...results);

          const groups = groupCatalogItems(scraperItems);

          // 1. Match by Title + Exact Year
          matchedGroup = groups.find(g => {
            const scraperYear = g.year || extractYear(g.representativeItem.title);
            if (extYear && scraperYear && extYear !== scraperYear) {
              return false; // NEVER merge different years
            }
            const canonicalScraperId = createCanonicalMovieId(g.title, scraperYear);
            return canonicalExtId === canonicalScraperId;
          });

          // 2. Fallback to Safe candidate matching
          if (!matchedGroup) {
            const cleanExtTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            matchedGroup = groups.find(g => {
              const scraperYear = g.year || extractYear(g.representativeItem.title);
              if (extYear && scraperYear && extYear !== scraperYear) {
                return false; // NEVER merge different years
              }
              const cleanScraperTitle = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanExtTitle === cleanScraperTitle;
            });
          }

          // 3. Fallback: Accept match without year if candidate has no year
          if (!matchedGroup && !extYear) {
            const cleanExtTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            matchedGroup = groups.find(g => {
              const cleanScraperTitle = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanExtTitle === cleanScraperTitle;
            });
          }
        } catch (err) {
          console.warn(`[MovieMetadataResolver] Scraper search failed for ${title}`, err);
          break;
        }

        page++;
      }

      if (matchedGroup) {
        let enriched: MovieGroup = {
          ...matchedGroup,
          tmdbId: candidate.id,
          rating: candidate.vote_average || matchedGroup.rating,
          popularity: candidate.popularity,
        };

        if (apiKey) {
          try {
            const details = await tmdb.getTmdbDetails(candidate.id, candidate.release_date ? 'movie' : 'tv', apiKey);
            if (details) {
              const backdropUrl = details.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}`
                : undefined;
              const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
              enriched = {
                ...enriched,
                genres,
                backdropUrl,
                collectionId: details.belongs_to_collection?.id || undefined,
                collectionName: details.belongs_to_collection?.name || undefined,
              };
            }
          } catch (e) {
            // Ignore details fetch errors
          }
        }

        try {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              expiresAt: Date.now() + CACHE_TTL_MS,
              data: { group: enriched }
            })
          );
        } catch (e) {
          console.warn(`[MovieMetadataResolver] Cache write failed for ${title}`, e);
        }

        globalDiscoveryStats.matches++;
        matchedGroups[index] = enriched;
        matchedCount++;
      } else {
        try {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              expiresAt: Date.now() + CACHE_TTL_MS,
              data: { unmatched: true }
            })
          );
        } catch (e) {
          console.warn(`[MovieMetadataResolver] Cache negative write failed for ${title}`, e);
        }
        globalDiscoveryStats.skipped++;
      }
    };

    const workers = Array.from({ length: concurrencyLimit }, async () => {
      while (nextIndex < externalList.length && matchedCount < targetCount) {
        const currentIndex = nextIndex++;
        await processCandidate(currentIndex);
      }
    });

    await Promise.all(workers);

    const uniqueMap = new Map<string, MovieGroup>();
    for (const g of matchedGroups) {
      if (g && !uniqueMap.has(g.movieId)) {
        uniqueMap.set(g.movieId, g);
      }
    }
    const finalResult = Array.from(uniqueMap.values());

    globalDiscoveryStats.totalPrepTimeMs = Date.now() - startTime;
    if (globalDiscoveryStats.scraperSearches > 0) {
      globalDiscoveryStats.averageSearchTimeMs = Math.round(
        globalDiscoveryStats.totalSearchTimeMs / globalDiscoveryStats.scraperSearches
      );
    }

    return finalResult;
  }
}
