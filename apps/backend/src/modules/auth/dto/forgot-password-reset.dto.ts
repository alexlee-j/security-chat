import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * 重置密码 DTO
 */
export class ForgotPasswordResetDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码为6位数字' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  code!: string;

  @IsString()
  @Length(8, 64, { message: '密码至少8位' })
  @Matches(/^(?=.*[0-9])(?=.*[a-zA-Z])/, {
    message: '密码必须包含数字和字母',
  })
  newPassword!: string;
}
