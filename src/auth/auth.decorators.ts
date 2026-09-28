import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface AuthUser {
  id: string;
  email: string;
}

export const IS_PUBLIC = 'isPublic';

/** Opts a resolver out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injects the authenticated user resolved by the guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    GqlExecutionContext.create(context).getContext().user,
);
