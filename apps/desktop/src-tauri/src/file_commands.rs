use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct SaveAndOpenFileResult {
    pub path: String,
    pub opened: bool,
    pub open_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EnsureCachedMediaFileResult {
    pub path: String,
    pub cache_hit: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CachedMediaFileLookupResult {
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenCachedMediaFileResult {
    pub path: String,
    pub opened: bool,
    pub open_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoveCachedMediaFileResult {
    pub path: String,
    pub removed: bool,
}

const MEDIA_CACHE_FOLDER: &str = "security-chat/media-cache";

fn sanitize_file_name(file_name: &str) -> String {
    let trimmed = file_name.trim();
    let fallback = if trimmed.is_empty() {
        "download"
    } else {
        trimmed
    };
    fallback
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ if ch.is_control() => '_',
            _ => ch,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string()
}

fn sanitize_cache_key(cache_key: &str) -> String {
    let trimmed = cache_key.trim();
    let fallback = if trimmed.is_empty() {
        "media"
    } else {
        trimmed
    };
    let sanitized = fallback
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();

    if sanitized.is_empty() {
        "media".to_string()
    } else {
        sanitized
    }
}

fn resolve_media_cache_root() -> Result<PathBuf, String> {
    let base = dirs::cache_dir()
        .or_else(dirs::data_local_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "failed to resolve cache directory".to_string())?;
    Ok(base.join(MEDIA_CACHE_FOLDER))
}

fn resolve_cached_media_path(root: &Path, cache_key: &str, file_name: &str) -> PathBuf {
    let sanitized_key = sanitize_cache_key(cache_key);
    let sanitized_name = sanitize_file_name(file_name);
    let final_name = if sanitized_name.is_empty() {
        "download".to_string()
    } else {
        sanitized_name
    };
    root.join(sanitized_key).join(final_name)
}

fn ensure_cached_media_file_at_root(
    root: &Path,
    cache_key: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<(PathBuf, bool), String> {
    let target_path = resolve_cached_media_path(root, cache_key, file_name);
    if target_path.exists() {
        return Ok((target_path, true));
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&target_path, bytes).map_err(|error| error.to_string())?;
    Ok((target_path, false))
}

fn ensure_path_within_cache_root(root: &Path, target_path: &Path) -> Result<(), String> {
    if !target_path.exists() {
        return Err("cached file does not exist".to_string());
    }
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_target = target_path
        .canonicalize()
        .map_err(|error| error.to_string())?;

    if canonical_target.starts_with(&canonical_root) {
        Ok(())
    } else {
        Err("path is outside media cache root".to_string())
    }
}

fn unique_path(dir: &Path, file_name: &str) -> PathBuf {
    let sanitized = sanitize_file_name(file_name);
    let base_name = if sanitized.is_empty() {
        "download".to_string()
    } else {
        sanitized
    };
    let candidate = dir.join(&base_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(&base_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    let extension = Path::new(&base_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();

    for index in 1..1000 {
        let candidate = dir.join(format!("{stem} ({index}){extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem} ({}){extension}", uuid::Uuid::new_v4()))
}

fn open_with_system(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(path).status();

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(["/C", "start", "", &path.to_string_lossy()])
        .status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(path).status();

    status
        .map_err(|error| error.to_string())
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(format!("system opener exited with status {status}"))
            }
        })
}

#[tauri::command]
pub async fn ensure_cached_media_file_command(
    cache_key: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<EnsureCachedMediaFileResult, String> {
    tokio::task::spawn_blocking(move || {
        let cache_root = resolve_media_cache_root()?;
        let (target_path, cache_hit) =
            ensure_cached_media_file_at_root(&cache_root, &cache_key, &file_name, &bytes)?;
        Ok(EnsureCachedMediaFileResult {
            path: target_path.to_string_lossy().to_string(),
            cache_hit,
        })
    })
    .await
    .map_err(|_| "ensure cached media file task failed".to_string())?
}

#[tauri::command]
pub async fn lookup_cached_media_file_command(
    cache_key: String,
    file_name: String,
) -> Result<CachedMediaFileLookupResult, String> {
    tokio::task::spawn_blocking(move || {
        let cache_root = resolve_media_cache_root()?;
        let target_path = resolve_cached_media_path(&cache_root, &cache_key, &file_name);
        Ok(CachedMediaFileLookupResult {
            path: target_path.to_string_lossy().to_string(),
            exists: target_path.exists(),
        })
    })
    .await
    .map_err(|_| "lookup cached media file task failed".to_string())?
}

#[tauri::command]
pub async fn open_cached_media_file_command(path: String) -> Result<OpenCachedMediaFileResult, String> {
    tokio::task::spawn_blocking(move || {
        let cache_root = resolve_media_cache_root()?;
        let target_path = PathBuf::from(path);
        ensure_path_within_cache_root(&cache_root, &target_path)?;

        let open_error = open_with_system(&target_path).err();
        Ok(OpenCachedMediaFileResult {
            path: target_path.to_string_lossy().to_string(),
            opened: open_error.is_none(),
            open_error,
        })
    })
    .await
    .map_err(|_| "open cached media file task failed".to_string())?
}

#[tauri::command]
pub async fn remove_cached_media_file_command(
    cache_key: String,
    file_name: String,
) -> Result<RemoveCachedMediaFileResult, String> {
    tokio::task::spawn_blocking(move || {
        let cache_root = resolve_media_cache_root()?;
        let target_path = resolve_cached_media_path(&cache_root, &cache_key, &file_name);
        let removed = if target_path.exists() {
            fs::remove_file(&target_path).map_err(|error| error.to_string())?;
            true
        } else {
            false
        };
        Ok(RemoveCachedMediaFileResult {
            path: target_path.to_string_lossy().to_string(),
            removed,
        })
    })
    .await
    .map_err(|_| "remove cached media file task failed".to_string())?
}

#[tauri::command]
pub async fn save_and_open_file_command(
    file_name: String,
    bytes: Vec<u8>,
) -> Result<SaveAndOpenFileResult, String> {
    tokio::task::spawn_blocking(move || {
        let downloads_dir = dirs::download_dir()
            .or_else(dirs::home_dir)
            .ok_or_else(|| "failed to resolve downloads directory".to_string())?;
        let target_dir = downloads_dir.join("Security Chat");
        fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

        let target_path = unique_path(&target_dir, &file_name);
        fs::write(&target_path, bytes).map_err(|error| error.to_string())?;

        let open_error = open_with_system(&target_path).err();
        Ok(SaveAndOpenFileResult {
            path: target_path.to_string_lossy().to_string(),
            opened: open_error.is_none(),
            open_error,
        })
    })
    .await
    .map_err(|_| "save file task failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::{ensure_cached_media_file_at_root, resolve_cached_media_path};
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!("security-chat-cache-test-{}", Uuid::new_v4()))
    }

    #[test]
    fn ensure_cached_media_file_reuses_existing_file() {
        let root = temp_root();
        let file_name = "report.txt";
        let first_bytes = b"first-version";
        let second_bytes = b"second-version";

        let (first_path, first_hit) =
            ensure_cached_media_file_at_root(&root, "asset-1-digest-a", file_name, first_bytes)
                .expect("first ensure should succeed");
        assert!(!first_hit, "first write should not be a cache hit");

        let (second_path, second_hit) =
            ensure_cached_media_file_at_root(&root, "asset-1-digest-a", file_name, second_bytes)
                .expect("second ensure should succeed");
        assert!(second_hit, "second write should hit cache");
        assert_eq!(first_path, second_path, "cache path should be stable");

        let stored = fs::read(&first_path).expect("cached file should be readable");
        assert_eq!(
            stored, first_bytes,
            "cache hit should not rewrite existing bytes"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ensure_cached_media_file_recovers_when_file_is_missing() {
        let root = temp_root();
        let file_name = "report.txt";
        let first_bytes = b"first-version";
        let recovered_bytes = b"recovered-version";

        let (path, first_hit) =
            ensure_cached_media_file_at_root(&root, "asset-2-digest-b", file_name, first_bytes)
                .expect("initial ensure should succeed");
        assert!(!first_hit, "initial write should not be a cache hit");

        fs::remove_file(&path).expect("cached file should be removable");
        let (restored_path, restored_hit) = ensure_cached_media_file_at_root(
            &root,
            "asset-2-digest-b",
            file_name,
            recovered_bytes,
        )
        .expect("recovery ensure should succeed");

        assert!(!restored_hit, "missing file should trigger fresh write");
        assert_eq!(path, restored_path, "recovery should keep deterministic path");
        let stored = fs::read(restored_path).expect("recovered file should be readable");
        assert_eq!(stored, recovered_bytes, "recovered bytes should be stored");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ensure_cached_media_file_avoids_collisions_for_different_cache_keys() {
        let root = temp_root();
        let file_name = "same-name.pdf";

        let (first_path, _) = ensure_cached_media_file_at_root(
            &root,
            "asset-3-digest-c",
            file_name,
            b"file-a",
        )
        .expect("first ensure should succeed");
        let (second_path, _) = ensure_cached_media_file_at_root(
            &root,
            "asset-4-digest-d",
            file_name,
            b"file-b",
        )
        .expect("second ensure should succeed");

        assert_ne!(
            first_path, second_path,
            "different cache keys must map to different files even when names match"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cached_media_path_is_deterministic_for_cleanup() {
        let root = temp_root();
        let file_name = "same-name.pdf";
        let cache_key = "asset-5-digest-e";

        let (written_path, _) =
            ensure_cached_media_file_at_root(&root, cache_key, file_name, b"file")
                .expect("ensure should succeed");
        let resolved_path = resolve_cached_media_path(&root, cache_key, file_name);

        assert_eq!(
            written_path, resolved_path,
            "cleanup lookup must resolve the same deterministic cache path"
        );

        let _ = fs::remove_dir_all(root);
    }
}
