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
import type { FormEvent } from 'react';
import { LoginScreen } from './features/auth/login-screen';
import { ChatPanel } from './features/chat/chat-panel';
import { ConversationSidebar } from './features/chat/conversation-sidebar';
import { GroupCreateModal } from './features/chat/group-create-modal';
import { FriendPanel } from './features/friend/friend-panel';
import { AddFriendDialog } from './features/friend/add-friend-dialog';
import { RemoveFriendDialog } from './features/friend/remove-friend-dialog';
import { AccountControlCenter, type AccountControlSection } from './features/navigation/account-control-center';
import { NavigationDrawer, type NavigationDrawerSection } from './features/navigation/navigation-drawer';
import { LogoutConfirmDialog } from './features/navigation/logout-confirm-dialog';
import { useChatClient } from './core/use-chat-client';
import { useVoiceCallClient } from './core/use-voice-call-client';
import { useTheme } from './core/use-theme';
import { getStoredCredentials, getRememberPassword, canAutoLogin } from './core/auth-storage';
import { getUserProfile } from './core/api';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * 应用根组件
 * @returns JSX.Element 应用主界面
 */
export function App(): JSX.Element {
  // 聊天客户端状态管理：包含用户状态、消息、会话等核心数据
  const { state, actions, activeConversation, decodePayload, socket } = useChatClient();
  const voiceCall = useVoiceCallClient({
    socket,
    currentUserId: state.auth?.userId ?? null,
    activeConversationId: state.activeConversationId,
    conversations: state.conversations,
  });
  // 主题状态管理
  const { theme, setTheme, resolvedTheme } = useTheme();
  // 当前工作区：'chat' 聊天界面 | 'friend' 好友界面
  const [workspace, setWorkspace] = useState<'chat' | 'friend'>('chat');
  // 导航抽屉开关状态
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  // 控制中心状态
  const [accountControlSection, setAccountControlSection] = useState<AccountControlSection | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [removeFriendOpen, setRemoveFriendOpen] = useState(false);
  const [removeFriendTarget, setRemoveFriendTarget] = useState<{ userId: string; username: string; avatarUrl: string | null } | null>(null);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  // 用于跟踪是否已经尝试过自动登录
  const autoLoginAttemptedRef = useRef(false);
  // 用户Profile信息
  const [navProfile, setNavProfile] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  // 使用 ref 保存 actions 以避免闭包问题
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // 更新 actionsRef 当 actions 变化时
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // 控制中心相关函数
  function openAccountControl(section: AccountControlSection): void {
    setAccountControlSection(section);
    setNavDrawerOpen(true);
  }

  function handleNavDrawerOpenChange(open: boolean): void {
    setNavDrawerOpen(open);
    if (!open) {
      setAccountControlSection(null);
    }
  }

  function closeAccountControl(): void {
    setAccountControlSection(null);
    setNavDrawerOpen(false);
  }

  function backToNormalDrawer(): void {
    setAccountControlSection(null);
    setNavDrawerOpen(true);
  }

  function openLogoutConfirmFromNavigation(): void {
    setNavDrawerOpen(false);
    setAccountControlSection(null);
    setLogoutConfirmOpen(true);
  }

  function handleProfileUpdated(profile: { username: string; avatarUrl: string | null }): void {
    setNavProfile(profile);
    void Promise.all([
      actions.onRefreshFriendData(),
      actions.onRefreshConversations(),
    ]);
  }

  /**
   * 启动时检查自动登录和记住密码状态
   */
  useEffect(() => {
    // 使用 AbortController 防止竞态条件
    const abortController = new AbortController();

    async function checkAuthState(): Promise<void> {
      // 如果已有认证状态，或已经尝试过自动登录，无需再次检查
      if (state.auth || autoLoginAttemptedRef.current) {
        return;
      }
      autoLoginAttemptedRef.current = true;

      try {
        // 检查是否可以自动登录
        if (await canAutoLogin()) {
          const credentials = await getStoredCredentials();
          // 检查中止信号
          if (abortController.signal.aborted) return;

          if (credentials?.account && credentials?.encryptedPassword) {
            // 验证凭证格式（与后端验证一致）
            if (credentials.account.length < 3 || credentials.encryptedPassword.length < 8) {
              console.warn('[App] Stored credentials invalid, clearing');
              actionsRef.current.setRememberPassword(false);
              actionsRef.current.setAutoLogin(false);
              return;
            }

            // 自动填充凭证并设置选项
            actionsRef.current.setAccount(credentials.account);
            actionsRef.current.setPassword(credentials.encryptedPassword);
            actionsRef.current.setRememberPassword(true);
            actionsRef.current.setAutoLogin(true);

            // 走统一登录链路，确保 Signal / 设备 / 会话初始化完整执行
            const mockEvent = { preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>;
            await actionsRef.current.onLogin(
              mockEvent,
              credentials.account,
              credentials.encryptedPassword,
              true,
              true,
            );
            return;
          }
        }

        // 检查是否记住密码
        const rememberPassword = await getRememberPassword();
        if (abortController.signal.aborted) return;

        if (rememberPassword) {
          const credentials = await getStoredCredentials();
          if (credentials?.account && credentials?.encryptedPassword) {
            // 验证凭证格式
            if (credentials.account.length >= 3 && credentials.encryptedPassword.length >= 8) {
              actionsRef.current.setAccount(credentials.account);
              actionsRef.current.setPassword(credentials.encryptedPassword);
              actionsRef.current.setRememberPassword(true);
            }
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('[App] Auto login failed:', error);
        // 自动登录失败，清除凭证
        actionsRef.current.setRememberPassword(false);
        actionsRef.current.setAutoLogin(false);
      }
    }

    void checkAuthState();

    // 清理函数：组件卸载或重新运行时中止之前的操作
    return () => {
      abortController.abort();
    };
  }, [state.auth]);

  // 登录成功后获取用户Profile信息
  useEffect(() => {
    if (!state.auth?.userId) {
      setNavProfile(null);
      return;
    }
    let active = true;
    void getUserProfile(state.auth.userId)
      .then((data) => {
        if (active) {
          setNavProfile({ username: data.username, avatarUrl: data.avatarUrl });
        }
      })
      .catch((error) => {
        console.error('[App] Failed to load profile:', error);
      });
    return () => {
      active = false;
    };
  }, [state.auth?.userId]);

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
          forgotEmail={state.forgotEmail}
          forgotCode={state.forgotCode}
          forgotPassword={state.forgotPassword}
          forgotConfirmPassword={state.forgotConfirmPassword}
          forgotCodeSent={state.forgotCodeSent}
          forgotCooldown={state.forgotCooldown}
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
          onForgotEmailChange={actions.setForgotEmail}
          onForgotCodeChange={actions.setForgotCode}
          onForgotPasswordChange={actions.setForgotPassword}
          onForgotConfirmPasswordChange={actions.setForgotConfirmPassword}
          onLoginCodeChange={actions.setLoginCode}
          onPasswordChange={actions.setPassword}
          onRememberPasswordChange={actions.setRememberPassword}
          onAutoLoginChange={actions.setAutoLogin}
          onLogin={actions.onLogin}
          onRegister={actions.onRegister}
          onSendLoginCode={actions.onSendLoginCode}
          onLoginWithCode={actions.onLoginWithCode}
          onSendForgotCode={actions.onSendForgotCode}
          onResetPassword={actions.onResetPassword}
        />
        {/* Toast 提示 */}
        {state.toast && (
          <div className={`toast toast-${state.toast.type} ${state.toast.visible ? 'visible' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {state.toast.type === 'success' ? (
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
              ) : state.toast.type === 'error' ? (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
              ) : (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor" />
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
      {voiceCall.state.status !== 'idle' ? (
        <section className={`voice-call-banner voice-call-status-${voiceCall.state.status}`}>
          <div className="voice-call-banner-main">
            <span className="material-symbols-rounded voice-call-banner-icon">
              {voiceCall.state.status === 'incoming'
                ? 'call_received'
                : voiceCall.state.status === 'connected' || voiceCall.state.status === 'muted'
                  ? 'call'
                  : voiceCall.state.status === 'failed'
                    ? 'call_end'
                    : 'ring_volume'}
            </span>
            <div className="voice-call-banner-copy">
              <strong>
                {voiceCall.state.status === 'incoming'
                  ? '有语音通话来电'
                  : voiceCall.state.status === 'outgoing'
                    ? `正在呼叫 · ${voiceCall.state.elapsedSeconds > 0 ? `${Math.floor(voiceCall.state.elapsedSeconds / 60)}:${String(Math.floor(voiceCall.state.elapsedSeconds % 60)).padStart(2, '0')}` : '00:00'}`
                    : voiceCall.state.status === 'requesting-permission'
                      ? '正在请求麦克风权限'
                      : voiceCall.state.status === 'connected' || voiceCall.state.status === 'muted'
                        ? `通话中 · ${voiceCall.state.elapsedSeconds > 0 ? `${Math.floor(voiceCall.state.elapsedSeconds / 60)}:${String(Math.floor(voiceCall.state.elapsedSeconds % 60)).padStart(2, '0')}` : '00:00'}`
                        : voiceCall.state.status === 'timeout'
                          ? '通话超时'
                          : voiceCall.state.status === 'answered-elsewhere'
                            ? '已由其他设备接听'
                            : voiceCall.state.error || '通话状态更新'}
              </strong>
              <span>
                {voiceCall.state.status === 'incoming'
                  ? '来电会在当前会话之外保持可见。'
                  : voiceCall.state.status === 'outgoing'
                    ? '等待对方接听。'
                    : voiceCall.state.status === 'connected' || voiceCall.state.status === 'muted'
                      ? voiceCall.state.isMuted
                        ? '麦克风已静音。'
                        : '实时音频传输中。'
                      : voiceCall.state.autoplayBlocked
                        ? '音频播放被浏览器策略阻止。'
                        : voiceCall.state.error || 'WebRTC 通话状态。'}
              </span>
            </div>
          </div>
          <div className="voice-call-banner-actions">
            {voiceCall.state.status === 'incoming' ? (
              <>
                <button type="button" className="voice-call-banner-btn primary" onClick={() => void voiceCall.actions.acceptIncomingCall()}>
                  接听
                </button>
                <button type="button" className="voice-call-banner-btn" onClick={() => void voiceCall.actions.rejectIncomingCall()}>
                  拒绝
                </button>
              </>
            ) : voiceCall.state.status === 'outgoing' || voiceCall.state.status === 'requesting-permission' ? (
              <button type="button" className="voice-call-banner-btn" onClick={() => void voiceCall.actions.cancelVoiceCall()}>
                取消
              </button>
            ) : voiceCall.state.status === 'connected' || voiceCall.state.status === 'muted' ? (
              <>
                <button type="button" className="voice-call-banner-btn" onClick={voiceCall.actions.toggleMute}>
                  {voiceCall.state.isMuted ? '取消静音' : '静音'}
                </button>
                <button type="button" className="voice-call-banner-btn danger" onClick={() => void voiceCall.actions.hangupVoiceCall()}>
                  挂断
                </button>
              </>
            ) : voiceCall.state.status === 'failed' || voiceCall.state.status === 'timeout' || voiceCall.state.status === 'answered-elsewhere' ? (
              <button type="button" className="voice-call-banner-btn" onClick={voiceCall.actions.clearError}>
                关闭
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
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
              onDeleteConversation={actions.deleteConversation}
              onNavDrawerOpen={() => setNavDrawerOpen(true)}
              onWorkspaceChange={setWorkspace}
              onLogout={() => void actions.onLogout()}
              currentUserId={state.auth.userId}
              onNewGroup={() => setGroupCreateOpen(true)}
              onNewChat={() => setAddFriendOpen(true)}
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
              callHistory={voiceCall.history}
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
              onAttachVoiceMedia={actions.onAttachVoiceMedia}
              onCancelMediaAttachment={actions.onCancelMediaAttachment}
              onOpenMedia={actions.onOpenMedia}
              onResolveMediaUrl={actions.onResolveMediaUrl}
              onReadMessageOnce={actions.onReadMessageOnce}
              onSubmit={actions.onSendMessage}
              onRetryMessage={actions.onRetryMessage}
              onStartTyping={actions.startTyping}
              onStopTyping={actions.stopTyping}
              onForwardMessage={actions.onForwardMessage}
              isConversationPinned={state.pinnedConversationIds.includes(state.activeConversationId)}
              isConversationMuted={state.mutedConversationIds.includes(state.activeConversationId)}
              onToggleConversationPin={actions.toggleConversationPin}
              onToggleConversationMute={actions.toggleConversationMute}
              onDeleteConversation={actions.deleteConversation}
              voiceCallEnabled={voiceCall.actions.canStartCall(state.activeConversationId)}
              onVoiceCall={() => void voiceCall.actions.startVoiceCall(state.activeConversationId)}
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
            onAddFriend={() => setAddFriendOpen(true)}
            onRemoveFriend={(targetUserId, targetUsername, targetAvatarUrl) => {
              setRemoveFriendTarget({ userId: targetUserId, username: targetUsername, avatarUrl: targetAvatarUrl });
              setRemoveFriendOpen(true);
            }}
            onRespondFriend={actions.onRespondFriend}
            onBlockUser={actions.onBlockUser}
            onUnblockUser={actions.onUnblockUser}
            onStartDirectConversation={(targetUserId) => {
              void actions.onStartDirectConversation(targetUserId);
              setWorkspace('chat');
            }}
            onNavDrawerOpen={() => setNavDrawerOpen(true)}
          />
        )}
      </div>

      {/* 导航抽屉 - 使用 shadcn/ui Sheet 组件 */}
      <Sheet open={navDrawerOpen} onOpenChange={handleNavDrawerOpenChange}>
        <SheetContent
          side="left"
          className={cn(
            "nav-drawer-sheet p-0 flex flex-col",
            accountControlSection ? "account-full-sheet" : "nav-drawer-compact-sheet",
          )}
        >
          {accountControlSection ? (
            <AccountControlCenter
              section={accountControlSection}
              userId={state.auth.userId}
              username={navProfile?.username ?? null}
              avatarUrl={navProfile?.avatarUrl ?? null}
              workspace={workspace}
              theme={theme}
              onThemeChange={setTheme}
              onSectionChange={setAccountControlSection}
              onWorkspaceChange={(nextWorkspace) => {
                setWorkspace(nextWorkspace);
                closeAccountControl();
              }}
              onProfileUpdated={handleProfileUpdated}
              onBackToDrawer={backToNormalDrawer}
              onClose={closeAccountControl}
              onLogout={openLogoutConfirmFromNavigation}
            />
          ) : (
            <NavigationDrawer
              userId={state.auth.userId}
              username={navProfile?.username ?? null}
              avatarUrl={navProfile?.avatarUrl ?? null}
              workspace={workspace}
              theme={theme}
              onWorkspaceChange={(ws) => {
                setWorkspace(ws);
                setNavDrawerOpen(false);
              }}
              onSectionChange={(section) => openAccountControl(section)}
              onLogout={openLogoutConfirmFromNavigation}
              onThemeChange={setTheme}
            />
          )}
        </SheetContent>
      </Sheet>

      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={() => void actions.onLogout()}
      />
      <AddFriendDialog
        open={addFriendOpen}
        onOpenChange={setAddFriendOpen}
        onRequestFriend={actions.onRequestFriend}
      />
      <RemoveFriendDialog
        open={removeFriendOpen}
        onOpenChange={(open) => {
          setRemoveFriendOpen(open);
          if (!open) {
            setRemoveFriendTarget(null);
          }
        }}
        targetUserId={removeFriendTarget?.userId ?? ''}
        targetUsername={removeFriendTarget?.username ?? ''}
        targetAvatarUrl={removeFriendTarget?.avatarUrl ?? null}
        onConfirm={async (targetUserId) => {
          await actions.onRemoveFriend(targetUserId);
          setRemoveFriendTarget(null);
        }}
      />
      <GroupCreateModal
        isOpen={groupCreateOpen}
        onClose={() => setGroupCreateOpen(false)}
        onGroupCreated={(groupId) => {
          setGroupCreateOpen(false);
          setWorkspace('chat');
          void actions.onOpenConversation(groupId);
        }}
        currentUserId={state.auth.userId}
      />
    </main>
  );
}
