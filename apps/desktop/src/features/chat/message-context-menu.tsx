/**
 * 文件名：message-context-menu.tsx
 * 所属模块：桌面端-聊天面板
 * 核心作用：消息右键上下文菜单，提供复制、引用、转发、下载、删除等功能
 * 重构说明：使用共享 ContextMenu primitives 替换自定义 div 实现
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

type MessageContextMenuProps = {
  children: React.ReactNode;
  messageType: 1 | 2 | 3 | 4;
  isOwn: boolean;
  isRevoked: boolean;
  canCopy: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onDownload?: () => void;
  onDelete: () => void;
};

export function MessageContextMenu(props: MessageContextMenuProps): JSX.Element {
  const showDownload = [2, 4].includes(props.messageType) && !props.isRevoked;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {props.children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!props.isRevoked && (
          <>
            <ContextMenuItem onSelect={props.onCopy} disabled={!props.canCopy}>
              <span className="material-symbols-rounded mr-2">content_copy</span>
              {props.canCopy ? '复制' : '无可复制内容'}
            </ContextMenuItem>
            <ContextMenuItem onSelect={props.onReply}>
              <span className="material-symbols-rounded mr-2">format_quote</span>
              引用
            </ContextMenuItem>
            <ContextMenuItem onSelect={props.onForward}>
              <span className="material-symbols-rounded mr-2">send</span>
              转发
            </ContextMenuItem>
            {showDownload && (
              <ContextMenuItem onSelect={props.onDownload}>
                <span className="material-symbols-rounded mr-2">download</span>
                下载
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={props.onDelete}
              className="text-destructive focus:text-destructive"
            >
              <span className="material-symbols-rounded mr-2">delete</span>
              删除
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
