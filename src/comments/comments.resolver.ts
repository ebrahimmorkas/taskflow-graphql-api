import { Inject } from '@nestjs/common';
import { Args, ID, Mutation, Parent, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { BadInput } from '../common/errors.js';
import { Loaders, refreshLoaders } from '../common/loaders.js';
import { PUB_SUB, type PubSubPort } from '../pubsub/pubsub.module.js';
import { Task } from '../tasks/task.entity.js';
import { TasksService } from '../tasks/tasks.service.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import { commentAddedTrigger, CommentsService } from './comments.service.js';

const MAX_COMMENT_LENGTH = 10_000;

@Resolver(() => Comment)
export class CommentsResolver {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly tasksService: TasksService,
    @Inject(PUB_SUB) private readonly pubSub: PubSubPort,
  ) {}

  @Mutation(() => Comment)
  addComment(
    @CurrentUser() user: AuthUser,
    @Args('taskId', { type: () => ID }) taskId: string,
    @Args('body', { type: () => String }) body: string,
  ) {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
      throw BadInput(`Comment must be 1-${MAX_COMMENT_LENGTH} characters`);
    }
    return this.commentsService.add(user.id, taskId, trimmed);
  }

  @Subscription(() => Comment, {
    resolve: (payload: { commentAdded: Comment }, _args: unknown, ctx: object) => {
      refreshLoaders(ctx);
      return payload.commentAdded;
    },
  })
  async commentAdded(
    @CurrentUser() user: AuthUser,
    @Args('taskId', { type: () => ID }) taskId: string,
  ) {
    await this.tasksService.requireTask(user.id, taskId);
    return this.pubSub.asyncIterableIterator<Comment>(commentAddedTrigger(taskId));
  }

  @ResolveField(() => User)
  author(@Parent() comment: Comment, @Loaders() loaders: Loaders) {
    return loaders.user.load(comment.authorId);
  }
}

@Resolver(() => Task)
export class TaskCommentsResolver {
  constructor(private readonly commentsService: CommentsService) {}

  @ResolveField(() => [Comment], { complexity: 5 })
  comments(@Parent() task: Task) {
    return this.commentsService.listForTask(task.id);
  }
}
