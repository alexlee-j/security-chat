import { invoke } from '@tauri-apps/api/core';

export type SaveAndOpenFileResult = {
  path: string;
  opened: boolean;
  open_error?: string | null;
};

export async function saveAndOpenFile(fileName: string, blob: Blob): Promise<SaveAndOpenFileResult> {
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return invoke<SaveAndOpenFileResult>('save_and_open_file_command', {
    fileName,
    bytes,
  });
}
