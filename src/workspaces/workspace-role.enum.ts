import { registerEnumType } from '@nestjs/graphql';

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

registerEnumType(WorkspaceRole, {
  name: 'WorkspaceRole',
  description: 'OWNER > ADMIN > MEMBER',
});

const RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.OWNER]: 3,
  [WorkspaceRole.ADMIN]: 2,
  [WorkspaceRole.MEMBER]: 1,
};

export const hasRole = (actual: WorkspaceRole, required: WorkspaceRole) =>
  RANK[actual] >= RANK[required];
