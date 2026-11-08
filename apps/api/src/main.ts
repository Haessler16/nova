import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const port = config.get<number>('API_PORT', 3001);

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NOVA PMS API')
      .setDescription(
        'Phase 1 foundation. Development authentication uses X-Dev-User-Id; tenant selection uses X-Organization-Id and X-Property-Id and is validated server-side.',
      )
      .setVersion('0.1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Dev-User-Id' }, 'dev-user')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Organization-Id' }, 'organization')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Property-Id' }, 'property')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  Logger.log(`NOVA API listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : 'Unknown bootstrap error',
    error instanceof Error ? error.stack : undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
