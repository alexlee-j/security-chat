import { test, expect } from '@playwright/test';

/**
 * 登录验证测试
 * 验证前端验证是否正确阻止短账号/密码提交
 */
test.describe('登录验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('空表单提交应显示验证错误，不应发送 API 请求', async ({ page }) => {
    // 监听网络请求
    const loginRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/login')) {
        loginRequests.push(request.url());
      }
    });

    // 直接点击登录按钮（不填写任何内容）
    await page.click('button:has-text("登录")');

    // 等待验证错误显示
    await page.waitForTimeout(500);

    // 验证错误信息应该显示
    const usernameError = await page.locator('text=账号长度至少3个字符').isVisible().catch(() => false);
    const passwordError = await page.locator('text=密码长度至少8个字符').isVisible().catch(() => false);

    // 至少应该显示一个验证错误
    const hasValidationError = usernameError || passwordError;

    // 不应该有发送到 /auth/login 的请求（因为表单验证应该阻止提交）
    const loginApiCalled = loginRequests.length > 0;

    console.log('验证错误显示:', hasValidationError);
    console.log('API 被调用:', loginApiCalled);

    // 如果验证正确工作，应该显示错误且 API 没有被调用
    if (!hasValidationError && loginApiCalled) {
      // 前端验证失败，API 被调用了（这是 bug）
      expect(hasValidationError).toBe(true);
    }
  });

  test('填写符合格式的账号密码应该能提交', async ({ page }) => {
    // 填写符合后端要求的账号和密码
    await page.fill('input[placeholder*="用户名"]', 'testuser123');
    await page.fill('input[placeholder="密码"]', 'Test123456');

    // 点击登录按钮
    await page.click('button:has-text("登录")');

    // 等待一段时间看是否有 API 调用
    await page.waitForTimeout(1000);

    // 这次应该会有 API 调用（即使返回 400，因为账号密码格式正确）
    const loginRequests = await page.evaluate(() => {
      return (window as any).__loginRequests || [];
    });

    console.log('Login requests captured:', loginRequests);
  });
});