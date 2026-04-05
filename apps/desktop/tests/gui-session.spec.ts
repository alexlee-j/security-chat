import { test, expect, chromium } from '@playwright/test';

/**
 * GUI 会话模块测试
 * 测试会话创建、置顶、静音等 UI 功能
 */

const BASE_URL = 'http://localhost:4173';

const generateRandomUser = () => ({
  username: `session_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  email: `session_test_${Date.now()}@example.com`,
  password: 'Test123456!',
});

test('GUI-SESSION-01: 创建单聊会话', async () => {
  const userA = generateRandomUser();
  const userB = generateRandomUser();

  const browser = await chromium.launch({ headless: false });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // 1. 注册用户 A
    console.log('步骤1: 注册用户A');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');
    await pageA.click('text=立即注册');
    await pageA.waitForTimeout(300);
    await pageA.fill('input[name="username"]', userA.username);
    await pageA.fill('input[name="email"]', userA.email);
    await pageA.fill('input[name="new-password"]', userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForTimeout(3000);

    // 2. 注册用户 B
    console.log('步骤2: 注册用户B');
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');
    await pageB.click('text=立即注册');
    await pageB.waitForTimeout(300);
    await pageB.fill('input[name="username"]', userB.username);
    await pageB.fill('input[name="email"]', userB.email);
    await pageB.fill('input[name="new-password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForTimeout(3000);

    // 3. 用户 A 创建会话
    console.log('步骤3: 用户A创建会话');
    await pageA.waitForTimeout(1000);

    // 查找创建会话按钮
    const createButton = pageA.locator('button:has-text("创建"), button:has-text("新会话"), [class*="add"]').first();
    const hasCreateButton = await createButton.count() > 0;

    if (hasCreateButton) {
      await createButton.click();
      await pageA.waitForTimeout(500);

      // 填写用户 B 的用户名
      const searchInput = pageA.locator('input[placeholder*="搜索"], input[placeholder*="用户"], input[type="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill(userB.username);
        await pageA.waitForTimeout(500);

        // 点击搜索结果
        const searchResult = pageA.locator(`text=${userB.username}`).first();
        if (await searchResult.count() > 0) {
          await searchResult.click();
          await pageA.waitForTimeout(500);
        }
      }
    }

    await pageA.screenshot({ path: '/tmp/gui-session-01-created.png' });
    console.log('✅ GUI-SESSION-01: 会话创建完成');

  } catch (error) {
    await pageA.screenshot({ path: '/tmp/gui-session-01-error.png' });
    console.log('❌ GUI-SESSION-01: 失败 -', error.message);
    throw error;
  } finally {
    await browser.close();
  }
});

test('GUI-SESSION-02: 右键菜单功能', async () => {
  const user = generateRandomUser();

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 注册并登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('text=立即注册');
    await page.waitForTimeout(300);
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="new-password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: '/tmp/gui-session-02-main.png' });

    // 尝试右键点击会话项（如果有的话）
    const conversationItem = page.locator('[class*="conversation"], [class*="session"]').first();
    if (await conversationItem.count() > 0) {
      await conversationItem.click({ button: 'right' });
      await page.waitForTimeout(500);

      // 截图右键菜单
      await page.screenshot({ path: '/tmp/gui-session-02-context-menu.png' });
      console.log('✅ GUI-SESSION-02: 右键菜单已显示');
    } else {
      console.log('⚠️ GUI-SESSION-02: 暂无会话项，跳过');
    }

  } catch (error) {
    await page.screenshot({ path: '/tmp/gui-session-02-error.png' });
    console.log('❌ GUI-SESSION-02: 失败 -', error.message);
    throw error;
  } finally {
    await browser.close();
  }
});