import { CatalogItem } from '../data/models';

export interface MovieRelease {
  url: string;
  resolution?: string;
  isDualAudio?: boolean;
  releaseLabel?: string;
}

export interface MovieGroup {
  movieId: string;
  tmdbId?: number;
  imdbId?: string;
  title: string;
  year?: string;
  imageUrl?: string;
  backdropUrl?: string;
  rating?: number;
  popularity?: number;
  genres?: string[];
  collectionId?: number;
  collectionName?: string;
  releases: MovieRelease[];
  representativeItem: CatalogItem;
}

export interface WatchProgress {
  movieId: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export type SectionLayout =
  | 'poster'
  | 'numbered'
  | 'landscape'
  | 'featured';

export interface MovieSection {
  id: string;
  title: string;
  layout: SectionLayout;
  movies: MovieGroup[];
}

export interface SectionConfig {
  id: string;
  title: string;
  layout: SectionLayout;
  genreFilter?: string;
}
