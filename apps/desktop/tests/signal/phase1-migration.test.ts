import { test, expect } from '@playwright/test';
import { SessionKeyManager } from '../../src/core/signal/session-key';

test.describe('Phase 1: Session Key Migration', () => {
  test('SessionKeyManager generates correct keys', () => {
    const key = SessionKeyManager.getSessionKey('user123', 'device456');
    expect(key).toBe('session-user123-device456');
  });

  test('SessionKeyManager parses session key', () => {
    const parsed = SessionKeyManager.parseSessionKey('session-user123-device456');
    expect(parsed).toEqual({
      userId: 'user123',
      deviceId: 'device456',
    });
  });

  test('SessionKeyManager validates device IDs', () => {
    expect(SessionKeyManager.isValidDeviceId('valid-device-id')).toBe(true);
    expect(SessionKeyManager.isValidDeviceId('')).toBe(false);
    expect(SessionKeyManager.isValidDeviceId('a'.repeat(65))).toBe(false);
  });

  test('old format session key should be migrated', () => {
    const oldKey = 'session-user123-1';
    const parsed = SessionKeyManager.parseSessionKey(oldKey);
    expect(parsed?.deviceId).toBe('1'); // detect old format
  });

  test('SessionKeyManager cleans special characters from userId', () => {
    const key = SessionKeyManager.getSessionKey('user@example.com', 'device1');
    expect(key).toBe('session-user-example-com-device1');
  });

  test('SessionKeyManager getMessageKey generates correct format', () => {
    const key = SessionKeyManager.getMessageKey('user123', 'device456');
    expect(key).toBe('user123:device456');
  });

  test('SessionKeyManager handles edge cases', () => {
    // 空字符串应该抛出错误
    expect(() => SessionKeyManager.getSessionKey('', 'device1')).toThrow();
    expect(() => SessionKeyManager.getSessionKey('user1', '')).toThrow();
  });

  test('parseSessionKey returns null for invalid format', () => {
    expect(SessionKeyManager.parseSessionKey('invalid-key')).toBe(null);
    expect(SessionKeyManager.parseSessionKey('session-')).toBe(null);
  });
});
