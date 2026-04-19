import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationSettingsAndV2Types1776700000000 implements MigrationInterface {
  name = 'AddNotificationSettingsAndV2Types1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL UNIQUE,
        "message_enabled" boolean NOT NULL DEFAULT true,
        "friend_request_enabled" boolean NOT NULL DEFAULT true,
        "burn_enabled" boolean NOT NULL DEFAULT true,
        "group_enabled" boolean NOT NULL DEFAULT true,
        "account_recovery_enabled" boolean NOT NULL DEFAULT true,
        "security_event_enabled" boolean NOT NULL DEFAULT true,
        "group_lifecycle_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_settings_user_id" UNIQUE ("user_id")
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_settings"
      ADD COLUMN IF NOT EXISTS "account_recovery_enabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_settings"
      ADD COLUMN IF NOT EXISTS "security_event_enabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_settings"
      ADD COLUMN IF NOT EXISTS "group_lifecycle_enabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_settings_user_id"
      ON "notification_settings" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_settings_user_id"`);
    await queryRunner.query(`
      ALTER TABLE "notification_settings" DROP COLUMN IF EXISTS "group_lifecycle_enabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_settings" DROP COLUMN IF EXISTS "security_event_enabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_settings" DROP COLUMN IF EXISTS "account_recovery_enabled"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_settings"`);
  }
}

