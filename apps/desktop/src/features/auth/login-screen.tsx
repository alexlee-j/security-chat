import { FormEvent } from 'react';

type Props = {
  account: string;
  password: string;
  error: string;
  onAccountChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function LoginScreen(props: Props): JSX.Element {
  return (
    <main className="auth-shell">
      <section className="auth-card card">
        <div className="auth-head">
          <p className="kicker">Secure Workspace</p>
          <h1>Security Chat</h1>
          <p className="subtle">Desktop Console</p>
        </div>
        <form onSubmit={props.onSubmit} className="stack mt-lg">
          <input
            value={props.account}
            onChange={(e) => props.onAccountChange(e.target.value)}
            placeholder="账号"
            name="username"
            autoComplete="username"
          />
          <input
            value={props.password}
            onChange={(e) => props.onPasswordChange(e.target.value)}
            placeholder="密码"
            type="password"
            name="current-password"
            autoComplete="current-password"
          />
          <button type="submit">登录</button>
        </form>
        <p className="subtle mt-md">仅支持已注册账号，输入后直接登录。</p>
        {props.error ? <div className="error mt-md">{props.error}</div> : null}
      </section>
    </main>
  );
}
