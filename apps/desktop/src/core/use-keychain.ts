/**
 * 文件名：use-keychain.ts
 * 所属模块：桌面端-密钥安全存储层
 * 核心作用：封装 Rust Keychain Commands，提供安全的密钥存储和检索能力
 *           基于 macOS Keychain / SQLite 实现
 * 核心依赖：@tauri-apps/api/core, Rust keychain commands
 * 创建时间：2026-04-03 (Week 11)
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 密钥类型枚举
 */
export type KeyType =
  | 'identity'          // 身份密钥对
  | 'signed_prekey'      // 签名预密钥
  | 'one_time_prekey'    // 一次性预密钥
  | 'session'            // 会话密钥
  | 'registration_id'    // 注册 ID
  | string;              // 其他自定义类型

/**
 * Keychain 错误类型
 */
export class KeychainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeychainError';
  }
}

/**
 * 存储密钥到 Keychain
 * @param keyType - 密钥类型
 * @param keyData - 密钥数据
 * @param id - 可选的密钥 ID（用于区分同一类型的多个密钥）
 */
export async function storeKey(
  keyType: KeyType,
  keyData: Uint8Array,
  id?: string
): Promise<void> {
  try {
    // Convert Uint8Array to number[] for Tauri invoke (Vec<u8>)
    const keyDataArray = Array.from(keyData);
    await invoke('keychain_store', {
      id: id ?? 'default',
      key_type: keyType,
      key_data: keyDataArray,
    });
  } catch (error) {
    console.error('[Keychain] Failed to store key:', error);
    throw new KeychainError(`存储密钥失败: ${error}`);
  }
}

/**
 * 从 Keychain 检索密钥
 * @param keyType - 密钥类型
 * @returns 密钥数据，如不存在则返回 null
 */
export async function retrieveKey(keyType: KeyType): Promise<Uint8Array | null> {
  try {
    const result = await invoke<number[] | null>('keychain_retrieve', { keyType });
    if (result === null) {
      return null;
    }
    return new Uint8Array(result);
  } catch (error) {
    console.error('[Keychain] Failed to retrieve key:', error);
    throw new KeychainError(`检索密钥失败: ${error}`);
  }
}

/**
 * 检查密钥是否存在
 * @param keyType - 密钥类型
 * @returns 是否存在
 */
export async function hasKey(keyType: KeyType): Promise<boolean> {
  try {
    const result = await retrieveKey(keyType);
    return result !== null;
  } catch (error) {
    console.error('[Keychain] Failed to check key existence:', error);
    return false;
  }
}

/**
 * 删除密钥
 * @param keyType - 密钥类型
 * @note Rust 侧 keychain_delete 命令尚未暴露为 Tauri Command
 */
export async function deleteKey(keyType: KeyType): Promise<void> {
  // TODO: 当 Rust 侧添加 keychain_delete Tauri Command 后实现
  console.warn('[Keychain] deleteKey not yet implemented - Rust command not exposed');
  throw new KeychainError('删除密钥功能尚未实现');
}

/**
 * 存储身份密钥对
 * @param identityKeyPair - 身份密钥对（包含公钥和私钥）
 */
export async function storeIdentityKey(identityKeyPair: CryptoKeyPair): Promise<void> {
  const publicKey = await crypto.subtle.exportKey('raw', identityKeyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', identityKeyPair.privateKey);

  // 合并公钥和私钥
  const combined = new Uint8Array(publicKey.byteLength + privateKey.byteLength);
  combined.set(new Uint8Array(publicKey), 0);
  combined.set(new Uint8Array(privateKey), publicKey.byteLength);

  await storeKey('identity', combined);
}

/**
 * 获取身份密钥对
 * @returns 身份密钥对，如不存在则返回 null
 */
export async function retrieveIdentityKey(): Promise<CryptoKeyPair | null> {
  const combined = await retrieveKey('identity');
  if (!combined) {
    return null;
  }

  try {
    // 公钥长度固定为 32 字节（Curve25519）
    const publicKeyLength = 32;
    const publicKey = combined.slice(0, publicKeyLength);
    const privateKey = combined.slice(publicKeyLength);

    const importedPublicKey = await crypto.subtle.importKey(
      'raw',
      publicKey,
      { name: 'ECDHE', namedCurve: 'P-256' },
      true,
      []
    );

    const importedPrivateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKey,
      { name: 'ECDHE', namedCurve: 'P-256' },
      true,
      []
    );

    return {
      publicKey: importedPublicKey,
      privateKey: importedPrivateKey,
    };
  } catch (error) {
    console.error('[Keychain] Failed to reconstruct identity key pair:', error);
    return null;
  }
}
