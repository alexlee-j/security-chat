/**
 * 消息加密/解密模块
 * 使用 Web Crypto API 实现 AES-GCM 加密
 */

/**
 * 使用 Web Crypto API 加密消息内容
 */
export async function encryptPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  // 生成随机密钥和 IV
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 加密数据
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // 导出密钥
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  
  // 格式：keyBase64:ivBase64:encryptedBase64
  return `${keyBase64}:${ivBase64}:${encryptedBase64}`;
}

/**
 * 解密消息内容
 * 兼容旧格式（Base64 编码的明文）和新格式（AES-GCM 加密）
 */
export async function decryptPayload(encryptedData: string): Promise<string> {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // 兼容旧格式（Base64 编码的明文）
      return decodeURIComponent(escape(atob(encryptedData)));
    }

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
  } catch (error) {
    // 解密失败，尝试按旧格式处理
    try {
      return decodeURIComponent(escape(atob(encryptedData)));
    } catch {
      return encryptedData;
    }
  }
}

/**
 * 解密消息内容（同步版本）
 * 兼容旧格式（Base64 编码的明文）和新格式（AES-GCM 加密）
 * 注意：同步版本仅支持旧格式的 Base64 编码，不支持 AES-GCM 加密
 */
export function decryptPayloadSync(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // 兼容旧格式（Base64 编码的明文）
      return decodeURIComponent(escape(atob(encryptedData)));
    }
    // 新格式需要异步解密，这里返回原始数据
    return encryptedData;
  } catch (error) {
    // 解密失败，尝试按旧格式处理
    try {
      return decodeURIComponent(escape(atob(encryptedData)));
    } catch {
      return encryptedData;
    }
  }
}

/**
 * 简单的 Base64 编码（兼容旧格式）
 */
export function encodePayloadBase64(payload: string): string {
  return btoa(unescape(encodeURIComponent(payload)));
}

/**
 * 简单的 Base64 解码（兼容旧格式）
 */
export function decodePayloadBase64(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}
