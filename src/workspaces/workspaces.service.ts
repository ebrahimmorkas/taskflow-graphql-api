import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { BadInput, Conflict, Forbidden, NotFound } from '../common/errors.js';
import { User } from '../users/user.entity.js';
import type {
  AddWorkspaceMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceMemberRoleInput,
} from './dto/workspace.inputs.js';
import { Membership } from './membership.entity.js';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspaceRole } from './workspace-role.enum.js';
import { Workspace } from './workspace.entity.js';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'workspace';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, input: CreateWorkspaceInput) {
    const base = slugify(input.name);
    const slug = (await this.workspaces.existsBy({ slug: base }))
      ? `${base}-${randomBytes(3).toString('hex')}`
      : base;

    return this.dataSource.transaction(async (tx) => {
      const workspace = await tx.save(tx.create(Workspace, { name: input.name, slug }));
      await tx.save(
        tx.create(Membership, { workspaceId: workspace.id, userId, role: WorkspaceRole.OWNER }),
      );
      return workspace;
    });
  }

  listForUser(userId: string) {
    return this.workspaces
      .createQueryBuilder('w')
      .innerJoin('w.memberships', 'm', 'm.userId = :userId', { userId })
      .orderBy('w.createdAt', 'ASC')
      .getMany();
  }

  async get(userId: string, workspaceId: string) {
    await this.access.require(userId, workspaceId);
    return this.workspaces.findOneByOrFail({ id: workspaceId });
  }

  members(workspaceId: string) {
    return this.memberships.find({
      where: { workspaceId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(actorId: string, input: AddWorkspaceMemberInput) {
    const actor = await this.access.require(actorId, input.workspaceId, WorkspaceRole.ADMIN);
    if (input.role === WorkspaceRole.OWNER && actor.role !== WorkspaceRole.OWNER) {
      throw Forbidden('Only owners can add other owners');
    }
    const user = await this.users.findOneBy({ email: input.email });
    if (!user) throw NotFound('User');
    if (await this.memberships.existsBy({ workspaceId: input.workspaceId, userId: user.id })) {
      throw Conflict('User is already a member of this workspace');
    }

    const membership = await this.memberships.save(
      this.memberships.create({
        workspaceId: input.workspaceId,
        userId: user.id,
        role: input.role,
      }),
    );
    membership.user = user;
    return membership;
  }

  async updateRole(actorId: string, input: UpdateWorkspaceMemberRoleInput) {
    await this.access.require(actorId, input.workspaceId, WorkspaceRole.OWNER);
    return this.dataSource.transaction(async (tx) => {
      const target = await this.lockMembers(tx, input.workspaceId, input.userId);
      if (target.role === WorkspaceRole.OWNER && input.role !== WorkspaceRole.OWNER) {
        await this.assertAnotherOwner(tx, input.workspaceId, input.userId);
      }
      target.role = input.role;
      await tx.save(target);
      return tx.findOneOrFail(Membership, { where: { id: target.id }, relations: { user: true } });
    });
  }

  /** Admins remove members; anyone may leave. A workspace always keeps at least one owner. */
  async removeMember(actorId: string, workspaceId: string, userId: string) {
    const actor = await this.access.require(actorId, workspaceId);
    return this.dataSource.transaction(async (tx) => {
      const target = await this.lockMembers(tx, workspaceId, userId);
      if (actorId !== userId) {
        if (actor.role === WorkspaceRole.MEMBER) throw Forbidden('Only admins can remove members');
        if (target.role === WorkspaceRole.OWNER && actor.role !== WorkspaceRole.OWNER) {
          throw Forbidden('Only owners can remove owners');
        }
      }
      if (target.role === WorkspaceRole.OWNER) {
        await this.assertAnotherOwner(tx, workspaceId, userId);
      }
      await tx.delete(Membership, { id: target.id });
      return true;
    });
  }

  /**
   * Locks all memberships of the workspace for the transaction so that two
   * concurrent demotions/removals can't both pass the "another owner exists" check.
   */
  private async lockMembers(tx: EntityManager, workspaceId: string, userId: string) {
    const rows = await tx
      .getRepository(Membership)
      .createQueryBuilder('m')
      .setLock('pessimistic_write')
      .where('m.workspaceId = :workspaceId', { workspaceId })
      .getMany();
    const target = rows.find((m) => m.userId === userId);
    if (!target) throw NotFound('Member');
    return target;
  }

  private async assertAnotherOwner(tx: EntityManager, workspaceId: string, exceptUserId: string) {
    const owners = await tx.countBy(Membership, { workspaceId, role: WorkspaceRole.OWNER });
    const targetIsOwner = await tx.existsBy(Membership, {
      workspaceId,
      userId: exceptUserId,
      role: WorkspaceRole.OWNER,
    });
    if (targetIsOwner && owners <= 1) {
      throw BadInput('A workspace must keep at least one owner');
    }
  }
}
