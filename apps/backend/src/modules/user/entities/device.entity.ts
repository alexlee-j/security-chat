import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'device_name', type: 'varchar', length: 100 })
  deviceName!: string;

  @Column({ name: 'device_type', type: 'varchar', length: 20 })
  deviceType!: 'ios' | 'android' | 'mac' | 'windows' | 'linux';

  @Column({ name: 'identity_public_key', type: 'text' })
  identityPublicKey!: string;

  @Column({ name: 'signed_pre_key', type: 'text' })
  signedPreKey!: string;

  @Column({ name: 'signed_pre_key_signature', type: 'text' })
  signedPreKeySignature!: string;

  @Column({ name: 'registration_id', type: 'int', nullable: true })
  registrationId!: number | null;

  @Column({ name: 'signal_version', type: 'varchar', length: 20, default: 'v1' })
  signalVersion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt!: Date | null;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
