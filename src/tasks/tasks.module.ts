import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module.js';
import { Activity } from './activity.entity.js';
import { Task } from './task.entity.js';
import { ActivityResolver, TasksResolver } from './tasks.resolver.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Activity]), ProjectsModule],
  providers: [TasksService, TasksResolver, ActivityResolver],
  exports: [TasksService],
})
export class TasksModule {}
