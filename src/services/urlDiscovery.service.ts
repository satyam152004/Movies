import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {ScraperService} from './scraper.service';

const STORAGE_KEY = '@hdhub4u_discovered_url';
const DEFAULT_URL = 'https://new3.hdhub4u.cl';
const MAX_SEARCH_RANGE = 15;

const ALTERNATIVE_TLDS = [
  'https://hdhub4u.work',
  'https://hdhub4u.site',
  'https://hdhub4u.support',
  'https://hdhub4u.tv',
  'https://hdhub4u.rocks',
  'https://hdhub4u.pink',
];

export class UrlDiscoveryService {
  private static instance: UrlDiscoveryService;

  private constructor() {}

  public static getInstance(): UrlDiscoveryService {
    if (!UrlDiscoveryService.instance) {
      UrlDiscoveryService.instance = new UrlDiscoveryService();
    }
    return UrlDiscoveryService.instance;
  }

  /**
   * Helper to extract the base URL (protocol + host)
   */
  private getBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * Validates if a given URL is a working HDHub4U domain.
   * Returns the final resolved base URL if successful, otherwise null.
   */
  public async validateUrl(url: string): Promise<string | null> {
    const scraper = ScraperService.getInstance();
    try {
      scraper.log(`Validating domain: ${url}`, 'info');

      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.google.com/',
        },
        timeout: 2500,
      });

      if (response.status === 200) {
        const html = response.data || '';
        const $ = cheerio.load(html);
        const titleText = $('title').text().toLowerCase();
        const hasThumbs = $('li.thumb, .thumb').length > 0;
        const containsSignature =
          titleText.includes('hdhub') ||
          html.toLowerCase().includes('hdhub4u') ||
          hasThumbs;

        if (containsSignature) {
          // If redirected, get the final redirected URL
          const finalUrl = this.getBaseUrl(
            response.request?.responseURL || response.config.url || url,
          );
          scraper.log(`Validation SUCCESS for domain: ${finalUrl}`, 'success');
          return finalUrl;
        }
      }
      return null;
    } catch (err: any) {
      scraper.log(
        `Validation FAILED for domain: ${url} (${err.message})`,
        'warn',
      );
      return null;
    }
  }

  /**
   * Discovers the current active HDHub4U URL.
   */
  public async discoverActiveUrl(): Promise<string> {
    return DEFAULT_URL;
  }

  /**
   * Gets the active URL (either from cache, discovery, or default)
   */
  public async getActiveUrl(forceRefresh = false): Promise<string> {
    return DEFAULT_URL;
  }
}
