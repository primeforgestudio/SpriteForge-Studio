import { AtlasMetadataJSON, AtlasSettings, MediaMetadata, PackedFrameItem } from './types';

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class AtlasBuilder {
  /**
   * Scans non-transparent pixel bounding box (alpha > 2)
   */
  public static getFrameContentBounds(canvas: HTMLCanvasElement): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { minX: 0, minY: 0, maxX: canvas.width - 1, maxY: canvas.height - 1, width: canvas.width, height: canvas.height };
    }

    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height).data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const a = imgData[rowOffset + x * 4 + 3];
        if (a > 2) { // Non-transparent pixel
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Completely transparent frame fallback
    if (maxX < 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Advanced Pack (MaxRects 2D Bin-Packing with Whitespace Trimming)
   * Trims transparent pixels from every frame and packs into the smallest optimal power-of-two canvas.
   */
  public static packFramesAdvanced(
    frameCanvases: HTMLCanvasElement[],
    padding: number = 2,
    frameNames?: string[]
  ): {
    canvas: HTMLCanvasElement;
    packedFrames: PackedFrameItem[];
    width: number;
    height: number;
    efficiency: number;
  } {
    const items = frameCanvases.map((canvas, index) => {
      const bounds = this.getFrameContentBounds(canvas);
      const name = frameNames && frameNames[index] ? frameNames[index] : `frame_${index}`;
      return {
        index,
        name,
        canvas,
        sourceWidth: canvas.width,
        sourceHeight: canvas.height,
        bounds,
        w: bounds.width + padding * 2,
        h: bounds.height + padding * 2,
      };
    });

    // Sort items by height descending (BSSF heuristic)
    const sortedItems = [...items].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

    // Power-of-two canvas candidates to test
    const candidates: Array<[number, number]> = [
      [512, 512],
      [1024, 512],
      [1024, 1024],
      [2048, 1024],
      [2048, 2048],
      [4096, 2048],
      [4096, 4096],
      [8192, 4096],
      [8192, 8192],
    ];

    let bestSolution: {
      targetW: number;
      targetH: number;
      placements: Map<number, { x: number; y: number }>;
    } | null = null;

    for (const [targetW, targetH] of candidates) {
      const placements = new Map<number, { x: number; y: number }>();
      let freeRects: FreeRect[] = [{ x: 0, y: 0, w: targetW, h: targetH }];
      let allFit = true;

      for (const item of sortedItems) {
        let bestRectIndex = -1;
        let bestShortSide = Infinity;
        let bestLongSide = Infinity;

        for (let i = 0; i < freeRects.length; i++) {
          const fr = freeRects[i];
          if (item.w <= fr.w && item.h <= fr.h) {
            const leftoverX = fr.w - item.w;
            const leftoverY = fr.h - item.h;
            const shortSide = Math.min(leftoverX, leftoverY);
            const longSide = Math.max(leftoverX, leftoverY);

            if (shortSide < bestShortSide || (shortSide === bestShortSide && longSide < bestLongSide)) {
              bestShortSide = shortSide;
              bestLongSide = longSide;
              bestRectIndex = i;
            }
          }
        }

        if (bestRectIndex === -1) {
          allFit = false;
          break;
        }

        const chosen = freeRects[bestRectIndex];
        const placedX = chosen.x;
        const placedY = chosen.y;
        placements.set(item.index, { x: placedX, y: placedY });

        // Split free rectangles intersecting the placed item
        const placedRect: FreeRect = { x: placedX, y: placedY, w: item.w, h: item.h };
        const newFreeRects: FreeRect[] = [];

        for (const fr of freeRects) {
          if (
            placedRect.x >= fr.x + fr.w ||
            placedRect.x + placedRect.w <= fr.x ||
            placedRect.y >= fr.y + fr.h ||
            placedRect.y + placedRect.h <= fr.y
          ) {
            newFreeRects.push(fr);
            continue;
          }

          // Top
          if (placedRect.y > fr.y && placedRect.y < fr.y + fr.h) {
            newFreeRects.push({ x: fr.x, y: fr.y, w: fr.w, h: placedRect.y - fr.y });
          }
          // Bottom
          if (placedRect.y + placedRect.h < fr.y + fr.h) {
            newFreeRects.push({
              x: fr.x,
              y: placedRect.y + placedRect.h,
              w: fr.w,
              h: fr.y + fr.h - (placedRect.y + placedRect.h),
            });
          }
          // Left
          if (placedRect.x > fr.x && placedRect.x < fr.x + fr.w) {
            newFreeRects.push({ x: fr.x, y: fr.y, w: placedRect.x - fr.x, h: fr.h });
          }
          // Right
          if (placedRect.x + placedRect.w < fr.x + fr.w) {
            newFreeRects.push({
              x: placedRect.x + placedRect.w,
              y: fr.y,
              w: fr.x + fr.w - (placedRect.x + placedRect.w),
              h: fr.h,
            });
          }
        }

        // Prune contained rects
        freeRects = [];
        for (let i = 0; i < newFreeRects.length; i++) {
          let contained = false;
          const a = newFreeRects[i];
          for (let j = 0; j < newFreeRects.length; j++) {
            if (i === j) continue;
            const b = newFreeRects[j];
            if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
              contained = true;
              break;
            }
          }
          if (!contained) {
            freeRects.push(a);
          }
        }
      }

      if (allFit) {
        bestSolution = { targetW, targetH, placements };
        break;
      }
    }

    // Fallback if somehow exceeded 8192
    const finalW = bestSolution ? bestSolution.targetW : 4096;
    const finalH = bestSolution ? bestSolution.targetH : 4096;

    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = finalW;
    atlasCanvas.height = finalH;
    const ctx = atlasCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, finalW, finalH);
    }

    let totalUsedArea = 0;
    const packedFrames: PackedFrameItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pos = bestSolution?.placements.get(item.index) || { x: 0, y: 0 };
      const destX = pos.x + padding;
      const destY = pos.y + padding;

      if (ctx) {
        ctx.drawImage(
          item.canvas,
          item.bounds.minX,
          item.bounds.minY,
          item.bounds.width,
          item.bounds.height,
          destX,
          destY,
          item.bounds.width,
          item.bounds.height
        );
      }

      totalUsedArea += item.bounds.width * item.bounds.height;

      packedFrames.push({
        name: item.name,
        index: item.index,
        x: destX,
        y: destY,
        width: item.bounds.width,
        height: item.bounds.height,
        sourceWidth: item.sourceWidth,
        sourceHeight: item.sourceHeight,
        offsetX: item.bounds.minX,
        offsetY: item.bounds.minY,
        trimmed: true,
      });
    }

    // Sort packedFrames back to original index order
    packedFrames.sort((a, b) => a.index - b.index);

    const efficiency = Math.round((totalUsedArea / (finalW * finalH)) * 100);

    return {
      canvas: atlasCanvas,
      packedFrames,
      width: finalW,
      height: finalH,
      efficiency,
    };
  }

  /**
   * Generates standard Spine / libGDX .atlas text file
   */
  public static createSpineAtlas(
    packedFrames: PackedFrameItem[],
    imageFilename: string,
    atlasWidth: number,
    atlasHeight: number
  ): string {
    const lines: string[] = [];

    lines.push(imageFilename);
    lines.push(`size: ${atlasWidth},${atlasHeight}`);
    lines.push('format: RGBA8888');
    lines.push('filter: Linear,Linear');
    lines.push('repeat: none');

    for (const frame of packedFrames) {
      lines.push(frame.name);
      lines.push('  rotate: false');
      lines.push(`  xy: ${frame.x}, ${frame.y}`);
      lines.push(`  size: ${frame.width}, ${frame.height}`);
      lines.push(`  orig: ${frame.sourceWidth}, ${frame.sourceHeight}`);
      lines.push(`  offset: ${frame.offsetX}, ${frame.sourceHeight - frame.height - frame.offsetY}`);
      lines.push('  index: -1');
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Creates the stitched atlas canvas from an array of frame canvases (Regular Grid)
   */
  public static createAtlasCanvas(
    frames: HTMLCanvasElement[],
    columns: number,
    rows: number,
    frameWidth: number,
    frameHeight: number
  ): HTMLCanvasElement {
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = columns * frameWidth;
    atlasCanvas.height = rows * frameHeight;
    const ctx = atlasCanvas.getContext('2d');
    if (!ctx) return atlasCanvas;

    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);

    const maxFrames = columns * rows;
    for (let idx = 0; idx < frames.length && idx < maxFrames; idx++) {
      const frame = frames[idx];
      const col = idx % columns;
      const row = Math.floor(idx / columns);

      const x = col * frameWidth;
      const y = row * frameHeight;

      ctx.drawImage(frame, 0, 0, frame.width, frame.height, x, y, frameWidth, frameHeight);
    }

    return atlasCanvas;
  }

  /**
   * Converts canvas to PNG blob
   */
  public static canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create canvas blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Generates atlas.json matching the desktop SpriteForge Studio format
   */
  public static createAtlasJson(
    mediaMeta: MediaMetadata,
    settings: AtlasSettings,
    markers: number[],
    cropStart: number,
    cropEnd: number
  ): AtlasMetadataJSON {
    return {
      videoFile: mediaMeta.filename,
      sourceFile: mediaMeta.filename,
      sourceType: mediaMeta.sourceType,
      frameWidth: settings.frameWidth,
      frameHeight: settings.frameHeight,
      columns: settings.columns,
      rows: settings.rows,
      framesCount: markers.length,
      fps: mediaMeta.fps,
      cropStart,
      cropEnd,
      frameIndices: markers,
      pivot: settings.pivot || { x: 0.5, y: 0.95 },
    };
  }

  /**
   * Generates Aseprite-compatible JSON consumed by Phaser, Unity, Defold, and Flame
   */
  public static createAsepriteJson(
    mediaMeta: MediaMetadata,
    settings: AtlasSettings,
    markers: number[],
    animName = 'animation',
    packedFrames?: PackedFrameItem[],
    atlasWidth?: number,
    atlasHeight?: number
  ): any {
    const { frameWidth, frameHeight, columns, rows, fps } = settings;
    const totalFrames = packedFrames ? packedFrames.length : Math.min(markers.length, columns * rows);
    const frameDurationMs = Math.round(1000 / Math.max(1, fps));
    const cleanAnim = animName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'anim';
    const pivot = settings.pivot || { x: 0.5, y: 0.95 };

    const frames: any[] = [];
    for (let i = 0; i < totalFrames; i++) {
      if (packedFrames && packedFrames[i]) {
        const pf = packedFrames[i];
        frames.push({
          filename: pf.name,
          frame: { x: pf.x, y: pf.y, w: pf.width, h: pf.height },
          rotated: false,
          trimmed: pf.trimmed,
          spriteSourceSize: { x: pf.offsetX, y: pf.offsetY, w: pf.width, h: pf.height },
          sourceSize: { w: pf.sourceWidth, h: pf.sourceHeight },
          duration: frameDurationMs,
          pivot: { x: pivot.x, y: pivot.y },
        });
      } else {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * frameWidth;
        const y = row * frameHeight;

        frames.push({
          filename: `${cleanAnim}_${i}`,
          frame: { x, y, w: frameWidth, h: frameHeight },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
          sourceSize: { w: frameWidth, h: frameHeight },
          duration: frameDurationMs,
          pivot: { x: pivot.x, y: pivot.y },
        });
      }
    }

    const finalW = atlasWidth || (columns * frameWidth);
    const finalH = atlasHeight || (rows * frameHeight);

    return {
      frames,
      meta: {
        app: 'SpriteForge',
        version: '2.0',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: {
          w: finalW,
          h: finalH,
        },
        scale: '1',
        frameTags: [
          {
            name: cleanAnim,
            from: 0,
            to: Math.max(0, totalFrames - 1),
            direction: 'forward',
          },
        ],
      },
    };
  }

  /**
   * Generates Aseprite-compatible JSON with multiple frameTags for Master Atlas
   */
  public static createMultiTrackAsepriteJson(
    settings: AtlasSettings,
    tracksMeta: {
      name: string;
      fps: number;
      loop: boolean;
      frameIndices: number[];
    }[],
    atlasFilename = 'atlas.png',
    packedFrames?: PackedFrameItem[],
    atlasWidth?: number,
    atlasHeight?: number
  ): any {
    const { frameWidth, frameHeight, columns, rows } = settings;
    const pivot = settings.pivot || { x: 0.5, y: 0.95 };

    const frames: any[] = [];
    const frameTags: any[] = [];
    let globalIndex = 0;

    tracksMeta.forEach((track) => {
      const startTagIdx = frames.length;
      const cleanAnim = track.name.replace(/[^a-zA-Z0-9_]/g, '_') || 'anim';
      const frameDurationMs = Math.round(1000 / Math.max(1, track.fps || 12));

      track.frameIndices.forEach((frameAtlasIdx, fIdx) => {
        if (packedFrames && packedFrames[globalIndex]) {
          const pf = packedFrames[globalIndex];
          frames.push({
            filename: pf.name,
            frame: { x: pf.x, y: pf.y, w: pf.width, h: pf.height },
            rotated: false,
            trimmed: pf.trimmed,
            spriteSourceSize: { x: pf.offsetX, y: pf.offsetY, w: pf.width, h: pf.height },
            sourceSize: { w: pf.sourceWidth, h: pf.sourceHeight },
            duration: frameDurationMs,
            pivot: { x: pivot.x, y: pivot.y },
          });
        } else {
          const col = frameAtlasIdx % columns;
          const row = Math.floor(frameAtlasIdx / columns);
          const x = col * frameWidth;
          const y = row * frameHeight;

          frames.push({
            filename: `${cleanAnim}_${fIdx}`,
            frame: { x, y, w: frameWidth, h: frameHeight },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight },
            duration: frameDurationMs,
            pivot: { x: pivot.x, y: pivot.y },
          });
        }
        globalIndex++;
      });

      const endTagIdx = frames.length - 1;
      frameTags.push({
        name: cleanAnim,
        from: startTagIdx,
        to: Math.max(startTagIdx, endTagIdx),
        direction: 'forward',
      });
    });

    const finalW = atlasWidth || (columns * frameWidth);
    const finalH = atlasHeight || (rows * frameHeight);

    return {
      frames,
      meta: {
        app: 'SpriteForge',
        version: '2.0',
        image: atlasFilename,
        format: 'RGBA8888',
        size: {
          w: finalW,
          h: finalH,
        },
        scale: '1',
        frameTags,
      },
    };
  }

  /**
   * Helper to trigger download of Blob or Text in browser
   */
  public static triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
