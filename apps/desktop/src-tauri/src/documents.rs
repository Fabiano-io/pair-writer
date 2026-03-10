use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Validates document_id to prevent path traversal. Only alphanumeric and hyphen allowed.
fn validate_document_id(document_id: &str) -> Result<(), String> {
    if document_id.is_empty() {
        return Err("document_id cannot be empty".to_string());
    }
    if document_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        Ok(())
    } else {
        Err("document_id contains invalid characters".to_string())
    }
}

fn get_documents_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    let documents_dir = data_dir.join("documents");
    fs::create_dir_all(&documents_dir)
        .map_err(|e| format!("Failed to create documents dir: {}", e))?;

    Ok(documents_dir)
}

fn get_document_path(app: &AppHandle, document_id: &str) -> Result<PathBuf, String> {
    validate_document_id(document_id)?;
    let documents_dir = get_documents_dir(app)?;
    Ok(documents_dir.join(format!("{}.html", document_id)))
}

#[tauri::command]
pub fn load_document_content(app: AppHandle, document_id: String) -> Result<Option<String>, String> {
    let path = get_document_path(&app, &document_id)?;
    match fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read document: {}", e)),
    }
}

#[tauri::command]
pub fn save_document_content(
    app: AppHandle,
    document_id: String,
    content: String,
) -> Result<(), String> {
    let path = get_document_path(&app, &document_id)?;
    fs::write(path, content).map_err(|e| format!("Failed to write document: {}", e))
}
