/**
 * 表单卡片组件 - 居中的表单容器
 * 设计稿：2026-04-07-auth-pages-design.md
 */
import type { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps): JSX.Element {
  return (
    <div className="auth-card w-[420px] rounded-3xl p-10 shadow-xl bg-card">
      {children}
    </div>
  );
}
