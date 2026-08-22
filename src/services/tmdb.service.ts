import AsyncStorage from '@react-native-async-storage/async-storage';
import {CacheStorage} from './storage/cache.storage';
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

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TMDB_BASE_URL = 'https://api.tmdb.org/3';

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
    return await CacheStorage.getTmdbCache(movieUrl);
  }

  /**
   * Saves enriched movie details to cache
   */
  private async setCachedData(movieUrl: string, data: any): Promise<void> {
    await CacheStorage.saveTmdbCache(movieUrl, data, CACHE_TTL_MS);
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
      const mediaType = matchResult.type;

      console.info('[TMDB Debug] Before getTmdbDetails()');
      console.info(`Fetching TMDB full details for ID: ${tmdbId} (${mediaType})...`);
      const details = await this.getTmdbDetails(tmdbId, mediaType, apiKey);
      console.info('[TMDB Debug] After getTmdbDetails()');
      if (!details) {
        return movie;
      }

      // Extract details
      const backdropUrl = details.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}`
        : undefined;
      const logoUrl = this.extractLogoUrl(details.images?.logos);
      const runtime = mediaType === 'movie'
        ? (details.runtime || undefined)
        : (details.episode_run_time && details.episode_run_time.length > 0 ? details.episode_run_time[0] : undefined);
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
      const certification = mediaType === 'movie'
        ? this.extractCertification(details.release_dates?.results, false)
        : this.extractCertification(details.content_ratings?.results, true);

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
      const rating = details.vote_average || undefined;

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
        rating,
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
  ): Promise<{id: number; type: 'movie' | 'tv'; confidence: number} | null> {
    const rawClean = formatDisplayTitle(movie.title);
    const yearMatch = rawClean.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : undefined;
    const cleanTitle = rawClean.replace(/\(\d{4}\)/, '').trim();

    const tvShowMatch = cleanTitle.match(/(.*)\s+(Season\s+\d+|Complete|Series|Show|Episode\s+\d+)/i);
    const isTvMarker = /(Season|Complete|Series|Show|Episode)/i.test(cleanTitle);
    
    let queryTitle = cleanTitle;
    if (tvShowMatch && tvShowMatch[1]) {
      queryTitle = tvShowMatch[1].trim();
    }

    if (!queryTitle) {
      return null;
    }

    const trySearch = async (type: 'movie' | 'tv'): Promise<{id: number; type: 'movie' | 'tv'; confidence: number} | null> => {
      try {
        let searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(
          queryTitle,
        )}`;
        if (year) {
          if (type === 'movie') {
            searchUrl += `&year=${year}`;
          } else {
            searchUrl += `&first_air_date_year=${year}`;
          }
        }
        const data = await this.testFetch(searchUrl);
        const results = data.results || [];
        if (results.length === 0) {
          return null;
        }

        const firstResult = results[0];
        const resultTitle = type === 'movie' ? firstResult.title : firstResult.name;
        const resultOrgTitle = type === 'movie' ? firstResult.original_title : firstResult.original_name;
        const resultDate = type === 'movie' ? firstResult.release_date : firstResult.first_air_date;

        if (
          year &&
          resultDate &&
          resultDate.startsWith(year)
        ) {
          return {id: firstResult.id, type, confidence: 95};
        }

        if (
          (resultTitle && resultTitle.toLowerCase() === queryTitle.toLowerCase()) ||
          (resultOrgTitle && resultOrgTitle.toLowerCase() === queryTitle.toLowerCase())
        ) {
          return {id: firstResult.id, type, confidence: 90};
        }

        if (movie.language && firstResult.original_language) {
          const movieLang = movie.language.toLowerCase();
          const tmdbLang = firstResult.original_language.toLowerCase();
          if (
            (movieLang.includes('hindi') && tmdbLang === 'hi') ||
            (movieLang.includes('english') && tmdbLang === 'en') ||
            (movieLang.includes('spanish') && tmdbLang === 'es')
          ) {
            return {id: firstResult.id, type, confidence: 90};
          }
        }

        return {id: firstResult.id, type, confidence: 70};
      } catch (e) {
        console.warn(`${type} search failed`, e);
        return null;
      }
    };

    if (isTvMarker) {
      const tvRes = await trySearch('tv');
      if (tvRes) return tvRes;
      return await trySearch('movie');
    } else {
      const movieRes = await trySearch('movie');
      if (movieRes) return movieRes;
      return await trySearch('tv');
    }
  }

  /**
   * Queries full movie/TV show details including credits, videos, and images
   */
  private async getTmdbDetails(
    tmdbId: number,
    type: 'movie' | 'tv',
    apiKey: string,
  ): Promise<any | null> {
    try {
      const appendParams = type === 'movie' ? 'videos,credits,images,release_dates' : 'videos,credits,images,content_ratings';
      const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=${appendParams}`;
      const data = await this.testFetch(url);
      return data;
    } catch (e) {
      console.warn(`Failed to retrieve full TMDB ${type} details`, e);
    }
    return null;
  }

  private extractLogoUrl(logos?: any[]): string | undefined {
    if (!logos || logos.length === 0) {
      return undefined;
    }
    const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
    const selectedLogo = enLogo || logos[0];
    return `https://image.tmdb.org/t/p/w300${selectedLogo.file_path}`;
  }

  private extractCertification(results?: any[], isTv: boolean = false): string | undefined {
    if (!results) {
      return undefined;
    }
    if (isTv) {
      const usRating = results.find((r: any) => r.iso_3166_1 === 'US');
      return usRating?.rating;
    }
    const usRelease = results.find((r: any) => r.iso_3166_1 === 'US');
    if (
      usRelease &&
      usRelease.release_dates &&
      usRelease.release_dates.length > 0
    ) {
      const dates = usRelease.release_dates;
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
    let targetUrl = url;
    try {
      console.info(`[TMDB Debug] Fetch Request URL: "${targetUrl}"`);

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
        console.warn(
          '[TMDB Debug] DIAGNOSTIC: jsonplaceholder FAILED:',
          de.message,
        );
      }

      console.info(`[TMDB Debug] Before fetch() for URL: "${targetUrl}"`);
      let response;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

        response = await fetch(targetUrl, {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        if (targetUrl.includes('api.themoviedb.org')) {
          console.warn('[TMDB Debug] Primary TMDB domain failed or timed out. Retrying with fallback domain api.tmdb.org...');
          targetUrl = targetUrl.replace('api.themoviedb.org', 'api.tmdb.org');
          console.info(`[TMDB Debug] Fetch Request URL (Fallback): "${targetUrl}"`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout for fallback

          response = await fetch(targetUrl, {
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } else {
          throw fetchErr;
        }
      }

      console.info(`[TMDB Debug] After fetch() for URL: "${targetUrl}"`);

      console.info(
        `[TMDB Debug] Fetch Response Status: ${response.status} for URL: "${targetUrl}"`,
      );
      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const data = await response.json();
      console.info(`[TMDB Debug] After response.json() for URL: "${targetUrl}"`);
      return data;
    } catch (e: any) {
      console.warn(
        `[TMDB Debug] Fetch Network Request Failed for URL: "${targetUrl}"`,
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
