import { Injectable } from '@nestjs/common';

/**
 * Single source of "now". Inject it instead of calling `new Date()` so tests
 * can control time deterministically.
 */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
