/**
 * 文件名：use-local-db.ts
 * 所属模块：桌面端-本地数据库层
 * 核心作用：封装 Rust SQLite Commands，提供本地消息持久化能力
 *           支持离线消息查看、会话缓存、草稿存储
 * 核心依赖：@tauri-apps/api, types
 * 创建时间：2026-04-03 (Week 10)
 */

import { invoke } from '@tauri-apps/api/core';
import type { MessageItem, ConversationListItem } from './types';

// ==================== Rust 侧数据类型 (snake_case) ====================

interface RustConversation {
  id: string;
  type: number; // 1: 单聊, 2: 群聊
  name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface RustMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: number; // 1: 文本, 2: 图片, 3: 语音, 4: 文件
  content: string | null;
  nonce: string;
  is_burn: boolean;
  burn_duration: number | null;
  is_read: boolean;
  created_at: number;
  server_timestamp: number | null;
  local_timestamp: number;
}

interface RustDraft {
  id: string;
  conversation_id: string;
  content: string | null;
  updated_at: number;
}

// ==================== 前端类型 (camelCase) ====================

export interface LocalMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: number;
  content: string | null;
  nonce: string;
  isBurn: boolean;
  burnDuration: number | null;
  isRead: boolean;
  createdAt: number;
  serverTimestamp: number | null;
  localTimestamp: number;
}

export interface LocalConversation {
  id: string;
  type: number;
  name: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
}

export interface LocalDraft {
  id: string;
  conversationId: string;
  content: string | null;
  updatedAt: number;
}

// ==================== 类型转换 ====================

function rustToLocalMessage(msg: RustMessage): LocalMessage {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    messageType: msg.type,
    content: msg.content,
    nonce: msg.nonce,
    isBurn: msg.is_burn,
    burnDuration: msg.burn_duration,
    isRead: msg.is_read,
    createdAt: msg.created_at,
    serverTimestamp: msg.server_timestamp,
    localTimestamp: msg.local_timestamp,
  };
}

function localToRustMessage(msg: LocalMessage): RustMessage {
  return {
    id: msg.id,
    conversation_id: msg.conversationId,
    sender_id: msg.senderId,
    type: msg.messageType,
    content: msg.content,
    nonce: msg.nonce,
    is_burn: msg.isBurn,
    burn_duration: msg.burnDuration,
    is_read: msg.isRead,
    created_at: msg.createdAt,
    server_timestamp: msg.serverTimestamp,
    local_timestamp: msg.localTimestamp,
  };
}

function rustToLocalConversation(conv: RustConversation): LocalConversation {
  return {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    avatarUrl: conv.avatar_url,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    lastMessageAt: conv.last_message_at,
    lastMessagePreview: conv.last_message_preview,
  };
}

function localToRustConversation(conv: LocalConversation): RustConversation {
  return {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    avatar_url: conv.avatarUrl,
    created_at: conv.createdAt,
    updated_at: conv.updatedAt,
    last_message_at: conv.lastMessageAt,
    last_message_preview: conv.lastMessagePreview,
  };
}

function rustToLocalDraft(draft: RustDraft): LocalDraft {
  return {
    id: draft.id,
    conversationId: draft.conversation_id,
    content: draft.content,
    updatedAt: draft.updated_at,
  };
}

function localToRustDraft(draft: LocalDraft): RustDraft {
  return {
    id: draft.id,
    conversation_id: draft.conversationId,
    content: draft.content,
    updated_at: draft.updatedAt,
  };
}

// ==================== Hook 实现 ====================

export interface UseLocalDbReturn {
  // 消息操作
  saveMessage: (message: LocalMessage) => Promise<void>;
  getMessages: (conversationId: string, limit: number, before?: number) => Promise<LocalMessage[]>;
  deleteMessage: (messageId: string) => Promise<void>;

  // 会话操作
  saveConversation: (conversation: LocalConversation) => Promise<void>;
  getConversations: () => Promise<LocalConversation[]>;

  // 草稿操作
  saveDraft: (draft: LocalDraft) => Promise<void>;
  getDraft: (conversationId: string) => Promise<LocalDraft | null>;
  deleteDraft: (conversationId: string) => Promise<void>;

  // 消息状态
  markMessageRead: (messageId: string) => Promise<void>;
  getUnreadCount: (conversationId: string) => Promise<number>;

  // 密钥存储
  keychainStore: (id: string, keyType: string, keyData: Uint8Array) => Promise<void>;
  keychainRetrieve: (keyType: string) => Promise<Uint8Array | null>;

  // 状态
  isInitialized: boolean;
}

/**
 * 本地数据库 Hook
 * 封装 Rust SQLite Commands，提供本地持久化能力
 *
 * @example
 * ```typescript
 * const localDb = useLocalDb();
 *
 * // 保存消息
 * await localDb.saveMessage({
 *   id: 'msg-1',
 *   conversationId: 'conv-1',
 *   senderId: 'user-1',
 *   messageType: 1,
 *   content: 'Hello',
 *   nonce: 'xxx',
 *   isBurn: false,
 *   burnDuration: null,
 *   isRead: false,
 *   createdAt: Date.now(),
 *   serverTimestamp: null,
 *   localTimestamp: Date.now(),
 * });
 *
 * // 获取离线消息
 * const messages = await localDb.getMessages('conv-1', 50);
 * ```
 */
export function useLocalDb(): UseLocalDbReturn {
  // ==================== 消息操作 ====================

  /**
   * 保存消息到本地数据库
   */
  async function saveMessage(message: LocalMessage): Promise<void> {
    try {
      await invoke('db_save_message', { msg: localToRustMessage(message) });
    } catch (error) {
      console.error('[LocalDb] Failed to save message:', error);
      throw error;
    }
  }

  /**
   * 获取会话消息（分页）
   * @param conversationId 会话 ID
   * @param limit 最多返回消息数
   * @param before 可选，时间戳上限，获取此时间之前的消息
   */
  async function getMessages(
    conversationId: string,
    limit: number,
    before?: number,
  ): Promise<LocalMessage[]> {
    try {
      const beforeParam = before !== undefined ? before : null;
      const messages: RustMessage[] = await invoke('db_get_messages', {
        conversationId,
        limit,
        before: beforeParam,
      });
      return messages.map(rustToLocalMessage);
    } catch (error) {
      console.error('[LocalDb] Failed to get messages:', error);
      throw error;
    }
  }

  /**
   * 删除本地消息
   */
  async function deleteMessage(messageId: string): Promise<void> {
    try {
      await invoke('db_delete_message', { messageId });
    } catch (error) {
      console.error('[LocalDb] Failed to delete message:', error);
      throw error;
    }
  }

  // ==================== 会话操作 ====================

  /**
   * 保存会话到本地数据库
   */
  async function saveConversation(conversation: LocalConversation): Promise<void> {
    try {
      await invoke('db_save_conversation', { conv: localToRustConversation(conversation) });
    } catch (error) {
      console.error('[LocalDb] Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * 获取所有本地会话
   */
  async function getConversations(): Promise<LocalConversation[]> {
    try {
      const conversations: RustConversation[] = await invoke('db_get_conversations');
      return conversations.map(rustToLocalConversation);
    } catch (error) {
      console.error('[LocalDb] Failed to get conversations:', error);
      throw error;
    }
  }

  // ==================== 草稿操作 ====================

  /**
   * 保存草稿
   */
  async function saveDraft(draft: LocalDraft): Promise<void> {
    try {
      await invoke('db_save_draft', { draft: localToRustDraft(draft) });
    } catch (error) {
      console.error('[LocalDb] Failed to save draft:', error);
      throw error;
    }
  }

  /**
   * 获取草稿
   */
  async function getDraft(conversationId: string): Promise<LocalDraft | null> {
    try {
      const draft: RustDraft | null = await invoke('db_get_draft', { conversationId });
      return draft ? rustToLocalDraft(draft) : null;
    } catch (error) {
      console.error('[LocalDb] Failed to get draft:', error);
      throw error;
    }
  }

  /**
   * 删除草稿
   */
  async function deleteDraft(conversationId: string): Promise<void> {
    try {
      await invoke('db_delete_draft', { conversationId });
    } catch (error) {
      console.error('[LocalDb] Failed to delete draft:', error);
      throw error;
    }
  }

  // ==================== 消息状态 ====================

  /**
   * 标记消息已读
   */
  async function markMessageRead(messageId: string): Promise<void> {
    try {
      await invoke('db_mark_message_read', { messageId });
    } catch (error) {
      console.error('[LocalDb] Failed to mark message read:', error);
      throw error;
    }
  }

  /**
   * 获取会话未读消息数
   */
  async function getUnreadCount(conversationId: string): Promise<number> {
    try {
      const count: number = await invoke('db_get_unread_count', { conversationId });
      return count;
    } catch (error) {
      console.error('[LocalDb] Failed to get unread count:', error);
      throw error;
    }
  }

  // ==================== 密钥存储 ====================

  /**
   * 存储密钥到 Keychain
   */
  async function keychainStore(id: string, keyType: string, keyData: Uint8Array): Promise<void> {
    try {
      await invoke('keychain_store', { id, keyType, keyData: Array.from(keyData) });
    } catch (error) {
      console.error('[LocalDb] Failed to store keychain:', error);
      throw error;
    }
  }

  /**
   * 从 Keychain 检索密钥
   */
  async function keychainRetrieve(keyType: string): Promise<Uint8Array | null> {
    try {
      const data: number[] | null = await invoke('keychain_retrieve', { keyType });
      if (data === null) return null;
      return new Uint8Array(data);
    } catch (error) {
      console.error('[LocalDb] Failed to retrieve keychain:', error);
      throw error;
    }
  }

  return {
    saveMessage,
    getMessages,
    deleteMessage,
    saveConversation,
    getConversations,
    saveDraft,
    getDraft,
    deleteDraft,
    markMessageRead,
    getUnreadCount,
    keychainStore,
    keychainRetrieve,
    isInitialized: true,
  };
}

// ==================== 同步机制设计 ====================

/**
 * 消息同步状态
 */
export interface SyncState {
  lastSyncTimestamp: number;
  pendingUploads: string[]; // 待上传的消息 ID
  pendingDownloads: string[]; // 待下载的消息 ID
}

/**
 * 同步方向
 */
export type SyncDirection = 'upload' | 'download' | 'bidirectional';

/**
 * 冲突解决策略
 */
export type ConflictResolution = 'local_wins' | 'remote_wins' | 'newest_wins' | 'manual';

/**
 * 同步配置
 */
export interface SyncConfig {
  direction: SyncDirection;
  conflictResolution: ConflictResolution;
  batchSize: number;
  retryAttempts: number;
}

/**
 * 默认同步配置
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  direction: 'bidirectional',
  conflictResolution: 'newest_wins',
  batchSize: 100,
  retryAttempts: 3,
};

/**
 * 消息同步器类
 * 负责前后端消息同步
 */
export class MessageSynchronizer {
  private localDb: UseLocalDbReturn;
  private config: SyncConfig;
  private isSyncing: boolean = false;

  constructor(localDb: UseLocalDbReturn, config: Partial<SyncConfig> = {}) {
    this.localDb = localDb;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  /**
   * 增量同步：从服务器拉取新消息
   * @param conversationId 会话 ID
   * @param afterIndex 同步起始索引
   */
  async syncFromServer(conversationId: string, afterIndex: number = 0): Promise<LocalMessage[]> {
    // TODO: 调用后端 API 获取新消息
    // const remoteMessages = await getMessages(conversationId, afterIndex);
    // 将远程消息保存到本地
    // for (const msg of remoteMessages) {
    //   await this.localDb.saveMessage(msg);
    // }
    return [];
  }

  /**
   * 上传本地消息到服务器
   * @param messageId 本地消息 ID
   */
  async syncToServer(messageId: string): Promise<void> {
    // TODO: 调用后端 API 上传消息
  }

  /**
   * 冲突检测
   * @param localMsg 本地消息
   * @param remoteMsg 远程消息
   */
  detectConflict(localMsg: LocalMessage, remoteMsg: LocalMessage): boolean {
    // 如果本地消息的 serverTimestamp 与远程不同，说明有冲突
    if (localMsg.serverTimestamp && remoteMsg.serverTimestamp) {
      return localMsg.serverTimestamp !== remoteMsg.serverTimestamp;
    }
    return false;
  }

  /**
   * 解决冲突
   */
  resolveConflict(localMsg: LocalMessage, remoteMsg: LocalMessage): LocalMessage {
    switch (this.config.conflictResolution) {
      case 'local_wins':
        return localMsg;
      case 'remote_wins':
        return remoteMsg;
      case 'newest_wins':
        return localMsg.createdAt > remoteMsg.createdAt ? localMsg : remoteMsg;
      case 'manual':
      default:
        // 返回远程消息，让用户手动解决
        return remoteMsg;
    }
  }
}
