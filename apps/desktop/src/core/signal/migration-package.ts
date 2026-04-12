/**
 * 迁移数据包结构
 * 包含在新设备重建 Signal Session 和解密历史消息所需的全部数据
 */

export interface EncryptedBlob {
  ciphertext: string;                  // Base64 编码的密文
  algorithm: 'AES-256-GCM';            // 加密算法
  iv: string;                          // 初始向量 (12 bytes, Base64)
  authTag?: string;                     // 认证标签 (AES-GCM 自动包含在密文中)
}

export interface MigrationPackage {
  version: 1;                          // 数据格式版本
  exportedAt: number;                   // 导出时间戳
  deviceId: string;                    // 源设备标识

  // 1. 消息数据（加密）
  encryptedMessageStore: {
    conversations: EncryptedBlob;       // 会话列表
    messages: EncryptedBlob;            // 消息列表
    messageKeyChecksum: string;         // 消息密钥校验和
  };

  // 2. Signal Session 状态（加密）
  encryptedSessionStore: {
    sessions: EncryptedBlob;            // 所有会话状态
    prekeyConsumption: EncryptedBlob;   // 预密钥消耗记录
    sessionKeyChecksum: string;         // Session 密钥校验和
  };

  // 3. 联系人数据（加密）
  encryptedContactStore: {
    contacts: EncryptedBlob;            // 联系人列表
    blockedUsers: EncryptedBlob;        // 黑名单
  };

  // 4. 用户配置（加密）
  encryptedSettings: {
    settings: EncryptedBlob;            // 用户配置
  };

  // 5. 元数据
  metadata: {
    totalMessageCount: number;          // 消息总数
    totalSessionCount: number;          // 会话总数
    oldestMessageTimestamp: number;      // 最老消息时间
    newestMessageTimestamp: number;     // 最新消息时间
  };

  // 6. 完整性校验
  integrity: {
    packageChecksum: string;            // 整个包的 SHA-256
    signature: string;                  // 源设备签名
  };
}

export interface MigrationAuthCode {
  code: string;                         // 6位数字授权码
  expiresAt: number;                    // 过期时间
  sourceDeviceId: string;               // 源设备ID
  targetDeviceId?: string;             // 目标设备ID（授权后填充）
}

/**
 * HKDF-SHA256 派生密钥
 */
export async function hkdf(
  masterKey: Uint8Array,
  length: number,
  purpose: string
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterKey,
    'HKDF',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode(purpose),
    },
    keyMaterial,
    length * 8
  );

  return new Uint8Array(bits);
}

/**
 * SHA-256 哈希
 */
export async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayToBase64(new Uint8Array(hash));
}

/**
 * 将 ArrayBuffer 或 Uint8Array 转换为 base64 字符串
 */
export function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * 将 base64 字符串转换为 Uint8Array
 */
export function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 导入 AES-GCM 密钥
 */
export async function importAesKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 使用 AES-GCM 加密数据
 */
export async function encryptAesGcm(
  plaintext: string,
  key: Uint8Array
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cryptoKey = await importAesKey(key);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  return {
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    algorithm: 'AES-256-GCM',
    iv: arrayToBase64(iv),
  };
}

/**
 * 使用 AES-GCM 解密数据
 */
export async function decryptAesGcm(
  blob: EncryptedBlob,
  key: Uint8Array
): Promise<string> {
  const iv = base64ToArray(blob.iv);
  const ciphertext = base64ToArray(blob.ciphertext);

  const cryptoKey = await importAesKey(key);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
