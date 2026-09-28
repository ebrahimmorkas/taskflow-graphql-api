import { Logger } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';

const logger = new Logger('GraphQL');

const KNOWN_CODES = new Set([
  'NOT_FOUND',
  'FORBIDDEN',
  'UNAUTHENTICATED',
  'BAD_USER_INPUT',
  'CONFLICT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'QUERY_TOO_COMPLEX',
  'BAD_REQUEST',
]);

interface NestHttpErrorResponse {
  statusCode?: number;
  message?: string | string[];
}

/**
 * Normalises every error into `{ message, extensions: { code, details? } }`:
 * - class-validator failures (thrown by ValidationPipe as BadRequestException) become BAD_USER_INPUT
 * - known domain codes pass through
 * - anything else is logged and masked as INTERNAL_SERVER_ERROR (no stack traces leak)
 */
export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const extensions = formatted.extensions ?? {};
  const code = extensions.code as string | undefined;
  const original = extensions.originalError as NestHttpErrorResponse | undefined;

  if (original?.statusCode === 400) {
    const messages = Array.isArray(original.message) ? original.message : [original.message];
    return {
      message: 'Input validation failed',
      path: formatted.path,
      extensions: { code: 'BAD_USER_INPUT', details: messages },
    };
  }
  if (original?.statusCode === 401) {
    return {
      message: 'Authentication required',
      path: formatted.path,
      extensions: { code: 'UNAUTHENTICATED' },
    };
  }

  if (code && KNOWN_CODES.has(code)) {
    return {
      message: formatted.message,
      locations: formatted.locations,
      path: formatted.path,
      extensions: {
        code,
        ...(extensions.details !== undefined && { details: extensions.details }),
      },
    };
  }

  logger.error(formatted.message, (error as { stack?: string })?.stack);
  return {
    message: 'Internal server error',
    path: formatted.path,
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}
