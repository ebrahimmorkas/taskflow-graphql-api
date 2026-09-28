import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuthModule } from './auth/auth.module.js';
import { formatGraphQLError } from './common/format-error.js';
import { GqlPassthroughFilter } from './common/gql-exception.filter.js';
import { createLoaders } from './common/loaders.js';
import { ProjectsModule } from './projects/projects.module.js';
import { validateEnv, type AppConfig } from './config/env.js';
import { buildDataSourceOptions } from './database/typeorm.config.js';
import { HealthController } from './health/health.controller.js';
import { SystemResolver } from './system/system.resolver.js';
import { TasksModule } from './tasks/tasks.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

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
      inject: [ConfigService, DataSource],
      useFactory: (config: ConfigService<AppConfig, true>, dataSource: DataSource) => ({
        autoSchemaFile: config.get('NODE_ENV', { infer: true }) === 'test' ? true : 'schema.gql',
        sortSchema: true,
        introspection: true,
        playground: false,
        // Fresh DataLoaders per request so batching/caching never leaks between users.
        context: ({ req }: { req: Request }) => ({ req, loaders: createLoaders(dataSource) }),
        formatError: formatGraphQLError,
      }),
    }),
    TerminusModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [SystemResolver, { provide: APP_FILTER, useClass: GqlPassthroughFilter }],
})
export class AppModule {}
