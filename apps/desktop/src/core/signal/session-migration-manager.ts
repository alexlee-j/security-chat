import { SessionKeyManager } from './session-key';
import { migrateSessionKeys } from './migrate-session-keys';

/**
 * 会话迁移管理器
 * 负责将旧的硬编码 deviceId='1' 的会话迁移到正确的 deviceId
 */
export class SessionMigrationManager {
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * 检查是否需要迁移
   */
  async checkMigrationNeeded(): Promise<boolean> {
    const hasOldFormatSessions = await this.hasOldFormatSessions();
    if (hasOldFormatSessions) {
      console.log('[Migration] Old format sessions found, migration needed');
    }
    return hasOldFormatSessions;
  }

  /**
   * 执行所有会话迁移
   */
  async migrateAllSessions(): Promise<number> {
    console.log(`[Migration] Starting session migration with deviceId: ${this.deviceId}`);

    // 获取所有会话 keys
    const sessionKeys = await this.getAllSessionKeys();
    let migrated = 0;

    for (const oldKey of sessionKeys) {
      const parsed = SessionKeyManager.parseSessionKey(oldKey);
      if (parsed && parsed.deviceId === '1') {
        await migrateSessionKeys(oldKey, this.deviceId);
        migrated++;
      }
    }

    console.log(`[Migration] Migrated ${migrated} sessions`);
    return migrated;
  }

  /**
   * 获取需要迁移的会话数量
   */
  async getMigrationCount(): Promise<number> {
    const sessionKeys = await this.getAllSessionKeys();
    return sessionKeys.filter(key => {
      const parsed = SessionKeyManager.parseSessionKey(key);
      return parsed?.deviceId === '1';
    }).length;
  }

  /**
   * 检查是否存在旧格式会话
   */
  private async hasOldFormatSessions(): Promise<boolean> {
    const keys = await this.getAllSessionKeys();
    return keys.some(key => {
      const parsed = SessionKeyManager.parseSessionKey(key);
      return parsed?.deviceId === '1';
    });
  }

  /**
   * 获取所有会话 key
   */
  private async getAllSessionKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('security-chat-session-')) {
        keys.push(key.replace('security-chat-session-', ''));
      }
    }
    return keys;
  }
}

/**
 * 创建设备迁移管理器
 */
export async function createSessionMigrationManager(): Promise<SessionMigrationManager> {
  // 获取当前设备的 deviceId
  // 这个值应该在登录时从服务器获取并存储
  let deviceId = localStorage.getItem('security-chat-device-id');

  if (!deviceId) {
    // 如果没有 deviceId，生成一个临时 ID
    deviceId = `temp-${Date.now()}`;
    console.warn('[Migration] No deviceId found, using temporary ID:', deviceId);
  }

  return new SessionMigrationManager(deviceId);
}
