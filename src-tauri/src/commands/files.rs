use serde::{Serialize, Deserialize};
use std::path::PathBuf;

fn launcher_base_dir() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("PortalLauncher")
}

/// Open the PortalLauncher folder in the system file explorer
#[tauri::command]
pub async fn open_minecraft_folder() -> Result<(), String> {
    let mc_dir = launcher_base_dir();
    std::fs::create_dir_all(&mc_dir).ok();
    
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&mc_dir).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&mc_dir).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&mc_dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the path to the PortalLauncher folder
#[tauri::command]
pub async fn get_minecraft_folder_path() -> Result<String, String> {
    let mc_dir = launcher_base_dir();
    std::fs::create_dir_all(&mc_dir).ok();
    Ok(mc_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    if path.is_empty() { return Err("Empty path".into()); }
    let p = std::path::Path::new(&path);
    if !p.exists() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileFilter { pub name: String, pub extensions: Vec<String> }

#[tauri::command]
pub async fn pick_file(_filters: Option<Vec<FileFilter>>) -> Result<Option<String>, String> {
    // File picking is handled by Tauri's dialog plugin on the frontend.
    // This stub exists for completeness; the actual call goes through
    // @tauri-apps/plugin-dialog on the JS side.
    Ok(None)
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Read error: {e}"))
}

#[tauri::command]
pub async fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &data).map_err(|e| format!("Write error: {e}"))
}

/// Open a URL in the system default browser
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    webbrowser::open(&url).map_err(|e| format!("Failed to open URL: {}", e))
}
