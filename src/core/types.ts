export type AppMode = 'atlas' | 'sprites';

export type BackgroundMode = 'checkerboard' | 'solid';

export interface ChromaKeySettings {
  enabled: boolean;
  algorithm: 'keylight' | 'classic';
  keyColor: [number, number, number]; // [R, G, B] in 0..255
  gain: number; // 0..100 (Screen Gain / Tolerance)
  soften: number; // 0..100
  clip: number; // -100..100 (Gamma)
  satThresh: number; // 0..100
  valThresh: number; // 0..100
  erodePx: number; // 0..5 (float)
  blurPx: number; // 0..10 (float)
  // KeyForge specific:
  screenBalance: number; // 0..100 (default 50)
  clipBlack: number; // 0..100 (default 0)
  clipWhite: number; // 0..100 (default 100)
  despill: boolean; // default true
  despillAmount: number; // 0..100 (default 100)
  despillWarmSafe?: boolean; // Protects red cloth and skin from turning khaki (default true)
  khakiSuppress?: number; // 0..100: Suppresses dark khaki/shadow green in crumbling holes & gaps
  // Secondary Key Color (for dark crevices, shadow green, or crumbling gaps)
  secondaryKey?: {
    enabled: boolean;
    color: [number, number, number];
    gain: number;
  };
  // Garbage Matte (AI Watermarks & Edge Artifacts Cutout)
  garbageMatte?: GarbageMatteSettings;
  // Smart Edge Defringe & Color Reconstruction
  defringe?: boolean; // default true
  defringeRadius?: number; // 1..6 px (default 2)
  defringeStrength?: number; // 0..100% (default 85)
  // Topological Border Clean (BFS flood-fill noise/halo eliminator)
  enableBorderClean?: boolean; // default true
  borderCleanThreshold?: number; // 10..120, default 45
}

export interface GarbageMatteSettings {
  enabled: boolean;
  x: number; // 0..1 normalized (left)
  y: number; // 0..1 normalized (top)
  width: number; // 0..1 normalized (width)
  height: number; // 0..1 normalized (height)
  feather: number; // 0..30 px edge softness
  invert?: boolean; // cut inside instead of outside
}

export interface PackedFrameItem {
  name: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  offsetX: number;
  offsetY: number;
  trimmed: boolean;
}

export interface AtlasSettings {
  layoutMode?: 'grid' | 'advanced'; // 'grid' (regular NxM) or 'advanced' (Spine/MaxRects bin-packing with whitespace trimming)
  packPadding?: number; // padding in px between packed sprites (default 2)
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  framesCount: number;
  fps: number;
  cropBox?: { x: number; y: number; width: number; height: number } | null;
  enableShadow?: boolean;
  shadowOpacity?: number; // 0..100, default 40
  shadowScale?: number; // 20..100, default 60
  pivot?: { x: number; y: number }; // 0..1, default { x: 0.5, y: 0.95 }
  enableOnionSkin?: boolean;
  onionOpacity?: number; // 10..80, default 35
  enableGroundSnap?: boolean;
  enableDeFlicker?: boolean;
  deFlickerStrength?: number; // 0..100, default 40
  // In-Place Centering / Root Motion (AI Walk/Run drift stabilizer)
  enableInPlace?: boolean;
  inPlaceLockAxis?: 'x' | 'xy'; // default 'x'
  collisionSettings?: CollisionSettings;
  // 2D Mesh & Overdraw Optimizer (iGaming / Mobile)
  meshSettings?: MeshSettings;
  // ✂️ Duplicate Frame Eliminator (reduces atlas texture size by up to 40%)
  eliminateDuplicates?: boolean;
  duplicateThreshold?: number; // 0..1 (default 0.992)
  // 🗜️ PNG-8 NeuQuant Palette Quantizer (60-80% smaller PNG)
  enablePng8?: boolean;
  png8Colors?: number; // default 256
  png8Dither?: boolean; // default true
  // 💡 2D PBR Pack (Normal + Emission + Roughness)
  generatePbrPack?: boolean;
  emissionThreshold?: number; // 0..255 (default 180)
  roughnessGloss?: number; // 0..100 (default 50)
  // 🔄 Seamless Loop Synthesizer
  enableLoopBlend?: boolean;
  loopBlendFrames?: number; // 1..8 (default 3)
  // 👾 Retro Pixel-Art Quantizer
  pixelArtSettings?: PixelArtSettings;
}

export interface PixelArtSettings {
  enabled: boolean;
  targetResolution: number; // 32, 48, 64, 96, 128
  palette: 'none' | 'pico8' | 'gameboy' | 'db32' | 'endesga32';
  dither: boolean;
  outline?: boolean;
}

export interface MeshSettings {
  enabled: boolean;
  detail: 'low' | 'balanced' | 'high'; // low: ~18v, balanced: ~36v, high: ~64v
  paddingPx: number; // 0..5 px (default 2)
  alphaThreshold: number; // 1..50 (default 15)
  showWireframe?: boolean;
}

export interface SpriteMesh {
  vertices: [number, number][]; // [x, y] in pixels
  normalizedVertices: [number, number][]; // [x, y] in 0..1
  uvs: [number, number][]; // [u, v] in 0..1
  indices: number[]; // triangle vertex indices [i0, i1, i2, ...]
  vertexCount: number;
  triangleCount: number;
  areaSavingsPercent: number; // percentage of quad area eliminated
}

export interface RootMotionFrame {
  frame: number;
  dx: number;
  dy: number;
  totalX: number;
  totalY: number;
}

export interface ChromaPreset {
  id: string;
  name: string;
  desc?: string;
  settings: Partial<ChromaKeySettings>;
  isCustom?: boolean;
}

export interface CollisionSettings {
  enabled: boolean;
  generateTscn: boolean;
  feet: {
    enabled: boolean;
    shape: 'capsule' | 'rectangle';
    width: number; // in pixels
    height: number; // in pixels
    offsetX: number; // in pixels from pivot
    offsetY: number; // in pixels from pivot
  };
  hurtbox: {
    enabled: boolean;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  hitbox: {
    enabled: boolean;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface SpriteTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SpritesSettings {
  targetWidth: number;
  targetHeight: number;
  rename: boolean;
  prefix: string;
  addBg: boolean;
  bgColor: [number, number, number];
  applyToAll: boolean;
}

export interface MediaMetadata {
  filename: string;
  sourceType: 'video' | 'png_sequence' | 'image_list';
  width: number;
  height: number;
  duration: number;
  fps: number;
  totalFrames: number;
}

export interface AtlasMetadataJSON {
  videoFile: string;
  sourceFile: string;
  sourceType: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  framesCount: number;
  fps: number;
  cropStart: number;
  cropEnd: number;
  frameIndices: number[];
  pivot?: { x: number; y: number };
}

export type ExportScope = 'single' | 'master';

export interface AnimationTrack {
  id: string;
  name: string; // Animation identifier (e.g. "idle", "run", "attack")
  fileName: string;
  filePath?: string;
  fileRef?: File;
  mediaBase64?: string;
  thumbnailUrl?: string;
  totalFrames: number;
  cropStart: number;
  cropEnd: number;
  markers: number[];
  fps: number;
  loop: boolean;
  enabled: boolean;
  cropBox?: { x: number; y: number; width: number; height: number } | null;
  directionLabel?: string;
}

export interface SpriteForgeProject {
  format: 'spriteforge-project';
  version: '1.0.0';
  name: string;
  savedAt: string;
  appMode: AppMode;
  exportScope: ExportScope;
  exportFilename: string;
  keyingSettings: ChromaKeySettings;
  atlasSettings: AtlasSettings;
  spritesSettings: SpritesSettings;
  tracks: Array<{
    id: string;
    name: string;
    fileName: string;
    filePath?: string;
    mediaBase64?: string;
    thumbnailUrl?: string;
    totalFrames: number;
    cropStart: number;
    cropEnd: number;
    markers: number[];
    fps: number;
    loop: boolean;
    enabled: boolean;
    cropBox?: { x: number; y: number; width: number; height: number } | null;
    directionLabel?: string;
  }>;
  selectedTrackId?: string;
  currentFrame?: number;
  maskFilename?: string;
  invertMask?: boolean;
}
