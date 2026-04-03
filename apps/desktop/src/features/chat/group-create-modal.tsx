/**
 * 文件名：group-create-modal.tsx
 * 所属模块：桌面端-群聊功能
 * 核心作用：创建群组弹窗组件，支持创建群组、添加/移除群成员
 * 核心依赖：React, types, api
 * 创建时间：2026-04-03 (Week 12)
 */

import { FormEvent, useState } from 'react';
import { FriendSearchItem } from '../../core/types';
import { searchUsers, createGroup, addGroupMember, removeGroupMember, getGroupMembers } from '../../core/api';

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
  const [searchResults, setSearchResults] = useState<FriendSearchItem[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<FriendSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  if (!isOpen) {
    return null;
  }

  /**
   * 搜索好友
   */
  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!searchKeyword.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(searchKeyword.trim(), 20);
      // 过滤掉自己
      setSearchResults(results.filter((r) => r.userId !== currentUserId));
    } catch (error) {
      console.error('[GroupCreateModal] Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }

  /**
   * 添加成员到选列表
   */
  function handleAddMember(user: FriendSearchItem): void {
    if (selectedMembers.some((m) => m.userId === user.userId)) {
      return;
    }
    setSelectedMembers([...selectedMembers, user]);
    setSearchKeyword('');
    setSearchResults([]);
  }

  /**
   * 从选中列表移除成员
   */
  function handleRemoveMember(userId: string): void {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId));
  }

  /**
   * 创建群组
   */
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
        memberIds,
      });
      onGroupCreated(result.groupId);
      // 重置表单
      setGroupName('');
      setGroupType(1);
      setSelectedMembers([]);
      onClose();
    } catch (error) {
      console.error('[GroupCreateModal] Create group failed:', error);
    } finally {
      setIsCreating(false);
    }
  }

  /**
   * 加载群组成员
   */
  async function handleLoadMembers(groupId: string): Promise<void> {
    setManageGroupId(groupId);
    setIsLoadingMembers(true);
    try {
      const members = await getGroupMembers(groupId);
      setGroupMembers(members);
    } catch (error) {
      console.error('[GroupCreateModal] Load members failed:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }

  /**
   * 从群组移除成员
   */
  async function handleRemoveGroupMember(userId: string): Promise<void> {
    if (!manageGroupId) return;

    try {
      await removeGroupMember(manageGroupId, userId);
      setGroupMembers(groupMembers.filter((m) => m.userId !== userId));
    } catch (error) {
      console.error('[GroupCreateModal] Remove member failed:', error);
    }
  }

  /**
   * 获取头像颜色索引
   */
  function getAvatarColorIndex(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 5;
  }

  const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>群组管理</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            创建群组
          </button>
          <button
            className={`modal-tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            管理群组
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'create' && (
            <form onSubmit={handleCreateGroup} className="group-create-form">
              <div className="form-group">
                <label>群组名称</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="请输入群组名称"
                  maxLength={50}
                  required
                />
              </div>

              <div className="form-group">
                <label>群组类型</label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(Number(e.target.value) as GroupType)}
                >
                  <option value={1}>私密群（仅好友可加入）</option>
                  <option value={2}>公开群（任何人可加入）</option>
                </select>
              </div>

              <div className="form-group">
                <label>添加成员</label>
                <form onSubmit={handleSearch} className="search-form">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索好友用户名"
                  />
                  <button type="submit" disabled={isSearching}>
                    {isSearching ? '搜索中...' : '搜索'}
                  </button>
                </form>

                {/* 搜索结果 */}
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((user) => (
                      <div
                        key={user.userId}
                        className="search-result-item"
                        onClick={() => handleAddMember(user)}
                      >
                        <div
                          className="avatar"
                          style={{ backgroundColor: avatarColors[getAvatarColorIndex(user.username)] }}
                        >
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <span className="username">{user.username}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 已选成员 */}
                {selectedMembers.length > 0 && (
                  <div className="selected-members">
                    <label>已选成员 ({selectedMembers.length})</label>
                    <div className="member-list">
                      {selectedMembers.map((member) => (
                        <div key={member.userId} className="member-item">
                          <div
                            className="avatar small"
                            style={{ backgroundColor: avatarColors[getAvatarColorIndex(member.username)] }}
                          >
                            {member.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="username">{member.username}</span>
                          <button
                            type="button"
                            className="btn-remove"
                            onClick={() => handleRemoveMember(member.userId)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
                >
                  {isCreating ? '创建中...' : '创建群组'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'manage' && (
            <div className="group-manage-form">
              <p className="hint">管理群组功能开发中...</p>
              {/* TODO: 群组管理界面 */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
