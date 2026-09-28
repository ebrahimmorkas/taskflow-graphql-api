import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/auth.decorators.js';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/env.js';

@ObjectType()
export class SystemInfo {
  @Field(() => String)
  version: string;

  @Field(() => String)
  pubSubBackend: string;
}

@Resolver()
export class SystemResolver {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Public()
  @Query(() => SystemInfo, { description: 'API version and runtime backends' })
  system(): SystemInfo {
    return {
      version: '1.0.0',
      pubSubBackend: this.config.get('REDIS_ENABLED', { infer: true }) ? 'redis' : 'memory',
    };
  }
}
