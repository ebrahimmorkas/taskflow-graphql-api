import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { formatGraphQLError } from './common/format-error.js';
import { validateEnv, type AppConfig } from './config/env.js';
import { buildDataSourceOptions } from './database/typeorm.config.js';
import { HealthController } from './health/health.controller.js';
import { SystemResolver } from './system/system.resolver.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildDataSourceOptions(
          config.get('DATABASE_URL', { infer: true }),
          config.get('DB_MIGRATIONS_RUN', { infer: true }),
        ),
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        autoSchemaFile: config.get('NODE_ENV', { infer: true }) === 'test' ? true : 'schema.gql',
        sortSchema: true,
        introspection: true,
        playground: false,
        context: ({ req }: { req: Request }) => ({ req }),
        formatError: formatGraphQLError,
      }),
    }),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [SystemResolver],
})
export class AppModule {}
