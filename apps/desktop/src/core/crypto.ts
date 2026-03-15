/**
 * 文件名：crypto.ts
 * 所属模块：桌面端-加密模块
 * 核心作用：实现消息内容的加密和解密，使用 AES-GCM 算法
 * 安全说明：
 *   - 使用用户凭证派生的密钥进行加密
 *   - 每次加密使用随机 IV（初始化向量）
 *   - 支持旧格式（Base64 明文）的向后兼容
 *   - 密钥不随消息传输，只传输 IV 和密文
 * 核心依赖：Web Crypto API
 * 创建时间：2024-01-01
 * 更新说明：2026-03-14 修复密钥管理问题，密钥不再随消息传输
 */

// 全局密钥缓存，避免重复派生
let globalKey: CryptoKey | null = null;
let globalKeyHash: string = '';

/**
 * 从用户凭证派生加密密钥
 * 使用 PBKDF2 算法从密码派生 256 位密钥
 * @param password - 用户密码
 * @param salt - 盐值（固定使用应用名称）
 * @returns Promise<CryptoKey> 派生的密钥
 */
async function deriveKeyFromPassword(password: string, salt: string = 'security-chat-salt'): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(salt);

  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 使用 PBKDF2 派生密钥
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000, // 高迭代次数增加安全性
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 获取或创建加密密钥
 * 使用缓存避免重复派生
 * @param password - 用户密码
 * @returns Promise<CryptoKey> 加密密钥
 */
async function getEncryptionKey(password: string): Promise<CryptoKey> {
  // 简单的密码哈希用于缓存比较
  const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const hashString = Array.from(new Uint8Array(passwordHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (globalKey && globalKeyHash === hashString) {
    return globalKey;
  }

  globalKey = await deriveKeyFromPassword(password);
  globalKeyHash = hashString;
  return globalKey;
}

/**
 * 清除全局密钥（用户登出时调用）
 */
export function clearEncryptionKey(): void {
  globalKey = null;
  globalKeyHash = '';
}

/**
 * 加密消息内容
 * 使用 AES-GCM 算法，格式：ivBase64:encryptedBase64（不再包含密钥）
 * @param payload - 要加密的明文
 * @param password - 用户密码（用于派生密钥）
 * @returns Promise<string> 加密后的字符串
 */
export async function encryptPayload(payload: string, password: string = 'default-key'): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    // 获取或派生密钥
    const key = await getEncryptionKey(password);

    // 生成随机 IV（每次加密都不同）
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // 只传输 IV 和密文，不传输密钥
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    // 格式：ivBase64:encryptedBase64
    return `${ivBase64}:${encryptedBase64}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    // 加密失败时返回 Base64 编码的明文（向后兼容）
    return encodePayloadBase64(payload);
  }
}

/**
 * 解密消息内容
 * 兼容新格式（AES-GCM，iv:ciphertext）和旧格式（Base64 明文或 key:iv:ciphertext）
 * @param encryptedData - 加密的数据
 * @param password - 用户密码（用于派生密钥）
 * @returns Promise<string> 解密后的明文
 */
export async function decryptPayload(encryptedData: string, password: string = 'default-key'): Promise<string> {
  try {
    const parts = encryptedData.split(':');

    // 旧格式：key:iv:ciphertext（3部分）- 仍然支持以兼容旧消息
    if (parts.length === 3) {
      const [keyBase64, ivBase64, encryptedBase64] = parts;

      const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
      const ivData = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
      const encryptedDataBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        true,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivData },
        key,
        encryptedDataBytes
      );

      return new TextDecoder().decode(decrypted);
    }

    // 新格式：iv:ciphertext（2部分）
    if (parts.length === 2) {
      const [ivBase64, encryptedBase64] = parts;

      const ivData = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
      const encryptedDataBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

      // 获取或派生密钥
      const key = await getEncryptionKey(password);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivData },
        key,
        encryptedDataBytes
      );

      return new TextDecoder().decode(decrypted);
    }

    // 旧格式：Base64 编码的明文（1部分，不包含 :）
    return decodePayloadBase64(encryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    // 解密失败，尝试按旧格式处理
    try {
      return decodePayloadBase64(encryptedData);
    } catch {
      return encryptedData;
    }
  }
}

/**
 * 解密消息内容（同步版本）
 * 仅支持旧格式（Base64 明文），新格式需要异步解密
 * @param encryptedData - 加密的数据
 * @returns string 解密后的明文或原始数据
 */
export function decryptPayloadSync(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');

    // 如果包含 : 说明是新格式或旧的三段式格式，需要异步解密
    if (parts.length >= 2) {
      // 返回原始数据，由调用方使用异步版本解密
      return encryptedData;
    }

    // 旧格式（Base64 编码的明文）
    return decodePayloadBase64(encryptedData);
  } catch (error) {
    // 解密失败，返回原始数据
    return encryptedData;
  }
}

/**
 * 简单的 Base64 编码（兼容旧格式）
 * @param payload - 要编码的字符串
 * @returns string Base64 编码
 */
export function encodePayloadBase64(payload: string): string {
  try {
    return btoa(unescape(encodeURIComponent(payload)));
  } catch {
    return payload;
  }
}

/**
 * 简单的 Base64 解码（兼容旧格式）
 * @param encoded - Base64 编码的字符串
 * @returns string 解码后的字符串
 */
export function decodePayloadBase64(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}

/**
 * 生成安全的随机字符串
 * 用于生成消息 ID、nonce 等
 * @param length - 字符串长度（默认 16）
 * @returns string 随机字符串
 */
export function generateSecureRandomString(length: number = 16): string {
  const array = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(array, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, length);
}
