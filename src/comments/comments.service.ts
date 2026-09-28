import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { PUB_SUB, type PubSubPort } from '../pubsub/pubsub.module.js';
import { Activity } from '../tasks/activity.entity.js';
import { ActivityType } from '../tasks/task.enums.js';
import { TasksService } from '../tasks/tasks.service.js';
import { Comment } from './comment.entity.js';

export const commentAddedTrigger = (taskId: string) => `commentAdded.${taskId}`;

@Injectable()
export class CommentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    private readonly tasks: TasksService,
    @Inject(PUB_SUB) private readonly pubSub: PubSubPort,
  ) {}

  async add(userId: string, taskId: string, body: string) {
    const { task } = await this.tasks.requireTask(userId, taskId);
    const comment = await this.dataSource.transaction(async (tx) => {
      const saved = await tx.save(tx.create(Comment, { taskId: task.id, authorId: userId, body }));
      await tx.save(
        tx.create(Activity, {
          taskId: task.id,
          actorId: userId,
          type: ActivityType.COMMENTED,
          changes: [],
        }),
      );
      return saved;
    });
    await this.pubSub.publish(commentAddedTrigger(task.id), { commentAdded: comment });
    return comment;
  }

  listForTask(taskId: string) {
    return this.comments.find({ where: { taskId }, order: { createdAt: 'ASC' } });
  }
}
