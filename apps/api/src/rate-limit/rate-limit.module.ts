import { Module } from '@nestjs/common';
import { MutationRateLimitGuard } from './mutation-rate-limit.guard';
import { MutationRateLimiter } from './mutation-rate-limiter.service';

@Module({
  providers: [MutationRateLimiter, MutationRateLimitGuard],
  exports: [MutationRateLimiter, MutationRateLimitGuard],
})
export class RateLimitModule {}
