import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 50)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phone!: string;

  @IsString()
  @Length(8, 64)
  password!: string;

  @IsString()
  @IsNotEmpty()
  deviceName!: string;

  @IsString()
  @Matches(/^(ios|android|mac|windows|linux)$/)
  deviceType!: 'ios' | 'android' | 'mac' | 'windows' | 'linux';

  @IsString()
  @IsNotEmpty()
  identityPublicKey!: string;

  @IsString()
  @IsNotEmpty()
  signedPreKey!: string;

  @IsString()
  @IsNotEmpty()
  signedPreKeySignature!: string;
}
