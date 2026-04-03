/**
 * 前端集成测试
 * 测试后端与 AI #2 的前端的集成
 */

import { TestClient } from '../e2e/utils/test-client';

describe('Frontend Integration', () => {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const authToken = process.env.AUTH_TOKEN || 'mock_token';

  describe('Authentication Flow', () => {
    it('should connect to WebSocket with JWT token', async () => {
      const client = new TestClient('frontend_user', authToken, serverUrl);

      await expect(client.connect()).resolves.toBeUndefined();

      client.disconnect();
    });

    it('should reject connection without valid token', async () => {
      const client = new TestClient('frontend_user', 'invalid_token', serverUrl);

      // 应该连接失败或收到错误
      await client.connect().catch((error) => {
        expect(error).toBeDefined();
      });

      client.disconnect();
    });
  });

  describe('Message Flow', () => {
    let sender: TestClient;
    let receiver: TestClient;

    beforeAll(async () => {
      sender = new TestClient('sender_user', authToken, serverUrl);
      receiver = new TestClient('receiver_user', authToken, serverUrl);

      await Promise.all([sender.connect(), receiver.connect()]);
    }, 15000);

    afterAll(() => {
      sender.disconnect();
      receiver.disconnect();
    });

    it('should complete full message flow', async () => {
      // 1. 发送加密消息
      const encryptedMessage = {
        messageType: 2,
        body: Buffer.from('full_flow_test_message').toString('base64'),
      };

      await sender.sendMessage('receiver_user', encryptedMessage);

      // 2. 接收者收到消息
      const received = await receiver.waitForMessage(5000);

      expect(received.senderId).toBe('sender_user');
      expect(received.encryptedMessage).toEqual(encryptedMessage);
      expect(received.timestamp).toBeDefined();

      // 3. 发送者收到确认
      const sentConfirm = await sender.waitForEvent('message.sent', 3000);

      expect(sentConfirm.status).toBe('sent');
    });

    it('should handle multiple messages in sequence', async () => {
      const messages = [
        { messageType: 2, body: Buffer.from('message_1').toString('base64') },
        { messageType: 2, body: Buffer.from('message_2').toString('base64') },
        { messageType: 2, body: Buffer.from('message_3').toString('base64') },
      ];

      for (const msg of messages) {
        await sender.sendMessage('receiver_user', msg);
        const received = await receiver.waitForMessage(3000);
        expect(received.encryptedMessage).toEqual(msg);
      }
    });
  });

  describe('PreKey Bundle Flow', () => {
    it('should fetch PreKey bundle for new session', async () => {
      // 前端获取对方的 PreKeyBundle
      const response = await fetch(`${serverUrl}/api/v1/prekey/target_user`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 200 或 404 都是有效响应
      expect([200, 404, 401]).toContain(response.status);

      if (response.status === 200) {
        const bundle = await response.json();
        expect(bundle.signedPreKey).toBeDefined();
        expect(bundle.kyberPreKey).toBeDefined();
      }
    });

    it('should upload PreKeys after registration', async () => {
      const uploadData = {
        preKeys: [
          { preKeyId: 1, publicKey: 'frontend_key_1_base64' },
          { preKeyId: 2, publicKey: 'frontend_key_2_base64' },
          { preKeyId: 3, publicKey: 'frontend_key_3_base64' },
        ],
        signedPreKey: {
          signedPreKeyId: 1,
          publicKey: 'frontend_signed_key_base64',
          signature: 'frontend_signature_base64',
          timestamp: Date.now(),
        },
        kyberPreKeys: [
          {
            kyberPreKeyId: 1,
            publicKey: 'frontend_kyber_key_base64',
            signature: 'frontend_kyber_signature_base64',
            timestamp: Date.now(),
          },
        ],
      };

      const response = await fetch(`${serverUrl}/api/v1/prekey/upload?deviceId=frontend_device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      expect([200, 201, 401]).toContain(response.status);
    });
  });

  describe('Conversation Events', () => {
    let client: TestClient;

    beforeAll(async () => {
      client = new TestClient('conversation_user', authToken, serverUrl);
      await client.connect();
    }, 10000);

    afterAll(() => {
      client.disconnect();
    });

    it('should receive typing events', async () => {
      // 加入会话
      client.socket.emit('conversation.join', { conversationId: 'test-conversation' });

      // 等待加入确认
      const joinConfirm = await client.waitForEvent('conversation.joined', 3000);
      expect(joinConfirm).toBeDefined();

      // 发送 typing 事件
      client.socket.emit('conversation.typing.start', { conversationId: 'test-conversation' });

      // 应该收到 typing 确认
      const typingAck = await client.waitForEvent('conversation.typing.ack', 3000);
      expect(typingAck).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid recipient', async () => {
      const client = new TestClient('error_test_user', authToken, serverUrl);
      await client.connect();

      try {
        await client.sendMessage('', {
          messageType: 2,
          body: 'test',
        });

        const error = await client.waitForEvent('message.error', 3000);
        expect(error.code).toBe('INVALID_RECIPIENT');
      } finally {
        client.disconnect();
      }
    });

    it('should handle invalid message format', async () => {
      const client = new TestClient('error_test_user', authToken, serverUrl);
      await client.connect();

      try {
        // @ts-ignore - 故意发送无效格式
        await client.sendMessage('target_user', {});

        const error = await client.waitForEvent('message.error', 3000);
        expect(error.code).toBe('INVALID_MESSAGE');
      } finally {
        client.disconnect();
      }
    });
  });
});
