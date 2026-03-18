/**
 * 消息加密服务
 * 负责消息的加密和解密
 */

import { SignalProtocol, PrekeyBundle, EncryptedMessage, SessionState } from './index';
import { KeyManager } from './key-management';
import * as api from '../api';

/**
 * 消息加密服务
 */
export class MessageEncryptionService {
  private signal: SignalProtocol;
  private keyManager: KeyManager;

  constructor() {
    this.signal = new SignalProtocol();
    this.keyManager = new KeyManager();
  }

  /**
   * 初始化加密服务
   */
  async initialize(): Promise<void> {
    await this.keyManager.initialize();
  }

  /**
   * 加密消息
   */
  async encryptMessage(
    recipientUserId: string,
    recipientDeviceId: string,
    plaintext: string
  ): Promise<EncryptedMessage> {
    // 检查是否已有会话
    let session = await this.keyManager.getSession(recipientUserId, recipientDeviceId);

    if (!session) {
      // 获取接收方的预密钥包
      const prekeyBundle = await this.fetchPrekeyBundle(recipientUserId, recipientDeviceId);
      // 初始化会话
      session = await this.signal.initiateSession(prekeyBundle);
      // 保存会话
      await this.keyManager.saveSession(recipientUserId, recipientDeviceId, session);
    }

    // 加密消息
    const encryptedMessage = await this.signal.encryptMessage(session, plaintext);

    // 保存更新后的会话
    await this.keyManager.saveSession(recipientUserId, recipientDeviceId, session);

    return encryptedMessage;
  }

  /**
   * 解密消息
   */
  async decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    // 修复从 JSON 解析的 Uint8Array 对象
    const fixedEncryptedMessage = this.fixEncryptedMessage(encryptedMessage);

    // 检查是否已有会话
    let session = await this.keyManager.getSession(senderUserId, senderDeviceId);

    if (!session) {
      // 获取本地身份密钥对
      const identityKeyPair = await this.keyManager.getIdentityKeyPair();
      // 接受会话
      session = await this.signal.acceptSession(fixedEncryptedMessage, identityKeyPair);
      // 保存会话
      await this.keyManager.saveSession(senderUserId, senderDeviceId, session);
    }

    // 解密消息
    const plaintext = await this.signal.decryptMessage(session, fixedEncryptedMessage);

    // 保存更新后的会话
    await this.keyManager.saveSession(senderUserId, senderDeviceId, session);

    return plaintext;
  }

  /**
   * 修复从 JSON 解析的 EncryptedMessage 对象，将普通对象转换回 Uint8Array
   */
  private fixEncryptedMessage(encryptedMessage: any): EncryptedMessage {
    return {
      ...encryptedMessage,
      baseKey: this.objectToUint8Array(encryptedMessage.baseKey),
      identityKey: this.objectToUint8Array(encryptedMessage.identityKey),
      ciphertext: this.objectToUint8Array(encryptedMessage.ciphertext),
      dhPublicKey: encryptedMessage.dhPublicKey ? this.objectToUint8Array(encryptedMessage.dhPublicKey) : undefined
    };
  }

  /**
   * 将对象转换为 Uint8Array
   */
  private objectToUint8Array(obj: any): Uint8Array {
    console.log('objectToUint8Array input:', obj, 'type:', typeof obj, 'instanceof Uint8Array:', obj instanceof Uint8Array);

    if (obj instanceof Uint8Array) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return new Uint8Array(obj);
    }
    if (typeof obj === 'string') {
      return this.base64ToUint8Array(obj);
    }
    if (obj && typeof obj === 'object') {
      // 处理从 JSON 解析的对象，可能有 data 属性或直接是数字数组
      if (obj.data && Array.isArray(obj.data)) {
        return new Uint8Array(obj.data);
      }
      // 处理可能的其他格式
      if (obj.buffer) {
        return new Uint8Array(obj.buffer);
      }
    }
    // 尝试直接转换，作为最后的尝试
    try {
      return new Uint8Array(obj);
    } catch (error) {
      throw new Error(`无法将对象转换为 Uint8Array: ${JSON.stringify(obj)}`);
    }
  }

  /**
   * 获取预密钥包
   */
  private async fetchPrekeyBundle(userId: string, deviceId: string): Promise<PrekeyBundle> {
    try {
      const data = await api.getPrekeyBundle(userId, deviceId);

      // 验证密钥长度
      const identityKey = this.base64ToUint8Array(data.identityKey);
      const signedPrekeyPublic = this.base64ToUint8Array(data.signedPrekey.publicKey);

      console.log('Prekey bundle received:', {
        identityKeyLength: identityKey.length,
        signedPrekeyLength: signedPrekeyPublic.length,
        registrationId: data.registrationId,
      });

      // P-256 公钥应该是 65 字节（未压缩格式）或 33 字节（压缩格式）
      if (identityKey.length !== 65 && identityKey.length !== 33) {
        console.warn(`Unexpected identity key length: ${identityKey.length}, expected 65 or 33`);
      }

      return {
        registrationId: data.registrationId,
        identityKey,
        signedPrekey: {
          keyId: data.signedPrekey.keyId,
          publicKey: signedPrekeyPublic,
          signature: this.base64ToUint8Array(data.signedPrekey.signature),
        },
        oneTimePrekey: data.oneTimePrekey ? {
          keyId: data.oneTimePrekey.keyId,
          publicKey: this.base64ToUint8Array(data.oneTimePrekey.publicKey),
        } : undefined,
      };
    } catch (error) {
      console.error('Error fetching prekey bundle:', error);
      throw new Error('Failed to fetch prekey bundle');
    }
  }

  /**
   * Base64 转 Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      array[i] = binaryString.charCodeAt(i);
    }
    return array;
  }

  /**
   * Uint8Array 转 Base64
   */
  private uint8ArrayToBase64(array: Uint8Array): string {
    const binaryString = Array.from(array, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }

  /**
   * 上传预密钥（使用指定的 KeyManager 实例）
   */
  async uploadPrekeysWithKeyManager(keyManager: KeyManager): Promise<void> {
    try {
      const identityKeyPair = await keyManager.getIdentityKeyPair();
      const signedPrekeys = await keyManager.getSignedPrekeys();
      const oneTimePrekeys = await keyManager.getOneTimePrekeys();

      if (signedPrekeys.length === 0) {
        throw new Error('No signed prekeys to upload');
      }

      // 获取当前设备 ID（从本地存储或登录响应获取）
      const deviceId = await this.getCurrentDeviceIdWithKeyManager(keyManager);

      // 准备上传数据
      const signedPrekeyPublic = new Uint8Array(await crypto.subtle.exportKey('raw', signedPrekeys[0].keyPair.publicKey));
      const data = {
        deviceId,
        signedPrekey: {
          keyId: signedPrekeys[0].keyId,
          publicKey: this.uint8ArrayToBase64(signedPrekeyPublic),
          signature: this.uint8ArrayToBase64(signedPrekeys[0].signature),
        },
        oneTimePrekeys: await Promise.all(oneTimePrekeys.map(async (prekey) => {
          const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', prekey.keyPair.publicKey));
          return {
            keyId: prekey.keyId,
            publicKey: this.uint8ArrayToBase64(publicKey),
          };
        })),
      };

      // 调用 API 上传预密钥
      await api.uploadPrekeys(data);

      console.log('Prekeys uploaded successfully:', {
        signedPrekeyId: signedPrekeys[0].keyId,
        oneTimePrekeysCount: oneTimePrekeys.length,
      });
    } catch (error) {
      console.error('Error uploading prekeys:', error);
      throw new Error('Failed to upload prekeys');
    }
  }

  /**
   * 获取当前设备 ID（使用指定的 KeyManager 实例）
   */
  private async getCurrentDeviceIdWithKeyManager(keyManager: KeyManager): Promise<string> {
    // 从本地存储获取设备 ID
    const deviceId = await keyManager['secureStorage'].get('currentDeviceId');
    if (deviceId) {
      return deviceId;
    }
    // 如果没有存储，生成一个新的设备 ID
    const newDeviceId = crypto.randomUUID();
    await keyManager['secureStorage'].set('currentDeviceId', newDeviceId);
    return newDeviceId;
  }

  /**
   * 上传预密钥
   */
  async uploadPrekeys(): Promise<void> {
    return this.uploadPrekeysWithKeyManager(this.keyManager);
  }

  /**
   * 获取当前设备 ID
   */
  private async getCurrentDeviceId(): Promise<string> {
    return this.getCurrentDeviceIdWithKeyManager(this.keyManager);
  }

  /**
   * 验证密钥
   */
  async verifyKey(userId: string, deviceId: string, fingerprint: string, isVerified: boolean): Promise<void> {
    try {
      await api.verifyKey(userId, deviceId, fingerprint, isVerified);
    } catch (error) {
      console.error('Error verifying key:', error);
      throw new Error('Failed to verify key');
    }
  }

  /**
   * 获取验证状态
   */
  async getVerificationStatus(userId: string): Promise<any> {
    try {
      return await api.getVerificationStatus(userId);
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw new Error('Failed to get verification status');
    }
  }

  /**
   * 获取身份密钥信息
   */
  async getIdentityKeyInfo(userId: string): Promise<any> {
    try {
      return await api.getIdentityKey(userId);
    } catch (error) {
      console.error('Error getting identity key info:', error);
      throw new Error('Failed to get identity key info');
    }
  }

  /**
   * 补充预密钥
   */
  async replenishPrekeys(): Promise<void> {
    await this.keyManager.replenishPrekeys();
    await this.uploadPrekeys();
  }

  /**
   * 清除所有密钥和会话
   */
  async clearAll(): Promise<void> {
    await this.keyManager.clearAll();
  }
}

// 导出单例
export const messageEncryptionService = new MessageEncryptionService();
