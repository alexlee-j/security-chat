import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const RUN_GROUP_RUST_E2E = process.env.RUN_GROUP_RUST_E2E === '1';

async function loginInUI(page: import('@playwright/test').Page, account: string, password: string): Promise<void> {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  const accountInput = page
    .locator('input[placeholder*="用户名"], input[placeholder*="邮箱"], input[name="username"], input[type="text"]')
    .first();
  const passwordInput = page
    .locator('input[placeholder*="密码"], input[name="password"], input[type="password"]')
    .first();

  await accountInput.fill(account);
  await passwordInput.fill(password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

async function openConversation(page: import('@playwright/test').Page, name: string): Promise<void> {
  const item = page.locator('.conversation-item, .group-item').filter({ hasText: name }).first();
  await item.click();
  await page.waitForTimeout(1000);
}

async function sendComposerText(page: import('@playwright/test').Page, text: string): Promise<void> {
  const input = page.locator('textarea[placeholder*="输入消息"], input[placeholder*="输入消息"]').first();
  await input.fill(text);
  await input.press('Enter');
}

test.describe('Group Rust regression scenarios', () => {
  test.skip(!RUN_GROUP_RUST_E2E, 'Set RUN_GROUP_RUST_E2E=1 to run desktop group regression scenarios');

  const account = process.env.E2E_GROUP_ACCOUNT ?? '';
  const password = process.env.E2E_GROUP_PASSWORD ?? '';
  const conversationName = process.env.E2E_GROUP_NAME ?? '';

  test.beforeEach(async ({ page }) => {
    test.skip(!account || !password || !conversationName, 'Missing E2E_GROUP_ACCOUNT/E2E_GROUP_PASSWORD/E2E_GROUP_NAME');
    await loginInUI(page, account, password);
    await openConversation(page, conversationName);
  });

  test('3.5-UI: group message bubble renders with self side class', async ({ page }) => {
    const text = `group-ui-${Date.now()}`;
    await sendComposerText(page, text);
    await expect(page.locator('.message.self').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.message-bubble, article.message').filter({ hasText: text }).first()).toBeVisible({
      timeout: 8000,
    });
  });

  test('3.5-Error: send failure shows user-facing error message', async ({ page }) => {
    await page.route('**/api/v1/message/send', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 500, message: 'mock group send failure' },
          traceId: 'playwright-group-send-failure',
        }),
      });
    });

    await sendComposerText(page, `group-fail-${Date.now()}`);
    await expect(page.getByText('发送消息失败，请稍后重试。')).toBeVisible({ timeout: 5000 });
  });

  test('3.5-Replay: message remains visible after re-login replay', async ({ page }) => {
    const text = `group-replay-${Date.now()}`;
    await sendComposerText(page, text);
    await expect(page.locator('.message-bubble, article.message').filter({ hasText: text }).first()).toBeVisible({
      timeout: 8000,
    });

    await page.evaluate(() => {
      localStorage.removeItem('auth-token');
    });
    await loginInUI(page, account, password);
    await openConversation(page, conversationName);

    await expect(page.locator('.message-bubble, article.message').filter({ hasText: text }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

