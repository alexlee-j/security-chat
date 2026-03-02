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
    deviceType: 'ios' | 'android' | 'mac' | 'windows';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    createdAt: string;
    lastActiveAt: string | null;
  }>> {
    return this.userService.listDevices(user.userId);
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
