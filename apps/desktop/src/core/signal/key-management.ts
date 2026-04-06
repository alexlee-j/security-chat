/**
 * 密钥管理模块
 * 负责密钥的生成、存储和管理
 */

import { SignalProtocol, IdentityKeyPair, SignedPrekey, OneTimePrekey, SessionState } from './index';
import { generateSecureRandomString } from '../crypto';

// 类型定义
export interface LocalKeyStore {
  identityKeyPair: IdentityKeyPair;
  registrationId: number;
  signedPrekeys: Map<number, SignedPrekey>;
  oneTimePrekeys: Map<number, OneTimePrekey>;
  sessions: Map<string, SessionState>;
}

/**
 * 安全存储接口
 */
export interface SecureStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * 本地安全存储实现
 */
export class LocalSecureStorage implements SecureStorage {
  private prefix = 'security-chat-';

  async get(key: string): Promise<any> {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      const fullKey = this.prefix + key;
      localStorage.setItem(fullKey, stringValue);
    } catch (error) {
      console.error('Error setting to storage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

/**
 * 身份密钥管理
 */
export class IdentityKeys {
  private storage: SecureStorage;

  constructor(storage: SecureStorage) {
    this.storage = storage;
  }

  /**
   * 初始化身份密钥
   */
  async initialize(): Promise<IdentityKeyPair> {
    let identityKeyPair = await this.getKeyPair();
    if (!identityKeyPair) {
      const signal = new SignalProtocol();
      identityKeyPair = await signal.generateIdentityKeyPair();
      await this.saveKeyPair(identityKeyPair);
    }
    return identityKeyPair;
  }

  /**
   * 获取身份密钥对
   */
  async getKeyPair(): Promise<IdentityKeyPair | null> {
    const data = await this.storage.get('identityKeyPair');
    if (!data) return null;

    try {
      // 从 JWK 重新导入 ECDH 私钥
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        data.privateKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits', 'deriveKey']
      );

      // 从 JWK 重新导入 ECDH 公钥
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        data.publicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );

      // 从 JWK 重新导入 ECDSA 签名私钥
      const signingPrivateKey = await crypto.subtle.importKey(
        'jwk',
        data.signingPrivateKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      );

      // 从 JWK 重新导入 ECDSA 签名公钥
      const signingPublicKey = await crypto.subtle.importKey(
        'jwk',
        data.signingPublicKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );

      // 确保 publicKeyBytes 是 Uint8Array
      let publicKeyBytes: Uint8Array;
      if (data.publicKeyBytes) {
        if (Array.isArray(data.publicKeyBytes)) {
          publicKeyBytes = new Uint8Array(data.publicKeyBytes);
        } else if (typeof data.publicKeyBytes === 'object') {
          const keys = Object.keys(data.publicKeyBytes).sort((a, b) => parseInt(a) - parseInt(b));
          const array = keys.map(key => data.publicKeyBytes[key]);
          publicKeyBytes = new Uint8Array(array);
        } else {
          publicKeyBytes = new Uint8Array(data.publicKeyBytes);
        }
      } else {
        // 如果没有存储 publicKeyBytes，从公钥导出
        const exported = await crypto.subtle.exportKey('raw', publicKey);
        publicKeyBytes = new Uint8Array(exported);
      }

      return {
        privateKey,
        publicKey,
        publicKeyBytes,
        signingPrivateKey,
        signingPublicKey,
      };
    } catch (error) {
      console.error('Failed to import identity key pair:', error);
      return null;
    }
  }

  /**
   * 保存身份密钥对
   */
  async saveKeyPair(keyPair: IdentityKeyPair): Promise<void> {
    try {
      // 导出 ECDH 私钥为 JWK 格式
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

      // 导出 ECDH 公钥为 JWK 格式
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

      // 导出 ECDSA 签名私钥为 JWK 格式
      const signingPrivateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.signingPrivateKey);

      // 导出 ECDSA 签名公钥为 JWK 格式
      const signingPublicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.signingPublicKey);

      // 存储可序列化的数据
      const data = {
        privateKeyJwk,
        publicKeyJwk,
        signingPrivateKeyJwk,
        signingPublicKeyJwk,
        publicKeyBytes: Array.from(keyPair.publicKeyBytes),
      };

      await this.storage.set('identityKeyPair', data);
    } catch (error) {
      console.error('Failed to save identity key pair:', error);
      throw error;
    }
  }

  /**
   * 清除身份密钥
   */
  async clear(): Promise<void> {
    await this.storage.remove('identityKeyPair');
  }
}

/**
 * 预密钥管理
 */
export class Prekeys {
  private storage: SecureStorage;

  constructor(storage: SecureStorage) {
    this.storage = storage;
  }

  /**
   * 初始化预密钥
   */
  async initialize(): Promise<void> {
    const signedPrekeys = await this.getSignedPrekeys();
    const oneTimePrekeys = await this.getOneTimePrekeys();

    if (signedPrekeys.size === 0) {
      await this.generateSignedPrekeys(1);
    }

    if (oneTimePrekeys.size < 100) {
      const count = 100 - oneTimePrekeys.size;
      await this.generateOneTimePrekeys(count);
    }
    
    // 验证是否保存成功
    const verifySigned = await this.getSignedPrekeys();
    const verifyOneTime = await this.getOneTimePrekeys();
  }

  /**
   * 生成签名预密钥
   */
  async generateSignedPrekeys(count: number): Promise<SignedPrekey[]> {
    const signal = new SignalProtocol();
    const identityKeys = new IdentityKeys(this.storage);
    const identityKeyPair = await identityKeys.getKeyPair();
    if (!identityKeyPair) {
      throw new Error('Identity key pair not found');
    }

    const signedPrekeys = await this.getSignedPrekeys();
    const newPrekeys: SignedPrekey[] = [];

    for (let i = 0; i < count; i++) {
      const keyId = signedPrekeys.size + i + 1;
      const prekey = await signal.generateSignedPrekey(identityKeyPair, keyId);
      signedPrekeys.set(keyId, prekey);
      newPrekeys.push(prekey);
    }

    await this.saveSignedPrekeys(signedPrekeys);
    return newPrekeys;
  }

  /**
   * 生成一次性预密钥
   */
  async generateOneTimePrekeys(count: number): Promise<OneTimePrekey[]> {
    const signal = new SignalProtocol();
    const oneTimePrekeys = await this.getOneTimePrekeys();
    const newPrekeys: OneTimePrekey[] = [];

    for (let i = 0; i < count; i++) {
      const keyId = oneTimePrekeys.size + i + 1;
      const prekey = await signal.generateOneTimePrekey(keyId);
      oneTimePrekeys.set(keyId, prekey);
      newPrekeys.push(prekey);
    }

    await this.saveOneTimePrekeys(oneTimePrekeys);
    return newPrekeys;
  }

  /**
   * 序列化签名预密钥
   */
  private async serializeSignedPrekey(prekey: SignedPrekey): Promise<any> {
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', prekey.keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', prekey.keyPair.publicKey);

    return {
      keyId: prekey.keyId,
      privateKeyJwk,
      publicKeyJwk,
      signature: Array.from(prekey.signature),
    };
  }

  /**
   * 反序列化签名预密钥
   */
  private async deserializeSignedPrekey(data: any): Promise<SignedPrekey> {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      data.privateKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      data.publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    let signature: Uint8Array;
    if (Array.isArray(data.signature)) {
      signature = new Uint8Array(data.signature);
    } else if (typeof data.signature === 'object') {
      const keys = Object.keys(data.signature).sort((a, b) => parseInt(a) - parseInt(b));
      signature = new Uint8Array(keys.map(key => data.signature[key]));
    } else {
      signature = new Uint8Array(data.signature);
    }

    return {
      keyId: data.keyId,
      keyPair: { privateKey, publicKey },
      signature,
    };
  }

  /**
   * 序列化一次性预密钥
   */
  private async serializeOneTimePrekey(prekey: OneTimePrekey): Promise<any> {
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', prekey.keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', prekey.keyPair.publicKey);

    return {
      keyId: prekey.keyId,
      privateKeyJwk,
      publicKeyJwk,
    };
  }

  /**
   * 反序列化一次性预密钥
   */
  private async deserializeOneTimePrekey(data: any): Promise<OneTimePrekey> {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      data.privateKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      data.publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    return {
      keyId: data.keyId,
      keyPair: { privateKey, publicKey },
    };
  }

  /**
   * 获取签名预密钥
   */
  async getSignedPrekeys(): Promise<Map<number, SignedPrekey>> {
    const data = await this.storage.get('signedPrekeys');
    if (!data) return new Map();

    const result = new Map<number, SignedPrekey>();
    for (const [key, value] of Object.entries(data)) {
      try {
        const prekey = await this.deserializeSignedPrekey(value);
        result.set(parseInt(key), prekey);
      } catch (error) {
        console.error(`Failed to deserialize signed prekey ${key}:`, error);
      }
    }
    return result;
  }

  /**
   * 获取一次性预密钥
   */
  async getOneTimePrekeys(): Promise<Map<number, OneTimePrekey>> {
    const data = await this.storage.get('oneTimePrekeys');
    if (!data) return new Map();

    const result = new Map<number, OneTimePrekey>();
    for (const [key, value] of Object.entries(data)) {
      try {
        const prekey = await this.deserializeOneTimePrekey(value);
        result.set(parseInt(key), prekey);
      } catch (error) {
        console.error(`Failed to deserialize one-time prekey ${key}:`, error);
      }
    }
    return result;
  }

  /**
   * 保存签名预密钥
   */
  async saveSignedPrekeys(prekeys: Map<number, SignedPrekey>): Promise<void> {
    const serialized: Record<string, any> = {};
    for (const [keyId, prekey] of prekeys) {
      serialized[keyId] = await this.serializeSignedPrekey(prekey);
    }
    try {
      await this.storage.set('signedPrekeys', serialized);
      
      // 验证是否保存成功
      const verify = await this.storage.get('signedPrekeys');
    } catch (error) {
      console.error('[Prekeys] Failed to save signed prekeys:', error);
      throw error;
    }
  }

  /**
   * 保存一次性预密钥
   */
  async saveOneTimePrekeys(prekeys: Map<number, OneTimePrekey>): Promise<void> {
    const serialized: Record<string, any> = {};
    for (const [keyId, prekey] of prekeys) {
      serialized[keyId] = await this.serializeOneTimePrekey(prekey);
    }
    await this.storage.set('oneTimePrekeys', serialized);
  }

  /**
   * 清除预密钥
   */
  async clear(): Promise<void> {
    await this.storage.remove('signedPrekeys');
    await this.storage.remove('oneTimePrekeys');
  }
}

/**
 * 会话存储管理
 */
export class SessionStore {
  private storage: SecureStorage;

  constructor(storage: SecureStorage) {
    this.storage = storage;
  }

  /**
   * Uint8Array 转 Base64
   */
  private uint8ArrayToBase64(arr: Uint8Array): string {
    const binary = Array.from(arr, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  /**
   * Base64 转 Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 序列化会话状态（将 Uint8Array 转为 Base64）
   */
  private serializeSession(session: SessionState): Record<string, any> {
    return {
      remoteIdentityKey: this.uint8ArrayToBase64(session.remoteIdentityKey),
      sendingChain: session.sendingChain ? {
        key: this.uint8ArrayToBase64(session.sendingChain.key),
        index: session.sendingChain.index,
      } : null,
      receivingChain: session.receivingChain ? {
        key: this.uint8ArrayToBase64(session.receivingChain.key),
        index: session.receivingChain.index,
      } : null,
      rootKey: this.uint8ArrayToBase64(session.rootKey),
      previousChainLength: session.previousChainLength,
      ephemeralPublicKey: session.ephemeralPublicKey ? this.uint8ArrayToBase64(session.ephemeralPublicKey) : undefined,
      // 注意：不序列化 localIdentityKeyPair，因为：
      // 1. 它包含 CryptoKey 对象，不能直接序列化
      // 2. DH 棘轮逻辑在简化实现中未使用
      // 3. 当需要时，可以从 identityKeys 获取
    };
  }

  /**
   * 反序列化会话状态（将 Base64 转回 Uint8Array）
   */
  private deserializeSession(data: Record<string, any>): SessionState {
    return {
      remoteIdentityKey: this.base64ToUint8Array(data.remoteIdentityKey),
      sendingChain: data.sendingChain ? {
        key: this.base64ToUint8Array(data.sendingChain.key),
        index: data.sendingChain.index,
      } : null,
      receivingChain: data.receivingChain ? {
        key: this.base64ToUint8Array(data.receivingChain.key),
        index: data.receivingChain.index,
      } : null,
      rootKey: this.base64ToUint8Array(data.rootKey),
      previousChainLength: data.previousChainLength,
      ephemeralPublicKey: data.ephemeralPublicKey ? this.base64ToUint8Array(data.ephemeralPublicKey) : undefined,
      // localIdentityKeyPair 不从序列化数据恢复，会话将使用较少的字段
    };
  }

  /**
   * 获取会话状态
   */
  async getSession(remoteUserId: string, remoteDeviceId: string): Promise<SessionState | null> {
    const key = this.getSessionKey(remoteUserId, remoteDeviceId);
    const data = await this.storage.get(key);
    if (!data) return null;
    
    try {
      return this.deserializeSession(data);
    } catch (error) {
      console.error('Failed to deserialize session:', error);
      return null;
    }
  }

  /**
   * 保存会话状态
   */
  async saveSession(remoteUserId: string, remoteDeviceId: string, session: SessionState): Promise<void> {
    const key = this.getSessionKey(remoteUserId, remoteDeviceId);
    const serialized = this.serializeSession(session);
    await this.storage.set(key, serialized);
  }

  /**
   * 删除会话状态
   */
  async deleteSession(remoteUserId: string, remoteDeviceId: string): Promise<void> {
    const key = this.getSessionKey(remoteUserId, remoteDeviceId);
    await this.storage.remove(key);
  }

  /**
   * 清除所有会话
   */
  async clearAll(): Promise<void> {
    // 简化实现，实际需要遍历所有会话键
    const sessions = await this.storage.get('sessions');
    if (sessions) {
      for (const key in sessions) {
        await this.storage.remove(key);
      }
    }
  }

  /**
   * 生成会话键
   */
  private getSessionKey(remoteUserId: string, remoteDeviceId: string): string {
    return `session-${remoteUserId}-${remoteDeviceId}`;
  }
}

/**
 * 密钥管理主类
 */
export class KeyManager {
  private secureStorage: SecureStorage;
  private sessionStore: SessionStore;
  private identityKeys: IdentityKeys;
  private prekeys: Prekeys;

  constructor(storage?: SecureStorage) {
    this.secureStorage = storage || new LocalSecureStorage();
    this.sessionStore = new SessionStore(this.secureStorage);
    this.identityKeys = new IdentityKeys(this.secureStorage);
    this.prekeys = new Prekeys(this.secureStorage);
  }

  /**
   * 初始化密钥管理
   */
  async initialize(): Promise<void> {
    await this.identityKeys.initialize();
    await this.prekeys.initialize();
  }

  /**
   * 获取身份密钥对
   */
  async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    return await this.identityKeys.initialize();
  }

  /**
   * 获取签名预密钥
   */
  async getSignedPrekeys(): Promise<SignedPrekey[]> {
    const prekeys = await this.prekeys.getSignedPrekeys();
    return Array.from(prekeys.values());
  }

  /**
   * 获取一次性预密钥
   */
  async getOneTimePrekeys(): Promise<OneTimePrekey[]> {
    const prekeys = await this.prekeys.getOneTimePrekeys();
    return Array.from(prekeys.values());
  }

  /**
   * 获取会话状态
   */
  async getSession(remoteUserId: string, remoteDeviceId: string): Promise<SessionState | null> {
    return await this.sessionStore.getSession(remoteUserId, remoteDeviceId);
  }

  /**
   * 保存会话状态
   */
  async saveSession(remoteUserId: string, remoteDeviceId: string, session: SessionState): Promise<void> {
    await this.sessionStore.saveSession(remoteUserId, remoteDeviceId, session);
  }

  /**
   * 删除会话状态
   */
  async deleteSession(remoteUserId: string, remoteDeviceId: string): Promise<void> {
    await this.sessionStore.deleteSession(remoteUserId, remoteDeviceId);
  }

  /**
   * 清除所有密钥和会话
   */
  async clearAll(): Promise<void> {
    await this.sessionStore.clearAll();
    await this.identityKeys.clear();
    await this.prekeys.clear();
  }

  /**
   * 生成注册ID
   */
  async getRegistrationId(): Promise<number> {
    let registrationId = await this.secureStorage.get('registrationId');
    if (!registrationId) {
      registrationId = Math.floor(Math.random() * 65535);
      await this.secureStorage.set('registrationId', registrationId);
    }
    return registrationId;
  }

  /**
   * 设置当前设备ID
   */
  async setDeviceId(deviceId: string): Promise<void> {
    await this.secureStorage.set('currentDeviceId', deviceId);
  }

  /**
   * 获取当前设备ID
   */
  async getDeviceId(): Promise<string | null> {
    return await this.secureStorage.get('currentDeviceId');
  }

  /**
   * 补充预密钥
   */
  async replenishPrekeys(): Promise<void> {
    const oneTimePrekeys = await this.prekeys.getOneTimePrekeys();
    if (oneTimePrekeys.size < 20) {
      await this.prekeys.generateOneTimePrekeys(100 - oneTimePrekeys.size);
    }
  }

  /**
   * 生成一次性预密钥
   */
  async generateOneTimePrekeys(count: number): Promise<void> {
    await this.prekeys.generateOneTimePrekeys(count);
  }

  /**
   * 生成签名预密钥
   */
  async generateSignedPrekeys(count: number): Promise<void> {
    await this.prekeys.generateSignedPrekeys(count);
  }

  /**
   * 获取预密钥状态
   */
  async getPrekeysStatus(): Promise<{
    hasSignedPrekeys: boolean;
    hasOneTimePrekeys: boolean;
    signedPrekeysCount: number;
    oneTimePrekeysCount: number;
  }> {
    const signedPrekeys = await this.getSignedPrekeys();
    const oneTimePrekeys = await this.getOneTimePrekeys();
    
    return {
      hasSignedPrekeys: signedPrekeys.length > 0,
      hasOneTimePrekeys: oneTimePrekeys.length > 0,
      signedPrekeysCount: signedPrekeys.length,
      oneTimePrekeysCount: oneTimePrekeys.length,
    };
  }
}
