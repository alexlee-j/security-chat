import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Device } from '../../src/modules/user/entities/device.entity';
import { KeyVerification } from '../../src/modules/user/entities/key-verification.entity';
import { OneTimePrekey } from '../../src/modules/user/entities/one-time-prekey.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { UserService } from '../../src/modules/user/user.service';
import { KyberPreKey } from '../../src/modules/prekey/entities/prekey.entity';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('UserService.updateAvatar', () => {
  let avatarRoot: string;
  let userRepository: jest.Mocked<Repository<User>>;
  let service: UserService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const baseUser: User = {
    id: userId,
    username: 'alice',
    email: 'alice@example.com',
    phone: null,
    passwordHash: 'hash',
    avatarUrl: null,
    bio: null,
    status: 1,
    identityPublicKey: null,
    identityKeyFingerprint: null,
    registrationId: null,
    signalVersion: 3,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    devices: [],
    normalizeFields: jest.fn(),
  };

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      ...baseUser,
      normalizeFields: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    avatarRoot = await mkdtemp(join(tmpdir(), 'security-chat-avatar-test-'));
    userRepository = {
      findOne: jest.fn().mockResolvedValue(makeUser()),
      save: jest.fn(async (user: User) => user),
    } as unknown as jest.Mocked<Repository<User>>;

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          AVATAR_ROOT: avatarRoot,
          AVATAR_URL_PREFIX: '/api/v1/user/avatar',
          AVATAR_MAX_BYTES: '64',
          AVATAR_ALLOWED_MIME_TYPES: 'image/png,image/jpeg',
        };
        return values[key] ?? fallback ?? '';
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new UserService(
      userRepository,
      {} as Repository<Device>,
      {} as Repository<OneTimePrekey>,
      {} as Repository<KeyVerification>,
      {} as Repository<KyberPreKey>,
      {} as Redis,
      configService,
    );
  });

  afterEach(async () => {
    await rm(avatarRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('stores a valid avatar and persists the avatar URL', async () => {
    const result = await service.updateAvatar(userId, {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: PNG_BYTES.length,
      buffer: PNG_BYTES,
    });

    expect(result).toMatchObject({
      id: userId,
      username: 'alice',
    });
    expect(result.avatarUrl).toMatch(/^\/api\/v1\/user\/avatar\/11111111-1111-4111-8111-111111111111-[a-f0-9-]+\.png$/);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        avatarUrl: result.avatarUrl,
      }),
    );

    expect(result.avatarUrl).toBeTruthy();
    const savedPath = join(avatarRoot, result.avatarUrl!.split('/').at(-1)!);
    await expect(readFile(savedPath)).resolves.toEqual(PNG_BYTES);
  });

  it('replaces an existing avatar URL with a new stored avatar URL', async () => {
    userRepository.findOne.mockResolvedValue(makeUser({ avatarUrl: '/api/v1/user/avatar/old.png' }));

    const result = await service.updateAvatar(userId, {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: PNG_BYTES.length,
      buffer: PNG_BYTES,
    });

    expect(result.avatarUrl).not.toBe('/api/v1/user/avatar/old.png');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: result.avatarUrl,
      }),
    );
  });

  it('rejects unsupported avatar MIME types without mutating the profile', async () => {
    await expect(
      service.updateAvatar(userId, {
        originalname: 'avatar.gif',
        mimetype: 'image/gif',
        size: PNG_BYTES.length,
        buffer: PNG_BYTES,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects oversized avatars without mutating the profile', async () => {
    await expect(
      service.updateAvatar(userId, {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 65,
        buffer: Buffer.concat([PNG_BYTES, Buffer.alloc(49)]),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects missing users without writing profile state', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateAvatar(userId, {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: PNG_BYTES.length,
        buffer: PNG_BYTES,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
