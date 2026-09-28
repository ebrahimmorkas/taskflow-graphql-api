import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { ActivityType } from './task.enums.js';
import { Task } from './task.entity.js';

@ObjectType()
export class FieldChange {
  @Field(() => String)
  field: string;

  @Field(() => String, { nullable: true })
  from: string | null;

  @Field(() => String, { nullable: true })
  to: string | null;
}

/** Append-only audit trail of everything that happens to a task. */
@ObjectType('ActivityEntry')
@Entity('task_activity')
@Index(['taskId', 'createdAt'])
export class Activity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'uuid' })
  actorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @Field(() => ActivityType)
  @Column({ type: 'enum', enum: ActivityType, enumName: 'activity_type' })
  type: ActivityType;

  @Field(() => [FieldChange])
  @Column({ type: 'jsonb', default: () => "'[]'" })
  changes: FieldChange[];

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
