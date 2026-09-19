import { VideoLoader } from './videoLoader';
import { ImageProcessor } from './imageProcessor';
import { ChromaKeySettings } from './types';

export interface LoopDetectResult {
  bestFrame: number;
  differenceScore: number;
  matchPercentage: number;
}

export class LoopDetector {
  /**
   * Fast auto-detection of the optimal seamless loop frame
   */
  public static async detectBestLoopFrame(
    loader: VideoLoader,
    cropStart: number,
    totalFrames: number,
    keyingSettings: ChromaKeySettings,
    onProgress?: (progress: number) => void
  ): Promise<LoopDetectResult | null> {
    if (totalFrames <= 4) return null;

    // Minimum frames for an animation loop (at least 6 frames)
    const minLoopFrames = 6;
    const startFrame = cropStart;
    const searchStart = startFrame + minLoopFrames;
    const searchEnd = totalFrames - 1;

    if (searchStart >= searchEnd) return null;

    // 1. Get reference start frame
    const rawStart = await loader.getFrame(startFrame);
    if (!rawStart) return null;

    // Downscale for fast difference matrix calculation (64x64 or 96x96)
    const compareSize = 64;
    const startThumb = this.createDownsampledAlphaMask(rawStart, compareSize, keyingSettings);

    let minDiff = Infinity;
    let bestFrame = searchEnd;

    const totalToSearch = searchEnd - searchStart + 1;

    for (let f = searchStart; f <= searchEnd; f++) {
      const raw = await loader.getFrame(f);
      if (raw) {
        const thumb = this.createDownsampledAlphaMask(raw, compareSize, keyingSettings);
        const diff = this.calculateMeanDifference(startThumb, thumb);

        // We look for a significant drop/local minimum in difference
        if (diff < minDiff) {
          minDiff = diff;
          bestFrame = f;
        }
      }

      if (onProgress && f % 5 === 0) {
        onProgress((f - searchStart) / totalToSearch);
      }

      // Yield to avoid blocking browser
      if (f % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Match percentage (0..100%)
    const matchPercentage = Math.max(0, Math.min(100, Math.round((1.0 - minDiff / 255.0) * 100)));

    return {
      bestFrame,
      differenceScore: minDiff,
      matchPercentage,
    };
  }

  /**
   * Downsamples frame and returns grayscale luminance + alpha silhouette buffer
   */
  private static createDownsampledAlphaMask(
    raw: ImageData,
    size: number,
    keyingSettings: ChromaKeySettings
  ): Uint8Array {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Create temp canvas with processed chroma key
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = raw.width;
    fullCanvas.height = raw.height;
    const fullCtx = fullCanvas.getContext('2d')!;

    const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
    if (keyingSettings.enabled) {
      ImageProcessor.applyChromaKey(processed, keyingSettings);
    }
    fullCtx.putImageData(processed, 0, 0);

    // Draw downscaled onto compare canvas
    ctx.drawImage(fullCanvas, 0, 0, size, size);
    const smallData = ctx.getImageData(0, 0, size, size).data;

    const buffer = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
      const idx = i * 4;
      const alpha = smallData[idx + 3] / 255.0;
      // Silhouette luminance multiplied by alpha
      const lum = (smallData[idx] * 0.299 + smallData[idx + 1] * 0.587 + smallData[idx + 2] * 0.114) * alpha;
      buffer[i] = Math.round(lum);
    }

    return buffer;
  }

  /**
   * Calculates Mean Absolute Difference between two downsampled buffers
   */
  private static calculateMeanDifference(bufA: Uint8Array, bufB: Uint8Array): number {
    let totalDiff = 0;
    const len = bufA.length;
    for (let i = 0; i < len; i++) {
      totalDiff += Math.abs(bufA[i] - bufB[i]);
    }
    return totalDiff / len;
  }
}
