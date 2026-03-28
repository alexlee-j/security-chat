# Desktop Application (Electron + React + Vite)

Security Chat 桌面应用 - 使用 Electron 和 Signal 官方库实现的端到端加密聊天应用。

## 技术栈

- **框架**: Electron 30 + React 18 + TypeScript + Vite 5
- **Signal 协议**: `@signalapp/libsignal-client` (官方库 v0.90)
- **打包工具**: electron-builder
- **支持平台**: macOS / Windows / Linux

## 架构设计

```
┌─────────────────────────────────────┐
│   Electron Main Process (Node.js)   │
│   @signalapp/libsignal-client       │
│   - 密钥管理 / 会话管理 / 加密解密   │
└─────────────────────────────────────┘
                    ↕ IPC
┌─────────────────────────────────────┐
│   Electron Renderer (React)         │
│   - UI 渲染 / 用户交互               │
└─────────────────────────────────────┘
```

## 快速开始

### 开发模式

```bash
# 安装依赖
pnpm install

# 启动 Electron 开发环境
pnpm run electron:dev
```

### 构建应用

```bash
# 构建 macOS 应用
pnpm run electron:build:mac

# 构建 Windows 应用
pnpm run electron:build:win

# 构建 Linux 应用
pnpm run electron:build:linux

# 仅构建前端 (不打包 Electron)
pnpm build
```

## 项目结构

```
desktop/
├── electron/                # Electron 主进程
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   └── signal-bridge.ts     # Signal 官方库桥接
├── src/                     # React 渲染进程
│   ├── core/
│   │   ├── signal/          # Signal 服务 (IPC 调用)
│   │   └── ...
│   └── ...
├── public/                  # 静态资源
├── package.json
├── vite.config.ts
└── electron-builder.config.js
```

## 核心功能

### Signal 协议集成

- **X3DH 密钥交换**: 完整的 4 次 DH 计算
- **Double Ratchet**: 消息链式加密，前向保密
- **预密钥系统**: 签名预密钥 + 一次性预密钥 (100 个)
- **消息加密**: AES-256-GCM

### 聊天功能

- 登录/注册
- 会话列表
- 创建单聊会话
- 消息发送/接收
- 消息状态 (已发送/已送达/已读)
- 阅后即焚

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

## Electron 集成

### 主进程 (electron/main.ts)

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { SignalBridge } from './signal-bridge';

const signalBridge = new SignalBridge();

app.whenReady().then(async () => {
  // 初始化 Signal 桥接
  await signalBridge.initialize();
  
  // 注册 IPC 处理器
  ipcMain.handle('signal:encrypt', async (event, recipient, plaintext) => {
    return signalBridge.encryptMessage(recipient, plaintext);
  });
  
  ipcMain.handle('signal:decrypt', async (event, ciphertext) => {
    return signalBridge.decryptMessage(ciphertext);
  });
  
  createWindow();
});
```

### 预加载脚本 (electron/preload.ts)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('signalAPI', {
  encryptMessage: (recipient: string, plaintext: string) =>
    ipcRenderer.invoke('signal:encrypt', recipient, plaintext),
  decryptMessage: (ciphertext: Uint8Array) =>
    ipcRenderer.invoke('signal:decrypt', ciphertext),
});
```

### 渲染进程调用

```typescript
// src/core/signal/electron-signal-service.ts
const ciphertext = await window.signalAPI.encryptMessage(recipient, plaintext);
const plaintext = await window.signalAPI.decryptMessage(ciphertext);
```

## 可扩展架构

- `src/core`: API 客户端、类型定义、状态管理
- `src/features/auth`: 认证模块
- `src/features/chat`: 聊天模块
- `src/features/friend`: 好友模块

推荐扩展模式：

1. 在 `src/features/<domain>` 添加新模块
2. 在 `src/core` 保持网络请求和跨域状态
3. 组件尽量保持无状态

## 开发规范

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- 语义化提交

### 测试

```bash
# 运行测试
pnpm test

# E2E 测试
pnpm test:e2e
```

## 打包发布

### macOS

```bash
pnpm run electron:build:mac
# 输出：dist-electron/Security Chat-{version}.dmg
```

### Windows

```bash
pnpm run electron:build:win
# 输出：dist-electron/Security Chat Setup {version}.exe
```

### Linux

```bash
pnpm run electron:build:linux
# 输出：dist-electron/Security Chat-{version}.AppImage
```

## 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Signal 官方文档](https://signal.org/docs/)
- [libsignal-client](https://github.com/signalapp/libsignal)
- [electron-builder](https://www.electron.build/)

## 故障排查

### 常见问题

1. **Electron 启动失败**
   - 检查 Node.js 版本 >= 18
   - 重新安装依赖 `pnpm install`

2. **Signal 库加载失败**
   - 检查 `@signalapp/libsignal-client` 是否正确安装
   - 运行 `pnpm rebuild @signalapp/libsignal-client`

3. **打包后应用无法打开**
   - macOS: 在系统设置中允许应用
   - Windows: 检查杀毒软件拦截

## 更新日志

### v2.0.0 (2026-03-28)

- ✅ 迁移到 Electron 框架
- ✅ 集成 Signal 官方库 `@signalapp/libsignal-client`
- ✅ 实现 X3DH + Double Ratchet 协议
- ✅ 支持 macOS/Windows/Linux 打包

### v1.0.0 (2026-02-25)

- ✅ 核心聊天功能完成
- ✅ 端到端加密 (自研实现)
- ✅ 阅后即焚功能
