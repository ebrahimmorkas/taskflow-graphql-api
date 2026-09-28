import type { INestApplication } from '@nestjs/common';
import { createTestApp, errorCode, gql, resetDb, signUp } from './utils/app.js';

const CREATE = `mutation ($input: CreateWorkspaceInput!) {
  createWorkspace(input: $input) { id name slug myRole members { role user { email } } }
}`;
const ADD_MEMBER = `mutation ($input: AddWorkspaceMemberInput!) {
  addWorkspaceMember(input: $input) { role user { id email } }
}`;
const UPDATE_ROLE = `mutation ($input: UpdateWorkspaceMemberRoleInput!) {
  updateWorkspaceMemberRole(input: $input) { role }
}`;
const REMOVE = `mutation ($workspaceId: ID!, $userId: ID!) {
  removeWorkspaceMember(workspaceId: $workspaceId, userId: $userId)
}`;

describe('workspaces', () => {
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
    const res = await gql(app, CREATE, { input: { name: 'Acme Corp' } }, owner.token);
    return { owner, workspace: res.data!.createWorkspace };
  }

  it('creates a workspace with the creator as owner and a unique slug', async () => {
    const { owner, workspace } = await setup();
    expect(workspace).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp', myRole: 'OWNER' });
    expect(workspace.members).toEqual([{ role: 'OWNER', user: { email: owner.email } }]);

    const second = await gql(app, CREATE, { input: { name: 'Acme Corp' } }, owner.token);
    expect(second.data?.createWorkspace.slug).toMatch(/^acme-corp-[0-9a-f]{6}$/);

    const mine = await gql(app, '{ myWorkspaces { name } }', {}, owner.token);
    expect(mine.data?.myWorkspaces).toHaveLength(2);
  });

  it('isolates tenants: outsiders get NOT_FOUND', async () => {
    const { workspace } = await setup();
    const outsider = await signUp(app, 'outsider');
    const res = await gql(
      app,
      'query ($id: ID!) { workspace(id: $id) { name } }',
      { id: workspace.id },
      outsider.token,
    );
    expect(errorCode(res)).toBe('NOT_FOUND');
  });

  it('lets admins add members but only owners grant ownership', async () => {
    const { owner, workspace } = await setup();
    const admin = await signUp(app, 'admin');
    const member = await signUp(app, 'member');

    const added = await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: admin.email, role: 'ADMIN' } },
      owner.token,
    );
    expect(added.data?.addWorkspaceMember.role).toBe('ADMIN');

    const promoteAttempt = await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: member.email, role: 'OWNER' } },
      admin.token,
    );
    expect(errorCode(promoteAttempt)).toBe('FORBIDDEN');

    const asMember = await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: member.email } },
      admin.token,
    );
    expect(asMember.data?.addWorkspaceMember.role).toBe('MEMBER');

    const duplicate = await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: member.email } },
      admin.token,
    );
    expect(errorCode(duplicate)).toBe('CONFLICT');

    const byMember = await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: owner.email } },
      member.token,
    );
    expect(errorCode(byMember)).toBe('FORBIDDEN');
  });

  it('always keeps at least one owner', async () => {
    const { owner, workspace } = await setup();

    const demoteSelf = await gql(
      app,
      UPDATE_ROLE,
      { input: { workspaceId: workspace.id, userId: owner.id, role: 'ADMIN' } },
      owner.token,
    );
    expect(errorCode(demoteSelf)).toBe('BAD_USER_INPUT');

    const leave = await gql(
      app,
      REMOVE,
      { workspaceId: workspace.id, userId: owner.id },
      owner.token,
    );
    expect(errorCode(leave)).toBe('BAD_USER_INPUT');

    const coOwner = await signUp(app, 'coowner');
    await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: coOwner.email, role: 'OWNER' } },
      owner.token,
    );
    const leaveNow = await gql(
      app,
      REMOVE,
      { workspaceId: workspace.id, userId: owner.id },
      owner.token,
    );
    expect(leaveNow.data?.removeWorkspaceMember).toBe(true);
  });

  it('lets members leave but not remove others', async () => {
    const { owner, workspace } = await setup();
    const member = await signUp(app, 'member');
    await gql(
      app,
      ADD_MEMBER,
      { input: { workspaceId: workspace.id, email: member.email } },
      owner.token,
    );

    const kick = await gql(
      app,
      REMOVE,
      { workspaceId: workspace.id, userId: owner.id },
      member.token,
    );
    expect(errorCode(kick)).toBe('FORBIDDEN');

    const leave = await gql(
      app,
      REMOVE,
      { workspaceId: workspace.id, userId: member.id },
      member.token,
    );
    expect(leave.data?.removeWorkspaceMember).toBe(true);
  });
});
