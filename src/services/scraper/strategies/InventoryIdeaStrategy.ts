import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';

export class InventoryIdeaStrategy implements BaseStrategy {
  public readonly name = 'InventoryIdea';

  public supports(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('inventoryidea.com');
  }

  public classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null {
    const lowerBody = bodyText.toLowerCase();

    // InventoryIdea is a multi-step mediator page with countdowns
    if (
      lowerBody.includes('inventoryidea.com') ||
      lowerBody.includes('mediator page') ||
      lowerBody.includes('click on continue') ||
      lowerBody.includes('click to continue')
    ) {
      // Check countdown. Stricter timer detection that doesn't get confused by static headers
      const hasReadyButton = /click to continue|get links/i.test(bodyText);
      const isCountdown =
        /wait\s*\d+|\b\d+\s*(?:s|sec|second|seconds)\b|generating/i.test(
          bodyText,
        ) ||
        (/please wait|timer/i.test(bodyText) && !hasReadyButton);

      if (isCountdown) {
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
    return null;
  }
}
