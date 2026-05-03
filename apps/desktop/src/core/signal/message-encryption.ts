/**
 * 消息加密服务（纯 Rust 实现）
 */

import { EncryptedMessage } from './index';
import { KeyManager } from './key-management';
import * as api from '../api';
import { RustGroupEncryptedMessage, RustSignalRuntime } from './rust-signal';

export class MessageEncryptionService {
  private keyManager: KeyManager;
  private rustSignal: RustSignalRuntime;

  constructor() {
    this.keyManager = KeyManager.getInstance();
    this.rustSignal = new RustSignalRuntime();
  }

  async initialize(): Promise<void> {
    const userId = this.keyManager.getUserId();
    if (userId) {
      await this.rustSignal.setCurrentUser(userId);
    }
    await this.rustSignal.initializeIdentity();
  }

  async encryptMessage(
    recipientUserId: string,
    recipientDeviceId: string,
    recipientSignalDeviceId: number,
    plaintext: string
  ): Promise<EncryptedMessage> {
    const prekeyBundle = await this.fetchPrekeyBundle(recipientUserId, recipientDeviceId);
    await this.rustSignal.establishSession(recipientUserId, recipientDeviceId, recipientSignalDeviceId, prekeyBundle);
    const encrypted = await this.rustSignal.encryptMessage(recipientUserId, recipientDeviceId, recipientSignalDeviceId, plaintext);
    return this.rustMessageToLegacyShape(encrypted);
  }

  async decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    senderSignalDeviceId: number,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    const fixedEncryptedMessage = this.fixEncryptedMessage(encryptedMessage);
    const rustMsg = {
      message_type: fixedEncryptedMessage.signedPreKeyId || 2,
      body: Array.from(fixedEncryptedMessage.ciphertext),
    };
    return await this.rustSignal.decryptMessage(senderUserId, senderDeviceId, senderSignalDeviceId, rustMsg);
  }

  async syncGroupMembers(groupId: string, memberUserIds: string[]): Promise<void> {
    await this.rustSignal.syncGroupMembers(groupId, memberUserIds);
  }

  async encryptGroupMessage(groupId: string, plaintext: string): Promise<RustGroupEncryptedMessage> {
    return await this.rustSignal.encryptGroupMessage(groupId, plaintext);
  }

  async decryptGroupMessage(groupId: string, encryptedMessage: RustGroupEncryptedMessage): Promise<string> {
    return await this.rustSignal.decryptGroupMessage(groupId, encryptedMessage);
  }

  private async fetchPrekeyBundle(userId: string, deviceId: string) {
    const data = await api.getPrekeyBundle(userId, deviceId);
    if (!data.kyberPrekey) {
      throw new Error('Remote device missing kyber prekey, cannot establish Rust Signal session');
    }
    return {
      deviceId: data.deviceId,
      registrationId: data.registrationId,
      signalDeviceId: data.signalDeviceId,
      identityKey: data.identityKey,
      signedPrekey: {
        keyId: data.signedPrekey.keyId,
        publicKey: data.signedPrekey.publicKey,
        signature: data.signedPrekey.signature,
      },
      oneTimePrekey: data.oneTimePrekey
        ? {
            keyId: data.oneTimePrekey.keyId,
            publicKey: data.oneTimePrekey.publicKey,
          }
        : undefined,
      kyberPrekey: {
        keyId: data.kyberPrekey.keyId,
        publicKey: data.kyberPrekey.publicKey,
        signature: data.kyberPrekey.signature,
      },
    };
  }

  async uploadPrekeysWithKeyManager(keyManager: KeyManager): Promise<void> {
    const deviceId = await this.getCurrentDeviceIdWithKeyManager(keyManager);
    if (!deviceId) {
      return;
    }
    const local = await this.rustSignal.getLocalPrekeyUploadPackage();
    await api.uploadPrekeys({
      deviceId,
      identityKey: local.identityPublicKey,
      signedPrekey: local.signedPrekey,
      oneTimePrekeys: local.oneTimePrekeys,
      kyberPrekey: local.kyberPrekey,
    });
  }

  private async getCurrentDeviceIdWithKeyManager(keyManager: KeyManager): Promise<string | null> {
    return await keyManager.getDeviceId();
  }

  async uploadPrekeys(): Promise<void> {
    return this.uploadPrekeysWithKeyManager(this.keyManager);
  }

  async verifyKey(userId: string, deviceId: string, fingerprint: string, isVerified: boolean): Promise<void> {
    await api.verifyKey(userId, deviceId, fingerprint, isVerified);
  }

  async getVerificationStatus(userId: string): Promise<any> {
    return await api.getVerificationStatus(userId);
  }

  async getIdentityKeyInfo(userId: string): Promise<any> {
    return await api.getIdentityKey(userId);
  }

  async checkAndReplenishPrekeys(): Promise<boolean> {
    const local = await this.rustSignal.getLocalPrekeyUploadPackage();
    if (local.oneTimePrekeys.length < 20) {
      await this.replenishPrekeys();
      return true;
    }
    return false;
  }

  async replenishPrekeys(): Promise<void> {
    await this.rustSignal.initializeIdentity();
    await this.uploadPrekeys();
  }

  async clearAll(): Promise<void> {
    await this.keyManager.clearAll();
  }

  private rustMessageToLegacyShape(message: { message_type: number; body: number[] }): EncryptedMessage {
    return {
      version: 1,
      registrationId: 0,
      signedPreKeyId: message.message_type,
      baseKey: new Uint8Array(),
      identityKey: new Uint8Array(),
      messageNumber: 0,
      previousChainLength: 0,
      ciphertext: new Uint8Array(message.body),
    };
  }

  private fixEncryptedMessage(encryptedMessage: any): EncryptedMessage {
    return {
      ...encryptedMessage,
      baseKey: this.objectToUint8Array(encryptedMessage.baseKey),
      identityKey: this.objectToUint8Array(encryptedMessage.identityKey),
      ciphertext: this.objectToUint8Array(encryptedMessage.ciphertext),
      dhPublicKey: encryptedMessage.dhPublicKey ? this.objectToUint8Array(encryptedMessage.dhPublicKey) : undefined
    };
  }

  private objectToUint8Array(obj: any): Uint8Array {
    if (obj instanceof Uint8Array) return obj;
    if (Array.isArray(obj)) return new Uint8Array(obj);
    if (typeof obj === 'string') return this.base64ToUint8Array(obj);
    if (obj && typeof obj === 'object') {
      if (obj.data && Array.isArray(obj.data)) return new Uint8Array(obj.data);
      if (obj.buffer) return new Uint8Array(obj.buffer);
    }
    return new Uint8Array(obj);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      array[i] = binaryString.charCodeAt(i);
    }
    return array;
  }
}

export const messageEncryptionService = new MessageEncryptionService();
