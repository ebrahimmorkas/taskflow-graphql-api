import type { INestApplication } from '@nestjs/common';
import { gql, signUp } from './app.js';

/** Owner + member in one workspace with one project (key WEB). */
export async function workspaceWithProject(app: INestApplication) {
  const owner = await signUp(app, 'owner');
  const member = await signUp(app, 'member');
  const ws = await gql(
    app,
    `mutation { createWorkspace(input: { name: "Acme" }) { id } }`,
    {},
    owner.token,
  );
  const workspaceId = ws.data!.createWorkspace.id as string;
  await gql(
    app,
    `mutation ($input: AddWorkspaceMemberInput!) { addWorkspaceMember(input: $input) { id } }`,
    { input: { workspaceId, email: member.email } },
    owner.token,
  );
  const project = await gql(
    app,
    `mutation ($input: CreateProjectInput!) { createProject(input: $input) { id key } }`,
    { input: { workspaceId, name: 'Website', key: 'WEB' } },
    owner.token,
  );
  return { owner, member, workspaceId, projectId: project.data!.createProject.id as string };
}

export const CREATE_TASK = `mutation ($input: CreateTaskInput!) {
  createTask(input: $input) { id number key title status priority assignee { id } reporter { id } }
}`;

export async function createTask(
  app: INestApplication,
  token: string,
  input: Record<string, unknown>,
) {
  const res = await gql(app, CREATE_TASK, { input }, token);
  if (!res.data) throw new Error(JSON.stringify(res.errors));
  return res.data.createTask;
}
