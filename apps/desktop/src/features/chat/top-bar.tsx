/**
 * 文件名：top-bar.tsx
 * 所属模块：桌面端-聊天顶部栏
 * 核心作用：显示当前会话的头像、名称、状态/成员数，以及搜索、更多操作等按钮
 * 创建时间：2026-04-06
 * 更新说明：2026-04-11 按照 Figma 设计稿重构，使用 Material Symbols 图标
 */

import * as React from 'react';

export type TopBarProps = {
  type: 'chat' | 'group';
  avatar: string;
  name: string;
  status?: string;
  memberCount?: number;
  isOnline?: boolean;
  voiceCallEnabled?: boolean;
  onVoiceCall?: () => void;
  onSearch: () => void;
  moreMenu: React.ReactNode;
};

export function TopBar(props: TopBarProps): JSX.Element {
  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <div className="chat-avatar">
          <span className="chat-avatar-text">{props.avatar}</span>
          {props.type === 'chat' && props.isOnline && <span className="chat-avatar-status" />}
        </div>
        <div className="chat-info">
          <h3 className="chat-name">{props.name}</h3>
          <p className={props.type === 'chat' && !props.isOnline ? 'chat-status-text offline' : 'chat-status-text'}>
            {props.type === 'chat'
              ? props.isOnline ? '在线' : '离线'
              : `${props.memberCount} 位成员`}
          </p>
        </div>
      </div>
      <div className="chat-header-actions">
        <button className="chat-action-btn" aria-label="搜索" onClick={props.onSearch}>
          <span className="material-symbols-rounded">search</span>
        </button>
        {props.type === 'chat' && (
          <>
            <button
              className="chat-action-btn"
              aria-label={props.voiceCallEnabled ? '语音通话' : '语音通话暂不可用'}
              title={props.voiceCallEnabled ? '发起语音通话' : '仅私聊支持语音通话'}
              disabled={!props.voiceCallEnabled}
              onClick={props.onVoiceCall}
            >
              <span className="material-symbols-rounded">call</span>
            </button>
          </>
        )}
        {props.moreMenu}
      </div>
    </header>
  );
}
