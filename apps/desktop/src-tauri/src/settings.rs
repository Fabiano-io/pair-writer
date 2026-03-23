use crate::storage::get_app_storage_paths;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

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
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub chat: ChatSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_preset")]
    pub font_preset: String,
    #[serde(default = "default_language")]
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSettings {
    #[serde(default = "default_chat_provider")]
    pub provider: String,
    #[serde(default)]
    pub general: ChatGeneralSettings,
    #[serde(default = "default_chat_model_catalog")]
    pub models: Vec<ChatModelCatalogEntry>,
    #[serde(default = "default_chat_default_model_id")]
    pub default_chat_model_id: String,
    #[serde(default = "default_bubble_default_model_id")]
    pub default_bubble_model_id: String,
    #[serde(default)]
    pub openai: OpenAiSettings,
    #[serde(default)]
    pub anthropic: AnthropicSettings,
    #[serde(default)]
    pub gemini: GeminiSettings,
    #[serde(default)]
    pub lm_studio: LmStudioSettings,
    #[serde(default)]
    pub open_ai_compatible: OpenAiCompatibleSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGeneralSettings {
    #[serde(default = "default_chat_save_history")]
    pub save_history: bool,
    #[serde(default = "default_chat_stream_responses")]
    pub stream_responses: bool,
    #[serde(default = "default_chat_check_for_updates")]
    pub check_for_updates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatModelCatalogEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "default_chat_provider")]
    pub provider: String,
    #[serde(default)]
    pub model_id: String,
    #[serde(default = "default_model_enabled")]
    pub enabled: bool,
    #[serde(default = "default_model_supports_vision")]
    pub supports_vision: bool,
    #[serde(default = "default_model_supports_tools")]
    pub supports_tools: bool,
    #[serde(default = "default_model_supports_thinking")]
    pub supports_thinking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiSettings {
    #[serde(default = "default_openai_model")]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicSettings {
    #[serde(default = "default_anthropic_model")]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiSettings {
    #[serde(default = "default_gemini_model")]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioSettings {
    #[serde(default = "default_lm_studio_endpoint_url")]
    pub endpoint_url: String,
    #[serde(default = "default_lm_studio_model")]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCompatibleSettings {
    #[serde(default = "default_openai_compatible_name")]
    pub display_name: String,
    #[serde(default = "default_openai_compatible_endpoint_url")]
    pub endpoint_url: String,
    #[serde(default = "default_openai_compatible_model")]
    pub model: String,
}

fn default_theme() -> String {
    "dark".to_string()
}
fn default_font_preset() -> String {
    "default".to_string()
}
fn default_language() -> String {
    "en".to_string()
}
fn default_chat_provider() -> String {
    "lmStudio".to_string()
}
fn default_chat_save_history() -> bool {
    true
}
fn default_chat_stream_responses() -> bool {
    true
}
fn default_chat_check_for_updates() -> bool {
    false
}
fn default_model_enabled() -> bool {
    true
}
fn default_model_supports_vision() -> bool {
    false
}
fn default_model_supports_tools() -> bool {
    false
}
fn default_model_supports_thinking() -> bool {
    false
}
fn default_openai_model() -> String {
    "gpt-4.1".to_string()
}
fn default_chat_default_model_id() -> String {
    "lmstudio-local".to_string()
}
fn default_bubble_default_model_id() -> String {
    "lmstudio-local".to_string()
}
fn default_anthropic_model() -> String {
    "claude-sonnet-4-5".to_string()
}
fn default_gemini_model() -> String {
    "gemini-2.5-pro".to_string()
}
fn default_lm_studio_endpoint_url() -> String {
    "http://127.0.0.1:1234".to_string()
}
fn default_lm_studio_model() -> String {
    "local-model".to_string()
}
fn default_openai_compatible_name() -> String {
    "OpenAI-Compatible".to_string()
}
fn default_openai_compatible_endpoint_url() -> String {
    "http://127.0.0.1:1234".to_string()
}
fn default_openai_compatible_model() -> String {
    "custom-model".to_string()
}
fn default_chat_model_catalog() -> Vec<ChatModelCatalogEntry> {
    vec![
        ChatModelCatalogEntry {
            id: "anthropic-sonnet".to_string(),
            name: "Claude Sonnet".to_string(),
            provider: "anthropic".to_string(),
            model_id: default_anthropic_model(),
            enabled: true,
            supports_vision: false,
            supports_tools: false,
            supports_thinking: false,
        },
        ChatModelCatalogEntry {
            id: "openai-gpt41".to_string(),
            name: "GPT-4.1".to_string(),
            provider: "openai".to_string(),
            model_id: default_openai_model(),
            enabled: true,
            supports_vision: false,
            supports_tools: false,
            supports_thinking: false,
        },
        ChatModelCatalogEntry {
            id: "gemini-pro".to_string(),
            name: "Gemini 2.5 Pro".to_string(),
            provider: "gemini".to_string(),
            model_id: default_gemini_model(),
            enabled: true,
            supports_vision: false,
            supports_tools: false,
            supports_thinking: false,
        },
        ChatModelCatalogEntry {
            id: "lmstudio-local".to_string(),
            name: "LM Studio Local".to_string(),
            provider: "lmStudio".to_string(),
            model_id: default_lm_studio_model(),
            enabled: true,
            supports_vision: false,
            supports_tools: false,
            supports_thinking: false,
        },
        ChatModelCatalogEntry {
            id: "openai-compatible-custom".to_string(),
            name: "Custom Endpoint".to_string(),
            provider: "openAiCompatible".to_string(),
            model_id: default_openai_compatible_model(),
            enabled: true,
            supports_vision: false,
            supports_tools: false,
            supports_thinking: false,
        },
    ]
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_preset: default_font_preset(),
            language: default_language(),
        }
    }
}

impl Default for ChatSettings {
    fn default() -> Self {
        Self {
            provider: default_chat_provider(),
            general: ChatGeneralSettings::default(),
            models: default_chat_model_catalog(),
            default_chat_model_id: default_chat_default_model_id(),
            default_bubble_model_id: default_bubble_default_model_id(),
            openai: OpenAiSettings::default(),
            anthropic: AnthropicSettings::default(),
            gemini: GeminiSettings::default(),
            lm_studio: LmStudioSettings::default(),
            open_ai_compatible: OpenAiCompatibleSettings::default(),
        }
    }
}

impl Default for ChatGeneralSettings {
    fn default() -> Self {
        Self {
            save_history: default_chat_save_history(),
            stream_responses: default_chat_stream_responses(),
            check_for_updates: default_chat_check_for_updates(),
        }
    }
}

impl Default for OpenAiSettings {
    fn default() -> Self {
        Self {
            model: default_openai_model(),
        }
    }
}

impl Default for AnthropicSettings {
    fn default() -> Self {
        Self {
            model: default_anthropic_model(),
        }
    }
}

impl Default for GeminiSettings {
    fn default() -> Self {
        Self {
            model: default_gemini_model(),
        }
    }
}

impl Default for LmStudioSettings {
    fn default() -> Self {
        Self {
            endpoint_url: default_lm_studio_endpoint_url(),
            model: default_lm_studio_model(),
        }
    }
}

impl Default for OpenAiCompatibleSettings {
    fn default() -> Self {
        Self {
            display_name: default_openai_compatible_name(),
            endpoint_url: default_openai_compatible_endpoint_url(),
            model: default_openai_compatible_model(),
        }
    }
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
    4
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
    380.0
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: default_version(),
            window: WindowSettings::default(),
            workspace_layout: WorkspaceLayoutSettings::default(),
            project_root_path: None,
            appearance: AppearanceSettings::default(),
            chat: ChatSettings::default(),
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
    let paths = get_app_storage_paths(app)?;
    Ok(paths.config_path)
}

fn try_read_settings(path: &Path) -> Option<AppSettings> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn read_settings_from_disk(path: &Path, legacy_path: Option<&Path>) -> AppSettings {
    if let Some(settings) = try_read_settings(path) {
        return settings;
    }

    if let Some(legacy_path) = legacy_path {
        if let Some(settings) = try_read_settings(legacy_path) {
            return settings;
        }
    }

    AppSettings::default()
}

pub fn write_settings_to_disk(path: &Path, settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, json).map_err(|e| format!("Failed to write settings file: {}", e))
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let paths = get_app_storage_paths(&app)?;
    let settings = read_settings_from_disk(&paths.config_path, Some(&paths.legacy_settings_path));

    if !paths.config_path.exists() {
        write_settings_to_disk(&paths.config_path, &settings)?;
    }

    Ok(settings)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path(&app)?;
    write_settings_to_disk(&path, &settings)
}

#[tauri::command]
pub fn get_app_data_directory(app: AppHandle) -> Result<String, String> {
    let settings_path = get_settings_path(&app)?;
    let parent = settings_path
        .parent()
        .ok_or_else(|| "Failed to resolve app data directory.".to_string())?;

    Ok(parent.to_string_lossy().into_owned())
}
