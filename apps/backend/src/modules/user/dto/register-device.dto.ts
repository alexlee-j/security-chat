import { IsString, IsIn, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(100)
  deviceName!: string;

  @IsIn(['ios', 'android', 'mac', 'windows'])
  deviceType!: 'ios' | 'android' | 'mac' | 'windows';

  @IsString()
  identityPublicKey!: string;

  @IsString()
  signedPreKey!: string;

  @IsString()
  signedPreKeySignature!: string;
}
