import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Signal 协议端到端加密测试', () => {
  test.setTimeout(180000); // 3 分钟超时

  let aliceContext: BrowserContext;
  let bobContext: BrowserContext;
  let alicePage: Page;
  let bobPage: Page;

  // 测试前清理：确保使用新的测试数据
  test.beforeAll(async ({ browser }) => {
    console.log('[BeforeAll] 设置测试环境...');
    
    // 创建两个独立的浏览器上下文
    aliceContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    bobContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    alicePage = await aliceContext.newPage();
    bobPage = await bobContext.newPage();

    console.log('[BeforeAll] 测试环境设置完成');
  });

  // 测试后清理
  test.afterAll(async () => {
    console.log('[AfterAll] 清理测试环境...');
    await aliceContext.close();
    await bobContext.close();
    console.log('[AfterAll] 测试环境清理完成');
  });

  test('完整流程：注册→登录→发送加密消息→接收解密', async () => {
    const BASE_URL = 'http://localhost:4173';
    const testMessage = `测试 Signal 加密-${Date.now()}`;
    
    console.log('\n=== 开始测试 Signal 协议端到端加密 ===\n');

    // ========== 步骤 1: Alice 注册 ==========
    console.log('[步骤 1] Alice 注册新用户...');
    await alicePage.goto(BASE_URL);
    await alicePage.waitForLoadState('domcontentloaded');
    
    // 切换到注册模式
    const registerTab = await alicePage.locator('button:has-text("注册"), button:has-text("Register"), .tab:has-text("注册"), .tab:has-text("Register")').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await alicePage.waitForTimeout(500);
    }

    // 填写注册表单
    const testUsername = `signal_test_alice_${Date.now()}`;
    const testEmail = `signal_test_alice_${Date.now()}@test.com`;
    const testPassword = 'Password123';

    console.log(`  - 用户名：${testUsername}`);
    console.log(`  - 邮箱：${testEmail}`);

    // 查找并填写用户名
    const usernameInput = await alicePage.locator('input[placeholder*="用户名"], input[placeholder*="Username"], input[name="username"]').first();
    await usernameInput.fill(testUsername);

    // 查找并填写邮箱
    const emailInput = await alicePage.locator('input[placeholder*="邮箱"], input[placeholder*="Email"], input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);

    // 查找并填写密码
    const passwordInput = await alicePage.locator('input[placeholder*="密码"], input[placeholder*="Password"], input[type="password"]').first();
    await passwordInput.fill(testPassword);

    // 点击注册按钮
    const registerButton = await alicePage.locator('button[type="submit"]:has-text("注册"), button[type="submit"]:has-text("Register"), button:has-text("注册"), button:has-text("Register")').first();
    await registerButton.click();

    // 等待注册成功并加载主界面
    await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
    await alicePage.waitForTimeout(5000); // 等待 Signal 密钥生成和上传

    console.log('[步骤 1] Alice 注册完成');

    // 调试：打印所有 localStorage 项
    const allStorage = await alicePage.evaluate(() => {
      const result: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          result[key] = localStorage.getItem(key)?.substring(0, 100) || null;
        }
      }
      return result;
    });
    console.log('  localStorage keys:', Object.keys(allStorage));

    // 验证 Alice 登录成功 - 检查 secure-storage 中的 auth 相关 key
    const aliceAuth = await alicePage.evaluate(() => {
      // 检查是否有 auth 相关的存储（secure-storage 加密存储）
      const hasAuthStorage = Object.keys(localStorage).some(key => 
        key.includes('auth') || key.includes('token') || key.includes('user')
      );
      // 或者检查是否有 Signal 密钥（说明注册成功）
      const hasSignalKeys = !!localStorage.getItem('security-chat-identityKeyPair');
      return hasAuthStorage || hasSignalKeys;
    });
    expect(aliceAuth).toBe(true);
    console.log('  ✓ Alice 登录成功，认证信息已存储');

    // 验证 Signal 密钥已生成
    const aliceSignalKeys = await alicePage.evaluate(() => {
      const identityKey = localStorage.getItem('security-chat-identityKeyPair');
      const signedPrekeys = localStorage.getItem('security-chat-signedPrekeys');
      const oneTimePrekeys = localStorage.getItem('security-chat-oneTimePrekeys');
      return {
        hasIdentityKey: !!identityKey,
        hasSignedPrekeys: !!signedPrekeys,
        hasOneTimePrekeys: !!oneTimePrekeys,
      };
    });
    expect(aliceSignalKeys.hasIdentityKey).toBe(true);
    console.log('  ✓ Alice 身份密钥已生成');
    expect(aliceSignalKeys.hasSignedPrekeys).toBe(true);
    console.log('  ✓ Alice 签名预密钥已生成');
    expect(aliceSignalKeys.hasOneTimePrekeys).toBe(true);
    console.log('  ✓ Alice 一次性预密钥已生成');

    // ========== 步骤 2: Bob 注册 ==========
    console.log('\n[步骤 2] Bob 注册新用户...');
    await bobPage.goto(BASE_URL);
    await bobPage.waitForLoadState('domcontentloaded');

    // 切换到注册模式
    const bobRegisterTab = await bobPage.locator('button:has-text("注册"), button:has-text("Register"), .tab:has-text("注册"), .tab:has-text("Register")').first();
    if (await bobRegisterTab.isVisible()) {
      await bobRegisterTab.click();
      await bobPage.waitForTimeout(500);
    }

    // 填写 Bob 的注册表单
    const testBobUsername = `signal_test_bob_${Date.now()}`;
    const testBobEmail = `signal_test_bob_${Date.now()}@test.com`;

    console.log(`  - 用户名：${testBobUsername}`);
    console.log(`  - 邮箱：${testBobEmail}`);

    const bobUsernameInput = await bobPage.locator('input[placeholder*="用户名"], input[placeholder*="Username"], input[name="username"]').first();
    await bobUsernameInput.fill(testBobUsername);

    const bobEmailInput = await bobPage.locator('input[placeholder*="邮箱"], input[placeholder*="Email"], input[type="email"], input[name="email"]').first();
    await bobEmailInput.fill(testBobEmail);

    const bobPasswordInput = await bobPage.locator('input[placeholder*="密码"], input[placeholder*="Password"], input[type="password"]').first();
    await bobPasswordInput.fill(testPassword);

    const bobRegisterButton = await bobPage.locator('button[type="submit"]:has-text("注册"), button[type="submit"]:has-text("Register"), button:has-text("注册"), button:has-text("Register")').first();
    await bobRegisterButton.click();

    await bobPage.waitForLoadState('networkidle', { timeout: 30000 });
    await bobPage.waitForTimeout(3000);

    console.log('[步骤 2] Bob 注册完成');

    // 验证 Bob 登录成功 - 检查 secure-storage 中的 auth 相关 key
    const bobAuth = await bobPage.evaluate(() => {
      // 检查是否有 auth 相关的存储（secure-storage 加密存储）
      const hasAuthStorage = Object.keys(localStorage).some(key => 
        key.includes('auth') || key.includes('token') || key.includes('user')
      );
      // 或者检查是否有 Signal 密钥（说明注册成功）
      const hasSignalKeys = !!localStorage.getItem('security-chat-identityKeyPair');
      return hasAuthStorage || hasSignalKeys;
    });
    expect(bobAuth).toBe(true);
    console.log('  ✓ Bob 登录成功，认证信息已存储');

    // 验证 Bob 的 Signal 密钥已生成
    const bobSignalKeys = await bobPage.evaluate(() => {
      const identityKey = localStorage.getItem('security-chat-identityKeyPair');
      const signedPrekeys = localStorage.getItem('security-chat-signedPrekeys');
      const oneTimePrekeys = localStorage.getItem('security-chat-oneTimePrekeys');
      return {
        hasIdentityKey: !!identityKey,
        hasSignedPrekeys: !!signedPrekeys,
        hasOneTimePrekeys: !!oneTimePrekeys,
      };
    });
    expect(bobSignalKeys.hasIdentityKey).toBe(true);
    console.log('  ✓ Bob 身份密钥已生成');
    expect(bobSignalKeys.hasSignedPrekeys).toBe(true);
    console.log('  ✓ Bob 签名预密钥已生成');
    expect(bobSignalKeys.hasOneTimePrekeys).toBe(true);
    console.log('  ✓ Bob 一次性预密钥已生成');

    // ========== 步骤 3: Alice 和 Bob 添加好友 ==========
    console.log('\n[步骤 3] Alice 和 Bob 添加好友...');

    // Alice 发送好友申请给 Bob
    await alicePage.goto(`${BASE_URL}/#/friend`);
    await alicePage.waitForLoadState('domcontentloaded');
    await alicePage.waitForTimeout(1000);

    // 在好友搜索框中输入 Bob 的用户名
    const searchInput = await alicePage.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill(testBobUsername);

    // 点击搜索按钮
    const searchButton = await alicePage.locator('button:has-text("搜索"), button:has-text("Search")').first();
    await searchButton.click();
    await alicePage.waitForTimeout(2000);

    // 点击加好友按钮
    const addFriendButton = await alicePage.locator('button:has-text("加好友"), button:has-text("Add Friend")').first();
    if (await addFriendButton.isVisible()) {
      await addFriendButton.click();
      await alicePage.waitForTimeout(2000);
      console.log('  ✓ Alice 发送好友申请给 Bob');
    }

    // Bob 接受好友申请
    await bobPage.goto(`${BASE_URL}/#/friend`);
    await bobPage.waitForLoadState('domcontentloaded');
    await bobPage.waitForTimeout(2000);

    // 查找并点击接受好友申请
    const acceptButton = await bobPage.locator('button:has-text("接受"), button:has-text("Accept"), button:has-text("同意")').first();
    if (await acceptButton.isVisible()) {
      await acceptButton.click();
      await bobPage.waitForTimeout(2000);
      console.log('  ✓ Bob 接受好友申请');
    }

    // ========== 步骤 4: Alice 发送加密消息给 Bob ==========
    console.log('\n[步骤 4] Alice 发送加密消息...');

    // Alice 切换到聊天页面
    await alicePage.goto(`${BASE_URL}/#/chat`);
    await alicePage.waitForLoadState('domcontentloaded');
    await alicePage.waitForTimeout(2000);

    // 选择 Bob 的会话
    const bobConversation = await alicePage.locator('.conversation:has-text("bob"), .conversation-item:has-text("bob"), .chat-list-item:has-text("bob")').first();
    if (await bobConversation.isVisible()) {
      await bobConversation.click();
      await alicePage.waitForTimeout(2000);
      console.log('  ✓ Alice 选择 Bob 的会话');
    } else {
      console.log('  ⚠ 未找到 Bob 的会话，尝试创建直接对话');
      // 尝试创建直接对话
      // 这里简化处理，如果找不到会话就跳过
    }

    // 查找消息输入框 (textarea)
    const messageTextarea = await alicePage.locator('textarea[placeholder*="消息"], textarea[placeholder*="Message"], textarea').first();
    
    if (await messageTextarea.isVisible()) {
      // 清空并输入消息
      await messageTextarea.click();
      await messageTextarea.press('Control+a');
      await messageTextarea.press('Backspace');
      await messageTextarea.type(testMessage, { delay: 50 });
      await alicePage.waitForTimeout(1000);

      // 查找发送按钮
      const sendButton = await alicePage.locator('button[type="submit"], button:has-text("发送"), button:has-text("Send"), .send-button').first();
      
      // 检查发送按钮是否可用
      const isDisabled = await sendButton.isDisabled();
      if (isDisabled) {
        console.log('  ⚠ 发送按钮被禁用，尝试使用 Enter 键发送');
        await messageTextarea.press('Enter');
      } else {
        await sendButton.click();
      }

      await alicePage.waitForLoadState('networkidle', { timeout: 30000 });
      await alicePage.waitForTimeout(2000);

      console.log(`  ✓ Alice 发送消息："${testMessage}"`);

      // 验证消息在 Alice 的界面中显示
      const aliceMessageVisible = await alicePage.locator('.message-list .message, .chat-message, .message-item').filter({ hasText: testMessage }).first().isVisible();
      if (aliceMessageVisible) {
        console.log('  ✓ 消息在 Alice 的界面中显示');
      }
    } else {
      console.log('  ⚠ 未找到消息输入框');
    }

    // ========== 步骤 5: Bob 接收并解密消息 ==========
    console.log('\n[步骤 5] Bob 接收消息...');

    // Bob 切换到聊天页面
    await bobPage.goto(`${BASE_URL}/#/chat`);
    await bobPage.waitForLoadState('domcontentloaded');
    await bobPage.waitForTimeout(2000);

    // 选择 Alice 的会话
    const aliceConversation = await bobPage.locator('.conversation:has-text("alice"), .conversation-item:has-text("alice"), .chat-list-item:has-text("alice")').first();
    if (await aliceConversation.isVisible()) {
      await aliceConversation.click();
      await bobPage.waitForTimeout(2000);
      console.log('  ✓ Bob 选择 Alice 的会话');
    }

    // 等待消息加载
    await bobPage.waitForTimeout(3000);

    // 验证消息在 Bob 的界面中显示（说明解密成功）
    const bobMessageLocator = await bobPage.locator('.message-list .message, .chat-message, .message-item').filter({ hasText: testMessage }).first();
    const bobMessageVisible = await bobMessageLocator.isVisible();
    
    if (bobMessageVisible) {
      console.log(`  ✓ Bob 收到并解密消息："${testMessage}"`);
      console.log('\n=== 测试通过：Signal 协议端到端加密功能正常 ===\n');
    } else {
      console.log('  ⚠ Bob 未收到消息，可能是 WebSocket 连接问题');
      console.log('\n=== 测试警告：消息未成功传递 ===\n');
    }

    // 最终断言
    expect(bobMessageVisible).toBe(true);
  });
});
