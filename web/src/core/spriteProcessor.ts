import JSZip from 'jszip';
import { AtlasBuilder } from './atlasBuilder';
import { ImageProcessor } from './imageProcessor';
import { SpritesSettings, SpriteTransform } from './types';

export class SpriteProcessor {
  /**
   * Process a single sprite image with transform, crop and optional background
   */
  public static processSprite(
    sourceCanvas: HTMLCanvasElement,
    transform: SpriteTransform,
    settings: SpritesSettings
  ): HTMLCanvasElement {
    const { targetWidth, targetHeight } = settings;

    // 1. First crop & resize base image to target dimensions
    const baseResized = ImageProcessor.resizeCanvas(
      sourceCanvas,
      targetWidth,
      targetHeight,
      { width: targetWidth, height: targetHeight }
    );

    // 2. Apply pan & scale transform
    const transformed = ImageProcessor.transformSprite(
      baseResized,
      targetWidth,
      targetHeight,
      transform.scale,
      transform.offsetX,
      transform.offsetY
    );

    // 3. Composite on background if enabled
    if (settings.addBg) {
      return ImageProcessor.compositeOnBackground(transformed, settings.bgColor);
    }

    return transformed;
  }

  /**
   * Batch process all sprites and export as ZIP file
   */
  public static async exportSpritesZip(
    files: { name: string; canvas: HTMLCanvasElement }[],
    transforms: Map<number, SpriteTransform>,
    defaultTransform: SpriteTransform,
    settings: SpritesSettings,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob> {
    const zip = new JSZip();

    for (let idx = 0; idx < files.length; idx++) {
      const item = files[idx];
      const transform = settings.applyToAll
        ? defaultTransform
        : transforms.get(idx) || defaultTransform;

      const processedCanvas = this.processSprite(item.canvas, transform, settings);
      const blob = await AtlasBuilder.canvasToBlob(processedCanvas);

      const numStr = String(idx + 1).padStart(4, '0');
      let outName: string;

      if (settings.rename) {
        outName = `${settings.prefix}${numStr}.png`;
      } else {
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        outName = `${baseName}_${numStr}.png`;
      }

      zip.file(outName, blob);

      if (onProgress) {
        onProgress(idx + 1, files.length);
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }
}
