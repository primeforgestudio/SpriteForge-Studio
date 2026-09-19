import { AtlasSettings, ChromaKeySettings, SpritesSettings } from './types';

const STORAGE_KEY = 'converter_atlas_settings_v1';

export interface SavedSettingsState {
  keying: ChromaKeySettings;
  atlas: AtlasSettings;
  sprites: SpritesSettings;
  bgPresets: [number, number, number][];
}

export const DEFAULT_KEYING: ChromaKeySettings = {
  enabled: true,
  algorithm: 'keylight',
  keyColor: [0, 255, 0], // Green default
  gain: 100, // Screen Gain
  screenBalance: 50,
  clipBlack: 0,
  clipWhite: 100,
  despill: true,
  despillAmount: 100,
  soften: 0,
  clip: 0,
  satThresh: 15,
  valThresh: 15,
  erodePx: 0.0,
  blurPx: 0.0,
  garbageMatte: {
    enabled: false,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    feather: 0,
    invert: false,
  },
  defringe: true,
  defringeRadius: 2,
  defringeStrength: 85,
};

export const DEFAULT_ATLAS: AtlasSettings = {
  frameWidth: 512,
  frameHeight: 512,
  columns: 4,
  rows: 4,
  framesCount: 16,
  fps: 30,
  cropBox: null,
  enableShadow: false,
  shadowOpacity: 45,
  shadowScale: 60,
  pivot: { x: 0.5, y: 0.95 },
  enableOnionSkin: false,
  onionOpacity: 35,
  enableGroundSnap: false,
  enableDeFlicker: false,
  deFlickerStrength: 40,
  collisionSettings: {
    enabled: true,
    generateTscn: true,
    feet: {
      enabled: true,
      shape: 'capsule',
      width: 28,
      height: 12,
      offsetX: 0,
      offsetY: -6,
    },
    hurtbox: {
      enabled: true,
      width: 36,
      height: 64,
      offsetX: 0,
      offsetY: -36,
    },
    hitbox: {
      enabled: false,
      width: 32,
      height: 32,
      offsetX: 28,
      offsetY: -32,
    },
  },
};

export const DEFAULT_SPRITES: SpritesSettings = {
  targetWidth: 512,
  targetHeight: 512,
  rename: true,
  prefix: 'char_',
  addBg: false,
  bgColor: [156, 142, 117],
  applyToAll: true,
};

export const DEFAULT_BG_PRESETS: [number, number, number][] = [
  [30, 30, 30],     // Dark gray
  [255, 255, 255], // White
  [0, 0, 0],       // Black
  [0, 255, 0],     // Green screen
  [156, 142, 117], // Sand
];

export class StorageManager {
  public static loadSettings(): SavedSettingsState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          keying: { ...DEFAULT_KEYING, ...parsed.keying },
          atlas: { ...DEFAULT_ATLAS, ...parsed.atlas },
          sprites: { ...DEFAULT_SPRITES, ...parsed.sprites },
          bgPresets: parsed.bgPresets || DEFAULT_BG_PRESETS,
        };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage', e);
    }

    return {
      keying: DEFAULT_KEYING,
      atlas: DEFAULT_ATLAS,
      sprites: DEFAULT_SPRITES,
      bgPresets: DEFAULT_BG_PRESETS,
    };
  }

  public static saveSettings(settings: SavedSettingsState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }

  public static exportSettingsJson(settings: SavedSettingsState): string {
    const payload = {
      keying: {
        gain: settings.keying.gain,
        soften: settings.keying.soften,
        clip: settings.keying.clip,
        sat: settings.keying.satThresh,
        val: settings.keying.valThresh,
        erode: settings.keying.erodePx,
        blur: settings.keying.blurPx,
      },
      colors: {
        key: settings.keying.keyColor,
        bg: settings.sprites.bgColor,
        bgPresets: settings.bgPresets,
      },
      atlas: {
        width: settings.atlas.frameWidth,
        height: settings.atlas.frameHeight,
        cols: settings.atlas.columns,
        rows: settings.atlas.rows,
        frames: settings.atlas.framesCount,
        fps: settings.atlas.fps,
      },
      sprites: {
        width: settings.sprites.targetWidth,
        height: settings.sprites.targetHeight,
        rename: settings.sprites.rename,
        prefix: settings.sprites.prefix,
        addBg: settings.sprites.addBg,
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  public static parseSettingsJson(jsonStr: string, current: SavedSettingsState): SavedSettingsState {
    try {
      const parsed = JSON.parse(jsonStr);
      const updated: SavedSettingsState = { ...current };

      if (parsed.keying) {
        updated.keying = {
          ...updated.keying,
          gain: parsed.keying.gain ?? updated.keying.gain,
          soften: parsed.keying.soften ?? updated.keying.soften,
          clip: parsed.keying.clip ?? updated.keying.clip,
          satThresh: parsed.keying.sat ?? updated.keying.satThresh,
          valThresh: parsed.keying.val ?? updated.keying.valThresh,
          erodePx: parsed.keying.erode ?? updated.keying.erodePx,
          blurPx: parsed.keying.blur ?? updated.keying.blurPx,
        };
      }

      if (parsed.colors) {
        if (parsed.colors.key) updated.keying.keyColor = parsed.colors.key;
        if (parsed.colors.bg) updated.sprites.bgColor = parsed.colors.bg;
        if (parsed.colors.bgPresets) updated.bgPresets = parsed.colors.bgPresets;
      }

      if (parsed.atlas) {
        updated.atlas = {
          ...updated.atlas,
          frameWidth: parsed.atlas.width ?? updated.atlas.frameWidth,
          frameHeight: parsed.atlas.height ?? updated.atlas.frameHeight,
          columns: parsed.atlas.cols ?? updated.atlas.columns,
          rows: parsed.atlas.rows ?? updated.atlas.rows,
          framesCount: parsed.atlas.frames ?? updated.atlas.framesCount,
          fps: parsed.atlas.fps ?? updated.atlas.fps,
        };
      }

      if (parsed.sprites) {
        updated.sprites = {
          ...updated.sprites,
          targetWidth: parsed.sprites.width ?? updated.sprites.targetWidth,
          targetHeight: parsed.sprites.height ?? updated.sprites.targetHeight,
          rename: parsed.sprites.rename ?? updated.sprites.rename,
          prefix: parsed.sprites.prefix ?? updated.sprites.prefix,
          addBg: parsed.sprites.addBg ?? updated.sprites.addBg,
        };
      }

      return updated;
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }
}
