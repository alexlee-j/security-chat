# 前端代码 Review 报告

> **Review 日期:** 2026-04-11
> **Review 范围:** apps/desktop/src 前端代码
> **Review 方式:** 单模块 Review + 模块间串联 Review

---

## 第一阶段：单模块 Review 结果

### 模块 Review 汇总

| # | 模块 | 文件 | 状态 | 主要发现 |
|---|------|------|------|---------|
| 1 | use-chat-client | `core/use-chat-client.ts` | ✅ 通过 | 设备 ID 设置在新 KeyManager 实例上无效 |
| 2 | use-signal | `core/use-signal.ts` | ⚠️ 需关注 | initialize 无条件调用；KeyManager 实例不共享；固定 deviceId |
| 3 | api | `core/api.ts` | ✅ 通过 | 群聊 API 返回类型不完整 |
| 4 | crypto | `core/crypto.ts` | ✅ 通过 | - |
| 5 | secure-storage | `core/secure-storage.ts` | ✅ 通过 | 加密失败降级到明文 |
| 6 | auth-storage | `core/auth-storage.ts` | ⚠️ 需关注 | encryptedPassword 命名误导 |
| 7 | auth | `features/auth/*` | ✅ 通过 | mockEvent 类型断言 |
| 8 | chat | `features/chat/*` | ⚠️ 需关注 | 焚毁按钮对发送者可见 |
| 9 | friend | `features/friend/*` | ✅ 通过 | - |

---

## 第二阶段：串联 Review 发现的问题

### 🚨 严重问题

#### 问题 1：自动登录密码格式不匹配（Critical）

**位置:** `App.tsx:76` + `auth-storage.ts`

**问题描述:**
自动登录时，`App.tsx` 使用 `auth-storage` 中存储的 `encryptedPassword` 调用登录 API：
```typescript
const result = await loginApi(credentials.account, credentials.encryptedPassword);
```

但 `encryptedPassword` 是通过 `secure-storage.ts` 的 **AES-GCM 加密**的密文。

后端 `auth.service.ts:99` 使用 **bcrypt.compare** 比对：
```typescript
const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
```

**影响:** 自动登录功能**永远无法成功**。

**修复建议:**
1. **方案 A（推荐）:** 自动登录时不使用加密存储的密码，而是存储原始密码的 bcrypt hash（或使用 refresh token）
2. **方案 B:** 修改后端登录 API，支持预加密密码登录（需要额外的密钥派生逻辑）

---

#### 问题 2：登录后设备 ID 设置无效

**位置:** `use-chat-client.ts:742-748`

**问题描述:**
```typescript
const devices = await import('./api').then(api => api.getDevices());
if (devices && devices.length > 0) {
  const primaryDevice = devices[0];
  const keyManager = new (await import('./signal/key-management')).KeyManager();
  await keyManager.setDeviceId(primaryDevice.deviceId);
}
```

这里创建了**新的 KeyManager 实例**，而不是使用 `useSignal` 中已经初始化的 `keyManagerRef`。因此 `setDeviceId` 的设置不会生效。

**修复建议:**
通过 `useSignal` 的 actions 或 state 暴露 `setDeviceId` 方法，或在 `useSignal` 初始化后调用设备 ID 设置。

---

#### 问题 3：Signal 初始化无条件执行

**位置:** `use-signal.ts:328-330`

**问题描述:**
```typescript
useEffect(() => {
  void initialize();
}, []);
```

组件挂载就执行 `initialize()`，与登录状态无关。这会导致：
1. 未登录时初始化会因无 token 而无法上传预密钥
2. 每次组件重新挂载都会重新初始化

**修复建议:**
```typescript
useEffect(() => {
  if (auth) {  // 假设有 auth 状态
    void initialize();
  }
}, [auth]);
```

---

### ⚠️ 需关注问题

#### 问题 4：焚毁按钮对发送者可见

**位置:** `chat-panel.tsx:1045-1049`

**问题描述:**
焚毁按钮对所有用户显示，但根据业务逻辑，只有**接收者**可以触发焚毁。

**修复建议:**
```typescript
// 添加条件判断
{row.isBurn && !isRevoked && row.senderId !== props.currentUserId ? (
  <button ...>焚毁</button>
) : null}
```

---

#### 问题 5：KeyManager 实例不共享

**位置:** `use-signal.ts` vs `message-encryption.ts`

**问题描述:**
- `use-signal.ts` 创建自己的 `keyManagerRef`
- `messageEncryptionService` 创建自己的 `keyManager`

两者不同步，可能导致预密钥状态检查与实际使用不一致。

**修复建议:**
使用单例模式或通过 React Context 共享 KeyManager 实例。

---

#### 问题 6：Session 存储使用固定 deviceId

**位置:** `key-management.ts:587-590`

**问题描述:**
```typescript
private getSessionKey(remoteUserId: string, remoteDeviceId: string): string {
  return `session-${remoteUserId}-1`;  // 固定使用 '1'
}
```

注释说明这是临时方案，多设备场景下无法正确区分设备。

**影响:**
用户切换设备后，新设备的 Signal 会话无法正确建立。

---

## 业务逻辑闭环检查

### ✅ 正常的流程

| 流程 | 状态 | 说明 |
|------|------|------|
| 正常登录 | ✅ | 账号密码 → bcrypt 比对 → 成功 |
| 验证码登录 | ✅ | 流程正确 |
| 注册 | ✅ | Signal 初始化 → 密钥生成 → API 注册 |
| 消息发送 | ✅ | Signal 加密 → sendMessage → WebSocket |
| 消息接收 | ✅ | WebSocket → 解密 → 显示 |
| 好友请求 | ✅ | 搜索 → 发送 → 接受/拒绝 |
| 会话管理 | ✅ | 创建/删除/置顶/静音 |

### ❌ 有问题的流程

| 流程 | 状态 | 说明 |
|------|------|------|
| 自动登录 | ❌ | 密码格式不匹配，永远失败 |
| 设备切换 | ⚠️ | Session 存储使用固定 deviceId |

---

## 优先级修复建议

### P0 - 必须修复

1. **自动登录密码格式不匹配** - 影响核心功能
2. **登录后设备 ID 设置无效** - 影响多设备支持

### P1 - 应该修复

3. **Signal 初始化条件** - 避免无谓的初始化尝试
4. **焚毁按钮权限** - 业务逻辑正确性

### P2 - 可以修复

5. **KeyManager 实例共享** - 代码质量
6. **Session deviceId 临时方案** - 多设备支持

---

## 总结

### 代码质量评价

整体代码质量**较高**，实现了完整的功能：
- ✅ Signal 协议集成
- ✅ 完整的认证流程
- ✅ 消息加密通信
- ✅ 阅后即焚功能
- ✅ 好友关系管理

### 主要风险

1. **自动登录功能不可用** - 用户必须每次手动输入密码
2. **多设备支持不完整** - Session 存储方案是临时方案

### 建议

1. 优先修复 P0 问题，特别是自动登录
2. 考虑使用 refresh token 机制实现自动登录
3. 完善多设备 Signal 会话管理
