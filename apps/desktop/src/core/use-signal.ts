/**
 * 文件名：use-signal.ts
 * 所属模块：桌面端 - 核心状态管理
 * 核心作用：实现 Signal 协议的状态管理和业务逻辑，包括密钥管理、会话管理、消息加密解密等
 * 核心依赖：React Hooks、Signal 协议核心实现、密钥管理模块、消息加密服务
 * 创建时间：2026-03-14
 * 更新时间：2026-03-18 - 优化预密钥检查和补充机制
 */

import { useEffect, useRef, useState } from 'react';
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
  initialize: () => Promise<void>;
  encryptMessage: (recipientUserId: string, recipientDeviceId: string, plaintext: string) => Promise<string>;
  decryptMessage: (senderUserId: string, senderDeviceId: string, encryptedMessage: string) => Promise<string>;
  verifyKey: (userId: string, deviceId: string, fingerprint: string, isVerified: boolean) => Promise<void>;
  getVerificationStatus: (userId: string) => Promise<any>;
  getIdentityKeyInfo: (userId: string) => Promise<any>;
  replenishPrekeys: () => Promise<void>;
  clearAll: () => Promise<void>;
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
      console.log('[Signal] Generating signed prekeys...');
      await keyManager.generateSignedPrekeys(1);
    }

    if (!status.hasOneTimePrekeys || status.oneTimePrekeysCount < 100) {
      const count = status.hasOneTimePrekeys ? (100 - status.oneTimePrekeysCount) : 100;
      console.log(`[Signal] Generating ${count} one-time prekeys...`);
      await keyManager.generateOneTimePrekeys(count);
    }
  }

  /**
   * 初始化 Signal 协议
   */
  const initialize = async () => {
    if (initializedRef.current || state.initializing) {
      return;
    }

    setState(prev => ({ ...prev, initializing: true, error: null }));

    try {
      // 创建 Signal 协议实例
      signalRef.current = new SignalProtocol();

      // 获取密钥管理器（使用单例）
      const keyManager = new KeyManager();
      keyManagerRef.current = keyManager;

      // 初始化密钥管理（这会生成身份密钥对和预密钥）
      console.log('[Signal] Initializing key manager...');
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
        console.log('[Signal] Prekeys status after initialize:', prekeysStatus);

        setState(prev => ({ ...prev, prekeysStatus }));

        if (!prekeysStatus.hasSignedPrekeys || !prekeysStatus.hasOneTimePrekeys) {
          console.log('[Signal] Generating missing prekeys...', prekeysStatus);
          await generateAllPrekeys(keyManager, prekeysStatus);

          // 更新状态
          const newStatus = await checkPrekeysStatus(keyManager);
          console.log('[Signal] Prekeys status after generation:', newStatus);
          setState(prev => ({ ...prev, prekeysStatus: newStatus }));
        }

        // 上传预密钥到服务器（使用同一个 keyManager）
        // 仅在有认证令牌时才上传
        const authToken = localStorage.getItem('auth-token');
        if (authToken && authToken.trim() !== '') {
          console.log('[Signal] Uploading prekeys to server...');
          await messageEncryptionService.uploadPrekeysWithKeyManager(keyManager);
          setState(prev => ({ ...prev, prekeysUploaded: true }));
          console.log('[Signal] Prekeys uploaded successfully');
        } else {
          console.log('[Signal] No auth token found, skipping prekeys upload');
        }
      } catch (error) {
        console.error('[Signal] Failed to upload prekeys:', error);
        // 上传预密钥失败不影响初始化
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
      console.log('[Signal] Signal protocol initialized successfully');
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
   */
  const encryptMessage = async (recipientUserId: string, recipientDeviceId: string, plaintext: string): Promise<string> => {
    try {
      if (!state.initialized) {
        await initialize();
      }

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

  // 初始化
  useEffect(() => {
    void initialize();
  }, []);

  return {
    state,
    actions: {
      initialize,
      encryptMessage,
      decryptMessage,
      verifyKey,
      getVerificationStatus,
      getIdentityKeyInfo,
      replenishPrekeys,
      clearAll,
    },
  };
}
