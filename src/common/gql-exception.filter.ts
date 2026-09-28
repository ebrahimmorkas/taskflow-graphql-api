import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';

/**
 * Hands every resolver error straight to Apollo. Without this, Nest logs each
 * expected domain error (NOT_FOUND, FORBIDDEN…) as an ERROR; `formatGraphQLError`
 * already logs only the unexpected ones.
 */
@Catch()
export class GqlPassthroughFilter implements GqlExceptionFilter {
  catch(exception: unknown) {
    return exception;
  }
}
