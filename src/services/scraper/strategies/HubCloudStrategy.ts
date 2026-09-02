import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';
import {parseDownloadPage, parseDirectDownloadPage} from '../../detail.parser';

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
    const priorities = [
      {regex: /download|direct|proceed/i, score: 100},
      {regex: /generate/i, score: 90},
      {regex: /server|mirror/i, score: 80},
    ];

    const scoredCandidates = candidates
      .filter(c => !/please wait|generating|wait\s*\d+/i.test(c.text))
      .map(c => {
        let score = c.score || 0;
        for (const p of priorities) {
          if (p.regex.test(c.text)) {
            score += p.score;
          }
        }
        return {...c, finalScore: score};
      });

    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
    const best = scoredCandidates[0];

    if (best && best.finalScore >= 40) {
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
    let mirrors = parseDownloadPage(html, finalUrl);
    if (!mirrors || mirrors.length === 0) {
      mirrors = parseDirectDownloadPage(html, finalUrl);
    }
    return mirrors && mirrors.length > 0 ? mirrors : null;
  }
}

