import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'notification_settings' })
@Index(['userId'], { unique: true })
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'message_enabled', type: 'boolean', default: true })
  messageEnabled!: boolean;

  @Column({ name: 'friend_request_enabled', type: 'boolean', default: true })
  friendRequestEnabled!: boolean;

  @Column({ name: 'burn_enabled', type: 'boolean', default: true })
  burnEnabled!: boolean;

  @Column({ name: 'group_enabled', type: 'boolean', default: true })
  groupEnabled!: boolean;

  @Column({ name: 'account_recovery_enabled', type: 'boolean', default: true })
  accountRecoveryEnabled!: boolean;

  @Column({ name: 'security_event_enabled', type: 'boolean', default: true })
  securityEventEnabled!: boolean;

  @Column({ name: 'group_lifecycle_enabled', type: 'boolean', default: true })
  groupLifecycleEnabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
