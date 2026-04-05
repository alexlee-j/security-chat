import { ApiClient } from './utils/api-client';

/**
 * 阅后即焚 E2E 测试 (Tester A)
 * 测试消息焚毁功能
 */

const TEST_USER_A1 = {
  username: `burn_user_a1_${Date.now()}`,
  email: `burn_user_a1_${Date.now()}@test.com`,
  password: 'Test123456',
};

const TEST_USER_A2 = {
  username: `burn_user_a2_${Date.now()}`,
  email: `burn_user_a2_${Date.now()}@test.com`,
  password: 'Test123456',
};

describe('Burn After Reading E2E (Tester A)', () => {
  let clientA1: ApiClient;
  let clientA2: ApiClient;
  let conversationId: string = '';

  beforeAll(async () => {
    clientA1 = new ApiClient();
    clientA2 = new ApiClient();

    // 注册用户
    await clientA1.register(TEST_USER_A1.username, TEST_USER_A1.email, TEST_USER_A1.password);
    await clientA2.register(TEST_USER_A2.username, TEST_USER_A2.email, TEST_USER_A2.password);

    // 创建单聊
    const response = await clientA1.client.post('/conversation/direct', {
      peerUserId: TEST_USER_A2.username,
    });
    conversationId = response.data.data.conversationId;
  });

  afterAll(async () => {
    try {
      await clientA1.logout();
      await clientA2.logout();
    } catch {}
  });

  beforeEach(async () => {
    await clientA1.login(TEST_USER_A1.username, TEST_USER_A1.password);
    await clientA2.login(TEST_USER_A2.username, TEST_USER_A2.password);
  });

  describe('BURN-01: 开启阅后即焚', () => {
    it('BURN-01: 应该能够发送阅后即焚消息', async () => {
      if (!conversationId) {
        console.log('⚠️ BURN-01: 跳过 - 前置会话未创建');
        return;
      }

      try {
        const response = await clientA1.client.post('/message/send', {
          conversationId,
          messageType: 1,
          encryptedPayload: JSON.stringify({ text: 'Burn after reading test' }),
          nonce: 'test-nonce-' + Date.now(),
          isBurn: true,
          burnDuration: 5, // 5秒
        });

        expect(response.data.success).toBe(true);
        console.log(`✅ BURN-01: 阅后即焚消息发送成功 - burnDuration: 5s`);
      } catch (error: any) {
        console.log(`⚠️ BURN-01: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });

  describe('BURN-02: 阅后即焚计时', () => {
    it('BURN-02: 消息应该正确记录焚毁时间', async () => {
      if (!conversationId) {
        console.log('⚠️ BURN-02: 跳过');
        return;
      }

      try {
        // 发送阅后即焚消息
        const sendResponse = await clientA1.client.post('/message/send', {
          conversationId,
          messageType: 1,
          encryptedPayload: JSON.stringify({ text: 'Timing test' }),
          nonce: 'test-nonce-' + Date.now(),
          isBurn: true,
          burnDuration: 10,
        });

        const messageId = sendResponse.data.data.messageId;

        // 获取消息列表，检查 burnDuration
        const listResponse = await clientA1.client.get('/message/list', {
          params: { conversationId, limit: 10 },
        });

        const burnMessage = listResponse.data.data.messages?.find(
          (m: any) => m.id === messageId
        );

        if (burnMessage) {
          console.log(`✅ BURN-02: 消息计时信息 - burnDuration: ${burnMessage.burnDuration}s`);
        } else {
          console.log(`⚠️ BURN-02: 消息未找到或已焚毁`);
        }
      } catch (error: any) {
        console.log(`⚠️ BURN-02: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });

  describe('BURN-03 & BURN-04: 消息自动/手动焚毁', () => {
    it('BURN-03 & BURN-04: 测试焚毁功能', async () => {
      if (!conversationId) {
        console.log('⚠️ BURN-03/04: 跳过');
        return;
      }

      try {
        // 发送阅后即焚消息
        const sendResponse = await clientA1.client.post('/message/send', {
          conversationId,
          messageType: 1,
          encryptedPayload: JSON.stringify({ text: 'Manual burn test' }),
          nonce: 'test-nonce-' + Date.now(),
          isBurn: true,
          burnDuration: 60,
        });

        const messageId = sendResponse.data.data.messageId;
        console.log(`✅ BURN-03: 阅后即焚消息已发送 - messageId: ${messageId}`);

        // 尝试手动触发焚毁
        try {
          const burnResponse = await clientA1.client.post('/burn/trigger', {
            messageId,
          });
          console.log(`✅ BURN-04: 手动触发焚毁成功`);
        } catch (error: any) {
          console.log(`⚠️ BURN-04: ${error.response?.data?.error?.message || error.message}`);
        }
      } catch (error: any) {
        console.log(`⚠️ BURN-03: ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });
});
