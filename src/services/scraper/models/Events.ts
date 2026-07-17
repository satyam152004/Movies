export type BrowserEventType =
  | 'PAGE_LOADED'
  | 'DOM_CHANGED'
  | 'URL_CHANGED'
  | 'NETWORK_IDLE'
  | 'NETWORK_BUSY'
  | 'BUTTON_FOUND'
  | 'BUTTON_CLICKED'
  | 'BUTTON_ENABLED'
  | 'BUTTON_DISABLED'
  | 'COUNTDOWN_STARTED'
  | 'COUNTDOWN_UPDATED'
  | 'COUNTDOWN_FINISHED'
  | 'DOWNLOAD_READY'
  | 'DOWNLOAD_FOUND'
  | 'ERROR'
  | 'TIMEOUT'
  | 'HANDSHAKE_REQUEST'
  | 'REDIRECT_ATTEMPT'
  | 'HISTORY_CHANGE'
  | 'FORM_SUBMIT_ATTEMPT'
  | 'LOG'
  | 'SUCCESS';

export interface BaseEvent {
  type: BrowserEventType;
  url: string;
  timestamp: number;
}

export interface NavigationEvent extends BaseEvent {
  type:
    | 'PAGE_LOADED'
    | 'HANDSHAKE_REQUEST'
    | 'URL_CHANGED'
    | 'REDIRECT_ATTEMPT'
    | 'HISTORY_CHANGE';
  method?: string;
  title?: string;
}

export interface MutationEvent extends BaseEvent {
  type:
    | 'DOM_CHANGED'
    | 'BUTTON_FOUND'
    | 'BUTTON_ENABLED'
    | 'BUTTON_DISABLED'
    | 'BUTTON_CLICKED';
  fingerprint?: string;
  buttonText?: string;
  buttonSelector?: string;
}

export interface NetworkEvent extends BaseEvent {
  type: 'NETWORK_IDLE' | 'NETWORK_BUSY';
  activeRequests: number;
}

export interface TimerEvent extends BaseEvent {
  type: 'COUNTDOWN_STARTED' | 'COUNTDOWN_UPDATED' | 'COUNTDOWN_FINISHED';
  secondsLeft?: number;
}

export interface DownloadEvent extends BaseEvent {
  type: 'DOWNLOAD_READY' | 'DOWNLOAD_FOUND' | 'SUCCESS';
  mirrors?: {label: string; url: string}[];
  html?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'ERROR' | 'TIMEOUT';
  message: string;
}

export interface LogEvent extends BaseEvent {
  type: 'LOG';
  message: string;
  logType?: 'info' | 'warn' | 'error' | 'success';
}

export type BrowserEvent =
  | NavigationEvent
  | MutationEvent
  | NetworkEvent
  | TimerEvent
  | DownloadEvent
  | ErrorEvent
  | LogEvent;
