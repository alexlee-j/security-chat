import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'key_verifications' })
@Unique(['userId', 'verifiedUserId', 'verifiedDeviceId'])
export class KeyVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'verified_user_id', type: 'uuid' })
  verifiedUserId!: string;

  @Column({ name: 'verified_device_id', type: 'uuid', nullable: true })
  verifiedDeviceId!: string | null;

  @Column({ name: 'fingerprint', type: 'varchar', length: 255 })
  fingerprint!: string;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
