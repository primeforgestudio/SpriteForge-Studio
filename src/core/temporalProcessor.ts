/**
 * TemporalProcessor: AI Video Stabilization & Animation Ground Alignment
 */
export class TemporalProcessor {
  /**
   * Scans a canvas from bottom to top to detect the lowest character contact point (feet Y).
   * Uses a noise threshold of 3+ consecutive opaque pixels to reject floating dust/noise.
   */
  public static detectBottomFeetY(
    canvas: HTMLCanvasElement,
    alphaThreshold = 45
  ): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.height - 1;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Scan from bottom row up to 20% from top
    for (let y = h - 1; y >= Math.round(h * 0.2); y--) {
      let opaqueCount = 0;
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a >= alphaThreshold) {
          opaqueCount++;
          if (opaqueCount >= 3) {
            return y;
          }
        } else {
          opaqueCount = 0;
        }
      }
    }

    return h - 1;
  }

  /**
   * Calculates the ground baseline for an animation sequence.
   * In walking/running cycles, ground contact is the lowest point (maximum Y) reached by feet.
   */
  public static calculateSequenceBaseline(canvases: HTMLCanvasElement[]): {
    bottomYs: number[];
    targetBaselineY: number;
  } {
    if (canvases.length === 0) {
      return { bottomYs: [], targetBaselineY: 0 };
    }

    const bottomYs: number[] = [];
    for (const c of canvases) {
      bottomYs.push(this.detectBottomFeetY(c));
    }

    // Sort to filter out extreme outlier spikes (e.g. stray bottom pixel artifact)
    const sorted = [...bottomYs].sort((a, b) => a - b);
    // Take the 90th percentile to robustly anchor the ground contact plane
    const p90Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
    const targetBaselineY = sorted[p90Idx];

    return { bottomYs, targetBaselineY };
  }

  /**
   * Vertically aligns a frame so that its feet contact point locks onto the target baseline.
   */
  public static applyGroundSnap(
    sourceCanvas: HTMLCanvasElement,
    currentBottomY: number,
    targetBaselineY: number
  ): HTMLCanvasElement {
    const dy = targetBaselineY - currentBottomY;
    // Don't shift if difference is negligible (< 1px) or huge anomaly (> 35% height)
    if (Math.abs(dy) < 1 || Math.abs(dy) > sourceCanvas.height * 0.35) {
      return sourceCanvas;
    }

    const aligned = document.createElement('canvas');
    aligned.width = sourceCanvas.width;
    aligned.height = sourceCanvas.height;
    const ctx = aligned.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, dy);
    return aligned;
  }

  /**
   * Temporal De-Flicker: Smooths high-frequency alpha contour vibration across consecutive AI video frames.
   * Preserves solid foreground opacity while filtering jittery fringe edges.
   */
  public static applyTemporalDeFlicker(
    canvases: HTMLCanvasElement[],
    strengthPercent = 40
  ): HTMLCanvasElement[] {
    const count = canvases.length;
    if (count <= 2 || strengthPercent <= 0) {
      return canvases;
    }

    const w = canvases[0].width;
    const h = canvases[0].height;
    const totalPixels = w * h;

    // Weight of neighboring frames (max ~0.22 at 100% strength)
    const neighborWeight = (Math.max(0, Math.min(100, strengthPercent)) / 100) * 0.22;
    const centerWeight = 1.0 - 2 * neighborWeight;

    // Extract all frame image datas
    const imgDatas: ImageData[] = [];
    for (let i = 0; i < count; i++) {
      const ctx = canvases[i].getContext('2d');
      if (!ctx) return canvases;
      imgDatas.push(ctx.getImageData(0, 0, w, h));
    }

    const resultCanvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < count; i++) {
      const prevIdx = (i - 1 + count) % count; // Seamless wrap
      const nextIdx = (i + 1) % count;

      const prevData = imgDatas[prevIdx].data;
      const currData = imgDatas[i].data;
      const nextData = imgDatas[nextIdx].data;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) {
        resultCanvases.push(canvases[i]);
        continue;
      }

      const outImgData = outCtx.createImageData(w, h);
      const outData = outImgData.data;

      for (let p = 0; p < totalPixels; p++) {
        const idx = p * 4;
        const aPrev = prevData[idx + 3];
        const aCurr = currData[idx + 3];
        const aNext = nextData[idx + 3];

        // Keep RGB from current frame
        outData[idx] = currData[idx];
        outData[idx + 1] = currData[idx + 1];
        outData[idx + 2] = currData[idx + 2];

        // Smooth alpha edge transitions
        if (aCurr === 0 && aPrev === 0 && aNext === 0) {
          outData[idx + 3] = 0;
        } else if (aCurr === 255 && aPrev === 255 && aNext === 255) {
          outData[idx + 3] = 255;
        } else {
          const smoothedAlpha =
            centerWeight * aCurr + neighborWeight * aPrev + neighborWeight * aNext;
          outData[idx + 3] = Math.round(Math.max(0, Math.min(255, smoothedAlpha)));
        }
      }

      outCtx.putImageData(outImgData, 0, 0);
      resultCanvases.push(outCanvas);
    }

    return resultCanvases;
  }
}
