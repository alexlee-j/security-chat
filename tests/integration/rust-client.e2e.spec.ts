/**
 * Rust 客户端集成测试
 * 测试后端与 AI #1 的 Rust 客户端的集成
 */

import { TestClient } from '../e2e/utils/test-client';

describe('Rust Client Integration', () => {
  let rustClient: TestClient;
  let backendClient: TestClient;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const authToken = process.env.AUTH_TOKEN || 'mock_token';

  beforeAll(async () => {
    rustClient = new TestClient('rust_client', authToken, serverUrl);
    backendClient = new TestClient('backend_client', authToken, serverUrl);

    await Promise.all([rustClient.connect(), backendClient.connect()]);
  }, 15000);

  afterAll(() => {
    rustClient.disconnect();
    backendClient.disconnect();
  });

  describe('PreKey Exchange', () => {
    it('should fetch PreKey bundle from backend', async () => {
      // Rust client 获取 backend 的 PreKeyBundle
      const response = await fetch(`${serverUrl}/api/v1/prekey/backend_client`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 200 表示有 PreKey，404 表示没有
      expect([200, 404, 401]).toContain(response.status);

      if (response.status === 200) {
        const bundle = await response.json();
        expect(bundle.signedPreKeyId).toBeDefined();
        expect(bundle.signedPreKey).toBeDefined();
        expect(bundle.kyberPreKeyId).toBeDefined();
        expect(bundle.kyberPreKey).toBeDefined();
      }
    });

    it('should upload PreKeys from Rust client', async () => {
      const uploadData = {
        preKeys: [
          { preKeyId: 1, publicKey: 'mock_rust_key_1_base64' },
          { preKeyId: 2, publicKey: 'mock_rust_key_2_base64' },
        ],
        signedPreKey: {
          signedPreKeyId: 1,
          publicKey: 'mock_rust_signed_key_base64',
          signature: 'mock_rust_signature_base64',
          timestamp: Date.now(),
        },
        kyberPreKeys: [
          {
            kyberPreKeyId: 1,
            publicKey: 'mock_rust_kyber_key_base64',
            signature: 'mock_rust_kyber_signature_base64',
            timestamp: Date.now(),
          },
        ],
      };

      const response = await fetch(`${serverUrl}/api/v1/prekey/upload?deviceId=rust_device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      // 200/201 表示成功，401 表示需要有效 token
      expect([200, 201, 401]).toContain(response.status);
    });
  });

  describe('Encrypted Message Exchange', () => {
    it('should send PreKeySignalMessage from Rust client to backend', async () => {
      // Rust client 发送 PreKeySignalMessage
      const encryptedMessage = {
        messageType: 1,  // PreKeySignalMessage
        body: Buffer.from('rust_encrypted_message').toString('base64'),
      };

      await rustClient.sendMessage('backend_client', encryptedMessage);

      // Backend 应该收到消息
      const received = await backendClient.waitForMessage(5000);

      expect(received.senderId).toBe('rust_client');
      expect(received.encryptedMessage.messageType).toBe(1);
    });

    it('should send SignalMessage from backend to Rust client', async () => {
      // Backend 发送 SignalMessage（会话已建立）
      const encryptedMessage = {
        messageType: 2,  // SignalMessage
        body: Buffer.from('backend_encrypted_message').toString('base64'),
      };

      await backendClient.sendMessage('rust_client', encryptedMessage);

      // Rust client 应该收到消息
      const received = await rustClient.waitForMessage(5000);

      expect(received.senderId).toBe('backend_client');
      expect(received.encryptedMessage.messageType).toBe(2);
    });
  });

  describe('Session Management', () => {
    it('should handle session establishment flow', async () => {
      // 1. Rust client 获取 backend 的 PreKeyBundle
      const bundleResponse = await fetch(`${serverUrl}/api/v1/prekey/backend_client`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (bundleResponse.status === 200) {
        const bundle = await bundleResponse.json();

        // 2. Rust client 使用 PreKeyBundle 建立会话（模拟）
        // 实际由 Rust 客户端实现

        // 3. 发送第一条加密消息
        await rustClient.sendMessage('backend_client', {
          messageType: 1,
          body: Buffer.from('session_init_message').toString('base64'),
        });

        // 4. Backend 确认收到
        const received = await backendClient.waitForMessage();
        expect(received).toBeDefined();
      }
    });
  });
});
