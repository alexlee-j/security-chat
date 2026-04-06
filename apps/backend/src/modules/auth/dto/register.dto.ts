import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 50)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  // @Matches(/^\+?[0-9]{8,20}$/)
  // 暂时注释手机号格式校验，支持空字符串
  phone!: string;

  @IsString()
  @Length(8, 64, { message: '密码至少8位' })
  @Matches(/^(?=.*[0-9])(?=.*[a-zA-Z])/, {
    message: '密码必须包含数字和字母',
  })
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
