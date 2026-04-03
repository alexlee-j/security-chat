/**
 * 文件名：group-chat.tsx
 * 所属模块：桌面端-群聊功能
 * 核心作用：群聊列表展示组件，显示用户加入的群组列表
 * 核心依赖：React, types, api
 * 创建时间：2026-04-03 (Week 12)
 */

import { useEffect, useState } from 'react';
import { GroupListItem } from '../../core/types';
import { getGroupList } from '../../core/api';

type Props = {
  /** 当前用户 ID */
  currentUserId: string;
  /** 当前选中的群组 ID */
  activeGroupId: string | null;
  /** 选中群组回调 */
  onSelectGroup: (groupId: string) => void;
  /** 打开创建群组弹窗回调 */
  onOpenCreateModal: () => void;
};

export function GroupChat(props: Props): JSX.Element {
  const { currentUserId, activeGroupId, onSelectGroup, onOpenCreateModal } = props;

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  /**
   * 加载群组列表
   */
  useEffect(() => {
    async function loadGroups(): Promise<void> {
      setIsLoading(true);
      try {
        const list = await getGroupList();
        setGroups(list as GroupListItem[]);
      } catch (error) {
        console.error('[GroupChat] Load groups failed:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadGroups();
  }, []);

  /**
   * 过滤群组
   */
  const filteredGroups = keyword.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(keyword.toLowerCase()))
    : groups;

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
    <div className="group-chat-sidebar">
      <div className="group-chat-header">
        <h3>群组</h3>
        <button className="btn-create-group" onClick={onOpenCreateModal} title="创建群组">
          +
        </button>
      </div>

      <div className="group-search">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索群组..."
          className="group-search-input"
        />
      </div>

      <div className="group-list">
        {isLoading ? (
          <div className="group-list-loading">加载中...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="group-list-empty">
            {keyword.trim() ? '未找到群组' : '暂未加入群组'}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`group-item ${activeGroupId === group.id ? 'active' : ''}`}
              onClick={() => onSelectGroup(group.id)}
            >
              <div
                className="avatar"
                style={{ backgroundColor: avatarColors[getAvatarColorIndex(group.name)] }}
              >
                {group.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="group-info">
                <div className="group-name-row">
                  <span className="group-name">{group.name}</span>
                  {group.unreadCount > 0 && (
                    <span className="unread-badge">{group.unreadCount > 99 ? '99+' : group.unreadCount}</span>
                  )}
                </div>
                <div className="group-meta">
                  <span className="member-count">{group.memberCount} 人</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
