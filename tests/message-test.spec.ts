import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';
const BACKEND_URL = 'http://localhost:3000/api/v1';

test('测试消息发送和接收功能', async ({ page, context }) => {
  // 登录Alice用户
  await page.goto(BASE_URL);
  await page.fill('input[placeholder="请输入用户名"]', 'alice');
  await page.fill('input[placeholder="请输入密码"]', 'Password123');
  await page.click('button:has-text("登录")');
  
  // 等待登录完成
  await page.waitForLoadState('networkidle');
  
  // 选择Bob的会话
  await page.click('button:has-text("BO bob")');
  
  // 等待会话加载
  await page.waitForLoadState('networkidle');
  
  // 输入消息
  const testMessage = '测试Playwright消息发送功能';
  await page.fill('input[placeholder="输入消息，按 Enter 发送"]', testMessage);
  await page.click('button:has-text("发送消息")');
  
  // 等待消息发送完成
  await page.waitForLoadState('networkidle');
  
  // 验证消息是否显示在聊天界面
  await expect(page.locator('text=' + testMessage)).toBeVisible();
  
  // 登录Bob用户（在新标签页）
  const bobPage = await context.newPage();
  await bobPage.goto(BASE_URL);
  await bobPage.fill('input[placeholder="请输入用户名"]', 'bob');
  await bobPage.fill('input[placeholder="请输入密码"]', 'Password123');
  await bobPage.click('button:has-text("登录")');
  
  // 等待登录完成
  await bobPage.waitForLoadState('networkidle');
  
  // 选择Alice的会话
  await bobPage.click('button:has-text("AL alice")');
  
  // 等待会话加载
  await bobPage.waitForLoadState('networkidle');
  
  // 验证消息是否显示在Bob的聊天界面
  await expect(bobPage.locator('text=' + testMessage)).toBeVisible();
  
  // 关闭Bob的标签页
  await bobPage.close();
});
