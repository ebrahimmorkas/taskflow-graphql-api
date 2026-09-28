import type { INestApplication } from '@nestjs/common';
import type { Client } from 'graphql-ws';
import { createTestApp, errorCode, gql, resetDb, signUp } from './utils/app.js';
import { createTask, workspaceWithProject } from './utils/fixtures.js';
import { listen, subscribe, wsClient } from './utils/ws.js';

const TASK_CHANGED = `subscription ($projectId: ID!) {
  taskChanged(projectId: $projectId) {
    type taskId actorId
    task { key title status assignee { name } }
  }
}`;
const COMMENT_ADDED = `subscription ($taskId: ID!) {
  commentAdded(taskId: $taskId) { body author { id name } }
}`;

describe('subscriptions', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  const client = (token?: string) => {
    const c = wsClient(url, token);
    clients.push(c);
    return c;
  };

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  beforeEach(() => resetDb(app));
  afterEach(async () => {
    for (const c of clients.splice(0)) await c.dispose();
  });
  afterAll(async () => {
    await app.close();
  });

  it('streams task created / updated / deleted events for a project', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    const sub = await subscribe(client(member.token), TASK_CHANGED, { projectId });

    const task = await createTask(app, owner.token, { projectId, title: 'Live task' });
    const created = await sub.next();
    expect(created.taskChanged).toMatchObject({
      type: 'CREATED',
      taskId: task.id,
      actorId: owner.id,
      task: { key: 'WEB-1', title: 'Live task', status: 'TODO', assignee: null },
    });

    await gql(
      app,
      'mutation ($input: UpdateTaskInput!) { updateTask(input: $input) { id } }',
      { input: { id: task.id, status: 'DONE', assigneeId: member.id } },
      owner.token,
    );
    const updated = await sub.next();
    expect(updated.taskChanged.type).toBe('UPDATED');
    expect(updated.taskChanged.task).toMatchObject({
      status: 'DONE',
      assignee: { name: 'member' },
    });

    await gql(app, 'mutation ($id: ID!) { deleteTask(id: $id) }', { id: task.id }, owner.token);
    const deleted = await sub.next();
    expect(deleted.taskChanged).toMatchObject({ type: 'DELETED', taskId: task.id, task: null });
  });

  it('streams new comments on a task', async () => {
    const { owner, member, projectId } = await workspaceWithProject(app);
    const task = await createTask(app, owner.token, { projectId, title: 'Discuss' });
    const sub = await subscribe(client(owner.token), COMMENT_ADDED, { taskId: task.id });

    const res = await gql(
      app,
      'mutation ($taskId: ID!, $body: String!) { addComment(taskId: $taskId, body: $body) { id } }',
      { taskId: task.id, body: '  Looks good to me  ' },
      member.token,
    );
    expect(res.errors).toBeUndefined();

    const event = await sub.next();
    expect(event.commentAdded).toEqual({
      body: 'Looks good to me',
      author: { id: member.id, name: 'member' },
    });

    const thread = await gql(
      app,
      'query ($id: ID!) { task(id: $id) { comments { body } activity { type } } }',
      { id: task.id },
      owner.token,
    );
    expect(thread.data!.task.comments).toEqual([{ body: 'Looks good to me' }]);
    expect(thread.data!.task.activity.map((a: { type: string }) => a.type)).toEqual([
      'CREATED',
      'COMMENTED',
    ]);
  });

  it('refuses subscriptions to projects the user cannot access', async () => {
    const { projectId } = await workspaceWithProject(app);
    const outsider = await signUp(app, 'outsider');
    const sub = await subscribe(client(outsider.token), TASK_CHANGED, { projectId });
    await expect(sub.next()).rejects.toEqual([
      expect.objectContaining({ extensions: expect.objectContaining({ code: 'NOT_FOUND' }) }),
    ]);
  });

  it('rejects WebSocket connections without a valid token', async () => {
    const { projectId } = await workspaceWithProject(app);
    const sub = await subscribe(client('not-a-token'), TASK_CHANGED, { projectId });
    await expect(sub.next()).rejects.toBeTruthy();
  });

  it('validates comment length', async () => {
    const { owner, projectId } = await workspaceWithProject(app);
    const task = await createTask(app, owner.token, { projectId, title: 'x' });
    const res = await gql(
      app,
      'mutation ($taskId: ID!) { addComment(taskId: $taskId, body: "   ") { id } }',
      { taskId: task.id },
      owner.token,
    );
    expect(errorCode(res)).toBe('BAD_USER_INPUT');
  });
});
