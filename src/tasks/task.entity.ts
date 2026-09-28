import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity.js';
import { User } from '../users/user.entity.js';
import { TaskPriority, TaskStatus } from './task.enums.js';

@ObjectType()
@Entity('tasks')
@Index(['projectId', 'number'], { unique: true })
@Index(['projectId', 'status'])
@Index(['assigneeId'])
export class Task {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Field(() => Int, { description: 'Sequential number within the project' })
  @Column({ type: 'int' })
  number: number;

  @Field(() => String)
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Field(() => String)
  @Column({ type: 'text', default: '' })
  description: string;

  @Field(() => TaskStatus)
  @Column({ type: 'enum', enum: TaskStatus, enumName: 'task_status', default: TaskStatus.TODO })
  status: TaskStatus;

  @Field(() => TaskPriority)
  @Column({
    type: 'enum',
    enum: TaskPriority,
    enumName: 'task_priority',
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User | null;

  @Column({ type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Field(() => String, { nullable: true, description: 'ISO date (YYYY-MM-DD)' })
  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
