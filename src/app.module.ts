import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import type { Context as WsContext } from 'graphql-ws';
import { DataSource } from 'typeorm';
import type { AuthUser } from './auth/auth.decorators.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthService } from './auth/auth.service.js';
import { CommentsModule } from './comments/comments.module.js';
import { formatGraphQLError } from './common/format-error.js';
import { GqlPassthroughFilter } from './common/gql-exception.filter.js';
import { createLoaders } from './common/loaders.js';
import { validateEnv, type AppConfig } from './config/env.js';
import { buildDataSourceOptions } from './database/typeorm.config.js';
import { HealthController } from './health/health.controller.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PubSubModule } from './pubsub/pubsub.module.js';
import { SystemResolver } from './system/system.resolver.js';
import { TasksModule } from './tasks/tasks.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

type GraphQLWsContext = WsContext<Record<string, unknown> | undefined>;

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
      imports: [AuthModule],
      inject: [ConfigService, DataSource, AuthService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        dataSource: DataSource,
        auth: AuthService,
      ) => ({
        autoSchemaFile: config.get('NODE_ENV', { infer: true }) === 'test' ? true : 'schema.gql',
        sortSchema: true,
        introspection: true,
        playground: false,
        subscriptions: {
          'graphql-ws': {
            // WebSocket clients authenticate once, in connectionParams.
            onConnect: (ctx: GraphQLWsContext) => {
              const params = ctx.connectionParams ?? {};
              const raw = params.authorization ?? params.Authorization;
              if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) return false;
              try {
                (ctx.extra as { user?: AuthUser }).user = auth.verifyToken(
                  raw.slice('Bearer '.length),
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
        // Fresh DataLoaders per request/subscription so caches never leak between users.
        context: ({ req, extra }: { req?: Request; extra?: { user?: AuthUser } }) => ({
          req,
          user: extra?.user,
          loaders: createLoaders(dataSource),
        }),
        formatError: formatGraphQLError,
      }),
    }),
    TerminusModule,
    PubSubModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
  ],
  controllers: [HealthController],
  providers: [SystemResolver, { provide: APP_FILTER, useClass: GqlPassthroughFilter }],
})
export class AppModule {}
