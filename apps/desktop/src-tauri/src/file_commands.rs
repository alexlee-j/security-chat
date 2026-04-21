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
