import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1790588220409 implements MigrationInterface {
  name = 'CreateTasks1790588220409';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."task_status" AS ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "number" integer NOT NULL, "title" character varying(200) NOT NULL, "description" text NOT NULL DEFAULT '', "status" "public"."task_status" NOT NULL DEFAULT 'TODO', "priority" "public"."task_priority" NOT NULL DEFAULT 'MEDIUM', "assigneeId" uuid, "reporterId" uuid NOT NULL, "dueDate" date, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a16d2c86252529f622fa53f1e" ON "tasks"  ("assigneeId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d41cf142c3c968c6a2d94abbb" ON "tasks"  ("projectId", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a5274e73fdd30b9b7abf58c89a" ON "tasks"  ("projectId", "number") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."activity_type" AS ENUM('CREATED', 'UPDATED', 'COMMENTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "actorId" uuid NOT NULL, "type" "public"."activity_type" NOT NULL, "changes" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a8f24c7952c9ff5533f88279941" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bedfe4c36ae4bd1116b26e1ca1" ON "task_activity"  ("taskId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_e08fca67ca8966e6b9914bf2956" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_9a16d2c86252529f622fa53f1e3" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_7ecc6be7d74a3f441f7aa5215ef" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_activity" ADD CONSTRAINT "FK_dd4d1f026f618e434d9254c0d68" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_activity" ADD CONSTRAINT "FK_ed6ff5529f7422f3056e6b4858c" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_activity" DROP CONSTRAINT "FK_ed6ff5529f7422f3056e6b4858c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_activity" DROP CONSTRAINT "FK_dd4d1f026f618e434d9254c0d68"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_7ecc6be7d74a3f441f7aa5215ef"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_9a16d2c86252529f622fa53f1e3"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_e08fca67ca8966e6b9914bf2956"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bedfe4c36ae4bd1116b26e1ca1"`);
    await queryRunner.query(`DROP TABLE "task_activity"`);
    await queryRunner.query(`DROP TYPE "public"."activity_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a5274e73fdd30b9b7abf58c89a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7d41cf142c3c968c6a2d94abbb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9a16d2c86252529f622fa53f1e"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "public"."task_priority"`);
    await queryRunner.query(`DROP TYPE "public"."task_status"`);
  }
}
