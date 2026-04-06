/**
 * 文件名：chat-more-menu.tsx
 * 所属模块：桌面端-聊天更多菜单
 * 核心作用：提供会话的阅后即焚、置顶、静音、群聊管理等操作菜单
 * 创建时间：2026-04-06
 */

import * as React from 'react';

export type ChatMoreMenuProps = {
  type: 'chat' | 'group';
  burnEnabled: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onToggleBurn: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onDeleteConversation?: () => void;
  onStartGroupChat?: () => void;   // 私聊
  onExitGroup?: () => void;         // 群聊
  onAddMember?: () => void;          // 群聊
  onClose: () => void;
};

export function ChatMoreMenu(props: ChatMoreMenuProps): JSX.Element {
  return (
    <div className="chat-more-menu">
      <button onClick={props.onToggleBurn}>
        🔥 {props.burnEnabled ? '关闭阅后即焚' : '开启阅后即焚'}
      </button>
      <button onClick={props.onTogglePin}>
        📌 {props.isPinned ? '取消置顶' : '置顶聊天'}
      </button>
      <button onClick={props.onToggleMute}>
        🔇 {props.isMuted ? '取消静音' : '静音'}
      </button>
      {props.type === 'chat' ? (
        <button onClick={props.onStartGroupChat}>
          👥 发起群聊
        </button>
      ) : (
        <>
          <button onClick={props.onAddMember}>👤 添加新成员</button>
          <button onClick={props.onExitGroup} className="danger">🚪 退出群聊</button>
        </>
      )}
      {props.type === 'chat' && (
        <button onClick={props.onDeleteConversation} className="danger">🗑 删除该会话</button>
      )}
    </div>
  );
}
