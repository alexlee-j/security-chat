import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ConversationListItem, MessageItem } from '../../core/types';

const QUICK_EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😭', '👍', '🙏', '🎉', '❤️', '🔥', '✅'];

type Props = {
  currentUserId: string;
  activeConversationId: string;
  activeConversation: ConversationListItem | null;
  messages: MessageItem[];
  messageText: string;
  messageType: 1 | 2 | 3 | 4;
  mediaUrl: string;
  mediaUploading: boolean;
  sendingMessage: boolean;
  burnEnabled: boolean;
  burnDuration: number;
  typingHint: string;
  hasMoreHistory: boolean;
  loadingMoreHistory: boolean;
  decodePayload: (payload: string) => string;
  onMessageTextChange: (value: string) => void;
  onMessageTypeChange: (value: 1 | 2 | 3 | 4) => void;
  onMediaUrlChange: (value: string) => void;
  onBurnEnabledChange: (value: boolean) => void;
  onBurnDurationChange: (value: number) => void;
  onTriggerBurn: (messageId: string) => Promise<void>;
  onRefreshConversation: () => Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onAttachMedia: (file: File) => Promise<void>;
  onOpenMedia: (message: MessageItem) => Promise<void>;
  onResolveMediaUrl: (message: MessageItem) => Promise<string | null>;
  onReadMessageOnce: (message: MessageItem) => Promise<void>;
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

function buildSearchText(row: MessageItem, payload: PayloadData): string {
  return [
    messageTypeLabel(row.messageType),
    payload.text ?? '',
    payload.mediaUrl ?? '',
    payload.fileName ?? '',
    row.messageIndex,
  ]
    .join(' ')
    .toLowerCase();
}

function buildSearchSnippet(payload: PayloadData, maxLength = 36): string {
  const source = [payload.text ?? '', payload.fileName ?? '', payload.mediaUrl ?? '']
    .join(' ')
    .trim();
  if (!source) {
    return '(空内容)';
  }
  return source.length <= maxLength ? source : `${source.slice(0, maxLength)}...`;
}

function renderHighlightedText(text: string, keyword: string): JSX.Element {
  const normalized = keyword.trim();
  if (!normalized) {
    return <>{text}</>;
  }
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === normalized.toLowerCase() ? (
          <mark key={`${part}-${idx}`} className="msg-highlight">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function ChatPanel(props: Props): JSX.Element {
  const hasActiveConversation = Boolean(props.activeConversationId);
  const peerName = props.activeConversation?.peerUser?.username ?? '未选择会话';
  const statusText = hasActiveConversation ? '加密聊天中' : '请选择一个会话';
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [audioSourceMap, setAudioSourceMap] = useState<Record<string, string>>({});
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const stickToBottomRef = useRef(true);

  const searchResults = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return [] as Array<{ id: string; label: string; time: string; index: string }>;
    }
    return props.messages
      .map((row) => {
        const payload = parsePayload(props.decodePayload(row.encryptedPayload));
        const matched = buildSearchText(row, payload).includes(keyword);
        if (!matched) {
          return null;
        }
        return {
          id: row.id,
          label: `[${messageTypeLabel(row.messageType)}] ${buildSearchSnippet(payload)}`,
          time: formatTime(row.createdAt),
          index: row.messageIndex,
        };
      })
      .filter(Boolean) as Array<{ id: string; label: string; time: string; index: string }>;
  }, [props.messages, searchKeyword, props.decodePayload]);

  function jumpToMessage(messageId: string): void {
    const container = messageListRef.current;
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
    if (!target) {
      return;
    }
    setFocusedMessageId(messageId);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const visibleMessages = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return props.messages;
    }
    return props.messages.filter((row) => {
      const payload = parsePayload(props.decodePayload(row.encryptedPayload));
      return buildSearchText(row, payload).includes(keyword);
    });
  }, [props.messages, searchKeyword, props.decodePayload]);

  function clearComposer(): void {
    props.onMessageTextChange('');
    props.onMediaUrlChange('');
    props.onMessageTypeChange(1);
    props.onBurnEnabledChange(false);
    setMenuOpen(false);
  }

  function scrollToBottom(): void {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
    setMenuOpen(false);
    stickToBottomRef.current = true;
  }

  function handleMessageListScroll(): void {
    const container = messageListRef.current;
    if (!container) {
      return;
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceToBottom <= 80;
  }

  function appendEmoji(emoji: string): void {
    props.onMessageTextChange(`${props.messageText}${emoji}`);
  }

  useEffect(() => {
    return () => {
      for (const source of Object.values(audioSourceMap)) {
        if (source.startsWith('blob:')) {
          URL.revokeObjectURL(source);
        }
      }
    };
  }, [audioSourceMap]);

  useEffect(() => {
    setSearchKeyword('');
    setFocusedMessageId('');
    setSearchOpen(false);
    stickToBottomRef.current = true;
    window.requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [props.activeConversationId]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }
    if (!stickToBottomRef.current) {
      return;
    }
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [visibleMessages.length, props.typingHint, props.activeConversationId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent): void => {
      const metaOrCtrl = event.metaKey || event.ctrlKey;
      if (metaOrCtrl && event.key.toLowerCase() === 'f') {
        if (!hasActiveConversation) {
          return;
        }
        event.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }
      if (event.key === 'Escape') {
        setEmojiOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasActiveConversation]);

  async function prepareAudioSource(row: MessageItem, payload: PayloadData): Promise<void> {
    if (audioSourceMap[row.id]) {
      return;
    }
    const resolved = await props.onResolveMediaUrl(row);
    if (resolved) {
      setAudioSourceMap((prev) => ({ ...prev, [row.id]: resolved }));
      return;
    }
    const fallback = (payload.mediaUrl ?? '').trim();
    if (fallback) {
      setAudioSourceMap((prev) => ({ ...prev, [row.id]: fallback }));
    }
  }

  function openMediaMessage(row: MessageItem, payload: PayloadData): void {
    if (row.messageType === 3) {
      void prepareAudioSource(row, payload);
      return;
    }
    void props.onOpenMedia(row);
    if (row.mediaAssetId) {
      return;
    }
    const mediaUrl = (payload.mediaUrl ?? '').trim();
    if (mediaUrl) {
      window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    }
  }

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
          <button
            type="button"
            className="chat-tool-btn icon-btn"
            disabled={!hasActiveConversation}
            aria-label="搜索会话"
            onClick={() => {
              setSearchOpen((v) => {
                const next = !v;
                if (!next) {
                  setSearchKeyword('');
                  setFocusedMessageId('');
                }
                return next;
              });
              setMenuOpen(false);
            }}
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
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="19" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="chat-menu">
              <button type="button" onClick={() => void props.onRefreshConversation()}>
                刷新会话
              </button>
              <button type="button" onClick={scrollToBottom}>
                跳到底部
              </button>
              <button type="button" onClick={clearComposer}>
                清空输入
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {searchOpen ? (
        <div className="chat-search-row">
          <input
            ref={searchInputRef}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="在当前会话搜索消息内容"
            disabled={!hasActiveConversation}
          />
          <small className="subtle">{searchKeyword.trim() ? `命中 ${searchResults.length}` : `共 ${props.messages.length}`}</small>
        </div>
      ) : null}

      {searchOpen && searchKeyword.trim() ? (
        <div className="chat-search-results">
          {searchResults.slice(0, 20).map((item) => (
            <button key={item.id} type="button" onClick={() => jumpToMessage(item.id)}>
              <span>{item.label}</span>
              <small>{item.time} · #{item.index}</small>
            </button>
          ))}
          {searchResults.length === 0 ? <small className="subtle">没有匹配结果</small> : null}
        </div>
      ) : null}

      <div className="message-list" ref={messageListRef} onScroll={handleMessageListScroll}>
        {!hasActiveConversation ? (
          <div className="empty-state">请选择左侧会话开始聊天。</div>
        ) : visibleMessages.length === 0 ? (
          <div className="empty-state">还没有消息，发一条试试看。</div>
        ) : (
          <>
            {props.hasMoreHistory ? (
              <div className="history-loader">
                <button type="button" onClick={() => void props.onLoadOlderMessages()} disabled={props.loadingMoreHistory}>
                  {props.loadingMoreHistory ? '加载中...' : '加载更早消息'}
                </button>
              </div>
            ) : (
              <div className="history-end subtle">没有更早消息了</div>
            )}
            {visibleMessages.map((row) => {
              const payload = parsePayload(props.decodePayload(row.encryptedPayload));
              return (
                <article
                  key={row.id}
                  data-msg-id={row.id}
                  className={`${row.senderId === props.currentUserId ? 'message self' : 'message'}${focusedMessageId === row.id ? ' focused' : ''}`}
                >
                  <div className="message-head">
                    <span className="message-type-tag">{messageTypeLabel(row.messageType)}</span>
                    {row.isBurn ? <span className="message-burn-tag">阅后即焚</span> : null}
                  </div>

                  {row.messageType === 1 ? (
                    <div className="message-content">{renderHighlightedText(payload.text ?? '', searchKeyword)}</div>
                  ) : (
                    <div className="message-media">
                      {row.messageType === 3 ? (
                        audioSourceMap[row.id] ? (
                          <audio
                            controls
                            preload="none"
                            src={audioSourceMap[row.id]}
                            onPlay={() => {
                              void props.onReadMessageOnce(row);
                            }}
                          />
                        ) : (
                          <button type="button" className="link-btn" onClick={() => openMediaMessage(row, payload)}>
                            加载语音
                          </button>
                        )
                      ) : (
                        <button type="button" className="link-btn" onClick={() => openMediaMessage(row, payload)}>
                          {row.messageType === 2 ? '查看图片' : `下载文件 ${payload.fileName ?? ''}`.trim()}
                        </button>
                      )}
                      {payload.text ? (
                        <div className="message-content">{renderHighlightedText(payload.text, searchKeyword)}</div>
                      ) : null}
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
            })}
          </>
        )}
      </div>

      <footer className="composer-area">
        <div className="composer-advanced-toggle">
          <button
            type="button"
            className="ghost-btn"
            disabled={!hasActiveConversation}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? '收起高级' : '高级'}
          </button>
          <small className="subtle">
            {props.messageType === 1 ? '文本' : props.messageType === 2 ? '图片' : props.messageType === 3 ? '语音' : '文件'}
            {props.burnEnabled ? ` · 焚毁${props.burnDuration}s` : ''}
          </small>
        </div>
        {advancedOpen ? (
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
                disabled={!hasActiveConversation || props.messageType === 4}
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
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={300}>5min</option>
              </select>
            </label>
            <small className="subtle burn-default-hint">当前会同步为会话默认焚毁设置</small>
          </div>
        ) : null}
        {props.messageType !== 1 ? (
          <input
            className="media-url-input"
            value={props.mediaUrl}
            readOnly
            placeholder={props.mediaUploading ? '附件上传中...' : '通过“附加”按钮选择并上传附件'}
            disabled
          />
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void props.onAttachMedia(file);
            }
            e.currentTarget.value = '';
          }}
        />
        <form ref={composerFormRef} onSubmit={props.onSubmit} className="composer">
          <button
            type="button"
            className="composer-tool icon-btn"
            disabled={!hasActiveConversation || props.mediaUploading}
            aria-label="附加"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15.5 5a4.5 4.5 0 0 1 0 9H8.8a2.8 2.8 0 1 1 0-5.6h6.4v1.8H8.8a1 1 0 1 0 0 2h6.7a2.7 2.7 0 1 0 0-5.4H8.2A4.2 4.2 0 1 0 8.2 15h7.1v1.8H8.2a6 6 0 1 1 0-12h7.3Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            className="composer-tool icon-btn"
            disabled={!hasActiveConversation}
            aria-label="表情"
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6Zm-3-7a1 1 0 1 0-1-1 1 1 0 0 0 1 1Zm6 0a1 1 0 1 0-1-1 1 1 0 0 0 1 1Zm-6.2 2.6a4.1 4.1 0 0 0 6.4 0l1.6 1a6 6 0 0 1-9.6 0l1.6-1Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <textarea
            value={props.messageText}
            onChange={(e) => props.onMessageTextChange(e.target.value)}
            placeholder="输入消息，按 Enter 发送"
            onFocus={props.onStartTyping}
            onBlur={props.onStopTyping}
            rows={1}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key !== 'Enter') {
                return;
              }
              if (event.shiftKey) {
                return;
              }
              event.preventDefault();
              composerFormRef.current?.requestSubmit();
            }}
            disabled={!hasActiveConversation}
          />
          <button
            type="submit"
            className="composer-send icon-btn"
            disabled={
              !hasActiveConversation ||
              props.sendingMessage ||
              props.mediaUploading ||
              (props.messageType === 1 ? !props.messageText.trim() : !props.mediaUrl.trim())
            }
            aria-label="发送消息"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 12-17 7 3.6-7L4 5l17 7Z" fill="currentColor" />
            </svg>
          </button>
        </form>
        {emojiOpen ? (
          <div className="emoji-panel">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" className="emoji-item" onClick={() => appendEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <small className="typing-hint">
          {props.mediaUploading ? '媒体上传中...' : props.sendingMessage ? '发送中...' : props.typingHint || ' '}
        </small>
      </footer>
    </section>
  );
}
