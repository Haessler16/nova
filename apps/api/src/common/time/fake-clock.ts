import { Clock } from './clock';

/** Deterministic clock for tests. */
export class FakeClock extends Clock {
  private current: Date;

  constructor(current: Date | string) {
    super();
    this.current = new Date(current);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date | string): void {
    this.current = new Date(next);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
