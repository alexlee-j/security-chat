/**
 * Signal Protocol 接口定义
 * 所有 Signal 实现必须实现此接口
 */
export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
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
  sessionId: string;
  remoteUserId: string;
  remoteDeviceId: string;
  localIdentityKeyPair: IdentityKeyPair;
  remoteIdentityKey: Uint8Array;
  sendingChainKey?: Uint8Array;
  receivingChainKey?: Uint8Array;
  sendingRatchetKey?: CryptoKeyPair;
  receivingRatchetKey?: CryptoKeyPair;
  sendingIndex: number;
  receivingIndex: number;
  previousSendingIndex: number;
  rootKey: Uint8Array;
}

export interface EncryptedMessage {
  preKeyId?: number;
  baseKey?: Uint8Array;
  identityKey?: Uint8Array;
  messageNumber: number;
  previousSendingIndex?: number;
  ciphertext: Uint8Array;
  dhPublicKey?: Uint8Array;
}

export interface DecryptedMessage {
  plaintext: string;
  messageNumber: number;
  previousSendingIndex?: number;
  isPreKeyMessage: boolean;
}

/**
 * Signal 接口 - 抽象 Signal Protocol 实现
 */
export interface ISignalProtocol {
  /**
   * 初始化会话（发起方）
   */
  initiateSession(
    prekeyBundle: PrekeyBundle,
    localIdentityKeyPair: IdentityKeyPair
  ): Promise<SessionState>;

  /**
   * 初始化会话（接收方）
   */
  acceptSession(
    preKeyMessage: EncryptedMessage,
    localIdentityKeyPair: IdentityKeyPair,
    localSignedPrekey: SignedPrekey,
    localOneTimePrekey?: OneTimePrekey
  ): Promise<SessionState>;

  /**
   * 加密消息
   */
  encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage>;

  /**
   * 解密消息
   */
  decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<DecryptedMessage>;

  /**
   * 生成签名预密钥
   */
  generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<SignedPrekey>;

  /**
   * 生成一次性预密钥
   */
  generateOneTimePrekey(keyId: number): Promise<OneTimePrekey>;

  /**
   * 序列化会话状态（用于持久化）
   */
  serializeSession(session: SessionState): string;

  /**
   * 反序列化会话状态（用于恢复）
   */
  deserializeSession(data: string): SessionState;
}

// 信号协议工厂函数类型
export type SignalProtocolFactory = () => ISignalProtocol;

// 当前使用的实现（JS 或 WASM）
let currentImplementation: ISignalProtocol | null = null;
let implementationType: 'js' | 'wasm' = 'js';

/**
 * 设置 Signal 协议实现
 */
export function setSignalImplementation(
  impl: ISignalProtocol,
  type: 'js' | 'wasm'
): void {
  currentImplementation = impl;
  implementationType = type;
  console.log(`[Signal] Using ${type.toUpperCase()} implementation`);
}

/**
 * 获取当前 Signal 协议实现
 */
export function getSignalImplementation(): ISignalProtocol {
  if (!currentImplementation) {
    throw new Error('Signal implementation not set');
  }
  return currentImplementation;
}

/**
 * 获取当前实现类型
 */
export function getImplementationType(): 'js' | 'wasm' {
  return implementationType;
}
