import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignalDeviceIdAndConversationHidden1777100000000 implements MigrationInterface {
  name = 'AddSignalDeviceIdAndConversationHidden1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD COLUMN IF NOT EXISTS "signal_device_id" smallint
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        overflow_user uuid;
      BEGIN
        SELECT user_id INTO overflow_user
        FROM devices
        GROUP BY user_id
        HAVING COUNT(*) > 127
        LIMIT 1;

        IF overflow_user IS NOT NULL THEN
          RAISE EXCEPTION 'Cannot assign signal_device_id: user % has more than 127 devices', overflow_user;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS signal_device_id
        FROM devices
        WHERE signal_device_id IS NULL
      )
      UPDATE devices d
      SET signal_device_id = numbered.signal_device_id
      FROM numbered
      WHERE d.id = numbered.id
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD CONSTRAINT "CHK_devices_signal_device_id_range"
      CHECK ("signal_device_id" BETWEEN 1 AND 127)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_devices_user_signal_device"
      ON "devices" ("user_id", "signal_device_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "devices"
      ALTER COLUMN "signal_device_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "conversation_members"
      ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN IF EXISTS "hidden"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_user_signal_device"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "CHK_devices_signal_device_id_range"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "signal_device_id"`);
  }
}
