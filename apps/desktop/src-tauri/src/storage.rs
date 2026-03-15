use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE_NAME: &str = "config.json";
const LEGACY_SETTINGS_FILE_NAME: &str = "settings.json";
const CONVERSATIONS_DIR_NAME: &str = "conversations";

pub struct AppStoragePaths {
    pub config_path: PathBuf,
    pub legacy_settings_path: PathBuf,
    #[allow(dead_code)]
    pub conversations_dir: PathBuf,
}

pub fn get_app_storage_paths(app: &AppHandle) -> Result<AppStoragePaths, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let conversations_dir = data_dir.join(CONVERSATIONS_DIR_NAME);
    fs::create_dir_all(&conversations_dir)
        .map_err(|e| format!("Failed to create conversations dir: {}", e))?;

    Ok(AppStoragePaths {
        config_path: data_dir.join(CONFIG_FILE_NAME),
        legacy_settings_path: data_dir.join(LEGACY_SETTINGS_FILE_NAME),
        conversations_dir,
    })
}
