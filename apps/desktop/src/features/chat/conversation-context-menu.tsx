/**
 * 文件名：conversation-context-menu.tsx
 * 所属模块：桌面端-会话列表
 * 核心作用：会话右键上下文菜单（置顶、静音、删除、复制ID）
 * 重构说明：使用共享 ContextMenu primitives 替换自定义 div 实现
 */

import * as React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export type ConversationContextMenuProps = {
  children: React.ReactNode;
  conversationId: string;
  isPinned: boolean;
  isMuted: boolean;
  onPin: (id: string) => void;
  onMute: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyId: (id: string) => void;
};

export function ConversationContextMenu(props: ConversationContextMenuProps): JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {props.children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => props.onPin(props.conversationId)}>
          <span className="mr-2">📌</span>
          {props.isPinned ? '取消本机置顶' : '本机置顶'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => props.onMute(props.conversationId)}>
          <span className="mr-2">🔇</span>
          {props.isMuted ? '取消本机静音' : '本机静音'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => props.onDelete(props.conversationId)}
          className="text-destructive focus:text-destructive"
        >
          <span className="mr-2">🗑</span>
          删除会话
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => props.onCopyId(props.conversationId)}>
          <span className="mr-2">📋</span>
          复制ID
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
