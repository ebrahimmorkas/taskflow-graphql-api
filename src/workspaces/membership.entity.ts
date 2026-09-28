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
import { WorkspaceRole } from './workspace-role.enum.js';
import { Workspace } from './workspace.entity.js';

@ObjectType('WorkspaceMember')
@Entity('memberships')
@Index(['workspaceId', 'userId'], { unique: true })
@Index(['userId'])
export class Membership {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, (w) => w.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  userId: string;

  @Field(() => User)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field(() => WorkspaceRole)
  @Column({ type: 'enum', enum: WorkspaceRole, enumName: 'workspace_role' })
  role: WorkspaceRole;

  @Field(() => Date, { name: 'joinedAt' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
