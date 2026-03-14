const fs = require('fs');
const content = fs.readFileSync('api.ts', 'utf8');

const oldFunc = `export function decodePayload(payload: string): string {
  try {
    return decodeURIComponent(escape(atob(payload)));
  } catch {
    return payload;
  }
}`;

const newFunc = `export async function decodePayload(payload: string): Promise<string> {
  return await decryptPayload(payload);
}`;

const updated = content.replace(oldFunc, newFunc);
fs.writeFileSync('api.ts', updated);
console.log('decodePayload updated');
