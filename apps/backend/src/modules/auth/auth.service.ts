import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegisterDto } from './dto/register.dto';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
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

  async login(dto: LoginDto): Promise<AuthTokens> {
    const account = dto.account?.trim();
    const phone = dto.phone?.trim();

    if (!account && !phone) {
      throw new BadRequestException('account or phone is required');
    }

    const user = phone
      ? await this.userService.findByPhone(phone)
      : account?.includes('@')
        ? await this.userService.findByEmail(account)
        : await this.userService.findByUsername(account as string);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.deviceId) {
      await this.userService.touchDeviceActivity(user.id, dto.deviceId);
      await this.safeMarkOnline(`online:${user.id}:${dto.deviceId}`);
    }
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

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.blacklistToken(payload.jti, payload.exp);
    return this.issueTokenPair(user.id);
  }

  async logout(user: RequestUser): Promise<{ success: true }> {
    await this.blacklistToken(user.jti, user.exp);
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
}
