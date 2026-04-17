import {
  MigrationPackage,
  MigrationAuthCode,
  hkdf,
  sha256,
  encryptAesGcm,
  arrayToBase64,
  base64ToArray,
} from './migration-package';

/**
 * 迁移打包器
 * 负责生成迁移数据包和授权码
 */
export class MigrationPacker {
  private sourceDeviceId: string;

  constructor(sourceDeviceId: string) {
    this.sourceDeviceId = sourceDeviceId;
  }

  /**
   * 生成迁移授权码
   * 用于在新设备扫码建立连接
   */
  async generateAuthCode(): Promise<MigrationAuthCode> {
    const code = this.generateSixDigitCode();
    const authCode: MigrationAuthCode = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟有效
      sourceDeviceId: this.sourceDeviceId,
    };

    // 存储授权码（带时效）
    await this.storeAuthCode(authCode);

    return authCode;
  }

  /**
   * 创建迁移数据包
   */
  async createPackage(migrationKey: Uint8Array): Promise<MigrationPackage> {
    // 1. 读取本地数据
    const messages = await this.readAllMessages();
    const sessions = await this.readAllSessions();
    const contacts = await this.readContacts();
    const blockedUsers = await this.readBlockedUsers();
    const settings = await this.readSettings();

    // 2. 生成专用密钥
    const messageKey = await hkdf(migrationKey, 32, 'message-encryption');
    const sessionKey = await hkdf(migrationKey, 32, 'session-encryption');

    // 3. 加密消息数据
    const encryptedMessages = await encryptAesGcm(
      JSON.stringify(messages),
      messageKey
    );
    const encryptedConversations = await encryptAesGcm(
      JSON.stringify(this.extractConversations(messages)),
      messageKey
    );

    // 4. 加密 Session 数据
    const encryptedSessions = await encryptAesGcm(
      JSON.stringify(sessions),
      sessionKey
    );
    const encryptedPrekeyConsumption = await encryptAesGcm(
      JSON.stringify([]), // TODO: 读取预密钥消耗记录
      sessionKey
    );

    // 5. 加密联系人数据
    const encryptedContacts = await encryptAesGcm(
      JSON.stringify(contacts),
      migrationKey
    );
    const encryptedBlockedUsers = await encryptAesGcm(
      JSON.stringify(blockedUsers),
      migrationKey
    );

    // 6. 加密设置
    const encryptedSettings = await encryptAesGcm(
      JSON.stringify(settings),
      migrationKey
    );

    // 7. 计算校验和
    const messageKeyChecksum = await sha256(messageKey);
    const sessionKeyChecksum = await sha256(sessionKey);

    // 8. 组装数据包
    const pkg: MigrationPackage = {
      version: 1,
      exportedAt: Date.now(),
      deviceId: this.sourceDeviceId,
      encryptedMessageStore: {
        conversations: encryptedConversations,
        messages: encryptedMessages,
        messageKeyChecksum,
      },
      encryptedSessionStore: {
        sessions: encryptedSessions,
        prekeyConsumption: encryptedPrekeyConsumption,
        sessionKeyChecksum,
      },
      encryptedContactStore: {
        contacts: encryptedContacts,
        blockedUsers: encryptedBlockedUsers,
      },
      encryptedSettings: {
        settings: encryptedSettings,
      },
      metadata: this.computeMetadata(messages),
      integrity: {
        packageChecksum: '', // 稍后计算
        signature: '',      // 稍后生成
      },
    };

    // 9. 计算完整性和签名
    pkg.integrity.packageChecksum = await this.computePackageChecksum(pkg);
    pkg.integrity.signature = await this.signPackage(pkg, migrationKey);

    return pkg;
  }

  /**
   * 通过授权码验证迁移请求
   */
  async validateAuthCode(code: string, targetDeviceId: string): Promise<boolean> {
    const stored = await this.getStoredAuthCode(code);
    if (!stored) return false;

    const now = Date.now();
    if (now > stored.expiresAt) {
      await this.deleteAuthCode(code);
      return false;
    }

    // 关联目标设备
    stored.targetDeviceId = targetDeviceId;
    await this.storeAuthCode(stored);

    return true;
  }

  private generateSixDigitCode(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return String(array[0] % 1000000).padStart(6, '0');
  }

  private async storeAuthCode(code: MigrationAuthCode): Promise<void> {
    sessionStorage.setItem(`migration-auth-${code.code}`, JSON.stringify(code));
  }

  private async getStoredAuthCode(code: string): Promise<MigrationAuthCode | null> {
    const stored = sessionStorage.getItem(`migration-auth-${code}`);
    return stored ? JSON.parse(stored) : null;
  }

  private async deleteAuthCode(code: string): Promise<void> {
    sessionStorage.removeItem(`migration-auth-${code}`);
  }

  private async computePackageChecksum(pkg: MigrationPackage): Promise<string> {
    // 排除 integrity 字段计算校验和
    const { integrity, ...rest } = pkg;
    const data = new TextEncoder().encode(JSON.stringify(rest));
    return sha256(new Uint8Array(data));
  }

  private async signPackage(pkg: MigrationPackage, key: Uint8Array): Promise<string> {
    // 简化实现：使用 HMAC-SHA256 签名
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const data = new TextEncoder().encode(
      pkg.integrity.packageChecksum + pkg.deviceId + pkg.exportedAt
    );

    const signature = await crypto.subtle.sign('HMAC', hmacKey, data);
    return arrayToBase64(new Uint8Array(signature));
  }

  private computeMetadata(messages: any[]): MigrationPackage['metadata'] {
    if (messages.length === 0) {
      return {
        totalMessageCount: 0,
        totalSessionCount: 0,
        oldestMessageTimestamp: 0,
        newestMessageTimestamp: 0,
      };
    }

    const timestamps = messages
      .map((m: any) => m.timestamp)
      .filter((t: number) => t > 0)
      .sort();

    return {
      totalMessageCount: messages.length,
      totalSessionCount: new Set(messages.map((m: any) => m.conversationId)).size,
      oldestMessageTimestamp: timestamps[0] || 0,
      newestMessageTimestamp: timestamps[timestamps.length - 1] || 0,
    };
  }

  private extractConversations(messages: any[]): any[] {
    const conversations = new Map();
    for (const msg of messages) {
      if (!conversations.has(msg.conversationId)) {
        conversations.set(msg.conversationId, {
          id: msg.conversationId,
          name: msg.conversationName || 'Unknown',
          type: msg.conversationType || 'direct',
        });
      }
    }
    return Array.from(conversations.values());
  }

  // 数据读取方法（需要与现有存储逻辑集成）
  private async readAllMessages(): Promise<any[]> {
    // TODO: 从 SQLite 或 localStorage 读取所有消息
    return [];
  }

  private async readAllSessions(): Promise<any[]> {
    // TODO: 从 localStorage 读取所有会话
    return [];
  }

  private async readContacts(): Promise<any[]> {
    // TODO: 从 localStorage 读取联系人
    return [];
  }

  private async readBlockedUsers(): Promise<any[]> {
    // TODO: 从 localStorage 读取黑名单
    return [];
  }

  private async readSettings(): Promise<any> {
    // TODO: 从 localStorage 读取设置
    return {};
  }
}
