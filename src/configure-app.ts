import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/** Global HTTP setup shared by `main.ts` and the e2e tests. */
export function configureApp(app: INestApplication, corsOrigin = '*') {
  const production = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      // Apollo Sandbox (dev only) loads assets from its CDN.
      contentSecurityPolicy: production ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}
