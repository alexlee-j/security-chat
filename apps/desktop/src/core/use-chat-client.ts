import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ackDelivered,
  ackRead,
  blockUser,
  createDirectConversation,
  decodePayload,
  getBlockedUsers,
  getConversations,
  getFriends,
  getIncomingRequests,
  getMessages,
  login,
  requestFriend,
  respondFriend,
  searchUsers,
  sendMessage,
  setAuthToken,
  triggerBurn,
  unblockUser,
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

export type ChatClientState = {
  auth: AuthState | null;
  account: string;
  password: string;
  error: string;
  conversations: ConversationListItem[];
  activeConversationId: string;
  messages: MessageItem[];
  messageText: string;
  messageType: 1 | 2 | 3 | 4;
  mediaUrl: string;
  burnEnabled: boolean;
  burnDuration: number;
  peerUserId: string;
  typingHint: string;
  friendKeyword: string;
  friendSearchResults: FriendSearchItem[];
  incomingRequests: PendingFriendItem[];
  friends: FriendListItem[];
  blockedUsers: BlockedFriendItem[];
};

export type ChatClientActions = {
  setAccount: (value: string) => void;
  setPassword: (value: string) => void;
  setMessageText: (value: string) => void;
  setMessageType: (value: 1 | 2 | 3 | 4) => void;
  setMediaUrl: (value: string) => void;
  setBurnEnabled: (value: boolean) => void;
  setBurnDuration: (value: number) => void;
  setPeerUserId: (value: string) => void;
  setActiveConversationId: (value: string) => void;
  setFriendKeyword: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateDirect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSearchFriends: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRequestFriend: (targetUserId: string) => Promise<void>;
  onRespondFriend: (requesterUserId: string, accept: boolean) => Promise<void>;
  onBlockUser: (targetUserId: string) => Promise<void>;
  onUnblockUser: (targetUserId: string) => Promise<void>;
  onTriggerBurn: (messageId: string) => Promise<void>;
  onRefreshFriendData: () => Promise<void>;
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
  const [account, setAccount] = useState('alice');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<1 | 2 | 3 | 4>(1);
  const [mediaUrl, setMediaUrl] = useState('');
  const [burnEnabled, setBurnEnabled] = useState(false);
  const [burnDuration, setBurnDuration] = useState(30);
  const [peerUserId, setPeerUserId] = useState('');
  const [typingHint, setTypingHint] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friendKeyword, setFriendKeyword] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingFriendItem[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedFriendItem[]>([]);

  const activeConversationIdRef = useRef('');
  const authRef = useRef<AuthState | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeConversationId) ?? null,
    [conversations, activeConversationId],
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

  async function loadConversations(): Promise<void> {
    const rows = await getConversations();
    const dedupedRows = rows.filter(
      (row, index, array) => array.findIndex((item) => item.conversationId === row.conversationId) === index,
    );
    setConversations(dedupedRows);
    if (!activeConversationIdRef.current && dedupedRows.length > 0) {
      setActiveConversationId(dedupedRows[0].conversationId);
    }
  }

  async function loadMessages(conversationId: string): Promise<void> {
    const rows = await getMessages(conversationId, 0, 100);
    const nowMs = Date.now();
    setMessages(rows.filter((row) => !isBurnExpired(row, nowMs)));

    const maxIndex = rows.reduce((max, row) => Math.max(max, Number(row.messageIndex)), 0);
    if (maxIndex > 0) {
      await Promise.all([ackDelivered(conversationId, maxIndex), ackRead(conversationId, maxIndex)]).catch(() => {});
    }
  }

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    try {
      const result = await login(account, password);
      setAuthToken(result.accessToken);
      setAuth({ token: result.accessToken, userId: result.userId });
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      setError('登录失败，请检查账号密码或后端服务状态。');
    }
  }

  async function onSendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeConversationIdRef.current) {
      return;
    }

    const text = messageText.trim();
    const media = mediaUrl.trim();
    if (messageType === 1 && !text) {
      return;
    }
    if (messageType !== 1 && !media) {
      return;
    }

    await sendMessage({
      conversationId: activeConversationIdRef.current,
      messageType,
      text,
      mediaUrl: messageType === 1 ? undefined : media,
      fileName: messageType === 4 ? media.split('/').pop() ?? 'file' : undefined,
      isBurn: burnEnabled,
      burnDuration: burnEnabled ? burnDuration : undefined,
    });
    setMessageText('');
    setMediaUrl('');
    setMessageType(1);
    setBurnEnabled(false);
    setBurnDuration(30);
    setTypingHint('');
    await loadMessages(activeConversationIdRef.current);
    await loadConversations();
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
    if (!peerUserId.trim()) {
      return;
    }
    try {
      const result = await createDirectConversation(peerUserId.trim());
      setPeerUserId('');
      await loadConversations();
      setActiveConversationId(result.conversationId);
    } catch {
      setError('创建单聊失败，请确认用户 ID。');
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
    } catch {
      setError('好友搜索失败，请稍后重试。');
    }
  }

  async function onRequestFriend(targetUserId: string): Promise<void> {
    try {
      await requestFriend(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
    } catch {
      setError('发送好友申请失败。');
    }
  }

  async function onRespondFriend(requesterUserId: string, accept: boolean): Promise<void> {
    try {
      await respondFriend(requesterUserId, accept);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
    } catch {
      setError('处理好友申请失败。');
    }
  }

  async function onBlockUser(targetUserId: string): Promise<void> {
    try {
      await blockUser(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
    } catch {
      setError('拉黑失败。');
    }
  }

  async function onUnblockUser(targetUserId: string): Promise<void> {
    try {
      await unblockUser(targetUserId);
      await Promise.all([loadFriendData(), refreshSearchResult()]);
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

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    if (!auth || !activeConversationId) {
      return;
    }
    void loadMessages(activeConversationId);
  }, [auth, activeConversationId]);

  useEffect(() => {
    if (!auth) {
      return;
    }
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setMessages((prev) => prev.filter((row) => !isBurnExpired(row, nowMs)));
    }, 1000);
    return () => {
      clearInterval(timer);
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
        void loadMessages(payload.conversationId);
      }
      void loadConversations();
    };

    client.on('connect', () => {
      if (activeConversationIdRef.current) {
        client.emit('conversation.join', { conversationId: activeConversationIdRef.current });
      }
    });

    client.on('message.sent', onConversationEvent);
    client.on('message.delivered', onConversationEvent);
    client.on('message.read', onConversationEvent);
    client.on('burn.triggered', onConversationEvent);
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
      account,
      password,
      error,
      conversations,
      activeConversationId,
      messages,
      messageText,
      messageType,
      mediaUrl,
      burnEnabled,
      burnDuration,
      peerUserId,
      typingHint,
      friendKeyword,
      friendSearchResults,
      incomingRequests,
      friends,
      blockedUsers,
    },
    actions: {
      setAccount,
      setPassword,
      setMessageText,
      setMessageType,
      setMediaUrl,
      setBurnEnabled,
      setBurnDuration,
      setPeerUserId,
      setActiveConversationId,
      setFriendKeyword,
      onLogin,
      onSendMessage,
      onCreateDirect,
      onSearchFriends,
      onRequestFriend,
      onRespondFriend,
      onBlockUser,
      onUnblockUser,
      onTriggerBurn,
      onRefreshFriendData: loadFriendData,
      startTyping,
      stopTyping,
    },
    activeConversation,
    decodePayload,
  };
}
