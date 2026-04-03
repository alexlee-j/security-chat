import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IdentityService, RegisterIdentityDto } from './identity.service';

/**
 * 身份密钥控制器
 * 提供身份密钥的注册和查询接口
 */
@Controller('identity')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  /**
   * 注册设备身份密钥
   * POST /identity/register
   */
  @Post('register')
  async register(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterIdentityDto,
  ): Promise<{
    success: boolean;
    message: string;
    deviceId: string;
  }> {
    // 确保只能注册自己的身份密钥
    if (dto.userId !== user.userId) {
      throw new NotFoundException('Cannot register identity for another user');
    }

    const identity = await this.identityService.register({
      ...dto,
      userId: user.userId,
    });

    return {
      success: true,
      message: 'Identity key registered successfully',
      deviceId: identity.deviceId,
    };
  }

  /**
   * 查询当前用户的所有设备身份密钥
   * GET /identity/query
   */
  @Get('query')
  async query(@CurrentUser() user: RequestUser): Promise<{
    identities: Array<{
      deviceId: string;
      identityPublicKey: string;
      fingerprint: string;
      signedPrekeyPublic: string | null;
      signedPrekeySignature: string | null;
      registrationId: number | null;
      isActive: boolean;
      createdAt: Date;
    }>;
  }> {
    const identities = await this.identityService.queryByUserId(user.userId);

    return {
      identities: identities.map((i) => ({
        deviceId: i.deviceId,
        identityPublicKey: i.identityPublicKey,
        fingerprint: i.fingerprint,
        signedPrekeyPublic: i.signedPrekeyPublic,
        signedPrekeySignature: i.signedPrekeySignature,
        registrationId: i.registrationId,
        isActive: i.isActive,
        createdAt: i.createdAt,
      })),
    };
  }

  /**
   * 查询指定设备的身仒密钥
   * GET /identity/query/:deviceId
   */
  @Get('query/:deviceId')
  async queryByDevice(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{
    deviceId: string;
    identityPublicKey: string;
    fingerprint: string;
    signedPrekeyPublic: string | null;
    signedPrekeySignature: string | null;
    registrationId: number | null;
    isActive: boolean;
    createdAt: Date;
  }> {
    const identity = await this.identityService.queryByDeviceId(user.userId, deviceId);

    if (!identity) {
      throw new NotFoundException('Identity key not found for this device');
    }

    return {
      deviceId: identity.deviceId,
      identityPublicKey: identity.identityPublicKey,
      fingerprint: identity.fingerprint,
      signedPrekeyPublic: identity.signedPrekeyPublic,
      signedPrekeySignature: identity.signedPrekeySignature,
      registrationId: identity.registrationId,
      isActive: identity.isActive,
      createdAt: identity.createdAt,
    };
  }

  /**
   * 获取当前活跃设备的身仒密钥
   * GET /identity/active
   */
  @Get('active')
  async queryActive(@CurrentUser() user: RequestUser): Promise<{
    deviceId: string;
    identityPublicKey: string;
    fingerprint: string;
    signedPrekeyPublic: string | null;
    signedPrekeySignature: string | null;
    registrationId: number | null;
    isActive: boolean;
    createdAt: Date;
  } | null> {
    return this.identityService.queryActiveByUserId(user.userId);
  }

  /**
   * 验证身份密钥
   * GET /identity/verify/:deviceId?fingerprint=xxx
   */
  @Get('verify/:deviceId')
  async verify(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Query('fingerprint') fingerprint: string,
  ): Promise<{ valid: boolean }> {
    const valid = await this.identityService.verify(user.userId, deviceId, fingerprint);
    return { valid };
  }
}
