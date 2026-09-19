import { AtlasMetadataJSON, AtlasSettings, MediaMetadata } from './types';

export class AtlasBuilder {
  /**
   * Creates the stitched atlas canvas from an array of frame canvases
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
   * Generates atlas.json matching the desktop ConverterAtlas format
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
    animName = 'animation'
  ): any {
    const { frameWidth, frameHeight, columns, rows, fps } = settings;
    const totalFrames = Math.min(markers.length, columns * rows);
    const frameDurationMs = Math.round(1000 / Math.max(1, fps));
    const cleanAnim = animName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'anim';
    const pivot = settings.pivot || { x: 0.5, y: 0.95 };

    const frames: any[] = [];
    for (let i = 0; i < totalFrames; i++) {
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

    return {
      frames,
      meta: {
        app: 'SpriteForge',
        version: '2.0',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: {
          w: columns * frameWidth,
          h: rows * frameHeight,
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
    atlasFilename = 'atlas.png'
  ): any {
    const { frameWidth, frameHeight, columns, rows } = settings;
    const pivot = settings.pivot || { x: 0.5, y: 0.95 };

    const frames: any[] = [];
    const frameTags: any[] = [];

    tracksMeta.forEach((track) => {
      const startTagIdx = frames.length;
      const cleanAnim = track.name.replace(/[^a-zA-Z0-9_]/g, '_') || 'anim';
      const frameDurationMs = Math.round(1000 / Math.max(1, track.fps || 12));

      track.frameIndices.forEach((frameAtlasIdx, fIdx) => {
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
      });

      const endTagIdx = frames.length - 1;
      frameTags.push({
        name: cleanAnim,
        from: startTagIdx,
        to: Math.max(startTagIdx, endTagIdx),
        direction: 'forward',
      });
    });

    return {
      frames,
      meta: {
        app: 'SpriteForge',
        version: '2.0',
        image: atlasFilename,
        format: 'RGBA8888',
        size: {
          w: columns * frameWidth,
          h: rows * frameHeight,
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
