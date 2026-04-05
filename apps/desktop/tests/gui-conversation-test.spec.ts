import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

test('GUI-CONV-01: 创建单聊会话', async () => {
  const userA = {
    username: `test_a_${Date.now()}`,
    email: `test_a_${Date.now()}@example.com`,
    password: 'Test123456!',
  };

  const browser = await chromium.launch({ headless: false });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // ========== 用户 A 注册并登录 ==========
    console.log('用户A注册...');
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');
    await pageA.click('text=立即注册');
    await pageA.waitForTimeout(500);
    await pageA.fill('input[name="username"]', userA.username);
    await pageA.fill('input[name="email"]', userA.email);
    await pageA.fill('input[name="new-password"]', userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForFunction(() => document.body.textContent?.includes('会话'), { timeout: 15000 });
    console.log('用户A注册成功');

    // ========== 用户 B 注册（用于获取 userId） ==========
    console.log('用户B注册...');
    const userB = {
      username: `test_b_${Date.now()}`,
      email: `test_b_${Date.now()}@example.com`,
      password: 'Test123456!',
    };
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');
    await pageB.click('text=立即注册');
    await pageB.waitForTimeout(500);
    await pageB.fill('input[name="username"]', userB.username);
    await pageB.fill('input[name="email"]', userB.email);
    await pageB.fill('input[name="new-password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForFunction(() => document.body.textContent?.includes('会话'), { timeout: 15000 });
    console.log('用户B注册成功');

    // 从 URL 或页面获取用户B的 userId（如果有的话）
    // 由于无法直接获取，我们使用直接 API 调用来创建会话
    // 但更好的方式是：直接通过搜索用户名来创建

    // ========== 用户 A 创建会话（使用精确的用户名） ==========
    console.log('用户A创建会话...');

    // 截图查看当前状态
    await pageA.screenshot({ path: '/tmp/conv-01-a-before.png' });

    // 查找创建会话按钮
    const createBtn = pageA.locator('button').filter({ hasText: /创建|新会话|添加/ }).first();
    if (await createBtn.count() > 0) {
      console.log('点击创建按钮');
      await createBtn.click();
      await pageA.waitForTimeout(500);
    }

    await pageA.screenshot({ path: '/tmp/conv-01-a-after-create.png' });

    // 诊断：列出页面上所有的 input placeholder
    const allInputs = await pageA.locator('input').all();
    console.log('页面上 input 数量:', allInputs.length);
    for (let i = 0; i < allInputs.length; i++) {
      const placeholder = await allInputs[i].getAttribute('placeholder');
      const value = await allInputs[i].inputValue();
      console.log(`input[${i}] placeholder: "${placeholder}", value: "${value}"`);
    }

    // 查找输入框 - 使用 placeholder 属性来定位正确的输入框
    // 关键：输入用户B的完整用户名
    const input = pageA.locator('input[placeholder*="发起聊天"], input[placeholder*="用户 ID"]').first();
    if (await input.count() > 0) {
      console.log('输入用户名B (完整):', userB.username);
      await input.click();
      await input.fill(userB.username);
      await pageA.waitForTimeout(1000);
    }

    await pageA.screenshot({ path: '/tmp/conv-01-a-filled.png' });

    // 再次检查输入框的值
    if (await input.count() > 0) {
      const inputValue = await input.inputValue();
      console.log('输入后 input 的值:', inputValue);
    }

    // 查找发起按钮
    const confirmBtn = pageA.locator('button[type="submit"]').first();
    if (await confirmBtn.count() > 0) {
      const isDisabled = await confirmBtn.isDisabled();
      console.log('发起按钮 disabled 状态:', isDisabled);
      if (!isDisabled) {
        console.log('点击发起');
        await confirmBtn.click();
        await pageA.waitForTimeout(3000);
      } else {
        console.log('⚠️ 发起按钮被禁用，可能是因为 peerUserId 为空');
      }
    }

    await pageA.screenshot({ path: '/tmp/conv-01-a-after-confirm.png' });

    // 检查是否有错误消息
    const errorMsg = await pageA.evaluate(() => {
      const errors = document.querySelectorAll('[class*="error"], [class*=" Error"]');
      return Array.from(errors).map(el => el.textContent);
    });
    console.log('错误消息:', errorMsg);

    // 检查会话列表内容
    const conversationList = await pageA.evaluate(() => {
      const items = document.querySelectorAll('[class*="conversation-item"], [class*="session-item"], [class*="conversation"]');
      return Array.from(items).map(el => ({
        text: el.textContent?.substring(0, 100),
        className: el.className
      }));
    });
    console.log('会话列表项数量:', conversationList.length);
    console.log('会话列表:', JSON.stringify(conversationList, null, 2));

    // 尝试点击新创建的会话项
    console.log('尝试点击会话项...');
    const conversationItem = pageA.locator(`text=${userB.username}`).first();
    if (await conversationItem.count() > 0) {
      console.log('找到会话项，点击它');
      await conversationItem.click();
      await pageA.waitForTimeout(1000);
    } else {
      console.log('未找到会话项，尝试点击第一个会话项');
      const firstItem = pageA.locator('[class*="conversation-item"], [class*="session-item"]').first();
      if (await firstItem.count() > 0) {
        await firstItem.click();
        await pageA.waitForTimeout(1000);
      }
    }

    await pageA.screenshot({ path: '/tmp/conv-01-after-click-item.png' });

    // ========== 检查消息输入框状态 ==========
    console.log('检查消息输入框...');

    // 等待更长时间让状态同步
    await pageA.waitForTimeout(2000);

    // 检查输入框是否可用
    const textarea = pageA.locator('.composer textarea').first();
    if (await textarea.count() > 0) {
      const isDisabled = await textarea.isDisabled();
      console.log('textarea disabled 状态:', isDisabled);
      if (!isDisabled) {
        console.log('✅ 会话创建成功，输入框可用');
      } else {
        console.log('⚠️ 输入框仍被禁用');
      }
    }

    console.log('✅ GUI-CONV-01 测试完成');

  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    await pageA.screenshot({ path: '/tmp/conv-01-error-a.png' });
    await pageB.screenshot({ path: '/tmp/conv-01-error-b.png' });
    throw error;
  } finally {
    await browser.close();
  }
});
