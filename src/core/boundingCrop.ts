import { VideoLoader } from './videoLoader';
import { ImageProcessor } from './imageProcessor';
import { ChromaKeySettings } from './types';

export type StatePreset = 'standard' | 'attack' | 'jump' | 'idle';

export interface BoundingBoxResult {
  x: number;
  y: number;
  width: number;
  height: number;
  recommendedCellW: number;
  recommendedCellH: number;
}

export class BoundingCrop {
  /**
   * Scans all keyframe markers, computes the union bounding box of the character
   */
  public static async calculateUnionBounds(
    loader: VideoLoader,
    markerIndices: number[],
    keyingSettings: ChromaKeySettings,
    preset: StatePreset = 'standard',
    paddingRatio = 0.1
  ): Promise<BoundingBoxResult | null> {
    if (markerIndices.length === 0) return null;

    let globalMinX = Infinity;
    let globalMinY = Infinity;
    let globalMaxX = -Infinity;
    let globalMaxY = -Infinity;

    let fullW = 0;
    let fullH = 0;

    for (const frameIdx of markerIndices) {
      const raw = await loader.getFrame(frameIdx);
      if (!raw) continue;

      fullW = raw.width;
      fullH = raw.height;

      const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
      if (keyingSettings.enabled) {
        ImageProcessor.applyChromaKey(processed, keyingSettings);
      }

      const { data, width, height } = processed;

      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
          const alpha = data[(rowOffset + x) * 4 + 3];
          // Significant alpha threshold
          if (alpha > 25) {
            if (x < globalMinX) globalMinX = x;
            if (x > globalMaxX) globalMaxX = x;
            if (y < globalMinY) globalMinY = y;
            if (y > globalMaxY) globalMaxY = y;
          }
        }
      }

      await new Promise((r) => setTimeout(r, 0));
    }

    if (globalMinX === Infinity) {
      // Nothing found or fully transparent
      return null;
    }

    let charW = globalMaxX - globalMinX + 1;
    let charH = globalMaxY - globalMinY + 1;

    // Apply State Canvas Padding
    let padLeft = charW * paddingRatio;
    let padRight = charW * paddingRatio;
    let padTop = charH * paddingRatio;
    let padBottom = charH * paddingRatio;

    if (preset === 'attack') {
      padRight += charW * 0.28; // +28% front for weapon reach
      padTop += charH * 0.1;
    } else if (preset === 'jump') {
      padTop += charH * 0.34; // +34% top for jump trajectory
    } else if (preset === 'idle') {
      padLeft = charW * 0.05;
      padRight = charW * 0.05;
      padTop = charH * 0.05;
      padBottom = charH * 0.05;
    }

    const cropX = Math.max(0, Math.floor(globalMinX - padLeft));
    const cropY = Math.max(0, Math.floor(globalMinY - padTop));
    const cropW = Math.min(fullW - cropX, Math.ceil(charW + padLeft + padRight));
    const cropH = Math.min(fullH - cropY, Math.ceil(charH + padTop + padBottom));

    // Recommend power of two or clean multiple of 16/32
    const roundToMultiple = (val: number, mult = 16) => Math.ceil(val / mult) * mult;
    const recW = Math.min(2048, Math.max(64, roundToMultiple(cropW, 32)));
    const recH = Math.min(2048, Math.max(64, roundToMultiple(cropH, 32)));

    return {
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
      recommendedCellW: recW,
      recommendedCellH: recH,
    };
  }

  /**
   * Automatically detects feet stance bounds (width, center, ground contact)
   * from an image buffer around the baseline/pivot point.
   */
  public static detectFeetBounds(
    imageData: ImageData,
    pivot: { x: number; y: number } = { x: 0.5, y: 0.95 }
  ): { width: number; height: number; offsetX: number; offsetY: number } {
    const { width, height, data } = imageData;
    const pivotPxX = pivot.x * width;
    const pivotPxY = pivot.y * height;

    // Scan region around pivotPxY (-15% .. +5%)
    const scanTop = Math.max(0, Math.floor(pivotPxY - height * 0.15));
    const scanBottom = Math.min(height, Math.ceil(pivotPxY + height * 0.05));

    let minX = Infinity;
    let maxX = -Infinity;
    let groundY = pivotPxY;

    for (let y = scanTop; y < scanBottom; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        const a = data[row + x * 4 + 3];
        if (a > 30) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > groundY) groundY = y;
        }
      }
    }

    if (minX === Infinity || maxX === -Infinity) {
      return {
        width: Math.max(16, Math.round(width * 0.18)),
        height: Math.max(8, Math.round(height * 0.06)),
        offsetX: 0,
        offsetY: -Math.round(height * 0.03),
      };
    }

    const feetW = Math.max(12, maxX - minX);
    const feetCenter = (minX + maxX) / 2;
    const offsetX = Math.round(feetCenter - pivotPxX);
    const feetH = Math.max(8, Math.round(feetW * 0.45));
    const offsetY = Math.round(-feetH / 2);

    return {
      width: Math.round(feetW),
      height: feetH,
      offsetX,
      offsetY,
    };
  }
}
