export interface CatalogItem {
  id?: string;
  title: string;
  url: string;
  imageUrl?: string;
  rating?: string;
  year?: string;
  resolution?: string;
  isDualAudio?: boolean;
  isHEVC?: boolean;
}

export interface DownloadLink {
  label: string;
  url: string;
  size?: string;
  resolution?: string;
  type: 'download' | 'watch';
}

export interface MovieDetail {
  id?: string;
  title: string;
  url: string;
  imageUrl?: string;
  date?: string;
  imdbRating?: string;
  quality?: string;
  language?: string;
  director?: string;
  stars: string[];
  genres: string[];
  categories: string[];
  storyline?: string;
  screenshots: string[];
  downloadLinks: DownloadLink[];
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
