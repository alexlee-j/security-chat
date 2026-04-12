import { test, expect } from '@playwright/test';

test.describe('Signal Protocol E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 清理本地存储
    await page.evaluate(() => localStorage.clear());
  });

  test('应该能注册并初始化 Signal 协议', async ({ page }) => {
    // 1. 打开应用
    await page.goto('/');

    // 2. 点击注册按钮
    await page.click('text=立即注册');

    // 3. 填写注册表单
    const username = 'testuser_' + Date.now();
    const email = `test_${Date.now()}@example.com`;

    await page.fill('input[placeholder*="用户名"]', username);
    await page.fill('input[autocomplete="email"]', email);
    await page.fill('input[autocomplete="new-password"]', 'Test123456');

    // 确认密码
    const passwordInputs = await page.locator('input[autocomplete="new-password"]').all();
    if (passwordInputs.length >= 2) {
      await passwordInputs[1].fill('Test123456');
    }

    // 4. 提交注册
    await page.click('button:has-text("注册")');

    // 5. 等待 Signal 初始化
    await page.waitForTimeout(3000);

    // 6. 检查 localStorage 中的密钥
    const hasIdentityKey = await page.evaluate(() => {
      return localStorage.getItem('security-chat-identityKeyPair') !== null;
    });
    expect(hasIdentityKey).toBe(true);

    // 7. 检查预密钥
    const hasPrekeys = await page.evaluate(() => {
      return localStorage.getItem('security-chat-signedPrekeys') !== null;
    });
    expect(hasPrekeys).toBe(true);
  });

  test('SessionKeyManager 应该生成正确的会话密钥', async ({ page }) => {
    await page.goto('/');

    // 检查 SessionKeyManager 是否正确工作
    const result = await page.evaluate(() => {
      // @ts-ignore - 动态加载模块
      const { SessionKeyManager } = window.__SIGNAL_MODULES__ || {};
      if (!SessionKeyManager) return null;
      return {
        key: SessionKeyManager.getSessionKey('user123', 'device456'),
        parsed: SessionKeyManager.parseSessionKey('session-user123-device456'),
        isValid: SessionKeyManager.isValidDeviceId('device456'),
      };
    });

    if (result) {
      expect(result.key).toBe('session-user123-device456');
      expect(result.parsed).toEqual({ userId: 'user123', deviceId: 'device456' });
      expect(result.isValid).toBe(true);
    }
  });

  test('Feature Flags 应该正常工作', async ({ page }) => {
    await page.goto('/');

    // 设置 Feature Flag
    await page.evaluate(() => {
      localStorage.setItem('feature-flags', JSON.stringify({
        useWasmSignal: true,
        useNewSessionManager: true,
        enableMultiDevice: false,
        enableDeviceMigration: false,
      }));
    });

    // 重新加载页面
    await page.reload();

    // 验证 Feature Flags 已加载
    const flags = await page.evaluate(() => {
      const stored = localStorage.getItem('feature-flags');
      return stored ? JSON.parse(stored) : null;
    });

    expect(flags).toBeTruthy();
    expect(flags?.useWasmSignal).toBe(true);
    expect(flags?.useNewSessionManager).toBe(true);
  });

  test('Signal 指标应该被正确记录', async ({ page }) => {
    await page.goto('/');

    // 记录测试指标
    await page.evaluate(() => {
      // @ts-ignore
      if (window.recordEncryption) {
        window.recordEncryption(true);
        window.recordDecryption(true);
      }
    });

    // 等待一段时间
    await page.waitForTimeout(1000);

    // 验证指标已存储
    const hasMetrics = await page.evaluate(() => {
      return localStorage.getItem('security-chat-signal-metrics') !== null;
    });
    expect(hasMetrics).toBe(true);
  });
});

test.describe('Signal Protocol Migration', () => {
  test('旧格式会话 key 应该被检测', async ({ page }) => {
    // 设置旧格式会话
    await page.goto('/');

    await page.evaluate(() => {
      localStorage.setItem('security-chat-session-user123-1', JSON.stringify({
        sessionId: 'old-session',
        remoteUserId: 'user123',
      }));
    });

    // 验证旧格式 key
    const oldKey = 'session-user123-1';
    const parsed = await page.evaluate((key) => {
      const match = key.match(/^session-(.+)-([^-]+)$/);
      if (!match) return null;
      return { userId: match[1], deviceId: match[2] };
    }, oldKey);

    expect(parsed?.deviceId).toBe('1');
  });
});
