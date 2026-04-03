import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'revoke_events' })
export class RevokeEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'revoked_by', type: 'uuid' })
  revokedBy!: string;

  @CreateDateColumn({ name: 'revoked_at', type: 'timestamptz' })
  revokedAt!: Date;
}