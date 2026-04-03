import { TestClient } from './utils/test-client';

/**
 * 消息 E2E 测试
 * 测试加密消息的实时路由功能
 */
describe('Message E2E', () => {
  let alice: TestClient;
  let bob: TestClient;

  // 使用模拟的 JWT token（实际测试需要有效的 token）
  const aliceToken = process.env.ALICE_TOKEN || 'mock_alice_token';
  const bobToken = process.env.BOB_TOKEN || 'mock_bob_token';
  const aliceUserId = 'alice-test-user';
  const bobUserId = 'bob-test-user';

  beforeAll(async () => {
    // 创建测试客户端
    alice = new TestClient(aliceUserId, aliceToken);
    bob = new TestClient(bobUserId, bobToken);

    // 连接 WebSocket
    await Promise.all([alice.connect(), bob.connect()]);
  }, 15000);

  afterAll(() => {
    // 断开连接
    alice.disconnect();
    bob.disconnect();
  });

  it('should send encrypted message from Alice to Bob', async () => {
    // 1. Alice 发送加密消息给 Bob
    const encryptedMessage = {
      messageType: 1,  // PreKeySignalMessage
      body: 'base64-encoded-ciphertext',
    };

    await alice.sendMessage(bobUserId, encryptedMessage);

    // 2. Bob 应该收到消息
    const received = await bob.waitForMessage();

    expect(received.senderId).toBe(aliceUserId);
    expect(received.encryptedMessage).toEqual(encryptedMessage);
    expect(received.timestamp).toBeDefined();
  });

  it('should confirm message sent to Alice', async () => {
    const encryptedMessage = {
      messageType: 2,  // SignalMessage
      body: 'another-base64-ciphertext',
    };

    // Alice 发送消息并等待确认
    await alice.sendMessage(bobUserId, encryptedMessage);

    // 等待发送确认
    const sentConfirm = await alice.waitForEvent('message.sent', 3000);

    expect(sentConfirm.status).toBe('sent');
    expect(sentConfirm.timestamp).toBeDefined();
  });
});
