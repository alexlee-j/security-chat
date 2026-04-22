## Context

当前群聊新建弹窗已经接入 shadcn `Dialog`，但仍保留了旧 modal 结构和样式约束，导致三个可见问题：1) create tab 存在嵌套 `form` 造成 React DOM nesting 警告；2) 缺少 `DialogTitle` 语义导致 Radix 可访问性警告；3) 旧 modal 壳样式与新 `DialogContent` 冲突，导致小窗条件下出现裁切、遮挡和可操作区域不稳定。

这属于跨组件但纯前端的交互结构重构：`GroupCreateModal`、`App` 的打开/关闭闭环、以及与既有桌面设计系统的对齐。后端群组接口和群治理权限语义不在本次改动范围内。

## Goals / Non-Goals

**Goals:**
- 重构群聊新建/管理弹窗的 DOM 结构，消除无效 form 嵌套。
- 满足 shadcn/Radix dialog 语义要求（标题、描述、关闭与焦点行为）。
- 保证在支持的桌面窗口尺寸下，创建与管理核心控件可达、可滚动、可提交。
- 保留现有群创建/管理 API 行为和数据流，不改变后端契约。

**Non-Goals:**
- 不调整群组权限模型、成员治理规则或消息加密流程。
- 不重做整站视觉系统，仅在既有设计语言内修复和收敛群聊弹窗。
- 不引入新的后端接口或数据库迁移。

## Decisions

### 1) 采用 dialog-native 结构替换 legacy modal 壳
弹窗统一使用 `DialogHeader` / `DialogTitle` / `DialogDescription` / content 区块 / footer 动作区，避免继续依赖旧 `.modal-*` 布局容器作为主结构。

原因：旧壳在定位、滚动和层级上与 `DialogContent` 有重复职责，容易产生裁切和交互覆盖。

备选：
- 保留旧壳并仅补 title：只能消除告警，无法系统性解决布局冲突。
- 全量重写群管理功能：风险高且超出本次修复目标。

### 2) 拆分表单边界，禁止 form 嵌套
创建 tab 和管理 tab 仅在需要原生提交语义的局部使用单层 `form`，搜索区与主提交区通过按钮事件分离，确保 DOM 层级合法。

原因：嵌套 form 是当前 console 告警主因，且会导致键盘提交行为不确定。

备选：
- 全部改成按钮 click 不用 form：可行但会损失局部 Enter 提交语义，不是最优。

### 3) 在 `DialogContent` 内建立受控滚动容器
使用 max-height + 内部 `ScrollArea`/overflow 区，让弹窗在小窗下保持控件可达，尤其是成员搜索结果和成员列表。

原因：当前问题核心是高度不足时内容被截断，不能把滚动责任交给页面背景层。

备选：
- 提高弹窗固定高度：在低分辨率窗口依旧失效。
- 页面级滚动：会破坏焦点和模态体验。

### 4) 保持 App 级开关状态，不改业务流程
继续由 `App` 统一控制群聊弹窗开关，FAB 只负责触发；创建成功后的行为仍回到 chat 上下文，不引入新导航路径。

原因：与当前主工作区状态模型一致，最小改动即可维持行为稳定。

## Risks / Trade-offs

- [Risk] 旧样式残留与新结构并存导致样式竞争。 → Mitigation：逐步去除关键 `.modal-*` 依赖，将关键布局转为 dialog 内联/utility class。
- [Risk] 表单边界调整后可能改变 Enter 提交习惯。 → Mitigation：仅在关键输入区域保留单层 form，其他区域显式按钮触发。
- [Risk] 小窗滚动区域过多导致体验割裂。 → Mitigation：控制为“外层内容区 + 局部列表区”两级滚动，不新增第三层滚动容器。

## Migration Plan

1. 重构 `GroupCreateModal` 的 dialog 语义结构（header/title/description/body/footer）。
2. 移除嵌套 form，拆分提交与搜索区域的事件边界。
3. 建立内容滚动策略并验证小窗可达性（创建与管理两 tab）。
4. 联调 FAB 打开、关闭、创建成功回到 chat 的交互闭环。
5. 以桌面 build + 手工检查控制台告警作为放行条件；若回归风险出现，回滚到上一版稳定弹窗实现并保留新 spec 约束。

## Open Questions

- 是否需要在下一步把群聊弹窗的 legacy CSS 类彻底清理为纯 shadcn/tailwind 结构（本 change 可先做到“告警清零 + 交互稳定”）。
