/**
 * 文件名：chat-more-menu.tsx
 * 所属模块：桌面端-聊天面板
 * 核心作用：提供会话的阅后即焚、置顶、静音、群聊管理等操作菜单
 * 重构说明：使用共享 DropdownMenu primitives 替换自定义 div 实现
 */

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ChatMoreMenuProps = {
  type: 'chat' | 'group';
  burnEnabled: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onToggleBurn: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onDeleteConversation?: () => void;
  onStartGroupChat?: () => void;
  onExitGroup?: () => void;
  onAddMember?: () => void;
  children: React.ReactNode;
};

export function ChatMoreMenu(props: ChatMoreMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {props.children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={props.onToggleBurn}>
          <span className="material-symbols-rounded mr-2">local_fire_department</span>
          {props.burnEnabled ? '关闭阅后即焚' : '开启阅后即焚'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={props.onTogglePin}>
          <span className="material-symbols-rounded mr-2">push_pin</span>
          {props.isPinned ? '取消本机置顶' : '本机置顶'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={props.onToggleMute}>
          <span className="material-symbols-rounded mr-2">volume_off</span>
          {props.isMuted ? '取消本机静音' : '本机静音'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {props.type === 'chat' ? (
          <DropdownMenuItem disabled>
            <span className="material-symbols-rounded mr-2">group</span>
            发起群聊暂未开放
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem disabled>
              <span className="material-symbols-rounded mr-2">person_add</span>
              添加成员请在群管理中操作
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              className="text-destructive focus:text-destructive"
            >
              <span className="material-symbols-rounded mr-2">exit_to_app</span>
              退出群聊请在群管理中操作
            </DropdownMenuItem>
          </>
        )}
        {props.type === 'chat' && props.onDeleteConversation && (
          <DropdownMenuSeparator />
        )}
        {props.type === 'chat' && props.onDeleteConversation && (
          <DropdownMenuItem
            onSelect={props.onDeleteConversation}
            className="text-destructive focus:text-destructive"
          >
            <span className="material-symbols-rounded mr-2">delete</span>
            删除该会话
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
