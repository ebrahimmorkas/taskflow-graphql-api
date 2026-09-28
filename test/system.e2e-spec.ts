import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, errorCode, gql } from './utils/app.js';

describe('system', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports health including the database', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.info.database.status).toBe('up');
  });

  it('answers a basic GraphQL query', async () => {
    const res = await gql(app, '{ system { version pubSubBackend } }');
    expect(res.data?.system.version).toBe('1.0.0');
  });

  it('returns a stable error code for invalid queries', async () => {
    const res = await gql(app, '{ doesNotExist }');
    expect(errorCode(res)).toBe('GRAPHQL_VALIDATION_FAILED');
  });
});
