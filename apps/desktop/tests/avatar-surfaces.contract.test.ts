import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const srcRoot = existsSync(join(root, 'src/App.tsx')) ? join(root, 'src') : join(root, 'apps/desktop/src');
const files = {
  app: readFileSync(join(srcRoot, 'App.tsx'), 'utf8'),
  profile: readFileSync(join(srcRoot, 'features/navigation/profile-sheet.tsx'), 'utf8'),
  drawer: readFileSync(join(srcRoot, 'features/navigation/navigation-drawer.tsx'), 'utf8'),
  conversationSidebar: readFileSync(join(srcRoot, 'features/chat/conversation-sidebar.tsx'), 'utf8'),
  chatPanel: readFileSync(join(srcRoot, 'features/chat/chat-panel.tsx'), 'utf8'),
  topBar: readFileSync(join(srcRoot, 'features/chat/top-bar.tsx'), 'utf8'),
  friendPanel: readFileSync(join(srcRoot, 'features/friend/friend-panel.tsx'), 'utf8'),
  addFriend: readFileSync(join(srcRoot, 'features/friend/add-friend-dialog.tsx'), 'utf8'),
  removeFriend: readFileSync(join(srcRoot, 'features/friend/remove-friend-dialog.tsx'), 'utf8'),
  groupCreate: readFileSync(join(srcRoot, 'features/chat/group-create-modal.tsx'), 'utf8'),
};

assert.match(files.profile, /compressAvatarImage/, 'personal center should compress avatar before upload');
assert.match(files.profile, /updateUserAvatar/, 'personal center should submit compressed avatars');
assert.match(files.profile, /type="file"/, 'personal center should provide a file picker');
assert.match(files.app, /handleProfileUpdated/, 'app shell should refresh profile state after avatar changes');
assert.match(files.app, /onRefreshConversations/, 'avatar update should refresh conversations');
assert.match(files.app, /onRefreshFriendData/, 'avatar update should refresh friend state');

for (const [name, source] of Object.entries(files)) {
  if (name === 'app') {
    continue;
  }
  assert.match(source, /AppAvatar/, `${name} should use shared avatar rendering`);
}

assert.match(files.friendPanel, /avatarUrl: row\.avatarUrl/, 'friend panel should preserve friend avatar URLs');
assert.match(files.removeFriend, /targetAvatarUrl/, 'remove friend dialog should accept avatar URL');
assert.match(files.topBar, /avatarUrl/, 'chat top bar should accept avatar URL');
assert.match(files.groupCreate, /member\.avatarUrl/, 'group member rows should render member avatar URLs');

console.log('avatar surfaces contract ok');
