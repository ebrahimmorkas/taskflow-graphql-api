import { createClient, type Client } from 'graphql-ws';

/** Empty means same origin: the Vite proxy in development. */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'taskflow.token';

export class GraphQLRequestError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.code = code;
    this.details = details;
  }
}

type Listener = (token: string | null) => void;

export const session = {
  listeners: new Set<Listener>(),
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    resetSubscriptionClient();
    this.listeners.forEach((l) => l(token));
  },
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  },
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string; details?: unknown } }[];
}

/**
 * A deliberately small GraphQL client: one POST per operation, typed result,
 * and the API's `{ message, extensions.code }` errors turned into exceptions.
 * Caching is left to TanStack Query.
 */
export async function gql<TData, TVars extends object = Record<string, never>>(
  query: string,
  variables?: TVars,
  signal?: AbortSignal,
): Promise<TData> {
  const token = session.token;
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as GraphQLResponse<TData> | null;
  const error = body?.errors?.[0];
  if (error) {
    const code = error.extensions?.code ?? 'ERROR';
    // An expired token ends the session everywhere.
    if (code === 'UNAUTHENTICATED' && token) session.set(null);
    throw new GraphQLRequestError(describe(error.message, error.extensions?.details), code);
  }
  if (!res.ok || !body?.data) {
    throw new GraphQLRequestError(`Request failed with status ${res.status}`);
  }
  return body.data;
}

function describe(message: string, details: unknown) {
  if (Array.isArray(details) && typeof details[0] === 'string') return details[0];
  return message;
}

let wsClient: Client | null = null;

/** One lazily opened WebSocket shared by every subscription; it reconnects on its own. */
export function subscriptionClient() {
  wsClient ??= createClient({
    url: toWsUrl(`${API_URL}/graphql`),
    lazy: true,
    retryAttempts: Infinity,
    shouldRetry: () => true,
    // The server authenticates the socket once, when it connects.
    connectionParams: () => ({ authorization: `Bearer ${session.token ?? ''}` }),
  });
  return wsClient;
}

function resetSubscriptionClient() {
  void wsClient?.dispose();
  wsClient = null;
}

function toWsUrl(url: string) {
  const absolute = new URL(url, window.location.href);
  absolute.protocol = absolute.protocol === 'https:' ? 'wss:' : 'ws:';
  return absolute.toString();
}

export function errorMessage(error: unknown): string {
  if (error instanceof GraphQLRequestError) return error.message;
  if (error instanceof TypeError) return 'Cannot reach the server. Is the API running?';
  return error instanceof Error ? error.message : 'Something went wrong';
}
