import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';
import {parseDownloadPage} from '../../detail.parser';

export class InventoryIdeaStrategy implements BaseStrategy {
  public readonly name = 'InventoryIdea';

  public supports(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('inventoryidea.com') ||
      lower.includes('inventoryidea') ||
      lower.includes('gadgetsweb') ||
      lower.includes('homelane') ||
      lower.includes('mediator')
    );
  }

  public classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null {
    const lowerBody = bodyText.toLowerCase();

    // Check if target mirrors are present on current page
    const mirrors = parseDownloadPage(html, session.currentUrl);
    if (mirrors.length > 0) {
      return {
        type: 'DOWNLOAD_SELECTION',
        confidence: 0.95,
        details: `Discovered ${mirrors.length} target mirrors on mediator page`,
      };
    }

    // InventoryIdea is a multi-step mediator page with countdowns
    if (
      lowerBody.includes('inventoryidea.com') ||
      lowerBody.includes('mediator page') ||
      lowerBody.includes('click on continue') ||
      lowerBody.includes('click to continue') ||
      lowerBody.includes('gadgetsweb') ||
      lowerBody.includes('homelane')
    ) {
      const timerMatch =
        bodyText.match(/\b(\d+)\s*(?:s|sec|second|seconds)\b/i) ||
        bodyText.match(/wait\s*(\d+)/i) ||
        bodyText.match(/timer:\s*(\d+)/i);

      const seconds = timerMatch ? parseInt(timerMatch[1], 10) : null;
      if (seconds !== null && seconds > 0) {
        return {
          type: 'MEDIATOR_WAITING_TIMER',
          confidence: 0.95,
          details: `InventoryIdea countdown timer: ${seconds}s remaining`,
        };
      }

      if (/please wait|generating|timer/i.test(bodyText) && !/get links|click to continue/i.test(bodyText)) {
        return {
          type: 'MEDIATOR_WAITING_TIMER',
          confidence: 0.95,
          details: 'InventoryIdea countdown timer running',
        };
      }

      return {
        type: 'MEDIATOR_READY',
        confidence: 0.9,
        details: 'InventoryIdea mediator button ready to click',
      };
    }

    return null;
  }

  public findPrimaryAction(
    session: BrowserSession,
    candidates: any[],
  ): ScraperCommand | null {
    // InventoryIdea buttons: "CLICK TO CONTINUE", "GET LINKS", "Click To Continue", "Get Links"
    const priorities = [
      {regex: /click to continue/i, score: 100},
      {regex: /get links/i, score: 90},
      {regex: /continue/i, score: 80},
    ];

    const scoredCandidates = candidates.map(c => {
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

    if (best && best.finalScore > 30) {
      return {
        id: Math.random().toString(36).substring(7),
        type: 'CLICK',
        selector: best.label,
        delayMs: 500,
      };
    }

    return null;
  }

  public extract(
    session: BrowserSession,
    html: string,
    finalUrl: string,
  ): {label: string; url: string}[] | null {
    const mirrors = parseDownloadPage(html, finalUrl);
    return mirrors.length > 0 ? mirrors : null;
  }
}

