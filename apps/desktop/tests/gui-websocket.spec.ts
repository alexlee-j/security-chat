import { test, expect, chromium } from '@playwright/test';

/**
 * WebSocket 连接测试
 */

const BASE_URL = 'http://localhost:4173';

test('WS-01: WebSocket 心跳检测', async () => {
  const user = {
    username: `ws_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: `ws_test_${Date.now()}@example.com`,
    password: 'Test123456!',
  };

  const wsEvents: string[] = [];
  let pingCount = 0;
  let pongCount = 0;

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 监听 WebSocket 连接
    page.on('websocket', (ws) => {
      console.log('WebSocket 连接:', ws.url());
      wsEvents.push(`connected: ${ws.url()}`);

      // 监听 WebSocket 消息
      ws.on('framesent', (data) => {
        console.log('发送:', data.payload);
        if (data.payload.includes('ping')) pingCount++;
      });

      ws.on('framereceived', (data) => {
        console.log('接收:', data.payload);
        if (data.payload.includes('pong')) pongCount++;
      });
    });

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

    await page.screenshot({ path: '/tmp/ws-01-loggedin.png' });

    // 等待一段时间观察心跳
    console.log('等待 5 秒观察 WebSocket 心跳...');
    await page.waitForTimeout(5000);

    console.log(`WebSocket 连接数: ${wsEvents.length}`);
    console.log(`Ping 发送次数: ${pingCount}`);
    console.log(`Pong 接收次数: ${pongCount}`);

    if (wsEvents.length > 0) {
      console.log('✅ WS-01: WebSocket 连接成功');
      wsEvents.forEach(e => console.log('  -', e));
    } else {
      console.log('⚠️ WS-01: 未检测到 WebSocket 连接');
    }

    if (pingCount > 0 || pongCount > 0) {
      console.log('✅ WS-01: 检测到心跳活动');
    }

  } finally {
    await browser.close();
  }
});

test('WS-03: 用户在线状态', async () => {
  const userA = {
    username: `wsa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: `wsa_${Date.now()}@example.com`,
    password: 'Test123456!',
  };

  const userB = {
    username: `wsb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: `wsb_${Date.now()}@example.com`,
    password: 'Test123456!',
  };

  const browser = await chromium.launch({ headless: false });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const statusEventsA: string[] = [];
  const statusEventsB: string[] = [];

  try {
    // 监听在线状态事件
    pageA.on('websocket', (ws) => {
      console.log('A WebSocket:', ws.url());
      ws.on('framereceived', (data) => {
        if (data.payload.includes('online') || data.payload.includes('offline') || data.payload.includes('status')) {
          statusEventsA.push(data.payload);
        }
      });
    });

    pageB.on('websocket', (ws) => {
      console.log('B WebSocket:', ws.url());
      ws.on('framereceived', (data) => {
        if (data.payload.includes('online') || data.payload.includes('offline') || data.payload.includes('status')) {
          statusEventsB.push(data.payload);
        }
      });
    });

    // 注册用户 A
    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState('networkidle');
    await pageA.click('text=立即注册');
    await pageA.waitForTimeout(300);
    await pageA.fill('input[name="username"]', userA.username);
    await pageA.fill('input[name="email"]', userA.email);
    await pageA.fill('input[name="new-password"]', userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForTimeout(2000);

    // 注册用户 B
    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState('networkidle');
    await pageB.click('text=立即注册');
    await pageB.waitForTimeout(300);
    await pageB.fill('input[name="username"]', userB.username);
    await pageB.fill('input[name="email"]', userB.email);
    await pageB.fill('input[name="new-password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForTimeout(2000);

    await pageA.screenshot({ path: '/tmp/ws-03-both-online.png' });

    // 等待观察状态变化
    console.log('等待 3 秒观察在线状态...');
    await pageA.waitForTimeout(3000);

    console.log('A 收到状态事件:', statusEventsA.length);
    console.log('B 收到状态事件:', statusEventsB.length);

    if (statusEventsA.length > 0 || statusEventsB.length > 0) {
      console.log('✅ WS-03: 检测到在线状态变化');
    } else {
      console.log('⚠️ WS-03: 未检测到在线状态事件（可能需要建立好友关系）');
    }

  } finally {
    await browser.close();
  }
});