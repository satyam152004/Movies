import {ScraperCommand} from '../models/Commands';

export class CommandQueue {
  private queue: ScraperCommand[] = [];
  private isProcessing = false;
  private executor: (command: ScraperCommand) => Promise<boolean>;

  constructor(executor: (command: ScraperCommand) => Promise<boolean>) {
    this.executor = executor;
  }

  public enqueue(command: ScraperCommand): void {
    this.queue.push(command);
    this.processNext();
  }

  public clear(): void {
    this.queue = [];
    this.isProcessing = false;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const cmd = this.queue.shift();

    if (cmd) {
      try {
        if (cmd.delayMs && cmd.delayMs > 0) {
          await new Promise(r => setTimeout(r, cmd.delayMs));
        }
        await this.executor(cmd);
      } catch (err) {
        console.error('[CommandQueue] Error executing command:', err);
      }
    }

    this.isProcessing = false;
    this.processNext();
  }
}
