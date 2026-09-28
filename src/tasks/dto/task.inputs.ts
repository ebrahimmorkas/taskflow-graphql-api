import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../task.enums.js';

@InputType()
export class CreateTaskInput {
  @Field(() => ID)
  @IsUUID()
  projectId: string;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @Field(() => String, { nullable: true, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string;
}

/**
 * Omitted fields are left unchanged; `assigneeId: null` / `dueDate: null`
 * explicitly clear the value.
 */
@InputType()
export class UpdateTaskInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @Field(() => TaskStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;
}

@InputType()
export class TaskFilter {
  @Field(() => [TaskStatus], { nullable: true })
  @IsOptional()
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @Field(() => [TaskPriority], { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @Field(() => Boolean, { nullable: true, description: 'Only tasks without an assignee' })
  @IsOptional()
  unassigned?: boolean;

  @Field(() => String, { nullable: true, description: 'Case-insensitive title search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@InputType()
export class PageArgs {
  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  first: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}
