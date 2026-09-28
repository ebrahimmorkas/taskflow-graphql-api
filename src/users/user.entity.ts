import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity('users')
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  name: string;

  // Never exposed through GraphQL (no @Field) and not selected by default.
  @Column({ type: 'varchar', length: 100, select: false })
  passwordHash: string;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
