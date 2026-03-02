import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ackReadOne,
  ackDelivered,
  ackRead,
  blockUser,
  createDirectConversation,
  downloadMedia,
  decodePayload,
  getConversationBurnDefault,
  getBlockedUsers,
  getConversations,
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

const MESSAGE_CURSOR_STORAGE_KEY = 'security-chat.desktop.message-cursors.v1';
const MESSAGE_DRAFT_STORAGE_KEY = 'security-chat.desktop.message-drafts.v1';
const CONVERSATION_PREF_STORAGE_KEY = 'security-chat.desktop.conversation-prefs.v1';

function loadMessageCursorSnapshot(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MESSAGE_CURSOR_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const num = Number(value);
      if (key && Number.isFinite(num) && num >= 0) {
        result[key] = num;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveMessageCursorSnapshot(snapshot: Record<string, number>): void {
  try {
    localStorage.setItem(MESSAGE_CURSOR_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence errors in private mode/storage-limited environments.
  }
}

function loadMessageDraftSnapshot(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MESSAGE_DRAFT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key || typeof value !== 'string') {
        continue;
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function saveMessageDraftSnapshot(snapshot: Record<string, string>): void {
  try {
    localStorage.setItem(MESSAGE_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence errors in private mode/storage-limited environments.
  }
}

function loadConversationPrefSnapshot(): { pinned: string[]; muted: string[] } {
  try {
    const raw = localStorage.getItem(CONVERSATION_PREF_STORAGE_KEY);
    if (!raw) {
      return { pinned: [], muted: [] };
    }
    const parsed = JSON.parse(raw) as { pinned?: unknown; muted?: unknown };
    const pinned = Array.isArray(parsed.pinned) ? parsed.pinned.filter((v): v is string => typeof v === 'string') : [];
    const muted = Array.isArray(parsed.muted) ? parsed.muted.filter((v): v is string => typeof v === 'string') : [];
    return { pinned, muted };
  } catch {
    return { pinned: [], muted: [] };
  }
}

function saveConversationPrefSnapshot(snapshot: { pinned: string[]; muted: string[] }): void {
  try {
    localStorage.setItem(CONVERSATION_PREF_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence errors in private mode/storage-limited environments.
  }
}

export type ChatClientState = {
  auth: AuthState | null;
  authMode: 'login' | 'register' | 'code';
  account: string;
  registerEmail: string;
  registerPhone: string;
  loginCode: string;
  codeHint: string;
  password: string;
  authSubmitting: boolean;
  sendingLoginCode: boolean;
  loginCodeCooldown: number;
  error: string;
  conversations: ConversationListItem[];
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
  setAuthMode: (value: 'login' | 'register' | 'code') => void;
  setAccount: (value: string) => void;
  setRegisterEmail: (value: string) => void;
  setRegisterPhone: (value: string) => void;
  setLoginCode: (value: string) => void;
  setPassword: (value: string) => void;
  setMessageText: (value: string) => void;
  setMessageType: (value: 1 | 2 | 3 | 4) => void;
  setMediaUrl: (value: string) => void;
  setBurnEnabled: (value: boolean) => void;
  setBurnDuration: (value: number) => void;
  setPeerUserId: (value: string) => void;
  setActiveConversationId: (value: string) => void;
  toggleConversationPin: (conversationId: string) => void;
  toggleConversationMute: (conversationId: string) => void;
  setFriendKeyword: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendLoginCode: () => Promise<void>;
  onLoginWithCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLogout: () => Promise<void>;
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
  startTyping: () => void;
  stopTyping: () => void;
};

export function useChatClient(): {
  state: ChatClientState;
  actions: ChatClientActions;
  activeConversation: ConversationListItem | null;
  decodePayload: (payload: string) => string;
} {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'code'>('login');
  const [account, setAccount] = useState('alice');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [codeHint, setCodeHint] = useState('');
  const [password, setPassword] = useState('Password123');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [sendingLoginCode, setSendingLoginCode] = useState(false);
  const [loginCodeCooldown, setLoginCodeCooldown] = useState(0);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(() => loadMessageDraftSnapshot());
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>(() => loadConversationPrefSnapshot().pinned);
  const [mutedConversationIds, setMutedConversationIds] = useState<string[]>(() => loadConversationPrefSnapshot().muted);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<1 | 2 | 3 | 4>(1);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [burnEnabled, setBurnEnabled] = useState(false);
  const [burnDuration, setBurnDuration] = useState(30);
  const [peerUserId, setPeerUserId] = useState('');
  const [creatingDirect, setCreatingDirect] = useState(false);
  const [typingHint, setTypingHint] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friendKeyword, setFriendKeyword] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingFriendItem[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedFriendItem[]>([]);

  const activeConversationIdRef = useRef('');
  const authRef = useRef<AuthState | null>(null);
  const messagesRef = useRef<MessageItem[]>([]);
  const messageCursorRef = useRef<Record<string, number>>(loadMessageCursorSnapshot());
  const fallbackPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingMediaAssetIdRef = useRef<string | null>(null);
  const messageDraftRef = useRef<Record<string, string>>(loadMessageDraftSnapshot());
  const autoBurnPendingRef = useRef<Set<string>>(new Set());

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
    const rows = await getMessages(conversationId, 0, 100);
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
  }

  async function syncMessagesDelta(conversationId: string): Promise<void> {
    const currentRows = activeConversationIdRef.current === conversationId ? messagesRef.current : [];
    const localCursor = messageCursorRef.current[conversationId] ?? 0;
    const activeMax =
      activeConversationIdRef.current === conversationId
        ? messagesRef.current.reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0)
        : 0;
    const afterIndex = Math.max(localCursor, activeMax);
    const rows = await getMessages(conversationId, afterIndex, 100);
    if (rows.length > 0) {
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
  }

  async function syncConversationCursor(conversationId: string, applyToActive: boolean): Promise<void> {
    const afterIndex = messageCursorRef.current[conversationId] ?? 0;
    const rows = await getMessages(conversationId, afterIndex, 100);
    if (rows.length === 0) {
      return;
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
      const nowMs = Date.now();
      setMessages((prev) => mergeMessages(olderRows, prev).filter((row) => !isBurnExpired(row, nowMs)));
      const oldestFetched = olderRows.reduce((min, row) => Math.min(min, Number(row.messageIndex)), oldestIndex);
      if (olderRows.length < 100 || oldestFetched <= 1) {
        setHasMoreHistory(false);
      }
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

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    setError('');
    try {
      const result = await login(account, password);
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      setError('登录失败，请检查账号密码或后端服务状态。');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function onRegister(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    setError('');
    const username = account.trim();
    const email = registerEmail.trim();
    const phone = registerPhone.trim();
    const pwd = password.trim();
    if (!username || !email || !phone || !pwd) {
      setError('请完整填写账号、邮箱、手机号和密码。');
      return;
    }
    try {
      const seed = crypto.randomUUID().replace(/-/g, '');
      const result = await register({
        username,
        email,
        phone,
        password: pwd,
        deviceName: 'desktop-client',
        deviceType: 'mac',
        identityPublicKey: `idpk-${seed}`,
        signedPreKey: `spk-${seed}`,
        signedPreKeySignature: `sig-${seed}`,
      });
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      setAuthMode('login');
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      setError('注册失败，请检查输入格式或更换账号信息。');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function onSendLoginCode(): Promise<void> {
    if (sendingLoginCode || loginCodeCooldown > 0) {
      return;
    }
    setSendingLoginCode(true);
    setError('');
    setCodeHint('');
    const identity = account.trim();
    if (!identity) {
      setError('请输入用户名/邮箱/手机号。');
      return;
    }
    const payload = identity.startsWith('+') || /^\d{8,20}$/.test(identity) ? { phone: identity } : { account: identity };
    try {
      const result = await sendLoginCode(payload);
      setCodeHint(result.debugCode ? `验证码：${result.debugCode}` : '验证码已发送，请查收。');
      setLoginCodeCooldown(60);
    } catch {
      setError('发送验证码失败，请稍后重试。');
    } finally {
      setSendingLoginCode(false);
    }
  }

  async function onLoginWithCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    setError('');
    const identity = account.trim();
    const code = loginCode.trim();
    if (!identity || !code) {
      setError('请输入用户名/邮箱/手机号和验证码。');
      return;
    }
    const payload =
      identity.startsWith('+') || /^\d{8,20}$/.test(identity)
        ? { phone: identity, code }
        : { account: identity, code };
    try {
      const result = await loginWithCode(payload);
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      setError('验证码登录失败，请检查验证码或重新发送。');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function onLogout(): Promise<void> {
    try {
      await logout();
    } catch {
      // Ignore logout API failure and continue local cleanup.
    }

    stopFallbackPolling();
    authRef.current = null;
    setAuthToken(null);
    setAuth(null);
    setAuthMode('login');
    setAccount('');
    setRegisterEmail('');
    setRegisterPhone('');
    setLoginCode('');
    setCodeHint('');
    setAuthSubmitting(false);
    setSendingLoginCode(false);
    setLoginCodeCooldown(0);
    setPassword('');
    setError('');
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
  }

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
      await sendMessage({
        conversationId: activeConversationIdRef.current,
        messageType,
        text,
        mediaUrl: messageType === 1 ? undefined : mediaUrl.trim() || undefined,
        fileName: messageType === 4 ? (mediaUrl.trim() || 'file') : undefined,
        mediaAssetId: messageType === 1 ? undefined : pendingMediaAssetIdRef.current ?? undefined,
        isBurn: isBurnForThisMessage,
        burnDuration: isBurnForThisMessage ? burnDuration : undefined,
      });
      setMessageText('');
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
      setError('媒体下载失败，请稍后重试。');
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
      const result = await createDirectConversation(peerUserId.trim());
      setPeerUserId('');
      setError('');
      await loadConversations();
      setActiveConversationId(result.conversationId);
    } catch {
      setError('创建单聊失败，请确认用户 ID。');
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
      await loadConversations();
      setActiveConversationId(result.conversationId);
    } catch {
      setError('创建单聊失败，请确认用户 ID。');
    } finally {
      setCreatingDirect(false);
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
    if (loginCodeCooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setLoginCodeCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [loginCodeCooldown]);

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
      registerPhone,
      loginCode,
      codeHint,
      password,
      authSubmitting,
      sendingLoginCode,
      loginCodeCooldown,
      error,
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
      setRegisterPhone,
      setLoginCode,
      setPassword,
      setMessageText,
      setMessageType: handleMessageTypeChange,
      setMediaUrl: handleMediaUrlChange,
      setBurnEnabled: handleBurnEnabledChange,
      setBurnDuration: handleBurnDurationChange,
      setPeerUserId,
      setActiveConversationId,
      toggleConversationPin,
      toggleConversationMute,
      setFriendKeyword,
      onLogin,
      onRegister,
      onSendLoginCode,
      onLoginWithCode,
      onLogout,
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
      startTyping,
      stopTyping,
    },
    activeConversation,
    decodePayload,
  };
}
