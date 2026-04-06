import { useEffect } from 'react';
import * as React from 'react';

export type ConversationContextMenuProps = {
  x: number;
  y: number;
  conversationId: string;
  isPinned: boolean;
  isMuted: boolean;
  onPin: (id: string) => void;
  onMute: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyId: (id: string) => void;
  onClose: () => void;
};

export function ConversationContextMenu(props: ConversationContextMenuProps): JSX.Element {
  useEffect(() => {
    const handleClick = (): void => props.onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [props.onClose]);

  return (
    <div
      className="conversation-context-menu"
      style={{ left: props.x, top: props.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => props.onPin(props.conversationId)}>
        📌 {props.isPinned ? '取消置顶' : '置顶会话'}
      </button>
      <button onClick={() => props.onMute(props.conversationId)}>
        🔇 {props.isMuted ? '取消静音' : '静音会话'}
      </button>
      <button onClick={() => props.onDelete(props.conversationId)}>
        🗑 删除会话
      </button>
      <button onClick={() => props.onCopyId(props.conversationId)}>
        📋 复制ID
      </button>
    </div>
  );
}
