import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import DataLoader from 'dataloader';
import { In, type DataSource, type ObjectLiteral, type EntityTarget } from 'typeorm';
import { Project } from '../projects/project.entity.js';
import { User } from '../users/user.entity.js';

function byIdLoader<T extends ObjectLiteral & { id: string }>(
  dataSource: DataSource,
  entity: EntityTarget<T>,
) {
  return new DataLoader<string, T | null>(async (ids) => {
    const rows = await dataSource.getRepository(entity).findBy({ id: In([...ids]) } as never);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}

/**
 * Request-scoped DataLoaders: resolving `assignee`/`reporter`/`project` for a
 * page of 100 tasks costs one query per entity type instead of one per task.
 */
export function createLoaders(dataSource: DataSource) {
  return {
    user: byIdLoader(dataSource, User),
    project: byIdLoader(dataSource, Project),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;

export const Loaders = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Loaders =>
    GqlExecutionContext.create(context).getContext().loaders,
);
