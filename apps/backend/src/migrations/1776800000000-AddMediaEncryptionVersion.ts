import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaEncryptionVersion1776800000000 implements MigrationInterface {
  name = 'AddMediaEncryptionVersion1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media_assets"
      ADD COLUMN IF NOT EXISTS "encryption_version" smallint NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media_assets"
      DROP COLUMN IF EXISTS "encryption_version"
    `);
  }
}
