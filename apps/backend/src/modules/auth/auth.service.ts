import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { SecurityService } from '../security/security.service';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { LoginWithCodeDto } from './dto/login-with-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegisterDto } from './dto/register.dto';
import { SendLoginCodeDto } from './dto/send-login-code.dto';
import { ForgotPasswordSendDto } from './dto/forgot-password-send.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly securityService: SecurityService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    // 检查唯一性，phone 为空字符串时跳过检查
    const existsChecks = [
      this.userService.findByEmail(dto.email),
      this.userService.findByUsername(dto.username),
    ];
    
    // 仅当 phone 非空时才检查 phone 唯一性
    if (dto.phone && dto.phone.trim()) {
      existsChecks.push(this.userService.findByPhone(dto.phone));
    }
    
    const exists = await Promise.all(existsChecks);

    if (exists.some(Boolean)) {
      throw new BadRequestException('User already exists with same email/phone/username');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userService.createUser({
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      device: {
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        identityPublicKey: dto.identityPublicKey,
        signedPreKey: dto.signedPreKey,
        signedPreKeySignature: dto.signedPreKeySignature,
      },
    });

    return this.issueTokenPair(user.id);
  }

  async login(dto: LoginDto, clientIp = 'unknown'): Promise<AuthTokens> {
    const account = dto.account?.trim();
    const phone = dto.phone?.trim();
    const identity = phone || account || 'unknown';

    if (!account && !phone) {
      throw new BadRequestException('account or phone is required');
    }

    await this.securityService.assertLoginAllowed(identity, clientIp);

    const user = phone
      ? await this.userService.findByPhone(phone)
      : account?.includes('@')
        ? await this.userService.findByEmail(account)
        : await this.userService.findByUsername(account as string);

    if (!user) {
      await this.securityService.recordLoginFailure(identity, clientIp);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await this.securityService.recordLoginFailure(identity, clientIp);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.securityService.clearLoginFailures(identity, clientIp);

    if (dto.deviceId) {
      await this.userService.touchDeviceActivity(user.id, dto.deviceId);
      await this.safeMarkOnline(`online:${user.id}:${dto.deviceId}`);
    }
    await this.safeMarkOnline(`online:${user.id}`);

    return this.issueTokenPair(user.id);
  }

  async sendLoginCode(
    dto: SendLoginCodeDto,
    clientIp = 'unknown',
  ): Promise<{ sent: true; expiresInSec: number; debugCode?: string }> {
    const { identity, user } = await this.resolveIdentityUser(dto.account, dto.phone);
    await this.securityService.assertLoginAllowed(identity, clientIp);
    const expiresInSec = 300;
    if (!user) {
      await this.securityService.recordLoginFailure(identity, clientIp);
      throw new BadRequestException('User not found');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const key = `auth:login-code:${identity}`;
    await this.redis.set(key, code, 'EX', expiresInSec);

    // 发送验证码邮件
    this.logger.log(`Sending login code to user ${user.id} at email ${user.email}`);
    await this.mailService.sendLoginCode(user.email, code);
    this.logger.log(`Login code sent successfully to ${user.email}`);

    const debugEnabled = this.configService.get<string>('AUTH_CODE_DEBUG_RETURN', 'false') === 'true';
    return {
      sent: true,
      expiresInSec,
      ...(debugEnabled ? { debugCode: code } : {}),
    };
  }

  async loginWithCode(dto: LoginWithCodeDto, clientIp = 'unknown'): Promise<AuthTokens> {
    const { identity, user } = await this.resolveIdentityUser(dto.account, dto.phone);
    await this.securityService.assertLoginAllowed(identity, clientIp);
    if (!user) {
      await this.securityService.recordLoginFailure(identity, clientIp);
      throw new UnauthorizedException('Invalid credentials');
    }

    const key = `auth:login-code:${identity}`;
    const expectedCode = await this.redis.get(key).catch(() => null);
    if (!expectedCode || expectedCode !== dto.code) {
      await this.securityService.recordLoginFailure(identity, clientIp);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.redis.del(key).catch(() => null);
    await this.securityService.clearLoginFailures(identity, clientIp);
    await this.safeMarkOnline(`online:${user.id}`);
    return this.issueTokenPair(user.id);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken).catch(() => null);
    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const blacklisted = await this.redis
      .get(`token:blacklist:${payload.jti}`)
      .catch(() => null);
    if (blacklisted) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const logoutAfterRaw = await this.redis
      .get(`token:logout-after:${payload.sub}`)
      .catch(() => null);
    const logoutAfter = Number(logoutAfterRaw ?? '0');
    if (Number.isFinite(logoutAfter) && logoutAfter > 0 && payload.iat <= logoutAfter) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.blacklistToken(payload.jti, payload.exp);
    return this.issueTokenPair(user.id);
  }

  async logout(user: RequestUser): Promise<{ success: true }> {
    await Promise.all([this.blacklistToken(user.jti, user.exp), this.markUserLogoutAfter(user.userId)]);
    return { success: true };
  }

  /**
   * 发送忘记密码验证码
   * 防撞库：频率限制 5分钟/次
   */
  async sendForgotPasswordCode(dto: ForgotPasswordSendDto): Promise<{ sent: true; message: string }> {
    const email = dto.email.toLowerCase().trim();
    const rateLimitKey = `auth:forgot:rate:${email}`;

    // 检查发送频率限制（5分钟）
    const rateLimited = await this.redis.get(rateLimitKey).catch(() => null);
    if (rateLimited) {
      throw new BadRequestException('操作过于频繁，请稍后再试');
    }

    const user = await this.userService.findByEmail(email);

    // 为了安全起见，即使用户不存在也返回成功，避免枚举有效邮箱
    if (!user) {
      this.logger.log(`Forgot password requested for non-existent email: ${email}`);
      // 即使不存在，也模拟发送成功，防止撞库
      return { sent: true, message: '如果邮箱已注册，将收到重置邮件' };
    }

    // 生成6位数字验证码
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresInSec = 900; // 15分钟

    // 存储验证码到 Redis
    const codeKey = `auth:forgot:code:${email}`;
    await this.redis.set(codeKey, resetCode, 'EX', expiresInSec);

    // 设置发送频率限制（5分钟）
    await this.redis.set(rateLimitKey, '1', 'EX', 300);

    // 发送重置邮件
    this.logger.log(`Sending password reset code to user ${user.id} at email ${email}`);
    await this.mailService.sendPasswordResetCode(email, resetCode, user.username);

    return { sent: true, message: '如果邮箱已注册，将收到重置邮件' };
  }

  /**
   * 验证验证码并重置密码
   * 防撞库：尝试次数限制 3次/验证码
   */
  async resetPasswordWithCode(dto: ForgotPasswordResetDto): Promise<{ success: true; message: string }> {
    const email = dto.email.toLowerCase().trim();
    const { code, newPassword } = dto;

    // 检查错误次数限制
    const attemptsKey = `auth:forgot:attempts:${email}`;
    const attempts = parseInt(await this.redis.get(attemptsKey).catch(() => '0') || '0', 10);

    if (attempts >= 5) {
      throw new BadRequestException('验证码尝试次数过多，请重新获取');
    }

    // 获取存储的验证码
    const codeKey = `auth:forgot:code:${email}`;
    const storedCode = await this.redis.get(codeKey).catch(() => null);

    // 验证码不存在或已过期
    if (!storedCode) {
      throw new BadRequestException('验证码已过期，请重新获取');
    }

    // 验证码错误
    if (storedCode !== code) {
      // 增加错误计数
      await this.redis.incr(attemptsKey);
      // 设置15分钟过期
      await this.redis.expire(attemptsKey, 900);

      const remainingAttempts = 5 - attempts - 1;
      if (remainingAttempts > 0) {
        throw new UnauthorizedException(`验证码错误，请重新输入，剩余${remainingAttempts}次尝试`);
      } else {
        throw new UnauthorizedException('验证码错误，请重新获取');
      }
    }

    // 验证成功，获取用户
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 删除验证码（一次性使用）
    await this.redis.del(codeKey).catch(() => null);
    await this.redis.del(attemptsKey).catch(() => null);

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userService.updatePassword(user.id, passwordHash);

    // 使该用户的所有活跃会话失效
    await this.markUserLogoutAfter(user.id);

    this.logger.log(`Password reset successfully for user ${user.id}`);

    return { success: true, message: '密码重置成功，请使用新密码登录' };
  }

  private async issueTokenPair(userId: string): Promise<AuthTokens> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, jti: accessJti, type: 'access' }, { expiresIn: accessExpiresIn as never }),
      this.jwtService.signAsync({ sub: userId, jti: refreshJti, type: 'refresh' }, { expiresIn: refreshExpiresIn as never }),
    ]);

    return { accessToken, refreshToken, userId };
  }

  private async blacklistToken(jti: string, exp: number): Promise<void> {
    const ttl = Math.max(1, exp - Math.floor(Date.now() / 1000));
    try {
      await this.redis.set(`token:blacklist:${jti}`, '1', 'EX', ttl);
    } catch {
      // Auth should not crash on Redis write failure.
    }
  }

  private async safeMarkOnline(key: string): Promise<void> {
    try {
      await this.redis.set(key, '1', 'EX', 60);
    } catch {
      // Redis online status failure should not block auth success.
    }
  }

  private async markUserLogoutAfter(userId: string): Promise<void> {
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const ttl = this.parseExpiresInSeconds(refreshExpiresIn, 7 * 24 * 60 * 60);
    const nowSec = Math.floor(Date.now() / 1000);
    try {
      await this.redis.set(`token:logout-after:${userId}`, String(nowSec), 'EX', ttl);
    } catch {
      // Auth should not crash on Redis write failure.
    }
  }

  private parseExpiresInSeconds(raw: string, fallbackSeconds: number): number {
    const value = raw.trim().toLowerCase();
    const match = value.match(/^(\d+)\s*([smhd]?)$/);
    if (!match) {
      return fallbackSeconds;
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fallbackSeconds;
    }
    const unit = match[2] || 's';
    if (unit === 's') return amount;
    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 3600;
    if (unit === 'd') return amount * 86400;
    return fallbackSeconds;
  }

  private async resolveIdentityUser(
    account: string | undefined,
    phone: string | undefined,
  ): Promise<{
    identity: string;
    user: Awaited<ReturnType<UserService['findById']>> | null;
  }> {
    const accountValue = account?.trim();
    const phoneValue = phone?.trim();
    const identity = phoneValue || accountValue || 'unknown';

    if (!accountValue && !phoneValue) {
      throw new BadRequestException('account or phone is required');
    }

    const user = phoneValue
      ? await this.userService.findByPhone(phoneValue)
      : accountValue?.includes('@')
        ? await this.userService.findByEmail(accountValue)
        : await this.userService.findByUsername(accountValue as string);

    return { identity, user };
  }
}
