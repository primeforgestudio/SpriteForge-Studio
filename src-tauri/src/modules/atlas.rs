use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedFrameItem {
    pub name: String,
    pub index: usize,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub source_width: u32,
    pub source_height: u32,
    pub offset_x: u32,
    pub offset_y: u32,
    pub trimmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtlasResult {
    pub atlas_width: u32,
    pub atlas_height: u32,
    pub frames: Vec<PackedFrameItem>,
    pub image_data_base64: String, // base64 encoded PNG or RGBA data URL
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameInput {
    pub name: String,
    pub index: usize,
    pub width: u32,
    pub height: u32,
    /// Raw RGBA bytes (length = width * height * 4)
    pub rgba: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
    pub width: u32,
    pub height: u32,
}

pub fn calculate_bounding_box(rgba: &[u8], width: u32, height: u32, alpha_thresh: u8) -> Option<BoundingBox> {
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4 + 3) as usize;
            if idx < rgba.len() && rgba[idx] > alpha_thresh {
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
                found = true;
            }
        }
    }

    if !found {
        None
    } else {
        Some(BoundingBox {
            min_x,
            min_y,
            max_x,
            max_y,
            width: max_x - min_x + 1,
            height: max_y - min_y + 1,
        })
    }
}
