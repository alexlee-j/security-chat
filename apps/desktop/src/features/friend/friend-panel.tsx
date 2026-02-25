import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BlockedFriendItem, FriendListItem, FriendSearchItem, PendingFriendItem } from '../../core/types';

type Props = {
  friendKeyword: string;
  friendSearchResults: FriendSearchItem[];
  incomingRequests: PendingFriendItem[];
  friends: FriendListItem[];
  blockedUsers: BlockedFriendItem[];
  onKeywordChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRequestFriend: (targetUserId: string) => Promise<void>;
  onRespondFriend: (requesterUserId: string, accept: boolean) => Promise<void>;
  onBlockUser: (targetUserId: string) => Promise<void>;
  onUnblockUser: (targetUserId: string) => Promise<void>;
};

type FriendEntry =
  | { kind: 'friend'; userId: string; username: string; online?: boolean }
  | { kind: 'incoming'; userId: string; username: string }
  | { kind: 'blocked'; userId: string; username: string };

function relationActionLabel(relation: FriendSearchItem['relation']): string {
  switch (relation) {
    case 'friends':
      return '已是好友';
    case 'pending_outgoing':
      return '已申请';
    case 'pending_incoming':
      return '待你处理';
    case 'blocked':
      return '已拉黑';
    default:
      return '加好友';
  }
}

function toFriendEntry(
  friends: FriendListItem[],
  incomingRequests: PendingFriendItem[],
  blockedUsers: BlockedFriendItem[],
): FriendEntry[] {
  return [
    ...friends.map((row) => ({
      kind: 'friend' as const,
      userId: row.userId,
      username: row.username,
      online: row.online,
    })),
    ...incomingRequests.map((row) => ({
      kind: 'incoming' as const,
      userId: row.requesterUserId,
      username: row.username,
    })),
    ...blockedUsers.map((row) => ({
      kind: 'blocked' as const,
      userId: row.userId,
      username: row.username,
    })),
  ];
}

function getInitials(value: string): string {
  return value.trim().slice(0, 2).toUpperCase();
}

export function FriendPanel(props: Props): JSX.Element {
  const entries = useMemo(
    () => toFriendEntry(props.friends, props.incomingRequests, props.blockedUsers),
    [props.friends, props.incomingRequests, props.blockedUsers],
  );
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (!entries.find((row) => row.userId === selectedUserId)) {
      setSelectedUserId(entries[0]?.userId ?? '');
    }
  }, [entries, selectedUserId]);

  const selectedEntry = entries.find((row) => row.userId === selectedUserId) ?? null;

  return (
    <section className="friend-panel card telegram-friends">
      <header className="friend-head">
        <div>
          <p className="kicker">People</p>
          <h3>好友中心</h3>
        </div>
        <span className="subtle">{entries.length} 位联系人</span>
      </header>

      <div className="friend-layout">
        <aside className="friend-sidebar">
          <form onSubmit={props.onSearch} className="friend-search">
            <input
              value={props.friendKeyword}
              onChange={(e) => props.onKeywordChange(e.target.value)}
              placeholder="搜索用户名/邮箱/手机号"
            />
            <button type="submit">查找</button>
          </form>

          <div className="friend-nav-list">
            {entries.map((item) => (
              <button
                key={`${item.kind}-${item.userId}`}
                type="button"
                className={item.userId === selectedUserId ? 'friend-nav-item active' : 'friend-nav-item'}
                onClick={() => setSelectedUserId(item.userId)}
              >
                <span className="avatar">{getInitials(item.username)}</span>
                <span className="friend-nav-main">
                  <span>{item.username}</span>
                  <small className="subtle">
                    {item.kind === 'friend' ? (item.online ? '在线' : '离线') : item.kind === 'incoming' ? '待处理请求' : '黑名单'}
                  </small>
                </span>
                {item.kind === 'incoming' ? <span className="friend-badge">新</span> : null}
              </button>
            ))}
            {entries.length === 0 ? <p className="subtle">暂无联系人数据</p> : null}
          </div>
        </aside>

        <section className="friend-main">
          <article className="friend-block friend-profile">
            <h4>联系人详情</h4>
            {!selectedEntry ? (
              <p className="subtle">请选择左侧联系人</p>
            ) : (
              <div className="friend-profile-body">
                <div className="friend-identity">
                  <span className="avatar avatar-large">{getInitials(selectedEntry.username)}</span>
                  <div>
                    <strong>{selectedEntry.username}</strong>
                    <small className="subtle mono">{selectedEntry.userId}</small>
                  </div>
                </div>
                <div className="friend-actions">
                  {selectedEntry.kind === 'incoming' ? (
                    <>
                      <button type="button" onClick={() => props.onRespondFriend(selectedEntry.userId, true)}>
                        同意
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => props.onRespondFriend(selectedEntry.userId, false)}
                      >
                        拒绝
                      </button>
                    </>
                  ) : null}
                  {selectedEntry.kind === 'friend' ? (
                    <button type="button" className="ghost-btn" onClick={() => props.onBlockUser(selectedEntry.userId)}>
                      拉黑
                    </button>
                  ) : null}
                  {selectedEntry.kind === 'blocked' ? (
                    <button type="button" onClick={() => props.onUnblockUser(selectedEntry.userId)}>
                      解除黑名单
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </article>

          <article className="friend-block">
            <h4>待处理申请</h4>
            <div className="friend-list">
            {props.incomingRequests.map((item) => (
              <div key={item.requesterUserId} className="friend-row">
                <div>
                  <div>{item.username}</div>
                  <small className="subtle mono">{item.requesterUserId}</small>
                </div>
                <div className="friend-actions">
                  <button type="button" onClick={() => props.onRespondFriend(item.requesterUserId, true)}>
                    同意
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => props.onRespondFriend(item.requesterUserId, false)}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
            {props.incomingRequests.length === 0 ? <p className="subtle">暂无待处理申请</p> : null}
            </div>
          </article>

          <article className="friend-block">
            <h4>搜索结果</h4>
            <div className="friend-list">
              {props.friendSearchResults.map((item) => (
                <div key={item.userId} className="friend-row">
                  <div>
                    <div>{item.username}</div>
                    <small className="subtle mono">{item.userId}</small>
                  </div>
                  <div className="friend-actions">
                    <button
                      type="button"
                      disabled={item.relation !== 'none'}
                      onClick={() => props.onRequestFriend(item.userId)}
                    >
                      {relationActionLabel(item.relation)}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => props.onBlockUser(item.userId)}>
                      拉黑
                    </button>
                  </div>
                </div>
              ))}
              {props.friendSearchResults.length === 0 ? <p className="subtle">暂无搜索结果</p> : null}
            </div>
          </article>

          <article className="friend-block">
            <h4>好友与黑名单</h4>
            <div className="friend-list">
              {props.friends.map((item) => (
                <div key={item.userId} className="friend-row">
                  <div>
                    <div>{item.username}</div>
                    <small className="subtle">{item.online ? '在线' : '离线'}</small>
                  </div>
                  <div className="friend-actions">
                    <button type="button" className="ghost-btn" onClick={() => props.onBlockUser(item.userId)}>
                      拉黑
                    </button>
                  </div>
                </div>
              ))}
              {props.blockedUsers.map((item) => (
                <div key={item.userId} className="friend-row">
                  <div>
                    <div>{item.username}</div>
                    <small className="subtle mono">{item.userId}</small>
                  </div>
                  <div className="friend-actions">
                    <button type="button" onClick={() => props.onUnblockUser(item.userId)}>
                      解除
                    </button>
                  </div>
                </div>
              ))}
              {props.friends.length === 0 && props.blockedUsers.length === 0 ? <p className="subtle">暂无联系人</p> : null}
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
