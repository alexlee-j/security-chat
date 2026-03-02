# 后端技能

## 核心技术栈

### NestJS
- **版本**：^11.0.1
- **类型**：后端框架
- **描述**：基于Node.js的渐进式框架，使用TypeScript构建，提供模块化、依赖注入等特性
- **应用**：整个后端服务的基础框架，处理API请求、WebSocket连接等

### PostgreSQL
- **版本**：>= 14
- **类型**：关系型数据库
- **描述**：强大的开源关系型数据库，支持复杂查询和事务
- **应用**：存储用户信息、消息、会话等核心业务数据

### Redis
- **版本**：>= 7
- **类型**：内存数据库
- **描述**：高性能的键值存储，支持多种数据结构
- **应用**：缓存热点数据、管理WebSocket连接状态、实现消息队列

### WebSocket (Socket.IO)
- **版本**：^4.8.1
- **类型**：实时通信
- **描述**：基于WebSocket的实时双向通信库
- **应用**：实现实时消息推送、用户在线状态管理

### JWT
- **类型**：认证方案
- **描述**：JSON Web Token，无状态的认证机制
- **应用**：用户身份验证、API授权

## 项目结构

```
backend/
├── src/
│   ├── common/           # 公共组件
│   │   ├── decorators/   # 装饰器
│   │   ├── filters/      # 异常过滤器
│   │   └── interceptors/ # 拦截器
│   ├── infra/            # 基础设施
│   │   ├── database/     # 数据库配置
│   │   └── redis/        # Redis配置
│   ├── modules/          # 业务模块
│   │   ├── auth/         # 认证模块
│   │   ├── burn/         # 阅后即焚模块
│   │   ├── conversation/ # 会话模块
│   │   ├── friend/       # 好友模块
│   │   ├── media/        # 媒体模块
│   │   ├── message/      # 消息模块
│   │   ├── notification/ # 通知模块
│   │   ├── security/     # 安全模块
│   │   └── user/         # 用户模块
│   ├── app.controller.ts # 应用控制器
│   ├── app.module.ts     # 应用模块
│   ├── app.service.ts    # 应用服务
│   └── main.ts           # 应用入口
├── .env.example          # 环境变量示例
├── package.json          # 项目配置
└── tsconfig.json         # TypeScript配置
```

## 核心功能

### 认证系统
- JWT令牌生成与验证
- 密码加密存储
- 验证码登录
- 令牌刷新机制

### 消息系统
- 消息发送与接收
- 消息状态管理（已发送、已送达、已读）
- 阅后即焚功能
- 消息历史查询

### 会话系统
- 单聊会话创建
- 会话列表管理
- 会话默认设置

### 好友系统
- 好友搜索
- 好友请求管理
- 好友列表
- 黑名单管理

### 媒体系统
- 媒体文件上传
- 媒体文件下载
- 媒体文件元信息管理

### WebSocket网关
- 实时消息推送
- 用户在线状态管理
- 心跳检测
- Typing状态同步

## API接口

### HTTP API
- RESTful风格的API设计
- 统一的响应格式
- 错误处理机制
- 认证授权保护

### WebSocket事件
- 客户端发送事件：message.ping, conversation.join, conversation.typing.start, conversation.typing.stop
- 服务器发送事件：system.connected, message.sent, message.delivered, message.read, burn.triggered, conversation.updated, conversation.typing

## 安全特性

### 端到端加密
- 使用AES-256-GCM加密消息内容
- 服务端存储加密后的消息
- 服务端不存储私钥和会话密钥

### 传输安全
- 强制使用TLS 1.3
- WebSocket连接使用安全传输

### 认证安全
- JWT令牌管理
- Token黑名单
- 登录尝试限流

### 数据安全
- 密码使用bcrypt加密存储
- 敏感数据加密传输
- 定期清理过期数据

## 性能优化

### 数据库优化
- 合理的索引设计
- 数据库连接池
- 批量操作优化

### 缓存策略
- Redis缓存热点数据
- 缓存过期策略

### 异步处理
- 耗时操作异步处理
- 消息队列

### 代码优化
- 模块化设计
- 依赖注入
- 类型安全

## 部署与监控

### 部署策略
- 容器化部署
- 环境变量配置
- 多环境支持

### 监控系统
- 应用日志
- 错误监控
- 性能指标监控
- 数据库监控

## 测试策略

### 烟雾测试
- 基本功能验证
- 服务可用性测试

### 端到端测试
- 完整业务流程测试
- API接口测试

### WebSocket测试
- 实时通信测试
- 连接稳定性测试

### 性能测试
- 并发测试
- 负载测试
- 响应时间测试

## 技术文档

### 架构文档
- 系统架构设计
- 模块划分
- 数据流设计

### API文档
- HTTP API接口文档
- WebSocket事件文档

### 数据库文档
- 数据库表结构
- 索引设计
- 关系图

### 安全文档
- 安全设计
- 加密方案
- 防护措施

## 学习资源

### 官方文档
- NestJS：https://docs.nestjs.com/
- PostgreSQL：https://www.postgresql.org/docs/
- Redis：https://redis.io/documentation
- Socket.IO：https://socket.io/docs/

### 实战教程
- NestJS实战
- PostgreSQL高级特性
- Redis性能优化
- WebSocket实时应用开发

## 最佳实践

### 代码规范
- TypeScript最佳实践
- NestJS模块化设计
- 错误处理规范
- 日志记录规范

### 安全实践
- 密码安全存储
- API接口防护
- 数据验证
- 防SQL注入

### 性能实践
- 数据库查询优化
- 缓存策略
- 异步编程
- 内存管理

### 部署实践
- 容器化部署
- 自动化测试
- 持续集成/持续部署
- 监控告警