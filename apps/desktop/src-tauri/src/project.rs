//! Project folder and file operations.
//! Filesystem is the operational source of read/write for this cycle only —
//! a practical decision of the current application, not final product architecture.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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

fn command_output_to_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    match (stdout.is_empty(), stderr.is_empty()) {
        (true, true) => String::new(),
        (false, true) => format!("stdout: {}", stdout),
        (true, false) => format!("stderr: {}", stderr),
        (false, false) => format!("stdout: {} | stderr: {}", stdout, stderr),
    }
}

fn cleanup_stale_docx_preview_dirs(base: &Path, max_age: Duration) {
    let now = SystemTime::now();
    let entries = match fs::read_dir(base) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        let modified_or_created = metadata.modified().or_else(|_| metadata.created());
        let timestamp = match modified_or_created {
            Ok(timestamp) => timestamp,
            Err(_) => continue,
        };

        let age = match now.duration_since(timestamp) {
            Ok(age) => age,
            Err(_) => continue,
        };

        if age >= max_age {
            let _ = fs::remove_dir_all(path);
        }
    }
}

fn create_docx_preview_workdir() -> Result<PathBuf, String> {
    let base = std::env::temp_dir().join("pair_writer_docx_preview");
    fs::create_dir_all(&base).map_err(|e| format!("Failed to create temp directory: {}", e))?;
    cleanup_stale_docx_preview_dirs(&base, Duration::from_secs(60 * 60 * 12));

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Invalid system time: {}", e))?
        .as_millis();

    let workdir = base.join(format!("{}_{}", std::process::id(), timestamp));
    fs::create_dir_all(&workdir).map_err(|e| format!("Failed to create work directory: {}", e))?;
    Ok(workdir)
}

#[cfg(target_os = "windows")]
fn convert_docx_with_word(input_path: &Path, output_pdf_path: &Path) -> Result<(), String> {
    let script = r#"On Error Resume Next
Dim inputPath, outputPath, fso
inputPath = WScript.Arguments(0)
outputPath = WScript.Arguments(1)

Dim wordApp, doc
Set wordApp = CreateObject("Word.Application")
If Err.Number <> 0 Then
  WScript.Echo "Failed to create Word.Application: " & Err.Description
  WScript.Quit 1
End If

wordApp.Visible = False
wordApp.DisplayAlerts = 0

Err.Clear
Set doc = wordApp.Documents.Open(inputPath, False, True, False)
If Err.Number <> 0 Then
  WScript.Echo "Failed to open DOCX in Word: " & Err.Description
  Err.Clear
  On Error Resume Next
  wordApp.Quit False
  WScript.Quit 1
End If

Err.Clear
doc.ExportAsFixedFormat outputPath, 17
If Err.Number <> 0 Then
  Err.Clear
  doc.SaveAs outputPath, 17
End If

On Error Resume Next
doc.Close False
wordApp.Quit False
Set doc = Nothing
Set wordApp = Nothing

Set fso = CreateObject("Scripting.FileSystemObject")
If fso.FileExists(outputPath) Then
  WScript.Quit 0
End If

WScript.Echo "Word did not generate PDF output."
WScript.Quit 1
"#;

    let workdir = output_pdf_path
        .parent()
        .ok_or_else(|| "Invalid output directory for Word conversion".to_string())?;
    let script_path = workdir.join("word-docx-to-pdf.vbs");
    fs::write(&script_path, script)
        .map_err(|e| format!("Failed to create Word conversion script: {}", e))?;

    let cscript_path = std::env::var("SystemRoot")
        .map(|root| PathBuf::from(root).join("System32").join("cscript.exe"))
        .unwrap_or_else(|_| PathBuf::from("cscript.exe"));

    let output = Command::new(&cscript_path)
        .arg("//nologo")
        .arg(&script_path)
        .arg(input_path)
        .arg(output_pdf_path)
        .output()
        .map_err(|e| format!("Failed to start Word conversion command: {}", e))?;

    let _ = fs::remove_file(&script_path);

    if !output.status.success() {
        let details = command_output_to_text(&output);
        if details.is_empty() {
            return Err(format!(
                "Word conversion command failed with status: {}",
                output.status
            ));
        }

        return Err(format!(
            "Word conversion command failed with status {} ({})",
            output.status, details
        ));
    }

    if !output_pdf_path.is_file() {
        return Err("Word conversion finished without PDF output".to_string());
    }

    Ok(())
}

fn convert_docx_with_libreoffice(input_path: &Path, output_dir: &Path) -> Result<PathBuf, String> {
    let mut candidates = vec![PathBuf::from("soffice")];

    #[cfg(target_os = "windows")]
    {
        candidates.push(PathBuf::from(r"C:\Program Files\LibreOffice\program\soffice.exe"));
        candidates.push(PathBuf::from(
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ));
    }

    let mut last_error = String::new();
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid DOCX file name".to_string())?;

    let expected_pdf = output_dir.join(format!("{}.pdf", stem));

    for executable in candidates {
        if executable.is_absolute() && !executable.exists() {
            continue;
        }

        let output = match Command::new(&executable)
            .arg("--headless")
            .arg("--convert-to")
            .arg("pdf")
            .arg("--outdir")
            .arg(output_dir)
            .arg(input_path)
            .output()
        {
            Ok(output) => output,
            Err(error) => {
                last_error = format!("Failed to start {:?}: {}", executable, error);
                continue;
            }
        };

        if !output.status.success() {
            let details = command_output_to_text(&output);
            if details.is_empty() {
                last_error = format!("{:?} finished with status {}", executable, output.status);
            } else {
                last_error = format!(
                    "{:?} finished with status {} ({})",
                    executable, output.status, details
                );
            }
            continue;
        }

        if expected_pdf.is_file() {
            return Ok(expected_pdf);
        }

        last_error = format!("{:?} did not produce expected PDF output", executable);
    }

    if last_error.is_empty() {
        last_error = "No conversion engine available".to_string();
    }

    Err(last_error)
}

fn render_docx_to_pdf_bytes(input_path: &Path) -> Result<Vec<u8>, String> {
    let workdir = create_docx_preview_workdir()?;
    let word_pdf = workdir.join("office-export.pdf");

    let mut errors: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Err(error) = convert_docx_with_word(input_path, &word_pdf) {
            errors.push(format!("Word engine: {}", error));
        } else if word_pdf.is_file() {
            let bytes = fs::read(&word_pdf).map_err(|e| format!("Failed to read PDF output: {}", e))?;
            let _ = fs::remove_dir_all(&workdir);
            return Ok(bytes);
        }
    }

    match convert_docx_with_libreoffice(input_path, &workdir) {
        Ok(pdf_path) => {
            let bytes =
                fs::read(&pdf_path).map_err(|e| format!("Failed to read PDF output: {}", e))?;
            let _ = fs::remove_dir_all(&workdir);
            Ok(bytes)
        }
        Err(error) => {
            errors.push(format!("LibreOffice engine: {}", error));
            let _ = fs::remove_dir_all(&workdir);
            Err(format!(
                "Unable to render DOCX via Office/PDF engines. {}",
                errors.join(" | ")
            ))
        }
    }
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
pub fn render_docx_as_pdf(
    file_path: String,
    project_root: Option<String>,
) -> Result<Vec<u8>, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }

    let lower = file_path.to_lowercase();
    if !lower.ends_with(".docx") {
        return Err("Path is not a DOCX file".to_string());
    }

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(path, base)? {
            return Err("File is outside project directory".to_string());
        }
    }

    render_docx_to_pdf_bytes(path)
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

