import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

test('GUI-SIMPLE-01: 用户登录', async () => {
  const user = {
    username: `test_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'Test123456!',
  };

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('步骤1: 打开页面');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    console.log('步骤2: 点击注册');
    await page.click('text=立即注册');
    await page.waitForTimeout(1000);

    console.log('步骤3: 填写表单');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="new-password"]', user.password);

    console.log('步骤4: 点击提交');
    await page.click('button[type="submit"]');

    console.log('步骤5: 等待主界面');
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('会话');
    }, { timeout: 20000 });

    console.log('✅ 测试通过');
    await page.screenshot({ path: '/tmp/simple-login-success.png' });

  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    await page.screenshot({ path: '/tmp/simple-login-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
});
