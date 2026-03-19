/**
 * Signal协议核心实现
 * 基于Web Crypto API实现Signal协议的核心功能
 */

import { generateSecureRandomString } from '../crypto';

// 类型定义
export interface IdentityKeyPair {
  privateKey: CryptoKey;  // ECDH 私钥，用于密钥交换
  publicKey: CryptoKey;   // ECDH 公钥
  publicKeyBytes: Uint8Array;
  signingPrivateKey: CryptoKey;  // ECDSA 私钥，用于签名
  signingPublicKey: CryptoKey;   // ECDSA 公钥，用于验证签名
}

export interface SignedPrekey {
  keyId: number;
  keyPair: CryptoKeyPair;
  signature: Uint8Array;
}

export interface OneTimePrekey {
  keyId: number;
  keyPair: CryptoKeyPair;
}

export interface PrekeyBundle {
  registrationId: number;
  identityKey: Uint8Array;
  signedPrekey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  oneTimePrekey?: {
    keyId: number;
    publicKey: Uint8Array;
  };
}

export interface SessionState {
  remoteIdentityKey: Uint8Array;
  sendingChain: {
    key: Uint8Array;
    index: number;
  } | null;
  receivingChain: {
    key: Uint8Array;
    index: number;
  } | null;
  rootKey: Uint8Array;
  previousChainLength: number;
  // 发送方在初始化时生成的临时公钥，用于第一条消息的 baseKey
  ephemeralPublicKey?: Uint8Array;
}

export interface EncryptedMessage {
  version: number;
  registrationId: number;
  preKeyId?: number;
  signedPreKeyId: number;
  baseKey: Uint8Array;
  identityKey: Uint8Array;
  messageNumber: number;
  previousChainLength: number;
  ciphertext: Uint8Array;
  dhPublicKey?: Uint8Array;
}

/**
 * X3DH密钥交换实现
 */
export class X3DH {
  /**
   * 生成身份密钥对
   */
  static async generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    // ECDH 密钥对用于密钥交换
    const ecdhKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    // ECDSA 密钥对用于签名
    const signingKeyPair = await this.generateSigningKeyPair();

    const publicKeyBytes = await crypto.subtle.exportKey('raw', ecdhKeyPair.publicKey);

    return {
      privateKey: ecdhKeyPair.privateKey,
      publicKey: ecdhKeyPair.publicKey,
      publicKeyBytes: new Uint8Array(publicKeyBytes),
      signingPrivateKey: signingKeyPair.privateKey,
      signingPublicKey: signingKeyPair.publicKey,
    };
  }

  /**
   * 生成用于签名的 ECDSA 密钥对（内部使用）
   */
  private static async generateSigningKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
  }

  /**
   * 生成签名预密钥
   */
  static async generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<SignedPrekey> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    // 使用身份签名私钥对签名预密钥公钥进行签名
    const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      identityKeyPair.signingPrivateKey,
      publicKeyBytes
    );

    return {
      keyId,
      keyPair,
      signature: new Uint8Array(signature),
    };
  }

  /**
   * 生成一次性预密钥
   */
  static async generateOneTimePrekey(keyId: number): Promise<OneTimePrekey> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    return {
      keyId,
      keyPair,
    };
  }

  /**
   * 初始化会话（发送方）
   */
  static async initiateSession(prekeyBundle: PrekeyBundle): Promise<SessionState> {
    // 生成临时密钥对
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    // 导出临时公钥
    const ephemeralPublicKeyBytes = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);

    // 计算共享密钥（简化实现）
    const initialSecret = await this.calculateSharedSecret(ephemeralKeyPair.privateKey, prekeyBundle.identityKey);

    // 派生根密钥和链密钥
    const rootKey = await this.deriveKey(initialSecret, 'root_key');
    const chainKey = await this.deriveKey(initialSecret, 'chain_key');

    return {
      remoteIdentityKey: prekeyBundle.identityKey,
      sendingChain: {
        key: chainKey,
        index: 0,
      },
      receivingChain: null,
      rootKey,
      previousChainLength: 0,
      ephemeralPublicKey: new Uint8Array(ephemeralPublicKeyBytes),
    };
  }

  /**
   * 接受会话（接收方）
   * @param initialMessage - 初始加密消息，包含发送方的 baseKey（临时公钥）
   * @param identityKeyPair - 接收方的身份密钥对
   */
  static async acceptSession(initialMessage: EncryptedMessage, identityKeyPair: IdentityKeyPair): Promise<SessionState> {
    console.log('[X3DH] acceptSession called:', {
      baseKeyLength: initialMessage.baseKey?.length,
      identityKeyLength: initialMessage.identityKey?.length,
      messageNumber: initialMessage.messageNumber,
    });

    // 验证 baseKey 是否有效
    if (!initialMessage.baseKey || !(initialMessage.baseKey instanceof Uint8Array) || initialMessage.baseKey.length === 0) {
      console.error('[X3DH] Invalid baseKey in initialMessage:', initialMessage.baseKey);
      throw new Error('初始消息中的 baseKey 无效');
    }

    // 计算共享密钥：使用接收方的身份私钥和发送方的临时公钥（baseKey）
    const initialSecret = await this.calculateSharedSecret(identityKeyPair.privateKey, initialMessage.baseKey);
    console.log('[X3DH] Shared secret calculated, length:', initialSecret.length);

    // 派生根密钥和链密钥
    const rootKey = await this.deriveKey(initialSecret, 'root_key');
    const chainKey = await this.deriveKey(initialSecret, 'chain_key');
    console.log('[X3DH] Root key and chain key derived');

    return {
      remoteIdentityKey: initialMessage.identityKey,
      sendingChain: null,
      receivingChain: {
        key: chainKey,
        index: initialMessage.messageNumber || 0,
      },
      rootKey,
      previousChainLength: initialMessage.previousChainLength || 0,
    };
  }

  /**
   * 计算共享密钥
   */
  static async calculateSharedSecret(privateKey: CryptoKey, publicKeyBytes: Uint8Array): Promise<Uint8Array> {
    // 确保publicKeyBytes是有效的Uint8Array
    if (!publicKeyBytes) {
      throw new Error('公钥字节数组为空 (null/undefined)');
    }
    if (!(publicKeyBytes instanceof Uint8Array)) {
      throw new Error(`公钥不是 Uint8Array 类型，实际类型: ${typeof publicKeyBytes}, 值: ${JSON.stringify(publicKeyBytes)}`);
    }
    if (publicKeyBytes.length === 0) {
      throw new Error('公钥字节数组为空 (长度为 0)');
    }

    console.log('calculateSharedSecret:', {
      publicKeyLength: publicKeyBytes.length,
      publicKeyFirstBytes: Array.from(publicKeyBytes.slice(0, 8)),
    });

    // P-256 公钥应该是 65 字节（未压缩格式）或 33 字节（压缩格式）
    if (publicKeyBytes.length !== 65 && publicKeyBytes.length !== 33) {
      console.warn(`Unexpected public key length: ${publicKeyBytes.length}, expected 65 or 33`);
    }

    // 创建公钥字节的副本，确保是独立的 ArrayBuffer
    const publicKeyBuffer = publicKeyBytes.slice().buffer;

    try {
      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );

      const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: publicKey },
        privateKey,
        256
      );

      return new Uint8Array(sharedSecret);
    } catch (error) {
      console.error('Failed to calculate shared secret:', error);
      throw new Error(`计算共享密钥失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 派生密钥
   */
  private static async deriveKey(secret: Uint8Array, salt: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(salt);

    // 创建 secret 的副本，确保是独立的 ArrayBuffer
    const secretBuffer = secret.slice().buffer;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 1000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }
}

/**
 * Double Ratchet算法实现
 */
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
   * @param receivingChain - 接收链状态
   * @param messageNumber - 消息编号
   * @returns 消息密钥
   * @description 对于接收方，需要根据消息编号推进链密钥
   */
  static async receiveMessageKey(
    receivingChain: { key: Uint8Array; index: number },
    messageNumber: number
  ): Promise<Uint8Array> {
    // 推进链密钥到正确的消息索引
    let chainKey = receivingChain.key;
    const currentIndex = receivingChain.index;
    
    // 如果消息编号大于当前索引，需要推进链
    for (let i = currentIndex; i < messageNumber; i++) {
      chainKey = await this.nextChainKey(chainKey);
    }
    
    // 使用 KDF 派生消息密钥
    return this.deriveMessageKey(chainKey);
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
   * DH棘轮
   */
  static async dhRatchet(rootKey: Uint8Array, localKeyPair: CryptoKeyPair, remotePublicKey: Uint8Array): Promise<Uint8Array> {
    // 计算共享密钥
    const sharedSecret = await X3DH.calculateSharedSecret(localKeyPair.privateKey, remotePublicKey);

    // 派生新的根密钥
    const encoder = new TextEncoder();
    const salt = encoder.encode('dh_ratchet');

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      sharedSecret.buffer as ArrayBuffer,
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
}

/**
 * 密钥指纹生成
 */
export class KeyFingerprint {
  /**
   * 生成密钥指纹
   */
  static async generate(identityKey: any): Promise<string> {
    // 确保identityKey是有效的类型
    let buffer: ArrayBuffer;
    
    if (identityKey instanceof Uint8Array) {
      // 直接使用Uint8Array
      buffer = identityKey.buffer as ArrayBuffer;
    } else if (identityKey && typeof identityKey === 'object' && 'buffer' in identityKey) {
      // 处理类似Uint8Array的对象
      buffer = identityKey.buffer as ArrayBuffer;
    } else if (identityKey && typeof identityKey === 'object' && 'length' in identityKey) {
      // 处理数组或类数组对象
      buffer = new Uint8Array(identityKey).buffer;
    } else {
      throw new Error('identityKey must be a Uint8Array or array-like object');
    }
    
    // 确保buffer是ArrayBuffer类型
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error('identityKey.buffer must be an ArrayBuffer');
    }
    
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hash);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
  }

  /**
   * 格式化指纹为易读格式
   */
  static format(fingerprint: string): string {
    return fingerprint.match(/.{12}/g)?.join(' ') || fingerprint;
  }
}

/**
 * Signal协议主类
 */
export class SignalProtocol {
  private x3dh: X3DH;
  private doubleRatchet: DoubleRatchet;
  private keyFingerprint: KeyFingerprint;

  constructor() {
    this.x3dh = new X3DH();
    this.doubleRatchet = new DoubleRatchet();
    this.keyFingerprint = new KeyFingerprint();
  }

  /**
   * 生成身份密钥对
   */
  async generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    return X3DH.generateIdentityKeyPair();
  }

  /**
   * 生成签名预密钥
   */
  async generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<SignedPrekey> {
    return X3DH.generateSignedPrekey(identityKeyPair, keyId);
  }

  /**
   * 生成一次性预密钥
   */
  async generateOneTimePrekey(keyId: number): Promise<OneTimePrekey> {
    return X3DH.generateOneTimePrekey(keyId);
  }

  /**
   * 初始化会话
   */
  async initiateSession(prekeyBundle: PrekeyBundle): Promise<SessionState> {
    return X3DH.initiateSession(prekeyBundle);
  }

  /**
   * 接受会话
   */
  async acceptSession(initialMessage: EncryptedMessage, identityKeyPair: IdentityKeyPair): Promise<SessionState> {
    return X3DH.acceptSession(initialMessage, identityKeyPair);
  }

  /**
   * 加密消息
   */
  async encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage> {
    if (!session.sendingChain) {
      throw new Error('Sending chain is null');
    }

    const messageKey = await DoubleRatchet.sendMessageKey(session.sendingChain);

    // 加密消息（简化实现）
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    const ciphertext = await this.encrypt(plaintextBytes, messageKey);

    // 确定 baseKey：第一条消息使用 ephemeralPublicKey，后续消息使用新的 DH 公钥
    let baseKey: Uint8Array;
    let dhPublicKey: Uint8Array | undefined;

    if (session.sendingChain.index === 0 && session.ephemeralPublicKey) {
      // 第一条消息：使用初始化时生成的临时公钥
      baseKey = session.ephemeralPublicKey;
      dhPublicKey = session.ephemeralPublicKey;
    } else {
      // 后续消息：生成新的 DH 密钥对
      const newDHKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits', 'deriveKey']
      );
      const dhPublicKeyBytes = await crypto.subtle.exportKey('raw', newDHKeyPair.publicKey);
      baseKey = new Uint8Array(dhPublicKeyBytes);
      dhPublicKey = baseKey;
    }

    // 更新会话状态
    session.sendingChain.key = await DoubleRatchet.nextChainKey(session.sendingChain.key);
    session.sendingChain.index++;

    return {
      version: 3,
      registrationId: 12345, // 实际应该从本地存储获取
      signedPreKeyId: 1,
      baseKey,
      identityKey: session.remoteIdentityKey,
      messageNumber: session.sendingChain.index,
      previousChainLength: session.previousChainLength,
      ciphertext,
      dhPublicKey,
    };
  }

  /**
   * 将 EncryptedMessage 转换为可传输的 JSON 对象（Base64 编码）
   */
  static messageToJSON(message: EncryptedMessage): Record<string, any> {
    const uint8ArrayToBase64 = (arr: Uint8Array): string => {
      const binary = Array.from(arr, byte => String.fromCharCode(byte)).join('');
      return btoa(binary);
    };

    return {
      version: message.version,
      registrationId: message.registrationId,
      signedPreKeyId: message.signedPreKeyId,
      baseKey: uint8ArrayToBase64(message.baseKey),
      identityKey: uint8ArrayToBase64(message.identityKey),
      messageNumber: message.messageNumber,
      previousChainLength: message.previousChainLength,
      ciphertext: uint8ArrayToBase64(message.ciphertext),
      dhPublicKey: message.dhPublicKey ? uint8ArrayToBase64(message.dhPublicKey) : undefined,
    };
  }

  /**
   * 将 JSON 对象（Base64 编码）转换回 EncryptedMessage
   */
  static messageFromJSON(json: Record<string, any>): EncryptedMessage {
    const base64ToUint8Array = (base64: string | Uint8Array): Uint8Array => {
      // 如果已经是 Uint8Array，直接返回
      if (base64 instanceof Uint8Array) {
        return base64;
      }
      // 如果是数组，转换为 Uint8Array
      if (Array.isArray(base64)) {
        return new Uint8Array(base64);
      }
      // 如果是字符串，尝试 Base64 解码
      if (typeof base64 === 'string') {
        try {
          const binary = atob(base64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        } catch (error) {
          // Base64 解码失败，可能是普通字符串
          const encoder = new TextEncoder();
          return encoder.encode(base64);
        }
      }
      // 其他情况，返回空数组
      console.warn('Unknown type for base64 field:', typeof base64, base64);
      return new Uint8Array();
    };

    return {
      version: json.version,
      registrationId: json.registrationId,
      signedPreKeyId: json.signedPreKeyId,
      baseKey: base64ToUint8Array(json.baseKey),
      identityKey: base64ToUint8Array(json.identityKey),
      messageNumber: json.messageNumber,
      previousChainLength: json.previousChainLength,
      ciphertext: base64ToUint8Array(json.ciphertext),
      dhPublicKey: json.dhPublicKey ? base64ToUint8Array(json.dhPublicKey) : undefined,
    };
  }

  /**
  /**
   * 解密消息
   */
  async decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<string> {
    console.log('[Signal] decryptMessage called:', {
      messageNumber: encryptedMessage.messageNumber,
      receivingChainIndex: session.receivingChain?.index,
      baseKeyLength: encryptedMessage.baseKey?.length,
      ciphertextLength: encryptedMessage.ciphertext?.length,
    });

    // 验证必要参数
    if (!session.receivingChain) {
      throw new Error('接收链为空，会话未正确初始化');
    }
    if (!encryptedMessage.baseKey || encryptedMessage.baseKey.length === 0) {
      throw new Error('加密消息缺少 baseKey');
    }
    if (!encryptedMessage.ciphertext || encryptedMessage.ciphertext.length === 0) {
      throw new Error('加密消息缺少密文');
    }

    // 获取消息密钥
    const messageKey = await DoubleRatchet.receiveMessageKey(session.receivingChain, encryptedMessage.messageNumber);
    console.log('[Signal] Message key derived');

    // 解密消息
    const plaintextBytes = await this.decrypt(encryptedMessage.ciphertext, messageKey);
    const plaintext = new TextDecoder().decode(plaintextBytes);
    console.log('[Signal] Message decrypted successfully');

    // 更新会话状态：推进接收链
    if (session.receivingChain) {
      session.receivingChain.key = await DoubleRatchet.nextChainKey(session.receivingChain.key);
      session.receivingChain.index = encryptedMessage.messageNumber + 1;
      console.log('[Signal] Receiving chain updated, new index:', session.receivingChain.index);
    }

    return plaintext;
  }
  /**
   * 生成密钥指纹
   */
  async generateFingerprint(identityKey: Uint8Array): Promise<string> {
    return KeyFingerprint.generate(identityKey);
  }

  /**
   * 加密数据
   */
  private async encrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    // 确保 key 是有效的 Uint8Array
    if (!key || !(key instanceof Uint8Array) || key.length === 0) {
      throw new Error(`无效的加密密钥: ${key}`);
    }

    // 创建 key 的副本，确保是独立的 ArrayBuffer
    const keyBuffer = key.slice().buffer;

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 创建 data 的副本，确保是独立的 ArrayBuffer
    const dataBuffer = data.slice().buffer;
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBuffer
    );

    // 组合IV和密文
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  }

  /**
   * 解密数据
   */
  private async decrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    // 确保 key 是有效的 Uint8Array
    if (!key || !(key instanceof Uint8Array) || key.length === 0) {
      throw new Error(`无效的解密密钥: ${key}`);
    }

    // 创建 key 的副本，确保是独立的 ArrayBuffer
    const keyBuffer = key.slice().buffer;

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    // 创建 ciphertext 的副本，确保是独立的 ArrayBuffer
    const ciphertextBuffer = ciphertext.slice().buffer;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.slice().buffer },
      cryptoKey,
      ciphertextBuffer
    );

    return new Uint8Array(decrypted);
  }
}
