/**
 * Per-frame Non-Destructive Retouch Engine
 * Retouch mask values (Uint8Array of length width * height):
 *   127 = untouched (preserve KeyForge / AI matte alpha)
 *     0 = force transparent (Magic Wand / Eraser)
 *   255 = force opaque from raw video frame (Restore Brush)
 */

export const RETOUCH_NEUTRAL = 127;
export const RETOUCH_ERASE = 0;
export const RETOUCH_RESTORE = 255;

export class FrameRetouchEngine {
  public static createNeutralMask(width: number, height: number): Uint8Array {
    const mask = new Uint8Array(width * height);
    mask.fill(RETOUCH_NEUTRAL);
    return mask;
  }

  /**
   * Flood-fill (Contiguous) or Global color-based Magic Wand erasure.
   * Targets visible pixels on the keyed frame matching the clicked pixel within tolerance.
   */
  public static applyMagicWandErase(
    keyedImageData: ImageData,
    retouchMask: Uint8Array,
    startX: number,
    startY: number,
    tolerance: number = 28,
    contiguous: boolean = true
  ): number {
    const { width, height, data } = keyedImageData;
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return 0;

    const startPos = sy * width + sx;
    const startIdx = startPos * 4;
    if (data[startIdx + 3] <= 10 || retouchMask[startPos] === RETOUCH_ERASE) {
      return 0;
    }

    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const tolSq = tolerance * tolerance * 3.0;
    let erasedCount = 0;

    if (!contiguous) {
      const n = width * height;
      for (let p = 0; p < n; p++) {
        const p4 = p * 4;
        if (data[p4 + 3] <= 10 || retouchMask[p] === RETOUCH_ERASE) continue;
        const dr = data[p4] - targetR;
        const dg = data[p4 + 1] - targetG;
        const db = data[p4 + 2] - targetB;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          retouchMask[p] = RETOUCH_ERASE;
          erasedCount++;
        }
      }
      return erasedCount;
    }

    // BFS Contiguous Flood Fill
    const n = width * height;
    const visited = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;

    visited[startPos] = 1;
    queue[tail++] = startPos;

    while (head < tail) {
      const p = queue[head++];
      retouchMask[p] = RETOUCH_ERASE;
      erasedCount++;

      const x = p % width;
      const y = (p - x) / width;

      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];

      for (let k = 0; k < 4; k++) {
        const np = neighbors[k];
        if (np < 0 || visited[np]) continue;
        visited[np] = 1;

        if (retouchMask[np] === RETOUCH_ERASE) continue;
        const np4 = np * 4;
        if (data[np4 + 3] <= 10) continue;

        const dr = data[np4] - targetR;
        const dg = data[np4 + 1] - targetG;
        const db = data[np4 + 2] - targetB;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          queue[tail++] = np;
        }
      }
    }

    return erasedCount;
  }

  /**
   * Circular brush stroke (Eraser or Restore)
   */
  public static paintBrushStroke(
    retouchMask: Uint8Array,
    width: number,
    height: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    mode: 'eraser' | 'restore'
  ): void {
    const val = mode === 'eraser' ? RETOUCH_ERASE : RETOUCH_RESTORE;
    const r = Math.max(1, radius);
    const rSq = r * r;

    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.35)));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);

      const minX = Math.max(0, Math.floor(cx - r));
      const maxX = Math.min(width - 1, Math.ceil(cx + r));
      const minY = Math.max(0, Math.floor(cy - r));
      const maxY = Math.min(height - 1, Math.ceil(cy + r));

      for (let y = minY; y <= maxY; y++) {
        const dy = y - cy;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= rSq) {
            retouchMask[y * width + x] = val;
          }
        }
      }
    }
  }

  /**
   * Applies stored retouch delta onto a keyed HTMLCanvasElement
   */
  public static applyRetouchMaskToCanvas(
    canvas: HTMLCanvasElement,
    retouchMask: Uint8Array | undefined,
    rawFrame?: ImageData | null
  ): void {
    if (!retouchMask) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    if (retouchMask.length !== width * height) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const rawData = rawFrame && rawFrame.width === width && rawFrame.height === height ? rawFrame.data : null;

    let modified = false;
    for (let p = 0; p < retouchMask.length; p++) {
      const m = retouchMask[p];
      if (m === RETOUCH_NEUTRAL) continue;
      const idx = p * 4;
      if (m === RETOUCH_ERASE) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        modified = true;
      } else if (m === RETOUCH_RESTORE) {
        if (rawData) {
          data[idx] = rawData[idx];
          data[idx + 1] = rawData[idx + 1];
          data[idx + 2] = rawData[idx + 2];
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 255;
        }
        modified = true;
      }
    }

    if (modified) {
      ctx.putImageData(imgData, 0, 0);
    }
  }
}
