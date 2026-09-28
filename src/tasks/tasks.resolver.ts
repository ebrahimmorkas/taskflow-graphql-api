import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { Loaders } from '../common/loaders.js';
import { Project } from '../projects/project.entity.js';
import { User } from '../users/user.entity.js';
import { Activity } from './activity.entity.js';
import { TaskConnection } from './dto/task.connection.js';
import { CreateTaskInput, PageArgs, TaskFilter, UpdateTaskInput } from './dto/task.inputs.js';
import { Task } from './task.entity.js';
import { TasksService } from './tasks.service.js';

@Resolver(() => Task)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

  @Query(() => TaskConnection, { description: 'Tasks in a project, newest first' })
  tasks(
    @CurrentUser() user: AuthUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('filter', { type: () => TaskFilter, defaultValue: {} }) filter: TaskFilter,
    @Args('page', { type: () => PageArgs, defaultValue: { first: 20 } }) page: PageArgs,
  ) {
    return this.tasksService.list(user.id, projectId, filter, page);
  }

  @Query(() => Task)
  async task(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    return (await this.tasksService.requireTask(user.id, id)).task;
  }

  @Query(() => Task, { description: 'Look up a task by its human key, e.g. WEB-42' })
  taskByKey(
    @CurrentUser() user: AuthUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('key', { type: () => String }) key: string,
  ) {
    return this.tasksService.findByKey(user.id, workspaceId, key);
  }

  @Mutation(() => Task)
  createTask(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => CreateTaskInput }) input: CreateTaskInput,
  ) {
    return this.tasksService.create(user.id, input);
  }

  @Mutation(() => Task)
  updateTask(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => UpdateTaskInput }) input: UpdateTaskInput,
  ) {
    return this.tasksService.update(user.id, input);
  }

  @Mutation(() => ID, { description: 'Returns the id of the deleted task' })
  async deleteTask(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    return (await this.tasksService.delete(user.id, id)).id;
  }

  @ResolveField(() => String, { description: 'Human key, e.g. WEB-42' })
  async key(@Parent() task: Task, @Loaders() loaders: Loaders) {
    const project = await loaders.project.load(task.projectId);
    return `${project?.key ?? '?'}-${task.number}`;
  }

  @ResolveField(() => Project)
  project(@Parent() task: Task, @Loaders() loaders: Loaders) {
    return loaders.project.load(task.projectId);
  }

  @ResolveField(() => User, { nullable: true })
  assignee(@Parent() task: Task, @Loaders() loaders: Loaders) {
    return task.assigneeId ? loaders.user.load(task.assigneeId) : null;
  }

  @ResolveField(() => User)
  reporter(@Parent() task: Task, @Loaders() loaders: Loaders) {
    return loaders.user.load(task.reporterId);
  }

  @ResolveField(() => [Activity], { complexity: 5 })
  activity(@Parent() task: Task) {
    return this.tasksService.activityFor(task.id);
  }
}

@Resolver(() => Activity)
export class ActivityResolver {
  @ResolveField(() => User)
  actor(@Parent() entry: Activity, @Loaders() loaders: Loaders) {
    return loaders.user.load(entry.actorId);
  }
}
