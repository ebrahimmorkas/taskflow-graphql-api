import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import type { Repository } from 'typeorm';
import { Forbidden, NotFound } from '../common/errors.js';
import { Membership } from './membership.entity.js';
import { hasRole, WorkspaceRole } from './workspace-role.enum.js';

/**
 * Central tenant-isolation check used by every workspace-scoped module.
 * Non-members get NOT_FOUND (not FORBIDDEN) so ids from other tenants can't be probed.
 */
@Injectable()
export class WorkspaceAccessService {
  constructor(@InjectRepository(Membership) private readonly memberships: Repository<Membership>) {}

  findMembership(userId: string, workspaceId: string) {
    if (!isUUID(workspaceId)) return Promise.resolve(null);
    return this.memberships.findOneBy({ userId, workspaceId });
  }

  async require(
    userId: string,
    workspaceId: string,
    minimum: WorkspaceRole = WorkspaceRole.MEMBER,
  ): Promise<Membership> {
    const membership = await this.findMembership(userId, workspaceId);
    if (!membership) throw NotFound('Workspace');
    if (!hasRole(membership.role, minimum)) {
      throw Forbidden(`This action requires the ${minimum} role`);
    }
    return membership;
  }
}
