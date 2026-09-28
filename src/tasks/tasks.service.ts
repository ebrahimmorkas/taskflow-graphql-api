import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, type Repository } from 'typeorm';
import { BadInput, Conflict, Forbidden, NotFound } from '../common/errors.js';
import { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { hasRole, WorkspaceRole } from '../workspaces/workspace-role.enum.js';
import { Activity, type FieldChange } from './activity.entity.js';
import { decodeCursor, encodeCursor, type TaskConnection } from './dto/task.connection.js';
import type { CreateTaskInput, PageArgs, TaskFilter, UpdateTaskInput } from './dto/task.inputs.js';
import { ActivityType, TaskPriority, TaskStatus } from './task.enums.js';
import { Task } from './task.entity.js';

const TRACKED_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'assigneeId',
  'dueDate',
] as const;

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Activity) private readonly activity: Repository<Activity>,
    private readonly projects: ProjectsService,
    private readonly access: WorkspaceAccessService,
  ) {}

  /** Loads a task after checking the caller can access its project. */
  async requireTask(userId: string, taskId: string) {
    const task = isUUID(taskId) ? await this.tasks.findOneBy({ id: taskId }) : null;
    if (!task) throw NotFound('Task');
    try {
      const project = await this.projects.requireProject(userId, task.projectId);
      return { task, project };
    } catch {
      throw NotFound('Task');
    }
  }

  private async assertAssignable(workspaceId: string, assigneeId: string) {
    if (!(await this.access.findMembership(assigneeId, workspaceId))) {
      throw BadInput('Assignee must be a member of the workspace');
    }
  }

  /**
   * Allocates the next per-project number with a single atomic
   * `UPDATE … RETURNING`. The row lock serialises concurrent creators, so
   * numbers are gap-free and never duplicated (the unique index is a backstop).
   */
  async create(userId: string, input: CreateTaskInput) {
    const project = await this.projects.requireProject(userId, input.projectId);
    if (project.archived) throw Conflict('Cannot add tasks to an archived project');
    if (input.assigneeId) await this.assertAssignable(project.workspaceId, input.assigneeId);

    return this.dataSource.transaction(async (tx) => {
      const [rows] = (await tx.query(
        'UPDATE "projects" SET "taskCounter" = "taskCounter" + 1 WHERE "id" = $1 RETURNING "taskCounter"',
        [project.id],
      )) as [{ taskCounter: number }[], number];
      const number = rows[0]!.taskCounter;

      const task = await tx.save(
        tx.create(Task, {
          projectId: project.id,
          number,
          title: input.title,
          description: input.description ?? '',
          priority: input.priority ?? TaskPriority.MEDIUM,
          status: TaskStatus.TODO,
          assigneeId: input.assigneeId ?? null,
          reporterId: userId,
          dueDate: input.dueDate ?? null,
        }),
      );
      await tx.save(
        tx.create(Activity, {
          taskId: task.id,
          actorId: userId,
          type: ActivityType.CREATED,
          changes: [],
        }),
      );
      return task;
    });
  }

  async update(userId: string, input: UpdateTaskInput) {
    const { task, project } = await this.requireTask(userId, input.id);
    if (input.assigneeId) await this.assertAssignable(project.workspaceId, input.assigneeId);

    const changes: FieldChange[] = [];
    for (const field of TRACKED_FIELDS) {
      const next = input[field];
      if (next === undefined) continue;
      if ((field === 'title' || field === 'status' || field === 'priority') && next === null) {
        throw BadInput(`${field} cannot be null`);
      }
      const previous = task[field];
      if (previous === next) continue;
      changes.push({ field, from: previous ?? null, to: next ?? null });
      Object.assign(task, { [field]: next ?? (field === 'description' ? '' : null) });
    }
    if (changes.length === 0) return task;

    return this.dataSource.transaction(async (tx) => {
      const saved = await tx.save(task);
      await tx.save(
        tx.create(Activity, {
          taskId: task.id,
          actorId: userId,
          type: ActivityType.UPDATED,
          changes,
        }),
      );
      return saved;
    });
  }

  /** Reporters can delete their own tasks; admins can delete any task. */
  async delete(userId: string, taskId: string) {
    const { task, project } = await this.requireTask(userId, taskId);
    if (task.reporterId !== userId) {
      const membership = await this.access.require(userId, project.workspaceId);
      if (!hasRole(membership.role, WorkspaceRole.ADMIN)) {
        throw Forbidden('Only the reporter or a workspace admin can delete this task');
      }
    }
    await this.tasks.delete({ id: task.id });
    return task;
  }

  async findByKey(userId: string, workspaceId: string, key: string) {
    const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(key.trim());
    if (!match) throw BadInput('Task key must look like WEB-42');
    await this.access.require(userId, workspaceId);
    const task = await this.tasks
      .createQueryBuilder('t')
      .innerJoin(Project, 'p', 'p.id = t.projectId')
      .where('p.workspaceId = :workspaceId', { workspaceId })
      .andWhere('p.key = :key', { key: match[1]!.toUpperCase() })
      .andWhere('t.number = :number', { number: Number(match[2]) })
      .getOne();
    if (!task) throw NotFound('Task');
    return task;
  }

  async list(
    userId: string,
    projectId: string,
    filter: TaskFilter = {},
    page: PageArgs = { first: 20 },
  ): Promise<TaskConnection> {
    await this.projects.requireProject(userId, projectId);

    const query = this.tasks
      .createQueryBuilder('t')
      .where('t.projectId = :projectId', { projectId });
    if (filter.status?.length)
      query.andWhere('t.status IN (:...status)', { status: filter.status });
    if (filter.priority?.length) {
      query.andWhere('t.priority IN (:...priority)', { priority: filter.priority });
    }
    if (filter.assigneeId)
      query.andWhere('t.assigneeId = :assigneeId', { assigneeId: filter.assigneeId });
    if (filter.unassigned) query.andWhere('t.assigneeId IS NULL');
    if (filter.search) {
      const escaped = filter.search.replace(/[\\%_]/g, (c) => `\\${c}`);
      query.andWhere('t.title ILIKE :search', { search: `%${escaped}%` });
    }

    const totalCount = await query.clone().getCount();

    if (page.after) {
      const afterNumber = decodeCursor(page.after);
      if (afterNumber === null) throw BadInput('Invalid cursor');
      query.andWhere('t.number < :afterNumber', { afterNumber });
    }
    const rows = await query
      .orderBy('t.number', 'DESC')
      .take(page.first + 1)
      .getMany();

    const hasNextPage = rows.length > page.first;
    const nodes = rows.slice(0, page.first);
    return {
      edges: nodes.map((node) => ({ node, cursor: encodeCursor(node.number) })),
      pageInfo: {
        hasNextPage,
        endCursor: nodes.length ? encodeCursor(nodes.at(-1)!.number) : null,
      },
      totalCount,
    };
  }

  activityFor(taskId: string) {
    return this.activity.find({ where: { taskId }, order: { createdAt: 'ASC' } });
  }
}
