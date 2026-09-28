import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { User } from '../../users/user.entity.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

@InputType()
export class SignUpInput {
  @Field(() => String)
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @Field(() => String)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Field(() => String)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: 'password must contain a letter' })
  @Matches(/[0-9]/, { message: 'password must contain a number' })
  password: string;
}

@InputType()
export class LogInInput {
  @Field(() => String)
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  password: string;
}

@ObjectType()
export class AuthPayload {
  @Field(() => String)
  token: string;

  @Field(() => User)
  user: User;
}
