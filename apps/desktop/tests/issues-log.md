# Signal 协议 E2E 加密测试 - 问题记录

## 测试时间
2026-03-17

## 测试环境
- 前端: http://localhost:4174
- 后端: http://localhost:3000/api/v1
- 测试工具: Playwright

---

## 🔴 P0 严重问题

### 1. CryptoKey 序列化问题 ✅ 已修复

**问题描述**:
Web Crypto API 的 `CryptoKey` 对象无法被 `JSON.stringify` 序列化，存储到 localStorage 后变成普通对象，读取后没有正确转换回 `CryptoKey`，导致 Web Crypto API 报错。

**错误信息**:
```
Failed to calculate shared secret: TypeError: 
Failed to execute 'deriveBits' on 'SubtleCrypto': 
parameter 2 is not of type 'CryptoKey'.
```

**修复方案**:
1. **身份密钥 (`IdentityKeys`)**:
   - 存储时使用 `crypto.subtle.exportKey('jwk', key)` 导出为 JWK 格式
   - 读取时使用 `crypto.subtle.importKey('jwk', ...)` 重新导入为 CryptoKey

2. **预密钥 (`Prekeys`)**:
   - 添加 `serializeSignedPrekey` / `deserializeSignedPrekey` 方法
   - 添加 `serializeOneTimePrekey` / `deserializeOneTimePrekey` 方法
   - 同样使用 JWK 格式进行序列化

**修改文件**:
- `apps/desktop/src/core/signal/key-management.ts`

**关键代码**:
```typescript
// 保存身份密钥
async saveKeyPair(keyPair: IdentityKeyPair): Promise<void> {
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  await this.storage.set('identityKeyPair', {
    privateKeyJwk,
    publicKeyJwk,
    publicKeyBytes: Array.from(keyPair.publicKeyBytes),
  });
}

// 读取身份密钥
async getKeyPair(): Promise<IdentityKeyPair | null> {
  const data = await this.storage.get('identityKeyPair');
  const privateKey = await crypto.subtle.importKey('jwk', data.privateKeyJwk, ...);
  const publicKey = await crypto.subtle.importKey('jwk', data.publicKeyJwk, ...);
  return { privateKey, publicKey, publicKeyBytes };
}
```

**状态**: ✅ 已修复，构建成功

---

### 2. 消息加密/解密失败 ✅ 已修复

**问题描述**:
消息发送成功，但接收方无法解密，出现 `OperationError`。

**根本原因**:
1. **密钥派生问题**: `nextChainKey` 生成随机密钥，导致发送方和接收方的链密钥不同步
2. **X3DH 密钥交换问题**: 发送方的临时公钥没有正确传递给接收方
3. **自己发送的消息解密问题**: 发送方尝试用 `receivingChain` 解密自己发送的消息

**修复方案**:
1. **修复密钥派生**:
   - 使用 KDF (PBKDF2) 替代随机生成
   - 确保发送方和接收方使用相同的派生逻辑

2. **修复 X3DH 密钥交换**:
   - 在 `initiateSession` 中保存临时公钥
   - 第一条消息使用临时公钥作为 `baseKey`

3. **跳过自己发送的消息解密**:
   - 在 `decodePayload` 中检查 `senderId`
   - 如果是自己发送的消息，使用默认解密

**修改文件**:
- `apps/desktop/src/core/signal/index.ts`
- `apps/desktop/src/core/use-chat-client.ts`

**关键代码**:
```typescript
// 使用 KDF 推进链密钥
static async nextChainKey(currentKey: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = encoder.encode('chain_key');
  const keyMaterial = await crypto.subtle.importKey('raw', currentKey.slice().buffer, ...);
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 1, hash: 'SHA-256' }, keyMaterial, 256);
  return new Uint8Array(derivedBits);
}

// 跳过自己发送的消息
if (senderId === authRef.current?.userId) {
  console.log('Skipping Signal decryption for self-sent message');
  decrypted = decodePayloadApi(payload);
}
```

**状态**: ✅ 已修复，测试通过

**测试结果**:
```
[A] encryptMessage messageKey: [53, 172, 2, 183, 213, 6, 23, 147, ...]
[B] decryptMessage messageKey: [53, 172, 2, 183, 213, 6, 23, 147, ...]
✅ 未发现错误日志
```

---

## 🟡 P1 中等问题

### 2. 创建会话需要 UUID ✅ 已修复

**问题描述**:
创建会话时，输入框要求输入用户 ID (UUID)，但用户通常只知道用户名。

**修复方案**:
1. 修改 `onCreateDirect` 函数，自动检测输入格式
2. 如果不是 UUID，调用 `searchUsers` API 搜索用户
3. 更新输入框提示文本为"输入用户名或用户 ID 发起聊天"

**修改文件**:
- `apps/desktop/src/core/use-chat-client.ts`
- `apps/desktop/src/features/chat/conversation-sidebar.tsx`

**关键代码**:
```typescript
async function onCreateDirect(event: FormEvent<HTMLFormElement>): Promise<void> {
  // ...
  let targetUserId = peerUserId.trim();
  
  // 如果不是 UUID 格式，尝试搜索用户
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(targetUserId)) {
    const searchResults = await searchUsers(targetUserId, 5);
    if (searchResults.length === 0) {
      setError('未找到该用户，请检查用户名。');
      return;
    }
    targetUserId = searchResults[0].userId;
  }
  
  const result = await createDirectConversation(targetUserId);
  // ...
}
```

**状态**: ✅ 已修复，测试通过

---

### 3. 消息显示问题 ✅ 已修复

**问题描述**:
发送消息后，发送方界面未显示消息内容（或显示为密文）。

**修复方案**:
- 修复了 CryptoKey 序列化问题后，消息显示正常
- 添加了跳过自己发送消息的 Signal 解密逻辑

**状态**: ✅ 已修复

## 🟢 P2 低优先级问题

### 4. 测试脚本改进 ✅ 已修复

**问题描述**:
E2E 测试脚本需要手动获取用户ID，流程不够自动化。

**修复方案**:
1. 支持用户名搜索创建会话
2. 添加双向通信测试（A→B 和 B→A）
3. 添加右键菜单功能测试
4. 优化页面刷新逻辑，使用 WebSocket 实时接收消息

**状态**: ✅ 已修复，测试通过

---

## 📋 修复完成总结

### 已修复问题

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | CryptoKey 序列化问题 | ✅ 已修复 |
| P0 | 消息加密/解密失败 | ✅ 已修复 |
| P1 | 创建会话需要 UUID | ✅ 已修复 |
| P1 | 消息显示问题 | ✅ 已修复 |
| P2 | 测试脚本改进 | ✅ 已修复 |

### 功能验证

- ✅ 用户注册与登录
- ✅ Signal 密钥生成
- ✅ 用户名搜索创建会话
- ✅ 消息加密发送（A→B）
- ✅ 消息解密接收（B）
- ✅ 消息回复（B→A）
- ✅ 双向通信
- ✅ 右键菜单（复制、引用、转发、删除）

### 截图记录

1. `05-user-a-conversation.png` - 会话创建成功
2. `07-user-b-message-received.png` - 消息接收成功
3. `08-context-menu.png` - 右键菜单正常
4. `09-user-b-reply-sent.png` - 回复发送成功
5. `10-user-a-reply-received.png` - 回复接收成功

**所有功能已验证通过！** 🎉

---

## 📋 修复优先级

| 优先级 | 问题 | 影响 | 修复难度 |
|--------|------|------|----------|
| P0 | CryptoKey 序列化 | 聊天功能完全不可用 | 中等 |
| P1 | 创建会话需要 UUID | 用户体验差 | 低 |
| P1 | 消息显示问题 | 功能可用但体验差 | 低 |
| P2 | 测试脚本改进 | 仅影响测试 | 低 |
| P2 | 错误处理优化 | 仅影响体验 | 低 |

---

## 🔧 修复计划

### 阶段 1: 修复 P0 问题 (1-2 天)
1. 修改 `key-management.ts` 中的会话序列化逻辑
2. 实现 CryptoKey 导出/导入
3. 测试加密/解密功能

### 阶段 2: 优化 P1 问题 (2-3 天)
1. 添加用户名搜索创建会话
2. 优化用户ID获取方式
3. 修复消息显示问题

### 阶段 3: 改进 P2 问题 (1 天)
1. 优化错误处理
2. 改进测试脚本
3. 完善文档

---

## 📸 测试截图

1. `05-b-menu-opened.png` - 汉堡菜单显示用户ID
2. `05-filled-uuid.png` - 填入用户ID准备创建会话
3. `05-user-a-conversation.png` - 会话创建成功

---

## 📝 备注

- Signal 协议基础架构已实现
- X3DH 密钥交换逻辑正确
- 主要问题是密钥存储/读取的序列化
- 修复后需要重新测试完整流程
