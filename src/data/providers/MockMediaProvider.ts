import { MediaRepository, SearchPage } from '../repositories/MediaRepository';
import { CatalogItem, MovieDetail, MediaCategory } from '../models';

export class MockMediaProvider implements MediaRepository {
  private mockItems: CatalogItem[] = [
    {
      id: 'm1',
      title: 'Mortal Kombat II (2026) [Dual Audio] [Hindi & English] 1080p FHD',
      url: 'https://mock-domain.com/mortal-kombat-ii-2026/',
      imageUrl: 'https://image.tmdb.org/t/p/w500/zPD511bWp012tFexjTjJ9r3oQ7C.jpg',
      rating: '7.8',
      year: '2026',
      resolution: '1080p',
      isDualAudio: true,
    },
    {
      id: 'm2',
      title: 'Avatar: The Way of Water (2022) [Dual Audio] [Hindi & English] 2160p 4K UHD',
      url: 'https://mock-domain.com/avatar-2-2022/',
      imageUrl: 'https://image.tmdb.org/t/p/w500/t6z8hp702ZwqIvDcJLt5oZs86uB.jpg',
      rating: '8.1',
      year: '2022',
      resolution: '2160p',
      isDualAudio: true,
      isHEVC: true,
    },
    {
      id: 'm3',
      title: 'Spider-Man: Beyond the Spider-Verse (2026) [Dual Audio] [Hindi-English] 1080p',
      url: 'https://mock-domain.com/spiderman-beyond-spiderverse-2026/',
      imageUrl: 'https://image.tmdb.org/t/p/w500/8Vt6Geo7o0lOI8724vKe6PY5jfg.jpg',
      rating: '8.9',
      year: '2026',
      resolution: '1080p',
      isDualAudio: true,
    },
    {
      id: 'm4',
      title: 'Interstellar (2014) [Dual Audio] [English & Hindi] 2160p 4K HEVC',
      url: 'https://mock-domain.com/interstellar-2014/',
      imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QvH3H670v5dfgZAnjkhu248.jpg',
      rating: '8.6',
      year: '2014',
      resolution: '2160p',
      isHEVC: true,
    },
  ];

  async search(
    query: string,
    page: number = 1,
    options?: { signal?: AbortSignal },
  ): Promise<SearchPage> {
    return new Promise((resolve, reject) => {
      const handleAbort = () => reject(new Error('Query aborted'));
      if (options?.signal?.aborted) {
        return handleAbort();
      }
      if (options?.signal) {
        options.signal.addEventListener('abort', handleAbort);
      }

      setTimeout(() => {
        if (options?.signal) {
          options.signal.removeEventListener('abort', handleAbort);
        }
        const filtered = this.mockItems.filter(item =>
          item.title.toLowerCase().includes(query.toLowerCase()),
        );
        resolve({
          items: page > 1 ? [] : filtered,
          page,
          hasNextPage: false,
        });
      }, 500);
    });
  }

  async getTrending(): Promise<CatalogItem[]> {
    return new Promise(resolve => setTimeout(() => resolve(this.mockItems.slice(0, 2)), 300));
  }

  async getLatest(): Promise<CatalogItem[]> {
    return new Promise(resolve => setTimeout(() => resolve(this.mockItems), 300));
  }

  async getMovie(id: string): Promise<MovieDetail> {
    const matched = this.mockItems.find(i => i.id === id) || this.mockItems[0];
    return new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            id: matched.id,
            title: matched.title,
            url: matched.url,
            imageUrl: matched.imageUrl,
            date: matched.year || '2026',
            imdbRating: matched.rating || '8.0',
            quality: matched.resolution || '1080p',
            language: 'Hindi + English',
            director: 'Christopher Nolan',
            stars: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
            genres: ['Sci-Fi', 'Adventure', 'Drama'],
            categories: ['Trending', 'Action', 'Sci-Fi'],
            storyline:
              "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival in a spectacular premium cinematic presentation.",
            screenshots: [
              'https://image.tmdb.org/t/p/w500/xJHok7RjIkZgdLrwtZNoMW5JNu5.jpg',
              'https://image.tmdb.org/t/p/w500/rAiw2mC4vS60cpe4o0Z2Q3219rL.jpg',
            ],
            downloadLinks: [
              {
                label: 'Download [Dual Audio] 1080p FHD (2.4 GB)',
                url: 'https://mock-portal.com/download/1080p',
                size: '2.4 GB',
                resolution: '1080p',
                type: 'download',
              },
              {
                label: 'Download [Dual Audio] 2160p 4K UHD (7.8 GB)',
                url: 'https://mock-portal.com/download/4k',
                size: '7.8 GB',
                resolution: '2160p',
                type: 'download',
              },
              {
                label: 'Direct Stream Playback (1080p)',
                url: 'https://mock-stream.com/play',
                resolution: '1080p',
                type: 'watch',
              },
            ],
          }),
        500,
      ),
    );
  }

  async getCategories(): Promise<MediaCategory[]> {
    return new Promise(resolve =>
      setTimeout(
        () =>
          resolve([
            { id: 'trending', title: 'Trending' },
            { id: 'latest', title: 'Latest' },
            { id: 'movies', title: 'Movies' },
            { id: 'series', title: 'Series' },
          ]),
        200,
      ),
    );
  }
}
