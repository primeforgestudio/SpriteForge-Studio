import { PixelArtSettings } from './types';

// Palette definitions: [R, G, B]
export const RETRO_PALETTES: Record<string, [number, number, number][]> = {
  // PICO-8 16-color fantasy console palette
  pico8: [
    [0, 0, 0],
    [29, 43, 83],
    [126, 37, 83],
    [0, 135, 81],
    [171, 82, 54],
    [95, 87, 79],
    [194, 195, 199],
    [255, 241, 232],
    [255, 0, 77],
    [255, 163, 0],
    [255, 236, 39],
    [0, 228, 54],
    [41, 173, 255],
    [131, 118, 156],
    [255, 119, 168],
    [255, 204, 170],
  ],

  // Original Game Boy 4-color Pea-Soup Green
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],

  // DawnBringer 32 (DB32) - Industry standard for indie pixel games
  db32: [
    [0, 0, 0],
    [34, 32, 52],
    [69, 40, 60],
    [102, 57, 49],
    [143, 86, 59],
    [223, 113, 38],
    [217, 160, 102],
    [238, 195, 154],
    [251, 242, 54],
    [153, 229, 80],
    [106, 190, 48],
    [55, 148, 110],
    [75, 105, 47],
    [82, 75, 36],
    [50, 60, 57],
    [63, 63, 116],
    [48, 96, 130],
    [91, 110, 225],
    [99, 155, 255],
    [95, 205, 228],
    [203, 219, 252],
    [255, 255, 255],
    [155, 173, 183],
    [132, 126, 135],
    [105, 106, 106],
    [89, 86, 82],
    [118, 66, 138],
    [172, 50, 50],
    [217, 87, 99],
    [215, 123, 186],
    [143, 151, 74],
    [138, 111, 48],
  ],

  // Endesga 32 (EDG32)
  endesga32: [
    [190, 74, 47],
    [215, 118, 67],
    [234, 212, 170],
    [228, 166, 114],
    [184, 111, 80],
    [115, 62, 57],
    [62, 39, 49],
    [162, 38, 51],
    [228, 59, 68],
    [247, 118, 34],
    [254, 174, 52],
    [254, 231, 97],
    [99, 199, 77],
    [62, 137, 72],
    [38, 92, 66],
    [25, 60, 62],
    [18, 78, 137],
    [36, 159, 222],
    [82, 219, 242],
    [255, 255, 255],
    [194, 204, 214],
    [139, 155, 180],
    [90, 105, 136],
    [58, 68, 102],
    [38, 43, 68],
    [24, 20, 37],
    [53, 43, 66],
    [109, 84, 117],
    [168, 130, 158],
    [222, 184, 206],
    [220, 140, 186],
    [164, 82, 139],
  ],
};

// 4x4 Bayer Dither Matrix normalized to -0.5 .. 0.5
const BAYER_4X4 = [
  [0 / 16 - 0.5, 8 / 16 - 0.5, 2 / 16 - 0.5, 10 / 16 - 0.5],
  [12 / 16 - 0.5, 4 / 16 - 0.5, 14 / 16 - 0.5, 6 / 16 - 0.5],
  [3 / 16 - 0.5, 11 / 16 - 0.5, 1 / 16 - 0.5, 9 / 16 - 0.5],
  [15 / 16 - 0.5, 7 / 16 - 0.5, 13 / 16 - 0.5, 5 / 16 - 0.5],
];

export class PixelArtConverter {
  /**
   * Converts a high-resolution sprite canvas into authentic retro pixel art
   */
  public static convertToPixelArt(
    sourceCanvas: HTMLCanvasElement,
    settings: PixelArtSettings
  ): HTMLCanvasElement {
    if (!settings.enabled) return sourceCanvas;

    const origW = sourceCanvas.width;
    const origH = sourceCanvas.height;

    // Calculate downscaled resolution preserving aspect ratio
    const targetSize = Math.max(16, Math.min(256, settings.targetResolution || 64));
    const aspect = origW / origH;
    let downW: number;
    let downH: number;

    if (origW >= origH) {
      downW = targetSize;
      downH = Math.max(16, Math.round(targetSize / aspect));
    } else {
      downH = targetSize;
      downW = Math.max(16, Math.round(targetSize * aspect));
    }

    // Step 1: Downscale to tiny canvas
    const downCanvas = document.createElement('canvas');
    downCanvas.width = downW;
    downCanvas.height = downH;
    const downCtx = downCanvas.getContext('2d', { willReadFrequently: true });
    if (!downCtx) return sourceCanvas;

    downCtx.imageSmoothingEnabled = true;
    downCtx.imageSmoothingQuality = 'high';
    downCtx.drawImage(sourceCanvas, 0, 0, downW, downH);

    const downImg = downCtx.getImageData(0, 0, downW, downH);
    const data = downImg.data;

    // Step 2: Palette matching & dithering
    const paletteKey = settings.palette || 'none';
    const palette = RETRO_PALETTES[paletteKey];
    const useDither = settings.dither && palette;

    const ditherSpread = 32.0; // Dither intensity spread

    for (let y = 0; y < downH; y++) {
      for (let x = 0; x < downW; x++) {
        const idx = (y * downW + x) * 4;
        const a = data[idx + 3];

        // Clean hard alpha threshold for crisp pixel art edges
        if (a < 64) {
          data[idx + 3] = 0;
          continue;
        } else {
          data[idx + 3] = 255;
        }

        let r = data[idx];
        let g = data[idx + 1];
        let b = data[idx + 2];

        if (palette && palette.length > 0) {
          if (useDither) {
            const dVal = BAYER_4X4[y % 4][x % 4] * ditherSpread;
            r = Math.max(0, Math.min(255, r + dVal));
            g = Math.max(0, Math.min(255, g + dVal));
            b = Math.max(0, Math.min(255, b + dVal));
          }

          // Nearest color in palette
          const nearest = this.findNearestPaletteColor(r, g, b, palette);
          data[idx] = nearest[0];
          data[idx + 1] = nearest[1];
          data[idx + 2] = nearest[2];
        }
      }
    }

    // Optional 1px Outline
    if (settings.outline) {
      this.applyPixelOutline(data, downW, downH);
    }

    downCtx.putImageData(downImg, 0, 0);

    // Step 3: Upscale back to original canvas size with nearest-neighbor
    const outCanvas = document.createElement('canvas');
    outCanvas.width = origW;
    outCanvas.height = origH;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) return sourceCanvas;

    outCtx.imageSmoothingEnabled = false; // Nearest-neighbor (Pixelated)
    outCtx.drawImage(downCanvas, 0, 0, origW, origH);

    return outCanvas;
  }

  private static findNearestPaletteColor(
    r: number,
    g: number,
    b: number,
    palette: [number, number, number][]
  ): [number, number, number] {
    let bestDist = Infinity;
    let bestCol = palette[0];

    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      // Weighted Euclidean distance for human perception
      const dr = r - p[0];
      const dg = g - p[1];
      const db = b - p[2];
      const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;

      if (dist < bestDist) {
        bestDist = dist;
        bestCol = p;
        if (dist === 0) break;
      }
    }

    return bestCol;
  }

  private static applyPixelOutline(data: Uint8ClampedArray, w: number, h: number): void {
    const isSolid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      isSolid[i] = data[i * 4 + 3] > 0 ? 1 : 0;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (isSolid[i] === 0) {
          // Check if adjacent to a solid pixel
          const hasSolidNeighbor =
            (x > 0 && isSolid[i - 1] === 1) ||
            (x < w - 1 && isSolid[i + 1] === 1) ||
            (y > 0 && isSolid[i - w] === 1) ||
            (y < h - 1 && isSolid[i + w] === 1);

          if (hasSolidNeighbor) {
            const idx = i * 4;
            data[idx] = 16;
            data[idx + 1] = 16;
            data[idx + 2] = 20;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }
}
