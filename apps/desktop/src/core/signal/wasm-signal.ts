import {
  ISignalProtocol,
  IdentityKeyPair,
  PrekeyBundle,
  SessionState,
  EncryptedMessage,
  DecryptedMessage
} from './signal-interface';
import { getWasmSignal, initWasmSignal } from './wasm-bridge';

/**
 * 将 ArrayBuffer 或 Uint8Array 转换为 base64 字符串
 */
function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * 将 base64 字符串转换为 Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * WASM Signal Protocol 实现
 */
export class WasmSignalProtocol implements ISignalProtocol {
  private wasm: any;

  constructor() {
    this.wasm = getWasmSignal();
  }

  static async create(): Promise<WasmSignalProtocol> {
    await initWasmSignal();
    return new WasmSignalProtocol();
  }

  async initiateSession(prekeyBundle: PrekeyBundle, localIdentityKeyPair: IdentityKeyPair): Promise<SessionState> {
    const bundle = {
      registration_id: prekeyBundle.registrationId,
      identity_key: arrayToBase64(prekeyBundle.identityKey),
      signed_prekey: {
        key_id: prekeyBundle.signedPrekey.keyId,
        public_key: arrayToBase64(prekeyBundle.signedPrekey.publicKey),
        signature: arrayToBase64(prekeyBundle.signedPrekey.signature),
      },
      one_time_prekey: prekeyBundle.oneTimePrekey ? {
        key_id: prekeyBundle.oneTimePrekey.keyId,
        public_key: arrayToBase64(prekeyBundle.oneTimePrekey.publicKey),
      } : undefined,
    };

    const result = this.wasm.initiate_session(bundle);
    return this.convertSessionFromWasm(result);
  }

  async acceptSession(
    preKeyMessage: EncryptedMessage,
    localIdentityKeyPair: IdentityKeyPair,
    localSignedPrekey: any,
    localOneTimePrekey?: any
  ): Promise<SessionState> {
    const msg = {
      pre_key_id: preKeyMessage.preKeyId,
      base_key: preKeyMessage.baseKey ? arrayToBase64(preKeyMessage.baseKey) : null,
      identity_key: preKeyMessage.identityKey ? arrayToBase64(preKeyMessage.identityKey) : null,
      message_number: preKeyMessage.messageNumber,
      previous_sending_index: preKeyMessage.previousSendingIndex,
      ciphertext: arrayToBase64(preKeyMessage.ciphertext),
      dh_public_key: preKeyMessage.dhPublicKey ? arrayToBase64(preKeyMessage.dhPublicKey) : null,
    };

    const result = this.wasm.accept_session(msg);
    return this.convertSessionFromWasm(result);
  }

  async encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage> {
    const sessionData = this.convertSessionToWasm(session);
    const result = this.wasm.encrypt_message(sessionData, plaintext);
    return this.convertMessageFromWasm(result);
  }

  async decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<DecryptedMessage> {
    const sessionData = this.convertSessionToWasm(session);
    const msg = this.convertMessageToWasm(encryptedMessage);
    const result = this.wasm.decrypt_message(sessionData, msg);
    return {
      plaintext: result.plaintext,
      messageNumber: result.message_number,
      previousSendingIndex: result.previous_sending_index,
      isPreKeyMessage: false,
    };
  }

  async generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<any> {
    throw new Error('Use WASM key generation - this is a placeholder');
  }

  async generateOneTimePrekey(keyId: number): Promise<any> {
    throw new Error('Use WASM key generation - this is a placeholder');
  }

  serializeSession(session: SessionState): string {
    return JSON.stringify(this.convertSessionToWasm(session));
  }

  deserializeSession(data: string): SessionState {
    return this.convertSessionFromWasm(JSON.parse(data));
  }

  // 转换辅助方法
  private convertSessionFromWasm(wasmSession: any): SessionState {
    return {
      sessionId: wasmSession.session_id,
      remoteUserId: wasmSession.remote_user_id,
      remoteDeviceId: wasmSession.remote_device_id,
      localIdentityKeyPair: {
        publicKey: base64ToArray(wasmSession.local_identity_public_key || ''),
        privateKey: base64ToArray(wasmSession.local_identity_private_key || ''),
      },
      remoteIdentityKey: base64ToArray(wasmSession.remote_identity_key || ''),
      sendingChainKey: base64ToArray(wasmSession.sending_chain_key || ''),
      receivingChainKey: base64ToArray(wasmSession.receiving_chain_key || ''),
      sendingIndex: wasmSession.sending_index || 0,
      receivingIndex: wasmSession.receiving_index || 0,
      previousSendingIndex: wasmSession.previous_sending_index || 0,
      rootKey: base64ToArray(wasmSession.root_key || ''),
    } as SessionState;
  }

  private convertSessionToWasm(session: SessionState): any {
    return {
      session_id: session.sessionId,
      remote_user_id: session.remoteUserId,
      remote_device_id: session.remoteDeviceId,
      sending_chain_key: arrayToBase64(session.sendingChainKey || new Uint8Array()),
      receiving_chain_key: arrayToBase64(session.receivingChainKey || new Uint8Array()),
      sending_index: session.sendingIndex,
      receiving_index: session.receivingIndex,
      previous_sending_index: session.previousSendingIndex,
      root_key: arrayToBase64(session.rootKey || new Uint8Array()),
      remote_identity_key: arrayToBase64(session.remoteIdentityKey || new Uint8Array()),
    };
  }

  private convertMessageToWasm(msg: EncryptedMessage): any {
    return {
      pre_key_id: msg.preKeyId,
      base_key: msg.baseKey ? arrayToBase64(msg.baseKey) : null,
      identity_key: msg.identityKey ? arrayToBase64(msg.identityKey) : null,
      message_number: msg.messageNumber,
      previous_sending_index: msg.previousSendingIndex,
      ciphertext: arrayToBase64(msg.ciphertext),
      dh_public_key: msg.dhPublicKey ? arrayToBase64(msg.dhPublicKey) : null,
    };
  }

  private convertMessageFromWasm(wasmMsg: any): EncryptedMessage {
    return {
      preKeyId: wasmMsg.pre_key_id,
      baseKey: wasmMsg.base_key ? base64ToArray(wasmMsg.base_key) : undefined,
      identityKey: wasmMsg.identity_key ? base64ToArray(wasmMsg.identity_key) : undefined,
      messageNumber: wasmMsg.message_number,
      previousSendingIndex: wasmMsg.previous_sending_index,
      ciphertext: base64ToArray(wasmMsg.ciphertext),
      dhPublicKey: wasmMsg.dh_public_key ? base64ToArray(wasmMsg.dh_public_key) : undefined,
    };
  }
}
