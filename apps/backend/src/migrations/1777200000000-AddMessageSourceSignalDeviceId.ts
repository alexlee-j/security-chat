import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageSourceSignalDeviceId1777200000000 implements MigrationInterface {
  name = 'AddMessageSourceSignalDeviceId1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "source_signal_device_id" smallint;
    `);
    await queryRunner.query(`
      UPDATE "messages" m
      SET "source_signal_device_id" = d."signal_device_id"
      FROM "devices" d
      WHERE m."source_device_id" = d."id"
        AND m."source_signal_device_id" IS NULL
        AND d."signal_device_id" IS NOT NULL;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'CHK_messages_source_signal_device_id_range'
        ) THEN
          ALTER TABLE "messages"
          ADD CONSTRAINT "CHK_messages_source_signal_device_id_range"
          CHECK ("source_signal_device_id" IS NULL OR "source_signal_device_id" BETWEEN 1 AND 127);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP CONSTRAINT IF EXISTS "CHK_messages_source_signal_device_id_range";
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "source_signal_device_id";
    `);
  }
}
