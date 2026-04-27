import { SheetTitle } from '@/components/ui/sheet';
import { AppAvatar } from '@/components/app-avatar';

export type NavigationDrawerSection = 'profile' | 'settings' | 'about';

type NavigationDrawerProps = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  workspace?: 'chat' | 'friend';
  activeSection?: NavigationDrawerSection;
  theme: 'light' | 'dark' | 'auto';
  onWorkspaceChange: (workspace: 'chat' | 'friend') => void;
  onSectionChange: (section: NavigationDrawerSection) => void;
  onLogout: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'auto') => void;
};

export function NavigationDrawer({
  userId,
  username,
  avatarUrl,
  workspace,
  activeSection,
  theme,
  onWorkspaceChange,
  onSectionChange,
  onLogout,
  onThemeChange,
}: NavigationDrawerProps): JSX.Element {
  function handleThemeToggle(): void {
    const themes: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme);
    onThemeChange(themes[(currentIndex + 1) % themes.length]);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="nav-drawer-header px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <AppAvatar
            avatarUrl={avatarUrl}
            name={username || userId || '用户'}
            className="h-12 w-12 shrink-0"
            fallbackClassName="bg-primary text-primary-foreground text-lg font-semibold"
          />
          <div className="flex-1 min-w-0">
            <SheetTitle className="nav-drawer-username truncate">
              {username || '用户'}
            </SheetTitle>
            <p className="nav-drawer-account-id truncate" />
            <p className="nav-drawer-status text-xs text-success flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success inline-block" />
              在线
            </p>
          </div>
        </div>
      </header>

      {/* 导航区 */}
      <div className="px-3 py-3">
        <nav className="nav-drawer-nav px-3 py-3 flex flex-col gap-2">
          <button
            type="button"
            className={"nav-drawer-nav-item flex-1" + (workspace === 'chat' ? ' active' : '')}
            onClick={() => onWorkspaceChange('chat')}
          >
            <span className="material-symbols-rounded nav-drawer-nav-icon">chat</span>
            <span>聊天</span>
          </button>

          <button
            type="button"
            className={"nav-drawer-nav-item flex-1" + (workspace === 'friend' ? ' active' : '')}
            onClick={() => onWorkspaceChange('friend')}
          >
            <span className="material-symbols-rounded nav-drawer-nav-icon">group</span>
            <span>好友</span>
          </button>
        </nav>
      </div>

      {/* 快捷设置区 - 主题切换 */}
      <div className="px-4 border-b border-border">
        <div className="flex items-center justify-between py-3">
          <span className="nav-drawer-theme-label">显示模式</span>
          <button
            type="button"
            className="nav-drawer-theme-btn"
            aria-label="切换主题"
            onClick={handleThemeToggle}
          >
            <span className="material-symbols-rounded">
              {theme === 'light' ? 'wb_sunny' : theme === 'dark' ? 'dark_mode' : 'desktop_windows'}
            </span>
          </button>
        </div>
      </div>

      {/* 底部功能区 */}
      <div className="mt-auto px-3 py-3">
        <button
          type="button"
          className={"nav-drawer-item w-full" + (activeSection === 'profile' ? ' active' : '')}
          onClick={() => onSectionChange('profile')}
        >
          <span className="material-symbols-rounded nav-drawer-icon">person</span>
          <span>个人中心</span>
        </button>
        <button
          type="button"
          className={"nav-drawer-item w-full" + (activeSection === 'settings' ? ' active' : '')}
          onClick={() => onSectionChange('settings')}
        >
          <span className="material-symbols-rounded nav-drawer-icon">settings</span>
          <span>设置</span>
        </button>
        <button
          type="button"
          className={"nav-drawer-item w-full" + (activeSection === 'about' ? ' active' : '')}
          onClick={() => onSectionChange('about')}
        >
          <span className="material-symbols-rounded nav-drawer-icon">info</span>
          <span>关于</span>
        </button>
        <button
          type="button"
          className="nav-drawer-item nav-drawer-logout w-full"
          onClick={onLogout}
        >
          <span className="material-symbols-rounded nav-drawer-icon">logout</span>
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
}
