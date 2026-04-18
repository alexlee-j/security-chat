import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageDeviceEnvelopes1776354023968 implements MigrationInterface {
  name = 'AddMessageDeviceEnvelopes1776354023968';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "source_device_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "FK_messages_source_device"
      FOREIGN KEY ("source_device_id") REFERENCES "devices"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_source_device" ON "messages" ("source_device_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "message_device_envelopes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "target_user_id" uuid NOT NULL,
        "target_device_id" uuid NOT NULL,
        "source_device_id" uuid,
        "encrypted_payload" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_device_envelopes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_message_device_envelopes_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_message_device_envelopes_target_device" FOREIGN KEY ("target_device_id") REFERENCES "devices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_message_device_envelopes_source_device" FOREIGN KEY ("source_device_id") REFERENCES "devices"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_message_device_envelopes_message_device" ON "message_device_envelopes" ("message_id", "target_device_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_device_envelopes_target_device" ON "message_device_envelopes" ("target_device_id", "message_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "encrypted_payload" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    throw new Error(
      'Irreversible migration: message_device_envelopes introduces per-device ciphertext and cannot be safely downgraded without data loss.',
    );
  }
}
