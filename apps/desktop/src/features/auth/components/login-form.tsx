/**
 * 登录表单组件
 * 设计稿：2026-04-07-auth-pages-design.md
 */
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  username: z.string()
    .min(3, '账号长度至少3个字符'),
  password: z.string()
    .min(8, '密码长度至少8个字符'),
  remember: z.boolean(),
  autoLogin: z.boolean(),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  defaultUsername?: string;
  defaultPassword?: string;
  rememberPassword?: boolean;
  autoLogin?: boolean;
  isLoading: boolean;
  onSubmit: (values: LoginFormData) => Promise<void>;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
  onSwitchToCodeLogin: () => void;
}

export function LoginForm({
  defaultUsername = '',
  defaultPassword = '',
  rememberPassword = false,
  autoLogin = false,
  isLoading,
  onSubmit,
  onSwitchToRegister,
  onSwitchToForgotPassword,
  onSwitchToCodeLogin,
}: LoginFormProps): JSX.Element {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: defaultUsername,
      password: defaultPassword,
      remember: rememberPassword,
      autoLogin,
    },
  });

  useEffect(() => {
    form.reset({
      username: defaultUsername,
      password: defaultPassword,
      remember: rememberPassword || autoLogin,
      autoLogin: autoLogin && (rememberPassword || autoLogin),
    });
  }, [autoLogin, defaultPassword, defaultUsername, form, rememberPassword]);

  const handleSubmit = async (values: LoginFormData) => {
    const normalizedValues: LoginFormData = {
      ...values,
      remember: values.remember || values.autoLogin,
      autoLogin: values.autoLogin && (values.remember || values.autoLogin),
    };
    await onSubmit(normalizedValues);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">欢迎回来</h1>
        <p className="text-sm text-muted-foreground">登录您的账号</p>
      </div>

      {/* 用户名 */}
      <div className="space-y-2">
        <Input
          {...form.register('username')}
          placeholder="用户名 / ID"
          className="h-12 w-[320px]"
          autoComplete="username"
          disabled={isLoading}
        />
        {form.formState.errors.username && (
          <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
        )}
      </div>

      {/* 密码 */}
      <div className="space-y-2">
        <Input
          {...form.register('password')}
          type="password"
          placeholder="密码"
          className="h-12 w-[320px]"
          autoComplete="current-password"
          disabled={isLoading}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      {/* 选项行：记住密码 + 忘记密码 */}
      <div className="flex items-center justify-between w-[320px]">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={form.watch('remember')}
            onCheckedChange={(checked) => {
              const nextRemember = Boolean(checked);
              form.setValue('remember', nextRemember);
              if (!nextRemember) {
                form.setValue('autoLogin', false);
              }
            }}
            disabled={isLoading}
          />
          <Label htmlFor="remember" className="text-sm cursor-pointer">
            记住密码
          </Label>
        </div>
        <span
          className="text-primary cursor-pointer"
          onClick={onSwitchToForgotPassword}
        >
          忘记密码？
        </span>
      </div>

      {/* 自动登录 */}
      <div className="flex items-center space-x-2 w-[320px]">
        <Checkbox
          id="autoLogin"
          checked={form.watch('autoLogin')}
          onCheckedChange={(checked) => {
            const nextAutoLogin = Boolean(checked);
            form.setValue('autoLogin', nextAutoLogin);
            if (nextAutoLogin) {
              form.setValue('remember', true);
            }
          }}
          disabled={isLoading}
        />
        <Label htmlFor="autoLogin" className="text-sm cursor-pointer">
          自动登录
        </Label>
      </div>

      {/* 提交按钮 */}
      <Button
        type="submit"
        className="h-12 w-[320px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            登录中...
          </>
        ) : (
          '登录'
        )}
      </Button>

      {/* 底部链接 */}
      <div className="text-center text-sm text-muted-foreground">
        还没有账号？
        <span
          className="text-primary cursor-pointer ml-1"
          onClick={onSwitchToRegister}
        >
          立即注册
        </span>
        <span className="mx-2">·</span>
        <span
          className="text-primary cursor-pointer"
          onClick={onSwitchToCodeLogin}
        >
          验证码登录
        </span>
      </div>
    </form>
  );
}
