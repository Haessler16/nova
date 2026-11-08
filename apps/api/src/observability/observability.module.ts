import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    RequestLoggingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestLoggingInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
