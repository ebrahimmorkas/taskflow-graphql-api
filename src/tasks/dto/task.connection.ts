import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Task } from '../task.entity.js';

@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType()
export class TaskEdge {
  @Field(() => String)
  cursor: string;

  @Field(() => Task)
  node: Task;
}

/** Relay-style connection: stable under concurrent inserts, unlike offset pagination. */
@ObjectType()
export class TaskConnection {
  @Field(() => [TaskEdge])
  edges: TaskEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

export const encodeCursor = (taskNumber: number) =>
  Buffer.from(`task:${taskNumber}`).toString('base64url');

export function decodeCursor(cursor: string): number | null {
  const match = /^task:(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString());
  return match ? Number(match[1]) : null;
}
