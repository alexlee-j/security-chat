import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallRecords1777000000000 implements MigrationInterface {
  name = 'AddCallRecords1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "call_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "caller_user_id" uuid NOT NULL,
        "callee_user_id" uuid NOT NULL,
        "caller_device_id" uuid,
        "accepted_device_id" uuid,
        "outcome" varchar(32) NOT NULL,
        "started_at" timestamptz,
        "accepted_at" timestamptz,
        "ended_at" timestamptz,
        "duration_seconds" integer,
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_call_records_conversation_created"
      ON "call_records" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_call_records_caller"
      ON "call_records" ("caller_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_call_records_callee"
      ON "call_records" ("callee_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_records_callee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_records_caller"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_records_conversation_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "call_records"`);
  }
}
