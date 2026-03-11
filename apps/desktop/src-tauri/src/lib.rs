mod documents;
mod project;
mod settings;

use documents::{load_document_content, save_document_content};
use project::{read_directory_entries, read_file_content, save_file_content};
use settings::{get_settings_path, read_settings_from_disk, write_settings_to_disk};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let settings_path = get_settings_path(&handle)?;
            let settings = read_settings_from_disk(&settings_path);

            if let Some(window) = app.get_webview_window("main") {
                let win = &settings.window;

                if win.is_maximized {
                    let _ = window.maximize();
                } else {
                    let width = win.width.max(400.0);
                    let height = win.height.max(300.0);
                    let _ = window.set_size(tauri::LogicalSize::new(width, height));

                    if let (Some(x), Some(y)) = (win.x, win.y) {
                        if x >= -50.0 && y >= -50.0 && x < 10000.0 && y < 10000.0 {
                            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                        }
                    }
                }
            }

            // Store the settings path for use in window event handler
            app.manage(Mutex::new(settings_path));

            Ok(())
        })
        .on_window_event(|window, event| {
            use tauri::WindowEvent;

            match event {
                WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                    // Save on close only to avoid excessive writes
                }
                WindowEvent::CloseRequested { .. } => {
                    save_window_state(window);
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::load_settings,
            settings::save_settings,
            load_document_content,
            save_document_content,
            read_directory_entries,
            read_file_content,
            save_file_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn save_window_state(window: &tauri::Window) {
    let app = window.app_handle();

    let settings_path = match app.try_state::<Mutex<std::path::PathBuf>>() {
        Some(path) => match path.lock() {
            Ok(p) => p.clone(),
            Err(_) => return,
        },
        None => return,
    };

    let mut settings = read_settings_from_disk(&settings_path);

    if let Ok(is_maximized) = window.is_maximized() {
        settings.window.is_maximized = is_maximized;

        if !is_maximized {
            let scale_factor = window.scale_factor().unwrap_or(1.0);

            if let Ok(physical_size) = window.inner_size() {
                let logical_size = physical_size.to_logical::<f64>(scale_factor);
                settings.window.width = logical_size.width;
                settings.window.height = logical_size.height;
            }
            if let Ok(physical_pos) = window.outer_position() {
                let logical_pos = physical_pos.to_logical::<f64>(scale_factor);
                settings.window.x = Some(logical_pos.x);
                settings.window.y = Some(logical_pos.y);
            }
        }
    }

    let _ = write_settings_to_disk(&settings_path, &settings);
}
