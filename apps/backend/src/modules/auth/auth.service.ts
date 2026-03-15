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
    const exists = await Promise.all([
      this.userService.findByEmail(dto.email),
      this.userService.findByPhone(dto.phone),
      this.userService.findByUsername(dto.username),
    ]);

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
