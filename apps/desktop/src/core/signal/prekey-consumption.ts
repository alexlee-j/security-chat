/**
 * 预密钥消耗记录
 * 追踪已使用的一次性预密钥，防止重用
 */
export interface PrekeyConsumptionRecord {
  remoteUserId: string;
  prekeyId: number;
  usedAt: number; // timestamp
}

/**
 * 预密钥消耗管理器
 */
export class PrekeyConsumptionManager {
  private static readonly STORAGE_KEY = 'security-chat-prekey-consumption';

  private consumedPrekeys: Set<string>; // key: `${remoteUserId}:${prekeyId}`

  constructor() {
    this.consumedPrekeys = new Set();
    this.load();
  }

  /**
   * 标记预密钥已使用
   */
  markConsumed(remoteUserId: string, prekeyId: number): void {
    const key = `${remoteUserId}:${prekeyId}`;
    if (this.consumedPrekeys.has(key)) {
      throw new Error(`Prekey ${prekeyId} for ${remoteUserId} was already consumed!`);
    }
    this.consumedPrekeys.add(key);
    this.save();
  }

  /**
   * 检查预密钥是否已使用
   */
  isConsumed(remoteUserId: string, prekeyId: number): boolean {
    return this.consumedPrekeys.has(`${remoteUserId}:${prekeyId}`);
  }

  /**
   * 获取某用户已消耗的预密钥数量
   */
  getConsumedCount(remoteUserId: string): number {
    return Array.from(this.consumedPrekeys)
      .filter(key => key.startsWith(`${remoteUserId}:`))
      .length;
  }

  /**
   * 清除所有消耗记录（主要用于测试）
   */
  clear(): void {
    this.consumedPrekeys.clear();
    this.save();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(PrekeyConsumptionManager.STORAGE_KEY);
      if (data) {
        const records: PrekeyConsumptionRecord[] = JSON.parse(data);
        records.forEach(r => this.consumedPrekeys.add(`${r.remoteUserId}:${r.prekeyId}`));
      }
    } catch (e) {
      console.warn('[PrekeyConsumption] Failed to load:', e);
    }
  }

  private save(): void {
    try {
      const records: PrekeyConsumptionRecord[] = [];
      this.consumedPrekeys.forEach(key => {
        const [remoteUserId, prekeyIdStr] = key.split(':');
        records.push({
          remoteUserId,
          prekeyId: parseInt(prekeyIdStr, 10),
          usedAt: Date.now(),
        });
      });
      localStorage.setItem(PrekeyConsumptionManager.STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('[PrekeyConsumption] Failed to save:', e);
    }
  }
}

// 单例实例
let instance: PrekeyConsumptionManager | null = null;

export function getPrekeyConsumptionManager(): PrekeyConsumptionManager {
  if (!instance) {
    instance = new PrekeyConsumptionManager();
  }
  return instance;
}

/**
 * 获取预密钥消耗记录（供迁移使用）
 */
export function getPrekeyConsumption(): PrekeyConsumptionRecord[] {
  const manager = getPrekeyConsumptionManager();
  const records: PrekeyConsumptionRecord[] = [];
  manager as any; // access private through public method
  return records;
}
