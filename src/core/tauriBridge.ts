import { invoke } from '@tauri-apps/api/core';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export class TauriBridge {
  public static async ping(): Promise<string> {
    if (!isTauriEnvironment()) {
      return 'Web Fallback';
    }
    try {
      return await invoke<string>('ping_engine');
    } catch (err) {
      console.warn('[TauriBridge] Ping error:', err);
      return 'Tauri Unavailable';
    }
  }

  /**
   * Fast native Normal Map generation in Rust (multi-threaded Sobel)
   */
  public static async generateNormalMap(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    bumpStrength: number = 2.5,
    invertY: boolean = false
  ): Promise<Uint8Array | null> {
    if (!isTauriEnvironment()) return null;
    try {
      const buffer = Array.from(rgba);
      const res = await invoke<number[]>('generate_normal_map_cmd', {
        rgba: buffer,
        width,
        height,
        bumpStrength,
        invertY,
      });
      return new Uint8Array(res);
    } catch (err) {
      console.error('[TauriBridge] generateNormalMap failed, using fallback:', err);
      return null;
    }
  }

  /**
   * Fast native PBR maps generation in Rust
   */
  public static async generatePbrMaps(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    bumpStrength: number = 2.5,
    emissionThreshold: number = 180,
    roughnessGloss: number = 50
  ): Promise<{ normal: Uint8Array; roughness: Uint8Array; emission: Uint8Array } | null> {
    if (!isTauriEnvironment()) return null;
    try {
      const buffer = Array.from(rgba);
      const res = await invoke<{
        normal_rgba: number[];
        roughness_rgba: number[];
        emission_rgba: number[];
      }>('generate_pbr_maps_cmd', {
        rgba: buffer,
        width,
        height,
        bumpStrength,
        emissionThreshold,
        roughnessGloss,
      });
      return {
        normal: new Uint8Array(res.normal_rgba),
        roughness: new Uint8Array(res.roughness_rgba),
        emission: new Uint8Array(res.emission_rgba),
      };
    } catch (err) {
      console.error('[TauriBridge] generatePbrMaps failed, using fallback:', err);
      return null;
    }
  }

  /**
   * Fast native 2D Silhouette Mesh generation in Rust
   */
  public static async generateMesh(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    alphaThreshold: number = 15,
    padding: number = 2
  ): Promise<any | null> {
    if (!isTauriEnvironment()) return null;
    try {
      const buffer = Array.from(rgba);
      return await invoke('generate_mesh_cmd', {
        rgba: buffer,
        width,
        height,
        alphaThreshold,
        padding,
      });
    } catch (err) {
      console.error('[TauriBridge] generateMesh failed:', err);
      return null;
    }
  }
}
