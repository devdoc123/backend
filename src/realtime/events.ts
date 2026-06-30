import { EventEmitter } from 'events';

/** Domain event names broadcast over SSE to connected clients. */
export type RealtimeEventType =
  | 'attendance.marked'
  | 'payment.recorded'
  | 'member.created'
  | 'member.updated'
  | 'membership.created'
  | 'membership.expired'
  | 'expense.recorded'
  | 'income.recorded'
  | 'inventory.updated'
  | 'dashboard.invalidated';

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  at: string;
}

class RealtimeBus extends EventEmitter {
  emitEvent(type: RealtimeEventType, payload: Record<string, unknown> = {}): void {
    const event: RealtimeEvent = { type, payload, at: new Date().toISOString() };
    this.emit('event', event);
  }
}

export const realtimeBus = new RealtimeBus();
// allow many concurrent SSE listeners
realtimeBus.setMaxListeners(0);
