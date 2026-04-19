import { expect, test } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

function uniqueUser(prefix: string) {
  const stamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    username: `${prefix}_${stamp}_${suffix}`,
    email: `${prefix}_${stamp}_${suffix}@example.com`,
    password: 'Test123456!',
  };
}

async function registerAndLogin(page: import('@playwright/test').Page, user: ReturnType<typeof uniqueUser>): Promise<void> {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  await page.getByText('立即注册').click();
  await page.waitForTimeout(300);
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="email"]', user.email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(user.password);
  await passwordInputs.nth(1).fill(user.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.evaluate(({ account, password }) => {
    const prefix = 'security-chat.auth.';
    localStorage.setItem(`${prefix}remember-password`, 'true');
    localStorage.setItem(`${prefix}auto-login`, JSON.stringify({
      enabled: true,
      refreshToken: 'playwright-auto-login',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }));
    localStorage.setItem(`${prefix}credentials`, JSON.stringify({
      account,
      encryptedPassword: password,
      lastLoginAt: Date.now(),
    }));
  }, { account: user.username, password: user.password });

  await page.reload();
  await expect(page.locator('.workspace-shell')).toBeVisible({ timeout: 30000 });
}

test.describe('桌面端认证偏好与导航', () => {
  test('登录页应回填历史凭证与偏好状态', async ({ page }) => {
    const user = uniqueUser('pref_hydrate');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate(({ account, password }) => {
      const prefix = 'security-chat.auth.';
      localStorage.setItem(`${prefix}remember-password`, 'true');
      localStorage.setItem(`${prefix}auto-login`, JSON.stringify({
        enabled: true,
        refreshToken: 'playwright-pref-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }));
      localStorage.setItem(`${prefix}credentials`, JSON.stringify({
        account,
        encryptedPassword: password,
        lastLoginAt: Date.now(),
      }));
    }, { account: user.username, password: user.password });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[name="username"]')).toHaveValue(user.username);
    await expect(page.locator('input[name="password"]')).toHaveValue(user.password);
    await expect(page.getByLabel('记住密码')).toBeChecked();
    await expect(page.getByLabel('自动登录')).toBeChecked();
  });

  test('自动登录应联动勾选记住密码', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const remember = page.getByLabel('记住密码');
    const autoLogin = page.getByLabel('自动登录');

    await expect(remember).not.toBeChecked();
    await expect(autoLogin).not.toBeChecked();

    await autoLogin.click();

    await expect(autoLogin).toBeChecked();
    await expect(remember).toBeChecked();

    await remember.click();

    await expect(remember).not.toBeChecked();
    await expect(autoLogin).not.toBeChecked();
  });

  test('好友中心与会话列表应共享同一个导航入口', async ({ page }) => {
    const user = uniqueUser('nav_test');
    await registerAndLogin(page, user);

    const navButton = page.getByRole('button', { name: '导航菜单' });
    await expect(navButton).toBeVisible();

    await navButton.click();
    await expect(page.getByText('个人中心')).toBeVisible();
    await expect(page.getByText('设置')).toBeVisible();

    await page.getByRole('button', { name: '好友' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '导航菜单' })).toBeVisible();
    await page.getByRole('button', { name: '导航菜单' }).click();
    await expect(page.getByText('个人中心')).toBeVisible();
    await expect(page.getByText('关于')).toBeVisible();
  });

  test('会话右键菜单 smoke: 显示本地与服务端动作分组', async ({ page }) => {
    const user = uniqueUser('menu_smoke');
    await registerAndLogin(page, user);

    const cards = page.locator('.conversation-card');
    const cardCount = await cards.count();
    if (cardCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No conversation card found in smoke run; skip context menu assertion.',
      });
      return;
    }

    await cards.first().click({ button: 'right' });
    await expect(page.getByText('本地会话偏好')).toBeVisible();
    await expect(page.getByText('服务端动作')).toBeVisible();
    await expect(page.getByText('删除会话记录')).toBeVisible();
  });
});
