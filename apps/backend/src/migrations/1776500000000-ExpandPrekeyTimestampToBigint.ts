import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPrekeyTimestampToBigint1776500000000 implements MigrationInterface {
  name = 'ExpandPrekeyTimestampToBigint1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kyber_pre_keys"
      ALTER COLUMN "timestamp" TYPE bigint
      USING "timestamp"::bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "signed_pre_keys"
      ALTER COLUMN "timestamp" TYPE bigint
      USING "timestamp"::bigint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kyber_pre_keys"
      ALTER COLUMN "timestamp" TYPE integer
      USING "timestamp"::integer
    `);
    await queryRunner.query(`
      ALTER TABLE "signed_pre_keys"
      ALTER COLUMN "timestamp" TYPE integer
      USING "timestamp"::integer
    `);
  }
}

