import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1790587949562 implements MigrationInterface {
  name = 'CreateProjects1790587949562';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying(100) NOT NULL, "key" character varying(10) NOT NULL, "description" text NOT NULL DEFAULT '', "archived" boolean NOT NULL DEFAULT false, "taskCounter" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_863459c3a5d29f7d696e20ad0c" ON "projects"  ("workspaceId", "key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_108ff8a2d40c2b294511c92a7c8" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_108ff8a2d40c2b294511c92a7c8"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_863459c3a5d29f7d696e20ad0c"`);
    await queryRunner.query(`DROP TABLE "projects"`);
  }
}
