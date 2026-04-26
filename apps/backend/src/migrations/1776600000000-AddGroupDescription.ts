import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupDescription1776600000000 implements MigrationInterface {
  name = 'AddGroupDescription1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "description" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "description"`);
  }
}

