import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, RequestLoggingInterceptor],
  exports: [MetricsService, RequestLoggingInterceptor],
})
export class ObservabilityModule {}
