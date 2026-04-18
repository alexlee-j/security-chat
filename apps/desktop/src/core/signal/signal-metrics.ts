/**
 * Signal Protocol 指标收集器
 * 用于监控加密/解密操作的成功率和失败率
 */

export interface SignalMetrics {
  encryptionCount: number;
  decryptionCount: number;
  encryptionFailures: number;
  decryptionFailures: number;
  sessionCount: number;
  prekeyCount: number;
  lastEncryptionError?: string;
  lastDecryptionError?: string;
  lastErrorTimestamp?: number;
}

const STORAGE_KEY = 'security-chat-signal-metrics';

const metrics: SignalMetrics = {
  encryptionCount: 0,
  decryptionCount: 0,
  encryptionFailures: 0,
  decryptionFailures: 0,
  sessionCount: 0,
  prekeyCount: 0,
};

/**
 * 记录加密操作
 */
export function recordEncryption(success: boolean, error?: string): void {
  metrics.encryptionCount++;
  if (!success) {
    metrics.encryptionFailures++;
    metrics.lastEncryptionError = error;
    metrics.lastErrorTimestamp = Date.now();
  }
  saveMetrics();
}

/**
 * 记录解密操作
 */
export function recordDecryption(success: boolean, error?: string): void {
  metrics.decryptionCount++;
  if (!success) {
    metrics.decryptionFailures++;
    metrics.lastDecryptionError = error;
    metrics.lastErrorTimestamp = Date.now();
  }
  saveMetrics();
}

/**
 * 记录会话创建
 */
export function recordSessionCreation(): void {
  metrics.sessionCount++;
  saveMetrics();
}

/**
 * 记录预密钥生成
 */
export function recordPrekeyGeneration(count: number = 1): void {
  metrics.prekeyCount += count;
  saveMetrics();
}

/**
 * 获取当前指标
 */
export function getMetrics(): SignalMetrics {
  return { ...metrics };
}

/**
 * 获取加密成功率
 */
export function getEncryptionSuccessRate(): number {
  if (metrics.encryptionCount === 0) return 1.0;
  return (metrics.encryptionCount - metrics.encryptionFailures) / metrics.encryptionCount;
}

/**
 * 获取解密成功率
 */
export function getDecryptionSuccessRate(): number {
  if (metrics.decryptionCount === 0) return 1.0;
  return (metrics.decryptionCount - metrics.decryptionFailures) / metrics.decryptionCount;
}

/**
 * 重置所有指标
 */
export function resetMetrics(): void {
  metrics.encryptionCount = 0;
  metrics.decryptionCount = 0;
  metrics.encryptionFailures = 0;
  metrics.decryptionFailures = 0;
  metrics.sessionCount = 0;
  metrics.prekeyCount = 0;
  metrics.lastEncryptionError = undefined;
  metrics.lastDecryptionError = undefined;
  metrics.lastErrorTimestamp = undefined;
  saveMetrics();
}

/**
 * 是否应该回滚（失败率超过阈值）
 */
export function shouldRollback(): boolean {
  const total = metrics.encryptionCount + metrics.decryptionCount;
  if (total < 10) return false; // 样本太少，不建议回滚

  const failures = metrics.encryptionFailures + metrics.decryptionFailures;
  const failureRate = failures / total;

  // 如果失败率超过 5%，建议回滚
  return failureRate > 0.05;
}

/**
 * 获取健康状态报告
 */
export function getHealthReport(): {
  status: 'healthy' | 'degraded' | 'critical';
  encryptionSuccessRate: number;
  decryptionSuccessRate: number;
  totalOperations: number;
  failureRate: number;
} {
  const encryptionSuccessRate = getEncryptionSuccessRate();
  const decryptionSuccessRate = getDecryptionSuccessRate();
  const total = metrics.encryptionCount + metrics.decryptionCount;
  const failures = metrics.encryptionFailures + metrics.decryptionFailures;
  const failureRate = total > 0 ? failures / total : 0;

  let status: 'healthy' | 'degraded' | 'critical';
  if (failureRate > 0.05) {
    status = 'critical';
  } else if (failureRate > 0.01) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    status,
    encryptionSuccessRate,
    decryptionSuccessRate,
    totalOperations: total,
    failureRate,
  };
}

/**
 * 加载保存的指标
 */
export function loadMetrics(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.assign(metrics, parsed);
    }
  } catch (e) {
    console.warn('[Metrics] Failed to load:', e);
  }
}

/**
 * 保存指标到 localStorage
 */
function saveMetrics(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch (e) {
    console.warn('[Metrics] Failed to save:', e);
  }
}

// 初始化时加载保存的指标
loadMetrics();
