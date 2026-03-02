import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { OneTimePrekey } from './entities/one-time-prekey.entity';
import { User } from './entities/user.entity';

interface CreateUserInput {
  username: string;
  email: string;
  phone: string;
  passwordHash: string;
  device: {
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
  };
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
  ) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const user = this.userRepository.create({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
    });

    const savedUser = await this.userRepository.save(user);

    const device = this.deviceRepository.create({
      userId: savedUser.id,
      deviceName: input.device.deviceName,
      deviceType: input.device.deviceType,
      identityPublicKey: input.device.identityPublicKey,
      signedPreKey: input.device.signedPreKey,
      signedPreKeySignature: input.device.signedPreKeySignature,
      lastActiveAt: new Date(),
    });

    await this.deviceRepository.save(device);
    return savedUser;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone: phone.trim() } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username: username.trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
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
    prekeys: string[],
  ): Promise<{ inserted: number; deviceId: string }> {
    await this.assertOwnDevice(userId, deviceId);

    const rows = prekeys.map((publicKey) =>
      this.oneTimePrekeyRepository.create({
        deviceId,
        publicKey,
        isUsed: false,
      }),
    );

    await this.oneTimePrekeyRepository.save(rows);

    return {
      inserted: rows.length,
      deviceId,
    };
  }

  async registerDevice(userId: string, deviceData: {
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
  }): Promise<{ deviceId: string }> {
    const device = this.deviceRepository.create({
      userId,
      deviceName: deviceData.deviceName,
      deviceType: deviceData.deviceType,
      identityPublicKey: deviceData.identityPublicKey,
      signedPreKey: deviceData.signedPreKey,
      signedPreKeySignature: deviceData.signedPreKeySignature,
      lastActiveAt: new Date(),
    });

    const savedDevice = await this.deviceRepository.save(device);
    return { deviceId: savedDevice.id };
  }

  async listDevices(userId: string): Promise<Array<{
    deviceId: string;
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
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
    publicKey: string;
  } | null> {
    const rows = await this.oneTimePrekeyRepository.query(
      `
      WITH picked AS (
        SELECT id, device_id, public_key
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
      RETURNING picked.id AS "preKeyId", picked.device_id AS "deviceId", picked.public_key AS "publicKey";
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

    return first as { preKeyId: string; deviceId: string; publicKey: string };
  }

  private async assertOwnDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
      select: ['id', 'userId'],
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== userId) {
      throw new ForbiddenException('Device does not belong to current user');
    }
  }
}
