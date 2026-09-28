import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

@InputType()
export class CreateProjectInput {
  @Field(() => ID)
  @IsUUID()
  workspaceId: string;

  @Field(() => String)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Field(() => String, { description: '2-6 letters, e.g. WEB' })
  @Transform(upper)
  @Matches(/^[A-Z][A-Z0-9]{1,5}$/, {
    message: 'key must be 2-6 letters/digits starting with a letter',
  })
  key: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

@InputType()
export class UpdateProjectInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
