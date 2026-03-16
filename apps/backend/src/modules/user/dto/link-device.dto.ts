import { IsString, IsIn, MaxLength, IsOptional, IsNumber } from 'class-validator';

/**
 * 设备链接请求 DTO
 * 用于从设备扫描二维码后发起链接请求
 */
export class LinkDeviceRequestDto {
  @IsString()
  @MaxLength(100)
  deviceName!: string;

  @IsIn(['ios', 'android', 'mac', 'windows', 'linux'])
  deviceType!: 'ios' | 'android' | 'mac' | 'windows' | 'linux';

  @IsString()
  temporaryToken!: string;

  @IsString()
  identityPublicKey!: string;

  @IsString()
  signedPreKey!: string;

  @IsString()
  signedPreKeySignature!: string;

  @IsOptional()
  @IsNumber()
  registrationId?: number;
}

/**
 * 确认设备链接请求 DTO
 * 用于主设备确认链接
 */
export class ConfirmLinkDeviceDto {
  @IsString()
  temporaryToken!: string;

  @IsString()
  fingerprint!: string;
}

/**
 * 生成链接二维码请求 DTO
 */
export class GenerateLinkingQRCodeDto {
  @IsString()
  @MaxLength(100)
  deviceName!: string;

  @IsIn(['ios', 'android', 'mac', 'windows', 'linux'])
  deviceType!: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
}
