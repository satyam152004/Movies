export type CommandType =
  | 'CLICK'
  | 'SCROLL'
  | 'EXTRACT'
  | 'WAIT'
  | 'GET_FINGERPRINT';

export interface ScraperCommand {
  id: string;
  type: CommandType;
  selector?: string;
  xpath?: string;
  delayMs?: number;
  maxWaitMs?: number;
}
