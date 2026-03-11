use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub window: WindowSettings,
    #[serde(default)]
    pub workspace_layout: WorkspaceLayoutSettings,
    /// Convenience only (e.g. reopen last folder). Not source of truth. User selection defines the project.
    #[serde(default)]
    pub project_root_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSettings {
    #[serde(default = "default_window_width")]
    pub width: f64,
    #[serde(default = "default_window_height")]
    pub height: f64,
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub is_maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceLayoutSettings {
    #[serde(default = "default_explorer_width")]
    pub explorer_width: f64,
    #[serde(default = "default_chat_width")]
    pub chat_width: f64,
}

fn default_version() -> u32 {
    1
}
fn default_window_width() -> f64 {
    1280.0
}
fn default_window_height() -> f64 {
    800.0
}
fn default_explorer_width() -> f64 {
    260.0
}
fn default_chat_width() -> f64 {
    340.0
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: default_version(),
            window: WindowSettings::default(),
            workspace_layout: WorkspaceLayoutSettings::default(),
            project_root_path: None,
        }
    }
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            width: default_window_width(),
            height: default_window_height(),
            x: None,
            y: None,
            is_maximized: false,
        }
    }
}

impl Default for WorkspaceLayoutSettings {
    fn default() -> Self {
        Self {
            explorer_width: default_explorer_width(),
            chat_width: default_chat_width(),
        }
    }
}

pub fn get_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(data_dir.join("settings.json"))
}

pub fn read_settings_from_disk(path: &PathBuf) -> AppSettings {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

pub fn write_settings_to_disk(path: &PathBuf, settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, json).map_err(|e| format!("Failed to write settings file: {}", e))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = get_settings_path(&app)?;
    Ok(read_settings_from_disk(&path))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path(&app)?;
    write_settings_to_disk(&path, &settings)
}
