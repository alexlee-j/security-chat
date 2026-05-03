import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendService } from '../friend/friend.service';
import { ConsumePrekeyDto } from './dto/consume-prekey.dto';
import { UploadPrekeysDto } from './dto/upload-prekeys.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { GenerateLinkingQRCodeDto, LinkDeviceRequestDto, ConfirmLinkDeviceDto } from './dto/link-device.dto';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly friendService: FriendService,
  ) {}

  @Get(':id')
  async profile(@Param('id', new ParseUUIDPipe()) id: string): Promise<{
    id: string;
    username: string;
    avatarUrl: string | null;
  }> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateAvatar(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ): Promise<{
    id: string;
    username: string;
    avatarUrl: string | null;
  }> {
    return this.userService.updateAvatar(user.userId, file);
  }

  @Post('keys/upload')
  uploadPrekeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadPrekeysDto,
  ): Promise<{ inserted: number; deviceId: string }> {
    return this.userService.uploadOneTimePrekeys(user.userId, dto.deviceId, {
      identityKey: dto.identityKey,
      signedPrekey: dto.signedPrekey,
      oneTimePrekeys: dto.oneTimePrekeys,
      kyberPrekey: dto.kyberPrekey,
    });
  }

  @Get('keys/device/:deviceId/next')
  nextPrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; keyId: number | null; publicKey: string } | null> {
    return this.userService.getNextAvailablePrekey(deviceId);
  }

  @Post('keys/device/:deviceId/next-consume')
  nextConsumePrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; keyId: number | null; publicKey: string } | null> {
    return this.userService.getAndConsumeNextPrekey(deviceId);
  }

  @Post('keys/consume')
  consumePrekey(@Body() dto: ConsumePrekeyDto): Promise<{
    consumed: boolean;
    alreadyUsed: boolean;
    preKeyId: string;
  }> {
    return this.userService.consumePrekey(dto.preKeyId);
  }

  @Post('device/register')
  registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ deviceId: string; signalDeviceId: number }> {
    return this.userService.registerDevice(user.userId, dto);
  }

  @Get('device/list')
  listDevices(
    @CurrentUser() user: RequestUser,
  ): Promise<Array<{
    deviceId: string;
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    registrationId: number | null;
    signalDeviceId: number;
    createdAt: string;
    lastActiveAt: string | null;
  }>> {
    return this.userService.listDevices(user.userId);
  }

  @Get('signal/info')
  getUserSignalInfo(
    @CurrentUser() user: RequestUser,
  ): Promise<{
    identityPublicKey: string;
    identityKeyFingerprint: string;
    registrationId: number;
    signalVersion: number;
  } | null> {
    return this.userService.getUserSignalInfo(user.userId);
  }

  @Post('signal/verify-key')
  verifyIdentityKey(
    @CurrentUser() user: RequestUser,
    @Body() dto: { deviceId: string; fingerprint: string },
  ): Promise<{ verified: boolean }> {
    return this.userService.verifyIdentityKey(user.userId, dto.deviceId, dto.fingerprint);
  }

  @Put('signal/signed-prekey')
  updateSignedPreKey(
    @CurrentUser() user: RequestUser,
    @Body() dto: { deviceId: string; signedPreKey: string; signedPreKeySignature: string },
  ): Promise<{ updated: boolean }> {
    return this.userService.updateSignedPreKey(user.userId, dto.deviceId, dto.signedPreKey, dto.signedPreKeySignature);
  }

  @Post('signal/devices/batch')
  getDevicesByUserIds(
    @Body() dto: { userIds: string[] },
  ): Promise<Array<{
    userId: string;
    devices: Array<{
      deviceId: string;
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      registrationId: number | null;
      signalDeviceId: number;
    }>;
  }>> {
    return this.userService.getDevicesByUserIds(dto.userIds);
  }

  @Get('keys/bundle/:userId/:deviceId')
  async getPrekeyBundle(
    @CurrentUser() user: RequestUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{
    deviceId: string;
    registrationId: number;
    signalDeviceId: number;
    identityKey: string;
    signedPrekey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePrekey?: {
      preKeyId: string;
      keyId: number;
      publicKey: string;
    };
    kyberPrekey?: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
  } | null> {
    // 注意：预密钥包包含公钥，可以公开访问
    // 这是 Signal 协议的设计，任何人都可以获取以建立加密会话
    // 不需要验证好友关系，因为预密钥包是用于建立初始会话的
    return this.userService.getPrekeyBundle(userId, deviceId);
  }

  @Get('keys/bundle/:userId/:deviceId/peek')
  async peekPrekeyBundle(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{
    deviceId: string;
    registrationId: number;
    signalDeviceId: number;
    identityKey: string;
    signedPrekey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePrekeyAvailable: boolean;
    kyberPrekeyAvailable: boolean;
  } | null> {
    // 注意：预密钥包包含公钥，可以公开访问
    return this.userService.peekPrekeyBundle(userId, deviceId);
  }

  @Get('keys/prekeys/:deviceId/stats')
  async getPrekeyStats(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{
    total: number;
    used: number;
    available: number;
    needsReplenish: boolean;
  }> {
    // 验证设备所有权
    const devices = await this.userService.listDevices(user.userId);
    const device = devices.find(d => d.deviceId === deviceId);
    if (!device) {
      throw new NotFoundException('Device not found or not owned by user');
    }
    return this.userService.getPrekeyStats(deviceId);
  }

  @Put('device/:deviceId')
  updateDevice(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body() dto: { deviceName: string },
  ): Promise<{ updated: boolean }> {
    return this.userService.updateDevice(user.userId, deviceId, dto);
  }

  @Delete('device/:deviceId')
  deleteDevice(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ deleted: boolean }> {
    return this.userService.deleteDevice(user.userId, deviceId);
  }

  // ==================== 设备链接功能 ====================

  @Post('device/linking/qrcode')
  async generateLinkingQRCode(
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateLinkingQRCodeDto,
  ): Promise<{
    temporaryToken: string;
    qrCodeData: string;
    expiresAt: Date;
  }> {
    return this.userService.generateLinkingQRCode(
      user.userId,
      dto.deviceName,
      dto.deviceType,
    );
  }

  @Post('device/linking/verify')
  async verifyLinkingToken(
    @Body() dto: { temporaryToken: string },
  ): Promise<{
    valid: boolean;
    userId?: string;
    fingerprint?: string;
    expiresAt?: Date;
  }> {
    return this.userService.verifyLinkingToken(dto.temporaryToken);
  }

  @Post('device/linking/confirm')
  async confirmLinkDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: LinkDeviceRequestDto,
  ): Promise<{ deviceId: string; signalDeviceId: number; success: boolean }> {
    return this.userService.confirmLinkDevice(user.userId, dto.temporaryToken, {
      deviceName: dto.deviceName,
      deviceType: dto.deviceType,
      identityPublicKey: dto.identityPublicKey,
      signedPreKey: dto.signedPreKey,
      signedPreKeySignature: dto.signedPreKeySignature,
      registrationId: dto.registrationId,
    });
  }

  // ==================== 密钥验证接口 ====================

  @Post('keys/verify')
  async verifyKey(
    @CurrentUser() user: RequestUser,
    @Body() dto: { userId: string; deviceId?: string; fingerprint: string; isVerified: boolean },
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.verifyKey(
      user.userId,
      dto.userId,
      dto.deviceId,
      dto.fingerprint,
      dto.isVerified
    );
  }

  @Get('keys/verify/:userId')
  async getVerificationStatus(
    @CurrentUser() user: RequestUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<{
    userId: string;
    fingerprint: string;
    isVerified: boolean;
    verifiedAt?: string;
    devices: Array<{
      deviceId: string;
      deviceName: string;
      fingerprint: string;
      isVerified: boolean;
    }>;
  }> {
    return this.userService.getVerificationStatus(user.userId, userId);
  }

  @Get('keys/identity/:userId')
  async getIdentityKey(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<{
    userId: string;
    identityKey: string;
    fingerprint: string;
    registrationId: number;
  }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      identityKey: user.identityPublicKey!,
      fingerprint: user.identityKeyFingerprint!,
      registrationId: user.registrationId!,
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 验证两个用户是否是好友关系
   * 如果不是好友，抛出 ForbiddenException
   */
  private async assertIsFriend(userId: string, otherUserId: string): Promise<void> {
    const areFriends = await this.friendService.areFriends(userId, otherUserId);
    if (!areFriends) {
      throw new ForbiddenException('You can only access prekey bundles of your friends');
    }
  }
}

@Controller('user/avatar')
export class UserAvatarController {
  constructor(private readonly userService: UserService) {}

  @Get(':fileName')
  async getAvatar(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    const source = await this.userService.getAvatarFileSource(fileName);
    res.setHeader('content-type', source.mimeType);
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    source.stream.pipe(res);
  }
}
