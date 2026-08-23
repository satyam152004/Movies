import { MovieGroup, MovieSection, SectionConfig, WatchProgress } from '../models/movie.types';

export function buildHomeSections(params: {
  movieGroups: MovieGroup[];
  watchProgress: WatchProgress[];
  configs: SectionConfig[];
  trendingTmdbIds: number[];
  topRatedTmdbIds: number[];
}): MovieSection[] {
  const { movieGroups, watchProgress, configs, trendingTmdbIds, topRatedTmdbIds } = params;

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
        sectionMovies = continueWatchingMovies;
        break;

      case 'trending':
        // Trending / Popular: Match TMDb trending IDs only
        if (trendingTmdbIds.length > 0) {
          sectionMovies = trendingTmdbIds
            .map(id => movieGroups.find(m => m.tmdbId === id))
            .filter((m): m is MovieGroup => !!m);
        }
        break;

      case 'top10':
        // Top Rated: Match TMDb top rated IDs only
        if (topRatedTmdbIds.length > 0) {
          sectionMovies = topRatedTmdbIds
            .map(id => movieGroups.find(m => m.tmdbId === id))
            .filter((m): m is MovieGroup => !!m);
        }
        sectionMovies = sectionMovies.slice(0, 10);
        break;

      case 'latest':
        // Latest Releases: Natural catalog order (new scraper posts first)
        sectionMovies = movieGroups.slice(0, 10);
        break;

      case 'recommended':
        // Recommendation: Movies matching watched genres, excluding watched movies
        if (watchedGenres.size > 0) {
          sectionMovies = movieGroups
            .filter(m => !continueWatchingMovies.some(cw => cw.movieId === m.movieId))
            .filter(m => m.genres?.some(g => watchedGenres.has(g)))
            .slice(0, 8);
        }
        break;

      case 'collections':
        // Only output collections section if explicit collectionId is present
        sectionMovies = movieGroups
          .filter(m => m.collectionId !== undefined && m.collectionId !== null)
          .slice(0, 5);
        break;

      default:
        // Handle genre filters (e.g. Action, Comedy)
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

    // Only add section if we have populated movies
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
