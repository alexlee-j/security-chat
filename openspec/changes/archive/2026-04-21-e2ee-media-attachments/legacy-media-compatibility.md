# 旧版媒体兼容性文档

## 概述

本文档描述 E2EE 媒体加密实现中旧版明文媒体附件的兼容性行为，以及未来迁移/移除的选项。

## 背景

在 E2EE 媒体附件功能实现之前，桌面客户端上传的图片、音频和文件是以明文形式存储在后端的。现有数据库中可能仍存在这些旧版明文媒体资产。

**设计决策**：不要求用户迁移或删除现有明文媒体，而是通过版本化元数据保持向后兼容性。

## 兼容性机制

### 消息载荷结构

新版本媒体消息使用 `payload.media` 对象（version 1）：

```json
{
  "type": 2,
  "media": {
    "version": 1,
    "assetId": "uuid",
    "algorithm": "aes-256-gcm",
    "key": "base64url",
    "nonce": "base64url",
    "ciphertextDigest": "base64url",
    "ciphertextSize": 123456,
    "plainDigest": "base64url",
    "plainSize": 120000,
    "fileName": "photo.png",
    "mimeType": "image/png"
  }
}
```

旧版媒体消息使用 `payload.mediaUrl` 和 `payload.fileName` 字段：

```json
{
  "type": 2,
  "mediaUrl": "https://backend/media/uuid",
  "fileName": "photo.png"
}
```

### 客户端回退逻辑

桌面客户端按以下顺序解析媒体 URL：

1. **优先检查 `payload.media`**：如果存在且 version === 1，使用加密媒体路径
2. **回退到 `payload.mediaUrl`**：如果 media 不存在或无效，使用旧版明文 URL
3. **均不存在时**：显示适当的错误状态

相关代码位于 `apps/desktop/src/core/media-message.ts`：

```typescript
export function resolveLegacyMediaUrl(payload: Pick<MediaMessagePayload, 'mediaUrl'> | null | undefined): string | null {
  const value = payload?.mediaUrl?.trim();
  return value ? value : null;
}
```

### 后端存储

- **新版本媒体**：后端仅存储密文和密文元数据（ciphertext digest, ciphertext size）
- **旧版媒体**：后端继续以原有方式存储明文文件和元数据

后端 `media_assets` 表通过 `encryptionVersion` 字段（或缺失该字段）区分两种类型。

## 错误处理

### 加密媒体错误类型

| 错误类型 | 代码 | 用户提示 |
|---------|------|---------|
| 解密失败 | `decrypt_failed` | "解密失败，请检查密钥" |
| 元数据缺失 | `metadata_missing` | "媒体元数据缺失" |
| 旧版不可用 | `legacy_unavailable` | "旧版媒体不可用" |
| 下载失败 | `download_failed` | "下载失败" |

### UI 错误状态

媒体加载失败时，消息气泡显示锁定图标和错误提示，而不是加载失败的网络错误图标。

详见 `apps/desktop/src/features/chat/message-bubble.tsx` 中的 `mediaError` 状态处理。

## 未来迁移选项

### 选项 1：保持现状（推荐短期）

**优点**：
- 无需用户操作
- 不破坏现有聊天记录
- 实现复杂度低

**缺点**：
- 旧版媒体仍在服务器存储明文
- 占用存储空间但不提供 E2EE 保护

### 选项 2：用户触发迁移

**触发条件**：用户首次查看旧版媒体时，提示用户"重新下载并加密"

**优点**：
- 用户控制迁移时机
- 逐步迁移，减少服务中断

**缺点**：
- 需要实现迁移逻辑
- 用户体验复杂度增加
- 迁移期间服务器仍需处理明文

### 选项 3：后台自动迁移

**实现方式**：
- 后端定时任务扫描旧版媒体
- 自动下载、重加密、上传

**优点**：
- 用户无感知
- 最终可清理所有明文存储

**缺点**：
- 实现复杂
- 需要处理大量数据
- 迁移期间资源消耗大

### 选项 4：强制重发

**实现方式**：
- 旧版媒体显示为"不可用"
- 用户需要重新选择文件发送

**优点**：
- 最彻底的 E2EE 覆盖
- 存储清理简单

**缺点**：
- 用户体验差
- 丢失历史媒体

## 迁移决策矩阵

| 考量因素 | 选项 1 | 选项 2 | 选项 3 | 选项 4 |
|---------|--------|--------|--------|--------|
| 用户体验影响 | 无 | 低 | 无 | 高 |
| 实现复杂度 | 无 | 中 | 高 | 低 |
| 存储清理 | 无 | 部分 | 完全 | 完全 |
| E2EE 覆盖率 | 部分 | 完全 | 完全 | 完全 |
| 数据丢失风险 | 无 | 低 | 中 | 高 |

## 已知限制

1. **历史消息**：现有数据库中的旧版明文媒体将继续以明文形式存储
2. **移动端**：当前实现仅覆盖桌面端，移动端可能无法解密新版本媒体（如果用户仅在移动端查看历史）
3. **转发**：转发的旧版媒体仍然使用明文 URL，不重新加密
4. **搜索**：后端无法搜索加密媒体内容，只能通过文件名匹配

## 测试命令

验证旧版媒体兼容性：

```bash
# 1. 启动后端
pnpm start:backend:dev

# 2. 启动桌面应用
pnpm run tauri:dev

# 3. 发送一条图片消息（使用旧版明文上传路径）
# - 选择一张图片发送
# - 检查网络请求是否为明文上传

# 4. 验证消息载荷
# - 在开发者工具中查看 WebSocket 消息
# - 确认旧版消息使用 mediaUrl 字段
# - 确认新版消息使用 media 字段

# 5. 验证错误处理
# - 断开网络，尝试加载图片
# - 确认显示相应的错误状态
```

## 相关文件

- `apps/desktop/src/core/media-crypto.ts` - 加密/解密核心逻辑
- `apps/desktop/src/core/media-message.ts` - 消息载荷解析和回退逻辑
- `apps/desktop/src/features/chat/chat-panel.tsx` - 媒体加载和错误状态管理
- `apps/desktop/src/features/chat/message-bubble.tsx` - 消息气泡 UI 和错误状态显示
- `apps/backend/src/modules/media/media.service.ts` - 后端媒体服务
