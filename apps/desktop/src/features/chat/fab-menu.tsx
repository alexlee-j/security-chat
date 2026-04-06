import { useState } from 'react';
import * as React from 'react';

type FabMenuProps = {
  onNewGroup: () => void;
  onNewChat: () => void;
};

export function FabMenu(props: FabMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="fab-menu">
      {open && (
        <div className="fab-menu-dropdown">
          <button
            className="fab-menu-item"
            onClick={() => {
              props.onNewGroup();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon">👥</span>
            <span>新建群聊</span>
          </button>
          <button
            className="fab-menu-item"
            onClick={() => {
              props.onNewChat();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon">👤</span>
            <span>发起私聊</span>
          </button>
        </div>
      )}
      <button
        className="fab-button"
        onClick={() => setOpen(!open)}
      >
        +
      </button>
    </div>
  );
}
