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
            read_media_file_bytes_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
