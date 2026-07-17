import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';

export class PixelDrainStrategy implements BaseStrategy {
  public readonly name = 'PixelDrain';

  public supports(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('pixeldrain.com') || lower.includes('pixeldrain.dev');
  }

  public classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null {
    if (session.currentUrl.toLowerCase().includes('/u/')) {
      return {
        type: 'DOWNLOAD_READY',
        confidence: 0.95,
        details: 'PixelDrain user file landing page',
      };
    }
    return null;
  }

  public findPrimaryAction(
    session: BrowserSession,
    candidates: any[],
  ): ScraperCommand | null {
    return null;
  }

  public extract(
    session: BrowserSession,
    html: string,
    finalUrl: string,
  ): {label: string; url: string}[] | null {
    const match = finalUrl.match(
      /(?:pixeldrain\.com|pixeldrain\.dev)\/u\/([a-zA-Z0-9_-]+)/,
    );
    if (match) {
      const directUrl = `https://pixeldrain.com/api/file/${match[1]}?download`;
      return [{label: 'Direct Download', url: directUrl}];
    }
    return null;
  }
}
