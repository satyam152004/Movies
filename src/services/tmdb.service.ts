import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'react-native';
import {MovieDetail} from '../data/models';
import {formatDisplayTitle} from '../utils/formatDisplayTitle';
import {isValidStoryline, sanitizeStoryline} from './detail.parser';

function mergeStoryline(
  scraperStoryline: string | undefined,
  tmdbOverview: string | undefined,
  title?: string,
): string | undefined {
  if (tmdbOverview && isValidStoryline(tmdbOverview, title)) {
    return sanitizeStoryline(tmdbOverview);
  }
  if (scraperStoryline && isValidStoryline(scraperStoryline, title)) {
    return sanitizeStoryline(scraperStoryline);
  }
  return undefined;
}

const CACHE_PREFIX = 'movie_enrichment_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export class TmdbService {
  private static instance: TmdbService;

  private constructor() {}

  public static getInstance(): TmdbService {
    if (!TmdbService.instance) {
      TmdbService.instance = new TmdbService();
    }
    return TmdbService.instance;
  }

  /**
   * Retrieves TMDB API Key based on configuration priority
   */
  private async getApiKey(): Promise<string | null> {
    try {
      // 1. Check AsyncStorage override
      const overrideKey = await AsyncStorage.getItem('@tmdb_api_key_override');
      if (overrideKey && overrideKey.trim().length > 0) {
        return overrideKey.trim();
      }

      // 2. Check process.env (react-native env configurations)
      const envKey =
        (process.env as any).TMDB_API_KEY ||
        (process.env as any).REACT_APP_TMDB_API_KEY;
      if (envKey && envKey.trim().length > 0) {
        return envKey.trim();
      }

      // 3. Fallback to default TMDB API key
      return '8b26c0df890cf2af74d385bb4ae55778';
    } catch (e) {
      console.warn('Failed to resolve TMDB API key', e);
    }
    return null;
  }

  /**
   * Checks local AsyncStorage cache for enriched movie data
   */
  private async getCachedData(movieUrl: string): Promise<any | null> {
    try {
      const cacheKey = CACHE_PREFIX + encodeURIComponent(movieUrl);
      const json = await AsyncStorage.getItem(cacheKey);
      if (json) {
        const cached = JSON.parse(json);
        if (cached.expiresAt && Date.now() < cached.expiresAt) {
          return cached.data;
        }
      }
    } catch (e) {
      console.warn('Cache read error', e);
    }
    return null;
  }

  /**
   * Saves enriched movie details to cache
   */
  private async setCachedData(movieUrl: string, data: any): Promise<void> {
    try {
      const cacheKey = CACHE_PREFIX + encodeURIComponent(movieUrl);
      const cacheObject = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheObject));
    } catch (e) {
      console.warn('Cache write error', e);
    }
  }

  /**
   * Main entry point to enrich a scraped MovieDetail
   */
  public async enrichMovie(movie: MovieDetail): Promise<MovieDetail> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.info(
        'TMDB API Key not configured. Gracefully skipping enrichment.',
      );
      return movie;
    }

    // Check Cache
    const cached = await this.getCachedData(movie.url);
    if (cached) {
      console.info(`Using cached enrichment for movie: "${movie.title}"`);
      const mergedStoryline = mergeStoryline(
        movie.storyline,
        cached.overview,
        movie.title,
      );
      return {
        ...movie,
        ...cached,
        storyline: mergedStoryline,
      };
    }

    try {
      // 2.5 Run configuration check first to debug network connectivity
      try {
        const configUrl = `${TMDB_BASE_URL}/configuration?api_key=${apiKey}`;
        console.info('[TMDB Debug] Running configuration endpoint check...');
        await this.testFetch(configUrl);
        console.info('[TMDB Debug] Before returning from configuration check');
        console.info('[TMDB Debug] Configuration endpoint check SUCCEEDED.');
      } catch (e: any) {
        console.error(
          '[TMDB Debug] Configuration endpoint check FAILED. Root details:',
          {
            message: e.message,
            stack: e.stack,
            cause: e.cause,
          },
        );
      }

      console.info('[TMDB Debug] Before findTmdbMovie()');
      console.info(`Searching TMDB for enrichment: "${movie.title}"...`);
      const matchResult = await this.findTmdbMovie(movie, apiKey);
      console.info('[TMDB Debug] After findTmdbMovie()');
      if (!matchResult || matchResult.confidence < 70) {
        console.info(
          `TMDB match confidence too low (${
            matchResult?.confidence || 0
          }%). Skipping.`,
        );
        return movie;
      }

      const tmdbId = matchResult.id;

      console.info('[TMDB Debug] Before getTmdbDetails()');
      console.info(`Fetching TMDB full details for ID: ${tmdbId}...`);
      const details = await this.getTmdbDetails(tmdbId, apiKey);
      console.info('[TMDB Debug] After getTmdbDetails()');
      if (!details) {
        return movie;
      }

      // Extract details
      const backdropUrl = details.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}`
        : undefined;
      const logoUrl = this.extractLogoUrl(details.images?.logos);
      const runtime = details.runtime || undefined;
      const country =
        details.origin_country && details.origin_country.length > 0
          ? details.origin_country[0]
          : undefined;
      const budget = details.budget || undefined;
      const revenue = details.revenue || undefined;
      const studios = details.production_companies
        ? details.production_companies.map((c: any) => c.name)
        : [];
      const homepage = details.homepage || undefined;

      // US certification rating
      const certification = this.extractCertification(
        details.release_dates?.results,
      );

      // Cast processing (using optimized w185 profiles)
      const enrichedCast = details.credits?.cast
        ? details.credits.cast.slice(0, 15).map((actor: any) => ({
            name: actor.name,
            character: actor.character,
            profileUrl: actor.profile_path
              ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
              : '',
          }))
        : [];

      // Crew processing
      const crewJobs = [
        'Director',
        'Screenplay',
        'Writer',
        'Producer',
        'Music',
      ];
      const enrichedCrew = details.credits?.crew
        ? details.credits.crew
            .filter((person: any) => crewJobs.includes(person.job))
            .map((person: any) => ({
              name: person.name,
              job: person.job,
            }))
            .slice(0, 8)
        : [];

      const overview = details.overview || undefined;

      const enrichedFields = {
        tmdbId: String(tmdbId),
        backdropUrl,
        logoUrl,
        runtime,
        certification,
        country,
        budget,
        revenue,
        studios,
        homepage,
        enrichedCast,
        enrichedCrew,
        overview,
      };

      // Prefetch images in background
      this.prefetchEnrichedImages(backdropUrl, logoUrl, enrichedCast);

      // Update Cache
      await this.setCachedData(movie.url, enrichedFields);

      console.info('[TMDB Debug] Before returning from enrichMovie()');
      const mergedStoryline = mergeStoryline(
        movie.storyline,
        overview,
        movie.title,
      );
      return {
        ...movie,
        ...enrichedFields,
        storyline: mergedStoryline,
      };
    } catch (error) {
      console.warn('Failed to enrich movie from TMDB', error);
      return movie;
    }
  }

  /**
   * Helper to perform matching and score confidence
   */
  private async findTmdbMovie(
    movie: MovieDetail,
    apiKey: string,
  ): Promise<{id: number; confidence: number} | null> {
    // Clean title and extract year
    const rawClean = formatDisplayTitle(movie.title);
    const yearMatch = rawClean.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : undefined;
    const cleanTitle = rawClean.replace(/\(\d{4}\)/, '').trim();

    if (!cleanTitle) {
      return null;
    }

    try {
      // Priority 2/3: Search movie by title (and optionally year)
      let searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(
        cleanTitle,
      )}`;
      if (year) {
        searchUrl += `&year=${year}`;
      }
      const data = await this.testFetch(searchUrl);
      const results = data.results || [];
      if (results.length === 0) {
        return null;
      }

      const firstResult = results[0];

      // Score matching
      if (
        year &&
        firstResult.release_date &&
        firstResult.release_date.startsWith(year)
      ) {
        return {id: firstResult.id, confidence: 95};
      }

      // Check for exact title match (case-insensitive)
      const tmdbTitle = firstResult.title || '';
      const tmdbOrgTitle = firstResult.original_title || '';
      if (
        tmdbTitle.toLowerCase() === cleanTitle.toLowerCase() ||
        tmdbOrgTitle.toLowerCase() === cleanTitle.toLowerCase()
      ) {
        return {id: firstResult.id, confidence: 90};
      }

      // Check matching language
      if (movie.language && firstResult.original_language) {
        const movieLang = movie.language.toLowerCase();
        const tmdbLang = firstResult.original_language.toLowerCase();
        // Simple mapping
        if (
          (movieLang.includes('hindi') && tmdbLang === 'hi') ||
          (movieLang.includes('english') && tmdbLang === 'en') ||
          (movieLang.includes('spanish') && tmdbLang === 'es')
        ) {
          return {id: firstResult.id, confidence: 90};
        }
      }

      // Otherwise title only
      return {id: firstResult.id, confidence: 70};
    } catch (e) {
      console.warn('Title search failed', e);
    }

    return null;
  }

  /**
   * Queries full movie details including credits, videos, release dates and images
   */
  private async getTmdbDetails(
    tmdbId: number,
    apiKey: string,
  ): Promise<any | null> {
    try {
      const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}&append_to_response=videos,credits,images,release_dates`;
      const data = await this.testFetch(url);
      return data;
    } catch (e) {
      console.warn('Failed to retrieve full TMDB details', e);
    }
    return null;
  }

  private extractLogoUrl(logos?: any[]): string | undefined {
    if (!logos || logos.length === 0) {
      return undefined;
    }
    // Prefer English logo
    const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
    const selectedLogo = enLogo || logos[0];
    return `https://image.tmdb.org/t/p/w300${selectedLogo.file_path}`;
  }

  private extractCertification(results?: any[]): string | undefined {
    if (!results) {
      return undefined;
    }
    const usRelease = results.find((r: any) => r.iso_3166_1 === 'US');
    if (
      usRelease &&
      usRelease.release_dates &&
      usRelease.release_dates.length > 0
    ) {
      const dates = usRelease.release_dates;
      // find first non-empty certification
      for (const d of dates) {
        if (d.certification) {
          return d.certification;
        }
      }
    }
    return undefined;
  }

  private prefetchEnrichedImages(
    backdropUrl?: string,
    logoUrl?: string,
    cast?: any[],
  ) {
    try {
      if (backdropUrl) {
        Image.prefetch(backdropUrl);
      }
      if (logoUrl) {
        Image.prefetch(logoUrl);
      }
      if (cast) {
        cast.forEach(actor => {
          if (actor.profileUrl) {
            Image.prefetch(actor.profileUrl);
          }
        });
      }
    } catch (e) {
      console.warn('Image prefetching error', e);
    }
  }

  /**
   * Custom fetch wrapper supporting detailed debug logging
   */
  private async testFetch(url: string): Promise<any> {
    try {
      console.info(`[TMDB Debug] Fetch Request URL: "${url}"`);

      // Diagnostic check to see if general networking works
      try {
        console.info('[TMDB Debug] DIAGNOSTIC: Fetching jsonplaceholder...');
        const diagRes = await fetch(
          'https://jsonplaceholder.typicode.com/todos/1',
        );
        const diagText = await diagRes.text();
        console.info(
          '[TMDB Debug] DIAGNOSTIC: jsonplaceholder SUCCESS:',
          diagText,
        );
      } catch (de: any) {
        console.error(
          '[TMDB Debug] DIAGNOSTIC: jsonplaceholder FAILED:',
          de.message,
        );
      }

      console.info(`[TMDB Debug] Before fetch() for URL: "${url}"`);
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      console.info(`[TMDB Debug] After fetch() for URL: "${url}"`);

      console.info(
        `[TMDB Debug] Fetch Response Status: ${response.status} for URL: "${url}"`,
      );
      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const data = await response.json();
      console.info(`[TMDB Debug] After response.json() for URL: "${url}"`);
      return data;
    } catch (e: any) {
      console.error(
        `[TMDB Debug] Fetch Network Request Failed for URL: "${url}"`,
        {
          message: e.message,
          stack: e.stack,
          cause: e.cause,
          name: e.name,
        },
      );
      throw e;
    }
  }
}
