/**
 * 文件名：auth-storage.ts
 * 所属模块：桌面端-核心状态管理
 * 核心作用：安全存储登录凭证，支持记住密码和自动登录功能
 * 核心依赖：secure-storage 加密存储
 * 创建时间：2026-04-03
 */

import { setSecureItem, getSecureItem, removeSecureItem, setSecureJSON, getSecureJSON } from './secure-storage';

const AUTH_STORAGE_PREFIX = 'auth.';
const CREDENTIALS_KEY = AUTH_STORAGE_PREFIX + 'credentials';
const AUTO_LOGIN_KEY = AUTH_STORAGE_PREFIX + 'auto-login';
const REMEMBER_PASSWORD_KEY = AUTH_STORAGE_PREFIX + 'remember-password';
const LAST_LOGIN_KEY = AUTH_STORAGE_PREFIX + 'last-login';
const ACCOUNT_DEVICE_MAP_KEY = AUTH_STORAGE_PREFIX + 'account-device-map';

/**
 * 登录凭证数据结构
 */
export interface StoredCredentials {
  account: string;
  /** 加密后的密码 */
  encryptedPassword: string;
  /** 最后登录时间戳 */
  lastLoginAt: number;
}

/**
 * 自动登录配置
 */
export interface AutoLoginConfig {
  enabled: boolean;
  /** 自动登录 token（用于静默刷新） */
  refreshToken?: string;
  /** 过期时间 */
  expiresAt?: number;
}

type AccountDeviceMap = Record<string, string>;

function normalizeAccount(account: string): string {
  return account.trim().toLowerCase();
}

/**
 * 存储登录凭证（用于记住密码）
 * @param account - 账号
 * @param password - 密码（会被加密存储）
 */
export async function storeCredentials(account: string, password: string): Promise<void> {
  const credentials: StoredCredentials = {
    account,
    encryptedPassword: password, // 密码会被 secure-storage 的 AES-GCM 加密
    lastLoginAt: Date.now(),
  };
  await setSecureJSON(CREDENTIALS_KEY, credentials);
}

/**
 * 获取存储的登录凭证
 */
export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  return await getSecureJSON<StoredCredentials>(CREDENTIALS_KEY);
}

/**
 * 清除登录凭证
 */
export async function clearCredentials(): Promise<void> {
  await removeSecureItem(CREDENTIALS_KEY);
}

/**
 * 设置记住密码选项
 */
export async function setRememberPassword(remember: boolean): Promise<void> {
  await setSecureItem(REMEMBER_PASSWORD_KEY, remember ? 'true' : 'false');
}

/**
 * 获取记住密码选项
 */
export async function getRememberPassword(): Promise<boolean> {
  const value = await getSecureItem(REMEMBER_PASSWORD_KEY);
  return value === 'true';
}

/**
 * 设置自动登录配置
 */
export async function setAutoLogin(config: AutoLoginConfig): Promise<void> {
  await setSecureJSON(AUTO_LOGIN_KEY, config);
}

/**
 * 获取自动登录配置
 */
export async function getAutoLogin(): Promise<AutoLoginConfig | null> {
  return await getSecureJSON<AutoLoginConfig>(AUTO_LOGIN_KEY);
}

/**
 * 清除自动登录配置
 */
export async function clearAutoLogin(): Promise<void> {
  await removeSecureItem(AUTO_LOGIN_KEY);
}

/**
 * 检查是否可以自动登录
 * 条件：开启了自动登录，且未过期
 */
export async function canAutoLogin(): Promise<boolean> {
  const config = await getAutoLogin();
  if (!config || !config.enabled) {
    return false;
  }

  // 检查是否过期
  if (config.expiresAt && Date.now() > config.expiresAt) {
    await clearAutoLogin();
    return false;
  }

  return true;
}

/**
 * 存储最后登录时间
 */
export async function setLastLoginTime(): Promise<void> {
  await setSecureItem(LAST_LOGIN_KEY, Date.now().toString());
}

/**
 * 获取最后登录时间
 */
export async function getLastLoginTime(): Promise<number | null> {
  const value = await getSecureItem(LAST_LOGIN_KEY);
  return value ? parseInt(value, 10) : null;
}

/**
 * 记录账号与设备 ID 的映射
 */
export async function setDeviceIdForAccount(account: string, deviceId: string): Promise<void> {
  const normalizedAccount = normalizeAccount(account);
  if (!normalizedAccount || !deviceId) {
    return;
  }
  const currentMap = (await getSecureJSON<AccountDeviceMap>(ACCOUNT_DEVICE_MAP_KEY)) || {};
  currentMap[normalizedAccount] = deviceId;
  await setSecureJSON(ACCOUNT_DEVICE_MAP_KEY, currentMap);
}

/**
 * 获取账号上次使用的设备 ID
 */
export async function getDeviceIdForAccount(account: string): Promise<string | null> {
  const normalizedAccount = normalizeAccount(account);
  if (!normalizedAccount) {
    return null;
  }
  const currentMap = (await getSecureJSON<AccountDeviceMap>(ACCOUNT_DEVICE_MAP_KEY)) || {};
  return currentMap[normalizedAccount] || null;
}

/**
 * 清除所有认证相关的本地存储
 * 但保留 Signal 密钥和会话
 */
export async function clearAllAuthData(): Promise<void> {
  await clearCredentials();
  await clearAutoLogin();
  await removeSecureItem(REMEMBER_PASSWORD_KEY);
  await removeSecureItem(LAST_LOGIN_KEY);
  await removeSecureItem(ACCOUNT_DEVICE_MAP_KEY);
}
