import type { INestApplication } from '@nestjs/common';
import { createTestApp, errorCode, gql, resetDb, signUp } from './utils/app.js';

const CREATE_WORKSPACE = `mutation ($name: String!) { createWorkspace(input: { name: $name }) { id } }`;
const ADD_MEMBER = `mutation ($input: AddWorkspaceMemberInput!) { addWorkspaceMember(input: $input) { id } }`;
const CREATE_PROJECT = `mutation ($input: CreateProjectInput!) {
  createProject(input: $input) { id key name archived }
}`;

describe('projects', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const owner = await signUp(app, 'owner');
    const member = await signUp(app, 'member');
    const ws = await gql(app, CREATE_WORKSPACE, { name: 'Acme' }, owner.token);
    const workspaceId = ws.data!.createWorkspace.id as string;
    await gql(app, ADD_MEMBER, { input: { workspaceId, email: member.email } }, owner.token);
    return { owner, member, workspaceId };
  }

  it('creates projects with normalised, per-workspace unique keys', async () => {
    const { owner, workspaceId } = await setup();
    const res = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Website', key: 'web' } },
      owner.token,
    );
    expect(res.data?.createProject).toMatchObject({ key: 'WEB', name: 'Website', archived: false });

    const dup = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Web 2', key: 'WEB' } },
      owner.token,
    );
    expect(errorCode(dup)).toBe('CONFLICT');

    const badKey = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Bad', key: '1-bad' } },
      owner.token,
    );
    expect(errorCode(badKey)).toBe('BAD_USER_INPUT');
  });

  it('requires ADMIN to create projects but lets members read them', async () => {
    const { owner, member, workspaceId } = await setup();
    const denied = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Nope', key: 'NO' } },
      member.token,
    );
    expect(errorCode(denied)).toBe('FORBIDDEN');

    await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'API', key: 'API' } },
      owner.token,
    );
    const list = await gql(
      app,
      'query ($w: ID!) { projects(workspaceId: $w) { key } }',
      { w: workspaceId },
      member.token,
    );
    expect(list.data?.projects).toEqual([{ key: 'API' }]);
  });

  it('archives projects and hides them by default', async () => {
    const { owner, workspaceId } = await setup();
    const created = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Old', key: 'OLD' } },
      owner.token,
    );
    await gql(
      app,
      'mutation ($id: ID!) { archiveProject(id: $id) { archived } }',
      { id: created.data!.createProject.id },
      owner.token,
    );

    const visible = await gql(
      app,
      'query ($w: ID!) { projects(workspaceId: $w) { key } }',
      { w: workspaceId },
      owner.token,
    );
    expect(visible.data?.projects).toEqual([]);

    const all = await gql(
      app,
      'query ($w: ID!) { projects(workspaceId: $w, includeArchived: true) { key } }',
      { w: workspaceId },
      owner.token,
    );
    expect(all.data?.projects).toEqual([{ key: 'OLD' }]);
  });

  it('hides projects from other tenants', async () => {
    const { owner, workspaceId } = await setup();
    const created = await gql(
      app,
      CREATE_PROJECT,
      { input: { workspaceId, name: 'Secret', key: 'SEC' } },
      owner.token,
    );
    const outsider = await signUp(app, 'outsider');
    const res = await gql(
      app,
      'query ($id: ID!) { project(id: $id) { name } }',
      { id: created.data!.createProject.id },
      outsider.token,
    );
    expect(errorCode(res)).toBe('NOT_FOUND');
  });
});
