import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtPayload } from '../../src/modules/auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { MailService } from '../../src/modules/mail/mail.service';
import { SecurityService } from '../../src/modules/security/security.service';
import { UserService } from '../../src/modules/user/user.service';

const userId = '3c0f8e1a-0d56-4a73-9f32-6f4f7a0ad001';
const deviceId = '7d61e0c4-38b5-4d9f-b36e-8e0f82f9f001';
const otherDeviceId = '7d61e0c4-38b5-4d9f-b36e-8e0f82f9f002';

describe('AuthService device-bound auth', () => {
  let authService: AuthService;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;
  let userService: jest.Mocked<UserService>;
  let securityService: jest.Mocked<SecurityService>;
  let mailService: jest.Mocked<MailService>;
  let redis: jest.Mocked<Redis>;
  let compareSpy: jest.SpyInstance;

  const createService = (devices: Array<{ deviceId: string }> = [{ deviceId }]) => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'JWT_EXPIRES_IN') {
          return '15m';
        }
        if (key === 'JWT_REFRESH_EXPIRES_IN') {
          return '7d';
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation(async (payload: JwtPayload) => `${payload.type}:${payload.deviceId}`),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    userService = {
      createUser: jest.fn().mockResolvedValue({ id: userId }),
      findByEmail: jest.fn().mockResolvedValue({
        id: userId,
        passwordHash: 'hashed-password',
      }),
      findByPhone: jest.fn().mockResolvedValue(null),
      findByUsername: jest.fn().mockResolvedValue({
        id: userId,
        passwordHash: 'hashed-password',
      }),
      findById: jest.fn().mockResolvedValue({ id: userId }),
      listDevices: jest.fn().mockResolvedValue(devices),
      touchDeviceActivity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UserService>;

    securityService = {
      assertLoginAllowed: jest.fn().mockResolvedValue(undefined),
      recordLoginFailure: jest.fn().mockResolvedValue(undefined),
      clearLoginFailures: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SecurityService>;

    mailService = {
      sendLoginCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<Redis>;

    authService = new AuthService(
      configService,
      userService,
      securityService,
      jwtService,
      mailService,
      redis,
    );
  };

  beforeEach(() => {
    compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    createService();
  });

  afterEach(() => {
    compareSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('issues jwt tokens with the created device id on register', async () => {
    createService([{ deviceId }]);
    userService.findByEmail.mockResolvedValueOnce(null);
    userService.findByUsername.mockResolvedValueOnce(null);
    userService.findByPhone.mockResolvedValueOnce(null);
    await authService.register({
      username: 'alice',
      email: 'alice@example.com',
      phone: '',
      password: 'Password123',
      deviceName: 'MacBook',
      deviceType: 'mac',
      identityPublicKey: 'identity-key',
      signedPreKey: 'signed-pre-key',
      signedPreKeySignature: 'signature',
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access', deviceId }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh', deviceId }),
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });

  it('falls back to an owned device when password login omits deviceId', async () => {
    await authService.login({
      account: 'alice',
      password: 'Password123',
    } as never);

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access', deviceId }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
  });

  it('rejects password login when the device does not belong to the user', async () => {
    createService([{ deviceId: otherDeviceId }]);

    await expect(
      authService.login({
        account: 'alice',
        password: 'Password123',
        deviceId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('falls back to an owned device for code login and binds tokens to that device', async () => {
    redis.get.mockResolvedValueOnce('123456');

    await authService.loginWithCode({
      account: 'alice',
      code: '123456',
      deviceId,
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access', deviceId }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh', deviceId }),
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });

  it('preserves the refresh token deviceId when issuing a new token pair', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: userId,
      jti: 'refresh-jti',
      type: 'refresh',
      deviceId,
      iat: 100,
      exp: 200,
    } as JwtPayload);

    await authService.refresh({ refreshToken: 'refresh-token' });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access', deviceId }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh', deviceId }),
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });
});

describe('JwtStrategy device-bound auth', () => {
  it('exposes deviceId on the request user object', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Redis>;
    const strategy = new JwtStrategy(
      {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'NODE_ENV') {
            return 'test';
          }
          if (key === 'JWT_SECRET') {
            return 'dev_secret_change_me';
          }
          return defaultValue;
        }),
      } as unknown as ConfigService,
      redis,
    );

    await expect(
      strategy.validate({
        sub: userId,
        jti: 'jti-1',
        type: 'access',
        deviceId,
        iat: 1,
        exp: 2,
      }),
    ).resolves.toEqual({
      userId,
      jti: 'jti-1',
      tokenType: 'access',
      deviceId,
      iat: 1,
      exp: 2,
    });
  });
});
