import type { INestApplication } from '@nestjs/common';
import type { Client } from 'graphql-ws';
import { createTestApp, resetDb } from './utils/app.js';
import { createTask, workspaceWithProject } from './utils/fixtures.js';
import { listen, subscribe, wsClient } from './utils/ws.js';

/**
 * Two independent app instances that share only PostgreSQL and Redis: a
 * mutation handled by instance A must reach a subscriber connected to B.
 */
describe.skipIf(process.env.REDIS_ENABLED !== 'true')('horizontal scaling (Redis PubSub)', () => {
  let a: INestApplication;
  let b: INestApplication;
  let client: Client;

  beforeAll(async () => {
    a = await createTestApp();
    b = await createTestApp();
  });
  beforeEach(() => resetDb(a));
  afterAll(async () => {
    await client?.dispose();
    await a.close();
    await b.close();
  });

  it('delivers subscription events across instances', async () => {
    const { owner, member, projectId } = await workspaceWithProject(a);
    client = wsClient(await listen(b), member.token);
    const sub = await subscribe(
      client,
      'subscription ($p: ID!) { taskChanged(projectId: $p) { type task { key createdAt } } }',
      { p: projectId },
    );

    await createTask(a, owner.token, { projectId, title: 'Created on instance A' });
    const event = await sub.next();
    expect(event.taskChanged.type).toBe('CREATED');
    expect(event.taskChanged.task.key).toBe('WEB-1');
    // Dates survive the Redis JSON round-trip.
    expect(Number.isNaN(Date.parse(event.taskChanged.task.createdAt))).toBe(false);
  });
});
