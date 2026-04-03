import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 身份密钥实体
 * 用于存储设备的身份密钥信息
 */
@Entity({ name: 'identity_keys' })
export class IdentityKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  /** 身份公钥 (Base64 编码) */
  @Column({ name: 'identity_public_key', type: 'text' })
  identityPublicKey!: string;

  /** 身份密钥指纹 */
  @Column({ name: 'fingerprint', type: 'varchar', length: 255 })
  fingerprint!: string;

  /** 签名预密钥公钥 (Base64 编码) */
  @Column({ name: 'signed_prekey_public', type: 'text', nullable: true })
  signedPrekeyPublic!: string | null;

  /** 签名预密钥签名 (Base64 编码) */
  @Column({ name: 'signed_prekey_signature', type: 'text', nullable: true })
  signedPrekeySignature!: string | null;

  /** 注册 ID (Signal 协议使用) */
  @Column({ name: 'registration_id', type: 'integer', nullable: true })
  registrationId!: number | null;

  /** 是否为当前活跃设备 */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
