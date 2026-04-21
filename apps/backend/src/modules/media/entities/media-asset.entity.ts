import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'media_assets' })
@Index(['uploaderId'])
@Index(['conversationId'])
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ name: 'media_kind', type: 'smallint' })
  mediaKind!: number;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'sha256', type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'encryption_version', type: 'smallint', default: 0 })
  encryptionVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
