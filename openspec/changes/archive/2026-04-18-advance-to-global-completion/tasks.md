## 1. Branching And Ownership

- [x] 1.1 从 `main` 创建实现分支 `feature/global-completion`，并明确该分支是本提案唯一集成分支
- [x] 1.2 在变更说明中锁定角色边界：GPT 负责协议/传输/跨层高风险事项，MiniMax 负责支撑性集成、UI、文档和低风险收口
- [x] 1.3 盘点并冻结本阶段必须覆盖的真实流程：注册、登录、加好友、单聊多设备、群聊、通知、重登历史回显

## 2. Backend Transport Convergence (High Risk, GPT)

- [x] 2.1 审核并收口直接消息的主动发送入口，确认受支持客户端只走 `send-v2`
- [x] 2.2 处理 `message.send` 旧 WebSocket 入口：移除、拒绝或显式弃用，避免绕过每设备 envelope 模型
- [x] 2.3 清理或标记所有会掩盖设备/会话错误的兼容回退逻辑，保留最小迁移窗口
- [x] 2.4 补强 direct-message 读取链路回归测试，覆盖 authenticated device envelope 解析与 legacy 行为边界
- [x] 2.5 校准会话列表预览策略，明确 metadata-first、占位文案或可解密摘要缓存的唯一产品行为

## 3. Group Rust Signal Closure (Critical Risk, GPT)

- [x] 3.1 明确群聊 Sender Key 生命周期：建群、加人、退群、踢人、重入、密钥轮换
- [x] 3.2 对齐 Rust/Tauri 侧群聊加解密接口，使组聊与直聊一样进入 Rust-first 主链路
- [x] 3.3 完成后端 group/message 路径与 Sender Key 分发、轮换、成员变更规则的集成
- [x] 3.4 为群聊补充协议级测试，覆盖建群后首发消息、成员新增、成员移除、历史消息读取
- [x] 3.5 为群聊补充桌面端回归场景，验证 UI 展示、发送失败处理、重登后群消息回显

## 4. Notification Delivery Controls (Medium Risk, MiniMax)

- [x] 4.1 落地 NotificationSettings 数据模型、读取/更新 API 与默认策略
- [x] 4.2 将 message、friend_request、burn 等通知创建逻辑接入用户通知设置判断
- [x] 4.3 为桌面端补充通知设置入口与状态展示，保证设置值与后端生效值一致
- [x] 4.4 补充通知回归测试，覆盖关闭消息通知、关闭好友请求通知、未读数与摘要一致性

## 5. Frontend And Product-Surface Convergence (Medium Risk, MiniMax)

- [x] 5.1 收口桌面端所有旧 transport 假设与过期注释，保证 UI 只暴露当前受支持的能力边界
- [x] 5.2 完成群聊产品表层接入：发送、接收、错误提示、群成员变化后的可见行为
- [x] 5.3 对齐会话列表、消息气泡、转发、媒体、阅后即焚在 direct/group 新模型下的展示策略
- [x] 5.4 校正文档、README 与运行脚本说明，删除与现状不符的接口/平台叙述

## 6. Regression Gates And Release Readiness

- [x] 6.1 建立后端回归矩阵：auth device binding、message multi-device、media copy、notification policy、group lifecycle
- [x] 6.2 建立 Rust 回归矩阵：会话建立、直聊加解密、Sender Key 发收、成员变更后的密钥轮换
- [x] 6.3 建立桌面端回归矩阵：`pnpm -C apps/desktop build`、关键 Playwright/E2E 场景、真实双账号冒烟
- [x] 6.4 追加真实验证方案：双账号单聊多设备、三账号群聊、通知开关、重登后 direct/group 历史回显
- [x] 6.5 输出合并门槛与回滚说明，只有当 backend/Rust/frontend/真实冒烟全部通过时才允许进入合并评审
