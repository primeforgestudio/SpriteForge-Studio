use serde::{Deserialize, Serialize};

fn default_border_clean_thresh() -> u8 {
    45
}

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
    #[serde(default)]
    pub enable_border_clean: bool,
    #[serde(default = "default_border_clean_thresh")]
    pub border_clean_threshold: u8,
}

/// Keylight Color Difference Keying implementation in Rust.
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

    // 4. Topological outer border clean
    if config.enable_border_clean {
        apply_topological_border_clean(rgba, width, height, config.border_clean_threshold);
    }
}

/// 4-Way BFS Outer Perimeter Flood Clean in Rust.
pub fn apply_topological_border_clean(
    rgba: &mut [u8],
    width: u32,
    height: u32,
    threshold: u8,
) {
    let w = width as usize;
    let h = height as usize;
    let total = w * h;
    if total == 0 {
        return;
    }

    let mut visited = vec![false; total];
    let mut queue = std::collections::VecDeque::with_capacity(total / 4);

    // 1. Seed border pixels into BFS queue
    for x in 0..w {
        let top = x;
        let btm = (h - 1) * w + x;
        if rgba[top * 4 + 3] < 220 {
            visited[top] = true;
            queue.push_back(top);
        }
        if rgba[btm * 4 + 3] < 220 {
            visited[btm] = true;
            queue.push_back(btm);
        }
    }
    for y in 1..(h - 1) {
        let left = y * w;
        let right = y * w + (w - 1);
        if !visited[left] && rgba[left * 4 + 3] < 220 {
            visited[left] = true;
            queue.push_back(left);
        }
        if !visited[right] && rgba[right * 4 + 3] < 220 {
            visited[right] = true;
            queue.push_back(right);
        }
    }

    // 2. BFS inward through low-alpha pixels
    while let Some(idx) = queue.pop_front() {
        let alpha = rgba[idx * 4 + 3];
        if alpha < threshold {
            rgba[idx * 4 + 3] = 0;
        }

        let px = idx % w;
        let py = idx / w;

        // Up
        if py > 0 {
            let n = idx - w;
            if !visited[n] && rgba[n * 4 + 3] < threshold {
                visited[n] = true;
                queue.push_back(n);
            }
        }
        // Down
        if py < h - 1 {
            let n = idx + w;
            if !visited[n] && rgba[n * 4 + 3] < threshold {
                visited[n] = true;
                queue.push_back(n);
            }
        }
        // Left
        if px > 0 {
            let n = idx - 1;
            if !visited[n] && rgba[n * 4 + 3] < threshold {
                visited[n] = true;
                queue.push_back(n);
            }
        }
        // Right
        if px < w - 1 {
            let n = idx + 1;
            if !visited[n] && rgba[n * 4 + 3] < threshold {
                visited[n] = true;
                queue.push_back(n);
            }
        }
    }
}
