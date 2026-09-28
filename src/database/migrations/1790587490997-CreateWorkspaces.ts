import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaces1790587490997 implements MigrationInterface {
  name = 'CreateWorkspaces1790587490997';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b8e9fe62e93d60089dfc4f175f3" UNIQUE ("slug"), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workspace_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."workspace_role" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_187d573e43b2c2aa3960df20b7" ON "memberships"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b4aa57a22a5eb10228c7b21a8f" ON "memberships"  ("workspaceId", "userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_5a480a4394c7b8a74da1cb66a2f" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_187d573e43b2c2aa3960df20b78" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_187d573e43b2c2aa3960df20b78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_5a480a4394c7b8a74da1cb66a2f"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_b4aa57a22a5eb10228c7b21a8f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_187d573e43b2c2aa3960df20b7"`);
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TYPE "public"."workspace_role"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
  }
}
