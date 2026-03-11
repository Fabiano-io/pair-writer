//! Project folder and file operations.
//! Filesystem is the operational source of read/write for this cycle only —
//! a practical decision of the current application, not final product architecture.

use std::fs;
use std::path::{Path, PathBuf};

#[derive(serde::Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn normalize_path(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize().map_err(|e| format!("Invalid path: {}", e))
}

fn path_is_within_base(child: &Path, base: &Path) -> Result<bool, String> {
    let base_canon = normalize_path(base)?;
    let child_canon = normalize_path(child)?;
    Ok(child_canon.starts_with(base_canon))
}

#[tauri::command]
pub fn read_directory_entries(base_path: String) -> Result<Vec<DirEntry>, String> {
    let base = Path::new(&base_path);
    if !base.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let _ = normalize_path(base)?;
    let mut entries = Vec::new();

    for entry in fs::read_dir(base).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .into_owned();
        let is_dir = path.is_dir();

        // Skip hidden files (e.g. .git, .DS_Store)
        if name.starts_with('.') {
            continue;
        }

        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            is_dir,
        });
    }

    entries.sort_by(|a, b| {
        // Directories first, then by name (case-insensitive)
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file_content(
    file_path: String,
    project_root: Option<String>,
) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // If project_root is provided, validate that file is within project
    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if path_is_within_base(path, base)? {
            // OK
        } else {
            return Err("File is outside project directory".to_string());
        }
    }

    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn save_file_content(
    file_path: String,
    content: String,
    project_root: Option<String>,
) -> Result<(), String> {
    let path = Path::new(&file_path);

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if path_is_within_base(path, base)? {
            // OK
        } else {
            return Err("File is outside project directory".to_string());
        }
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}
