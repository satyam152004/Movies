import {BrowserSession} from '../models/Session';
import {ScraperCommand} from '../models/Commands';
import {ScraperState} from '../models/States';

export interface BaseStrategy {
  name: string;
  supports(url: string): boolean;
  classify(
    session: BrowserSession,
    bodyText: string,
    title: string,
    html: string,
  ): {type: ScraperState; confidence: number; details?: string} | null;
  findPrimaryAction(
    session: BrowserSession,
    candidates: any[],
  ): ScraperCommand | null;
  extract(
    session: BrowserSession,
    html: string,
    finalUrl: string,
  ): {label: string; url: string}[] | null;
}
