import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'messages' })
@Index(['conversationId', 'createdAt'])
@Index(['conversationId', 'messageIndex'])
@Index(['senderId'])
@Index(['isBurn', 'readAt'])
@Index(['nonce'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ name: 'message_type', type: 'smallint' })
  messageType!: number;

  @Column({ name: 'encrypted_payload', type: 'text' })
  encryptedPayload!: string;

  @Column({ type: 'varchar', length: 100 })
  nonce!: string;

  @Column({ name: 'media_asset_id', type: 'uuid', nullable: true })
  mediaAssetId!: string | null;

  @Column({ name: 'message_index', type: 'bigint' })
  messageIndex!: string;

  @Column({ name: 'is_burn', type: 'boolean', default: false })
  isBurn!: boolean;

  @Column({ name: 'burn_duration', type: 'integer', nullable: true })
  burnDuration!: number | null;

  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'is_forwarded', type: 'boolean', default: false })
  isForwarded!: boolean;

  @Column({ name: 'original_message_id', type: 'uuid', nullable: true })
  originalMessageId!: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
