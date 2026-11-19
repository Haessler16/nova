import { Clock, SystemClock } from './clock';
import { FakeClock } from './fake-clock';

describe('Clock', () => {
  it('SystemClock returns the current instant', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it('FakeClock is deterministic and can be advanced', () => {
    const clock: Clock = new FakeClock(new Date('2026-03-10T02:30:00.000Z'));

    expect(clock.now().toISOString()).toBe('2026-03-10T02:30:00.000Z');
    expect(clock.now()).not.toBe(clock.now());
  });

  it('FakeClock set and advance move the injected time', () => {
    const clock = new FakeClock('2026-03-10T02:30:00.000Z');

    clock.set('2026-03-10T09:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-10T09:00:00.000Z');

    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-03-10T09:01:00.000Z');
  });

  it('does not let callers mutate the clock through the returned Date', () => {
    const clock = new FakeClock('2026-03-10T02:30:00.000Z');
    const first = clock.now();
    first.setUTCFullYear(2030);

    expect(clock.now().toISOString()).toBe('2026-03-10T02:30:00.000Z');
  });
});
