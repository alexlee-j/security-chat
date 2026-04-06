import { MouseEvent, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { ConversationListItem } from '../../core/types';

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
  onWorkspaceChange?: (workspace: 'chat' | 'friend') => void;
  onLogout?: () => void;
  currentUserId?: string;
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

function parsePayload(raw: string): { text?: string; fileName?: string } {
  try {
    const parsed = JSON.parse(raw) as { text?: string; fileName?: string };
    return parsed ?? {};
  } catch {
    return { text: raw };
  }
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
  const [menu, setMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
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

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = (): void => setMenu(null);
    const onEsc = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menu]);

  async function onCopyConversationId(conversationId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(conversationId);
    } catch {
      // Ignore clipboard failures (system-level permissions etc).
    }
    setMenu(null);
  }

  function onMenuTogglePin(conversationId: string): void {
    props.onTogglePin(conversationId);
    setMenu(null);
  }

  function onMenuToggleMute(conversationId: string): void {
    props.onToggleMute(conversationId);
    setMenu(null);
  }

  function openConversationMenu(event: MouseEvent<HTMLButtonElement>, conversationId: string): void {
    event.preventDefault();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      conversationId,
    });
  }

  function renderConversationRow(row: ConversationListItem): JSX.Element {
    const displayName = getDisplayName(row);
    const isPinned = pinnedSet.has(row.conversationId);
    const isMuted = mutedSet.has(row.conversationId);
    const draft = props.messageDrafts[row.conversationId]?.trim() ?? '';
    const decodedPayload = row.lastMessage?.encryptedPayload ? props.decodePayload(row.lastMessage.encryptedPayload) : '';
    const parsed = decodedPayload ? parsePayload(decodedPayload) : {};
    const textPreview = (parsed.text ?? parsed.fileName ?? '').trim();
    const previewBase = row.lastMessage ? `${lastMessagePreview(row)} ${textPreview}`.trim() : '暂无消息';
    const previewText = draft
      ? `草稿: ${draft.length > 24 ? `${draft.slice(0, 24)}...` : draft}`
      : previewBase.length > 28
        ? `${previewBase.slice(0, 28)}...`
        : previewBase;

    return (
      <button
        type="button"
        key={row.conversationId}
        className={row.conversationId === props.activeConversationId ? 'conversation active' : 'conversation'}
        onClick={() => props.onSelectConversation(row.conversationId)}
        onContextMenu={(event) => openConversationMenu(event, row.conversationId)}
      >
        <span className="avatar-wrapper">
          <span className="avatar" style={{ background: `var(--avatar-gradient-${(getAvatarColorIndex(displayName) % 5) + 1})` }}>{getInitials(displayName)}</span>
          {row.peerUser?.isOnline ? <span className="status-dot" /> : null}
        </span>
        <div className="conversation-main">
          <div className="conversation-row">
            <div className="conversation-title">
              {displayName}
              {isMuted ? <span className="conversation-muted-tag">静音</span> : null}
            </div>
            <small className="conversation-time">{formatTime(row.lastMessage?.createdAt)}</small>
          </div>
          <small className={draft ? 'conversation-meta conversation-meta-draft' : 'conversation-meta'}>
            {previewText}
          </small>
        </div>
        {isPinned ? <span className="conversation-flag">置顶</span> : null}
        {!isMuted && row.unreadCount > 0 ? (
          <span className="conversation-unread">{row.unreadCount}</span>
        ) : (
          <span className="conversation-unread-placeholder" />
        )}
      </button>
    );
  }

  return (
    <aside className="sidebar card telegram-sidebar">
      <header className="sidebar-toolbar">
        <div className="sidebar-nav-menu">
          <button
            type="button"
            className="nav-menu-btn"
            aria-label="菜单"
            onClick={() => props.onWorkspaceChange?.('friend')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div className="sidebar-search-shell">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M11 4a7 7 0 1 0 4.41 12.44l4.08 4.08 1.41-1.41-4.08-4.08A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
              fill="currentColor"
            />
          </svg>
          <input
            className="sidebar-search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索聊天"
          />
        </div>
      </header>

      <div className="conversation-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-state">暂无会话</div>
        ) : (
          filteredConversations.map((row) => renderConversationRow(row))
        )}
      </div>
      {menu ? (
        <div
          className="conversation-menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => onMenuTogglePin(menu.conversationId)}>
            {pinnedSet.has(menu.conversationId) ? '取消置顶' : '置顶会话'}
          </button>
          <button type="button" onClick={() => onMenuToggleMute(menu.conversationId)}>
            {mutedSet.has(menu.conversationId) ? '取消静音' : '静音会话'}
          </button>
          <button type="button" onClick={() => void onCopyConversationId(menu.conversationId)}>
            复制会话ID
          </button>
        </div>
      ) : null}
    </aside>
  );
}
