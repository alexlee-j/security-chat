/**
 * 安全存储模块
 * 使用 Web Crypto API 加密 localStorage 中的敏感数据
 */

const STORAGE_PREFIX = 'security-chat.';
const KEY_PREFIX = 'key.';

/**
 * 生成或获取主加密密钥
 */
async function getMasterKey(): Promise<CryptoKey> {
  const keyId = 'master-key-v1';
  const storedKeyId = STORAGE_PREFIX + KEY_PREFIX + keyId;
  
  try {
    const stored = localStorage.getItem(storedKeyId);
    if (stored) {
      const keyData = JSON.parse(stored);
      return await crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  } catch {
    // Key import failed, generate new one
  }
  
  // Generate new master key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exported = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(storedKeyId, JSON.stringify(exported));
  
  return key;
}

/**
 * 加密数据
 */
async function encryptData(data: string): Promise<string> {
  const key = await getMasterKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  
  return `${ivBase64}:${encryptedBase64}`;
}

/**
 * 解密数据
 */
async function decryptData(encrypted: string): Promise<string> {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 2) {
      return encrypted; // Not encrypted, return as-is
    }
    
    const [ivBase64, encryptedBase64] = parts;
    const ivData = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const key = await getMasterKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivData },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch {
    return encrypted; // Decryption failed, return as-is
  }
}

/**
 * 安全地设置存储项（加密）
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    const encrypted = await encryptData(value);
    localStorage.setItem(STORAGE_PREFIX + key, encrypted);
  } catch {
    // Fallback to unencrypted storage
    localStorage.setItem(STORAGE_PREFIX + key, value);
  }
}

/**
 * 安全地获取存储项（解密）
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const encrypted = localStorage.getItem(STORAGE_PREFIX + key);
    if (!encrypted) return null;
    
    const decrypted = await decryptData(encrypted);
    return decrypted;
  } catch {
    return localStorage.getItem(STORAGE_PREFIX + key);
  }
}

/**
 * 安全地移除存储项
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * 解析 JSON 数据（安全）
 */
export async function getSecureJSON<T>(key: string): Promise<T | null> {
  try {
    const value = await getSecureItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * 设置 JSON 数据（安全）
 */
export async function setSecureJSON<T>(key: string, value: T): Promise<void> {
  await setSecureItem(key, JSON.stringify(value));
}

/**
 * 清除所有安全存储（包括主密钥）
 */
export function clearSecureStorage(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
