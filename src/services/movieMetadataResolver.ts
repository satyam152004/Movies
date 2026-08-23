import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatalogItem } from '../data/models';
import { MovieGroup, MovieRelease } from '../models/movie.types';
import { TmdbService } from './tmdb.service';
import { createCanonicalMovieId, extractYear, groupCatalogItems } from '../utils/movieGrouping';

const RESOLVER_CACHE_PREFIX = 'tmdb_metadata_resolve_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ResolvedMetadata {
  tmdbId?: number;
  imdbId?: string;
  rating?: number;
  popularity?: number;
  genres?: string[];
  collectionId?: number;
  collectionName?: string;
  backdropUrl?: string;
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

    const enrichedGroups = await this.runWithConcurrency(
      initialGroups,
      5, // limit requests to 5 at a time
      async (group): Promise<MovieGroup> => {
        try {
          const cacheKey = RESOLVER_CACHE_PREFIX + encodeURIComponent(group.movieId);
          const cachedRaw = await AsyncStorage.getItem(cacheKey);

          let meta: ResolvedMetadata | null = null;
          if (cachedRaw) {
            const cachedParsed = JSON.parse(cachedRaw);
            if (cachedParsed && cachedParsed.expiresAt && Date.now() < cachedParsed.expiresAt) {
              meta = cachedParsed.data;
            }
          }

          if (!meta && apiKey) {
            // Find Candidate
            const match = await tmdb.findTmdbMovie(
              { title: group.title },
              apiKey
            );

            if (match && match.confidence >= 70) {
              // Verify Year match if both exist
              const searchDetails = await tmdb.getTmdbDetails(match.id, match.type, apiKey);
              if (searchDetails) {
                const tmdbDate = match.type === 'movie' ? searchDetails.release_date : searchDetails.first_air_date;
                const tmdbYear = tmdbDate ? tmdbDate.substring(0, 4) : undefined;
                const scraperYear = group.year || extractYear(group.representativeItem.title);

                const isYearMatch = !scraperYear || !tmdbYear || scraperYear === tmdbYear;
                if (isYearMatch) {
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
          }

          if (meta) {
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
}
