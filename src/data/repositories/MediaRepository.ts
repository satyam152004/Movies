import {CatalogItem, MovieDetail} from '../models';

export interface MediaRepository {
  getCatalog(
    categoryUrl?: string,
    forceRefresh?: boolean,
  ): Promise<CatalogItem[]>;
  getMovieDetails(
    movieUrl: string,
    forceDynamic?: boolean,
  ): Promise<MovieDetail>;
  searchCatalog(query: string): Promise<CatalogItem[]>;
}
