import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NotFound } from '../common/errors.js';
import { User } from '../users/user.entity.js';
import { CurrentUser, Public, type AuthUser } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { AuthPayload, LogInInput, SignUpInput } from './dto/auth.inputs.js';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Mutation(() => AuthPayload)
  signUp(@Args('input', { type: () => SignUpInput }) input: SignUpInput) {
    return this.auth.signUp(input);
  }

  @Public()
  @Mutation(() => AuthPayload)
  logIn(@Args('input', { type: () => LogInInput }) input: LogInInput) {
    return this.auth.logIn(input);
  }

  @Query(() => User)
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.users.findOneBy({ id: user.id });
    if (!found) throw NotFound('User');
    return found;
  }
}
