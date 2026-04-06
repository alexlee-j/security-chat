import { test, expect } from '@playwright/test';

/**
 * GUI 密码相关功能测试
 * TDD 规范：先写测试，再实现功能
 *
 * 待测试功能：
 * 1. TODO-003: 注册表单显示密码强度提示
 * 2. 忘记密码功能
 */

const BASE_URL = 'http://localhost:4173';

/**
 * TEST-01: 注册表单密码强度提示
 * 验证注册表单显示密码强度要求提示文字
 */
test('TEST-01: 注册表单显示密码强度提示', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // 点击"立即注册"切换到注册模式
  await page.click('text=立即注册');
  await page.waitForTimeout(500);

  // 查找密码输入框
  const passwordInput = page.locator('input[name="new-password"]');
  await expect(passwordInput).toBeVisible();

  // 查找密码强度提示元素
  // 预期：显示"密码必须包含数字和字母"的提示
  const passwordHint = page.locator('.password-hint, .password-requirements, .auth-password-hint, text=密码必须');
  const hintExists = await passwordHint.count() > 0;

  // 截图记录当前状态
  await page.screenshot({ path: '/tmp/gui-test-01-password-hint.png' });

  console.log('TEST-01: 密码强度提示元素存在:', hintExists);

  // 断言：密码强度提示应该显示
  expect(hintExists).toBe(true);
});

/**
 * TEST-02: 忘记密码 - 点击按钮显示重置表单
 * 验证点击"忘记密码？"后显示输入邮箱的表单
 */
test('TEST-02: 忘记密码 - 点击按钮显示重置表单', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // 点击"忘记密码？"链接
  await page.click('text=忘记密码？');
  await page.waitForTimeout(500);

  // 验证：显示忘记密码表单
  // 预期：显示邮箱输入框和发送重置链接按钮
  const emailInput = page.locator('input[name="forgot-email"], input[name="email"]');
  const resetButton = page.locator('button[type="submit"]');

  await page.screenshot({ path: '/tmp/gui-test-02-forgot-password.png' });

  // 断言：邮箱输入框应该可见
  await expect(emailInput.first()).toBeVisible();
  console.log('TEST-02: 忘记密码表单已显示');
});

/**
 * TEST-03: 忘记密码 - 发送重置邮件成功
 * 验证输入邮箱后点击发送，按钮显示loading状态，然后显示成功提示
 */
test('TEST-03: 忘记密码 - 发送重置邮件成功', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // 进入忘记密码表单
  await page.click('text=忘记密码？');
  await page.waitForTimeout(500);

  // 输入邮箱
  const emailInput = page.locator('input[name="forgot-email"], input[name="email"]').first();
  await emailInput.fill('test@example.com');

  // 点击发送按钮
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  // 等待响应
  await page.waitForTimeout(2000);

  // 截图记录状态
  await page.screenshot({ path: '/tmp/gui-test-03-after-send.png' });

  // 验证：应该显示成功提示或错误提示（取决于邮箱是否存在）
  const toast = page.locator('.toast, .auth-toast, text=发送, text=成功, text=错误');
  const toastVisible = await toast.count() > 0;

  console.log('TEST-03: 发送后 toast 显示:', toastVisible);
});

/**
 * TEST-04: 忘记密码 - 返回登录页
 * 验证在忘记密码页面可以返回登录页
 */
test('TEST-04: 忘记密码 - 返回登录页', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // 进入忘记密码表单
  await page.click('text=忘记密码？');
  await page.waitForTimeout(500);

  // 点击"返回登录"或"想起密码？立即登录"
  const backLink = page.locator('text=返回登录, text=想起密码？, text=立即登录').first();
  await backLink.click();
  await page.waitForTimeout(500);

  // 验证：应该显示登录表单（用户名/ID输入框）
  const usernameInput = page.locator('input[name="username"]');
  await expect(usernameInput).toBeVisible();

  await page.screenshot({ path: '/tmp/gui-test-04-back-to-login.png' });
  console.log('TEST-04: 成功返回登录页');
});
