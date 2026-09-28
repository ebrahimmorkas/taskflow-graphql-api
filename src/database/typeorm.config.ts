import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities.js';
import { migrations } from './migrations/index.js';

/**
 * Shared by the Nest app and the TypeORM CLI. Entities and migrations are
 * listed explicitly (not globbed) so the same config works from `src` via tsx,
 * from `dist` in production, and under Vitest.
 */
export function buildDataSourceOptions(url: string, migrationsRun = false): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities,
    migrations,
    migrationsRun,
    synchronize: false,
    logging: ['error', 'warn'],
  };
}
