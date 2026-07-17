import {
  BrowserSession as IBrowserSession,
  ClickRecord,
} from '../models/Session';
import {ScraperState} from '../models/States';

export class BrowserSession {
  private session: IBrowserSession;

  constructor(
    sessionId: string,
    url: string,
    targetType: 'mirrors' | 'direct-links' | 'direct-file',
    maxRedirects = 25,
    maxClicks = 40,
    maxRuntime = 90000,
    maxIdleWait = 5000,
  ) {
    this.session = {
      sessionId,
      currentUrl: url,
      previousUrl: '',
      pageFingerprint: '',
      currentState: 'INIT',
      networkStatus: 'idle',
      pendingRequests: 0,
      clickHistory: [],
      activeStrategyName: 'DirectDownload',
      retryCount: 0,
      navigationCount: 0,
      visitedFingerprints: [],
      visitedUrls: [url],
      diagnostics: {
        visitedUrls: [url],
        detectedStrategies: ['DirectDownload'],
        stateTransitions: ['INIT'],
        warnings: [],
        structuredDiagnostics: [],
      },
      startTime: Date.now(),
      targetType,
      maxRedirects,
      maxClicks,
      maxRuntime,
      maxIdleWait,
    };
  }

  public get data(): IBrowserSession {
    return this.session;
  }

  public updateState(state: ScraperState): void {
    if (this.session.currentState !== state) {
      this.session.currentState = state;
      this.session.diagnostics.stateTransitions.push(state);
    }
  }

  public updateUrl(url: string): void {
    if (this.session.currentUrl !== url) {
      this.session.previousUrl = this.session.currentUrl;
      this.session.currentUrl = url;
      this.session.navigationCount += 1;
      if (!this.session.visitedUrls.includes(url)) {
        this.session.visitedUrls.push(url);
        this.session.diagnostics.visitedUrls.push(url);
      }
    }
  }

  public addClickRecord(record: Omit<ClickRecord, 'clickCount'>): void {
    const nextCount = this.session.clickHistory.length + 1;
    const fullRecord: ClickRecord = {
      ...record,
      clickCount: nextCount,
    };
    this.session.clickHistory.push(fullRecord);
  }

  public setFingerprint(fingerprint: string): void {
    this.session.pageFingerprint = fingerprint;
    if (
      fingerprint &&
      !this.session.visitedFingerprints.includes(fingerprint)
    ) {
      this.session.visitedFingerprints.push(fingerprint);
    }
  }

  public setStrategy(name: string): void {
    this.session.activeStrategyName = name;
    if (!this.session.diagnostics.detectedStrategies.includes(name)) {
      this.session.diagnostics.detectedStrategies.push(name);
    }
  }

  public addWarning(warning: string): void {
    this.session.diagnostics.warnings.push(warning);
  }

  public addStructuredDiagnostic(detail: any): void {
    this.session.diagnostics.structuredDiagnostics.push({
      timestamp: Date.now() - this.session.startTime,
      url: this.session.currentUrl,
      fingerprint: this.session.pageFingerprint,
      state: this.session.currentState,
      strategy: this.session.activeStrategyName,
      ...detail,
    });
  }

  public incrementRetry(): void {
    this.session.retryCount += 1;
  }
}
