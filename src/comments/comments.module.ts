import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module.js';
import { Comment } from './comment.entity.js';
import { CommentsResolver, TaskCommentsResolver } from './comments.resolver.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Comment]), TasksModule],
  providers: [CommentsService, CommentsResolver, TaskCommentsResolver],
})
export class CommentsModule {}
