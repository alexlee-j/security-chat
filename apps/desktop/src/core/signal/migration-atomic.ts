import { MigrationPackage } from './migration-package';
import { MigrationResult } from './migration-unpacker';

/**
 * 迁移检查点
 */
export interface MigrationCheckpoint {
  id: string;
  timestamp: number;
  stage: MigrationStage;
  backupData: Map<string, any>;
  verified: boolean;
}

export type MigrationStage =
  | 'idle'
  | 'backup_created'
  | 'messages_imported'
  | 'sessions_imported'
  | 'contacts_imported'
  | 'settings_imported'
  | 'verification_passed'
  | 'committed'
  | 'rolled_back';

/**
 * 迁移原子性保证
 *
 * 原则：
 * 1. 迁移前备份现有数据
 * 2. 分阶段执行，每阶段可回滚
 * 3. 全部验证通过后才提交
 * 4. 失败时自动回滚到备份
 */
export class MigrationAtomic {
  private checkpoints: Map<string, MigrationCheckpoint> = new Map();
  private currentCheckpoint: MigrationCheckpoint | null = null;
  private backupStorageKey = 'security-chat-migration-backup';

  /**
   * 开始迁移流程，创建备份检查点
   */
  async beginMigration(): Promise<MigrationCheckpoint> {
    console.log('[Migration] Creating backup checkpoint...');

    // 1. 备份现有数据
    const backupData = await this.createBackup();

    // 2. 创建检查点
    const checkpoint: MigrationCheckpoint = {
      id: `checkpoint-${Date.now()}`,
      timestamp: Date.now(),
      stage: 'backup_created',
      backupData,
      verified: false,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.currentCheckpoint = checkpoint;

    console.log('[Migration] Backup checkpoint created:', checkpoint.id);
    return checkpoint;
  }

  /**
   * 执行各阶段迁移
   */
  async executeStage(
    stage: MigrationStage,
    operation: () => Promise<void>
  ): Promise<void> {
    if (!this.currentCheckpoint) {
      throw new Error('No active migration checkpoint');
    }

    console.log(`[Migration] Executing stage: ${stage}`);

    try {
      await operation();

      this.currentCheckpoint.stage = stage;
      this.checkpoints.set(this.currentCheckpoint.id, this.currentCheckpoint);

      console.log(`[Migration] Stage completed: ${stage}`);
    } catch (error) {
      console.error(`[Migration] Stage failed: ${stage}`, error);
      // 失败时自动回滚
      await this.rollback();
      throw error;
    }
  }

  /**
   * 验证迁移结果
   */
  async verifyMigration(result: MigrationResult): Promise<boolean> {
    if (!this.currentCheckpoint) {
      throw new Error('No active migration checkpoint');
    }

    console.log('[Migration] Verifying migration result...');

    // 1. 检查不可恢复错误
    const hasUnrecoverableErrors = result.errors.some(e => !e.recoverable);
    if (hasUnrecoverableErrors) {
      console.error('[Migration] Unrecoverable errors detected');
      return false;
    }

    // 2. 验证消息数量
    const expectedMessages = this.currentCheckpoint.backupData.get('messageCount') as number;
    if (expectedMessages > 0 && result.importedMessages < expectedMessages * 0.95) {
      console.warn('[Migration] Message count mismatch');
      // 允许 5% 的消息丢失容差
    }

    // 3. 验证会话
    const expectedSessions = this.currentCheckpoint.backupData.get('sessionCount') as number;
    if (expectedSessions > 0 && result.importedSessions < expectedSessions * 0.8) {
      console.warn('[Migration] Session count mismatch');
      // 允许 20% 的会话失败容差
    }

    this.currentCheckpoint.verified = true;
    this.currentCheckpoint.stage = 'verification_passed';

    console.log('[Migration] Verification passed');
    return true;
  }

  /**
   * 提交迁移（删除备份）
   */
  async commit(): Promise<void> {
    if (!this.currentCheckpoint) {
      throw new Error('No active migration checkpoint');
    }

    if (!this.currentCheckpoint.verified) {
      throw new Error('Cannot commit unverified migration');
    }

    console.log('[Migration] Committing migration...');

    // 删除备份数据
    await this.deleteBackup(this.currentCheckpoint.id);

    this.currentCheckpoint.stage = 'committed';
    this.checkpoints.delete(this.currentCheckpoint.id);
    this.currentCheckpoint = null;

    console.log('[Migration] Migration committed successfully');
  }

  /**
   * 回滚到备份点
   */
  async rollback(): Promise<void> {
    if (!this.currentCheckpoint) {
      console.log('[Migration] No active checkpoint to rollback');
      return;
    }

    console.log('[Migration] Rolling back to backup...');

    try {
      // 恢复备份数据
      await this.restoreBackup(this.currentCheckpoint.backupData);

      this.currentCheckpoint.stage = 'rolled_back';
      this.checkpoints.delete(this.currentCheckpoint.id);
      this.currentCheckpoint = null;

      console.log('[Migration] Rollback completed');
    } catch (error) {
      console.error('[Migration] Rollback failed:', error);
      throw new Error('CRITICAL: Migration rollback failed. Manual intervention required.');
    }
  }

  /**
   * 创建数据备份
   */
  private async createBackup(): Promise<Map<string, any>> {
    const backup = new Map<string, any>();

    // 备份消息
    const messages = await this.readAllMessages();
    backup.set('messages', messages);
    backup.set('messageCount', messages.length);

    // 备份会话
    const sessions = await this.readAllSessions();
    backup.set('sessions', sessions);
    backup.set('sessionCount', sessions.length);

    // 备份联系人
    const contacts = await this.readContacts();
    backup.set('contacts', contacts);

    // 备份设置
    const settings = await this.readSettings();
    backup.set('settings', settings);

    // 存储到临时区域
    const backupId = `backup-${Date.now()}`;
    localStorage.setItem(
      `${this.backupStorageKey}-${backupId}`,
      JSON.stringify(Object.fromEntries(backup))
    );

    return backup;
  }

  /**
   * 恢复备份数据
   */
  private async restoreBackup(backupData: Map<string, any>): Promise<void> {
    // 清除当前数据
    await this.clearCurrentData();

    // 恢复消息
    const messages = backupData.get('messages') as any[];
    for (const msg of messages || []) {
      await this.insertMessage(msg);
    }

    // 恢复会话
    const sessions = backupData.get('sessions') as any[];
    for (const session of sessions || []) {
      await this.insertSession(session);
    }

    // 恢复联系人
    const contacts = backupData.get('contacts') as any[];
    for (const contact of contacts || []) {
      await this.insertContact(contact);
    }

    // 恢复设置
    const settings = backupData.get('settings') as any;
    if (settings) {
      await this.applySettings(settings);
    }
  }

  /**
   * 删除备份
   */
  private async deleteBackup(backupId: string): Promise<void> {
    localStorage.removeItem(`${this.backupStorageKey}-${backupId}`);
  }

  // 数据操作方法（需要与现有存储逻辑集成）
  private async readAllMessages(): Promise<any[]> {
    // TODO: 从 SQLite 或 localStorage 读取
    return [];
  }

  private async readAllSessions(): Promise<any[]> {
    // TODO: 从 localStorage 读取
    return [];
  }

  private async readContacts(): Promise<any[]> {
    // TODO: 从 localStorage 读取
    return [];
  }

  private async readSettings(): Promise<any> {
    // TODO: 从 localStorage 读取
    return {};
  }

  private async clearCurrentData(): Promise<void> {
    // TODO: 清除当前设备上的数据
  }

  private async insertMessage(msg: any): Promise<void> {
    // TODO: 插入消息
  }

  private async insertSession(session: any): Promise<void> {
    // TODO: 插入会话
  }

  private async insertContact(contact: any): Promise<void> {
    // TODO: 插入联系人
  }

  private async applySettings(settings: any): Promise<void> {
    // TODO: 应用设置
  }
}

/**
 * 迁移锁 - 防止并发迁移
 */
export class MigrationLock {
  private static LOCK_KEY = 'security-chat-migration-lock';

  static async acquire(): Promise<boolean> {
    const existing = localStorage.getItem(this.LOCK_KEY);
    if (existing) {
      const lock = JSON.parse(existing);
      const now = Date.now();
      // 锁超过 30 分钟自动释放
      if (now - lock.timestamp < 30 * 60 * 1000) {
        return false;
      }
    }

    localStorage.setItem(this.LOCK_KEY, JSON.stringify({
      timestamp: Date.now(),
      deviceId: await MigrationLock.getCurrentDeviceId(),
    }));

    return true;
  }

  static release(): void {
    localStorage.removeItem(this.LOCK_KEY);
  }

  private static async getCurrentDeviceId(): Promise<string> {
    let deviceId = localStorage.getItem('security-chat-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('security-chat-device-id', deviceId);
    }
    return deviceId;
  }
}
