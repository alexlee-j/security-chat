import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * 发送忘记密码验证码 DTO
 */
export class ForgotPasswordSendDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;
}
