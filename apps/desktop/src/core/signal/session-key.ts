/**
 * 会话 Key 生成器
 * 确保每个 (userId, deviceId) 组合有唯一的会话 key
 */
export class SessionKeyManager {
  /**
   * 生成会话存储 key
   * 格式: session-{userId}-{deviceId}
   *
   * 之前硬编码 deviceId 为 '1'，导致多设备失效
   * 现在使用正确的 deviceId
   */
  static getSessionKey(remoteUserId: string, remoteDeviceId: string): string {
    if (!remoteUserId || !remoteDeviceId) {
      throw new Error('remoteUserId and remoteDeviceId are required');
    }
    // 清理特殊字符，只允许字母数字和连字符
    const cleanUserId = remoteUserId.replace(/[^a-zA-Z0-9-]/g, '-');
    const cleanDeviceId = remoteDeviceId.replace(/[^a-zA-Z0-9-]/g, '-');
    return `session-${cleanUserId}-${cleanDeviceId}`;
  }

  /**
   * 从会话 key 解析出 userId 和 deviceId
   */
  static parseSessionKey(key: string): { userId: string; deviceId: string } | null {
    const match = key.match(/^session-(.+)-([^-]+)$/);
    if (!match) {
      return null;
    }
    return {
      userId: match[1],
      deviceId: match[2],
    };
  }

  /**
   * 生成消息加密所需的设备标识
   * 用于查找正确的会话
   */
  static getMessageKey(senderUserId: string, senderDeviceId: string): string {
    return `${senderUserId}:${senderDeviceId}`;
  }

  /**
   * 验证 deviceId 格式
   */
  static isValidDeviceId(deviceId: string): boolean {
    return Boolean(deviceId) && deviceId.length > 0 && deviceId.length <= 64;
  }
}
