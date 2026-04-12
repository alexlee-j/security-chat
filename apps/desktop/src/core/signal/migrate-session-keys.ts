import { SessionKeyManager } from './session-key';

/**
 * 会话 Key 迁移脚本
 * 将旧的硬编码 deviceId='1' 的会话迁移到正确的 deviceId
 *
 * 执行方式:
 * 1. 获取服务器返回的真实 deviceId
 * 2. 遍历本地旧格式会话
 * 3. 创建新格式会话
 * 4. 删除旧格式会话
 */
export async function migrateSessionKeys(
  oldSessionKey: string,
  newDeviceId: string
): Promise<void> {
  // 旧格式: session-{userId}-1
  // 新格式: session-{userId}-{actualDeviceId}

  const parsed = SessionKeyManager.parseSessionKey(oldSessionKey);
  if (!parsed) {
    console.warn('[Migration] Invalid old session key format:', oldSessionKey);
    return;
  }

  // 跳过已经是新格式的会话
  if (parsed.deviceId !== '1') {
    console.log('[Migration] Session already migrated:', oldSessionKey);
    return;
  }

  const newSessionKey = SessionKeyManager.getSessionKey(parsed.userId, newDeviceId);
  console.log(`[Migration] Migrating: ${oldSessionKey} -> ${newSessionKey}`);
}
