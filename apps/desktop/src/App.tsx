/**
 * 文件名：App.tsx
 * 所属模块：桌面端-主应用容器
 * 核心作用：应用根组件，负责整体布局渲染、路由切换（聊天/好友）、全局快捷键处理
 *          整合登录界面、聊天面板、好友面板、会话侧边栏等核心模块
 * 核心依赖：React(useEffect, useState)、useChatClient、LoginScreen、ChatPanel、
 *          ConversationSidebar、FriendPanel
 * 创建时间：2024-01-01
 * 更新说明：2026-03-14 添加 Cmd/Ctrl+K 快捷键快速聚焦搜索框功能
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { LoginScreen } from './features/auth/login-screen';
import { ChatPanel } from './features/chat/chat-panel';
import { ConversationSidebar } from './features/chat/conversation-sidebar';
import { FriendPanel } from './features/friend/friend-panel';
import { useChatClient } from './core/use-chat-client';
import { getStoredCredentials, getRememberPassword, canAutoLogin } from './core/auth-storage';
import { login as loginApi, setAuthToken } from './core/api';

/**
 * 应用根组件
 * @returns JSX.Element 应用主界面
 */
export function App(): JSX.Element {
  // 聊天客户端状态管理：包含用户状态、消息、会话等核心数据
  const { state, actions, activeConversation, decodePayload } = useChatClient();
  // 当前工作区：'chat' 聊天界面 | 'friend' 好友界面
  const [workspace, setWorkspace] = useState<'chat' | 'friend'>('chat');
  // 用于跟踪是否已经尝试过自动登录
  const autoLoginAttemptedRef = useRef(false);
  // 使用 ref 保存 actions 以避免闭包问题
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // 更新 actionsRef 当 actions 变化时
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  /**
   * 启动时检查自动登录和记住密码状态
   */
  useEffect(() => {
    async function checkAuthState(): Promise<void> {
      // 如果已有认证状态，或已经尝试过自动登录，无需再次检查
      if (state.auth || autoLoginAttemptedRef.current) {
        return;
      }
      autoLoginAttemptedRef.current = true;

      // 检查是否可以自动登录
      if (await canAutoLogin()) {
        const credentials = await getStoredCredentials();
        if (credentials?.account && credentials?.encryptedPassword) {
          // 自动填充凭证并设置选项
          actionsRef.current.setAccount(credentials.account);
          actionsRef.current.setPassword(credentials.encryptedPassword);
          actionsRef.current.setRememberPassword(true);
          actionsRef.current.setAutoLogin(true);

          // 直接调用 login API 进行自动登录
          try {
            const result = await loginApi(credentials.account, credentials.encryptedPassword);
            setAuthToken(result.accessToken);
            actionsRef.current.setAuth({ token: result.accessToken, userId: result.userId });
          } catch (error) {
            console.error('[App] Auto login failed:', error);
            // 自动登录失败，清除凭证
            actionsRef.current.setRememberPassword(false);
            actionsRef.current.setAutoLogin(false);
          }
          return;
        }
      }

      // 检查是否记住密码
      const rememberPassword = await getRememberPassword();
      if (rememberPassword) {
        const credentials = await getStoredCredentials();
        if (credentials?.account && credentials?.encryptedPassword) {
          actionsRef.current.setAccount(credentials.account);
          actionsRef.current.setPassword(credentials.encryptedPassword);
          actionsRef.current.setRememberPassword(true);
        }
      }
    }

    void checkAuthState();
  }, [state.auth]);

  /**
   * 全局快捷键监听：Cmd/Ctrl + K 快速聚焦搜索框
   * 适用于 macOS(Command) 和 Windows/Linux(Control)
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const metaOrCtrl = event.metaKey || event.ctrlKey;
      if (!metaOrCtrl || event.key.toLowerCase() !== 'k') {
        return;
      }
      event.preventDefault();
      // 切换到聊天工作区并聚焦搜索框
      setWorkspace('chat');
      window.requestAnimationFrame(() => {
        const filterInput = document.querySelector<HTMLInputElement>('.sidebar-search-input');
        filterInput?.focus();
        filterInput?.select();
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 未登录状态：渲染登录界面
  if (!state.auth) {
    return (
      <>
        <LoginScreen
          mode={state.authMode}
          account={state.account}
          registerEmail={state.registerEmail}
          loginCode={state.loginCode}
          codeHint={state.codeHint}
          password={state.password}
          authSubmitting={state.authSubmitting}
          sendingLoginCode={state.sendingLoginCode}
          loginCodeCooldown={state.loginCodeCooldown}
          rememberPassword={state.rememberPassword}
          autoLogin={state.autoLogin}
          onModeChange={actions.setAuthMode}
          onAccountChange={actions.setAccount}
          onRegisterEmailChange={actions.setRegisterEmail}
          onLoginCodeChange={actions.setLoginCode}
          onPasswordChange={actions.setPassword}
          onRememberPasswordChange={actions.setRememberPassword}
          onAutoLoginChange={actions.setAutoLogin}
          onLogin={actions.onLogin}
          onRegister={actions.onRegister}
          onSendLoginCode={actions.onSendLoginCode}
          onLoginWithCode={actions.onLoginWithCode}
        />
        {/* Toast 提示 */}
        {state.toast && (
          <div className={`toast toast-${state.toast.type} ${state.toast.visible ? 'visible' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {state.toast.type === 'success' ? (
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              ) : state.toast.type === 'error' ? (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
              ) : (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
              )}
            </svg>
            <span>{state.toast.message}</span>
          </div>
        )}
      </>
    );
  }

  // 已登录状态：渲染主工作区
  return (
    <main className="workspace-shell">
      {/* 全局错误提示 */}
      {state.error ? <div className="error">{state.error}</div> : null}
      <div className="workspace-stage">
        {/* 聊天工作区：包含会话侧边栏和聊天面板 */}
        {workspace === 'chat' ? (
          <div className="chat-shell telegram-desktop">
            <ConversationSidebar
              userId={state.auth.userId}
              peerUserId={state.peerUserId}
              creatingDirect={state.creatingDirect}
              conversations={state.conversations}
              decodePayload={decodePayload}
              messageDrafts={state.messageDrafts}
              pinnedConversationIds={state.pinnedConversationIds}
              mutedConversationIds={state.mutedConversationIds}
              unreadTotal={state.unreadTotal}
              activeConversationId={state.activeConversationId}
              onPeerUserIdChange={actions.setPeerUserId}
              onCreateDirect={actions.onCreateDirect}
              onSelectConversation={actions.setActiveConversationId}
              onTogglePin={actions.toggleConversationPin}
              onToggleMute={actions.toggleConversationMute}
              onWorkspaceChange={setWorkspace}
              onLogout={() => void actions.onLogout()}
              currentUserId={state.auth.userId}
            />
            <ChatPanel
              currentUserId={state.auth.userId}
              activeConversationId={state.activeConversationId}
              activeConversation={activeConversation}
              messages={state.messages}
              messageText={state.messageText}
              messageType={state.messageType}
              mediaUrl={state.mediaUrl}
              mediaUploading={state.mediaUploading}
              sendingMessage={state.sendingMessage}
              burnEnabled={state.burnEnabled}
              burnDuration={state.burnDuration}
              replyToMessage={state.replyToMessage}
              typingHint={state.typingHint}
              hasMoreHistory={state.hasMoreHistory}
              loadingMoreHistory={state.loadingMoreHistory}
              decodePayload={decodePayload}
              onMessageTextChange={actions.setMessageText}
              onMessageTypeChange={actions.setMessageType}
              onMediaUrlChange={actions.setMediaUrl}
              onBurnEnabledChange={actions.setBurnEnabled}
              onBurnDurationChange={actions.setBurnDuration}
              onReplyToMessageChange={actions.setReplyToMessage}
              onTriggerBurn={actions.onTriggerBurn}
              onRefreshConversation={actions.onRefreshActiveConversation}
              onLoadOlderMessages={actions.onLoadOlderMessages}
              onAttachMedia={actions.onAttachMedia}
              onOpenMedia={actions.onOpenMedia}
              onResolveMediaUrl={actions.onResolveMediaUrl}
              onReadMessageOnce={actions.onReadMessageOnce}
              onSubmit={actions.onSendMessage}
              onStartTyping={actions.startTyping}
              onStopTyping={actions.stopTyping}
            />
          </div>
        ) : (
          <FriendPanel
            currentUserId={state.auth.userId}
            friendKeyword={state.friendKeyword}
            friendSearchResults={state.friendSearchResults}
            incomingRequests={state.incomingRequests}
            friends={state.friends}
            blockedUsers={state.blockedUsers}
            onKeywordChange={actions.setFriendKeyword}
            onSearch={actions.onSearchFriends}
            onRequestFriend={actions.onRequestFriend}
            onRespondFriend={actions.onRespondFriend}
            onBlockUser={actions.onBlockUser}
            onUnblockUser={actions.onUnblockUser}
            onStartDirectConversation={(targetUserId) => {
              void actions.onStartDirectConversation(targetUserId);
              setWorkspace('chat');
            }}
            onWorkspaceChange={setWorkspace}
            onLogout={() => void actions.onLogout()}
          />
        )}
      </div>
    </main>
  );
}
