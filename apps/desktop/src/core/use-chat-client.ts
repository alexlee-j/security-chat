/**
 * 文件名：use-chat-client.ts
 * 所属模块：桌面端-核心状态管理
 * 核心作用：实现聊天客户端的核心状态管理和业务逻辑，包括用户认证、WebSocket连接、
 *          消息收发、会话管理、好友关系、加密解密等完整聊天功能
 * 核心依赖：React Hooks、Socket.IO Client、API模块、secure-storage安全存储
 * 创建时间：2024-01-01
 * 更新说明：2026-03-14 添加消息撤回事件监听、异步解密优化、Toast提示功能
 */

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getSecureJSON, setSecureJSON, getSecureItem, setSecureItem } from './secure-storage';
import { io, Socket } from 'socket.io-client';
import {
  ackReadOne,
  ackDelivered,
  ackRead,
  blockUser,
  createDirectConversation,
  deleteConversation,
  downloadMedia,
  decodePayload as decodePayloadApi,
  decodePayloadAsync,
  sendForgotPasswordCode,
  resetPasswordWithCode,
  getConversationBurnDefault,
  getBlockedUsers,
  getConversations,
  getDevicesByUserIds,
  getFriends,
  getIncomingRequests,
  getMessages,
  login,
  loginWithCode,
  logout,
  requestFriend,
  register,
  respondFriend,
  searchUsers,
  sendMessage,
  sendLoginCode,
  setAuthToken,
  triggerBurn,
  unblockUser,
  uploadMedia,
  updateConversationBurnDefault,
  wsBaseUrl,
} from './api';
import { clearEncryptionKey } from './crypto';
import {
  AuthState,
  BlockedFriendItem,
  ConversationListItem,
  FriendListItem,
  FriendSearchItem,
  MessageItem,
  PendingFriendItem,
  WsConversationEvent,
} from './types';
import { useSignal } from './use-signal';
import { isSignalProtocolError, isExpectedSignalError } from './signal/errors';
import {
  storeCredentials,
  getStoredCredentials,
  clearCredentials,
  setRememberPassword,
  getRememberPassword,
  setAutoLogin,
  clearAutoLogin,
  clearAllAuthData,
  getDeviceIdForAccount,
  setDeviceIdForAccount,
} from './auth-storage';

const MESSAGE_CURSOR_STORAGE_KEY = 'security-chat.desktop.message-cursors.v1';
const MESSAGE_DRAFT_STORAGE_KEY = 'security-chat.desktop.message-drafts.v1';
const CONVERSATION_PREF_STORAGE_KEY = 'security-chat.desktop.conversation-prefs.v1';

async function loadMessageCursorSnapshot(): Promise<Record<string, number>> {
  return await getSecureJSON<Record<string, number>>(MESSAGE_CURSOR_STORAGE_KEY) || {};
}

async function saveMessageCursorSnapshot(snapshot: Record<string, number>): Promise<void> {
  await setSecureJSON(MESSAGE_CURSOR_STORAGE_KEY, snapshot);
}

async function loadMessageDraftSnapshot(): Promise<Record<string, string>> {
  return await getSecureJSON<Record<string, string>>(MESSAGE_DRAFT_STORAGE_KEY) || {};
}

async function saveMessageDraftSnapshot(snapshot: Record<string, string>): Promise<void> {
  await setSecureJSON(MESSAGE_DRAFT_STORAGE_KEY, snapshot);
}

async function loadConversationPrefSnapshot(): Promise<{ pinned: string[]; muted: string[] }> {
  return await getSecureJSON<{ pinned: string[]; muted: string[] }>(CONVERSATION_PREF_STORAGE_KEY) || { pinned: [], muted: [] };
}

async function saveConversationPrefSnapshot(snapshot: { pinned: string[]; muted: string[] }): Promise<void> {
  await setSecureJSON(CONVERSATION_PREF_STORAGE_KEY, snapshot);
}

/**
 * 聊天客户端状态类型定义
 * 包含用户认证、会话、消息、好友等完整状态
 */
export type ChatClientState = {
  auth: AuthState | null;
  authMode: 'login' | 'register' | 'code' | 'forgot-password';
  account: string;
  registerEmail: string;
  /** 忘记密码 - 邮箱 */
  forgotEmail: string;
  /** 忘记密码 - 验证码 */
  forgotCode: string;
  /** 忘记密码 - 新密码 */
  forgotPassword: string;
  /** 忘记密码 - 确认密码 */
  forgotConfirmPassword: string;
  /** 忘记密码 - 验证码是否已发送 */
  forgotCodeSent: boolean;
  /** 忘记密码 - 重新发送倒计时 */
  forgotCooldown: number;
  loginCode: string;
  codeHint: string;
  password: string;
  authSubmitting: boolean;
  sendingLoginCode: boolean;
  loginCodeCooldown: number;
  /** 是否记住密码 */
  rememberPassword: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  error: string;
  /** Toast 提示状态 */
  toast: { message: string; type: 'success' | 'error' | 'info'; visible: boolean } | null;
  conversations: ConversationListItem[];
  /** 会话草稿：key为conversationId，value为草稿内容 */
  messageDrafts: Record<string, string>;
  pinnedConversationIds: string[];
  mutedConversationIds: string[];
  unreadTotal: number;
  activeConversationId: string;
  messages: MessageItem[];
  hasMoreHistory: boolean;
  loadingMoreHistory: boolean;
  messageText: string;
  messageType: 1 | 2 | 3 | 4;
  mediaUrl: string;
  mediaUploading: boolean;
  sendingMessage: boolean;
  burnEnabled: boolean;
  burnDuration: number;
  replyToMessage: MessageItem | null;
  peerUserId: string;
  creatingDirect: boolean;
  typingHint: string;
  friendKeyword: string;
  friendSearchResults: FriendSearchItem[];
  incomingRequests: PendingFriendItem[];
  friends: FriendListItem[];
  blockedUsers: BlockedFriendItem[];
};

export type ChatClientActions = {
  setAuthMode: (value: 'login' | 'register' | 'code' | 'forgot-password') => void;
  setAccount: (value: string) => void;
  setRegisterEmail: (value: string) => void;
  setForgotEmail: (value: string) => void;
  setForgotCode: (value: string) => void;
  setForgotPassword: (value: string) => void;
  setForgotConfirmPassword: (value: string) => void;
  setLoginCode: (value: string) => void;
  setPassword: (value: string) => void;
  setRememberPassword: (value: boolean) => void;
  setAutoLogin: (value: boolean) => void;
  setAuth: (auth: AuthState | null) => void;
  setMessageText: (value: string) => void;
  setMessageType: (value: 1 | 2 | 3 | 4) => void;
  setMediaUrl: (value: string) => void;
  setBurnEnabled: (value: boolean) => void;
  setBurnDuration: (value: number) => void;
  setReplyToMessage: (message: MessageItem | null) => void;
  setPeerUserId: (value: string) => void;
  setActiveConversationId: (value: string) => void;
  toggleConversationPin: (conversationId: string) => void;
  toggleConversationMute: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  setFriendKeyword: (value: string) => void;
  onLogin: (
    event: FormEvent<HTMLFormElement>,
    loginAccount?: string,
    loginPassword?: string,
    rememberOverride?: boolean,
    autoLoginOverride?: boolean,
  ) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
  onSendLoginCode: (accountOverride?: string) => Promise<void>;
  onLoginWithCode: (event: FormEvent<HTMLFormElement>, codeAccount?: string, codeValue?: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onSendForgotCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateDirect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSearchFriends: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRequestFriend: (targetUserId: string) => Promise<void>;
  onRespondFriend: (requesterUserId: string, accept: boolean) => Promise<void>;
  onBlockUser: (targetUserId: string) => Promise<void>;
  onUnblockUser: (targetUserId: string) => Promise<void>;
  onTriggerBurn: (messageId: string) => Promise<void>;
  onRefreshFriendData: () => Promise<void>;
  onRefreshActiveConversation: () => Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onAttachMedia: (file: File) => Promise<void>;
  onOpenMedia: (message: MessageItem) => Promise<void>;
  onResolveMediaUrl: (message: MessageItem) => Promise<string | null>;
  onReadMessageOnce: (message: MessageItem) => Promise<void>;
  onStartDirectConversation: (targetUserId: string) => Promise<void>;
  onForwardMessage: (originalMessageId: string, targetConversationId: string) => Promise<{ messageId: string; messageIndex: string }>;
  startTyping: () => void;
  stopTyping: () => void;
};

/**
 * 聊天客户端 Hook
 * @returns 包含状态、操作、当前会话和解码函数的对象
 * @description 核心状态管理Hook，整合用户认证、WebSocket连接、消息收发、会话管理等功能
 */
export function useChatClient(): {
  state: ChatClientState;
  actions: ChatClientActions;
  activeConversation: ConversationListItem | null;
  decodePayload: (payload: string) => string;
} {
  // ==================== Signal协议 ====================
  const { state: signalState, actions: signalActions } = useSignal();

  // ==================== 认证相关状态 ====================
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'code' | 'forgot-password'>('login');
  const [account, setAccount] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotCodeSent, setForgotCodeSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [loginCode, setLoginCode] = useState('');
  const [codeHint, setCodeHint] = useState('');
  const [password, setPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [sendingLoginCode, setSendingLoginCode] = useState(false);
  const [loginCodeCooldown, setLoginCodeCooldown] = useState(0);
  const [rememberPassword, setRememberPasswordState] = useState(false);
  const [autoLogin, setAutoLoginState] = useState(false);
  const [error, setError] = useState('');
  
  // ==================== Toast 提示状态 ====================
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean } | null>(null);
  
  // ==================== 会话相关状态 ====================
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([]);
  const [mutedConversationIds, setMutedConversationIds] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  
  // ==================== 消息相关状态 ====================
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<1 | 2 | 3 | 4>(1);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // ==================== 阅后即焚相关状态 ====================
  const [burnEnabled, setBurnEnabled] = useState(false);
  const [burnDuration, setBurnDuration] = useState(30);
  const [replyToMessage, setReplyToMessage] = useState<MessageItem | null>(null);
  // ==================== 好友相关状态 ====================
  const [peerUserId, setPeerUserId] = useState('');
  const [creatingDirect, setCreatingDirect] = useState(false);
  const [typingHint, setTypingHint] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friendKeyword, setFriendKeyword] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingFriendItem[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedFriendItem[]>([]);

  // ==================== Refs ====================
  const activeConversationIdRef = useRef('');           // 活跃会话ID引用
  const authRef = useRef<AuthState | null>(null);       // 认证信息引用
  const messagesRef = useRef<MessageItem[]>([]);        // 消息列表引用
  const messageCursorRef = useRef<Record<string, number>>({});  // 消息游标引用
  const fallbackPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);  // 轮询定时器
  const pendingMediaAssetIdRef = useRef<string | null>(null);  // 待上传媒体ID
  const messageDraftRef = useRef<Record<string, string>>({});  // 消息草稿引用
  const autoBurnPendingRef = useRef<Set<string>>(new Set());   // 待焚毁消息集合
  // 解密缓存：Map<encryptedPayload, decryptedPayload>
  const payloadCacheRef = useRef<Map<string, string>>(new Map());
  // Toast 定时器引用，用于清理
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 解密消息 payload
   * @param payload - 加密的 payload 字符串
   * @param senderId - 发送者ID（用于Signal协议解密）
   * @param sourceDeviceId - 发送设备ID（用于Signal协议解密）
   * @returns 解密后的字符串
   * @description 使用缓存机制避免重复解密，提升性能
   */
  const decodePayload = async (payload: string, senderId?: string, sourceDeviceId?: string): Promise<string> => {
    if (payloadCacheRef.current.has(payload)) {
      return payloadCacheRef.current.get(payload)!;
    }
    try {
      let decrypted: string;

      // 尝试使用Signal协议解密
      if (signalState.initialized && senderId) {
        // 如果是自己发送的消息，跳过Signal解密，使用默认解密
        if (senderId === authRef.current?.userId) {
          decrypted = decodePayloadApi(payload);
        } else {
          // Rust-only 模式：sourceDeviceId 是必填的，不再接受 '1' 作为回退
          if (!sourceDeviceId) {
            throw new Error('sourceDeviceId is required for Signal decryption in Rust-only mode');
          }
          decrypted = await signalActions.decryptMessage(senderId, sourceDeviceId, payload);
        }
      } else {
        // 使用默认解密
        decrypted = decodePayloadApi(payload);
      }

      payloadCacheRef.current.set(payload, decrypted);
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return payload;
    }
  };

  /**
   * 根据消息ID获取已解密的明文（用于转发等场景）
   * @param messageId - 消息ID
   * @returns 解密后的明文，如果未找到则返回 null
   */
  const getDecryptedTextByMessageId = (messageId: string): string | null => {
    return payloadCacheRef.current.get(`msg:${messageId}`) ?? null;
  };

  // 同步版本的 decodePayload，用于渲染
  // 对于已缓存的 payload 直接返回，未缓存的触发异步解密并返回占位符
  const decodePayloadSync = (payload: string): string => {
    if (payloadCacheRef.current.has(payload)) {
      return payloadCacheRef.current.get(payload)!;
    }

    // 检测是否是 Signal 加密的 JSON 格式
    // Signal 加密消息格式：{"version":3,"baseKey":"...","ciphertext":"...",...}
    const trimmedPayload = payload.trim();
    const isSignalJsonFormat = trimmedPayload.startsWith('{');

    if (isSignalJsonFormat && signalState.initialized) {
      // Signal 加密的 JSON 消息，触发异步解密
      setTimeout(() => {
        if (!payloadCacheRef.current.has(payload)) {
          const message = messagesRef.current.find(m => m.encryptedPayload === payload);
          if (message) {
            void decodePayload(payload, message.senderId, message.sourceDeviceId);
          }
        }
      }, 0);
      // 返回占位符，避免显示加密内容
      return '';
    }

    // 尝试同步解密（仅支持旧版 Base64 格式）
    try {
      const decrypted = decodeURIComponent(escape(atob(trimmedPayload)));
      payloadCacheRef.current.set(payload, decrypted);
      return decrypted;
    } catch {
      // Base64 解密失败
    }

    // 如果都不是，返回原始 payload
    return payload;
  };

  /**
   * 显示 Toast 提示
   * @param message - 提示消息
   * @param type - 提示类型：success | error | info
   */
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // 清理之前的定时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
    }

    setToast({ message, type, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      toastHideTimerRef.current = setTimeout(() => setToast(null), 300);
    }, 3000);
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );
  const unreadTotal = useMemo(
    () =>
      conversations.reduce((sum, row) => {
        if (mutedConversationIds.includes(row.conversationId)) {
          return sum;
        }
        return sum + Number(row.unreadCount || 0);
      }, 0),
    [conversations, mutedConversationIds],
  );

  const isBurnExpired = (row: MessageItem, nowMs = Date.now()): boolean => {
    if (!row.isBurn || !row.readAt || !row.burnDuration) {
      return false;
    }
    const readAtMs = Date.parse(row.readAt);
    if (Number.isNaN(readAtMs)) {
      return false;
    }
    return readAtMs + row.burnDuration * 1000 <= nowMs;
  };

  function applyReadAckToActiveMessages(
    conversationId: string,
    maxMessageIndex: string | number,
    ackByUserId: string,
    ackAt: string,
  ): void {
    if (!conversationId || activeConversationIdRef.current !== conversationId) {
      return;
    }
    const maxIndex = Number(maxMessageIndex);
    if (!Number.isFinite(maxIndex) || maxIndex <= 0) {
      return;
    }
    setMessages((prev) =>
      prev.map((row) => {
        const rowIndex = Number(row.messageIndex);
        if (!Number.isFinite(rowIndex) || rowIndex > maxIndex) {
          return row;
        }
        if (row.senderId === ackByUserId) {
          return row;
        }
        return {
          ...row,
          deliveredAt: row.deliveredAt ?? ackAt,
          readAt: row.readAt ?? ackAt,
        };
      }),
    );
  }

  const mergeMessages = (prev: MessageItem[], incoming: MessageItem[]): MessageItem[] => {
    if (incoming.length === 0) {
      return prev;
    }
    const merged = new Map<string, MessageItem>();
    for (const row of prev) {
      merged.set(row.id, row);
    }
    for (const row of incoming) {
      merged.set(row.id, row);
    }
    return Array.from(merged.values()).sort((a, b) => Number(a.messageIndex) - Number(b.messageIndex));
  };

  async function loadConversations(): Promise<ConversationListItem[]> {
    const rows = await getConversations();
    const dedupedRows = rows.filter(
      (row, index, array) => array.findIndex((item) => item.conversationId === row.conversationId) === index,
    );
    setConversations(dedupedRows);
    if (!activeConversationIdRef.current && dedupedRows.length > 0) {
      setActiveConversationId(dedupedRows[0].conversationId);
    }
    return dedupedRows;
  }

  function updateConversationCursor(conversationId: string, indexValue: number): void {
    if (!conversationId || !Number.isFinite(indexValue) || indexValue < 0) {
      return;
    }
    const current = messageCursorRef.current[conversationId] ?? 0;
    if (indexValue <= current) {
      return;
    }
    messageCursorRef.current = {
      ...messageCursorRef.current,
      [conversationId]: indexValue,
    };
    saveMessageCursorSnapshot(messageCursorRef.current);
  }

  async function loadMessages(conversationId: string): Promise<void> {
    try {
      const rows = await getMessages(conversationId, 0, 100);
      
      // 预先解密消息
      for (const row of rows) {
        if (!payloadCacheRef.current.has(row.encryptedPayload)) {
          try {
            const decrypted = await decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
            payloadCacheRef.current.set(row.encryptedPayload, decrypted);
            // 同时按消息ID缓存，支持通过ID查找明文（如转发场景）
            payloadCacheRef.current.set(`msg:${row.id}`, decrypted);
          } catch (error) {
            console.error('Decryption failed:', error);
          }
        }
      }
      
      const nowMs = Date.now();
      setMessages(rows.filter((row) => !isBurnExpired(row, nowMs)));
      setHasMoreHistory(rows.length >= 100);

      const maxIndex = rows.reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0);
      updateConversationCursor(conversationId, maxIndex);
      if (maxIndex > 0) {
        await Promise.all([ackDelivered(conversationId, maxIndex), ackRead(conversationId, maxIndex)])
          .then(() => {
            if (authRef.current) {
              applyReadAckToActiveMessages(conversationId, maxIndex, authRef.current.userId, new Date().toISOString());
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      setError('加载消息失败，请稍后重试。');
      setMessages([]);
      setHasMoreHistory(false);
    }
  }

  async function syncMessagesDelta(conversationId: string): Promise<void> {
    try {
      const currentRows = activeConversationIdRef.current === conversationId ? messagesRef.current : [];
      const localCursor = messageCursorRef.current[conversationId] ?? 0;
      const activeMax =
        activeConversationIdRef.current === conversationId
          ? messagesRef.current.reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0)
          : 0;
      const afterIndex = Math.max(localCursor, activeMax);
      const rows = await getMessages(conversationId, afterIndex, 100);
      
      if (rows.length > 0) {
        // 预先解密新消息
        for (const row of rows) {
          if (!payloadCacheRef.current.has(row.encryptedPayload)) {
            try {
              const decrypted = await decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
              payloadCacheRef.current.set(row.encryptedPayload, decrypted);
              // 同时按消息ID缓存，支持通过ID查找明文（如转发场景）
              payloadCacheRef.current.set(`msg:${row.id}`, decrypted);
            } catch (error) {
              console.error('Decryption failed:', error);
            }
          }
        }
        
        const nowMs = Date.now();
        setMessages((prev) => mergeMessages(prev, rows).filter((row) => !isBurnExpired(row, nowMs)));
      }
      const latestMax = [...currentRows, ...rows].reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0);
      updateConversationCursor(conversationId, latestMax);
      if (latestMax > 0) {
        await Promise.all([ackDelivered(conversationId, latestMax), ackRead(conversationId, latestMax)])
          .then(() => {
            if (authRef.current) {
              applyReadAckToActiveMessages(conversationId, latestMax, authRef.current.userId, new Date().toISOString());
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('同步消息失败:', error);
      // 同步消息失败不设置错误状态，避免影响用户体验
    }
  }

  async function syncConversationCursor(conversationId: string, applyToActive: boolean): Promise<void> {
    try {
      const afterIndex = messageCursorRef.current[conversationId] ?? 0;
      const rows = await getMessages(conversationId, afterIndex, 100);
      if (rows.length === 0) {
        return;
      }

      // 预先解密新消息
      for (const row of rows) {
        if (!payloadCacheRef.current.has(row.encryptedPayload)) {
          try {
            const decrypted = await decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
            payloadCacheRef.current.set(row.encryptedPayload, decrypted);
            // 同时按消息ID缓存，支持通过ID查找明文（如转发场景）
            payloadCacheRef.current.set(`msg:${row.id}`, decrypted);
          } catch (error) {
            console.error('Decryption failed:', error);
          }
        }
      }

      const maxIndex = rows.reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0);
      updateConversationCursor(conversationId, maxIndex);

      if (applyToActive && activeConversationIdRef.current === conversationId) {
        const nowMs = Date.now();
        setMessages((prev) => mergeMessages(prev, rows).filter((row) => !isBurnExpired(row, nowMs)));
        await Promise.all([ackDelivered(conversationId, maxIndex), ackRead(conversationId, maxIndex)])
          .then(() => {
            if (authRef.current) {
              applyReadAckToActiveMessages(conversationId, maxIndex, authRef.current.userId, new Date().toISOString());
            }
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('同步会话游标失败:', error);
      // 同步会话游标失败不设置错误状态，避免影响用户体验
    }
  }

  async function onLoadOlderMessages(): Promise<void> {
    const conversationId = activeConversationIdRef.current;
    if (!conversationId || loadingMoreHistory || !hasMoreHistory) {
      return;
    }
    const oldestIndex = messagesRef.current.reduce((min, row) => {
      const current = Number(row.messageIndex);
      if (Number.isFinite(current) && current > 0) {
        return Math.min(min, current);
      }
      return min;
    }, Number.POSITIVE_INFINITY);
    if (!Number.isFinite(oldestIndex) || oldestIndex <= 1) {
      setHasMoreHistory(false);
      return;
    }

    setLoadingMoreHistory(true);
    try {
      const olderRows = await getMessages(conversationId, 0, 100, oldestIndex);
      // 预先解密新消息
      for (const row of olderRows) {
        if (!payloadCacheRef.current.has(row.encryptedPayload)) {
          try {
            const decrypted = await decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
            payloadCacheRef.current.set(row.encryptedPayload, decrypted);
            // 同时按消息ID缓存，支持通过ID查找明文（如转发场景）
            payloadCacheRef.current.set(`msg:${row.id}`, decrypted);
          } catch (error) {
            console.error('Decryption failed:', error);
          }
        }
      }
      const nowMs = Date.now();
      setMessages((prev) => mergeMessages(olderRows, prev).filter((row) => !isBurnExpired(row, nowMs)));
      const oldestFetched = olderRows.reduce((min, row) => Math.min(min, Number(row.messageIndex)), oldestIndex);
      if (olderRows.length < 100 || oldestFetched <= 1) {
        setHasMoreHistory(false);
      }
    } catch (error) {
      console.error('加载历史消息失败:', error);
      setError('加载历史消息失败，请稍后重试。');
    } finally {
      setLoadingMoreHistory(false);
    }
  }

  async function onRefreshActiveConversation(): Promise<void> {
    if (!activeConversationIdRef.current) {
      return;
    }
    await Promise.all([loadMessages(activeConversationIdRef.current), loadConversations()]);
  }

  function stopFallbackPolling(): void {
    if (fallbackPollTimerRef.current) {
      clearInterval(fallbackPollTimerRef.current);
      fallbackPollTimerRef.current = null;
    }
  }

  function startFallbackPolling(): void {
    if (!authRef.current) {
      return;
    }
    if (fallbackPollTimerRef.current) {
      return;
    }
    fallbackPollTimerRef.current = setInterval(() => {
      if (!authRef.current) {
        stopFallbackPolling();
        return;
      }
      void loadConversations();
      if (activeConversationIdRef.current) {
        void syncMessagesDelta(activeConversationIdRef.current);
      }
    }, 5000);
  }

  async function onLogin(
    event: FormEvent<HTMLFormElement>,
    loginAccount?: string,
    loginPassword?: string,
    rememberOverride?: boolean,
    autoLoginOverride?: boolean,
  ): Promise<void> {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    // 优先使用传入的参数，否则使用状态中的值（用于兼容自动登录等场景）
    // 注意：使用 !== undefined 判断，因为空字符串是有效值，不应回退到状态
    const accountToUse = loginAccount !== undefined ? loginAccount : account;
    const passwordToUse = loginPassword !== undefined ? loginPassword : password;
    const rememberToUse = rememberOverride ?? rememberPassword;
    const autoLoginToUse = autoLoginOverride ?? autoLogin;
    setAuthSubmitting(true);
    try {
      const rememberedDeviceId = await getDeviceIdForAccount(accountToUse);
      const result = await login(accountToUse, passwordToUse, rememberedDeviceId ?? undefined);
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      await setDeviceIdForAccount(accountToUse, result.deviceId);

      if (rememberOverride !== undefined) {
        setRememberPasswordState(rememberToUse);
      }
      if (autoLoginOverride !== undefined) {
        setAutoLoginState(autoLoginToUse);
      }

      // 根据选项保存凭证
      if (rememberToUse) {
        await storeCredentials(accountToUse, passwordToUse);
        await setRememberPassword(true);
      } else {
        await clearCredentials();
        await setRememberPassword(false);
      }

      if (autoLoginToUse) {
        await setAutoLogin({
          enabled: true,
          refreshToken: result.refreshToken,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
      } else {
        await clearAutoLogin();
      }

      // 登录后初始化 Signal 协议并检查预密钥
      // 注意：initialize() 必须在 setDeviceId() 之前调用
      // 重要：通过 userId 参数隔离密钥存储（必须在 initialize 之前设置）
      try {
        await signalActions.initialize(result.userId);

        // 登录后获取设备列表并更新本地设备ID（在 initialize 之后）
        try {
          const devices = await import('./api').then((api) => api.getDevices());
          if (devices && devices.length > 0) {
            const selectedDevice = (result.deviceId
              ? devices.find((device) => device.deviceId === result.deviceId)
              : null) || devices[0];
            // 使用 Signal actions 设置设备ID
            await signalActions.setDeviceId(selectedDevice.deviceId);
            await setDeviceIdForAccount(accountToUse, selectedDevice.deviceId);
          }
        } catch (deviceError) {
          console.error('[Login] Failed to get devices:', deviceError);
        }

        // 上传预密钥（必须在 setDeviceId 之后调用）
        try {
          await signalActions.uploadPrekeys();
        } catch (uploadError) {
          console.error('[Login] Failed to upload prekeys:', uploadError);
          // 预密钥上传失败不影响登录
        }

        // 检查并补充预密钥
        const prekeysStatus = signalState.prekeysStatus;
        if (prekeysStatus && (!prekeysStatus.hasSignedPrekeys || !prekeysStatus.hasOneTimePrekeys || prekeysStatus.oneTimePrekeysCount < 100)) {
          await signalActions.replenishPrekeys();
        }
      } catch (signalError) {
        console.error('[Login] Failed to initialize Signal protocol:', signalError);
        // Signal 初始化失败不影响登录
      }

      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      showToast('登录失败，请检查账号密码或后端服务状态', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function onSendLoginCode(accountOverride?: string): Promise<void> {
    if (sendingLoginCode || loginCodeCooldown > 0) {
      return;
    }
    const accountValue = (accountOverride ?? account).trim();
    if (!accountValue) {
      showToast('请输入账号或邮箱', 'error');
      return;
    }
    // 验证输入格式是否为邮箱
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(accountValue);
    
    setSendingLoginCode(true);
    try {
      await sendLoginCode({ account: accountValue });
      setCodeHint(`验证码已发送至 ${isEmail ? accountValue : '您的邮箱'}`);
      setLoginCodeCooldown(60);
      showToast('验证码已发送', 'success');
    } catch {
      showToast('发送验证码失败，请稍后重试', 'error');
    } finally {
      setSendingLoginCode(false);
    }
  }

  async function onLoginWithCode(
    event: FormEvent<HTMLFormElement>,
    codeAccount?: string,
    codeValue?: string,
  ): Promise<void> {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    try {
      const accountToUse = (codeAccount ?? account).trim();
      const codeToUse = (codeValue ?? loginCode).trim();
      const rememberedDeviceId = await getDeviceIdForAccount(accountToUse);
      const result = await loginWithCode({ account: accountToUse, code: codeToUse, deviceId: rememberedDeviceId ?? undefined });
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      await setDeviceIdForAccount(accountToUse, result.deviceId);

      // 登录后初始化 Signal 协议并检查预密钥
      // 注意：initialize() 必须在 setDeviceId() 之前调用
      // 重要：通过 userId 参数隔离密钥存储（必须在 initialize 之前设置）
      try {
        await signalActions.initialize(result.userId);

        // 登录后获取设备列表并更新本地设备ID（在 initialize 之后）
        try {
          const devices = await import('./api').then((api) => api.getDevices());
          if (devices && devices.length > 0) {
            const selectedDevice = (result.deviceId
              ? devices.find((device) => device.deviceId === result.deviceId)
              : null) || devices[0];
            await signalActions.setDeviceId(selectedDevice.deviceId);
            await setDeviceIdForAccount(accountToUse, selectedDevice.deviceId);
          }
        } catch (deviceError) {
          console.error('[LoginWithCode] Failed to get devices:', deviceError);
        }

        // 上传预密钥（必须在 setDeviceId 之后调用）
        try {
          await signalActions.uploadPrekeys();
        } catch (uploadError) {
          console.error('[LoginWithCode] Failed to upload prekeys:', uploadError);
        }

        // 检查并补充预密钥
        const prekeysStatus = signalState.prekeysStatus;
        if (prekeysStatus && (!prekeysStatus.hasSignedPrekeys || !prekeysStatus.hasOneTimePrekeys || prekeysStatus.oneTimePrekeysCount < 100)) {
          await signalActions.replenishPrekeys();
        }
      } catch (signalError) {
        console.error('[LoginWithCode] Failed to initialize Signal protocol:', signalError);
        // Signal 初始化失败不影响登录
      }

      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      showToast('登录失败，请检查验证码或后端服务状态', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function onRegister(username: string, email: string, password: string): Promise<void> {
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // 基础非空验证
    if (!trimmedUsername || !trimmedEmail || !trimmedPassword) {
      showToast('请完整填写账号、邮箱和密码', 'error');
      setAuthSubmitting(false);
      return;
    }

    // 用户名格式验证（3-50字符）
    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      showToast('账号长度需在 3-50 个字符之间', 'error');
      setAuthSubmitting(false);
      return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('请输入有效的邮箱地址', 'error');
      setAuthSubmitting(false);
      return;
    }

    // 密码长度验证（8-64字符）
    if (trimmedPassword.length < 8 || trimmedPassword.length > 64) {
      showToast('密码长度需在 8-64 个字符之间', 'error');
      setAuthSubmitting(false);
      return;
    }

    try {
      const keyManager = new (await import('./signal/key-management')).KeyManager();
      const { RustSignalRuntime } = await import('./signal/rust-signal');
      const rustSignal = new RustSignalRuntime();
      await rustSignal.initializeIdentity();
      const registrationKeys = await rustSignal.getRegistrationKeys();

      // 检测操作系统类型
      const deviceType = detectDeviceType();

      const result = await register({
        username: trimmedUsername,
        email: trimmedEmail,
        phone: '', // 移除手机号输入，传入空字符串
        password: trimmedPassword,
        deviceName: 'desktop-client',
        deviceType,
        identityPublicKey: registrationKeys.identityPublicKey,
        signedPreKey: registrationKeys.signedPreKey,
        signedPreKeySignature: registrationKeys.signedPreKeySignature,
      });

      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });

      // 注册成功后，获取设备列表并更新本地设备ID
      try {
        // 等待认证令牌生效
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 获取设备列表
        const devices = await import('./api').then((api) => api.getDevices());
        if (devices && devices.length > 0) {
          const primaryDevice = devices[0]; // 假设第一个设备是主要设备
          
          // 更新本地存储中的设备ID
          await keyManager['secureStorage'].set('currentDeviceId', primaryDevice.deviceId);
          await setDeviceIdForAccount(trimmedUsername, primaryDevice.deviceId);
          await setDeviceIdForAccount(trimmedEmail, primaryDevice.deviceId);
        }
      } catch (deviceError) {
        console.error('Failed to get devices after registration:', deviceError);
      }

      // 上传 Rust 侧预密钥
      try {
        const { messageEncryptionService } = await import('./signal/message-encryption');
        // 使用在注册流程中创建的 keyManager，确保上传正确的预密钥
        await messageEncryptionService.uploadPrekeysWithKeyManager(keyManager);
      } catch (uploadError) {
        console.error('Failed to upload prekeys after registration:', uploadError);
        // 预密钥上传失败不影响注册成功，可以后续补充
      }
      setAuthMode('login');
      showToast('注册成功', 'success');
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch (error: any) {
      // 详细错误日志
      console.error('注册失败:', error);

      // 根据错误信息显示具体原因
      const errorData = error?.response?.data?.error || {};
      const errorMsg = errorData?.message || error?.response?.data?.message || error?.message || '';

      if (errorMsg.includes('already exists') || errorMsg.includes('User already exists')) {
        showToast('该账号或邮箱已被注册', 'error');
      } else if (errorMsg.includes('username')) {
        showToast('账号格式不正确（3-50字符）', 'error');
      } else if (errorMsg.includes('email')) {
        showToast('邮箱格式不正确', 'error');
      } else if (errorMsg.includes('password')) {
        showToast('密码长度需在 8-64 个字符之间', 'error');
      } else if (errorData?.code === 'VALIDATION_ERROR' || error?.response?.status === 400) {
        // 处理验证错误详情
        const details = errorData?.details || [];
        if (details.length > 0) {
          const firstError = details[0];
          showToast(`${firstError.field}: ${firstError.message}`, 'error');
        } else {
          showToast(errorMsg || '输入信息格式不正确，请检查', 'error');
        }
      } else {
        showToast('注册失败，请检查输入信息或稍后重试', 'error');
      }
    } finally {
      setAuthSubmitting(false);
    }
  }

  /**
   * 检测设备类型
   * @returns 'mac' | 'windows'
   * @description 后端目前只支持 mac/windows，Linux 默认返回 mac
   */
  /**
   * 检测设备类型
   * @returns 'mac' | 'windows' | 'linux'
   * @description 根据 navigator.platform 和 userAgent 检测操作系统类型
   */
  function detectDeviceType(): 'mac' | 'windows' | 'linux' {
    const platform = navigator.platform?.toLowerCase() || '';
    const userAgent = navigator.userAgent?.toLowerCase() || '';

    // Windows 检测
    if (platform.includes('win') || userAgent.includes('windows')) {
      return 'windows';
    }

    // macOS 检测
    if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
      return 'mac';
    }

    // Linux 检测
    if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'linux';
    }

    // 默认返回 mac（向后兼容）
    return 'mac';
  }



  async function onLogout(): Promise<void> {
    try {
      await logout();
    } catch {
      // Ignore logout API failure and continue local cleanup.
    }

    stopFallbackPolling();
    signalActions.resetRuntime();
    authRef.current = null;
    setAuthToken(null);
    setAuth(null);
    setAuthMode('login');
    setAccount('');
    setRegisterEmail('');
    setLoginCode('');
    setCodeHint('');
    setAuthSubmitting(false);
    setSendingLoginCode(false);
    setLoginCodeCooldown(0);
    setPassword('');
    setRememberPasswordState(false);
    setAutoLoginState(false);
    setError('');
    // 清除加密密钥
    clearEncryptionKey();
    
    // 清除认证相关的 localStorage，但保留 Signal 密钥和会话
    const signalKeys: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // 保留所有 Signal 相关的密钥和会话
      if (key && (
        key.includes('security-chat-identity') || 
        key.includes('security-chat-signed') || 
        key.includes('security-chat-oneTime') ||
        key.includes('security-chat-session') ||
        key.includes('security-chat-registrationId')
      )) {
        signalKeys[key] = localStorage.getItem(key)!;
      }
    }
    localStorage.clear();
    // 恢复 Signal 密钥
    Object.keys(signalKeys).forEach(key => {
      localStorage.setItem(key, signalKeys[key]);
    });
    
    setConversations([]);
    setActiveConversationId('');
    setMessages([]);
    setHasMoreHistory(true);
    setLoadingMoreHistory(false);
    setMessageText('');
    setMessageType(1);
    setMediaUrl('');
    setMediaUploading(false);
    setSendingMessage(false);
    setBurnEnabled(false);
    setBurnDuration(30);
    setPeerUserId('');
    setCreatingDirect(false);
    setTypingHint('');
    setFriendKeyword('');
    setFriendSearchResults([]);
    setIncomingRequests([]);
    setFriends([]);
    setBlockedUsers([]);
    pendingMediaAssetIdRef.current = null;
    messageCursorRef.current = {};
    saveMessageCursorSnapshot({});
    messageDraftRef.current = {};
    saveMessageDraftSnapshot({});
    setMessageDrafts({});
    setPinnedConversationIds([]);
    setMutedConversationIds([]);
    saveConversationPrefSnapshot({ pinned: [], muted: [] });

    // 清除记住密码和自动登录凭证
    await clearAllAuthData();
  }

  /**
   * 发送忘记密码验证码
   */
  async function onSendForgotCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAuthSubmitting(true);
    setError('');

    try {
      const result = await sendForgotPasswordCode(forgotEmail);
      showToast(result.message, 'success');
      setForgotCodeSent(true);
      setForgotCooldown(300); // 5分钟冷却
    } catch (error: any) {
      console.error('Send forgot code failed:', error);
      const message = error?.response?.data?.error?.message || error?.message || '发送失败，请稍后重试';
      setError(message);
      showToast(message, 'error');
    } finally {
      setAuthSubmitting(false);
    }
  }

  /**
   * 重置密码
   */
  async function onResetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    // 验证确认密码
    if (forgotPassword !== forgotConfirmPassword) {
      const msg = '两次输入的密码不一致';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    // 前端预校验密码强度
    const passwordRegex = /^(?=.*[0-9])(?=.*[a-zA-Z])/;
    if (!passwordRegex.test(forgotPassword)) {
      const msg = '密码必须包含数字和字母';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setAuthSubmitting(true);

    try {
      const result = await resetPasswordWithCode(forgotEmail, forgotCode, forgotPassword);
      showToast(result.message || '密码重置成功', 'success');

      // 重置表单状态
      setForgotEmail('');
      setForgotCode('');
      setForgotPassword('');
      setForgotConfirmPassword('');
      setForgotCodeSent(false);

      // 跳转登录页
      setAuthMode('login');
    } catch (error: any) {
      console.error('Reset password failed:', error);
      const message = error?.response?.data?.error?.message || error?.message || '重置失败，请稍后重试';
      setError(message);
      showToast(message, 'error');
    } finally {
      setAuthSubmitting(false);
    }
  }

  // 验证码倒计时效果
  useEffect(() => {
    if (loginCodeCooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setLoginCodeCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loginCodeCooldown]);

  async function onSendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sendingMessage) {
      return;
    }
    if (!activeConversationIdRef.current) {
      return;
    }

    const text = messageText.trim();
    if (messageType === 1 && !text) {
      return;
    }
    if (messageType !== 1 && !pendingMediaAssetIdRef.current) {
      setError('请先通过附件按钮上传媒体文件。');
      return;
    }
    if (mediaUploading) {
      setError('媒体上传中，请稍候再发送。');
      return;
    }

    setSendingMessage(true);
    try {
      const isBurnForThisMessage = messageType !== 4 && burnEnabled;
      
      // 构建 replyTo 信息
      const replyTo = replyToMessage
        ? {
            messageId: replyToMessage.id,
            senderId: replyToMessage.senderId,
            text: (() => {
              try {
                const decoded = decodePayloadSync(replyToMessage.encryptedPayload);
                const payload = JSON.parse(decoded);
                return payload.text || '[图片]';
              } catch {
                return '[消息]';
              }
            })(),
          }
        : undefined;

      // 构建消息内容
      const messageContent = {
        type: messageType,
        text: text || undefined,
        mediaUrl: messageType === 1 ? undefined : mediaUrl.trim() || undefined,
        fileName: messageType === 4 ? (mediaUrl.trim() || 'file') : undefined,
        replyTo,
      };

      // 序列化消息内容
      const messageText = JSON.stringify(messageContent);

      // 获取接收方信息
      const recipientUserId = activeConversation?.peerUser?.userId;
      if (!recipientUserId) {
        setError('无法获取接收方信息');
        return;
      }

      // 初始化 Signal 协议
      if (!signalState.initialized) {
        await signalActions.initialize(authRef.current?.userId);
      }

      // 获取接收方所有设备
      // 同时获取发送方设备（用于自同步），合并为一次 API 调用
      const currentUserId = authRef.current?.userId;
      const userIdsToQuery = currentUserId ? [recipientUserId, currentUserId] : [recipientUserId];
      const deviceInfoList = await getDevicesByUserIds(userIdsToQuery);
      const recipientDeviceInfo = deviceInfoList.find((info) => info.userId === recipientUserId);
      const recipientDevices = recipientDeviceInfo?.devices ?? [];
      if (recipientDevices.length === 0) {
        throw new Error('无法获取接收方设备信息');
      }

      // 对接收方所有设备进行加密（fan-out）
      const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const envelopes: Array<{ targetUserId: string; targetDeviceId: string; encryptedPayload: string }> = [];
      for (const recipientDevice of recipientDevices) {
        const encryptedPayload = await signalActions.encryptMessage(
          recipientUserId,
          recipientDevice.deviceId,
          messageText,
        );
        envelopes.push({
          targetUserId: recipientUserId,
          targetDeviceId: recipientDevice.deviceId,
          encryptedPayload,
        });
      }

      // 发送方自同步：覆盖当前设备 + 其他设备，确保“自己发送自己可见”。
      if (currentUserId) {
        const selfDeviceInfo = deviceInfoList.find((info) => info.userId === currentUserId);
        const selfDevices = selfDeviceInfo?.devices ?? [];
        for (const selfDevice of selfDevices) {
          const encryptedPayload = await signalActions.encryptMessage(
            currentUserId,
            selfDevice.deviceId,
            messageText,
          );
          envelopes.push({
            targetUserId: currentUserId,
            targetDeviceId: selfDevice.deviceId,
            encryptedPayload,
          });
        }
      }

      // 对于自己发送的消息，预先缓存明文，避免解密时无法显示
      // 注意：这里缓存的是同一份明文，因为所有 envelope 都是同一个 messageText 加密的
      for (const envelope of envelopes) {
        payloadCacheRef.current.set(envelope.encryptedPayload, messageText);
      }

      // 调用 send-v2 接口，提交所有设备信封
      const { sendMessageV2 } = await import('./api');
      const sendResult = await sendMessageV2({
        conversationId: activeConversationIdRef.current,
        messageType,
        nonce,
        envelopes,
        mediaAssetId: messageType === 1 ? undefined : pendingMediaAssetIdRef.current ?? undefined,
        isBurn: isBurnForThisMessage,
        burnDuration: isBurnForThisMessage ? burnDuration : undefined,
      });

      // 按消息ID缓存明文，支持后续转发等场景
      if (sendResult?.messageId) {
        payloadCacheRef.current.set(`msg:${sendResult.messageId}`, messageText);
      }
      setMessageText('');
      setReplyToMessage(null);
      if (activeConversationIdRef.current) {
        const nextDrafts = { ...messageDraftRef.current };
        delete nextDrafts[activeConversationIdRef.current];
        messageDraftRef.current = nextDrafts;
        saveMessageDraftSnapshot(nextDrafts);
        setMessageDrafts(nextDrafts);
      }
      setMediaUrl('');
      pendingMediaAssetIdRef.current = null;
      handleMessageTypeChange(1);
      setTypingHint('');
      setError('');
      await loadMessages(activeConversationIdRef.current);
      await loadConversations();
    } catch {
      setError('发送消息失败，请稍后重试。');
    } finally {
      setSendingMessage(false);
    }
  }

  async function onAttachMedia(file: File): Promise<void> {
    if (!activeConversationIdRef.current) {
      setError('请先选择会话。');
      return;
    }

    const nextType: 2 | 3 | 4 = file.type.startsWith('image/')
      ? 2
      : file.type.startsWith('audio/')
        ? 3
        : 4;
    setMessageType(nextType);
    setMediaUrl(file.name);
    setMediaUploading(true);
    setError('');
    try {
      const uploaded = await uploadMedia(file, nextType);
      pendingMediaAssetIdRef.current = uploaded.mediaAssetId;
    } catch {
      pendingMediaAssetIdRef.current = null;
      setMediaUrl('');
      setError('媒体上传失败，请重试。');
    } finally {
      setMediaUploading(false);
    }
  }

  async function onOpenMedia(message: MessageItem): Promise<void> {
    if (message.messageType === 2 || message.messageType === 3) {
      await onReadMessageOnce(message);
    }
    const mediaUrl = await onResolveMediaUrl(message);
    if (!mediaUrl) {
      return;
    }
    window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    if (mediaUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(mediaUrl), 60_000);
    }
  }

  async function onResolveMediaUrl(message: MessageItem): Promise<string | null> {
    if (!message.mediaAssetId) {
      return null;
    }
    try {
      const blob = await downloadMedia(message.mediaAssetId);
      return URL.createObjectURL(blob);
    } catch {
      // 媒体下载失败，不设置全局错误状态，避免影响其他会话
      console.error('媒体下载失败:', message.mediaAssetId);
      return null;
    }
  }

  async function onReadMessageOnce(message: MessageItem): Promise<void> {
    if (message.senderId === authRef.current?.userId || message.readAt) {
      return;
    }
    try {
      await ackReadOne(message.id);
      if (activeConversationIdRef.current === message.conversationId) {
        const nowIso = new Date().toISOString();
        setMessages((prev) =>
          prev.map((row) =>
            row.id === message.id
              ? {
                  ...row,
                  deliveredAt: row.deliveredAt ?? nowIso,
                  readAt: row.readAt ?? nowIso,
                }
              : row,
          ),
        );
      }
    } catch {
      // Keep UI responsive even if read-ack fails transiently.
    }
  }

  async function onTriggerBurn(messageId: string): Promise<void> {
    if (!activeConversationIdRef.current) {
      return;
    }
    try {
      await triggerBurn(messageId);
      await Promise.all([loadMessages(activeConversationIdRef.current), loadConversations()]);
    } catch {
      setError('触发焚毁失败，请稍后重试。');
    }
  }

  async function onCreateDirect(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (creatingDirect) {
      return;
    }
    if (!peerUserId.trim()) {
      return;
    }
    setCreatingDirect(true);
    try {
      let targetUserId = peerUserId.trim();
      
      // 如果不是 UUID 格式，尝试搜索用户
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId)) {
        const searchResults = await searchUsers(targetUserId, 5);
        if (searchResults.length === 0) {
          setError('未找到该用户，请检查用户名。');
          setCreatingDirect(false);
          return;
        }
        if (searchResults.length === 1) {
          // 只有一个结果，直接使用
          targetUserId = searchResults[0].userId;
        } else {
          // 多个结果，显示选择列表（简化处理：使用第一个）
          targetUserId = searchResults[0].userId;
        }
      }
      
      const result = await createDirectConversation(targetUserId);
      setPeerUserId('');
      setError('');
      // 先更新 ref，避免 loadConversations 中的自动选中逻辑覆盖
      activeConversationIdRef.current = result.conversationId;
      await loadConversations();
      setActiveConversationId(result.conversationId);
    } catch (error) {
      console.error('创建单聊失败:', error);
      setError('创建单聊失败，请确认用户 ID 或用户名。');
    } finally {
      setCreatingDirect(false);
    }
  }

  async function onStartDirectConversation(targetUserId: string): Promise<void> {
    if (creatingDirect) {
      return;
    }
    const userId = targetUserId.trim();
    if (!userId) {
      return;
    }
    setCreatingDirect(true);
    try {
      const result = await createDirectConversation(userId);
      setError('');
      // 先更新 ref，避免 loadConversations 中的自动选中逻辑覆盖
      activeConversationIdRef.current = result.conversationId;
      await loadConversations();
      setActiveConversationId(result.conversationId);
    } catch {
      setError('创建单聊失败，请确认用户 ID。');
    } finally {
      setCreatingDirect(false);
    }
  }

  /**
   * 转发消息
   * - v2 消息（encryptedPayload 为 null）：客户端重加密流程
   * - 旧版消息（encryptedPayload 非 null）：调用后端转发接口
   */
  async function onForwardMessage(
    originalMessageId: string,
    targetConversationId: string,
  ): Promise<{ messageId: string; messageIndex: string }> {
    // 查找原消息（优先从本地缓存查找，找不到则通过 API 获取）
    let originalMessage: MessageItem | undefined | null = messagesRef.current.find((m) => m.id === originalMessageId);
    if (!originalMessage) {
      const { getMessageById } = await import('./api');
      originalMessage = await getMessageById(originalMessageId);
    }
    if (!originalMessage) {
      throw new Error('找不到原消息');
    }

    // 获取目标会话信息
    const targetConversation = conversations.find((c) => c.conversationId === targetConversationId);
    if (!targetConversation) {
      throw new Error('找不到目标会话');
    }

    const recipientUserId = targetConversation.peerUser?.userId;
    if (!recipientUserId) {
      throw new Error('目标会话不是单聊，无法转发');
    }

    // 判断是 v2 消息还是旧版消息
    // v2 消息：encryptedPayload 为 null（但在 REST API 返回时已被 resolveEnvelopePayloadsForDevice 填充）
    // 旧版消息：encryptedPayload 是 base64 编码的 JSON
    const isV2Message = (() => {
      const trimmed = (originalMessage.encryptedPayload || '').trim();
      // 如果是 Signal 加密的 JSON 格式，说明是从 envelope 解析出来的 v2 消息
      return trimmed.startsWith('{');
    })();

    // 尝试从缓存获取明文（优先按消息ID查找）
    let plaintext = getDecryptedTextByMessageId(originalMessageId);
    if (!plaintext) {
      // 回退：尝试用 encryptedPayload 解密
      try {
        plaintext = decodePayloadSync(originalMessage.encryptedPayload);
      } catch {
        // 解密失败
      }
    }

    if (isV2Message) {
      // v2 消息必须能解密，否则无法转发
      if (!plaintext) {
        throw new Error('无法解密消息，请确认已在其他设备同步 Signal 状态');
      }
      // P1: v2 消息走客户端重加密流程
      // 初始化 Signal 协议
      if (!signalState.initialized) {
        await signalActions.initialize(authRef.current?.userId);
      }

      // 获取目标接收方所有设备
      // 同时获取发送方设备（用于自同步），合并为一次 API 调用
      const currentUserId = authRef.current?.userId;
      const userIdsToQuery = currentUserId ? [recipientUserId, currentUserId] : [recipientUserId];
      const deviceInfoList = await getDevicesByUserIds(userIdsToQuery);
      const recipientDeviceInfo = deviceInfoList.find((info) => info.userId === recipientUserId);
      const recipientDevices = recipientDeviceInfo?.devices ?? [];
      if (recipientDevices.length === 0) {
        throw new Error('无法获取目标用户设备信息');
      }

      // 获取目标会话的元数据（用于构建消息内容）
      let originalPayload: Record<string, unknown>;
      try {
        originalPayload = JSON.parse(plaintext) as Record<string, unknown>;
      } catch {
        throw new Error('原消息内容解析失败，无法转发');
      }
      const messageType = originalMessage.messageType as 1 | 2 | 3 | 4;
      const normalizedText = typeof originalPayload.text === 'string' ? originalPayload.text.trim() : '';
      if (messageType === 1 && !normalizedText) {
        throw new Error('文本消息缺少可转发内容');
      }

      // 构建消息内容（保留原消息的 type 和媒体信息）
      // 注意：媒体消息不包含 mediaUrl，因为媒体已复制到新 asset，mediaAssetId 会独立传递
      const messageContent = {
        type: messageType,
        text: messageType === 1 ? normalizedText : undefined,
        mediaUrl: messageType === 1 && typeof originalPayload.mediaUrl === 'string' ? originalPayload.mediaUrl : undefined,
        fileName: typeof originalPayload.fileName === 'string' ? originalPayload.fileName : undefined,
        replyTo: undefined,
      };
      const messageText = JSON.stringify(messageContent);

      // 对目标用户所有设备进行加密
      const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const envelopes: Array<{ targetUserId: string; targetDeviceId: string; encryptedPayload: string }> = [];
      for (const recipientDevice of recipientDevices) {
        const encryptedPayload = await signalActions.encryptMessage(
          recipientUserId,
          recipientDevice.deviceId,
          messageText,
        );
        envelopes.push({
          targetUserId: recipientUserId,
          targetDeviceId: recipientDevice.deviceId,
          encryptedPayload,
        });
      }

      // 发送方自同步：覆盖当前设备 + 其他设备，保证转发后自己也能看到正文。
      if (currentUserId) {
        const selfDeviceInfo = deviceInfoList.find((info) => info.userId === currentUserId);
        const selfDevices = selfDeviceInfo?.devices ?? [];
        for (const selfDevice of selfDevices) {
          const encryptedPayload = await signalActions.encryptMessage(
            currentUserId,
            selfDevice.deviceId,
            messageText,
          );
          envelopes.push({
            targetUserId: currentUserId,
            targetDeviceId: selfDevice.deviceId,
            encryptedPayload,
          });
        }
      }

      // 缓存明文
      for (const envelope of envelopes) {
        payloadCacheRef.current.set(envelope.encryptedPayload, messageText);
      }

      // 对于媒体消息，需要先复制媒体资产到目标会话
      let forwardedMediaAssetId: string | undefined;
      if (messageType !== 1 && originalMessage.mediaAssetId) {
        const { copyMediaAsset } = await import('./api');
        const copied = await copyMediaAsset(originalMessage.mediaAssetId, targetConversationId);
        forwardedMediaAssetId = copied.mediaAssetId;
      }

      // 调用 send-v2 接口
      const { sendMessageV2 } = await import('./api');
      const result = await sendMessageV2({
        conversationId: targetConversationId,
        messageType,
        nonce,
        envelopes,
        mediaAssetId: forwardedMediaAssetId,
        isBurn: originalMessage.isBurn,
        burnDuration: originalMessage.isBurn ? originalMessage.burnDuration ?? undefined : undefined,
      });

      // 按消息ID缓存明文
      if (result?.messageId) {
        payloadCacheRef.current.set(`msg:${result.messageId}`, messageText);
      }

      return result;
    } else {
      // 旧版消息调用后端转发接口
      const { forwardMessage } = await import('./api');
      return await forwardMessage(originalMessageId, targetConversationId);
    }
  }

  async function loadFriendData(): Promise<void> {
    const [requests, friendList, blockedList] = await Promise.all([
      getIncomingRequests(),
      getFriends(),
      getBlockedUsers(),
    ]);
    setIncomingRequests(requests);
    setFriends(friendList);
    setBlockedUsers(blockedList);
    setError('');
  }

  async function onSearchFriends(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const keyword = friendKeyword.trim();
    if (!keyword) {
      setFriendSearchResults([]);
      return;
    }
    try {
      const rows = await searchUsers(keyword, 20);
      setFriendSearchResults(rows);
      setError('');
    } catch {
      setError('好友搜索失败，请稍后重试。');
    }
  }

  async function onRequestFriend(targetUserId: string): Promise<void> {
    try {
      await requestFriend(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
      setError('');
    } catch {
      setError('发送好友申请失败。');
      throw new Error('send friend request failed');
    }
  }

  async function onRespondFriend(requesterUserId: string, accept: boolean): Promise<void> {
    try {
      await respondFriend(requesterUserId, accept);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
      setError('');
    } catch {
      setError('处理好友申请失败。');
    }
  }

  async function onBlockUser(targetUserId: string): Promise<void> {
    try {
      await blockUser(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
      setError('');
    } catch {
      setError('拉黑失败。');
    }
  }

  async function onUnblockUser(targetUserId: string): Promise<void> {
    try {
      await unblockUser(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
      setError('');
    } catch {
      setError('解除拉黑失败。');
    }
  }

  async function refreshSearchResult(): Promise<void> {
    const keyword = friendKeyword.trim();
    if (!keyword) {
      return;
    }
    const rows = await searchUsers(keyword, 20);
    setFriendSearchResults(rows);
  }

  function startTyping(): void {
    if (socket && activeConversationIdRef.current) {
      socket.emit('conversation.typing.start', { conversationId: activeConversationIdRef.current });
    }
  }

  function stopTyping(): void {
    if (socket && activeConversationIdRef.current) {
      socket.emit('conversation.typing.stop', { conversationId: activeConversationIdRef.current });
    }
  }

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // 当消息更新时，异步解密所有未解密的 payload
  useEffect(() => {
    let cancelled = false;
    const decryptMessages = async () => {
      const nowMs = Date.now();
      let hasDecrypted = false;
      
      for (const row of messagesRef.current) {
        if (isBurnExpired(row, nowMs)) {
          continue;
        }
        if (!payloadCacheRef.current.has(row.encryptedPayload)) {
          try {
            const decrypted = await decodePayload(row.encryptedPayload, row.senderId, row.sourceDeviceId);
            payloadCacheRef.current.set(row.encryptedPayload, decrypted);
            // 同时按消息ID缓存，支持通过ID查找明文（如转发场景）
            payloadCacheRef.current.set(`msg:${row.id}`, decrypted);
            hasDecrypted = true;
          } catch (error) {
            console.error('Decryption failed:', error);
          }
        }
      }
      
      // 只有在有新解密的数据时才触发重新渲染
      if (!cancelled && hasDecrypted) {
        setMessages((prev) => {
          // 创建一个新数组以触发重新渲染
          const newMessages = [...prev];
          return newMessages;
        });
      }
    };
    
    void decryptMessages();
    
    return () => {
      cancelled = true;
    };
  }, [messages.length, signalState.initialized]);

  function handleMessageTypeChange(value: 1 | 2 | 3 | 4): void {
    setMessageType(value);
    if (value === 1) {
      setMediaUrl('');
      pendingMediaAssetIdRef.current = null;
    }
    if (value === 4 && burnEnabled) {
      setBurnEnabled(false);
    }
    if (value !== 4 && !burnEnabled) {
      const selected = conversations.find((c) => c.conversationId === activeConversationIdRef.current);
      if (selected?.defaultBurnEnabled) {
        setBurnEnabled(true);
        setBurnDuration(selected.defaultBurnDuration ?? 30);
      }
    }
  }

  function handleMediaUrlChange(value: string): void {
    setMediaUrl(value);
    pendingMediaAssetIdRef.current = null;
  }

  /**
   * 记住密码选项变化处理
   * 取消记住密码时，自动取消自动登录
   */
  function handleRememberPasswordChange(value: boolean): void {
    setRememberPasswordState(value);
    if (!value) {
      // 取消记住密码时，强制取消自动登录
      setAutoLoginState(false);
    }
  }

  /**
   * 自动登录选项变化处理
   * 勾选自动登录时，自动勾选记住密码
   */
  function handleAutoLoginChange(value: boolean): void {
    setAutoLoginState(value);
    if (value) {
      // 勾选自动登录时，自动勾选记住密码
      setRememberPasswordState(true);
    }
  }

  /**
   * 设置认证状态（用于自动登录）
   */
  function handleSetAuth(newAuth: AuthState | null): void {
    setAuth(newAuth);
  }

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!auth || !activeConversationId) {
      return;
    }
    setHasMoreHistory(true);
    setLoadingMoreHistory(false);
    void loadMessages(activeConversationId);
  }, [auth, activeConversationId]);

  useEffect(() => {
    if (!auth || !activeConversationId) {
      return;
    }
    const selected = conversations.find((c) => c.conversationId === activeConversationId);
    if (selected) {
      const enabled = Boolean(selected.defaultBurnEnabled);
      setBurnEnabled(enabled);
      setBurnDuration(selected.defaultBurnDuration ?? 30);
    } else {
      void getConversationBurnDefault(activeConversationId)
        .then((row) => {
          setBurnEnabled(Boolean(row.enabled));
          setBurnDuration(row.burnDuration ?? 30);
        })
        .catch(() => {});
    }
  }, [auth, activeConversationId, conversations]);

  useEffect(() => {
    if (!auth || !activeConversationId) {
      return;
    }
    const draft = messageDraftRef.current[activeConversationId] ?? '';
    setMessageText(draft);
  }, [auth, activeConversationId]);

  useEffect(() => {
    if (!auth || !activeConversationId) {
      return;
    }
    const trimmed = messageText;
    const prev = messageDraftRef.current[activeConversationId] ?? '';
    if (trimmed === prev) {
      return;
    }
    const nextDrafts = { ...messageDraftRef.current };
    if (trimmed.trim()) {
      nextDrafts[activeConversationId] = trimmed;
    } else {
      delete nextDrafts[activeConversationId];
    }
    messageDraftRef.current = nextDrafts;
    saveMessageDraftSnapshot(nextDrafts);
    setMessageDrafts(nextDrafts);
  }, [auth, activeConversationId, messageText]);

  useEffect(() => {
    saveConversationPrefSnapshot({
      pinned: pinnedConversationIds,
      muted: mutedConversationIds,
    });
  }, [pinnedConversationIds, mutedConversationIds]);

  function toggleConversationPin(conversationId: string): void {
    if (!conversationId) {
      return;
    }
    setPinnedConversationIds((prev) =>
      prev.includes(conversationId) ? prev.filter((id) => id !== conversationId) : [...prev, conversationId],
    );
  }

  function toggleConversationMute(conversationId: string): void {
    if (!conversationId) {
      return;
    }
    setMutedConversationIds((prev) =>
      prev.includes(conversationId) ? prev.filter((id) => id !== conversationId) : [...prev, conversationId],
    );
  }

  async function deleteConversationFromServer(conversationId: string): Promise<boolean> {
    if (!conversationId) {
      return false;
    }
    try {
      await deleteConversation(conversationId);
      return true;
    } catch (error) {
      console.error('[useChatClient] 删除会话失败:', error);
      return false;
    }
  }

  function handleBurnEnabledChange(value: boolean): void {
    setBurnEnabled(value);
    const conversationId = activeConversationIdRef.current;
    if (!conversationId) {
      return;
    }
    if (messageType === 4 && value) {
      setError('文件消息不支持阅后即焚。');
      setBurnEnabled(false);
      return;
    }
    void updateConversationBurnDefault(conversationId, value, burnDuration).catch(() => {
      setError('更新会话焚毁默认设置失败。');
    });
  }

  function handleBurnDurationChange(value: number): void {
    setBurnDuration(value);
    const conversationId = activeConversationIdRef.current;
    if (!conversationId || !burnEnabled) {
      return;
    }
    void updateConversationBurnDefault(conversationId, true, value).catch(() => {
      setError('更新会话焚毁时长失败。');
    });
  }



  useEffect(() => {
    if (!auth) {
      return;
    }
    const timer = setInterval(() => {
      const nowMs = Date.now();
      const expiredRows = messagesRef.current.filter((row) => isBurnExpired(row, nowMs));
      for (const row of expiredRows) {
        if (autoBurnPendingRef.current.has(row.id)) {
          continue;
        }
        autoBurnPendingRef.current.add(row.id);
        void triggerBurn(row.id)
          .then(async () => {
            if (activeConversationIdRef.current === row.conversationId) {
              await loadMessages(row.conversationId);
            }
            await loadConversations();
          })
          .catch(() => {
            // Fall back to local filtering; sweep/retry will handle eventual consistency.
          })
          .finally(() => {
            autoBurnPendingRef.current.delete(row.id);
          });
      }
      setMessages((prev) => prev.filter((row) => !isBurnExpired(row, nowMs)));
    }, 1000);
    return () => {
      clearInterval(timer);
      autoBurnPendingRef.current.clear();
    };
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const client = io(wsBaseUrl, {
      transports: ['websocket'],
      auth: { token: auth.token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // WebSocket 连接事件处理
    client.on('connect', () => {
      console.log('WebSocket connected');
    });

    client.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    client.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要手动重连
        client.connect();
      }
    });

    client.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    const onConversationEvent = (payload: WsConversationEvent): void => {
      if (payload.conversationId && payload.conversationId === activeConversationIdRef.current) {
        void syncMessagesDelta(payload.conversationId);
      } else if (payload.conversationId) {
        void syncConversationCursor(payload.conversationId, false);
      }
      void loadConversations();
    };

    const onMessageRead = (payload: {
      conversationId?: string;
      maxMessageIndex?: string | number;
      ackByUserId?: string;
      ackAt?: string;
    }): void => {
      if (!payload.conversationId || !payload.maxMessageIndex || !payload.ackByUserId) {
        return;
      }
      applyReadAckToActiveMessages(
        payload.conversationId,
        payload.maxMessageIndex,
        payload.ackByUserId,
        payload.ackAt ?? new Date().toISOString(),
      );
      onConversationEvent(payload);
    };

    const onBurnTriggered = (payload: { conversationId?: string; messageId?: string }): void => {
      if (!payload.conversationId || !payload.messageId) {
        return;
      }
      setMessages((prev) => prev.filter((row) => row.id !== payload.messageId));
      onConversationEvent(payload);
    };

    const onMessageRevoked = (payload: { conversationId?: string; messageId?: string; revokedByUserId?: string; revokedAt?: string }): void => {
      if (!payload.conversationId || !payload.messageId) {
        return;
      }
      // 检查当前会话是否匹配
      if (payload.conversationId !== activeConversationIdRef.current) {
        return;
      }
      // 从消息列表中移除被撤回的消息
      setMessages((prev) => {
        const filtered = prev.filter((row) => {
          const match = row.id === payload.messageId;
          if (match) {
          }
          return !match;
        });
        return filtered;
      });
      // 触发会话更新事件
      onConversationEvent({ conversationId: payload.conversationId });
    };

    client.on('connect', () => {
      stopFallbackPolling();
      if (activeConversationIdRef.current) {
        client.emit('conversation.join', { conversationId: activeConversationIdRef.current });
        void syncMessagesDelta(activeConversationIdRef.current);
      }
      void loadConversations().then((rows) => {
        for (const row of rows) {
          const isActive = row.conversationId === activeConversationIdRef.current;
          if (!isActive) {
            void syncConversationCursor(row.conversationId, false);
          }
        }
      });
    });

    client.on('disconnect', () => {
      startFallbackPolling();
    });

    client.on('message.sent', onConversationEvent);
    client.on('message.delivered', onConversationEvent);
    client.on('message.read', onMessageRead);
    client.on('message.revoked', onMessageRevoked);
    client.on('burn.triggered', onBurnTriggered);
    client.on('conversation.updated', onConversationEvent);
    client.on('conversation.typing', (payload: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
      if (!payload.conversationId || payload.conversationId !== activeConversationIdRef.current) {
        return;
      }
      if (!authRef.current || payload.userId === authRef.current.userId) {
        return;
      }
      setTypingHint(payload.isTyping ? '对方正在输入...' : '');
    });

    setSocket(client);
    return () => {
      stopFallbackPolling();
      client.disconnect();
      setSocket(null);
      // 清理 Toast 定时器
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current);
      }
    };
  }, [auth]);

  useEffect(() => {
    if (socket && activeConversationId) {
      socket.emit('conversation.join', { conversationId: activeConversationId });
    }
  }, [socket, activeConversationId]);

  return {
    state: {
      auth,
      authMode,
      account,
      registerEmail,
      forgotEmail,
      forgotCode,
      forgotPassword,
      forgotConfirmPassword,
      forgotCodeSent,
      forgotCooldown,
      loginCode,
      codeHint,
      password,
      authSubmitting,
      sendingLoginCode,
      loginCodeCooldown,
      rememberPassword,
      autoLogin,
      error,
      toast,
      conversations,
      messageDrafts,
      pinnedConversationIds,
      mutedConversationIds,
      unreadTotal,
      activeConversationId,
      messages,
      hasMoreHistory,
      loadingMoreHistory,
      messageText,
      messageType,
      mediaUrl,
      mediaUploading,
      sendingMessage,
      burnEnabled,
      burnDuration,
      replyToMessage,
      peerUserId,
      creatingDirect,
      typingHint,
      friendKeyword,
      friendSearchResults,
      incomingRequests,
      friends,
      blockedUsers,
    },
    actions: {
      setAuthMode,
      setAccount,
      setRegisterEmail,
      setForgotEmail,
      setForgotCode,
      setForgotPassword,
      setForgotConfirmPassword,
      setLoginCode,
      setPassword,
      setRememberPassword: handleRememberPasswordChange,
      setAutoLogin: handleAutoLoginChange,
      setAuth: handleSetAuth,
      setMessageText,
      setMessageType: handleMessageTypeChange,
      setMediaUrl: handleMediaUrlChange,
      setBurnEnabled: handleBurnEnabledChange,
      setBurnDuration: handleBurnDurationChange,
      setReplyToMessage,
      setPeerUserId,
      setActiveConversationId,
      toggleConversationPin,
      toggleConversationMute,
      deleteConversation: deleteConversationFromServer,
      setFriendKeyword,
      onLogin,
      onRegister,
      onSendLoginCode,
      onLoginWithCode,
      onLogout,
      onSendForgotCode,
      onResetPassword,
      onSendMessage,
      onCreateDirect,
      onSearchFriends,
      onRequestFriend,
      onRespondFriend,
      onBlockUser,
      onUnblockUser,
      onTriggerBurn,
      onRefreshFriendData: loadFriendData,
      onRefreshActiveConversation,
      onLoadOlderMessages,
      onAttachMedia,
      onOpenMedia,
      onResolveMediaUrl,
      onReadMessageOnce,
      onStartDirectConversation,
      onForwardMessage,
      startTyping,
      stopTyping,
    },
    activeConversation,
    decodePayload: decodePayloadSync,
  };
}
