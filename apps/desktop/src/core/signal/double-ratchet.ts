/**
 * Double Ratchet 算法实现
 */

import { X3DH } from './index';

export class DoubleRatchet {
  /**
   * 发送消息密钥
   */
  static async sendMessageKey(sendingChain: { key: Uint8Array; index: number }): Promise<Uint8Array> {
    // 使用 KDF 派生消息密钥
    return this.deriveMessageKey(sendingChain.key);
  }

  /**
   * 接收消息密钥
   */
  static async receiveMessageKey(receivingChain: { key: Uint8Array; index: number }, messageNumber: number): Promise<Uint8Array> {
    // 使用 KDF 派生消息密钥
    return this.deriveMessageKey(receivingChain.key);
  }

  /**
   * 派生消息密钥
   */
  private static async deriveMessageKey(chainKey: Uint8Array): Promise<Uint8Array> {
    // 使用 HKDF 派生消息密钥
    const encoder = new TextEncoder();
    const salt = encoder.encode('message_key');

    // 创建 key 的副本，确保是独立的 ArrayBuffer
    const keyBuffer = chainKey.slice().buffer;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 1,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }

  /**
   * 推进发送链
   */
  static async nextChainKey(currentKey: Uint8Array): Promise<Uint8Array> {
    // 使用 KDF 推进链密钥
    const encoder = new TextEncoder();
    const salt = encoder.encode('chain_key');

    // 创建 key 的副本，确保是独立的 ArrayBuffer
    const keyBuffer = currentKey.slice().buffer;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 1,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }

  /**
   * DH 棘轮
   */
  static async dhRatchet(
    rootKey: Uint8Array,
    localKeyPair: CryptoKeyPair,
    remotePublicKey: Uint8Array
  ): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
    // 计算共享密钥
    const sharedSecret = await X3DH.calculateSharedSecret(localKeyPair.privateKey, remotePublicKey);

    // 使用 HKDF 派生新的根密钥和链密钥
    const { rootKey: newRootKey, chainKey } = await this.hkdf(
      rootKey,
      sharedSecret,
      'DoubleRatchet'
    );

    return { rootKey: newRootKey, chainKey };
  }

  /**
   * HKDF 密钥派生函数
   */
  private static async hkdf(
    inputKeyMaterial: Uint8Array,
    salt: Uint8Array,
    info: string
  ): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode(info);

    // Step 1: Extract - 使用 HMAC-SHA256 提取
    const saltBuffer = salt.slice(0).buffer as ArrayBuffer;
    const saltKey = await crypto.subtle.importKey(
      'raw',
      saltBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const inputBuffer = inputKeyMaterial.slice(0).buffer as ArrayBuffer;
    const prk = await crypto.subtle.sign('HMAC', saltKey, inputBuffer);

    // Step 2: Expand - 扩展密钥材料
    const prkKey = await crypto.subtle.importKey(
      'raw',
      prk,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // 生成 64 字节的输出密钥材料（32 字节根密钥 + 32 字节链密钥）
    const okm1Input = new Uint8Array([...infoBytes, 0x01]);
    const okm1 = await crypto.subtle.sign('HMAC', prkKey, okm1Input.buffer as ArrayBuffer);

    const okm2Input = new Uint8Array([...new Uint8Array(okm1), ...infoBytes, 0x02]);
    const okm2 = await crypto.subtle.sign('HMAC', prkKey, okm2Input.buffer as ArrayBuffer);

    return {
      rootKey: new Uint8Array(okm1),
      chainKey: new Uint8Array(okm2),
    };
  }
}
