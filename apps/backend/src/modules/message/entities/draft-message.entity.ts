import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'draft_messages' })
@Index(['userId', 'conversationId'], { unique: true })
export class DraftMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'message_type', type: 'smallint' })
  messageType!: number;

  @Column({ name: 'encrypted_payload', type: 'text' })
  encryptedPayload!: string;

  @Column({ type: 'varchar', length: 100 })
  nonce!: string;

  @Column({ name: 'media_asset_id', type: 'uuid', nullable: true })
  mediaAssetId!: string | null;

  @Column({ name: 'is_burn', type: 'boolean', default: false })
  isBurn!: boolean;

  @Column({ name: 'burn_duration', type: 'integer', nullable: true })
  burnDuration!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
