/**
 * 文件名：message-context-menu.tsx
 * 所属模块：桌面端-聊天面板
 * 核心作用：消息右键上下文菜单，提供复制、引用、转发、下载、删除等功能
 * 创建时间：2026-04-06
 */

type MessageContextMenuProps = {
  x: number;
  y: number;
  messageType: 1 | 2 | 3 | 4;
  isOwn: boolean;
  isRevoked: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onDownload?: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function MessageContextMenu(props: MessageContextMenuProps): JSX.Element {
  const menuItems: Array<{ label: string; icon: string; action: () => void; danger?: boolean }> = [];

  if (!props.isRevoked) {
    menuItems.push({ label: '复制', icon: '📋', action: props.onCopy });
    menuItems.push({ label: '引用', icon: '↩️', action: props.onReply });
    menuItems.push({ label: '转发', icon: '↗️', action: props.onForward });
  }

  if ([2, 4].includes(props.messageType) && !props.isRevoked) {
    menuItems.push({ label: '下载', icon: '⬇️', action: props.onDownload! });
  }

  if (!props.isRevoked) {
    menuItems.push({ label: '删除', icon: '🗑', action: props.onDelete, danger: true });
  }

  return (
    <div
      className="message-context-menu"
      style={{ left: props.x, top: props.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className={item.danger ? 'message-context-menu-danger' : ''}
          onClick={() => {
            item.action();
            props.onClose();
          }}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
