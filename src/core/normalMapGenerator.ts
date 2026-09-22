/**
 * NormalMapGenerator: Algorithmic 2D Normal Map generator for Godot 4 & Unity dynamic lighting
 * Uses Sobel operator on combined luminance and alpha contours
 */
export class NormalMapGenerator {
  /**
   * Generates a tangent-space 2D Normal Map from a diffuse texture canvas (atlas).
   * Encodes normal vectors into RGB [128, 128, 255] with matching alpha channel.
   */
  public static generateNormalMap(
    sourceCanvas: HTMLCanvasElement,
    bumpStrength = 2.5,
    invertY = false
  ): HTMLCanvasElement {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    const srcData = ctx.getImageData(0, 0, w, h);
    const src = srcData.data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return sourceCanvas;
    const outData = outCtx.createImageData(w, h);
    const out = outData.data;

    // 1. Build height map buffer (0..1) combining luminance and alpha contour
    const heightMap = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const a = src[idx + 3] / 255.0;
      if (a <= 0.02) {
        heightMap[i] = 0;
      } else {
        // Luminance (perceived brightness)
        const lum =
          (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255.0;
        // Combine interior luminance with alpha edge falloff for relief
        heightMap[i] = lum * 0.6 + a * 0.4;
      }
    }

    // 2. Sobel kernel convolution for gradients
    const strength = Math.max(0.5, Math.min(10.0, bumpStrength));
    const yMult = invertY ? -1 : 1;

    for (let y = 0; y < h; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(h - 1, y + 1);

      for (let x = 0; x < w; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(w - 1, x + 1);
        const centerIdx = (y * w + x) * 4;
        const alpha = src[centerIdx + 3];

        if (alpha <= 5) {
          // Transparent pixel: neutral flat normal (0, 0, 1) -> RGB(128, 128, 255)
          out[centerIdx] = 128;
          out[centerIdx + 1] = 128;
          out[centerIdx + 2] = 255;
          out[centerIdx + 3] = 0;
          continue;
        }

        // Sample 3x3 neighborhood heights
        const tl = heightMap[yPrev * w + xPrev];
        const tc = heightMap[yPrev * w + x];
        const tr = heightMap[yPrev * w + xNext];
        const ml = heightMap[y * w + xPrev];
        const mr = heightMap[y * w + xNext];
        const bl = heightMap[yNext * w + xPrev];
        const bc = heightMap[yNext * w + x];
        const br = heightMap[yNext * w + xNext];

        // Sobel filter for horizontal (dX) and vertical (dY) gradients
        const dx = tr + 2 * mr + br - (tl + 2 * ml + bl);
        const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * yMult;

        // Construct 3D normal vector [-dx * strength, -dy * strength, 1.0]
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1.0;

        // Normalize vector
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
        const normX = nx / len;
        const normY = ny / len;
        const normZ = nz / len;

        // Encode [-1..1] to [0..255] RGB
        out[centerIdx] = Math.round((normX * 0.5 + 0.5) * 255);
        out[centerIdx + 1] = Math.round((normY * 0.5 + 0.5) * 255);
        out[centerIdx + 2] = Math.round((normZ * 0.5 + 0.5) * 255);
        out[centerIdx + 3] = alpha; // Preserve exact character silhouette
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  /**
   * Applies dynamic 2.5D point lighting to a diffuse sprite canvas using its normal map.
   * Computes diffuse shading (N . L), radial distance attenuation, and specular highlights in real time.
   */
  public static applyDynamicLight(
    diffuseCanvas: HTMLCanvasElement,
    normalCanvas: HTMLCanvasElement,
    lightX: number,
    lightY: number,
    lightZ = 60,
    lightRadius = 350,
    lightColor: [number, number, number] = [255, 240, 210],
    intensity = 1.3,
    ambient = 0.35,
    roughnessCanvas?: HTMLCanvasElement | null,
    emissionCanvas?: HTMLCanvasElement | null
  ): HTMLCanvasElement {
    const w = diffuseCanvas.width;
    const h = diffuseCanvas.height;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;

    const outCtx = outCanvas.getContext('2d');
    const diffCtx = diffuseCanvas.getContext('2d');
    const normCtx = normalCanvas.getContext('2d');
    if (!outCtx || !diffCtx || !normCtx) return diffuseCanvas;

    const diffData = diffCtx.getImageData(0, 0, w, h).data;
    const normData = normCtx.getImageData(0, 0, w, h).data;
    const roughData = roughnessCanvas ? roughnessCanvas.getContext('2d')?.getImageData(0, 0, w, h).data : null;
    const emitData = emissionCanvas ? emissionCanvas.getContext('2d')?.getImageData(0, 0, w, h).data : null;

    const outImg = outCtx.createImageData(w, h);
    const out = outImg.data;

    const rCol = lightColor[0] / 255;
    const gCol = lightColor[1] / 255;
    const bCol = lightColor[2] / 255;
    const radiusSq = lightRadius * lightRadius;

    for (let y = 0; y < h; y++) {
      const dy = lightY - y;
      const dySq = dy * dy;

      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = diffData[idx + 3];

        if (alpha <= 5) {
          out[idx + 3] = 0;
          continue;
        }

        const dx = lightX - x;
        const distSq = dx * dx + dySq;

        // Radial falloff attenuation
        let atten = 0;
        if (distSq < radiusSq) {
          const d = Math.sqrt(distSq);
          atten = Math.max(0, 1.0 - d / lightRadius);
          atten = atten * atten; // Smooth quadratic falloff
        }

        // Normal vector from normal map [0..255] -> [-1..1]
        const nx = (normData[idx] / 255.0) * 2.0 - 1.0;
        const ny = (normData[idx + 1] / 255.0) * 2.0 - 1.0;
        const nz = (normData[idx + 2] / 255.0) * 2.0 - 1.0;

        // Light direction vector
        const lLen = Math.sqrt(distSq + lightZ * lightZ) || 1.0;
        const lx = dx / lLen;
        const ly = dy / lLen;
        const lz = lightZ / lLen;

        // Dot product N . L (diffuse)
        const dot = Math.max(0, nx * lx + ny * ly + nz * lz);
        const diffuseFactor = dot * atten * intensity;

        // Specular highlight (Blinn-Phong modulated by Roughness)
        const hx = lx;
        const hy = ly;
        const hz = lz + 1.0;
        const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1.0;
        const specDot = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);

        let shininess = 24;
        let specIntensity = 0.45;
        if (roughData) {
          const rough = roughData[idx] / 255.0; // 0 (glossy) .. 1 (matte)
          shininess = Math.max(8, (1.0 - rough) * 80 + 8);
          specIntensity = Math.max(0.05, (1.0 - rough) * 0.9);
        }
        const specular = Math.pow(specDot, shininess) * atten * specIntensity;

        // Combine ambient + diffuse + specular
        const litFactorR = Math.min(1.8, ambient + diffuseFactor * rCol);
        const litFactorG = Math.min(1.8, ambient + diffuseFactor * gCol);
        const litFactorB = Math.min(1.8, ambient + diffuseFactor * bCol);

        let finalR = diffData[idx] * litFactorR + specular * 255 * rCol;
        let finalG = diffData[idx + 1] * litFactorG + specular * 255 * gCol;
        let finalB = diffData[idx + 2] * litFactorB + specular * 255 * bCol;

        // Add emission glow if present
        if (emitData && emitData[idx + 3] > 10) {
          finalR = Math.min(255, finalR + emitData[idx] * 0.85);
          finalG = Math.min(255, finalG + emitData[idx + 1] * 0.85);
          finalB = Math.min(255, finalB + emitData[idx + 2] * 0.85);
        }

        out[idx] = Math.min(255, Math.round(finalR));
        out[idx + 1] = Math.min(255, Math.round(finalG));
        out[idx + 2] = Math.min(255, Math.round(finalB));
        out[idx + 3] = alpha;
      }
    }

    outCtx.putImageData(outImg, 0, 0);
    return outCanvas;
  }
}
