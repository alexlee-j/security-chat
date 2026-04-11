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
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendLoginCode: () => Promise<void>;
  onLoginWithCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
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
    // Update state to match expected values for old handler
    props.onAccountChange(values.username);
    props.onPasswordChange(values.password);
    props.onRememberPasswordChange(values.remember);
    props.onAutoLoginChange(values.autoLogin);
    // Create mock event for original handler
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onLogin(mockEvent);
  };

  // Wrapper for register form submit
  const handleRegister = async (values: RegisterFormData) => {
    props.onAccountChange(values.username);
    props.onRegisterEmailChange(values.email);
    props.onPasswordChange(values.password);
    props.onForgotConfirmPasswordChange(values.confirmPassword);
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onRegister(mockEvent);
  };

  // Wrapper for code login form submit
  const handleCodeLogin = async (values: CodeLoginFormData) => {
    props.onAccountChange(values.account);
    props.onLoginCodeChange(values.code);
    const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
    await props.onLoginWithCode(mockEvent);
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
            />
          )}

          {/* 验证码登录表单 */}
          {isCode && (
            <CodeLoginForm
              defaultAccount={props.account}
              isLoading={props.authSubmitting}
              onSubmit={handleCodeLogin}
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
