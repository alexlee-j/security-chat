/**
 * 文件名：chat-panel.tsx
 * 所属模块：桌面端-聊天面板
 * 核心作用：实现聊天界面的核心交互功能，包括消息列表展示、消息发送、右键菜单操作
 *          （复制/引用/转发/下载/删除）、图片预览、消息搜索、引用回复等功能
 * 核心依赖：React(hooks)、MessageItem/ConversationListItem 类型、API 模块
 * 创建时间：2024-01-01
 * 更新说明：2026-03-14 添加消息引用、转发、下载功能，优化图片预览和右键菜单交互
 */

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { ConversationListItem, MessageItem } from '../../core/types';
import { isEncryptedMediaPayload } from '../../core/media-crypto';
import { saveAndOpenFile } from '../../core/native-file';
import {
  MediaMessagePayload,
  formatMediaSize,
  isVideoMediaPayload,
  resolveLegacyMediaUrl,
  resolveMediaBubbleContent,
  resolveMediaFileName,
  resolveMediaMimeType,
  resolveMediaSize,
} from '../../core/media-message';
import { TopBar } from './top-bar';
import { ChatMoreMenu } from './chat-more-menu';
import { MessageBubble, MediaErrorType } from './message-bubble';
import { MessageContextMenu } from './message-context-menu';
import { EmojiPicker } from './emoji-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Props 类型定义 - 聊天面板组件属性
 */
type Props = {
  /** 当前用户ID */
  currentUserId: string;
  /** 当前会话ID */
  activeConversationId: string;
  /** 当前会话信息 */
  activeConversation: ConversationListItem | null;
  /** 消息列表 */
  messages: MessageItem[];
  /** 输入框文本 */
  messageText: string;
  /** 消息类型：1文本 2图片 3语音 4文件 */
  messageType: 1 | 2 | 3 | 4;
  /** 媒体文件URL */
  mediaUrl: string;
  /** 媒体上传中状态 */
  mediaUploading: boolean;
  /** 发送中状态 */
  sendingMessage: boolean;
  /** 阅后即焚开关 */
  burnEnabled: boolean;
  /** 阅后即焚时长（秒） */
  burnDuration: number;
  /** 引用的消息 */
  replyToMessage: MessageItem | null;
  /** 输入提示文本 */
  typingHint: string;
  /** 是否有更多历史消息 */
  hasMoreHistory: boolean;
  /** 加载历史消息中状态 */
  loadingMoreHistory: boolean;
  decodePayload: (payload: string, senderId?: string, sourceDeviceId?: string) => string;
  onMessageTextChange: (value: string) => void;
  onMessageTypeChange: (value: 1 | 2 | 3 | 4) => void;
  onMediaUrlChange: (value: string) => void;
  onBurnEnabledChange: (value: boolean) => void;
  onBurnDurationChange: (value: number) => void;
  onReplyToMessageChange: (message: MessageItem | null) => void;
  onTriggerBurn: (messageId: string) => Promise<void>;
  onRefreshConversation: () => Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onAttachMedia: (file: File) => Promise<void>;
  onCancelMediaAttachment: () => void;
  onOpenMedia: (message: MessageItem) => Promise<void>;
  onResolveMediaUrl: (message: MessageItem) => Promise<string | null>;
  onReadMessageOnce: (message: MessageItem) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRetryMessage: (messageId: string) => Promise<void>;
  onStartTyping: () => void;
  onStopTyping: () => void;
  onForwardMessage: (originalMessageId: string, targetConversationId: string) => Promise<{ messageId: string; messageIndex: string }>;
  isConversationPinned: boolean;
  isConversationMuted: boolean;
  onToggleConversationPin: (conversationId: string) => void;
  onToggleConversationMute: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => Promise<boolean>;
};

const QUICK_EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😭', '👍', '🙏', '🎉', '❤️', '🔥', '✅'];

/**
 * Payload 数据结构 - 消息内容解析后的格式
 */
type PayloadData = MediaMessagePayload;

/**
 * 格式化时间戳为本地时间字符串
 * @param value - ISO 8601 格式的时间字符串
 * @returns 格式化后的时间字符串（如：14:30）
 */
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

/**
 * 获取用户名的首字母缩写（最多2个字符）
 * @param name - 用户名
 * @returns 大写的首字母缩写
 */
function getInitial(name?: string): string {
  return (name?.trim().slice(0, 2) ?? 'SC').toUpperCase();
}

/**
 * 根据用户名生成头像渐变色索引（0-4）
 * 使用简单的哈希算法确保同一用户名始终生成相同颜色
 * @param name - 用户名
 * @returns 渐变色索引
 */
function getAvatarColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 5;
}

/**
 * 解析消息 payload JSON 字符串
 * @param raw - JSON 字符串或原始文本
 * @returns 解析后的 PayloadData 对象
 * @description 兼容旧格式：如果解析失败或不是对象，返回 { text: raw }
 */
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

/**
 * 构建搜索文本，用于消息搜索功能
 * @param row - 消息项
 * @param payload - 解析后的消息内容
 * @returns 小写的搜索文本
 */
function buildSearchText(row: MessageItem, payload: PayloadData): string {
  return [
    getTypeLabel(row.messageType),
    payload.text ?? '',
    resolveLegacyMediaUrl(payload) ?? '',
    resolveMediaFileName(payload, ''),
    row.messageIndex,
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * 构建搜索摘要文本，限制长度
 * @param payload - 解析后的消息内容
 * @param maxLength - 最大长度，默认36字符
 * @returns 截断后的摘要文本
 */
function buildSearchSnippet(payload: PayloadData, maxLength = 36): string {
  const source = [payload.text ?? '', resolveMediaFileName(payload, ''), resolveLegacyMediaUrl(payload) ?? '']
    .join(' ')
    .trim();
  if (!source) {
    return '(空内容)';
  }
  return source.length <= maxLength ? source : `${source.slice(0, maxLength)}...`;
}

/**
 * 获取消息类型标签
 * @param messageType - 消息类型编号
 * @returns 类型标签文本
 */
function getTypeLabel(messageType: number): string {
  if (messageType === 2) return '图片';
  if (messageType === 3) return '语音';
  if (messageType === 4) return '文件';
  return '文本';
}

function getCopyableText(message: MessageItem, payload: PayloadData): string {
  const text = payload.text?.trim();
  if (text) {
    return text;
  }
  const fileName = resolveMediaFileName(payload, '').trim();
  if (fileName) {
    return fileName;
  }
  if (message.messageType === 2) {
    return '[图片]';
  }
  if (message.messageType === 3) {
    return '[语音]';
  }
  if (message.messageType === 4) {
    return '[文件]';
  }
  return '';
}

/**
 * 渲染高亮文本，将关键词标记为黄色背景
 * @param text - 原始文本
 * @param keyword - 要高亮的关键词
 * @returns JSX.Element 高亮后的文本元素
 */
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

/**
 * 聊天面板主组件
 * @param props - 组件属性
 * @returns JSX.Element 聊天面板界面
 * @description 实现完整的聊天功能：消息列表、输入框、搜索、右键菜单、图片预览等
 */
export function ChatPanel(props: Props): JSX.Element {
  // 是否有活跃会话
  const hasActiveConversation = Boolean(props.activeConversationId);
  // 对方用户名
  const peerName = props.activeConversation?.peerUser?.username ?? '未选择会话';
  // 状态文本
  const statusText = hasActiveConversation ? '加密聊天中' : '请选择一个会话';
  
  // UI 状态
  const [searchOpen, setSearchOpen] = useState(false);          // 搜索面板开关
  const [searchKeyword, setSearchKeyword] = useState('');       // 搜索关键词
  const [focusedMessageId, setFocusedMessageId] = useState(''); // 聚焦的消息ID
  const [emojiOpen, setEmojiOpen] = useState(false);            // 表情面板开关
  const [audioSourceMap, setAudioSourceMap] = useState<Record<string, string>>({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState('');
  const [imageSourceMap, setImageSourceMap] = useState<Record<string, string>>({});
  /** 媒体错误状态映射：消息ID -> 错误类型 */
  const [mediaErrorMap, setMediaErrorMap] = useState<Record<string, MediaErrorType>>({});
  // 附件预览状态
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl: string } | null>(null);
  // 图片懒加载 - 追踪哪些图片应该在视口内加载
  const [visibleImageIds, setVisibleImageIds] = useState<Set<string>>(new Set());
  const imageObserverRef = useRef<IntersectionObserver | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState('');
  const [forwardConversations, setForwardConversations] = useState<ConversationListItem[]>([]);
  const [selectedForwardConversation, setSelectedForwardConversation] = useState('');
  const [forwardLoading, setForwardLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; messageId: string; message?: MessageItem } | null>(null);
  // 阅后即焚倒计时状态
  const [burnCountdowns, setBurnCountdowns] = useState<Record<string, number>>({});
  // 正在销毁的消息ID
  const [burningMessageIds, setBurningMessageIds] = useState<Set<string>>(new Set());
  // 增量加载状态
  const [displayedMessageCount, setDisplayedMessageCount] = useState(50);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const stickToBottomRef = useRef(true);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioSourceMapRef = useRef<Record<string, string>>({});
  const imageSourceMapRef = useRef<Record<string, string>>({});

  const searchResults = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return [] as Array<{ id: string; label: string; time: string; index: string }>;
    }
    return props.messages
      .map((row) => {
        const payload = parsePayload(props.decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId));
        const matched = buildSearchText(row, payload).includes(keyword);
        if (!matched) {
          return null;
        }
        return {
          id: row.id,
          label: `[${getTypeLabel(row.messageType)}] ${buildSearchSnippet(payload)}`,
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
      const payload = parsePayload(props.decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId));
      return buildSearchText(row, payload).includes(keyword);
    });
  }, [props.messages, searchKeyword, props.decodePayload]);

  // 增量加载 - 只显示一部分消息
  const displayedMessages = useMemo(() => {
    if (searchKeyword.trim()) {
      // 搜索模式下显示所有匹配结果
      return visibleMessages;
    }
    // 增量加载模式：新消息在底部，只显示最后 displayedMessageCount 条
    const messages = visibleMessages;
    if (messages.length <= displayedMessageCount) {
      return messages;
    }
    return messages.slice(messages.length - displayedMessageCount);
  }, [visibleMessages, displayedMessageCount, searchKeyword]);

  function clearComposer(): void {
    props.onMessageTextChange('');
    props.onMediaUrlChange('');
    props.onMessageTypeChange(1);
    props.onBurnEnabledChange(false);
  }

  function scrollToBottom(): void {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
    stickToBottomRef.current = true;
  }

  function handleMessageListScroll(): void {
    const container = messageListRef.current;
    if (!container) {
      return;
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceToBottom <= 80;

    // 增量加载：当滚动到顶部附近且有更多历史消息时，加载更多
    if (container.scrollTop <= 100 && props.hasMoreHistory && !searchKeyword.trim()) {
      const totalMessages = visibleMessages.length;
      if (totalMessages >= displayedMessageCount) {
        // 已经显示了足够多的消息，可以继续增量加载
        setDisplayedMessageCount((prev) => prev + 30);
      }
    }
  }

  function appendEmoji(emoji: string): void {
    props.onMessageTextChange(`${props.messageText}${emoji}`);
  }

  function revokeMediaObjectUrls(): void {
    for (const source of Object.values(audioSourceMapRef.current)) {
      if (source.startsWith('blob:')) {
        URL.revokeObjectURL(source);
      }
    }
    for (const source of Object.values(imageSourceMapRef.current)) {
      if (source.startsWith('blob:')) {
        URL.revokeObjectURL(source);
      }
    }
    if (imagePreviewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    if (audioObjectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    audioElementRef.current?.pause();
  }

  useEffect(() => {
    audioSourceMapRef.current = audioSourceMap;
  }, [audioSourceMap]);

  useEffect(() => {
    imageSourceMapRef.current = imageSourceMap;
  }, [imageSourceMap]);

  useEffect(() => {
    return () => {
      revokeMediaObjectUrls();
    };
  }, []);

  useEffect(() => {
    revokeMediaObjectUrls();
    setSearchKeyword('');
    setFocusedMessageId('');
    setSearchOpen(false);
    // 重置媒体相关状态
    setAudioSourceMap({});
    setImageSourceMap({});
    setImagePreviewOpen(false);
    setImagePreviewSrc('');
    setVisibleImageIds(new Set());
    setMediaErrorMap({});
    setDisplayedMessageCount(50);
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

  // 设置图片懒加载 - Intersection Observer
  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    // 创建 Intersection Observer
    imageObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = (entry.target as HTMLElement).dataset.msgId;
          if (!messageId) return;

          if (entry.isIntersecting) {
            setVisibleImageIds((prev) => new Set(prev).add(messageId));
          }
        });
      },
      {
        root: messageListRef.current,
        rootMargin: '100px', // 提前 100px 开始加载
        threshold: 0.01,
      }
    );

    // 观察所有图片消息元素
    const imageElements = messageListRef.current.querySelectorAll('[data-msg-type="2"]');
    imageElements.forEach((el) => {
      imageObserverRef.current?.observe(el);
    });

    return () => {
      imageObserverRef.current?.disconnect();
    };
  }, [visibleMessages]);

  // 懒加载图片 - 只加载可见区域的图片
  useEffect(() => {
    visibleMessages.forEach((row) => {
      if (row.messageType !== 2) {
        return;
      }
      // 检查图片是否可见
      if (!visibleImageIds.has(row.id)) {
        return;
      }
      if (imageSourceMap[row.id]) {
        return;
      }
      const payload = parsePayload(props.decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId));
      void prepareImageSource(row, payload);
    });
  }, [visibleMessages, visibleImageIds]);

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
        closeImagePreview();
        if (searchOpen) {
          setSearchOpen(false);
          setSearchKeyword('');
          setFocusedMessageId('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasActiveConversation, searchOpen]);

  // 搜索关闭或关键词清空时清除焦点
  useEffect(() => {
    if (!searchOpen || !searchKeyword.trim()) {
      setFocusedMessageId('');
    }
  }, [searchOpen, searchKeyword]);

  // 父级清空媒体状态后，同步清理本地预览。
  useEffect(() => {
    if (!props.mediaUrl && pendingAttachment) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
      setPendingAttachment(null);
    }
  }, [props.mediaUrl]);

  useEffect(() => {
    return () => {
      if (pendingAttachment) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  useEffect(() => {
    // 初始化需要倒计时的消息
    const burnMessages = visibleMessages.filter((row) => row.isBurn && row.burnDuration && row.readAt);
    const initialCountdowns: Record<string, number> = {};

    burnMessages.forEach((row) => {
      const readTime = row.readAt ? new Date(row.readAt).getTime() : 0;
      const burnDuration = (row.burnDuration ?? 0) * 1000;
      const remaining = Math.max(0, Math.floor((readTime + burnDuration - Date.now()) / 1000));
      initialCountdowns[row.id] = remaining;
    });

    setBurnCountdowns(initialCountdowns);
  }, [visibleMessages]);

  // handleBurnComplete 必须在 useEffect 之前定义，以便闭包正确捕获
  const handleBurnComplete = useCallback(async function handleBurnComplete(messageId: string): Promise<void> {
    // 等待动画完成
    setTimeout(async () => {
      try {
        await props.onTriggerBurn(messageId);
      } catch (error) {
        console.error('[ChatPanel] Burn message failed:', error);
      }
      setBurningMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      setBurnCountdowns((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    }, 800); // 动画时长
  }, [props.onTriggerBurn]);

  // 倒计时更新
  useEffect(() => {
    const interval = setInterval(() => {
      setBurnCountdowns((prev) => {
        const next: Record<string, number> = {};
        let hasActive = false;

        Object.entries(prev).forEach(([id, remaining]) => {
          if (remaining > 0) {
            const newRemaining = remaining - 1;
            next[id] = newRemaining;
            if (newRemaining > 0) {
              hasActive = true;
            } else {
              // 时间到，触发销毁
              setBurningMessageIds((prev) => new Set(prev).add(id));
              void handleBurnComplete(id);
            }
          }
        });

        if (!hasActive) {
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visibleMessages, handleBurnComplete]);

  async function prepareAudioSource(row: MessageItem, payload: PayloadData): Promise<void> {
    if (audioSourceMap[row.id] || mediaErrorMap[row.id]) {
      return;
    }
    const resolved = await props.onResolveMediaUrl(row);
    if (resolved) {
      setAudioSourceMap((prev) => ({ ...prev, [row.id]: resolved }));
      // 清除之前的错误状态
      if (mediaErrorMap[row.id]) {
        setMediaErrorMap((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      }
      return;
    }
    const fallback = resolveLegacyMediaUrl(payload);
    if (fallback) {
      setAudioSourceMap((prev) => ({ ...prev, [row.id]: fallback }));
      return;
    }
    // 设置媒体错误状态
    const hasEncryptedMedia = isEncryptedMediaPayload(payload.media);
    const hasLegacyMedia = Boolean(resolveLegacyMediaUrl(payload));
    if (hasEncryptedMedia) {
      // 有加密媒体元数据但解析失败，推断为解密失败
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'decrypt_failed' }));
    } else if (!hasLegacyMedia && row.mediaAssetId) {
      // 有 mediaAssetId 但没有加密媒体也没有 legacy URL，元数据可能损坏
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'metadata_missing' }));
    } else if (!hasLegacyMedia) {
      // 旧版媒体不可用（既没有加密媒体也没有 legacy URL）
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'legacy_unavailable' }));
    }
  }

  async function prepareImageSource(row: MessageItem, payload: PayloadData): Promise<void> {
    if (imageSourceMap[row.id] || mediaErrorMap[row.id]) {
      return;
    }
    const resolved = await props.onResolveMediaUrl(row);
    if (resolved) {
      setImageSourceMap((prev) => ({ ...prev, [row.id]: resolved }));
      // 清除之前的错误状态
      if (mediaErrorMap[row.id]) {
        setMediaErrorMap((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      }
      return;
    }
    const fallback = resolveLegacyMediaUrl(payload);
    if (fallback) {
      setImageSourceMap((prev) => ({ ...prev, [row.id]: fallback }));
      return;
    }
    // 设置媒体错误状态
    const hasEncryptedMedia = isEncryptedMediaPayload(payload.media);
    const hasLegacyMedia = Boolean(resolveLegacyMediaUrl(payload));
    if (hasEncryptedMedia) {
      // 有加密媒体元数据但解析失败，推断为解密失败
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'decrypt_failed' }));
    } else if (!hasLegacyMedia && row.mediaAssetId) {
      // 有 mediaAssetId 但没有加密媒体也没有 legacy URL，元数据可能损坏
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'metadata_missing' }));
    } else if (!hasLegacyMedia) {
      // 旧版媒体不可用（既没有加密媒体也没有 legacy URL）
      setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'legacy_unavailable' }));
    }
  }

  function closeImagePreview(): void {
    if (imagePreviewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }
    imagePreviewUrlRef.current = null;
    setImagePreviewOpen(false);
    setImagePreviewSrc('');
  }

  async function openImagePreview(row: MessageItem, payload: PayloadData): Promise<void> {
    if (row.messageType !== 2) {
      return;
    }
    await props.onReadMessageOnce(row);
    const resolved = await props.onResolveMediaUrl(row);
    const nextPreview = resolved || resolveLegacyMediaUrl(payload);
    if (!nextPreview) {
      // 设置媒体错误状态
      const hasEncryptedMedia = isEncryptedMediaPayload(payload.media);
      const hasLegacyMedia = Boolean(resolveLegacyMediaUrl(payload));
      if (hasEncryptedMedia) {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'decrypt_failed' }));
        showToast('图片解密失败', 'error');
      } else if (!hasLegacyMedia && row.mediaAssetId) {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'metadata_missing' }));
        showToast('图片元数据缺失', 'error');
      } else {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'legacy_unavailable' }));
        showToast('图片加载失败', 'error');
      }
      return;
    }
    // 清除错误状态
    if (mediaErrorMap[row.id]) {
      setMediaErrorMap((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
    if (imagePreviewUrlRef.current && imagePreviewUrlRef.current !== nextPreview && imagePreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }
    imagePreviewUrlRef.current = resolved ? nextPreview : null;
    setImagePreviewSrc(nextPreview);
    setImagePreviewOpen(true);
  }

  async function playAudioMessage(row: MessageItem, payload: PayloadData): Promise<void> {
    if (row.messageType !== 3) {
      return;
    }
    await props.onReadMessageOnce(row);
    const resolved = await props.onResolveMediaUrl(row);
    const audioUrl = resolved || resolveLegacyMediaUrl(payload);
    if (!audioUrl) {
      // 设置媒体错误状态
      const hasEncryptedMedia = isEncryptedMediaPayload(payload.media);
      const hasLegacyMedia = Boolean(resolveLegacyMediaUrl(payload));
      if (hasEncryptedMedia) {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'decrypt_failed' }));
        showToast('语音解密失败', 'error');
      } else if (!hasLegacyMedia && row.mediaAssetId) {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'metadata_missing' }));
        showToast('语音元数据缺失', 'error');
      } else {
        setMediaErrorMap((prev) => ({ ...prev, [row.id]: 'legacy_unavailable' }));
        showToast('语音加载失败', 'error');
      }
      return;
    }
    // 清除错误状态
    if (mediaErrorMap[row.id]) {
      setMediaErrorMap((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (audioObjectUrlRef.current && audioObjectUrlRef.current !== resolved && audioObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
    }
    audioObjectUrlRef.current = resolved || null;

    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;
    const cleanup = (): void => {
      if (audioElementRef.current === audio) {
        audioElementRef.current = null;
      }
      if (audioObjectUrlRef.current === resolved && audioObjectUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    try {
      await audio.play();
    } catch {
      cleanup();
      showToast('语音播放失败', 'error');
    }
  }

  async function copyMessage(messageId: string): Promise<void> {
    const message = props.messages.find((m: MessageItem) => m.id === messageId);
    if (!message) {
      return;
    }
    const payload = parsePayload(
      props.decodePayload(message.encryptedPayload, message.senderId, message.sourceDeviceId),
    );
    const text = getCopyableText(message, payload);
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板', 'success');
      } catch {
        showToast('复制失败', 'error');
      }
    } else {
      showToast('当前消息没有可复制内容', 'info');
    }
  }

  function replyMessage(messageId: string): void {
    const message = props.messages.find((m: MessageItem) => m.id === messageId);
    if (!message) {
      return;
    }
    props.onReplyToMessageChange(message);
    // 聚焦到输入框
    window.requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('.composer textarea');
      textarea?.focus();
    });
  }

  async function loadForwardConversations(): Promise<void> {
    try {
      const { getConversations } = await import('../../core/api');
      const conversations = await getConversations();
      setForwardConversations(conversations);
    } catch (error) {
      console.error('加载会话列表失败:', error);
    }
  }

  function forwardMessage(messageId: string): void {
    setForwardMessageId(messageId);
    setSelectedForwardConversation('');
    void loadForwardConversations();
    setForwardDialogOpen(true);
  }

  async function downloadMedia(message: MessageItem): Promise<void> {
    try {
      const payload = parsePayload(
        props.decodePayload(message.encryptedPayload, message.senderId, message.sourceDeviceId),
      );
      let url: string | null = null;
      let filename = resolveMediaFileName(payload, 'download');
      const mimeType = resolveMediaMimeType(payload);
      let revokeUrl = false;

      if (message.messageType === 2) {
        // 图片 - 使用 imageSourceMap 中的 URL 或解析新的 URL
        if (imageSourceMap[message.id]) {
          url = imageSourceMap[message.id];
        } else if (message.mediaAssetId || isEncryptedMediaPayload(payload.media)) {
          url = await props.onResolveMediaUrl(message);
          revokeUrl = true;
        } else {
          url = resolveLegacyMediaUrl(payload);
        }
        if (!filename.includes('.')) {
          filename = resolveMediaFileName(payload, 'image.jpg');
        }
      } else if (message.messageType === 4) {
        // 文件
        if (message.mediaAssetId || isEncryptedMediaPayload(payload.media)) {
          url = await props.onResolveMediaUrl(message);
          revokeUrl = true;
        } else {
          url = resolveLegacyMediaUrl(payload);
        }
        if (!filename.includes('.')) {
          filename = resolveMediaFileName(payload, 'file');
        }
      }

      if (!url) {
        showToast('下载链接不可用', 'error');
        return;
      }

      const response = await fetch(url);
      const sourceBlob = await response.blob();
      const blob = new Blob([sourceBlob], { type: mimeType });
      const result = await saveAndOpenFile(filename, blob);

      // 清理需要释放的 URL
      if (revokeUrl && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }

      showToast(
        result.opened
          ? `已下载到 ${result.path}，并已打开`
          : `已下载到 ${result.path}，但系统打开失败，请手动打开`,
        result.opened ? 'success' : 'info',
      );
    } catch (error) {
      console.error('下载失败:', error);
      showToast('下载失败，请重试', 'error');
    }
  }

  async function handleForwardSubmit(): Promise<void> {
    if (!selectedForwardConversation) {
      showToast('请选择要转发的会话', 'error');
      return;
    }
    setForwardLoading(true);
    try {
      await props.onForwardMessage(forwardMessageId, selectedForwardConversation);
      setForwardDialogOpen(false);
      showToast('消息转发成功', 'success');
    } catch (error) {
      console.error('转发消息失败:', error);
      showToast('转发消息失败，请重试', 'error');
    } finally {
      setForwardLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => setToast(null), 300);
    }, 3000);
  }

  async function deleteMessage(messageId: string): Promise<void> {
    const message = props.messages.find((m: MessageItem) => m.id === messageId);
    if (!message) {
      return;
    }
    if (message.senderId !== props.currentUserId) {
      showToast('只能撤回自己发送的消息', 'error');
      return;
    }
    if (message.isRevoked) {
      showToast('消息已撤回', 'info');
      return;
    }
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      messageId,
      message,
    });
  }

  async function confirmDelete(): Promise<void> {
    if (!confirmDialog?.messageId) {
      return;
    }
    try {
      await import('../../core/api').then(({ revokeMessage }) => revokeMessage(confirmDialog.messageId));
      showToast('消息已撤回', 'success');
      // 刷新会话以更新消息列表，确保用户能立即看到删除效果
      await props.onRefreshConversation();
      setConfirmDialog(null);
    } catch (error) {
      console.error('撤回消息失败:', error);
      showToast('撤回消息失败，请重试', 'error');
    }
  }

  return (
    <>
      <section className="chat-panel card telegram-chat">
      <TopBar
        type={props.activeConversation?.type === 2 ? 'group' : 'chat'}
        avatar={getInitial(peerName)}
        name={peerName}
        status={statusText}
        isOnline={props.activeConversation?.peerUser?.isOnline ?? false}
        memberCount={props.activeConversation?.type === 2 ? props.activeConversation.groupInfo?.memberCount : undefined}
        onSearch={() => {
          setSearchOpen((v) => {
            const next = !v;
            if (!next) {
              setSearchKeyword('');
              setFocusedMessageId('');
            }
            return next;
          });
        }}
        moreMenu={
          <ChatMoreMenu
            type={props.activeConversation?.type === 2 ? 'group' : 'chat'}
            burnEnabled={props.burnEnabled}
            isPinned={props.isConversationPinned}
            isMuted={props.isConversationMuted}
            onToggleBurn={() => {
              props.onBurnEnabledChange(!props.burnEnabled);
            }}
            onTogglePin={() => {
              if (props.activeConversationId) {
                props.onToggleConversationPin(props.activeConversationId);
              }
            }}
            onToggleMute={() => {
              if (props.activeConversationId) {
                props.onToggleConversationMute(props.activeConversationId);
              }
            }}
            onDeleteConversation={() => {
              if (props.activeConversationId) {
                setDeleteConfirmOpen(true);
              }
            }}
          >
            <button className="chat-action-btn" aria-label="更多">
              <span className="material-symbols-rounded">more_vert</span>
            </button>
          </ChatMoreMenu>
        }
      />

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
          <div className="chat-empty">
            <p>请选择一个会话开始聊天</p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="chat-empty">
            <p>暂无聊天消息</p>
          </div>
        ) : (
          <>
            {props.hasMoreHistory && visibleMessages.length >= displayedMessageCount ? (
              <div className="history-loader">
                {props.loadingMoreHistory ? (
                  <span className="spinner" />
                ) : (
                  <button type="button" onClick={() => void props.onLoadOlderMessages()}>
                    加载更早消息
                  </button>
                )}
              </div>
            ) : props.hasMoreHistory ? (
              <div className="history-loader">
                <button type="button" onClick={() => void props.onLoadOlderMessages()} disabled={props.loadingMoreHistory}>
                  {props.loadingMoreHistory ? (
                    <>
                      <span className="spinner" />
                      加载中...
                    </>
                  ) : '查看更早消息'}
                </button>
              </div>
            ) : (
              <div className="history-end">
                <span>没有更早消息了</span>
              </div>
            )}
            {displayedMessages.map((row) => {
              const decoded = props.decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
              const payload = parsePayload(decoded);
              const isOut = row.senderId === props.currentUserId;
              const isBurning = burningMessageIds.has(row.id);
              const isRevoked = row.isRevoked;
              const burnCountdown = burnCountdowns[row.id];
              const showBurnTimer = row.isBurn && burnCountdown !== undefined && burnCountdown > 0 && !isBurning;

              // 构建 MessageBubble 所需的数据
              const bubbleContent = resolveMediaBubbleContent(
                row.messageType as 1 | 2 | 3 | 4,
                payload,
                row.messageType === 2 ? imageSourceMap[row.id] : row.messageType === 3 ? audioSourceMap[row.id] : undefined,
              );
              const canCopy = Boolean(getCopyableText(row, payload));
              const isVideoMessage = row.messageType === 4 && isVideoMediaPayload(payload);
              const fileSize = formatMediaSize(resolveMediaSize(payload));

              const bubbleStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' = isRevoked
                ? 'sent'
                : row.localDeliveryState === 'queued' || row.localDeliveryState === 'sending'
                ? 'sending'
                : row.localDeliveryState === 'failed'
                ? 'failed'
                : row.readAt
                ? 'read'
                : row.deliveredAt
                ? 'delivered'
                : 'sent';

              const bubbleReplyTo = payload.replyTo
                ? {
                    sender: payload.replyTo.senderId === props.currentUserId ? '我' : '对方',
                    text: payload.replyTo.text || '[图片]',
                  }
                : undefined;

              return (
                <article
                  key={row.id}
                  data-msg-id={row.id}
                  data-msg-type={row.messageType}
                  className={`${isOut ? 'message self' : 'message'}${focusedMessageId === row.id ? ' focused' : ''}${isBurning ? ' message-burning' : ''}${isRevoked ? ' message-revoked' : ''}`}
                >
                  <MessageContextMenu
                    messageType={row.messageType as 1 | 2 | 3 | 4}
                    isOwn={isOut}
                    isRevoked={!!isRevoked}
                    canCopy={canCopy}
                    onCopy={() => copyMessage(row.id)}
                    onReply={() => replyMessage(row.id)}
                    onForward={() => forwardMessage(row.id)}
                    onDownload={([2, 4].includes(row.messageType) && !isRevoked) ? () => downloadMedia(row) : undefined}
                    onDelete={() => deleteMessage(row.id)}
                  >
                    <MessageBubble
                      type={isOut ? 'out' : 'in'}
                      messageType={row.messageType}
                      content={String(bubbleContent)}
                      time={formatTime(row.createdAt)}
                      status={bubbleStatus}
                      isBurn={row.isBurn && !isRevoked}
                      burnSeconds={showBurnTimer ? burnCountdown : undefined}
                      replyTo={bubbleReplyTo}
                      fileName={resolveMediaFileName(payload)}
                      fileSize={fileSize}
                      mediaVariant={isVideoMessage ? 'video' : 'file'}
                      voiceDuration={undefined}
                      mediaError={mediaErrorMap[row.id]}
                      role={row.messageType === 2 || row.messageType === 3 || row.messageType === 4 ? 'button' : undefined}
                      tabIndex={row.messageType === 2 || row.messageType === 3 || row.messageType === 4 ? 0 : undefined}
                      onClick={() => {
                        if (row.messageType === 2) {
                          void openImagePreview(row, payload);
                        } else if (row.messageType === 3) {
                          void playAudioMessage(row, payload);
                        }
                      }}
                      onDoubleClick={() => {
                        if (row.messageType === 4) {
                          void downloadMedia(row);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return;
                        }
                        event.preventDefault();
                        if (row.messageType === 2) {
                          void openImagePreview(row, payload);
                        } else if (row.messageType === 3) {
                          void playAudioMessage(row, payload);
                        } else if (row.messageType === 4) {
                          void downloadMedia(row);
                        }
                      }}
                      className={row.messageType === 2 || row.messageType === 3 || row.messageType === 4 ? 'message-media-interactive' : undefined}
                      onRetry={
                        row.localDeliveryState === 'failed'
                          ? () => void props.onRetryMessage(row.id)
                          : undefined
                      }
                    />
                  </MessageContextMenu>
                  {showBurnTimer ? (
                    <span className="message-burn-countdown">
                      <span className="material-symbols-rounded">check_circle</span>
                      {burnCountdown}s
                    </span>
                  ) : row.isBurn && !isRevoked && !isOut ? (
                    <button type="button" className="message-burn-btn" onClick={() => void props.onTriggerBurn(row.id)}>
                      焚毁
                    </button>
                  ) : null}
                </article>
              );
            })}
          </>
        )}
      </div>

      <footer className="composer-area">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // 创建本地预览 URL
              const previewUrl = URL.createObjectURL(file);
              setPendingAttachment({ file, previewUrl });
              void props.onAttachMedia(file);
            }
            e.currentTarget.value = '';
          }}
        />
        <form ref={composerFormRef} onSubmit={props.onSubmit} className="composer">
          {props.replyToMessage ? (
            <div className="reply-preview">
              <div className="reply-preview-content">
                <div className="reply-preview-header">
                  <span className="reply-preview-label">引用</span>
                  <span className="reply-preview-sender">
                    {props.replyToMessage.senderId === props.currentUserId ? '我' : '对方'}
                  </span>
                </div>
                <div className="reply-preview-text">
                  {(() => {
                    const replyMsg = props.replyToMessage;
                    const payload = parsePayload(
                      props.decodePayload(
                        replyMsg.encryptedPayload,
                        replyMsg.senderId,
                        replyMsg.sourceDeviceId,
                      ),
                    );
                    const content = payload.text || (replyMsg.messageType === 2 ? '[图片]' : replyMsg.messageType === 3 ? '[语音]' : '[文件]');
                    return content.slice(0, 60) + (content.length > 60 ? '...' : '');
                  })()}
                </div>
              </div>
              <button
                type="button"
                className="reply-preview-close"
                onClick={() => props.onReplyToMessageChange(null)}
                aria-label="取消引用"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
          ) : null}
          {pendingAttachment ? (
            <div className="attachment-preview">
              {pendingAttachment.file.type.startsWith('image/') ? (
                <img src={pendingAttachment.previewUrl} alt="附件预览" className="attachment-preview-image" />
              ) : (
                <div className="attachment-preview-file">
                  <span className="material-symbols-rounded">description</span>
                  <span>{pendingAttachment.file.name}</span>
                </div>
              )}
              <button
                type="button"
                className="attachment-preview-close"
                onClick={() => {
                  if (pendingAttachment) {
                    URL.revokeObjectURL(pendingAttachment.previewUrl);
                    setPendingAttachment(null);
                  }
                  props.onCancelMediaAttachment();
                }}
                aria-label="取消附件"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
          ) : null}
          <div className="composer-input-wrapper">
            <textarea
              value={props.messageText}
              onChange={(e) => props.onMessageTextChange(e.target.value)}
              placeholder="输入消息，按 Enter 发送"
              onFocus={props.onStartTyping}
              onBlur={props.onStopTyping}
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
              className="send-btn"
              disabled={
                !hasActiveConversation ||
                props.sendingMessage ||
                props.mediaUploading ||
                !props.messageText.trim()
              }
              aria-label="发送消息"
            >
              <span className="material-symbols-rounded">send</span>
            </button>
          </div>
        </form>
        <div className="composer-tools">
          <button
            type="button"
            className="composer-tool-btn"
            disabled={!hasActiveConversation || props.mediaUploading}
            aria-label="附加"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="material-symbols-rounded">attach_file</span>
          </button>
          <button
            type="button"
            className="composer-tool-btn"
            disabled={!hasActiveConversation}
            aria-label="表情"
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <span className="material-symbols-rounded">emoji_emotions</span>
          </button>
          <button
            type="button"
            className="composer-tool-btn"
            disabled={!hasActiveConversation}
            aria-label="麦克风"
          >
            <span className="material-symbols-rounded">mic</span>
          </button>
        </div>
        {emojiOpen ? (
          <>
            <div className="emoji-picker-overlay" onClick={() => setEmojiOpen(false)} />
            <EmojiPicker
              onSelect={(emoji) => {
                appendEmoji(emoji);
                setEmojiOpen(false);
              }}
              onClose={() => setEmojiOpen(false)}
            />
          </>
        ) : null}
        <small className="typing-hint">
          {props.mediaUploading ? '媒体上传中...' : props.sendingMessage ? '发送中...' : props.typingHint || ' '}
        </small>
      </footer>
    </section>

    {/* 图片预览模态框 */}
    {imagePreviewOpen ? (
      <div className="image-preview-overlay" onClick={closeImagePreview}>
        <button className="image-preview-close" onClick={closeImagePreview} aria-label="关闭预览">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </button>
        <img src={imagePreviewSrc} alt="预览" className="image-preview-image" onClick={(e) => e.stopPropagation()} />
      </div>
    ) : null}

    {/* 转发对话框 */}
    {forwardDialogOpen ? (
      <div className="forward-dialog-overlay" onClick={() => !forwardLoading && setForwardDialogOpen(false)}>
        <div className="forward-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="forward-dialog-header">
            <h3>转发消息</h3>
            <button
              type="button"
              className="forward-dialog-close"
              onClick={() => setForwardDialogOpen(false)}
              disabled={forwardLoading}
              aria-label="关闭"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <div className="forward-dialog-content">
            {forwardConversations.length === 0 ? (
              <div className="forward-dialog-empty">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" fill="currentColor"/>
                </svg>
                <p>暂无会话</p>
              </div>
            ) : (
              <div className="forward-dialog-list">
                {forwardConversations.map((conv) => (
                  <label
                    key={conv.conversationId}
                    className={`forward-dialog-item ${selectedForwardConversation === conv.conversationId ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="forward-conversation"
                      value={conv.conversationId}
                      checked={selectedForwardConversation === conv.conversationId}
                      onChange={(e) => setSelectedForwardConversation(e.target.value)}
                      disabled={forwardLoading}
                    />
                    <span className="avatar" style={{ background: `var(--avatar-gradient-${(getAvatarColorIndex(conv.peerUser?.username || '') % 5) + 1})` }}>
                      {getInitial(conv.peerUser?.username)}
                    </span>
                    <span className="forward-dialog-item-name">
                      {conv.peerUser?.username || '未知用户'}
                    </span>
                    {selectedForwardConversation === conv.conversationId && (
                      <svg className="forward-dialog-check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="forward-dialog-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setForwardDialogOpen(false)}
              disabled={forwardLoading}
            >
              取消
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleForwardSubmit}
              disabled={forwardLoading || !selectedForwardConversation}
            >
              {forwardLoading ? (
                <>
                  <span className="spinner" />
                  转发中...
                </>
              ) : '转发'}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {/* 确认对话框 */}
    {confirmDialog?.open ? (
      <div className="confirm-dialog-overlay" onClick={() => setConfirmDialog(null)}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-dialog-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
          </div>
          <h3>确认撤回消息</h3>
          <p>撤回后，该消息将从双方聊天中删除，是否确认？</p>
          <div className="confirm-dialog-actions">
            <button type="button" className="ghost-btn" onClick={() => setConfirmDialog(null)}>
              取消
            </button>
            <button type="button" className="danger-btn" onClick={confirmDelete}>
              确认撤回
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {/* Toast 提示 */}
    {toast ? (
      <div className={`toast toast-${toast.type} ${toast.visible ? 'visible' : ''}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {toast.type === 'success' ? (
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
          ) : toast.type === 'error' ? (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
          ) : (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
          )}
        </svg>
        <span>{toast.message}</span>
      </div>
    ) : null}

    {/* 删除会话确认对话框 */}
    <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>删除会话</DialogTitle>
          <DialogDescription>
            确定要删除该会话吗？此操作会移除当前会话记录，且无法恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (props.activeConversationId) {
                setDeleteConfirmOpen(false);
                void props.onDeleteConversation(props.activeConversationId);
              }
            }}
          >
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
