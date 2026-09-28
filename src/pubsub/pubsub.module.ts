import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/env.js';

export const PUB_SUB = Symbol('PUB_SUB');

/** The subset of the PubSub API the app relies on; both backends implement it. */
export interface PubSubPort {
  publish(trigger: string, payload: unknown): Promise<void>;
  asyncIterableIterator<T>(triggers: string | string[]): AsyncIterableIterator<T>;
}

/**
 * GraphQL subscription transport.
 * - REDIS_ENABLED=false: in-memory PubSub (events only reach clients on this instance)
 * - REDIS_ENABLED=true: Redis PubSub, so a mutation handled by instance A
 *   notifies subscribers connected to instance B
 */
@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): PubSubPort => {
        if (!config.get('REDIS_ENABLED', { infer: true })) {
          Logger.log('PubSub backend: memory', 'PubSub');
          return new PubSub();
        }
        const url = config.get('REDIS_URL', { infer: true });
        Logger.log('PubSub backend: redis', 'PubSub');
        return new RedisPubSub({
          publisher: new Redis(url),
          subscriber: new Redis(url),
          // Revive Date fields that JSON turned into strings.
          reviver: (_key, value) =>
            typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
              ? new Date(value)
              : value,
        }) as unknown as PubSubPort;
      },
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule implements OnApplicationShutdown {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSubPort) {}

  async onApplicationShutdown() {
    if (this.pubSub instanceof RedisPubSub) await this.pubSub.close();
  }
}
