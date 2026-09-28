import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Task } from './task.entity.js';

export enum TaskEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
}

registerEnumType(TaskEventType, { name: 'TaskEventType' });

@ObjectType()
export class TaskChangedEvent {
  @Field(() => TaskEventType)
  type: TaskEventType;

  @Field(() => ID)
  taskId: string;

  @Field(() => ID, { description: 'User who made the change' })
  actorId: string;

  @Field(() => Task, { nullable: true, description: 'Null for DELETED events' })
  task: Task | null;
}

/** One channel per project, so Redis only fans events out to interested instances. */
export const taskChangedTrigger = (projectId: string) => `taskChanged.${projectId}`;
