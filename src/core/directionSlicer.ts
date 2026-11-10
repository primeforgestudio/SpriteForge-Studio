import { VideoLoader } from './videoLoader';
import { ImageProcessor } from './imageProcessor';
import { ChromaKeySettings, AnimationTrack } from './types';

export interface DirectionDef {
  key: string;
  name: string;
  label: string;
  icon: string;
  col: number; // 0, 1, 2
  row: number; // 0, 1, 2
}

export const COMPASS_DIRECTIONS_8: DirectionDef[] = [
  { key: 'down', name: 'walk_down', label: 'Front (South)', icon: '⬇', col: 1, row: 2 },
  { key: 'down_left', name: 'walk_down_left', label: 'Front-Left (South-West)', icon: '↙', col: 0, row: 2 },
  { key: 'left', name: 'walk_left', label: 'Left (West)', icon: '⬅', col: 0, row: 1 },
  { key: 'up_left', name: 'walk_up_left', label: 'Back-Left (North-West)', icon: '↖', col: 0, row: 0 },
  { key: 'up', name: 'walk_up', label: 'Back (North)', icon: '⬆', col: 1, row: 0 },
  { key: 'up_right', name: 'walk_up_right', label: 'Back-Right (North-East)', icon: '↗', col: 2, row: 0 },
  { key: 'right', name: 'walk_right', label: 'Right (East)', icon: '➡', col: 2, row: 1 },
  { key: 'down_right', name: 'walk_down_right', label: 'Front-Right (South-East)', icon: '↘', col: 2, row: 2 },
];

export interface SliceEightDirectionsResult {
  tracks: AnimationTrack[];
  uniformCellW: number;
  uniformCellH: number;
}

export class DirectionSlicer {
  /**
   * Automatically detects and slices 8 directional character walk cycles arranged in a 3x3 circle.
   * Scans keyframe samples with chroma key, finds bounding boxes per direction,
   * normalizes all directions to a uniform cell size with bottom-ground anchor,
   * and creates 8 ready-to-use AnimationTracks.
   */
  public static async sliceEightDirections(
    loader: VideoLoader,
    markers: number[],
    keyingSettings: ChromaKeySettings,
    baseFileName: string,
    fileRef?: File,
    fps: number = 24
  ): Promise<SliceEightDirectionsResult | null> {
    if (loader.metadata.totalFrames <= 0 || markers.length === 0) return null;

    const fullW = loader.metadata.width || 1920;
    const fullH = loader.metadata.height || 1080;

    const cellW = Math.floor(fullW / 3);
    const cellH = Math.floor(fullH / 3);

    // Sample up to 6 keyframes evenly across markers for fast & accurate bounding
    const sampleCount = Math.min(6, markers.length);
    const sampleIndices: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor((i * (markers.length - 1)) / Math.max(1, sampleCount - 1));
      sampleIndices.push(markers[idx]);
    }

    interface DirBound {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      found: boolean;
    }

    const bounds: Record<string, DirBound> = {};
    for (const d of COMPASS_DIRECTIONS_8) {
      bounds[d.key] = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        found: false,
      };
    }

    for (const frameIdx of sampleIndices) {
      const raw = await loader.getFrame(frameIdx);
      if (!raw) continue;

      const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
      if (keyingSettings.enabled) {
        ImageProcessor.applyChromaKey(processed, keyingSettings);
      }

      const { data, width } = processed;

      for (const d of COMPASS_DIRECTIONS_8) {
        const xStart = d.col * cellW;
        const xEnd = Math.min(fullW, (d.col + 1) * cellW);
        const yStart = d.row * cellH;
        const yEnd = Math.min(fullH, (d.row + 1) * cellH);

        const b = bounds[d.key];

        for (let y = yStart; y < yEnd; y++) {
          const rowOffset = y * width * 4;
          for (let x = xStart; x < xEnd; x++) {
            const alpha = data[rowOffset + x * 4 + 3];
            if (alpha > 35) {
              if (x < b.minX) b.minX = x;
              if (x > b.maxX) b.maxX = x;
              if (y < b.minY) b.minY = y;
              if (y > b.maxY) b.maxY = y;
              b.found = true;
            }
          }
        }
      }

      await new Promise((r) => setTimeout(r, 0));
    }

    // Determine max character dimensions across all 8 directions
    let maxCharW = 0;
    let maxCharH = 0;

    for (const d of COMPASS_DIRECTIONS_8) {
      const b = bounds[d.key];
      if (b.found && b.maxX > b.minX && b.maxY > b.minY) {
        const w = b.maxX - b.minX + 1;
        const h = b.maxY - b.minY + 1;
        if (w > maxCharW) maxCharW = w;
        if (h > maxCharH) maxCharH = h;
      }
    }

    // Fallbacks if scan found nothing in any cell
    if (maxCharW === 0) maxCharW = Math.round(cellW * 0.7);
    if (maxCharH === 0) maxCharH = Math.round(cellH * 0.85);

    // Add 16% safety padding so arms/feet never touch the edge of the cell
    const roundToMultiple = (v: number, mult = 16) => Math.ceil(v / mult) * mult;
    const paddedW = Math.round(maxCharW * 1.16);
    const paddedH = Math.round(maxCharH * 1.16);

    // Uniform square or clean game-ready cell size:
    // Strictly bounded by cell sector dimensions to prevent vertical row overlaps in 16:9 / non-square video
    const maxSectorDimension = Math.min(cellW, cellH);
    const candidateSize = Math.max(64, roundToMultiple(Math.max(paddedW, paddedH), 16));
    const uniformCellSize = Math.min(maxSectorDimension, candidateSize);
    const uniformCellW = uniformCellSize;
    const uniformCellH = uniformCellSize;

    const cleanBase = baseFileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_') || 'character';

    const timestamp = Date.now();
    const tracks: AnimationTrack[] = [];

    for (let i = 0; i < COMPASS_DIRECTIONS_8.length; i++) {
      const d = COMPASS_DIRECTIONS_8[i];
      const b = bounds[d.key];

      const sectorXStart = d.col * cellW;
      const sectorXEnd = Math.min(fullW, (d.col + 1) * cellW);
      const sectorYStart = d.row * cellH;
      const sectorYEnd = Math.min(fullH, (d.row + 1) * cellH);

      let centerX: number;
      let groundY: number;

      if (b.found && b.maxX > b.minX) {
        centerX = (b.minX + b.maxX) / 2;
        groundY = b.maxY;
      } else {
        // Fallback to center of 3x3 partition
        centerX = sectorXStart + cellW / 2;
        groundY = sectorYEnd - Math.round(cellH * 0.05);
      }

      // Crop box anchored with ground near bottom (90% height)
      let cropX = Math.round(centerX - uniformCellW / 2);
      let cropY = Math.round(groundY - uniformCellH * 0.90);

      // Clamp strictly within this direction's 3x3 sector
      cropX = Math.max(sectorXStart, Math.min(sectorXEnd - uniformCellW, cropX));
      cropY = Math.max(sectorYStart, Math.min(sectorYEnd - uniformCellH, cropY));

      const cropBox = {
        x: cropX,
        y: cropY,
        width: uniformCellW,
        height: uniformCellH,
      };

      tracks.push({
        id: `${timestamp}_dir_${d.key}`,
        name: `${cleanBase}_${d.key}`,
        fileName: baseFileName,
        fileRef,
        totalFrames: loader.metadata.totalFrames,
        cropStart: 0,
        cropEnd: loader.metadata.totalFrames - 1,
        markers: [...markers],
        fps,
        loop: true,
        enabled: true,
        cropBox,
        directionLabel: `${d.icon} ${d.label}`,
      });
    }

    return {
      tracks,
      uniformCellW,
      uniformCellH,
    };
  }
}
