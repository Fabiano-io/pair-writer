//! Project folder and file operations.
//! Filesystem is the operational source of read/write for this cycle only —
//! a practical decision of the current application, not final product architecture.

use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn normalize_path(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))
}

fn path_is_within_base(child: &Path, base: &Path) -> Result<bool, String> {
    let base_canon = normalize_path(base)?;
    let child_canon = normalize_path(child)?;
    Ok(child_canon.starts_with(base_canon))
}

fn is_valid_entry_name(name: &str) -> bool {
    if name.trim().is_empty() || name == "." || name == ".." {
        return false;
    }

    let mut components = Path::new(name).components();
    matches!(
        (components.next(), components.next()),
        (Some(Component::Normal(_)), None)
    )
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
        let name = entry.file_name().to_string_lossy().into_owned();
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
pub fn read_file_binary(
    file_path: String,
    project_root: Option<String>,
) -> Result<Vec<u8>, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(path, base)? {
            return Err("File is outside project directory".to_string());
        }
    }

    fs::read(path).map_err(|e| format!("Failed to read file: {}", e))
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

#[tauri::command]
pub fn create_project_file(file_path: String, project_root: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    let canon_base = normalize_path(base)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    let parent_canon = normalize_path(path.parent().unwrap_or(base))?;
    if !parent_canon.starts_with(&canon_base) {
        return Err("File is outside project directory".to_string());
    }

    if path.exists() {
        return Err("File already exists".to_string());
    }

    fs::write(path, "").map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_project_folder(
    target_dir: String,
    project_root: String,
    base_name: String,
) -> Result<String, String> {
    let target = Path::new(&target_dir);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    if !target.is_dir() {
        return Err("Target path is not a directory".to_string());
    }

    if !is_valid_entry_name(&base_name) {
        return Err("Invalid folder name".to_string());
    }

    if !path_is_within_base(target, base)? {
        return Err("Entry is outside project directory".to_string());
    }

    let mut destination: Option<PathBuf> = None;
    for index in 0..10_000 {
        let candidate_name = if index == 0 {
            base_name.clone()
        } else {
            format!("{} ({})", base_name, index)
        };

        let candidate = target.join(candidate_name);
        if !candidate.exists() {
            destination = Some(candidate);
            break;
        }
    }

    let destination = destination
        .ok_or_else(|| "Could not generate destination name".to_string())?;

    fs::create_dir(&destination)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn rename_project_entry(
    entry_path: String,
    new_name: String,
    project_root: String,
) -> Result<String, String> {
    let source = Path::new(&entry_path);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    if !source.exists() {
        return Err("Entry does not exist".to_string());
    }

    if !is_valid_entry_name(&new_name) {
        return Err("Invalid name".to_string());
    }

    if !path_is_within_base(source, base)? {
        return Err("Entry is outside project directory".to_string());
    }

    let source_parent = source
        .parent()
        .ok_or_else(|| "Entry has no parent directory".to_string())?;

    let canon_base = normalize_path(base)?;
    let canon_parent = normalize_path(source_parent)?;
    if !canon_parent.starts_with(&canon_base) {
        return Err("Entry is outside project directory".to_string());
    }

    let destination = source_parent.join(&new_name);
    if destination.exists() {
        return Err("Entry already exists".to_string());
    }

    fs::rename(source, &destination).map_err(|e| format!("Failed to rename entry: {}", e))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn delete_project_entry(entry_path: String, project_root: String) -> Result<(), String> {
    let entry = Path::new(&entry_path);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    if !entry.exists() {
        return Err("Entry does not exist".to_string());
    }

    if !path_is_within_base(entry, base)? {
        return Err("Entry is outside project directory".to_string());
    }

    if entry.is_dir() {
        fs::remove_dir_all(entry).map_err(|e| format!("Failed to delete folder: {}", e))?;
    } else {
        fs::remove_file(entry).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn paste_copied_project_file(
    entry_path: String,
    target_dir: String,
    project_root: String,
    base_name: String,
) -> Result<String, String> {
    let source = Path::new(&entry_path);
    let target = Path::new(&target_dir);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    if !source.is_file() {
        return Err("Source entry is not a file".to_string());
    }

    if !target.is_dir() {
        return Err("Target path is not a directory".to_string());
    }

    if !is_valid_entry_name(&base_name) {
        return Err("Invalid base name".to_string());
    }

    if !path_is_within_base(source, base)? || !path_is_within_base(target, base)? {
        return Err("Entry is outside project directory".to_string());
    }

    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!(".{}", ext))
        .unwrap_or_default();

    let mut destination: Option<PathBuf> = None;
    for index in 0..10_000 {
        let candidate_name = if index == 0 {
            format!("{}{}", base_name, extension)
        } else {
            format!("{} ({}){}", base_name, index, extension)
        };

        let candidate = target.join(candidate_name);
        if !candidate.exists() {
            destination = Some(candidate);
            break;
        }
    }

    let destination = destination.ok_or_else(|| "Could not generate destination name".to_string())?;

    fs::copy(source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn move_project_entry(
    entry_path: String,
    target_dir: String,
    project_root: String,
) -> Result<String, String> {
    let source = Path::new(&entry_path);
    let target = Path::new(&target_dir);
    let base = Path::new(&project_root);

    if !base.is_dir() {
        return Err("Project root is not a directory".to_string());
    }

    if !source.exists() {
        return Err("Entry does not exist".to_string());
    }

    if !target.is_dir() {
        return Err("Target path is not a directory".to_string());
    }

    if !path_is_within_base(source, base)? || !path_is_within_base(target, base)? {
        return Err("Entry is outside project directory".to_string());
    }

    let source_canon = normalize_path(source)?;
    let target_canon = normalize_path(target)?;

    if source_canon.is_dir() && target_canon.starts_with(&source_canon) {
        return Err("Cannot move a folder into itself".to_string());
    }

    let source_name = source
        .file_name()
        .ok_or_else(|| "Entry has no valid name".to_string())?;

    let destination = target.join(source_name);

    if destination == source {
        return Ok(source.to_string_lossy().into_owned());
    }

    if destination.exists() {
        return Err("Destination already exists".to_string());
    }

    fs::rename(source, &destination).map_err(|e| format!("Failed to move entry: {}", e))?;

    Ok(destination.to_string_lossy().into_owned())
}

