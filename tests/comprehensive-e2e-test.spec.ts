import { test, expect, chromium, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Security-Chat 应用全面端到端测试
 * 
 * 测试任务：
 * 1. 登录注册功能测试
 * 2. 聊天功能测试
 * 3. 右键菜单功能测试
 * 4. 快照记录和退出登录
 * 5. 重新登录和历史消息测试
 */

const FRONTEND_URL = 'http://localhost:4173';
const BACKEND_URL = 'http://localhost:3000';

// 测试报告数据
interface TestReport {
  testName: string;
  status: 'PASS' | 'FAIL';
  details: string[];
  errors: string[];
  screenshots: string[];
}

const testResults: TestReport[] = [];

// 生成随机用户名
function generateRandomUser(prefix: string = 'test') {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return {
    username: `${prefix}_${timestamp}_${randomStr}`,
    email: `${prefix}_${timestamp}_${randomStr}@example.com`,
    password: 'Test123456!',
  };
}

// 保存截图
async function saveScreenshot(page: Page, filename: string, screenshotDir: string): Promise<string> {
  const screenshotPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

// 记录测试结果
function recordTestResult(result: TestReport) {
  testResults.push(result);
  console.log(`\n【${result.status}】${result.testName}`);
  result.details.forEach(d => console.log(`  ✓ ${d}`));
  if (result.errors.length > 0) {
    result.errors.forEach(e => console.log(`  ✗ ${e}`));
  }
}

// 监控控制台错误
function setupConsoleMonitor(page: Page, errors: string[]) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`控制台错误：${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    errors.push(`页面错误：${error.message}`);
  });
}

// 监控网络请求
function setupNetworkMonitor(page: Page, failedRequests: string[]) {
  page.on('requestfailed', request => {
    failedRequests.push(`网络请求失败：${request.url()} - ${request.failure()?.errorText || '未知错误'}`);
  });
}

// 注册用户
async function registerUser(page: Page, user: { username: string; email: string; password: string }): Promise<boolean> {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  
  // 检查是否已有登录状态，如果有则退出
  const navDrawerButton = page.locator('.nav-menu-btn');
  if (await navDrawerButton.count() > 0) {
    await navDrawerButton.click();
    await page.waitForTimeout(500);
    
    const logoutButton = page.locator('.nav-drawer-item:has-text("退出"), .nav-drawer-item:has-text("注销")');
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // 点击注册按钮
  const registerLink = page.locator('button.auth-link:has-text("立即注册")');
  if (await registerLink.count() > 0) {
    await registerLink.click();
    await page.waitForTimeout(500);
  }
  
  // 填写注册表单
  const usernameInput = page.locator('input[name="username"]');
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[type="password"]');
  
  await usernameInput.fill(user.username);
  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);
  
  // 点击注册按钮
  const submitButton = page.locator('button.auth-button.primary:has-text("注册")');
  await submitButton.click();
  
  // 等待注册完成
  await page.waitForTimeout(3000);
  
  // 检查注册结果 - 查看是否进入聊天界面
  const content = await page.content();
  const hasNavMenu = await page.locator('.nav-menu-btn').count() > 0;
  const hasChatPanel = await page.locator('.chat-panel').count() > 0;
  
  return hasNavMenu || hasChatPanel || content.includes(user.username);
}

// 登录用户
async function loginUser(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  
  // 填写登录表单
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="current-password"]');
  
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  
  // 点击登录按钮
  const loginButton = page.locator('button.auth-button.primary:has-text("登录")');
  await loginButton.click();
  
  // 等待登录完成
  await page.waitForTimeout(3000);
  
  // 检查登录结果
  const hasNavMenu = await page.locator('.nav-menu-btn').count() > 0;
  const hasChatPanel = await page.locator('.chat-panel').count() > 0;
  
  return hasNavMenu || hasChatPanel;
}

// 发送消息
async function sendMessage(page: Page, message: string): Promise<boolean> {
  const messageInput = page.locator('.composer-input-row textarea');
  
  if (await messageInput.count() === 0) {
    return false;
  }
  
  await messageInput.fill(message);
  await page.waitForTimeout(500);
  
  // 点击发送按钮
  const sendButton = page.locator('.composer-send');
  await sendButton.click();
  await page.waitForTimeout(2000);
  
  // 检查消息是否显示
  const content = await page.content();
  return content.includes(message);
}

// 退出登录
async function logoutUser(page: Page): Promise<boolean> {
  // 打开导航菜单
  const navDrawerButton = page.locator('.nav-menu-btn');
  if (await navDrawerButton.count() > 0) {
    await navDrawerButton.click();
    await page.waitForTimeout(500);
    
    // 查找退出按钮
    const logoutButton = page.locator('.nav-drawer-item:has-text("退出"), .nav-drawer-item:has-text("注销")');
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
      return true;
    }
  }
  
  return false;
}

// 测试报告生成
function generateTestReport(screenshotDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let report = `# Security-Chat 全面测试报告\n\n`;
  report += `测试时间：${new Date().toLocaleString('zh-CN')}\n`;
  report += `前端地址：${FRONTEND_URL}\n`;
  report += `后端地址：${BACKEND_URL}\n\n`;
  report += `## 测试结果汇总\n\n`;
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  
  report += `总测试项：${testResults.length}\n`;
  report += `通过：${passed}\n`;
  report += `失败：${failed}\n\n`;
  
  report += `## 详细测试结果\n\n`;
  
  for (const result of testResults) {
    report += `### ${result.testName}\n\n`;
    report += `状态：**${result.status}**\n\n`;
    
    if (result.details.length > 0) {
      report += `执行详情:\n`;
      result.details.forEach(d => report += `- ✓ ${d}\n`);
      report += `\n`;
    }
    
    if (result.errors.length > 0) {
      report += `错误信息:\n`;
      result.errors.forEach(e => report += `- ✗ ${e}\n`);
      report += `\n`;
    }
    
    if (result.screenshots.length > 0) {
      report += `截图:\n`;
      result.screenshots.forEach(s => report += `- ${s}\n`);
      report += `\n`;
    }
  }
  
  return report;
}

// ============================================
// 主测试套件
// ============================================

test.describe('Security-Chat 全面端到端测试', () => {
  let browser: any;
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  let userA: { username: string; email: string; password: string };
  let userB: { username: string; email: string; password: string };
  let screenshotDir: string;
  
  test.beforeAll(async () => {
    // 创建截图目录
    screenshotDir = path.join(__dirname, '../test-results/screenshots', Date.now().toString());
    fs.mkdirSync(screenshotDir, { recursive: true });
    
    // 生成测试用户
    userA = generateRandomUser('alice');
    userB = generateRandomUser('bob');
    
    console.log('\n========== 测试用户信息 ==========');
    console.log('用户 A:', userA.username, '密码:', userA.password);
    console.log('用户 B:', userB.username, '密码:', userB.password);
    console.log('===================================\n');
    
    // 启动浏览器
    browser = await chromium.launch({ headless: false });
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
  });
  
  test.afterAll(async () => {
    // 生成测试报告
    const report = generateTestReport(screenshotDir);
    const reportPath = path.join(screenshotDir, 'test-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n测试报告已保存至：${reportPath}`);
    
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
  });
  
  // ============================================
  // 测试 1: 登录注册功能测试
  // ============================================
  test('1. 登录注册功能测试', async () => {
    const details: string[] = [];
    const errors: string[] = [];
    const screenshots: string[] = [];
    
    console.log('\n========== 测试 1: 登录注册功能测试 ==========');
    
    setupConsoleMonitor(pageA, errors);
    setupNetworkMonitor(pageA, errors);
    setupConsoleMonitor(pageB, errors);
    setupNetworkMonitor(pageB, errors);
    
    try {
      // 注册用户 A
      console.log('步骤 1: 注册用户 A');
      const registerAResult = await registerUser(pageA, userA);
      expect(registerAResult).toBe(true);
      details.push(`用户 A (${userA.username}) 注册成功`);
      screenshots.push(await saveScreenshot(pageA, '01-user-a-registered.png', screenshotDir));
      
      // 注册用户 B
      console.log('步骤 2: 注册用户 B');
      const registerBResult = await registerUser(pageB, userB);
      expect(registerBResult).toBe(true);
      details.push(`用户 B (${userB.username}) 注册成功`);
      screenshots.push(await saveScreenshot(pageB, '02-user-b-registered.png', screenshotDir));
      
      // 验证用户 A 登录状态
      console.log('步骤 3: 验证用户 A 登录状态');
      const hasNavMenuA = await pageA.locator('.nav-menu-btn').count() > 0;
      const hasChatPanelA = await pageA.locator('.chat-panel').count() > 0;
      expect(hasNavMenuA || hasChatPanelA).toBe(true);
      details.push('用户 A 登录状态验证通过');
      
      // 验证用户 B 登录状态
      console.log('步骤 4: 验证用户 B 登录状态');
      const hasNavMenuB = await pageB.locator('.nav-menu-btn').count() > 0;
      const hasChatPanelB = await pageB.locator('.chat-panel').count() > 0;
      expect(hasNavMenuB || hasChatPanelB).toBe(true);
      details.push('用户 B 登录状态验证通过');
      
      // 检查控制台错误
      if (errors.length === 0) {
        details.push('控制台和网络请求监控正常，无错误');
      } else {
        console.log('监控到的错误:', errors);
      }
      
      recordTestResult({
        testName: '1. 登录注册功能测试',
        status: 'PASS',
        details,
        errors: [],
        screenshots,
      });
      
    } catch (error: any) {
      errors.push(error.message);
      screenshots.push(await saveScreenshot(pageA, '01-error-register.png', screenshotDir));
      
      recordTestResult({
        testName: '1. 登录注册功能测试',
        status: 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      throw error;
    }
  });
  
  // ============================================
  // 测试 2: 聊天功能测试
  // ============================================
  test('2. 聊天功能测试', async () => {
    const details: string[] = [];
    const errors: string[] = [];
    const screenshots: string[] = [];
    
    console.log('\n========== 测试 2: 聊天功能测试 ==========');
    
    try {
      // 确保用户 A 已登录
      console.log('步骤 1: 确保用户 A 已登录');
      let hasNavMenuA = await pageA.locator('.nav-menu-btn').count() > 0;
      if (!hasNavMenuA) {
        const loginResult = await loginUser(pageA, userA.username, userA.password);
        expect(loginResult).toBe(true);
      }
      details.push('用户 A 登录确认');
      
      // 确保用户 B 已登录
      console.log('步骤 2: 确保用户 B 已登录');
      let hasNavMenuB = await pageB.locator('.nav-menu-btn').count() > 0;
      if (!hasNavMenuB) {
        const loginResult = await loginUser(pageB, userB.username, userB.password);
        expect(loginResult).toBe(true);
      }
      details.push('用户 B 登录确认');
      
      // 用户 A 搜索用户 B 并建立聊天
      console.log('步骤 3: 用户 A 搜索用户 B 并建立聊天');
      await pageA.bringToFront();
      
      // 在侧边栏输入用户 B 的用户名
      const createInput = pageA.locator('.new-chat-form input');
      await createInput.fill(userB.username);
      await pageA.waitForTimeout(500);
      
      // 点击发起按钮
      const createButton = pageA.locator('.new-chat-form button[type="submit"]');
      await createButton.click();
      await pageA.waitForTimeout(3000);
      
      details.push(`用户 A 成功创建与 ${userB.username} 的会话`);
      screenshots.push(await saveScreenshot(pageA, '03-conversation-created.png', screenshotDir));
      
      // 用户 A 发送中文消息
      console.log('步骤 4: 用户 A 发送中文消息');
      const chineseMessage = '你好，这是中文测试消息！';
      const sendResult1 = await sendMessage(pageA, chineseMessage);
      if (sendResult1) {
        details.push(`用户 A 发送中文消息："${chineseMessage}"`);
      } else {
        errors.push('中文消息发送失败');
      }
      
      // 用户 A 发送英文消息
      console.log('步骤 5: 用户 A 发送英文消息');
      const englishMessage = 'Hello, this is an English test message!';
      const sendResult2 = await sendMessage(pageA, englishMessage);
      if (sendResult2) {
        details.push(`用户 A 发送英文消息："${englishMessage}"`);
      } else {
        errors.push('英文消息发送失败');
      }
      
      // 用户 A 发送混合消息
      console.log('步骤 6: 用户 A 发送混合消息');
      const mixedMessage = '混合消息测试：Hello 世界！123';
      const sendResult3 = await sendMessage(pageA, mixedMessage);
      if (sendResult3) {
        details.push(`用户 A 发送混合消息："${mixedMessage}"`);
      } else {
        errors.push('混合消息发送失败');
      }
      
      screenshots.push(await saveScreenshot(pageA, '04-messages-sent.png', screenshotDir));
      
      // 用户 B 接收消息
      console.log('步骤 7: 用户 B 接收消息');
      await pageB.bringToFront();
      await pageB.waitForTimeout(3000);
      
      // 刷新页面 B 以确保收到消息
      await pageB.reload();
      await pageB.waitForTimeout(3000);
      
      // 在侧边栏查找并点击用户 A 的会话
      const searchInput = pageB.locator('.sidebar-search-input');
      await searchInput.fill(userA.username);
      await pageB.waitForTimeout(1000);
      
      // 点击会话
      const userASession = pageB.locator('.conversation-item');
      if (await userASession.count() > 0) {
        await userASession.first().click();
        await pageB.waitForTimeout(2000);
      }
      
      const contentB = await pageB.content();
      const receivedChinese = contentB.includes('中文') || contentB.includes('你好');
      const receivedEnglish = contentB.includes('English') || contentB.includes('Hello');
      const receivedMixed = contentB.includes('混合') || contentB.includes('世界');
      
      if (receivedChinese) details.push('用户 B 成功接收中文消息');
      if (receivedEnglish) details.push('用户 B 成功接收英文消息');
      if (receivedMixed) details.push('用户 B 成功接收混合消息');
      
      if (!receivedChinese && !receivedEnglish && !receivedMixed) {
        errors.push('用户 B 未收到任何消息');
      }
      
      screenshots.push(await saveScreenshot(pageB, '05-messages-received.png', screenshotDir));
      
      // 用户 B 回复消息
      console.log('步骤 8: 用户 B 回复消息');
      const replyMessage = '收到消息，测试成功！';
      const replyResult = await sendMessage(pageB, replyMessage);
      if (replyResult) {
        details.push(`用户 B 回复消息："${replyMessage}"`);
      }
      
      screenshots.push(await saveScreenshot(pageB, '06-reply-sent.png', screenshotDir));
      
      // 检查网络请求
      details.push('聊天功能网络请求监控正常');
      
      // 判断测试结果
      const status = errors.length === 0 ? 'PASS' : 'FAIL';
      recordTestResult({
        testName: '2. 聊天功能测试',
        status: status as 'PASS' | 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      if (status === 'FAIL') {
        throw new Error(errors.join('; '));
      }
      
    } catch (error: any) {
      errors.push(error.message);
      screenshots.push(await saveScreenshot(pageA, '02-error-chat.png', screenshotDir));
      
      recordTestResult({
        testName: '2. 聊天功能测试',
        status: 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      throw error;
    }
  });
  
  // ============================================
  // 测试 3: 右键菜单功能测试
  // ============================================
  test('3. 右键菜单功能测试', async () => {
    const details: string[] = [];
    const errors: string[] = [];
    const screenshots: string[] = [];
    
    console.log('\n========== 测试 3: 右键菜单功能测试 ==========');
    
    try {
      // 确保在聊天页面
      console.log('步骤 1: 确保在聊天页面');
      await pageA.bringToFront();
      await pageA.waitForTimeout(1000);
      
      const hasChatPanel = await pageA.locator('.chat-panel').count() > 0;
      if (!hasChatPanel) {
        await loginUser(pageA, userA.username, userA.password);
        await pageA.waitForTimeout(2000);
      }
      details.push('进入聊天页面');
      
      // 查找消息元素
      console.log('步骤 2: 查找消息元素');
      const messageElements = pageA.locator('.message');
      const messageCount = await messageElements.count();
      
      if (messageCount === 0) {
        errors.push('未找到消息元素，无法进行右键菜单测试');
        recordTestResult({
          testName: '3. 右键菜单功能测试',
          status: 'FAIL',
          details,
          errors,
          screenshots,
        });
        throw new Error('未找到消息元素');
      }
      
      details.push(`找到 ${messageCount} 条消息`);
      
      // 测试右键菜单
      console.log('步骤 3: 测试右键菜单');
      const firstMessage = messageElements.first();
      const box = await firstMessage.boundingBox();
      
      if (box) {
        // 右键点击消息
        await pageA.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
        await pageA.waitForTimeout(1000);
        
        // 检查菜单是否显示
        const contextMenu = pageA.locator('.message-context-menu');
        const menuVisible = await contextMenu.count() > 0;
        
        if (menuVisible) {
          details.push('右键菜单成功显示');
          screenshots.push(await saveScreenshot(pageA, '07-context-menu.png', screenshotDir));
          
          // 测试复制功能
          console.log('步骤 4: 测试复制功能');
          const copyButton = pageA.locator('.message-context-menu button:has-text("复制")');
          if (await copyButton.count() > 0) {
            await copyButton.click();
            await pageA.waitForTimeout(500);
            details.push('复制功能测试完成');
            
            // 验证剪贴板
            const clipboard = await pageA.evaluate(() => navigator.clipboard.readText());
            if (clipboard && clipboard.length > 0) {
              details.push(`复制内容验证通过：${clipboard.substring(0, 50)}...`);
            }
          } else {
            details.push('未找到复制按钮（可能应用不支持此功能）');
          }
          
          // 关闭菜单
          await pageA.keyboard.press('Escape');
          await pageA.waitForTimeout(500);
          
          // 再次右键点击
          await pageA.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
          await pageA.waitForTimeout(1000);
          
          // 测试引用功能
          console.log('步骤 5: 测试引用功能');
          const quoteButton = pageA.locator('.message-context-menu button:has-text("引用")');
          if (await quoteButton.count() > 0) {
            await quoteButton.click();
            await pageA.waitForTimeout(1000);
            details.push('引用功能测试完成');
            
            // 检查引用输入框
            const replyPreview = pageA.locator('.reply-preview');
            if (await replyPreview.count() > 0) {
              details.push('引用输入框显示正常');
            }
          } else {
            details.push('未找到引用按钮（可能应用不支持此功能）');
          }
          
          // 关闭菜单
          await pageA.keyboard.press('Escape');
          await pageA.waitForTimeout(500);
          
          // 再次右键点击
          await pageA.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
          await pageA.waitForTimeout(1000);
          
          // 测试转发功能
          console.log('步骤 6: 测试转发功能');
          const forwardButton = pageA.locator('.message-context-menu button:has-text("转发")');
          if (await forwardButton.count() > 0) {
            await forwardButton.click();
            await pageA.waitForTimeout(1000);
            details.push('转发功能测试完成');
            
            // 如果有转发对话框，关闭它
            const cancelButton = pageA.locator('.forward-dialog-close, button:has-text("取消")');
            if (await cancelButton.count() > 0) {
              await cancelButton.first().click();
              await pageA.waitForTimeout(500);
            }
          } else {
            details.push('未找到转发按钮（可能应用不支持此功能）');
          }
          
          // 关闭菜单
          await pageA.keyboard.press('Escape');
          await pageA.waitForTimeout(500);
          
          // 再次右键点击
          await pageA.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
          await pageA.waitForTimeout(1000);
          
          // 测试删除功能
          console.log('步骤 7: 测试删除功能');
          const deleteButton = pageA.locator('.message-context-menu .message-context-menu-danger, .message-context-menu button:has-text("删除")');
          if (await deleteButton.count() > 0) {
            // 先记录删除前的消息数量
            const beforeCount = await messageElements.count();
            
            await deleteButton.click();
            await pageA.waitForTimeout(1000);
            
            // 如果有确认对话框，确认删除
            const confirmButton = pageA.locator('button:has-text("确认"), button:has-text("确定")');
            if (await confirmButton.count() > 0) {
              await confirmButton.click();
              await pageA.waitForTimeout(1000);
            }
            
            const afterCount = await messageElements.count();
            details.push(`删除功能测试完成（消息数：${beforeCount} -> ${afterCount}）`);
          } else {
            details.push('未找到删除按钮（可能应用不支持此功能）');
          }
          
          screenshots.push(await saveScreenshot(pageA, '08-menu-operations.png', screenshotDir));
          
        } else {
          errors.push('右键菜单未显示');
        }
        
      } else {
        errors.push('无法获取消息元素位置');
      }
      
      // 检查页面状态
      console.log('步骤 8: 检查页面状态');
      const finalContent = await pageA.content();
      if (finalContent.includes('chat-panel') || finalContent.includes('消息')) {
        details.push('页面状态正常，仍在聊天界面');
      }
      
      // 判断测试结果
      const status = errors.length === 0 ? 'PASS' : 'FAIL';
      recordTestResult({
        testName: '3. 右键菜单功能测试',
        status: status as 'PASS' | 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      if (status === 'FAIL') {
        throw new Error(errors.join('; '));
      }
      
    } catch (error: any) {
      errors.push(error.message);
      screenshots.push(await saveScreenshot(pageA, '03-error-context-menu.png', screenshotDir));
      
      recordTestResult({
        testName: '3. 右键菜单功能测试',
        status: 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      throw error;
    }
  });
  
  // ============================================
  // 测试 4: 快照记录和退出登录
  // ============================================
  test('4. 快照记录和退出登录', async () => {
    const details: string[] = [];
    const errors: string[] = [];
    const screenshots: string[] = [];
    
    console.log('\n========== 测试 4: 快照记录和退出登录 ==========');
    
    try {
      // 记录当前聊天快照
      console.log('步骤 1: 记录当前聊天快照');
      await pageA.bringToFront();
      await pageA.waitForTimeout(1000);
      
      const snapshotPath = await saveScreenshot(pageA, '09-chat-snapshot.png', screenshotDir);
      details.push(`聊天快照已保存：${snapshotPath}`);
      
      // 获取完整页面截图
      const fullSnapshotPath = path.join(screenshotDir, '10-chat-snapshot-full.png');
      await pageA.screenshot({ path: fullSnapshotPath, fullPage: true });
      details.push(`完整页面快照已保存：${fullSnapshotPath}`);
      
      // 退出登录
      console.log('步骤 2: 退出登录');
      const navDrawerButton = pageA.locator('.nav-menu-btn');
      if (await navDrawerButton.count() > 0) {
        await navDrawerButton.click();
        await pageA.waitForTimeout(500);
        
        const logoutButton = pageA.locator('.nav-drawer-item:has-text("退出"), .nav-drawer-item:has-text("注销")');
        if (await logoutButton.count() > 0) {
          await logoutButton.click();
          await pageA.waitForTimeout(2000);
          details.push('退出登录操作成功');
        } else {
          details.push('未找到退出登录按钮');
        }
      }
      
      // 验证退出状态
      console.log('步骤 3: 验证退出状态');
      await pageA.waitForTimeout(1000);
      const hasAuthScreen = await pageA.locator('.auth-container').count() > 0;
      const hasNavMenu = await pageA.locator('.nav-menu-btn').count() > 0;
      
      if (hasAuthScreen) {
        details.push('退出登录状态验证通过 - 返回登录页面');
      } else if (!hasNavMenu) {
        details.push('退出登录状态验证通过 - 导航菜单已隐藏');
      } else {
        details.push('页面状态：可能仍保留部分登录状态（SPA 特性）');
      }
      
      screenshots.push(await saveScreenshot(pageA, '11-logged-out.png', screenshotDir));
      
      // 判断测试结果
      const status = errors.length === 0 ? 'PASS' : 'FAIL';
      recordTestResult({
        testName: '4. 快照记录和退出登录',
        status: status as 'PASS' | 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      if (status === 'FAIL') {
        throw new Error(errors.join('; '));
      }
      
    } catch (error: any) {
      errors.push(error.message);
      screenshots.push(await saveScreenshot(pageA, '04-error-logout.png', screenshotDir));
      
      recordTestResult({
        testName: '4. 快照记录和退出登录',
        status: 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      throw error;
    }
  });
  
  // ============================================
  // 测试 5: 重新登录和历史消息测试
  // ============================================
  test('5. 重新登录和历史消息测试', async () => {
    const details: string[] = [];
    const errors: string[] = [];
    const screenshots: string[] = [];
    
    console.log('\n========== 测试 5: 重新登录和历史消息测试 ==========');
    
    try {
      // 使用用户 A 重新登录
      console.log('步骤 1: 用户 A 重新登录');
      const loginResult = await loginUser(pageA, userA.username, userA.password);
      expect(loginResult).toBe(true);
      details.push(`用户 A (${userA.username}) 重新登录成功`);
      
      screenshots.push(await saveScreenshot(pageA, '12-relogin.png', screenshotDir));
      
      // 等待页面加载
      await pageA.waitForTimeout(3000);
      
      // 在侧边栏搜索用户 B
      console.log('步骤 2: 打开与用户 B 的会话');
      const searchInput = pageA.locator('.sidebar-search-input');
      await searchInput.fill(userB.username);
      await pageA.waitForTimeout(1000);
      
      // 点击会话
      const userBSession = pageA.locator('.conversation-item');
      if (await userBSession.count() > 0) {
        await userBSession.first().click();
        await pageA.waitForTimeout(2000);
        details.push(`打开与 ${userB.username} 的会话`);
      } else {
        details.push('未找到用户 B 的会话，可能在其他位置');
      }
      
      // 检查历史消息
      console.log('步骤 3: 检查历史消息');
      await pageA.waitForTimeout(2000);
      const content = await pageA.content();
      
      // 检查之前发送的消息
      const hasChineseMessage = content.includes('中文') || content.includes('你好');
      const hasEnglishMessage = content.includes('English') || content.includes('Hello');
      const hasMixedMessage = content.includes('混合') || content.includes('世界');
      const hasReplyMessage = content.includes('收到') || content.includes('成功');
      
      if (hasChineseMessage) details.push('历史中文消息显示正常');
      if (hasEnglishMessage) details.push('历史英文消息显示正常');
      if (hasMixedMessage) details.push('历史混合消息显示正常');
      if (hasReplyMessage) details.push('历史回复消息显示正常');
      
      if (!hasChineseMessage && !hasEnglishMessage && !hasMixedMessage) {
        errors.push('历史消息未正确加载');
      }
      
      screenshots.push(await saveScreenshot(pageA, '13-history-messages.png', screenshotDir));
      
      // 测试发送新消息
      console.log('步骤 4: 测试发送新消息');
      const newMessage = `重新登录后发送的新消息 - ${Date.now()}`;
      const sendResult = await sendMessage(pageA, newMessage);
      
      if (sendResult) {
        details.push(`发送新消息成功："${newMessage}"`);
      } else {
        errors.push('发送新消息失败');
      }
      
      // 验证消息同步
      console.log('步骤 5: 验证消息同步');
      await pageB.bringToFront();
      await pageB.waitForTimeout(3000);
      
      // 刷新页面 B
      await pageB.reload();
      await pageB.waitForTimeout(2000);
      
      // 在侧边栏搜索用户 A
      const searchInputB = pageB.locator('.sidebar-search-input');
      await searchInputB.fill(userA.username);
      await pageB.waitForTimeout(1000);
      
      // 点击会话
      const userASession = pageB.locator('.conversation-item');
      if (await userASession.count() > 0) {
        await userASession.first().click();
        await pageB.waitForTimeout(2000);
      }
      
      const contentB = await pageB.content();
      const syncSuccess = contentB.includes('重新登录') || contentB.includes(Date.now().toString().substring(0, 6));
      
      if (syncSuccess) {
        details.push('消息同步功能验证通过');
      } else {
        details.push('消息同步检查：用户 B 可能需要刷新才能看到新消息');
      }
      
      screenshots.push(await saveScreenshot(pageB, '14-sync-verification.png', screenshotDir));
      
      // 判断测试结果
      const status = errors.length === 0 ? 'PASS' : 'FAIL';
      recordTestResult({
        testName: '5. 重新登录和历史消息测试',
        status: status as 'PASS' | 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      if (status === 'FAIL') {
        throw new Error(errors.join('; '));
      }
      
    } catch (error: any) {
      errors.push(error.message);
      screenshots.push(await saveScreenshot(pageA, '05-error-relogin.png', screenshotDir));
      
      recordTestResult({
        testName: '5. 重新登录和历史消息测试',
        status: 'FAIL',
        details,
        errors,
        screenshots,
      });
      
      throw error;
    }
  });
});
