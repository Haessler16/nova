import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type RoomRackEventType =
  | 'room.updated'
  | 'room.housekeeping'
  | 'room.block_changed'
  | 'room.lease_changed';

export interface RoomRackEvent {
  /** Monotonic per API instance; exposed so clients can detect gaps. */
  id: number;
  type: RoomRackEventType;
  roomId: string;
  at: string;
}

export type RoomRackStreamEvent = { type: 'ready'; cursor: number; at: string } | RoomRackEvent;

interface Envelope {
  roomId: string;
  type: RoomRackEventType;
}

/**
 * In-process fan-out for room rack notifications. Events are hints, never
 * state: PostgreSQL stays the authority, so a missed event costs one refetch
 * and can never lose or duplicate a write. Multi-instance deployments need a
 * shared broker (see docs/v4/FASE_3_REPORT.md).
 */
@Injectable()
export class RoomEventsService implements OnModuleDestroy {
  /** Every open stream for a tenant, so one tab never displaces another. */
  private readonly streams = new Map<string, Set<Subject<RoomRackEvent>>>();
  private sequence = 0;

  get cursor(): number {
    return this.sequence;
  }

  publish(organizationId: string, propertyId: string, envelope: Envelope): RoomRackEvent {
    this.sequence += 1;
    const event: RoomRackEvent = {
      id: this.sequence,
      type: envelope.type,
      roomId: envelope.roomId,
      at: new Date().toISOString(),
    };
    const subscribers = this.streams.get(this.key(organizationId, propertyId));
    if (subscribers !== undefined) {
      for (const subject of subscribers) {
        subject.next(event);
      }
    }
    return event;
  }

  /**
   * Sends `ready` with the current cursor, then every later event for the
   * tenant. Past events are not replayed: a reconnecting client compares the
   * cursor and refetches the rack, which is cheaper and always consistent.
   */
  stream(organizationId: string, propertyId: string): Observable<{ data: RoomRackStreamEvent }> {
    const key = this.key(organizationId, propertyId);
    return new Observable<{ data: RoomRackStreamEvent }>((subscriber) => {
      const subject = new Subject<RoomRackEvent>();
      const subscription = subject.subscribe((event) => subscriber.next({ data: event }));
      const existing = this.streams.get(key);
      const subscribers = existing ?? new Set<Subject<RoomRackEvent>>();
      subscribers.add(subject);
      if (existing === undefined) {
        this.streams.set(key, subscribers);
      }
      subscriber.next({
        data: { type: 'ready', cursor: this.sequence, at: new Date().toISOString() },
      });
      return () => {
        subscription.unsubscribe();
        const current = this.streams.get(key);
        if (current !== undefined) {
          current.delete(subject);
          if (current.size === 0) {
            this.streams.delete(key);
          }
        }
      };
    });
  }

  onModuleDestroy(): void {
    for (const subscribers of this.streams.values()) {
      for (const subject of subscribers) {
        subject.complete();
      }
    }
    this.streams.clear();
  }

  private key(organizationId: string, propertyId: string): string {
    return `${organizationId}:${propertyId}`;
  }
}
