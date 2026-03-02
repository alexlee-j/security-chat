import { FormEvent, useEffect, useRef } from 'react';

type Props = {
  mode: 'login' | 'register' | 'code';
  account: string;
  registerEmail: string;
  registerPhone: string;
  loginCode: string;
  codeHint: string;
  password: string;
  authSubmitting: boolean;
  sendingLoginCode: boolean;
  loginCodeCooldown: number;
  error: string;
  onModeChange: (value: 'login' | 'register' | 'code') => void;
  onAccountChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onRegisterPhoneChange: (value: string) => void;
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
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isCode) {
      return;
    }
    if (props.sendingLoginCode || !props.codeHint) {
      return;
    }
    codeInputRef.current?.focus();
    codeInputRef.current?.select();
  }, [isCode, props.sendingLoginCode, props.codeHint]);
  return (
    <main className="auth-shell">
      <section className="auth-card card">
        <div className="auth-head">
          <p className="kicker">Secure Workspace</p>
          <h1>Security Chat</h1>
          <p className="subtle">Desktop Console</p>
        </div>
        <div className="auth-mode-tabs mt-md">
          <button
            type="button"
            className={isLogin ? '' : 'ghost-btn'}
            onClick={() => props.onModeChange('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={isRegister ? '' : 'ghost-btn'}
            onClick={() => props.onModeChange('register')}
          >
            注册
          </button>
          <button
            type="button"
            className={isCode ? '' : 'ghost-btn'}
            onClick={() => props.onModeChange('code')}
          >
            验证码登录
          </button>
        </div>
        <form onSubmit={isRegister ? props.onRegister : isCode ? props.onLoginWithCode : props.onLogin} className="stack mt-lg">
          <input
            value={props.account}
            onChange={(e) => props.onAccountChange(e.target.value)}
            placeholder={isCode ? '用户名/邮箱/手机号' : '账号（用户名）'}
            name="username"
            autoComplete="username"
          />
          {isRegister ? (
            <>
              <input
                value={props.registerEmail}
                onChange={(e) => props.onRegisterEmailChange(e.target.value)}
                placeholder="邮箱"
                name="email"
                autoComplete="email"
              />
              <input
                value={props.registerPhone}
                onChange={(e) => props.onRegisterPhoneChange(e.target.value)}
                placeholder="手机号（+8613...）"
                name="tel"
                autoComplete="tel"
              />
            </>
          ) : null}
          {isCode ? (
            <div className="auth-code-row">
              <input
                ref={codeInputRef}
                value={props.loginCode}
                onChange={(e) => props.onLoginCodeChange(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder="6位验证码"
                inputMode="numeric"
                maxLength={6}
              />
              <button
                type="button"
                className="ghost-btn"
                disabled={props.sendingLoginCode || props.loginCodeCooldown > 0}
                onClick={() => void props.onSendLoginCode()}
              >
                {props.sendingLoginCode
                  ? '发送中...'
                  : props.loginCodeCooldown > 0
                    ? `${props.loginCodeCooldown}s`
                    : '发送验证码'}
              </button>
            </div>
          ) : (
            <input
              value={props.password}
              onChange={(e) => props.onPasswordChange(e.target.value)}
              placeholder="密码"
              type="password"
              name={isRegister ? 'new-password' : 'current-password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          )}
          <button type="submit" disabled={props.authSubmitting}>
            {props.authSubmitting ? '提交中...' : isRegister ? '注册并登录' : isCode ? '验证码登录' : '登录'}
          </button>
        </form>
        <p className="subtle mt-md">
          {isRegister
            ? '注册成功后将自动进入桌面端。'
            : isCode
              ? props.codeHint || '发送验证码后输入6位数字即可登录。'
              : '输入已注册账号后直接登录。'}
        </p>
        {props.error ? <div className="error mt-md">{props.error}</div> : null}
      </section>
    </main>
  );
}
