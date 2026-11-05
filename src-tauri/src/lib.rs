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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ping_engine,
            generate_normal_map_cmd,
            generate_pbr_maps_cmd,
            apply_chroma_key_cmd,
            generate_mesh_cmd,
            generate_godot_tres_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
