import { FormEvent } from 'react';

type Props = {
  mode: 'login' | 'register' | 'code';
  account: string;
  registerEmail: string;
  loginCode: string;
  codeHint: string;
  password: string;
  authSubmitting: boolean;
  sendingLoginCode: boolean;
  loginCodeCooldown: number;
  /** 是否记住密码 */
  rememberPassword: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  onModeChange: (value: 'login' | 'register' | 'code') => void;
  onAccountChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onLoginCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberPasswordChange: (value: boolean) => void;
  onAutoLoginChange: (value: boolean) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendLoginCode: () => Promise<void>;
  onLoginWithCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function LoginScreen(props: Props): JSX.Element {
  const isLogin = props.mode === 'login';
  const isRegister = props.mode === 'register';
  const isCode = props.mode === 'code';

  return (
    <main className="auth-container">
      {/* 左侧品牌区域 */}
      <aside className="auth-brand-side">
        <div className="auth-brand-pattern"></div>
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="auth-brand-title">Security Chat</h1>
          <p className="auth-brand-subtitle">安全至上，畅聊无忧</p>
        </div>
      </aside>

      {/* 右侧表单区域 */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-form-container">
            {/* 登录表单 */}
            {isLogin && (
              <form onSubmit={props.onLogin} className="auth-form">
                <div className="auth-header-back">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
                  </svg>
                </div>
                <h2 className="auth-form-title">登录</h2>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.account}
                      onChange={(e) => props.onAccountChange(e.target.value.slice(0, 50))}
                      placeholder="手机号或邮箱"
                      name="username"
                      autoComplete="username"
                      className="auth-input"
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.password}
                      onChange={(e) => props.onPasswordChange(e.target.value.slice(0, 64))}
                      placeholder="密码"
                      type="password"
                      name="current-password"
                      autoComplete="current-password"
                      className="auth-input"
                      maxLength={64}
                    />
                  </div>
                </div>
                <button type="submit" className="auth-button primary" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      登录中...
                    </>
                  ) : '登录'}
                </button>
                <div className="auth-footer">
                  <p>还没有账号？
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => props.onModeChange('register')}
                    >
                      注册
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* 验证码登录表单 */}
            {isCode && (
              <form onSubmit={props.onLoginWithCode} className="auth-form">
                <h2 className="auth-form-title">验证登录</h2>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.account}
                      onChange={(e) => props.onAccountChange(e.target.value.slice(0, 100))}
                      placeholder="手机号或邮箱"
                      name="username"
                      autoComplete="username email"
                      className="auth-input"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.loginCode}
                      onChange={(e) => props.onLoginCodeChange(e.target.value.slice(0, 6).replace(/\D/g, ''))}
                      placeholder="验证码"
                      name="code"
                      autoComplete="one-time-code"
                      className="auth-input"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <button type="submit" className="auth-button primary" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      验证中...
                    </>
                  ) : '验证登录'}
                </button>
                <div className="auth-footer">
                  <p>
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => props.onModeChange('login')}
                    >
                      使用密码登录
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* 注册表单 */}
            {isRegister && (
              <form onSubmit={props.onRegister} className="auth-form">
                <div className="auth-header-back">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
                  </svg>
                </div>
                <h2 className="auth-form-title">注册</h2>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.account}
                      onChange={(e) => props.onAccountChange(e.target.value.slice(0, 50))}
                      placeholder="用户名"
                      name="username"
                      autoComplete="username"
                      className="auth-input"
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.registerEmail}
                      onChange={(e) => props.onRegisterEmailChange(e.target.value.slice(0, 100))}
                      placeholder="邮箱"
                      name="email"
                      autoComplete="email"
                      className="auth-input"
                      maxLength={100}
                      type="email"
                    />
                  </div>
                </div>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
                    </svg>
                    <input
                      value={props.password}
                      onChange={(e) => props.onPasswordChange(e.target.value.slice(0, 64))}
                      placeholder="密码"
                      type="password"
                      name="new-password"
                      autoComplete="new-password"
                      className="auth-input"
                      maxLength={64}
                    />
                  </div>
                </div>
                <div className="auth-form-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
                    </svg>
                    <input
                      placeholder="确认密码"
                      type="password"
                      name="confirm-password"
                      autoComplete="new-password"
                      className="auth-input"
                      maxLength={64}
                    />
                  </div>
                </div>
                <button type="submit" className="auth-button primary" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      注册中...
                    </>
                  ) : '注册'}
                </button>
                <div className="auth-footer">
                  <p>已有账号？
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => props.onModeChange('login')}
                    >
                      登录
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
