## 1. Scope And Version Governance

- [x] 1.1 创建 2.0 集成分支并在文档中明确该分支为唯一集成入口
- [x] 1.2 盘点并冻结 2.0 范围内的真实流程：注册、登录、找回密码、单聊、群聊、通知、重连恢复
- [x] 1.3 更新 README、版本说明和 2.0 范围文档，移除与现状不符的 V2/V3 描述
- [x] 1.4 在实施说明中明确 GPT / MiniMax 分工：GPT 负责高风险跨层闭环，MiniMax 负责低风险 UI / 文档 / 支撑整合
- [x] 1.5 在治理文档中明确下一阶段“桌面产品面闭环”为独立 change，且必须在当前 change 合并到 `main` 后从最新 `main` 新开分支

## 2. Account Recovery And Auth Hardening

- [x] 2.1 为注册接口与客户端补齐统一密码策略校验与错误提示
- [x] 2.2 设计并实现忘记密码/重置密码后端流程，包括验证码或恢复令牌、邮件发送和校验失效
- [x] 2.3 为桌面端接入忘记密码/重置密码 UI 与状态流转
- [x] 2.4 实现密码重置后的 refresh token / 登录态处理策略，并补回归测试
- [x] 2.5 补充真实账号“找回密码后重新登录”冒烟验证与文档记录

## 3. Group Governance And Sender Key Lifecycle

- [x] 3.1 设计并实现群资料管理接口与数据模型（群名、头像、描述等）
- [x] 3.2 明确群主/管理员/普通成员的最小权限模型，并在后端落地校验
- [x] 3.3 为加人、移人、退群、重入场景补齐服务端群生命周期事件与可见行为
- [x] 3.4 让群治理动作与 Rust Sender Key 生命周期规则对齐，并补协议级回归测试
- [x] 3.5 为桌面端补齐群管理 UI、成员变更提示和相关 E2E/冒烟场景

## 4. Conversation Sync And Reliability

- [x] 4.1 设计并实现桌面端本地消息状态机（draft / queued / sending / sent / failed / replayed）
- [x] 4.2 补齐本地数据库的消息上传/拉取 TODO，完成断线补拉与重登回放主链路
- [x] 4.3 为 direct/group 消息补齐显式失败重试与幂等处理，避免静默回退
- [x] 4.4 统一会话列表预览摘要策略，并收口现有 metadata/decrypt fallback 混用逻辑
- [x] 4.5 为同步恢复链路补充 backend / desktop / 真实账号多设备回归验证

## 5. Notifications And Security Events

- [x] 5.1 扩展通知设置模型，覆盖密码恢复、安全事件、群治理事件等 2.0 类型
- [x] 5.2 将新增通知事件接入后端通知策略判断与未读数汇总
- [x] 5.3 为桌面端补齐新增通知类型的设置入口、展示与状态验证

## 6. Release Operability And Merge Gates

- [x] 6.1 更新 backend/Rust/desktop/real-flow 的 2.0 回归矩阵与必跑命令
- [x] 6.2 补齐 2.0 回滚策略、运维说明和故障分层处置文档
- [x] 6.3 执行双账号单聊、三账号群聊、找回密码、通知策略、重连恢复真实冒烟并记录结果
- [x] 6.4 仅在所有回归矩阵和真实冒烟通过后，输出 2.0 合并门槛结论
