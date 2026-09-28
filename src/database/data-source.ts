// Entry point for the TypeORM CLI (migration:generate / run / revert).
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.config.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

export default new DataSource(buildDataSourceOptions(url));
