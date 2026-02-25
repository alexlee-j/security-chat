import { FormEvent } from 'react';
import { ConversationListItem } from '../../core/types';

type Props = {
  userId: string;
  peerUserId: string;
  conversations: ConversationListItem[];
  activeConversationId: string;
  onPeerUserIdChange: (value: string) => void;
  onCreateDirect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSelectConversation: (conversationId: string) => void;
};

function getDisplayName(row: ConversationListItem): string {
  return row.peerUser?.username ?? row.conversationId.slice(0, 8);
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function ConversationSidebar(props: Props): JSX.Element {
  return (
    <aside className="sidebar card telegram-sidebar">
      <header className="sidebar-head">
        <div className="sidebar-title-wrap">
          <h2>Chats</h2>
          <p className="subtle">端到端加密会话</p>
        </div>
        <small className="subtle mono user-chip" title={props.userId}>
          {props.userId}
        </small>
      </header>

      <form onSubmit={props.onCreateDirect} className="new-chat-form">
        <input
          value={props.peerUserId}
          onChange={(e) => props.onPeerUserIdChange(e.target.value)}
          placeholder="输入 peerUserId"
        />
        <button type="submit">发起</button>
      </form>

      <div className="list-meta subtle">
        <span>最近会话</span>
        <span>{props.conversations.length} 项</span>
      </div>

      <div className="conversation-list">
        {props.conversations.length === 0 ? (
          <div className="empty-state">暂无会话，输入 peerUserId 创建单聊。</div>
        ) : (
          props.conversations.map((row) => {
            const displayName = getDisplayName(row);
            const messageState = row.lastMessage
              ? `最近消息 #${row.lastMessage.messageIndex} · ${row.lastMessage.readAt ? '已读' : row.lastMessage.deliveredAt ? '已送达' : '已发送'}`
              : '暂无消息';

            return (
              <button
                type="button"
                key={row.conversationId}
                className={row.conversationId === props.activeConversationId ? 'conversation active' : 'conversation'}
                onClick={() => props.onSelectConversation(row.conversationId)}
              >
                <span className="avatar">{getInitials(displayName)}</span>
                <div className="conversation-main">
                  <div className="conversation-row">
                    <div className="conversation-title">{displayName}</div>
                    <small className="conversation-time">{formatTime(row.lastMessage?.createdAt)}</small>
                  </div>
                  <small className="conversation-meta">{messageState}</small>
                </div>
                {row.unreadCount > 0 ? (
                  <span className="conversation-unread">{row.unreadCount}</span>
                ) : (
                  <span className="conversation-unread-placeholder" />
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
