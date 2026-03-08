mod settings;

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
        .invoke_handler(tauri::generate_handler![
            settings::load_settings,
            settings::save_settings,
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
            if let Ok(size) = window.outer_size() {
                settings.window.width = size.width as f64;
                settings.window.height = size.height as f64;
            }
            if let Ok(pos) = window.outer_position() {
                settings.window.x = Some(pos.x as f64);
                settings.window.y = Some(pos.y as f64);
            }
        }
    }

    let _ = write_settings_to_disk(&settings_path, &settings);
}
