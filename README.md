# Security Chat 项目文档

## 项目概述

Security Chat 是一个全平台安全通讯应用，专注于提供端到端加密的即时通讯服务，支持多设备同步和阅后即焚等高级安全特性。

### 项目状态

✅ **核心功能已完成**：端到端加密、多设备支持、实时通信、阅后即焚等
✅ **测试全部通过**：烟雾测试、端到端测试、WebSocket测试
✅ **性能已优化**：数据库查询、WebSocket广播、定时任务等
✅ **文档已完善**：详细的项目文档和API接口说明
✅ **直聊功能已完成**：device-bound send-v2 多设备消息发送
🚧 **群聊功能进行中**：Rust Signal Sender Key 协议完善中（Section 3.2-3.5 由 GPT 负责）
🚧 **通知设置功能进行中**：NotificationSettings 数据模型和 API 已落地，桌面端 UI 集成中

### 版本信息

- **当前版本**：v1.0.0
- **发布日期**：2026-02-25
- **开发状态**：已完成核心功能，准备部署

### 核心特性

- **端到端加密**：使用 AES-256-GCM 加密消息内容
- **多设备支持**：用户可在多个设备上登录并同步消息
- **实时通信**：基于 WebSocket 的实时消息推送
- **阅后即焚**：支持多种时长的阅后即焚消息
- **多种消息类型**：支持文本、图片、语音、文件消息
- **好友管理**：支持添加好友、好友请求、黑名单功能
- **安全存储**：客户端密钥安全存储

## 技术架构

### 后端

- **框架**：NestJS ^11.0.1
- **数据库**：PostgreSQL + Redis
- **实时通信**：WebSocket (Socket.IO)
- **认证**：JWT
- **API 接口**：RESTful HTTP API + WebSocket Gateway

### 前端

- **桌面应用**：**Tauri 2.x** + React ^18.3.1 + TypeScript + Vite
  - **Signal 协议库**：`libsignal-protocol` (官方 Rust 库 v0.90)
  - **打包工具**：@tauri-apps/cli
  - **支持平台**：macOS / Windows / Linux
- **移动应用**：规划中（当前仓库暂无 `apps/mobile` 实现）
- **实时通信**：Socket.io-client ^4.8.1

### 项目结构

```
security-chat/
├── apps/
│   ├── backend/       # NestJS 后端服务
│   ├── desktop/       # React 桌面应用
│   └── mobile/        # React Native 移动应用
├── infra/             # 基础设施配置
│   └── postgres/      # PostgreSQL 初始化脚本
└── 文档/              # 项目文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 14
- Redis >= 7

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 文件为 `.env` 并配置相应的环境变量：

```bash
cp .env.example .env
```

### 启动服务

#### 后端服务

```bash
# 开发模式
pnpm start:backend:dev

# 生产模式
pnpm build:backend
pnpm start:backend
```

#### 桌面应用

```bash
# 开发模式 (Tauri)
pnpm run tauri:dev

# 构建 macOS 应用
pnpm run tauri:build -- --target universal-apple-darwin

# 构建 Windows 应用
pnpm run tauri:build -- --target x86_64-pc-windows-msvc

# 仅构建前端
pnpm build:desktop
```

#### 移动应用

```bash
pnpm start:mobile
```

## 核心功能

### 1. 用户认证

- **登录**：支持账号密码登录
- **注册**：支持创建新用户
- **验证码登录**：支持通过验证码登录
- **Token 管理**：使用 JWT 进行身份验证

### 2. 消息功能

- **发送消息**：支持文本、图片、语音、文件消息
- **消息状态**：已发送、已送达、已读
- **阅后即焚**：支持 5s/10s/30s/1m/5m 时长的阅后即焚消息
- **消息历史**：支持加载历史消息

### 3. 好友管理

- **好友搜索**：支持通过关键词搜索用户
- **好友请求**：支持发送和接收好友请求
- **好友列表**：查看好友列表
- **黑名单**：支持拉黑和解除拉黑用户

### 4. 会话管理

- **单聊**：支持一对一聊天
- **群聊**：支持多人聊天（Rust Signal Sender Key 协议完善中）
- **会话列表**：查看所有会话
- **会话设置**：支持设置会话的默认阅后即焚时间
- **群成员管理**：支持添加和移除群成员（群管理 UI 开发中）

### 5. 媒体管理

- **上传媒体**：支持上传图片、语音、文件
- **下载媒体**：支持下载和预览媒体文件

## API 接口

### HTTP API

#### 认证相关

- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/send-code` - 发送登录验证码
- `POST /api/v1/auth/login-with-code` - 使用验证码登录

#### 消息相关

- `POST /api/v1/message/send` - 发送消息
- `GET /api/v1/message/list` - 获取消息列表
- `POST /api/v1/message/ack/delivered` - 标记消息已送达
- `POST /api/v1/message/ack/read` - 标记消息已读
- `POST /api/v1/message/ack/read-one` - 标记单条消息已读

#### 好友相关

- `GET /api/v1/friend/search` - 搜索用户
- `POST /api/v1/friend/request` - 发送好友请求
- `GET /api/v1/friend/pending/incoming` - 获取收到的好友请求
- `POST /api/v1/friend/respond` - 响应好友请求
- `GET /api/v1/friend/list` - 获取好友列表
- `POST /api/v1/friend/block` - 拉黑用户
- `GET /api/v1/friend/blocked` - 获取黑名单
- `POST /api/v1/friend/unblock` - 解除拉黑用户

#### 会话相关

- `POST /api/v1/conversation/direct` - 创建单聊会话
- `GET /api/v1/conversation/list` - 获取会话列表
- `GET /api/v1/conversation/:conversationId/burn-default` - 获取会话的默认阅后即焚设置
- `POST /api/v1/conversation/:conversationId/burn-default` - 设置会话的默认阅后即焚设置

#### 媒体相关

- `POST /api/v1/media/upload` - 上传媒体文件
- `POST /api/v1/media/:mediaAssetId/attach` - 附加媒体文件到消息
- `GET /api/v1/media/:mediaAssetId/meta` - 获取媒体文件元信息
- `GET /api/v1/media/:mediaAssetId/download` - 下载媒体文件

#### 阅后即焚相关

- `POST /api/v1/burn/trigger` - 触发消息阅后即焚

### WebSocket 事件

#### 客户端发送

- `message.ping` - 心跳检测
- `conversation.join` - 加入会话
- `conversation.typing.start` - 开始 typing
- `conversation.typing.stop` - 停止 typing

#### 服务器发送

- `system.connected` - 连接成功
- `message.sent` - 消息已发送
- `message.delivered` - 消息已送达
- `message.read` - 消息已读
- `burn.triggered` - 消息已销毁
- `conversation.updated` - 会话已更新
- `conversation.typing` - 对方正在输入

## 数据库设计

### 核心表结构

- **users** - 用户信息
- **devices** - 设备管理
- **one_time_prekeys** - 一次性密钥
- **friendships** - 好友关系
- **conversations** - 会话管理
- **conversation_members** - 会话成员
- **messages** - 消息存储
- **burn_events** - 阅后即焚事件
- **notifications** - 通知管理
- **media_assets** - 媒体文件

## 安全特性

### 端到端加密 (Signal 官方协议)

- **协议实现**：X3DH + Double Ratchet (Signal 官方库)
- **密钥交换**：ECDH P-256 (4 次 DH 计算)
- **消息加密**：AES-256-GCM
- **签名算法**：ECDSA P-256
- **密钥派生**：HKDF (HMAC-SHA256)
- **服务端**：仅存储加密后的消息内容，不存储私钥和会话密钥

### 传输安全

- 强制使用 TLS 1.3
- WebSocket 连接使用安全传输

### 认证安全

- 使用 JWT 进行身份验证
- 支持 Token 黑名单
- 登录尝试限流

### 数据安全

- 密码使用 bcrypt 加密存储
- 敏感数据加密传输
- 定期清理过期数据

## 部署指南

### 后端部署

1. **构建应用**：
   ```bash
   pnpm build:backend
   ```

2. **配置环境变量**：
   - 配置数据库连接
   - 配置 Redis 连接
   - 配置 JWT 密钥

3. **启动服务**：
   ```bash
   pnpm start:backend
   ```

### 桌面应用部署

1. **构建应用**：
   ```bash
   pnpm build:desktop
   ```

2. **分发应用**：
   - 打包为可执行文件
   - 分发到目标平台

### 移动应用部署

> 注意：当前仓库暂无移动应用实现，规划中

移动应用（React Native）开发相关命令待定。

## 测试

### 后端测试

```bash
# 烟雾测试
pnpm smoke:backend:v1

# 端到端测试
pnpm test:backend:e2e:v1

# WebSocket 测试
pnpm test:backend:ws:v1

# 运行所有测试
pnpm verify:backend:v1
```

### 前端测试

```bash
# 桌面应用测试
cd apps/desktop
pnpm test

# 移动应用（规划中）
# cd apps/mobile
# pnpm test
```

## 性能优化

### 后端优化

- **数据库索引**：为常用查询添加索引
- **连接池**：使用数据库连接池
- **缓存**：使用 Redis 缓存热点数据
- **异步处理**：将耗时操作异步处理
- **批量操作**：优化数据库批量操作
- **阅后即焚优化**：将清理间隔从 1 秒改为 10 秒，减少数据库负载
- **查询性能优化**：将消息查询中的清理操作移至后台，提高响应速度
- **WebSocket 优化**：使用批量事件广播，减少网络开销

### 前端优化

- **状态管理**：使用高效的状态管理
- **组件优化**：使用 React.memo 等优化组件渲染
- **网络优化**：减少网络请求，使用缓存
- **图片优化**：使用适当的图片格式和大小
- **消息加载优化**：实现分页加载，减少初始加载时间

## 监控与日志

### 后端监控

- **应用日志**：记录应用运行状态
- **错误日志**：记录错误信息
- **性能监控**：监控应用性能指标
- **数据库监控**：监控数据库性能

### 前端监控

- **用户行为**：记录用户行为
- **错误监控**：捕获前端错误
- **性能监控**：监控前端性能指标

## 常见问题

### 1. 消息发送失败

- 检查网络连接
- 检查后端服务是否正常运行
- 检查消息格式是否正确

### 2. 登录失败

- 检查账号密码是否正确
- 检查后端服务是否正常运行
- 检查网络连接

### 3. 消息不同步

- 检查网络连接
- 检查设备是否已登录
- 尝试重新登录

### 4. 媒体文件上传失败

- 检查文件大小是否超过限制
- 检查网络连接
- 检查后端服务是否正常运行

## 后续计划

### 已完成功能

- **群聊基础架构**：数据库结构和核心服务已支持群聊
- **单聊功能**：完整的一对一聊天功能
- **消息功能**：支持文本、图片、语音、文件消息
- **阅后即焚**：支持多种时长的消息销毁
- **好友管理**：完整的好友添加、请求、黑名单功能

### V2 版本计划

- **群聊完善**：Rust Signal Sender Key 协议完整实现
- **群聊 UI**：群管理界面（成员管理、群信息修改）
- **通知设置**：用户可配置的通知偏好

### V3 版本计划

- **视频通话**：支持视频通话
- **语音通话**：支持语音通话
- **屏幕共享**：支持屏幕共享
- **企业版功能**：支持企业级特性
- **多语言支持**：支持多语言

## 贡献指南

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 遵循 Prettier 格式
- 编写清晰的注释

### 提交规范

- 使用语义化提交信息
- 提交前运行测试
- 提交前运行 lint

### 开发流程

1. Fork 仓库
2. 创建特性分支
3. 提交代码
4. 创建 Pull Request
5. 代码审查
6. 合并代码

## 许可证

MIT License

## 联系我们

- **项目地址**：https://github.com/security-chat
- **问题反馈**：https://github.com/security-chat/issues
- **贡献代码**：https://github.com/security-chat/pulls
