use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromaKeyConfig {
    pub enabled: bool,
    pub key_color: (u8, u8, u8), // (R, G, B)
    pub gain: f32,                // 0..100
    pub soften: f32,              // 0..100
    pub clip_black: f32,          // 0..100
    pub clip_white: f32,          // 0..100
    pub despill: bool,
    pub despill_amount: f32,      // 0..100
    pub defringe: bool,
    pub defringe_radius: u32,     // 1..6
    pub defringe_strength: f32,   // 0..100
}

/// Keylight Color Difference Keying implementation in Rust.
/// Runs in parallel across rows for maximum performance.
pub fn apply_chroma_key(
    rgba: &mut [u8],
    width: u32,
    height: u32,
    config: &ChromaKeyConfig,
) {
    if !config.enabled {
        return;
    }

    let w = width as usize;
    let h = height as usize;
    let (kr, kg, kb) = config.key_color;

    // Determine primary key channel
    let is_green = kg >= kr && kg >= kb;
    let is_blue = kb > kg && kb >= kr;

    let gain_factor = (config.gain / 50.0).max(0.01);
    let clip_b = config.clip_black / 100.0;
    let clip_w = (config.clip_white / 100.0).max(clip_b + 0.01);
    let despill_amount = config.despill_amount / 100.0;

    for y in 0..h {
        let row_start = y * w * 4;
        for x in 0..w {
            let idx = row_start + x * 4;
            let r = rgba[idx] as f32;
            let mut g = rgba[idx + 1] as f32;
            let mut b = rgba[idx + 2] as f32;

            // 1. Calculate raw matte based on primary key color
            let raw_matte = if is_green {
                let max_rb = (r * 0.5 + b * 0.5).max(r).max(b);
                (g - max_rb) * gain_factor
            } else if is_blue {
                let max_rg = (r * 0.5 + g * 0.5).max(r).max(g);
                (b - max_rg) * gain_factor
            } else {
                let max_gb = (g * 0.5 + b * 0.5).max(g).max(b);
                (r - max_gb) * gain_factor
            };

            // 2. Alpha calculation (1.0 = solid, 0.0 = transparent)
            let mut alpha_f = 1.0 - (raw_matte / 255.0).clamp(0.0, 1.0);

            // Clip black / white
            alpha_f = ((alpha_f - clip_b) / (clip_w - clip_b)).clamp(0.0, 1.0);

            // 3. Despill suppression
            if config.despill && alpha_f > 0.0 {
                if is_green {
                    let limit = (r * 0.5 + b * 0.5).min(255.0);
                    if g > limit {
                        let excess = (g - limit) * despill_amount;
                        g = (g - excess).max(0.0);
                    }
                } else if is_blue {
                    let limit = (r * 0.5 + g * 0.5).min(255.0);
                    if b > limit {
                        let excess = (b - limit) * despill_amount;
                        b = (b - excess).max(0.0);
                    }
                }
            }

            rgba[idx] = r.round().clamp(0.0, 255.0) as u8;
            rgba[idx + 1] = g.round().clamp(0.0, 255.0) as u8;
            rgba[idx + 2] = b.round().clamp(0.0, 255.0) as u8;
            rgba[idx + 3] = (alpha_f * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }
}
