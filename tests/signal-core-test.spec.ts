import { test, expect } from '@playwright/test';

/**
 * Signal 协议核心功能测试
 * 测试重点：验证 Signal 密钥生成和存储
 */
test.describe('Signal 协议核心功能测试', () => {
  test.setTimeout(120000);

  test('验证 Signal 密钥生成和存储', async ({ browser }) => {
    const BASE_URL = 'http://localhost:4173';
    
    console.log('\n=== 开始测试 Signal 协议核心功能 ===\n');

    // 创建浏览器上下文
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ========== 步骤 1: 访问应用 ==========
      console.log('[步骤 1] 访问应用...');
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      console.log('  ✓ 应用加载成功');

      // ========== 步骤 2: 切换到注册页面 ==========
      console.log('\n[步骤 2] 切换到注册页面...');
      
      // 查找注册按钮并点击
      const registerButton = await page.locator('button:has-text("注册"), button:has-text("Register")').first();
      if (await registerButton.isVisible()) {
        await registerButton.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ 切换到注册页面');
      } else {
        console.log('  ⚠ 未找到注册按钮，可能已在注册页面');
      }

      // ========== 步骤 3: 填写注册表单 ==========
      console.log('\n[步骤 3] 填写注册表单...');
      
      const testUsername = `signal_test_${Date.now()}`;
      const testEmail = `signal_test_${Date.now()}@test.com`;
      const testPassword = 'Password123';

      console.log(`  - 用户名：${testUsername}`);
      console.log(`  - 邮箱：${testEmail}`);

      // 填写用户名
      const usernameInput = await page.locator('input[placeholder*="用户名"], input[placeholder*="Username"], input[name="username"]').first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill(testUsername);
        console.log('  ✓ 填写用户名');
      }

      // 填写邮箱
      const emailInput = await page.locator('input[placeholder*="邮箱"], input[placeholder*="Email"], input[type="email"], input[name="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill(testEmail);
        console.log('  ✓ 填写邮箱');
      }

      // 填写密码
      const passwordInput = await page.locator('input[placeholder*="密码"], input[placeholder*="Password"], input[type="password"]').first();
      if (await passwordInput.isVisible()) {
        await passwordInput.fill(testPassword);
        console.log('  ✓ 填写密码');
      }

      // ========== 步骤 4: 提交注册 ==========
      console.log('\n[步骤 4] 提交注册...');
      
      const submitButton = await page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log('  ✓ 提交注册表单');
      }

      // 等待注册完成
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(5000); // 等待 Signal 密钥生成和上传
      console.log('  ✓ 注册完成');

      // ========== 步骤 5: 验证 Signal 密钥 ==========
      console.log('\n[步骤 5] 验证 Signal 密钥...');

      const signalKeys = await page.evaluate(() => {
        const identityKey = localStorage.getItem('security-chat-identityKeyPair');
        const signedPrekeys = localStorage.getItem('security-chat-signedPrekeys');
        const oneTimePrekeys = localStorage.getItem('security-chat-oneTimePrekeys');
        const registrationId = localStorage.getItem('security-chat-registrationId');
        const currentDeviceId = localStorage.getItem('security-chat-currentDeviceId');

        return {
          hasIdentityKey: !!identityKey,
          hasSignedPrekeys: !!signedPrekeys,
          hasOneTimePrekeys: !!oneTimePrekeys,
          hasRegistrationId: !!registrationId,
          hasCurrentDeviceId: !!currentDeviceId,
          identityKeyLength: identityKey ? identityKey.length : 0,
          signedPrekeysLength: signedPrekeys ? signedPrekeys.length : 0,
          oneTimePrekeysLength: oneTimePrekeys ? oneTimePrekeys.length : 0,
        };
      });

      console.log('  Signal 密钥状态:', signalKeys);

      // 断言
      expect(signalKeys.hasIdentityKey).toBe(true);
      console.log('  ✓ 身份密钥已生成');

      expect(signalKeys.hasSignedPrekeys).toBe(true);
      console.log('  ✓ 签名预密钥已生成');

      expect(signalKeys.hasOneTimePrekeys).toBe(true);
      console.log('  ✓ 一次性预密钥已生成');

      expect(signalKeys.hasRegistrationId).toBe(true);
      console.log('  ✓ 注册 ID 已生成');

      expect(signalKeys.hasCurrentDeviceId).toBe(true);
      console.log('  ✓ 设备 ID 已生成');

      // ========== 步骤 6: 验证密钥格式 ==========
      console.log('\n[步骤 6] 验证密钥格式...');

      const identityKeyData = await page.evaluate(() => {
        const identityKey = localStorage.getItem('security-chat-identityKeyPair');
        if (!identityKey) return null;
        try {
          return JSON.parse(identityKey);
        } catch {
          return null;
        }
      });

      if (identityKeyData) {
        console.log('  身份密钥数据结构:', Object.keys(identityKeyData));
        expect(identityKeyData.privateKeyJwk).toBeDefined();
        console.log('  ✓ 私钥 JWK 格式正确');
        expect(identityKeyData.publicKeyJwk).toBeDefined();
        console.log('  ✓ 公钥 JWK 格式正确');
      }

      console.log('\n=== 测试通过：Signal 协议核心功能正常 ===\n');

    } catch (error) {
      console.error('\n=== 测试失败 ===\n');
      console.error('错误:', error);
      throw error;
    } finally {
      await context.close();
      console.log('\n[清理] 关闭浏览器上下文\n');
    }
  });
});
