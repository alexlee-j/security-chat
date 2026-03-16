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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsumePrekeyDto } from './dto/consume-prekey.dto';
import { UploadPrekeysDto } from './dto/upload-prekeys.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

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

  @Post('keys/upload')
  uploadPrekeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadPrekeysDto,
  ): Promise<{ inserted: number; deviceId: string }> {
    return this.userService.uploadOneTimePrekeys(user.userId, dto.deviceId, dto.prekeys);
  }

  @Get('keys/device/:deviceId/next')
  nextPrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; publicKey: string } | null> {
    return this.userService.getNextAvailablePrekey(deviceId);
  }

  @Post('keys/device/:deviceId/next-consume')
  nextConsumePrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; publicKey: string } | null> {
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
  ): Promise<{ deviceId: string }> {
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
    }>;
  }>> {
    return this.userService.getDevicesByUserIds(dto.userIds);
  }

  @Get('signal/prekeys/:deviceId')
  getPrekeysByDeviceId(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body('limit') limit: number = 10,
  ): Promise<Array<{
    preKeyId: string;
    publicKey: string;
  }>> {
    return this.userService.getPrekeysByDeviceId(deviceId, limit);
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
}
