import { FormEvent } from 'react';

type Props = {
  mode: 'login' | 'register' | 'code' | 'forgot-password';
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
  /** 是否记住密码 */
  rememberPassword: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  onModeChange: (value: 'login' | 'register' | 'code' | 'forgot-password') => void;
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

  return (
    <main className="auth-container">
      {/* 左侧品牌区域 - 按照设计稿 */}
      <aside className="auth-brand-side">
        {/* 渐变覆盖层 */}
        <div className="auth-brand-gradient-overlay"></div>
        {/* 装饰椭圆 */}
        <div className="auth-brand-ellipse-1"></div>
        <div className="auth-brand-ellipse-2"></div>
        <div className="auth-brand-ellipse-3"></div>

        {/* 品牌内容 - 设计稿只有文字 */}
        <div className="auth-brand-content">
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
                <h2 className="auth-form-title">欢迎回来</h2>
                <p className="auth-form-subtitle">登录您的账号</p>

                {/* 用户名/ID 输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.account}
                    onChange={(e) => props.onAccountChange(e.target.value.slice(0, 50))}
                    placeholder="用户名 / ID"
                    name="username"
                    autoComplete="username"
                    className="auth-input"
                    maxLength={50}
                  />
                </div>

                {/* 密码输入框 */}
                <div className="auth-input-wrapper">
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

                {/* 记住密码 + 忘记密码 */}
                <div className="auth-checkbox-row">
                  <div className="auth-checkbox-group">
                    <input
                      type="checkbox"
                      id="rememberPassword"
                      className="auth-checkbox"
                      checked={props.rememberPassword}
                      onChange={(e) => props.onRememberPasswordChange(e.target.checked)}
                    />
                    <label htmlFor="rememberPassword" className="auth-checkbox-label">记住密码</label>
                  </div>
                  <button type="button" className="auth-link" onClick={() => props.onModeChange('forgot-password')}>忘记密码？</button>
                </div>

                {/* 自动登录 */}
                <div className="auth-checkbox-row">
                  <div className="auth-checkbox-group">
                    <input
                      type="checkbox"
                      id="autoLogin"
                      className="auth-checkbox"
                      checked={props.autoLogin}
                      onChange={(e) => props.onAutoLoginChange(e.target.checked)}
                    />
                    <label htmlFor="autoLogin" className="auth-checkbox-label">自动登录</label>
                  </div>
                </div>

                {/* 登录按钮 */}
                <button type="submit" className="auth-button" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      登录中...
                    </>
                  ) : '登录'}
                </button>

                {/* 还没有账号？立即注册 */}
                <div className="auth-footer-row">
                  <span className="auth-text">还没有账号？</span>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => props.onModeChange('register')}
                  >
                    立即注册
                  </button>
                </div>
              </form>
            )}

            {/* 验证码登录表单 */}
            {isCode && (
              <form onSubmit={props.onLoginWithCode} className="auth-form">
                <h2 className="auth-form-title">验证登录</h2>
                <p className="auth-form-subtitle">登录您的账号</p>

                <div className="auth-input-wrapper">
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
                <div className="auth-input-wrapper">
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
                <button type="submit" className="auth-button" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      验证中...
                    </>
                  ) : '验证登录'}
                </button>
                <div className="auth-footer-row">
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => props.onModeChange('login')}
                  >
                    使用密码登录
                  </button>
                </div>
              </form>
            )}

            {/* 注册表单 */}
            {isRegister && (
              <form onSubmit={props.onRegister} className="auth-register-form">
                <h2 className="auth-form-title">创建账号</h2>
                <p className="auth-form-subtitle">注册以开始安全通讯</p>

                {/* 用户名输入框 */}
                <div className="auth-input-wrapper">
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

                {/* 邮箱输入框 */}
                <div className="auth-input-wrapper">
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

                {/* 密码输入框 */}
                <div className="auth-input-wrapper">
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
                  {/* 密码强度提示 tooltip */}
                  <span className="auth-input-tooltip" data-title="密码至少8位，必须包含数字和字母" tabIndex={0}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </span>
                </div>

                {/* 确认密码输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    placeholder="确认密码"
                    type="password"
                    name="confirm-password"
                    autoComplete="new-password"
                    className="auth-input"
                    maxLength={64}
                  />
                </div>

                {/* 注册按钮 */}
                <button type="submit" className="auth-button" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      注册中...
                    </>
                  ) : '注册'}
                </button>

                {/* 已有账号？立即登录 */}
                <div className="auth-footer-row">
                  <span className="auth-text">已有账号？</span>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => props.onModeChange('login')}
                  >
                    立即登录
                  </button>
                </div>
              </form>
            )}

            {/* 忘记密码表单 */}
            {isForgotPassword && !props.forgotCodeSent && (
              <form onSubmit={props.onSendForgotCode} className="auth-form">
                <h2 className="auth-form-title">重置密码</h2>
                <p className="auth-form-subtitle">输入您注册的邮箱地址</p>

                {/* 邮箱输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.forgotEmail}
                    onChange={(e) => props.onForgotEmailChange(e.target.value.slice(0, 100))}
                    placeholder="邮箱地址"
                    type="email"
                    name="forgot-email"
                    autoComplete="email"
                    className="auth-input"
                    maxLength={100}
                  />
                </div>

                {/* 发送按钮 */}
                <button
                  type="submit"
                  className="auth-button"
                  disabled={props.authSubmitting || props.forgotCooldown > 0}
                >
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      发送中...
                    </>
                  ) : props.forgotCooldown > 0 ? `${props.forgotCooldown}秒后可重发` : '发送验证码'}
                </button>

                {/* 返回登录 */}
                <div className="auth-footer-row">
                  <span className="auth-text">想起密码了？</span>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => props.onModeChange('login')}
                  >
                    立即登录
                  </button>
                </div>
              </form>
            )}

            {/* 忘记密码 - 输入验证码和新密码 */}
            {isForgotPassword && props.forgotCodeSent && (
              <form onSubmit={props.onResetPassword} className="auth-form">
                <h2 className="auth-form-title">重置密码</h2>
                <p className="auth-form-subtitle">请输入收到的验证码</p>

                {/* 邮箱（只读） */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.forgotEmail}
                    placeholder="邮箱地址"
                    type="email"
                    name="forgot-email-display"
                    autoComplete="email"
                    className="auth-input auth-input-disabled"
                    maxLength={100}
                    disabled
                  />
                </div>

                {/* 验证码输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.forgotCode}
                    onChange={(e) => props.onForgotCodeChange(e.target.value.slice(0, 6))}
                    placeholder="6位验证码"
                    type="text"
                    name="forgot-code"
                    autoComplete="one-time-code"
                    className="auth-input"
                    maxLength={6}
                  />
                </div>

                {/* 新密码输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.forgotPassword}
                    onChange={(e) => props.onForgotPasswordChange(e.target.value.slice(0, 64))}
                    placeholder="新密码"
                    type="password"
                    name="forgot-new-password"
                    autoComplete="new-password"
                    className="auth-input"
                    maxLength={64}
                  />
                  {/* 密码强度提示 tooltip */}
                  <span className="auth-input-tooltip" data-title="密码至少8位，必须包含数字和字母" tabIndex={0}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </span>
                </div>

                {/* 确认密码输入框 */}
                <div className="auth-input-wrapper">
                  <input
                    value={props.forgotConfirmPassword}
                    onChange={(e) => props.onForgotConfirmPasswordChange(e.target.value.slice(0, 64))}
                    placeholder="确认密码"
                    type="password"
                    name="forgot-confirm-password"
                    autoComplete="new-password"
                    className="auth-input"
                    maxLength={64}
                  />
                </div>

                {/* 重置按钮 */}
                <button type="submit" className="auth-button" disabled={props.authSubmitting}>
                  {props.authSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      重置中...
                    </>
                  ) : '重置密码'}
                </button>

                {/* 返回登录 */}
                <div className="auth-footer-row">
                  <span className="auth-text">想起密码了？</span>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => {
                      props.onModeChange('login');
                    }}
                  >
                    立即登录
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
