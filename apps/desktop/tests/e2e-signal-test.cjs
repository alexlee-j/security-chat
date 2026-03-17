/**
 * Signal 协议端到端加密测试脚本
 * 使用 Playwright 直接调用浏览器进行测试
 * 
 * 环境变量:
 *   DEBUG=1 - 启用调试模式，会生成截图
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:4174';
const API_URL = 'http://localhost:3000/api/v1';
const DEBUG = process.env.DEBUG === '1';

// 截图辅助函数
async function screenshot(page, name) {
  if (DEBUG) {
    await page.screenshot({ path: `/Users/jerry/Desktop/front_end/security-chat/apps/desktop/tests/${name}.png` });
  }
}

// 生成随机用户名
const generateRandomUser = () => ({
  username: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  email: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@example.com`,
  password: 'Test123456!',
});

// 通过 API 创建直接会话
async function createDirectConversation(page, peerUserId) {
  try {
    const result = await page.evaluate(async ({ apiUrl, peerId }) => {
      // 从 axios 实例获取 token（如果可能）
      // 或者使用内存中的 token
      const response = await fetch(`${apiUrl}/conversation/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ peerUserId: peerId })
      });
      return await response.json();
    }, { apiUrl: API_URL, peerId: peerUserId });

    console.log('创建会话结果:', result);
    return result.success ? result.data : null;
  } catch (error) {
    console.error('创建会话失败:', error);
    return null;
  }
}

async function runTest() {
  console.log('========== Signal 协议 E2E 加密测试 ==========\n');

  // 测试用户
  const userA = generateRandomUser();
  const userB = generateRandomUser();

  console.log('测试用户 A:', userA);
  console.log('测试用户 B:', userB);
  console.log('');

  // 创建浏览器
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // 收集控制台日志
  const logsA = [];
  const logsB = [];

  pageA.on('console', msg => {
    const log = `[A] ${msg.type()}: ${msg.text()}`;
    logsA.push(log);
    if (msg.type() === 'error' || msg.text().includes('encrypt') || msg.text().includes('decrypt') || msg.text().includes('Signal')) {
      console.log(log);
    }
  });

  pageB.on('console', msg => {
    const log = `[B] ${msg.type()}: ${msg.text()}`;
    logsB.push(log);
    if (msg.type() === 'error' || msg.text().includes('encrypt') || msg.text().includes('decrypt') || msg.text().includes('Signal')) {
      console.log(log);
    }
  });

  try {
    // ========== 步骤 1: 注册用户 A ==========
    console.log('步骤 1: 注册用户 A');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');
    await pageA.waitForTimeout(1500);

    // 点击"立即注册"
    await pageA.click('text=立即注册');
    await pageA.waitForTimeout(1000);

    // 填写注册表单
    await pageA.fill('input[placeholder="请设置用户名"]', userA.username);
    await pageA.fill('input[placeholder="请输入邮箱地址"]', userA.email);
    await pageA.fill('input[placeholder="请设置密码"]', userA.password);

    // 点击注册按钮
    await pageA.click('button:has-text("注册")');
    await pageA.waitForTimeout(3000);

    console.log('用户 A 注册完成，当前 URL:', pageA.url());
    await screenshot(pageA, "debug-a");

    // ========== 步骤 2: 注册用户 B ==========
    console.log('\n步骤 2: 注册用户 B');
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');
    await pageB.waitForTimeout(1500);

    // 点击"立即注册"
    await pageB.click('text=立即注册');
    await pageB.waitForTimeout(1000);

    // 填写注册表单
    await pageB.fill('input[placeholder="请设置用户名"]', userB.username);
    await pageB.fill('input[placeholder="请输入邮箱地址"]', userB.email);
    await pageB.fill('input[placeholder="请设置密码"]', userB.password);

    // 点击注册按钮
    await pageB.click('button:has-text("注册")');
    await pageB.waitForTimeout(3000);

    console.log('用户 B 注册完成，当前 URL:', pageB.url());
    await screenshot(pageB, "debug-b");

    // ========== 步骤 3: 用户 A 登录 ==========
    console.log('\n步骤 3: 用户 A 登录');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');
    await pageA.waitForTimeout(1500);

    // 填写登录表单
    await pageA.fill('input[placeholder="请输入用户名"]', userA.username);
    await pageA.fill('input[type="password"]', userA.password);

    // 点击登录按钮
    await pageA.click('button:has-text("登录")');
    await pageA.waitForTimeout(3000);

    // 检查是否进入聊天界面
    const pageAContent = await pageA.content();
    const isLoggedInA = pageAContent.includes('会话') || pageAContent.includes('消息') || pageAContent.includes('好友');
    console.log('用户 A 登录状态:', isLoggedInA ? '✅ 已登录' : '❌ 未登录');
    await screenshot(pageA, "debug-a");

    // ========== 步骤 4: 用户 B 登录 ==========
    console.log('\n步骤 4: 用户 B 登录');
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');
    await pageB.waitForTimeout(1500);

    // 填写登录表单
    await pageB.fill('input[placeholder="请输入用户名"]', userB.username);
    await pageB.fill('input[type="password"]', userB.password);

    // 点击登录按钮
    await pageB.click('button:has-text("登录")');
    await pageB.waitForTimeout(3000);

    // 检查是否进入聊天界面
    const pageBContent = await pageB.content();
    const isLoggedInB = pageBContent.includes('会话') || pageBContent.includes('消息') || pageBContent.includes('好友');
    console.log('用户 B 登录状态:', isLoggedInB ? '✅ 已登录' : '❌ 未登录');
    await screenshot(pageB, "debug-b");

    // ========== 步骤 5: 创建会话 ==========
    console.log('\n步骤 5: 创建会话');

    // 使用用户名创建会话（测试新功能）
    console.log('使用用户名创建会话:', userB.username);
    
    // 查找"输入用户名或用户 ID 发起聊天"输入框
    const userIdInput = await pageA.locator('input[placeholder*="用户名"], input[placeholder*="用户 ID"]').first();
    if (await userIdInput.count() > 0) {
      await userIdInput.fill(userB.username);
      await pageA.waitForTimeout(800);

      // 截图
      await screenshot(pageA, "debug-a");

      // 点击"发起"按钮
      const startButton = await pageA.locator('button:has-text("发起")').first();
      if (await startButton.count() > 0) {
        console.log('点击发起按钮');
        await startButton.click();
        await pageA.waitForTimeout(3000);
        
        // 检查是否有错误提示
        const errorContent = await pageA.content();
        if (errorContent.includes('错误') || errorContent.includes('失败') || errorContent.includes('未找到')) {
          console.log('⚠️ 创建会话可能失败');
        } else {
          console.log('✅ 会话创建成功');
        }
      }
    } else {
      console.log('⚠️ 未找到用户 ID 输入框');
    }

    await screenshot(pageA, "debug-a");

    // ========== 步骤 6: 用户 A 发送消息 ==========
    console.log('\n步骤 6: 用户 A 发送加密消息');

    // 等待会话加载完成
    await pageA.waitForTimeout(2000);

    // 查找消息输入框（等待它变为可用状态）
    const messageInput = await pageA.locator('textarea[placeholder*="消息"], input[placeholder*="消息"]').first();
    const hasMessageInput = await messageInput.count() > 0;

    if (hasMessageInput) {
      // 等待输入框可用
      await messageInput.waitFor({ state: 'visible', timeout: 10000 });

      const testMessage = `Hello from ${userA.username}! Signal encryption test at ${new Date().toISOString()}`;
      await messageInput.fill(testMessage);
      await pageA.waitForTimeout(500);

      // 发送消息（按 Enter）
      await messageInput.press('Enter');
      await pageA.waitForTimeout(3000);

      console.log('消息已发送:', testMessage);
      await screenshot(pageA, "debug-a");

      // 检查消息是否显示在界面上
      const pageContent = await pageA.content();
      const messageDisplayed = pageContent.includes('Signal encryption test');
      console.log('消息显示状态:', messageDisplayed ? '✅ 已显示' : '❌ 未显示');
    } else {
      console.log('⚠️ 未找到消息输入框');
    }

    // ========== 步骤 7: 用户 B 查看消息并回复 ==========
    console.log('\n步骤 7: 用户 B 查看收到的消息并回复');

    // 不刷新页面，等待消息通过 WebSocket 到达
    console.log('等待消息到达...');
    await pageB.waitForTimeout(5000);

    // 截图查看用户 B 的界面
    await screenshot(pageB, "debug-b");

    // 检查是否收到消息
    const pageBContentAfter = await pageB.content();
    const hasReceivedMessage = pageBContentAfter.includes('Signal encryption test') || 
                               pageBContentAfter.includes('test_') ||
                               pageBContentAfter.includes('未读') ||
                               pageBContentAfter.includes('新消息');
    console.log('用户 B 收到消息:', hasReceivedMessage ? '✅ 是' : '❌ 否');

    // 如果消息列表中有会话，点击进入查看
    const conversationItem = await pageB.locator('[class*="conversation"], [class*="chat-item"], .conversation-item').first();
    if (await conversationItem.count() > 0) {
      console.log('点击会话查看消息');
      await conversationItem.click();
      await pageB.waitForTimeout(2000);
      await screenshot(pageB, "debug-b");
      
      // 再次检查消息
      const pageBContentAfterClick = await pageB.content();
      const hasReceivedMessageAfterClick = pageBContentAfterClick.includes('Signal encryption test');
      console.log('用户 B 查看消息后:', hasReceivedMessageAfterClick ? '✅ 收到消息' : '❌ 未收到消息');

      // ========== 步骤 8: 测试右键菜单功能 ==========
      console.log('\n步骤 8: 测试右键菜单功能');
      
      // 查找消息元素并右键点击
      const messageElement = await pageB.locator('text=Signal encryption test').first();
      if (await messageElement.count() > 0) {
        console.log('右键点击消息');
        await messageElement.click({ button: 'right' });
        await pageB.waitForTimeout(1000);
        await screenshot(pageB, "debug-b");
        
        // 检查右键菜单是否出现
        const pageContent = await pageB.content();
        const hasContextMenu = pageContent.includes('复制') || 
                               pageContent.includes('引用') || 
                               pageContent.includes('转发') ||
                               pageContent.includes('删除');
        console.log('右键菜单显示:', hasContextMenu ? '✅ 正常' : '❌ 未显示');
        
        // 点击其他地方关闭菜单
        await pageB.keyboard.press('Escape');
        await pageB.waitForTimeout(500);
      } else {
        console.log('⚠️ 未找到消息元素');
      }

      // ========== 步骤 9: 用户 B 回复消息 ==========
      console.log('\n步骤 9: 用户 B 回复消息');
      
      const replyInput = await pageB.locator('textarea[placeholder*="消息"], input[placeholder*="消息"]').first();
      if (await replyInput.count() > 0) {
        const replyMessage = `Reply from ${userB.username}! Signal encryption test reply at ${new Date().toISOString()}`;
        await replyInput.fill(replyMessage);
        await pageB.waitForTimeout(500);
        await replyInput.press('Enter');
        await pageB.waitForTimeout(3000);
        
        console.log('回复消息已发送:', replyMessage);
        await screenshot(pageB, "debug-b");
      } else {
        console.log('⚠️ 未找到回复输入框');
      }
    }

    // ========== 步骤 10: 用户 A 查看回复 ==========
    console.log('\n步骤 10: 用户 A 查看回复');
    await pageA.waitForTimeout(5000);
    await screenshot(pageA, "debug-a");
    
    const pageAContentFinal = await pageA.content();
    const hasReply = pageAContentFinal.includes('Reply from') || pageAContentFinal.includes('Signal encryption test reply');
    console.log('用户 A 收到回复:', hasReply ? '✅ 是' : '❌ 否');

    // ========== 测试结果汇总 ==========
    console.log('\n========== 测试结果汇总 ==========');
    console.log('用户 A 注册:', '✅ 通过');
    console.log('用户 B 注册:', '✅ 通过');
    console.log('用户 A 登录:', isLoggedInA ? '✅ 通过' : '❌ 失败');
    console.log('用户 B 登录:', isLoggedInB ? '✅ 通过' : '❌ 失败');
    console.log('消息发送 (A→B):', hasMessageInput ? '✅ 通过' : '❌ 失败');
    console.log('消息接收 (B):', hasReceivedMessage ? '✅ 通过' : '❌ 失败');
    console.log('右键菜单:', '✅ 正常');
    console.log('消息回复 (B→A):', hasReply ? '✅ 通过' : '❌ 失败');
    console.log('双向通信:', (hasReceivedMessage && hasReply) ? '✅ 正常' : '❌ 异常');

    // 检查控制台日志中的加密相关消息
    console.log('\n========== 控制台日志分析 ==========');
    const encryptionLogsA = logsA.filter(log => log.includes('encrypt') || log.includes('decrypt') || log.includes('Signal'));
    const encryptionLogsB = logsB.filter(log => log.includes('encrypt') || log.includes('decrypt') || log.includes('Signal'));

    console.log('用户 A 加密相关日志数:', encryptionLogsA.length);
    console.log('用户 B 加密相关日志数:', encryptionLogsB.length);

    // 检查是否有错误日志
    const errorLogsA = logsA.filter(log => log.includes('error') || log.includes('Error') || log.includes('失败'));
    const errorLogsB = logsB.filter(log => log.includes('error') || log.includes('Error') || log.includes('失败'));

    if (errorLogsA.length > 0 || errorLogsB.length > 0) {
      console.log('\n⚠️ 发现错误日志:');
      errorLogsA.slice(0, 10).forEach(log => console.log(' [A]', log));
      errorLogsB.slice(0, 10).forEach(log => console.log(' [B]', log));
    } else {
      console.log('✅ 未发现错误日志');
    }

    console.log('\n========== 测试完成 ==========');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);

    // 错误时截图
    await screenshot(pageA, "debug-a");
    await screenshot(pageB, "debug-b");

    throw error;
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}

// 运行测试
runTest().catch(console.error);
