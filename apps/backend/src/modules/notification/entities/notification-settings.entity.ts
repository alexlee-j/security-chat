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

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'boolean', default: true })
  messageEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  friendRequestEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  burnEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  groupEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
