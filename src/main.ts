import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/env.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`GraphQL API ready at http://localhost:${port}/graphql`, 'Bootstrap');
}

await bootstrap();
