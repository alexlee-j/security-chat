/**
 * Signal 协议核心实现
 * 基于 Web Crypto API 实现 Signal 协议的核心功能
 * 
 * 参考：https://signal.org/docs/specifications/x3dh/
 * 参考：https://signal.org/docs/specifications/doubleratchet/
 */

import { generateSecureRandomString } from '../crypto';

// ==================== 类型定义 ====================

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
  // 本地身份密钥引用（用于多设备场景）
  localIdentityKeyPair?: IdentityKeyPair;
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

// ==================== X3DH 密钥交换实现 ====================

/**
 * X3DH (Extended Triple Diffie-Hellman) 密钥交换协议实现
 * 
 * 协议规范：https://signal.org/docs/specifications/x3dh/
 * 
 * 共享密钥计算：
 * - DH1 = DH(发送方身份私钥，接收方签名预密钥公钥)
 * - DH2 = DH(发送方临时私钥，接收方身份公钥)
 * - DH3 = DH(发送方临时私钥，接收方签名预密钥公钥)
 * - DH4 = DH(发送方临时私钥，接收方一次性预密钥公钥) [可选]
 * - SK = KDF(DH1 || DH2 || DH3 || DH4)
 */
export class X3DH {
  /**
   * 生成身份密钥对
   * 
   * 注意：Signal 官方实现中，身份密钥对只用于 ECDH 密钥交换
   * 签名使用独立的 ECDSA 密钥对
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
   * 
   * 签名预密钥由身份私钥签名，用于验证身份
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
   * 初始化会话（发送方）- 实现完整的 X3DH 协议
   * 
   * @param prekeyBundle - 接收方的预密钥包
   * @param localIdentityKeyPair - 发送方的身份密钥对
   * @returns 会话状态
   * 
   * 协议流程：
   * 1. 生成临时密钥对 (ephemeral keypair)
   * 2. 计算 DH1 = DH(身份私钥，签名预密钥公钥)
   * 3. 计算 DH2 = DH(临时私钥，身份公钥)
   * 4. 计算 DH3 = DH(临时私钥，签名预密钥公钥)
   * 5. 计算 DH4 = DH(临时私钥，一次性预密钥公钥) [如果存在]
   * 6. SK = KDF(DH1 || DH2 || DH3 || DH4)
   * 7. 派生根密钥和链密钥
   */
  static async initiateSession(
    prekeyBundle: PrekeyBundle,
    localIdentityKeyPair: IdentityKeyPair
  ): Promise<SessionState> {
    
    // 1. 生成临时密钥对
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    // 导出临时公钥
    const ephemeralPublicKeyBytes = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);

    // 2-5. 计算完整的 X3DH 共享密钥 (DH1 || DH2 || DH3 || DH4)
    const sharedSecret = await this.calculateX3DHSharedSecret(
      localIdentityKeyPair,
      prekeyBundle,
      ephemeralKeyPair
    );


    // 6-7. 使用 HKDF 派生根密钥和链密钥
    const { rootKey, chainKey } = await this.hkdf(
      sharedSecret,
      'X3DH_Initial_KDF'
    );


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
      localIdentityKeyPair,
    };
  }

  /**
   * 计算完整的 X3DH 共享密钥
   * 
   * @param localIdentityKeyPair - 本地身份密钥对
   * @param prekeyBundle - 远程预密钥包
   * @param ephemeralKeyPair - 临时密钥对
   * @returns 组合的共享密钥
   * 
   * DH1 = DH(身份私钥，签名预密钥公钥)
   * DH2 = DH(临时私钥，身份公钥)
   * DH3 = DH(临时私钥，签名预密钥公钥)
   * DH4 = DH(临时私钥，一次性预密钥公钥) [可选]
   */
  private static async calculateX3DHSharedSecret(
    localIdentityKeyPair: IdentityKeyPair,
    prekeyBundle: PrekeyBundle,
    ephemeralKeyPair: CryptoKeyPair
  ): Promise<Uint8Array> {
    const dhOutputs: Uint8Array[] = [];

    // DH1 = DH(身份私钥，签名预密钥公钥)
    const dh1 = await this.calculateSharedSecret(
      localIdentityKeyPair.privateKey,
      prekeyBundle.signedPrekey.publicKey
    );
    dhOutputs.push(dh1);

    // DH2 = DH(临时私钥，身份公钥)
    const dh2 = await this.calculateSharedSecret(
      ephemeralKeyPair.privateKey,
      prekeyBundle.identityKey
    );
    dhOutputs.push(dh2);

    // DH3 = DH(临时私钥，签名预密钥公钥)
    const dh3 = await this.calculateSharedSecret(
      ephemeralKeyPair.privateKey,
      prekeyBundle.signedPrekey.publicKey
    );
    dhOutputs.push(dh3);

    // DH4 = DH(临时私钥，一次性预密钥公钥) [可选]
    if (prekeyBundle.oneTimePrekey) {
      const dh4 = await this.calculateSharedSecret(
        ephemeralKeyPair.privateKey,
        prekeyBundle.oneTimePrekey.publicKey
      );
      dhOutputs.push(dh4);
    }

    // 组合所有 DH 输出
    const totalLength = dhOutputs.reduce((sum, dh) => sum + dh.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const dh of dhOutputs) {
      combined.set(dh, offset);
      offset += dh.length;
    }


    return combined;
  }

  /**
   * 接受会话（接收方）- 实现完整的 X3DH 协议
   * 
   * @param initialMessage - 初始加密消息，包含发送方的 baseKey（临时公钥）
   * @param identityKeyPair - 接收方的身份密钥对
   * @param signedPrekey - 接收方的签名预密钥
   * @param oneTimePrekey - 接收方的一次性预密钥（可选）
   * @returns 会话状态
   * 
   * 协议流程：
   * 1. 计算 DH1 = DH(身份私钥，签名预密钥公钥) - 从发送方视角
   * 2. 计算 DH2 = DH(临时私钥，身份公钥) - 从发送方视角
   * 3. 计算 DH3 = DH(临时私钥，签名预密钥公钥) - 从发送方视角
   * 4. 计算 DH4 = DH(临时私钥，一次性预密钥公钥) - 从发送方视角
   * 5. SK = KDF(DH1 || DH2 || DH3 || DH4)
   */
  static async acceptSession(
    initialMessage: EncryptedMessage,
    identityKeyPair: IdentityKeyPair,
    signedPrekey: SignedPrekey,
    oneTimePrekey?: OneTimePrekey
  ): Promise<SessionState> {

    // 验证 baseKey 是否有效
    if (!initialMessage.baseKey || !(initialMessage.baseKey instanceof Uint8Array) || initialMessage.baseKey.length === 0) {
      console.error('[X3DH] Invalid baseKey in initialMessage:', initialMessage.baseKey);
      throw new Error('初始消息中的 baseKey 无效');
    }

    // 计算完整的 X3DH 共享密钥
    const sharedSecret = await this.calculateX3DHSharedSecretForReceiver(
      identityKeyPair,
      signedPrekey,
      oneTimePrekey,
      initialMessage.baseKey,  // baseKey 是发送方的临时公钥
      initialMessage.identityKey  // 发送方的身份公钥
    );


    // 使用 HKDF 派生根密钥和链密钥
    const { rootKey, chainKey } = await this.hkdf(
      sharedSecret,
      'X3DH_Initial_KDF'
    );


    return {
      remoteIdentityKey: initialMessage.identityKey,
      sendingChain: null,
      receivingChain: {
        key: chainKey,
        index: initialMessage.messageNumber || 0,
      },
      rootKey,
      previousChainLength: initialMessage.previousChainLength || 0,
      localIdentityKeyPair: identityKeyPair,
    };
  }

  /**
   * 为接收方计算 X3DH 共享密钥
   * 
   * 接收方需要从发送方的视角计算 DH 输出：
   * - DH1 = DH(发送方身份私钥，接收方签名预密钥公钥) = DH(接收方签名预密钥私钥，发送方身份公钥)
   * - DH2 = DH(发送方临时私钥，接收方身份公钥) = DH(接收方身份私钥，发送方临时公钥)
   * - DH3 = DH(发送方临时私钥，接收方签名预密钥公钥) = DH(接收方签名预密钥私钥，发送方临时公钥)
   * - DH4 = DH(发送方临时私钥，接收方一次性预密钥公钥) = DH(接收方一次性预密钥私钥，发送方临时公钥)
   */
  private static async calculateX3DHSharedSecretForReceiver(
    localIdentityKeyPair: IdentityKeyPair,
    signedPrekey: SignedPrekey,
    oneTimePrekey: OneTimePrekey | undefined,
    ephemeralPublicKey: Uint8Array,  // 发送方的临时公钥 (baseKey)
    remoteIdentityKey: Uint8Array     // 发送方的身份公钥
  ): Promise<Uint8Array> {
    const dhOutputs: Uint8Array[] = [];

    // DH1 = DH(签名预密钥私钥，发送方身份公钥)
    // 等价于 DH(发送方身份私钥，签名预密钥公钥)
    const dh1 = await this.calculateSharedSecret(
      signedPrekey.keyPair.privateKey,
      remoteIdentityKey
    );
    dhOutputs.push(dh1);

    // DH2 = DH(身份私钥，发送方临时公钥)
    // 等价于 DH(发送方临时私钥，身份公钥)
    const dh2 = await this.calculateSharedSecret(
      localIdentityKeyPair.privateKey,
      ephemeralPublicKey
    );
    dhOutputs.push(dh2);

    // DH3 = DH(签名预密钥私钥，发送方临时公钥)
    // 等价于 DH(发送方临时私钥，签名预密钥公钥)
    const dh3 = await this.calculateSharedSecret(
      signedPrekey.keyPair.privateKey,
      ephemeralPublicKey
    );
    dhOutputs.push(dh3);

    // DH4 = DH(一次性预密钥私钥，发送方临时公钥) [可选]
    if (oneTimePrekey) {
      const dh4 = await this.calculateSharedSecret(
        oneTimePrekey.keyPair.privateKey,
        ephemeralPublicKey
      );
      dhOutputs.push(dh4);
    }

    // 组合所有 DH 输出
    const totalLength = dhOutputs.reduce((sum, dh) => sum + dh.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const dh of dhOutputs) {
      combined.set(dh, offset);
      offset += dh.length;
    }


    return combined;
  }

  /**
   * 计算共享密钥 (ECDH)
   */
  static async calculateSharedSecret(privateKey: CryptoKey, publicKeyBytes: Uint8Array): Promise<Uint8Array> {
    // 验证输入
    if (!publicKeyBytes) {
      throw new Error('公钥字节数组为空 (null/undefined)');
    }
    if (!(publicKeyBytes instanceof Uint8Array)) {
      throw new Error(`公钥不是 Uint8Array 类型，实际类型：${typeof publicKeyBytes}`);
    }
    if (publicKeyBytes.length === 0) {
      throw new Error('公钥字节数组为空 (长度为 0)');
    }

    // P-256 公钥应该是 65 字节（未压缩格式）或 33 字节（压缩格式）
    if (publicKeyBytes.length !== 65 && publicKeyBytes.length !== 33) {
      console.warn(`Unexpected public key length: ${publicKeyBytes.length}, expected 65 or 33`);
    }

    // 创建公钥字节的副本
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
      throw new Error(`计算共享密钥失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * HKDF 密钥派生函数
   * 
   * @param inputKeyMaterial - 输入密钥材料
   * @param info - 上下文信息
   * @returns 派生的根密钥和链密钥
   */
  private static async hkdf(
    inputKeyMaterial: Uint8Array,
    info: string
  ): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode(info);

    // Step 1: Extract - 使用 HMAC-SHA256 提取密钥
    const salt = encoder.encode('Signal_Salt');
    const saltBuffer = salt.slice().buffer as ArrayBuffer;
    const saltKey = await crypto.subtle.importKey(
      'raw',
      saltBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const inputBuffer = inputKeyMaterial.slice().buffer as ArrayBuffer;
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

// ==================== Double Ratchet 算法实现 ====================

/**
 * Double Ratchet 算法实现
 * 
 * 参考：https://signal.org/docs/specifications/doubleratchet/
 * 
 * 核心概念：
 * 1. 对称密钥棘轮 (Symmetric-key Ratchet) - 推进链密钥
 * 2. DH 棘轮 (DH Ratchet) - 每次收到新公钥时执行
 * 3. 消息密钥派生 - 从链密钥派生消息密钥
 * 4. 前向保密 - 每条消息使用不同的密钥
 */
export class DoubleRatchet {
  /**
   * 发送消息密钥
   * 
   * @param sendingChain - 发送链状态
   * @returns 消息密钥
   * 
   * 流程：
   * 1. 从链密钥派生消息密钥
   * 2. 推进链密钥
   */
  static async sendMessageKey(sendingChain: { key: Uint8Array; index: number }): Promise<{ messageKey: Uint8Array; nextChainKey: Uint8Array }> {
    // 使用 KDF 派生消息密钥
    const messageKey = await this.deriveMessageKey(sendingChain.key);
    
    // 推进链密钥
    const nextChainKey = await this.nextChainKey(sendingChain.key);
    
    return { messageKey, nextChainKey };
  }

  /**
   * 接收消息密钥
   * 
   * @param receivingChain - 接收链状态
   * @param messageNumber - 消息编号
   * @returns 消息密钥和更新后的链密钥
   * 
   * 流程：
   * 1. 推进链密钥到正确的消息索引
   * 2. 从链密钥派生消息密钥
   */
  static async receiveMessageKey(
    receivingChain: { key: Uint8Array; index: number },
    messageNumber: number
  ): Promise<{ messageKey: Uint8Array; nextChainKey: Uint8Array; newIndex: number }> {
    // 推进链密钥到正确的消息索引
    let chainKey = receivingChain.key;
    const currentIndex = receivingChain.index;
    
    // 如果消息编号大于当前索引，需要推进链
    for (let i = currentIndex; i < messageNumber; i++) {
      chainKey = await this.nextChainKey(chainKey);
    }
    
    // 使用 KDF 派生消息密钥
    const messageKey = await this.deriveMessageKey(chainKey);
    
    // 计算下一个链密钥
    const nextChainKey = await this.nextChainKey(chainKey);
    
    return { 
      messageKey, 
      nextChainKey,
      newIndex: messageNumber + 1
    };
  }

  /**
   * 派生消息密钥
   */
  private static async deriveMessageKey(chainKey: Uint8Array): Promise<Uint8Array> {
    // 使用 HMAC-SHA256 派生消息密钥
    const encoder = new TextEncoder();
    const salt = encoder.encode('message_key');

    const keyBuffer = chainKey.slice().buffer;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const derivedBits = await crypto.subtle.sign('HMAC', keyMaterial, salt);

    return new Uint8Array(derivedBits);
  }

  /**
   * 推进发送链
   */
  static async nextChainKey(currentKey: Uint8Array): Promise<Uint8Array> {
    // 使用 HMAC-SHA256 推进链密钥
    const encoder = new TextEncoder();
    const salt = encoder.encode('chain_key');

    const keyBuffer = currentKey.slice().buffer;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const derivedBits = await crypto.subtle.sign('HMAC', keyMaterial, salt);

    return new Uint8Array(derivedBits);
  }

  /**
   * DH 棘轮
   * 
   * @param rootKey - 当前根密钥
   * @param localKeyPair - 本地 DH 密钥对
   * @param remotePublicKey - 远程 DH 公钥
   * @returns 新的根密钥和链密钥
   * 
   * 流程：
   * 1. 计算 DH 共享密钥
   * 2. 使用 HKDF 派生新的根密钥和链密钥
   */
  static async dhRatchet(
    rootKey: Uint8Array,
    localKeyPair: CryptoKeyPair,
    remotePublicKey: Uint8Array
  ): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
    // 计算共享密钥
    const sharedSecret = await X3DH.calculateSharedSecret(localKeyPair.privateKey, remotePublicKey);

    // 使用 HKDF 派生新的根密钥和链密钥
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode('DoubleRatchet_DH');

    // Extract
    const salt = rootKey.slice().buffer as ArrayBuffer;
    const saltKey = await crypto.subtle.importKey(
      'raw',
      salt,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const inputBuffer = sharedSecret.slice().buffer as ArrayBuffer;
    const prk = await crypto.subtle.sign('HMAC', saltKey, inputBuffer);

    // Expand
    const prkKey = await crypto.subtle.importKey(
      'raw',
      prk,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

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

// ==================== 密钥指纹生成 ====================

export class KeyFingerprint {
  /**
   * 生成密钥指纹
   */
  static async generate(identityKey: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', identityKey.buffer as ArrayBuffer);
    const hashArray = new Uint8Array(hash);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
  }

  /**
   * 格式化指纹为易读格式（每 12 个字符一组）
   */
  static format(fingerprint: string): string {
    return fingerprint.match(/.{12}/g)?.join(' ') || fingerprint;
  }
}

// ==================== Signal 协议主类 ====================

export class SignalProtocol {
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
   * 初始化会话（发送方）
   * 
   * @param prekeyBundle - 接收方的预密钥包
   * @param localIdentityKeyPair - 发送方的身份密钥对
   */
  async initiateSession(
    prekeyBundle: PrekeyBundle,
    localIdentityKeyPair: IdentityKeyPair
  ): Promise<SessionState> {
    return X3DH.initiateSession(prekeyBundle, localIdentityKeyPair);
  }

  /**
   * 接受会话（接收方）
   * 
   * @param initialMessage - 初始加密消息
   * @param identityKeyPair - 接收方的身份密钥对
   * @param signedPrekey - 接收方的签名预密钥
   * @param oneTimePrekey - 接收方的一次性预密钥（可选）
   */
  async acceptSession(
    initialMessage: EncryptedMessage,
    identityKeyPair: IdentityKeyPair,
    signedPrekey: SignedPrekey,
    oneTimePrekey?: OneTimePrekey
  ): Promise<SessionState> {
    return X3DH.acceptSession(initialMessage, identityKeyPair, signedPrekey, oneTimePrekey);
  }

  /**
   * 加密消息
   */
  async encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage> {
    if (!session.sendingChain) {
      throw new Error('Sending chain is null');
    }

    // 使用 Double Ratchet 派生消息密钥
    const { messageKey, nextChainKey } = await DoubleRatchet.sendMessageKey(session.sendingChain);

    // 加密消息
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    const ciphertext = await this.encrypt(plaintextBytes, messageKey);

    // 确定 baseKey
    let baseKey: Uint8Array;
    let dhPublicKey: Uint8Array | undefined;

    if (session.sendingChain.index === 0 && session.ephemeralPublicKey) {
      // 第一条消息：使用初始化时生成的临时公钥
      baseKey = session.ephemeralPublicKey;
      dhPublicKey = session.ephemeralPublicKey;
    } else {
      // 后续消息：生成新的 DH 密钥对用于 DH 棘轮
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
    session.sendingChain.key = nextChainKey;
    session.sendingChain.index++;

    return {
      version: 3,
      registrationId: 12345,
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
   * 解密消息
   */
  async decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<string> {
    if (!session.receivingChain) {
      throw new Error('Receiving chain is null');
    }

    // 检查是否需要 DH 棘轮
    if (encryptedMessage.dhPublicKey && session.localIdentityKeyPair) {
      // 这里应该实现 DH 棘轮逻辑
      // 简化实现：直接使用当前链
    }

    // 使用 Double Ratchet 派生消息密钥
    const { messageKey, nextChainKey, newIndex } = await DoubleRatchet.receiveMessageKey(
      session.receivingChain,
      encryptedMessage.messageNumber
    );

    // 解密消息
    const plaintextBytes = await this.decrypt(encryptedMessage.ciphertext, messageKey);
    const plaintext = new TextDecoder().decode(plaintextBytes);

    // 更新会话状态
    session.receivingChain.key = nextChainKey;
    session.receivingChain.index = newIndex;

    return plaintext;
  }

  /**
   * 生成密钥指纹
   */
  async generateFingerprint(identityKey: Uint8Array): Promise<string> {
    return KeyFingerprint.generate(identityKey);
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
      if (base64 instanceof Uint8Array) {
        return base64;
      }
      if (Array.isArray(base64)) {
        return new Uint8Array(base64);
      }
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
          const encoder = new TextEncoder();
          return encoder.encode(base64);
        }
      }
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
   * 加密数据 (AES-256-GCM)
   */
  private async encrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    if (!key || !(key instanceof Uint8Array) || key.length === 0) {
      throw new Error(`无效的加密密钥`);
    }

    const keyBuffer = key.slice().buffer;

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dataBuffer = data.slice().buffer;
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBuffer
    );

    // 组合 IV 和密文
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  }

  /**
   * 解密数据 (AES-256-GCM)
   */
  private async decrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    if (!key || !(key instanceof Uint8Array) || key.length === 0) {
      throw new Error(`无效的解密密钥`);
    }

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
    const ciphertextBuffer = ciphertext.slice().buffer;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.slice().buffer },
      cryptoKey,
      ciphertextBuffer
    );

    return new Uint8Array(decrypted);
  }
}
