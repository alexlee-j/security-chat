import {
  MigrationPackage,
  hkdf,
  sha256,
  decryptAesGcm,
  base64ToArray,
} from './migration-package';

/**
 * 迁移导入结果
 */
export interface MigrationResult {
  success: boolean;
  importedMessages: number;
  importedSessions: number;
  importedContacts: number;
  errors: MigrationError[];
}

export interface MigrationError {
  type: 'checksum_mismatch' | 'decryption_failed' | 'session_rebuild_failed';
  message: string;
  recoverable: boolean;
}

/**
 * 迁移数据导入器
 * 负责在新设备上解密和恢复迁移数据
 */
export class MigrationUnpacker {
  /**
   * 验证迁移数据包完整性
   */
  async verifyPackage(pkg: MigrationPackage): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查版本
    if (pkg.version !== 1) {
      return { valid: false, error: `Unsupported package version: ${pkg.version}` };
    }

    // 2. 检查必要字段
    if (!pkg.encryptedMessageStore || !pkg.encryptedSessionStore) {
      return { valid: false, error: 'Missing required encrypted stores' };
    }

    // 3. 验证包校验和
    const computedChecksum = await this.computePackageChecksum(pkg);
    if (computedChecksum !== pkg.integrity.packageChecksum) {
      return { valid: false, error: 'Package checksum mismatch - data may be corrupted' };
    }

    return { valid: true };
  }

  /**
   * 解密并导入迁移数据
   */
  async importPackage(
    pkg: MigrationPackage,
    migrationKey: Uint8Array
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      importedMessages: 0,
      importedSessions: 0,
      importedContacts: 0,
      errors: [],
    };

    try {
      // 1. 派生解密密钥
      const messageKey = await hkdf(migrationKey, 32, 'message-encryption');
      const sessionKey = await hkdf(migrationKey, 32, 'session-encryption');

      // 2. 验证消息密钥校验和
      const messageKeyChecksum = await sha256(messageKey);
      if (messageKeyChecksum !== pkg.encryptedMessageStore.messageKeyChecksum) {
        result.errors.push({
          type: 'checksum_mismatch',
          message: 'Message key checksum mismatch',
          recoverable: false,
        });
        return result;
      }

      // 3. 验证 Session 密钥校验和
      const sessionKeyChecksum = await sha256(sessionKey);
      if (sessionKeyChecksum !== pkg.encryptedSessionStore.sessionKeyChecksum) {
        result.errors.push({
          type: 'checksum_mismatch',
          message: 'Session key checksum mismatch',
          recoverable: false,
        });
        return result;
      }

      // 4. 解密消息
      try {
        const messages = await decryptAesGcm(
          pkg.encryptedMessageStore.messages,
          messageKey
        );
        const messageData = JSON.parse(messages);
        await this.importMessages(messageData);
        result.importedMessages = messageData.length;
      } catch (e) {
        result.errors.push({
          type: 'decryption_failed',
          message: `Failed to decrypt messages: ${e}`,
          recoverable: true,
        });
      }

      // 5. 解密并重建 Sessions
      try {
        const sessions = await decryptAesGcm(
          pkg.encryptedSessionStore.sessions,
          sessionKey
        );
        const sessionData = JSON.parse(sessions);
        const rebuiltCount = await this.rebuildSessions(sessionData);
        result.importedSessions = rebuiltCount;
      } catch (e) {
        result.errors.push({
          type: 'session_rebuild_failed',
          message: `Failed to rebuild sessions: ${e}`,
          recoverable: true,
        });
      }

      // 6. 解密联系人
      try {
        const contacts = await decryptAesGcm(
          pkg.encryptedContactStore.contacts,
          migrationKey
        );
        const contactData = JSON.parse(contacts);
        await this.importContacts(contactData);
        result.importedContacts = contactData.length;
      } catch (e) {
        result.errors.push({
          type: 'decryption_failed',
          message: `Failed to decrypt contacts: ${e}`,
          recoverable: true,
        });
      }

      // 7. 解密并恢复设置
      try {
        const settings = await decryptAesGcm(
          pkg.encryptedSettings.settings,
          migrationKey
        );
        await this.applySettings(JSON.parse(settings));
      } catch (e) {
        console.warn('[Migration] Settings restore failed:', e);
      }

      // 8. 全部成功才算成功（无可恢复错误）
      result.success = !result.errors.some(e => !e.recoverable);

    } catch (e) {
      result.errors.push({
        type: 'decryption_failed',
        message: `Unexpected error during import: ${e}`,
        recoverable: false,
      });
    }

    return result;
  }

  /**
   * 导入消息到本地存储
   */
  private async importMessages(messages: any[]): Promise<void> {
    // TODO: 批量写入本地 SQLite
    for (const msg of messages) {
      await this.insertMessage(msg);
    }
  }

  /**
   * 插入单条消息
   */
  private async insertMessage(msg: any): Promise<void> {
    // TODO: 调用现有的消息插入逻辑
    console.log('[Migration] Inserting message:', msg.id);
  }

  /**
   * 重建 Signal Sessions
   */
  private async rebuildSessions(sessions: any[]): Promise<number> {
    let rebuilt = 0;
    for (const session of sessions) {
      try {
        await this.rebuildSession(session);
        rebuilt++;
      } catch (e) {
        console.warn('[Migration] Failed to rebuild session:', e);
      }
    }
    return rebuilt;
  }

  /**
   * 重建单个 Session
   */
  private async rebuildSession(sessionData: any): Promise<void> {
    // TODO: 使用 SignalInterface 重建会话
    console.log('[Migration] Rebuilding session:', sessionData.sessionId);
  }

  /**
   * 导入联系人
   */
  private async importContacts(contacts: any[]): Promise<void> {
    for (const contact of contacts) {
      await this.insertContact(contact);
    }
  }

  /**
   * 插入单个联系人
   */
  private async insertContact(contact: any): Promise<void> {
    // TODO: 调用现有的联系人插入逻辑
    console.log('[Migration] Inserting contact:', contact.id);
  }

  /**
   * 应用设置
   */
  private async applySettings(settings: any): Promise<void> {
    // TODO: 合并设置
    console.log('[Migration] Applying settings');
  }

  private async computePackageChecksum(pkg: MigrationPackage): Promise<string> {
    const { integrity, ...rest } = pkg;
    const data = new TextEncoder().encode(JSON.stringify(rest));
    return sha256(new Uint8Array(data));
  }
}

/**
 * 从文件导入迁移包
 */
export async function importPackageFromFile(file: File): Promise<MigrationPackage> {
  const text = await file.text();
  const pkg = JSON.parse(text) as MigrationPackage;
  return pkg;
}
