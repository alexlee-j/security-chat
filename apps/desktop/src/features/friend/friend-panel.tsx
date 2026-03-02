import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BlockedFriendItem, FriendListItem, FriendSearchItem, PendingFriendItem } from '../../core/types';

type Props = {
  currentUserId: string;
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
  onStartDirectConversation: (targetUserId: string) => void;
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
  const [qrInput, setQrInput] = useState('');
  const [qrHint, setQrHint] = useState('');
  const [pendingOps, setPendingOps] = useState<Record<string, boolean>>({});
  const ownAddCode = `sc:add:${props.currentUserId}`;

  function isPending(key: string): boolean {
    return Boolean(pendingOps[key]);
  }

  async function withPending(key: string, action: () => Promise<void> | void): Promise<void> {
    if (isPending(key)) {
      return;
    }
    setPendingOps((prev) => ({ ...prev, [key]: true }));
    try {
      await Promise.resolve(action());
    } finally {
      setPendingOps((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function runBulk(
    key: string,
    ids: string[],
    action: (id: string) => Promise<void>,
  ): Promise<void> {
    if (isPending(key) || ids.length === 0) {
      return;
    }
    setPendingOps((prev) => ({ ...prev, [key]: true }));
    try {
      for (const id of ids) {
        await action(id);
      }
    } finally {
      setPendingOps((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  useEffect(() => {
    if (!entries.find((row) => row.userId === selectedUserId)) {
      setSelectedUserId(entries[0]?.userId ?? '');
    }
  }, [entries, selectedUserId]);

  const selectedEntry = entries.find((row) => row.userId === selectedUserId) ?? null;

  function parseTargetFromCode(raw: string): string {
    const value = raw.trim();
    if (!value) {
      return '';
    }
    if (value.startsWith('sc:add:')) {
      return value.slice('sc:add:'.length).trim();
    }
    return value;
  }

  async function onCopyOwnCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(ownAddCode);
      setQrHint('已复制加好友码');
    } catch {
      setQrHint('复制失败，请手动复制');
    }
  }

  async function onAddByCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const targetUserId = parseTargetFromCode(qrInput);
    if (!targetUserId) {
      setQrHint('请输入扫码结果或用户ID');
      return;
    }
    if (targetUserId === props.currentUserId) {
      setQrHint('不能添加自己');
      return;
    }
    try {
      await withPending(`request:${targetUserId}`, () => props.onRequestFriend(targetUserId));
      setQrHint('好友申请已发送');
      setQrInput('');
    } catch {
      setQrHint('添加失败，请检查扫码结果');
    }
  }

  return (
    <section className="friend-panel card telegram-friends">
      <header className="friend-head">
        <div>
          <p className="kicker">People</p>
          <h3>好友中心</h3>
        </div>
        <span className="subtle">{props.friends.length} 位好友</span>
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
                      <button
                        type="button"
                        disabled={isPending(`respond:${selectedEntry.userId}`)}
                        onClick={() => void withPending(`respond:${selectedEntry.userId}`, () => props.onRespondFriend(selectedEntry.userId, true))}
                      >
                        {isPending(`respond:${selectedEntry.userId}`) ? '处理中...' : '同意'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={isPending(`respond:${selectedEntry.userId}`)}
                        onClick={() => void withPending(`respond:${selectedEntry.userId}`, () => props.onRespondFriend(selectedEntry.userId, false))}
                      >
                        拒绝
                      </button>
                    </>
                  ) : null}
                  {selectedEntry.kind === 'friend' ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending(`direct:${selectedEntry.userId}`)}
                        onClick={() => void withPending(`direct:${selectedEntry.userId}`, () => props.onStartDirectConversation(selectedEntry.userId))}
                      >
                        {isPending(`direct:${selectedEntry.userId}`) ? '跳转中...' : '发消息'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={isPending(`block:${selectedEntry.userId}`)}
                        onClick={() => void withPending(`block:${selectedEntry.userId}`, () => props.onBlockUser(selectedEntry.userId))}
                      >
                        {isPending(`block:${selectedEntry.userId}`) ? '处理中...' : '拉黑'}
                      </button>
                    </>
                  ) : null}
                  {selectedEntry.kind === 'blocked' ? (
                    <button
                      type="button"
                      disabled={isPending(`unblock:${selectedEntry.userId}`)}
                      onClick={() => void withPending(`unblock:${selectedEntry.userId}`, () => props.onUnblockUser(selectedEntry.userId))}
                    >
                      {isPending(`unblock:${selectedEntry.userId}`) ? '处理中...' : '解除黑名单'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </article>

          <article className="friend-block friend-qr">
            <h4>二维码加好友</h4>
            <div className="friend-qr-body">
              <small className="subtle">我的加好友码（供二维码承载）</small>
              <div className="friend-qr-code mono">{ownAddCode}</div>
              <div className="friend-actions">
                <button type="button" onClick={() => void onCopyOwnCode()}>
                  复制我的码
                </button>
              </div>
              <form className="friend-qr-form" onSubmit={onAddByCode}>
                <input
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="粘贴扫码结果（sc:add:...）或用户ID"
                />
                <button type="submit" disabled={isPending(`request:${parseTargetFromCode(qrInput)}`)}>
                  {isPending(`request:${parseTargetFromCode(qrInput)}`) ? '添加中...' : '添加好友'}
                </button>
              </form>
              <small className="subtle">{qrHint || '可将我的加好友码生成二维码供对方扫码。'}</small>
            </div>
          </article>

          {props.incomingRequests.length > 0 ? (
            <article className="friend-block">
              <div className="friend-actions">
                <h4>待处理申请</h4>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={isPending('bulk:reject')}
                  onClick={() =>
                    void runBulk(
                      'bulk:reject',
                      props.incomingRequests.map((row) => row.requesterUserId),
                      async (id) => props.onRespondFriend(id, false),
                    )
                  }
                >
                  {isPending('bulk:reject') ? '批量处理中...' : '全部拒绝'}
                </button>
              </div>
              <div className="friend-list">
                {props.incomingRequests.map((item) => (
                  <div key={item.requesterUserId} className="friend-row">
                    <div>
                      <div>{item.username}</div>
                      <small className="subtle mono">{item.requesterUserId}</small>
                    </div>
                    <div className="friend-actions">
                      <button
                        type="button"
                        disabled={isPending(`respond:${item.requesterUserId}`)}
                        onClick={() =>
                          void withPending(`respond:${item.requesterUserId}`, () => props.onRespondFriend(item.requesterUserId, true))
                        }
                      >
                        {isPending(`respond:${item.requesterUserId}`) ? '处理中...' : '同意'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={isPending(`respond:${item.requesterUserId}`)}
                        onClick={() =>
                          void withPending(`respond:${item.requesterUserId}`, () => props.onRespondFriend(item.requesterUserId, false))
                        }
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {props.friendKeyword.trim() || props.friendSearchResults.length > 0 ? (
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
                        disabled={item.relation !== 'none' || isPending(`request:${item.userId}`)}
                        onClick={() =>
                          void withPending(`request:${item.userId}`, () => props.onRequestFriend(item.userId)).catch(() => {})
                        }
                      >
                        {isPending(`request:${item.userId}`) ? '处理中...' : relationActionLabel(item.relation)}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={isPending(`block:${item.userId}`)}
                        onClick={() => void withPending(`block:${item.userId}`, () => props.onBlockUser(item.userId))}
                      >
                        {isPending(`block:${item.userId}`) ? '处理中...' : '拉黑'}
                      </button>
                    </div>
                  </div>
                ))}
                {props.friendSearchResults.length === 0 ? <p className="subtle">暂无搜索结果</p> : null}
              </div>
            </article>
          ) : null}
        </section>
      </div>
    </section>
  );
}
