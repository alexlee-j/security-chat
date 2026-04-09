# Security Chat - 认证页面设计方案

**日期**：2026-04-07
**版本**：2.0
**用途**：用于 Figma 高保真交互设计稿
**UI 组件库**：shadcn/ui + Tailwind CSS
**设计参考**：Telegram Desktop + Security Chat 品牌风格

---

## 1. 技术栈与组件规范

### 1.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 框架 |
| Tailwind CSS | 样式 |
| shadcn/ui | 组件库 |
| Radix UI | 无障碍底层 |
| react-hook-form + zod | 表单验证 |

### 1.2 shadcn/ui 组件清单

| 组件 | 用途 | 变体 |
|------|------|------|
| `Input` | 文本输入框 | default |
| `Button` | 按钮 | default, outline, ghost, link |
| `Checkbox` | 复选框 | - |
| `Label` | 标签文字 | - |
| `Form` | 表单封装 | - |
| `Card` | 卡片容器 | - |
| `Spinner` | 加载动画 | - |

### 1.3 组件设计原则

1. **使用 shadcn/ui 变体** - 通过 `cn()` 工具函数合并品牌色
2. **Radix UI 原语** - 保证无障碍支持（WAI-ARIA）
3. **Tailwind CSS** - 使用 `tailwind-merge` 和 `clsx` 合并类名
4. **CSS 变量** - 通过 CSS 变量注入主题色，便于 Dark Mode 切换

---

## 2. shadcn/ui 组件规格

### 2.1 Input 组件

**设计稿规格**（基于 shadcn/ui Input）：

```tsx
// 组件变体
<Input
  className="h-12 px-4 rounded-xl border-1.5 bg-input text-primary placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand/50"
/>
```

| 属性 | 设计稿值 |
|------|----------|
| 高度 | 48px (h-12) |
| 圆角 | 14px (rounded-xl) |
| 边框 | 1.5px |
| 间距 | px-4 (16px) |

**Light Mode CSS 变量**：

| Tailwind 变量 | CSS 变量 | 值 |
|---------------|----------|-----|
| `bg-input` | `--input` | `#f8f9fa` |
| `border-input` | `--border` | `#dfe1e5` |
| `text-primary` | `--primary` | `#1a1a1a` |
| `text-muted-foreground` | `--muted-foreground` | `#aab0b6` |
| `ring-brand` | `--ring` | `#3390ec` |

**Dark Mode CSS 变量**：

| Tailwind 变量 | CSS 变量 | 值 |
|---------------|----------|-----|
| `bg-input` | `--input` | `#1a242d` |
| `border-input` | `--border` | `#3d4a57` |
| `text-primary` | `--primary` | `#ffffff` |
| `text-muted-foreground` | `--muted-foreground` | `#5a6a75` |
| `ring-brand` | `--ring` | `#8777d1` |

### 2.2 Button 组件

**设计稿规格**（基于 shadcn/ui Button）：

```tsx
// 主要按钮 - 渐变背景
<Button
  className="h-12 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-start to-brand-end hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-lg"
>
  {children}
</Button>

// 链接按钮
<Button
  variant="link"
  className="text-brand h-auto p-0 font-normal"
>
  {children}
</Button>
```

**Button 变体定义**：

| 变体 | Tailwind Classes | 用途 |
|------|------------------|------|
| `default` | 渐变背景 | 提交按钮 |
| `outline` | 边框+透明背景 | 次要操作 |
| `ghost` | 透明背景 | 辅助操作 |
| `link` | 链接样式 | 跳转链接 |

**品牌渐变定义**（Tailwind Extended）：

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      backgroundImage: {
        'gradient-brand': 'linear-gradient(90deg, var(--brand-start), var(--brand-end))',
      },
      colors: {
        brand: {
          start: '#4da3f0',
          end: '#3390ec',
          DEFAULT: '#3390ec',
        },
      },
    },
  },
}
```

**Dark Mode 渐变**：

```css
:root[data-theme="dark"] {
  --brand-start: #9b8bd9;
  --brand-end: #8777d1;
}
```

### 2.3 Checkbox 组件

**设计稿规格**（基于 shadcn/ui Checkbox）：

```tsx
<Checkbox
  id={id}
  className="w-5 h-5 rounded border-1.5 border-muted bg-transparent data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-white"
/>
```

| 属性 | 设计稿值 |
|------|----------|
| 尺寸 | 20x20px (w-5 h-5) |
| 圆角 | 4px (rounded) |
| 边框 | 1.5px |

### 2.4 Label 组件

**设计稿规格**（基于 shadcn/ui Label）：

```tsx
<Label
  htmlFor={id}
  className="text-sm font-normal text-secondary"
>
  {children}
</Label>
```

### 2.5 Card 组件（表单卡片）

**设计稿规格**（基于 shadcn/ui Card）：

```tsx
<Card className="w-[420px] rounded-3xl p-10 shadow-xl">
  <CardContent className="p-0 space-y-6">
    {children}
  </CardContent>
</Card>
```

| 属性 | 设计稿值 |
|------|----------|
| 宽度 | 420px |
| 圆角 | 28px (rounded-3xl) |
| 内边距 | 40px (p-10) |
| 阴影 | blur:60px, offset-y:20px |

---

## 3. 页面布局

### 2.1 整体结构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  品牌区 (540px)                    │  表单区 (660px)                    │
│  渐变背景 + 装饰圆形                │  表单卡片居中                       │
│  Logo + 标题 + 标语                │  输入框 + 按钮 + 链接               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**布局规格**：
| 属性 | 值 |
|------|-----|
| 页面总宽度 | 1200px |
| 页面总高度 | 700px |
| 品牌区宽度 | 540px (45%) |
| 表单区宽度 | 660px (55%) |
| 表单卡片宽度 | 420px |
| 表单卡片圆角 | 28px |
| 表单卡片内边距 | 40px |
| 表单卡片阴影 | blur:60px, offset-y:20px |

### 2.2 表单卡片内部结构

```
┌─────────────────────────────────────┐
│                                      │
│           标题文字                    │  ← 28px 粗体
│           副标题文字                  │  ← 15px 次色
│                                      │
│  ┌─────────────────────────────┐   │
│  │      输入框 1                │   │  ← 52px 高
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │      输入框 2                │   │
│  └─────────────────────────────┘   │
│                                      │
│  选项行 / 复选框                     │
│                                      │
│  ┌─────────────────────────────┐   │
│  │        提交按钮              │   │  ← 52px 高
│  └─────────────────────────────┘   │
│                                      │
│         底部链接文字                   │
└─────────────────────────────────────┘
```

---

## 3. 品牌区设计

### 3.1 品牌区结构

```
┌─────────────────────────────────┐
│                                   │
│      ○                           │  ← 装饰椭圆 1 (280px)
│           ○                      │  ← 装饰椭圆 2 (220px)
│                    ○             │  ← 装饰椭圆 3 (160px)
│                                   │
│         Security Chat             │  ← 标题 32px 白色粗体
│        安全至上，畅聊无忧            │  ← 标语 19px 白色/主题色
│                                   │
└─────────────────────────────────┘
```

### 3.2 品牌区规格

#### Light Mode

| 元素 | 规格 |
|------|------|
| 背景渐变 | #e8f4f8 → #d4e4f8 + #3390ec 遮罩 8% opacity |
| 椭圆 1 | #3390ec, 280px, opacity:0.15, 位置:(-60, -80) |
| 椭圆 2 | #3390ec, 220px, opacity:0.08, 位置:(280, 340) |
| 椭圆 3 | #3390ec, 160px, opacity:0.12, 位置:(380, -20) |
| Logo 背景 | #3390ec 填充圆形 |
| 标题 | "Security Chat", 32px, Inter Bold, #ffffff |
| 标语 | "安全至上，畅聊无忧", 19px, Inter Bold, #ffffff |

#### Dark Mode

| 元素 | 规格 |
|------|------|
| 背景渐变 | #181a21 → #1e2230 + #8777d1 遮罩 12% opacity |
| 椭圆 1 | #8777d1, 280px, opacity:0.15, 位置:(-60, -80) |
| 椭圆 2 | #8777d1, 220px, opacity:0.08, 位置:(280, 340) |
| 椭圆 3 | #8777d1, 160px, opacity:0.12, 位置:(380, -20) |
| Logo 背景 | #8777d1 填充圆形 |
| 标题 | "Security Chat", 32px, Inter Bold, #ffffff |
| 标语 | "安全至上，畅聊无忧", 19px, Inter Bold, #e6e3f7 |

---

## 4. 表单元素规格（shadcn/ui + Tailwind）

### 4.1 Input 组件

**组件代码**：

```tsx
// 使用 shadcn/ui Input 变体
<Input
  className={cn(
    "h-12 w-[320px] rounded-xl border bg-background px-4",
    "text-sm text-foreground placeholder:text-muted-foreground",
    "border-input focus-visible:ring-2 focus-visible:ring-brand/50",
    error && "border-destructive focus-visible:ring-destructive/50",
    disabled && "opacity-50 cursor-not-allowed"
  )}
  placeholder="输入框占位文字"
/>
```

**Tailwind CSS 变量映射**：

| Tailwind 类 | CSS 变量 | Light Mode | Dark Mode |
|-------------|----------|-----------|-----------|
| `bg-background` | `--background` | #ffffff | #232936 |
| `text-foreground` | `--foreground` | #1a1a1a | #ffffff |
| `text-muted-foreground` | `--muted-foreground` | #707579 | #8b9aa3 |
| `border-input` | `--input` | #dfe1e5 | #3d4a57 |
| `ring-brand` | `--ring` | #3390ec | #8777d1 |

**交互状态**：

| 状态 | Tailwind Classes |
|------|------------------|
| Default | `border-input` |
| Hover | `hover:border-brand` |
| Focus | `focus-visible:ring-2 focus-visible:ring-brand/50` |
| Error | `border-destructive focus-visible:ring-destructive/50` |
| Disabled | `opacity-50 cursor-not-allowed` |

### 4.2 Checkbox 组件

**组件代码**：

```tsx
// 使用 shadcn/ui Checkbox 变体
<Checkbox
  id="remember"
  className={cn(
    "h-5 w-5 rounded border border-input bg-transparent",
    "data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-white",
    "focus-visible:ring-2 focus-visible:ring-brand/50",
    "transition-colors"
  )}
/>
```

**Tailwind CSS 变量映射**：

| Tailwind 类 | CSS 变量 | Light Mode | Dark Mode |
|-------------|----------|-----------|-----------|
| `border-input` | `--input` | #dfe1e5 | #3d4a57 |
| `bg-brand` | `--brand` | #3390ec | #8777d1 |

### 4.3 Button 组件

**组件代码**：

```tsx
// 主要按钮 - 渐变背景
<Button
  className={cn(
    "h-12 w-[320px] rounded-xl",
    "bg-gradient-to-r from-brand-start to-brand-end",
    "text-white font-semibold",
    "hover:opacity-90 active:scale-[0.98]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "shadow-lg shadow-brand/25",
    "transition-all duration-150"
  )}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      处理中...
    </>
  ) : children}
</Button>

// 链接按钮
<Button
  variant="link"
  className="h-auto p-0 text-brand hover:underline"
>
  {children}
</Button>
```

**Button 变体定义**：

| 变体 | Tailwind Classes | 用途 |
|------|------------------|------|
| `default` | 渐变背景 | 主要提交按钮 |
| `outline` | 边框+透明背景 | 次要操作 |
| `ghost` | 透明背景 | 辅助操作 |
| `link` | 链接样式 | 内联链接 |

**品牌渐变配置**：

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3390ec',  // 主色
          600: '#2b7fd4', // 悬停色
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          start: '#4da3f0', // 渐变起点
          end: '#3390ec',   // 渐变终点
        },
      },
    },
  },
}
```

**按钮状态**：

| 状态 | Tailwind Classes |
|------|------------------|
| Default | `bg-gradient-to-r from-brand-start to-brand-end` |
| Hover | `hover:opacity-90` |
| Active | `active:scale-[0.98]` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Loading | `animate-spin` + Loader2 图标 |

### 4.4 Label 组件

**组件代码**：

```tsx
// 使用 shadcn/ui Label
<Label
  htmlFor="username"
  className="text-sm font-normal text-secondary"
>
  用户名
</Label>
```

### 4.5 FormField 组件

**组件代码**：

```tsx
// 使用 react-hook-form + shadcn Form
<FormField
  control={control}
  name="username"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel className="text-sm font-normal text-secondary">
        用户名
      </FormLabel>
      <FormControl>
        <Input
          {...field}
          placeholder="用户名 / ID"
          className={cn(
            "h-12 w-[320px]",
            fieldState.error && "border-destructive"
          )}
        />
      </FormControl>
      <FormMessage className="text-xs text-destructive" />
    </FormItem>
  )}
/>
```

---

## 5. 登录页面实现

### 5.1 组件结构（shadcn/ui）

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
  remember: z.boolean().default(false),
  autoLogin: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm() {
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      remember: false,
      autoLogin: false,
    },
  });

  const isLoading = form.formState.isSubmitting;

  async function onSubmit(values: LoginForm) {
    // 处理登录逻辑
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">欢迎回来</h1>
          <p className="text-sm text-muted-foreground">登录您的账号</p>
        </div>

        {/* 用户名 */}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  placeholder="用户名 / ID"
                  className="h-12 w-[320px]"
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        {/* 密码 */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder="密码"
                  className="h-12 w-[320px]"
                  autoComplete="current-password"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        {/* 选项行 */}
        <div className="flex items-center justify-between w-[320px]">
          <FormField
            control={form.control}
            name="remember"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="remember" className="text-sm cursor-pointer">
                  记住密码
                </Label>
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-brand"
            onClick={() => navigate("/forgot-password")}
          >
            忘记密码？
          </Button>
        </div>

        {/* 自动登录 */}
        <FormField
          control={form.control}
          name="autoLogin"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <Checkbox
                id="autoLogin"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <Label htmlFor="autoLogin" className="text-sm cursor-pointer">
                自动登录
              </Label>
            </FormItem>
          )}
        />

        {/* 提交按钮 */}
        <Button
          type="submit"
          className="h-12 w-[320px] bg-gradient-to-r from-brand-start to-brand-end text-white font-semibold shadow-lg shadow-brand/25"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登录中...
            </>
          ) : (
            "登录"
          )}
        </Button>

        {/* 底部链接 */}
        <div className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Button
            type="button"
            variant="link"
            className="text-brand p-0 h-auto font-normal"
            onClick={() => navigate("/register")}
          >
            立即注册
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### 5.2 布局规格

| 元素 | 间距 |
|------|------|
| 标题与副标题 | 8px |
| 副标题与输入框 | 24px |
| 输入框之间 | 16px |
| 输入框与选项行 | 16px |
| 选项行之间 | 12px |
| 选项行与按钮 | 20px |
| 按钮与底部链接 | 16px |
| 底部链接与卡片底部 | 0px |

### 5.3 页面流程

```
登录页
  │
  ├── [填写用户名/密码] → [点击登录] → [登录成功] → 跳转聊天页
  │
  ├── [点击"忘记密码？"] → 忘记密码页
  │
  ├── [点击"立即注册"] → 注册页
  │
  └── [点击"自动登录"选项] → 切换自动登录状态
```

---

## 6. 验证码登录页面

### 6.1 表单结构

```
┌─────────────────────────────────────┐
│                                      │
│           验证登录                     │  ← 28px, Inter Bold
│         登录您的账号                   │  ← 15px, Inter Normal
│                                      │
│  ┌─────────────────────────────┐   │
│  │       手机号或邮箱             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │       验证码                  │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │         验证登录              │   │
│  └─────────────────────────────┘   │
│                                      │
│       使用密码登录                    │
└─────────────────────────────────────┘
```

### 6.2 验证码输入规格

| 属性 | 规格 |
|------|------|
| 验证码长度 | 6位 |
| 输入模式 | numeric |
| 自动填充 | 支持 one-time-code |

---

## 7. 注册页面

### 7.1 表单结构

```
┌─────────────────────────────────────┐
│                                      │
│           创建账号                     │  ← 28px, Inter Bold
│        注册以开始安全通讯               │  ← 15px, Inter Normal
│                                      │
│  ┌─────────────────────────────┐   │
│  │           用户名             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │           邮箱               │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │           密码               │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │         确认密码              │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │           注册               │   │
│  └─────────────────────────────┘   │
│                                      │
│        已有账号？立即登录              │
└─────────────────────────────────────┘
```

### 7.2 密码强度提示

| 规则 | 说明 |
|------|------|
| 最小长度 | 8位 |
| 必须包含 | 数字和字母 |
| 提示样式 | info 图标 + tooltip |
| Tooltip 触发 | Hover / Focus |

### 7.3 注册流程

```
注册页
  │
  ├── [填写表单] → [点击注册] → [注册成功] → 跳转聊天页
  │
  └── [点击"立即登录"] → 登录页
```

---

## 8. 忘记密码页面

### 8.1 流程概述

```
忘记密码页 - Step 1                    忘记密码页 - Step 2
┌─────────────────────┐              ┌─────────────────────┐
│                     │              │                     │
│    重置密码          │              │    重置密码          │
│  输入您注册的邮箱地址  │              │  请输入收到的验证码   │
│                     │              │                     │
│  ┌───────────────┐  │              │  ┌───────────────┐  │
│  │   邮箱地址     │  │   [发送]     │  │   邮箱地址     │  │
│  └───────────────┘  │     ↓        │  └───────────────┘  │
│                     │              │  ┌───────────────┐  │
│  ┌───────────────┐  │              │  │   6位验证码    │  │
│  │   发送验证码    │  │              │  └───────────────┘  │
│  └───────────────┘  │              │  ┌───────────────┐  │
│                     │              │  │    新密码      │  │
│   想起密码了？        │              │  └───────────────┘  │
│   立即登录            │              │  ┌───────────────┐  │
│                     │              │  │   确认密码     │  │
└─────────────────────┘              │  └───────────────┘  │
                                     │  ┌───────────────┐  │
                                     │  │   重置密码     │  │
                                     │  └───────────────┘  │
                                     │   想起密码了？       │
                                     │   立即登录           │
                                     └─────────────────────┘
```

### 8.2 Step 1 - 发送验证码

| 元素 | 规格 |
|------|------|
| 标题 | "重置密码", 28px, Inter Bold |
| 副标题 | "输入您注册的邮箱地址", 15px, Inter Normal |
| 邮箱输入框 | 320x52px, 支持 email 自动补全 |
| 发送按钮 | 320x52px, 渐变背景 |
| 按钮冷却 | 显示倒计时 "60秒后可重发" |

### 8.3 Step 2 - 输入验证码和新密码

| 元素 | 规格 |
|------|------|
| 标题 | "重置密码", 28px, Inter Bold |
| 副标题 | "请输入收到的验证码", 15px, Inter Normal |
| 邮箱输入框 | 只读，显示已发送的邮箱 |
| 验证码输入 | 6位，支持自动读取短信验证码 |
| 新密码输入 | 同注册密码规则 |
| 确认密码输入 | 必须与新密码一致 |
| 重置按钮 | 320x52px, 渐变背景 |

### 8.4 忘记密码完整流程

```
忘记密码页 Step 1
  │
  ├── [输入邮箱] → [点击发送验证码] → [发送成功] → 显示 Step 2
  │
  └── [点击"立即登录"] → 返回登录页

忘记密码页 Step 2
  │
  ├── [输入验证码+新密码] → [点击重置] → [重置成功] → 返回登录页
  │
  └── [点击"立即登录"] → 返回登录页
```

---

## 9. 交互状态与动画

### 9.1 表单验证

| 验证项 | 触发条件 | 反馈 |
|--------|----------|------|
| 用户名为空 | 点击登录时 | 输入框边框变红，显示"请输入用户名" |
| 密码为空 | 点击登录时 | 输入框边框变红，显示"请输入密码" |
| 邮箱格式错误 | 失焦时 | 输入框边框变红，显示"请输入有效邮箱" |
| 密码太短 | 失焦时 | tooltip 提示"密码至少8位" |
| 密码不一致 | 确认密码失焦时 | 输入框边框变红，显示"两次密码不一致" |
| 验证码错误 | 点击验证时 | 输入框边框变红，显示"验证码错误" |

### 9.2 加载状态

| 操作 | 按钮状态 | 说明 |
|------|----------|------|
| 登录中 | "登录中..." + spinner | 按钮禁用，不可点击 |
| 注册中 | "注册中..." + spinner | 按钮禁用，不可点击 |
| 发送验证码 | "发送中..." + spinner | 按钮禁用，显示倒计时 |
| 重置密码 | "重置中..." + spinner | 按钮禁用，不可点击 |

### 9.3 过渡动画

| 元素 | 属性 | 时长 | 缓动 |
|------|------|------|------|
| 页面切换 | opacity | 200ms | ease |
| 输入框聚焦 | border-color, box-shadow | 150ms | ease |
| 按钮悬停 | background | 150ms | ease |
| 按钮点击 | transform | 100ms | ease |
| 错误提示 | opacity, translateY | 200ms | ease |
| Spinner | transform | 1000ms | linear (循环) |

---

## 10. shadcn/ui CSS 变量（基于 CSS 颜色变量）

### 10.1 设计系统颜色变量

shadcn/ui 使用 WAI-ARIA 标准 CSS 变量命名。我们需要扩展以下变量：

```css
/* ========================================
   Security Chat - CSS Variables
   基于 shadcn/ui 设计系统
   ======================================== */

/* === Light Mode === */
:root {
  /* shadcn/ui 标准变量 */
  --background: #ffffff;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;
  --primary: #3390ec;           /* 主色 */
  --primary-foreground: #ffffff;
  --secondary: #f8f9fa;
  --secondary-foreground: #1a1a1a;
  --muted: #f8f9fa;
  --muted-foreground: #707579;
  --accent: #f8f9fa;
  --accent-foreground: #1a1a1a;
  --destructive: #e53935;
  --destructive-foreground: #ffffff;
  --border: #dfe1e5;
  --input: #f8f9fa;
  --ring: #3390ec;

  /* 品牌渐变（Tailwind Extended） */
  --brand-start: #4da3f0;
  --brand-end: #3390ec;

  /* 页面背景 */
  --page-background: #e8f4f8;

  /* 阴影 */
  --shadow: #00000014;
  --shadow-lg: #00000020;

  /* 椭圆装饰 */
  --ellipse: #3390ec;
  --ellipse-opacity-1: 0.15;
  --ellipse-opacity-2: 0.08;
  --ellipse-opacity-3: 0.12;

  /* 圆角 */
  --radius: 0.875rem;  /* 14px - 组件默认圆角 */
}

/* === Dark Mode === */
:root[data-theme="dark"] {
  --background: #202530;
  --foreground: #ffffff;
  --card: #232936;
  --card-foreground: #ffffff;
  --popover: #232936;
  --popover-foreground: #ffffff;
  --primary: #8777d1;           /* 主色 */
  --primary-foreground: #ffffff;
  --secondary: #2d3a47;
  --secondary-foreground: #ffffff;
  --muted: #2d3a47;
  --muted-foreground: #8b9aa3;
  --accent: #2d3a47;
  --accent-foreground: #ffffff;
  --destructive: #e53935;
  --destructive-foreground: #ffffff;
  --border: #3d4a57;
  --input: #1a242d;
  --ring: #8777d1;

  /* 品牌渐变 */
  --brand-start: #9b8bd9;
  --brand-end: #8777d1;

  /* 页面背景 */
  --page-background: #202530;

  /* 阴影 */
  --shadow: #00000033;
  --shadow-lg: #00000050;

  /* 椭圆装饰 */
  --ellipse: #8777d1;
}
```

### 10.2 Tailwind 配置

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          start: "var(--brand-start)",
          end: "var(--brand-end)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        lg: "0 10px 15px -3px var(--shadow-lg), 0 4px 6px -4px var(--shadow-lg)",
      },
    },
  },
}
```

---

## 11. Figma 设计标注要求

### 11.1 设计系统组件标注

使用 shadcn/ui 组件库时，Figma 设计稿应标注：

| 标注项 | 说明 | 示例 |
|--------|------|------|
| 组件名称 | shadcn/ui 组件名 | `<Input>`, `<Button>` |
| 变体 | 组件变体 | `variant="default"`, `variant="outline"` |
| Tailwind 类 | 样式类名 | `h-12 w-[320px] rounded-xl` |
| CSS 变量 | 使用的主题变量 | `--primary`, `--ring` |
| 状态 | 交互状态 | Default, Hover, Focus, Disabled |

### 11.2 组件命名规范（shadcn/ui）

```
组件/变体/状态
例如：
- Input/default/Default
- Input/default/Focus
- Input/default/Error
- Button/default/Default
- Button/default/Hover
- Button/default/Loading
- Button/default/Disabled
- Button/outline/Default
- Checkbox/default/Unchecked
- Checkbox/default/Checked
```

### 11.3 Figma 图层组织

```
Page: 登录页
├── Brand Area (品牌区)
│   ├── Gradient Overlay
│   ├── Ellipse 1
│   ├── Ellipse 2
│   ├── Ellipse 3
│   └── Brand Content
│       ├── Title
│       └── Subtitle
│
├── Form Area (表单区)
│   └── Auth Card
│       └── Form Container
│           ├── Title
│           ├── Subtitle
│           ├── Input: Username
│           ├── Input: Password
│           ├── Checkbox Row
│           │   ├── Remember Password
│           │   └── Forgot Password Link
│           ├── Checkbox: Auto Login
│           ├── Button: Login
│           └── Footer Link
│
└── Auto Layout Frames
    ├── Desktop: 1200x700
    ├── Tablet: (if needed)
    └── Mobile: (if needed)
```

---

## 12. 设计文件节点 ID

| 页面 | Light Mode ID | Dark Mode ID |
|------|-------------|--------------|
| 登录页 | QU5PV | LnBJf |
| 注册页 | Keaay | dkDjk |

`.pen` 文件路径: `/Users/jerry/Desktop/security-chat.pen`

---

## 13. 待确认事项

以下事项需要与产品确认：

1. **验证码登录**：是否需要图形验证码？
2. **注册限制**：是否需要验证邮箱唯一性？
3. **密码强度**：是否需要更复杂的密码规则？
4. **第三方登录**：是否需要支持 Google/Apple 登录？
5. **人机验证**：是否需要 CAPTCHA？

---

## 14. shadcn/ui 组件安装

认证页面需要安装以下 shadcn/ui 组件：

```bash
# 安装核心组件
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add label
npx shadcn-ui@latest add form
npx shadcn-ui@latest add card
npx shadcn-ui@latest add separator

# 安装表单验证
npm install react-hook-form @hookform/resolvers zod

# 安装图标（Lucide React）
npm install lucide-react
```

### 14.1 组件变体扩展

需要在 `components/ui` 中扩展组件以支持品牌色：

```tsx
// components/ui/button.tsx 扩展
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary-start to-primary-end text-primary-foreground shadow-lg shadow-primary/25",
        outline: "border-2 border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 px-3",
        lg: "h-14 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 14.2 cn 工具函数

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 15. 参考资料

- [会话列表 UI 改版设计](../UI设计稿/会话列表UI改版设计.md)
- [聊天页面设计方案](./2026-04-05-chat-page-design.md)
- [shadcn/ui 官方文档](https://ui.shadcn.com)
- 原始 .pen 文件: `/Users/jerry/Desktop/security-chat.pen`
