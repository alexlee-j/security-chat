/**
 * 文件名：use-signal.ts
 * 所属模块：桌面端 - 核心状态管理
 * 核心作用：实现 Signal 协议的状态管理和业务逻辑，包括密钥管理、会话管理、消息加密解密等
 * 核心依赖：React Hooks、Signal 协议核心实现、密钥管理模块、消息加密服务
 * 创建时间：2026-03-14
 * 更新时间：2026-03-18 - 优化预密钥检查和补充机制
 */

import { useRef, useState } from 'react';
import { KeyManager } from './signal/key-management';
import { messageEncryptionService } from './signal/message-encryption';
import {
  decodeRustEnvelope,
  decodeRustGroupEnvelope,
  encodeRustEnvelope,
  encodeRustGroupEnvelope,
  RustSignalRuntime,
} from './signal/rust-signal';

/**
 * Signal 协议状态类型定义
 */
export type SignalState = {
  initialized: boolean;
  initializing: boolean;
  error: string | null;
  identityKeyFingerprint: string | null;
  registrationId: number | null;
  prekeysUploaded: boolean;
  prekeysStatus: {
    hasSignedPrekeys: boolean;
    hasOneTimePrekeys: boolean;
    signedPrekeysCount: number;
    oneTimePrekeysCount: number;
  } | null;
};

/**
 * Signal 协议操作类型定义
 */
export type SignalActions = {
  initialize: (userId?: string) => Promise<void>;
  uploadPrekeys: () => Promise<void>;
  encryptMessage: (recipientUserId: string, recipientDeviceId: string, recipientSignalDeviceId: number, plaintext: string) => Promise<string>;
  decryptMessage: (senderUserId: string, senderDeviceId: string, senderSignalDeviceId: number, encryptedMessage: string) => Promise<string>;
  syncGroupMembers: (groupId: string, memberUserIds: string[]) => Promise<void>;
  encryptGroupMessage: (groupId: string, plaintext: string) => Promise<string>;
  decryptGroupMessage: (groupId: string, encryptedMessage: string) => Promise<string>;
  verifyKey: (userId: string, deviceId: string, fingerprint: string, isVerified: boolean) => Promise<void>;
  getVerificationStatus: (userId: string) => Promise<any>;
  getIdentityKeyInfo: (userId: string) => Promise<any>;
  replenishPrekeys: () => Promise<void>;
  clearAll: () => Promise<void>;
  resetRuntime: () => void;
  setDeviceId: (deviceId: string) => Promise<void>;
  setUserId: (userId: string) => void;
};

/**
 * Signal 协议 Hook
 * @returns 包含状态和操作的对象
 */
export function useSignal(): { state: SignalState; actions: SignalActions } {
  // 状态
  const [state, setState] = useState<SignalState>({
    initialized: false,
    initializing: false,
    error: null,
    identityKeyFingerprint: null,
    registrationId: null,
    prekeysUploaded: false,
    prekeysStatus: null,
  });

  // 引用
  const keyManagerRef = useRef<KeyManager | null>(null);
  const initializedRef = useRef(false);
  const rustSignalRef = useRef<RustSignalRuntime | null>(null);

  /**
   * 检查预密钥状态
   */
  async function checkPrekeysStatus(): Promise<{
    hasSignedPrekeys: boolean;
    hasOneTimePrekeys: boolean;
    signedPrekeysCount: number;
    oneTimePrekeysCount: number;
  }> {
    if (!rustSignalRef.current) {
      throw new Error('Rust signal runtime not initialized');
    }
    const local = await rustSignalRef.current.getLocalPrekeyUploadPackage();

    return {
      hasSignedPrekeys: !!local.signedPrekey,
      hasOneTimePrekeys: local.oneTimePrekeys.length > 0,
      signedPrekeysCount: local.signedPrekey ? 1 : 0,
      oneTimePrekeysCount: local.oneTimePrekeys.length,
    };
  }

  /**
   * 初始化 Signal 协议
   * @param userId 可选的用户 ID，如果在 initialize 之前没有调用 setUserId，可以通过此参数传递
   */
  const initialize = async (userId?: string) => {
    if (state.initializing) {
      return;
    }

    const currentUserId = keyManagerRef.current?.getUserId?.() ?? null;
    if (initializedRef.current) {
      if (!userId || userId === currentUserId) {
        return;
      }
      // 切换账号时重置运行时状态，再按新用户上下文重新初始化
      initializedRef.current = false;
      setState((prev) => ({
        ...prev,
        initialized: false,
        prekeysUploaded: false,
        prekeysStatus: null,
      }));
    }

    setState(prev => ({ ...prev, initializing: true, error: null }));

    try {
      // 获取密钥管理器（使用单例，确保用户 ID 隔离）
      const keyManager = KeyManager.getInstance();
      keyManagerRef.current = keyManager;

      // 如果调用者传递了 userId，立即设置（必须在 initialize 之前）
      if (userId) {
        keyManager.setUserId(userId);
      }
      rustSignalRef.current = new RustSignalRuntime();
      await messageEncryptionService.initialize();
      const localPrekeys = await rustSignalRef.current.getLocalPrekeyUploadPackage();
      const registrationId = localPrekeys.registrationId;
      const fingerprint = await generateFingerprint(base64ToUint8Array(localPrekeys.identityPublicKey));

      // 检查并补充预密钥
      try {
        const prekeysStatus = await checkPrekeysStatus();

        setState(prev => ({ ...prev, prekeysStatus }));

        if (!prekeysStatus.hasSignedPrekeys || !prekeysStatus.hasOneTimePrekeys || prekeysStatus.oneTimePrekeysCount < 20) {
          await messageEncryptionService.replenishPrekeys();
          const newStatus = await checkPrekeysStatus();
          setState(prev => ({ ...prev, prekeysStatus: newStatus }));
        }
      } catch (error) {
        console.error('[Signal] Failed to initialize keys:', error);
      }

      // 更新状态
      setState(prev => ({
        ...prev,
        initialized: true,
        initializing: false,
        identityKeyFingerprint: fingerprint,
        registrationId,
        error: null,
      }));

      initializedRef.current = true;
    } catch (error) {
      console.error('[Signal] Failed to initialize Signal protocol:', error);
      setState(prev => ({
        ...prev,
        initializing: false,
        error: '初始化 Signal 协议失败',
      }));
    }
  };

  /**
   * 加密消息
   * 如果预密钥不足，会自动补充
   */
  const encryptMessage = async (recipientUserId: string, recipientDeviceId: string, recipientSignalDeviceId: number, plaintext: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }

      // 检查并补充预密钥（如果不足）
      await messageEncryptionService.checkAndReplenishPrekeys();

      const encryptedMessage = await messageEncryptionService.encryptMessage(
        recipientUserId,
        recipientDeviceId,
        recipientSignalDeviceId,
        plaintext
      );

      // 将加密消息转换为可传输的 JSON 对象（Base64 编码）
      const messageJson = encodeRustEnvelope({
        message_type: encryptedMessage.signedPreKeyId || 2,
        body: Array.from(encryptedMessage.ciphertext),
      });

      return messageJson;
    } catch (error) {
      console.error('[Signal] Failed to encrypt message:', error);
      throw new Error('加密消息失败');
    }
  };

  /**
   * 解密消息
   */
  const decryptMessage = async (senderUserId: string, senderDeviceId: string, senderSignalDeviceId: number, encryptedMessage: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }

      // 尝试 Base64 解码（如果消息是 Base64 编码的）
      const rustEnvelope = decodeRustEnvelope(encryptedMessage);
      if (!rustEnvelope) {
        throw new Error('Non-Rust envelope is not supported in Rust-only mode');
      }
      const encryptedMessageObj = {
        version: 1,
        registrationId: 0,
        signedPreKeyId: rustEnvelope.message_type,
        baseKey: new Uint8Array(),
        identityKey: new Uint8Array(),
        messageNumber: 0,
        previousChainLength: 0,
        ciphertext: new Uint8Array(rustEnvelope.body),
      };

      const plaintext = await messageEncryptionService.decryptMessage(
        senderUserId,
        senderDeviceId,
        senderSignalDeviceId,
        encryptedMessageObj
      );

      return plaintext;
    } catch (error) {
      console.error('[Signal] Failed to decrypt message:', error);
      throw new Error('解密消息失败');
    }
  };

  /**
   * 同步群聊成员，确保 Rust Sender Key 会话具备有效成员上下文
   */
  const syncGroupMembers = async (groupId: string, memberUserIds: string[]): Promise<void> => {
    try {
      if (!state.initialized) {
        await initialize();
      }
      await messageEncryptionService.syncGroupMembers(groupId, memberUserIds);
    } catch (error) {
      console.error('[Signal] Failed to sync group members:', error);
      throw new Error('同步群成员失败');
    }
  };

  /**
   * 群聊加密（Rust Sender Key）
   */
  const encryptGroupMessage = async (groupId: string, plaintext: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }
      const encryptedMessage = await messageEncryptionService.encryptGroupMessage(groupId, plaintext);
      return encodeRustGroupEnvelope(groupId, encryptedMessage);
    } catch (error) {
      console.error('[Signal] Failed to encrypt group message:', error);
      throw new Error('群消息加密失败');
    }
  };

  /**
   * 群聊解密（Rust Sender Key）
   */
  const decryptGroupMessage = async (groupId: string, encryptedMessage: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }
      const groupEnvelope = decodeRustGroupEnvelope(encryptedMessage);
      if (!groupEnvelope) {
        throw new Error('Non-Rust group envelope is not supported in Rust-only mode');
      }
      const targetGroupId = groupEnvelope.groupId || groupId;
      return await messageEncryptionService.decryptGroupMessage(targetGroupId, groupEnvelope.encrypted);
    } catch (error) {
      console.error('[Signal] Failed to decrypt group message:', error);
      throw new Error('群消息解密失败');
    }
  };

  /**
   * 验证密钥
   */
  const verifyKey = async (userId: string, deviceId: string, fingerprint: string, isVerified: boolean): Promise<void> => {
    try {
      await messageEncryptionService.verifyKey(userId, deviceId, fingerprint, isVerified);
    } catch (error) {
      console.error('[Signal] Failed to verify key:', error);
      throw new Error('验证密钥失败');
    }
  };

  /**
   * 获取验证状态
   */
  const getVerificationStatus = async (userId: string): Promise<any> => {
    try {
      return await messageEncryptionService.getVerificationStatus(userId);
    } catch (error) {
      console.error('[Signal] Failed to get verification status:', error);
      throw new Error('获取验证状态失败');
    }
  };

  /**
   * 获取身份密钥信息
   */
  const getIdentityKeyInfo = async (userId: string): Promise<any> => {
    try {
      return await messageEncryptionService.getIdentityKeyInfo(userId);
    } catch (error) {
      console.error('[Signal] Failed to get identity key info:', error);
      throw new Error('获取身份密钥信息失败');
    }
  };

  /**
   * 补充预密钥
   */
  const replenishPrekeys = async (): Promise<void> => {
    try {
      await messageEncryptionService.replenishPrekeys();
      
      // 更新预密钥状态
      if (rustSignalRef.current) {
        const newStatus = await checkPrekeysStatus();
        setState(prev => ({ ...prev, prekeysStatus: newStatus }));
      }
    } catch (error) {
      console.error('[Signal] Failed to replenish prekeys:', error);
      throw new Error('补充预密钥失败');
    }
  };

  /**
   * 清除所有密钥和会话
   */
  const clearAll = async (): Promise<void> => {
    try {
      await messageEncryptionService.clearAll();
      setState(prev => ({
        ...prev,
        initialized: false,
        identityKeyFingerprint: null,
        registrationId: null,
        prekeysUploaded: false,
        prekeysStatus: null,
      }));
      initializedRef.current = false;
    } catch (error) {
      console.error('[Signal] Failed to clear all keys and sessions:', error);
      throw new Error('清除所有密钥和会话失败');
    }
  };

  /**
   * 重置运行时状态，不清理已落盘密钥
   * 用于登出后切换账号，避免复用旧上下文
   */
  const resetRuntime = (): void => {
    keyManagerRef.current = null;
    rustSignalRef.current = null;
    initializedRef.current = false;
    setState((prev) => ({
      ...prev,
      initialized: false,
      initializing: false,
      error: null,
      identityKeyFingerprint: null,
      registrationId: null,
      prekeysUploaded: false,
      prekeysStatus: null,
    }));
  };

  /**
   * 设置当前设备ID
   * 用于在登录后将从服务器获取的设备ID设置到KeyManager
   */
  const setDeviceId = async (deviceId: string): Promise<void> => {
    if (keyManagerRef.current) {
      await keyManagerRef.current.setDeviceId(deviceId);
    }
  };

  /**
   * 设置当前用户 ID，用于密钥隔离
   * 必须在 initialize() 之后调用
   */
  const setUserId = (userId: string): void => {
    if (keyManagerRef.current) {
      keyManagerRef.current.setUserId(userId);
    }
  };

  /**
   * 上传预密钥到服务器
   * 必须在 setDeviceId() 之后调用，确保设备 ID 已设置
   */
  const uploadPrekeys = async (): Promise<void> => {
    if (!keyManagerRef.current) {
      throw new Error('KeyManager not initialized');
    }

    const authToken = localStorage.getItem('auth-token');
    if (!authToken || authToken.trim() === '') {
      console.log('[Signal] No auth token, skipping prekey upload');
      return;
    }

    try {
      await messageEncryptionService.uploadPrekeysWithKeyManager(keyManagerRef.current);
      setState(prev => ({ ...prev, prekeysUploaded: true }));
    } catch (error) {
      console.error('[Signal] Failed to upload prekeys:', error);
      throw error;
    }
  };

  return {
    state,
    actions: {
      initialize,
      uploadPrekeys,
      encryptMessage,
      decryptMessage,
      syncGroupMembers,
      encryptGroupMessage,
      decryptGroupMessage,
      verifyKey,
      getVerificationStatus,
      getIdentityKeyInfo,
      replenishPrekeys,
      clearAll,
      resetRuntime,
      setDeviceId,
      setUserId,
    },
  };
}

async function generateFingerprint(identityKey: Uint8Array): Promise<string> {
  const bytes = Uint8Array.from(identityKey);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = new Uint8Array(digest);
  return Array.from(hash).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
