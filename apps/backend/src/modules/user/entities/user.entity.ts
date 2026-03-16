import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Device } from './device.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bio!: string | null;

  @Column({ type: 'smallint', default: 1 })
  status!: number;

  @Column({ name: 'identity_public_key', type: 'text', nullable: true })
  identityPublicKey!: string | null;

  @Column({ name: 'identity_key_fingerprint', type: 'varchar', length: 255, nullable: true })
  identityKeyFingerprint!: string | null;

  @Column({ name: 'registration_id', type: 'integer', nullable: true })
  registrationId!: number | null;

  @Column({ name: 'signal_version', type: 'integer', default: 3 })
  signalVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Device, (device) => device.user)
  devices!: Device[];

  @BeforeInsert()
  normalizeFields(): void {
    this.email = this.email.trim().toLowerCase();
    this.phone = this.phone.trim();
    this.username = this.username.trim();
  }
}
