import { GraphQLError } from 'graphql';

/**
 * Domain errors surface to clients as GraphQL errors with a stable
 * `extensions.code`, which is what frontends should branch on.
 */
const error = (code: string, message: string, details?: unknown) =>
  new GraphQLError(message, { extensions: { code, ...(details !== undefined && { details }) } });

export const NotFound = (resource = 'Resource') => error('NOT_FOUND', `${resource} not found`);
export const Forbidden = (message = 'You do not have permission to perform this action') =>
  error('FORBIDDEN', message);
export const Unauthenticated = (message = 'Authentication required') =>
  error('UNAUTHENTICATED', message);
export const BadInput = (message: string, details?: unknown) =>
  error('BAD_USER_INPUT', message, details);
export const Conflict = (message: string) => error('CONFLICT', message);
