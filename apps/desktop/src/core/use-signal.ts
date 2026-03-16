/**
 * 文件名：use-signal.ts
 * 所属模块：桌面端-核心状态管理
 * 核心作用：实现Signal协议的状态管理和业务逻辑，包括密钥管理、会话管理、消息加密解密等
 * 核心依赖：React Hooks、Signal协议核心实现、密钥管理模块、消息加密服务
 * 创建时间：2026-03-14
 */

import { useEffect, useRef, useState } from 'react';
import { SignalProtocol } from './signal';
import { KeyManager } from './signal/key-management';
import { messageEncryptionService } from './signal/message-encryption';

/**
 * Signal协议状态类型定义
 */
export type SignalState = {
  initialized: boolean;
  initializing: boolean;
  error: string | null;
  identityKeyFingerprint: string | null;
  registrationId: number | null;
  prekeysUploaded: boolean;
};

/**
 * Signal协议操作类型定义
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
 * Signal协议Hook
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
  });

  // 引用
  const signalRef = useRef<SignalProtocol | null>(null);
  const keyManagerRef = useRef<KeyManager | null>(null);
  const initializedRef = useRef(false);

  /**
   * 初始化Signal协议
   */
  const initialize = async () => {
    if (initializedRef.current || state.initializing) {
      return;
    }

    setState(prev => ({ ...prev, initializing: true, error: null }));

    try {
      // 初始化消息加密服务
      await messageEncryptionService.initialize();

      // 创建Signal协议实例
      signalRef.current = new SignalProtocol();

      // 获取密钥管理器
      const keyManager = new KeyManager();
      keyManagerRef.current = keyManager;

      // 初始化密钥管理
      await keyManager.initialize();

      // 获取注册ID
      const registrationId = await keyManager.getRegistrationId();

      // 获取身份密钥对
      const identityKeyPair = await keyManager.getIdentityKeyPair();

      // 生成身份密钥指纹
      const fingerprint = await signalRef.current.generateFingerprint(identityKeyPair.publicKeyBytes);

      // 上传预密钥
      try {
        await messageEncryptionService.uploadPrekeys();
        setState(prev => ({ ...prev, prekeysUploaded: true }));
      } catch (error) {
        console.error('Failed to upload prekeys:', error);
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
    } catch (error) {
      console.error('Failed to initialize Signal protocol:', error);
      setState(prev => ({
        ...prev,
        initializing: false,
        error: '初始化Signal协议失败',
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
      console.error('Failed to encrypt message:', error);
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
      console.error('Failed to decrypt message:', error);
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
      console.error('Failed to verify key:', error);
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
      console.error('Failed to get verification status:', error);
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
      console.error('Failed to get identity key info:', error);
      throw new Error('获取身份密钥信息失败');
    }
  };

  /**
   * 补充预密钥
   */
  const replenishPrekeys = async (): Promise<void> => {
    try {
      await messageEncryptionService.replenishPrekeys();
    } catch (error) {
      console.error('Failed to replenish prekeys:', error);
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
      }));
      initializedRef.current = false;
    } catch (error) {
      console.error('Failed to clear all keys and sessions:', error);
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
