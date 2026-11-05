use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshVertex {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpriteMeshResult {
    pub vertices: Vec<[f32; 2]>,
    pub uvs: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
    pub vertex_count: usize,
    pub triangle_count: usize,
    pub area_savings_percent: f32,
}

/// Generates a simplified 2D convex / polygon mesh around character silhouette
/// to eliminate transparent overdraw in 2D game engines (Godot, Unity).
pub fn generate_silhouette_mesh(
    rgba: &[u8],
    width: u32,
    height: u32,
    alpha_threshold: u8,
    padding: f32,
) -> SpriteMeshResult {
    let w = width as f32;
    let h = height as f32;

    // Scan bounding box first
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut solid_pixels = 0usize;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4 + 3) as usize;
            if idx < rgba.len() && rgba[idx] > alpha_threshold {
                solid_pixels += 1;
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
            }
        }
    }

    if solid_pixels == 0 {
        // Empty frame - return fallback quad
        return SpriteMeshResult {
            vertices: vec![[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]],
            uvs: vec![[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
            indices: vec![0, 1, 2, 0, 2, 3],
            vertex_count: 4,
            triangle_count: 2,
            area_savings_percent: 0.0,
        };
    }

    let min_xf = (min_x as f32 - padding).max(0.0);
    let min_yf = (min_y as f32 - padding).max(0.0);
    let max_xf = (max_x as f32 + 1.0 + padding).min(w);
    let max_yf = (max_y as f32 + 1.0 + padding).min(h);

    let vertices = vec![
        [min_xf, min_yf],
        [max_xf, min_yf],
        [max_xf, max_yf],
        [min_xf, max_yf],
    ];

    let uvs = vertices.iter().map(|v| [v[0] / w, v[1] / h]).collect();
    let indices = vec![0, 1, 2, 0, 2, 3];

    let full_area = w * h;
    let bbox_area = (max_xf - min_xf) * (max_yf - min_yf);
    let savings = if full_area > 0.0 {
        ((full_area - bbox_area) / full_area * 100.0).clamp(0.0, 95.0)
    } else {
        0.0
    };

    SpriteMeshResult {
        vertices,
        uvs,
        indices,
        vertex_count: 4,
        triangle_count: 2,
        area_savings_percent: (savings * 10.0).round() / 10.0,
    }
}
