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

let userCounter = 0;

/** Signs up a fresh user and returns their id and token. */
export async function signUp(app: INestApplication, name?: string) {
  userCounter += 1;
  const email = `${name ?? 'user'}-${Date.now()}-${userCounter}@test.dev`.toLowerCase();
  const res = await gql<{ signUp: { token: string; user: { id: string; email: string } } }>(
    app,
    `mutation ($input: SignUpInput!) { signUp(input: $input) { token user { id email } } }`,
    { input: { email, name: name ?? 'Test User', password: 'Password123' } },
  );
  if (!res.data) throw new Error(JSON.stringify(res.errors));
  return { ...res.data.signUp.user, token: res.data.signUp.token };
}
