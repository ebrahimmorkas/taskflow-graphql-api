import type { INestApplication } from '@nestjs/common';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js';
import { createTestApp, errorCode, gql, resetDb, signUp } from './utils/app.js';
import { CREATE_TASK, createTask, workspaceWithProject } from './utils/fixtures.js';

const UPDATE_TASK = `mutation ($input: UpdateTaskInput!) {
  updateTask(input: $input) {
    status assignee { id }
    activity { type actor { id } changes { field from to } }
  }
}`;
const LIST = `query ($projectId: ID!, $filter: TaskFilter, $page: PageArgs) {
  tasks(projectId: $projectId, filter: $filter, page: $page) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { cursor node { key title } }
  }
}`;

describe('tasks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
  });

  it('creates tasks with sequential human keys', async () => {
    const { member, projectId } = await workspaceWithProject(app);
    const first = await createTask(app, member.token, { projectId, title: 'Set up CI' });
    const second = await createTask(app, member.token, {
      projectId,
      title: 'Write docs',
      priority: 'HIGH',
    });
    expect(first).toMatchObject({ number: 1, key: 'WEB-1', status: 'TODO', priority: 'MEDIUM' });
    expect(second).toMatchObject({ number: 2, key: 'WEB-2', priority: 'HIGH' });
    expect(first.reporter.id).toBe(member.id);
  });

  it('never issues duplicate numbers under concurrent creation', async () => {
    const { owner, projectId } = await workspaceWithProject(app);
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        gql(app, CREATE_TASK, { input: { projectId, title: `Task ${i}` } }, owner.token),
      ),
    );
    const numbers = results.map((r) => r.data!.createTask.number as number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('only assigns workspace members', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    const outsider = await signUp(app, 'outsider');

    const bad = await gql(
      app,
      CREATE_TASK,
      { input: { projectId, title: 'x', assigneeId: outsider.id } },
      owner.token,
    );
    expect(errorCode(bad)).toBe('BAD_USER_INPUT');

    const ok = await createTask(app, owner.token, { projectId, title: 'x', assigneeId: member.id });
    expect(ok.assignee.id).toBe(member.id);
  });

  it('records an activity log with field-level changes', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    const task = await createTask(app, owner.token, { projectId, title: 'Ship it' });

    const res = await gql(
      app,
      UPDATE_TASK,
      { input: { id: task.id, status: 'IN_PROGRESS', assigneeId: member.id } },
      member.token,
    );
    expect(res.errors).toBeUndefined();
    const activity = res.data!.updateTask.activity;
    expect(activity.map((a: { type: string }) => a.type)).toEqual(['CREATED', 'UPDATED']);
    expect(activity[1].actor.id).toBe(member.id);
    expect(activity[1].changes).toEqual([
      { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
      { field: 'assigneeId', from: null, to: member.id },
    ]);

    // Explicit null unassigns.
    const unassigned = await gql(
      app,
      UPDATE_TASK,
      { input: { id: task.id, assigneeId: null } },
      member.token,
    );
    expect(unassigned.data!.updateTask.assignee).toBeNull();
  });

  it('paginates with cursors and filters', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    for (let i = 1; i <= 5; i++) {
      await createTask(app, owner.token, {
        projectId,
        title: i % 2 ? `Bug ${i}` : `Feature ${i}`,
        ...(i === 5 && { assigneeId: member.id }),
      });
    }

    const page1 = await gql(app, LIST, { projectId, page: { first: 2 } }, owner.token);
    const conn1 = page1.data!.tasks;
    expect(conn1.totalCount).toBe(5);
    expect(conn1.edges.map((e: { node: { key: string } }) => e.node.key)).toEqual([
      'WEB-5',
      'WEB-4',
    ]);
    expect(conn1.pageInfo.hasNextPage).toBe(true);

    const page2 = await gql(
      app,
      LIST,
      { projectId, page: { first: 10, after: conn1.pageInfo.endCursor } },
      owner.token,
    );
    expect(page2.data!.tasks.edges).toHaveLength(3);
    expect(page2.data!.tasks.pageInfo.hasNextPage).toBe(false);

    const bugs = await gql(app, LIST, { projectId, filter: { search: 'bug' } }, owner.token);
    expect(bugs.errors).toBeUndefined();
    expect(bugs.data!.tasks.totalCount).toBe(3);

    const mine = await gql(
      app,
      LIST,
      { projectId, filter: { assigneeId: member.id } },
      owner.token,
    );
    expect(mine.data!.tasks.edges.map((e: { node: { key: string } }) => e.node.key)).toEqual([
      'WEB-5',
    ]);

    const invalid = await gql(app, LIST, { projectId, page: { first: 0 } }, owner.token);
    expect(errorCode(invalid)).toBe('BAD_USER_INPUT');
  });

  it('batches relation lookups with DataLoader (no N+1)', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    for (let i = 0; i < 25; i++) {
      await createTask(app, owner.token, { projectId, title: `T${i}`, assigneeId: member.id });
    }
    const spy = vi.spyOn(PostgresQueryRunner.prototype, 'query');
    const res = await gql(
      app,
      `query ($projectId: ID!) {
        tasks(projectId: $projectId, page: { first: 25 }) {
          edges { node { key assignee { name } reporter { name } project { name } } }
        }
      }`,
      { projectId },
      owner.token,
    );
    const queries = spy.mock.calls.length;
    spy.mockRestore();

    expect(res.data!.tasks.edges).toHaveLength(25);
    // Auth + count + page + one batched query per relation type — not 25×3.
    expect(queries).toBeLessThan(12);
  });

  it('finds tasks by key and enforces delete permissions', async () => {
    const { owner, member, workspaceId, projectId } = await workspaceWithProject(app);
    const byOwner = await createTask(app, owner.token, { projectId, title: 'Owner task' });

    const found = await gql(
      app,
      'query ($w: ID!) { taskByKey(workspaceId: $w, key: "web-1") { id } }',
      { w: workspaceId },
      member.token,
    );
    expect(found.data!.taskByKey.id).toBe(byOwner.id);

    const denied = await gql(
      app,
      'mutation ($id: ID!) { deleteTask(id: $id) }',
      { id: byOwner.id },
      member.token,
    );
    expect(errorCode(denied)).toBe('FORBIDDEN');

    const deleted = await gql(
      app,
      'mutation ($id: ID!) { deleteTask(id: $id) }',
      { id: byOwner.id },
      owner.token,
    );
    expect(deleted.data!.deleteTask).toBe(byOwner.id);
  });

  it('hides tasks from other tenants', async () => {
    const { owner, projectId } = await workspaceWithProject(app);
    const task = await createTask(app, owner.token, { projectId, title: 'Private' });
    const outsider = await signUp(app, 'outsider');
    const res = await gql(
      app,
      'query ($id: ID!) { task(id: $id) { title } }',
      { id: task.id },
      outsider.token,
    );
    expect(errorCode(res)).toBe('NOT_FOUND');
  });
});
