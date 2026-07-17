import { CatalogItem, MovieDetail, MediaCategory } from '../models';

export interface SearchPage {
  items: CatalogItem[];
  page: number;
  hasNextPage: boolean;
}

export interface MediaRepository {
  search(
    query: string,
    page?: number,
    options?: { signal?: AbortSignal },
  ): Promise<SearchPage>;
  getTrending(): Promise<CatalogItem[]>;
  getLatest(): Promise<CatalogItem[]>;
  getMovie(id: string): Promise<MovieDetail>;
  getCategories(): Promise<MediaCategory[]>;
}
