import {BrowserEvent, BrowserEventType} from '../models/Events';

export type EventCallback = (event: BrowserEvent) => void;

export class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  public subscribe(
    type: BrowserEventType | '*',
    callback: EventCallback,
  ): () => void {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);

    return () => {
      const current = this.listeners.get(type) || [];
      this.listeners.set(
        type,
        current.filter(cb => cb !== callback),
      );
    };
  }

  public emit(event: BrowserEvent): void {
    // Notify specific type listeners
    const specific = this.listeners.get(event.type) || [];
    specific.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('[EventBus] Error in listener:', e);
      }
    });

    // Notify wildcard listeners
    const wildcard = this.listeners.get('*') || [];
    wildcard.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('[EventBus] Error in wildcard listener:', e);
      }
    });
  }

  public clear(): void {
    this.listeners.clear();
  }
}
