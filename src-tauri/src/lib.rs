use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::SystemTime;
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct AppLaunchState {
    pub autostart_silenced: AtomicBool,
    pub launch_file: std::sync::Mutex<Option<String>>,
}

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
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_external: Option<bool>,
    #[serde(default)]
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub accent_color: String,
    pub custom_notes_dir: Option<String>,
    #[serde(default)]
    pub external_notes: Option<Vec<String>>,
    pub font_size: String,
    pub font_family: String,
    pub line_height: String,
    pub auto_save_interval: u32,
    pub always_on_top: bool,
    #[serde(default)]
    pub startup_behavior: Option<String>,
    #[serde(default)]
    pub startup_specific_note_id: Option<String>,
    #[serde(default)]
    pub last_active_note_id: Option<String>,
    #[serde(default)]
    pub quick_switcher_mode: Option<String>,
    #[serde(default)]
    pub quick_switcher_order: Option<String>,
    #[serde(default)]
    pub quick_switcher_shortcut: Option<String>,
    #[serde(default = "default_zoom")]
    pub global_zoom: Option<u32>,
    #[serde(default = "default_zoom")]
    pub editor_zoom: Option<u32>,
    #[serde(default = "default_global_shortcut")]
    pub global_shortcut: Option<String>,
    pub window_width: Option<f64>,
    pub window_height: Option<f64>,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub has_completed_onboarding: bool,
    pub discovery_source: Option<String>,
    #[serde(default = "default_telemetry_enabled")]
    pub telemetry_enabled: Option<bool>,
}

fn default_zoom() -> Option<u32> {
    Some(100)
}

fn default_global_shortcut() -> Option<String> {
    Some("Ctrl+Space".to_string())
}

fn default_telemetry_enabled() -> Option<bool> {
    Some(true)
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            accent_color: "#0399F7".to_string(),
            custom_notes_dir: None,
            external_notes: None,
            font_size: "15px".to_string(),
            font_family: "system-ui".to_string(),
            line_height: "1.6".to_string(),
            auto_save_interval: 500,
            always_on_top: false,
            startup_behavior: Some("last".to_string()),
            startup_specific_note_id: None,
            last_active_note_id: None,
            quick_switcher_mode: Some("overlay".to_string()),
            quick_switcher_order: Some("mru".to_string()),
            quick_switcher_shortcut: Some("ctrl_tab".to_string()),
            global_zoom: Some(100),
            editor_zoom: Some(100),
            global_shortcut: Some("Ctrl+Space".to_string()),
            window_width: Some(520.0),
            window_height: Some(720.0),
            window_x: None,
            window_y: None,
            has_completed_onboarding: false,
            discovery_source: None,
            telemetry_enabled: Some(true),
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
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if fs::create_dir_all(&path).is_ok() && path.is_dir() {
                return path;
            }
        }
    }
    let notes_dir = get_app_data_dir().join("notes");
    let _ = fs::create_dir_all(&notes_dir);
    notes_dir
}

fn get_trash_dir(custom_dir: Option<&str>) -> PathBuf {
    let notes_dir = get_resolved_notes_dir(custom_dir);
    let trash_dir = notes_dir.join(".trash");
    let _ = fs::create_dir_all(&trash_dir);
    trash_dir
}

fn get_assets_dir(custom_dir: Option<&str>) -> PathBuf {
    let notes_dir = get_resolved_notes_dir(custom_dir);
    let assets_dir = notes_dir.join("assets");
    let _ = fs::create_dir_all(&assets_dir);
    assets_dir
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct NotesMetadataIndex {
    #[serde(default)]
    pub pinned: std::collections::HashMap<String, bool>,
}

fn get_metadata_index_path(notes_dir: &Path) -> PathBuf {
    notes_dir.join(".metadata.json")
}

fn load_metadata_index(notes_dir: &Path) -> NotesMetadataIndex {
    let path = get_metadata_index_path(notes_dir);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(index) = serde_json::from_str::<NotesMetadataIndex>(&content) {
                return index;
            }
        }
    }
    NotesMetadataIndex::default()
}

fn save_metadata_index(notes_dir: &Path, index: &NotesMetadataIndex) -> Result<(), String> {
    let path = get_metadata_index_path(notes_dir);
    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn is_note_pinned(filename: &str, index: &NotesMetadataIndex) -> bool {
    if let Some(&pinned) = index.pinned.get(filename) {
        pinned
    } else {
        // Fallback / migration for legacy filenames
        filename.starts_with("pin_")
    }
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
fn save_settings(mut settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    // Merge existing window position and dimensions if the caller did not specify them
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(existing) = serde_json::from_str::<AppSettings>(&content) {
                if settings.window_x.is_none() {
                    settings.window_x = existing.window_x;
                }
                if settings.window_y.is_none() {
                    settings.window_y = existing.window_y;
                }
                if settings.window_width.is_none() {
                    settings.window_width = existing.window_width;
                }
                if settings.window_height.is_none() {
                    settings.window_height = existing.window_height;
                }
            }
        }
    }
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
    let first_line = content.lines().next().unwrap_or("").trim();
    if first_line.is_empty() {
        "Untitled".to_string()
    } else {
        let without_hash = first_line.trim_start_matches('#').trim();
        if without_hash.is_empty() {
            "Untitled".to_string()
        } else {
            without_hash.to_string()
        }
    }
}

fn extract_tags_from_content(content: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        // Strip leading markdown heading tokens, e.g. "### Heading" -> "Heading"
        let mut line_to_scan = line;
        let trimmed_start = line.trim_start();
        if trimmed_start.starts_with('#') {
            let heading_prefix_len = trimmed_start.chars().take_while(|&c| c == '#').count();
            if trimmed_start[heading_prefix_len..].starts_with(' ') {
                let offset = line.len() - trimmed_start.len() + heading_prefix_len;
                line_to_scan = &line[offset..];
            }
        }

        // Split by backtick to ignore inline code segments
        for (idx, segment) in line_to_scan.split('`').enumerate() {
            if idx % 2 == 1 {
                // Inside inline code
                continue;
            }

            let chars: Vec<char> = segment.chars().collect();
            let len = chars.len();
            let mut i = 0;
            while i < len {
                if chars[i] == '#' {
                    let preceded_by_boundary = i == 0 || chars[i - 1].is_whitespace() || chars[i - 1] == '(' || chars[i - 1] == '[' || chars[i - 1] == '{';
                    if preceded_by_boundary && i + 1 < len {
                        let next_char = chars[i + 1];
                        if next_char.is_alphabetic() || next_char == '_' {
                            let start = i + 1;
                            let mut end = start;
                            while end < len {
                                let c = chars[end];
                                if c.is_alphanumeric() || c == '_' || c == '-' || c == '/' {
                                    end += 1;
                                } else {
                                    break;
                                }
                            }
                            let tag_str: String = chars[start..end].iter().collect();
                            let lower = tag_str.to_lowercase();
                            if !tags.contains(&lower) {
                                tags.push(lower);
                            }
                            i = end;
                            continue;
                        }
                    }
                }
                i += 1;
            }
        }
    }

    tags
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
    let metadata_index = load_metadata_index(&notes_dir);
    let mut notes = Vec::new();

    if let Ok(entries) = fs::read_dir(&notes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let id = filename.trim_end_matches(".md").to_string();
                let is_pinned = is_note_pinned(&filename, &metadata_index);

                if let Ok(content) = fs::read_to_string(&path) {
                    let title = extract_title_from_content(&content);
                    let (updated_at, created_at) = get_file_timestamps(&path);
                    let character_count = content.chars().count();

                    let tags = extract_tags_from_content(&content);
                    notes.push(NoteMetadata {
                        id,
                        filename,
                        title,
                        content,
                        updated_at,
                        created_at,
                        character_count,
                        is_pinned,
                        tags,
                        is_external: None,
                        file_path: None,
                    });
                }
            }
        }
    }

    // Also read external notes tracked in settings
    if let Some(ref ext_paths) = settings.external_notes {
        for ext_path_str in ext_paths {
            let path = PathBuf::from(ext_path_str);
            if path.is_file() {
                if let Ok(content) = fs::read_to_string(&path) {
                    let title = extract_title_from_content(&content);
                    let (updated_at, created_at) = get_file_timestamps(&path);
                    let character_count = content.chars().count();
                    let tags = extract_tags_from_content(&content);
                    let is_pinned = is_note_pinned(ext_path_str, &metadata_index);

                    notes.push(NoteMetadata {
                        id: ext_path_str.clone(),
                        filename: ext_path_str.clone(),
                        title,
                        content,
                        updated_at,
                        created_at,
                        character_count,
                        is_pinned,
                        tags,
                        is_external: Some(true),
                        file_path: Some(ext_path_str.clone()),
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
    let is_external = Path::new(&filename).is_absolute();
    let path = if is_external {
        PathBuf::from(&filename)
    } else {
        notes_dir.join(&filename)
    };

    if !path.exists() {
        return Err("Note not found".to_string());
    }

    let metadata_index = load_metadata_index(&notes_dir);
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&path);
    let character_count = content.chars().count();
    let id = if is_external {
        filename.clone()
    } else {
        filename.trim_end_matches(".md").to_string()
    };
    let is_pinned = is_note_pinned(&filename, &metadata_index);

    let tags = extract_tags_from_content(&content);
    Ok(NoteMetadata {
        id,
        filename: filename.clone(),
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
        tags,
        is_external: if is_external { Some(true) } else { None },
        file_path: if is_external { Some(filename) } else { None },
    })
}

#[tauri::command]
fn set_note_pinned(filename: String, is_pinned: bool) -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let is_external = Path::new(&filename).is_absolute();
    let path = if is_external {
        PathBuf::from(&filename)
    } else {
        notes_dir.join(&filename)
    };

    if !path.exists() {
        return Err("Note not found".to_string());
    }

    let mut metadata_index = load_metadata_index(&notes_dir);
    metadata_index.pinned.insert(filename, is_pinned);
    save_metadata_index(&notes_dir, &metadata_index)?;
    Ok(())
}

#[tauri::command]
fn save_note(mut filename: String, content: String, is_pinned: bool) -> Result<NoteMetadata, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());

    let is_external = !filename.is_empty() && Path::new(&filename).is_absolute();

    if filename.is_empty() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
        filename = format!("note_{}.md", timestamp);
    }

    let path = if is_external {
        PathBuf::from(&filename)
    } else {
        notes_dir.join(&filename)
    };

    fs::write(&path, &content).map_err(|e| e.to_string())?;

    // Update metadata index for pin status without renaming the file
    let mut metadata_index = load_metadata_index(&notes_dir);
    metadata_index.pinned.insert(filename.clone(), is_pinned);
    let _ = save_metadata_index(&notes_dir, &metadata_index);

    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&path);
    let character_count = content.chars().count();
    let id = if is_external {
        filename.clone()
    } else {
        filename.trim_end_matches(".md").to_string()
    };

    let tags = extract_tags_from_content(&content);
    Ok(NoteMetadata {
        id,
        filename: filename.clone(),
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
        tags,
        is_external: if is_external { Some(true) } else { None },
        file_path: if is_external { Some(filename) } else { None },
    })
}

#[tauri::command]
fn open_external_note(path: String) -> Result<NoteMetadata, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() || !path_buf.is_file() {
        return Err("File does not exist or is not a valid file".to_string());
    }

    let content = fs::read_to_string(&path_buf).map_err(|e| format!("Failed to read file: {}", e))?;
    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&path_buf);
    let character_count = content.chars().count();
    let tags = extract_tags_from_content(&content);

    let mut settings = get_settings();
    let mut external_notes = settings.external_notes.unwrap_or_default();
    if !external_notes.contains(&path) {
        external_notes.insert(0, path.clone());
        settings.external_notes = Some(external_notes);
        let _ = save_settings(settings);
    }

    let settings_ref = get_settings();
    let notes_dir = get_resolved_notes_dir(settings_ref.custom_notes_dir.as_deref());
    let metadata_index = load_metadata_index(&notes_dir);
    let is_pinned = is_note_pinned(&path, &metadata_index);

    Ok(NoteMetadata {
        id: path.clone(),
        filename: path.clone(),
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
        tags,
        is_external: Some(true),
        file_path: Some(path),
    })
}

#[tauri::command]
fn untrack_external_note(path: String) -> Result<(), String> {
    let mut settings = get_settings();
    if let Some(mut external_notes) = settings.external_notes {
        external_notes.retain(|p| p != &path);
        settings.external_notes = Some(external_notes);
        save_settings(settings)?;
    }
    Ok(())
}

#[tauri::command]
fn delete_note(filename: String) -> Result<(), String> {
    if Path::new(&filename).is_absolute() {
        return untrack_external_note(filename);
    }
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let trash_dir = get_trash_dir(settings.custom_notes_dir.as_deref());
    let src_path = notes_dir.join(&filename);

    if src_path.exists() {
        let dest_path = trash_dir.join(&filename);
        if dest_path.exists() {
            let _ = fs::remove_file(&dest_path);
        }
        fs::rename(&src_path, &dest_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_trashed_notes() -> Result<Vec<NoteMetadata>, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let trash_dir = get_trash_dir(settings.custom_notes_dir.as_deref());
    let metadata_index = load_metadata_index(&notes_dir);
    let mut notes = Vec::new();

    if let Ok(entries) = fs::read_dir(&trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let id = filename.trim_end_matches(".md").to_string();
                let is_pinned = is_note_pinned(&filename, &metadata_index);

                if let Ok(content) = fs::read_to_string(&path) {
                    let title = extract_title_from_content(&content);
                    let (updated_at, created_at) = get_file_timestamps(&path);
                    let character_count = content.chars().count();

                    let tags = extract_tags_from_content(&content);
                    notes.push(NoteMetadata {
                        id,
                        filename,
                        title,
                        content,
                        updated_at,
                        created_at,
                        character_count,
                        is_pinned,
                        tags,
                        is_external: None,
                        file_path: None,
                    });
                }
            }
        }
    }

    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(notes)
}

#[tauri::command]
fn restore_note(filename: String) -> Result<NoteMetadata, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let trash_dir = get_trash_dir(settings.custom_notes_dir.as_deref());
    let src_path = trash_dir.join(&filename);
    let dest_path = notes_dir.join(&filename);

    if !src_path.exists() {
        return Err("Trashed note not found".to_string());
    }

    fs::rename(&src_path, &dest_path).map_err(|e| e.to_string())?;

    let metadata_index = load_metadata_index(&notes_dir);
    let content = fs::read_to_string(&dest_path).map_err(|e| e.to_string())?;
    let title = extract_title_from_content(&content);
    let (updated_at, created_at) = get_file_timestamps(&dest_path);
    let character_count = content.chars().count();
    let id = filename.trim_end_matches(".md").to_string();
    let is_pinned = is_note_pinned(&filename, &metadata_index);

    let tags = extract_tags_from_content(&content);
    Ok(NoteMetadata {
        id,
        filename,
        title,
        content,
        updated_at,
        created_at,
        character_count,
        is_pinned,
        tags,
        is_external: None,
        file_path: None,
    })
}

#[tauri::command]
fn permanently_delete_note(filename: String) -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let trash_dir = get_trash_dir(settings.custom_notes_dir.as_deref());
    let path = trash_dir.join(&filename);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    // Clean up metadata entry if it was present
    let mut metadata_index = load_metadata_index(&notes_dir);
    if metadata_index.pinned.remove(&filename).is_some() {
        let _ = save_metadata_index(&notes_dir, &metadata_index);
    }
    Ok(())
}

#[tauri::command]
fn empty_trash() -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let trash_dir = get_trash_dir(settings.custom_notes_dir.as_deref());
    let mut metadata_index = load_metadata_index(&notes_dir);

    if let Ok(entries) = fs::read_dir(&trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                metadata_index.pinned.remove(&filename);
                let _ = fs::remove_file(path);
            }
        }
    }
    let _ = save_metadata_index(&notes_dir, &metadata_index);
    Ok(())
}

#[tauri::command]
fn save_image_attachment(
    filename: Option<String>,
    base64_data: String,
) -> Result<String, String> {
    let settings = get_settings();
    let assets_dir = get_assets_dir(settings.custom_notes_dir.as_deref());

    // 1. Separate potential data URI prefix e.g. "data:image/png;base64,"
    let (mime_ext, clean_base64) = if let Some(idx) = base64_data.find(";base64,") {
        let prefix = &base64_data[..idx];
        let data = &base64_data[idx + 8..];
        let ext = if prefix.contains("image/png") {
            "png"
        } else if prefix.contains("image/jpeg") || prefix.contains("image/jpg") {
            "jpg"
        } else if prefix.contains("image/webp") {
            "webp"
        } else if prefix.contains("image/gif") {
            "gif"
        } else if prefix.contains("image/svg") {
            "svg"
        } else if prefix.contains("image/bmp") {
            "bmp"
        } else if prefix.contains("image/x-icon") || prefix.contains("image/vnd.microsoft.icon") {
            "ico"
        } else {
            "png"
        };
        (Some(ext), data.trim())
    } else {
        (None, base64_data.trim())
    };

    // 2. Decode base64 bytes
    let image_bytes = BASE64_STANDARD
        .decode(clean_base64)
        .map_err(|e| format!("Invalid base64 image data: {}", e))?;

    // 3. Determine extension
    let requested_name = filename.as_deref().unwrap_or("").trim();
    let sanitized_basename = Path::new(requested_name)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext = if let Some(dot_idx) = sanitized_basename.rfind('.') {
        let e = sanitized_basename[dot_idx + 1..].to_lowercase();
        match e.as_str() {
            "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "ico" => e,
            _ => mime_ext.unwrap_or("png").to_string(),
        }
    } else {
        mime_ext.unwrap_or("png").to_string()
    };

    // 4. Generate timestamp and random suffix for collision-free uniqueness
    let now = chrono::Local::now();
    let timestamp = now.format("%Y%m%d-%H%M%S").to_string();
    let rand_suffix: u32 = {
        let duration = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default();
        (duration.subsec_nanos() % 0xFFFF) as u32
    };

    let target_filename = if !sanitized_basename.is_empty() && !sanitized_basename.starts_with('.') {
        let stem = if let Some(dot_idx) = sanitized_basename.rfind('.') {
            &sanitized_basename[..dot_idx]
        } else {
            &sanitized_basename
        };
        let clean_stem: String = stem
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
            .take(30)
            .collect();
        format!("{}-{}-{:04x}.{}", clean_stem, timestamp, rand_suffix, ext)
    } else {
        format!("image-{}-{:04x}.{}", timestamp, rand_suffix, ext)
    };

    let target_path = assets_dir.join(&target_filename);
    fs::write(&target_path, image_bytes).map_err(|e| format!("Failed to write image file: {}", e))?;

    Ok(format!("assets/{}", target_filename))
}

#[tauri::command]
fn read_image_attachment(
    relative_path: String,
) -> Result<String, String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());

    // Security check: reject directory traversal attempts
    let trimmed = relative_path.trim().replace('\\', "/");
    if trimmed.contains("..") || trimmed.starts_with('/') {
        return Err("Invalid image path: directory traversal prohibited".to_string());
    }

    let full_path = notes_dir.join(&trimmed);
    if !full_path.exists() || !full_path.is_file() {
        return Err(format!("Image attachment not found: {}", trimmed));
    }

    let bytes = fs::read(&full_path).map_err(|e| format!("Failed to read image: {}", e))?;
    let ext = full_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    };

    let encoded = BASE64_STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
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
fn show_window(window: WebviewWindow, state: tauri::State<AppLaunchState>) -> Result<(), String> {
    // If the application was launched via autostart/silent/hidden,
    // suppress initial window reveal so it starts quietly in the background.
    if state.autostart_silenced.swap(false, Ordering::SeqCst) {
        return Ok(());
    }
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_is_autostart_launch(state: tauri::State<AppLaunchState>) -> bool {
    state.autostart_silenced.load(Ordering::SeqCst) || is_autostart_launch(std::env::args())
}

#[tauri::command]
fn get_launch_file(state: tauri::State<AppLaunchState>) -> Option<String> {
    if let Ok(mut lock) = state.launch_file.lock() {
        lock.take()
    } else {
        None
    }
}

#[tauri::command]
fn reveal_in_explorer(filename: Option<String>) -> Result<(), String> {
    let settings = get_settings();
    let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
    let _ = fs::create_dir_all(&notes_dir);
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
fn save_window_state(window: WebviewWindow) -> Result<(), String> {
    if let (Ok(pos), Ok(size)) = (window.outer_position(), window.inner_size()) {
        let scale = window.scale_factor().unwrap_or(1.0);
        let logical_pos = pos.to_logical::<i32>(scale);
        let logical_size = size.to_logical::<f64>(scale);
        if logical_size.width >= 300.0 && logical_size.height >= 300.0 && logical_pos.x > -10000 && logical_pos.y > -10000 {
            let mut s = get_settings();
            s.window_x = Some(logical_pos.x);
            s.window_y = Some(logical_pos.y);
            s.window_width = Some(logical_size.width);
            s.window_height = Some(logical_size.height);
            let _ = save_settings(s);
        }
    }
    Ok(())
}

#[tauri::command]
fn update_global_shortcut(app: tauri::AppHandle, new_shortcut_str: String) -> Result<String, String> {
    let trimmed = new_shortcut_str.trim();
    if trimmed.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    let new_shortcut = trimmed.parse::<Shortcut>().map_err(|e| format!("Invalid shortcut format: {}", e))?;
    
    let mut settings = get_settings();
    let old_shortcut_str = settings.global_shortcut.as_deref().unwrap_or("Ctrl+Space").to_string();

    if old_shortcut_str == trimmed && app.global_shortcut().is_registered(new_shortcut.clone()) {
        return Ok(trimmed.to_string());
    }

    let old_shortcut = old_shortcut_str.parse::<Shortcut>().ok();

    // Safely replace shortcut: unregister old first
    if let Some(ref old) = old_shortcut {
        let _ = app.global_shortcut().unregister(old.clone());
    }

    let app_handle = app.clone();
    let reg_result = app.global_shortcut().on_shortcut(new_shortcut.clone(), move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            toggle_main_window(&app_handle);
        }
    });

    match reg_result {
        Ok(_) => {
            settings.global_shortcut = Some(trimmed.to_string());
            let _ = save_settings(settings);
            Ok(trimmed.to_string())
        }
        Err(err) => {
            // Restore previous shortcut
            if let Some(old) = old_shortcut {
                let app_handle_restore = app.clone();
                let _ = app.global_shortcut().on_shortcut(old, move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(&app_handle_restore);
                    }
                });
            }
            Err(format!("Failed to register shortcut '{}': {}", trimmed, err))
        }
    }
}

#[tauri::command]
fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().enable().map_err(|e| e.to_string())
}

#[tauri::command]
fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().disable().map_err(|e| e.to_string())
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

pub fn is_autostart_launch<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().any(|arg| {
        let a = arg.as_ref();
        a == "--autostart" || a == "--silent" || a == "--hidden"
    })
}

pub fn find_launch_file_in_args<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    for arg in args.into_iter().skip(1) {
        let a = arg.as_ref();
        if !a.starts_with('-') && !a.starts_with('/') {
            let path = PathBuf::from(a);
            if path.is_file() {
                return Some(a.to_string());
            }
        }
    }
    None
}

pub fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppLaunchState>() {
        state.autostart_silenced.store(false, Ordering::SeqCst);
    }
    if let Some(win) = app.get_webview_window("main") {
        let is_visible = win.is_visible().unwrap_or(false);
        let is_minimized = win.is_minimized().unwrap_or(false);
        let is_focused = win.is_focused().unwrap_or(false);

        if is_visible && !is_minimized && is_focused {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let is_autostart = is_autostart_launch(&args);
    let initial_launch_file = find_launch_file_in_args(&args);
    let should_silence = is_autostart && initial_launch_file.is_none();

    tauri::Builder::default()
        .manage(AppLaunchState {
            autostart_silenced: AtomicBool::new(should_silence),
            launch_file: std::sync::Mutex::new(initial_launch_file),
        })
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(state) = app.try_state::<AppLaunchState>() {
                state.autostart_silenced.store(false, Ordering::SeqCst);
            }
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            if let Some(file_path) = find_launch_file_in_args(&args) {
                let _ = app.emit("open-external-file", file_path);
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_notes_directory,
            list_notes,
            read_note,
            save_note,
            open_external_note,
            untrack_external_note,
            set_note_pinned,
            delete_note,
            list_trashed_notes,
            restore_note,
            permanently_delete_note,
            empty_trash,
            save_image_attachment,
            read_image_attachment,
            set_window_always_on_top,
            minimize_window,
            close_window,
            reveal_in_explorer,
            save_window_state,
            update_global_shortcut,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            get_is_autostart_launch,
            get_launch_file,
            show_window
        ])
        .setup(|app| {
            let is_autostart = is_autostart_launch(std::env::args());

            // Restore window size and position from settings
            let settings = get_settings();
            if let Some(win) = app.get_webview_window("main") {
                if let (Some(w), Some(h)) = (settings.window_width, settings.window_height) {
                    if w >= 300.0 && h >= 300.0 {
                        let _ = win.set_size(LogicalSize::new(w, h));
                    }
                }

                let mut position_restored = false;
                if let (Some(x), Some(y)) = (settings.window_x, settings.window_y) {
                    // Only restore if valid on-screen coordinate
                    if x > -10000 && y > -10000 {
                        let is_on_screen = if let Ok(monitors) = win.available_monitors() {
                            if monitors.is_empty() {
                                true
                            } else {
                                monitors.iter().any(|m| {
                                    let pos = m.position();
                                    let size = m.size();
                                    let scale = m.scale_factor();
                                    let logical_x = (pos.x as f64 / scale) as i32;
                                    let logical_y = (pos.y as f64 / scale) as i32;
                                    let logical_w = (size.width as f64 / scale) as i32;
                                    let logical_h = (size.height as f64 / scale) as i32;
                                    x >= logical_x - 100 && x < logical_x + logical_w && y >= logical_y - 50 && y < logical_y + logical_h
                                })
                            }
                        } else {
                            true
                        };

                        if is_on_screen {
                            let _ = win.set_position(LogicalPosition::new(x, y));
                            position_restored = true;
                        }
                    }
                }

                if !position_restored {
                    let _ = win.center();
                }

                // Restore persisted always-on-top state before making window visible
                if settings.always_on_top {
                    let _ = win.set_always_on_top(true);
                }

                // Window visibility & smooth launch:
                // Window starts hidden (visible: false in tauri.conf.json) so position and size
                // restoration happen off-screen without any jump or flicker.
                if is_autostart {
                    let _ = win.hide();
                } else {
                    // Reveal smoothly via frontend after first paint (show_window command).
                    // As a failsafe, reveal after 1200ms if frontend has not already done so.
                    let win_safety = win.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1200));
                        if !win_safety.is_visible().unwrap_or(false) {
                            let _ = win_safety.show();
                            let _ = win_safety.unminimize();
                            let _ = win_safety.set_focus();
                        }
                    });
                }

                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    match event {
                        WindowEvent::Moved(pos) => {
                            let scale = win_clone.scale_factor().unwrap_or(1.0);
                            let logical_pos = pos.to_logical::<i32>(scale);
                            // Only save valid normal window positions, ignore minimized coordinates (-32000)
                            if logical_pos.x > -10000 && logical_pos.y > -10000 {
                                let mut s = get_settings();
                                s.window_x = Some(logical_pos.x);
                                s.window_y = Some(logical_pos.y);
                                let _ = save_settings(s);
                            }
                        }
                        WindowEvent::Resized(size) => {
                            let scale = win_clone.scale_factor().unwrap_or(1.0);
                            let logical_size = size.to_logical::<f64>(scale);
                            if logical_size.width >= 300.0 && logical_size.height >= 300.0 {
                                let mut s = get_settings();
                                s.window_width = Some(logical_size.width);
                                s.window_height = Some(logical_size.height);
                                let _ = save_settings(s);
                            }
                        }
                        _ => {}
                    }
                });
            }

            // Initial seed note if empty
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

            // Register OS-level global shortcut for window toggle.
            //
            // IMPORTANT: We defer registration to a separate thread that waits briefly for
            // the Windows message loop to be fully running. This is necessary because F13-F24
            // (extended virtual keys VK_F13-VK_F24) registered via RegisterHotKey before the
            // event loop is pumped may silently succeed but never fire on Windows.
            // All standard keys (letters, F1-F12, Ctrl+Space, etc.) are also safer this way.
            let shortcut_str = settings
                .global_shortcut
                .as_deref()
                .unwrap_or("Ctrl+Space")
                .to_string();

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                // Give the Tauri window event loop time to start its message pump.
                std::thread::sleep(std::time::Duration::from_millis(500));

                match shortcut_str.parse::<Shortcut>() {
                    Ok(shortcut) => {
                        let app_handle_cb = app_handle.clone();
                        if let Err(e) = app_handle.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                toggle_main_window(&app_handle_cb);
                            }
                        }) {
                            // Registration failed. Do NOT silently fall back to a different
                            // shortcut - that creates a split-brain state where the UI shows
                            // one shortcut but the OS listens to another. Log it clearly.
                            eprintln!(
                                "[Kenote] Failed to register global shortcut '{}': {}. \
                                No fallback registered - open Settings to choose a different shortcut.",
                                shortcut_str, e
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "[Kenote] Saved global shortcut '{}' is not a valid accelerator: {}. \
                            Open Settings to reset it.",
                            shortcut_str, e
                        );
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_index_serialization() {
        let mut index = NotesMetadataIndex::default();
        index.pinned.insert("note_123.md".to_string(), true);
        index.pinned.insert("note_456.md".to_string(), false);

        let json = serde_json::to_string(&index).expect("Should serialize");
        let deserialized: NotesMetadataIndex =
            serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.pinned.get("note_123.md"), Some(&true));
        assert_eq!(deserialized.pinned.get("note_456.md"), Some(&false));
    }

    #[test]
    fn test_is_note_pinned_logic() {
        let mut index = NotesMetadataIndex::default();
        index.pinned.insert("note_explicit_pinned.md".to_string(), true);
        index.pinned.insert("note_explicit_unpinned.md".to_string(), false);
        index.pinned.insert("pin_legacy_unpinned.md".to_string(), false);

        // Explicit index entries take precedence (even over legacy pin_ filename prefix)
        assert!(is_note_pinned("note_explicit_pinned.md", &index));
        assert!(!is_note_pinned("note_explicit_unpinned.md", &index));
        assert!(!is_note_pinned("pin_legacy_unpinned.md", &index));

        // Legacy filename fallback only for notes without explicit index entry
        assert!(is_note_pinned("pin_note_legacy.md", &index));
        assert!(!is_note_pinned("note_normal.md", &index));
    }

    #[test]
    fn test_save_and_load_metadata_index() {
        let temp_dir = std::env::temp_dir().join(format!("kenote_test_{}", chrono::Local::now().timestamp_nanos_opt().unwrap_or(0)));
        let _ = fs::create_dir_all(&temp_dir);

        let mut index = NotesMetadataIndex::default();
        index.pinned.insert("note_alpha.md".to_string(), true);

        assert!(save_metadata_index(&temp_dir, &index).is_ok());

        let loaded = load_metadata_index(&temp_dir);
        assert_eq!(loaded.pinned.get("note_alpha.md"), Some(&true));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_extract_title_from_content() {
        assert_eq!(extract_title_from_content("# My Title\nBody text"), "My Title");
        assert_eq!(extract_title_from_content("### Nested Heading\nMore"), "Nested Heading");
        assert_eq!(extract_title_from_content("Plain text first line"), "Plain text first line");
        assert_eq!(extract_title_from_content("\nThis is body content."), "Untitled");
        assert_eq!(extract_title_from_content(""), "Untitled");
        assert_eq!(extract_title_from_content("   \n\n  "), "Untitled");
    }

    #[test]
    fn test_settings_merging_preserves_window_bounds() {
        let existing = AppSettings {
            window_x: Some(450),
            window_y: Some(250),
            window_width: Some(600.0),
            window_height: Some(800.0),
            ..AppSettings::default()
        };

        let mut incoming = AppSettings {
            last_active_note_id: Some("note_123".to_string()),
            window_x: None,
            window_y: None,
            window_width: None,
            window_height: None,
            ..AppSettings::default()
        };

        // Simulated merge logic
        if incoming.window_x.is_none() {
            incoming.window_x = existing.window_x;
        }
        if incoming.window_y.is_none() {
            incoming.window_y = existing.window_y;
        }
        if incoming.window_width.is_none() {
            incoming.window_width = existing.window_width;
        }
        if incoming.window_height.is_none() {
            incoming.window_height = existing.window_height;
        }

        assert_eq!(incoming.window_x, Some(450));
        assert_eq!(incoming.window_y, Some(250));
        assert_eq!(incoming.window_width, Some(600.0));
        assert_eq!(incoming.window_height, Some(800.0));
        assert_eq!(incoming.last_active_note_id, Some("note_123".to_string()));
    }

    #[test]
    fn test_get_resolved_notes_dir_resolution_and_fallback() {
        let default_dir = get_resolved_notes_dir(None);
        assert!(default_dir.ends_with("notes"));

        // Fallback on whitespace or empty strings
        assert_eq!(get_resolved_notes_dir(Some("")), default_dir);
        assert_eq!(get_resolved_notes_dir(Some("   ")), default_dir);

        // Valid custom directory resolution
        let temp_custom = std::env::temp_dir().join(format!("kenote_test_custom_dir_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let resolved = get_resolved_notes_dir(Some(temp_custom.to_str().unwrap()));
        assert_eq!(resolved, temp_custom);
        assert!(temp_custom.is_dir());

        let _ = fs::remove_dir_all(&temp_custom);
    }

    #[test]
    fn test_always_on_top_settings_serialization() {
        let settings = AppSettings {
            always_on_top: true,
            ..AppSettings::default()
        };
        let json = serde_json::to_string(&settings).expect("Should serialize");
        let deserialized: AppSettings = serde_json::from_str(&json).expect("Should deserialize");
        assert!(deserialized.always_on_top);

        let default_settings = AppSettings::default();
        assert!(!default_settings.always_on_top);
    }

    #[test]
    fn test_zoom_and_shortcut_settings_serialization() {
        // Test defaults
        let default_settings = AppSettings::default();
        assert_eq!(default_settings.global_zoom, Some(100));
        assert_eq!(default_settings.editor_zoom, Some(100));
        assert_eq!(default_settings.global_shortcut, Some("Ctrl+Space".to_string()));

        // Test custom values serialization & deserialization
        let custom = AppSettings {
            global_zoom: Some(125),
            editor_zoom: Some(150),
            global_shortcut: Some("Ctrl+Shift+N".to_string()),
            ..AppSettings::default()
        };
        let json = serde_json::to_string(&custom).expect("Should serialize");
        let deserialized: AppSettings = serde_json::from_str(&json).expect("Should deserialize");
        assert_eq!(deserialized.global_zoom, Some(125));
        assert_eq!(deserialized.editor_zoom, Some(150));
        assert_eq!(deserialized.global_shortcut, Some("Ctrl+Shift+N".to_string()));

        // Backwards compatibility: deserialize older json missing zoom fields
        let legacy_json = r##"{
            "accent_color": "#0399F7",
            "font_size": "15px",
            "font_family": "system-ui",
            "line_height": "1.6",
            "auto_save_interval": 500,
            "always_on_top": false,
            "has_completed_onboarding": true
        }"##;
        let from_legacy: AppSettings = serde_json::from_str(legacy_json).expect("Should deserialize legacy JSON");
        assert_eq!(from_legacy.global_zoom, Some(100));
        assert_eq!(from_legacy.editor_zoom, Some(100));
        assert_eq!(from_legacy.global_shortcut, Some("Ctrl+Space".to_string()));
    }

    #[test]
    fn test_global_shortcut_parsing() {
        assert!("Alt+Shift+K".parse::<Shortcut>().is_ok());
        assert!("Ctrl+Space".parse::<Shortcut>().is_ok());
        assert!("Super+Shift+K".parse::<Shortcut>().is_ok());
        assert!("Ctrl+Alt+A".parse::<Shortcut>().is_ok());
        assert!("Ctrl+Alt+F13".parse::<Shortcut>().is_ok());
        assert!("".parse::<Shortcut>().is_err());
        assert!("InvalidKeyCombinationName".parse::<Shortcut>().is_err());
    }

    #[test]
    fn test_app_launch_state_autostart_silencing() {
        let state = AppLaunchState {
            autostart_silenced: AtomicBool::new(true),
        };
        assert!(state.autostart_silenced.load(Ordering::SeqCst));
        assert!(state.autostart_silenced.swap(false, Ordering::SeqCst));
        assert!(!state.autostart_silenced.swap(false, Ordering::SeqCst));
    }

    #[test]
    fn test_is_autostart_launch() {
        assert!(is_autostart_launch(vec!["kenote.exe", "--autostart"]));
        assert!(is_autostart_launch(vec!["kenote.exe", "--silent"]));
        assert!(is_autostart_launch(vec!["kenote.exe", "--hidden"]));
        assert!(is_autostart_launch(vec!["kenote.exe", "-a", "--autostart"]));
        assert!(!is_autostart_launch(vec!["kenote.exe"]));
        assert!(!is_autostart_launch(vec!["kenote.exe", "--normal"]));
        assert!(!is_autostart_launch(Vec::<String>::new()));
    }

    #[test]
    fn test_image_attachment_handling() {
        let sample_data = BASE64_STANDARD.encode(b"fake png image bytes");
        let sample_data_uri = format!("data:image/png;base64,{}", sample_data);

        let saved_rel = save_image_attachment(Some("diagram.png".to_string()), sample_data_uri).expect("Should save image");
        assert!(saved_rel.starts_with("assets/"));
        assert!(saved_rel.ends_with(".png"));
        assert!(saved_rel.contains("diagram-"));

        let read_result = read_image_attachment(saved_rel.clone());
        assert!(read_result.is_ok());
        let data_url = read_result.unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));

        // Clean up written test asset
        let settings = get_settings();
        let notes_dir = get_resolved_notes_dir(settings.custom_notes_dir.as_deref());
        let full_path = notes_dir.join(&saved_rel);
        let _ = fs::remove_file(full_path);
    }

    #[test]
    fn test_read_image_attachment_traversal_protection() {
        assert!(read_image_attachment("../secret.txt".to_string()).is_err());
        assert!(read_image_attachment("..\\secret.txt".to_string()).is_err());
        assert!(read_image_attachment("/etc/passwd".to_string()).is_err());
        assert!(read_image_attachment("assets/../../etc/passwd".to_string()).is_err());
    }

    #[test]
    fn test_extract_tags_from_content() {
        let content = r#"# Meeting Notes #work
Here are the action items:
- Review budget #finance/q1
- Call client #client-acme
- Ignore `inline #notatag` and #123 (issue number)
- Check https://example.com/#anchor
- Also (#parenthesized) and [#bracketed]
- Duplicate #WORK and #work should be deduplicated

```rust
// In code block:
#notataginblock
```

Final thought #ideas."#;

        let tags = extract_tags_from_content(content);
        assert_eq!(
            tags,
            vec![
                "work",
                "finance/q1",
                "client-acme",
                "parenthesized",
                "bracketed",
                "ideas"
            ]
        );
    }
}


