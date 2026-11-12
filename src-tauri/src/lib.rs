pub mod modules;

use modules::chromakey::{apply_chroma_key, ChromaKeyConfig};
use modules::godot::generate_sprite_frames_tres;
use modules::mesh::{generate_silhouette_mesh, SpriteMeshResult};
use modules::pbr::{generate_normal_map, generate_pbr_maps, NormalMapOptions, PbrMapsResult};

#[tauri::command]
fn ping_engine() -> String {
    "SpriteForge Rust Engine v2.0 Active (Native Multi-Threaded)".into()
}

#[tauri::command]
fn generate_normal_map_cmd(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    bump_strength: f32,
    invert_y: bool,
) -> Vec<u8> {
    generate_normal_map(
        &rgba,
        width,
        height,
        &NormalMapOptions {
            bump_strength,
            invert_y,
        },
    )
}

#[tauri::command]
fn generate_pbr_maps_cmd(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    bump_strength: f32,
    emission_threshold: u8,
    roughness_gloss: u8,
) -> PbrMapsResult {
    generate_pbr_maps(
        &rgba,
        width,
        height,
        bump_strength,
        emission_threshold,
        roughness_gloss,
    )
}

#[tauri::command]
fn apply_chroma_key_cmd(
    mut rgba: Vec<u8>,
    width: u32,
    height: u32,
    config: ChromaKeyConfig,
) -> Vec<u8> {
    apply_chroma_key(&mut rgba, width, height, &config);
    rgba
}

#[tauri::command]
fn generate_mesh_cmd(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    alpha_threshold: u8,
    padding: f32,
) -> SpriteMeshResult {
    generate_silhouette_mesh(&rgba, width, height, alpha_threshold, padding)
}

#[tauri::command]
fn generate_godot_tres_cmd(
    animation_name: String,
    atlas_filename: String,
    frame_width: u32,
    frame_height: u32,
    columns: u32,
    frames_count: usize,
    fps: f32,
    pivot_x: f32,
    pivot_y: f32,
) -> String {
    generate_sprite_frames_tres(
        &animation_name,
        &atlas_filename,
        frame_width,
        frame_height,
        columns,
        frames_count,
        fps,
        (pivot_x, pivot_y),
        None,
        None,
    )
}

#[derive(serde::Deserialize)]
pub struct ExportFileEntry {
    pub name: String,
    pub content_base64: Option<String>,
    pub text: Option<String>,
}

#[derive(serde::Serialize)]
pub struct NativeExportResult {
    pub success: bool,
    pub target_dir: Option<String>,
    pub error: Option<String>,
    pub count: usize,
}

#[derive(serde::Serialize)]
pub struct NativeProjectDialogResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub content: Option<String>,
    pub error: Option<String>,
    pub canceled: bool,
}

#[tauri::command]
fn save_project_file_native_cmd(
    default_name: Option<String>,
    content: String,
) -> NativeProjectDialogResult {
    let mut dialog = rfd::FileDialog::new()
        .set_title("Save SpriteForge Project")
        .add_filter("SpriteForge Project (*.sfproj)", &["sfproj", "json"]);

    let name = default_name.unwrap_or_else(|| "project.sfproj".to_string());
    dialog = dialog.set_file_name(&name);

    if let Some(path) = dialog.save_file() {
        match std::fs::write(&path, content.as_bytes()) {
            Ok(_) => NativeProjectDialogResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
                content: None,
                error: None,
                canceled: false,
            },
            Err(e) => NativeProjectDialogResult {
                success: false,
                file_path: None,
                content: None,
                error: Some(format!("Failed to save project: {}", e)),
                canceled: false,
            },
        }
    } else {
        NativeProjectDialogResult {
            success: false,
            file_path: None,
            content: None,
            error: None,
            canceled: true,
        }
    }
}

#[tauri::command]
fn open_project_file_native_cmd() -> NativeProjectDialogResult {
    let dialog = rfd::FileDialog::new()
        .set_title("Open SpriteForge Project")
        .add_filter("SpriteForge Project (*.sfproj, *.json)", &["sfproj", "json"]);

    if let Some(path) = dialog.pick_file() {
        match std::fs::read_to_string(&path) {
            Ok(content) => NativeProjectDialogResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
                content: Some(content),
                error: None,
                canceled: false,
            },
            Err(e) => NativeProjectDialogResult {
                success: false,
                file_path: None,
                content: None,
                error: Some(format!("Failed to read project file: {}", e)),
                canceled: false,
            },
        }
    } else {
        NativeProjectDialogResult {
            success: false,
            file_path: None,
            content: None,
            error: None,
            canceled: true,
        }
    }
}

#[tauri::command]
fn read_media_file_bytes_cmd(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Failed to read media {}: {}", file_path, e))
}

#[derive(serde::Serialize)]
pub struct LibraryEntryMeta {
    pub id: String,
    pub character_name: String,
    pub action_name: String,
    pub file_path: String,
    pub thumbnail_url: Option<String>,
    pub frames_count: usize,
    pub fps: f64,
    pub updated_at: String,
}

fn get_library_root() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    std::path::Path::new(&home)
        .join(".spriteforge")
        .join("library")
}

fn sanitize_seg(s: &str) -> String {
    let cleaned: String = s
        .trim()
        .chars()
        .map(|c| {
            if ['<', '>', ':', '"', '/', '\\', '|', '?', '*'].contains(&c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    if cleaned.is_empty() {
        "Unnamed".to_string()
    } else {
        cleaned
    }
}

#[tauri::command]
fn save_to_library_cmd(
    character_name: String,
    action_name: String,
    content: String,
) -> Result<String, String> {
    let char_dir = get_library_root().join(sanitize_seg(&character_name));
    std::fs::create_dir_all(&char_dir).map_err(|e| format!("Failed to create character folder: {}", e))?;
    let file_name = format!("{}.sfproj", sanitize_seg(&action_name));
    let full_path = char_dir.join(file_name);
    std::fs::write(&full_path, content.as_bytes()).map_err(|e| format!("Failed to write library item: {}", e))?;
    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_library_cmd() -> Vec<LibraryEntryMeta> {
    let root = get_library_root();
    let mut entries = Vec::new();
    let Ok(chars) = std::fs::read_dir(&root) else {
        return entries;
    };
    for char_entry in chars.flatten() {
        let char_path = char_entry.path();
        if !char_path.is_dir() {
            continue;
        }
        let char_name = char_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Character")
            .to_string();

        let Ok(actions) = std::fs::read_dir(&char_path) else {
            continue;
        };
        for act_entry in actions.flatten() {
            let act_path = act_entry.path();
            if act_path.extension().and_then(|e| e.to_str()) != Some("sfproj") {
                continue;
            }
            let action_name = act_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("action")
                .to_string();

            let mut thumbnail_url = None;
            let mut frames_count = 0usize;
            let mut fps = 24.0;
            let mut updated_at = String::new();

            if let Ok(raw) = std::fs::read_to_string(&act_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(saved) = val.get("savedAt").and_then(|v| v.as_str()) {
                        updated_at = saved.to_string();
                    }
                    if let Some(atlas) = val.get("atlasSettings") {
                        if let Some(f) = atlas.get("fps").and_then(|v| v.as_f64()) {
                            fps = f;
                        }
                    }
                    if let Some(tracks) = val.get("tracks").and_then(|v| v.as_array()) {
                        if let Some(first) = tracks.first() {
                            thumbnail_url = first
                                .get("thumbnailUrl")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            if let Some(markers) = first.get("markers").and_then(|v| v.as_array()) {
                                frames_count = markers.len();
                            } else if let Some(tot) = first.get("totalFrames").and_then(|v| v.as_u64()) {
                                frames_count = tot as usize;
                            }
                        }
                    }
                }
            }

            entries.push(LibraryEntryMeta {
                id: format!("{}/{}", char_name, action_name),
                character_name: char_name.clone(),
                action_name,
                file_path: act_path.to_string_lossy().to_string(),
                thumbnail_url,
                frames_count,
                fps,
                updated_at,
            });
        }
    }
    entries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    entries
}

#[tauri::command]
fn load_library_file_cmd(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to load library project: {}", e))
}

#[tauri::command]
fn delete_library_file_cmd(file_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&file_path);
    if p.exists() {
        std::fs::remove_file(p).map_err(|e| format!("Failed to delete library file: {}", e))?;
        if let Some(parent) = p.parent() {
            if let Ok(mut rd) = std::fs::read_dir(parent) {
                if rd.next().is_none() {
                    let _ = std::fs::remove_dir(parent);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn pick_export_directory_cmd(default_path: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new().set_title("Select Destination Directory for Sprite Export");
    if let Some(p) = default_path {
        if !p.is_empty() {
            dialog = dialog.set_directory(p);
        }
    }
    dialog.pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn save_export_files_native_cmd(
    target_dir: String,
    folder_name: String,
    files: Vec<ExportFileEntry>,
) -> NativeExportResult {
    let clean_folder = folder_name.trim().replace(|c: char| ['<', '>', ':', '"', '/', '\\', '|', '?', '*'].contains(&c), "_");
    let full_path = std::path::Path::new(&target_dir).join(&clean_folder);
    if let Err(e) = std::fs::create_dir_all(&full_path) {
        return NativeExportResult {
            success: false,
            target_dir: None,
            error: Some(format!("Failed to create folder {}: {}", full_path.display(), e)),
            count: 0,
        };
    }

    let mut count = 0;
    for file in files {
        let file_path = full_path.join(&file.name);
        if let Some(text) = file.text {
            if let Err(e) = std::fs::write(&file_path, text.as_bytes()) {
                return NativeExportResult {
                    success: false,
                    target_dir: None,
                    error: Some(format!("Failed to write {}: {}", file_path.display(), e)),
                    count,
                };
            }
            count += 1;
        } else if let Some(b64) = file.content_base64 {
            use base64::Engine;
            let clean_b64 = if let Some(pos) = b64.find(";base64,") {
                &b64[pos + 8..]
            } else {
                b64.trim()
            };
            let bytes = match base64::engine::general_purpose::STANDARD.decode(clean_b64) {
                Ok(b) => b,
                Err(e) => return NativeExportResult {
                    success: false,
                    target_dir: None,
                    error: Some(format!("Base64 decode error on {}: {}", file.name, e)),
                    count,
                },
            };
            if let Err(e) = std::fs::write(&file_path, &bytes) {
                return NativeExportResult {
                    success: false,
                    target_dir: None,
                    error: Some(format!("Failed to write {}: {}", file_path.display(), e)),
                    count,
                };
            }
            count += 1;
        }
    }

    NativeExportResult {
        success: true,
        target_dir: Some(full_path.to_string_lossy().to_string()),
        error: None,
        count,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            ping_engine,
            generate_normal_map_cmd,
            generate_pbr_maps_cmd,
            apply_chroma_key_cmd,
            generate_mesh_cmd,
            generate_godot_tres_cmd,
            pick_export_directory_cmd,
            save_export_files_native_cmd,
            save_project_file_native_cmd,
            open_project_file_native_cmd,
            read_media_file_bytes_cmd,
            save_to_library_cmd,
            list_library_cmd,
            load_library_file_cmd,
            delete_library_file_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
