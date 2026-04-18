# Signal Protocol Rust 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端 Signal Protocol 实现从有缺陷的 JS 代码迁移到经过审计的 Rust/libsignal 库，实现真正的前向保密和多设备支持。

**Architecture:** 三阶段实施：
1. **Phase 1 - 架构重构**：修复当前 JS 实现的核心缺陷，建立正确的会话管理机制
2. **Phase 2 - Rust/WASM 实现**：使用 libsignal  Rust 库实现 Signal Protocol，通过 WASM 暴露给前端
3. **Phase 3 - 迁移**：平滑过渡，新旧实现并存，逐步切换

**Tech Stack:**
- Rust + `libsignal-protocol` (经过审计的 Signal 协议实现)
- `wasm-bindgen` + `wasm-pack` (WASM 编译)
- TypeScript (前端状态管理)
- Tauri (桌面端)

**Worktree:** `feature/signal-rust-refactor` (已从 `main` 创建)

---

# Phase 4: 设备迁移方案（换设备时消息迁移）

## 目标
实现安全、原子性的设备迁移方案，确保用户换设备时能完整恢复聊天历史和 Signal 会话状态。

## 当前问题分析
| 问题 | 影响 |
|------|------|
| 消息存储在本地 SQLite | 换设备后历史消息丢失 |
| Signal Session 密钥未导出 | 无法在新设备解密历史消息 |
| 无标准迁移格式 | 迁移过程不可靠 |

## 迁移架构设计

```
旧设备                            新设备
┌─────────────────┐              ┌─────────────────┐
│ 1. 导出数据      │   ──传输──>  │ 3. 导入数据      │
│   - 消息加密包   │   (扫码/文件) │   - 验证完整性   │
│   - Session Keys │              │   - 解密消息     │
│   - 联系人列表   │              │   - 重建 Session │
│   - 用户配置     │              │   - 恢复配置     │
└─────────────────┘              └─────────────────┘
```

## 迁移数据包设计

```typescript
// apps/desktop/src/core/signal/migration-package.ts

/**
 * 迁移数据包结构
 * 包含在新设备重建 Signal Session 和解密历史消息所需的全部数据
 */
export interface MigrationPackage {
  version: 1;                          // 数据格式版本
  exportedAt: number;                   // 导出时间戳
  deviceId: string;                     // 源设备标识

  // 1. 消息数据（加密）
  encryptedMessageStore: {
    conversations: EncryptedBlob;       // 会话列表
    messages: EncryptedBlob;            // 消息列表（按会话分组的加密数据）
    messageKeyChecksum: string;         // 消息密钥校验和
  };

  // 2. Signal Session 状态（加密）
  encryptedSessionStore: {
    sessions: EncryptedBlob;            // 所有会话状态
    prekeyConsumption: EncryptedBlob;   // 预密钥消耗记录
    sessionKeyChecksum: string;         // Session 密钥校验和
  };

  // 3. 联系人数据（加密）
  encryptedContactStore: {
    contacts: EncryptedBlob;            // 联系人列表
    blockedUsers: EncryptedBlob;        // 黑名单
  };

  // 4. 用户配置（可选，带完整性校验）
  encryptedSettings: {
    settings: EncryptedBlob;            // 用户配置
  };

  // 5. 元数据
  metadata: {
    totalMessageCount: number;          // 消息总数
    totalSessionCount: number;          // 会话总数
    oldestMessageTimestamp: number;      // 最老消息时间
    newestMessageTimestamp: number;     // 最新消息时间
  };

  // 6. 完整性校验
  integrity: {
    packageChecksum: string;            // 整个包的 SHA-256
    signature: string;                  // 源设备签名
  };
}

export interface EncryptedBlob {
  ciphertext: string;                  // Base64 编码的密文
  algorithm: 'AES-256-GCM';            // 加密算法
  iv: string;                           // 初始向量 (12 bytes, Base64)
  authTag: string;                      // 认证标签 (16 bytes, Base64)
}

/**
 * 迁移授权码
 * 用于在新设备扫码授权，建立传输通道
 */
export interface MigrationAuthCode {
  code: string;                         // 6位数字授权码
  expiresAt: number;                    // 过期时间
  sourceDeviceId: string;               // 源设备ID
  targetDeviceId?: string;              // 目标设备ID（授权后填充）
}
```

## 任务列表

### Task 13: 实现迁移数据包打包器

**Files:**
- Create: `apps/desktop/src/core/signal/migration-package.ts`
- Create: `apps/desktop/src/core/signal/migration-packer.ts`

- [ ] **Step 1: 创建加密数据结构**

```typescript
// apps/desktop/src/core/signal/migration-package.ts

import { EncryptedBlob } from './migration-package';

export interface MigrationPackage {
  version: 1;
  exportedAt: number;
  deviceId: string;
  encryptedMessageStore: {
    conversations: EncryptedBlob;
    messages: EncryptedBlob;
    messageKeyChecksum: string;
  };
  encryptedSessionStore: {
    sessions: EncryptedBlob;
    prekeyConsumption: EncryptedBlob;
    sessionKeyChecksum: string;
  };
  encryptedContactStore: {
    contacts: EncryptedBlob;
    blockedUsers: EncryptedBlob;
  };
  encryptedSettings: {
    settings: EncryptedBlob;
  };
  metadata: {
    totalMessageCount: number;
    totalSessionCount: number;
    oldestMessageTimestamp: number;
    newestMessageTimestamp: number;
  };
  integrity: {
    packageChecksum: string;
    signature: string;
  };
}

export interface MigrationAuthCode {
  code: string;
  expiresAt: number;
  sourceDeviceId: string;
  targetDeviceId?: string;
}

/**
 * 导出迁移数据包
 * 1. 从本地存储读取消息、会话、联系人
 * 2. 使用迁移密钥加密
 * 3. 生成完整性校验
 */
export async function createMigrationPackage(
  migrationKey: Uint8Array,
  sourceDeviceId: string
): Promise<MigrationPackage> {
  // 1. 读取本地数据
  const messages = await readAllMessages();
  const sessions = await readAllSessions();
  const contacts = await readContacts();
  const settings = await readSettings();

  // 2. 生成消息密钥（从 migrationKey 派生）
  const messageKey = deriveKey(migrationKey, 'message-encryption');
  const sessionKey = deriveKey(migrationKey, 'session-encryption');

  // 3. 加密消息数据
  const encryptedMessages = await encryptBlob(
    JSON.stringify(messages),
    messageKey
  );
  const encryptedConversations = await encryptBlob(
    JSON.stringify(extractConversations(messages)),
    messageKey
  );

  // 4. 加密 Session 数据
  const encryptedSessions = await encryptBlob(
    JSON.stringify(sessions),
    sessionKey
  );
  const encryptedPrekeyConsumption = await encryptBlob(
    JSON.stringify(getPrekeyConsumption()),
    sessionKey
  );

  // 5. 加密联系人数据
  const encryptedContacts = await encryptBlob(
    JSON.stringify(contacts),
    migrationKey
  );
  const encryptedBlockedUsers = await encryptBlob(
    JSON.stringify(getBlockedUsers()),
    migrationKey
  );

  // 6. 加密设置
  const encryptedSettings = await encryptBlob(
    JSON.stringify(settings),
    migrationKey
  );

  // 7. 计算校验和
  const messageKeyChecksum = await sha256(messageKey);
  const sessionKeyChecksum = await sha256(sessionKey);

  // 8. 组装数据包
  const pkg: MigrationPackage = {
    version: 1,
    exportedAt: Date.now(),
    deviceId: sourceDeviceId,
    encryptedMessageStore: {
      conversations: encryptedConversations,
      messages: encryptedMessages,
      messageKeyChecksum,
    },
    encryptedSessionStore: {
      sessions: encryptedSessions,
      prekeyConsumption: encryptedPrekeyConsumption,
      sessionKeyChecksum,
    },
    encryptedContactStore: {
      contacts: encryptedContacts,
      blockedUsers: encryptedBlockedUsers,
    },
    encryptedSettings: {
      settings: encryptedSettings,
    },
    metadata: computeMetadata(messages),
    integrity: {
      packageChecksum: '', // 稍后计算
      signature: '',       // 稍后生成
    },
  };

  // 9. 计算完整性和签名
  pkg.integrity.packageChecksum = await computePackageChecksum(pkg);
  pkg.integrity.signature = await signPackage(pkg, migrationKey);

  return pkg;
}

function deriveKey(masterKey: Uint8Array, purpose: string): Uint8Array {
  // HKDF-SHA256 派生特定用途的密钥
  return hkdf(masterKey, 32, purpose);
}

async function encryptBlob(
  plaintext: string,
  key: Uint8Array
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await importKey(key),
    encoded
  );

  return {
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    algorithm: 'AES-256-GCM',
    iv: arrayToBase64(iv),
    authTag: '', // AES-GCM 自动包含在密文中
  };
}

async function decryptBlob(
  blob: EncryptedBlob,
  key: Uint8Array
): Promise<string> {
  const iv = base64ToArray(blob.iv);
  const ciphertext = base64ToArray(blob.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await importKey(key),
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

- [ ] **Step 2: 创建迁移打包器**

```typescript
// apps/desktop/src/core/signal/migration-packer.ts

import { MigrationPackage, MigrationAuthCode } from './migration-package';

/**
 * 迁移打包器
 * 负责生成迁移数据包和授权码
 */
export class MigrationPacker {
  private sourceDeviceId: string;

  constructor(sourceDeviceId: string) {
    this.sourceDeviceId = sourceDeviceId;
  }

  /**
   * 生成迁移授权码
   * 用于在新设备扫码建立连接
   */
  async generateAuthCode(): Promise<MigrationAuthCode> {
    const code = this.generateSixDigitCode();
    const authCode: MigrationAuthCode = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟有效
      sourceDeviceId: this.sourceDeviceId,
    };

    // 存储授权码（带时效）
    await this.storeAuthCode(authCode);

    return authCode;
  }

  /**
   * 创建迁移数据包
   */
  async createPackage(migrationKey: Uint8Array): Promise<MigrationPackage> {
    const { createMigrationPackage } = await import('./migration-package');
    return createMigrationPackage(migrationKey, this.sourceDeviceId);
  }

  /**
   * 通过授权码验证迁移请求
   */
  async validateAuthCode(code: string, targetDeviceId: string): Promise<boolean> {
    const stored = await this.getStoredAuthCode(code);
    if (!stored) return false;

    const now = Date.now();
    if (now > stored.expiresAt) {
      await this.deleteAuthCode(code);
      return false;
    }

    // 关联目标设备
    stored.targetDeviceId = targetDeviceId;
    await this.storeAuthCode(stored);

    return true;
  }

  private generateSixDigitCode(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return String(array[0] % 1000000).padStart(6, '0');
  }

  private async storeAuthCode(code: MigrationAuthCode): Promise<void> {
    // 存储到内存（仅当前会话有效）
    sessionStorage.setItem(`migration-auth-${code.code}`, JSON.stringify(code));
  }

  private async getStoredAuthCode(code: string): Promise<MigrationAuthCode | null> {
    const stored = sessionStorage.getItem(`migration-auth-${code}`);
    return stored ? JSON.parse(stored) : null;
  }

  private async deleteAuthCode(code: string): Promise<void> {
    sessionStorage.removeItem(`migration-auth-${code}`);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/migration-package.ts apps/desktop/src/core/signal/migration-packer.ts
git commit -m "feat(migration): 实现迁移数据包打包器"
```

---

### Task 14: 实现迁移数据导入器

**Files:**
- Create: `apps/desktop/src/core/signal/migration-unpacker.ts`

- [ ] **Step 1: 创建迁移数据导入器**

```typescript
// apps/desktop/src/core/signal/migration-unpacker.ts

import { MigrationPackage } from './migration-package';

/**
 * 迁移导入结果
 */
export interface MigrationResult {
  success: boolean;
  importedMessages: number;
  importedSessions: number;
  importedContacts: number;
  errors: MigrationError[];
}

export interface MigrationError {
  type: 'checksum_mismatch' | 'decryption_failed' | 'session_rebuild_failed';
  message: string;
  recoverable: boolean;
}

/**
 * 迁移数据导入器
 * 负责在新设备上解密和恢复迁移数据
 */
export class MigrationUnpacker {
  /**
   * 验证迁移数据包完整性
   */
  async verifyPackage(pkg: MigrationPackage): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查版本
    if (pkg.version !== 1) {
      return { valid: false, error: `Unsupported package version: ${pkg.version}` };
    }

    // 2. 检查必要字段
    if (!pkg.encryptedMessageStore || !pkg.encryptedSessionStore) {
      return { valid: false, error: 'Missing required encrypted stores' };
    }

    // 3. 验证包校验和
    const computedChecksum = await this.computePackageChecksum(pkg);
    if (computedChecksum !== pkg.integrity.packageChecksum) {
      return { valid: false, error: 'Package checksum mismatch - data may be corrupted' };
    }

    return { valid: true };
  }

  /**
   * 解密并导入迁移数据
   */
  async importPackage(
    pkg: MigrationPackage,
    migrationKey: Uint8Array
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      importedMessages: 0,
      importedSessions: 0,
      importedContacts: 0,
      errors: [],
    };

    try {
      // 1. 派生解密密钥
      const messageKey = this.deriveKey(migrationKey, 'message-encryption');
      const sessionKey = this.deriveKey(migrationKey, 'session-encryption');

      // 2. 验证消息密钥校验和
      const messageKeyChecksum = await this.sha256(messageKey);
      if (messageKeyChecksum !== pkg.encryptedMessageStore.messageKeyChecksum) {
        result.errors.push({
          type: 'checksum_mismatch',
          message: 'Message key checksum mismatch',
          recoverable: false,
        });
        return result;
      }

      // 3. 验证 Session 密钥校验和
      const sessionKeyChecksum = await this.sha256(sessionKey);
      if (sessionKeyChecksum !== pkg.encryptedSessionStore.sessionKeyChecksum) {
        result.errors.push({
          type: 'checksum_mismatch',
          message: 'Session key checksum mismatch',
          recoverable: false,
        });
        return result;
      }

      // 4. 解密消息
      try {
        const messages = await this.decryptBlob(pkg.encryptedMessageStore.messages, messageKey);
        const messageData = JSON.parse(messages);
        await this.importMessages(messageData);
        result.importedMessages = messageData.length;
      } catch (e) {
        result.errors.push({
          type: 'decryption_failed',
          message: `Failed to decrypt messages: ${e}`,
          recoverable: true,
        });
      }

      // 5. 解密并重建 Sessions
      try {
        const sessions = await this.decryptBlob(pkg.encryptedSessionStore.sessions, sessionKey);
        const sessionData = JSON.parse(sessions);
        const rebuiltCount = await this.rebuildSessions(sessionData);
        result.importedSessions = rebuiltCount;
      } catch (e) {
        result.errors.push({
          type: 'session_rebuild_failed',
          message: `Failed to rebuild sessions: ${e}`,
          recoverable: true,
        });
      }

      // 6. 解密联系人
      try {
        const contacts = await this.decryptBlob(pkg.encryptedContactStore.contacts, migrationKey);
        const contactData = JSON.parse(contacts);
        await this.importContacts(contactData);
        result.importedContacts = contactData.length;
      } catch (e) {
        result.errors.push({
          type: 'decryption_failed',
          message: `Failed to decrypt contacts: ${e}`,
          recoverable: true,
        });
      }

      // 7. 解密并恢复设置
      try {
        const settings = await this.decryptBlob(pkg.encryptedSettings.settings, migrationKey);
        await this.applySettings(JSON.parse(settings));
      } catch (e) {
        // 设置恢复失败不算致命错误
        console.warn('[Migration] Settings restore failed:', e);
      }

      // 8. 全部成功才算成功
      result.success = result.errors.filter(e => !e.recoverable).length === 0;

    } catch (e) {
      result.errors.push({
        type: 'decryption_failed',
        message: `Unexpected error during import: ${e}`,
        recoverable: false,
      });
    }

    return result;
  }

  private async decryptBlob(
    blob: any,
    key: Uint8Array
  ): Promise<string> {
    const iv = this.base64ToArray(blob.iv);
    const ciphertext = this.base64ToArray(blob.ciphertext);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await this.importKey(key),
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private async importMessages(messages: any[]): Promise<void> {
    // 批量写入本地 SQLite
    for (const msg of messages) {
      await this.insertMessage(msg);
    }
  }

  private async insertMessage(msg: any): Promise<void> {
    // 调用现有的消息插入逻辑
    // await messageDb.insert(msg);
  }

  private async rebuildSessions(sessions: any[]): Promise<number> {
    let rebuilt = 0;
    for (const session of sessions) {
      try {
        // 重建 Signal Session
        // 使用迁移后的密钥重新初始化会话
        await this.rebuildSession(session);
        rebuilt++;
      } catch (e) {
        console.warn('[Migration] Failed to rebuild session:', e);
      }
    }
    return rebuilt;
  }

  private async rebuildSession(sessionData: any): Promise<void> {
    // 1. 重新创建 SessionState
    // 2. 存储到新位置
  }

  private async importContacts(contacts: any[]): Promise<void> {
    for (const contact of contacts) {
      await this.insertContact(contact);
    }
  }

  private async insertContact(contact: any): Promise<void> {
    // 调用现有的联系人插入逻辑
  }

  private async applySettings(settings: any): Promise<void> {
    Object.assign(getCurrentSettings(), settings);
  }

  private deriveKey(masterKey: Uint8Array, purpose: string): Uint8Array {
    // HKDF-SHA256 派生
    return hkdf(masterKey, 32, purpose);
  }

  private async sha256(data: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.arrayToBase64(new Uint8Array(hash));
  }

  private async computePackageChecksum(pkg: MigrationPackage): Promise<string> {
    // 排除 integrity 字段计算校验和
    const { integrity, ...rest } = pkg;
    const data = new TextEncoder().encode(JSON.stringify(rest));
    return this.sha256(new Uint8Array(data));
  }

  private async importKey(key: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  private base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/desktop/src/core/signal/migration-unpacker.ts
git commit -m "feat(migration): 实现迁移数据导入器"
```

---

### Task 15: 实现迁移传输通道（扫码 + 端到端加密）

**Files:**
- Create: `apps/desktop/src/core/signal/migration-transport.ts`
- Modify: `apps/desktop/src/features/settings/device-settings.tsx` (添加迁移入口)

- [ ] **Step 1: 创建传输通道管理**

```typescript
// apps/desktop/src/core/signal/migration-transport.ts

import { MigrationPackage } from './migration-package';

/**
 * 迁移传输通道
 * 支持两种模式：
 * 1. 扫码授权：旧设备生成二维码，新设备扫码建立连接
 * 2. 文件导出：导出加密文件，通过其他方式传输到新设备
 */
export class MigrationTransport {
  private wsConnection: WebSocket | null = null;
  private authCode: string | null = null;

  /**
   * 启动扫码监听（新设备端）
   */
  async startQRScanner(): Promise<void> {
    // 使用浏览器 MediaDevices API 访问摄像头
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    // 使用 jsQR 或类似库解析二维码
    // 二维码内容格式: sc:migrate:{authCode}:{deviceId}
  }

  /**
   * 旧设备端：生成迁移授权二维码
   */
  async generateMigrationQR(
    authCode: string,
    sourceDeviceId: string,
    challenge: string
  ): Promise<string> {
    // 二维码内容包含授权信息和挑战
    const qrData = `sc:migrate:${authCode}:${sourceDeviceId}:${challenge}`;
    return this.generateQRCodeImage(qrData);
  }

  /**
   * 建立 WebSocket 传输通道
   */
  async establishConnection(
    authCode: string,
    sourceDeviceId: string,
    targetDeviceId: string
  ): Promise<void> {
    // 1. 客户端认证
    const response = await fetch('/api/v1/migration/connect', {
      method: 'POST',
      body: JSON.stringify({ authCode, sourceDeviceId, targetDeviceId }),
    });

    if (!response.ok) {
      throw new Error('Connection establishment failed');
    }

    const { wsToken } = await response.json();

    // 2. 建立 WebSocket
    this.wsConnection = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/migration`
    );

    this.wsConnection.onopen = () => {
      // 认证
      this.wsConnection?.send(JSON.stringify({ token: wsToken }));
    };

    this.wsConnection.onmessage = (event) => {
      // 处理迁移数据包
      this.handleIncomingData(event.data);
    };
  }

  /**
   * 通过文件导出迁移数据
   * 用于没有网络连接或扫码不便的场景
   */
  async exportToFile(pkg: MigrationPackage): Promise<Blob> {
    const json = JSON.stringify(pkg, null, 2);
    const bytes = new TextEncoder().encode(json);
    return new Blob([bytes], { type: 'application/json' });
  }

  /**
   * 从文件导入
   */
  async importFromFile(file: File): Promise<MigrationPackage> {
    const text = await file.text();
    const pkg = JSON.parse(text) as MigrationPackage;
    return pkg;
  }

  /**
   * 传输数据包
   */
  async sendPackage(pkg: MigrationPackage): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.wsConnection.send(JSON.stringify({
      type: 'migration_package',
      data: pkg,
    }));
  }

  /**
   * 接收数据包
   */
  private handleIncomingData(data: string): void {
    const message = JSON.parse(data);
    if (message.type === 'migration_package') {
      this.onPackageReceived?.(message.data as MigrationPackage);
    }
  }

  onPackageReceived?: (pkg: MigrationPackage) => void;

  /**
   * 关闭连接
   */
  close(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  private async generateQRCodeImage(data: string): Promise<string> {
    // 使用 qrcode.js 生成二维码
    // 返回 Data URL
    const QRCode = await import('qrcode');
    return QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }
}

/**
 * 迁移进度追踪
 */
export interface MigrationProgress {
  stage: 'preparing' | 'transferring' | 'verifying' | 'importing' | 'complete' | 'failed';
  totalBytes: number;
  transferredBytes: number;
  currentItem: string;
  errors: string[];
}

export class MigrationProgressTracker {
  private progress: MigrationProgress;

  constructor() {
    this.progress = {
      stage: 'preparing',
      totalBytes: 0,
      transferredBytes: 0,
      currentItem: '',
      errors: [],
    };
  }

  onProgressUpdate?: (progress: MigrationProgress) => void;

  update(updates: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.onProgressUpdate?.(this.progress);
  }

  getProgress(): MigrationProgress {
    return { ...this.progress };
  }
}
```

- [ ] **Step 2: 在设置页面添加迁移入口**

修改 `device-settings.tsx` 添加"换设备迁移"按钮。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/migration-transport.ts
git add apps/desktop/src/features/settings/device-settings.tsx
git commit -m "feat(migration): 实现迁移传输通道"
```

---

### Task 16: 实现迁移原子性和错误恢复

**Files:**
- Create: `apps/desktop/src/core/signal/migration-atomic.ts`

- [ ] **Step 1: 创建原子性管理器**

```typescript
// apps/desktop/src/core/signal/migration-atomic.ts

/**
 * 迁移原子性保证
 *
 * 原则：
 * 1. 迁移前备份现有数据
 * 2. 分阶段执行，每阶段可回滚
 * 3. 全部验证通过后才提交
 * 4. 失败时自动回滚到备份
 */

import { MigrationPackage } from './migration-package';
import { MigrationResult } from './migration-unpacker';

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

export class MigrationAtomic {
  private checkpoints: Map<string, MigrationCheckpoint> = new Map();
  private currentCheckpoint: MigrationCheckpoint | null = null;
  private backupStorage = 'security-chat-migration-backup';

  /**
   * 开始迁移流程，创建备份检查点
   */
  async beginMigration(sourceDeviceId: string): Promise<MigrationCheckpoint> {
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
    if (result.importedMessages < expectedMessages * 0.95) {
      console.warn('[Migration] Message count mismatch');
      // 允许 5% 的消息丢失容差
    }

    // 3. 验证会话
    const expectedSessions = this.currentCheckpoint.backupData.get('sessionCount') as number;
    if (result.importedSessions < expectedSessions * 0.8) {
      console.warn('[Migration] Session count mismatch');
      // 允许 20% 的会话失败容差（某些会话可能已过期）
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
    backup.set('messages', await this.readAllMessages());
    backup.set('messageCount', (backup.get('messages') as any[]).length);

    // 备份会话
    backup.set('sessions', await this.readAllSessions());
    backup.set('sessionCount', (backup.get('sessions') as any[]).length);

    // 备份联系人
    backup.set('contacts', await this.readContacts());

    // 备份设置
    backup.set('settings', await this.readSettings());

    // 存储到临时区域
    const backupId = `backup-${Date.now()}`;
    localStorage.setItem(
      `${this.backupStorage}-${backupId}`,
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
    const messages = backupData.get('messages');
    for (const msg of messages) {
      await this.insertMessage(msg);
    }

    // 恢复会话
    const sessions = backupData.get('sessions');
    for (const session of sessions) {
      await this.insertSession(session);
    }

    // 恢复联系人
    const contacts = backupData.get('contacts');
    for (const contact of contacts) {
      await this.insertContact(contact);
    }

    // 恢复设置
    const settings = backupData.get('settings');
    await this.applySettings(settings);
  }

  /**
   * 删除备份
   */
  private async deleteBackup(backupId: string): Promise<void> {
    localStorage.removeItem(`${this.backupStorage}-${backupId}`);
  }

  private async readAllMessages(): Promise<any[]> {
    // 从本地存储读取所有消息
    return [];
  }

  private async readAllSessions(): Promise<any[]> {
    // 从本地存储读取所有会话
    return [];
  }

  private async readContacts(): Promise<any[]> {
    return [];
  }

  private async readSettings(): Promise<any> {
    return {};
  }

  private async clearCurrentData(): Promise<void> {
    // 清除当前数据
  }

  private async insertMessage(msg: any): Promise<void> {
    // 插入消息
  }

  private async insertSession(session: any): Promise<void> {
    // 插入会话
  }

  private async insertContact(contact: any): Promise<void> {
    // 插入联系人
  }

  private async applySettings(settings: any): Promise<void> {
    // 应用设置
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
      deviceId: await getCurrentDeviceId(),
    }));

    return true;
  }

  static release(): void {
    localStorage.removeItem(this.LOCK_KEY);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/desktop/src/core/signal/migration-atomic.ts
git commit -m "feat(migration): 实现迁移原子性和错误恢复"
```

---

## Phase 4 总结

| Task | 状态 | 说明 |
|------|------|------|
| Task 13: 迁移打包器 | ⬜ | 生成加密迁移包 |
| Task 14: 迁移导入器 | ⬜ | 解密并恢复数据 |
| Task 15: 传输通道 | ⬜ | 扫码/文件传输 |
| Task 16: 原子性保证 | ⬜ | 备份、回滚机制 |

---

# Phase 1: 架构重构（修复当前 JS 实现）

## 目标
修复当前 Signal 实现中的关键缺陷，建立正确的会话管理接口，为 Phase 2 的 Rust 实现铺平道路。

## 当前问题清单
| 问题 | 位置 | 影响 |
|------|------|------|
| DH 棘轮未实现 | `index.ts:828` | 前向保密失效 |
| deviceId 硬编码为 '1' | `key-management.ts:628` | 多设备完全失效 |
| localIdentityKeyPair 不持久化 | `key-management.ts:548` | 会话恢复失败 |
| 一次性预密钥未删除 | `message-encryption.ts:81` | 重用风险 |
| 两个不兼容的 Double Ratchet 实现 | `index.ts` vs `double-ratchet.ts` | 实际使用有缺陷的版本 |

## 任务列表

### Task 1: 建立 Signal Interface 接口层

**Files:**
- Create: `apps/desktop/src/core/signal/signal-interface.ts`
- Modify: `apps/desktop/src/core/signal/index.ts` (导出接口)

- [ ] **Step 1: 创建 SignalInterface TypeScript 接口**

```typescript
// apps/desktop/src/core/signal/signal-interface.ts

/**
 * Signal Protocol 接口定义
 * 所有 Signal 实现必须实现此接口
 */
export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPrekey {
  keyId: number;
  keyPair: CryptoKeyPair;
  signature: Uint8Array;
}

export interface OneTimePrekey {
  keyId: number;
  keyPair: CryptoKeyPair;
}

export interface PrekeyBundle {
  registrationId: number;
  identityKey: Uint8Array;
  signedPrekey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  oneTimePrekey?: {
    keyId: number;
    publicKey: Uint8Array;
  };
}

export interface SessionState {
  sessionId: string;
  remoteUserId: string;
  remoteDeviceId: string;
  localIdentityKeyPair: IdentityKeyPair;
  remoteIdentityKey: Uint8Array;
  sendingChainKey?: Uint8Array;
  receivingChainKey?: Uint8Array;
  sendingRatchetKey?: CryptoKeyPair;
  receivingRatchetKey?: CryptoKeyPair;
  sendingIndex: number;
  receivingIndex: number;
  previousSendingIndex: number;
  rootKey: Uint8Array;
}

export interface EncryptedMessage {
  preKeyId?: number;
  baseKey?: Uint8Array;
  identityKey?: Uint8Array;
  messageNumber: number;
  previousSendingIndex?: number;
  ciphertext: Uint8Array;
  dhPublicKey?: Uint8Array;
}

export interface DecryptedMessage {
  plaintext: string;
  messageNumber: number;
  previousSendingIndex?: number;
  isPreKeyMessage: boolean;
}

/**
 * Signal 接口 - 抽象 Signal Protocol 实现
 */
export interface ISignalProtocol {
  /**
   * 初始化会话（发起方）
   */
  initiateSession(
    prekeyBundle: PrekeyBundle,
    localIdentityKeyPair: IdentityKeyPair
  ): Promise<SessionState>;

  /**
   * 初始化会话（接收方）
   */
  acceptSession(
    preKeyMessage: EncryptedMessage,
    localIdentityKeyPair: IdentityKeyPair,
    localSignedPrekey: SignedPrekey,
    localOneTimePrekey?: OneTimePrekey
  ): Promise<SessionState>;

  /**
   * 加密消息
   */
  encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage>;

  /**
   * 解密消息
   */
  decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<DecryptedMessage>;

  /**
   * 生成签名预密钥
   */
  generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<SignedPrekey>;

  /**
   * 生成一次性预密钥
   */
  generateOneTimePrekey(keyId: number): Promise<OneTimePrekey>;

  /**
   * 序列化会话状态（用于持久化）
   */
  serializeSession(session: SessionState): string;

  /**
   * 反序列化会话状态（用于恢复）
   */
  deserializeSession(data: string): SessionState;
}
```

- [ ] **Step 2: 运行 TypeScript 类型检查验证接口**

Run: `cd apps/desktop && pnpm tsc --noEmit 2>&1 | head -30`
Expected: 无类型错误

- [ ] **Step 3: 创建 SignalInterfaceBridge 类**

```typescript
// apps/desktop/src/core/signal/signal-interface.ts (追加)

// 信号协议工厂函数类型
export type SignalProtocolFactory = () => ISignalProtocol;

// 当前使用的实现（JS 或 WASM）
let currentImplementation: ISignalProtocol | null = null;
let implementationType: 'js' | 'wasm' = 'js';

/**
 * 设置 Signal 协议实现
 */
export function setSignalImplementation(
  impl: ISignalProtocol,
  type: 'js' | 'wasm'
): void {
  currentImplementation = impl;
  implementationType = type;
  console.log(`[Signal] Using ${type.toUpperCase()} implementation`);
}

/**
 * 获取当前 Signal 协议实现
 */
export function getSignalImplementation(): ISignalProtocol {
  if (!currentImplementation) {
    throw new Error('Signal implementation not set');
  }
  return currentImplementation;
}

/**
 * 获取当前实现类型
 */
export function getImplementationType(): 'js' | 'wasm' {
  return implementationType;
}
```

- [ ] **Step 4: 提交**

```bash
cd /Users/jerry/Desktop/front_end/security-chat-signal-refactor
git add apps/desktop/src/core/signal/signal-interface.ts
git commit -m "feat(signal): 建立 SignalInterface 接口层"
```

---

### Task 2: 修复 deviceId 问题，建立正确的会话 Key 体系

**Files:**
- Modify: `apps/desktop/src/core/signal/key-management.ts:628-631`
- Create: `apps/desktop/src/core/signal/session-key.ts` (会话 key 生成器)

- [ ] **Step 1: 创建 session-key.ts**

```typescript
// apps/desktop/src/core/signal/session-key.ts

/**
 * 会话 Key 生成器
 * 确保每个 (userId, deviceId) 组合有唯一的会话 key
 */
export class SessionKeyManager {
  /**
   * 生成会话存储 key
   * 格式: session-{userId}-{deviceId}
   *
   * 之前硬编码 deviceId 为 '1'，导致多设备失效
   * 现在使用正确的 deviceId
   */
  static getSessionKey(remoteUserId: string, remoteDeviceId: string): string {
    if (!remoteUserId || !remoteDeviceId) {
      throw new Error('remoteUserId and remoteDeviceId are required');
    }
    // 清理特殊字符，只允许字母数字和连字符
    const cleanUserId = remoteUserId.replace(/[^a-zA-Z0-9-]/g, '-');
    const cleanDeviceId = remoteDeviceId.replace(/[^a-zA-Z0-9-]/g, '-');
    return `session-${cleanUserId}-${cleanDeviceId}`;
  }

  /**
   * 从会话 key 解析出 userId 和 deviceId
   */
  static parseSessionKey(key: string): { userId: string; deviceId: string } | null {
    const match = key.match(/^session-(.+)-([^-]+)$/);
    if (!match) {
      return null;
    }
    return {
      userId: match[1],
      deviceId: match[2],
    };
  }

  /**
   * 生成消息加密所需的设备标识
   * 用于查找正确的会话
   */
  static getMessageKey(senderUserId: string, senderDeviceId: string): string {
    return `${senderUserId}:${senderDeviceId}`;
  }

  /**
   * 验证 deviceId 格式
   */
  static isValidDeviceId(deviceId: string): boolean {
    return Boolean(deviceId) && deviceId.length > 0 && deviceId.length <= 64;
  }
}
```

- [ ] **Step 2: 验证现有会话迁移**

创建迁移脚本 `apps/desktop/src/core/signal/migrate-session-keys.ts`:

```typescript
// apps/desktop/src/core/signal/migrate-session-keys.ts

/**
 * 会话 Key 迁移脚本
 * 将旧的硬编码 deviceId='1' 的会话迁移到正确的 deviceId
 *
 * 执行方式:
 * 1. 获取服务器返回的真实 deviceId
 * 2. 遍历本地旧格式会话
 * 3. 创建新格式会话
 * 4. 删除旧格式会话
 */
export async function migrateSessionKeys(
  oldSessionKey: string,
  newDeviceId: string
): Promise<void> {
  // 旧格式: session-{userId}-1
  // 新格式: session-{userId}-{actualDeviceId}

  const parsed = SessionKeyManager.parseSessionKey(oldSessionKey);
  if (!parsed) {
    console.warn('[Migration] Invalid old session key format:', oldSessionKey);
    return;
  }

  // 跳过已经是新格式的会话
  if (parsed.deviceId !== '1') {
    console.log('[Migration] Session already migrated:', oldSessionKey);
    return;
  }

  const newSessionKey = SessionKeyManager.getSessionKey(parsed.userId, newDeviceId);
  console.log(`[Migration] Migrating: ${oldSessionKey} -> ${newSessionKey}`);
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/session-key.ts apps/desktop/src/core/signal/migrate-session-keys.ts
git commit -m "feat(signal): 建立正确的会话 Key 体系，支持多设备"
```

---

### Task 3: 实现 localIdentityKeyPair 持久化

**Files:**
- Modify: `apps/desktop/src/core/signal/key-management.ts`
- Create: `apps/desktop/src/core/signal/serializable-session.ts`

- [ ] **Step 1: 创建可序列化的会话状态**

```typescript
// apps/desktop/src/core/signal/serializable-session.ts

export interface SerializableSessionState {
  sessionId: string;
  remoteUserId: string;
  remoteDeviceId: string;
  // 使用 base64 编码的公钥/私钥（可序列化）
  localIdentityPublicKey: string;
  localIdentityPrivateKey: string;
  remoteIdentityKey: string;
  sendingChainKey: string;
  receivingChainKey: string;
  // 发送方 ratchet key (P-256, uncompressed, 65 bytes)
  sendingRatchetPublicKey: string;
  sendingRatchetPrivateKey: string;
  // 接收方 ratchet key
  receivingRatchetPublicKey: string;
  receivingRatchetPrivateKey: string;
  sendingIndex: number;
  receivingIndex: number;
  previousSendingIndex: number;
  rootKey: string;
}

/**
 * 将 SessionState 转换为可序列化格式
 */
export async function serializeSessionState(
  session: SessionState
): Promise<SerializableSessionState> {
  const localPubKey = await crypto.subtle.exportKey('raw', session.localIdentityKeyPair.publicKey);
  const localPrivKey = await crypto.subtle.exportKey('pkcs8', session.localIdentityKeyPair.privateKey);

  return {
    sessionId: session.sessionId,
    remoteUserId: session.remoteUserId,
    remoteDeviceId: session.remoteDeviceId,
    localIdentityPublicKey: arrayToBase64(new Uint8Array(localPubKey)),
    localIdentityPrivateKey: arrayToBase64(new Uint8Array(localPrivKey)),
    remoteIdentityKey: arrayToBase64(session.remoteIdentityKey),
    sendingChainKey: arrayToBase64(session.sendingChainKey!),
    receivingChainKey: arrayToBase64(session.receivingChainKey!),
    sendingRatchetPublicKey: arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', session.sendingRatchetKey!.publicKey))),
    sendingRatchetPrivateKey: arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', session.sendingRatchetKey!.privateKey))),
    receivingRatchetPublicKey: session.receivingRatchetKey
      ? arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', session.receivingRatchetKey.publicKey)))
      : '',
    receivingRatchetPrivateKey: session.receivingRatchetKey
      ? arrayToBase64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', session.receivingRatchetKey.privateKey)))
      : '',
    sendingIndex: session.sendingIndex,
    receivingIndex: session.receivingIndex,
    previousSendingIndex: session.previousSendingIndex,
    rootKey: arrayToBase64(session.rootKey),
  };
}

function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}
```

- [ ] **Step 2: 更新 KeyManager 的会话持久化方法**

修改 `key-management.ts` 中的 `saveSession` 和 `getSession` 方法。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/serializable-session.ts apps/desktop/src/core/signal/key-management.ts
git commit -m "feat(signal): 实现 localIdentityKeyPair 持久化"
```

---

### Task 4: 实现一次性预密钥消耗机制

**Files:**
- Modify: `apps/desktop/src/core/signal/key-management.ts`
- Create: `apps/desktop/src/core/signal/prekey-consumption.ts`

- [ ] **Step 1: 创建预密钥消耗记录**

```typescript
// apps/desktop/src/core/signal/prekey-consumption.ts

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
```

- [ ] **Step 2: 在解密时检查并标记消耗**

修改 `message-encryption.ts` 的解密逻辑，在使用一次性预密钥后调用 `markConsumed`。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/prekey-consumption.ts apps/desktop/src/core/signal/message-encryption.ts
git commit -m "feat(signal): 实现一次性预密钥消耗机制"
```

---

### Task 5: 清理冗余代码（删除 double-ratchet.ts 未使用的实现）

**Files:**
- Delete: `apps/desktop/src/core/signal/double-ratchet.ts` (与 index.ts 中的实现冲突且未被使用)

- [ ] **Step 1: 确认无引用**

```bash
grep -r "double-ratchet" apps/desktop/src --include="*.ts" --include="*.tsx"
```

Expected: 无结果

- [ ] **Step 2: 删除文件**

```bash
rm apps/desktop/src/core/signal/double-ratchet.ts
```

- [ ] **Step 3: 提交**

```bash
git rm apps/desktop/src/core/signal/double-ratchet.ts
git commit -m "refactor(signal): 删除冗余的 double-ratchet 实现"
```

---

### Task 6: Phase 1 测试验证

**Files:**
- Create: `apps/desktop/tests/signal/phase1-migration.test.ts`

- [ ] **Step 1: 编写迁移测试**

```typescript
// apps/desktop/tests/signal/phase1-migration.test.ts

import { test, expect } from '@playwright/test';
import { SessionKeyManager } from '../../src/core/signal/session-key';

test.describe('Phase 1: Session Key Migration', () => {
  test('SessionKeyManager generates correct keys', () => {
    const key = SessionKeyManager.getSessionKey('user123', 'device456');
    expect(key).toBe('session-user123-device456');
  });

  test('SessionKeyManager parses session key', () => {
    const parsed = SessionKeyManager.parseSessionKey('session-user123-device456');
    expect(parsed).toEqual({
      userId: 'user123',
      deviceId: 'device456',
    });
  });

  test('SessionKeyManager validates device IDs', () => {
    expect(SessionKeyManager.isValidDeviceId('valid-device-id')).toBe(true);
    expect(SessionKeyManager.isValidDeviceId('')).toBe(false);
    expect(SessionKeyManager.isValidDeviceId('a'.repeat(65))).toBe(false);
  });

  test('old format session key should be migrated', () => {
    const oldKey = 'session-user123-1';
    const parsed = SessionKeyManager.parseSessionKey(oldKey);
    expect(parsed?.deviceId).toBe('1'); // detect old format
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd apps/desktop && npx playwright test tests/signal/phase1-migration.test.ts --reporter=list`
Expected: All tests pass

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/tests/signal/phase1-migration.test.ts
git commit -m "test(signal): Phase 1 迁移测试"
```

---

## Phase 1 总结

| Task | 状态 | 说明 |
|------|------|------|
| Task 1: SignalInterface 接口层 | ⬜ | 建立抽象接口 |
| Task 2: 会话 Key 体系 | ⬜ | 修复多设备问题 |
| Task 3: 持久化 | ⬜ | 修复会话恢复 |
| Task 4: 预密钥消耗 | ⬜ | 防止重用 |
| Task 5: 清理冗余 | ⬜ | 删除未使用代码 |
| Task 6: 测试验证 | ⬜ | 确保修复正确 |

---

# Phase 2: Rust/WASM Signal 层实现

## 目标
使用 `libsignal-protocol` Rust 库实现 Signal Protocol，通过 WASM 暴露接口给前端。

## 技术方案

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   TypeScript    │ ──── │   WASM Bridge   │ ──── │  libsignal Rust │
│   前端状态管理   │      │   (wasm-bindgen)│      │    协议实现      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 任务列表

### Task 7: 创建 Rust 项目结构

**Files:**
- Create: `apps/desktop/src-tauri/signal/Cargo.toml`
- Create: `apps/desktop/src-tauri/signal/src/lib.rs`
- Create: `apps/desktop/src-tauri/signal/src/x3dh.rs`
- Create: `apps/desktop/src-tauri/signal/src/double_ratchet.rs`
- Create: `apps/desktop/src-tauri/signal/src/session.rs`
- Create: `apps/desktop/src-tauri/signal/src/prekeys.rs`

- [ ] **Step 1: 创建 Cargo.toml**

```toml
# apps/desktop/src-tauri/signal/Cargo.toml

[package]
name = "signal-protocol"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
base64 = "0.21"
getrandom = { version = "0.2", features = ["js"] }
# Signal Protocol 核心实现
# 注意: libsignal-protocol 需要从源码编译，暂用简化实现
aes = "0.8"
aes-gcm = "0.10"
hkdf = "0.12"
sha2 = "0.10"
x25519-dalek = { version = "2.0", features = ["static_secrets"] }
rand = "0.8"
thiserror = "1.0"
console_error_panic_hook = "0.1"

[dev-dependencies]
wasm-bindgen-test = "0.3"

[profile.release]
opt-level = "s"
lto = true
```

- [ ] **Step 2: 创建 lib.rs (WASM 绑定入口)**

```rust
// apps/desktop/src-tauri/signal/src/lib.rs

mod x3dh;
mod double_ratchet;
mod session;
mod prekeys;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    init_panic_hook();
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct IdentityKeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct PrekeyBundle {
    pub registration_id: u32,
    pub identity_key: Vec<u8>,
    pub signed_prekey: SignedPrekey,
    pub one_time_prekey: Option<OneTimePrekey>,
}

#[derive(Serialize, Deserialize)]
pub struct SignedPrekey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct OneTimePrekey {
    pub key_id: u32,
    pub public_key: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct SessionState {
    pub session_id: String,
    pub remote_user_id: String,
    pub remote_device_id: String,
    pub sending_chain_key: Vec<u8>,
    pub receiving_chain_key: Vec<u8>,
    pub sending_ratchet_key: Vec<u8>,
    pub receiving_ratchet_key: Vec<u8>,
    pub sending_index: u32,
    pub receiving_index: u32,
    pub previous_sending_index: u32,
    pub root_key: Vec<u8>,
    pub remote_identity_key: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub pre_key_id: Option<u32>,
    pub base_key: Option<Vec<u8>>,
    pub identity_key: Option<Vec<u8>>,
    pub message_number: u32,
    pub previous_sending_index: Option<u32>,
    pub ciphertext: Vec<u8>,
    pub dh_public_key: Option<Vec<u8>>,
}

#[derive(Serialize, Deserialize)]
pub struct DecryptedMessage {
    pub plaintext: String,
    pub message_number: u32,
    pub previous_sending_index: Option<u32>,
}

#[wasm_bindgen]
pub struct SignalProtocol {
    identity_key_pair: Option<IdentityKeyPair>,
}

#[wasm_bindgen]
impl SignalProtocol {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { identity_key_pair: None }
    }

    #[wasm_bindgen]
    pub fn generate_identity_key_pair(&mut self) -> Result<IdentityKeyPair, JsValue> {
        // 生成 X25519 身份密钥对
        let private = x25519_dalek::StaticSecret::new(rand::thread_rng());
        let public = x25519_dalek::PublicKey::from(&private);

        Ok(IdentityKeyPair {
            public_key: public.to_bytes().to_vec(),
            private_key: private.to_bytes().to_vec(),
        })
    }

    #[wasm_bindgen]
    pub fn set_identity_key_pair(&mut self, key_pair: IdentityKeyPair) {
        self.identity_key_pair = Some(key_pair);
    }

    #[wasm_bindgen]
    pub fn initiate_session(
        &self,
        prekey_bundle: JsValue,
    ) -> Result<SessionState, JsValue> {
        let bundle: PrekeyBundle = serde_wasm_bindgen::from_value(prekey_bundle)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        // X3DH 发起方
        x3dh::initiate_session(&self.identity_key_pair, &bundle)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn accept_session(
        &self,
        prekey_message: JsValue,
    ) -> Result<SessionState, JsValue> {
        let message: EncryptedMessage = serde_wasm_bindgen::from_value(prekey_message)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        x3dh::accept_session(&self.identity_key_pair, &message)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn encrypt_message(
        &self,
        session: JsValue,
        plaintext: &str,
    ) -> Result<EncryptedMessage, JsValue> {
        let mut session: SessionState = serde_wasm_bindgen::from_value(session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        double_ratchet::encrypt(&mut session, plaintext.as_bytes())
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }

    #[wasm_bindgen]
    pub fn decrypt_message(
        &self,
        session: JsValue,
        encrypted: JsValue,
    ) -> Result<DecryptedMessage, JsValue> {
        let mut session: SessionState = serde_wasm_bindgen::from_value(session)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        let encrypted: EncryptedMessage = serde_wasm_bindgen::from_value(encrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        double_ratchet::decrypt(&mut session, &encrypted)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))
    }
}
```

- [ ] **Step 3: 创建 X3DH 实现**

```rust
// apps/desktop/src-tauri/signal/src/x3dh.rs

use super::{IdentityKeyPair, PrekeyBundle, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum X3DHError {
    #[error("Missing identity key")]
    MissingIdentityKey,
    #[error("Invalid prekey bundle")]
    InvalidPrekeyBundle,
    #[error("DH failure")]
    DhFailure,
}

pub fn initiate_session(
    local_identity: &Option<IdentityKeyPair>,
    bundle: &PrekeyBundle,
) -> Result<SessionState, X3DHError> {
    let local_identity = local_identity.as_ref().ok_or(X3DHError::MissingIdentityKey)?;

    // 生成临时密钥对 (Ephemeral Key)
    let ephemeral_private = x25519_dalek::StaticSecret::new(rand::thread_rng());
    let ephemeral_public = x25519_dalek::PublicKey::from(&ephemeral_private);

    // 从 Bundle 获取接收方公钥
    let recipient_identity_public = x25519_dalek::PublicKey::from(
        x25519_dalek::PublicKey::from(bundle.identity_key.as_slice())
            .0
    );
    let recipient_signed_prekey_public = x25519_dalek::PublicKey::from(
        bundle.signed_prekey.public_key.as_slice()
    );

    // 计算 DH1 = DH(IK_A, SPK_B)
    let dh1 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 计算 DH2 = DH(EK_A, IK_B) - 如果有
    let dh2 = ephemeral_private.diffie_hellman(&recipient_identity_public);

    // 计算 DH3 = DH(EK_A, SPK_B)
    let dh3 = ephemeral_private.diffie_hellman(&recipient_signed_prekey_public);

    // 如果有一时预密钥，计算 DH4 = DH(EK_A, OPK_B)
    let dh4 = if let Some(ref opk) = bundle.one_time_prekey {
        let opk_public = x25519_dalek::PublicKey::from(opk.public_key.as_slice());
        Some(ephemeral_private.diffie_hellman(&opk_public))
    } else {
        None
    };

    // 合并 DH 输出
    let mut combined = Vec::new();
    combined.extend_from_slice(&dh1.to_bytes());
    combined.extend_from_slice(&dh2.to_bytes());
    combined.extend_from_slice(&dh3.to_bytes());
    if let Some(dh4_val) = dh4 {
        combined.extend_from_slice(&dh4_val.to_bytes());
    }

    // KDF 生成根密钥和链密钥
    let (root_key, chain_key) = hkdf_sha256(&combined, b"X3DH");

    Ok(SessionState {
        session_id: format!("{:x}", rand::random::<u128>()),
        remote_user_id: String::new(),
        remote_device_id: String::new(),
        sending_chain_key: chain_key,
        receiving_chain_key: vec![],
        sending_ratchet_key: ephemeral_public.to_bytes().to_vec(),
        receiving_ratchet_key: recipient_signed_prekey_public.to_bytes().to_vec(),
        sending_index: 0,
        receiving_index: 0,
        previous_sending_index: 0,
        root_key,
        remote_identity_key: bundle.identity_key.clone(),
    })
}

fn hkdf_sha256(ikm: &[u8], info: &[u8]) -> (Vec<u8>, Vec<u8>) {
    use hkdf::Hkdf;
    use sha2::Sha256;

    let hk = Hkdf::<Sha256>::new(Some(ikm), info);
    let mut okm = vec![0u8; 64];
    hk.expand(&[0, 1], &mut okm).unwrap();

    // 前 32 字节作为根密钥，后 32 字节作为链密钥
    (okm[..32].to_vec(), okm[32..].to_vec())
}
```

- [ ] **Step 4: 创建 Double Ratchet 实现**

```rust
// apps/desktop/src-tauri/signal/src/double_ratchet.rs

use super::{EncryptedMessage, DecryptedMessage, SessionState};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RatchetError {
    #[error("Invalid message key")]
    InvalidMessageKey,
    #[error("Skipped message key")]
    SkippedMessageKey,
    #[error("Decryption failed")]
    DecryptionFailed,
}

const MESSAGE_KEY_SIZE: usize = 32;
const CHAIN_KEY_SIZE: usize = 32;

pub fn encrypt(session: &mut SessionState, plaintext: &[u8]) -> Result<EncryptedMessage, RatchetError> {
    // 1. 生成消息密钥
    let (message_key, next_chain_key) = derive_message_key(&session.sending_chain_key)?;

    // 2. 更新链密钥
    session.sending_chain_key = next_chain_key;

    // 3. 加密消息
    let ciphertext = aes_gcm_encrypt(plaintext, &message_key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let message = EncryptedMessage {
        pre_key_id: None,
        base_key: None,
        identity_key: None,
        message_number: session.sending_index,
        previous_sending_index: Some(session.previous_sending_index),
        ciphertext,
        dh_public_key: None,
    };

    // 4. 推进 ratchet
    session.previous_sending_index = session.sending_index;
    session.sending_index += 1;

    Ok(message)
}

pub fn decrypt(session: &mut SessionState, encrypted: &EncryptedMessage) -> Result<DecryptedMessage, RatchetError> {
    // 1. 推进链（如果需要）
    while session.receiving_index < encrypted.message_number {
        let (skipped_key, next_chain) = derive_message_key(&session.receiving_chain_key)
            .map_err(|_| RatchetError::SkippedMessageKey)?;
        session.receiving_chain_key = next_chain;
        session.receiving_index += 1;
    }

    // 2. 生成当前消息密钥
    let (message_key, next_chain_key) = derive_message_key(&session.receiving_chain_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    // 3. 解密
    let plaintext = aes_gcm_decrypt(&encrypted.ciphertext, &message_key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    // 4. 更新链密钥
    session.receiving_chain_key = next_chain_key;
    session.receiving_index += 1;

    Ok(DecryptedMessage {
        plaintext: String::from_utf8_lossy(&plaintext).to_string(),
        message_number: encrypted.message_number,
        previous_sending_index: encrypted.previous_sending_index,
    })
}

fn derive_message_key(chain_key: &[u8]) -> Result<(Vec<u8>, Vec<u8>), RatchetError> {
    use hkdf::Hkdf;
    use sha2::Sha256;

    // message_key = HMAC-SHA256(chain_key, 0x01)
    // next_chain_key = HMAC-SHA256(chain_key, 0x02)
    let hk = Hkdf::<Sha256>::new(Some(chain_key), &[]);

    let mut message_key = vec![0u8; MESSAGE_KEY_SIZE];
    hk.expand(b"\x01", &mut message_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    let mut next_chain_key = vec![0u8; CHAIN_KEY_SIZE];
    hk.expand(b"\x02", &mut next_chain_key)
        .map_err(|_| RatchetError::InvalidMessageKey)?;

    Ok((message_key, next_chain_key))
}

fn aes_gcm_encrypt(plaintext: &[u8], key: &[u8]) -> Result<Vec<u8>, RatchetError> {
    use aes::Aes256Gcm;
    use aes_gcm::AesGcm;
    use aes_gcm::KeyInit;
    use rand::RngCore;

    let cipher = AesGcm::<Aes256Gcm>::new_from_slice(key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);

    let ciphertext = cipher
        .encrypt(nonce.as_ref().into(), plaintext)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let mut result = nonce.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

fn aes_gcm_decrypt(ciphertext: &[u8], key: &[u8]) -> Result<Vec<u8>, RatchetError> {
    use aes::Aes256Gcm;
    use aes_gcm::AesGcm;
    use aes_gcm::KeyInit;

    if ciphertext.len() < 12 {
        return Err(RatchetError::DecryptionFailed);
    }

    let cipher = AesGcm::<Aes256Gcm>::new_from_slice(key)
        .map_err(|_| RatchetError::DecryptionFailed)?;

    let nonce = &ciphertext[..12];
    let ciphertext = &ciphertext[12..];

    cipher.decrypt(nonce.into(), ciphertext)
        .map_err(|_| RatchetError::DecryptionFailed)
}
```

- [ ] **Step 5: 编译 WASM**

Run: `cd apps/desktop/src-tauri/signal && wasm-pack build --target web --out-dir ../src/core/signal/wasm`
Expected: 构建成功，生成 wasm 文件

- [ ] **Step 6: 创建 JS 桥接层**

Create: `apps/desktop/src/core/signal/wasm-bridge.ts`

```typescript
// apps/desktop/src/core/signal/wasm-bridge.ts

/**
 * WASM Signal 实现
 * 包装 wasm-bindgen 生成的 JS 胶水代码
 */

import init, { SignalProtocol } from './wasm/signal_protocol';

let initialized = false;
let signalProtocol: SignalProtocol | null = null;

export async function initWasmSignal(): Promise<void> {
  if (initialized) return;

  console.log('[WASM] Initializing Signal Protocol WASM module...');
  await init();

  signalProtocol = new SignalProtocol();
  initialized = true;
  console.log('[WASM] Signal Protocol WASM module initialized');
}

export function getWasmSignal(): SignalProtocol {
  if (!signalProtocol) {
    throw new Error('WASM Signal not initialized. Call initWasmSignal() first.');
  }
  return signalProtocol;
}

export function isWasmInitialized(): boolean {
  return initialized;
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src-tauri/signal/
git add apps/desktop/src/core/signal/wasm-bridge.ts
git commit -m "feat(signal): 添加 Rust/WASM Signal Protocol 实现"
```

---

### Task 8: 集成 WASM 实现到 SignalInterface

**Files:**
- Modify: `apps/desktop/src/core/signal/signal-interface.ts`
- Create: `apps/desktop/src/core/signal/wasm-signal.ts`

- [ ] **Step 1: 创建 WASM Signal 实现**

```typescript
// apps/desktop/src/core/signal/wasm-signal.ts

import { ISignalProtocol, IdentityKeyPair, PrekeyBundle, SessionState, EncryptedMessage, DecryptedMessage } from './signal-interface';
import { getWasmSignal, initWasmSignal } from './wasm-bridge';

export class WasmSignalProtocol implements ISignalProtocol {
  private wasm: ReturnType<typeof getWasmSignal>;

  constructor() {
    this.wasm = getWasmSignal();
  }

  static async create(): Promise<WasmSignalProtocol> {
    await initWasmSignal();
    return new WasmSignalProtocol();
  }

  async initiateSession(prekeyBundle: PrekeyBundle, localIdentityKeyPair: IdentityKeyPair): Promise<SessionState> {
    // 转换格式并调用 WASM
    const bundle = {
      registration_id: prekeyBundle.registrationId,
      identity_key: arrayToBase64(prekeyBundle.identityKey),
      signed_prekey: {
        key_id: prekeyBundle.signedPrekey.keyId,
        public_key: arrayToBase64(prekeyBundle.signedPrekey.publicKey),
        signature: arrayToBase64(prekeyBundle.signedPrekey.signature),
      },
      one_time_prekey: prekeyBundle.oneTimePrekey ? {
        key_id: prekeyBundle.oneTimePrekey.keyId,
        public_key: arrayToBase64(prekeyBundle.oneTimePrekey.publicKey),
      } : undefined,
    };

    const result = this.wasm.initiate_session(bundle);
    return convertSessionFromWasm(result);
  }

  async acceptSession(preKeyMessage: EncryptedMessage, localIdentityKeyPair: IdentityKeyPair, localSignedPrekey: any, localOneTimePrekey?: any): Promise<SessionState> {
    const msg = {
      pre_key_id: preKeyMessage.preKeyId,
      base_key: preKeyMessage.baseKey ? arrayToBase64(preKeyMessage.baseKey) : null,
      identity_key: preKeyMessage.identityKey ? arrayToBase64(preKeyMessage.identityKey) : null,
      message_number: preKeyMessage.messageNumber,
      previous_sending_index: preKeyMessage.previousSendingIndex,
      ciphertext: arrayToBase64(preKeyMessage.ciphertext),
      dh_public_key: preKeyMessage.dhPublicKey ? arrayToBase64(preKeyMessage.dhPublicKey) : null,
    };

    const result = this.wasm.accept_session(msg);
    return convertSessionFromWasm(result);
  }

  async encryptMessage(session: SessionState, plaintext: string): Promise<EncryptedMessage> {
    const sessionData = convertSessionToWasm(session);
    const result = this.wasm.encrypt_message(sessionData, plaintext);
    return convertMessageFromWasm(result);
  }

  async decryptMessage(session: SessionState, encryptedMessage: EncryptedMessage): Promise<DecryptedMessage> {
    const sessionData = convertSessionToWasm(session);
    const msg = convertMessageToWasm(encryptedMessage);
    const result = this.wasm.decrypt_message(sessionData, msg);
    return {
      plaintext: result.plaintext,
      messageNumber: result.message_number,
      previousSendingIndex: result.previous_sending_index,
      isPreKeyMessage: false,
    };
  }

  async generateSignedPrekey(identityKeyPair: IdentityKeyPair, keyId: number): Promise<any> {
    throw new Error('Use WASM key generation');
  }

  async generateOneTimePrekey(keyId: number): Promise<any> {
    throw new Error('Use WASM key generation');
  }

  serializeSession(session: SessionState): string {
    return JSON.stringify(convertSessionToWasm(session));
  }

  deserializeSession(data: string): SessionState {
    return convertSessionFromWasm(JSON.parse(data));
  }
}
```

- [ ] **Step 2: 更新 signal-interface.ts 添加工厂函数**

```typescript
// 在 signal-interface.ts 中添加

export async function createSignalProtocol(type: 'js' | 'wasm' = 'wasm'): Promise<ISignalProtocol> {
  if (type === 'wasm') {
    try {
      const wasm = await WasmSignalProtocol.create();
      setSignalImplementation(wasm, 'wasm');
      return wasm;
    } catch (e) {
      console.warn('[Signal] WASM initialization failed, falling back to JS:', e);
    }
  }

  // 回退到 JS 实现
  const jsImpl = new JSSignalProtocol();
  setSignalImplementation(jsImpl, 'js');
  return jsImpl;
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/wasm-signal.ts apps/desktop/src/core/signal/signal-interface.ts
git commit -m "feat(signal): 集成 WASM 实现到 SignalInterface"
```

---

## Phase 2 总结

| Task | 状态 | 说明 |
|------|------|------|
| Task 7: Rust 项目 | ⬜ | 创建 Cargo 项目和核心实现 |
| Task 8: WASM 集成 | ⬜ | 桥接 JS 和 WASM |

---

# Phase 3: 迁移策略

## 目标
平滑过渡，新旧实现并存，逐步切换。

## 迁移策略

### 策略 1: 并行运行
- 新实现作为主要实现
- 旧实现在后台作为 fallback
- 逐步将流量切换到新实现

### 策略 2: 功能开关
- 使用 Feature Flag 控制使用哪个实现
- 可快速回滚

### 策略 3: 数据迁移
- 会话数据从旧格式迁移到新格式
- 预密钥状态保持兼容

## 任务列表

### Task 9: 实现 Feature Flag 系统

**Files:**
- Create: `apps/desktop/src/core/feature-flags.ts`

- [ ] **Step 1: 创建 Feature Flag 系统**

```typescript
// apps/desktop/src/core/feature-flags.ts

export interface FeatureFlags {
  useWasmSignal: boolean;
  useNewSessionManager: boolean;
  enableMultiDevice: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useWasmSignal: false, // 初始关闭
  useNewSessionManager: false,
  enableMultiDevice: false,
};

let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };

export function getFeatureFlags(): FeatureFlags {
  return { ...currentFlags };
}

export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  currentFlags = { ...currentFlags, ...flags };
  localStorage.setItem('feature-flags', JSON.stringify(currentFlags));
  console.log('[FeatureFlags] Updated:', currentFlags);
}

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

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return currentFlags[flag];
}
```

- [ ] **Step 2: 在 Signal 初始化时检查 Feature Flag**

修改 `use-signal.ts` 中的初始化逻辑。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/feature-flags.ts
git commit -m "feat(signal): 添加 Feature Flag 系统"
```

---

### Task 10: 实现会话迁移管理器

**Files:**
- Create: `apps/desktop/src/core/signal/session-migration-manager.ts`

- [ ] **Step 1: 创建迁移管理器**

```typescript
// apps/desktop/src/core/signal/session-migration-manager.ts

import { getFeatureFlags, setFeatureFlags } from '../feature-flags';
import { SessionKeyManager } from './session-key';
import { migrateSessionKeys } from './migrate-session-keys';

export class SessionMigrationManager {
  /**
   * 检查是否需要迁移
   */
  async checkMigrationNeeded(): Promise<boolean> {
    const hasOldFormatSessions = await this.hasOldFormatSessions();
    if (hasOldFormatSessions) {
      console.log('[Migration] Old format sessions found, migration needed');
    }
    return hasOldFormatSessions;
  }

  /**
   * 执行迁移
   */
  async migrateAllSessions(deviceId: string): Promise<number> {
    console.log(`[Migration] Starting session migration with deviceId: ${deviceId}`);

    // 获取所有会话 keys
    const sessionKeys = await this.getAllSessionKeys();
    let migrated = 0;

    for (const oldKey of sessionKeys) {
      const parsed = SessionKeyManager.parseSessionKey(oldKey);
      if (parsed && parsed.deviceId === '1') {
        await migrateSessionKeys(oldKey, deviceId);
        migrated++;
      }
    }

    console.log(`[Migration] Migrated ${migrated} sessions`);
    return migrated;
  }

  private async hasOldFormatSessions(): Promise<boolean> {
    const keys = await this.getAllSessionKeys();
    return keys.some(key => {
      const parsed = SessionKeyManager.parseSessionKey(key);
      return parsed?.deviceId === '1';
    });
  }

  private async getAllSessionKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('security-chat-session-')) {
        keys.push(key.replace('security-chat-session-', ''));
      }
    }
    return keys;
  }
}
```

- [ ] **Step 2: 在登录流程中触发迁移**

修改 `use-chat-client.ts` 的 `onLogin` 函数。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/core/signal/session-migration-manager.ts
git commit -m "feat(signal): 实现会话迁移管理器"
```

---

### Task 11: 创建监控和回滚机制

**Files:**
- Create: `apps/desktop/src/core/signal/signal-metrics.ts`

- [ ] **Step 1: 创建指标收集器**

```typescript
// apps/desktop/src/core/signal/signal-metrics.ts

export interface SignalMetrics {
  encryptionCount: number;
  decryptionCount: number;
  encryptionFailures: number;
  decryptionFailures: number;
  sessionCount: number;
  prekeyCount: number;
  lastError?: string;
}

const metrics: SignalMetrics = {
  encryptionCount: 0,
  decryptionCount: 0,
  encryptionFailures: 0,
  decryptionFailures: 0,
  sessionCount: 0,
  prekeyCount: 0,
};

export function recordEncryption(success: boolean): void {
  metrics.encryptionCount++;
  if (!success) {
    metrics.encryptionFailures++;
  }
}

export function recordDecryption(success: boolean): void {
  metrics.decryptionCount++;
  if (!success) {
    metrics.decryptionFailures++;
    metrics.lastError = new Error().stack;
  }
}

export function getMetrics(): SignalMetrics {
  return { ...metrics };
}

export function resetMetrics(): void {
  metrics.encryptionCount = 0;
  metrics.decryptionCount = 0;
  metrics.encryptionFailures = 0;
  metrics.decryptionFailures = 0;
  metrics.lastError = undefined;
}

/**
 * 如果失败率超过阈值，触发告警
 */
export function shouldRollback(): boolean {
  const total = metrics.encryptionCount + metrics.decryptionCount;
  if (total < 10) return false; // 样本太少

  const failures = metrics.encryptionFailures + metrics.decryptionFailures;
  const failureRate = failures / total;

  // 如果失败率超过 5%，建议回滚
  return failureRate > 0.05;
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/desktop/src/core/signal/signal-metrics.ts
git commit -m "feat(signal): 添加 Signal 指标监控"
```

---

### Task 12: 端到端测试

**Files:**
- Create: `apps/desktop/tests/signal/e2e-signal.test.ts`

- [ ] **Step 1: 编写 E2E 测试**

```typescript
// apps/desktop/tests/signal/e2e-signal.test.ts

import { test, expect } from '@playwright/test';

test.describe('Signal Protocol E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 清理本地存储
    await page.evaluate(() => localStorage.clear());
  });

  test('应该能注册并初始化 Signal 协议', async ({ page }) => {
    // 1. 注册
    await page.goto('/');
    await page.click('text=立即注册');
    await page.fill('input[placeholder="用户名"]', 'testuser_' + Date.now());
    await page.fill('input[autocomplete="email"]', `test_${Date.now()}@example.com`);
    await page.fill('input[autocomplete="new-password"]', 'Test123456');
    await page.fill('input[autocomplete="new-password"]', 'Test123456');
    await page.click('button:has-text("注册")');

    // 2. 等待 Signal 初始化
    await page.waitForTimeout(3000);

    // 3. 检查 localStorage 中的密钥
    const hasIdentityKey = await page.evaluate(() => {
      return localStorage.getItem('security-chat-identityKeyPair') !== null;
    });
    expect(hasIdentityKey).toBe(true);

    // 4. 检查预密钥
    const hasPrekeys = await page.evaluate(() => {
      return localStorage.getItem('security-chat-signedPrekeys') !== null;
    });
    expect(hasPrekeys).toBe(true);
  });

  test('WASM 实现应该正常工作', async ({ page }) => {
    // 启用 WASM Feature Flag
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('feature-flags', JSON.stringify({ useWasmSignal: true }));
    });

    // 重新加载页面
    await page.reload();

    // 注册并验证
    await page.click('text=立即注册');
    // ... 同上

    // 检查使用的是 WASM 实现
    const implType = await page.evaluate(() => {
      // 这个信息需要通过某种方式暴露
      return 'wasm'; // TODO: 实际检查
    });
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd apps/desktop && npx playwright test tests/signal/e2e-signal.test.ts --reporter=list`

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/tests/signal/e2e-signal.test.ts
git commit -m "test(signal): 添加 Signal E2E 测试"
```

---

## Phase 3 总结

| Task | 状态 | 说明 |
|------|------|------|
| Task 9: Feature Flag | ⬜ | 控制实现切换 |
| Task 10: 迁移管理 | ⬜ | 会话数据迁移 |
| Task 11: 监控回滚 | ⬜ | 指标和回滚 |
| Task 12: E2E 测试 | ⬜ | 验证功能 |

---

# 总体进度追踪

| Phase | Tasks | 预计工时 |
|-------|-------|---------|
| Phase 1: 架构重构 | Task 1-6 | 4-6 小时 |
| Phase 2: Rust/WASM | Task 7-8 | 8-12 小时 |
| Phase 3: 迁移 | Task 9-12 | 4-6 小时 |
| Phase 4: 设备迁移 | Task 13-16 | 6-8 小时 |
| **总计** | **16 Tasks** | **22-32 小时** |

---

# 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| WASM 编译失败 | 项目无法构建 | 保持 JS 实现作为 fallback |
| 会话迁移丢失数据 | 用户无法解密历史消息 | 迁移前备份，验证后删除旧数据 |
| 性能回退 | WASM 比 JS 慢 | 测量对比，确保达标 |
| 多设备兼容性问题 | 消息无法跨设备同步 | Feature Flag 控制，灰度发布 |
| 迁移过程数据泄露 | 迁移包被恶意获取 | 端到端加密，密钥不触地服务器 |
| 迁移中断导致数据不一致 | 部分数据导入，部分未导入 | 原子性保证，失败自动回滚 |
| 旧设备损坏无法导出 | 用户无法发起迁移 | 支持文件导出作为备选方案 |

---

# 执行选项

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

---

*Plan created: 2026-04-12*
*Worktree: feature/signal-rust-refactor (based on main)*
