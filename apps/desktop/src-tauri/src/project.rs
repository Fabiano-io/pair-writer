//! Project folder and file operations.
//! Filesystem is the operational source of read/write for this cycle only —
//! a practical decision of the current application, not final product architecture.

use std::fs;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use printpdf::{Mm, PdfDocument, PdfSaveOptions};

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

fn open_path_in_system_file_explorer(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("explorer");
        if path.is_file() {
            command.arg(format!("/select,{}", path.to_string_lossy()));
        } else {
            command.arg(path);
        }

        command
            .spawn()
            .map_err(|e| format!("Failed to open File Explorer: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        if path.is_file() {
            command.arg("-R").arg(path);
        } else {
            command.arg(path);
        }

        command
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let target = if path.is_dir() {
            path.to_path_buf()
        } else {
            path.parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "File has no parent directory".to_string())?
        };

        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Open in file explorer is not supported on this platform".to_string())
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

fn ensure_pdf_extension(path: &Path) -> PathBuf {
    match path.extension().and_then(|value| value.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("pdf") => path.to_path_buf(),
        _ => path.with_extension("pdf"),
    }
}

fn resolve_browser_pdf_engines() -> Vec<PathBuf> {
    let mut engines: Vec<PathBuf> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            engines.push(
                PathBuf::from(&program_files_x86)
                    .join("Microsoft")
                    .join("Edge")
                    .join("Application")
                    .join("msedge.exe"),
            );
        }
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            engines.push(
                PathBuf::from(&program_files)
                    .join("Microsoft")
                    .join("Edge")
                    .join("Application")
                    .join("msedge.exe"),
            );
            engines.push(
                PathBuf::from(&program_files)
                    .join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe"),
            );
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            engines.push(
                PathBuf::from(&local_app_data)
                    .join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe"),
            );
        }
        engines.push(PathBuf::from("msedge"));
        engines.push(PathBuf::from("chrome"));
        engines.push(PathBuf::from("chromium"));
    }

    #[cfg(target_os = "linux")]
    {
        engines.push(PathBuf::from("microsoft-edge"));
        engines.push(PathBuf::from("google-chrome"));
        engines.push(PathBuf::from("chromium"));
        engines.push(PathBuf::from("chromium-browser"));
    }

    #[cfg(target_os = "macos")]
    {
        engines.push(PathBuf::from(
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ));
        engines.push(PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ));
        engines.push(PathBuf::from("google-chrome"));
        engines.push(PathBuf::from("microsoft-edge"));
    }

    engines
}

fn resolve_node_executables() -> Vec<PathBuf> {
    let mut executables: Vec<PathBuf> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        executables.push(PathBuf::from(r"C:\Program Files\nodejs\node.exe"));
        executables.push(PathBuf::from("node.exe"));
        executables.push(PathBuf::from("node"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        executables.push(PathBuf::from("node"));
    }

    executables
}

fn resolve_playwright_render_script_path() -> Result<PathBuf, String> {
    let script_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Failed to resolve desktop application root".to_string())?
        .join("scripts")
        .join("render-html-to-pdf.mjs");

    if !script_path.is_file() {
        return Err(format!(
            "Playwright PDF render script was not found: {}",
            script_path.to_string_lossy()
        ));
    }

    Ok(script_path)
}

fn render_html_to_pdf_with_browser(output_pdf_path: &Path, html_content: &str) -> Result<(), String> {
    let workdir = create_docx_preview_workdir()?;
    let html_path = workdir.join("rendered-export.html");
    fs::write(&html_path, html_content)
        .map_err(|e| format!("Failed to create temporary HTML export file: {}", e))?;

    if let Some(parent) = output_pdf_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let output_pdf = output_pdf_path.to_string_lossy().to_string();
    let script_path = resolve_playwright_render_script_path()?;
    let desktop_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Failed to resolve desktop application root".to_string())?;

    let mut last_error = String::new();
    let mut any_browser_found = false;
    let mut any_node_found = false;

    for node_executable in resolve_node_executables() {
        if node_executable.is_absolute() && !node_executable.exists() {
            continue;
        }

        any_node_found = true;

        for engine in resolve_browser_pdf_engines() {
            if engine.is_absolute() && !engine.exists() {
                continue;
            }

            any_browser_found = true;

            let output = match Command::new(&node_executable)
                .arg(&script_path)
                .arg(&html_path)
                .arg(&output_pdf)
                .arg(&engine)
                .current_dir(desktop_root)
                .output()
            {
                Ok(output) => output,
                Err(error) => {
                    last_error = format!(
                        "Failed to start {:?} with {:?}: {}",
                        node_executable, engine, error
                    );
                    continue;
                }
            };

            if output.status.success() && output_pdf_path.is_file() {
                let _ = fs::remove_dir_all(&workdir);
                return Ok(());
            }

            let details = command_output_to_text(&output);
            last_error = if details.is_empty() {
                format!(
                    "Playwright PDF render failed with {:?} + {:?} (status: {})",
                    node_executable, engine, output.status
                )
            } else {
                format!(
                    "Playwright PDF render failed with {:?} + {:?} (status: {}, {})",
                    node_executable, engine, output.status, details
                )
            };
        }
    }

    let _ = fs::remove_dir_all(&workdir);

    if !any_node_found {
        return Err("Node.js was not found. Install Node.js to enable Markdown PDF export.".to_string());
    }

    if !any_browser_found {
        return Err(
            "No compatible browser engine found. Install Microsoft Edge or Google Chrome."
                .to_string(),
        );
    }

    if last_error.is_empty() {
        return Err("Failed to render HTML to PDF via browser engine".to_string());
    }

    Err(last_error)
}

fn resolve_export_font_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\calibri.ttf",
        ];
        for candidate in candidates {
            let path = PathBuf::from(candidate);
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ];
        for candidate in candidates {
            let path = PathBuf::from(candidate);
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
        ];
        for candidate in candidates {
            let path = PathBuf::from(candidate);
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

fn wrap_text_line(line: &str, max_chars: usize) -> Vec<String> {
    if max_chars == 0 {
        return vec![line.to_string()];
    }

    let normalized = line.replace('\t', "  ").replace('\u{0000}', "");
    if normalized.is_empty() {
        return vec![String::new()];
    }

    let chars: Vec<char> = normalized.chars().collect();
    if chars.len() <= max_chars {
        return vec![normalized];
    }

    let mut wrapped = Vec::new();
    let mut start = 0usize;

    while start < chars.len() {
        let hard_end = usize::min(start + max_chars, chars.len());
        if hard_end == chars.len() {
            wrapped.push(chars[start..hard_end].iter().collect());
            break;
        }

        let mut break_at = hard_end;
        let search_start = start + (max_chars / 2);
        for index in (search_start..hard_end).rev() {
            if chars[index].is_whitespace() {
                break_at = index + 1;
                break;
            }
        }

        if break_at <= start {
            break_at = hard_end;
        }

        wrapped.push(
            chars[start..break_at]
                .iter()
                .collect::<String>()
                .trim_end()
                .to_string(),
        );
        start = break_at;
    }

    if wrapped.is_empty() {
        wrapped.push(String::new());
    }

    wrapped
}

#[derive(Clone, Copy)]
enum MarkdownLineStyle {
    Body,
    Heading(u8),
    Quote,
    Code,
}

struct MarkdownRenderLine {
    text: String,
    style: MarkdownLineStyle,
}

fn is_horizontal_rule_markdown(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.len() < 3 {
        return false;
    }
    if !(trimmed.chars().all(|c| c == '-' || c == '_' || c == '*')) {
        return false;
    }
    let first = trimmed.chars().next().unwrap_or('-');
    trimmed.chars().all(|c| c == first)
}

fn is_code_fence_markdown(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with("```") || trimmed.starts_with("~~~")
}

fn parse_markdown_heading(line: &str) -> Option<(u8, String)> {
    let trimmed = line.trim_start();
    let bytes = trimmed.as_bytes();
    let mut level = 0usize;
    while level < bytes.len() && bytes[level] == b'#' && level < 6 {
        level += 1;
    }
    if level == 0 || level >= bytes.len() || bytes[level] != b' ' {
        return None;
    }

    let text = trimmed[level + 1..].trim().to_string();
    Some((level as u8, text))
}

fn split_markdown_table_row(line: &str) -> Vec<String> {
    line.trim()
        .trim_matches('|')
        .split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}

fn is_markdown_table_separator(line: &str) -> bool {
    let cells = split_markdown_table_row(line);
    !cells.is_empty()
        && cells.iter().all(|cell| {
            let candidate = cell.trim().trim_matches(':');
            candidate.len() >= 3 && candidate.chars().all(|c| c == '-')
        })
}

fn markdown_to_render_lines(markdown: &str) -> Vec<MarkdownRenderLine> {
    let normalized = markdown.replace("\r\n", "\n").replace('\r', "\n");
    let source_lines: Vec<&str> = normalized.split('\n').collect();
    let mut lines: Vec<MarkdownRenderLine> = Vec::new();
    let mut index = 0usize;
    let mut in_code_fence = false;

    while index < source_lines.len() {
        let line = source_lines[index];
        let trimmed = line.trim();

        if in_code_fence {
            if is_code_fence_markdown(trimmed) {
                in_code_fence = false;
                lines.push(MarkdownRenderLine {
                    text: String::new(),
                    style: MarkdownLineStyle::Body,
                });
                index += 1;
                continue;
            }

            lines.push(MarkdownRenderLine {
                text: line.replace('\t', "  "),
                style: MarkdownLineStyle::Code,
            });
            index += 1;
            continue;
        }

        if trimmed.is_empty() {
            lines.push(MarkdownRenderLine {
                text: String::new(),
                style: MarkdownLineStyle::Body,
            });
            index += 1;
            continue;
        }

        if is_code_fence_markdown(trimmed) {
            in_code_fence = true;
            index += 1;
            continue;
        }

        if let Some((level, text)) = parse_markdown_heading(line) {
            lines.push(MarkdownRenderLine {
                text,
                style: MarkdownLineStyle::Heading(level),
            });
            index += 1;
            continue;
        }

        if is_horizontal_rule_markdown(line) {
            lines.push(MarkdownRenderLine {
                text: "────────────────────────────────────────".to_string(),
                style: MarkdownLineStyle::Body,
            });
            index += 1;
            continue;
        }

        if line.trim_start().starts_with('>') {
            let quote = line.trim_start().trim_start_matches('>').trim_start();
            lines.push(MarkdownRenderLine {
                text: format!("| {}", quote),
                style: MarkdownLineStyle::Quote,
            });
            index += 1;
            continue;
        }

        let unordered = line.trim_start();
        if unordered.starts_with("- ") || unordered.starts_with("* ") || unordered.starts_with("+ ")
        {
            let item = unordered[2..].trim_start();
            lines.push(MarkdownRenderLine {
                text: format!("• {}", item),
                style: MarkdownLineStyle::Body,
            });
            index += 1;
            continue;
        }

        if let Some(dot_index) = unordered.find('.') {
            let (left, right) = unordered.split_at(dot_index);
            if !left.is_empty()
                && left.chars().all(|c| c.is_ascii_digit())
                && right.starts_with(". ")
            {
                let item = right[2..].trim_start();
                lines.push(MarkdownRenderLine {
                    text: format!("{}. {}", left, item),
                    style: MarkdownLineStyle::Body,
                });
                index += 1;
                continue;
            }
        }

        if line.contains('|')
            && (index + 1) < source_lines.len()
            && is_markdown_table_separator(source_lines[index + 1])
        {
            let headers = split_markdown_table_row(line);
            lines.push(MarkdownRenderLine {
                text: headers.join(" | "),
                style: MarkdownLineStyle::Body,
            });
            lines.push(MarkdownRenderLine {
                text: "────────────────────────────────────────".to_string(),
                style: MarkdownLineStyle::Body,
            });

            index += 2;
            while index < source_lines.len() {
                let row = source_lines[index].trim();
                if row.is_empty() || !row.contains('|') {
                    break;
                }
                lines.push(MarkdownRenderLine {
                    text: split_markdown_table_row(row).join(" | "),
                    style: MarkdownLineStyle::Body,
                });
                index += 1;
            }

            lines.push(MarkdownRenderLine {
                text: String::new(),
                style: MarkdownLineStyle::Body,
            });
            continue;
        }

        let mut paragraph = String::from(trimmed);
        index += 1;
        while index < source_lines.len() {
            let next = source_lines[index];
            let next_trimmed = next.trim();
            if next_trimmed.is_empty()
                || is_code_fence_markdown(next_trimmed)
                || parse_markdown_heading(next).is_some()
                || is_horizontal_rule_markdown(next)
                || next.trim_start().starts_with('>')
                || next.trim_start().starts_with("- ")
                || next.trim_start().starts_with("* ")
                || next.trim_start().starts_with("+ ")
                || (next.contains('|')
                    && (index + 1) < source_lines.len()
                    && is_markdown_table_separator(source_lines[index + 1]))
            {
                break;
            }
            paragraph.push(' ');
            paragraph.push_str(next_trimmed);
            index += 1;
        }

        lines.push(MarkdownRenderLine {
            text: paragraph,
            style: MarkdownLineStyle::Body,
        });
    }

    if lines.is_empty() {
        lines.push(MarkdownRenderLine {
            text: String::new(),
            style: MarkdownLineStyle::Body,
        });
    }

    lines
}

fn render_text_as_pdf(output_path: &Path, title: &str, content: &str) -> Result<(), String> {
    let mut doc = PdfDocument::new(title);

    let page_width = Mm(210.0);
    let page_height = Mm(297.0);
    let margin_left_mm: f32 = 14.0;
    let margin_right_mm: f32 = 14.0;
    let margin_top_mm: f32 = 16.0;
    let margin_bottom_mm: f32 = 16.0;
    let font_size_pt: f32 = 10.5;
    let line_height_mm: f32 = font_size_pt * 0.352_778 * 1.55;
    let approx_char_width_mm: f32 = font_size_pt * 0.352_778 * 0.56;
    let usable_width_mm = page_width.0 - margin_left_mm - margin_right_mm;
    let max_chars = usize::max(10, (usable_width_mm / approx_char_width_mm).floor() as usize);

    let font_path = resolve_export_font_path()
        .ok_or_else(|| "No compatible system font found for PDF export".to_string())?;
    let bytes =
        fs::read(&font_path).map_err(|e| format!("Failed to read export font: {}", e))?;
    let mut warnings = Vec::new();
    let font_id = doc.add_font(
        &printpdf::ParsedFont::from_bytes(&bytes, 0, &mut warnings)
            .ok_or_else(|| "Failed to parse export font".to_string())?,
    );

    let mut ops: Vec<printpdf::Op> = vec![
        printpdf::Op::StartTextSection,
        printpdf::Op::SetFontSize {
            size: printpdf::Pt(font_size_pt),
            font: font_id.clone(),
        },
        printpdf::Op::SetLineHeight {
            lh: printpdf::Pt(line_height_mm * 2.834_645_7),
        },
        printpdf::Op::SetTextCursor {
            pos: printpdf::Point {
                x: printpdf::Pt(margin_left_mm * 2.834_645_7),
                y: printpdf::Pt((page_height.0 - margin_top_mm) * 2.834_645_7),
            },
        },
    ];

    let mut current_y_mm = page_height.0 - margin_top_mm;
    let min_y_mm = margin_bottom_mm;

    let mut pages: Vec<printpdf::PdfPage> = Vec::new();
    let push_page = |ops: &mut Vec<printpdf::Op>, pages: &mut Vec<printpdf::PdfPage>| {
        ops.push(printpdf::Op::EndTextSection);
        let page = printpdf::PdfPage::new(page_width, page_height, ops.clone());
        pages.push(page);
        ops.clear();
        ops.push(printpdf::Op::StartTextSection);
        ops.push(printpdf::Op::SetFontSize {
            size: printpdf::Pt(font_size_pt),
            font: font_id.clone(),
        });
        ops.push(printpdf::Op::SetLineHeight {
            lh: printpdf::Pt(line_height_mm * 2.834_645_7),
        });
        ops.push(printpdf::Op::SetTextCursor {
            pos: printpdf::Point {
                x: printpdf::Pt(margin_left_mm * 2.834_645_7),
                y: printpdf::Pt((page_height.0 - margin_top_mm) * 2.834_645_7),
            },
        });
    };

    let normalized_content = content.replace("\r\n", "\n").replace('\r', "\n");
    let lines = normalized_content.split('\n');
    for line in lines {
        let wrapped_lines = wrap_text_line(line, max_chars);
        for wrapped_line in wrapped_lines {
            if current_y_mm <= min_y_mm {
                push_page(&mut ops, &mut pages);
                current_y_mm = page_height.0 - margin_top_mm;
            }

            ops.push(printpdf::Op::WriteText {
                items: vec![printpdf::TextItem::Text(wrapped_line)],
                font: font_id.clone(),
            });
            ops.push(printpdf::Op::AddLineBreak);
            current_y_mm -= line_height_mm;
        }
    }

    ops.push(printpdf::Op::EndTextSection);
    pages.push(printpdf::PdfPage::new(page_width, page_height, ops));
    doc.with_pages(pages);

    let mut warnings = Vec::new();
    let bytes = doc.save(&PdfSaveOptions::default(), &mut warnings);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let mut writer = BufWriter::new(
        File::create(output_path).map_err(|e| format!("Failed to create PDF file: {}", e))?,
    );
    use std::io::Write as _;
    writer
        .write_all(&bytes)
        .map_err(|e| format!("Failed to write PDF file: {}", e))?;

    Ok(())
}

fn markdown_style_metrics(style: MarkdownLineStyle) -> (f32, f32, f32, f32) {
    match style {
        MarkdownLineStyle::Heading(1) => (22.0, 1.35, 1.0, 0.6),
        MarkdownLineStyle::Heading(2) => (18.0, 1.35, 0.9, 0.5),
        MarkdownLineStyle::Heading(3) => (15.5, 1.35, 0.75, 0.4),
        MarkdownLineStyle::Heading(4) => (13.5, 1.35, 0.6, 0.35),
        MarkdownLineStyle::Heading(5) => (12.0, 1.35, 0.5, 0.3),
        MarkdownLineStyle::Heading(_) => (11.0, 1.35, 0.4, 0.28),
        MarkdownLineStyle::Code => (10.0, 1.5, 0.1, 0.1),
        MarkdownLineStyle::Quote => (10.6, 1.45, 0.25, 0.25),
        MarkdownLineStyle::Body => (10.8, 1.48, 0.15, 0.15),
    }
}

fn markdown_left_margin(base_margin: f32, style: MarkdownLineStyle) -> f32 {
    match style {
        MarkdownLineStyle::Code => base_margin + 4.0,
        MarkdownLineStyle::Quote => base_margin + 3.0,
        MarkdownLineStyle::Body | MarkdownLineStyle::Heading(_) => base_margin,
    }
}

fn render_markdown_as_pdf(output_path: &Path, title: &str, markdown: &str) -> Result<(), String> {
    let mut doc = PdfDocument::new(title);

    let page_width = Mm(210.0);
    let page_height = Mm(297.0);
    let margin_left_mm: f32 = 14.0;
    let margin_right_mm: f32 = 14.0;
    let margin_top_mm: f32 = 16.0;
    let margin_bottom_mm: f32 = 16.0;
    let usable_width_mm = page_width.0 - margin_left_mm - margin_right_mm;

    let font_path = resolve_export_font_path()
        .ok_or_else(|| "No compatible system font found for PDF export".to_string())?;
    let font_bytes =
        fs::read(&font_path).map_err(|e| format!("Failed to read export font: {}", e))?;
    let mut font_warnings = Vec::new();
    let font_id = doc.add_font(
        &printpdf::ParsedFont::from_bytes(&font_bytes, 0, &mut font_warnings)
            .ok_or_else(|| "Failed to parse export font".to_string())?,
    );

    let lines = markdown_to_render_lines(markdown);

    let mut ops: Vec<printpdf::Op> = vec![printpdf::Op::StartTextSection];
    let mut pages: Vec<printpdf::PdfPage> = Vec::new();

    let mut current_y_mm = page_height.0 - margin_top_mm;
    let min_y_mm = margin_bottom_mm;

    for line in lines {
        let (font_size_pt, line_height_mult, spacing_before, spacing_after) =
            markdown_style_metrics(line.style);
        let line_height_mm = font_size_pt * 0.352_778 * line_height_mult;
        let text_left_mm = markdown_left_margin(margin_left_mm, line.style);
        let approx_char_width_mm = font_size_pt * 0.352_778 * 0.54;
        let max_chars = usize::max(
            10,
            ((usable_width_mm - (text_left_mm - margin_left_mm)) / approx_char_width_mm)
                .floor() as usize,
        );

        current_y_mm -= spacing_before;
        if current_y_mm <= min_y_mm {
            ops.push(printpdf::Op::EndTextSection);
            pages.push(printpdf::PdfPage::new(page_width, page_height, std::mem::take(&mut ops)));
            ops.push(printpdf::Op::StartTextSection);
            current_y_mm = page_height.0 - margin_top_mm;
        }

        let wrapped = wrap_text_line(&line.text, max_chars);
        for wrapped_line in wrapped {
            if current_y_mm <= min_y_mm {
                ops.push(printpdf::Op::EndTextSection);
                pages.push(printpdf::PdfPage::new(
                    page_width,
                    page_height,
                    std::mem::take(&mut ops),
                ));
                ops.push(printpdf::Op::StartTextSection);
                current_y_mm = page_height.0 - margin_top_mm;
            }

            ops.push(printpdf::Op::SetFontSize {
                size: printpdf::Pt(font_size_pt),
                font: font_id.clone(),
            });
            ops.push(printpdf::Op::SetTextCursor {
                pos: printpdf::Point {
                    x: printpdf::Pt(text_left_mm * 2.834_645_7),
                    y: printpdf::Pt(current_y_mm * 2.834_645_7),
                },
            });
            ops.push(printpdf::Op::WriteText {
                items: vec![printpdf::TextItem::Text(wrapped_line)],
                font: font_id.clone(),
            });

            current_y_mm -= line_height_mm;
        }

        current_y_mm -= spacing_after;
    }

    ops.push(printpdf::Op::EndTextSection);
    pages.push(printpdf::PdfPage::new(page_width, page_height, ops));
    doc.with_pages(pages);

    let mut warnings = Vec::new();
    let bytes = doc.save(&PdfSaveOptions::default(), &mut warnings);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let mut writer = BufWriter::new(
        File::create(output_path).map_err(|e| format!("Failed to create PDF file: {}", e))?,
    );
    use std::io::Write as _;
    writer
        .write_all(&bytes)
        .map_err(|e| format!("Failed to write PDF file: {}", e))?;

    Ok(())
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
pub fn open_in_file_explorer(
    entry_path: String,
    project_root: Option<String>,
) -> Result<(), String> {
    let path = Path::new(&entry_path);
    if !path.exists() {
        return Err("Entry does not exist".to_string());
    }

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(path, base)? {
            return Err("Entry is outside project directory".to_string());
        }
    }

    open_path_in_system_file_explorer(path)
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
pub fn export_text_document_as_pdf(
    source_file_path: String,
    output_file_path: String,
    content: String,
    project_root: Option<String>,
) -> Result<String, String> {
    let source_path = Path::new(&source_file_path);
    if !source_path.is_file() {
        return Err("Source path is not a file".to_string());
    }

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(source_path, base)? {
            return Err("File is outside project directory".to_string());
        }
    }

    let output_path = ensure_pdf_extension(Path::new(&output_file_path));
    let title = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Document export");

    let is_markdown = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false);

    if is_markdown {
        render_markdown_as_pdf(&output_path, title, &content)?;
    } else {
        render_text_as_pdf(&output_path, title, &content)?;
    }

    Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn export_html_document_as_pdf(
    source_file_path: String,
    output_file_path: String,
    html_content: String,
    project_root: Option<String>,
) -> Result<String, String> {
    let source_path = Path::new(&source_file_path);
    if !source_path.is_file() {
        return Err("Source path is not a file".to_string());
    }

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(source_path, base)? {
            return Err("File is outside project directory".to_string());
        }
    }

    let output_path = ensure_pdf_extension(Path::new(&output_file_path));
    render_html_to_pdf_with_browser(&output_path, &html_content)?;

    Ok(output_path.to_string_lossy().into_owned())
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
pub fn save_file_binary(
    file_path: String,
    bytes: Vec<u8>,
    project_root: Option<String>,
) -> Result<(), String> {
    let path = Path::new(&file_path);

    if let Some(ref root) = project_root {
        let base = Path::new(root);
        if !path_is_within_base(path, base)? {
            return Err("File is outside project directory".to_string());
        }
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    fs::write(path, bytes).map_err(|e| format!("Failed to write file: {}", e))
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

