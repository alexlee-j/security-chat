import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachMediaDto } from './dto/attach-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body() dto: UploadMediaDto,
  ): Promise<{
    mediaAssetId: string;
    mediaKind: number;
    mimeType: string;
    fileSize: number;
    sha256: string;
    createdAt: string;
  }> {
    return this.mediaService.upload(user.userId, file, dto.mediaKind);
  }

  @Post(':mediaAssetId/attach')
  attach(
    @CurrentUser() user: RequestUser,
    @Param('mediaAssetId', new ParseUUIDPipe()) mediaAssetId: string,
    @Body() dto: AttachMediaDto,
  ): Promise<{ attached: true; mediaAssetId: string; conversationId: string }> {
    return this.mediaService.attachToConversation(user.userId, mediaAssetId, dto.conversationId);
  }

  @Post(':mediaAssetId/copy')
  copyToConversation(
    @CurrentUser() user: RequestUser,
    @Param('mediaAssetId', new ParseUUIDPipe()) mediaAssetId: string,
    @Body() dto: AttachMediaDto,
  ): Promise<{ mediaAssetId: string; conversationId: string }> {
    return this.mediaService.copyForConversation(user.userId, mediaAssetId, dto.conversationId);
  }

  @Get(':mediaAssetId/meta')
  meta(
    @CurrentUser() user: RequestUser,
    @Param('mediaAssetId', new ParseUUIDPipe()) mediaAssetId: string,
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
    return this.mediaService.getMediaMeta(user.userId, mediaAssetId);
  }

  @Get(':mediaAssetId/download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('mediaAssetId', new ParseUUIDPipe()) mediaAssetId: string,
    @Res() res: Response,
  ): Promise<void> {
    const source = await this.mediaService.getDownloadSource(user.userId, mediaAssetId);
    res.setHeader('content-type', source.mimeType);
    res.setHeader('content-disposition', `inline; filename="${encodeURIComponent(source.fileName)}"`);
    source.stream.pipe(res);
  }
}
