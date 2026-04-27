import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { FriendListItem, FriendSearchItem } from '../../core/types';
import {
  searchUsers,
  getFriends,
  createGroup,
  addGroupMember,
  removeGroupMember,
  getGroupMembers,
  getGroup,
  updateGroupProfile,
} from '../../core/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppAvatar, getAvatarColorIndex } from '@/components/app-avatar';

type Props = {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 创建群组成功回调 */
  onGroupCreated: (groupId: string) => void;
  /** 当前用户 ID */
  currentUserId: string;
};

type TabType = 'create' | 'manage';

type GroupType = 1 | 2; // 1: 私密群, 2: 公开群

export function GroupCreateModal(props: Props): JSX.Element | null {
  const { isOpen, onClose, onGroupCreated, currentUserId } = props;

  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupType>(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [friendCandidates, setFriendCandidates] = useState<FriendListItem[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<FriendListItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendHint, setFriendHint] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 管理群组相关状态
  const [manageGroupId, setManageGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState<Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: number;
  }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [manageSearchKeyword, setManageSearchKeyword] = useState('');
  const [manageSearchResults, setManageSearchResults] = useState<FriendSearchItem[]>([]);
  const [isManageSearching, setIsManageSearching] = useState(false);
  const [manageName, setManageName] = useState('');
  const [manageDescription, setManageDescription] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [manageHint, setManageHint] = useState('');

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setActiveTab('create');
    setGroupName('');
    setGroupType(1);
    setSearchKeyword('');
    setFriendCandidates([]);
    setSelectedMembers([]);
    setIsLoadingFriends(false);
    setFriendHint('');
    setIsCreating(false);

    setManageGroupId('');
    setGroupMembers([]);
    setIsLoadingMembers(false);
    setManageSearchKeyword('');
    setManageSearchResults([]);
    setIsManageSearching(false);
    setManageName('');
    setManageDescription('');
    setIsSavingProfile(false);
    setManageHint('');
  }, [isOpen]);

  function handleDialogOpenChange(open: boolean): void {
    if (!open) {
      onClose();
    }
  }

  async function loadFriendCandidates(): Promise<void> {
    setIsLoadingFriends(true);
    setFriendHint('');
    try {
      const friends = await getFriends();
      setFriendCandidates(friends.filter((friend) => friend.userId !== currentUserId));
      if (friends.length === 0) {
        setFriendHint('当前没有好友，请先添加好友后再创建群组。');
      }
    } catch (error) {
      console.error('[GroupCreateModal] Load friends failed:', error);
      setFriendHint('加载好友列表失败，请稍后重试。');
    } finally {
      setIsLoadingFriends(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadFriendCandidates();
  }, [isOpen, currentUserId]);

  function handleAddMember(user: FriendListItem): void {
    if (selectedMembers.some((m) => m.userId === user.userId)) {
      return;
    }
    setSelectedMembers([...selectedMembers, user]);
  }

  function handleRemoveMember(userId: string): void {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId));
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) {
      return;
    }

    setIsCreating(true);
    try {
      const memberIds = selectedMembers.map((m) => m.userId);
      const result = await createGroup({
        name: groupName.trim(),
        type: groupType,
        memberUserIds: memberIds,
      });
      onGroupCreated(result.groupId);
      onClose();
    } catch (error) {
      console.error('[GroupCreateModal] Create group failed:', error);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleLoadMembers(groupId: string): Promise<void> {
    const trimmedGroupId = groupId.trim();
    if (!trimmedGroupId) {
      setManageHint('请输入群组 ID。');
      return;
    }
    setManageGroupId(trimmedGroupId);
    setIsLoadingMembers(true);
    setManageHint('');
    try {
      const [members, group] = await Promise.all([
        getGroupMembers(trimmedGroupId),
        getGroup(trimmedGroupId),
      ]);
      setGroupMembers(members);
      setManageName(group.name);
      setManageDescription(group.description ?? '');
    } catch (error) {
      console.error('[GroupCreateModal] Load members failed:', error);
      setManageHint('加载群组失败，请检查群组ID与权限。');
    } finally {
      setIsLoadingMembers(false);
    }
  }

  async function handleRemoveGroupMember(userId: string): Promise<void> {
    if (!manageGroupId) return;

    try {
      await removeGroupMember(manageGroupId, userId);
      setGroupMembers(groupMembers.filter((m) => m.userId !== userId));
      setManageHint('成员已移除。');
    } catch (error) {
      console.error('[GroupCreateModal] Remove member failed:', error);
      setManageHint('移除成员失败，请确认当前账号有管理员权限。');
    }
  }

  async function handleManageSearch(): Promise<void> {
    if (!manageSearchKeyword.trim()) {
      setManageSearchResults([]);
      return;
    }
    setIsManageSearching(true);
    setManageHint('');
    try {
      const results = await searchUsers(manageSearchKeyword.trim(), 20);
      setManageSearchResults(results.filter((r) => r.userId !== currentUserId));
    } catch (error) {
      console.error('[GroupCreateModal] Manage search failed:', error);
      setManageHint('搜索成员失败，请稍后重试。');
    } finally {
      setIsManageSearching(false);
    }
  }

  async function handleAddGroupMember(userId: string): Promise<void> {
    if (!manageGroupId) return;
    try {
      await addGroupMember(manageGroupId, userId);
      await handleLoadMembers(manageGroupId);
      setManageSearchResults([]);
      setManageSearchKeyword('');
      setManageHint('成员已添加。');
    } catch (error) {
      console.error('[GroupCreateModal] Add member failed:', error);
      setManageHint('添加成员失败，请确认当前账号有管理员权限。');
    }
  }

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!manageGroupId || !manageName.trim()) {
      return;
    }
    setIsSavingProfile(true);
    setManageHint('');
    try {
      await updateGroupProfile(manageGroupId, {
        name: manageName.trim(),
        description: manageDescription.trim() || undefined,
      });
      setManageHint('群资料已更新。');
    } catch (error) {
      console.error('[GroupCreateModal] Update profile failed:', error);
      setManageHint('更新群资料失败，请确认当前账号有管理员权限。');
    } finally {
      setIsSavingProfile(false);
    }
  }

  const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

  function onManageSearchInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    void handleManageSearch();
  }

  if (!isOpen) {
    return null;
  }

  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
  const filteredFriendCandidates = friendCandidates.filter((friend) => {
    if (!normalizedSearchKeyword) {
      return true;
    }
    return (
      friend.username.toLowerCase().includes(normalizedSearchKeyword) ||
      friend.userId.toLowerCase().includes(normalizedSearchKeyword)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="w-[min(94vw,960px)] !max-w-none gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle>群组管理</DialogTitle>
          <DialogDescription>
            在当前页面创建群聊，或通过群组 ID 管理现有群聊。
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-6 py-4">
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'create' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveTab('create')}
            >
              创建群组
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'manage' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveTab('manage')}
            >
              管理群组
            </button>
          </div>
        </div>

        <div className="max-h-[min(72vh,640px)] overflow-y-auto px-6 py-5">
          {activeTab === 'create' ? (
            <form id="group-create-form" className="space-y-6" onSubmit={handleCreateGroup}>
              <div className="space-y-2">
                <Label htmlFor="group-name">群组名称</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="请输入群组名称"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-type">群组类型</Label>
                <select
                  id="group-type"
                  value={groupType}
                  onChange={(e) => setGroupType(Number(e.target.value) as GroupType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value={1}>私密群（仅好友可加入）</option>
                  <option value={2}>公开群（任何人可加入）</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label>添加成员（好友）</Label>
                <div className="flex gap-2">
                  <Input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="按用户名或用户 ID 筛选好友"
                  />
                  <Button type="button" variant="secondary" disabled={isLoadingFriends} onClick={() => void loadFriendCandidates()}>
                    {isLoadingFriends ? '刷新中...' : '刷新'}
                  </Button>
                </div>

                {friendHint ? <p className="text-xs text-muted-foreground">{friendHint}</p> : null}

                {filteredFriendCandidates.length > 0 ? (
                  <ScrollArea className="h-56 rounded-lg border border-border">
                    <div className="divide-y divide-border">
                      {filteredFriendCandidates.map((user) => (
                        <div
                          key={user.userId}
                          className="flex items-center justify-between gap-3 px-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <AppAvatar
                              avatarUrl={user.avatarUrl}
                              name={user.username}
                              className="h-9 w-9"
                              fallbackClassName="text-xs text-white"
                              fallbackStyle={{ backgroundColor: avatarColors[getAvatarColorIndex(user.username)] }}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{user.username}</p>
                              <p className="truncate font-mono text-xs text-muted-foreground">{user.userId}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedMembers.some((member) => member.userId === user.userId) ? 'secondary' : 'default'}
                            disabled={selectedMembers.some((member) => member.userId === user.userId)}
                            onClick={() => handleAddMember(user)}
                          >
                            {selectedMembers.some((member) => member.userId === user.userId) ? '已选择' : '添加'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground">未找到符合条件的好友。</p>
                )}

                {selectedMembers.length > 0 ? (
                  <div className="space-y-2">
                    <Label>已选成员 ({selectedMembers.length})</Label>
                    <ScrollArea className="max-h-44 rounded-lg border border-border">
                      <div className="divide-y divide-border">
                        {selectedMembers.map((member) => (
                          <div key={member.userId} className="flex items-center gap-3 px-3 py-3">
                            <AppAvatar
                              avatarUrl={member.avatarUrl}
                              name={member.username}
                              className="h-9 w-9"
                              fallbackClassName="text-xs text-white"
                              fallbackStyle={{ backgroundColor: avatarColors[getAvatarColorIndex(member.username)] }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{member.username}</p>
                              <p className="truncate font-mono text-xs text-muted-foreground">{member.userId}</p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveMember(member.userId)}>
                              移除
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="manage-group-id">群组 ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="manage-group-id"
                    value={manageGroupId}
                    onChange={(e) => setManageGroupId(e.target.value)}
                    placeholder="输入要管理的群组 ID"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleLoadMembers(manageGroupId)}
                    disabled={!manageGroupId.trim() || isLoadingMembers}
                  >
                    {isLoadingMembers ? '加载中...' : '加载'}
                  </Button>
                </div>
              </div>

              {manageGroupId ? (
                <>
                  <form className="space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={handleUpdateProfile}>
                    <div className="space-y-2">
                      <Label htmlFor="manage-group-name">群名称</Label>
                      <Input
                        id="manage-group-name"
                        value={manageName}
                        onChange={(e) => setManageName(e.target.value)}
                        placeholder="群名称"
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manage-group-desc">群描述</Label>
                      <Input
                        id="manage-group-desc"
                        value={manageDescription}
                        onChange={(e) => setManageDescription(e.target.value)}
                        placeholder="群描述"
                        maxLength={200}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSavingProfile || !manageName.trim()}>
                        {isSavingProfile ? '保存中...' : '更新群资料'}
                      </Button>
                    </DialogFooter>
                  </form>

                  <div className="space-y-3">
                    <Label>添加成员</Label>
                    <div className="flex gap-2">
                      <Input
                        value={manageSearchKeyword}
                        onChange={(e) => setManageSearchKeyword(e.target.value)}
                        onKeyDown={onManageSearchInputKeyDown}
                        placeholder="搜索用户名"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isManageSearching}
                        onClick={() => void handleManageSearch()}
                      >
                        {isManageSearching ? '搜索中...' : '搜索'}
                      </Button>
                    </div>
                    {manageSearchResults.length > 0 ? (
                      <ScrollArea className="max-h-40 rounded-lg border border-border">
                        <div className="divide-y divide-border">
                          {manageSearchResults.map((user) => (
                            <div key={user.userId} className="flex items-center justify-between gap-3 px-3 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <AppAvatar
                                  avatarUrl={user.avatarUrl}
                                  name={user.username}
                                  className="h-9 w-9"
                                  fallbackClassName="text-xs text-white"
                                  fallbackStyle={{ backgroundColor: avatarColors[getAvatarColorIndex(user.username)] }}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{user.username}</p>
                                  <p className="truncate font-mono text-xs text-muted-foreground">{user.userId}</p>
                                </div>
                              </div>
                              <Button type="button" size="sm" onClick={() => void handleAddGroupMember(user.userId)}>
                                添加
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <Label>成员列表 ({groupMembers.length})</Label>
                    <ScrollArea className="max-h-52 rounded-lg border border-border">
                      <div className="divide-y divide-border">
                        {groupMembers.map((member) => (
                          <div key={member.userId} className="flex items-center justify-between gap-3 px-3 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <AppAvatar
                                avatarUrl={member.avatarUrl}
                                name={member.username}
                                className="h-9 w-9"
                                fallbackClassName="text-xs text-white"
                                fallbackStyle={{ backgroundColor: avatarColors[getAvatarColorIndex(member.username)] }}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{member.username}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {member.role === 1 ? '管理员' : '成员'}
                                </p>
                              </div>
                            </div>
                            {member.userId !== currentUserId ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleRemoveGroupMember(member.userId)}
                              >
                                移除
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              ) : null}

              {manageHint ? <p className="text-sm text-muted-foreground">{manageHint}</p> : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          {activeTab === 'create' ? (
            <Button
              type="submit"
              form="group-create-form"
              disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
            >
              {isCreating ? '创建中...' : '创建群组'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
