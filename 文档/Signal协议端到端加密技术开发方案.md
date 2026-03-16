# Signal协议端到端加密技术开发方案

## 文档信息
- **文档版本**: v1.0
- **创建日期**: 2026-03-15
- **项目名称**: Security Chat - Signal协议端到端加密升级
- **技术架构**: React Native + Tauri + NestJS + PostgreSQL + Redis

---

## 1. 项目背景与目标

### 1.1 当前加密机制分析
当前项目采用基于用户密码的PBKDF2密钥派生机制：
- **加密算法**: AES-GCM 256位
- **密钥派生**: PBKDF2从用户密码派生，100,000次迭代
- **密钥管理**: 内存缓存，无跨设备同步
- **消息格式**: `iv:ciphertext`
- **安全限制**: 服务器可访问加密内容，非真正的端到端加密

### 1.2 升级目标
实现真正的端到端加密(E2EE)，达到以下安全标准：
- **服务器零知识**: 服务器无法解密任何消息内容
- **前向保密**: 密钥泄露不影响历史消息安全
- **后向保密**: 密钥更新后旧密钥失效
- **多设备支持**: 支持跨设备密钥同步和消息解密
- **安全验证**: 提供密钥指纹验证机制

### 1.3 技术选择
采用Signal协议作为端到端加密方案，原因：
- **成熟性**: Signal协议经过广泛验证，安全性有保障
- **标准化**: 已成为端到端加密的事实标准
- **开源实现**: 有成熟的JavaScript实现库
- **功能完整**: 支持单聊、群聊、多设备等完整场景

---

## 2. Signal协议概述

### 2.1 协议组成
Signal协议包含三个核心组件：

#### 2.1.1 X3DH密钥交换协议
- **身份密钥对**: 长期使用的密钥对，用于身份验证
- **签名预密钥**: 中期密钥对，定期轮换（如每周）
- **一次性预密钥**: 短期密钥对，用完即弃
- **初始消息密钥**: 首次通信时派生的会话密钥

#### 2.1.2 Double Ratchet算法
- **对称密钥派生**: 每次消息派生新的发送和接收密钥链
- **Diffie-Hellman密钥交换**: 每条消息包含新的DH公钥
- **前向保密**: 发送密钥链在每次发送后推进
- **后向保密**: 接收密钥链在每次接收后推进

#### 2.1.3 密钥管理
- **预密钥包**: 服务器存储的公钥集合，用于密钥交换
- **会话状态**: 本地维护的会话信息和密钥链状态
- **密钥轮换**: 定期更新密钥对，保持安全性
- **设备同步**: 多设备间的密钥同步机制

### 2.2 加密流程
1. **初始密钥交换**: 使用X3DH协议建立初始会话密钥
2. **消息加密**: 使用Double Ratchet算法加密每条消息
3. **密钥更新**: 每条消息后自动更新密钥链
4. **会话维护**: 定期更新预密钥，保持会话活跃

---

## 3. 技术架构设计

### 3.1 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
├─────────────────┬─────────────────┬─────────────────────────┤
│   移动端        │   桌面端        │   共享模块               │
│  (React Native) │  (Tauri+React)  │  (核心加密逻辑)          │
├─────────────────┴─────────────────┴─────────────────────────┤
│  Signal协议实现  │  密钥管理  │  会话状态  │  消息加密/解密   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        网络层                                │
│                    TLS 1.3 加密传输                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        服务端层                              │
├─────────────────┬─────────────────┬─────────────────────────┤
│   API网关       │   WebSocket     │   业务逻辑              │
├─────────────────┴─────────────────┴─────────────────────────┤
│  预密钥管理  │  消息转发  │  设备管理  │  会话管理          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────┬─────────────────┬─────────────────────────┐
│   PostgreSQL    │     Redis       │   对象存储              │
│   (业务数据)    │   (缓存/状态)    │   (媒体文件)            │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 3.1.1 移动端支持策略
**当前状态**: 移动端暂不开发，仅作为未来扩展考虑

**技术准备**:
- **共享核心加密逻辑**: 将加密核心逻辑抽象为独立包，便于移动端复用
- **跨平台接口设计**: 定义统一的加密接口，支持不同平台实现
- **移动端技术选型**: 预留React Native + 原生模块桥接方案

**未来扩展**:
- **Android**: 通过JNI调用Rust实现的libsignal-client
- **iOS**: 通过C接口调用Rust实现的libsignal-client
- **React Native**: 创建原生模块桥接加密功能

### 3.2 模块划分

#### 3.2.1 前端模块
- **crypto/signal**: Signal协议实现
- **crypto/key-management**: 密钥生成、存储、管理
- **crypto/session-management**: 会话状态管理
- **api/encryption**: 加密相关API调用
- **state/signal**: Signal协议相关状态管理

#### 3.2.2 后端模块
- **modules/keys**: 预密钥管理
- **modules/sessions**: 会话状态管理
- **modules/devices**: 设备管理和同步
- **modules/encryption**: 加密服务支持

### 3.3 技术栈选择

#### 3.3.1 加密库
- **前端**: `@signalapp/libsignal-client` 或 `libsignal`
- **后端**: `@signalapp/libsignal-client` (Node.js版本)

#### 3.3.2 存储方案
- **密钥存储**: 
  - iOS: Keychain
  - Android: Keystore
  - macOS: Keychain
  - Windows: Credential Vault
- **会话状态**: 本地加密数据库 (SQLCipher)

#### 3.3.3 网络协议
- **传输层**: TLS 1.3
- **应用层**: WebSocket + HTTP API
- **消息格式**: Protocol Buffers (可选) 或 JSON

---

## 4. 密钥管理方案

### 4.1 密钥类型与生命周期

#### 4.1.1 身份密钥对 (Identity Key Pair)
- **生成时机**: 用户注册时生成
- **存储位置**: 本地安全存储 + 服务器公钥
- **生命周期**: 长期使用，除非用户主动重置
- **用途**: 身份验证，密钥指纹生成

#### 4.1.2 签名预密钥 (Signed Prekey)
- **生成时机**: 注册时生成，之后定期轮换
- **存储位置**: 本地安全存储 + 服务器公钥
- **生命周期**: 中期使用（建议1-2周轮换）
- **用途**: 初始密钥交换，身份验证

#### 4.1.3 一次性预密钥 (One-time Prekey)
- **生成时机**: 注册时批量生成（如100个），定期补充
- **存储位置**: 本地安全存储 + 服务器公钥
- **生命周期**: 短期使用，用完即弃
- **用途**: 初始密钥交换，增强前向保密

#### 4.1.4 会话密钥 (Session Key)
- **生成时机**: 建立会话时通过X3DH派生
- **存储位置**: 本地安全存储
- **生命周期**: 会话期间，通过Double Ratchet更新
- **用途**: 消息加密解密

### 4.2 密钥生成流程

#### 4.2.1 用户注册时
```typescript
async function generateIdentityKeys(): Promise<IdentityKeyPair> {
  const identityKeyPair = await Signal.IdentityKeyPair.generate();
  return identityKeyPair;
}

async function generateSignedPrekeys(
  identityKeyPair: IdentityKeyPair,
  count: number = 100
): Promise<SignedPrekey[]> {
  const signedPrekeys = [];
  for (let i = 0; i < count; i++) {
    const signedPrekey = await Signal.SignedPrekey.generate(
      identityKeyPair,
      i + 1
    );
    signedPrekeys.push(signedPrekey);
  }
  return signedPrekeys;
}

async function generateOneTimePrekeys(
  count: number = 100
): Promise<OneTimePrekey[]> {
  const oneTimePrekeys = [];
  for (let i = 0; i < count; i++) {
    const oneTimePrekey = await Signal.OneTimePrekey.generate(i + 1);
    oneTimePrekeys.push(oneTimePrekey);
  }
  return oneTimePrekeys;
}
```

#### 4.2.2 密钥轮换
```typescript
async function rotateSignedPrekey(
  identityKeyPair: IdentityKeyPair
): Promise<SignedPrekey> {
  const newSignedPrekey = await Signal.SignedPrekey.generate(
    identityKeyPair,
    Date.now()
  );
  return newSignedPrekey;
}

async function replenishOneTimePrekeys(
  targetCount: number = 100
): Promise<OneTimePrekey[]> {
  const currentCount = await getStoredOneTimePrekeyCount();
  const neededCount = Math.max(0, targetCount - currentCount);
  
  if (neededCount > 0) {
    return await generateOneTimePrekeys(neededCount);
  }
  return [];
}
```

### 4.3 密钥存储方案

#### 4.3.1 本地存储结构
```typescript
interface LocalKeyStore {
  identityKeyPair: IdentityKeyPair;
  registrationId: number;
  signedPrekeys: Map<number, SignedPrekey>;
  oneTimePrekeys: Map<number, OneTimePrekey>;
  sessions: Map<string, SessionState>;
}

interface SessionState {
  remoteIdentityKey: PublicKey;
  sendingChain: KeyChain;
  receivingChain: KeyChain;
  rootKey: Buffer;
  previousChainLength: number;
}
```

#### 4.3.2 服务器存储结构
```sql
-- 身份密钥存储
ALTER TABLE users ADD COLUMN identity_public_key TEXT NOT NULL;
ALTER TABLE users ADD COLUMN identity_key_fingerprint TEXT NOT NULL;

-- 预密钥存储
CREATE TABLE prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  key_type SMALLINT NOT NULL, -- 1: signed, 2: one-time
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  signature TEXT, -- 签名预密钥的签名
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id, key_type, key_id)
);

CREATE INDEX idx_prekeys_user_device ON prekeys(user_id, device_id, is_used);
CREATE INDEX idx_prekeys_unused ON prekeys(is_used) WHERE is_used = FALSE;
```

### 4.4 密钥指纹验证

#### 4.4.1 指纹生成
```typescript
async function generateKeyFingerprint(
  identityKey: PublicKey
): Promise<string> {
  const fingerprint = await Signal.KeyFingerprint.create(
    'security-chat',
    identityKey
  );
  return fingerprint.displayString();
}

// 格式: 60位数字，分为5组，每组12位
// 示例: 123456789012 345678901234 567890123456 789012345678 901234567890
```

#### 4.4.2 验证流程
1. 用户A获取用户B的身份公钥
2. 双方通过安全渠道（如面对面、视频通话）比对指纹
3. 确认指纹一致后，标记为"已验证"
4. 后续通信时显示验证状态

### 4.5 密钥备份机制

#### 4.5.1 备份策略
- **可选备份**: 由用户自主选择是否备份
- **加密备份**: 使用用户提供的密码或助记词加密
- **跨设备恢复**: 支持在新设备上恢复密钥

#### 4.5.2 实现方式
```typescript
class KeyBackupManager {
  private keyManager: KeyManager;
  
  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
  }
  
  async exportEncryptedBackup(password: string): Promise<string> {
    const identityKeyPair = await this.keyManager.getIdentityKeyPair();
    const signedPrekeys = await this.keyManager.getSignedPrekeys();
    const oneTimePrekeys = await this.keyManager.getOneTimePrekeys();
    
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      identityKeyPair,
      signedPrekeys,
      oneTimePrekeys,
      salt: crypto.randomBytes(16).toString('hex')
    };
    
    const encrypted = await this.encryptBackup(backupData, password);
    return btoa(JSON.stringify(encrypted));
  }
  
  async importEncryptedBackup(backup: string, password: string): Promise<void> {
    const encrypted = JSON.parse(atob(backup));
    const backupData = await this.decryptBackup(encrypted, password);
    
    await this.keyManager.restoreFromBackup(backupData);
  }
  
  private async encryptBackup(data: any, password: string): Promise<any> {
    // 使用PBKDF2派生密钥，AES-GCM加密
  }
  
  private async decryptBackup(encrypted: any, password: string): Promise<any> {
    // 解密备份数据
  }
}
```

#### 4.5.3 恢复流程
1. 用户在新设备上选择"从备份恢复"
2. 输入备份密码或助记词
3. 系统解密并恢复密钥数据
4. 验证恢复的密钥有效性

### 4.6 预密钥管理策略

#### 4.6.1 补充触发条件
- **定时检查**: 每天定时检查预密钥数量
- **启动检查**: 应用启动时检查
- **发送前检查**: 发送消息前异步检查（不阻塞）
- **阈值触发**: 当一次性预密钥数量低于20个时补充

#### 4.6.2 实现策略
```typescript
class PrekeyManager {
  private readonly MIN_PREKEY_COUNT = 20;
  private readonly TARGET_PREKEY_COUNT = 100;
  private keyManager: KeyManager;
  
  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
    this.setupChecks();
  }
  
  private setupChecks(): void {
    // 启动时检查
    this.checkAndReplenish();
    
    // 每天检查
    setInterval(() => this.checkAndReplenish(), 24 * 60 * 60 * 1000);
  }
  
  async checkAndReplenish(): Promise<void> {
    try {
      const currentCount = await this.getUnusedPrekeyCount();
      if (currentCount < this.MIN_PREKEY_COUNT) {
        const needed = this.TARGET_PREKEY_COUNT - currentCount;
        await this.generateAndUpload(needed);
      }
    } catch (error) {
      console.error('Failed to replenish prekeys:', error);
    }
  }
  
  private async getUnusedPrekeyCount(): Promise<number> {
    // 获取未使用的一次性预密钥数量
    return 0;
  }
  
  private async generateAndUpload(count: number): Promise<void> {
    // 生成并上传新的预密钥
  }
  
  // 发送消息前调用（异步）
  async ensurePrekeysAvailable(): Promise<void> {
    this.checkAndReplenish();
  }
}
```

---

## 5. 消息加密流程

### 5.1 初始会话建立 (X3DH)

#### 5.1.1 发送方流程
```typescript
async function initiateSession(
  recipientUserId: string,
  recipientDeviceId: string
): Promise<SessionState> {
  const prekeyBundle = await fetchPrekeyBundle(
    recipientUserId,
    recipientDeviceId
  );
  
  const ephemeralKeyPair = await Signal.KeyPair.generate();
  
  const initialSecret = await Signal.X3DH.calculateAgreement(
    ephemeralKeyPair,
    prekeyBundle
  );
  
  const rootKey = await Signal.HKDF.derive(
    initialSecret,
    'root_key'
  );
  const chainKey = await Signal.HKDF.derive(
    initialSecret,
    'chain_key'
  );
  
  const session: SessionState = {
    remoteIdentityKey: prekeyBundle.identityKey,
    sendingChain: {
      key: chainKey,
      index: 0
    },
    receivingChain: null,
    rootKey: rootKey,
    previousChainLength: 0
  };
  
  await storeSession(recipientUserId, recipientDeviceId, session);
  
  return session;
}
```

#### 5.1.2 接收方流程
```typescript
async function acceptSession(
  senderUserId: string,
  senderDeviceId: string,
  initialMessage: InitialMessage
): Promise<SessionState> {
  const senderIdentityKey = await fetchIdentityKey(senderUserId);
  
  const signedPrekey = await getSignedPrekey(initialMessage.signedPreKeyId);
  const oneTimePrekey = initialMessage.oneTimePreKeyId 
    ? await getOneTimePrekey(initialMessage.oneTimePreKeyId)
    : null;
  
  const initialSecret = await Signal.X3DH.calculateAgreement(
    initialMessage.ephemeralPublicKey,
    signedPrekey,
    oneTimePrekey
  );
  
  const rootKey = await Signal.HKDF.derive(
    initialSecret,
    'root_key'
  );
  const chainKey = await Signal.HKDF.derive(
    initialSecret,
    'chain_key'
  );
  
  const session: SessionState = {
    remoteIdentityKey: senderIdentityKey,
    sendingChain: null,
    receivingChain: {
      key: chainKey,
      index: 0
    },
    rootKey: rootKey,
    previousChainLength: 0
  };
  
  await markPrekeyAsUsed(initialMessage.signedPreKeyId);
  if (oneTimePrekey) {
    await markPrekeyAsUsed(initialMessage.oneTimePreKeyId);
  }
  
  await storeSession(senderUserId, senderDeviceId, session);
  
  return session;
}
```

### 5.2 消息加密 (Double Ratchet)

#### 5.2.1 单聊消息加密
```typescript
async function encryptMessage(
  recipientUserId: string,
  recipientDeviceId: string,
  plaintext: string
): Promise<EncryptedMessage> {
  let session = await getSession(recipientUserId, recipientDeviceId);
  if (!session) {
    session = await initiateSession(recipientUserId, recipientDeviceId);
  }
  
  const messageKey = await Signal.DoubleRatchet.sendMessageKey(
    session.sendingChain
  );
  
  const ciphertext = await Signal.AESGCM.encrypt(
    plaintext,
    messageKey
  );
  
  const newDHKeyPair = await Signal.KeyPair.generate();
  const newRootKey = await Signal.DoubleRatchet.dhRatchet(
    session.rootKey,
    newDHKeyPair,
    session.remoteIdentityKey
  );
  
  session.sendingChain.key = await Signal.DoubleRatchet.nextChainKey(
    session.sendingChain.key
  );
  session.sendingChain.index++;
  session.rootKey = newRootKey;
  
  await storeSession(recipientUserId, recipientDeviceId, session);
  
  return {
    version: 3,
    registrationId: await getRegistrationId(),
    preKeyId: session.sendingChain.preKeyId,
    signedPreKeyId: session.sendingChain.signedPreKeyId,
    baseKey: session.sendingChain.baseKey,
    identityKey: await getIdentityPublicKey(),
    messageNumber: session.sendingChain.index,
    previousChainLength: session.previousChainLength,
    ciphertext: ciphertext,
    dhPublicKey: newDHKeyPair.publicKey
  };
}
```

#### 5.2.2 单聊消息解密
```typescript
async function decryptMessage(
  senderUserId: string,
  senderDeviceId: string,
  encryptedMessage: EncryptedMessage
): Promise<string> {
  let session = await getSession(senderUserId, senderDeviceId);
  if (!session) {
    session = await acceptSession(
      senderUserId,
      senderDeviceId,
      encryptedMessage
    );
  }
  
  const messageKey = await Signal.DoubleRatchet.receiveMessageKey(
    session.receivingChain,
    encryptedMessage.messageNumber
  );
  
  const plaintext = await Signal.AESGCM.decrypt(
    encryptedMessage.ciphertext,
    messageKey
  );
  
  if (encryptedMessage.dhPublicKey) {
    const newRootKey = await Signal.DoubleRatchet.dhRatchet(
      session.rootKey,
      await getLocalDHKeyPair(),
      encryptedMessage.dhPublicKey
    );
    session.rootKey = newRootKey;
  }
  
  session.receivingChain.key = await Signal.DoubleRatchet.nextChainKey(
    session.receivingChain.key
  );
  session.receivingChain.index++;
  
  await storeSession(senderUserId, senderDeviceId, session);
  
  return plaintext;
}
```

### 5.3 消息格式

#### 5.3.1 单聊加密消息结构
```typescript
interface EncryptedMessage {
  version: number;
  registrationId: number;
  preKeyId?: number;
  signedPreKeyId: number;
  baseKey: string;
  identityKey: string;
  messageNumber: number;
  previousChainLength: number;
  ciphertext: string;
  dhPublicKey?: string;
}

interface SignalEnvelope {
  type: number;
  version: number;
  sourceDeviceId: number;
  sourceRegistrationId: number;
  destinationRegistrationId: number;
  message: EncryptedMessage;
}
```

#### 5.3.2 群聊加密消息结构
```typescript
interface GroupEncryptedMessage {
  version: number;
  groupId: string;
  senderKeyId: number;
  senderKey: string;
  messageNumber: number;
  ciphertext: string;
  signature: string;
}

interface GroupSignalEnvelope {
  type: number;
  version: number;
  sourceDeviceId: number;
  sourceRegistrationId: number;
  groupId: string;
  message: GroupEncryptedMessage;
}
```

#### 5.3.3 传输格式
```json
{
  "type": 3,
  "version": 3,
  "sourceDeviceId": 1,
  "sourceRegistrationId": 12345,
  "destinationRegistrationId": 67890,
  "message": {
    "version": 3,
    "registrationId": 12345,
    "signedPreKeyId": 1,
    "baseKey": "BASE64_ENCODED_KEY",
    "identityKey": "BASE64_ENCODED_KEY",
    "messageNumber": 42,
    "previousChainLength": 0,
    "ciphertext": "BASE64_ENCODED_CIPHERTEXT",
    "dhPublicKey": "BASE64_ENCODED_DH_KEY"
  }
}
```

### 5.4 群聊加密 (Sender Keys)

#### 5.4.1 群聊密钥管理
```typescript
class GroupKeyManager {
  private groupSessions: Map<string, GroupSession> = new Map();
  
  async createGroupSession(groupId: string, members: string[]): Promise<GroupSession> {
    const senderKeyPair = await Signal.KeyPair.generate();
    const groupSession: GroupSession = {
      groupId,
      senderKeyPair,
      distributionKeys: new Map(),
      messageCounter: 0
    };
    
    // 为每个成员生成分发密钥
    for (const memberId of members) {
      const memberSession = await getSession(memberId);
      if (memberSession) {
        const distributionKey = await this.generateDistributionKey(
          senderKeyPair.privateKey,
          memberSession.remoteIdentityKey
        );
        groupSession.distributionKeys.set(memberId, distributionKey);
      }
    }
    
    this.groupSessions.set(groupId, groupSession);
    return groupSession;
  }
  
  async encryptGroupMessage(groupId: string, plaintext: string): Promise<GroupEncryptedMessage> {
    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession) {
      throw new Error('Group session not found');
    }
    
    const messageKey = await this.deriveMessageKey(
      groupSession.senderKeyPair.privateKey,
      groupSession.messageCounter
    );
    
    const ciphertext = await Signal.AESGCM.encrypt(plaintext, messageKey);
    const signature = await this.signMessage(
      groupSession.senderKeyPair.privateKey,
      ciphertext
    );
    
    groupSession.messageCounter++;
    await this.saveGroupSession(groupId, groupSession);
    
    return {
      version: 3,
      groupId,
      senderKeyId: 1, // 简化处理，实际应使用唯一ID
      senderKey: groupSession.senderKeyPair.publicKey,
      messageNumber: groupSession.messageCounter,
      ciphertext,
      signature
    };
  }
  
  async decryptGroupMessage(
    groupId: string,
    encryptedMessage: GroupEncryptedMessage
  ): Promise<string> {
    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession) {
      // 首次接收群消息，需要从其他成员获取群密钥
      throw new Error('Group session not initialized');
    }
    
    // 验证签名
    const isValid = await this.verifySignature(
      encryptedMessage.senderKey,
      encryptedMessage.ciphertext,
      encryptedMessage.signature
    );
    
    if (!isValid) {
      throw new Error('Invalid message signature');
    }
    
    // 派生消息密钥并解密
    const messageKey = await this.deriveMessageKey(
      groupSession.senderKeyPair.privateKey,
      encryptedMessage.messageNumber
    );
    
    return await Signal.AESGCM.decrypt(
      encryptedMessage.ciphertext,
      messageKey
    );
  }
  
  async addMember(groupId: string, memberId: string): Promise<void> {
    const groupSession = this.groupSessions.get(groupId);
    if (!groupSession) {
      throw new Error('Group session not found');
    }
    
    const memberSession = await getSession(memberId);
    if (memberSession) {
      const distributionKey = await this.generateDistributionKey(
        groupSession.senderKeyPair.privateKey,
        memberSession.remoteIdentityKey
      );
      groupSession.distributionKeys.set(memberId, distributionKey);
      await this.saveGroupSession(groupId, groupSession);
    }
  }
  
  async removeMember(groupId: string, memberId: string): Promise<void> {
    const groupSession = this.groupSessions.get(groupId);
    if (groupSession) {
      groupSession.distributionKeys.delete(memberId);
      // 生成新的群密钥以确保前成员无法解密新消息
      await this.rotateGroupKey(groupId);
    }
  }
  
  private async rotateGroupKey(groupId: string): Promise<void> {
    const groupSession = this.groupSessions.get(groupId);
    if (groupSession) {
      const newSenderKeyPair = await Signal.KeyPair.generate();
      groupSession.senderKeyPair = newSenderKeyPair;
      groupSession.messageCounter = 0;
      await this.saveGroupSession(groupId, groupSession);
    }
  }
  
  private async saveGroupSession(groupId: string, session: GroupSession): Promise<void> {
    // 保存到本地存储
  }
  
  private async generateDistributionKey(privateKey: string, publicKey: string): Promise<string> {
    // 生成安全的分发密钥
  }
  
  private async deriveMessageKey(privateKey: string, counter: number): Promise<string> {
    // 从群密钥派生消息密钥
  }
  
  private async signMessage(privateKey: string, message: string): Promise<string> {
    // 签名消息
  }
  
  private async verifySignature(publicKey: string, message: string, signature: string): Promise<boolean> {
    // 验证签名
  }
}

interface GroupSession {
  groupId: string;
  senderKeyPair: KeyPair;
  distributionKeys: Map<string, string>;
  messageCounter: number;
}
```

#### 5.4.2 群聊消息流程
1. **创建群聊**：生成群聊密钥对，为每个成员生成分发密钥
2. **发送消息**：使用群聊密钥加密，增加消息计数器
3. **接收消息**：验证签名，使用群聊密钥解密
4. **成员变动**：添加成员时生成新的分发密钥，移除成员时轮换群聊密钥

---

## 6. 数据库设计调整

### 6.1 用户表扩展
```sql
ALTER TABLE users ADD COLUMN identity_public_key TEXT NOT NULL;
ALTER TABLE users ADD COLUMN identity_key_fingerprint TEXT NOT NULL;
ALTER TABLE users ADD COLUMN registration_id INTEGER NOT NULL;
ALTER TABLE users ADD COLUMN signal_version INTEGER DEFAULT 3;

CREATE INDEX idx_users_fingerprint ON users(identity_key_fingerprint);
```

### 6.2 预密钥管理表
```sql
CREATE TABLE prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  key_type SMALLINT NOT NULL,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  signature TEXT,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id, key_type, key_id)
);

CREATE INDEX idx_prekeys_user_device ON prekeys(user_id, device_id, is_used);
CREATE INDEX idx_prekeys_unused ON prekeys(is_used) WHERE is_used = FALSE;
CREATE INDEX idx_prekeys_type ON prekeys(key_type);
```

### 6.3 会话状态存储
**注意**：会话状态仅在本地存储，服务器不存储任何会话状态数据。

#### 6.3.1 本地会话存储结构
```typescript
interface LocalSessionStore {
  // 会话状态存储
  sessions: Map<string, SessionState>;
  
  // 会话操作方法
  async getSession(conversationId: string): Promise<SessionState | null>;
  async saveSession(conversationId: string, state: SessionState): Promise<void>;
  async deleteSession(conversationId: string): Promise<void>;
  async clearAll(): Promise<void>;
}

interface SessionState {
  remoteIdentityKey: PublicKey;
  sendingChain: KeyChain;
  receivingChain: KeyChain;
  rootKey: Uint8Array;
  previousChainLength: number;
  // Double Ratchet 状态
  lastMessageIndex: number;
  chainKey: Uint8Array;
}
```

#### 6.3.2 存储实现
- **桌面端**: IndexedDB + 加密存储
- **移动端**: SQLite (SQLCipher) + 加密存储
- **安全性**: 使用系统安全存储API加密会话数据

### 6.4 密钥验证表
```sql
CREATE TABLE key_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, verified_user_id, verified_device_id)
);

CREATE INDEX idx_key_verifications_user ON key_verifications(user_id);
CREATE INDEX idx_key_verifications_verified ON key_verifications(verified_user_id, verified_device_id);
```

### 6.5 消息表调整
```sql
ALTER TABLE messages ADD COLUMN signal_version INTEGER DEFAULT 3;
ALTER TABLE messages ADD COLUMN sender_registration_id INTEGER;
ALTER TABLE messages ADD COLUMN destination_registration_id INTEGER;
ALTER TABLE messages ADD COLUMN source_device_id INTEGER;

CREATE INDEX idx_messages_signal ON messages(signal_version, sender_registration_id);
```

---

## 7. API接口设计

### 7.1 预密钥管理接口

#### 7.1.1 上传预密钥
```typescript
POST /api/v1/keys/prekeys
interface UploadPrekeysRequest {
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
}

interface UploadPrekeysResponse {
  success: boolean;
  message: string;
}
```

#### 7.1.2 获取预密钥包
```typescript
GET /api/v1/keys/prekeys/:userId/:deviceId
interface PrekeyBundleResponse {
  registrationId: number;
  identityKey: string;
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekey?: {
    keyId: number;
    publicKey: string;
  };
}
```

#### 7.1.3 获取身份密钥
```typescript
GET /api/v1/keys/identity/:userId
interface IdentityKeyResponse {
  userId: string;
  identityKey: string;
  fingerprint: string;
  registrationId: number;
}
```

### 7.2 会话管理
**注意**：会话状态仅在本地管理，服务器不提供会话状态相关API。

#### 7.2.1 本地会话管理
- **存储**: 使用IndexedDB/SQLite本地存储
- **同步**: 会话状态在设备间独立管理
- **备份**: 提供可选的会话状态备份功能

### 7.3 密钥验证接口

#### 7.3.1 标记密钥已验证
```typescript
POST /api/v1/keys/verify
interface VerifyKeyRequest {
  userId: string;
  deviceId?: string;
  fingerprint: string;
  isVerified: boolean;
}

interface VerifyKeyResponse {
  success: boolean;
  message: string;
}
```

#### 7.3.2 获取验证状态
```typescript
GET /api/v1/keys/verify/:userId
interface VerificationStatusResponse {
  userId: string;
  fingerprint: string;
  isVerified: boolean;
  verifiedAt?: string;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    fingerprint: string;
    isVerified: boolean;
  }>;
}
```

### 7.4 设备管理接口

#### 7.4.1 链接新设备
```typescript
POST /api/v1/devices/link
interface LinkDeviceRequest {
  deviceName: string;
  deviceType: 'ios' | 'android' | 'mac' | 'windows';
  verificationCode: string;
}

interface LinkDeviceResponse {
  success: boolean;
  deviceId: string;
  temporaryToken: string;
}
```

#### 7.4.2 确认设备链接
```typescript
POST /api/v1/devices/confirm
interface ConfirmDeviceRequest {
  temporaryToken: string;
  deviceKeys: {
    identityKey: string;
    signedPrekey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePrekeys: Array<{
      keyId: number;
      publicKey: string;
    }>;
  };
}

interface ConfirmDeviceResponse {
  success: boolean;
  deviceId: string;
}
```

---

## 8. 前端实现方案

### 8.1 项目结构
```
packages/
  crypto/
    signal/
      index.ts
      x3dh.ts
      double-ratchet.ts
      key-derivation.ts
      key-fingerprint.ts
    key-management/
      index.ts
      identity-keys.ts
      prekeys.ts
      session-store.ts
      secure-storage.ts
    encryption/
      index.ts
      message-encryption.ts
      payload-builder.ts
  api/
    encryption/
      index.ts
      prekeys-api.ts
      sessions-api.ts
      verification-api.ts
      devices-api.ts
  state/
    signal/
      index.ts
      keys-slice.ts
      sessions-slice.ts
      verification-slice.ts
```

### 8.2 核心模块实现

#### 8.2.1 Signal协议主入口
```typescript
export class SignalProtocol {
  private x3dh: X3DH;
  private doubleRatchet: DoubleRatchet;
  private keyDerivation: KeyDerivation;
  private keyFingerprint: KeyFingerprint;

  constructor() {
    this.x3dh = new X3DH();
    this.doubleRatchet = new DoubleRatchet();
    this.keyDerivation = new KeyDerivation();
    this.keyFingerprint = new KeyFingerprint();
  }

  async generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    return await this.keyDerivation.generateIdentityKeyPair();
  }

  async generateSignedPrekey(
    identityKeyPair: IdentityKeyPair,
    keyId: number
  ): Promise<SignedPrekey> {
    return await this.keyDerivation.generateSignedPrekey(
      identityKeyPair,
      keyId
    );
  }

  async generateOneTimePrekey(keyId: number): Promise<OneTimePrekey> {
    return await this.keyDerivation.generateOneTimePrekey(keyId);
  }

  async initiateSession(
    recipientPrekeyBundle: PrekeyBundle
  ): Promise<SessionState> {
    return await this.x3dh.initiateSession(recipientPrekeyBundle);
  }

  async acceptSession(
    initialMessage: InitialMessage
  ): Promise<SessionState> {
    return await this.x3dh.acceptSession(initialMessage);
  }

  async encryptMessage(
    session: SessionState,
    plaintext: string
  ): Promise<EncryptedMessage> {
    return await this.doubleRatchet.encrypt(session, plaintext);
  }

  async decryptMessage(
    session: SessionState,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    return await this.doubleRatchet.decrypt(session, encryptedMessage);
  }

  async generateFingerprint(
    identityKey: PublicKey
  ): Promise<string> {
    return await this.keyFingerprint.generate(identityKey);
  }
}
```

#### 8.2.2 密钥管理
```typescript
export class KeyManager {
  private secureStorage: SecureStorage;
  private sessionStore: SessionStore;
  private identityKeys: IdentityKeys;
  private prekeys: Prekeys;

  constructor() {
    this.secureStorage = new SecureStorage();
    this.sessionStore = new SessionStore();
    this.identityKeys = new IdentityKeys(this.secureStorage);
    this.prekeys = new Prekeys(this.secureStorage);
  }

  async initialize(): Promise<void> {
    await this.secureStorage.initialize();
    await this.identityKeys.initialize();
    await this.prekeys.initialize();
  }

  async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    return await this.identityKeys.getKeyPair();
  }

  async getSignedPrekeys(): Promise<SignedPrekey[]> {
    return await this.prekeys.getSignedPrekeys();
  }

  async getOneTimePrekeys(): Promise<OneTimePrekey[]> {
    return await this.prekeys.getOneTimePrekeys();
  }

  async getSession(
    remoteUserId: string,
    remoteDeviceId: string
  ): Promise<SessionState | null> {
    return await this.sessionStore.getSession(
      remoteUserId,
      remoteDeviceId
    );
  }

  async saveSession(
    remoteUserId: string,
    remoteDeviceId: string,
    session: SessionState
  ): Promise<void> {
    await this.sessionStore.saveSession(
      remoteUserId,
      remoteDeviceId,
      session
    );
  }

  async clearAll(): Promise<void> {
    await this.sessionStore.clearAll();
    await this.identityKeys.clear();
    await this.prekeys.clear();
  }
}
```

#### 8.2.3 消息加密服务
```typescript
export class MessageEncryptionService {
  private signal: SignalProtocol;
  private keyManager: KeyManager;

  constructor() {
    this.signal = new SignalProtocol();
    this.keyManager = new KeyManager();
  }

  async initialize(): Promise<void> {
    await this.keyManager.initialize();
  }

  async encryptMessage(
    recipientUserId: string,
    recipientDeviceId: string,
    plaintext: string
  ): Promise<EncryptedMessage> {
    let session = await this.keyManager.getSession(
      recipientUserId,
      recipientDeviceId
    );

    if (!session) {
      const prekeyBundle = await this.fetchPrekeyBundle(
        recipientUserId,
        recipientDeviceId
      );
      session = await this.signal.initiateSession(prekeyBundle);
    }

    const encryptedMessage = await this.signal.encryptMessage(
      session,
      plaintext
    );

    await this.keyManager.saveSession(
      recipientUserId,
      recipientDeviceId,
      session
    );

    return encryptedMessage;
  }

  async decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    let session = await this.keyManager.getSession(
      senderUserId,
      senderDeviceId
    );

    if (!session) {
      session = await this.signal.acceptSession(encryptedMessage);
    }

    const plaintext = await this.signal.decryptMessage(
      session,
      encryptedMessage
    );

    await this.keyManager.saveSession(
      senderUserId,
      senderDeviceId,
      session
    );

    return plaintext;
  }

  private async fetchPrekeyBundle(
    userId: string,
    deviceId: string
  ): Promise<PrekeyBundle> {
    const response = await fetch(
      `/api/v1/keys/prekeys/${userId}/${deviceId}`
    );
    return await response.json();
  }
}
```

### 8.3 状态管理集成

#### 8.3.1 Signal状态切片
```typescript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface KeysState {
  identityKeyPair: IdentityKeyPair | null;
  signedPrekeys: SignedPrekey[];
  oneTimePrekeys: OneTimePrekey[];
  fingerprint: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: KeysState = {
  identityKeyPair: null,
  signedPrekeys: [],
  oneTimePrekeys: [],
  fingerprint: null,
  isInitialized: false,
  isLoading: false,
  error: null,
};

export const initializeKeys = createAsyncThunk(
  'signal/initializeKeys',
  async () => {
    const keyManager = new KeyManager();
    await keyManager.initialize();
    return {
      identityKeyPair: await keyManager.getIdentityKeyPair(),
      signedPrekeys: await keyManager.getSignedPrekeys(),
      oneTimePrekeys: await keyManager.getOneTimePrekeys(),
    };
  }
);

export const uploadPrekeys = createAsyncThunk(
  'signal/uploadPrekeys',
  async (prekeys: { signedPrekey: SignedPrekey; oneTimePrekeys: OneTimePrekey[] }) => {
    const response = await fetch('/api/v1/keys/prekeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prekeys),
    });
    return await response.json();
  }
);

const keysSlice = createSlice({
  name: 'signalKeys',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeKeys.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeKeys.fulfilled, (state, action) => {
        state.isLoading = false;
        state.identityKeyPair = action.payload.identityKeyPair;
        state.signedPrekeys = action.payload.signedPrekeys;
        state.oneTimePrekeys = action.payload.oneTimePrekeys;
        state.isInitialized = true;
      })
      .addCase(initializeKeys.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to initialize keys';
      })
      .addCase(uploadPrekeys.fulfilled, (state) => {
        state.error = null;
      });
  },
});

export const { clearError } = keysSlice.actions;
export default keysSlice.reducer;
```

### 8.4 React组件集成

#### 8.4.1 密钥验证组件
```typescript
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { verifyKey, getVerificationStatus } from '../../api/encryption';

interface KeyVerificationProps {
  userId: string;
  deviceId?: string;
}

export const KeyVerification: React.FC<KeyVerificationProps> = ({
  userId,
  deviceId,
}) => {
  const dispatch = useDispatch();
  const [verificationStatus, setVerificationStatus] = useState<{
    fingerprint: string;
    isVerified: boolean;
  } | null>(null);
  const [showFingerprint, setShowFingerprint] = useState(false);

  useEffect(() => {
    loadVerificationStatus();
  }, [userId, deviceId]);

  const loadVerificationStatus = async () => {
    try {
      const status = await getVerificationStatus(userId);
      setVerificationStatus(status);
    } catch (error) {
      console.error('Failed to load verification status:', error);
    }
  };

  const handleVerify = async (isVerified: boolean) => {
    try {
      await verifyKey({
        userId,
        deviceId,
        fingerprint: verificationStatus?.fingerprint || '',
        isVerified,
      });
      await loadVerificationStatus();
    } catch (error) {
      console.error('Failed to verify key:', error);
    }
  };

  if (!verificationStatus) {
    return <div>Loading...</div>;
  }

  return (
    <div className="key-verification">
      <div className="verification-status">
        <span className={`status-indicator ${verificationStatus.isVerified ? 'verified' : 'unverified'}`}>
          {verificationStatus.isVerified ? '✓ 已验证' : '✗ 未验证'}
        </span>
      </div>

      <button onClick={() => setShowFingerprint(!showFingerprint)}>
        {showFingerprint ? '隐藏' : '显示'}密钥指纹
      </button>

      {showFingerprint && (
        <div className="fingerprint-display">
          <h3>密钥指纹</h3>
          <p className="fingerprint">{verificationStatus.fingerprint}</p>
          <p className="warning">
            请通过安全渠道（如面对面、视频通话）与对方确认此指纹
          </p>

          {!verificationStatus.isVerified && (
            <div className="verification-actions">
              <button onClick={() => handleVerify(true)} className="btn-verify">
                确认验证
              </button>
              <button onClick={() => handleVerify(false)} className="btn-cancel">
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## 9. 后端实现方案

### 9.1 项目结构
```
apps/backend/src/modules/
  keys/
    keys.module.ts
    keys.controller.ts
    keys.service.ts
    prekeys.entity.ts
    prekeys.repository.ts
  devices/
    devices.module.ts
    devices.controller.ts
    devices.service.ts
    device-linking.service.ts
  verification/
    verification.module.ts
    verification.controller.ts
    verification.service.ts
    key-verifications.entity.ts
    key-verifications.repository.ts
```

### 9.2 核心模块实现

#### 9.2.1 预密钥管理模块
```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prekey } from './prekeys.entity';
import { User } from '../user/entities/user.entity';
import { Device } from '../user/entities/device.entity';

@Injectable()
export class KeysService {
  constructor(
    @InjectRepository(Prekey)
    private prekeysRepository: Repository<Prekey>,
  ) {}

  async uploadPrekeys(
    userId: string,
    deviceId: string,
    signedPrekey: { keyId: number; publicKey: string; signature: string },
    oneTimePrekeys: Array<{ keyId: number; publicKey: string }>
  ): Promise<void> {
    const signedPrekeyEntity = this.prekeysRepository.create({
      userId,
      deviceId,
      keyType: 1,
      keyId: signedPrekey.keyId,
      publicKey: signedPrekey.publicKey,
      signature: signedPrekey.signature,
      isUsed: false,
    });
    await this.prekeysRepository.save(signedPrekeyEntity);

    for (const prekey of oneTimePrekeys) {
      const oneTimePrekeyEntity = this.prekeysRepository.create({
        userId,
        deviceId,
        keyType: 2,
        keyId: prekey.keyId,
        publicKey: prekey.publicKey,
        isUsed: false,
      });
      await this.prekeysRepository.save(oneTimePrekeyEntity);
    }
  }

  async getPrekeyBundle(
    userId: string,
    deviceId: string
  ): Promise<{
    registrationId: number;
    identityKey: string;
    signedPrekey: { keyId: number; publicKey: string; signature: string };
    oneTimePrekey?: { keyId: number; publicKey: string };
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const signedPrekey = await this.prekeysRepository.findOne({
      where: {
        userId,
        deviceId,
        keyType: 1,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!signedPrekey) {
      throw new NotFoundException('No signed prekey available');
    }

    const oneTimePrekey = await this.prekeysRepository.findOne({
      where: {
        userId,
        deviceId,
        keyType: 2,
        isUsed: false,
      },
      order: { createdAt: 'ASC' },
    });

    if (oneTimePrekey) {
      oneTimePrekey.isUsed = true;
      await this.prekeysRepository.save(oneTimePrekey);
    }

    return {
      registrationId: user.registrationId,
      identityKey: user.identityPublicKey,
      signedPrekey: {
        keyId: signedPrekey.keyId,
        publicKey: signedPrekey.publicKey,
        signature: signedPrekey.signature,
      },
      oneTimePrekey: oneTimePrekey ? {
        keyId: oneTimePrekey.keyId,
        publicKey: oneTimePrekey.publicKey,
      } : undefined,
    };
  }

  async getIdentityKey(userId: string): Promise<{
    userId: string;
    identityKey: string;
    fingerprint: string;
    registrationId: number;
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      identityKey: user.identityPublicKey,
      fingerprint: user.identityKeyFingerprint,
      registrationId: user.registrationId,
    };
  }

  async markPrekeyAsUsed(
    userId: string,
    deviceId: string,
    keyId: number,
    keyType: number
  ): Promise<void> {
    const prekey = await this.prekeysRepository.findOne({
      where: { userId, deviceId, keyId, keyType },
    });

    if (prekey) {
      prekey.isUsed = true;
      await this.prekeysRepository.save(prekey);
    }
  }

  private async getUserById(userId: string): Promise<User> {
    return {} as User;
  }
}
```

#### 9.2.2 本地会话管理（前端实现）
**注意**：会话状态仅在本地管理，服务器不参与会话状态存储。

```typescript
// 前端本地会话存储实现
class LocalSessionManager {
  private storage: LocalStorage;
  private sessions: Map<string, SessionState> = new Map();

  constructor() {
    this.storage = new LocalStorage('signal-sessions');
    this.loadSessions();
  }

  private async loadSessions(): Promise<void> {
    const stored = await this.storage.get('sessions');
    if (stored) {
      this.sessions = new Map(Object.entries(stored));
    }
  }

  private async saveSessions(): Promise<void> {
    await this.storage.set('sessions', Object.fromEntries(this.sessions));
  }

  async getSession(conversationId: string): Promise<SessionState | null> {
    return this.sessions.get(conversationId) || null;
  }

  async saveSession(conversationId: string, state: SessionState): Promise<void> {
    this.sessions.set(conversationId, state);
    await this.saveSessions();
  }

  async deleteSession(conversationId: string): Promise<void> {
    this.sessions.delete(conversationId);
    await this.saveSessions();
  }

  async clearAll(): Promise<void> {
    this.sessions.clear();
    await this.storage.remove('sessions');
  }
}
```

#### 9.2.3 设备链接服务
```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../user/entities/device.entity';
import { User } from '../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DeviceLinkingService {
  constructor(
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async generateLinkingCode(userId: string): Promise<string> {
    const linkingCode = uuidv4().replace(/-/g, '').substring(0, 6);
    await this.storeLinkingCode(userId, linkingCode);
    return linkingCode;
  }

  async linkDevice(
    linkingCode: string,
    deviceName: string,
    deviceType: 'ios' | 'android' | 'mac' | 'windows',
    deviceKeys: {
      identityKey: string;
      signedPrekey: { keyId: number; publicKey: string; signature: string };
      oneTimePrekeys: Array<{ keyId: number; publicKey: string }>;
    }
  ): Promise<{ deviceId: string; temporaryToken: string }> {
    const userId = await this.validateLinkingCode(linkingCode);
    if (!userId) {
      throw new BadRequestException('Invalid or expired linking code');
    }

    const device = this.devicesRepository.create({
      userId,
      deviceName,
      deviceType,
      identityPublicKey: deviceKeys.identityKey,
      signedPreKey: deviceKeys.signedPrekey.publicKey,
      signedPreKeySignature: deviceKeys.signedPrekey.signature,
    });
    const savedDevice = await this.devicesRepository.save(device);

    const temporaryToken = this.generateTemporaryToken(savedDevice.id);

    await this.deleteLinkingCode(linkingCode);

    return {
      deviceId: savedDevice.id,
      temporaryToken,
    };
  }

  async confirmDevice(
    temporaryToken: string
  ): Promise<{ deviceId: string }> {
    const deviceId = await this.validateTemporaryToken(temporaryToken);
    if (!deviceId) {
      throw new BadRequestException('Invalid or expired temporary token');
    }

    await this.activateDevice(deviceId);

    await this.deleteTemporaryToken(temporaryToken);

    return { deviceId };
  }

  private async storeLinkingCode(userId: string, code: string): Promise<void> {
  }

  private async validateLinkingCode(code: string): Promise<string | null> {
    return null;
  }

  private async deleteLinkingCode(code: string): Promise<void> {
  }

  private generateTemporaryToken(deviceId: string): string {
    return uuidv4();
  }

  private async validateTemporaryToken(token: string): Promise<string | null> {
    return null;
  }

  private async deleteTemporaryToken(token: string): Promise<void> {
  }

  private async activateDevice(deviceId: string): Promise<void> {
  }
}
```

### 9.3 控制器实现

#### 9.3.1 预密钥控制器
```typescript
import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KeysService } from './keys.service';

@Controller('api/v1/keys')
@UseGuards(JwtAuthGuard)
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Post('prekeys')
  async uploadPrekeys(
    @Request() req,
    @Body() body: {
      signedPrekey: { keyId: number; publicKey: string; signature: string };
      oneTimePrekeys: Array<{ keyId: number; publicKey: string }>;
    }
  ) {
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;

    await this.keysService.uploadPrekeys(
      userId,
      deviceId,
      body.signedPrekey,
      body.oneTimePrekeys
    );

    return { success: true, message: 'Prekeys uploaded successfully' };
  }

  @Get('prekeys/:userId/:deviceId')
  async getPrekeyBundle(
    @Param('userId') userId: string,
    @Param('deviceId') deviceId: string
  ) {
    return await this.keysService.getPrekeyBundle(userId, deviceId);
  }

  @Get('identity/:userId')
  async getIdentityKey(@Param('userId') userId: string) {
    return await this.keysService.getIdentityKey(userId);
  }
}
```

---

## 10. 测试方案

### 10.1 单元测试

#### 10.1.1 加密算法测试
```typescript
import { X3DH } from '../x3dh';

describe('X3DH Protocol', () => {
  let x3dh: X3DH;

  beforeEach(() => {
    x3dh = new X3DH();
  });

  test('should generate valid identity key pair', async () => {
    const keyPair = await x3dh.generateIdentityKeyPair();
    expect(keyPair).toHaveProperty('publicKey');
    expect(keyPair).toHaveProperty('privateKey');
    expect(keyPair.publicKey).toHaveLength(32);
  });

  test('should perform successful key exchange', async () => {
    const aliceKeys = await x3dh.generatePrekeyBundle();
    const bobKeys = await x3dh.generatePrekeyBundle();

    const aliceSharedSecret = await x3dh.calculateAgreement(
      aliceKeys.ephemeralKeyPair,
      bobKeys.signedPrekey,
      bobKeys.oneTimePrekey
    );

    const bobSharedSecret = await x3dh.calculateAgreement(
      bobKeys.ephemeralKeyPair,
      aliceKeys.signedPrekey,
      aliceKeys.oneTimePrekey
    );

    expect(aliceSharedSecret).toEqual(bobSharedSecret);
  });

  test('should derive different keys for different sessions', async () => {
    const prekeyBundle = await x3dh.generatePrekeyBundle();

    const session1 = await x3dh.initiateSession(prekeyBundle);
    const session2 = await x3dh.initiateSession(prekeyBundle);

    expect(session1.rootKey).not.toEqual(session2.rootKey);
  });
});
```

#### 10.1.2 密钥管理测试
```typescript
import { KeyManager } from '../index';

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(async () => {
    keyManager = new KeyManager();
    await keyManager.initialize();
  });

  afterEach(async () => {
    await keyManager.clearAll();
  });

  test('should generate and store identity key pair', async () => {
    const keyPair = await keyManager.getIdentityKeyPair();
    expect(keyPair).not.toBeNull();
    expect(keyPair).toHaveProperty('publicKey');
    expect(keyPair).toHaveProperty('privateKey');
  });

  test('should generate signed prekeys', async () => {
    const signedPrekeys = await keyManager.getSignedPrekeys();
    expect(signedPrekeys.length).toBeGreaterThan(0);
    expect(signedPrekeys[0]).toHaveProperty('keyId');
    expect(signedPrekeys[0]).toHaveProperty('publicKey');
    expect(signedPrekeys[0]).toHaveProperty('signature');
  });

  test('should generate one-time prekeys', async () => {
    const oneTimePrekeys = await keyManager.getOneTimePrekeys();
    expect(oneTimePrekeys.length).toBeGreaterThan(0);
    expect(oneTimePrekeys[0]).toHaveProperty('keyId');
    expect(oneTimePrekeys[0]).toHaveProperty('publicKey');
  });

  test('should save and retrieve session state', async () => {
    const session = {
      remoteIdentityKey: Buffer.from('test'),
      sendingChain: { key: Buffer.from('test'), index: 0 },
      receivingChain: null,
      rootKey: Buffer.from('test'),
      previousChainLength: 0,
    };

    await keyManager.saveSession('user1', 'device1', session);
    const retrieved = await keyManager.getSession('user1', 'device1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.rootKey).toEqual(session.rootKey);
  });
});
```

### 10.2 集成测试

#### 10.2.1 端到端消息加密测试
```typescript
import { MessageEncryptionService } from '../../packages/crypto/encryption';
import { KeyManager } from '../../packages/crypto/key-management';

describe('Message Encryption E2E', () => {
  let aliceEncryption: MessageEncryptionService;
  let bobEncryption: MessageEncryptionService;

  beforeEach(async () => {
    aliceEncryption = new MessageEncryptionService();
    bobEncryption = new MessageEncryptionService();
    await aliceEncryption.initialize();
    await bobEncryption.initialize();
  });

  test('should encrypt and decrypt message successfully', async () => {
    const plaintext = 'Hello, this is a secret message!';
    const recipientUserId = 'bob-user-id';
    const recipientDeviceId = 'bob-device-id';

    const encryptedMessage = await aliceEncryption.encryptMessage(
      recipientUserId,
      recipientDeviceId,
      plaintext
    );

    const decrypted = await bobEncryption.decryptMessage(
      'alice-user-id',
      'alice-device-id',
      encryptedMessage
    );

    expect(decrypted).toEqual(plaintext);
  });

  test('should maintain forward secrecy', async () => {
    const plaintext1 = 'First message';
    const plaintext2 = 'Second message';

    const encrypted1 = await aliceEncryption.encryptMessage(
      'bob-user-id',
      'bob-device-id',
      plaintext1
    );

    const session = await aliceEncryption['keyManager'].getSession(
      'bob-user-id',
      'bob-device-id'
    );

    const encrypted2 = await aliceEncryption.encryptMessage(
      'bob-user-id',
      'bob-device-id',
      plaintext2
    );

    const decrypted1WithLeakedKey = await bobEncryption.decryptMessage(
      'alice-user-id',
      'alice-device-id',
      encrypted1
    );

    expect(decrypted1WithLeakedKey).toEqual(plaintext1);
  });
});
```

### 10.3 性能测试

#### 10.3.1 加密性能测试
```typescript
import { MessageEncryptionService } from '../encryption';
import { performance } from 'perf_hooks';

describe('Encryption Performance', () => {
  let encryption: MessageEncryptionService;

  beforeEach(async () => {
    encryption = new MessageEncryptionService();
    await encryption.initialize();
  });

  test('should encrypt 100 messages in less than 5 seconds', async () => {
    const messageCount = 100;
    const messages = Array.from({ length: messageCount }, (_, i) => 
      `Message ${i}: This is a test message for performance testing.`
    );

    const startTime = performance.now();

    for (const message of messages) {
      await encryption.encryptMessage('user-id', 'device-id', message);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000);
    console.log(`Encrypted ${messageCount} messages in ${duration.toFixed(2)}ms`);
  });

  test('should maintain consistent performance over time', async () => {
    const iterations = 10;
    const messageCount = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      for (let j = 0; j < messageCount; j++) {
        await encryption.encryptMessage('user-id', 'device-id', `Message ${j}`);
      }

      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`Average: ${avgDuration.toFixed(2)}ms, Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`);

    expect(maxDuration - minDuration).toBeLessThan(avgDuration * 0.5);
  });
});
```

### 10.4 安全测试

#### 10.4.1 密钥泄露测试
```typescript
import { MessageEncryptionService } from '../encryption';
import { KeyManager } from '../key-management';

describe('Security Tests', () => {
  let aliceEncryption: MessageEncryptionService;
  let bobEncryption: MessageEncryptionService;

  beforeEach(async () => {
    aliceEncryption = new MessageEncryptionService();
    bobEncryption = new MessageEncryptionService();
    await aliceEncryption.initialize();
    await bobEncryption.initialize();
  });

  test('should not decrypt messages with wrong key', async () => {
    const plaintext = 'Secret message';
    const encrypted = await aliceEncryption.encryptMessage(
      'bob-user-id',
      'bob-device-id',
      plaintext
    );

    const wrongSession = {
      remoteIdentityKey: Buffer.from('wrong'),
      sendingChain: { key: Buffer.from('wrong'), index: 0 },
      receivingChain: null,
      rootKey: Buffer.from('wrong'),
      previousChainLength: 0,
    };

    await expect(
      bobEncryption['signal'].decryptMessage(wrongSession, encrypted)
    ).rejects.toThrow();
  });

  test('should detect message tampering', async () => {
    const plaintext = 'Original message';
    const encrypted = await aliceEncryption.encryptMessage(
      'bob-user-id',
      'bob-device-id',
      plaintext
    );

    const tamperedEncrypted = {
      ...encrypted,
      ciphertext: encrypted.ciphertext + 'tampered',
    };

    await expect(
      bobEncryption.decryptMessage(
        'alice-user-id',
        'alice-device-id',
        tamperedEncrypted
      )
    ).rejects.toThrow();
  });

  test('should not reveal key information in encrypted messages', async () => {
    const plaintext = 'Test message';
    const encrypted = await aliceEncryption.encryptMessage(
      'bob-user-id',
      'bob-device-id',
      plaintext
    );

    expect(encrypted).not.toHaveProperty('privateKey');
    expect(encrypted).not.toHaveProperty('rootKey');
    expect(encrypted).not.toHaveProperty('chainKey');
  });
});
```

---

## 11. 部署方案

### 11.1 环境配置

#### 11.1.1 环境变量
```bash
# Signal协议配置
SIGNAL_PROTOCOL_VERSION=3
SIGNAL_PREKEY_ROTATION_INTERVAL=604800
SIGNAL_ONETIME_PREKEY_COUNT=100
SIGNAL_SESSION_SYNC_INTERVAL=3600

# 加密配置
ENCRYPTION_KEY_DERIVATION_ITERATIONS=100000
ENCRYPTION_KEY_LENGTH=256
ENCRYPTION_IV_LENGTH=12

# 安全存储配置
SECURE_STORAGE_ENABLED=true
SECURE_STORAGE_ENCRYPTION_ENABLED=true
SESSION_STATE_ENCRYPTION_ENABLED=true

# 设备管理配置
MAX_DEVICES_PER_USER=5
DEVICE_LINKING_CODE_TTL=300
DEVICE_TEMPORARY_TOKEN_TTL=600
```

#### 11.1.2 数据库配置
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE INDEX CONCURRENTLY idx_prekeys_user_device_type 
  ON prekeys(user_id, device_id, key_type, is_used);

CREATE INDEX CONCURRENTLY idx_session_states_user_updated 
  ON session_states(user_id, device_id, updated_at DESC);
```

### 11.2 迁移策略

#### 11.2.1 数据迁移脚本
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateToSignalProtocol1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE prekeys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        key_type SMALLINT NOT NULL,
        key_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        signature TEXT,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, device_id, key_type, key_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE session_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        remote_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        remote_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        session_data JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, device_id, remote_user_id, remote_device_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE key_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verified_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verified_device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, verified_user_id, verified_device_id)
      );
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN identity_public_key TEXT NOT NULL DEFAULT '',
      ADD COLUMN identity_key_fingerprint TEXT NOT NULL DEFAULT '',
      ADD COLUMN registration_id INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN signal_version INTEGER DEFAULT 3;
    `);

    await queryRunner.query(`
      ALTER TABLE messages 
      ADD COLUMN signal_version INTEGER DEFAULT 3,
      ADD COLUMN sender_registration_id INTEGER,
      ADD COLUMN destination_registration_id INTEGER,
      ADD COLUMN source_device_id INTEGER;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_prekeys_user_device ON prekeys(user_id, device_id, is_used);
      CREATE INDEX idx_prekeys_unused ON prekeys(is_used) WHERE is_used = FALSE;
      CREATE INDEX idx_session_states_user ON session_states(user_id, device_id);
      CREATE INDEX idx_session_states_remote ON session_states(remote_user_id, remote_device_id);
      CREATE INDEX idx_session_states_updated ON session_states(updated_at);
      CREATE INDEX idx_users_fingerprint ON users(identity_key_fingerprint);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS key_verifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS session_states`);
    await queryRunner.query(`DROP TABLE IF EXISTS prekeys`);

    await queryRunner.query(`
      ALTER TABLE messages 
      DROP COLUMN IF EXISTS signal_version,
      DROP COLUMN IF EXISTS sender_registration_id,
      DROP COLUMN IF EXISTS destination_registration_id,
      DROP COLUMN IF EXISTS source_device_id;
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS identity_public_key,
      DROP COLUMN IF EXISTS identity_key_fingerprint,
      DROP COLUMN IF EXISTS registration_id,
      DROP COLUMN IF EXISTS signal_version;
    `);
  }
}
```

#### 11.2.2 用户数据迁移
```typescript
import { DataSource } from 'typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Device } from '../modules/user/entities/device.entity';
import { SignalProtocol } from '../packages/crypto/signal';

export async function migrateUserData(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const deviceRepository = dataSource.getRepository(Device);
  const signal = new SignalProtocol();

  const users = await userRepository.find();

  for (const user of users) {
    console.log(`Migrating user: ${user.username}`);

    const identityKeyPair = await signal.generateIdentityKeyPair();
    const fingerprint = await signal.generateFingerprint(identityKeyPair.publicKey);
    const registrationId = Math.floor(Math.random() * 16380) + 1;

    user.identityPublicKey = Buffer.from(identityKeyPair.publicKey).toString('base64');
    user.identityKeyFingerprint = fingerprint;
    user.registrationId = registrationId;
    user.signalVersion = 3;

    await userRepository.save(user);

    const devices = await deviceRepository.find({ where: { userId: user.id } });

    for (const device of devices) {
      console.log(`Migrating device: ${device.deviceName}`);

      const signedPrekey = await signal.generateSignedPrekey(
        identityKeyPair,
        Date.now()
      );

      const oneTimePrekeys = [];
      for (let i = 0; i < 100; i++) {
        const oneTimePrekey = await signal.generateOneTimePrekey(i + 1);
        oneTimePrekeys.push(oneTimePrekey);
      }

      device.signedPreKey = Buffer.from(signedPrekey.publicKey).toString('base64');
      device.signedPreKeySignature = Buffer.from(signedPrekey.signature).toString('base64');

      await deviceRepository.save(device);

      await uploadPrekeysToServer(user.id, device.id, signedPrekey, oneTimePrekeys);
    }
  }

  console.log('User data migration completed');
}

async function uploadPrekeysToServer(
  userId: string,
  deviceId: string,
  signedPrekey: any,
  oneTimePrekeys: any[]
): Promise<void> {
  console.log(`Uploading prekeys for user ${userId}, device ${deviceId}`);
}
```

### 11.3 监控与维护

#### 11.3.1 监控指标
```typescript
export class SignalMetrics {
  private metrics = {
    prekeyUsage: new Map<string, number>(),
    sessionCount: new Map<string, number>(),
    encryptionLatency: number[],
    decryptionLatency: number[],
    keyRotationEvents: number,
  };

  recordPrekeyUsage(userId: string, deviceId: string): void {
    const key = `${userId}:${deviceId}`;
    const count = this.metrics.prekeyUsage.get(key) || 0;
    this.metrics.prekeyUsage.set(key, count + 1);
  }

  recordSessionCount(userId: string, deviceId: string): void {
    const key = `${userId}:${deviceId}`;
    const count = this.metrics.sessionCount.get(key) || 0;
    this.metrics.sessionCount.set(key, count + 1);
  }

  recordEncryptionLatency(latency: number): void {
    this.metrics.encryptionLatency.push(latency);
    if (this.metrics.encryptionLatency.length > 1000) {
      this.metrics.encryptionLatency.shift();
    }
  }

  recordDecryptionLatency(latency: number): void {
    this.metrics.decryptionLatency.push(latency);
    if (this.metrics.decryptionLatency.length > 1000) {
      this.metrics.decryptionLatency.shift();
    }
  }

  recordKeyRotation(): void {
    this.metrics.keyRotationEvents++;
  }

  getMetrics() {
    return {
      prekeyUsage: Object.fromEntries(this.metrics.prekeyUsage),
      sessionCount: Object.fromEntries(this.metrics.sessionCount),
      encryptionLatency: {
        avg: this.calculateAverage(this.metrics.encryptionLatency),
        p50: this.calculatePercentile(this.metrics.encryptionLatency, 50),
        p95: this.calculatePercentile(this.metrics.encryptionLatency, 95),
        p99: this.calculatePercentile(this.metrics.encryptionLatency, 99),
      },
      decryptionLatency: {
        avg: this.calculateAverage(this.metrics.decryptionLatency),
        p50: this.calculatePercentile(this.metrics.decryptionLatency, 50),
        p95: this.calculatePercentile(this.metrics.decryptionLatency, 95),
        p99: this.calculatePercentile(this.metrics.decryptionLatency, 99),
      },
      keyRotationEvents: this.metrics.keyRotationEvents,
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

#### 11.3.2 告警规则
```typescript
export const alertRules = {
  prekeyUsage: {
    warning: 80,
    critical: 95,
    message: 'Prekey usage is high, consider replenishing',
  },
  encryptionLatency: {
    warning: 1000,
    critical: 2000,
    message: 'Encryption latency is high',
  },
  decryptionLatency: {
    warning: 1000,
    critical: 2000,
    message: 'Decryption latency is high',
  },
  keyRotationEvents: {
    warning: 10,
    critical: 20,
    message: 'High frequency of key rotation events',
  },
};
```

---

## 12. 风险评估与应对

### 12.1 技术风险

#### 12.1.1 实现复杂性风险
- **风险描述**: Signal协议实现复杂，容易出现安全漏洞
- **应对措施**: 
  - 使用成熟的加密库（如libsignal）
  - 进行严格的安全审计和代码审查
  - 实施全面的测试覆盖
  - 定期进行渗透测试

#### 12.1.2 性能影响风险
- **风险描述**: 加密解密可能影响消息传输性能
- **应对措施**:
  - 使用WebAssembly优化加密性能
  - 实现异步加密处理
  - 缓存会话状态减少重复计算
  - 监控性能指标，及时优化

#### 12.1.3 兼容性风险
- **风险描述**: 新旧协议共存可能导致兼容性问题
- **应对措施**:
  - 实现协议版本协商机制
  - 支持渐进式迁移
  - 保留向后兼容性
  - 提供降级方案

### 12.2 业务风险

#### 12.2.1 用户体验风险
- **风险描述**: 密钥验证可能增加用户操作复杂度
- **应对措施**:
  - 简化验证流程，提供清晰的指导
  - 支持多种验证方式（面对面、视频通话等）
  - 提供友好的错误提示和帮助文档
  - 逐步引导用户完成验证

#### 12.2.2 设备管理风险
- **风险描述**: 多设备管理可能增加用户困惑
- **应对措施**:
  - 提供直观的设备管理界面
  - 支持设备命名和识别
  - 实现设备状态监控
  - 提供设备移除和重置功能

#### 12.2.3 迁移成本风险
- **风险描述**: 现有用户需要重新注册或进行密钥迁移
- **应对措施**:
  - 提供平滑的迁移方案
  - 支持数据迁移和恢复
  - 提供详细的迁移指导
  - 保留旧版本支持一段时间

### 12.3 安全风险

#### 12.3.1 实现漏洞风险
- **风险描述**: 不当实现可能引入新的安全漏洞
- **应对措施**:
  - 严格遵循Signal协议规范
  - 使用经过验证的加密库
  - 进行安全审计和渗透测试
  - 及时修复发现的安全问题

#### 12.3.2 密钥管理风险
- **风险描述**: 密钥存储和管理不当可能导致密钥泄露
- **应对措施**:
  - 使用操作系统提供的安全存储
  - 实现密钥加密和访问控制
  - 定期轮换密钥
  - 提供密钥备份和恢复功能

#### 12.3.3 降级攻击风险
- **风险描述**: 需要防止协议降级攻击
- **应对措施**:
  - 实现协议版本协商
  - 拒绝不安全的协议版本
  - 记录协议版本使用情况
  - 监控异常降级行为

#### 12.3.4 中间人攻击风险
- **风险描述**: 攻击者可能尝试拦截和篡改密钥交换
- **应对措施**:
  - 强制使用TLS 1.3加密传输
  - 实现证书固定(Certificate Pinning)
  - 提供密钥指纹验证
  - 记录密钥交换日志

#### 12.3.5 密钥泄露风险
- **风险描述**: 设备被盗或恶意软件可能导致密钥泄露
- **应对措施**:
  - 实现设备锁定和远程擦除
  - 提供密钥撤销机制
  - 支持会话密钥过期
  - 实现前向保密，限制泄露影响

### 12.4 合规风险

#### 12.4.1 数据保护法规风险
- **风险描述**: 端到端加密可能与某些地区的法规要求冲突
- **应对措施**:
  - 了解并遵守当地法规
  - 提供合规性文档
  - 实现必要的合规功能
  - 与监管机构沟通

#### 12.4.2 审计要求风险
- **风险描述**: 端到端加密可能影响系统审计能力
- **应对措施**:
  - 实现元数据审计
  - 记录加密操作日志
  - 提供审计报告生成
  - 平衡安全性和可审计性

---

## 13. 测试方案

### 13.1 单元测试

#### 13.1.1 加密算法测试
```typescript
describe('Signal Protocol Encryption', () => {
  it('should encrypt and decrypt message correctly', async () => {
    const plaintext = 'Hello, World!';
    const encrypted = await encryptMessage(userId, deviceId, plaintext);
    const decrypted = await decryptMessage(userId, deviceId, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should generate different ciphertext for same plaintext', async () => {
    const plaintext = 'Hello, World!';
    const encrypted1 = await encryptMessage(userId, deviceId, plaintext);
    const encrypted2 = await encryptMessage(userId, deviceId, plaintext);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  it('should fail with wrong key', async () => {
    const plaintext = 'Hello, World!';
    const encrypted = await encryptMessage(userId, deviceId, plaintext);
    await expect(
      decryptMessage(userId, 'wrong-device-id', encrypted)
    ).rejects.toThrow();
  });
});
```

#### 13.1.2 密钥管理测试
```typescript
describe('Key Management', () => {
  it('should generate valid identity key pair', async () => {
    const keyPair = await generateIdentityKeys();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey.length).toBe(32);
  });

  it('should rotate signed prekey correctly', async () => {
    const oldKey = await getSignedPrekey(1);
    await rotateSignedPrekey();
    const newKey = await getSignedPrekey(1);
    expect(newKey.publicKey).not.toBe(oldKey.publicKey);
  });

  it('should replenish one-time prekeys', async () => {
    await consumeOneTimePrekeys(50);
    await replenishOneTimePrekeys(100);
    const count = await getOneTimePrekeyCount();
    expect(count).toBeGreaterThanOrEqual(100);
  });
});
```

#### 13.1.3 会话管理测试
```typescript
describe('Session Management', () => {
  it('should create new session correctly', async () => {
    const session = await initiateSession(userId, deviceId);
    expect(session.remoteIdentityKey).toBeDefined();
    expect(session.rootKey).toBeDefined();
  });

  it('should maintain session state across messages', async () => {
    await initiateSession(userId, deviceId);
    const msg1 = await encryptMessage(userId, deviceId, 'Message 1');
    const msg2 = await encryptMessage(userId, deviceId, 'Message 2');
    expect(msg1.messageNumber).toBe(1);
    expect(msg2.messageNumber).toBe(2);
  });

  it('should handle out-of-order messages', async () => {
    await initiateSession(userId, deviceId);
    const msg1 = await encryptMessage(userId, deviceId, 'Message 1');
    const msg2 = await encryptMessage(userId, deviceId, 'Message 2');
    const decrypted2 = await decryptMessage(userId, deviceId, msg2);
    const decrypted1 = await decryptMessage(userId, deviceId, msg1);
    expect(decrypted1).toBe('Message 1');
    expect(decrypted2).toBe('Message 2');
  });
});
```

### 13.2 集成测试

#### 13.2.1 端到端消息流程测试
```typescript
describe('End-to-End Message Flow', () => {
  it('should send and receive encrypted message', async () => {
    await userA.initiateSession(userB.id, userB.deviceId);
    const encrypted = await userA.sendMessage(userB.id, 'Hello, User B!');
    await server.deliverMessage(userB.id, encrypted);
    const decrypted = await userB.receiveMessage(encrypted);
    expect(decrypted).toBe('Hello, User B!');
  });

  it('should handle multiple devices', async () => {
    await userA.initiateSession(userB.id, userB.device1);
    await userA.initiateSession(userB.id, userB.device2);
    const msg = 'Hello, User B on all devices!';
    const encrypted1 = await userA.sendMessage(userB.id, msg, userB.device1);
    const encrypted2 = await userA.sendMessage(userB.id, msg, userB.device2);
    const decrypted1 = await userB.receiveMessage(encrypted1, userB.device1);
    const decrypted2 = await userB.receiveMessage(encrypted2, userB.device2);
    expect(decrypted1).toBe(msg);
    expect(decrypted2).toBe(msg);
  });
});
```

#### 13.2.2 密钥交换测试
```typescript
describe('Key Exchange', () => {
  it('should perform X3DH key exchange', async () => {
    const prekeyBundle = await userA.getPrekeyBundle();
    const session = await userB.initiateSessionFromBundle(userA.id, prekeyBundle);
    expect(session.rootKey).toBeDefined();
    expect(session.remoteIdentityKey).toBe(prekeyBundle.identityKey);
  });

  it('should handle prekey exhaustion', async () => {
    await consumeAllOneTimePrekeys(userA.id);
    const session = await userB.initiateSession(userA.id, userA.deviceId);
    expect(session).toBeDefined();
    await waitForPrekeyReplenishment(userA.id);
    const count = await getOneTimePrekeyCount(userA.id);
    expect(count).toBeGreaterThan(0);
  });
});
```

### 13.3 性能测试

#### 13.3.1 加密性能测试
```typescript
describe('Encryption Performance', () => {
  it('should encrypt 1000 messages in under 10 seconds', async () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      await encryptMessage(userId, deviceId, `Message ${i}`);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
  });

  it('should handle concurrent encryption', async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(encryptMessage(userId, deviceId, `Message ${i}`));
    }
    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
  });
});
```

#### 13.3.2 内存使用测试
```typescript
describe('Memory Usage', () => {
  it('should not leak memory during message processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10000; i++) {
      await encryptMessage(userId, deviceId, `Message ${i}`);
      await decryptMessage(userId, deviceId, encrypted);
    }
    global.gc();
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

### 13.4 安全测试

#### 13.4.1 密钥泄露测试
```typescript
describe('Security Tests', () => {
  it('should not expose private keys in logs', async () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    
    await generateIdentityKeys();
    await encryptMessage(userId, deviceId, 'Test');
    
    console.log = originalLog;
    const hasPrivateKey = logs.some(log => 
      log.includes('private') || log.includes('secret')
    );
    expect(hasPrivateKey).toBe(false);
  });

  it('should reject tampered messages', async () => {
    const encrypted = await encryptMessage(userId, deviceId, 'Original');
    encrypted.ciphertext = encrypted.ciphertext.slice(0, -1) + 'X';
    await expect(
      decryptMessage(userId, deviceId, encrypted)
    ).rejects.toThrow();
  });
});
```

#### 13.4.2 前向保密测试
```typescript
describe('Forward Secrecy', () => {
  it('should not allow decryption with old keys', async () => {
    await initiateSession(userId, deviceId);
    const encrypted1 = await encryptMessage(userId, deviceId, 'Message 1');
    
    await rotateSendingChain();
    const encrypted2 = await encryptMessage(userId, deviceId, 'Message 2');
    
    await rotateSendingChain();
    
    const decrypted1 = await decryptMessage(userId, deviceId, encrypted1);
    const decrypted2 = await decryptMessage(userId, deviceId, encrypted2);
    expect(decrypted1).toBe('Message 1');
    expect(decrypted2).toBe('Message 2');
  });
});
```

### 13.5 兼容性测试

#### 13.5.1 多平台测试
- iOS设备测试
- Android设备测试
- macOS桌面测试
- Windows桌面测试
- Linux桌面测试

#### 13.5.2 版本兼容性测试
```typescript
describe('Version Compatibility', () => {
  it('should support protocol version 3', async () => {
    const message = { version: 3, ... };
    const decrypted = await decryptMessage(userId, deviceId, message);
    expect(decrypted).toBeDefined();
  });

  it('should reject unsupported protocol versions', async () => {
    const message = { version: 99, ... };
    await expect(
      decryptMessage(userId, deviceId, message)
    ).rejects.toThrow('Unsupported protocol version');
  });
});
```

---

## 14. 部署方案

### 14.1 部署策略

#### 14.1.1 渐进式部署
1. **阶段一**: 内部测试环境部署
   - 小规模用户测试
   - 功能验证
   - 性能测试
   - 安全审计

2. **阶段二**: 灰度发布
   - 5%用户启用端到端加密
   - 监控错误率和性能
   - 收集用户反馈
   - 逐步扩大到10%、20%、50%

3. **阶段三**: 全量发布
   - 所有新用户默认启用
   - 现有用户引导迁移
   - 保留旧版本支持3个月
   - 完全切换到新协议

#### 14.1.2 回滚方案
- 保留旧版本API接口
- 实现协议版本检测
- 提供快速回滚开关
- 数据库迁移回滚脚本

### 14.2 环境配置

#### 14.2.1 生产环境配置
```typescript
// config/production.ts
export const productionConfig = {
  signal: {
    version: 3,
    prekeyCount: {
      signed: 1,
      oneTime: 100
    },
    rotationInterval: {
      signedPrekey: 7 * 24 * 60 * 60 * 1000, // 7天
      oneTimePrekey: 1 * 24 * 60 * 60 * 1000 // 1天
    },
    sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30天
    maxMessageSkew: 2000
  },
  storage: {
    keyStore: 'secure',
    sessionStore: 'encrypted'
  },
  performance: {
    encryptionWorkers: 4,
    maxConcurrentEncryption: 100
  }
};
```

#### 14.2.2 数据库迁移脚本
```sql
-- 迁移脚本: v1_to_signal.sql
BEGIN;

-- 添加Signal协议相关字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_public_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_key_fingerprint TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signal_version INTEGER DEFAULT 3;

-- 创建预密钥表
CREATE TABLE IF NOT EXISTS prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  key_type SMALLINT NOT NULL,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  signature TEXT,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id, key_type, key_id)
);

-- 创建会话状态表
CREATE TABLE IF NOT EXISTS session_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  remote_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id, remote_user_id, remote_device_id)
);

-- 创建密钥验证表
CREATE TABLE IF NOT EXISTS key_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, verified_user_id, verified_device_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prekeys_user_device ON prekeys(user_id, device_id, is_used);
CREATE INDEX IF NOT EXISTS idx_prekeys_unused ON prekeys(is_used) WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_session_states_user ON session_states(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_session_states_remote ON session_states(remote_user_id, remote_device_id);
CREATE INDEX IF NOT EXISTS idx_key_verifications_user ON key_verifications(user_id);

COMMIT;
```

### 14.3 监控配置

#### 14.3.1 性能监控指标
```typescript
// monitoring/metrics.ts
export const signalMetrics = {
  encryption: {
    avgEncryptionTime: 'signal.encryption.avg_time',
    avgDecryptionTime: 'signal.decryption.avg_time',
    encryptionErrorRate: 'signal.encryption.error_rate',
    decryptionErrorRate: 'signal.decryption.error_rate'
  },
  keys: {
    prekeyUsageRate: 'signal.keys.prekey_usage_rate',
    prekeyReplenishmentRate: 'signal.keys.replenishment_rate',
    keyRotationSuccess: 'signal.keys.rotation_success'
  },
  sessions: {
    activeSessions: 'signal.sessions.active',
    sessionCreationRate: 'signal.sessions.creation_rate',
    sessionErrorRate: 'signal.sessions.error_rate'
  },
  messages: {
    encryptedMessages: 'signal.messages.encrypted',
    decryptedMessages: 'signal.messages.decrypted',
    failedDecryptions: 'signal.messages.failed_decryptions'
  }
};
```

#### 14.3.2 告警规则
```yaml
# monitoring/alerts.yml
alerts:
  - name: HighEncryptionErrorRate
    condition: signal.encryption.error_rate > 0.01
    duration: 5m
    severity: critical
    message: "加密错误率超过1%"

  - name: LowPrekeyCount
    condition: signal.keys.prekey_count < 10
    duration: 1m
    severity: warning
    message: "一次性预密钥数量低于10"

  - name: SessionCreationFailure
    condition: signal.sessions.error_rate > 0.05
    duration: 10m
    severity: critical
    message: "会话创建失败率超过5%"

  - name: DecryptionFailureSpike
    condition: signal.messages.failed_decryptions > 100
    duration: 1m
    severity: critical
    message: "解密失败数量激增"
```

### 14.4 备份与恢复

#### 14.4.1 数据备份策略
```typescript
// backup/strategy.ts
export const backupStrategy = {
  database: {
    schedule: '0 2 * * *', // 每天凌晨2点
    retention: 30, // 保留30天
    encryption: true
  },
  keys: {
    schedule: '0 */6 * * *', // 每6小时
    retention: 7, // 保留7天
    encryption: true,
    location: 'secure-storage'
  },
  sessions: {
    schedule: '0 * * * *', // 每小时
    retention: 24, // 保留24小时
    encryption: true
  }
};
```

#### 14.4.2 灾难恢复方案
```typescript
// recovery/plan.ts
export const recoveryPlan = {
  rto: 4, // 恢复时间目标: 4小时
  rpo: 1, // 恢复点目标: 1小时
  
  steps: [
    '1. 评估损坏范围',
    '2. 从备份恢复数据库',
    '3. 恢复密钥存储',
    '4. 重启加密服务',
    '5. 验证会话状态',
    '6. 通知用户可能的影响'
  ],
  
  testing: {
    frequency: 'monthly',
    scenarios: [
      '数据库损坏',
      '密钥存储损坏',
      '部分服务故障',
      '网络分区'
    ]
  }
};
```

---

## 15. 监控与运维

### 15.1 系统监控

#### 15.1.1 实时监控面板
```typescript
// monitoring/dashboard.ts
interface MonitoringDashboard {
  overview: {
    totalUsers: number;
    activeSessions: number;
    encryptedMessages: number;
    errorRate: number;
  };
  
  performance: {
    avgEncryptionTime: number;
    avgDecryptionTime: number;
    p99EncryptionTime: number;
    p99DecryptionTime: number;
  };
  
  security: {
    keyRotationSuccess: number;
    prekeyUsageRate: number;
    failedAuthAttempts: number;
  };
  
  health: {
    encryptionService: 'healthy' | 'degraded' | 'down';
    keyStore: 'healthy' | 'degraded' | 'down';
    sessionStore: 'healthy' | 'degraded' | 'down';
  };
}
```

#### 15.1.2 日志管理
```typescript
// logging/signal-logger.ts
export class SignalLogger {
  private logger = new Logger('SignalProtocol');
  
  logKeyGeneration(userId: string, keyType: string) {
    this.logger.log(`Key generated: userId=${userId}, type=${keyType}`);
  }
  
  logEncryption(userId: string, recipientId: string, success: boolean) {
    this.logger.log(
      `Encryption: userId=${userId}, recipient=${recipientId}, success=${success}`
    );
  }
  
  logDecryption(userId: string, senderId: string, success: boolean, error?: string) {
    if (success) {
      this.logger.log(
        `Decryption: userId=${userId}, sender=${senderId}, success=true`
      );
    } else {
      this.logger.error(
        `Decryption failed: userId=${userId}, sender=${senderId}, error=${error}`
      );
    }
  }
  
  logSessionCreation(userId: string, remoteUserId: string) {
    this.logger.log(
      `Session created: userId=${userId}, remoteUser=${remoteUserId}`
    );
  }
  
  logKeyRotation(userId: string, keyType: string, keyId: number) {
    this.logger.log(
      `Key rotated: userId=${userId}, type=${keyType}, keyId=${keyId}`
    );
  }
}
```

### 15.2 性能优化

#### 15.2.1 加密性能优化
```typescript
// optimization/encryption.ts
export class EncryptionOptimizer {
  private workerPool: Worker[];
  private queue: Promise<any>[] = [];
  
  constructor(poolSize: number = 4) {
    this.workerPool = Array(poolSize).fill(null).map(() => 
      new Worker('./encryption-worker.js')
    );
  }
  
  async encryptBatch(messages: Message[]): Promise<EncryptedMessage[]> {
    const chunks = this.chunkArray(messages, this.workerPool.length);
    const results = await Promise.all(
      chunks.map((chunk, index) => 
        this.encryptOnWorker(this.workerPool[index], chunk)
      )
    );
    return results.flat();
  }
  
  private async encryptOnWorker(worker: Worker, messages: Message[]): Promise<EncryptedMessage[]> {
    return new Promise((resolve, reject) => {
      worker.postMessage({ type: 'encrypt', messages });
      worker.onmessage = (e) => resolve(e.data);
      worker.onerror = (e) => reject(e.error);
    });
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

#### 15.2.2 缓存策略
```typescript
// optimization/cache.ts
export class SessionCache {
  private cache = new Map<string, { session: SessionState; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5分钟
  
  get(userId: string, deviceId: string): SessionState | null {
    const key = this.buildKey(userId, deviceId);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.session;
  }
  
  set(userId: string, deviceId: string, session: SessionState): void {
    const key = this.buildKey(userId, deviceId);
    this.cache.set(key, { session, timestamp: Date.now() });
  }
  
  invalidate(userId: string, deviceId: string): void {
    const key = this.buildKey(userId, deviceId);
    this.cache.delete(key);
  }
  
  private buildKey(userId: string, deviceId: string): string {
    return `${userId}:${deviceId}`;
  }
}
```

### 15.3 故障处理

#### 15.3.1 自动故障恢复
```typescript
// recovery/auto-recovery.ts
export class AutoRecovery {
  private maxRetries = 3;
  private retryDelay = 1000;
  
  async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.maxRetries) {
          this.logFailure(context, error);
          throw error;
        }
        
        this.logRetry(context, attempt, error);
        await this.delay(this.retryDelay * attempt);
      }
    }
    throw new Error('Max retries exceeded');
  }
  
  async recoverSession(userId: string, deviceId: string): Promise<boolean> {
    try {
      await this.withRetry(
        () => this.reestablishSession(userId, deviceId),
        `Session recovery: ${userId}:${deviceId}`
      );
      return true;
    } catch (error) {
      this.logRecoveryFailure(userId, deviceId, error);
      return false;
    }
  }
  
  private async reestablishSession(userId: string, deviceId: string): Promise<void> {
    await this.deleteSession(userId, deviceId);
    await this.initiateNewSession(userId, deviceId);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private logRetry(context: string, attempt: number, error: any): void {
    console.warn(`Retry ${attempt}/${this.maxRetries} for ${context}:`, error.message);
  }
  
  private logFailure(context: string, error: any): void {
    console.error(`Failed after ${this.maxRetries} retries for ${context}:`, error);
  }
  
  private logRecoveryFailure(userId: string, deviceId: string, error: any): void {
    console.error(`Failed to recover session ${userId}:${deviceId}:`, error);
  }
}
```

#### 15.3.2 手动故障处理流程
```markdown
# 故障处理手册

## 1. 加密服务故障
### 症状
- 消息加密失败
- 错误率激增
- 响应时间过长

### 处理步骤
1. 检查服务状态: `systemctl status signal-encryption`
2. 查看日志: `journalctl -u signal-encryption -n 100`
3. 重启服务: `systemctl restart signal-encryption`
4. 验证恢复: 检查监控面板

## 2. 密钥存储故障
### 症状
- 无法获取预密钥
- 密钥轮换失败
- 会话创建失败

### 处理步骤
1. 检查存储连接: `ping keystore.internal`
2. 验证存储健康: `curl http://keystore.internal/health`
3. 从备份恢复密钥
4. 重新初始化密钥服务

## 3. 会话状态损坏
### 症状
- 消息解密失败
- 会话不一致
- 状态同步错误

### 处理步骤
1. 识别损坏的会话
2. 删除损坏的会话状态
3. 重新建立会话
4. 验证消息解密
```

### 15.4 安全审计

#### 15.4.1 审计日志
```typescript
// audit/auditor.ts
export class SecurityAuditor {
  private auditLog: AuditEntry[] = [];
  
  logKeyAccess(userId: string, keyType: string, action: 'read' | 'write' | 'delete') {
    this.addEntry({
      type: 'key_access',
      userId,
      keyType,
      action,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
  }
  
  logSessionOperation(userId: string, operation: 'create' | 'update' | 'delete', remoteUserId: string) {
    this.addEntry({
      type: 'session_operation',
      userId,
      operation,
      remoteUserId,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
  }
  
  logEncryptionFailure(userId: string, recipientId: string, error: string) {
    this.addEntry({
      type: 'encryption_failure',
      userId,
      recipientId,
      error,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
  }
  
  logDecryptionFailure(userId: string, senderId: string, error: string) {
    this.addEntry({
      type: 'decryption_failure',
      userId,
      senderId,
      error,
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
  }
  
  generateReport(startDate: Date, endDate: Date): AuditReport {
    const entries = this.auditLog.filter(
      entry => entry.timestamp >= startDate && entry.timestamp <= endDate
    );
    
    return {
      period: { startDate, endDate },
      totalEntries: entries.length,
      byType: this.groupByType(entries),
      byUser: this.groupByUser(entries),
      failures: entries.filter(e => e.type.includes('failure')),
      suspiciousActivities: this.detectSuspiciousActivities(entries)
    };
  }
  
  private addEntry(entry: AuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > 100000) {
      this.auditLog = this.auditLog.slice(-50000);
    }
  }
  
  private getClientIP(): string {
    return '127.0.0.1';
  }
  
  private getUserAgent(): string {
    return 'SecurityChat/1.0';
  }
  
  private groupByType(entries: AuditEntry[]): Record<string, number> {
    return entries.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  private groupByUser(entries: AuditEntry[]): Record<string, number> {
    return entries.reduce((acc, entry) => {
      acc[entry.userId] = (acc[entry.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  private detectSuspiciousActivities(entries: AuditEntry[]): SuspiciousActivity[] {
    const activities: SuspiciousActivity[] = [];
    
    const failureByUser = this.groupByUser(
      entries.filter(e => e.type.includes('failure'))
    );
    
    Object.entries(failureByUser).forEach(([userId, count]) => {
      if (count > 100) {
        activities.push({
          type: 'high_failure_rate',
          userId,
          count,
          threshold: 100
        });
      }
    });
    
    return activities;
  }
}
```

#### 15.4.2 定期安全检查
```typescript
// audit/security-check.ts
export class SecurityChecker {
  async performDailyCheck(): Promise<SecurityReport> {
    const checks = await Promise.all([
      this.checkPrekeyExhaustion(),
      this.checkStaleSessions(),
      this.checkFailedDecryptions(),
      this.checkKeyRotation(),
      this.checkUnauthorizedAccess()
    ]);
    
    return {
      timestamp: new Date(),
      checks,
      overallStatus: this.calculateOverallStatus(checks)
    };
  }
  
  private async checkPrekeyExhaustion(): Promise<CheckResult> {
    const usersWithLowPrekeys = await this.findUsersWithLowPrekeys(10);
    
    return {
      name: 'Prekey Exhaustion',
      status: usersWithLowPrekeys.length > 0 ? 'warning' : 'pass',
      details: {
        affectedUsers: usersWithLowPrekeys.length,
        users: usersWithLowPrekeys.slice(0, 10)
      }
    };
  }
  
  private async checkStaleSessions(): Promise<CheckResult> {
    const staleSessions = await this.findStaleSessions(30); // 30天
    
    return {
      name: 'Stale Sessions',
      status: staleSessions.length > 100 ? 'warning' : 'pass',
      details: {
        staleSessionCount: staleSessions.length
      }
    };
  }
  
  private async checkFailedDecryptions(): Promise<CheckResult> {
    const failedDecryptions = await this.countFailedDecryptions(24); // 24小时
    
    return {
      name: 'Failed Decryptions',
      status: failedDecryptions > 1000 ? 'critical' : 'pass',
      details: {
        failureCount: failedDecryptions
      }
    };
  }
  
  private async checkKeyRotation(): Promise<CheckResult> {
    const expiredKeys = await this.findExpiredSignedPrekeys(7); // 7天
    
    return {
      name: 'Key Rotation',
      status: expiredKeys.length > 0 ? 'warning' : 'pass',
      details: {
        expiredKeyCount: expiredKeys.length
      }
    };
  }
  
  private async checkUnauthorizedAccess(): Promise<CheckResult> {
    const unauthorizedAttempts = await this.countUnauthorizedAttempts(24); // 24小时
    
    return {
      name: 'Unauthorized Access',
      status: unauthorizedAttempts > 100 ? 'critical' : 'pass',
      details: {
        attemptCount: unauthorizedAttempts
      }
    };
  }
  
  private calculateOverallStatus(checks: CheckResult[]): 'pass' | 'warning' | 'critical' {
    if (checks.some(c => c.status === 'critical')) return 'critical';
    if (checks.some(c => c.status === 'warning')) return 'warning';
    return 'pass';
  }
}
```

---

## 16. 附录

### 16.1 术语表

| 术语 | 英文 | 解释 |
|------|------|------|
| 端到端加密 | End-to-End Encryption (E2EE) | 只有发送方和接收方能解密消息的加密方式 |
| X3DH协议 | Extended Triple Diffie-Hellman | Signal协议使用的初始密钥交换协议 |
| Double Ratchet | 双棘轮算法 | Signal协议使用的消息加密算法，提供前向保密 |
| 身份密钥 | Identity Key | 长期使用的密钥对，用于身份验证 |
| 签名预密钥 | Signed Prekey | 中期密钥对，定期轮换，用于初始密钥交换 |
| 一次性预密钥 | One-time Prekey | 短期密钥对，用完即弃，增强前向保密 |
| 会话状态 | Session State | 本地维护的会话信息和密钥链状态 |
| 密钥指纹 | Key Fingerprint | 身份公钥的可读表示，用于验证身份 |
| 前向保密 | Forward Secrecy | 密钥泄露不影响历史消息安全 |
| 后向保密 | Backward Secrecy | 密钥更新后旧密钥失效 |

### 16.2 参考资源

#### 16.2.1 Signal协议文档
- [Signal Protocol Specification](https://signal.org/docs/)
- [The Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement Protocol](https://signal.org/docs/specifications/x3dh/)
- [Key Fingerprint Specification](https://signal.org/docs/specifications/fingerprint/)

#### 16.2.2 实现库
- [libsignal (JavaScript)](https://github.com/signalapp/libsignal)
- [@signalapp/libsignal-client](https://github.com/signalapp/libsignal-client)
- [signal-protocol-javascript](https://github.com/signalapp/libsignal-protocol-javascript)

#### 16.2.3 安全研究
- [Signal Protocol: Formal Analysis](https://eprint.iacr.org/2016/1013)
- [On the Security of the Signal Protocol](https://eprint.iacr.org/2017/835)
- [Formal Verification of the Signal Protocol](https://www.cs.ox.ac.uk/people/cas.cremers/)

### 16.3 代码示例

#### 16.3.1 完整的加密消息示例
```typescript
// 完整的加密消息流程
async function sendEncryptedMessage(
  sender: User,
  recipient: User,
  plaintext: string
): Promise<void> {
  // 1. 获取或创建会话
  let session = await sender.getSession(recipient.id, recipient.deviceId);
  if (!session) {
    const prekeyBundle = await fetchPrekeyBundle(recipient.id, recipient.deviceId);
    session = await sender.initiateSession(recipient.id, recipient.deviceId, prekeyBundle);
  }
  
  // 2. 加密消息
  const encrypted = await sender.encryptMessage(recipient.id, recipient.deviceId, plaintext);
  
  // 3. 发送到服务器
  await server.sendMessage({
    from: sender.id,
    to: recipient.id,
    deviceId: recipient.deviceId,
    message: encrypted
  });
  
  // 4. 接收方解密
  const decrypted = await recipient.decryptMessage(sender.id, sender.deviceId, encrypted);
  
  // 5. 显示消息
  recipient.displayMessage(sender.id, decrypted);
}
```

#### 16.3.2 密钥验证流程示例
```typescript
// 密钥验证流程
async function verifyKeyFingerprint(
  userA: User,
  userB: User
): Promise<VerificationResult> {
  // 1. 获取双方的身份公钥
  const publicKeyA = await userA.getIdentityPublicKey();
  const publicKeyB = await userB.getIdentityPublicKey();
  
  // 2. 生成指纹
  const fingerprintA = await generateKeyFingerprint(publicKeyA);
  const fingerprintB = await generateKeyFingerprint(publicKeyB);
  
  // 3. 用户比对指纹
  const isVerified = await promptUserToVerifyFingerprints(
    userA,
    userB,
    fingerprintA,
    fingerprintB
  );
  
  // 4. 保存验证结果
  if (isVerified) {
    await userA.markUserAsVerified(userB.id, fingerprintB);
    await userB.markUserAsVerified(userA.id, fingerprintA);
  }
  
  return {
    userA: { fingerprint: fingerprintA, verified: isVerified },
    userB: { fingerprint: fingerprintB, verified: isVerified }
  };
}
```

### 16.4 故障排查指南

#### 16.4.1 常见问题及解决方案

**问题1: 消息解密失败**
```
症状: 接收消息时显示"解密失败"
原因: 
- 会话状态不同步
- 密钥链过期
- 消息被篡改

解决方案:
1. 删除本地会话状态
2. 重新建立会话
3. 验证发送方身份密钥
```

**问题2: 无法建立新会话**
```
症状: 发送消息时显示"无法建立会话"
原因:
- 对方预密钥已用完
- 网络连接问题
- 服务器配置错误

解决方案:
1. 检查对方预密钥数量
2. 等待对方补充预密钥
3. 检查网络连接
4. 联系管理员检查服务器
```

**问题3: 密钥指纹不匹配**
```
症状: 密钥验证时指纹不一致
原因:
- 中间人攻击
- 对方更换了设备
- 对方重置了密钥

解决方案:
1. 通过其他渠道确认对方身份
2. 重新验证密钥指纹
3. 如确认是对方更换设备，更新验证状态
```

**问题4: 加密性能缓慢**
```
症状: 消息加密/解密耗时过长
原因:
- 设备性能不足
- 会话数量过多
- 加密库未优化

解决方案:
1. 关闭不必要的会话
2. 清理过期会话
3. 使用WebAssembly版本加密库
4. 升级设备硬件
```

### 16.5 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-15 | Security Chat Team | 初始版本，完整的技术开发方案 |

---

## 17. 移动端支持与设备链接详解

### 17.1 移动端技术架构

#### 17.1.1 核心组件
- **加密核心**: 共享桌面端的核心加密逻辑
- **平台适配层**: 处理平台特定的安全存储和网络操作
- **原生模块**: 桥接Rust实现的libsignal-client
- **UI组件**: 与桌面端保持一致的用户体验

#### 17.1.2 技术实现
```typescript
// 移动端加密模块架构
interface MobileSignalModule {
  // 初始化加密模块
  initialize(): Promise<boolean>;
  
  // 密钥管理
  generateIdentityKeyPair(): Promise<IdentityKeyPair>;
  generatePrekeys(): Promise<PrekeyBundle>;
  
  // 会话管理
  initiateSession(prekeyBundle: PrekeyBundle): Promise<Session>;
  encryptMessage(session: Session, plaintext: string): Promise<EncryptedMessage>;
  decryptMessage(session: Session, encrypted: EncryptedMessage): Promise<string>;
  
  // 设备链接
  generateLinkingQRCode(): Promise<string>;
  scanLinkingQRCode(qrCode: string): Promise<LinkingResult>;
  
  // 密钥验证
  generateKeyFingerprint(identityKey: PublicKey): Promise<string>;
  verifyKeyFingerprint(fingerprint: string): Promise<boolean>;
}
```

### 17.2 设备链接详细流程

#### 17.2.1 主从设备模式
1. **主设备**：生成身份密钥对，管理所有预密钥
2. **从设备**：通过主设备授权获取密钥，独立运行

#### 17.2.2 链接流程
```
┌─────────────────┐                   ┌─────────────────┐
│   主设备        │                   │   从设备        │
└────────┬────────┘                   └────────┬────────┘
         │                                    │
         │ 1. 生成临时密钥对                   │
         │ 2. 显示二维码（包含临时公钥）        │
         │                                    │
         │ ◄───────── 3. 扫描二维码 ───────────┤
         │ 4. 从设备生成临时密钥对             │
         │ 5. 建立临时加密通道                 │
         │ 6. 主设备发送身份密钥 + 预密钥      │
         │                                    │
         │ ◄──────── 7. 从设备验证指纹 ─────────┤
         │ 8. 主设备确认验证结果              │
         │ 9. 从设备激活并独立运行            │
         │                                    │
┌────────┴────────┐                   ┌────────┴────────┐
│   主设备        │                   │   从设备        │
└─────────────────┘                   └─────────────────┘
```

#### 17.2.3 密钥指纹验证
**关键概念**：
- **密钥指纹**：身份公钥的可视化表示，60位数字，分为5组
- **验证方式**：
  1. **二维码验证**：从设备扫描主设备显示的指纹二维码
  2. **手动验证**：用户口头核对指纹数字
  3. **生物识别**：使用设备的指纹/面部识别（可选）

**无生物识别设备的处理**：
- 自动降级到二维码或手动验证
- 提供清晰的视觉引导
- 支持多种验证渠道（如视频通话）

### 17.3 移动端性能优化

#### 17.3.1 内存管理
- **会话状态压缩**：减少内存占用
- **懒加载**：按需加载会话状态
- **垃圾回收**：及时清理过期会话

#### 17.3.2 网络优化
- **批量预密钥上传**：减少网络请求
- **WebSocket重连**：优化移动网络环境
- **消息压缩**：减少传输数据量

#### 17.3.3 电池优化
- **加密操作批处理**：减少CPU唤醒
- **后台同步**：智能调度同步时机
- **硬件加速**：利用设备硬件加密能力

### 17.4 安全性考虑

#### 17.4.1 移动端特有风险
- **设备丢失**：实现远程擦除功能
- ** jailbreak/root**：检测并警告
- **应用切换**：保护内存中的密钥
- **权限管理**：最小化必要权限

#### 17.4.2 防护措施
- **密钥材料保护**：使用系统安全存储
- **运行时保护**：检测调试器和异常环境
- **传输加密**：强制TLS 1.3
- **安全更新**：及时修复漏洞

---

## 18. 实施路线图

### 18.1 阶段一：桌面端核心实现（4-5周）
1. **周1-2**：基础架构搭建
   - 集成libsignal-client
   - 数据库迁移
   - API接口实现

2. **周3-4**：核心功能开发
   - 密钥管理
   - X3DH密钥交换
   - Double Ratchet加密/解密
   - 会话管理

3. **周5**：集成与测试
   - 消息流程集成
   - 密钥指纹验证
   - 性能优化

### 18.2 阶段二：移动端准备（2-3周，可选）
1. **周1**：架构设计
   - 跨平台接口定义
   - 原生模块设计
   - 性能预算制定

2. **周2-3**：基础实现
   - 核心加密模块
   - 平台适配层
   - 设备链接功能

### 18.3 阶段三：多设备同步（2周，可选）
1. **周1**：设备管理
   - 主从设备模式
   - 二维码链接
   - 密钥同步

2. **周2**：测试与优化
   - 多设备测试
   - 性能优化
   - 安全审计

---

## 文档结束

本文档提供了完整的Signal协议端到端加密技术开发方案，涵盖了从技术架构、实现细节到部署运维的各个方面。在实施过程中，请严格按照本文档的规范进行，确保系统的安全性和可靠性。

如有任何疑问或需要进一步的技术支持，请联系技术团队。
