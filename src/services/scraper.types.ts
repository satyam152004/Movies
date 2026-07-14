export type ScraperPageState =
  | 'INIT'
  | 'WAIT_FOR_STABLE'
  | 'CLASSIFY_PAGE'
  | 'HANDLE_CLOUDFLARE'
  | 'HANDLE_VERIFICATION'
  | 'HANDLE_COUNTDOWN'
  | 'HANDLE_MEDIATOR'
  | 'HANDLE_REDIRECT'
  | 'HANDLE_SERVER_SELECTION'
  | 'EXTRACT_MIRRORS'
  | 'RESOLVE_DIRECT_URL'
  | 'RECOVERY'
  | 'SUCCESS'
  | 'ERROR';

export interface Diagnostics {
  visitedUrls: string[];
  detectedStrategies: string[];
  stateTransitions: string[];
  warnings: string[];
}

export interface ScraperSessionResult {
  html: string;
  finalUrl: string;
  pageType: string;
  redirectCount: number;
  clickCount: number;
  mirrorCount: number;
  duration: number;
  history: string[];
  diagnostics: Diagnostics;
  mirrors?: { label: string; url: string }[];
}

export interface ScraperSessionRequest {
  id: string;
  url: string;
  targetType: 'mirrors' | 'direct-links' | 'direct-file';
  maxRedirects?: number;
  maxClicks?: number;
  maxRuntime?: number;
  maxIdleWait?: number;
}
