import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Unauthenticated } from '../common/errors.js';
import { IS_PUBLIC } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

/**
 * Global guard: every GraphQL operation requires a valid JWT unless marked
 * @Public(). HTTP requests read the Authorization header; WebSocket
 * subscriptions are authenticated once in `onConnect` and carry `user` in context.
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<string>() !== 'graphql') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const ctx = GqlExecutionContext.create(context).getContext();
    if (ctx.user) return true;

    const header: string | undefined = ctx.req?.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthenticated();
    ctx.user = this.auth.verifyToken(header.slice('Bearer '.length));
    return true;
  }
}
