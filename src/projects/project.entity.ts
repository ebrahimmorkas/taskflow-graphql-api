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
import { Workspace } from '../workspaces/workspace.entity.js';

@ObjectType()
@Entity('projects')
@Index(['workspaceId', 'key'], { unique: true })
export class Project {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Field(() => String, { description: 'Short uppercase key used in task ids, e.g. WEB-42' })
  @Column({ type: 'varchar', length: 10 })
  key: string;

  @Field(() => String)
  @Column({ type: 'text', default: '' })
  description: string;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  archived: boolean;

  /** Last issued task number; incremented atomically when tasks are created. */
  @Column({ type: 'int', default: 0 })
  taskCounter: number;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
