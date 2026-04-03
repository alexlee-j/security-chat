import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 签名预密钥 (Signed PreKey)
 * 用于 Signal 协议的密钥协商
 */
@Entity('signed_pre_keys')
export class SignedPreKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Column()
  signedPreKeyId!: number;

  @Column('text')
  publicKey!: string;  // Base64

  @Column('text')
  signature!: string;  // Base64

  @Column()
  timestamp!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

/**
 * Kyber 预密钥 (用于后量子密码学)
 * 用于 ML-KEM (Kyber) 密钥封装
 */
@Entity('kyber_pre_keys')
export class KyberPreKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Column()
  kyberPreKeyId!: number;

  @Column('text')
  publicKey!: string;  // Base64

  @Column('text')
  signature!: string;  // Base64

  @Column()
  timestamp!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
