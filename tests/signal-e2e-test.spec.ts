import { test, expect, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

test('测试Signal协议端到端加密功能', async ({ browser }) => {
  test.setTimeout(60000); // 增加超时时间到60秒
  
  console.log('开始测试Signal协议端到端加密功能');
  
  // 创建两个浏览器上下文，模拟两个用户
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    // 登录Alice用户
    console.log('登录Alice用户');
    await alicePage.goto(BASE_URL);
    await alicePage.waitForLoadState('domcontentloaded');
    await alicePage.fill('input[placeholder="请输入用户名"]', 'alice');
    await alicePage.fill('input[placeholder="请输入密码"]', 'Password123');
    await alicePage.click('button:has-text("登录")');
    await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Alice登录成功');
    
    // 登录Bob用户
    console.log('登录Bob用户');
    await bobPage.goto(BASE_URL);
    await bobPage.waitForLoadState('domcontentloaded');
    await bobPage.fill('input[placeholder="请输入用户名"]', 'bob');
    await bobPage.fill('input[placeholder="请输入密码"]', 'Password123');
    await bobPage.click('button:has-text("登录")');
    await bobPage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Bob登录成功');

    // Alice选择Bob的会话
    console.log('Alice选择Bob的会话');
    // 使用更灵活的选择器，查找包含"bob"的按钮
    await alicePage.click('button:has-text("bob")');
    await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Alice选择会话成功');

    // Alice发送加密消息
    const testMessage = '测试Signal协议端到端加密';
    console.log('Alice发送消息:', testMessage);
    // 使用更灵活的选择器，查找输入框
    await alicePage.fill('input[type="text"]', testMessage);
    // 查找发送按钮
    await alicePage.click('button');
    await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Alice消息发送成功');

    // 验证消息在Alice的界面中显示
    console.log('验证Alice界面消息显示');
    await expect(alicePage.locator('text=' + testMessage)).toBeVisible({ timeout: 10000 });
    console.log('Alice界面消息显示验证成功');

    // Bob选择Alice的会话
    console.log('Bob选择Alice的会话');
    // 使用更灵活的选择器，查找包含"alice"的按钮
    await bobPage.click('button:has-text("alice")');
    await bobPage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Bob选择会话成功');

    // 验证消息在Bob的界面中显示（说明解密成功）
    console.log('验证Bob界面消息显示');
    await expect(bobPage.locator('text=' + testMessage)).toBeVisible({ timeout: 10000 });
    console.log('Bob界面消息显示验证成功');

    // 检查控制台是否有错误
    console.log('检查控制台错误');
    const aliceErrors = await alicePage.console.getMessages({ type: 'error' });
    const bobErrors = await bobPage.console.getMessages({ type: 'error' });
    
    console.log('Alice控制台错误数量:', aliceErrors.length);
    console.log('Bob控制台错误数量:', bobErrors.length);
    
    expect(aliceErrors.length).toBe(0, 'Alice的控制台不应该有错误');
    expect(bobErrors.length).toBe(0, 'Bob的控制台不应该有错误');

    console.log('测试成功完成');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    throw error;
  } finally {
    // 关闭浏览器上下文
    console.log('关闭浏览器上下文');
    try {
      if (aliceContext) await aliceContext.close();
    } catch (error) {
      console.error('关闭Alice上下文失败:', error);
    }
    try {
      if (bobContext) await bobContext.close();
    } catch (error) {
      console.error('关闭Bob上下文失败:', error);
    }
    console.log('测试结束');
  }
});
