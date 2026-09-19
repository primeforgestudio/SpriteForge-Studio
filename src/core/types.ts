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
  // Keylight 1.2 specific:
  screenBalance: number; // 0..100 (default 50)
  clipBlack: number; // 0..100 (default 0)
  clipWhite: number; // 0..100 (default 100)
  despill: boolean; // default true
  despillAmount: number; // 0..100 (default 100)
  // Garbage Matte (AI Watermarks & Edge Artifacts Cutout)
  garbageMatte?: GarbageMatteSettings;
  // Smart Edge Defringe & Color Reconstruction (CorridorKey method)
  defringe?: boolean; // default true
  defringeRadius?: number; // 1..6 px (default 2)
  defringeStrength?: number; // 0..100% (default 85)
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

export interface AtlasSettings {
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
  collisionSettings?: CollisionSettings;
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
  fileRef?: File;
  thumbnailUrl?: string;
  totalFrames: number;
  cropStart: number;
  cropEnd: number;
  markers: number[];
  fps: number;
  loop: boolean;
  enabled: boolean;
}
