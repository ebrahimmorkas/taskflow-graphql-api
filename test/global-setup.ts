import 'reflect-metadata';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/typeorm.config.js';

/** Creates the test database if needed and applies all migrations once per run. */
export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/taskflow_test',
  );
  const dbName = url.pathname.slice(1);

  const admin = new pg.Client({ connectionString: new URL('/postgres', url).toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const dataSource = new DataSource(buildDataSourceOptions(url.toString()));
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
