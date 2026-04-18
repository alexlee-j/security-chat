import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'message_device_envelopes' })
@Index(['messageId', 'targetDeviceId'], { unique: true })
@Index(['targetDeviceId', 'messageId'])
export class MessageDeviceEnvelope {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId!: string;

  @Column({ name: 'target_device_id', type: 'uuid' })
  targetDeviceId!: string;

  @Column({ name: 'source_device_id', type: 'uuid', nullable: true })
  sourceDeviceId!: string | null;

  @Column({ name: 'encrypted_payload', type: 'text' })
  encryptedPayload!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
