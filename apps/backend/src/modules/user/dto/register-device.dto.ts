import { IsString, IsIn, MaxLength, IsOptional, IsNumber } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(100)
  deviceName!: string;

  @IsIn(['ios', 'android', 'mac', 'windows', 'linux'])
  deviceType!: 'ios' | 'android' | 'mac' | 'windows' | 'linux';

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
