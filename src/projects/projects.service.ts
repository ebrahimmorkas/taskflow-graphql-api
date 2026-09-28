import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import type { Repository } from 'typeorm';
import { BadInput, Conflict, NotFound } from '../common/errors.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { WorkspaceRole } from '../workspaces/workspace-role.enum.js';
import type { CreateProjectInput, UpdateProjectInput } from './dto/project.inputs.js';
import { Project } from './project.entity.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly access: WorkspaceAccessService,
  ) {}

  /**
   * Loads a project and verifies the user's role in its workspace. Used by
   * every project-scoped operation (tasks, comments, subscriptions).
   */
  async requireProject(userId: string, projectId: string, minimum = WorkspaceRole.MEMBER) {
    const project = isUUID(projectId) ? await this.projects.findOneBy({ id: projectId }) : null;
    if (!project) throw NotFound('Project');
    try {
      await this.access.require(userId, project.workspaceId, minimum);
    } catch (err) {
      // Hide projects of other tenants entirely.
      if ((err as { extensions?: { code?: string } }).extensions?.code === 'NOT_FOUND') {
        throw NotFound('Project');
      }
      throw err;
    }
    return project;
  }

  async create(userId: string, input: CreateProjectInput) {
    await this.access.require(userId, input.workspaceId, WorkspaceRole.ADMIN);
    if (await this.projects.existsBy({ workspaceId: input.workspaceId, key: input.key })) {
      throw Conflict(`Project key ${input.key} is already used in this workspace`);
    }
    return this.projects.save(
      this.projects.create({
        workspaceId: input.workspaceId,
        name: input.name,
        key: input.key,
        description: input.description ?? '',
      }),
    );
  }

  async list(userId: string, workspaceId: string, includeArchived: boolean) {
    await this.access.require(userId, workspaceId);
    return this.projects.find({
      where: { workspaceId, ...(!includeArchived && { archived: false }) },
      order: { createdAt: 'ASC' },
    });
  }

  async update(userId: string, input: UpdateProjectInput) {
    const project = await this.requireProject(userId, input.id, WorkspaceRole.ADMIN);
    if (input.name === undefined && input.description === undefined) {
      throw BadInput('Nothing to update');
    }
    Object.assign(project, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    });
    return this.projects.save(project);
  }

  async setArchived(userId: string, projectId: string, archived: boolean) {
    const project = await this.requireProject(userId, projectId, WorkspaceRole.ADMIN);
    project.archived = archived;
    return this.projects.save(project);
  }
}
