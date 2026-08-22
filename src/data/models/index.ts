export interface CatalogItem {
  id?: string;
  title: string;
  url: string;
  imageUrl?: string;
  year?: string;
  resolution?: string;
  isDualAudio?: boolean;
  isHEVC?: boolean;
  rating?: number;
}

export interface DownloadLink {
  label: string;
  url: string;
  size?: string;
  resolution?: string;
  type: 'download' | 'watch' | 'unknown';
}

export interface MovieDetail {
  id?: string;
  title: string;
  url: string;
  imageUrl?: string;
  date?: string;
  quality?: string;
  language?: string;
  director?: string;
  stars: string[];
  genres: string[];
  categories: string[];
  storyline?: string;
  screenshots: string[];
  downloadLinks: DownloadLink[];
  tmdbId?: string;
  backdropUrl?: string;
  logoUrl?: string;
  runtime?: number;
  certification?: string;
  country?: string;
  budget?: number;
  revenue?: number;
  studios?: string[];
  homepage?: string;
  enrichedCast?: {name: string; character: string; profileUrl: string}[];
  enrichedCrew?: {name: string; job: string}[];
  enrichmentPending?: boolean;
  rating?: number;
}

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'cancelled'
  | 'failed'
  | 'completed';

export interface DownloadTask {
  id: string;
  movieTitle: string;
  fileSize: string;
  downloadUrl: string;
  progress: number;
  status: DownloadStatus;
  downloadSpeed: string;
  downloadedSize: string;
  eta: string;
  logs: string[];
}

export interface MediaCategory {
  id: string;
  title: string;
}

export interface FeatureFlags {
  heroBannerV2: boolean;
  downloadsV2: boolean;
  developerMode: boolean;
  experimentalAnimations: boolean;
}
