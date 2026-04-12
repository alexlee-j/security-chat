/**
 * 文件名：use-signal.ts
 * 所属模块：桌面端 - 核心状态管理
 * 核心作用：实现 Signal 协议的状态管理和业务逻辑，包括密钥管理、会话管理、消息加密解密等
 * 核心依赖：React Hooks、Signal 协议核心实现、密钥管理模块、消息加密服务
 * 创建时间：2026-03-14
 * 更新时间：2026-03-18 - 优化预密钥检查和补充机制
 */

import { useRef, useState } from 'react';
import { SignalProtocol } from './signal';
import { KeyManager } from './signal/key-management';
import { messageEncryptionService } from './signal/message-encryption';

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
  encryptMessage: (recipientUserId: string, recipientDeviceId: string, plaintext: string) => Promise<string>;
  decryptMessage: (senderUserId: string, senderDeviceId: string, encryptedMessage: string) => Promise<string>;
  verifyKey: (userId: string, deviceId: string, fingerprint: string, isVerified: boolean) => Promise<void>;
  getVerificationStatus: (userId: string) => Promise<any>;
  getIdentityKeyInfo: (userId: string) => Promise<any>;
  replenishPrekeys: () => Promise<void>;
  clearAll: () => Promise<void>;
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
  const signalRef = useRef<SignalProtocol | null>(null);
  const keyManagerRef = useRef<KeyManager | null>(null);
  const initializedRef = useRef(false);

  /**
   * 检查预密钥状态
   */
  async function checkPrekeysStatus(keyManager: KeyManager): Promise<{
    hasSignedPrekeys: boolean;
    hasOneTimePrekeys: boolean;
    signedPrekeysCount: number;
    oneTimePrekeysCount: number;
  }> {
    const signedPrekeys = await keyManager.getSignedPrekeys();
    const oneTimePrekeys = await keyManager.getOneTimePrekeys();

    return {
      hasSignedPrekeys: signedPrekeys.length > 0,
      hasOneTimePrekeys: oneTimePrekeys.length > 0,
      signedPrekeysCount: signedPrekeys.length,
      oneTimePrekeysCount: oneTimePrekeys.length,
    };
  }

  /**
   * 生成所有预密钥
   */
  async function generateAllPrekeys(
    keyManager: KeyManager,
    status: {
      hasSignedPrekeys: boolean;
      hasOneTimePrekeys: boolean;
      signedPrekeysCount: number;
      oneTimePrekeysCount: number;
    }
  ): Promise<void> {
    if (!status.hasSignedPrekeys) {
      await keyManager.generateSignedPrekeys(1);
    }

    if (!status.hasOneTimePrekeys || status.oneTimePrekeysCount < 100) {
      const count = status.hasOneTimePrekeys ? (100 - status.oneTimePrekeysCount) : 100;
      await keyManager.generateOneTimePrekeys(count);
    }
  }

  /**
   * 初始化 Signal 协议
   * @param userId 可选的用户 ID，如果在 initialize 之前没有调用 setUserId，可以通过此参数传递
   */
  const initialize = async (userId?: string) => {
    if (initializedRef.current || state.initializing) {
      return;
    }

    setState(prev => ({ ...prev, initializing: true, error: null }));

    try {
      // 创建 Signal 协议实例
      signalRef.current = new SignalProtocol();

      // 获取密钥管理器（使用单例，确保用户 ID 隔离）
      const keyManager = KeyManager.getInstance();
      keyManagerRef.current = keyManager;

      // 如果调用者传递了 userId，立即设置（必须在 initialize 之前）
      if (userId) {
        keyManager.setUserId(userId);
      }

      // 初始化密钥管理（这会生成身份密钥对和预密钥）
      await keyManager.initialize();

      // 获取注册 ID
      const registrationId = await keyManager.getRegistrationId();

      // 获取身份密钥对
      const identityKeyPair = await keyManager.getIdentityKeyPair();

      // 生成身份密钥指纹
      const fingerprint = await signalRef.current.generateFingerprint(identityKeyPair.publicKeyBytes);

      // 检查并补充预密钥
      try {
        const prekeysStatus = await checkPrekeysStatus(keyManager);

        setState(prev => ({ ...prev, prekeysStatus }));

        if (!prekeysStatus.hasSignedPrekeys || !prekeysStatus.hasOneTimePrekeys) {
          await generateAllPrekeys(keyManager, prekeysStatus);

          // 更新状态
          const newStatus = await checkPrekeysStatus(keyManager);
          setState(prev => ({ ...prev, prekeysStatus: newStatus }));
        }
        // 注意：预密钥上传现在由调用者在 setDeviceId 之后显式调用
        // 这是为了确保设备 ID 在上传预密钥之前已经正确设置
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
  const encryptMessage = async (recipientUserId: string, recipientDeviceId: string, plaintext: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }

      // 检查并补充预密钥（如果不足）
      await messageEncryptionService.checkAndReplenishPrekeys();

      const encryptedMessage = await messageEncryptionService.encryptMessage(
        recipientUserId,
        recipientDeviceId,
        plaintext
      );

      // 将加密消息转换为可传输的 JSON 对象（Base64 编码）
      const messageJson = SignalProtocol.messageToJSON(encryptedMessage);

      // 将 JSON 对象序列化为字符串
      return JSON.stringify(messageJson);
    } catch (error) {
      console.error('[Signal] Failed to encrypt message:', error);
      throw new Error('加密消息失败');
    }
  };

  /**
   * 解密消息
   */
  const decryptMessage = async (senderUserId: string, senderDeviceId: string, encryptedMessage: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }

      // 尝试 Base64 解码（如果消息是 Base64 编码的）
      let messageJson: Record<string, any>;
      try {
        const decoded = atob(encryptedMessage);
        messageJson = JSON.parse(decoded);
      } catch {
        // 如果不是 Base64，直接尝试 JSON 解析
        messageJson = JSON.parse(encryptedMessage);
      }

      // 将 JSON 对象转换回 EncryptedMessage（Base64 解码）
      const encryptedMessageObj = SignalProtocol.messageFromJSON(messageJson);

      const plaintext = await messageEncryptionService.decryptMessage(
        senderUserId,
        senderDeviceId,
        encryptedMessageObj
      );

      return plaintext;
    } catch (error) {
      console.error('[Signal] Failed to decrypt message:', error);
      throw new Error('解密消息失败');
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
      if (keyManagerRef.current) {
        const newStatus = await checkPrekeysStatus(keyManagerRef.current);
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
      verifyKey,
      getVerificationStatus,
      getIdentityKeyInfo,
      replenishPrekeys,
      clearAll,
      setDeviceId,
      setUserId,
    },
  };
}
