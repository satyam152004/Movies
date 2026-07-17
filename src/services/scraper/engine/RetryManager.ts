import {BrowserSession} from './BrowserSession';

export class RetryManager {
  private readonly maxRetriesPerState = 3;

  public shouldRetry(session: BrowserSession, errorReason: string): boolean {
    const data = session.data;

    // Non-retryable errors
    if (
      errorReason.includes('PORTAL_ACCESS_DENIED') ||
      errorReason.includes('EXTERNAL_BROWSER_REQUIRED')
    ) {
      return false;
    }

    // Check total runtime limit
    const elapsed = Date.now() - data.startTime;
    if (elapsed > data.maxRuntime) {
      session.addWarning(
        `RetryManager: Terminating retries due to total runtime limit exceeded (${elapsed}ms)`,
      );
      return false;
    }

    // Check total clicks limit
    if (data.clickHistory.length > data.maxClicks) {
      session.addWarning(
        `RetryManager: Click count limit reached (${data.clickHistory.length})`,
      );
      return false;
    }

    // Check same state repeat counts in transition history
    const history = data.diagnostics.stateTransitions;
    const lastState = data.currentState;
    let repeatCount = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] === lastState) {
        repeatCount++;
      } else {
        break;
      }
    }

    if (repeatCount > this.maxRetriesPerState) {
      session.addWarning(
        `RetryManager: State "${lastState}" repeated ${repeatCount} times. Aborting retry loop.`,
      );
      return false;
    }

    return true;
  }
}
