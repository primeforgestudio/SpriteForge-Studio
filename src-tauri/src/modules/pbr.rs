use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalMapOptions {
    pub bump_strength: f32, // default 2.5
    pub invert_y: bool,      // default false
}

/// Generates a tangent-space 2D normal map from RGBA diffuse buffer.
/// Encodes normal vectors into RGB [0..255] with preserved alpha channel.
pub fn generate_normal_map(
    src: &[u8],
    width: u32,
    height: u32,
    options: &NormalMapOptions,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let total_pixels = w * h;
    let mut out = vec![0u8; total_pixels * 4];

    // 1. Build height map combining luminance and alpha contour
    let mut height_map = vec![0.0f32; total_pixels];
    for i in 0..total_pixels {
        let idx = i * 4;
        let a = src[idx + 3] as f32 / 255.0;
        if a <= 0.02 {
            height_map[i] = 0.0;
        } else {
            let lum = (src[idx] as f32 * 0.299
                + src[idx + 1] as f32 * 0.587
                + src[idx + 2] as f32 * 0.114)
                / 255.0;
            height_map[i] = lum * 0.6 + a * 0.4;
        }
    }

    // 2. Sobel convolution
    let strength = options.bump_strength.clamp(0.5, 10.0);
    let y_mult = if options.invert_y { -1.0 } else { 1.0 };

    for y in 0..h {
        let y_prev = if y == 0 { 0 } else { y - 1 };
        let y_next = (y + 1).min(h - 1);

        for x in 0..w {
            let x_prev = if x == 0 { 0 } else { x - 1 };
            let x_next = (x + 1).min(w - 1);

            let center_idx = (y * w + x) * 4;
            let alpha = src[center_idx + 3];

            if alpha <= 5 {
                out[center_idx] = 128;
                out[center_idx + 1] = 128;
                out[center_idx + 2] = 255;
                out[center_idx + 3] = 0;
                continue;
            }

            let tl = height_map[y_prev * w + x_prev];
            let tc = height_map[y_prev * w + x];
            let tr = height_map[y_prev * w + x_next];
            let ml = height_map[y * w + x_prev];
            let mr = height_map[y * w + x_next];
            let bl = height_map[y_next * w + x_prev];
            let bc = height_map[y_next * w + x];
            let br = height_map[y_next * w + x_next];

            let dx = tr + 2.0 * mr + br - (tl + 2.0 * ml + bl);
            let dy = (bl + 2.0 * bc + br - (tl + 2.0 * tc + tr)) * y_mult;

            let nx = -dx * strength;
            let ny = -dy * strength;
            let nz = 1.0f32;

            let len = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-6);
            let norm_x = nx / len;
            let norm_y = ny / len;
            let norm_z = nz / len;

            out[center_idx] = ((norm_x * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            out[center_idx + 1] = ((norm_y * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            out[center_idx + 2] = ((norm_z * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            out[center_idx + 3] = alpha;
        }
    }

    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PbrMapsResult {
    pub normal_rgba: Vec<u8>,
    pub roughness_rgba: Vec<u8>,
    pub emission_rgba: Vec<u8>,
}

/// Generates full 2D PBR pack (Normal, Roughness, Emission)
pub fn generate_pbr_maps(
    src: &[u8],
    width: u32,
    height: u32,
    bump_strength: f32,
    emission_threshold: u8,
    roughness_gloss: u8,
) -> PbrMapsResult {
    let w = width as usize;
    let h = height as usize;
    let total = w * h;

    let normal_rgba = generate_normal_map(
        src,
        width,
        height,
        &NormalMapOptions {
            bump_strength,
            invert_y: false,
        },
    );

    let mut roughness_rgba = vec![0u8; total * 4];
    let mut emission_rgba = vec![0u8; total * 4];

    let base_roughness = (100 - roughness_gloss.min(100)) as f32 / 100.0;

    for i in 0..total {
        let idx = i * 4;
        let alpha = src[idx + 3];

        if alpha <= 5 {
            continue;
        }

        let r = src[idx];
        let g = src[idx + 1];
        let b = src[idx + 2];
        let lum = (r as f32 * 0.299 + g as f32 * 0.587 + b as f32 * 0.114) / 255.0;

        // Roughness: high luminance is glossier
        let rough_val = ((1.0 - lum * 0.4) * base_roughness * 255.0).clamp(0.0, 255.0) as u8;
        roughness_rgba[idx] = rough_val;
        roughness_rgba[idx + 1] = rough_val;
        roughness_rgba[idx + 2] = rough_val;
        roughness_rgba[idx + 3] = alpha;

        // Emission: pixels brighter than emission_threshold
        let max_channel = r.max(g).max(b);
        if max_channel >= emission_threshold {
            emission_rgba[idx] = r;
            emission_rgba[idx + 1] = g;
            emission_rgba[idx + 2] = b;
            emission_rgba[idx + 3] = alpha;
        } else {
            emission_rgba[idx + 3] = 0;
        }
    }

    PbrMapsResult {
        normal_rgba,
        roughness_rgba,
        emission_rgba,
    }
}
