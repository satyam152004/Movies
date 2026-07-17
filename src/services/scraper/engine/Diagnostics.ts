import {BrowserSession} from './BrowserSession';

export class Diagnostics {
  public static generateStructuredReport(
    session: BrowserSession,
    reason: string,
  ): any {
    const data = session.data;
    const clickCount = data.clickHistory.length;
    const lastClick = clickCount > 0 ? data.clickHistory[clickCount - 1] : null;

    const report = {
      sessionId: data.sessionId,
      provider: data.activeStrategyName,
      state: data.currentState,
      url: data.currentUrl,
      clicks: clickCount,
      retry: data.retryCount,
      fingerprint: data.pageFingerprint,
      network: data.networkStatus,
      lastButton: lastClick
        ? {
            text: lastClick.text,
            selector: lastClick.selector,
            timestamp: lastClick.timestamp,
            stateBeforeClick: lastClick.stateBeforeClick,
          }
        : null,
      navigationCount: data.navigationCount,
      duration: Date.now() - data.startTime,
      reason: reason,
      warnings: data.diagnostics.warnings,
      visitedUrls: data.diagnostics.visitedUrls,
      stateTransitions: data.diagnostics.stateTransitions,
      structuredDiagnostics: data.diagnostics.structuredDiagnostics,
    };

    return report;
  }
}
