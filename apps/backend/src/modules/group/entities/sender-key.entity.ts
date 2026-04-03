import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sender_keys' })
@Index(['groupId', 'userId'], { unique: true })
export class SenderKey {
  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** 加密的 Sender Key (Base64 编码) */
  @Column({ name: 'sender_key', type: 'text' })
  senderKey!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
