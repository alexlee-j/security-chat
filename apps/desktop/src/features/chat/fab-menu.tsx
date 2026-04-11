/**
 * FAB 菜单组件
 * 设计规范：2026-04-07-ui-redesign.md
 */
import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
import { cn } from '@/lib/utils';

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
      {/* 展开菜单 */}
      {open && (
        <div className="fab-menu-dropdown" role="menu">
          <button
            className="fab-menu-item w-full flex items-center gap-3 h-11 px-3 border-none bg-transparent rounded-lg cursor-pointer text-sm text-foreground transition-colors hover:bg-accent"
            role="menuitem"
            aria-label="新建群聊"
            onClick={() => {
              props.onNewGroup();
              setOpen(false);
            }}
          >
            <span className="w-5 h-5 rounded shrink-0" style={{ background: '#3390ec' }} />
            <span className="text-foreground">新建群聊</span>
          </button>
          <button
            className="fab-menu-item w-full flex items-center gap-3 h-11 px-3 border-none bg-transparent rounded-lg cursor-pointer text-sm text-foreground transition-colors hover:bg-accent"
            role="menuitem"
            aria-label="添加好友"
            onClick={() => {
              props.onNewChat();
              setOpen(false);
            }}
          >
            <span className="w-5 h-5 rounded shrink-0" style={{ background: '#707579' }} />
            <span className="text-foreground">添加好友</span>
          </button>
        </div>
      )}

      {/* FAB 按钮 */}
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
