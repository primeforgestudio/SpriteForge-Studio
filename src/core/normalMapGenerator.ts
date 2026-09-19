/**
 * NormalMapGenerator: Algorithmic 2D Normal Map generator for Godot 4 & Unity dynamic lighting
 * Uses Sobel operator on combined luminance and alpha contours
 */
export class NormalMapGenerator {
  /**
   * Generates a tangent-space 2D Normal Map from a diffuse texture canvas (atlas).
   * Encodes normal vectors into RGB [128, 128, 255] with matching alpha channel.
   */
  public static generateNormalMap(
    sourceCanvas: HTMLCanvasElement,
    bumpStrength = 2.5,
    invertY = false
  ): HTMLCanvasElement {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return sourceCanvas;
    const outData = outCtx.createImageData(w, h);
    const out = outData.data;

    // 1. Build height map buffer (0..1) combining luminance and alpha contour
    const heightMap = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const a = src[idx + 3] / 255.0;
      if (a <= 0.02) {
        heightMap[i] = 0;
      } else {
        // Luminance (perceived brightness)
        const lum =
          (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255.0;
        // Combine interior luminance with alpha edge falloff for relief
        heightMap[i] = lum * 0.6 + a * 0.4;
      }
    }

    // 2. Sobel kernel convolution for gradients
    const strength = Math.max(0.5, Math.min(10.0, bumpStrength));
    const yMult = invertY ? -1 : 1;

    for (let y = 0; y < h; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(h - 1, y + 1);

      for (let x = 0; x < w; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(w - 1, x + 1);
        const centerIdx = (y * w + x) * 4;
        const alpha = src[centerIdx + 3];

        if (alpha <= 5) {
          // Transparent pixel: neutral flat normal (0, 0, 1) -> RGB(128, 128, 255)
          out[centerIdx] = 128;
          out[centerIdx + 1] = 128;
          out[centerIdx + 2] = 255;
          out[centerIdx + 3] = 0;
          continue;
        }

        // Sample 3x3 neighborhood heights
        const tl = heightMap[yPrev * w + xPrev];
        const tc = heightMap[yPrev * w + x];
        const tr = heightMap[yPrev * w + xNext];
        const ml = heightMap[y * w + xPrev];
        const mr = heightMap[y * w + xNext];
        const bl = heightMap[yNext * w + xPrev];
        const bc = heightMap[yNext * w + x];
        const br = heightMap[yNext * w + xNext];

        // Sobel filter for horizontal (dX) and vertical (dY) gradients
        const dx = tr + 2 * mr + br - (tl + 2 * ml + bl);
        const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * yMult;

        // Construct 3D normal vector [-dx * strength, -dy * strength, 1.0]
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1.0;

        // Normalize vector
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
        const normX = nx / len;
        const normY = ny / len;
        const normZ = nz / len;

        // Encode [-1..1] to [0..255] RGB
        out[centerIdx] = Math.round((normX * 0.5 + 0.5) * 255);
        out[centerIdx + 1] = Math.round((normY * 0.5 + 0.5) * 255);
        out[centerIdx + 2] = Math.round((normZ * 0.5 + 0.5) * 255);
        out[centerIdx + 3] = alpha; // Preserve exact character silhouette
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }
}
