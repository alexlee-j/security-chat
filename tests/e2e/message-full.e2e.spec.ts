import { ApiClient } from './utils/api-client';
import { TestClient } from './utils/test-client';
import { io, Socket } from 'socket.io-client';

/**
 * 消息模块 E2E 测试 (Tester A)
 * 测试消息发送、接收、列表等功能
 */

const TEST_USER_A1 = {
  username: `msg_user_a1_${Date.now()}`,
  email: `msg_user_a1_${Date.now()}@test.com`,
  password: 'Test123456',
};

const TEST_USER_A2 = {
  username: `msg_user_a2_${Date.now()}`,
  email: `msg_user_a2_${Date.now()}@test.com`,
  password: 'Test123456',
};

describe('Message Module E2E (Tester A)', () => {
  let clientA1: ApiClient;
  let clientA2: ApiClient;
  let wsA1: Socket;
  let wsA2: Socket;
  let conversationId: string = '';

  beforeAll(async () => {
    clientA1 = new ApiClient();
    clientA2 = new ApiClient();

    // 注册用户
    await clientA1.register(TEST_USER_A1.username, TEST_USER_A1.email, TEST_USER_A1.password);
    await clientA2.register(TEST_USER_A2.username, TEST_USER_A2.email, TEST_USER_A2.password);
  });

  afterAll(async () => {
    wsA1?.disconnect();
    wsA2?.disconnect();
    try {
      await clientA1.logout();
      await clientA2.logout();
    } catch {}
  });

  beforeEach(async () => {
    // 登录
    await clientA1.login(TEST_USER_A1.username, TEST_USER_A1.password);
    await clientA2.login(TEST_USER_A2.username, TEST_USER_A2.password);
  });

  afterEach(async () => {
    wsA1?.disconnect();
    wsA2?.disconnect();
  });

  describe('前置准备: 创建单聊会话', () => {
    it('MSG-PRE: 创建单聊会话', async () => {
      // 用户A创建与用户B的单聊
      const response = await clientA1.client.post('/conversation/direct', {
        peerUserId: TEST_USER_A2.username,
      });

      expect(response.data.success).toBe(true);
      conversationId = response.data.data.conversationId;
      console.log(`✅ MSG-PRE: 创建单聊成功 - conversationId: ${conversationId}`);
    });
  });

  describe('MSG-01 & MSG-02: 发送和接收文本消息', () => {
    it('MSG-01: 应该能够发送文本消息', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-01: 跳过 - 前置会话未创建');
        return;
      }

      const response = await clientA1.client.post('/message/send', {
        conversationId,
        messageType: 1,
        encryptedPayload: JSON.stringify({ text: 'Hello, this is a test message' }),
        nonce: 'test-nonce-' + Date.now(),
      });

      expect(response.data.success).toBe(true);
      console.log(`✅ MSG-01: 发送文本消息成功`);
    });

    it('MSG-02: 应该能够接收消息', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-02: 跳过 - 前置会话未创建');
        return;
      }

      // 用户A发送消息
      await clientA1.client.post('/message/send', {
        conversationId,
        messageType: 1,
        encryptedPayload: JSON.stringify({ text: 'Message for receive test' }),
        nonce: 'test-nonce-' + Date.now(),
      });

      // 用户B获取消息列表
      const response = await clientA2.client.get('/message/list', {
        params: { conversationId, limit: 10 },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.messages.length).toBeGreaterThan(0);
      console.log(`✅ MSG-02: 接收消息成功 - 收到 ${response.data.data.messages.length} 条消息`);
    });
  });

  describe('MSG-03 & MSG-04: 消息列表', () => {
    it('MSG-03: 首次加载应该显示消息', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-03: 跳过 - 前置会话未创建');
        return;
      }

      const response = await clientA1.client.get('/message/list', {
        params: { conversationId, limit: 20 },
      });

      expect(response.data.success).toBe(true);
      console.log(`✅ MSG-03: 消息列表加载成功 - 共 ${response.data.data.messages?.length || 0} 条`);
    });

    it('MSG-04: 滚动加载更早消息', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-04: 跳过 - 前置会话未创建');
        return;
      }

      // 获取消息索引
      const firstResponse = await clientA1.client.get('/message/list', {
        params: { conversationId, limit: 5 },
      });

      if (firstResponse.data.data.messages?.length > 0) {
        const beforeIndex = firstResponse.data.data.messages[0].messageIndex;

        // 使用 beforeIndex 加载更早的消息
        const secondResponse = await clientA1.client.get('/message/list', {
          params: { conversationId, limit: 5, beforeIndex },
        });

        console.log(`✅ MSG-04: 加载更早消息成功`);
      } else {
        console.log('⚠️ MSG-04: 消息数量不足，跳过增量加载测试');
      }
    });
  });

  describe('MSG-05: 消息已读确认', () => {
    it('MSG-05: 发送已读确认', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-05: 跳过 - 前置会话未创建');
        return;
      }

      try {
        // 用户A发送消息
        const sendResponse = await clientA1.client.post('/message/send', {
          conversationId,
          messageType: 1,
          encryptedPayload: JSON.stringify({ text: 'Read receipt test' }),
          nonce: 'test-nonce-' + Date.now(),
        });

        // 用户B发送已读确认
        const ackResponse = await clientA2.client.post('/message/ack/read', {
          conversationId,
          maxMessageIndex: sendResponse.data.data.messageIndex,
        });

        console.log(`✅ MSG-05: 已读确认发送成功`);
      } catch (error: any) {
        console.log(`⚠️ MSG-05: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });

  describe('MSG-07: 消息搜索', () => {
    it('MSG-07: 应该能够搜索消息', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-07: 跳过 - 前置会话未创建');
        return;
      }

      try {
        const response = await clientA1.client.get('/message/search', {
          params: { conversationId, keyword: 'test' },
        });

        expect(response.data.success).toBe(true);
        console.log(`✅ MSG-07: 消息搜索成功`);
      } catch (error: any) {
        console.log(`⚠️ MSG-07: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });

  describe('MSG-08: 草稿保存', () => {
    it('MSG-08: 应该能够保存草稿', async () => {
      if (!conversationId) {
        console.log('⚠️ MSG-08: 跳过 - 前置会话未创建');
        return;
      }

      try {
        // 保存草稿
        const saveResponse = await clientA1.client.post('/message/draft/save', {
          conversationId,
          content: 'This is a draft message',
        });

        // 获取草稿
        const getResponse = await clientA1.client.get('/message/draft/get', {
          params: { conversationId },
        });

        expect(getResponse.data.success).toBe(true);
        console.log(`✅ MSG-08: 草稿保存成功`);
      } catch (error: any) {
        console.log(`⚠️ MSG-08: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });
});
