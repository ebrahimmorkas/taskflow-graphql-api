import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { Conflict, Unauthenticated } from '../common/errors.js';
import { User } from '../users/user.entity.js';
import type { AuthUser } from './auth.decorators.js';
import type { LogInInput, SignUpInput } from './dto/auth.inputs.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async signUp(input: SignUpInput) {
    if (await this.users.existsBy({ email: input.email })) {
      throw Conflict('Email is already registered');
    }
    const user = await this.users.save(
      this.users.create({
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      }),
    );
    return { user, token: this.sign(user) };
  }

  async logIn(input: LogInInput) {
    const user = await this.users.findOne({
      where: { email: input.email },
      select: { id: true, email: true, name: true, createdAt: true, passwordHash: true },
    });
    // Compare against a dummy hash for unknown emails to keep timing uniform.
    this.dummyHash ??= bcrypt.hash('timing-safe-dummy', BCRYPT_ROUNDS);
    const valid = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) throw Unauthenticated('Invalid email or password');

    const { passwordHash: _omit, ...publicUser } = user;
    return { user: publicUser as User, token: this.sign(user) };
  }

  verifyToken(token: string): AuthUser {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(token);
      return { id: payload.sub, email: payload.email };
    } catch {
      throw Unauthenticated('Invalid or expired token');
    }
  }

  private sign(user: User) {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }
}
