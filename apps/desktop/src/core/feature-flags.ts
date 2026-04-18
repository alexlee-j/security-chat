/**
 * Feature Flag 系统
 * 用于控制 Signal Protocol 实现的切换
 */

export interface FeatureFlags {
  /** 使用 WASM Signal 实现 */
  useWasmSignal: boolean;
  /** 使用新的会话管理器 */
  useNewSessionManager: boolean;
  /** 启用多设备支持 */
  enableMultiDevice: boolean;
  /** 启用设备迁移功能 */
  enableDeviceMigration: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useWasmSignal: false, // 初始关闭，使用 JS 实现
  useNewSessionManager: true, // 新的会话管理器默认启用
  enableMultiDevice: false, // 多设备支持需要 Phase 2 完成后启用
  enableDeviceMigration: false, // 设备迁移需要 Phase 4 完成后启用
};

let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };

/**
 * 获取当前 Feature Flags
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...currentFlags };
}

/**
 * 更新 Feature Flags
 */
export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  currentFlags = { ...currentFlags, ...flags };
  localStorage.setItem('feature-flags', JSON.stringify(currentFlags));
  console.log('[FeatureFlags] Updated:', currentFlags);
}

/**
 * 加载保存的 Feature Flags
 */
export function loadFeatureFlags(): void {
  try {
    const stored = localStorage.getItem('feature-flags');
    if (stored) {
      currentFlags = { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[FeatureFlags] Failed to load:', e);
  }
}

/**
 * 检查某个 Feature 是否启用
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return currentFlags[flag];
}

/**
 * 重置所有 Feature Flags 到默认值
 */
export function resetFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FLAGS };
  localStorage.removeItem('feature-flags');
  console.log('[FeatureFlags] Reset to defaults');
}

/**
 * 启用指定功能（便捷方法）
 */
export function enableFeature(flag: keyof FeatureFlags): void {
  setFeatureFlags({ [flag]: true });
}

/**
 * 禁用指定功能（便捷方法）
 */
export function disableFeature(flag: keyof FeatureFlags): void {
  setFeatureFlags({ [flag]: false });
}
