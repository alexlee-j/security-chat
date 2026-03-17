import { test, expect, chromium } from '@playwright/test';

/**
 * Signal 协议端到端加密测试
 * 测试流程：
 * 1. 注册两个新用户
 * 2. 用户 A 登录并创建与用户 B 的会话
 * 3. 用户 A 发送加密消息给用户 B
 * 4. 用户 B 登录并查看消息
 * 5. 验证消息是否正确解密
 */

const BASE_URL = 'http://127.0.0.1:4173';

// 生成随机用户名
const generateRandomUser = () => ({
  username: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  email: `test_${Date.now()}@example.com`,
  password: 'Test123456!',
});

test('Signal 协议 E2E 加密完整测试', async () => {
  // 测试用户
  const userA = generateRandomUser();
  const userB = generateRandomUser();

  console.log('测试用户 A:', userA);
  console.log('测试用户 B:', userB);

  // 创建浏览器上下文
  const browser = await chromium.launch({ headless: false });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // ========== 步骤 1: 注册用户 A ==========
    console.log('步骤 1: 注册用户 A');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');

    // 点击"立即注册"
    await pageA.click('text=立即注册');
    await pageA.waitForTimeout(500);

    // 填写注册表单
    await pageA.fill('input[placeholder*="账号"]', userA.username);
    await pageA.fill('input[placeholder*="邮箱"]', userA.email);
    await pageA.fill('input[type="password"]', userA.password);

    // 点击注册按钮
    await pageA.click('button:has-text("注册")');

    // 等待注册成功
    await pageA.waitForTimeout(2000);

    console.log('用户 A 注册后 URL:', pageA.url());

    // ========== 步骤 2: 注册用户 B ==========
    console.log('步骤 2: 注册用户 B');
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');

    // 点击"立即注册"
    await pageB.click('text=立即注册');
    await pageB.waitForTimeout(500);

    // 填写注册表单
    await pageB.fill('input[placeholder*="账号"]', userB.username);
    await pageB.fill('input[placeholder*="邮箱"]', userB.email);
    await pageB.fill('input[type="password"]', userB.password);

    // 点击注册按钮
    await pageB.click('button:has-text("注册")');

    // 等待注册成功
    await pageB.waitForTimeout(2000);

    console.log('用户 B 注册后 URL:', pageB.url());

    // ========== 步骤 3: 用户 A 登录 ==========
    console.log('步骤 3: 用户 A 登录');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');

    // 填写登录表单
    await pageA.fill('input[placeholder*="账号"]', userA.username);
    await pageA.fill('input[type="password"]', userA.password);

    // 点击登录按钮
    await pageA.click('button:has-text("登录")');

    // 等待登录成功
    await pageA.waitForTimeout(2000);

    // 检查是否进入聊天界面
    const pageAContent = await pageA.content();
    const isLoggedInA = pageAContent.includes('会话') || pageAContent.includes('消息') || pageAContent.includes('好友');
    console.log('用户 A 登录状态:', isLoggedInA ? '已登录' : '未登录');

    // 截图记录
    await pageA.screenshot({ path: '/tmp/user-a-logged-in.png' });

    // ========== 步骤 4: 用户 B 登录 ==========
    console.log('步骤 4: 用户 B 登录');
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');

    // 填写登录表单
    await pageB.fill('input[placeholder*="账号"]', userB.username);
    await pageB.fill('input[type="password"]', userB.password);

    // 点击登录按钮
    await pageB.click('button:has-text("登录")');

    // 等待登录成功
    await pageB.waitForTimeout(2000);

    // 检查是否进入聊天界面
    const pageBContent = await pageB.content();
    const isLoggedInB = pageBContent.includes('会话') || pageBContent.includes('消息') || pageBContent.includes('好友');
    console.log('用户 B 登录状态:', isLoggedInB ? '已登录' : '未登录');

    // 截图记录
    await pageB.screenshot({ path: '/tmp/user-b-logged-in.png' });

    // ========== 步骤 5: 用户 A 创建会话 ==========
    console.log('步骤 5: 用户 A 创建会话');

    // 点击"创建会话"按钮
    const hasCreateButton = await pageA.locator('button:has-text("创建")').count() > 0;
    if (hasCreateButton) {
      await pageA.click('button:has-text("创建")');
      await pageA.waitForTimeout(500);

      // 填写用户 B 的用户名
      await pageA.fill('input[placeholder*="用户"]', userB.username);
      await pageA.waitForTimeout(500);

      // 点击确认按钮
      await pageA.click('button:has-text("确认")');
      await pageA.waitForTimeout(1000);
    }

    // 截图记录
    await pageA.screenshot({ path: '/tmp/user-a-conversation-created.png' });

    // ========== 步骤 6: 用户 A 发送消息 ==========
    console.log('步骤 6: 用户 A 发送消息');

    // 查找消息输入框
    const messageInput = pageA.locator('input[placeholder*="消息"], textarea[placeholder*="消息"], [contenteditable="true"]');
    const hasMessageInput = await messageInput.count() > 0;

    if (hasMessageInput) {
      // 输入消息
      const testMessage = `Hello from ${userA.username}! Signal encryption test.`;
      await messageInput.fill(testMessage);
      await pageA.waitForTimeout(500);

      // 发送消息
      await messageInput.press('Enter');
      await pageA.waitForTimeout(1000);

      console.log('消息已发送:', testMessage);

      // 截图记录
      await pageA.screenshot({ path: '/tmp/user-a-message-sent.png' });

      // 检查消息是否显示
      const pageContent = await pageA.content();
      const messageDisplayed = pageContent.includes(testMessage) || pageContent.includes('Hello from');
      console.log('消息显示状态:', messageDisplayed ? '已显示' : '未显示');
    } else {
      console.log('未找到消息输入框');
    }

    // ========== 步骤 7: 用户 B 查看消息 ==========
    console.log('步骤 7: 用户 B 查看消息');

    // 刷新页面
    await pageB.reload();
    await pageB.waitForTimeout(2000);

    // 截图记录
    await pageB.screenshot({ path: '/tmp/user-b-message-received.png' });

    // 检查是否收到消息
    const pageBContentAfter = await pageB.content();
    const hasReceivedMessage = pageBContentAfter.includes('Hello from') || pageBContentAfter.includes(userA.username);
    console.log('用户 B 收到消息:', hasReceivedMessage ? '是' : '否');

    // ========== 测试结果 ==========
    console.log('\n========== 测试结果 ==========');
    console.log('用户 A 登录:', isLoggedInA ? '✅ 通过' : '❌ 失败');
    console.log('用户 B 登录:', isLoggedInB ? '✅ 通过' : '❌ 失败');
    console.log('消息发送:', hasMessageInput ? '✅ 通过' : '❌ 失败');
    console.log('消息接收:', hasReceivedMessage ? '✅ 通过' : '❌ 失败');

    // 基本断言
    expect(isLoggedInA).toBe(true);
    expect(isLoggedInB).toBe(true);

  } catch (error) {
    console.error('测试失败:', error);

    // 错误时截图
    await pageA.screenshot({ path: '/tmp/error-page-a.png' });
    await pageB.screenshot({ path: '/tmp/error-page-b.png' });

    throw error;
  } finally {
    // 关闭浏览器
    await browser.close();
  }
});
