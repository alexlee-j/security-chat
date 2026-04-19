/**
 * 会话侧边栏组件
 * 设计规范：2026-04-07-ui-redesign.md
 */
import { FormEvent, useMemo, useState } from 'react';
import * as React from 'react';
import { ConversationListItem } from '../../core/types';
import { ConversationContextMenu } from './conversation-context-menu';
import { FabMenu } from './fab-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  userId: string;
  peerUserId: string;
  creatingDirect: boolean;
  conversations: ConversationListItem[];
  decodePayload: (payload: string) => string;
  messageDrafts: Record<string, string>;
  pinnedConversationIds: string[];
  mutedConversationIds: string[];
  unreadTotal: number;
  activeConversationId: string;
  onPeerUserIdChange: (value: string) => void;
  onCreateDirect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onTogglePin: (conversationId: string) => void;
  onToggleMute: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => Promise<boolean>;
  onNavDrawerOpen?: () => void;
  onLogout?: () => void;
  onWorkspaceChange?: (workspace: 'chat' | 'friend') => void;
  currentUserId?: string;
  onNewGroup?: () => void;
  onNewChat?: () => void;
};

function getDisplayName(row: ConversationListItem): string {
  return row.peerUser?.username ?? row.conversationId.slice(0, 8);
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

// 根据用户名生成头像渐变色索引
function getAvatarColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 5;
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const isYesterday = now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
  if (isYesterday) {
    return '昨天';
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function lastMessagePreview(row: ConversationListItem): string {
  if (!row.lastMessage) {
    return '暂无消息';
  }
  if (row.lastMessage.messageType === 2) {
    return '[图片]';
  }
  if (row.lastMessage.messageType === 3) {
    return '[语音]';
  }
  if (row.lastMessage.messageType === 4) {
    return '[文件]';
  }
  return '[文本]';
}

export function ConversationSidebar(props: Props): JSX.Element {
  const [keyword, setKeyword] = useState('');
  const pinnedSet = useMemo(() => new Set(props.pinnedConversationIds), [props.pinnedConversationIds]);

  const mutedSet = useMemo(() => new Set(props.mutedConversationIds), [props.mutedConversationIds]);
  const filteredConversations = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const matched = props.conversations.filter((row) => {
      if (!normalizedKeyword) {
        return true;
      }
      const displayName = getDisplayName(row).toLowerCase();
      const conversationId = row.conversationId.toLowerCase();
      const preview = row.lastMessage ? `${row.lastMessage.messageIndex} ${row.lastMessage.senderId}`.toLowerCase() : '';
      return displayName.includes(normalizedKeyword) || conversationId.includes(normalizedKeyword) || preview.includes(normalizedKeyword);
    });
    const sorted = [...matched].sort((a, b) => {
      const aPinned = pinnedSet.has(a.conversationId) ? 1 : 0;
      const bPinned = pinnedSet.has(b.conversationId) ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      const timeA = a.lastMessage?.createdAt ? Date.parse(a.lastMessage.createdAt) : 0;
      const timeB = b.lastMessage?.createdAt ? Date.parse(b.lastMessage.createdAt) : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.unreadCount - a.unreadCount;
    });
    return sorted;
  }, [props.conversations, keyword, pinnedSet]);

  async function onCopyConversationId(conversationId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(conversationId);
    } catch {
      // Ignore clipboard failures (system-level permissions etc).
    }
  }

  function onMenuTogglePin(conversationId: string): void {
    props.onTogglePin(conversationId);
  }

  function onMenuToggleMute(conversationId: string): void {
    props.onToggleMute(conversationId);
  }

  async function onMenuDeleteConversation(conversationId: string): Promise<void> {
    const confirmed = window.confirm('确定要删除该会话吗？此操作会移除当前会话记录。');
    if (!confirmed) {
      return;
    }
    const success = await props.onDeleteConversation(conversationId);
    if (!success) {
      console.error('[conversation-sidebar] 删除会话失败');
    }
  }

  function renderConversationRow(row: ConversationListItem): JSX.Element {
    const displayName = getDisplayName(row);
    const isActive = row.conversationId === props.activeConversationId;
    const isPinned = pinnedSet.has(row.conversationId);
    const isMuted = mutedSet.has(row.conversationId);
    const draft = props.messageDrafts[row.conversationId]?.trim() ?? '';
    // Metadata-first preview policy: conversation list relies on message type only.
    // Ciphertext-dependent preview text is intentionally not decoded here.
    const previewBase = row.lastMessage ? lastMessagePreview(row) : '暂无消息';
    const previewText = draft
      ? `草稿: ${draft.length > 24 ? `${draft.slice(0, 24)}...` : draft}`
      : previewBase.length > 28
        ? `${previewBase.slice(0, 28)}...`
        : previewBase;

    return (
      <ConversationContextMenu
        key={row.conversationId}
        conversationId={row.conversationId}
        isPinned={isPinned}
        isMuted={isMuted}
        onPin={onMenuTogglePin}
        onMute={onMenuToggleMute}
        onDelete={onMenuDeleteConversation}
        onCopyId={onCopyConversationId}
      >
        <div
          className={cn(
            'conversation-card flex items-center gap-3 p-3 h-[72px] rounded-xl cursor-pointer',
            'transition-colors duration-150',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-card hover:bg-accent text-foreground'
          )}
          onClick={() => props.onSelectConversation(row.conversationId)}
          role="button"
          tabIndex={0}
        >
        {/* 头像 */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback
              className="text-sm font-semibold"
              style={isActive
                ? { background: 'white', color: 'var(--primary)' }
                : { background: `var(--avatar-gradient-${(getAvatarColorIndex(displayName) % 5) + 1}` }
              }
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {/* 在线状态点 */}
          {row.peerUser?.isOnline && !isActive && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
          )}
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn(
              'font-semibold text-sm truncate',
              isActive ? 'text-primary-foreground' : 'text-foreground'
            )}>
              {displayName}
            </span>
            <span className={cn(
              'text-xs shrink-0',
              isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {formatTime(row.lastMessage?.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'text-xs truncate',
              draft ? 'text-primary font-medium' : '',
              isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {previewText}
            </span>
          </div>
        </div>

        {/* 右侧元素 */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* 静音标签 */}
          {isMuted && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              isActive ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              静音
            </span>
          )}
          {/* 置顶标识 */}
          {isPinned && !isMuted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-accent text-primary">
              置顶
            </span>
          )}
          {/* 未读数 */}
          {!isMuted && row.unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                'h-5 min-w-5 px-1.5 rounded-full text-xs font-bold',
                isActive && 'bg-primary-foreground text-primary'
              )}
            >
              {row.unreadCount > 99 ? '99+' : row.unreadCount}
            </Badge>
          )}
          {(!isMuted && row.unreadCount === 0) || isMuted ? (
            <span className="w-5 h-5" />
          ) : null}
        </div>
        </div>
      </ConversationContextMenu>
    );
  }

  return (
    <aside className="sidebar flex flex-col w-[280px] min-w-[280px] h-screen bg-sidebar-background">
      {/* 顶部工具栏 */}
      <header className="h-16 px-3 flex items-center gap-3 bg-sidebar-background">
        {/* 汉堡菜单按钮 */}
        <button
          type="button"
          className="nav-menu-btn flex items-center justify-center w-9 h-9 rounded-full border-none bg-transparent cursor-pointer transition-all duration-150 hover:bg-accent"
          aria-label="菜单"
          onClick={() => props.onNavDrawerOpen?.()}
        >
          <span className="material-symbols-rounded text-2xl text-muted-foreground">menu</span>
        </button>

        {/* 搜索框 */}
        <div className="search-shell flex-1 flex items-center gap-2 bg-search-bg rounded-2xl px-3 h-8">
          <span className="material-symbols-rounded text-lg text-muted-foreground shrink-0">search</span>
          <input
            className="sidebar-search-input flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索"
          />
          {keyword ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-muted-foreground hover:bg-accent"
              onClick={() => setKeyword('')}
              aria-label="清空搜索"
            >
              <span className="material-symbols-rounded text-base">close</span>
            </Button>
          ) : null}
        </div>
      </header>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 h-32 text-muted-foreground text-sm text-center px-4">
            <span>暂无会话</span>
            <span className="text-xs">
              {keyword ? '尝试清空搜索条件或切换到新的联系人。' : '通过右下角 FAB 新建群聊或发起私聊。'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredConversations.map((row) => renderConversationRow(row))}
          </div>
        )}
      </div>

      {/* FAB 菜单 */}
      <FabMenu
        onNewGroup={() => props.onNewGroup?.()}
        onNewChat={() => {
          props.onPeerUserIdChange('');
          props.onWorkspaceChange?.('friend');
        }}
      />
    </aside>
  );
}
