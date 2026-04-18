import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationService } from '../conversation/conversation.service';
import { MediaAsset } from './entities/media-asset.entity';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/**
 * 文件 magic bytes 签名定义
 * 用于验证上传文件的真实类型
 */
const FILE_SIGNATURES: Record<string, { magic: number[]; offset?: number; kind: number }> = {
  // JPEG - starts with FF D8 FF
  'image/jpeg': { magic: [0xff, 0xd8, 0xff], kind: 2 },
  // PNG - starts with 89 50 4E 47 0D 0A 1A 0A
  'image/png': { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], kind: 2 },
  // GIF87a - 47 49 46 38 37 61
  'image/gif': { magic: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], kind: 2 },
  // GIF89a - 47 49 46 38 39 61
  'image/gif87a': { magic: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], kind: 2 },
  // MP3 - starts with FF FB or FF F3 or FF F2 (MPEG audio frame)
  'audio/mpeg': { magic: [0xff, 0xfb], offset: 0, kind: 3 },
  // WAV - starts with RIFF....WAVE (52 49 46 46 ... 57 41 56 45)
  'audio/wav': { magic: [0x52, 0x49, 0x46, 0x46], offset: 0, kind: 3 },
  // WebM / MKV - starts with 1A 45 DF A3
  'video/webm': { magic: [0x1a, 0x45, 0xdf, 0xa3], kind: 4 },
  // MP4 - starts with 00 00 00 XX 66 74 79 70 (freebox mtyp)
  'video/mp4': { magic: [0x66, 0x74, 0x79, 0x70], offset: 4, kind: 4 },
};

@Injectable()
export class MediaService {
  private readonly mediaRoot: string;
  private readonly maxBytes: number;

  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepository: Repository<MediaAsset>,
    private readonly configService: ConfigService,
    private readonly conversationService: ConversationService,
  ) {
    this.mediaRoot = this.configService.get<string>('MEDIA_ROOT', '/tmp/security-chat-media');
    this.maxBytes = Number(this.configService.get<string>('MEDIA_MAX_BYTES', String(100 * 1024 * 1024)));
  }

  async upload(
    userId: string,
    file: UploadFile | undefined,
    mediaKind?: number,
  ): Promise<{
    mediaAssetId: string;
    mediaKind: number;
    mimeType: string;
    fileSize: number;
    sha256: string;
    createdAt: string;
  }> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!file.buffer || !file.originalname) {
      throw new BadRequestException('invalid file upload');
    }

    if (file.size <= 0 || file.size > this.maxBytes) {
      throw new BadRequestException(`file size must be between 1 and ${this.maxBytes} bytes`);
    }

    // 验证文件 magic bytes 确保文件类型与声明的 MIME type 一致
    this.validateMagicBytes(file.buffer, file.mimetype);

    const resolvedKind = mediaKind ?? this.resolveMediaKind(file.mimetype);
    if (![2, 3, 4].includes(resolvedKind)) {
      throw new BadRequestException('mediaKind must be one of [2,3,4]');
    }

    const id = randomUUID();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const extension = extname(file.originalname || '').slice(0, 10);
    const now = new Date();
    const dir = join(this.mediaRoot, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'));
    const fileName = `${id}${extension}`;
    const fullPath = join(dir, fileName);

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, file.buffer);

    const saved = await this.mediaAssetRepository.save(
      this.mediaAssetRepository.create({
        id,
        uploaderId: userId,
        conversationId: null,
        mediaKind: resolvedKind,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        fileSize: String(file.size),
        storagePath: fullPath,
        sha256,
      }),
    );

    return {
      mediaAssetId: saved.id,
      mediaKind: saved.mediaKind,
      mimeType: saved.mimeType,
      fileSize: Number(saved.fileSize),
      sha256: saved.sha256,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async attachToConversation(
    userId: string,
    mediaAssetId: string,
    conversationId: string,
  ): Promise<{ attached: true; mediaAssetId: string; conversationId: string }> {
    const asset = await this.mediaAssetRepository.findOne({ where: { id: mediaAssetId } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.uploaderId !== userId) {
      throw new ForbiddenException('Only uploader can attach media asset');
    }

    await this.conversationService.assertMember(conversationId, userId);

    if (asset.conversationId && asset.conversationId !== conversationId) {
      throw new BadRequestException('Media asset already attached to another conversation');
    }

    asset.conversationId = conversationId;
    await this.mediaAssetRepository.save(asset);

    return {
      attached: true,
      mediaAssetId,
      conversationId,
    };
  }

  async copyForConversation(
    userId: string,
    mediaAssetId: string,
    conversationId: string,
  ): Promise<{ mediaAssetId: string; conversationId: string }> {
    const asset = await this.mediaAssetRepository.findOne({ where: { id: mediaAssetId } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    // 验证权限：必须是上传者或原始会话成员才能复制（不允许仅因是目标会话成员就复制）
    const isUploader = asset.uploaderId === userId;
    const isOriginalConversationMember = asset.conversationId
      ? await this.isConversationMember(asset.conversationId, userId)
      : false;

    if (!isUploader && !isOriginalConversationMember) {
      throw new ForbiddenException('Not allowed to copy this media asset');
    }

    // 验证目标会话成员身份
    await this.conversationService.assertMember(conversationId, userId);

    // 幂等保护：相同 source+target+operator 在并发重试时只生成一条复制记录。
    const copied = await this.mediaAssetRepository.manager.transaction(async (manager) => {
      const lockKey = `media.copy:${mediaAssetId}:${conversationId}:${userId}`;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1));', [lockKey]);

      const existing = await manager.findOne(MediaAsset, {
        where: {
          uploaderId: userId,
          conversationId,
          storagePath: asset.storagePath,
          sha256: asset.sha256,
          mediaKind: asset.mediaKind,
        },
      });
      if (existing) {
        return existing;
      }

      const newId = randomUUID();
      return await manager.save(
        MediaAsset,
        manager.create(MediaAsset, {
          id: newId,
          // 复制后的资产归当前转发者所有，才能通过 send-v2 的 uploader 校验。
          uploaderId: userId,
          conversationId, // 绑定到目标会话
          mediaKind: asset.mediaKind,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          storagePath: asset.storagePath, // 复用相同存储路径
          sha256: asset.sha256,
        }),
      );
    });

    return {
      mediaAssetId: copied.id,
      conversationId,
    };
  }

  async getMediaMeta(
    userId: string,
    mediaAssetId: string,
  ): Promise<{
    mediaAssetId: string;
    mediaKind: number;
    mimeType: string;
    fileSize: number;
    sha256: string;
    originalName: string;
    conversationId: string | null;
    createdAt: string;
  }> {
    const asset = await this.assertReadable(userId, mediaAssetId);
    return {
      mediaAssetId: asset.id,
      mediaKind: asset.mediaKind,
      mimeType: asset.mimeType,
      fileSize: Number(asset.fileSize),
      sha256: asset.sha256,
      originalName: asset.originalName,
      conversationId: asset.conversationId,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  async getDownloadSource(
    userId: string,
    mediaAssetId: string,
  ): Promise<{ fileName: string; mimeType: string; stream: NodeJS.ReadableStream }> {
    const asset = await this.assertReadable(userId, mediaAssetId);

    try {
      await access(asset.storagePath);
    } catch {
      throw new NotFoundException('Media file not found in storage');
    }

    return {
      fileName: asset.originalName,
      mimeType: asset.mimeType,
      stream: createReadStream(asset.storagePath),
    };
  }

  private async assertReadable(userId: string, mediaAssetId: string): Promise<MediaAsset> {
    const asset = await this.mediaAssetRepository.findOne({ where: { id: mediaAssetId } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    if (asset.conversationId) {
      await this.conversationService.assertMember(asset.conversationId, userId);
      return asset;
    }

    if (asset.uploaderId !== userId) {
      throw new ForbiddenException('Not allowed to access this media asset');
    }

    return asset;
  }

  private async isConversationMember(conversationId: string, userId: string): Promise<boolean> {
    try {
      await this.conversationService.assertMember(conversationId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private resolveMediaKind(mimeType: string): number {
    const mime = (mimeType || '').toLowerCase();
    if (mime.startsWith('image/')) {
      return 2;
    }
    if (mime.startsWith('audio/')) {
      return 3;
    }
    return 4;
  }

  /**
   * 验证文件 magic bytes 确保文件类型与声明的 MIME type 一致
   * 防止攻击者上传恶意文件但声称是其他类型
   */
  private validateMagicBytes(buffer: Buffer, mimeType: string): void {
    const signatures = Object.entries(FILE_SIGNATURES).filter(([key]) => key === mimeType);
    if (signatures.length === 0) {
      // 没有定义 magic bytes 验证的文件类型，跳过验证
      return;
    }

    const [, config] = signatures[0];
    const offset = config.offset ?? 0;

    if (buffer.length < offset + config.magic.length) {
      throw new BadRequestException('File is too small to validate');
    }

    const fileMagic = buffer.slice(offset, offset + config.magic.length);
    const isMatch = config.magic.every((byte, index) => fileMagic[index] === byte);

    if (!isMatch) {
      throw new BadRequestException(`File content does not match declared MIME type: ${mimeType}`);
    }
  }
}
