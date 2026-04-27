import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { Device } from './entities/device.entity';
import { OneTimePrekey } from './entities/one-time-prekey.entity';
import { User } from './entities/user.entity';
import { KeyVerification } from './entities/key-verification.entity';
import { KyberPreKey } from '../prekey/entities/prekey.entity';

type AvatarUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const AVATAR_SIGNATURES: Record<string, { magic: number[]; offset?: number; extension: string }> = {
  'image/png': {
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    extension: '.png',
  },
  'image/jpeg': {
    magic: [0xff, 0xd8, 0xff],
    extension: '.jpg',
  },
  'image/webp': {
    magic: [0x57, 0x45, 0x42, 0x50],
    offset: 8,
    extension: '.webp',
  },
};

interface CreateUserInput {
  username: string;
  email: string;
  phone: string;
  passwordHash: string;
  device: {
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    registrationId?: number;
  };
}

/**
 * 设备链接请求临时存储
 * 生产环境应该使用 Redis
 */
interface LinkingRequest {
  userId: string;
  deviceName: string;
  deviceType: string;
  temporaryPublicKey: string;
  fingerprint: string;
  expiresAt: Date;
  confirmed: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(OneTimePrekey)
    private readonly oneTimePrekeyRepository: Repository<OneTimePrekey>,
    @InjectRepository(KeyVerification)
    private readonly keyVerificationRepository: Repository<KeyVerification>,
    @InjectRepository(KyberPreKey)
    private readonly kyberPrekeyRepository: Repository<KyberPreKey>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService?: ConfigService,
  ) {}

  /**
   * 生成身份密钥指纹
   * 使用 SHA-256 哈希，取前 32 位十六进制字符
   */
  private generateKeyFingerprint(publicKey: string): string {
    return createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 32);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = manager.create(User, {
        username: input.username,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        identityPublicKey: input.device.identityPublicKey,
        identityKeyFingerprint: this.generateKeyFingerprint(input.device.identityPublicKey),
        registrationId: input.device.registrationId || randomInt(1, 65535),
        signalVersion: 3,
      });

      const savedUser = await manager.save(user);

      const device = manager.create(Device, {
        userId: savedUser.id,
        deviceName: input.device.deviceName,
        deviceType: input.device.deviceType,
        identityPublicKey: input.device.identityPublicKey,
        signedPreKey: input.device.signedPreKey,
        signedPreKeySignature: input.device.signedPreKeySignature,
        registrationId: input.device.registrationId || randomInt(1, 65535),
        lastActiveAt: new Date(),
      });

      await manager.save(device);
      return savedUser;
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findByPhone(phone: string): Promise<User | null> {
    // 空字符串时返回 null，避免匹配到数据库中的 null 值
    if (!phone || !phone.trim()) {
      return Promise.resolve(null);
    }
    return this.userRepository.findOne({ where: { phone: phone.trim() } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username: username.trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async updateAvatar(userId: string, file: AvatarUploadFile | undefined): Promise<{
    id: string;
    username: string;
    avatarUrl: string | null;
  }> {
    if (!file) {
      throw new BadRequestException('avatar file is required');
    }

    this.validateAvatarFile(file);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const avatarRoot = this.configService?.get<string>('AVATAR_ROOT', '/tmp/security-chat-avatars') ?? '/tmp/security-chat-avatars';
    const urlPrefix = this.normalizeAvatarUrlPrefix(
      this.configService?.get<string>('AVATAR_URL_PREFIX', '/api/v1/user/avatar') ?? '/api/v1/user/avatar',
    );
    const extension = this.avatarExtension(file.mimetype);
    const fileName = `${userId}-${randomUUID()}${extension}`;
    const fullPath = join(avatarRoot, fileName);

    await mkdir(avatarRoot, { recursive: true });
    await writeFile(fullPath, file.buffer);

    user.avatarUrl = `${urlPrefix}/${fileName}`;
    const saved = await this.userRepository.save(user);

    return {
      id: saved.id,
      username: saved.username,
      avatarUrl: saved.avatarUrl,
    };
  }

  async getAvatarFileSource(fileName: string): Promise<{ fileName: string; mimeType: string; stream: NodeJS.ReadableStream }> {
    if (!/^[a-f0-9-]{36}-[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
      throw new NotFoundException('Avatar not found');
    }

    const avatarRoot = this.configService?.get<string>('AVATAR_ROOT', '/tmp/security-chat-avatars') ?? '/tmp/security-chat-avatars';
    const fullPath = join(avatarRoot, fileName);
    if (!fullPath.startsWith(avatarRoot)) {
      throw new NotFoundException('Avatar not found');
    }

    try {
      await access(fullPath);
    } catch {
      throw new NotFoundException('Avatar not found');
    }

    return {
      fileName,
      mimeType: this.avatarMimeType(fileName),
      stream: createReadStream(fullPath),
    };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { passwordHash });
  }

  private validateAvatarFile(file: AvatarUploadFile): void {
    if (!file.buffer || !file.originalname) {
      throw new BadRequestException('invalid avatar upload');
    }

    const maxBytes = Number(this.configService?.get<string>('AVATAR_MAX_BYTES', String(256 * 1024)) ?? String(256 * 1024));
    if (file.size <= 0 || file.size > maxBytes || file.buffer.length > maxBytes) {
      throw new BadRequestException(`avatar size must be between 1 and ${maxBytes} bytes`);
    }

    const allowed = this.allowedAvatarMimeTypes();
    const mimeType = (file.mimetype || '').toLowerCase();
    if (!allowed.has(mimeType)) {
      throw new BadRequestException('unsupported avatar image type');
    }

    const signature = AVATAR_SIGNATURES[mimeType];
    if (!signature) {
      throw new BadRequestException('unsupported avatar image type');
    }

    const offset = signature.offset ?? 0;
    if (file.buffer.length < offset + signature.magic.length) {
      throw new BadRequestException('avatar file is too small to validate');
    }

    const fileMagic = file.buffer.slice(offset, offset + signature.magic.length);
    const isMatch = signature.magic.every((byte, index) => fileMagic[index] === byte);
    if (!isMatch) {
      throw new BadRequestException(`avatar content does not match declared MIME type: ${mimeType}`);
    }
  }

  private allowedAvatarMimeTypes(): Set<string> {
    const configured = this.configService?.get<string>('AVATAR_ALLOWED_MIME_TYPES', 'image/png,image/jpeg,image/webp') ?? 'image/png,image/jpeg,image/webp';
    return new Set(configured.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  }

  private avatarExtension(mimeType: string): string {
    return AVATAR_SIGNATURES[mimeType.toLowerCase()]?.extension ?? (extname(mimeType).slice(0, 10) || '.img');
  }

  private avatarMimeType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
    return 'image/jpeg';
  }

  private normalizeAvatarUrlPrefix(value: string): string {
    const trimmed = value.trim() || '/api/v1/user/avatar';
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  async touchDeviceActivity(userId: string, deviceId: string): Promise<void> {
    await this.deviceRepository.update(
      { id: deviceId, userId },
      { lastActiveAt: new Date() },
    );
  }

  async uploadOneTimePrekeys(
    userId: string,
    deviceId: string,
    data: {
      identityKey?: string;
      signedPrekey?: {
        keyId: number;
        publicKey: string;
        signature: string;
      };
      oneTimePrekeys?: Array<{
        keyId: number;
        publicKey: string;
      }>;
      kyberPrekey?: {
        keyId: number;
        publicKey: string;
        signature: string;
      };
    },
  ): Promise<{ inserted: number; deviceId: string }> {
    await this.assertOwnDevice(userId, deviceId);
    const nowUnixSeconds = Math.floor(Date.now() / 1000);

    let insertedCount = 0;

    // 更新签名预密钥（如果提供）
    if (data.identityKey || data.signedPrekey) {
      await this.deviceRepository.update(
        { id: deviceId, userId },
        {
          identityPublicKey: data.identityKey,
          signedPreKey: data.signedPrekey?.publicKey,
          signedPreKeySignature: data.signedPrekey?.signature,
        },
      );
      insertedCount++;
    }

    // 插入一次性预密钥（如果提供）
    if (data.oneTimePrekeys && data.oneTimePrekeys.length > 0) {
      // 客户端可能重复上传同一批 keyId；这里做幂等去重，避免唯一键冲突。
      const dedupedByKeyId = new Map<number, { keyId: number; publicKey: string }>();
      for (const prekey of data.oneTimePrekeys) {
        if (typeof prekey.keyId === 'number') {
          dedupedByKeyId.set(prekey.keyId, prekey);
        }
      }

      const incomingKeyIds = [...dedupedByKeyId.keys()];
      if (incomingKeyIds.length > 0) {
        const existing = await this.oneTimePrekeyRepository.find({
          where: {
            deviceId,
            keyId: In(incomingKeyIds),
          },
          select: ['keyId'],
        });
        const existingKeyIds = new Set(existing.map((item) => item.keyId).filter((v): v is number => v !== null));
        const rows = incomingKeyIds
          .filter((keyId) => !existingKeyIds.has(keyId))
          .map((keyId) => {
            const prekey = dedupedByKeyId.get(keyId)!;
            return this.oneTimePrekeyRepository.create({
              deviceId,
              keyId: prekey.keyId,
              publicKey: prekey.publicKey,
              isUsed: false,
            });
          });

        if (rows.length > 0) {
          await this.oneTimePrekeyRepository.save(rows);
          insertedCount += rows.length;
        }
      }
    }

    if (data.kyberPrekey) {
      const existingKyber = await this.kyberPrekeyRepository.findOne({
        where: {
          userId,
          kyberPreKeyId: data.kyberPrekey.keyId,
        },
        order: { createdAt: 'DESC' },
      });

      if (existingKyber) {
        existingKyber.publicKey = data.kyberPrekey.publicKey;
        existingKyber.signature = data.kyberPrekey.signature;
        existingKyber.timestamp = nowUnixSeconds;
        await this.kyberPrekeyRepository.save(existingKyber);
      } else {
        await this.kyberPrekeyRepository.save(
          this.kyberPrekeyRepository.create({
            userId,
            kyberPreKeyId: data.kyberPrekey.keyId,
            publicKey: data.kyberPrekey.publicKey,
            signature: data.kyberPrekey.signature,
            timestamp: nowUnixSeconds,
          }),
        );
      }
      insertedCount += 1;
    }

    return {
      inserted: insertedCount,
      deviceId,
    };
  }

  async registerDevice(userId: string, deviceData: {
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    registrationId?: number;
  }): Promise<{ deviceId: string }> {
    const device = this.deviceRepository.create({
      userId,
      deviceName: deviceData.deviceName,
      deviceType: deviceData.deviceType,
      identityPublicKey: deviceData.identityPublicKey,
      signedPreKey: deviceData.signedPreKey,
      signedPreKeySignature: deviceData.signedPreKeySignature,
      registrationId: deviceData.registrationId || randomInt(1, 65535),
      lastActiveAt: new Date(),
    });

    const savedDevice = await this.deviceRepository.save(device);
    return { deviceId: savedDevice.id };
  }

  async listDevices(userId: string): Promise<Array<{
    deviceId: string;
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    registrationId: number | null;
    createdAt: string;
    lastActiveAt: string | null;
  }>> {
    const devices = await this.deviceRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return devices.map(device => ({
      deviceId: device.id,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      identityPublicKey: device.identityPublicKey,
      signedPreKey: device.signedPreKey,
      signedPreKeySignature: device.signedPreKeySignature,
      registrationId: device.registrationId,
      createdAt: device.createdAt.toISOString(),
      lastActiveAt: device.lastActiveAt?.toISOString() || null,
    }));
  }

  async updateDevice(userId: string, deviceId: string, deviceData: {
    deviceName: string;
  }): Promise<{ updated: boolean }> {
    await this.assertOwnDevice(userId, deviceId);

    const result = await this.deviceRepository.update(
      { id: deviceId, userId },
      { deviceName: deviceData.deviceName },
    );

    return { updated: (result.affected || 0) > 0 };
  }

  async deleteDevice(userId: string, deviceId: string): Promise<{ deleted: boolean }> {
    await this.assertOwnDevice(userId, deviceId);

    const result = await this.deviceRepository.delete({
      id: deviceId,
      userId,
    });

    return { deleted: (result.affected || 0) > 0 };
  }

  async getNextAvailablePrekey(deviceId: string): Promise<{
    preKeyId: string;
    deviceId: string;
    keyId: number | null;
    publicKey: string;
  } | null> {
    const prekey = await this.oneTimePrekeyRepository.findOne({
      where: { deviceId, isUsed: false },
      order: { createdAt: 'ASC' },
    });

    if (!prekey) {
      return null;
    }

    return {
      preKeyId: prekey.id,
      deviceId: prekey.deviceId,
      keyId: prekey.keyId,
      publicKey: prekey.publicKey,
    };
  }

  async consumePrekey(preKeyId: string): Promise<{
    consumed: boolean;
    alreadyUsed: boolean;
    preKeyId: string;
  }> {
    const prekey = await this.oneTimePrekeyRepository.findOne({
      where: { id: preKeyId },
    });

    if (!prekey) {
      throw new NotFoundException('Prekey not found');
    }

    if (prekey.isUsed) {
      return {
        consumed: true,
        alreadyUsed: true,
        preKeyId,
      };
    }

    const updated = await this.oneTimePrekeyRepository.update(
      { id: preKeyId, isUsed: false },
      { isUsed: true },
    );
    if ((updated.affected ?? 0) === 0) {
      return {
        consumed: true,
        alreadyUsed: true,
        preKeyId,
      };
    }

    return {
      consumed: true,
      alreadyUsed: false,
      preKeyId,
    };
  }

  async getAndConsumeNextPrekey(deviceId: string): Promise<{
    preKeyId: string;
    deviceId: string;
    keyId: number | null;
    publicKey: string;
  } | null> {
    return this.oneTimePrekeyRepository.manager.transaction(async (manager) => {
      const rows = await manager.query(
        `
        WITH picked AS (
          SELECT id, device_id, key_id, public_key
          FROM one_time_prekeys
          WHERE device_id = $1 AND is_used = false
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE one_time_prekeys otp
        SET is_used = true
        FROM picked
        WHERE otp.id = picked.id
        RETURNING picked.id AS "preKeyId", picked.device_id AS "deviceId", picked.key_id AS "keyId", picked.public_key AS "publicKey";
        `,
        [deviceId],
      );

      if (!rows?.length) {
        return null;
      }

      const first = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
      if (!first) {
        return null;
      }

      return first as { preKeyId: string; deviceId: string; keyId: number | null; publicKey: string };
    });
  }

  private async assertOwnDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
      select: ['id', 'userId'],
    });

    if (!device) {
      // 检查用户是否没有任何设备，如果是，则可能是注册后首次上传预密钥
      const userDevices = await this.deviceRepository.find({
        where: { userId },
        select: ['id'],
      });
      
      if (userDevices.length === 0) {
        throw new NotFoundException('No devices found for user');
      }
      
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== userId) {
      throw new ForbiddenException('Device does not belong to current user');
    }
  }

  async getUserSignalInfo(userId: string): Promise<{
    identityPublicKey: string;
    identityKeyFingerprint: string;
    registrationId: number;
    signalVersion: number;
  } | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['identityPublicKey', 'identityKeyFingerprint', 'registrationId', 'signalVersion'],
    });

    return user ? {
      identityPublicKey: user.identityPublicKey!,
      identityKeyFingerprint: user.identityKeyFingerprint!,
      registrationId: user.registrationId!,
      signalVersion: user.signalVersion!,
    } : null;
  }

  async verifyIdentityKey(userId: string, deviceId: string, fingerprint: string): Promise<{ verified: boolean }> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, userId },
      select: ['identityPublicKey'],
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const deviceFingerprint = device.identityPublicKey.substring(0, 16);
    return { verified: deviceFingerprint === fingerprint };
  }

  async updateSignedPreKey(userId: string, deviceId: string, signedPreKey: string, signedPreKeySignature: string): Promise<{ updated: boolean }> {
    await this.assertOwnDevice(userId, deviceId);

    const result = await this.deviceRepository.update(
      { id: deviceId, userId },
      { signedPreKey, signedPreKeySignature },
    );

    return { updated: (result.affected || 0) > 0 };
  }

  async getDevicesByUserIds(userIds: string[]): Promise<Array<{
    userId: string;
    devices: Array<{
      deviceId: string;
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      registrationId: number | null;
    }>;
  }>> {
    const devices = await this.deviceRepository.find({
      where: { userId: In(userIds) },
      select: ['id', 'userId', 'identityPublicKey', 'signedPreKey', 'signedPreKeySignature', 'registrationId'],
    });

    const result = userIds.map(userId => ({
      userId,
      devices: devices
        .filter(device => device.userId === userId)
        .map(device => ({
          deviceId: device.id,
          identityPublicKey: device.identityPublicKey,
          signedPreKey: device.signedPreKey,
          signedPreKeySignature: device.signedPreKeySignature,
          registrationId: device.registrationId,
        })),
    }));

    return result;
  }

  async getPrekeysByDeviceId(deviceId: string, limit: number = 10): Promise<Array<{
    preKeyId: string;
    publicKey: string;
  }>> {
    const prekeys = await this.oneTimePrekeyRepository.find({
      where: { deviceId, isUsed: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return prekeys.map(prekey => ({
      preKeyId: prekey.id,
      publicKey: prekey.publicKey,
    }));
  }

  /**
   * 获取预密钥包（用于 X3DH 密钥交换）
   * 返回身份密钥、签名预密钥和一个一次性预密钥
   */
  async getPrekeyBundle(userId: string, deviceId: string): Promise<{
    registrationId: number;
    identityKey: string;
    signedPrekey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePrekey?: {
      preKeyId: string;
      keyId: number;
      publicKey: string;
    };
    kyberPrekey?: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
  } | null> {
    // 获取设备信息
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, userId },
      select: ['id', 'userId', 'identityPublicKey', 'signedPreKey', 'signedPreKeySignature', 'registrationId'],
    });

    if (!device) {
      return null;
    }

    // 获取并消耗一个一次性预密钥
    const oneTimePrekey = await this.getAndConsumeNextPrekey(deviceId);
    const kyberPrekey = await this.kyberPrekeyRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      registrationId: device.registrationId || 0,
      identityKey: device.identityPublicKey,
      signedPrekey: {
        keyId: 1, // 签名预密钥通常使用固定 keyId
        publicKey: device.signedPreKey,
        signature: device.signedPreKeySignature,
      },
      oneTimePrekey: oneTimePrekey ? {
        preKeyId: oneTimePrekey.preKeyId,
        keyId: oneTimePrekey.keyId ?? 1,
        publicKey: oneTimePrekey.publicKey,
      } : undefined,
      kyberPrekey: kyberPrekey
        ? {
            keyId: kyberPrekey.kyberPreKeyId,
            publicKey: kyberPrekey.publicKey,
            signature: kyberPrekey.signature,
          }
        : undefined,
    };
  }

  /**
   * 获取预密钥包（不消耗预密钥，用于查询）
   */
  async peekPrekeyBundle(userId: string, deviceId: string): Promise<{
    registrationId: number;
    identityKey: string;
    signedPrekey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePrekeyAvailable: boolean;
    kyberPrekeyAvailable: boolean;
  } | null> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, userId },
      select: ['id', 'userId', 'identityPublicKey', 'signedPreKey', 'signedPreKeySignature', 'registrationId'],
    });

    if (!device) {
      return null;
    }

    // 检查是否有可用的一次性预密钥
    const availablePrekey = await this.getNextAvailablePrekey(deviceId);
    const kyberPrekey = await this.kyberPrekeyRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      registrationId: device.registrationId || 0,
      identityKey: device.identityPublicKey,
      signedPrekey: {
        keyId: 1,
        publicKey: device.signedPreKey,
        signature: device.signedPreKeySignature,
      },
      oneTimePrekeyAvailable: !!availablePrekey,
      kyberPrekeyAvailable: !!kyberPrekey,
    };
  }

  /**
   * 获取预密钥数量统计
   */
  async getPrekeyStats(deviceId: string): Promise<{
    total: number;
    used: number;
    available: number;
    needsReplenish: boolean;
  }> {
    const [total, used, available] = await Promise.all([
      this.oneTimePrekeyRepository.count({ where: { deviceId } }),
      this.oneTimePrekeyRepository.count({ where: { deviceId, isUsed: true } }),
      this.oneTimePrekeyRepository.count({ where: { deviceId, isUsed: false } }),
    ]);

    const MIN_PREKEY_THRESHOLD = 20;

    return {
      total,
      used,
      available,
      needsReplenish: available < MIN_PREKEY_THRESHOLD,
    };
  }

  // ==================== 密钥验证功能 ====================

  /**
   * 标记密钥已验证
   */
  async verifyKey(
    userId: string,
    verifiedUserId: string,
    deviceId: string | undefined,
    fingerprint: string,
    isVerified: boolean
  ): Promise<{ success: boolean; message: string }> {
    // 验证目标用户是否存在
    const verifiedUser = await this.userRepository.findOne({ where: { id: verifiedUserId } });
    if (!verifiedUser) {
      throw new NotFoundException('Verified user not found');
    }

    // 查找或创建密钥验证记录
    let verification = await this.keyVerificationRepository.findOne({
      where: {
        userId,
        verifiedUserId,
        verifiedDeviceId: deviceId,
      },
    });

    if (!verification) {
      verification = this.keyVerificationRepository.create({
        userId,
        verifiedUserId,
        verifiedDeviceId: deviceId,
        fingerprint,
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
      });
    } else {
      verification.isVerified = isVerified;
      verification.verifiedAt = isVerified ? new Date() : null;
    }

    await this.keyVerificationRepository.save(verification);

    return {
      success: true,
      message: isVerified ? 'Key verified successfully' : 'Key verification removed',
    };
  }

  /**
   * 获取验证状态
   */
  async getVerificationStatus(
    userId: string,
    verifiedUserId: string
  ): Promise<{
    userId: string;
    fingerprint: string;
    isVerified: boolean;
    verifiedAt?: string;
    devices: Array<{
      deviceId: string;
      deviceName: string;
      fingerprint: string;
      isVerified: boolean;
    }>;
  }> {
    // 验证目标用户是否存在
    const verifiedUser = await this.userRepository.findOne({ where: { id: verifiedUserId } });
    if (!verifiedUser) {
      throw new NotFoundException('Verified user not found');
    }

    // 获取用户级别的验证状态
    const userVerification = await this.keyVerificationRepository.findOne({
      where: {
        userId,
        verifiedUserId,
        verifiedDeviceId: undefined,
      },
    });

    // 获取设备级别的验证状态
    const deviceVerifications = await this.keyVerificationRepository.find({
      where: {
        userId,
        verifiedUserId,
        verifiedDeviceId: Not(''),
      },
    });

    // 获取目标用户的所有设备
    const devices = await this.deviceRepository.find({ where: { userId: verifiedUserId } });

    // 构建设备验证状态列表
    const deviceStatuses = devices.map(device => {
      const deviceVerification = deviceVerifications.find(
        v => v.verifiedDeviceId === device.id
      );
      return {
        deviceId: device.id,
        deviceName: device.deviceName,
        fingerprint: this.generateKeyFingerprint(device.identityPublicKey),
        isVerified: deviceVerification?.isVerified || false,
      };
    });

    return {
      userId: verifiedUserId,
      fingerprint: userVerification?.fingerprint || this.generateKeyFingerprint(verifiedUser.identityPublicKey!),
      isVerified: userVerification?.isVerified || false,
      verifiedAt: userVerification?.verifiedAt?.toISOString(),
      devices: deviceStatuses,
    };
  }

  // ==================== 设备链接功能 ====================

  /**
   * 生成设备链接二维码数据
   * 主设备调用此接口生成二维码，供从设备扫描
   */
  async generateLinkingQRCode(
    userId: string,
    deviceName: string,
    deviceType: string,
  ): Promise<{
    temporaryToken: string;
    qrCodeData: string;
    expiresAt: Date;
  }> {
    // 获取主设备的身份密钥
    const devices = await this.listDevices(userId);
    if (devices.length === 0) {
      throw new BadRequestException('No existing device found');
    }

    const primaryDevice = devices[0];
    const fingerprint = this.generateKeyFingerprint(primaryDevice.identityPublicKey);

    // 生成临时令牌
    const temporaryToken = randomUUID();

    // 生成临时密钥对（用于建立安全通道）
    const temporaryPublicKey = randomUUID(); // 实际应该使用 ECDH 生成密钥对

    // 存储链接请求到 Redis
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    const requestData = {
      userId,
      deviceName,
      deviceType,
      temporaryPublicKey,
      fingerprint,
      expiresAt: expiresAt.toISOString(),
      confirmed: false,
    };

    // 使用 Redis 存储，设置过期时间
    await this.redis.setex(
      `linking:${temporaryToken}`,
      300, // 5分钟过期
      JSON.stringify(requestData)
    );

    // 构建二维码数据
    const qrCodeData = JSON.stringify({
      temporaryToken,
      temporaryPublicKey,
      fingerprint,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      temporaryToken,
      qrCodeData,
      expiresAt,
    };
  }

  /**
   * 验证链接请求
   * 从设备扫描二维码后，调用此接口验证令牌
   */
  async verifyLinkingToken(temporaryToken: string): Promise<{
    valid: boolean;
    userId?: string;
    fingerprint?: string;
    expiresAt?: Date;
  }> {
    try {
      const requestData = await this.redis.get(`linking:${temporaryToken}`);
      if (!requestData) {
        return { valid: false };
      }

      const request = JSON.parse(requestData);
      const expiresAt = new Date(request.expiresAt);

      if (new Date() > expiresAt) {
        await this.redis.del(`linking:${temporaryToken}`);
        return { valid: false };
      }

      return {
        valid: true,
        userId: request.userId,
        fingerprint: request.fingerprint,
        expiresAt,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * 确认设备链接
   * 主设备确认后，完成设备链接
   */
  async confirmLinkDevice(
    userId: string,
    temporaryToken: string,
    deviceData: {
      deviceName: string;
      deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      registrationId?: number;
    },
  ): Promise<{ deviceId: string; success: boolean }> {
    try {
      const requestData = await this.redis.get(`linking:${temporaryToken}`);
      if (!requestData) {
        throw new BadRequestException('Invalid or expired linking token');
      }

      const request = JSON.parse(requestData);

      if (request.userId !== userId) {
        throw new ForbiddenException('Token does not belong to current user');
      }

      const expiresAt = new Date(request.expiresAt);
      if (new Date() > expiresAt) {
        await this.redis.del(`linking:${temporaryToken}`);
        throw new BadRequestException('Linking token has expired');
      }

      if (request.confirmed) {
        throw new BadRequestException('Linking token has already been used');
      }

      // 注册新设备
      const { deviceId } = await this.registerDevice(userId, deviceData);

      // 标记链接请求为已确认
      request.confirmed = true;
      await this.redis.setex(
        `linking:${temporaryToken}`,
        300, // 5分钟过期
        JSON.stringify(request)
      );

      return { deviceId, success: true };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Invalid or expired linking token');
    }
  }
}
