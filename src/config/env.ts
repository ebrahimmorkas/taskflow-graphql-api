import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MIGRATIONS_RUN: booleanFromString.default(true),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL: z.string().default('1d'),

  REDIS_ENABLED: booleanFromString,
  REDIS_URL: z.string().default('redis://localhost:6379'),

  GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().positive().default(300),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails fast at boot with a readable list of problems. */
export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
