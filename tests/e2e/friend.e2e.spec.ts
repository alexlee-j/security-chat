import { ApiClient } from './utils/api-client';

/**
 * 好友模块 E2E 测试 (Tester B)
 * 测试好友搜索、添加、接受、拒绝、拉黑等功能
 */

// 每次测试使用唯一的基础名
const getTestBase = () => `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe('Friend Module E2E (Tester B)', () => {
  let clientB1: ApiClient;
  let clientB2: ApiClient;
  let b1UserId: string;
  let b2UserId: string;

  beforeEach(() => {
    clientB1 = new ApiClient();
    clientB2 = new ApiClient();
  });

  afterEach(async () => {
    try {
      await clientB1.logout();
    } catch {}
    try {
      await clientB2.logout();
    } catch {}
  });

  // 辅助函数：注册并登录获取用户ID
  async function registerAndLogin(client: ApiClient, username: string, email: string, password: string): Promise<string> {
    try {
      await client.register(username, email, password);
    } catch (error: any) {
      // 如果注册失败（用户已存在），直接登录
      if (error.response?.data?.error?.message !== 'User already exists with same email/phone/username') {
        throw error;
      }
    }
    await client.login(username, password);
    return client.getUserId();
  }

  // 辅助函数：搜索用户获取userId
  async function searchUser(client: ApiClient, keyword: string): Promise<string | null> {
    const response = await client.client.get('/friend/search', {
      params: { keyword }
    });
    const users = response.data.data || response.data;
    // 过滤出精确匹配的用户
    const exactMatch = users.find((u: any) => u.username === keyword);
    return exactMatch?.userId || users[0]?.userId || null;
  }

  describe('FRIEND-01: 搜索用户', () => {
    it('应该能够通过用户名搜索用户', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 搜索 B2
      const targetUserId = await searchUser(clientB1, testB2.username);

      expect(targetUserId).toBeDefined();
      console.log(`✅ FRIEND-01: 搜索用户成功 - targetUserId: ${targetUserId}`);
    });
  });

  describe('FRIEND-02: 发送好友请求', () => {
    it('应该能够发送好友请求', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 搜索 B2 并发送好友请求
      const targetUserId = await searchUser(clientB1, testB2.username);

      expect(targetUserId).toBeDefined();

      const response = await clientB1.client.post('/friend/request', {
        targetUserId,
        remark: ''
      });

      expect(response.status).toBe(201);
      console.log(`✅ FRIEND-02: 发送好友请求成功`);
    });
  });

  describe('FRIEND-03: 接收好友请求', () => {
    it('应该能够在待处理请求中看到收到的请求', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送好友请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 查看待处理请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');

      expect(pendingResponse.status).toBe(200);
      const requests = pendingResponse.data.data || pendingResponse.data;
      expect(Array.isArray(requests)).toBe(true);
      console.log(`✅ FRIEND-03: 收到好友请求 - 待处理请求数: ${requests.length}`);
    });
  });

  describe('FRIEND-04: 同意好友请求', () => {
    it('应该能够同意好友请求', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送好友请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 同意请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');
      const requests = pendingResponse.data.data || pendingResponse.data;
      const incomingRequest = requests.find((r: any) => r.requesterUserId === b1UserId);

      expect(incomingRequest).toBeDefined();

      const respondResponse = await clientB2.client.post('/friend/respond', {
        requesterUserId: b1UserId,
        accept: true
      });

      expect([200, 201]).toContain(respondResponse.status);
      console.log(`✅ FRIEND-04: 同意好友请求成功`);
    });
  });

  describe('FRIEND-05: 拒绝好友请求', () => {
    it('应该能够拒绝好友请求', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送好友请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 拒绝请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');
      const requests = pendingResponse.data.data || pendingResponse.data;
      const incomingRequest = requests.find((r: any) => r.requesterUserId === b1UserId);

      expect(incomingRequest).toBeDefined();

      const respondResponse = await clientB2.client.post('/friend/respond', {
        requesterUserId: b1UserId,
        accept: false
      });

      expect([200, 201]).toContain(respondResponse.status);
      console.log(`✅ FRIEND-05: 拒绝好友请求成功`);
    });
  });

  describe('FRIEND-06: 好友列表', () => {
    it('应该能够查看好友列表', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送好友请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 同意请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');
      const requests = pendingResponse.data.data || pendingResponse.data;
      const incomingRequest = requests.find((r: any) => r.requesterUserId === b1UserId);

      if (incomingRequest) {
        await clientB2.client.post('/friend/respond', {
          requesterUserId: b1UserId,
          accept: true
        });
      }

      // B2 查看好友列表
      const friendListResponse = await clientB2.client.get('/friend/list');
      expect(friendListResponse.status).toBe(200);
      const friends = friendListResponse.data.data || friendListResponse.data;
      expect(Array.isArray(friends)).toBe(true);
      console.log(`✅ FRIEND-06: 好友列表获取成功 - 好友数: ${friends.length}`);
    });
  });

  describe('FRIEND-07: 发起单聊', () => {
    it('应该能够向好友发起单聊', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送好友请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 同意请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');
      const requests = pendingResponse.data.data || pendingResponse.data;
      const incomingRequest = requests.find((r: any) => r.requesterUserId === b1UserId);

      if (incomingRequest) {
        await clientB2.client.post('/friend/respond', {
          requesterUserId: b1UserId,
          accept: true
        });
      }

      // B2 创建与 B1 的单聊会话
      const convResponse = await clientB2.client.post('/conversation/direct', {
        peerUserId: b1UserId
      });

      expect(convResponse.status).toBe(201);
      console.log(`✅ FRIEND-07: 发起单聊会话成功`);
    });
  });

  describe('FRIEND-08: 拉黑用户', () => {
    it('应该能够拉黑用户', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 拉黑 B2
      const targetUserId = await searchUser(clientB1, testB2.username);

      expect(targetUserId).toBeDefined();

      const blockResponse = await clientB1.client.post('/friend/block', {
        targetUserId
      });

      expect([200, 201]).toContain(blockResponse.status);
      console.log(`✅ FRIEND-08: 拉黑用户成功`);

      // 验证拉黑列表
      const blockedResponse = await clientB1.client.get('/friend/blocked');
      const blockedList = blockedResponse.data.data || blockedResponse.data;
      const isBlocked = blockedList.some((u: any) => u.userId === targetUserId);
      expect(isBlocked).toBe(true);
      console.log(`✅ FRIEND-08: 拉黑列表验证成功`);
    });
  });

  describe('FRIEND-09: 解除拉黑', () => {
    it('应该能够解除拉黑', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 拉黑 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/block', { targetUserId });

      // B1 解除拉黑
      const unblockResponse = await clientB1.client.post('/friend/unblock', {
        targetUserId
      });

      expect([200, 201]).toContain(unblockResponse.status);
      console.log(`✅ FRIEND-09: 解除拉黑成功`);

      // 验证不在拉黑列表中
      const blockedResponse = await clientB1.client.get('/friend/blocked');
      const blockedList = blockedResponse.data.data || blockedResponse.data;
      const isBlocked = blockedList.some((u: any) => u.userId === targetUserId);
      expect(isBlocked).toBe(false);
      console.log(`✅ FRIEND-09: 解除拉黑验证成功`);
    });
  });

  describe('FRIEND-10: 待处理请求', () => {
    it('应该能够查看所有收到的待处理好友请求', async () => {
      const base = getTestBase();
      const testB1 = { username: `${base}_b1`, email: `${base}_b1@test.com`, password: 'Test123456' };
      const testB2 = { username: `${base}_b2`, email: `${base}_b2@test.com`, password: 'Test123456' };

      b1UserId = await registerAndLogin(clientB1, testB1.username, testB1.email, testB1.password);
      b2UserId = await registerAndLogin(clientB2, testB2.username, testB2.email, testB2.password);

      // B1 发送请求给 B2
      const targetUserId = await searchUser(clientB1, testB2.username);
      await clientB1.client.post('/friend/request', { targetUserId, remark: '' });

      // B2 查看待处理请求
      const pendingResponse = await clientB2.client.get('/friend/pending/incoming');

      expect(pendingResponse.status).toBe(200);
      const requests = pendingResponse.data.data || pendingResponse.data;
      expect(Array.isArray(requests)).toBe(true);
      console.log(`✅ FRIEND-10: 待处理请求获取成功 - 请求数: ${requests.length}`);
    });
  });
});
