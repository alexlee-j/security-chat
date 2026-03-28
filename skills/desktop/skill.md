# 前端桌面应用技能 (Electron + Signal 官方库)

**版本**: v2.0 (Electron + Signal 官方库)  
**更新日期**: 2026-03-28

---

## 核心技术栈

### Electron
- **版本**: ^30.0.0
- **类型**: 桌面应用框架
- **描述**: 使用 Chromium 和 Node.js 构建跨平台桌面应用
- **应用**: Electron 主进程、Signal 官方库集成、IPC 通信

### @signalapp/libsignal-client
- **版本**: ^0.90.0
- **类型**: Signal 协议官方库
- **描述**: 提供端到端加密功能，实现 X3DH + Double Ratchet 协议
- **应用**: 消息加密/解密、会话管理、密钥管理

### React
- **版本**: ^18.3.1
- **类型**: 前端框架
- **描述**: 用于构建用户界面的 JavaScript 库，采用组件化开发模式
- **应用**: Electron 渲染进程 UI 构建

### TypeScript
- **类型**: 编程语言
- **描述**: JavaScript 的超集，添加了静态类型检查
- **应用**: 提高代码可维护性和可靠性

### Vite
- **类型**: 构建工具
- **描述**: 现代化的前端构建工具，提供快速的开发体验
- **应用**: 渲染进程构建、开发服务器、代码优化

### Socket.io-client
- **版本**: ^4.8.1
- **类型**: 实时通信
- **描述**: Socket.IO 的客户端库，用于与服务器建立 WebSocket 连接
- **应用**: 实时消息接收、用户在线状态同步

---

## Electron 架构

### 进程架构

```
┌─────────────────────────────────────┐
│   Main Process (Node.js)            │
│   - Signal Bridge (官方库)          │
│   - IPC 处理器                      │
│   - 应用生命周期管理                 │
└─────────────────────────────────────┘
                ↕ IPC
┌─────────────────────────────────────┐
│   Renderer Process (React)          │
│   - UI 渲染                         │
│   - 用户交互                        │
│   - 调用 Signal API (通过 IPC)       │
└─────────────────────────────────────┘
```

### 项目结构

```
desktop/
├── electron/
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   └── signal-bridge.ts     # Signal 官方库桥接
├── src/
│   ├── core/
│   │   ├── signal/          # Signal 服务 (IPC 调用)
│   │   ├── api.ts           # API 调用封装
│   │   └── types.ts         # 类型定义
│   ├── features/
│   │   ├── auth/            # 认证模块
│   │   ├── chat/            # 聊天模块
│   │   └── friend/          # 好友模块
│   ├── App.tsx              # 应用根组件
│   └── main.tsx             # 渲染进程入口
├── package.json
├── vite.config.ts
└── electron-builder.config.js
```

---

## Electron 开发技能

### 主进程开发

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { SignalBridge } from './signal-bridge';

let mainWindow: BrowserWindow | null = null;
const signalBridge = new SignalBridge();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await signalBridge.initialize();
  registerIpcHandlers();
  createWindow();
});
```

### 预加载脚本

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('signalAPI', {
  encryptMessage: (recipient: string, plaintext: string) =>
    ipcRenderer.invoke('signal:encrypt', recipient, plaintext),
  decryptMessage: (ciphertext: Uint8Array) =>
    ipcRenderer.invoke('signal:decrypt', ciphertext),
  initSession: (bundle: any) =>
    ipcRenderer.invoke('signal:init-session', bundle),
});
```

### IPC 通信

```typescript
// electron/main.ts
function registerIpcHandlers() {
  ipcMain.handle('signal:encrypt', async (event, recipient, plaintext) => {
    return signalBridge.encryptMessage(recipient, plaintext);
  });
  
  ipcMain.handle('signal:decrypt', async (event, ciphertext) => {
    return signalBridge.decryptMessage(ciphertext);
  });
}
```

### 渲染进程调用

```typescript
// src/core/signal/electron-signal-service.ts
declare global {
  interface Window {
    signalAPI: {
      encryptMessage: (recipient: string, plaintext: string) => Promise<Uint8Array>;
      decryptMessage: (ciphertext: Uint8Array) => Promise<string>;
    };
  }
}

const ciphertext = await window.signalAPI.encryptMessage(recipient, plaintext);
const plaintext = await window.signalAPI.decryptMessage(ciphertext);
```

---

## Signal 官方库集成

### 安装

```bash
pnpm add @signalapp/libsignal-client
```

### 核心 API

```typescript
import {
  generateIdentityKeyPair,
  generateSignedPreKey,
  PreKeyRecord,
  SignedPreKeyRecord,
  ProtocolAddress,
  processPreKeyBundle,
  sealedSenderEncryptMessage,
  sealedSenderDecryptMessage,
  SessionRecord,
} from '@signalapp/libsignal-client';
```

### Signal 桥接实现

```typescript
// electron/signal-bridge.ts
export class SignalBridge {
  private identityKeyPair: any = null;
  private sessionStore: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    this.identityKeyPair = await generateIdentityKeyPair();
    // 生成预密钥等...
  }

  async encryptMessage(recipient: string, plaintext: string): Promise<Uint8Array> {
    const address = new ProtocolAddress(recipient, 1);
    const session = this.sessionStore.get(recipient);
    
    if (!session) {
      throw new Error('No session found for recipient');
    }

    return sealedSenderEncryptMessage(
      Buffer.from(plaintext, 'utf-8'),
      session,
      // ... 其他参数
    );
  }

  async decryptMessage(ciphertext: Uint8Array): Promise<string> {
    const plaintext = await sealedSenderDecryptMessage(
      ciphertext,
      // ... 其他参数
    );
    return new TextDecoder().decode(plaintext);
  }
}
```

---

## 打包发布

### electron-builder 配置

```javascript
// electron-builder.config.js
export default {
  appId: 'com.security.chat',
  productName: 'Security Chat',
  files: ['dist/**/*', 'electron/**/*'],
  mac: { target: ['dmg', 'zip'] },
  win: { target: ['nsis', 'portable'] },
  linux: { target: ['AppImage', 'deb'] },
};
```

### 打包命令

```bash
# macOS
pnpm run electron:build:mac

# Windows
pnpm run electron:build:win

# Linux
pnpm run electron:build:linux
```

---

## 安全特性

### 端到端加密

- **协议**: X3DH + Double Ratchet (Signal 官方)
- **密钥交换**: ECDH P-256 (4 次 DH 计算)
- **消息加密**: AES-256-GCM
- **签名**: ECDSA P-256
- **密钥派生**: HKDF (HMAC-SHA256)

### 密钥存储

- **Electron 主进程**: 加密后存储
- **macOS**: Keychain
- **Windows**: Credential Vault
- **Linux**: libsecret

### IPC 安全

- `contextIsolation: true` - 隔离上下文
- `nodeIntegration: false` - 禁用 Node 集成
- 使用预加载脚本暴露有限 API

---

## 开发流程

### 环境搭建

```bash
# 安装依赖
pnpm install

# 启动后端
pnpm start:backend:dev

# 启动 Electron 开发
pnpm run electron:dev
```

### 调试

1. **主进程调试**: 使用 VS Code 附加到 Electron 进程
2. **渲染进程调试**: DevTools (F12)
3. **IPC 调试**: 使用 `ipcMain.on` 记录事件

### 测试

```bash
# 单元测试
pnpm test

# E2E 测试 (Playwright)
pnpm test:e2e
```

---

## 性能优化

### 主进程优化

- 避免阻塞主线程
- 使用 Worker 处理密集计算
- 合理管理 BrowserWindow

### 渲染进程优化

- React.memo 优化组件
- 虚拟列表优化长列表
- 图片懒加载

### IPC 优化

- 批量发送 IPC 消息
- 避免频繁 IPC 调用
- 使用共享内存传输大数据

---

## 常见问题

### 1. Electron 启动失败

```bash
# 检查 Node.js 版本
node -v  # 需要 >= 18

# 重新安装依赖
rm -rf node_modules
pnpm install
```

### 2. Signal 库加载失败

```bash
# 重建原生模块
pnpm rebuild @signalapp/libsignal-client
```

### 3. 打包后应用无法打开

**macOS**:
```bash
# 移除隔离属性
xattr -cr /Applications/Security\ Chat.app
```

**Windows**:
- 检查杀毒软件拦截
- 使用代码签名证书

---

## 学习资源

### 官方文档

- [Electron](https://www.electronjs.org/docs)
- [Signal](https://signal.org/docs/)
- [libsignal-client](https://github.com/signalapp/libsignal)
- [electron-builder](https://www.electron.build/)

### 实战教程

- Electron 主进程开发
- Signal 协议原理与实现
- IPC 通信最佳实践
- Electron 应用打包发布

---

## 最佳实践

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- 语义化提交

### 组件设计

- 职责单一
- 可复用性
- 可测试性

### 状态管理

- 状态分层
- 状态持久化
- 状态更新优化

### 安全实践

- 数据加密
- 认证安全
- 防止攻击
- 隐私保护

---

**文档版本**: v2.0  
**最后更新**: 2026-03-28
