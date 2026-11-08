import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  render(@Req() request: Request): string {
    if (!this.config.get<boolean>('METRICS_ENABLED', true)) {
      throw new NotFoundException({ code: 'metrics_disabled', message: 'Metrics are disabled.' });
    }

    const token = this.config.get<string>('METRICS_TOKEN');
    if (token !== undefined) {
      const authorization = request.header('authorization') ?? '';
      const expected = `Bearer ${token}`;
      if (!safeEqual(authorization, expected)) {
        throw new UnauthorizedException({
          code: 'metrics_unauthorized',
          message: 'A valid metrics bearer token is required.',
        });
      }
    }

    return this.metrics.render();
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
