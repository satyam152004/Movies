import {ScraperState} from './States';
import {Diagnostics} from '../../scraper.types';

export interface ClickRecord {
  url: string;
  xpath: string;
  selector: string;
  text: string;
  boundingBox?: {x: number; y: number; width: number; height: number};
  fingerprint: string;
  timestamp: number;
  clickCount: number;
  stateBeforeClick: ScraperState;
}

export interface BrowserSession {
  sessionId: string;
  currentUrl: string;
  previousUrl: string;
  pageFingerprint: string;
  currentState: ScraperState;
  networkStatus: 'idle' | 'busy';
  pendingRequests: number;
  clickHistory: ClickRecord[];
  activeStrategyName: string;
  retryCount: number;
  navigationCount: number;
  visitedFingerprints: string[];
  visitedUrls: string[];
  diagnostics: Diagnostics & {
    structuredDiagnostics: any[];
  };
  startTime: number;
  targetType: 'mirrors' | 'direct-links' | 'direct-file';
  maxRedirects: number;
  maxClicks: number;
  maxRuntime: number;
  maxIdleWait: number;
}
