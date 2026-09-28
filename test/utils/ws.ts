import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { createClient, type Client } from 'graphql-ws';
import WebSocket from 'ws';

export async function listen(app: INestApplication): Promise<string> {
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `ws://localhost:${port}/graphql`;
}

export function wsClient(url: string, token?: string): Client {
  return createClient({
    url,
    webSocketImpl: WebSocket,
    connectionParams: token ? { authorization: `Bearer ${token}` } : {},
    retryAttempts: 0,
  });
}

export interface Subscription<T> {
  /** Resolves with the next event (or rejects on error). */
  next(): Promise<T>;
  dispose(): void;
}

/**
 * Subscribes and waits briefly so the server has registered the subscription
 * before the test triggers a mutation.
 */
export async function subscribe<T = Record<string, any>>(
  client: Client,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Subscription<T>> {
  const events: T[] = [];
  const waiters: { resolve: (v: T) => void; reject: (e: unknown) => void }[] = [];
  let failure: unknown;

  const dispose = client.subscribe<T>(
    { query, variables },
    {
      next: ({ data, errors }) => {
        if (errors) {
          failure = errors;
          waiters.splice(0).forEach((w) => w.reject(errors));
          return;
        }
        const waiter = waiters.shift();
        if (waiter) waiter.resolve(data as T);
        else events.push(data as T);
      },
      error: (err) => {
        failure = err;
        waiters.splice(0).forEach((w) => w.reject(err));
      },
      complete: () => undefined,
    },
  );

  await new Promise((r) => setTimeout(r, 300));

  return {
    next: () =>
      new Promise<T>((resolve, reject) => {
        if (failure) return reject(failure);
        const queued = events.shift();
        if (queued) return resolve(queued);
        const timer = setTimeout(() => reject(new Error('timed out waiting for event')), 3000);
        waiters.push({
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      }),
    dispose,
  };
}
