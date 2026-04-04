## Qwen Added Memories

### 项目基本信息
- **项目名称**: security-chat
- **技术栈**: Tauri 2.x + libsignal-protocol v0.90.0 + NestJS + PostgreSQL + Redis + MinIO
- **项目状态**: Week 6 (2026-04-03)，开发环境就绪，核心功能开发中
- **架构**: 桌面端(Tauri) + 后端(NestJS)，Signal Protocol 实现分为 Rust(加密原语) + TypeScript(业务逻辑)

---

### 团队架构 (4 AI)

| 代号 | 职责 | 核心能力 |
|------|------|----------|
| AI #1 (rust-core) | Tauri/Rust 核心协议 | Rust、libsignal、Tauri Commands |
| AI #2 (frontend) | 前端 UI + 状态管理 | React/TypeScript、Tauri API |
| AI #3 (backend) | 后端 API + 基础设施 | NestJS、PostgreSQL、Redis |
| AI #4 (code-reviewer) | 代码审查 + 质量保障 | 全栈、安全、架构 |

---

### 技术决策记录

#### 已完成
- ✅ Signal Protocol TypeScript 实现（前端 use-signal.ts）
- ✅ 数据库迁移机制（TypeORM Migrations）
- ✅ 预密钥自动补充机制
- ✅ NestJS CORS 修复（开发环境支持）
- ✅ Docker 开发环境配置（PostgreSQL、Redis、MinIO）
- ✅ 环境变量结构整理（.env.example、.env.development、.env）

#### 进行中
- 🟡 Signal Protocol 消息加解密流程完善
- 🟡 前端 CORS/预检请求处理

---

### Tech Lead 工作方法

1. **日常管理**
   - 每日检查 文档/PROGRESS.md 更新
   - 协调 AI 之间的依赖和阻塞
   - 监督 AI #4 的代码审查执行

2. **周验收**
   - 周五各 AI 提交周报
   - 创建 WEEKn_REPORT.md 总结
   - 分配下周任务

3. **关键决策**
   - 接口变更：召集相关方讨论
   - 架构调整：Tech Lead + AI #4 评估
   - 排期冲突：Tech Lead 决定优先级

4. **当前重点**
   - 确保前后端联调正常
   - 推进 Signal Protocol 完整实现
   - 建立代码审查流程

---

### 项目结构

```
security-chat/
├── apps/
│   ├── backend/                    # AI #3 负责
│   │   ├── src/
│   │   │   ├── modules/           # 业务模块
│   │   │   ├── infra/            # 数据库、Redis
│   │   │   └── migrations/       # 数据库迁移
│   │   └── .env.development      # 开发环境配置
│   │
│   └── desktop/                    # AI #1 + AI #2 负责
│       ├── src/                    # AI #2 负责
│       │   ├── core/              # Signal Hooks、API、Crypto
│       │   ├── features/          # 功能模块
│       │   └── components/       # UI 组件
│       │
│       └── src-tauri/             # AI #1 负责
│           ├── src/
│           │   ├── commands/     # Tauri Commands
│           │   └── signal/        # Signal Rust 实现
│           └── Cargo.toml
│
├── infra/                         # AI #3 负责
│   └── docker/                    # Docker Compose
│
└── 文档/
    ├── PROGRESS.md               # 进度跟踪
    └── STANDARDS.md             # 代码规范（AI #4 维护）
```

---

### 关键文件

- `apps/desktop/src/core/use-signal.ts` - Signal Protocol Hook
- `apps/desktop/src/core/signal/message-encryption.ts` - 消息加密服务
- `apps/desktop/src/core/api.ts` - 前端 API 封装
- `apps/backend/src/main.ts` - NestJS 入口（CORS 配置）
- `apps/backend/src/infra/database/database.module.ts` - 数据库模块

---

### 环境配置

| 文件 | 用途 | 可提交 |
|------|------|--------|
| `.env.example` | 模板，仅变量名 | ✅ |
| `.env.development` | 开发环境默认值 | ✅ |
| `.env` | 实例配置（实际值） | ❌ |

**生产环境**: `http://silencelee.cn/`
**开发环境**: `http://localhost:3000`
