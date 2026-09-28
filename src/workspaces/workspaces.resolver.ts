import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import {
  AddWorkspaceMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceMemberRoleInput,
} from './dto/workspace.inputs.js';
import { Membership } from './membership.entity.js';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspaceRole } from './workspace-role.enum.js';
import { Workspace } from './workspace.entity.js';
import { WorkspacesService } from './workspaces.service.js';

@Resolver(() => Workspace)
export class WorkspacesResolver {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly access: WorkspaceAccessService,
  ) {}

  @Query(() => [Workspace], { description: 'Workspaces the current user belongs to' })
  myWorkspaces(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Query(() => Workspace)
  workspace(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    return this.workspaces.get(user.id, id);
  }

  @Mutation(() => Workspace)
  createWorkspace(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => CreateWorkspaceInput }) input: CreateWorkspaceInput,
  ) {
    return this.workspaces.create(user.id, input);
  }

  @Mutation(() => Membership)
  addWorkspaceMember(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => AddWorkspaceMemberInput }) input: AddWorkspaceMemberInput,
  ) {
    return this.workspaces.addMember(user.id, input);
  }

  @Mutation(() => Membership)
  updateWorkspaceMemberRole(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => UpdateWorkspaceMemberRoleInput })
    input: UpdateWorkspaceMemberRoleInput,
  ) {
    return this.workspaces.updateRole(user.id, input);
  }

  @Mutation(() => Boolean, { description: 'Remove a member (admins) or leave (self)' })
  removeWorkspaceMember(
    @CurrentUser() user: AuthUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.workspaces.removeMember(user.id, workspaceId, userId);
  }

  @ResolveField(() => [Membership])
  members(@Parent() workspace: Workspace) {
    return this.workspaces.members(workspace.id);
  }

  @ResolveField(() => WorkspaceRole, { description: "The current user's role" })
  async myRole(@Parent() workspace: Workspace, @CurrentUser() user: AuthUser) {
    return (await this.access.require(user.id, workspace.id)).role;
  }
}
