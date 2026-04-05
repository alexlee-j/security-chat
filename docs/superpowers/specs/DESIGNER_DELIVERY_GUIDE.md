# Security Chat - 设计师交付指南

**更新日期**: 2026-04-05
**目的**: 指导设计师如何交付 UI 设计稿，确保 AI 能高效还原

---

## 1. 设计文件要求

### 1.1 Pencil 文件组织

所有设计稿放在 `/security-chat.pen` 文件中，采用以下结构：

```
Top-Level Frames (必须):
├── Light Mode        ← Light Mode 所有页面
└── Dark Mode         ← Dark Mode 所有页面

每个页面 Frame 内部:
├── Login             ← 登录页
├── Register          ← 注册页
├── Chat              ← 聊天页 (已完成)
├── Settings          ← 设置页 (待设计)
└── ...
```

### 1.2 Frame 命名规范

- 使用简洁的英文名称
- Light/Dark Mode 的对应 Frame 名称一致
- 示例: `Login` / `Login` (不是 `Login Light` / `Login Dark`)

---

## 2. 页面清单

| 页面 | 文件位置 | 说明 |
|------|----------|------|
| 登录页 | `Light Mode / Login` | 待设计 |
| 注册页 | `Light Mode / Register` | 待设计 |
| 聊天页 | `Light Mode / Chat` | ✅ 已完成 |
| 设置页 | `Light Mode / Settings` | 待设计 |
| 好友列表页 | `Light Mode / Friends` | 待设计 |

Dark Mode 对应页面放在 `Dark Mode` frame 下，结构相同。

---

## 3. 设计规范

### 3.1 布局模式

**重要**: 父级 Frame 必须设置 `layout: "none"`，启用绝对定位。

```
Frame 属性设置:
├── layout: "none"       ← 启用绝对定位
├── width: 具体像素值     ← 设计稿宽度
└── height: 具体像素值    ← 设计稿高度
```

### 3.2 颜色变量 (Design Tokens)

设计时使用以下颜色变量，确保 Light/Dark 切换一致：

#### Light Mode

| 变量名 | 用途 | 色值 |
|--------|------|------|
| `--brand-primary` | 主色 | `#3390ec` |
| `--brand-hover` | 主色悬停 | `#2b7fd4` |
| `--sidebar-bg` | 侧边栏背景 | `#f8f9fa` |
| `--chat-bg` | 聊天区域背景 | `#e8f4f8` |
| `--msg-in` | 收到消息气泡 | `#ffffff` |
| `--msg-out` | 发送消息气泡 | `#e6ffde` |
| `--text-primary` | 文字主色 | `#000000` |
| `--text-secondary` | 文字次色 | `#707579` |
| `--border-light` | 边框 | `#dfe1e5` |
| `--input-bg` | 输入框背景 | `#f8f9fa` |
| `--card-bg` | 卡片背景 | `#ffffff` |
| `--error` | 错误色 | `#e53935` |
| `--success` | 成功色 | `#4caf50` |

#### Dark Mode

| 变量名 | 用途 | 色值 |
|--------|------|------|
| `--brand-primary` | 主色 | `#8777d1` |
| `--brand-hover` | 主色悬停 | `#9b8cd9` |
| `--sidebar-bg` | 侧边栏背景 | `#182533` |
| `--chat-bg` | 聊天区域背景 | `#202530` |
| `--msg-in` | 收到消息气泡 | `#2d3a42` |
| `--msg-out` | 发送消息气泡 | `#8777d1` |
| `--text-primary` | 文字主色 | `#ffffff` |
| `--text-secondary` | 文字次色 | `#8b9aa3` |
| `--border-light` | 边框 | `#2d3a47` |
| `--input-bg` | 输入框背景 | `#2d3a47` |
| `--card-bg` | 卡片背景 | `#2d3a42` |
| `--error` | 错误色 | `#ef5350` |
| `--success` | 成功色 | `#66bb6a` |

### 3.3 字号规范

| 用途 | 字号 |
|------|------|
| 页面标题 | 20px, bold |
| 区块标题 | 18px, bold |
| 正文 | 15px |
| 次要文字 | 14px |
| 辅助说明 | 13px |
| 小标签 | 11px |

### 3.4 间距规范

| 用途 | 间距 |
|------|------|
| 页面边距 | 16px |
| 区块间距 | 24px |
| 元素间距 | 12px |
| 紧凑间距 | 8px |
| 输入框高度 | 48px |
| 按钮高度 | 48px |
| 输入框圆角 | 12px |
| 按钮圆角 | 12px |
| 卡片圆角 | 16px |
| 头像尺寸 | 40x40px |

---

## 4. 组件设计要求

### 4.1 登录/注册页面组件

**必做组件**:

1. **输入框 (Input)**
   - Default 状态
   - Focus 状态（边框变主色）
   - Error 状态（边框变错误色）
   - Disabled 状态（50% 透明度）

2. **主按钮 (Primary Button)**
   - Default 状态
   - Hover 状态（背景悬停色）
   - Active 状态（略微缩小）
   - Loading 状态（显示加载动画）
   - Disabled 状态

3. **错误提示 (Error Message)**
   - 带图标和文字

4. **链接文字 (Link Text)**
   - Default 状态
   - Hover 状态（变主色）

### 4.2 组件命名

```
组件命名格式: Component/<组件名>/<状态>
示例:
├── Component/Button/Default
├── Component/Button/Hover
├── Component/Button/Disabled
├── Component/Input/Default
├── Component/Input/Error
└── ...
```

---

## 5. 交付物清单

### 5.1 Pencil 文件

设计师完成设计后，交付 `/security-chat.pen` 文件。

**要求**:
- 所有页面放在同一个 .pen 文件中
- Light/Dark Mode 分别放在顶层 Frame
- 使用 Design Tokens 定义颜色（方便 AI 读取变量）

### 5.2 PNG 截图

每个页面需要导出 PNG 截图：

| 截图文件 | 说明 |
|----------|------|
| `login-light.png` | 登录页 Light Mode |
| `login-dark.png` | 登录页 Dark Mode |
| `register-light.png` | 注册页 Light Mode |
| `register-dark.png` | 注册页 Dark Mode |
| `settings-light.png` | 设置页 Light Mode |
| `settings-dark.png` | 设置页 Dark Mode |

**截图要求**:
- 尺寸: 设计稿实际尺寸
- 包含完整页面内容
- 清晰展示各组件状态

### 5.3 组件细节图

关键组件需要单独截图展示各状态：

```
components/
├── button-default.png
├── button-hover.png
├── button-loading.png
├── input-default.png
├── input-focus.png
├── input-error.png
└── error-message.png
```

---

## 6. AI 读取设计稿流程

### 6.1 AI 会用到的 MCP 工具

| 工具 | 用途 |
|------|------|
| `get_screenshot` | 获取页面 PNG 截图 |
| `get_variables` | 读取设计变量（颜色、字号等）|
| `batch_get` | 读取组件结构 |
| `snapshot_layout` | 读取布局信息 |

### 6.2 设计师需要提供的节点 ID

完成设计后，请提供每个页面的 Frame 节点 ID：

```
示例:
Light Mode / Login Frame ID: "LoginPage"
Light Mode / Register Frame ID: "RegisterPage"
Dark Mode / Login Frame ID: "LoginPageDark"
...
```

---

## 7. 文件存放位置

```
docs/superpowers/
├── specs/
│   ├── 2026-04-05-chat-page-design.md      ← 聊天页设计规范
│   ├── 2026-04-05-login-register-design.md ← 登录注册设计规范
│   └── DESIGNER_DELIVERY_GUIDE.md           ← 本文档
├── design/                                  ← 设计交付物
│   ├── security-chat.pen                    ← Pencil 文件
│   ├── login-light.png
│   ├── login-dark.png
│   └── ...
└── pencil-cache/                            ← AI 生成的临时文件
```

---

## 8. 常见问题

### Q: 为什么父级 Frame 要设置 `layout: "none"`？
A: 这是 Pencil 的绝对定位模式。如果使用 flexbox 布局 (horizontal/vertical)，子元素的 x/y 坐标会被忽略，导致布局错乱。

### Q: 如何使用 Design Tokens？
A: 在 Pencil 变量面板中创建颜色变量，命名为 `--brand-primary` 等。在属性中使用 `$--brand-primary` 引用。

### Q: Dark Mode 要单独设计吗？
A: 是的，需要在 `Dark Mode` Frame 下创建对应的页面。布局结构与 Light Mode 相同，仅颜色不同。

### Q: 组件状态需要画出来吗？
A: 至少画一个完整的 Default 状态，其他状态可以在文档中描述。AI 能从 Default 状态推断其他状态。

---

## 9. 交付检查清单

完成设计后，请确认：

- [ ] Pencil 文件包含所有页面
- [ ] Light Mode 和 Dark Mode 分别放在对应顶层 Frame
- [ ] 父级 Frame 设置了 `layout: "none"`
- [ ] 使用了 Design Tokens 定义颜色
- [ ] 每个页面有对应的 Frame 节点 ID
- [ ] 导出了 PNG 截图
- [ ] 组件各状态已标注或描述
- [ ] 填写了页面节点 ID 清单

---

## 10. 联系方式

如有疑问，请联系开发团队。
