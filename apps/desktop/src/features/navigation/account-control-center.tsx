import { Button } from '@/components/ui/button';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { NavigationDrawer, type NavigationDrawerSection } from './navigation-drawer';
import { ProfilePanel } from './profile-sheet';
import { AboutPanel } from './about-sheet';
import { SettingsPanel } from '../settings/notification-settings-sheet';

export type AccountControlSection = NavigationDrawerSection;
type ThemeMode = 'light' | 'dark' | 'auto';

type AccountControlCenterProps = {
  section: AccountControlSection;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  workspace: 'chat' | 'friend';
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onSectionChange: (section: AccountControlSection) => void;
  onWorkspaceChange: (workspace: 'chat' | 'friend') => void;
  onBackToDrawer: () => void;
  onClose: () => void;
  onLogout: () => void;
};

const sectionMeta: Record<AccountControlSection, { title: string; eyebrow: string; icon: string }> = {
  profile: { title: '个人中心', eyebrow: '账户身份与当前设备', icon: 'person' },
  settings: { title: '设置', eyebrow: '通知与显示偏好', icon: 'settings' },
  about: { title: '关于', eyebrow: '产品信息与安全能力', icon: 'info' },
};

export function AccountControlCenter(props: AccountControlCenterProps): JSX.Element {
  const meta = sectionMeta[props.section];

  function renderPanel(): JSX.Element {
    if (props.section === 'profile') {
      return <ProfilePanel userId={props.userId} onLogout={props.onLogout} />;
    }
    if (props.section === 'settings') {
      return <SettingsPanel active theme={props.theme} onThemeChange={props.onThemeChange} />;
    }
    return <AboutPanel />;
  }

  function handleSectionChange(section: NavigationDrawerSection): void {
    props.onSectionChange(section);
  }

  return (
    <div className="account-control-center">
      <SheetTitle className="sr-only">{meta.title}</SheetTitle>
      <SheetDescription className="sr-only">{meta.eyebrow}</SheetDescription>

      <aside className="nav-drawer-sheet p-0 flex flex-col h-full" style={{ width: '292px', minWidth: '292px' }}>
        <NavigationDrawer
          userId={props.userId}
          username={props.username}
          avatarUrl={props.avatarUrl}
          workspace={undefined}
          activeSection={props.section}
          theme={props.theme}
          onWorkspaceChange={props.onWorkspaceChange}
          onSectionChange={handleSectionChange}
          onLogout={props.onLogout}
          onThemeChange={props.onThemeChange}
        />
      </aside>

      <section className="account-control-content" aria-labelledby="account-control-title">
        <header className="account-control-content-header">
          <div className="flex items-center gap-3">
            <span className="material-symbols-rounded text-xl">{meta.icon}</span>
            <h2 className="text-base font-semibold">{meta.title}</h2>
          </div>
        </header>

        <div className="account-control-scroll">
          {renderPanel()}
        </div>
      </section>
    </div>
  );
}
