import {BaseStrategy} from './BaseStrategy';
import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';

export class DirectDownloadStrategy implements BaseStrategy {
  public readonly name = 'DirectDownload';

  public supports(url: string): boolean {
    return true; // Catch-all fallback strategy
  }

  public classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null {
    const titleLower = title.toLowerCase();
    const bodyTextLower = bodyText.toLowerCase();

    // 1. Cloudflare Check
    if (
      titleLower.includes('cloudflare') ||
      titleLower.includes('just a moment') ||
      html.includes('cf-challenge') ||
      html.includes('challenge-form')
    ) {
      return {
        type: 'PAGE_LOADING',
        confidence: 0.95,
        details: 'Cloudflare security challenge active',
      };
    }

    // 2. Verification Check
    if (
      html.includes('g-recaptcha') ||
      html.includes('h-captcha') ||
      html.includes('cf-turnstile') ||
      /verify you are human|i am human|confirm you are human/i.test(
        bodyTextLower,
      )
    ) {
      return {
        type: 'MEDIATOR_READY',
        confidence: 0.85,
        details: 'Verification captcha page detected',
      };
    }

    // 3. Countdown check
    const hasWaitKeywords = /wait\s*\d+|please wait|seconds|sec|timer/i.test(
      bodyTextLower,
    );
    if (
      hasWaitKeywords &&
      /\b\d+\s*(?:s|sec|second|seconds)\b/i.test(bodyTextLower)
    ) {
      return {
        type: 'MEDIATOR_WAITING_TIMER',
        confidence: 0.85,
        details: 'Countdown timer found in text',
      };
    }

    // 4. Server/Direct file check
    const isDirectUrl = this.isDirectFileUrl(session.currentUrl);
    if (session.targetType === 'direct-file' && isDirectUrl) {
      return {
        type: 'DOWNLOAD_READY',
        confidence: 0.95,
        details: 'Final direct download URL reached',
      };
    }

    return {
      type: 'MEDIATOR_READY',
      confidence: 0.5,
      details: 'Generic mediator fallback',
    };
  }

  public findPrimaryAction(
    session: BrowserSession,
    candidates: any[],
  ): ScraperCommand | null {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    if (best && best.score >= 20) {
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
    return null; // fallback to generic DOM link extraction in engine
  }

  private isDirectFileUrl(url: string): boolean {
    if (!url) {
      return false;
    }
    const lower = url.toLowerCase();
    return (
      lower.includes('cloudflarestorage.com') ||
      lower.includes('backblazeb2.com') ||
      lower.includes('storage.googleapis.com') ||
      lower.includes('s3.amazonaws.com') ||
      lower.includes('pixeldrain.com/api/file/') ||
      lower.includes('drive.google.com/uc') ||
      lower.includes('/download.php') ||
      /\.(mkv|mp4|avi|zip|rar|tar|gz|mov|wmv|7z|dmg|iso|mp3|m4a|epub|pdf)(\?|#|$)/i.test(
        lower,
      )
    );
  }
}
