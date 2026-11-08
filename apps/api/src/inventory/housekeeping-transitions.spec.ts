import { UnprocessableEntityException } from '@nestjs/common';
import { assertHousekeepingTransition } from './housekeeping-transitions';

describe('assertHousekeepingTransition', () => {
  it('allows the documented cleaning workflow', () => {
    expect(() => assertHousekeepingTransition('DIRTY', 'CLEANING')).not.toThrow();
    expect(() => assertHousekeepingTransition('CLEANING', 'CLEAN')).not.toThrow();
    expect(() => assertHousekeepingTransition('CLEAN', 'INSPECTED')).not.toThrow();
    expect(() => assertHousekeepingTransition('INSPECTED', 'DIRTY')).not.toThrow();
  });

  it('rejects skipping required steps', () => {
    expect(() => assertHousekeepingTransition('DIRTY', 'CLEAN')).toThrow(
      UnprocessableEntityException,
    );
    expect(() => assertHousekeepingTransition('INSPECTED', 'CLEAN')).toThrow(
      UnprocessableEntityException,
    );
  });
});
