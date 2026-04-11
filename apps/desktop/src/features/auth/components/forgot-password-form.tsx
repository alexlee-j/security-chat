/**
 * 忘记密码表单组件 - Step 1 & Step 2
 * 设计稿：2026-04-07-auth-pages-design.md
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Step 1 schema
const step1Schema = z.object({
  email: z.string().email('请输入有效邮箱'),
});

type Step1FormData = z.infer<typeof step1Schema>;

// Step 2 schema
const step2Schema = z.object({
  code: z.string().length(6, '验证码为6位'),
  password: z.string()
    .min(8, '密码至少8位')
    .regex(/[0-9]/, '密码必须包含数字')
    .regex(/[a-zA-Z]/, '密码必须包含字母'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
});

type Step2FormData = z.infer<typeof step2Schema>;

interface ForgotPasswordFormProps {
  email: string;
  codeSent: boolean;
  cooldown: number;
  isLoading: boolean;
  onSendCode: (email: string) => Promise<void>;
  onResetPassword: (values: Step2FormData) => Promise<void>;
  onSwitchToLogin: () => void;
}

export function ForgotPasswordForm({
  email,
  codeSent,
  cooldown,
  isLoading,
  onSendCode,
  onResetPassword,
  onSwitchToLogin,
}: ForgotPasswordFormProps): JSX.Element {
  // Step 1: Send code form
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email },
  });

  // Step 2: Reset password form
  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  const handleSendCode = async (values: Step1FormData) => {
    await onSendCode(values.email);
  };

  const handleResetPassword = async (values: Step2FormData) => {
    await onResetPassword(values);
  };

  // Step 1: Send verification code
  if (!codeSent) {
    return (
      <form onSubmit={step1Form.handleSubmit(handleSendCode)} className="space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">重置密码</h1>
          <p className="text-sm text-muted-foreground">输入您注册的邮箱地址</p>
        </div>

        <div className="space-y-2">
          <Input
            {...step1Form.register('email')}
            type="email"
            placeholder="邮箱地址"
            className="h-12 w-[320px]"
            autoComplete="email"
            disabled={isLoading}
          />
          {step1Form.formState.errors.email && (
            <p className="text-xs text-destructive">{step1Form.formState.errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="h-12 w-[320px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
          disabled={isLoading || cooldown > 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              发送中...
            </>
          ) : cooldown > 0 ? (
            `${cooldown}秒后可重发`
          ) : (
            '发送验证码'
          )}
        </Button>

        <div className="text-center">
          <span
            className="text-primary cursor-pointer"
            onClick={onSwitchToLogin}
          >
            想起密码了？立即登录
          </span>
        </div>
      </form>
    );
  }

  // Step 2: Enter code and reset password
  return (
    <form onSubmit={step2Form.handleSubmit(handleResetPassword)} className="space-y-5">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">重置密码</h1>
        <p className="text-sm text-muted-foreground">请输入收到的验证码</p>
      </div>

      {/* Email (readonly) */}
      <div className="space-y-2">
        <Input
          value={email}
          type="email"
          placeholder="邮箱地址"
          className="h-12 w-[320px] opacity-50"
          autoComplete="email"
          disabled
        />
      </div>

      {/* Verification code */}
      <div className="space-y-2">
        <Input
          {...step2Form.register('code')}
          placeholder="6位验证码"
          className="h-12 w-[320px]"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={isLoading}
        />
        {step2Form.formState.errors.code && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.code.message}</p>
        )}
      </div>

      {/* New password */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            {...step2Form.register('password')}
            type="password"
            placeholder="新密码"
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
        {step2Form.formState.errors.password && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.password.message}</p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-2">
        <Input
          {...step2Form.register('confirmPassword')}
          type="password"
          placeholder="确认密码"
          className="h-12 w-[320px]"
          autoComplete="new-password"
          disabled={isLoading}
        />
        {step2Form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">{step2Form.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="h-12 w-[320px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            重置中...
          </>
        ) : (
          '重置密码'
        )}
      </Button>

      <div className="text-center">
        <Button
          type="button"
          variant="link"
          className="text-primary p-0 h-auto font-normal"
          onClick={onSwitchToLogin}
        >
          想起密码了？立即登录
        </Button>
      </div>
    </form>
  );
}
