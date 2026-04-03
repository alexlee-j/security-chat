import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704067200000 implements MigrationInterface {
  name = 'InitialSchema1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 启用扩展
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 创建 users 表
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" varchar(50) NOT NULL UNIQUE,
        "email" varchar(100) NOT NULL UNIQUE,
        "phone" varchar(20) UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "avatar_url" text,
        "bio" varchar(200),
        "status" smallint NOT NULL DEFAULT 1,
        "identity_public_key" text,
        "identity_key_fingerprint" varchar(255),
        "registration_id" integer,
        "signal_version" integer NOT NULL DEFAULT 3,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email") `);
    await queryRunner.query(`CREATE INDEX "IDX_users_username" ON "users" ("username") `);

    // 创建 devices 表
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "device_name" varchar(100) NOT NULL,
        "device_type" varchar(20) NOT NULL,
        "identity_public_key" text NOT NULL,
        "signed_pre_key" text NOT NULL,
        "signed_pre_key_signature" text NOT NULL,
        "registration_id" integer,
        "signal_version" varchar(20) NOT NULL DEFAULT 'v1',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_active_at" timestamptz,
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_devices_user_id" ON "devices" ("user_id") `);

    // 创建 one_time_prekeys 表
    await queryRunner.query(`
      CREATE TABLE "one_time_prekeys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "device_id" uuid NOT NULL,
        "key_id" integer NOT NULL,
        "public_key" text NOT NULL,
        "is_used" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_one_time_prekeys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_one_time_prekeys_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_one_time_prekeys_device_id" ON "one_time_prekeys" ("device_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_one_time_prekeys_key_id" ON "one_time_prekeys" ("key_id", "is_used") `);

    // 创建 signed_pre_keys 表
    await queryRunner.query(`
      CREATE TABLE "signed_pre_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "signed_pre_key_id" integer NOT NULL,
        "public_key" text NOT NULL,
        "signature" text NOT NULL,
        "timestamp" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signed_pre_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_signed_pre_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_signed_pre_keys_user_id" ON "signed_pre_keys" ("user_id") `);

    // 创建 kyber_pre_keys 表
    await queryRunner.query(`
      CREATE TABLE "kyber_pre_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "kyber_pre_key_id" integer NOT NULL,
        "public_key" text NOT NULL,
        "signature" text NOT NULL,
        "timestamp" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyber_pre_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kyber_pre_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_kyber_pre_keys_user_id" ON "kyber_pre_keys" ("user_id") `);

    // 创建 key_verifications 表
    await queryRunner.query(`
      CREATE TABLE "key_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "verified_user_id" uuid NOT NULL,
        "verified_device_id" varchar(255),
        "fingerprint" varchar(255) NOT NULL,
        "is_verified" boolean NOT NULL DEFAULT false,
        "verified_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_key_verifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_key_verifications_user_verified" ON "key_verifications" ("user_id", "verified_user_id") `);

    // 创建 friendships 表
    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" uuid NOT NULL,
        "addressee_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_friendships_requester" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_friendships_addressee" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_friendships_requester" ON "friendships" ("requester_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_friendships_addressee" ON "friendships" ("addressee_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_friendships_unique" ON "friendships" ("requester_id", "addressee_id") `);

    // 创建 conversations 表
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" smallint NOT NULL DEFAULT 1,
        "name" varchar(255),
        "avatar_url" text,
        "burn_duration" integer,
        "is_burn_enabled" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      )
    `);

    // 创建 conversation_members 表
    await queryRunner.query(`
      CREATE TABLE "conversation_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" smallint NOT NULL DEFAULT 0,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        "last_read_index" bigint NOT NULL DEFAULT 0,
        "last_read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_members_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversation_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_conversation_members_conversation" ON "conversation_members" ("conversation_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_conversation_members_user" ON "conversation_members" ("user_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_conversation_members_unique" ON "conversation_members" ("conversation_id", "user_id") `);

    // 创建 messages 表
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "message_type" smallint NOT NULL,
        "encrypted_payload" text NOT NULL,
        "nonce" varchar(64) NOT NULL,
        "media_asset_id" uuid,
        "message_index" bigint NOT NULL,
        "is_burn" boolean NOT NULL DEFAULT false,
        "burn_duration" integer,
        "is_revoked" boolean NOT NULL DEFAULT false,
        "delivered_at" timestamptz,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_messages_conversation" ON "messages" ("conversation_id", "created_at" DESC) `);
    await queryRunner.query(`CREATE INDEX "IDX_messages_conversation_index" ON "messages" ("conversation_id", "message_index") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_messages_unique_index" ON "messages" ("conversation_id", "message_index") `);

    // 创建 draft_messages 表
    await queryRunner.query(`
      CREATE TABLE "draft_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "conversation_id" uuid NOT NULL,
        "message_type" smallint NOT NULL,
        "encrypted_payload" text NOT NULL,
        "nonce" varchar(64) NOT NULL,
        "media_asset_id" uuid,
        "is_burn" boolean NOT NULL DEFAULT false,
        "burn_duration" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_draft_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_draft_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_draft_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_draft_messages_unique" ON "draft_messages" ("user_id", "conversation_id") `);

    // 创建 media_assets 表
    await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "uploader_id" uuid NOT NULL,
        "media_kind" smallint NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "file_size" bigint NOT NULL,
        "file_name" varchar(255),
        "storage_path" text NOT NULL,
        "sha256" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_assets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_media_assets_uploader" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_media_assets_uploader" ON "media_assets" ("uploader_id") `);

    // 创建 burn_events 表
    await queryRunner.query(`
      CREATE TABLE "burn_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "conversation_id" uuid NOT NULL,
        "burned_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_burn_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_burn_events_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_burn_events_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_burn_events_message" ON "burn_events" ("message_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_burn_events_conversation" ON "burn_events" ("conversation_id", "burned_at") `);

    // 创建 notifications 表
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "body" text,
        "data" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user" ON "notifications" ("user_id", "is_read", "created_at" DESC) `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "burn_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "media_assets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "draft_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "key_verifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kyber_pre_keys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signed_pre_keys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "one_time_prekeys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
  }
}
