/**
 * SpriteForge Studio - 2D PBR Texture Generator (Godot 4, Unity URP 2D, Unreal 5)
 * Generates complete PBR texture sets from 2D sprites:
 * 1. Tangent-space Normal Maps (_normal.png)
 * 2. Emission / Glow Maps (_emission.png) for neon, eyes, magic runes, and lasers
 * 3. Roughness / Specular Maps (_roughness.png) for metal, gems, and matte fabrics
 */

import { NormalMapGenerator } from './normalMapGenerator';

export interface PbrSettings {
  bumpStrength?: number; // 0.5..10, default 2.5
  invertY?: boolean;
  emissionThreshold?: number; // 100..250, default 180
  emissionBoost?: number; // 1.0..3.0, default 1.5
  roughnessGloss?: number; // 0..100, default 50
}

export interface PbrPackResult {
  normalCanvas: HTMLCanvasElement;
  roughnessCanvas: HTMLCanvasElement;
  emissionCanvas: HTMLCanvasElement;
}

export class PbrGenerator {
  /**
   * Generates a complete 2D PBR texture pack (Normal, Roughness, Emission)
   */
  public static generatePbrPack(
    sourceCanvas: HTMLCanvasElement,
    settings?: PbrSettings
  ): PbrPackResult {
    const normalCanvas = NormalMapGenerator.generateNormalMap(
      sourceCanvas,
      settings?.bumpStrength ?? 2.5,
      settings?.invertY ?? false
    );

    const roughnessCanvas = this.generateRoughnessMap(
      sourceCanvas,
      settings?.roughnessGloss ?? 50
    );

    const emissionCanvas = this.generateEmissionMap(
      sourceCanvas,
      settings?.emissionThreshold ?? 180,
      settings?.emissionBoost ?? 1.5
    );

    return {
      normalCanvas,
      roughnessCanvas,
      emissionCanvas,
    };
  }

  /**
   * Generates an Emission Map (_emission.png)
   * Isolates glowing elements (eyes, neon, magic runes, gems, lasers) onto transparent black.
   */
  public static generateEmissionMap(
    sourceCanvas: HTMLCanvasElement,
    threshold = 180,
    boost = 1.5
  ): HTMLCanvasElement {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;

    if (!ctx || w <= 0 || h <= 0) return outCanvas;

    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;
    const outData = outCtx.createImageData(w, h);
    const out = outData.data;

    const cutoff = Math.max(80, Math.min(250, threshold));

    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3];
      if (a < 10) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
        continue;
      }

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Emissive test: high luminance OR saturated neon highlight
      const isBright = lum >= cutoff;
      const isNeonGlow = maxC >= 170 && sat >= 0.65;

      if (isBright || isNeonGlow) {
        const factor = isBright ? Math.min(2.5, 1.0 + ((lum - cutoff) / (255 - cutoff)) * (boost - 1.0)) : boost;
        out[i] = Math.min(255, Math.round(r * factor));
        out[i + 1] = Math.min(255, Math.round(g * factor));
        out[i + 2] = Math.min(255, Math.round(b * factor));
        out[i + 3] = a;
      } else {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0; // Black / transparent for non-emissive
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  /**
   * Generates a Roughness Map (_roughness.png)
   * Dark pixels = low roughness / high gloss (metals, reflective eyes, shiny gems)
   * Light pixels = high roughness / matte (fabrics, skin, stone)
   */
  public static generateRoughnessMap(
    sourceCanvas: HTMLCanvasElement,
    glossStrength = 50
  ): HTMLCanvasElement {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;

    if (!ctx || w <= 0 || h <= 0) return outCanvas;

    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;
    const outData = outCtx.createImageData(w, h);
    const out = outData.data;

    const glossFactor = Math.max(0.1, Math.min(2.0, glossStrength / 50));

    // Compute luminance map for gradient analysis
    const lumMap = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      lumMap[i] = (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255.0;
    }

    for (let y = 0; y < h; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(h - 1, y + 1);

      for (let x = 0; x < w; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(w - 1, x + 1);

        const centerIdx = (y * w + x) * 4;
        const alpha = src[centerIdx + 3];

        if (alpha < 10) {
          out[centerIdx] = 255;
          out[centerIdx + 1] = 255;
          out[centerIdx + 2] = 255;
          out[centerIdx + 3] = 0;
          continue;
        }

        const r = src[centerIdx];
        const g = src[centerIdx + 1];
        const b = src[centerIdx + 2];
        const lum = lumMap[y * w + x];

        // Edge gradient (specular sheen on metallic/sharp contours)
        const dx = lumMap[y * w + xNext] - lumMap[y * w + xPrev];
        const dy = lumMap[yNext * w + x] - lumMap[yPrev * w + x];
        const edgeMagnitude = Math.sqrt(dx * dx + dy * dy);

        // Saturation check: low saturation + high brightness indicates metallic highlight
        const maxC = Math.max(r, g, b) / 255.0;
        const minC = Math.min(r, g, b) / 255.0;
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

        // Base roughness: default matte ~0.75
        let roughness = 0.78;

        // Metallic/specular highlight reduction (lower roughness)
        if (lum > 0.65 && sat < 0.35) {
          // Bright highlight -> very glossy
          roughness -= 0.55 * glossFactor;
        } else if (edgeMagnitude > 0.18) {
          // Bevel edge highlight
          roughness -= 0.35 * glossFactor;
        } else if (sat > 0.7) {
          // Pure saturated color (paint / armor)
          roughness -= 0.15 * glossFactor;
        }

        const val = Math.max(25, Math.min(245, Math.round(roughness * 255)));

        out[centerIdx] = val;
        out[centerIdx + 1] = val;
        out[centerIdx + 2] = val;
        out[centerIdx + 3] = alpha;
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }
}

export { NormalMapGenerator };
