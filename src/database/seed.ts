// Demo data: `npm run db:seed` (idempotent). All users share the password Password123.
import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { Comment } from '../comments/comment.entity.js';
import { Project } from '../projects/project.entity.js';
import { Activity } from '../tasks/activity.entity.js';
import { ActivityType, TaskPriority, TaskStatus } from '../tasks/task.enums.js';
import { Task } from '../tasks/task.entity.js';
import { User } from '../users/user.entity.js';
import { Membership } from '../workspaces/membership.entity.js';
import { WorkspaceRole } from '../workspaces/workspace-role.enum.js';
import { Workspace } from '../workspaces/workspace.entity.js';
import dataSource from './data-source.js';

const TASKS: [string, TaskStatus, TaskPriority][] = [
  ['Design landing page', TaskStatus.DONE, TaskPriority.HIGH],
  ['Set up CI pipeline', TaskStatus.DONE, TaskPriority.MEDIUM],
  ['Implement sign-up flow', TaskStatus.IN_REVIEW, TaskPriority.HIGH],
  ['Add dark mode', TaskStatus.IN_PROGRESS, TaskPriority.LOW],
  ['Fix mobile navigation bug', TaskStatus.TODO, TaskPriority.URGENT],
  ['Write onboarding docs', TaskStatus.TODO, TaskPriority.MEDIUM],
];

async function main() {
  await dataSource.initialize();
  await dataSource.runMigrations();

  if (await dataSource.getRepository(User).existsBy({ email: 'alice@example.com' })) {
    console.log('Seed data already present.');
    return;
  }

  await dataSource.transaction(async (tx) => {
    const passwordHash = await bcrypt.hash('Password123', 10);
    const [alice, bob, carol] = await tx.save(
      ['Alice Owner', 'Bob Developer', 'Carol Designer'].map((name) =>
        tx.create(User, {
          name,
          email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
          passwordHash,
        }),
      ),
    );

    const workspace = await tx.save(tx.create(Workspace, { name: 'Acme Inc', slug: 'acme-inc' }));
    await tx.save([
      tx.create(Membership, {
        workspaceId: workspace.id,
        userId: alice!.id,
        role: WorkspaceRole.OWNER,
      }),
      tx.create(Membership, {
        workspaceId: workspace.id,
        userId: bob!.id,
        role: WorkspaceRole.ADMIN,
      }),
      tx.create(Membership, {
        workspaceId: workspace.id,
        userId: carol!.id,
        role: WorkspaceRole.MEMBER,
      }),
    ]);

    const web = await tx.save(
      tx.create(Project, {
        workspaceId: workspace.id,
        name: 'Website',
        key: 'WEB',
        description: 'Marketing site and web app',
        taskCounter: TASKS.length,
      }),
    );
    await tx.save(
      tx.create(Project, { workspaceId: workspace.id, name: 'Public API', key: 'API' }),
    );

    const assignees = [bob!, carol!, bob!, carol!, null, alice!];
    const tasks = await tx.save(
      TASKS.map(([title, status, priority], i) =>
        tx.create(Task, {
          projectId: web.id,
          number: i + 1,
          title,
          status,
          priority,
          reporterId: alice!.id,
          assigneeId: assignees[i]?.id ?? null,
        }),
      ),
    );
    await tx.save(
      tasks.map((task) =>
        tx.create(Activity, { taskId: task.id, actorId: alice!.id, type: ActivityType.CREATED }),
      ),
    );
    await tx.save(
      tx.create(Comment, {
        taskId: tasks[2]!.id,
        authorId: carol!.id,
        body: 'Left a few review comments on the validation messages.',
      }),
    );
  });

  console.log('Seeded: alice@example.com / bob@example.com / carol@example.com (Password123)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => dataSource.destroy());
