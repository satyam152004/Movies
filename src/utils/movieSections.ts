import { MovieGroup, MovieSection, SectionConfig, WatchProgress } from '../models/movie.types';
import { createCanonicalMovieId, extractYear } from './movieGrouping';

function matchExternalToScraper(
  external: { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string },
  scraperGroups: MovieGroup[]
): MovieGroup | undefined {
  const extId = external.id;
  const extTitle = (external.title || external.name || '').trim();
  const extDate = external.release_date || external.first_air_date || '';
  const extYear = extDate ? extDate.substring(0, 4) : undefined;

  if (!extTitle) return undefined;

  // 1. TMDb ID / IMDb ID when already resolved
  const idMatch = scraperGroups.find(g => g.tmdbId === extId);
  if (idMatch) return idMatch;

  const canonicalExtId = createCanonicalMovieId(extTitle, extYear);

  // 2. Normalized title + exact year validation
  const exactMatch = scraperGroups.find(g => {
    const scraperYear = g.year || extractYear(g.representativeItem.title);
    if (extYear && scraperYear && extYear !== scraperYear) {
      return false; // Never merge different years
    }
    const canonicalScraperId = createCanonicalMovieId(g.title, scraperYear);
    return canonicalExtId === canonicalScraperId;
  });
  if (exactMatch) return exactMatch;

  // 3. Safe title/year candidate matching
  const cleanExtTitle = extTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidateMatch = scraperGroups.find(g => {
    const scraperYear = g.year || extractYear(g.representativeItem.title);
    if (extYear && scraperYear && extYear !== scraperYear) {
      return false; // Never merge different years
    }
    const cleanScraperTitle = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanExtTitle === cleanScraperTitle;
  });

  if (candidateMatch) return candidateMatch;

  // 4. Otherwise treat as unmatched and SKIP
  return undefined;
}

export function buildHomeSections(params: {
  movieGroups: MovieGroup[];
  watchProgress: WatchProgress[];
  configs: SectionConfig[];
  trendingTmdbList: any[];
  topRatedTmdbList: any[];
}): MovieSection[] {
  const { movieGroups, watchProgress, configs, trendingTmdbList, topRatedTmdbList } = params;

  // Filter valid watch progress (position > 0, duration > 0, progress < 90%)
  const continueWatchingProgress = watchProgress
    .filter(p => p.position > 0 && p.duration > 0 && p.position < p.duration * 0.90)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const continueWatchingMovies = continueWatchingProgress
    .map(p => movieGroups.find(m => m.movieId === p.movieId))
    .filter((m): m is MovieGroup => !!m);

  // Extract genres from recently watched to use in Recommendations
  const watchedGenres = new Set<string>();
  continueWatchingMovies.forEach(m => {
    m.genres?.forEach(g => watchedGenres.add(g));
  });

  const resultSections: MovieSection[] = [];

  for (const config of configs) {
    let sectionMovies: MovieGroup[] = [];

    switch (config.id) {
      case 'continue-watching':
        // Continue Watching: Local watch progress ∩ Scraper
        sectionMovies = continueWatchingMovies;
        break;

      case 'trending':
        // Trending Now: TMDb Trending ∩ Scraper
        if (trendingTmdbList && trendingTmdbList.length > 0) {
          const matched: MovieGroup[] = [];
          for (const ext of trendingTmdbList) {
            const match = matchExternalToScraper(ext, movieGroups);
            if (match && !matched.some(m => m.movieId === match.movieId)) {
              matched.push(match);
              if (matched.length >= 10) break;
            }
          }
          sectionMovies = matched;
        }
        break;

      case 'top10':
        // Top 10: TMDb Top Rated ∩ Scraper
        if (topRatedTmdbList && topRatedTmdbList.length > 0) {
          const matched: MovieGroup[] = [];
          for (const ext of topRatedTmdbList) {
            const match = matchExternalToScraper(ext, movieGroups);
            if (match && !matched.some(m => m.movieId === match.movieId)) {
              matched.push(match);
              if (matched.length >= 10) break;
            }
          }
          sectionMovies = matched;
        }
        break;

      case 'latest':
        // Latest Releases: Chronological scraper-available catalog order
        sectionMovies = movieGroups.slice(0, 10);
        break;

      case 'recommended':
        // Recommended: User preference/history metadata ∩ Scraper
        if (watchedGenres.size > 0) {
          sectionMovies = movieGroups
            .filter(m => !continueWatchingMovies.some(cw => cw.movieId === m.movieId))
            .filter(m => m.genres?.some(g => watchedGenres.has(g)))
            .slice(0, 8);
        }
        break;

      case 'collections':
        // Collection = TMDb Collection ∩ Scraper
        sectionMovies = movieGroups
          .filter(m => m.collectionId !== undefined && m.collectionId !== null)
          .slice(0, 5);
        break;

      default:
        // Genre Filters (e.g. Action, Comedy): TMDb Genre Group ∩ Scraper
        if (config.genreFilter) {
          sectionMovies = movieGroups
            .filter(m =>
              m.genres?.some(
                g => g.toLowerCase() === config.genreFilter!.toLowerCase()
              )
            )
            .slice(0, 10);
        }
        break;
    }

    // Only add section if we have populated scraper-matched movies
    if (sectionMovies.length > 0) {
      resultSections.push({
        id: config.id,
        title: config.title,
        layout: config.layout,
        movies: sectionMovies,
      });
    }
  }

  return resultSections;
}
