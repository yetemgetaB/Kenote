use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::WebviewWindow;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteMetadata {
    pub id: String,
    pub filename: String,
    pub title: String,
    pub content: String,
    pub updated_at: u64,
    pub created_at: u64,
    pub character_count: usize,
    pub is_pinned: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub accent_color: String,
    pub custom_notes_dir: Option<String>,
    pub font_size: String,
    pub font_family: String,
    pub line_height: String,
    pub auto_save_interval: u32,
    pub always_on_top: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            accent_color: "#0399F7".to_string(),
            custom_notes_dir: None,
            font_size: "15px".to_string(),
            font_family: "system-ui".to_string(),
            line_height: "1.6".to_string(),
            auto_save_interval: 500,
            always_on_top: false,
        }
    }
}

fn get_app_data_dir() -> PathBuf {
    if let Some(mut dir) = dirs::data_dir() {
        dir.push("Kenote");
        let _ = fs::create_dir_all(&dir);
        dir
    } else {
        PathBuf::from("./kenote_data")
    }
}

fn get_settings_path() -> PathBuf {
    get_app_data_dir().join("settings.json")
}

fn get_resolved_notes_dir(custom_dir: Option<&str>) -> PathBuf {
    if let Some(dir) = custom_dir {
        let path = PathBuf::from(dir);
        if path.exists() {
            return path;
        }
    }
    let notes_dir = get_app_data_dir().join("notes");
    let _ = fs::create_dir_all(&notes_dir);
    notes_dir
}

#[tauri::command]
fn get_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    let default = AppSettings::default();
    let _ = save_settings(default.clone());
    default
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_notes_directory() -> String {
    let settings = get_settings();
    let dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    dir.to_string_lossy().to_string()
}

fn extract_title_from_content(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let without_hash = trimmed.trim_start_matches('#').trim();
            if !without_hash.is_empty() {
                return without_hash.to_string();
            }
        }
    }
    "Untitled".to_string()
}

fn get_file_timestamps(path: &Path) -> (u64, u64) {
    if let Ok(metadata) = fs::metadata(path) {
        let modified = metadata
            .modified()
            .unwrap_or_else(|_| SystemTime::now())
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let created = metadata
            .created()
            .unwrap_or_else(|_| SystemTime::now())
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(modified);
        (modified, created)
    } else {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        (now, now)
    }
}

#[tauri::command]
fn list_notes() -> Result<Vec<NoteMetadata>, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let mut notes = Vec::new();

    if let Ok(entries) = fs::read_dir(&notes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let id = filename.trim_end_matches(".md").to_string();
                let is_pinned = filename.starts_with("pin_");

                if let Ok(content) = fs::read_to_string(&path) {
                    let title = extract_title_from_content(&content);
                    let (updated_at, created_at) = get_file_timestamps(&path);
                    let character_count = content.chars().count();

                    notes.push(NoteMetadata {
                        id,
                        filename,
                        title,
                        content,
                        updated_at,
                        created_at,
                        character_count,
                        is_pinned,
                    });
                }
            }
        }
    }

    // Sort: pinned first, then by updated_at descending
    notes.sort_by(|a, b| {
        b.is_pinned.cmp(&a.is_pinned).then_with(|| b.updated_at.cmp(&a.updated_at))
    });

    Ok(notes)
}

#[tauri::command]
fn read_note(filename: String) -> Result<NoteMetadata, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let path = notes_dir.join(&filename);

    if !path.exists() {
        return Err("Note not found".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&path);
    let character_count = content.chars().count();
    let id = filename.trim_end_matches(".md").to_string();
    let is_pinned = filename.starts_with("pin_");

    Ok(NoteMetadata {
        id,
        filename,
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
    })
}

#[tauri::command]
fn save_note(mut filename: String, content: String, is_pinned: bool) -> Result<NoteMetadata, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());

    if filename.is_empty() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
        filename = if is_pinned {
            format!("pin_note_{}.md", timestamp)
        } else {
            format!("note_{}.md", timestamp)
        };
    } else {
        // Adjust filename if pin status changed
        let base_name = if filename.starts_with("pin_") {
            filename[4..].to_string()
        } else {
            filename.clone()
        };

        let new_filename = if is_pinned {
            format!("pin_{}", base_name)
        } else {
            base_name
        };

        if new_filename != filename {
            let old_path = notes_dir.join(&filename);
            let new_path = notes_dir.join(&new_filename);
            if old_path.exists() {
                let _ = fs::rename(&old_path, &new_path);
            }
            filename = new_filename;
        }
    }

    let path = notes_dir.join(&filename);
    fs::write(&path, &content).map_err(|e| e.to_string())?;

    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&path);
    let character_count = content.chars().count();
    let id = filename.trim_end_matches(".md").to_string();

    Ok(NoteMetadata {
        id,
        filename,
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
    })
}

#[tauri::command]
fn delete_note(filename: String) -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let path = notes_dir.join(&filename);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_window_always_on_top(window: WebviewWindow, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn reveal_in_explorer(filename: Option<String>) -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let target = if let Some(name) = filename {
        notes_dir.join(name)
    } else {
        notes_dir
    };

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if target.is_file() {
            Command::new("explorer")
                .args(["/select,", &target.to_string_lossy()])
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("explorer")
                .arg(&target.to_string_lossy().as_ref())
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if target.is_file() {
            Command::new("open")
                .args(["-R", &target.to_string_lossy()])
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("open")
                .arg(&target.to_string_lossy().as_ref())
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let dir = if target.is_file() {
            target.parent().unwrap_or(&target)
        } else {
            &target
        };
        Command::new("xdg-open")
            .arg(dir.to_string_lossy().as_ref())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_default_install_dir() -> String {
    if let Some(mut local_app_data) = dirs::data_local_dir() {
        local_app_data.push("Programs");
        local_app_data.push("Kenote");
        return local_app_data.to_string_lossy().to_string();
    }
    "C:\\Program Files\\Kenote".to_string()
}

#[tauri::command]
fn is_installed() -> bool {
    let default_dir = get_default_install_dir();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            if parent == Path::new(&default_dir) {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
fn perform_installation(
    target_dir: String,
    create_desktop_shortcut: bool,
    create_start_menu_shortcut: bool,
) -> Result<(), String> {
    let target_path = PathBuf::from(&target_dir);
    fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dest_exe = target_path.join("kenote.exe");

    // Copy executable if not already in target directory
    if current_exe != dest_exe {
        let _ = fs::copy(&current_exe, &dest_exe);
    }

    // Create Shortcuts on Windows
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe_str = dest_exe.to_string_lossy();

        if create_desktop_shortcut {
            if let Some(desktop) = dirs::desktop_dir() {
                let lnk_path = desktop.join("Kenote.lnk");
                let ps_cmd = format!(
                    "$s=(New-Object -COM WScript.Shell).CreateShortcut('{}');$s.TargetPath='{}';$s.WorkingDirectory='{}';$s.Save()",
                    lnk_path.to_string_lossy(),
                    exe_str,
                    target_path.to_string_lossy()
                );
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
                    .output();
            }
        }

        if create_start_menu_shortcut {
            if let Some(roaming) = dirs::data_dir() {
                let start_menu = roaming.join("Microsoft").join("Windows").join("Start Menu").join("Programs");
                let _ = fs::create_dir_all(&start_menu);
                let lnk_path = start_menu.join("Kenote.lnk");
                let ps_cmd = format!(
                    "$s=(New-Object -COM WScript.Shell).CreateShortcut('{}');$s.TargetPath='{}';$s.WorkingDirectory='{}';$s.Save()",
                    lnk_path.to_string_lossy(),
                    exe_str,
                    target_path.to_string_lossy()
                );
                let _ = Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
                    .output();
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn launch_installed_app(target_dir: String, window: WebviewWindow) -> Result<(), String> {
    let target_path = PathBuf::from(&target_dir);
    let dest_exe = target_path.join("kenote.exe");

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new(&dest_exe).spawn();
    }

    let _ = window.close();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_notes_directory,
            list_notes,
            read_note,
            save_note,
            delete_note,
            set_window_always_on_top,
            minimize_window,
            close_window,
            reveal_in_explorer,
            get_default_install_dir,
            is_installed,
            perform_installation,
            launch_installed_app
        ])
        .setup(|_app| {
            // Initial seed note if empty
            let settings = get_settings();
            let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
            if let Ok(entries) = fs::read_dir(&notes_dir) {
                let count = entries.count();
                if count == 0 {
                    let default_note = r#"# Welcome to Kenote 🚀

Kenote is your lightning-fast, local-first markdown note taker inspired by Raycast.

### Quick Markdown Features:
- **Instant WYSIWYG**: Type `# Heading` or `- list` and see the formatted output in-place!
- **Pin Always On Top**: Click the pin icon in the top right to keep your notes visible while working across apps.
- **Local First**: Notes are saved directly as `.md` files in your storage folder.

```javascript
console.log("Hello from Kenote!");
```

> "Simplicity is the soul of efficiency."

### Next Steps:
1. Press `Ctrl + N` or the `+` icon to create a new note.
2. Press `Ctrl + O` or the note switcher icon to browse all notes.
3. Press `Ctrl + K` or the action icon to open the command palette.
"#;
                    let _ = fs::write(notes_dir.join("note_welcome.md"), default_note);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
