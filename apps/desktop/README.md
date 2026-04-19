# Security Chat Desktop (Tauri + React + Rust)

Security Chat 桌面应用 - 使用 Tauri 2.x 和 libsignal-protocol 官方库实现的端到端加密聊天应用。

## 技术栈

- **框架**: Tauri 2.x + React 18 + TypeScript + Vite 5
- **Signal 协议**: `libsignal-protocol` (官方 Rust 库 v0.90)
- **打包工具**: `@tauri-apps/cli`
- **支持平台**: macOS / Windows / Linux

## 架构设计

```
┌─────────────────────────────────────┐
│   Tauri Commands (Rust)             │
│   libsignal-protocol                │
│   - 密钥管理 / 会话管理 / 加密解密   │
└─────────────────────────────────────┘
                    ↕ IPC
┌─────────────────────────────────────┐
│   React Renderer                    │
│   - UI 渲染 / 用户交互               │
└─────────────────────────────────────┘
```

## 快速开始

### 开发模式

```bash
# 安装依赖
pnpm install

# 启动 Tauri 开发环境
pnpm run tauri:dev
```

### 构建应用

```bash
# 构建 macOS 应用
pnpm run tauri:build -- --target universal-apple-darwin

# 构建 Windows 应用
pnpm run tauri:build -- --target x86_64-pc-windows-msvc

# 构建 Linux 应用
pnpm run tauri:build -- --target x86_64-unknown-linux-gnu
```

## 项目结构

```
desktop/
├── src/                     # React 渲染进程
│   ├── core/
│   │   ├── api/             # Tauri API 调用
│   │   ├── hooks/           # React Hooks
│   │   ├── services/        # 业务服务
│   │   ├── signal/          # Signal 协议集成
│   │   ├── utils/           # 工具函数
│   │   └── types.ts         # TypeScript 类型
│   ├── features/
│   │   ├── auth/            # 认证模块
│   │   ├── chat/            # 聊天模块
│   │   └── contacts/        # 联系人模块
│   ├── App.tsx              # 主组件
│   └── main.tsx             # 入口文件
├── src-tauri/               # Tauri Rust 后端
│   ├── src/
│   │   ├── signal/          # Signal 协议实现
│   │   ├── api/             # Tauri Commands
│   │   └── db/              # SQLite 持久化
│   ├── Cargo.toml           # Rust 依赖配置
│   └── tauri.conf.json      # Tauri 配置
├── public/                  # 静态资源
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 核心功能

### Signal 协议集成

- **X3DH 密钥交换**: 完整的 4 次 DH 计算
- **Double Ratchet**: 消息链式加密，前向保密
- **后量子密码学**: Kyber1024 KEM
- **预密钥系统**: 签名预密钥 + 一次性预密钥

### 聊天功能

- 登录/注册
- 会话列表
- 创建单聊会话
- 消息发送/接收
- 消息状态 (已发送/已送达/已读)
- 阅后即焚

### 媒体消息

- **文本消息**: 端到端加密
- **图片消息**: Canvas 压缩上传
- **语音消息**: 波形显示 (wavesurfer.js)
- **文件消息**: 上传/下载

### 好友系统

- 搜索用户
- 发送好友请求
- 处理好友请求
- 好友列表
- 黑名单管理

### 实时通信

- WebSocket 连接
- 心跳检测
- 自动重连
- 事件监听:
  - `message.sent`
  - `message.delivered`
  - `message.read`
  - `burn.triggered`
  - `conversation.typing`

## Tauri 集成

### Tauri Commands (Rust)

```rust
// src-tauri/src/api/commands.rs

#[tauri::command]
pub async fn initialize_identity_command(state: State<AppState>) -> Result<bool, String> {
    initialize_store(&state.store).await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn encrypt_message_command(
    recipient_id: String,
    plaintext: String,
    state: State<AppState>,
) -> Result<EncryptedMessage, String> {
    let address = ProtocolAddress::new(&recipient_id, 1);
    encrypt_message(&state.store, &address, plaintext.as_bytes())
        .await
        .map_err(|e| e.to_string())
}
```

### React 调用

```typescript
// src/core/api/tauri.ts
import { invoke } from '@tauri-apps/api/core'

export async function initializeIdentity(): Promise<boolean> {
  return invoke('initialize_identity_command')
}

export async function encryptMessage(
  recipientId: string,
  plaintext: string
): Promise<EncryptedMessage> {
  return invoke('encrypt_message_command', { recipientId, plaintext })
}
```

## 可扩展架构

- `src/core`: API 客户端、类型定义、状态管理
- `src/features/<domain>`: 领域功能模块
- `src-tauri/src/signal/`: Signal 协议核心实现
- `src-tauri/src/db/`: SQLite 持久化存储

推荐扩展模式：

1. 在 `src/features/<domain>` 添加新模块
2. 在 `src/core` 保持网络请求和跨域状态
3. Rust 后端实现核心加密逻辑

## 开发规范

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- Rust clippy

### 测试

```bash
# Rust 测试
cd src-tauri && cargo test

# TypeScript 检查
pnpm tsc --noEmit

# 前端构建
pnpm build
```

## 打包发布

### macOS

```bash
pnpm run tauri:build -- --target universal-apple-darwin
# 输出：src-tauri/target/universal-apple-darwin/release/bundle/dmg/
```

### Windows

```bash
pnpm run tauri:build -- --target x86_64-pc-windows-msvc
# 输出：src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/
```

### Linux

```bash
pnpm run tauri:build -- --target x86_64-unknown-linux-gnu
# 输出：src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/
```

## 安全特性

### 端到端加密

- **协议**: X3DH + Double Ratchet (Signal 官方协议)
- **密钥交换**: ECDH P-256 (4 次 DH 计算)
- **消息加密**: AES-256-GCM
- **签名算法**: ECDSA P-256
- **密钥派生**: HKDF (HMAC-SHA256)
- **后量子**: Kyber1024 KEM

### 密钥存储

- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service API

### 传输安全

- 强制使用 TLS 1.3
- WebSocket 安全传输
- JWT 认证

## 性能优化

### 消息虚拟化

使用 `react-window` 实现虚拟滚动：

```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={100}
  width="100%"
>
  {MessageItem}
</FixedSizeList>
```

### 图片压缩

使用 Canvas API 压缩图片：

```typescript
import { compressImage } from './core/utils/image-compressor'

const compressedBlob = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
})
```

### 语音波形

使用 `wavesurfer.js` 显示语音波形：

```typescript
import WaveSurfer from 'wavesurfer.js'

const ws = WaveSurfer.create({
  container: waveformContainerRef.current,
  waveColor: '#4fc3f7',
  progressColor: '#29b6f6',
  barWidth: 2,
  height: 60,
})
```

## 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [Signal 官方文档](https://signal.org/docs/)
- [libsignal-protocol 源码](https://github.com/signalapp/libsignal)
- [react-window](https://github.com/bvaughn/react-window)
- [wavesurfer.js](https://wavesurfer.xyz/)

## 故障排查

### 常见问题

1. **Tauri 启动失败**
   - 检查 Rust 版本 >= 1.85
   - 重新安装依赖 `pnpm install`
   - 清理构建缓存 `rm -rf src-tauri/target`

2. **Signal 库加载失败**
   - 检查 `libsignal-protocol` 是否正确配置
   - 运行 `cargo update` 更新依赖

3. **打包后应用无法打开**
   - macOS: 在系统设置中允许应用
   - Windows: 检查杀毒软件拦截
   - Linux: 检查依赖库 `ldd`

## 更新日志

### v1.1.0 (2026-04-19) - Desktop Product Surface Closure

#### 新增功能

**会话列表**
- 搜索功能：支持按用户名、会话ID、消息内容搜索
- 右键上下文菜单：置顶、静音、删除会话、复制ID
- 静音/置顶状态徽章显示
- 空状态和搜索空结果状态

**聊天界面**
- 消息右键菜单：复制、引用、转发、下载、删除
- 阅后即焚倒计时显示和焚毁按钮
- 消息状态指示器：发送中/已发送/已送达/已读
- 聊天内搜索：关键词高亮、跳转定位

**输入区**
- Emoji 选择器：追加到现有文本，不影响引用/附件状态
- 附件预览：选择文件后显示预览，支持取消
- 引用回复：显示引用内容，支持取消

**设置页面**
- 通知设置：支持所有后端通知类别
  - 新消息通知
  - 好友请求通知
  - 阅后即焚通知
  - 群聊通知
  - 密码恢复通知
  - 安全事件通知
  - 群成员变更通知
- 主题切换：Light/Dark/Auto

**群组功能**
- 创建群组
- 管理群资料（名称、描述）
- 添加/移除群成员
- 群类型选择（私密群/公开群）

#### 已知限制

以下功能在本版本中不开放：
- 音频通话、视频通话（UI 已预留，需后续实现）
- 屏幕共享
- 消息编辑

### v1.0.0 (2026-03-29)

- ✅ 集成 libsignal-protocol 官方库
- ✅ 实现 X3DH + Double Ratchet 协议
- ✅ 支持文本/图片/语音/文件消息
- ✅ 消息虚拟化滚动 (react-window)
- ✅ 文件下载功能
- ✅ 语音消息波形显示 (wavesurfer.js)
- ✅ Prometheus + Grafana 监控集成
- ✅ 完整的端到端测试

### v0.1.0 (2026-02-25)

- ✅ 核心聊天功能完成
- ✅ 端到端加密 (自研实现)
- ✅ 阅后即焚功能
