/**
 * 注册表单组件
 * 设计稿：2026-04-07-auth-pages-design.md
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const registerSchema = z.object({
  username: z.string().min(3, '用户名至少3位').max(20, '用户名最多20位'),
  email: z.string().email('请输入有效邮箱'),
  password: z.string()
    .min(8, '密码至少8位')
    .regex(/[0-9]/, '密码必须包含数字')
    .regex(/[a-zA-Z]/, '密码必须包含字母'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  defaultAccount?: string;
  defaultEmail?: string;
  isLoading: boolean;
  onSubmit: (values: RegisterFormData) => Promise<void>;
  onSwitchToLogin: () => void;
}

export function RegisterForm({
  defaultAccount = '',
  defaultEmail = '',
  isLoading,
  onSubmit,
  onSwitchToLogin,
}: RegisterFormProps): JSX.Element {
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: defaultAccount,
      email: defaultEmail,
      password: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = async (values: RegisterFormData) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">创建账号</h1>
        <p className="text-sm text-muted-foreground">注册以开始安全通讯</p>
      </div>

      {/* 用户名 */}
      <div className="space-y-2">
        <Input
          {...form.register('username')}
          placeholder="用户名"
          className="h-12 w-[320px]"
          autoComplete="username"
          disabled={isLoading}
        />
        {form.formState.errors.username && (
          <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
        )}
      </div>

      {/* 邮箱 */}
      <div className="space-y-2">
        <Input
          {...form.register('email')}
          type="email"
          placeholder="邮箱"
          className="h-12 w-[320px]"
          autoComplete="email"
          disabled={isLoading}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      {/* 密码 */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            {...form.register('password')}
            type="password"
            placeholder="密码"
            className="h-12 w-[320px] pr-10"
            autoComplete="new-password"
            disabled={isLoading}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-help">
                  <Info className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p>密码至少8位，必须包含数字和字母</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      {/* 确认密码 */}
      <div className="space-y-2">
        <Input
          {...form.register('confirmPassword')}
          type="password"
          placeholder="确认密码"
          className="h-12 w-[320px]"
          autoComplete="new-password"
          disabled={isLoading}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      {/* 注册按钮 */}
      <Button
        type="submit"
        className="h-12 w-[320px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            注册中...
          </>
        ) : (
          '注册'
        )}
      </Button>

      {/* 底部链接 */}
      <div className="text-center text-sm text-muted-foreground">
        已有账号？
        <span
          className="text-primary cursor-pointer ml-1"
          onClick={onSwitchToLogin}
        >
          立即登录
        </span>
      </div>
    </form>
  );
}
