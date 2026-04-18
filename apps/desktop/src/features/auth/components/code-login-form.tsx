/**
 * 验证码登录表单组件
 * 设计稿：2026-04-07-auth-pages-design.md
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const codeLoginSchema = z.object({
  account: z.string().min(1, '请输入手机号或邮箱'),
  code: z.string().length(6, '验证码为6位'),
});

type CodeLoginFormData = z.infer<typeof codeLoginSchema>;

interface CodeLoginFormProps {
  defaultAccount?: string;
  isLoading: boolean;
  isSendingCode: boolean;
  cooldown: number;
  codeHint?: string;
  onSubmit: (values: CodeLoginFormData) => Promise<void>;
  onSendCode: (account: string) => Promise<void>;
  onSwitchToPasswordLogin: () => void;
}

export function CodeLoginForm({
  defaultAccount = '',
  isLoading,
  isSendingCode,
  cooldown,
  codeHint,
  onSubmit,
  onSendCode,
  onSwitchToPasswordLogin,
}: CodeLoginFormProps): JSX.Element {
  const form = useForm<CodeLoginFormData>({
    resolver: zodResolver(codeLoginSchema),
    defaultValues: {
      account: defaultAccount,
      code: '',
    },
  });

  const handleSubmit = async (values: CodeLoginFormData) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">验证登录</h1>
        <p className="text-sm text-muted-foreground">登录您的账号</p>
      </div>

      {/* 手机号/邮箱 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 w-[320px]">
          <Input
            {...form.register('account')}
            placeholder="手机号或邮箱"
            className="h-12 flex-1"
            autoComplete="username email"
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 px-3 shrink-0"
            disabled={isLoading || isSendingCode || cooldown > 0}
            onClick={() => void onSendCode(form.getValues('account'))}
          >
            {cooldown > 0 ? `${cooldown}s` : (isSendingCode ? '发送中' : '发送验证码')}
          </Button>
        </div>
        {codeHint ? (
          <p className="text-xs text-muted-foreground">{codeHint}</p>
        ) : null}
        {form.formState.errors.account && (
          <p className="text-xs text-destructive">{form.formState.errors.account.message}</p>
        )}
      </div>

      {/* 验证码 */}
      <div className="space-y-2">
        <Input
          {...form.register('code')}
          placeholder="验证码"
          className="h-12 w-[320px]"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          disabled={isLoading}
        />
        {form.formState.errors.code && (
          <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
        )}
      </div>

      {/* 验证按钮 */}
      <Button
        type="submit"
        className="h-12 w-[320px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold shadow-lg disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            验证中...
          </>
        ) : (
          '验证登录'
        )}
      </Button>

      {/* 底部链接 */}
      <div className="text-center">
        <Button
          type="button"
          variant="link"
          className="text-primary p-0 h-auto font-normal"
          onClick={onSwitchToPasswordLogin}
        >
          使用密码登录
        </Button>
      </div>
    </form>
  );
}
