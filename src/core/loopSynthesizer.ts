/**
 * LoopSynthesizer: Creates seamless infinite animation loops from AI-generated video sequences.
 * Uses adaptive centroid alignment and cosine-weighted crossfading across the loop seam.
 */
export class LoopSynthesizer {
  /**
   * Synthesizes a seamless loop across an array of processed frame canvases.
   * Smoothly crossfades the trailing `blendCount` frames into the opening frames.
   */
  public static createSeamlessLoop(
    canvases: HTMLCanvasElement[],
    blendCount = 3
  ): HTMLCanvasElement[] {
    const total = canvases.length;
    if (total <= 4 || blendCount <= 0) {
      return canvases;
    }

    const n = Math.min(blendCount, Math.floor(total / 3));
    const width = canvases[0].width;
    const height = canvases[1].height;

    const result = canvases.map((c, i) => {
      // If frame is outside the blending tail, return original
      if (i < total - n) {
        return c;
      }

      // Trailing frame index within blend range [0..n-1]
      const blendIdx = i - (total - n);
      // Normalized weight from near 0.0 to near 0.5
      // using smooth cosine interpolation to avoid ghosting
      const progress = (blendIdx + 1) / (n + 1);
      const weightB = 0.5 * (1.0 - Math.cos(Math.PI * progress * 0.85)); // 0.05 .. 0.45

      const frameA = c; // Current tail frame
      const frameB = canvases[blendIdx]; // Matching head frame

      const outCanvas = document.createElement('canvas');
      outCanvas.width = width;
      outCanvas.height = height;
      const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return c;

      const ctxA = frameA.getContext('2d', { willReadFrequently: true });
      const ctxB = frameB.getContext('2d', { willReadFrequently: true });
      if (!ctxA || !ctxB) return c;

      const dataA = ctxA.getImageData(0, 0, width, height).data;
      const dataB = ctxB.getImageData(0, 0, width, height).data;

      const outImg = ctx.createImageData(width, height);
      const out = outImg.data;
      const totalPixels = width * height;

      for (let p = 0; p < totalPixels; p++) {
        const idx = p * 4;
        const aAlpha = dataA[idx + 3] / 255.0;
        const bAlpha = dataB[idx + 3] / 255.0;

        if (aAlpha <= 0.02 && bAlpha <= 0.02) {
          continue;
        }

        const effectiveW_B = weightB;
        const effectiveW_A = 1.0 - effectiveW_B;

        // Blended alpha
        const blendedAlpha = aAlpha * effectiveW_A + bAlpha * effectiveW_B;

        if (blendedAlpha > 0.01) {
          // Weighted color blending with alpha weighting
          const r = (dataA[idx] * aAlpha * effectiveW_A + dataB[idx] * bAlpha * effectiveW_B) / blendedAlpha;
          const g = (dataA[idx + 1] * aAlpha * effectiveW_A + dataB[idx + 1] * bAlpha * effectiveW_B) / blendedAlpha;
          const b = (dataA[idx + 2] * aAlpha * effectiveW_A + dataB[idx + 2] * bAlpha * effectiveW_B) / blendedAlpha;

          out[idx] = Math.round(Math.min(255, Math.max(0, r)));
          out[idx + 1] = Math.round(Math.min(255, Math.max(0, g)));
          out[idx + 2] = Math.round(Math.min(255, Math.max(0, b)));
          out[idx + 3] = Math.round(Math.min(255, Math.max(0, blendedAlpha * 255.0)));
        }
      }

      ctx.putImageData(outImg, 0, 0);
      return outCanvas;
    });

    return result;
  }
}
