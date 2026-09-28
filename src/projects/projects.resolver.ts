import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { CreateProjectInput, UpdateProjectInput } from './dto/project.inputs.js';
import { Project } from './project.entity.js';
import { ProjectsService } from './projects.service.js';

@Resolver(() => Project)
export class ProjectsResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @Query(() => [Project])
  projects(
    @CurrentUser() user: AuthUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('includeArchived', { type: () => Boolean, defaultValue: false }) includeArchived: boolean,
  ) {
    return this.projectsService.list(user.id, workspaceId, includeArchived);
  }

  @Query(() => Project)
  project(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    return this.projectsService.requireProject(user.id, id);
  }

  @Mutation(() => Project)
  createProject(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => CreateProjectInput }) input: CreateProjectInput,
  ) {
    return this.projectsService.create(user.id, input);
  }

  @Mutation(() => Project)
  updateProject(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => UpdateProjectInput }) input: UpdateProjectInput,
  ) {
    return this.projectsService.update(user.id, input);
  }

  @Mutation(() => Project)
  archiveProject(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('archived', { type: () => Boolean, defaultValue: true }) archived: boolean,
  ) {
    return this.projectsService.setArchived(user.id, id, archived);
  }
}
