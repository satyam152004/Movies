import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {parseCatalog} from './catalog.parser';
import {
  parseMovieDetail,
  parseDownloadPage,
  parseDirectDownloadPage,
  parseDirectFileHost,
} from './detail.parser';
import {CatalogItem, MovieDetail} from '../model/movie.model';
import {ScraperSessionRequest, ScraperSessionResult} from './scraper.types';

export type LogType = 'info' | 'warn' | 'error' | 'success';
export type LogCallback = (message: string, type: LogType) => void;

export class ScraperError extends Error {
  public type: string;
  public retryable: boolean;
  public statusCode?: number;
  public url?: string;

  constructor(
    type: string,
    message: string,
    retryable: boolean,
    statusCode?: number,
    url?: string,
  ) {
    super(message);
    this.name = 'ScraperError';
    this.type = type;
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.url = url;
    Object.setPrototypeOf(this, ScraperError.prototype);
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
];

export class ScraperService {
  private static instance: ScraperService;
  private logCallbacks: LogCallback[] = [];

  // WebView dynamic scraper hooks
  private webViewTrigger:
    | ((
        request: ScraperSessionRequest,
        onCompleted: (result: ScraperSessionResult | null, error?: any) => void,
      ) => void)
    | null = null;

  private constructor() {}

  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  // Register logger hooks
  public addLogListener(callback: LogCallback) {
    this.logCallbacks.push(callback);
  }

  public removeLogListener(callback: LogCallback) {
    this.logCallbacks = this.logCallbacks.filter(cb => cb !== callback);
  }

  public log(message: string, type: LogType = 'info') {
    const formattedMsg = `[${new Date().toLocaleTimeString()}] ${message}`;

    // Log to standard JavaScript console so ADB and Metro capture it
    switch (type) {
      case 'error':
        console.error(`[Scraper] ${message}`);
        break;
      case 'warn':
        console.warn(`[Scraper] ${message}`);
        break;
      case 'success':
      case 'info':
      default:
        console.log(`[Scraper] ${message}`);
        break;
    }

    this.logCallbacks.forEach(cb => cb(formattedMsg, type));
  }

  // Register WebView control trigger
  public registerWebViewTrigger(
    trigger: (
      request: ScraperSessionRequest,
      onCompleted: (
        result: ScraperSessionResult | null,
        error?: string,
      ) => void,
    ) => void,
  ) {
    this.webViewTrigger = trigger;
  }

  /**
   * Run a multi-stage session using the registered WebView trigger
   */
  private runWebViewScrapeSession(
    url: string,
    targetType: 'mirrors' | 'direct-links' | 'direct-file',
  ): Promise<ScraperSessionResult> {
    if (!this.webViewTrigger) {
      return Promise.reject(
        new Error(
          'WebView crawler trigger is not registered. Cannot scrape dynamic sites.',
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const request: ScraperSessionRequest = {
        id,
        url,
        targetType,
        maxRedirects: 25,
        maxClicks: 40,
        maxRuntime: 90000,
        maxIdleWait: 5000,
      };

      this.log(
        `Initiating dynamic multi-stage scrape session for: ${url}`,
        'info',
      );

      this.webViewTrigger!(request, (result, error) => {
        if (error) {
          try {
            const parsed = JSON.parse(error);
            if (
              parsed &&
              (parsed.type === 'PORTAL_ACCESS_DENIED' ||
                parsed.type === 'WEBVIEW_HTTP_ERROR')
            ) {
              reject(
                new ScraperError(
                  parsed.type,
                  parsed.message || 'WebView session failed',
                  parsed.retryable,
                  parsed.statusCode,
                  parsed.url,
                ),
              );
              return;
            }
          } catch (e) {
            // Not a JSON string
          }
          if (
            typeof error === 'object' &&
            error !== null &&
            (error as any).type
          ) {
            reject(error);
          } else {
            this.log(`Scraper session failed: ${error}`, 'error');
            reject(new Error(error));
          }
        } else if (result) {
          this.log(
            `Scraper session succeeded in ${result.duration}ms. Hops: ${result.redirectCount}, Clicks: ${result.clickCount}`,
            'success',
          );
          resolve(result);
        } else {
          reject(new Error('Session terminated with empty result'));
        }
      });
    });
  }

  /**
   * Automatic Stack Detector
   */
  public async detectStack(
    url: string,
  ): Promise<{stack: string; isStatic: boolean}> {
    this.log(`Detecting technology stack for: ${url}...`, 'info');
    try {
      const response = await axios.get(url, {
        headers: {'User-Agent': USER_AGENTS[0]},
        timeout: 8000,
      });

      const html = response.data || '';
      const headers = response.headers;

      // Check WordPress
      const isWordpress =
        html.includes('/wp-content/') ||
        html.includes('/wp-includes/') ||
        headers['x-powered-by']?.includes('WordPress') ||
        /<meta[^>]+name="generator"[^>]+content="WordPress/i.test(html);

      if (isWordpress) {
        this.log(
          'Detected tech: WordPress (Static / Server-Rendered HTML)',
          'success',
        );
        return {stack: 'WordPress', isStatic: true};
      }

      // Check Next.js
      if (html.includes('__NEXT_DATA__') || html.includes('/_next/')) {
        this.log(
          'Detected tech: Next.js (Server-Rendered & Rehydrated)',
          'success',
        );
        return {stack: 'Next.js', isStatic: true};
      }

      // Check Nuxt / Vue
      if (html.includes('__NUXT__') || html.includes('data-v-')) {
        this.log('Detected tech: Nuxt / Vue (Static/Hydrated)', 'success');
        return {stack: 'Nuxt/Vue', isStatic: true};
      }

      // Check for common Single Page App indicators (React/Angular) with thin body shells
      const hasAppRoot =
        html.includes('<app-root') ||
        html.includes('id="root"') ||
        html.includes('id="app"');
      const isThinShell =
        html.length < 5000 &&
        (html.includes('bundle.js') || html.includes('/static/js/'));

      if (hasAppRoot && isThinShell) {
        this.log(
          'Detected tech: Single Page Application (React/Angular client-rendered)',
          'warn',
        );
        return {stack: 'React/Angular SPA', isStatic: false};
      }

      // Fallback default
      this.log('Detected tech: Standard Static HTML', 'info');
      return {stack: 'Static HTML', isStatic: true};
    } catch (err: any) {
      this.log(
        `Network check failed during tech detection: ${err.message}. Defaulting to dynamic client.`,
        'warn',
      );
      return {stack: 'Unknown / Blocked (Using WebView)', isStatic: false};
    }
  }

  /**
   * Helper to perform HTTP fetches with custom retry logic and exponential backoff
   */
  private async fetchHtmlWithRetry(
    url: string,
    retries = 3,
    delay = 2000,
  ): Promise<string> {
    const userAgent =
      USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.log(
          `Fetching HTML (Attempt ${attempt}/${retries}) for: ${url.substring(
            0,
            50,
          )}...`,
          'info',
        );
        const response = await axios.get(url, {
          headers: {
            'User-Agent': userAgent,
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://www.google.com/',
          },
          timeout: 10000,
        });
        return response.data;
      } catch (err: any) {
        const statusCode = err.response?.status;
        if (statusCode === 401 || statusCode === 403) {
          this.log(
            `Portal rejected automated request: HTTP ${statusCode}`,
            'warn',
          );
          throw new ScraperError(
            'PORTAL_ACCESS_DENIED',
            'Portal rejected automated request',
            false,
            statusCode,
            url,
          );
        }

        this.log(`Attempt ${attempt} failed: ${err.message}`, 'warn');

        if (attempt === retries) {
          throw err;
        }
        const backoff = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    throw new Error('Fetch failed after retries');
  }

  /**
   * Dynamic Web Grabber utilizing hidden React Native WebView
   */
  private async fetchHtmlViaWebView(url: string): Promise<string> {
    const result = await this.runWebViewScrapeSession(url, 'mirrors');
    return result.html;
  }

  /**
   * Helper to check if a URL is already a direct file download link
   */
  public isDirectFileUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    const lowerUrl = url.toLowerCase();

    // 1. Check known storage hosts which always serve direct downloads
    if (
      lowerUrl.includes('cloudflarestorage.com') ||
      lowerUrl.includes('backblazeb2.com') ||
      lowerUrl.includes('storage.googleapis.com') ||
      lowerUrl.includes('s3.amazonaws.com') ||
      lowerUrl.includes('pixeldrain.com/api/file/')
    ) {
      return true;
    }

    // 2. Check if the URL contains filename parameters in query strings suggesting attachment
    if (
      /filename.*?=.*?\.(mkv|mp4|avi|zip|rar|tar|gz|mov|wmv|3gp|7z|dmg|iso|mp3|m4a|epub|pdf)/i.test(
        url,
      ) ||
      /content-disposition.*?filename/i.test(url) ||
      (lowerUrl.includes('filename') &&
        (lowerUrl.includes('.zip') ||
          lowerUrl.includes('.mkv') ||
          lowerUrl.includes('.mp4')))
    ) {
      return true;
    }

    // 3. Check regular extensions at the end of path or before query parameters
    const fileExtensionRegex =
      /\.(mkv|mp4|avi|zip|rar|tar|gz|mov|wmv|3gp|7z|dmg|iso|mp3|m4a|epub|pdf)(\?|#|$)/i;
    if (fileExtensionRegex.test(url)) {
      return true;
    }

    // 4. Check specific query params or path segments commonly indicating direct download endpoints
    if (
      (lowerUrl.includes('token=') && lowerUrl.includes('.zip')) ||
      lowerUrl.includes('/download.php') ||
      lowerUrl.includes('drive.google.com/uc')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Scrapes catalog/listings
   */
  public async scrapeCatalogPage(
    url: string,
    forceDynamic = false,
  ): Promise<{items: CatalogItem[]; nextPageUrl: string | null}> {
    let html = '';

    if (forceDynamic) {
      html = await this.fetchHtmlViaWebView(url);
    } else {
      const detect = await this.detectStack(url);
      if (detect.isStatic) {
        html = await this.fetchHtmlWithRetry(url);
      } else {
        this.log(
          'Tech stack suggests dynamic loading. Launching WebView engine...',
          'warn',
        );
        html = await this.fetchHtmlViaWebView(url);
      }
    }

    this.log('Parsing catalog elements...', 'info');
    const result = parseCatalog(html, url);
    this.log(
      `Extracted ${result.items.length} items from listing page.`,
      'success',
    );
    return result;
  }

  /**
   * Scrapes individual detail page
   */
  public async scrapeMovieDetail(
    url: string,
    forceDynamic = false,
  ): Promise<MovieDetail> {
    let html = '';

    if (forceDynamic) {
      html = await this.fetchHtmlViaWebView(url);
    } else {
      const detect = await this.detectStack(url);
      if (detect.isStatic) {
        html = await this.fetchHtmlWithRetry(url);
      } else {
        this.log(
          'Tech stack suggests dynamic details. Launching WebView engine...',
          'warn',
        );
        html = await this.fetchHtmlViaWebView(url);
      }
    }

    this.log('Parsing movie detail content...', 'info');
    const movie = parseMovieDetail(html, url);
    this.log(`Movie detail parse complete: "${movie.title}"`, 'success');
    return movie;
  }

  /**
   * Scrapes download page mirrors
   */
  public async scrapeDownloadPage(
    url: string,
    forceDynamic = false,
  ): Promise<{label: string; url: string}[]> {
    if (this.isDirectFileUrl(url)) {
      this.log(
        `Instant Resolution: URL is already a direct file link: ${url.substring(
          0,
          45,
        )}...`,
        'success',
      );
      return [{label: 'Direct Download', url}];
    }

    let html = '';
    let finalUrl = url;
    let fallbackMirrors: {label: string; url: string}[] = [];

    if (forceDynamic) {
      try {
        const session = await this.runWebViewScrapeSession(url, 'mirrors');
        html = session.html;
        finalUrl = session.finalUrl;
        if (session.mirrors && session.mirrors.length > 0) {
          fallbackMirrors = session.mirrors;
        }
      } catch (webViewErr: any) {
        if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              webViewErr.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            webViewErr.statusCode,
            url,
          );
        }
        throw webViewErr;
      }
    } else {
      // First attempt with static axios client (fast)
      try {
        html = await this.fetchHtmlWithRetry(url, 2, 1000);
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log('Axios portal access unavailable', 'warn');
          this.log('Starting dynamic WebView fallback', 'info');
        } else {
          this.log(
            `Axios portal load failed, falling back to WebView: ${err.message}`,
            'warn',
          );
        }

        try {
          const session = await this.runWebViewScrapeSession(url, 'mirrors');
          html = session.html;
          finalUrl = session.finalUrl;
          if (session.mirrors && session.mirrors.length > 0) {
            fallbackMirrors = session.mirrors;
          }
        } catch (webViewErr: any) {
          if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
            this.log(
              `[Scraper] Portal rejected automated request: HTTP ${
                webViewErr.statusCode || 403
              }`,
              'error',
            );
            this.log('[Scraper] Automated portal access unavailable', 'warn');
            this.log('[Scraper] Interactive browser flow required', 'info');
            this.log(
              '[Scraper] Closing WebView scraper session cleanly',
              'info',
            );
            throw new ScraperError(
              'EXTERNAL_BROWSER_REQUIRED',
              'This download page requires interactive browser access',
              false,
              webViewErr.statusCode,
              url,
            );
          }
          throw webViewErr;
        }
      }
    }

    this.log('Parsing download mirrors...', 'info');
    let mirrors = parseDownloadPage(html, finalUrl);
    if (mirrors.length === 0 && fallbackMirrors.length > 0) {
      mirrors = fallbackMirrors;
    }

    // If static parsed zero links, retry dynamic WebView just in case JavaScript rendering is required
    if (mirrors.length === 0 && !forceDynamic) {
      this.log(
        'No mirror links found on static HTML. Retrying with full browser WebView engine...',
        'warn',
      );
      try {
        const session = await this.runWebViewScrapeSession(url, 'mirrors');
        html = session.html;
        finalUrl = session.finalUrl;
        mirrors = parseDownloadPage(html, finalUrl);
        if (
          mirrors.length === 0 &&
          session.mirrors &&
          session.mirrors.length > 0
        ) {
          mirrors = session.mirrors;
        }
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              err.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            err.statusCode,
            url,
          );
        }
        this.log(`WebView fallback failed: ${err.message}`, 'error');
      }
    }

    this.log(`Extracted ${mirrors.length} mirrors from portal.`, 'success');
    return mirrors;
  }

  /**
   * Scrapes third-level file landing pages for direct download links
   */
  public async scrapeDirectDownloadPage(
    url: string,
    forceDynamic = false,
  ): Promise<{label: string; url: string}[]> {
    if (this.isDirectFileUrl(url)) {
      this.log(
        `Instant Resolution: URL is already a direct file link: ${url.substring(
          0,
          45,
        )}...`,
        'success',
      );
      return [{label: 'Direct Download', url}];
    }

    let html = '';
    let finalUrl = url;
    let fallbackLinks: {label: string; url: string}[] = [];

    if (forceDynamic) {
      try {
        const session = await this.runWebViewScrapeSession(url, 'direct-links');
        html = session.html;
        finalUrl = session.finalUrl;
        if (session.mirrors && session.mirrors.length > 0) {
          fallbackLinks = session.mirrors;
        }
      } catch (webViewErr: any) {
        if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              webViewErr.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            webViewErr.statusCode,
            url,
          );
        }
        throw webViewErr;
      }
    } else {
      try {
        html = await this.fetchHtmlWithRetry(url, 2, 1000);
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log('Axios portal access unavailable', 'warn');
          this.log('Starting dynamic WebView fallback', 'info');
        } else {
          this.log(
            `Axios direct file fetch failed, trying WebView: ${err.message}`,
            'warn',
          );
        }
        try {
          const session = await this.runWebViewScrapeSession(
            url,
            'direct-links',
          );
          html = session.html;
          finalUrl = session.finalUrl;
          if (session.mirrors && session.mirrors.length > 0) {
            fallbackLinks = session.mirrors;
          }
        } catch (webViewErr: any) {
          if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
            this.log(
              `[Scraper] Portal rejected automated request: HTTP ${
                webViewErr.statusCode || 403
              }`,
              'error',
            );
            this.log('[Scraper] Automated portal access unavailable', 'warn');
            this.log('[Scraper] Interactive browser flow required', 'info');
            this.log(
              '[Scraper] Closing WebView scraper session cleanly',
              'info',
            );
            throw new ScraperError(
              'EXTERNAL_BROWSER_REQUIRED',
              'This download page requires interactive browser access',
              false,
              webViewErr.statusCode,
              url,
            );
          }
          throw webViewErr;
        }
      }
    }

    this.log('Parsing final direct download endpoints...', 'info');
    let directLinks = parseDirectDownloadPage(html, finalUrl);
    if (directLinks.length === 0 && fallbackLinks.length > 0) {
      directLinks = fallbackLinks;
    }

    if (directLinks.length === 0 && !forceDynamic) {
      this.log(
        'No direct links found on static HTML. Retrying with full browser WebView engine...',
        'warn',
      );
      try {
        const session = await this.runWebViewScrapeSession(url, 'direct-links');
        html = session.html;
        finalUrl = session.finalUrl;
        directLinks = parseDirectDownloadPage(html, finalUrl);
        if (
          directLinks.length === 0 &&
          session.mirrors &&
          session.mirrors.length > 0
        ) {
          directLinks = session.mirrors;
        }
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              err.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            err.statusCode,
            url,
          );
        }
        this.log(
          `WebView fallback direct parse failed: ${err.message}`,
          'error',
        );
      }
    }

    this.log(`Extracted ${directLinks.length} direct links.`, 'success');
    return directLinks;
  }

  /**
   * Scrapes final file hosting pages for the direct video file link
   */
  public async scrapeDirectFileHost(
    url: string,
    forceDynamic = false,
  ): Promise<string | null> {
    if (this.isDirectFileUrl(url)) {
      this.log(
        `Instant Resolution: URL is already a direct file link: ${url.substring(
          0,
          45,
        )}...`,
        'success',
      );
      return url;
    }

    // Check if we can perform an instant local resolution (e.g. PixelDrain API rewrite)
    if (url.includes('pixeldrain.com') || url.includes('pixeldrain.dev')) {
      const match = url.match(
        /(?:pixeldrain\.com|pixeldrain\.dev)\/u\/([a-zA-Z0-9_-]+)/,
      );
      if (match) {
        return `https://pixeldrain.com/api/file/${match[1]}?download`;
      }
    }

    let html = '';
    let finalUrl = url;
    let fallbackDirect: string | null = null;

    if (forceDynamic) {
      try {
        const session = await this.runWebViewScrapeSession(url, 'direct-file');
        html = session.html;
        finalUrl = session.finalUrl;
        if (session.mirrors && session.mirrors.length > 0) {
          fallbackDirect = session.mirrors[0].url;
        }
      } catch (webViewErr: any) {
        if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              webViewErr.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            webViewErr.statusCode,
            url,
          );
        }
        throw webViewErr;
      }
    } else {
      try {
        html = await this.fetchHtmlWithRetry(url, 2, 1000);
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log('Axios portal access unavailable', 'warn');
          this.log('Starting dynamic WebView fallback', 'info');
        } else {
          this.log(
            `Axios file host fetch failed, trying WebView: ${err.message}`,
            'warn',
          );
        }
        try {
          const session = await this.runWebViewScrapeSession(
            url,
            'direct-file',
          );
          html = session.html;
          finalUrl = session.finalUrl;
          if (session.mirrors && session.mirrors.length > 0) {
            fallbackDirect = session.mirrors[0].url;
          }
        } catch (webViewErr: any) {
          if (webViewErr && webViewErr.type === 'PORTAL_ACCESS_DENIED') {
            this.log(
              `[Scraper] Portal rejected automated request: HTTP ${
                webViewErr.statusCode || 403
              }`,
              'error',
            );
            this.log('[Scraper] Automated portal access unavailable', 'warn');
            this.log('[Scraper] Interactive browser flow required', 'info');
            this.log(
              '[Scraper] Closing WebView scraper session cleanly',
              'info',
            );
            throw new ScraperError(
              'EXTERNAL_BROWSER_REQUIRED',
              'This download page requires interactive browser access',
              false,
              webViewErr.statusCode,
              url,
            );
          }
          throw webViewErr;
        }
      }
    }

    this.log('Parsing direct link from file host...', 'info');
    let directLink = parseDirectFileHost(html, finalUrl) || fallbackDirect;

    if (!directLink && !forceDynamic) {
      this.log(
        'No direct links parsed on host static HTML. Retrying with WebView engine...',
        'warn',
      );
      try {
        const session = await this.runWebViewScrapeSession(url, 'direct-file');
        html = session.html;
        finalUrl = session.finalUrl;
        directLink = parseDirectFileHost(html, finalUrl);
        if (!directLink && session.mirrors && session.mirrors.length > 0) {
          directLink = session.mirrors[0].url;
        }
      } catch (err: any) {
        if (err && err.type === 'PORTAL_ACCESS_DENIED') {
          this.log(
            `[Scraper] Portal rejected automated request: HTTP ${
              err.statusCode || 403
            }`,
            'error',
          );
          this.log('[Scraper] Automated portal access unavailable', 'warn');
          this.log('[Scraper] Interactive browser flow required', 'info');
          this.log('[Scraper] Closing WebView scraper session cleanly', 'info');
          throw new ScraperError(
            'EXTERNAL_BROWSER_REQUIRED',
            'This download page requires interactive browser access',
            false,
            err.statusCode,
            url,
          );
        }
        this.log(`WebView host fallback failed: ${err.message}`, 'error');
      }
    }

    if (directLink) {
      this.log(`Direct link resolved: ${directLink}`, 'success');
    } else {
      this.log('Could not extract direct link from file host page.', 'warn');
    }

    return directLink;
  }

  /**
   * Performs a live query to the Typesense movie search engine
   */
  public async searchMovies(query: string, page = 1): Promise<CatalogItem[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const today = new Date().toISOString().split('T')[0];
    const proxyUrl = 'https://search.pingora.fyi/collections/post/documents/search';

    let activeDomain = 'https://new3.hdhub4u.cl';
    try {
      const cached = await AsyncStorage.getItem('@hdhub4u_discovered_url');
      if (cached) {
        activeDomain = cached;
      }
    } catch (e) {
      // ignore
    }

    // Clean up active domain to get Origin and Referer
    const origin = activeDomain.replace(/\/$/, '');
    const referer = `${origin}/`;

    this.log(`Searching movies for: "${query}" (page ${page}) using domain: ${origin}...`, 'info');

    try {
      const response = await axios.get(proxyUrl, {
        params: {
          q: query,
          query_by: 'post_title,category,stars,director,imdb_id',
          query_by_weights: '4,2,2,2,4',
          sort_by: 'sort_by_date:desc',
          limit: 15,
          highlight_fields: 'none',
          use_cache: 'true',
          page: page,
          analytics_tag: today,
        },
        headers: {
          'Host': 'search.pingora.fyi',
          'Origin': origin,
          'Referer': referer,
          'User-Agent': USER_AGENTS[0],
          'Accept': '*/*',
        },
        timeout: 8000,
      });

      if (response.status === 200 && response.data) {
        const hits = response.data.hits || [];
        const items: CatalogItem[] = hits
          .map((hit: any) => {
            const doc = hit.document || {};
            const thumb =
              doc.post_thumbnail ||
              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/315px-No-Image-Placeholder.svg.png?20200912122019';
            return {
              title: doc.post_title || 'Unknown Title',
              url: doc.permalink || '',
              imageUrl: thumb,
            };
          })
          .filter((item: CatalogItem) => !!item.url);

        this.log(`Search returned ${items.length} items.`, 'success');
        return items;
      }
      return [];
    } catch (err: any) {
      this.log(`Search request failed: ${err.message}`, 'error');
      throw err;
    }
  }
}
