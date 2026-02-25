import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ackDelivered,
  ackRead,
  blockUser,
  BlockedFriendItem,
  ConversationListItem,
  createDirectConversation,
  decodePayload,
  FriendListItem,
  FriendSearchItem,
  getConversations,
  getBlockedUsers,
  getFriends,
  getIncomingRequests,
  getMessages,
  login,
  MessageItem,
  PendingFriendItem,
  requestFriend,
  respondFriend,
  searchUsers,
  sendMessage,
  setAuthToken,
  unblockUser,
  wsBaseUrl,
} from './src/api';

type TabKey = 'chat' | 'friend';

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

function getDisplayName(row: ConversationListItem): string {
  return row.peerUser?.username ?? row.conversationId.slice(0, 8);
}

function getInitials(value: string): string {
  return value.trim().slice(0, 2).toUpperCase();
}

function isBurnExpired(row: MessageItem, nowMs = Date.now()): boolean {
  if (!row.isBurn || !row.readAt || !row.burnDuration) {
    return false;
  }
  const readAtMs = Date.parse(row.readAt);
  if (Number.isNaN(readAtMs)) {
    return false;
  }
  return readAtMs + row.burnDuration * 1000 <= nowMs;
}

export default function App(): JSX.Element {
  const [account, setAccount] = useState('alice');
  const [password, setPassword] = useState('Password123');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [peerUserId, setPeerUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tab, setTab] = useState<TabKey>('chat');
  const [friendKeyword, setFriendKeyword] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingFriendItem[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedFriendItem[]>([]);
  const activeConversationIdRef = useRef('');

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversationId === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

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

  async function handleLogin(): Promise<void> {
    setLoading(true);
    try {
      const result = await login(account.trim(), password);
      setAuthToken(result.accessToken);
      setToken(result.accessToken);
      setUserId(result.userId);
      await Promise.all([loadConversations(), loadFriendData()]);
    } catch {
      Alert.alert('登录失败', '请检查账号密码或后端服务地址。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (token && activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [token, activeConversationId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setMessages((prev) => prev.filter((row) => !isBurnExpired(row, nowMs)));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const client: Socket = io(wsBaseUrl, {
      transports: ['websocket'],
      auth: { token },
    });
    setSocket(client);

    const onUpdate = (payload: { conversationId?: string }): void => {
      if (payload?.conversationId === activeConversationIdRef.current && activeConversationIdRef.current) {
        void loadMessages(activeConversationIdRef.current);
      }
      void loadConversations();
    };

    client.on('connect', () => {
      if (activeConversationIdRef.current) {
        client.emit('conversation.join', { conversationId: activeConversationIdRef.current });
      }
    });

    client.on('message.sent', onUpdate);
    client.on('message.delivered', onUpdate);
    client.on('message.read', onUpdate);
    client.on('burn.triggered', onUpdate);
    client.on('conversation.updated', onUpdate);
    client.on('conversation.typing', (payload: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
      if (!activeConversationIdRef.current || payload.conversationId !== activeConversationIdRef.current) {
        return;
      }
      if (!payload.userId || payload.userId === userId) {
        return;
      }
      setTypingText(payload.isTyping ? '对方正在输入...' : '');
    });

    return () => {
      client.disconnect();
      setSocket(null);
    };
  }, [token, userId]);

  useEffect(() => {
    if (socket && activeConversationId) {
      socket.emit('conversation.join', { conversationId: activeConversationId });
    }
  }, [socket, activeConversationId]);

  async function handleSend(): Promise<void> {
    if (!activeConversationId || !messageText.trim()) {
      return;
    }
    await sendMessage(activeConversationId, messageText.trim());
    setMessageText('');
    await Promise.all([loadMessages(activeConversationId), loadConversations()]);
  }

  async function handleCreateDirect(): Promise<void> {
    if (!peerUserId.trim()) {
      return;
    }
    try {
      const row = await createDirectConversation(peerUserId.trim());
      setPeerUserId('');
      await loadConversations();
      setActiveConversationId(row.conversationId);
    } catch {
      Alert.alert('创建失败', '请确认 peerUserId 是否正确。');
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

  async function handleSearchFriends(): Promise<void> {
    const keyword = friendKeyword.trim();
    if (!keyword) {
      setFriendSearchResults([]);
      return;
    }
    try {
      const rows = await searchUsers(keyword, 20);
      setFriendSearchResults(rows);
    } catch {
      Alert.alert('搜索失败', '请稍后重试。');
    }
  }

  async function handleRequestFriend(targetUserId: string): Promise<void> {
    try {
      await requestFriend(targetUserId);
      await Promise.all([loadFriendData(), handleSearchFriends()]);
    } catch {
      Alert.alert('发送失败', '好友申请发送失败。');
    }
  }

  async function handleRespondFriend(requesterUserId: string, accept: boolean): Promise<void> {
    try {
      await respondFriend(requesterUserId, accept);
      await Promise.all([loadFriendData(), handleSearchFriends()]);
    } catch {
      Alert.alert('处理失败', '处理好友申请失败。');
    }
  }

  async function handleBlockUser(targetUserId: string): Promise<void> {
    try {
      await blockUser(targetUserId);
      await Promise.all([loadFriendData(), handleSearchFriends()]);
    } catch {
      Alert.alert('拉黑失败', '操作失败，请稍后重试。');
    }
  }

  async function handleUnblockUser(targetUserId: string): Promise<void> {
    try {
      await unblockUser(targetUserId);
      await Promise.all([loadFriendData(), handleSearchFriends()]);
    } catch {
      Alert.alert('解除失败', '操作失败，请稍后重试。');
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loginCard}>
          <Text style={styles.loginKicker}>Secure Messenger</Text>
          <Text style={styles.title}>Security Chat</Text>
          <Text style={styles.subtitle}>Telegram-style Mobile Console</Text>
          <TextInput style={styles.input} value={account} onChangeText={setAccount} placeholder="账号" />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="密码"
            secureTextEntry
          />
          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>登录</Text>}
          </Pressable>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <View style={styles.rail}>
          <Pressable
            style={tab === 'chat' ? styles.railTabActive : styles.railTab}
            onPress={() => setTab('chat')}
          >
            <Text style={tab === 'chat' ? styles.railTabTextActive : styles.railTabText}>Chats</Text>
          </Pressable>
          <Pressable
            style={tab === 'friend' ? styles.railTabActive : styles.railTab}
            onPress={() => setTab('friend')}
          >
            <Text style={tab === 'friend' ? styles.railTabTextActive : styles.railTabText}>Friends</Text>
          </Pressable>
        </View>

        {tab === 'friend' ? (
          <ScrollView style={styles.friendPanel} contentContainerStyle={styles.friendPanelContent}>
            <Text style={styles.friendTitle}>好友管理</Text>
            <View style={styles.inlineForm}>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={friendKeyword}
                onChangeText={setFriendKeyword}
                placeholder="搜索用户"
              />
              <Pressable style={styles.smallButton} onPress={handleSearchFriends}>
                <Text style={styles.primaryButtonText}>搜索</Text>
              </Pressable>
            </View>

            <Text style={styles.friendSectionTitle}>搜索结果</Text>
            {friendSearchResults.length === 0 ? (
              <Text style={styles.friendDesc}>暂无结果</Text>
            ) : (
              friendSearchResults.map((item) => (
                <View key={`search-${item.userId}`} style={styles.friendRow}>
                  <Text style={styles.friendName}>{item.username}</Text>
                  <Text style={styles.friendMeta}>{item.relation}</Text>
                  <Pressable style={styles.smallButton} onPress={() => void handleRequestFriend(item.userId)}>
                    <Text style={styles.primaryButtonText}>加好友</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.friendSectionTitle}>待处理申请</Text>
            {incomingRequests.length === 0 ? (
              <Text style={styles.friendDesc}>暂无待处理请求</Text>
            ) : (
              incomingRequests.map((item) => (
                <View key={`pending-${item.requesterUserId}`} style={styles.friendRow}>
                  <View style={styles.friendMain}>
                    <Text style={styles.friendName}>{item.username}</Text>
                    <Text style={styles.friendMeta}>{item.remark || item.requesterUserId.slice(0, 8)}</Text>
                  </View>
                  <Pressable style={styles.smallButton} onPress={() => void handleRespondFriend(item.requesterUserId, true)}>
                    <Text style={styles.primaryButtonText}>同意</Text>
                  </Pressable>
                  <Pressable style={styles.smallGhostButton} onPress={() => void handleRespondFriend(item.requesterUserId, false)}>
                    <Text style={styles.ghostButtonText}>拒绝</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.friendSectionTitle}>好友列表</Text>
            {friends.length === 0 ? (
              <Text style={styles.friendDesc}>暂无好友</Text>
            ) : (
              friends.map((item) => (
                <View key={`friend-${item.userId}`} style={styles.friendRow}>
                  <View style={styles.friendMain}>
                    <Text style={styles.friendName}>{item.username}</Text>
                    <Text style={styles.friendMeta}>{item.online ? '在线' : '离线'}</Text>
                  </View>
                  <Pressable style={styles.smallGhostButton} onPress={() => void handleBlockUser(item.userId)}>
                    <Text style={styles.ghostButtonText}>拉黑</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.friendSectionTitle}>黑名单</Text>
            {blockedUsers.length === 0 ? (
              <Text style={styles.friendDesc}>黑名单为空</Text>
            ) : (
              blockedUsers.map((item) => (
                <View key={`blocked-${item.userId}`} style={styles.friendRow}>
                  <Text style={styles.friendName}>{item.username}</Text>
                  <Pressable style={styles.smallButton} onPress={() => void handleUnblockUser(item.userId)}>
                    <Text style={styles.primaryButtonText}>解除</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        ) : (
          <>
            <View style={styles.sidebarCard}>
              <Text style={styles.sectionTitle}>会话</Text>
              <View style={styles.inlineForm}>
                <TextInput
                  style={[styles.input, styles.inlineInput, styles.darkInput]}
                  value={peerUserId}
                  onChangeText={setPeerUserId}
                  placeholder="peerUserId"
                  placeholderTextColor="#84a4bf"
                />
                <Pressable style={styles.smallButton} onPress={handleCreateDirect}>
                  <Text style={styles.primaryButtonText}>发起</Text>
                </Pressable>
              </View>

              <FlatList
                data={conversations}
                keyExtractor={(item) => item.conversationId}
                style={styles.conversationList}
                renderItem={({ item }) => {
                  const active = item.conversationId === activeConversationId;
                  const displayName = getDisplayName(item);
                  return (
                    <Pressable
                      style={active ? styles.conversationItemActive : styles.conversationItem}
                      onPress={() => setActiveConversationId(item.conversationId)}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
                      </View>
                      <View style={styles.conversationMain}>
                        <View style={styles.conversationTopRow}>
                          <Text style={styles.conversationName} numberOfLines={1}>{displayName}</Text>
                          <Text style={styles.conversationTime}>{formatTime(item.lastMessage?.createdAt)}</Text>
                        </View>
                        <Text style={styles.conversationMeta} numberOfLines={1}>
                          {item.lastMessage
                            ? item.lastMessage.readAt
                              ? '已读'
                              : item.lastMessage.deliveredAt
                                ? '已送达'
                                : '已发送'
                            : '暂无消息'}
                        </Text>
                      </View>
                      {item.unreadCount > 0 ? (
                        <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unreadCount}</Text></View>
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            </View>

            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarText}>{getInitials(activeConversation?.peerUser?.username ?? 'SC')}</Text>
                </View>
                <View style={styles.chatHeaderMain}>
                  <Text style={styles.chatTitle}>{activeConversation?.peerUser?.username ?? '未选择会话'}</Text>
                  <Text style={styles.chatSub}>{typingText || '加密聊天中'}</Text>
                </View>
              </View>

              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                style={styles.messageList}
                contentContainerStyle={styles.messageContainer}
                renderItem={({ item }) => (
                  <View style={item.senderId === userId ? styles.messageSelf : styles.messageOther}>
                    <Text style={styles.messageText}>{decodePayload(item.encryptedPayload)}</Text>
                    <Text style={styles.messageMeta}>{formatTime(item.createdAt)}</Text>
                  </View>
                )}
              />

              <View style={styles.composerBar}>
                <Pressable style={styles.plusButton}><Text style={styles.plusText}>+</Text></Pressable>
                <TextInput
                  style={styles.composerInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="输入消息"
                  onFocus={() => socket?.emit('conversation.typing.start', { conversationId: activeConversationId })}
                  onBlur={() => socket?.emit('conversation.typing.stop', { conversationId: activeConversationId })}
                />
                <Pressable style={styles.sendButton} onPress={handleSend}>
                  <Text style={styles.primaryButtonText}>发送</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f1b2b',
  },
  container: {
    flex: 1,
    padding: 10,
    gap: 10,
    backgroundColor: '#dfe9f3',
  },
  loginCard: {
    margin: 18,
    marginTop: 56,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#17212b',
    borderWidth: 1,
    borderColor: '#2c4156',
    gap: 10,
  },
  loginKicker: {
    color: '#72a7da',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#eef5ff',
  },
  subtitle: {
    color: '#97b1c8',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bcccdc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#102a43',
  },
  darkInput: {
    backgroundColor: '#213244',
    color: '#e5eff9',
    borderColor: '#35506a',
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: '#3390ec',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rail: {
    flexDirection: 'row',
    backgroundColor: '#17212b',
    borderRadius: 12,
    padding: 6,
    gap: 6,
  },
  railTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#243748',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railTabActive: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#3390ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railTabText: {
    color: '#c4d6e7',
    fontWeight: '600',
  },
  railTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  friendPlaceholder: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d2dee9',
    backgroundColor: '#f8fbff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  friendTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18344f',
  },
  friendDesc: {
    color: '#5f778e',
    textAlign: 'left',
  },
  friendPanel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d2dee9',
    backgroundColor: '#f8fbff',
  },
  friendPanelContent: {
    padding: 14,
    gap: 10,
  },
  friendSectionTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#254663',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4e2ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  friendMain: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: '#18344f',
    fontWeight: '600',
  },
  friendMeta: {
    color: '#68849e',
    fontSize: 12,
  },
  smallGhostButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9bb6cc',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 66,
    paddingHorizontal: 10,
    backgroundColor: '#eef5fb',
  },
  ghostButtonText: {
    color: '#2f587b',
    fontWeight: '600',
  },
  sidebarCard: {
    flex: 1.05,
    borderRadius: 14,
    backgroundColor: '#17212b',
    borderWidth: 1,
    borderColor: '#2d3f4f',
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#eef5ff',
  },
  inlineForm: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1,
  },
  smallButton: {
    backgroundColor: '#3390ec',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 66,
    paddingHorizontal: 10,
  },
  conversationList: {
    flex: 1,
  },
  conversationItem: {
    borderWidth: 1,
    borderColor: '#2f4558',
    borderRadius: 12,
    backgroundColor: '#233547',
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conversationItemActive: {
    borderWidth: 1,
    borderColor: '#66b0f2',
    borderRadius: 12,
    backgroundColor: '#2f5f8a',
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4c96dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4c96dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  conversationMain: {
    flex: 1,
    gap: 2,
  },
  conversationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  conversationName: {
    color: '#eff5fb',
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    color: '#b4cadf',
    fontSize: 11,
  },
  conversationMeta: {
    color: '#abc0d4',
    fontSize: 12,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5bb3f3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chatCard: {
    flex: 1.4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d2dee9',
    backgroundColor: '#ecf3fa',
    padding: 10,
    gap: 10,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#d6e3ef',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 10,
  },
  chatHeaderMain: {
    flex: 1,
    gap: 2,
  },
  chatTitle: {
    fontWeight: '700',
    color: '#1b354c',
  },
  chatSub: {
    color: '#5f7a92',
    fontSize: 12,
  },
  messageList: {
    flex: 1,
  },
  messageContainer: {
    gap: 8,
    paddingBottom: 2,
  },
  messageOther: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d8e3ee',
    borderRadius: 14,
    borderBottomLeftRadius: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '82%',
  },
  messageSelf: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#c4def6',
    borderRadius: 14,
    borderBottomRightRadius: 6,
    backgroundColor: '#e8f3ff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '82%',
  },
  messageText: {
    color: '#18344f',
  },
  messageMeta: {
    marginTop: 6,
    fontSize: 11,
    color: '#6d859b',
    textAlign: 'right',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d7e2ee',
    borderRadius: 999,
    backgroundColor: '#fff',
    padding: 6,
  },
  plusButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#edf4fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 20,
    color: '#567692',
    lineHeight: 20,
  },
  composerInput: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 6,
    color: '#1e3b52',
  },
  sendButton: {
    minWidth: 72,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#3390ec',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
