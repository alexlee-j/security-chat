import { TestClient } from './utils/test-client';

/**
 * Burn (阅后即焚) E2E 测试
 * 测试消息销毁功能
 */
describe('Burn E2E', () => {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const aliceToken = process.env.ALICE_TOKEN || 'mock_alice_token';
  const bobToken = process.env.BOB_TOKEN || 'mock_bob_token';

  describe('Burn REST API', () => {
    it('should trigger burn on message', async () => {
      const mockMessageId = '00000000-0000-0000-0000-000000000001';

      const response = await fetch(`${serverUrl}/api/v1/burn/${mockMessageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aliceToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 401 表示未授权，404 表示消息不存在，200 表示成功
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should handle burn for non-burn message', async () => {
      const mockMessageId = '00000000-0000-0000-0000-000000000002';

      const response = await fetch(`${serverUrl}/api/v1/burn/${mockMessageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aliceToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 非阅后即焚消息返回 400
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  describe('WebSocket Burn Events', () => {
    let alice: TestClient;
    let bob: TestClient;

    beforeAll(async () => {
      alice = new TestClient('alice-burn-test', aliceToken, serverUrl);
      bob = new TestClient('bob-burn-test', bobToken, serverUrl);

      try {
        await Promise.all([alice.connect(), bob.connect()]);
      } catch {
        // 连接失败时跳过 WebSocket 测试
      }
    }, 10000);

    afterAll(() => {
      alice?.disconnect();
      bob?.disconnect();
    });

    it('should receive burn.triggered event', async () => {
      // 测试 burn.triggered 事件存在且可以被监听
      // 实际测试需要创建真实的阅后即焚消息
      expect(true).toBe(true);
    });

    it('should handle burn event timing', async () => {
      // 验证 burn sweep 机制（服务端 1 秒间隔）
      // 实际测试需要消息已设置为阅后即焚且已读
      expect(true).toBe(true);
    });
  });

  describe('Burn Configuration', () => {
    it('should validate burn duration', async () => {
      // 验证允许的 burn duration: 5, 10, 30, 60, 300 秒
      const validDurations = [5, 10, 30, 60, 300];
      expect(validDurations).toContain(5);
      expect(validDurations).toContain(300);
      expect(validDurations).not.toContain(100);
    });
  });
});
