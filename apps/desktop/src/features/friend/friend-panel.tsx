import { FormEvent, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { BlockedFriendItem, FriendListItem, FriendSearchItem, PendingFriendItem } from '../../core/types';
import { NavMenuTrigger } from '../navigation/nav-menu-trigger';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  onNavDrawerOpen?: () => void;
};

type TabType = 'friends' | 'pending' | 'blocked';

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

function getInitials(value: string): string {
  return value.trim().slice(0, 2).toUpperCase();
}

function getAvatarColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 5;
}

export function FriendPanel(props: Props): JSX.Element {
  const { currentUserId } = props;
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pendingOps, setPendingOps] = useState<Record<string, boolean>>({});

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

  // 构建所有联系人条目
  const allEntries = useMemo(
    () => [
      ...props.friends.map((row) => ({
        kind: 'friend' as const,
        userId: row.userId,
        username: row.username,
        online: row.online,
      })),
      ...props.incomingRequests.map((row) => ({
        kind: 'incoming' as const,
        userId: row.requesterUserId,
        username: row.username,
      })),
      ...props.blockedUsers.map((row) => ({
        kind: 'blocked' as const,
        userId: row.userId,
        username: row.username,
      })),
    ],
    [props.friends, props.incomingRequests, props.blockedUsers],
  );

  // Tab 数据
  const tabs: { key: TabType; label: string; count: number }[] = useMemo(
    () => [
      { key: 'friends', label: '好友', count: props.friends.length },
      { key: 'pending', label: '待处理', count: props.incomingRequests.length },
      { key: 'blocked', label: '黑名单', count: props.blockedUsers.length },
    ],
    [props.friends.length, props.incomingRequests.length, props.blockedUsers.length],
  );

  // 当前 Tab 的联系人列表
  const filteredEntries = useMemo(() => {
    switch (activeTab) {
      case 'friends':
        return allEntries.filter((e) => e.kind === 'friend');
      case 'pending':
        return allEntries.filter((e) => e.kind === 'incoming');
      case 'blocked':
        return allEntries.filter((e) => e.kind === 'blocked');
    }
  }, [activeTab, allEntries]);

  // 自动选中第一个
  useEffect(() => {
    if (filteredEntries.length > 0 && !filteredEntries.find((e) => e.userId === selectedUserId)) {
      setSelectedUserId(filteredEntries[0].userId);
    }
    if (filteredEntries.length === 0) {
      setSelectedUserId('');
    }
  }, [filteredEntries, selectedUserId]);

  const selectedEntry = allEntries.find((e) => e.userId === selectedUserId) ?? null;

  // 搜索结果处理
  const showSearchResults = props.friendKeyword.trim() || props.friendSearchResults.length > 0;
  const searchResultEntries: FriendEntry[] = useMemo(
    () =>
      props.friendSearchResults.map((row) => ({
        kind: 'friend' as const,
        userId: row.userId,
        username: row.username,
        online: false,
      })),
    [props.friendSearchResults],
  );

  const displayEntries = showSearchResults ? searchResultEntries : filteredEntries;

  function renderContactCard(entry: FriendEntry, isActive: boolean): JSX.Element {
    const isOnline = entry.kind === 'friend' && entry.online;
    const hasNewBadge = entry.kind === 'incoming';

    return (
      <div
        key={`${entry.kind}-${entry.userId}`}
        className={cn(
          'conversation-card flex items-center gap-3 p-3 h-[72px] rounded-xl cursor-pointer',
          'transition-colors duration-150',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-card hover:bg-accent text-foreground',
        )}
        onClick={() => setSelectedUserId(entry.userId)}
        role="button"
        tabIndex={0}
      >
        {/* 头像 */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback
              className="text-sm font-semibold"
              style={
                isActive
                  ? { background: 'white', color: 'var(--primary)' }
                  : { background: `var(--avatar-gradient-${(getAvatarColorIndex(entry.username) % 5) + 1})` }
              }
            >
              {getInitials(entry.username)}
            </AvatarFallback>
          </Avatar>
          {/* 在线状态点 */}
          {isOnline && !isActive && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
          )}
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'font-semibold text-sm truncate',
                isActive ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {entry.username}
            </span>
            {hasNewBadge && !isActive && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                新
              </Badge>
            )}
          </div>
          <div className="text-xs truncate">
            <span
              className={cn(
                isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
              )}
            >
              {entry.kind === 'friend'
                ? isOnline
                  ? '在线'
                  : '离线'
                : entry.kind === 'incoming'
                  ? '待处理请求'
                  : '黑名单'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderDetailPanel(): JSX.Element {
    if (!selectedEntry) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <span className="text-sm">请选择左侧联系人</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {/* 联系人详情卡片 */}
        <div className="conversation-card p-6">
          <div className="flex items-start gap-4">
            {/* 大头像 */}
            <Avatar className="h-14 w-14">
              <AvatarFallback
                className="text-lg font-semibold"
                style={{
                  background: `var(--avatar-gradient-${(getAvatarColorIndex(selectedEntry.username) % 5) + 1})`,
                }}
              >
                {getInitials(selectedEntry.username)}
              </AvatarFallback>
            </Avatar>

            {/* 用户信息 */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{selectedEntry.username}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {selectedEntry.userId}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {selectedEntry.kind === 'friend' && (
                  <Badge variant="secondary">
                    {selectedEntry.online ? '在线' : '离线'}
                  </Badge>
                )}
                {selectedEntry.kind === 'incoming' && (
                  <Badge variant="outline">待处理请求</Badge>
                )}
                {selectedEntry.kind === 'blocked' && (
                  <Badge variant="destructive">黑名单</Badge>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-6">
            {selectedEntry.kind === 'incoming' && (
              <>
                <Button
                  size="sm"
                  disabled={isPending(`respond:${selectedEntry.userId}`)}
                  onClick={() =>
                    void withPending(`respond:${selectedEntry.userId}`, () =>
                      props.onRespondFriend(selectedEntry.userId, true),
                    )
                  }
                >
                  {isPending(`respond:${selectedEntry.userId}`) ? '处理中...' : '同意'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending(`respond:${selectedEntry.userId}`)}
                  onClick={() =>
                    void withPending(`respond:${selectedEntry.userId}`, () =>
                      props.onRespondFriend(selectedEntry.userId, false),
                    )
                  }
                >
                  拒绝
                </Button>
              </>
            )}
            {selectedEntry.kind === 'friend' && (
              <>
                <Button
                  size="sm"
                  disabled={isPending(`direct:${selectedEntry.userId}`)}
                  onClick={() =>
                    void withPending(`direct:${selectedEntry.userId}`, () =>
                      props.onStartDirectConversation(selectedEntry.userId),
                    )
                  }
                >
                  {isPending(`direct:${selectedEntry.userId}`) ? '跳转中...' : '发消息'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending(`block:${selectedEntry.userId}`)}
                  onClick={() =>
                    void withPending(`block:${selectedEntry.userId}`, () =>
                      props.onBlockUser(selectedEntry.userId),
                    )
                  }
                >
                  {isPending(`block:${selectedEntry.userId}`) ? '处理中...' : '拉黑'}
                </Button>
              </>
            )}
            {selectedEntry.kind === 'blocked' && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending(`unblock:${selectedEntry.userId}`)}
                onClick={() =>
                  void withPending(`unblock:${selectedEntry.userId}`, () =>
                    props.onUnblockUser(selectedEntry.userId),
                  )
                }
              >
                {isPending(`unblock:${selectedEntry.userId}`) ? '处理中...' : '解除黑名单'}
              </Button>
            )}
          </div>
        </div>

        {/* 关系总览 */}
        <div className="conversation-card p-4">
          <h4 className="text-sm font-medium mb-3">关系总览</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{props.friends.length}</span>
              <span className="text-xs text-muted-foreground">好友</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{props.incomingRequests.length}</span>
              <span className="text-xs text-muted-foreground">待处理</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{props.blockedUsers.length}</span>
              <span className="text-xs text-muted-foreground">黑名单</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 左侧列表区 */}
      <aside className="flex flex-col w-[280px] min-w-[280px] h-screen bg-sidebar-background">
        {/* 顶部导航 */}
        <header className="h-14 px-3 flex items-center gap-3 border-b border-border">
          <NavMenuTrigger onClick={() => props.onNavDrawerOpen?.()} />
          <span className="font-semibold text-sm">好友中心</span>
        </header>

        {/* 搜索框 */}
        <div className="px-3 py-2">
          <form onSubmit={props.onSearch}>
            <div className="search-shell flex-1 flex items-center gap-2 bg-search-bg rounded-2xl px-3 h-9">
              <span className="material-symbols-rounded text-base text-muted-foreground shrink-0">search</span>
              <Input
                value={props.friendKeyword}
                onChange={(e) => props.onKeywordChange(e.target.value)}
                placeholder="搜索"
                className="flex-1 bg-transparent border-none outline-none text-sm h-8"
              />
            </div>
          </form>
        </div>

        {/* Tab 导航 */}
        <div className="px-3 pb-2 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    activeTab === tab.key
                      ? 'bg-primary-foreground/20'
                      : 'bg-muted',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 联系人列表 */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {showSearchResults ? (
            // 搜索结果模式
            <div className="flex flex-col gap-1">
              {props.friendSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <span>暂无搜索结果</span>
                </div>
              ) : (
                searchResultEntries.map((entry) =>
                  renderContactCard(entry, entry.userId === selectedUserId),
                )
              )}
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <span>暂无{activeTab === 'friends' ? '好友' : activeTab === 'pending' ? '待处理请求' : '黑名单'}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {displayEntries.map((entry) =>
                renderContactCard(entry, entry.userId === selectedUserId),
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 右侧详情区 */}
      <section className="flex-1 border-l border-border overflow-y-auto">
        <div className="p-6">{renderDetailPanel()}</div>
      </section>
    </div>
  );
}
