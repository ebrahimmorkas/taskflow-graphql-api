import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../config/env.js';
import { User } from '../users/user.entity.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { GqlAuthGuard } from './gql-auth.guard.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): JwtModuleOptions => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_TTL', { infer: true }) as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
        },
      }),
    }),
  ],
  providers: [AuthService, AuthResolver, { provide: APP_GUARD, useClass: GqlAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
