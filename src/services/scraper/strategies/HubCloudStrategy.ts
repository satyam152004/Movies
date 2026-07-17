import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';

export class HubCloudStrategy implements BaseStrategy {
  public readonly name = 'HubCloud';

  public supports(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('hubcloud') ||
      lower.includes('hubcdn') ||
      lower.includes('hubdrive')
    );
  }

  public classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null {
    const lowerTitle = title.toLowerCase();
    const lowerBody = bodyText.toLowerCase();

    // Check if we are on a mirror/download links page
    const hasDownloadLinks =
      html.includes('/download.php') ||
      html.includes('pixeldrain') ||
      html.includes('mega.nz') ||
      html.includes('cloudflarestorage.com') ||
      html.includes('drive.google.com');

    if (
      lowerTitle.includes('hubcloud') ||
      lowerTitle.includes('download') ||
      lowerBody.includes('hubcloud')
    ) {
      if (hasDownloadLinks) {
        return {
          type: 'DOWNLOAD_SELECTION',
          confidence: 0.9,
          details: 'HubCloud mirror page detected with links',
        };
      }
      return {
        type: 'MEDIATOR_READY',
        confidence: 0.9,
        details: 'HubCloud mediator redirect page',
      };
    }

    return null;
  }

  public findPrimaryAction(
    session: BrowserSession,
    candidates: any[],
  ): ScraperCommand | null {
    // If we've got click candidates, sort them by priority.
    // HubCloud usually has a 'download' or 'proceed' button.
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    if (best && best.score >= 50) {
      return {
        id: Math.random().toString(36).substring(7),
        type: 'CLICK',
        selector: best.label,
        delayMs: 1000,
      };
    }
    return null;
  }

  public extract(
    session: BrowserSession,
    html: string,
    finalUrl: string,
  ): {label: string; url: string}[] | null {
    // Standard extraction can be performed by a fallback Direct/Mirror extractor,
    // but strategy can supply details if needed. Let's return null to let the main engine use the generic DOM crawler,
    // or return extracted ones.
    return null;
  }
}
