import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @HttpCode(200)
  live() {
    return this.health.liveness();
  }

  @Get('version')
  @HttpCode(200)
  version() {
    return this.health.version();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.readiness();
    response.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
}
