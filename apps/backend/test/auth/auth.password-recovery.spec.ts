import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AuthService } from '../../src/modules/auth/auth.service';
import { MailService } from '../../src/modules/mail/mail.service';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { SecurityService } from '../../src/modules/security/security.service';
import { UserService } from '../../src/modules/user/user.service';

describe('AuthService password recovery', () => {
  let authService: AuthService;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;
  let userService: jest.Mocked<UserService>;
  let securityService: jest.Mocked<SecurityService>;
  let mailService: jest.Mocked<MailService>;
  let notificationService: jest.Mocked<NotificationService>;
  let redis: jest.Mocked<Redis>;

  const setup = () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') {
          return '7d';
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    userService = {
      findByEmail: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UserService>;

    securityService = {
      assertLoginAllowed: jest.fn(),
      recordLoginFailure: jest.fn(),
      clearLoginFailures: jest.fn(),
    } as unknown as jest.Mocked<SecurityService>;

    mailService = {
      sendLoginCode: jest.fn(),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailService>;

    notificationService = {
      isNotificationEnabled: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue({ notificationId: 'n-1' }),
    } as unknown as jest.Mocked<NotificationService>;

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<Redis>;

    authService = new AuthService(
      configService,
      userService,
      securityService,
      jwtService,
      mailService,
      notificationService,
      redis,
    );
  };

  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends password recovery code and stores rate/code state when user exists', async () => {
    userService.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
    } as never);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = await authService.sendForgotPasswordCode({ email: 'Alice@Example.com' });

    expect(result).toEqual({ sent: true, message: '如果邮箱已注册，将收到重置邮件' });
    expect(redis.set).toHaveBeenNthCalledWith(1, 'auth:forgot:code:alice@example.com', '100000', 'EX', 900);
    expect(redis.set).toHaveBeenNthCalledWith(2, 'auth:forgot:rate:alice@example.com', '1', 'EX', 300);
    expect(mailService.sendPasswordResetCode).toHaveBeenCalledWith('alice@example.com', '100000', 'alice');

    randomSpy.mockRestore();
  });

  it('returns generic success and does not send mail when account does not exist', async () => {
    userService.findByEmail.mockResolvedValueOnce(null);

    const result = await authService.sendForgotPasswordCode({ email: 'nobody@example.com' });

    expect(result).toEqual({ sent: true, message: '如果邮箱已注册，将收到重置邮件' });
    expect(mailService.sendPasswordResetCode).not.toHaveBeenCalled();
  });

  it('invalidates existing sessions after successful password reset', async () => {
    redis.get
      .mockResolvedValueOnce('0')
      .mockResolvedValueOnce('123456');
    userService.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
    } as never);

    const result = await authService.resetPasswordWithCode({
      email: 'alice@example.com',
      code: '123456',
      newPassword: 'Password123',
    });

    expect(result.success).toBe(true);
    expect(userService.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    expect(redis.del).toHaveBeenCalledWith('auth:forgot:code:alice@example.com');
    expect(redis.set).toHaveBeenCalledWith(
      'token:logout-after:user-1',
      expect.any(String),
      'EX',
      7 * 24 * 60 * 60,
    );
  });
});
