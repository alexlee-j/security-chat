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
  onModeChange: (value: 'login' | 'register' | 'code') => void;
  onAccountChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onLoginCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
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
      <div className="auth-background">
        <div className="auth-pattern"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-inner">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          <h1 className="auth-title">Security Chat</h1>
          <p className="auth-subtitle">安全、私密的通讯平台</p>
        </div>

        <div className="auth-form-container">
          {/* 登录表单 */}
          {isLogin && (
            <form onSubmit={props.onLogin} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-form-label">账号</label>
                <input
                  value={props.account}
                  onChange={(e) => props.onAccountChange(e.target.value.slice(0, 50))}
                  placeholder="请输入用户名"
                  name="username"
                  autoComplete="username"
                  className="auth-input"
                  maxLength={50}
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-form-label">密码</label>
                <input
                  value={props.password}
                  onChange={(e) => props.onPasswordChange(e.target.value.slice(0, 64))}
                  placeholder="请输入密码"
                  type="password"
                  name="current-password"
                  autoComplete="current-password"
                  className="auth-input"
                  maxLength={64}
                />
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
                    立即注册
                  </button>
                </p>
                <p>
                  <button 
                    type="button" 
                    className="auth-link" 
                    onClick={() => props.onModeChange('code')}
                  >
                    使用验证码登录
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 验证码登录表单 */}
          {isCode && (
            <form onSubmit={props.onLoginWithCode} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-form-label">账号或邮箱</label>
                <input
                  value={props.account}
                  onChange={(e) => props.onAccountChange(e.target.value.slice(0, 100))}
                  placeholder="请输入账号或邮箱"
                  name="username"
                  autoComplete="username email"
                  className="auth-input"
                  maxLength={100}
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-form-label">验证码</label>
                <div className="auth-code-input-group">
                  <input
                    value={props.loginCode}
                    onChange={(e) => props.onLoginCodeChange(e.target.value.slice(0, 6).replace(/\D/g, ''))}
                    placeholder="请输入验证码"
                    name="code"
                    autoComplete="one-time-code"
                    className="auth-input auth-code-input"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <button 
                    type="button" 
                    className="auth-code-button"
                    disabled={props.sendingLoginCode || props.loginCodeCooldown > 0}
                    onClick={props.onSendLoginCode}
                  >
                    {props.sendingLoginCode ? (
                      <>
                        <span className="auth-spinner small"></span>
                        发送中...
                      </>
                    ) : props.loginCodeCooldown > 0 ? (
                      `${props.loginCodeCooldown}s后重发`
                    ) : '发送验证码'}
                  </button>
                </div>
                {props.codeHint && <p className="auth-code-hint">{props.codeHint}</p>}
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
                    立即注册
                  </button>
                </p>
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
              <div className="auth-form-group">
                <label className="auth-form-label">账号</label>
                <input
                  value={props.account}
                  onChange={(e) => props.onAccountChange(e.target.value.slice(0, 50))}
                  placeholder="请设置用户名"
                  name="username"
                  autoComplete="username"
                  className="auth-input"
                  maxLength={50}
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-form-label">邮箱</label>
                <input
                  value={props.registerEmail}
                  onChange={(e) => props.onRegisterEmailChange(e.target.value.slice(0, 100))}
                  placeholder="请输入邮箱地址"
                  name="email"
                  autoComplete="email"
                  className="auth-input"
                  maxLength={100}
                  type="email"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-form-label">密码</label>
                <input
                  value={props.password}
                  onChange={(e) => props.onPasswordChange(e.target.value.slice(0, 64))}
                  placeholder="请设置密码"
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  className="auth-input"
                  maxLength={64}
                />
              </div>
              <button type="submit" className="auth-button primary" disabled={props.authSubmitting}>
                {props.authSubmitting ? (
                  <>
                    <span className="auth-spinner"></span>
                    注册中...
                  </>
                ) : '注册并登录'}
              </button>
              <div className="auth-footer">
                <p>已有账号？
                  <button 
                    type="button" 
                    className="auth-link" 
                    onClick={() => props.onModeChange('login')}
                  >
                    立即登录
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
