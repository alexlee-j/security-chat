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
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
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

    // 确保publicKeyBytes是Uint8Array类型
    if (data.publicKeyBytes) {
      if (Array.isArray(data.publicKeyBytes)) {
        // 从数组创建Uint8Array
        data.publicKeyBytes = new Uint8Array(data.publicKeyBytes);
      } else if (typeof data.publicKeyBytes === 'object') {
        // 处理从JSON.parse得到的对象
        const keys = Object.keys(data.publicKeyBytes).sort((a, b) => parseInt(a) - parseInt(b));
        const array = keys.map(key => data.publicKeyBytes[key]);
        data.publicKeyBytes = new Uint8Array(array);
      }
    }

    // 重建CryptoKey对象（简化实现，实际需要使用importKey）
    return data;
  }

  /**
   * 保存身份密钥对
   */
  async saveKeyPair(keyPair: IdentityKeyPair): Promise<void> {
    // 简化实现，实际需要导出密钥为可存储格式
    await this.storage.set('identityKeyPair', keyPair);
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
      await this.generateOneTimePrekeys(100 - oneTimePrekeys.size);
    }
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
   * 获取签名预密钥
   */
  async getSignedPrekeys(): Promise<Map<number, SignedPrekey>> {
    const data = await this.storage.get('signedPrekeys');
    if (!data) return new Map();
    return new Map(Object.entries(data).map(([key, value]) => [parseInt(key), value as SignedPrekey]));
  }

  /**
   * 获取一次性预密钥
   */
  async getOneTimePrekeys(): Promise<Map<number, OneTimePrekey>> {
    const data = await this.storage.get('oneTimePrekeys');
    if (!data) return new Map();
    return new Map(Object.entries(data).map(([key, value]) => [parseInt(key), value as OneTimePrekey]));
  }

  /**
   * 保存签名预密钥
   */
  async saveSignedPrekeys(prekeys: Map<number, SignedPrekey>): Promise<void> {
    await this.storage.set('signedPrekeys', Object.fromEntries(prekeys));
  }

  /**
   * 保存一次性预密钥
   */
  async saveOneTimePrekeys(prekeys: Map<number, OneTimePrekey>): Promise<void> {
    await this.storage.set('oneTimePrekeys', Object.fromEntries(prekeys));
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
   * 补充预密钥
   */
  async replenishPrekeys(): Promise<void> {
    const oneTimePrekeys = await this.prekeys.getOneTimePrekeys();
    if (oneTimePrekeys.size < 20) {
      await this.prekeys.generateOneTimePrekeys(100 - oneTimePrekeys.size);
    }
  }
}
