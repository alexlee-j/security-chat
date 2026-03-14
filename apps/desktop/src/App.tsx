import { useEffect, useState } from 'react';
import { LoginScreen } from './features/auth/login-screen';
import { ChatPanel } from './features/chat/chat-panel';
import { ConversationSidebar } from './features/chat/conversation-sidebar';
import { FriendPanel } from './features/friend/friend-panel';
import { useChatClient } from './core/use-chat-client';

export function App(): JSX.Element {
  const { state, actions, activeConversation, decodePayload } = useChatClient();
  const [workspace, setWorkspace] = useState<'chat' | 'friend'>('chat');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const metaOrCtrl = event.metaKey || event.ctrlKey;
      if (!metaOrCtrl || event.key.toLowerCase() !== 'k') {
        return;
      }
      event.preventDefault();
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

  if (!state.auth) {
    return (
      <LoginScreen
        mode={state.authMode}
        account={state.account}
        registerEmail={state.registerEmail}
        registerPhone={state.registerPhone}
        loginCode={state.loginCode}
        codeHint={state.codeHint}
        password={state.password}
        authSubmitting={state.authSubmitting}
        sendingLoginCode={state.sendingLoginCode}
        loginCodeCooldown={state.loginCodeCooldown}
        error={state.error}
        onModeChange={actions.setAuthMode}
        onAccountChange={actions.setAccount}
        onRegisterEmailChange={actions.setRegisterEmail}
        onRegisterPhoneChange={actions.setRegisterPhone}
        onLoginCodeChange={actions.setLoginCode}
        onPasswordChange={actions.setPassword}
        onLogin={actions.onLogin}
        onRegister={actions.onRegister}
        onSendLoginCode={actions.onSendLoginCode}
        onLoginWithCode={actions.onLoginWithCode}
      />
    );
  }

  return (
    <main className="workspace-shell">
      {state.error ? <div className="error">{state.error}</div> : null}
      <div className="workspace-stage">
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
