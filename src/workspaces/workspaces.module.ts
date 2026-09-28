import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { Membership } from './membership.entity.js';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { Workspace } from './workspace.entity.js';
import { WorkspacesResolver } from './workspaces.resolver.js';
import { WorkspacesService } from './workspaces.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, Membership, User])],
  providers: [WorkspacesService, WorkspacesResolver, WorkspaceAccessService],
  exports: [WorkspaceAccessService],
})
export class WorkspacesModule {}
