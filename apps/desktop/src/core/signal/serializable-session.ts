/**
 * 可序列化的会话状态
 * 用于将 SessionState 持久化到 localStorage
 */

export interface SerializableSessionState {
  sessionId: string;
  remoteUserId: string;
  remoteDeviceId: string;
  // 使用 base64 编码的公钥/私钥（可序列化）
  localIdentityPublicKey: string;
  localIdentityPrivateKey: string;
  remoteIdentityKey: string;
  sendingChainKey: string;
  receivingChainKey: string;
  // 发送方 ratchet key (P-256, uncompressed, 65 bytes)
  sendingRatchetPublicKey: string;
  sendingRatchetPrivateKey: string;
  // 接收方 ratchet key
  receivingRatchetPublicKey: string;
  receivingRatchetPrivateKey: string;
  sendingIndex: number;
  receivingIndex: number;
  previousSendingIndex: number;
  rootKey: string;
}

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
 * 将 SessionState 转换为可序列化格式
 *
 * 注意：此函数需要完整的 SessionState 输入，
 * 其中包含 CryptoKey 类型的密钥对
 */
export async function serializeSessionState(
  session: any
): Promise<SerializableSessionState> {
  const localPubKey = await crypto.subtle.exportKey('raw', session.localIdentityKeyPair.publicKey);
  const localPrivKey = await crypto.subtle.exportKey('pkcs8', session.localIdentityKeyPair.privateKey);

  return {
    sessionId: session.sessionId,
    remoteUserId: session.remoteUserId,
    remoteDeviceId: session.remoteDeviceId,
    localIdentityPublicKey: arrayToBase64(new Uint8Array(localPubKey)),
    localIdentityPrivateKey: arrayToBase64(new Uint8Array(localPrivKey)),
    remoteIdentityKey: arrayToBase64(session.remoteIdentityKey),
    sendingChainKey: arrayToBase64(session.sendingChainKey!),
    receivingChainKey: arrayToBase64(session.receivingChainKey!),
    sendingRatchetPublicKey: arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', session.sendingRatchetKey!.publicKey))),
    sendingRatchetPrivateKey: arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', session.sendingRatchetKey!.privateKey))),
    receivingRatchetPublicKey: session.receivingRatchetKey
      ? arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', session.receivingRatchetKey.publicKey)))
      : '',
    receivingRatchetPrivateKey: session.receivingRatchetKey
      ? arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', session.receivingRatchetKey.privateKey)))
      : '',
    sendingIndex: session.sendingIndex,
    receivingIndex: session.receivingIndex,
    previousSendingIndex: session.previousSendingIndex,
    rootKey: arrayToBase64(session.rootKey),
  };
}

/**
 * 从可序列化格式恢复 SessionState
 */
export async function deserializeSessionState(
  data: SerializableSessionState
): Promise<any> {
  const localPublicKey = await crypto.subtle.importKey(
    'raw',
    base64ToArray(data.localIdentityPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const localPrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToArray(data.localIdentityPrivateKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  return {
    sessionId: data.sessionId,
    remoteUserId: data.remoteUserId,
    remoteDeviceId: data.remoteDeviceId,
    localIdentityKeyPair: {
      publicKey: localPublicKey,
      privateKey: localPrivateKey,
    },
    remoteIdentityKey: base64ToArray(data.remoteIdentityKey),
    sendingChainKey: base64ToArray(data.sendingChainKey),
    receivingChainKey: base64ToArray(data.receivingChainKey),
    sendingRatchetKey: data.sendingRatchetPublicKey
      ? await crypto.subtle.importKey(
          'raw',
          base64ToArray(data.sendingRatchetPublicKey),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          []
        )
      : undefined,
    receivingRatchetKey: data.receivingRatchetPublicKey
      ? await crypto.subtle.importKey(
          'raw',
          base64ToArray(data.receivingRatchetPublicKey),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          []
        )
      : undefined,
    sendingIndex: data.sendingIndex,
    receivingIndex: data.receivingIndex,
    previousSendingIndex: data.previousSendingIndex,
    rootKey: base64ToArray(data.rootKey),
  };
}
