import { useState, useEffect, useRef } from 'react';
import * as React from 'react';

type FabMenuProps = {
  onNewGroup: () => void;
  onNewChat: () => void;
};

export function FabMenu(props: FabMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="fab-menu" ref={menuRef}>
      {open && (
        <div className="fab-menu-dropdown" role="menu">
          <button
            className="fab-menu-item"
            role="menuitem"
            aria-label="新建群聊"
            onClick={() => {
              props.onNewGroup();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon material-symbols-rounded" aria-hidden="true">group_add</span>
            <span>新建群聊</span>
          </button>
          <button
            className="fab-menu-item"
            role="menuitem"
            aria-label="发起私聊"
            onClick={() => {
              props.onNewChat();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon material-symbols-rounded" aria-hidden="true">person_add</span>
            <span>发起私聊</span>
          </button>
        </div>
      )}
      <button
        className="fab-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="打开操作菜单"
        onClick={() => setOpen(!open)}
      >
        <span className="fab-icon">+</span>
      </button>
    </div>
  );
}
