/**
 * Signal 协议错误类型定义
 */

export class SignalProtocolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SignalProtocolError';
  }
}

export class SessionNotFoundError extends SignalProtocolError {
  constructor(userId: string, deviceId: string) {
    super(
      `Session not found for user ${userId}, device ${deviceId}`,
      'SESSION_NOT_FOUND'
    );
    this.name = 'SessionNotFoundError';
  }
}

export class DecryptionError extends SignalProtocolError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DECRYPTION_ERROR', originalError);
    this.name = 'DecryptionError';
  }
}

export class EncryptionError extends SignalProtocolError {
  constructor(message: string, originalError?: Error) {
    super(message, 'ENCRYPTION_ERROR', originalError);
    this.name = 'EncryptionError';
  }
}

export class InvalidKeyError extends SignalProtocolError {
  constructor(message: string) {
    super(message, 'INVALID_KEY');
    this.name = 'InvalidKeyError';
  }
}

export class RatchetError extends SignalProtocolError {
  constructor(message: string) {
    super(message, 'RATCHET_ERROR');
    this.name = 'RatchetError';
  }
}

/**
 * 判断错误是否为 Signal 协议错误
 */
export function isSignalProtocolError(error: unknown): error is SignalProtocolError {
  return error instanceof SignalProtocolError;
}

/**
 * 判断错误是否为预期的 Signal 错误（可以降级处理）
 */
export function isExpectedSignalError(error: unknown): boolean {
  if (!isSignalProtocolError(error)) {
    return false;
  }
  
  const expectedCodes = [
    'SESSION_NOT_FOUND',
    'DECRYPTION_ERROR',
    'RATCHET_ERROR'
  ];
  
  return expectedCodes.includes(error.code);
}