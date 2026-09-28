import type { INestApplication } from '@nestjs/common';
import { createTestApp, errorCode, gql, resetDb } from './utils/app.js';
import { workspaceWithProject } from './utils/fixtures.js';

describe('query complexity limits', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
  });

  const query = (first: number) => `query ($projectId: ID!) {
    tasks(projectId: $projectId, page: { first: ${first} }) {
      edges { node {
        key title assignee { name } reporter { name }
        comments { body author { name } }
        activity { type actor { name } changes { field from to } }
      } }
    }
  }`;

  it('allows reasonably sized queries', async () => {
    const { owner, projectId } = await workspaceWithProject(app);
    const res = await gql(app, query(5), { projectId }, owner.token);
    expect(res.errors).toBeUndefined();
  });

  it('rejects queries whose cost scales past the limit', async () => {
    const { owner, projectId } = await workspaceWithProject(app);
    const res = await gql(app, query(100), { projectId }, owner.token);
    expect(errorCode(res)).toBe('QUERY_TOO_COMPLEX');
    expect(res.errors?.[0]?.extensions?.details).toMatchObject({ max: 300 });
  });
});
