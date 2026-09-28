import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

/** Truncates every entity table (fast reset between tests). */
export async function resetDb(app: INestApplication) {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas.map((m) => `"${m.tableName}"`);
  if (tables.length > 0) {
    await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  }
}

export interface GqlResponse<T = Record<string, any>> {
  data: T | null;
  errors?: { message: string; extensions?: { code?: string; details?: unknown } }[];
}

export async function gql<T = Record<string, any>>(
  app: INestApplication,
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GqlResponse<T>> {
  const req = request(app.getHttpServer()).post('/graphql').send({ query, variables });
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  return res.body as GqlResponse<T>;
}

export const errorCode = (res: GqlResponse) => res.errors?.[0]?.extensions?.code;
