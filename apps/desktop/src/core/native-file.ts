import { invoke } from '@tauri-apps/api/core';

export type SaveAndOpenFileResult = {
  path: string;
  opened: boolean;
  open_error?: string | null;
};

export type EnsureCachedMediaFileResult = {
  path: string;
  cache_hit: boolean;
};

export type CachedMediaFileLookupResult = {
  path: string;
  exists: boolean;
};

export type OpenCachedMediaFileResult = {
  path: string;
  opened: boolean;
  open_error?: string | null;
};

export type RemoveCachedMediaFileResult = {
  path: string;
  removed: boolean;
};

export async function saveAndOpenFile(fileName: string, blob: Blob): Promise<SaveAndOpenFileResult> {
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return invoke<SaveAndOpenFileResult>('save_and_open_file_command', {
    fileName,
    bytes,
  });
}

export function buildMediaCacheKey(input: {
  mediaAssetId: string;
  plainDigest?: string | null;
}): string {
  const mediaAssetId = input.mediaAssetId.trim();
  const plainDigest = input.plainDigest?.trim();
  return plainDigest ? `${mediaAssetId}-${plainDigest.slice(0, 16)}` : mediaAssetId;
}

export async function ensureCachedMediaFile(
  cacheKey: string,
  fileName: string,
  blob: Blob,
): Promise<EnsureCachedMediaFileResult> {
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return invoke<EnsureCachedMediaFileResult>('ensure_cached_media_file_command', {
    cacheKey,
    fileName,
    bytes,
  });
}

export async function lookupCachedMediaFile(
  cacheKey: string,
  fileName: string,
): Promise<CachedMediaFileLookupResult> {
  return invoke<CachedMediaFileLookupResult>('lookup_cached_media_file_command', {
    cacheKey,
    fileName,
  });
}

export async function openCachedMediaFile(path: string): Promise<OpenCachedMediaFileResult> {
  return invoke<OpenCachedMediaFileResult>('open_cached_media_file_command', {
    path,
  });
}

export async function removeCachedMediaFile(
  cacheKey: string,
  fileName: string,
): Promise<RemoveCachedMediaFileResult> {
  return invoke<RemoveCachedMediaFileResult>('remove_cached_media_file_command', {
    cacheKey,
    fileName,
  });
}
