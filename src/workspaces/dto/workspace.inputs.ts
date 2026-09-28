import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { WorkspaceRole } from '../workspace-role.enum.js';

@InputType()
export class CreateWorkspaceInput {
  @Field(() => String)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

@InputType()
export class AddWorkspaceMemberInput {
  @Field(() => ID)
  @IsUUID()
  workspaceId: string;

  @Field(() => String)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @Field(() => WorkspaceRole, { defaultValue: WorkspaceRole.MEMBER })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}

@InputType()
export class UpdateWorkspaceMemberRoleInput {
  @Field(() => ID)
  @IsUUID()
  workspaceId: string;

  @Field(() => ID)
  @IsUUID()
  userId: string;

  @Field(() => WorkspaceRole)
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
