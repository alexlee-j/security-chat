/**
 * 文件名：top-bar.tsx
 * 所属模块：桌面端-聊天顶部栏
 * 核心作用：显示当前会话的头像、名称、状态/成员数，以及搜索、更多操作等按钮
 * 创建时间：2026-04-06
 */

import * as React from 'react';

export type TopBarProps = {
  type: 'chat' | 'group';
  avatar: string;
  name: string;
  status?: string;
  memberCount?: number;
  onSearch: () => void;
  onMore: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
};

export function TopBar(props: TopBarProps): JSX.Element {
  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <div className="chat-avatar">
          {props.avatar}
          {props.type === 'chat' && <span className="status-dot" />}
        </div>
        <div className="chat-info">
          <h3>{props.name}</h3>
          <p>
            {props.type === 'chat'
              ? props.status || '在线'
              : `${props.memberCount} 位成员`}
          </p>
        </div>
      </div>
      <div className="chat-header-actions">
        {props.type === 'group' && (
          <>
            <button className="icon-btn disabled" disabled>📹</button>
            <button className="icon-btn disabled" disabled>📞</button>
          </>
        )}
        <button className="icon-btn" onClick={props.onSearch}>🔍</button>
        <button className="icon-btn" onClick={props.onMore}>⋮</button>
      </div>
    </header>
  );
}
