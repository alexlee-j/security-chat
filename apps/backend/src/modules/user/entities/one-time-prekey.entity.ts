import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'one_time_prekeys' })
@Index(['deviceId', 'isUsed'])
@Unique(['deviceId', 'keyId'])
export class OneTimePrekey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ name: 'key_id', type: 'integer', nullable: true })
  keyId!: number | null;

  @Column({ name: 'public_key', type: 'text' })
  publicKey!: string;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
