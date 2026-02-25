import { FormEvent } from 'react';
import { ConversationListItem, MessageItem } from '../../core/types';

type Props = {
  currentUserId: string;
  activeConversationId: string;
  activeConversation: ConversationListItem | null;
  messages: MessageItem[];
  messageText: string;
  messageType: 1 | 2 | 3 | 4;
  mediaUrl: string;
  burnEnabled: boolean;
  burnDuration: number;
  typingHint: string;
  decodePayload: (payload: string) => string;
  onMessageTextChange: (value: string) => void;
  onMessageTypeChange: (value: 1 | 2 | 3 | 4) => void;
  onMediaUrlChange: (value: string) => void;
  onBurnEnabledChange: (value: boolean) => void;
  onBurnDurationChange: (value: number) => void;
  onTriggerBurn: (messageId: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStartTyping: () => void;
  onStopTyping: () => void;
};

type PayloadData = {
  text?: string;
  mediaUrl?: string;
  fileName?: string;
};

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

function getInitial(name?: string): string {
  return (name?.trim().slice(0, 2) ?? 'SC').toUpperCase();
}

function parsePayload(raw: string): PayloadData {
  try {
    const parsed = JSON.parse(raw) as PayloadData;
    if (typeof parsed === 'object' && parsed) {
      return parsed;
    }
    return { text: raw };
  } catch {
    return { text: raw };
  }
}

function messageTypeLabel(messageType: number): string {
  if (messageType === 2) return '图片';
  if (messageType === 3) return '语音';
  if (messageType === 4) return '文件';
  return '文本';
}

export function ChatPanel(props: Props): JSX.Element {
  const hasActiveConversation = Boolean(props.activeConversationId);
  const peerName = props.activeConversation?.peerUser?.username ?? '未选择会话';
  const statusText = hasActiveConversation ? '加密聊天中' : '请选择一个会话';
  const conversationShortId = props.activeConversationId ? props.activeConversationId.slice(0, 8) : '-';

  return (
    <section className="chat-panel card telegram-chat">
      <header className="chat-header">
        <div className="chat-title">
          <span className="avatar avatar-large">{getInitial(peerName)}</span>
          <div>
            <h3>{peerName}</h3>
            <p className="subtle">{statusText}</p>
          </div>
        </div>
        <div className="chat-tools">
          <span className="mono subtle conversation-chip">{conversationShortId}</span>
          <button
            type="button"
            className="chat-tool-btn icon-btn"
            disabled={!hasActiveConversation}
            aria-label="搜索会话"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 4.41 12.44l4.08 4.08 1.41-1.41-4.08-4.08A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            className="chat-tool-btn icon-btn"
            disabled={!hasActiveConversation}
            aria-label="更多操作"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="19" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      <div className="message-list">
        {!hasActiveConversation ? (
          <div className="empty-state">请选择左侧会话开始聊天。</div>
        ) : props.messages.length === 0 ? (
          <div className="empty-state">还没有消息，发一条试试看。</div>
        ) : (
          props.messages.map((row) => {
            const payload = parsePayload(props.decodePayload(row.encryptedPayload));
            return (
              <article key={row.id} className={row.senderId === props.currentUserId ? 'message self' : 'message'}>
                <div className="message-head">
                  <span className="message-type-tag">{messageTypeLabel(row.messageType)}</span>
                  {row.isBurn ? <span className="message-burn-tag">阅后即焚</span> : null}
                </div>

                {row.messageType === 1 ? (
                  <div className="message-content">{payload.text ?? ''}</div>
                ) : (
                  <div className="message-media">
                    <a href={payload.mediaUrl ?? '#'} target="_blank" rel="noreferrer">
                      {row.messageType === 2
                        ? '查看图片'
                        : row.messageType === 3
                          ? '播放语音'
                          : `下载文件 ${payload.fileName ?? ''}`.trim()}
                    </a>
                    {payload.text ? <div className="message-content">{payload.text}</div> : null}
                  </div>
                )}

                <small className="message-meta">
                  <span>{formatTime(row.createdAt)}</span>
                  <span>{row.readAt ? '已读' : row.deliveredAt ? '已送达' : '已发送'}</span>
                  {row.isBurn ? (
                    <button type="button" className="message-burn-btn" onClick={() => void props.onTriggerBurn(row.id)}>
                      焚毁
                    </button>
                  ) : null}
                </small>
              </article>
            );
          })
        )}
      </div>

      <footer className="composer-area">
        <div className="composer-config">
          <label>
            类型
            <select
              value={props.messageType}
              onChange={(e) => props.onMessageTypeChange(Number(e.target.value) as 1 | 2 | 3 | 4)}
              disabled={!hasActiveConversation}
            >
              <option value={1}>文本</option>
              <option value={2}>图片</option>
              <option value={3}>语音</option>
              <option value={4}>文件</option>
            </select>
          </label>
          <label className="burn-toggle">
            <input
              type="checkbox"
              checked={props.burnEnabled}
              onChange={(e) => props.onBurnEnabledChange(e.target.checked)}
              disabled={!hasActiveConversation}
            />
            阅后即焚
          </label>
          <label>
            时长
            <select
              value={props.burnDuration}
              onChange={(e) => props.onBurnDurationChange(Number(e.target.value))}
              disabled={!hasActiveConversation || !props.burnEnabled}
            >
              <option value={5}>5s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={300}>5min</option>
            </select>
          </label>
        </div>
        {props.messageType !== 1 ? (
          <input
            className="media-url-input"
            value={props.mediaUrl}
            onChange={(e) => props.onMediaUrlChange(e.target.value)}
            placeholder={props.messageType === 2 ? '图片 URL' : props.messageType === 3 ? '语音 URL' : '文件 URL'}
            disabled={!hasActiveConversation}
          />
        ) : null}
        <form onSubmit={props.onSubmit} className="composer">
          <button type="button" className="composer-tool icon-btn" disabled={!hasActiveConversation} aria-label="附加">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15.5 5a4.5 4.5 0 0 1 0 9H8.8a2.8 2.8 0 1 1 0-5.6h6.4v1.8H8.8a1 1 0 1 0 0 2h6.7a2.7 2.7 0 1 0 0-5.4H8.2A4.2 4.2 0 1 0 8.2 15h7.1v1.8H8.2a6 6 0 1 1 0-12h7.3Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button type="button" className="composer-tool icon-btn" disabled={!hasActiveConversation} aria-label="表情">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6Zm-3-7a1 1 0 1 0-1-1 1 1 0 0 0 1 1Zm6 0a1 1 0 1 0-1-1 1 1 0 0 0 1 1Zm-6.2 2.6a4.1 4.1 0 0 0 6.4 0l1.6 1a6 6 0 0 1-9.6 0l1.6-1Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <input
            value={props.messageText}
            onChange={(e) => props.onMessageTextChange(e.target.value)}
            placeholder="输入消息，按 Enter 发送"
            onFocus={props.onStartTyping}
            onBlur={props.onStopTyping}
            disabled={!hasActiveConversation}
          />
          <button
            type="submit"
            className="composer-send icon-btn"
            disabled={
              !hasActiveConversation ||
              (props.messageType === 1 ? !props.messageText.trim() : !props.mediaUrl.trim())
            }
            aria-label="发送消息"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 12-17 7 3.6-7L4 5l17 7Z" fill="currentColor" />
            </svg>
          </button>
        </form>
        <small className="typing-hint">{props.typingHint || ' '}</small>
      </footer>
    </section>
  );
}
