import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginWithCodeDto } from './dto/login-with-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendLoginCodeDto } from './dto/send-login-code.dto';
import { ForgotPasswordSendDto } from './dto/forgot-password-send.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    return this.authService.register(dto);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const forwarded = req.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    const clientIp = (firstForwarded || req.ip || 'unknown').trim();
    return this.authService.login(dto, clientIp);
  }

  @Post('login-code/send')
  sendLoginCode(
    @Body() dto: SendLoginCodeDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<{ sent: true; expiresInSec: number; debugCode?: string }> {
    const forwarded = req.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    const clientIp = (firstForwarded || req.ip || 'unknown').trim();
    return this.authService.sendLoginCode(dto, clientIp);
  }

  @Post('login-code')
  loginWithCode(
    @Body() dto: LoginWithCodeDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const forwarded = req.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    const clientIp = (firstForwarded || req.ip || 'unknown').trim();
    return this.authService.loginWithCode(dto, clientIp);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: RequestUser): Promise<{ success: true }> {
    return this.authService.logout(user);
  }

  @Post('forgot-password/send')
  sendForgotPasswordCode(@Body() dto: ForgotPasswordSendDto): Promise<{ sent: true; message: string }> {
    return this.authService.sendForgotPasswordCode(dto);
  }

  @Post('forgot-password/reset')
  resetPasswordWithCode(@Body() dto: ForgotPasswordResetDto): Promise<{ success: true; message: string }> {
    return this.authService.resetPasswordWithCode(dto);
  }
}
