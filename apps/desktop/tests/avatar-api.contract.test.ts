import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const localPath = join(process.cwd(), 'src/core/api.ts');
const repoRootPath = join(process.cwd(), 'apps/desktop/src/core/api.ts');
const apiSource = readFileSync(existsSync(localPath) ? localPath : repoRootPath, 'utf8');

assert.match(apiSource, /export async function updateUserAvatar/, 'desktop API should expose updateUserAvatar');
assert.match(apiSource, /\/user\/me\/avatar/, 'updateUserAvatar should call the current-user avatar endpoint');
assert.match(apiSource, /multipart\/form-data/, 'updateUserAvatar should submit multipart form data');

console.log('avatar api contract ok');
