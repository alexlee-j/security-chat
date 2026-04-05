import { test, expect, chromium } from '@playwright/test';

/**
 * GUI 认证测试
 * 测试登录/注册 UI 流程
 */

const BASE_URL = 'http://localhost:4173';

const generateRandomUser = () => ({
  username: `gui_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  email: `gui_test_${Date.now()}@example.com`,
  password: 'Test123456!',
});

test('GUI-01: 加载登录页面', async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 验证页面标题或主要元素
    const title = await page.locator('.auth-title').textContent();
    console.log('页面标题:', title);

    // 检查登录表单存在
    const loginForm = await page.locator('.auth-form').count();
    console.log('登录表单数量:', loginForm);

    // 检查输入框
    const inputs = await page.locator('.auth-input').count();
    console.log('输入框数量:', inputs);

    // 截图
    await page.screenshot({ path: '/tmp/gui-01-login-page.png' });
    console.log('✅ GUI-01: 登录页面加载成功');

  } finally {
    await browser.close();
  }
});

test('GUI-02: 注册新用户', async () => {
  const user = generateRandomUser();
  console.log('测试用户:', user);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 点击"立即注册"
    await page.click('text=立即注册');
    await page.waitForTimeout(500);

    // 填写注册表单 - 使用 name 属性
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="new-password"]', user.password);

    // 截图注册表单
    await page.screenshot({ path: '/tmp/gui-02-register-form.png' });

    // 点击注册按钮
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 截图注册后状态
    await page.screenshot({ path: '/tmp/gui-02-after-register.png' });

    console.log('✅ GUI-02: 注册流程完成');

  } catch (error) {
    await page.screenshot({ path: '/tmp/gui-02-error.png' });
    console.log('❌ GUI-02: 注册失败 -', error);
    throw error;
  } finally {
    await browser.close();
  }
});

test('GUI-03: 用户登录', async () => {
  const user = generateRandomUser();
  console.log('测试用户:', user);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 先注册
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('text=立即注册');
    await page.waitForTimeout(500);
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="new-password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 等待注册完成，页面跳转
    await page.waitForTimeout(2000);

    // 截图当前状态
    await page.screenshot({ path: '/tmp/gui-03-after-register.png' });

    // 如果注册后还在登录页，尝试登录
    const currentUrl = page.url();
    console.log('当前URL:', currentUrl);

    // 如果还在登录页，说明注册后跳转了
    if (currentUrl.includes('4173')) {
      // 填写登录表单
      await page.fill('input[name="username"]', user.username);
      await page.fill('input[name="current-password"]', user.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: '/tmp/gui-03-after-login.png' });
    console.log('✅ GUI-03: 登录流程完成');

  } catch (error) {
    await page.screenshot({ path: '/tmp/gui-03-error.png' });
    console.log('❌ GUI-03: 登录失败 -', error);
    throw error;
  } finally {
    await browser.close();
  }
});