import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const appSource = readFileSync(join(root, 'apps/desktop/src/App.tsx'), 'utf8');
const centerSource = readFileSync(join(root, 'apps/desktop/src/features/navigation/account-control-center.tsx'), 'utf8');
const settingsSource = readFileSync(join(root, 'apps/desktop/src/features/settings/notification-settings-sheet.tsx'), 'utf8');
const aboutSource = readFileSync(join(root, 'apps/desktop/src/features/navigation/about-sheet.tsx'), 'utf8');

assert.match(appSource, /AccountControlCenter/, 'App should render the expanded account control center');
assert.match(appSource, /accountControlSection/, 'App should own selected account control section state');
assert.doesNotMatch(appSource, /<ProfileSheet/, 'Profile should no longer open as a right-side sheet from App');
assert.doesNotMatch(appSource, /<NotificationSettingsSheet/, 'Settings should no longer open as a right-side sheet from App');
assert.doesNotMatch(appSource, /<AboutSheet/, 'About should no longer open as a right-side sheet from App');

for (const section of ['profile', 'settings', 'about']) {
  assert.match(centerSource, new RegExp(section), `Control center should support ${section} section`);
}

assert.match(centerSource, /onBackToDrawer/, 'Control center should expose a back-to-drawer affordance');
assert.match(centerSource, /onClose/, 'Control center should expose a close affordance');
assert.match(centerSource, /ProfilePanel/, 'Control center should render the profile panel');
assert.match(centerSource, /SettingsPanel/, 'Control center should render the settings panel');
assert.match(centerSource, /AboutPanel/, 'Control center should render the about panel');

assert.match(settingsSource, /messageEnabled/, 'Settings panel should include message notifications');
assert.match(settingsSource, /friendRequestEnabled/, 'Settings panel should include friend request notifications');
assert.match(settingsSource, /groupLifecycleEnabled/, 'Settings panel should include group lifecycle notifications');
assert.match(settingsSource, /onThemeChange/, 'Settings panel should expose display mode switching');
assert.doesNotMatch(settingsSource, /未来设置/, 'Settings panel should not show roadmap cards');

assert.doesNotMatch(aboutSource, /Tauri 2\.x|React 18|Vite|shadcn-ui/, 'About content should not expose framework stack details');

console.log('account control center contract ok');
