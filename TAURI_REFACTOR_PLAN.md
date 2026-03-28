# Security Chat - Tauri 重构方案

**日期**: 2026-03-28  
**分支**: refactor/tauri-desktop  
**状态**: 方案规划

---

## 一、方案概述

### 架构变更

| 项目 | 原方案 | 新方案 |
|------|--------|--------|
| 桌面框架 | Electron | Tauri |
| 加密库 | @privacyresearch/libsignal-protocol-typescript | @signalapp/libsignal-client |
| 前端框架 | React + Vite | React + Vite (保持) |
| 后端服务 | NestJS | NestJS (保持) |

### 为什么选择 Tauri？

#### Electron 的问题
1. **包体积大** -  bundled Chromium + Node.js，应用体积 150MB+
2. **内存占用高** - 每个窗口一个 Chromium 实例
3. **安全性** - 完整的 Node.js 暴露，攻击面大
4. **性能** - 相对原生应用性能较差

#### Tauri 的优势
1. **包体积小** - 使用系统 WebView，应用体积 10-30MB
2. **内存占用低** - 共享系统 WebView 资源
3. **安全性高** - Rust 后端，最小权限原则
4. **性能好** - Rust 后端性能优异
5. **原生体验** - 更好的系统集成

### 可行性分析

#### ✅ 技术可行

| 组件 | 可行性 | 说明 |
|------|--------|------|
| Signal 协议 | ✅ | @signalapp/libsignal-client 支持 Node.js/Rust |
| 前端 UI | ✅ | React + Vite 完全兼容 |
| 后端通信 | ✅ | HTTP/WebSocket 保持不变 |
| 本地存储 | ✅ | Tauri API + SQLite |
| 系统托盘 | ✅ | Tauri 原生支持 |
| 通知 | ✅ | Tauri 原生支持 |

#### ⚠️ 需要注意

1. **@signalapp/libsignal-client** - 需要确认 Rust 绑定是否可用
2. **WebView 兼容性** - macOS (WebKit), Windows (WebView2), Linux (WebKitGTK)
3. **开发流程变化** - 需要 Rust 工具链

---

## 二、技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Security Chat                         │
├─────────────────────────────────────────────────────────┤
│  Frontend (React + Vite + TypeScript)                   │
│  ├─ 聊天界面                                             │
│  ├─ 联系人管理                                           │
│  ├─ 设置界面                                             │
│  └─ 登录/注册                                            │
├─────────────────────────────────────────────────────────┤
│  Tauri Backend (Rust)                                   │
│  ├─ Signal 协议层 (@signalapp/libsignal-client)         │
│  ├─ 本地数据库 (SQLite)                                 │
│  ├─ 文件系统访问                                         │
│  ├─ 系统通知                                             │
│  └─ 系统托盘                                             │
├─────────────────────────────────────────────────────────┤
│  Remote Backend (NestJS)                                │
│  ├─ 用户认证                                             │
│  ├─ 消息中继                                             │
│  ├─ 预密钥存储                                           │
│  └─ 联系人同步                                           │
└─────────────────────────────────────────────────────────┘
```

### 目录结构

```
security-chat/
├── apps/
│   ├── desktop/              # Tauri 桌面应用
│   │   ├── src/              # React 前端代码
│   │   ├── src-tauri/        # Tauri/Rust 后端代码
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tauri.conf.json
│   │
│   └── backend/              # NestJS 后端服务
│       └── ...
│
├── packages/                 # 共享代码包
│   ├── signal-protocol/      # Signal 协议封装 (可选)
│   └── ui-components/        # 共享 UI 组件 (可选)
│
└── docs/                     # 文档
```

### 核心依赖

#### Frontend (React)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^4.x"
  },
  "devDependencies": {
    "@tauri-apps/api": "^1.x",
    "vite": "^5.x",
    "typescript": "^5.x"
  }
}
```

#### Tauri Backend (Rust)
```toml
[dependencies]
tauri = "^1.5"
signal-crypto = "0.1"  # 或使用 Node.js binding
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio"] }
```

---

## 三、实施步骤

### 阶段 1: 环境准备 (1 天)

- [ ] 安装 Rust 工具链
- [ ] 安装 Tauri CLI
- [ ] 配置系统依赖 (macOS: Xcode, Linux: WebKitGTK, Windows: WebView2)

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli

# 安装系统依赖 (macOS)
xcode-select --install
```

### 阶段 2: 项目初始化 (1 天)

- [ ] 初始化 Tauri 项目
- [ ] 配置 tauri.conf.json
- [ ] 迁移现有 React 代码
- [ ] 配置前后端通信

```bash
cd apps/desktop
pnpm add -D @tauri-apps/cli
pnpm add @tauri-apps/api
cargo init src-tauri
```

### 阶段 3: Signal 协议集成 (2-3 天)

- [ ] 安装 @signalapp/libsignal-client
- [ ] 实现密钥生成
- [ ] 实现 X3DH 密钥交换
- [ ] 实现 Double Ratchet
- [ ] 实现消息加密解密

**关键问题**: 需要确认 @signalapp/libsignal-client 是否有 Rust 实现或 Node.js binding

**备选方案**:
1. 使用 @privacyresearch/libsignal-protocol-typescript (如果可用)
2. 使用纯 Rust 实现 (signal-crypto-rust)
3. 通过 FFI 调用 C 库

### 阶段 4: 本地存储 (1-2 天)

- [ ] 集成 SQLite 数据库
- [ ] 设计数据库 schema
- [ ] 实现消息存储
- [ ] 实现会话存储
- [ ] 实现密钥存储

### 阶段 5: UI 迁移 (2-3 天)

- [ ] 迁移登录界面
- [ ] 迁移聊天界面
- [ ] 迁移联系人界面
- [ ] 迁移设置界面
- [ ] 适配 Tauri API

### 阶段 6: 系统功能 (1-2 天)

- [ ] 系统托盘
- [ ] 系统通知
- [ ] 全局快捷键
- [ ] 文件拖拽
- [ ] 剪贴板集成

### 阶段 7: 测试与优化 (2-3 天)

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 包体积优化
- [ ] 代码签名
- [ ] 打包发布

### 总预计时间：10-15 天

---

## 四、风险评估

### 高风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| @signalapp 库无 Rust 绑定 | 高 | 备选方案：使用 Node.js binding 或纯 Rust 实现 |
| WebView 兼容性问题 | 中 | 充分测试三大平台，使用 polyfill |
| Rust 学习曲线 | 中 | 参考 Tauri 官方文档和示例 |

### 中风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 数据迁移 | 中 | 设计兼容的存储格式 |
| 性能问题 | 中 | 早期性能测试，优化关键路径 |

### 低风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| UI 适配 | 低 | 逐步迁移，保持功能一致 |
| 构建配置 | 低 | 参考官方模板 |

---

## 五、预期收益

### 用户体验

- **启动速度**: 提升 50%+
- **内存占用**: 降低 60%+
- **包体积**: 减少 80%+ (从 150MB 到 30MB)

### 开发体验

- **热更新**: 更快的前端 HMR
- **Rust 后端**: 类型安全，性能优异
- **跨平台**: 一次构建，多平台部署

### 安全性

- **最小权限**: Rust 后端隔离
- **代码审计**: Rust 代码更易审计
- **原生安全**: 系统 WebView 安全更新

---

## 六、决策点

### 需要确认的问题

1. **Signal 库选择**
   - [ ] 确认 @signalapp/libsignal-client 是否有 Rust 实现
   - [ ] 如果没有，选择备选方案

2. **数据库选择**
   - [ ] SQLite (推荐) vs IndexedDB vs JSON 文件

3. **状态管理**
   - [ ] Zustand (保持) vs Redux vs Jotai

4. **UI 组件库**
   - [ ] 保持现有 vs 切换到 shadcn/ui

---

## 七、下一步行动

1. **确认 Signal 库可用性** - 调研 @signalapp/libsignal-client 的 Rust 支持
2. **创建 Tauri 原型** - 最小可行产品验证技术栈
3. **制定详细计划** - 根据调研结果调整时间表

---

**创建时间**: 2026-03-28  
**负责人**: Qwen Code B  
**状态**: 等待确认
