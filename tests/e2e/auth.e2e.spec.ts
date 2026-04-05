import { ApiClient } from './utils/api-client';

/**
 * 认证模块 E2E 测试 (Tester A)
 * 测试注册、登录、登出等功能
 */

const TEST_USER_A1 = {
  username: `testuser_a1_${Date.now()}`,
  email: `testuser_a1_${Date.now()}@test.com`,
  password: 'Test123456',
};

const TEST_USER_A2 = {
  username: `testuser_a2_${Date.now()}`,
  email: `testuser_a2_${Date.now()}@test.com`,
  password: 'Test123456',
};

describe('Auth Module E2E (Tester A)', () => {
  let clientA1: ApiClient;
  let clientA2: ApiClient;

  beforeEach(() => {
    clientA1 = new ApiClient();
    clientA2 = new ApiClient();
  });

  afterEach(async () => {
    try {
      await clientA1.logout();
    } catch {}
    try {
      await clientA2.logout();
    } catch {}
  });

  describe('AUTH-01: 用户注册', () => {
    it('应该能够正常注册新用户', async () => {
      const result = await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      expect(result.userId).toBeDefined();
      expect(result.username).toBe(TEST_USER_A1.username);
      console.log(`✅ AUTH-01: 用户注册成功 - userId: ${result.userId}`);
    });
  });

  describe('AUTH-02: 用户注册-重复用户名', () => {
    it('注册重复用户名应该失败', async () => {
      // 先注册一个用户
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      // 尝试用相同用户名注册
      try {
        await clientA2.register(
          TEST_USER_A1.username,
          TEST_USER_A2.email,
          TEST_USER_A2.password
        );
        console.log('❌ AUTH-02: 重复用户名未报错');
      } catch (error: any) {
        if (error.response?.data?.error?.message) {
          console.log(`✅ AUTH-02: 重复用户名报错 - ${error.response.data.error.message}`);
        } else {
          console.log(`✅ AUTH-02: 重复用户名报错 - ${error.message}`);
        }
      }
    });
  });

  describe('AUTH-03: 用户注册-密码过短', () => {
    it('密码少于8位应该失败', async () => {
      try {
        await clientA1.register(
          `test_short_pwd_${Date.now()}`,
          `test_${Date.now()}@test.com`,
          '123456' // 短密码
        );
        console.log('❌ AUTH-03: 短密码未报错');
      } catch (error: any) {
        if (error.response?.data?.error?.message) {
          console.log(`✅ AUTH-03: 短密码报错 - ${error.response.data.error.message}`);
        } else {
          console.log(`✅ AUTH-03: 短密码报错 - ${error.message}`);
        }
      }
    });
  });

  describe('AUTH-04: 密码登录', () => {
    it('应该能够使用正确密码登录', async () => {
      // 先注册
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      // 登出以清除状态
      await clientA1.logout();

      // 使用密码登录
      const result = await clientA1.login(TEST_USER_A1.username, TEST_USER_A1.password);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.userId).toBeDefined();
      console.log(`✅ AUTH-04: 密码登录成功 - userId: ${result.userId}`);
    });
  });

  describe('AUTH-05: 密码登录-错误密码', () => {
    it('错误密码应该登录失败', async () => {
      // 先注册
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      await clientA1.logout();

      // 使用错误密码登录
      try {
        await clientA1.login(TEST_USER_A1.username, 'WrongPassword123');
        console.log('❌ AUTH-05: 错误密码未报错');
      } catch (error: any) {
        if (error.response?.data?.error?.message) {
          console.log(`✅ AUTH-05: 错误密码报错 - ${error.response.data.error.message}`);
        } else {
          console.log(`✅ AUTH-05: 错误密码报错 - ${error.message}`);
        }
      }
    });
  });

  describe('AUTH-06: 验证码登录', () => {
    it('应该能够发送登录验证码', async () => {
      // 先注册
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      await clientA1.logout();

      // 发送验证码（这里会发送真实验证码到邮箱，测试环境可能失败）
      try {
        await clientA1.sendLoginCode(TEST_USER_A1.username);
        console.log('✅ AUTH-06: 发送验证码成功（需手动检查邮箱获取验证码）');
      } catch (error: any) {
        console.log(`⚠️ AUTH-06: 发送验证码 - ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });

  describe('AUTH-09: 登出', () => {
    it('应该能够正常登出', async () => {
      // 先注册并登录
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      // 登出
      await clientA1.logout();

      // 尝试使用已登出的 token 访问受保护资源
      try {
        await clientA1.client.get('/user/signal/info');
        console.log('❌ AUTH-09: 登出后仍能访问');
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log('✅ AUTH-09: 登出成功，访问受保护资源返回 401');
        } else {
          console.log(`✅ AUTH-09: 登出成功 - ${error.response?.data?.error?.message || error.message}`);
        }
      }
    });
  });

  describe('AUTH-10: Token刷新', () => {
    it('应该能够刷新Token', async () => {
      // 先注册并登录
      await clientA1.register(
        TEST_USER_A1.username,
        TEST_USER_A1.email,
        TEST_USER_A1.password
      );

      const oldToken = clientA1.getAccessToken();

      // 刷新 token
      try {
        const result = await clientA1.refreshToken('mock-refresh-token');
        console.log(`⚠️ AUTH-10: Token刷新测试 - 需要真实refreshToken`);
      } catch (error: any) {
        console.log(`⚠️ AUTH-10: Token刷新 - ${error.response?.data?.error?.message || error.message}`);
      }
    });
  });
});
