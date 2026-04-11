import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdentityKey } from './identity.entity';

/**
 * 身份密钥注册 DTO
 */
export class RegisterIdentityDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  deviceId!: string;

  @IsString()
  identityPublicKey!: string;

  @IsString()
  fingerprint!: string;

  @IsOptional()
  @IsString()
  signedPrekeyPublic?: string;

  @IsOptional()
  @IsString()
  signedPrekeySignature?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  registrationId?: number;
}

/**
 * 身份密钥查询结果
 */
export interface IdentityQueryResult {
  userId: string;
  deviceId: string;
  identityPublicKey: string;
  fingerprint: string;
  signedPrekeyPublic: string | null;
  signedPrekeySignature: string | null;
  registrationId: number | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * 身份密钥服务
 * 负责设备的身份密钥注册、查询和管理
 */
@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(IdentityKey)
    private readonly identityRepository: Repository<IdentityKey>,
  ) {}

  /**
   * 注册设备身份密钥
   * 如果设备已存在则更新，否则创建新记录
   */
  async register(dto: RegisterIdentityDto): Promise<IdentityKey> {
    // 检查是否已存在相同的 userId + deviceId 组合
    const existing = await this.identityRepository.findOne({
      where: {
        userId: dto.userId,
        deviceId: dto.deviceId,
      },
    });

    if (existing) {
      // 更新现有记录
      existing.identityPublicKey = dto.identityPublicKey;
      existing.fingerprint = dto.fingerprint;
      existing.signedPrekeyPublic = dto.signedPrekeyPublic || null;
      existing.signedPrekeySignature = dto.signedPrekeySignature || null;
      existing.registrationId = dto.registrationId || null;
      existing.isActive = true;

      return this.identityRepository.save(existing);
    }

    // 创建新记录
    const identity = this.identityRepository.create({
      userId: dto.userId,
      deviceId: dto.deviceId,
      identityPublicKey: dto.identityPublicKey,
      fingerprint: dto.fingerprint,
      signedPrekeyPublic: dto.signedPrekeyPublic || null,
      signedPrekeySignature: dto.signedPrekeySignature || null,
      registrationId: dto.registrationId || null,
      isActive: true,
    });

    return this.identityRepository.save(identity);
  }

  /**
   * 查询用户的所有设备身份密钥
   */
  async queryByUserId(userId: string): Promise<IdentityQueryResult[]> {
    const identities = await this.identityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return identities.map(this.toQueryResult);
  }

  /**
   * 查询指定设备的身份密钥
   */
  async queryByDeviceId(userId: string, deviceId: string): Promise<IdentityQueryResult | null> {
    const identity = await this.identityRepository.findOne({
      where: { userId, deviceId },
    });

    return identity ? this.toQueryResult(identity) : null;
  }

  /**
   * 查询用户的活跃设备身份密钥
   */
  async queryActiveByUserId(userId: string): Promise<IdentityQueryResult | null> {
    const identity = await this.identityRepository.findOne({
      where: { userId, isActive: true },
      order: { updatedAt: 'DESC' },
    });

    return identity ? this.toQueryResult(identity) : null;
  }

  /**
   * 停用设备身份密钥
   */
  async deactivate(userId: string, deviceId: string): Promise<void> {
    const identity = await this.identityRepository.findOne({
      where: { userId, deviceId },
    });

    if (!identity) {
      throw new NotFoundException('Identity key not found');
    }

    identity.isActive = false;
    await this.identityRepository.save(identity);
  }

  /**
   * 删除设备身份密钥
   */
  async delete(userId: string, deviceId: string): Promise<void> {
    const result = await this.identityRepository.delete({ userId, deviceId });

    if (result.affected === 0) {
      throw new NotFoundException('Identity key not found');
    }
  }

  /**
   * 验证身份密钥是否存在且活跃
   */
  async verify(userId: string, deviceId: string, fingerprint: string): Promise<boolean> {
    const identity = await this.identityRepository.findOne({
      where: { userId, deviceId, isActive: true },
    });

    if (!identity) {
      return false;
    }

    return identity.fingerprint === fingerprint;
  }

  /**
   * 转换为查询结果格式
   */
  private toQueryResult(identity: IdentityKey): IdentityQueryResult {
    return {
      userId: identity.userId,
      deviceId: identity.deviceId,
      identityPublicKey: identity.identityPublicKey,
      fingerprint: identity.fingerprint,
      signedPrekeyPublic: identity.signedPrekeyPublic,
      signedPrekeySignature: identity.signedPrekeySignature,
      registrationId: identity.registrationId,
      isActive: identity.isActive,
      createdAt: identity.createdAt,
    };
  }
}
