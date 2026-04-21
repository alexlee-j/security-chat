import { invoke } from '@tauri-apps/api/core';

export const MEDIA_ENCRYPTION_VERSION = 1;
export const MEDIA_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * 媒体加密/解密相关错误类型
 */
export class MediaCryptoError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_PAYLOAD' | 'DECRYPT_FAILED' | 'CIPHERTEXT_DIGEST_MISMATCH' | 'PLAINTEXT_DIGEST_MISMATCH' | 'ALGORITHM_MISMATCH' | 'KEY_LENGTH_INVALID' | 'NONCE_LENGTH_INVALID' | 'UNKNOWN',
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'MediaCryptoError';
  }
}

export function isMediaCryptoError(error: unknown): error is MediaCryptoError {
  return error instanceof MediaCryptoError;
}

/**
 * 判断是否为解密失败错误（可能是密钥错误或数据损坏）
 */
export function isDecryptFailure(error: unknown): boolean {
  if (!isMediaCryptoError(error)) {
    return false;
  }
  return ['DECRYPT_FAILED', 'CIPHERTEXT_DIGEST_MISMATCH', 'PLAINTEXT_DIGEST_MISMATCH', 'KEY_LENGTH_INVALID', 'NONCE_LENGTH_INVALID'].includes(error.code);
}

/**
 * 判断是否为媒体元数据缺失错误
 */
export function isMediaMetadataMissing(error: unknown): boolean {
  if (!isMediaCryptoError(error)) {
    return false;
  }
  return error.code === 'INVALID_PAYLOAD';
}

export type EncryptedMediaPayload = {
  version: 1;
  assetId: string;
  algorithm: typeof MEDIA_ENCRYPTION_ALGORITHM;
  key: string;
  nonce: string;
  ciphertextDigest: string;
  ciphertextSize: number;
  plainDigest: string;
  plainSize: number;
  fileName: string;
  mimeType: string;
};

type RustEncryptedMedia = {
  algorithm: string;
  key: number[];
  nonce: number[];
  ciphertext: number[];
  ciphertext_digest: number[];
  ciphertext_size: number;
  plain_digest: number[];
  plain_size: number;
};

type RustDecryptedMedia = {
  plaintext: number[];
  plain_digest: number[];
  plain_size: number;
};

function bytesToBase64Url(bytes: number[] | Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): number[] {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Array.from(binary, (char) => char.charCodeAt(0));
}

export function isEncryptedMediaPayload(value: unknown): value is EncryptedMediaPayload {
  const media = value as Partial<EncryptedMediaPayload> | null;
  return Boolean(
    media
      && media.version === MEDIA_ENCRYPTION_VERSION
      && media.algorithm === MEDIA_ENCRYPTION_ALGORITHM
      && typeof media.assetId === 'string'
      && typeof media.key === 'string'
      && typeof media.nonce === 'string'
      && typeof media.ciphertextDigest === 'string'
      && typeof media.ciphertextSize === 'number'
      && Number.isFinite(media.ciphertextSize)
      && typeof media.plainDigest === 'string'
      && typeof media.plainSize === 'number'
      && Number.isFinite(media.plainSize)
      && typeof media.fileName === 'string'
      && typeof media.mimeType === 'string',
  );
}

export async function encryptMediaFile(file: File): Promise<{
  encryptedFile: File;
  media: Omit<EncryptedMediaPayload, 'assetId'>;
}> {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const encrypted = await invoke<RustEncryptedMedia>('encrypt_media_command', {
    plaintext: Array.from(plaintext),
  });
  if (encrypted.algorithm !== MEDIA_ENCRYPTION_ALGORITHM) {
    throw new Error(`Unsupported media algorithm: ${encrypted.algorithm}`);
  }

  const encryptedBytes = new Uint8Array(encrypted.ciphertext);
  const encryptedFile = new File([encryptedBytes], 'encrypted-media.bin', {
    type: 'application/octet-stream',
  });

  return {
    encryptedFile,
    media: {
      version: MEDIA_ENCRYPTION_VERSION,
      algorithm: MEDIA_ENCRYPTION_ALGORITHM,
      key: bytesToBase64Url(encrypted.key),
      nonce: bytesToBase64Url(encrypted.nonce),
      ciphertextDigest: bytesToBase64Url(encrypted.ciphertext_digest),
      ciphertextSize: encrypted.ciphertext_size,
      plainDigest: bytesToBase64Url(encrypted.plain_digest),
      plainSize: encrypted.plain_size,
      fileName: file.name || 'attachment',
      mimeType: file.type || 'application/octet-stream',
    },
  };
}

export async function decryptMediaBlob(ciphertext: Blob, media: EncryptedMediaPayload): Promise<Blob> {
  if (!isEncryptedMediaPayload(media)) {
    throw new MediaCryptoError('无效的加密媒体载荷：缺少必要字段', 'INVALID_PAYLOAD');
  }
  const ciphertextBytes = new Uint8Array(await ciphertext.arrayBuffer());
  try {
    const decrypted = await invoke<RustDecryptedMedia>('decrypt_media_command', {
      input: {
        algorithm: media.algorithm,
        key: base64UrlToBytes(media.key),
        nonce: base64UrlToBytes(media.nonce),
        ciphertext: Array.from(ciphertextBytes),
        ciphertext_digest: base64UrlToBytes(media.ciphertextDigest),
        plain_digest: base64UrlToBytes(media.plainDigest),
      },
    });

    return new Blob([new Uint8Array(decrypted.plaintext)], {
      type: media.mimeType || 'application/octet-stream',
    });
  } catch (error) {
    if (error instanceof MediaCryptoError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ciphertext digest mismatch')) {
      throw new MediaCryptoError('媒体密文校验失败：数据可能被篡改', 'CIPHERTEXT_DIGEST_MISMATCH', error instanceof Error ? error : undefined);
    }
    if (message.includes('plaintext digest mismatch')) {
      throw new MediaCryptoError('媒体明文校验失败：解密后的数据与原始摘要不匹配', 'PLAINTEXT_DIGEST_MISMATCH', error instanceof Error ? error : undefined);
    }
    if (message.includes('decryption failed')) {
      throw new MediaCryptoError('媒体解密失败：密钥错误或数据损坏', 'DECRYPT_FAILED', error instanceof Error ? error : undefined);
    }
    if (message.includes('unsupported media algorithm') || message.includes('algorithm mismatch')) {
      throw new MediaCryptoError(`不支持的加密算法：${media.algorithm}`, 'ALGORITHM_MISMATCH', error instanceof Error ? error : undefined);
    }
    if (message.includes('invalid media key length')) {
      throw new MediaCryptoError('无效的媒体密钥长度', 'KEY_LENGTH_INVALID', error instanceof Error ? error : undefined);
    }
    if (message.includes('invalid media nonce length')) {
      throw new MediaCryptoError('无效的媒体随机数长度', 'NONCE_LENGTH_INVALID', error instanceof Error ? error : undefined);
    }
    throw new MediaCryptoError(`媒体解密失败：${message}`, 'UNKNOWN', error instanceof Error ? error : undefined);
  }
}
