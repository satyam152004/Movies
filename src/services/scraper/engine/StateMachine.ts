import {BrowserSession} from './BrowserSession';
import {ScraperState} from '../models/States';
import {BrowserEvent} from '../models/Events';

export class StateMachine {
  public transition(
    session: BrowserSession,
    event: BrowserEvent,
    classifyFn: () => {
      type: ScraperState;
      confidence: number;
      details?: string;
    },
  ): ScraperState {
    const currentState = session.data.currentState;
    let nextState = currentState;

    switch (event.type) {
      case 'HANDSHAKE_REQUEST':
      case 'PAGE_LOADED':
      case 'URL_CHANGED':
      case 'REDIRECT_ATTEMPT':
      case 'HISTORY_CHANGE':
        nextState = 'PAGE_LOADING';
        break;

      case 'NETWORK_BUSY':
        if (
          currentState === 'PAGE_STABLE' ||
          currentState === 'MEDIATOR_IDLE'
        ) {
          nextState = 'MEDIATOR_WAITING_NETWORK';
        }
        break;

      case 'NETWORK_IDLE':
        if (
          currentState === 'MEDIATOR_WAITING_NETWORK' ||
          currentState === 'PAGE_LOADING'
        ) {
          nextState = 'PAGE_STABLE';
        }
        break;

      case 'COUNTDOWN_STARTED':
      case 'COUNTDOWN_UPDATED':
        nextState = 'MEDIATOR_WAITING_TIMER';
        break;

      case 'COUNTDOWN_FINISHED':
        if (currentState === 'MEDIATOR_WAITING_TIMER') {
          nextState = 'PAGE_STABLE';
        }
        break;

      case 'DOM_CHANGED':
        // Run classification if the page is stable or idle
        if (
          currentState === 'INIT' ||
          currentState === 'PAGE_LOADING' ||
          currentState === 'PAGE_STABLE' ||
          currentState === 'MEDIATOR_IDLE' ||
          currentState === 'MEDIATOR_WAITING_TIMER' ||
          currentState === 'CLASSIFYING'
        ) {
          session.updateState('CLASSIFYING');
          const classification = classifyFn();
          nextState = classification.type;
          session.addStructuredDiagnostic({
            action: 'CLASSIFY',
            confidence: classification.confidence,
            details: classification.details,
          });
        }
        break;

      case 'BUTTON_CLICKED':
        nextState = 'ACTION_RUNNING';
        break;

      case 'SUCCESS':
        nextState = 'SUCCESS';
        break;

      case 'ERROR':
      case 'TIMEOUT':
        nextState = 'FAILED';
        break;
    }

    if (nextState !== currentState) {
      session.updateState(nextState);
    }

    return nextState;
  }
}
