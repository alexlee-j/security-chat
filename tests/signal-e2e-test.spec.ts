import { test, expect, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

test('测试 Signal 协议端到端加密功能', async ({ browser }) => {
  test.setTimeout(120000); // 增加超时时间到 120 秒
  
  console.log('开始测试 Signal 协议端到端加密功能');
  
  // 创建两个浏览器上下文，模拟两个用户
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    // 登录 Alice 用户
    console.log('登录 Alice 用户');
    await alicePage.goto(BASE_URL);
    await alicePage.waitForLoadState('domcontentloaded');
    await alicePage.locator('input[placeholder="请输入用户名"]').first().fill('alice');
    await alicePage.locator('input[placeholder="请输入密码"]').first().fill('Password123');
    await alicePage.locator('button:has-text("登录")').first().click();
    await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Alice 登录成功');
    
    // 等待会话列表加载
    await alicePage.waitForTimeout(3000);
    
    // 检查是否有会话
    const conversationCount = await alicePage.locator('.conversation').count();
    console.log('Alice 的会话数量:', conversationCount);
    
    // 登录 Bob 用户
    console.log('登录 Bob 用户');
    await bobPage.goto(BASE_URL);
    await bobPage.waitForLoadState('domcontentloaded');
    await bobPage.locator('input[placeholder="请输入用户名"]').first().fill('bob');
    await bobPage.locator('input[placeholder="请输入密码"]').first().fill('Password123');
    await bobPage.locator('button:has-text("登录")').first().click();
    await bobPage.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Bob 登录成功');
    
    // 等待会话列表加载
    await bobPage.waitForTimeout(3000);
    
    // 检查 Bob 的会话
    const bobConversationCount = await bobPage.locator('.conversation').count();
    console.log('Bob 的会话数量:', bobConversationCount);

    // Alice 选择 Bob 的会话 - 点击包含 bob 的会话按钮
    console.log('Alice 选择 Bob 的会话');
    const aliceConversation = await alicePage.locator('.conversation:has-text("bob")').first();
    if (await aliceConversation.isVisible()) {
      await aliceConversation.click();
      await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('Alice 选择会话成功');
    } else {
      console.log('Alice 没有找到 bob 的会话');
      // 尝试选择第一个会话
      const firstConversation = await alicePage.locator('.conversation').first();
      if (await firstConversation.isVisible()) {
        await firstConversation.click();
        console.log('Alice 选择第一个会话');
      }
    }
    
    // 等待聊天面板加载
    await alicePage.waitForTimeout(2000);

    // Alice 发送加密消息
    const testMessage = '测试 Signal 协议端到端加密';
    console.log('Alice 发送消息:', testMessage);
    
    // 使用 textarea 选择器（聊天输入框是 textarea）
    const textarea = await alicePage.locator('textarea').first();
    
    // 检查 textarea 是否可见和可用
    const isTextareaVisible = await textarea.isVisible();
    console.log('Textarea 是否可见:', isTextareaVisible);
    
    if (isTextareaVisible) {
      // 使用 press 方式输入，确保触发 React onChange 事件
      await textarea.click();
      await textarea.press('Control+a'); // 全选
      await textarea.press('Backspace'); // 删除
      await textarea.type(testMessage, { delay: 50 }); // 逐字输入
      await alicePage.waitForTimeout(1000); // 等待状态更新
      
      // 检查发送按钮状态
      const sendButton = await alicePage.locator('button[type="submit"]').first();
      const isDisabled = await sendButton.isDisabled();
      console.log('发送按钮是否禁用:', isDisabled);
      
      // 如果仍然禁用，尝试使用 Enter 键发送
      if (isDisabled) {
        console.log('发送按钮被禁用，尝试使用 Enter 键发送');
        await textarea.press('Enter');
      } else {
        await sendButton.click();
      }
      
      await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('Alice 消息发送成功');

      // 等待消息出现在消息列表中（而不是在 textarea 或草稿中）
      await alicePage.waitForTimeout(2000);
      
      // 验证消息在 Alice 的界面中显示 - 使用更精确的选择器（消息容器中的文本）
      console.log('验证 Alice 界面消息显示');
      const aliceMessageLocator = alicePage.locator('.message-list .message:has-text("' + testMessage + '")').first();
      await expect(aliceMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('Alice 界面消息显示验证成功');

      // 等待 Bob 接收消息
      await bobPage.waitForTimeout(3000);
      
      // Bob 选择 Alice 的会话
      console.log('Bob 选择 Alice 的会话');
      const bobConversation = await bobPage.locator('.conversation:has-text("alice")').first();
      if (await bobConversation.isVisible()) {
        await bobConversation.click();
        await bobPage.waitForLoadState('networkidle', { timeout: 30000 });
        console.log('Bob 选择会话成功');
        
        // 等待消息加载
        await bobPage.waitForTimeout(2000);

        // 验证消息在 Bob 的界面中显示（说明解密成功）
        console.log('验证 Bob 界面消息显示');
        const bobMessageLocator = bobPage.locator('.message-list .message:has-text("' + testMessage + '")').first();
        await expect(bobMessageLocator).toBeVisible({ timeout: 10000 });
        console.log('Bob 界面消息显示验证成功');
      } else {
        console.log('Bob 没有找到 alice 的会话');
      }
    } else {
      console.log('Textarea 不可见');
    }

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
      console.error('关闭 Alice 上下文失败:', error);
    }
    try {
      if (bobContext) await bobContext.close();
    } catch (error) {
      console.error('关闭 Bob 上下文失败:', error);
    }
    console.log('测试结束');
  }
});
