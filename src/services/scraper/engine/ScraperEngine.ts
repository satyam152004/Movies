import {EventBus} from './EventBus';
import {CommandQueue} from './CommandQueue';
import {BrowserSession} from './BrowserSession';
import {ClickHistory} from './ClickHistory';
import {Diagnostics} from './Diagnostics';
import {RetryManager} from './RetryManager';
import {StrategyRegistry} from './StrategyRegistry';
import {StateMachine} from './StateMachine';
import {BrowserEvent, DownloadEvent} from '../models/Events';
import {ScraperCommand} from '../models/Commands';
import {ScraperSessionRequest, ScraperSessionResult} from '../../scraper.types';

import {getAgentCommandAPI} from '../browser/injected';

export class ScraperEngine {
  private eventBus: EventBus;
  private commandQueue: CommandQueue;
  private clickHistory: ClickHistory;
  private retryManager: RetryManager;
  private strategyRegistry: StrategyRegistry;
  private stateMachine: StateMachine;

  private session: BrowserSession | null = null;
  private injectJS: (script: string) => void;
  private onCompleted: (
    result: ScraperSessionResult | null,
    error?: any,
  ) => void;

  constructor(
    injectJS: (script: string) => void,
    onCompleted: (result: ScraperSessionResult | null, error?: any) => void,
  ) {
    this.injectJS = injectJS;
    this.onCompleted = onCompleted;

    this.eventBus = new EventBus();
    this.clickHistory = new ClickHistory();
    this.retryManager = new RetryManager();
    this.strategyRegistry = StrategyRegistry.getInstance();
    this.stateMachine = new StateMachine();

    this.commandQueue = new CommandQueue(async cmd =>
      this.executeCommandOnAgent(cmd),
    );

    this.setupEventHandlers();
  }

  public startSession(request: ScraperSessionRequest): void {
    this.session = new BrowserSession(
      request.id,
      request.url,
      request.targetType,
      request.maxRedirects || 25,
      request.maxClicks || 40,
      request.maxRuntime || 90000,
      request.maxIdleWait || 5000,
    );

    console.log(
      `[ScraperEngine] Started session ${request.id} for target: ${request.targetType}`,
    );
  }

  public handleBrowserMessage(messageStr: string): void {
    if (!this.session) {
      return;
    }

    try {
      const parsed = JSON.parse(messageStr);
      if (parsed && parsed.type) {
        const event: BrowserEvent = {
          url: this.session.data.currentUrl,
          timestamp: Date.now(),
          ...parsed,
        };
        this.eventBus.emit(event);
      }
    } catch (err: any) {
      console.error(
        '[ScraperEngine] Failed to parse browser event message:',
        err,
      );
    }
  }

  public stopSession(errorReason?: string): void {
    if (!this.session) {
      return;
    }

    const report = Diagnostics.generateStructuredReport(
      this.session,
      errorReason || 'Success',
    );

    if (errorReason) {
      console.error(`[ScraperEngine] Session failed: ${errorReason}`);
      console.log(
        '[ScraperEngine] Diagnostic Report:',
        JSON.stringify(report, null, 2),
      );
      this.onCompleted(null, errorReason);
    } else {
      console.log(
        `[ScraperEngine] Session completed successfully in ${report.duration}ms`,
      );
      const result: ScraperSessionResult = {
        html:
          this.session.data.diagnostics.structuredDiagnostics[0]?.html || '',
        finalUrl: this.session.data.currentUrl,
        pageType: 'SUCCESS',
        redirectCount: this.session.data.navigationCount,
        clickCount: this.session.data.clickHistory.length,
        mirrorCount:
          this.session.data.diagnostics.structuredDiagnostics.find(
            (d: any) => d.mirrors,
          )?.mirrors?.length || 0,
        duration: report.duration,
        history: this.session.data.diagnostics.stateTransitions,
        diagnostics: this.session.data.diagnostics,
        mirrors: this.session.data.diagnostics.structuredDiagnostics.find(
          (d: any) => d.mirrors,
        )?.mirrors,
      };
      this.onCompleted(result);
    }

    this.commandQueue.clear();
    this.eventBus.clear();
    this.session = null;
  }

  private setupEventHandlers(): void {
    // 1. Wildcard observer to trace state changes & log
    this.eventBus.subscribe('*', event => {
      if (!this.session) {
        return;
      }

      // Update URL if changed
      if (event.url && event.url !== this.session.data.currentUrl) {
        this.session.updateUrl(event.url);
      }

      // If payload contains fingerprint, update
      if ('fingerprint' in event && event.fingerprint) {
        this.session.setFingerprint(event.fingerprint);
      }

      // If payload is log, print
      if (event.type === 'LOG') {
        const logEvt = event as any;
        console.log(
          `[BrowserAgent] [${logEvt.logType || 'info'}] ${logEvt.message}`,
        );
      }
    });

    // 2. Handshake registration: inject command API and get initial fingerprint
    this.eventBus.subscribe('HANDSHAKE_REQUEST', event => {
      if (!this.session) {
        return;
      }
      this.session.updateUrl(event.url);

      // Resolve strategy
      const strategy = this.strategyRegistry.resolve(event.url);
      this.session.setStrategy(strategy.name);

      // Inject API scripts
      this.injectJS(getAgentCommandAPI());

      // Trigger state scan
      this.commandQueue.enqueue({
        id: 'init_scan',
        type: 'GET_FINGERPRINT',
      });
    });

    // 3. Process DOM/Mutation events to trigger classification and run actions
    this.eventBus.subscribe('DOM_CHANGED', event => {
      if (!this.session) {
        return;
      }

      const ev = event as any;
      const strategy = this.strategyRegistry.resolve(
        this.session.data.currentUrl,
      );
      const scraper =
        require('../../scraper.service').ScraperService.getInstance();

      scraper.log(
        `[ScraperEngine] DOM changed on URL: ${
          this.session.data.currentUrl
        } (Fingerprint: ${ev.fingerprint || 'none'})`,
      );

      if (ev.candidateLogs && ev.candidateLogs.length > 0) {
        scraper.log('[ScraperEngine] Candidate scan details:');
        ev.candidateLogs.forEach((l: any) => {
          scraper.log(
            `  - Element <${l.tagName}> text="${l.text}" accepted=${
              l.accepted
            } score=${l.score || 0} reason: ${l.reason}`,
          );
        });
      }

      if (!ev.candidates || ev.candidates.length === 0) {
        scraper.log(
          '[ScraperEngine] No actionable candidate elements discovered.',
        );
        if (ev.compactSnapshot) {
          scraper.log(
            `[ScraperEngine] Compact DOM Snapshot:\n${JSON.stringify(
              ev.compactSnapshot,
              null,
              2,
            )}`,
          );
        }
      } else {
        scraper.log(
          `[ScraperEngine] Discovered ${ev.candidates.length} actionable candidates.`,
        );
      }

      // Transition State Machine
      const nextState = this.stateMachine.transition(
        this.session,
        event,
        () => {
          const bodyText = ev.bodyText || '';
          const title = ev.title || '';
          const html = ev.html || '';

          // Strategy classification
          const classification = strategy.classify(
            this.session!.data,
            bodyText,
            title,
            html,
          );
          if (classification) {
            scraper.log(
              `[ScraperEngine] Strategy "${strategy.name}" classified page as ${classification.type} (confidence: ${classification.confidence})`,
            );
            return classification;
          }

          // Generic classification
          const hasAction = (ev.candidates || []).some(
            (c: any) => c.score >= 20,
          );
          if (hasAction) {
            return {
              type: 'MEDIATOR_READY',
              confidence: 0.7,
              details: 'Action candidates discovered in DOM',
            };
          }

          return {
            type: 'MEDIATOR_IDLE',
            confidence: 0.5,
            details: 'No actionable elements found',
          };
        },
      );

      scraper.log(`[ScraperEngine] State transition: -> ${nextState}`);
      this.processDecision(nextState, ev);
    });

    // 4. Handle success event
    this.eventBus.subscribe('SUCCESS', event => {
      this.stopSession();
    });

    // 5. Handle errors
    this.eventBus.subscribe('ERROR', event => {
      const errEv = event as any;
      if (
        this.session &&
        this.retryManager.shouldRetry(this.session, errEv.message)
      ) {
        this.session.incrementRetry();
        console.warn(
          `[ScraperEngine] Retry attempt ${this.session.data.retryCount} for error: ${errEv.message}`,
        );
        this.commandQueue.enqueue({
          id: 'retry_scan',
          type: 'GET_FINGERPRINT',
          delayMs: 2000,
        });
      } else {
        this.stopSession(errEv.message || 'Scraper failed');
      }
    });
  }

  private processDecision(state: string, eventDetails: any): void {
    if (!this.session) {
      return;
    }

    const strategy = this.strategyRegistry.resolve(
      this.session.data.currentUrl,
    );
    const scraper =
      require('../../scraper.service').ScraperService.getInstance();

    if (state === 'MEDIATOR_READY') {
      const candidates = eventDetails.candidates || [];
      const cmd = strategy.findPrimaryAction(this.session.data, candidates);

      if (cmd && cmd.selector) {
        const candidateInfo = candidates.find(
          (c: any) => c.label === cmd.selector,
        );
        const text = candidateInfo ? candidateInfo.text : '';

        scraper.log(
          `[ScraperEngine] Strategy selected action candidate: text="${text}" selector="${cmd.selector}"`,
        );

        const allowed = this.clickHistory.isClickAllowed(
          this.session,
          cmd.selector,
          text,
          this.session.data.pageFingerprint,
        );

        if (allowed) {
          scraper.log(
            '[ScraperEngine] Click allowed. Registering click in history and enqueuing CLICK command.',
          );
          this.clickHistory.registerClick(
            this.session,
            cmd.selector,
            text,
            this.session.data.pageFingerprint,
          );
          this.commandQueue.enqueue(cmd);
        } else {
          scraper.log(
            '[ScraperEngine] Click BLOCKED by ClickHistory rules. Changing state to MEDIATOR_IDLE.',
          );
          this.session.updateState('MEDIATOR_IDLE');
        }
      } else {
        scraper.log(
          '[ScraperEngine] Strategy failed to pick a primary action from candidate list.',
        );
      }
    } else if (state === 'DOWNLOAD_SELECTION' || state === 'DOWNLOAD_READY') {
      // Perform extraction
      const html = eventDetails.html || '';
      const finalUrl = this.session.data.currentUrl;

      // Strategy extraction
      let mirrors = strategy.extract(this.session.data, html, finalUrl);

      // Generic fallback DOM mirror extraction if strategy returned null
      if (!mirrors) {
        mirrors = [];
        const candidates = eventDetails.candidates || [];
        // Scan for download/mirrors
        for (const c of candidates) {
          if (c.tagName === 'a') {
            // In a real browser, target links might be direct or mirror pages
            // We'll collect the candidates
          }
        }
      }

      this.session.addStructuredDiagnostic({
        action: 'EXTRACT',
        mirrors,
        html,
      });

      this.eventBus.emit({
        type: 'SUCCESS',
        url: finalUrl,
        timestamp: Date.now(),
        mirrors,
        html,
      } as DownloadEvent);
    }
  }

  private async executeCommandOnAgent(
    command: ScraperCommand,
  ): Promise<boolean> {
    if (!this.session) {
      return false;
    }

    const script = `
      (function() {
        if (window.__SCRAPER_API__) {
          return window.__SCRAPER_API__.executeCommand(${JSON.stringify(
            command,
          )});
        }
        return false;
      })();
    `;

    this.injectJS(script);
    return true;
  }
}
