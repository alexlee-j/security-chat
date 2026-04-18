/**
 * 登录页面主组件
 * 设计稿：2026-04-07-auth-pages-design.md
 * 技术栈：shadcn/ui + Tailwind CSS + react-hook-form + zod
 */
import type { FormEvent } from 'react';
import { AuthBrand, AuthCard, LoginForm, RegisterForm, CodeLoginForm, ForgotPasswordForm } from './components';

type AuthMode = 'login' | 'register' | 'code' | 'forgot-password';

interface LoginFormData {
  username: string;
  password: string;
  remember: boolean;
  autoLogin: boolean;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface CodeLoginFormData {
  account: string;
  code: string;
}

interface ForgotPasswordStep2Data {
  code: string;
  password: string;
  confirmPassword: string;
}

type Props = {
  mode: AuthMode;
  account: string;
  registerEmail: string;
  forgotEmail: string;
  forgotCode: string;
  forgotPassword: string;
  forgotConfirmPassword: string;
  forgotCodeSent: boolean;
  forgotCooldown: number;
  loginCode: string;
  codeHint: string;
  password: string;
  authSubmitting: boolean;
  sendingLoginCode: boolean;
  loginCodeCooldown: number;
  rememberPassword: boolean;
  autoLogin: boolean;
  onModeChange: (value: AuthMode) => void;
  onAccountChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onForgotEmailChange: (value: string) => void;
  onForgotCodeChange: (value: string) => void;
  onForgotPasswordChange: (value: string) => void;
  onForgotConfirmPasswordChange: (value: string) => void;
  onLoginCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberPasswordChange: (value: boolean) => void;
  onAutoLoginChange: (value: boolean) => void;
  onLogin: (
    event: FormEvent<HTMLFormElement>,
    loginAccount?: string,
    loginPassword?: string,
    rememberOverride?: boolean,
    autoLoginOverride?: boolean,
  ) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
  onSendLoginCode: (accountOverride?: string) => Promise<void>;
  onLoginWithCode: (event: FormEvent<HTMLFormElement>, codeAccount?: string, codeValue?: string) => Promise<void>;
  onSendForgotCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function LoginScreen(props: Props): JSX.Element {
  const isLogin = props.mode === 'login';
  const isRegister = props.mode === 'register';
  const isCode = props.mode === 'code';
  const isForgotPassword = props.mode === 'forgot-password';

  // Wrapper for login form submit - convert form values to match old interface
  const handleLogin = async (values: LoginFormData) => {
    // 更新状态（用于 UI 同步）
    props.onAccountChange(values.username);
    props.onPasswordChange(values.password);
    props.onRememberPasswordChange(values.remember);
    props.onAutoLoginChange(values.autoLogin);
    // 直接传递账号密码给 onLogin，避免状态异步问题
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onLogin(mockEvent, values.username, values.password, values.remember, values.autoLogin);
  };

  // Wrapper for register form submit
  const handleRegister = async (values: RegisterFormData) => {
    // 同步调用 onRegister，直接传递表单值
    await props.onRegister(values.username, values.email, values.password);
  };

  // Wrapper for code login form submit
  const handleCodeLogin = async (values: CodeLoginFormData) => {
    props.onAccountChange(values.account);
    props.onLoginCodeChange(values.code);
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onLoginWithCode(mockEvent, values.account, values.code);
  };

  // Wrapper for forgot password step 2 submit
  const handleForgotPasswordStep2 = async (values: ForgotPasswordStep2Data) => {
    props.onForgotCodeChange(values.code);
    props.onForgotPasswordChange(values.password);
    props.onForgotConfirmPasswordChange(values.confirmPassword);
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onResetPassword(mockEvent);
  };

  // Wrapper for send forgot code - using step1 email
  const handleSendForgotCode = async (email: string) => {
    props.onForgotEmailChange(email);
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onSendForgotCode(mockEvent);
  };

  return (
    <main className="auth-container">
      {/* 左侧品牌区域 */}
      <AuthBrand />

      {/* 右侧表单区域 */}
      <div className="auth-form-side">
        <AuthCard>
          {/* 登录表单 */}
          {isLogin && (
            <LoginForm
              defaultUsername={props.account}
              defaultPassword={props.password}
              isLoading={props.authSubmitting}
              onSubmit={handleLogin}
              onSwitchToRegister={() => props.onModeChange('register')}
              onSwitchToForgotPassword={() => props.onModeChange('forgot-password')}
              onSwitchToCodeLogin={() => props.onModeChange('code')}
            />
          )}

          {/* 验证码登录表单 */}
          {isCode && (
            <CodeLoginForm
              defaultAccount={props.account}
              isLoading={props.authSubmitting}
              isSendingCode={props.sendingLoginCode}
              cooldown={props.loginCodeCooldown}
              codeHint={props.codeHint}
              onSubmit={handleCodeLogin}
              onSendCode={props.onSendLoginCode}
              onSwitchToPasswordLogin={() => props.onModeChange('login')}
            />
          )}

          {/* 注册表单 */}
          {isRegister && (
            <RegisterForm
              defaultAccount={props.account}
              defaultEmail={props.registerEmail}
              isLoading={props.authSubmitting}
              onSubmit={handleRegister}
              onSwitchToLogin={() => props.onModeChange('login')}
            />
          )}

          {/* 忘记密码表单 */}
          {isForgotPassword && (
            <ForgotPasswordForm
              email={props.forgotEmail}
              codeSent={props.forgotCodeSent}
              cooldown={props.forgotCooldown}
              isLoading={props.authSubmitting}
              onSendCode={handleSendForgotCode}
              onResetPassword={handleForgotPasswordStep2}
              onSwitchToLogin={() => props.onModeChange('login')}
            />
          )}
        </AuthCard>
      </div>
    </main>
  );
}
