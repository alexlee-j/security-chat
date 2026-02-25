import { useState } from 'react';
import { LoginScreen } from './features/auth/login-screen';
import { ChatPanel } from './features/chat/chat-panel';
import { ConversationSidebar } from './features/chat/conversation-sidebar';
import { FriendPanel } from './features/friend/friend-panel';
import { useChatClient } from './core/use-chat-client';

export function App(): JSX.Element {
  const { state, actions, activeConversation, decodePayload } = useChatClient();
  const [workspace, setWorkspace] = useState<'chat' | 'friend'>('chat');

  if (!state.auth) {
    return (
      <LoginScreen
        account={state.account}
        password={state.password}
        error={state.error}
        onAccountChange={actions.setAccount}
        onPasswordChange={actions.setPassword}
        onSubmit={actions.onLogin}
      />
    );
  }

  return (
    <main className="workspace-shell">
      {state.error ? <div className="error">{state.error}</div> : null}
      <section className="workspace-desktop">
        <aside className="desktop-rail">
          <div className="rail-brand">
            <span className="rail-logo">SC</span>
            <div>
              <p className="kicker">Security Chat</p>
              <p className="subtle">Desktop</p>
            </div>
          </div>
          <button
            type="button"
            className={workspace === 'chat' ? 'rail-tab active' : 'rail-tab'}
            onClick={() => setWorkspace('chat')}
          >
            聊天
          </button>
          <button
            type="button"
            className={workspace === 'friend' ? 'rail-tab active' : 'rail-tab'}
            onClick={() => setWorkspace('friend')}
          >
            好友
          </button>
          <small className="subtle mono rail-user">{state.auth.userId}</small>
        </aside>

        <section className="workspace-stage">
          {workspace === 'chat' ? (
            <section className="chat-shell telegram-desktop">
              <ConversationSidebar
                userId={state.auth.userId}
                peerUserId={state.peerUserId}
                conversations={state.conversations}
                activeConversationId={state.activeConversationId}
                onPeerUserIdChange={actions.setPeerUserId}
                onCreateDirect={actions.onCreateDirect}
                onSelectConversation={actions.setActiveConversationId}
              />

              <ChatPanel
                currentUserId={state.auth.userId}
                activeConversationId={state.activeConversationId}
                activeConversation={activeConversation}
                messages={state.messages}
                messageText={state.messageText}
                messageType={state.messageType}
                mediaUrl={state.mediaUrl}
                burnEnabled={state.burnEnabled}
                burnDuration={state.burnDuration}
                typingHint={state.typingHint}
                decodePayload={decodePayload}
                onMessageTextChange={actions.setMessageText}
                onMessageTypeChange={actions.setMessageType}
                onMediaUrlChange={actions.setMediaUrl}
                onBurnEnabledChange={actions.setBurnEnabled}
                onBurnDurationChange={actions.setBurnDuration}
                onTriggerBurn={actions.onTriggerBurn}
                onSubmit={actions.onSendMessage}
                onStartTyping={actions.startTyping}
                onStopTyping={actions.stopTyping}
              />
            </section>
          ) : (
            <FriendPanel
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
            />
          )}
        </section>
      </section>
    </main>
  );
}
