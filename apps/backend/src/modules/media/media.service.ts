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
}
