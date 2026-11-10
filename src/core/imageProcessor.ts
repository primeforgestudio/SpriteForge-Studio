import { ChromaKeySettings, GarbageMatteSettings } from './types';

export class ImageProcessor {
  /**
   * Converts RGB [0..255] to OpenCV-style HSV:
   * H: [0..180], S: [0..255], V: [0..255]
   */
  public static rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta > 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * ((b - r) / delta + 2);
      } else {
        h = 60 * ((r - g) / delta + 4);
      }
      if (h < 0) h += 360;
    }
    const hCv = h * 0.5; // [0..180]
    const sCv = max === 0 ? 0 : (delta / max) * 255;
    const vCv = max;
    return [hCv, sCv, vCv];
  }

  private static cachedAlphaBuffer: Float32Array | null = null;
  private static getAlphaBuffer(size: number): Float32Array {
    if (!this.cachedAlphaBuffer || this.cachedAlphaBuffer.length < size) {
      this.cachedAlphaBuffer = new Float32Array(size);
    }
    return this.cachedAlphaBuffer;
  }

  /**
   * Main Chroma Key entry point - KeyForge Color Difference Keying
   */
  public static applyChromaKey(
    imageData: ImageData,
    settings: ChromaKeySettings,
    skipDefringe = false
  ): ImageData {
    if (!settings.enabled && !settings.garbageMatte?.enabled) {
      return imageData;
    }
    let result = imageData;
    if (settings.enabled) {
      result = this.applyKeyForge(imageData, settings);
      if (settings.defringe && !skipDefringe) {
        this.applySmartDefringe(
          result,
          settings.defringeRadius ?? 2,
          (settings.defringeStrength ?? 85) / 100
        );
      }
      if (settings.enableBorderClean ?? true) {
        this.applyTopologicalBorderClean(
          result,
          settings.borderCleanThreshold ?? 45
        );
      }
    }
    if (settings.garbageMatte?.enabled) {
      this.applyGarbageMatte(result, settings.garbageMatte);
    }
    return result;
  }

  /**
   * Smart Edge Defringe & Inward Color Reconstruction.
   * Eliminates green/dark fringe halos along hair, swords, fur, and thin silhouettes
   * by reconstructing edge pixel colors from nearest solid interior pixels (alpha >= 230).
   * Crucially, leaves anti-aliased subpixel alpha intact so fine details are preserved.
   */
  public static applySmartDefringe(
    imageData: ImageData,
    radius: number = 2,
    strength: number = 0.85,
    solidThreshold: number = 230
  ): ImageData {
    if (radius <= 0 || strength <= 0) return imageData;

    const { width, height, data } = imageData;
    const rInt = Math.max(1, Math.min(6, Math.round(radius)));
    const rSq = rInt * rInt;
    const srcData = new Uint8ClampedArray(data);

    // Pre-calculate kernel offsets and inverse distance weights
    const kernel: { dx: number; dy: number; weight: number }[] = [];
    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 <= rSq) {
          kernel.push({
            dx,
            dy,
            weight: 1.0 / (Math.sqrt(d2) + 0.1),
          });
        }
      }
    }

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 4;
        const a = srcData[idx + 3];

        // Skip completely transparent pixels
        if (a === 0) continue;

        // Determine if pixel is on the fringe:
        // Either semi-transparent (a < solidThreshold),
        // or a near-edge solid pixel with at least one transparent neighbor
        let isEdge = a < solidThreshold;
        if (!isEdge) {
          const leftA = x > 0 ? srcData[idx - 4 + 3] : 0;
          const rightA = x < width - 1 ? srcData[idx + 4 + 3] : 0;
          const topA = y > 0 ? srcData[idx - width * 4 + 3] : 0;
          const bottomA = y < height - 1 ? srcData[idx + width * 4 + 3] : 0;
          if (leftA < 128 || rightA < 128 || topA < 128 || bottomA < 128) {
            isEdge = true;
          }
        }

        if (!isEdge) continue;

        // Search kernel for solid interior pixels
        let accumR = 0;
        let accumG = 0;
        let accumB = 0;
        let totalWeight = 0;

        for (let k = 0; k < kernel.length; k++) {
          const nx = x + kernel[k].dx;
          const ny = y + kernel[k].dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const nIdx = (ny * width + nx) * 4;
          const na = srcData[nIdx + 3];
          if (na >= solidThreshold) {
            const w = kernel[k].weight;
            accumR += srcData[nIdx] * w;
            accumG += srcData[nIdx + 1] * w;
            accumB += srcData[nIdx + 2] * w;
            totalWeight += w;
          }
        }

        if (totalWeight > 0) {
          const recR = accumR / totalWeight;
          const recG = accumG / totalWeight;
          const recB = accumB / totalWeight;

          // Blend factor: stronger on more transparent fringe pixels
          const alphaFactor = 1.0 - (a / 255.0) * 0.4;
          const blend = Math.max(0, Math.min(1, strength * alphaFactor));

          data[idx] = Math.round(srcData[idx] * (1 - blend) + recR * blend);
          data[idx + 1] = Math.round(srcData[idx + 1] * (1 - blend) + recG * blend);
          data[idx + 2] = Math.round(srcData[idx + 2] * (1 - blend) + recB * blend);
        }
      }
    }

    return imageData;
  }

  /**
   * Topological 4-Way BFS Outer Perimeter Flood Clean.
   * Starts exclusively from outer border pixels (x=0, x=W-1, y=0, y=H-1) and
   * floods through low-alpha noise and residual compression halo artifacts.
   * Cleans floating debris completely to alpha=0, while strictly stopping
   * at solid character silhouettes (alpha >= threshold). Internal enclosed cavities
   * (e.g. gaps between character arms and torso) are never reached or modified!
   */
  public static applyTopologicalBorderClean(
    imageData: ImageData,
    alphaThreshold: number = 45
  ): ImageData {
    const { data, width, height } = imageData;
    const total = width * height;
    if (total === 0) return imageData;

    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    // 1. Seed border pixels into BFS queue
    for (let x = 0; x < width; x++) {
      const topIdx = x;
      const btmIdx = (height - 1) * width + x;
      if (data[topIdx * 4 + 3] < 220) {
        visited[topIdx] = 1;
        queue[tail++] = topIdx;
      }
      if (data[btmIdx * 4 + 3] < 220) {
        visited[btmIdx] = 1;
        queue[tail++] = btmIdx;
      }
    }
    for (let y = 1; y < height - 1; y++) {
      const leftIdx = y * width;
      const rightIdx = y * width + (width - 1);
      if (!visited[leftIdx] && data[leftIdx * 4 + 3] < 220) {
        visited[leftIdx] = 1;
        queue[tail++] = leftIdx;
      }
      if (!visited[rightIdx] && data[rightIdx * 4 + 3] < 220) {
        visited[rightIdx] = 1;
        queue[tail++] = rightIdx;
      }
    }

    // 2. BFS traversal inward through background fringe
    while (head < tail) {
      const idx = queue[head++];
      const pAlpha = data[idx * 4 + 3];

      // If connected to outer boundary and below threshold, zero it completely
      if (pAlpha < alphaThreshold) {
        data[idx * 4 + 3] = 0;
      }

      const px = idx % width;
      const py = (idx / width) | 0;

      // 4 neighbors
      if (py > 0) {
        const n = idx - width;
        if (!visited[n] && data[n * 4 + 3] < alphaThreshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (py < height - 1) {
        const n = idx + width;
        if (!visited[n] && data[n * 4 + 3] < alphaThreshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (px > 0) {
        const n = idx - 1;
        if (!visited[n] && data[n * 4 + 3] < alphaThreshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (px < width - 1) {
        const n = idx + 1;
        if (!visited[n] && data[n * 4 + 3] < alphaThreshold) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    return imageData;
  }

  /**
   * Applies Garbage Matte cutout mask to an ImageData buffer.
   * Pixels outside (or inside if inverted) the matte bounding box are zeroed out (alpha = 0).
   * Supports optional feathering for smooth gradient transitions.
   */
  public static applyGarbageMatte(
    imageData: ImageData,
    matte: GarbageMatteSettings
  ): ImageData {
    const { width: imgW, height: imgH, data } = imageData;
    const x0 = Math.max(0, Math.round(matte.x * imgW));
    const y0 = Math.max(0, Math.round(matte.y * imgH));
    const x1 = Math.min(imgW, Math.round((matte.x + matte.width) * imgW));
    const y1 = Math.min(imgH, Math.round((matte.y + matte.height) * imgH));
    const feather = Math.max(0, matte.feather || 0);
    const invert = matte.invert ?? false;

    if (feather <= 0) {
      // Fast branch: hard cutout
      for (let y = 0; y < imgH; y++) {
        const rowOffset = y * imgW * 4;
        const insideY = y >= y0 && y < y1;
        for (let x = 0; x < imgW; x++) {
          const inside = insideY && x >= x0 && x < x1;
          const keep = invert ? !inside : inside;
          if (!keep) {
            data[rowOffset + x * 4 + 3] = 0;
          }
        }
      }
    } else {
      // Feathered branch: distance to matte boundary
      for (let y = 0; y < imgH; y++) {
        const rowOffset = y * imgW * 4;
        for (let x = 0; x < imgW; x++) {
          const idx = rowOffset + x * 4 + 3;
          if (data[idx] === 0) continue;

          // Distance from pixel (x, y) to inside of [x0, y0, x1, y1]
          const distLeft = x - x0;
          const distRight = x1 - 1 - x;
          const distTop = y - y0;
          const distBottom = y1 - 1 - y;

          const minDistInside = Math.min(distLeft, distRight, distTop, distBottom);

          if (minDistInside < 0) {
            // Outside box
            if (!invert) {
              data[idx] = 0;
            }
          } else if (minDistInside < feather) {
            // In feather zone
            const factor = Math.max(0, Math.min(1, minDistInside / feather));
            const multiplier = invert ? (1 - factor) : factor;
            data[idx] = Math.round(data[idx] * multiplier);
          } else {
            // Deep inside box
            if (invert) {
              data[idx] = 0;
            }
          }
        }
      }
    }

    return imageData;
  }

  /**
   * Converts keyed RGBA image into an Alpha Matte / Mask (grayscale: white = opaque, black = transparent)
   */
  public static convertToAlphaMask(imageData: ImageData): ImageData {
    const { data } = imageData;
    const totalPixels = data.length / 4;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const a = data[idx + 3];
      data[idx] = a;
      data[idx + 1] = a;
      data[idx + 2] = a;
      data[idx + 3] = 255;
    }
    return imageData;
  }

  /**
   * Converts canvas pixels into an Alpha Matte / Mask
   */
  public static canvasToAlphaMask(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.convertToAlphaMask(imgData);
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * KeyForge-grade Color Difference Keying with Despill and Clip Black/White
   */
  public static applyKeyForge(
    imageData: ImageData,
    settings: ChromaKeySettings
  ): ImageData {
    const { width, height, data } = imageData;
    const totalPixels = width * height;

    const [sR, sG, sB] = settings.keyColor;
    const sr = sR / 255.0;
    const sg = sG / 255.0;
    const sb = sB / 255.0;

    // YCbCr reference chrominance of key color
    const sCb = -0.1687 * sr - 0.3313 * sg + 0.5 * sb + 0.5;
    const sCr = 0.5 * sr - 0.4187 * sg - 0.0813 * sb + 0.5;

    const bal = Math.max(0, Math.min(1, settings.screenBalance / 100.0));
    const gain = Math.max(0.01, settings.gain / 100.0);
    const cb = settings.clipBlack / 100.0;
    const cw = Math.max(cb + 0.001, settings.clipWhite / 100.0);
    const despillAmt = settings.despill ? settings.despillAmount / 100.0 : 0.0;
    const despillWarmSafe = settings.despillWarmSafe !== false;
    const khakiSupp = (settings.khakiSuppress ?? 0) / 100.0;

    // Secondary Key (Shadow / Khaki / Dark Crevice Key)
    const hasSecKey = !!settings.secondaryKey?.enabled;
    const secColor = settings.secondaryKey?.color ?? [27, 78, 43];
    const sec_sr = secColor[0] / 255.0;
    const sec_sg = secColor[1] / 255.0;
    const sec_sb = secColor[2] / 255.0;
    const sec_sCb = -0.1687 * sec_sr - 0.3313 * sec_sg + 0.5 * sec_sb + 0.5;
    const sec_sCr = 0.5 * sec_sr - 0.4187 * sec_sg - 0.0813 * sec_sb + 0.5;
    const sec_sComp = bal * sec_sr + (1.0 - bal) * sec_sb;
    const sec_sExcess = Math.max(0.001, sec_sg - sec_sComp);
    const secGain = Math.max(0.01, (settings.secondaryKey?.gain ?? 100) / 100.0);

    // Detect dominant screen channel (Green, Blue, or Red)
    let dominant: 'g' | 'b' | 'r' = 'g';
    if (sg >= sr && sg >= sb) {
      dominant = 'g';
    } else if (sb >= sg && sb >= sr) {
      dominant = 'b';
    } else {
      dominant = 'r';
    }

    // Calculate screen excess
    let sComp = 0;
    let sExcess = 0.001;
    if (dominant === 'g') {
      sComp = bal * sr + (1.0 - bal) * sb;
      sExcess = Math.max(0.001, sg - sComp);
    } else if (dominant === 'b') {
      sComp = bal * sr + (1.0 - bal) * sg;
      sExcess = Math.max(0.001, sb - sComp);
    } else {
      sComp = bal * sg + (1.0 - bal) * sb;
      sExcess = Math.max(0.001, sr - sComp);
    }

    const alphaBuffer = this.getAlphaBuffer(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      let r = data[idx] / 255.0;
      let g = data[idx + 1] / 255.0;
      let b = data[idx + 2] / 255.0;

      let pComp = 0;
      let pExcess = 0;

      if (dominant === 'g') {
        pComp = bal * r + (1.0 - bal) * b;
        // Warm surface protection: prevents red cloth and skin from turning khaki
        if (despillWarmSafe && r > b) {
          pComp = Math.min(pComp, Math.max(b * 1.25, 0.08));
        }
        pExcess = g - pComp;

        // Despill Green with Luminance Preservation
        if (despillAmt > 0 && g > pComp) {
          const oldLum = 0.299 * r + 0.587 * g + 0.114 * b;
          g = g * (1.0 - despillAmt) + pComp * despillAmt;
          const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (newLum > 0.001) {
            const boost = Math.min(1.3, oldLum / newLum);
            r = Math.min(1.0, r * boost);
            g = Math.min(1.0, g * boost);
            b = Math.min(1.0, b * boost);
          }
          data[idx] = Math.round(r * 255.0);
          data[idx + 1] = Math.round(g * 255.0);
          data[idx + 2] = Math.round(b * 255.0);
        }
      } else if (dominant === 'b') {
        pComp = bal * r + (1.0 - bal) * g;
        pExcess = b - pComp;

        // Despill Blue with Luminance Preservation
        if (despillAmt > 0 && b > pComp) {
          const oldLum = 0.299 * r + 0.587 * g + 0.114 * b;
          b = b * (1.0 - despillAmt) + pComp * despillAmt;
          const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (newLum > 0.001) {
            const boost = Math.min(1.3, oldLum / newLum);
            r = Math.min(1.0, r * boost);
            g = Math.min(1.0, g * boost);
            b = Math.min(1.0, b * boost);
          }
          data[idx] = Math.round(r * 255.0);
          data[idx + 1] = Math.round(g * 255.0);
          data[idx + 2] = Math.round(b * 255.0);
        }
      } else {
        pComp = bal * g + (1.0 - bal) * b;
        pExcess = r - pComp;

        // Despill Red with Luminance Preservation
        if (despillAmt > 0 && r > pComp) {
          const oldLum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = r * (1.0 - despillAmt) + pComp * despillAmt;
          const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (newLum > 0.001) {
            const boost = Math.min(1.3, oldLum / newLum);
            r = Math.min(1.0, r * boost);
            g = Math.min(1.0, g * boost);
            b = Math.min(1.0, b * boost);
          }
          data[idx] = Math.round(r * 255.0);
          data[idx + 1] = Math.round(g * 255.0);
          data[idx + 2] = Math.round(b * 255.0);
        }
      }

      // 1. Color Difference RGB KeyForge Alpha
      let rgbAlpha = 1.0;
      if (pExcess > 0) {
        const keyRatio = (pExcess / sExcess) * gain;
        rgbAlpha = Math.max(0, 1.0 - keyRatio);
      }

      // 2. YCbCr Chrominance model (isolates green chroma independent of shadows)
      const pCb = -0.1687 * r - 0.3313 * g + 0.5 * b + 0.5;
      const pCr = 0.5 * r - 0.4187 * g - 0.0813 * b + 0.5;
      const dCb = pCb - sCb;
      const dCr = pCr - sCr;
      const chromaDist = Math.sqrt(dCb * dCb + dCr * dCr);
      const t = Math.max(0, Math.min(1, (chromaDist - 0.02) / (0.18 - 0.02)));
      const chromaFactor = t * t * (3.0 - 2.0 * t);

      let alphaRaw = Math.min(rgbAlpha, chromaFactor);

      // Secondary Key (Shadow / Khaki / Dark Crevice Key)
      if (hasSecKey) {
        const secExcess = g - (bal * r + (1.0 - bal) * b);
        let secRgbAlpha = 1.0;
        if (secExcess > 0) {
          secRgbAlpha = Math.max(0, 1.0 - (secExcess / sec_sExcess) * secGain);
        }
        const sec_dCb = pCb - sec_sCb;
        const sec_dCr = pCr - sec_sCr;
        const secDist = Math.sqrt(sec_dCb * sec_dCb + sec_dCr * sec_dCr);
        const secT = Math.max(0, Math.min(1, (secDist - 0.02) / (0.18 - 0.02)));
        const secFactor = secT * secT * (3.0 - 2.0 * secT);
        alphaRaw = Math.min(alphaRaw, Math.min(secRgbAlpha, secFactor));
      }

      // Khaki / Shadow Hole Suppressor
      if (khakiSupp > 0) {
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const delta = maxVal - minVal;
        if (delta > 0.03 && g > b && g >= r * 0.7) {
          const khakiWeight = (g - b) / Math.max(0.05, maxVal);
          const suppFactor = Math.max(0, Math.min(1, khakiWeight * khakiSupp * 2.2));
          alphaRaw = alphaRaw * (1.0 - suppFactor);
        }
      }

      // KeyForge Matte Levels: Softness curve transition matching WebGLKeyer GPU shader
      let alpha = 0;
      const soften = (settings.soften ?? 0) / 100.0;
      if (soften > 0.001) {
        const sHalf = soften * 0.35;
        const bStart = Math.max(0.0, cb - sHalf);
        const wEnd = Math.min(1.0, cw + sHalf);
        const span = Math.max(0.001, wEnd - bStart);
        const t = Math.max(0.0, Math.min(1.0, (alphaRaw - bStart) / span));
        alpha = t * t * (3.0 - 2.0 * t);
      } else {
        const span = Math.max(0.001, cw - cb);
        alpha = Math.max(0.0, Math.min(1.0, (alphaRaw - cb) / span));
      }

      alphaBuffer[i] = Math.max(0, Math.min(1, alpha));
    }

    let blurredAlpha: Float32Array<ArrayBufferLike> = alphaBuffer;

    // Clip (Gamma)
    if (settings.clip !== 0) {
      const gamma = Math.pow(10.0, settings.clip / 100.0);
      for (let i = 0; i < totalPixels; i++) {
        blurredAlpha[i] = Math.pow(blurredAlpha[i], gamma);
      }
    }

    // Erode / Blur Refinement
    if (settings.erodePx > 0.001 || settings.blurPx > 0.001) {
      blurredAlpha = this.refineAlpha(
        blurredAlpha,
        width,
        height,
        settings.erodePx,
        settings.blurPx,
        data
      );
    }

    // Write back alpha
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const finalA = Math.round(Math.max(0, Math.min(1, blurredAlpha[i])) * 255);
      data[idx + 3] = Math.min(data[idx + 3], finalA);
    }

    return imageData;
  }

  /**
   * Classic OpenCV-style Hue Chroma Key
   */
  public static applyClassicChromaKey(
    imageData: ImageData,
    settings: ChromaKeySettings
  ): ImageData {
    const { width, height, data } = imageData;
    const totalPixels = width * height;

    const [keyR, keyG, keyB] = settings.keyColor;
    const [targetH] = this.rgbToHsv(keyR, keyG, keyB);

    const gainNorm = settings.gain / 100.0;
    const softenNorm = settings.soften / 100.0;
    const clipNorm = settings.clip / 100.0;
    const satThreshNorm = settings.satThresh / 100.0;
    const valThreshNorm = settings.valThresh / 100.0;

    const hueTolerance = 5 + gainNorm * 60;
    const lowerH = hueTolerance;
    const upperH = hueTolerance + 1.0;

    const satProtLower = satThreshNorm;
    const satProtUpper = satThreshNorm + 0.1;
    const valProtLower = valThreshNorm;
    const valProtUpper = valThreshNorm + 0.1;

    const alphaBuffer = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, v] = this.rgbToHsv(r, g, b);

      let diffH = Math.abs(h - targetH);
      if (diffH > 90) {
        diffH = 180 - diffH;
      }

      const sFloat = s / 255.0;
      const vFloat = v / 255.0;

      let alphaH = 0;
      if (diffH <= lowerH) {
        alphaH = 0;
      } else if (diffH >= upperH) {
        alphaH = 1;
      } else {
        alphaH = (diffH - lowerH) / (upperH - lowerH);
      }

      let satProt = 0;
      if (sFloat <= satProtLower) {
        satProt = 1.0;
      } else if (sFloat >= satProtUpper) {
        satProt = 0.0;
      } else {
        satProt = 1.0 - (sFloat - satProtLower) / (satProtUpper - satProtLower);
      }

      let valProt = 0;
      if (vFloat <= valProtLower) {
        valProt = 1.0;
      } else if (vFloat >= valProtUpper) {
        valProt = 0.0;
      } else {
        valProt = 1.0 - (vFloat - valProtLower) / (valProtUpper - valProtLower);
      }

      const maxProt = Math.max(satProt, valProt);
      alphaBuffer[i] = Math.max(alphaH, maxProt);
    }

    let blurredAlpha: Float32Array<ArrayBufferLike> = alphaBuffer;
    if (softenNorm > 0) {
      const radius = Math.max(1, Math.round(softenNorm * 12));
      blurredAlpha = this.fastBoxBlur(alphaBuffer, width, height, radius);
    }

    if (clipNorm !== 0) {
      const gamma = Math.pow(10.0, clipNorm);
      for (let i = 0; i < totalPixels; i++) {
        blurredAlpha[i] = Math.pow(blurredAlpha[i], gamma);
      }
    }

    if (settings.erodePx > 0.001 || settings.blurPx > 0.001) {
      blurredAlpha = this.refineAlpha(
        blurredAlpha,
        width,
        height,
        settings.erodePx,
        settings.blurPx
      );
    }

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const finalA = Math.round(Math.max(0, Math.min(1, blurredAlpha[i])) * 255);
      data[idx + 3] = Math.min(data[idx + 3], finalA);
    }

    return imageData;
  }

  /**
   * Fast Separable Alpha Refinement (Erode & Blur) with Ink Outline Protection
   */
  private static refineAlpha(
    alpha: Float32Array,
    w: number,
    h: number,
    erodePx: number,
    blurPx: number,
    pixelData?: Uint8ClampedArray
  ): Float32Array {
    let result = alpha;
    const total = w * h;

    // Fast 2-pass Separable Morphological Erosion
    if (erodePx > 0.001) {
      const r = Math.max(1, Math.round(erodePx));
      const temp = new Float32Array(total);
      const eroded = new Float32Array(total);

      // Pass 1: Horizontal Min
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          let minVal = alpha[row + x];
          const xMin = x > r ? x - r : 0;
          const xMax = x + r < w ? x + r : w - 1;
          for (let k = xMin; k <= xMax; k++) {
            const v = alpha[row + k];
            if (v < minVal) minVal = v;
          }
          temp[row + x] = minVal;
        }
      }

      // Pass 2: Vertical Min + Ink Outline Protection
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          let minVal = temp[y * w + x];
          const yMin = y > r ? y - r : 0;
          const yMax = y + r < h ? y + r : h - 1;
          for (let k = yMin; k <= yMax; k++) {
            const v = temp[k * w + x];
            if (v < minVal) minVal = v;
          }

          // Black Edge / Ink Outline Snapping: protect dark border lines from being eaten away
          const i = y * w + x;
          if (pixelData) {
            const pxIdx = i * 4;
            const lum = (0.299 * pixelData[pxIdx] + 0.587 * pixelData[pxIdx + 1] + 0.114 * pixelData[pxIdx + 2]) / 255.0;
            if (lum < 0.28 && alpha[i] > 0.12) {
              minVal = Math.max(minVal, alpha[i] * 0.95);
            }
          }
          eroded[i] = minVal;
        }
      }

      result = eroded;
    }

    // Fast Box Blur on Alpha
    if (blurPx > 0.001) {
      const radius = Math.max(1, Math.round(blurPx));
      result = this.fastBoxBlur(result, w, h, radius);
    }

    return result;
  }

  /**
   * 2-pass separable Box Blur for alpha channel
   */
  private static fastBoxBlur(
    src: Float32Array,
    w: number,
    h: number,
    radius: number
  ): Float32Array {
    const total = w * h;
    const temp = new Float32Array(total);
    const dest = new Float32Array(total);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      let sum = 0;
      let count = 0;

      for (let x = -radius; x <= radius; x++) {
        if (x >= 0 && x < w) {
          sum += src[rowOffset + x];
          count++;
        }
      }

      for (let x = 0; x < w; x++) {
        temp[rowOffset + x] = sum / count;

        const left = x - radius;
        if (left >= 0) {
          sum -= src[rowOffset + left];
          count--;
        }

        const right = x + radius + 1;
        if (right < w) {
          sum += src[rowOffset + right];
          count++;
        }
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;

      for (let y = -radius; y <= radius; y++) {
        if (y >= 0 && y < h) {
          sum += temp[y * w + x];
          count++;
        }
      }

      for (let y = 0; y < h; y++) {
        dest[y * w + x] = sum / count;

        const top = y - radius;
        if (top >= 0) {
          sum -= temp[top * w + x];
          count--;
        }

        const bottom = y + radius + 1;
        if (bottom < h) {
          sum += temp[bottom * w + x];
          count++;
        }
      }
    }

    return dest;
  }

  /**
   * Resizes an image with optional aspect-ratio crop
   */
  public static resizeCanvas(
    source: HTMLCanvasElement | ImageBitmap | ImageData,
    targetWidth: number,
    targetHeight: number,
    cropTarget: { width: number; height: number } | null = null,
    sourceRect: { x: number; y: number; width: number; height: number } | null = null
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    let srcW = 0;
    let srcH = 0;

    let srcDrawable: CanvasImageSource;
    if (source instanceof ImageData) {
      const temp = document.createElement('canvas');
      temp.width = source.width;
      temp.height = source.height;
      temp.getContext('2d')?.putImageData(source, 0, 0);
      srcDrawable = temp;
      srcW = source.width;
      srcH = source.height;
    } else {
      srcDrawable = source;
      srcW = source.width;
      srcH = source.height;
    }

    if (sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
      const sw = Math.min(srcW - sourceRect.x, sourceRect.width);
      const sh = Math.min(srcH - sourceRect.y, sourceRect.height);
      const scale = Math.min(targetWidth / sw, targetHeight / sh);
      const dw = Math.round(sw * scale);
      const dh = Math.round(sh * scale);
      const dx = Math.round((targetWidth - dw) / 2);
      const dy = Math.round(targetHeight - dh); // bottom-anchored ground pivot

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcDrawable, sourceRect.x, sourceRect.y, sw, sh, dx, dy, dw, dh);
      return canvas;
    }

    // Uniform aspect-fit (contain) within target dimensions, centered
    const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
    const dw = Math.round(srcW * scale);
    const dh = Math.round(srcH * scale);
    const dx = Math.round((targetWidth - dw) / 2);
    const dy = Math.round((targetHeight - dh) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcDrawable, 0, 0, srcW, srcH, dx, dy, dw, dh);

    return canvas;
  }

  /**
   * Applies transform (scale, offset) to sprite
   */
  public static transformSprite(
    source: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    scale: number,
    offsetX: number,
    offsetY: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const cx = targetWidth * 0.5;
    const cy = targetHeight * 0.5;
    const s = Math.max(0.05, scale);

    ctx.save();
    ctx.translate(cx + offsetX, cy + offsetY);
    ctx.scale(s, s);
    ctx.drawImage(source, -source.width * 0.5, -source.height * 0.5);
    ctx.restore();

    return canvas;
  }

  /**
   * Composite on solid background color
   */
  public static compositeOnBackground(
    sourceCanvas: HTMLCanvasElement,
    bgColor: [number, number, number] | null
  ): HTMLCanvasElement {
    if (!bgColor) return sourceCanvas;

    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);

    return canvas;
  }

  /**
   * Samples border pixels of an image to automatically detect the background chroma key color
   */
  public static detectBorderKeyColor(
    imageData: ImageData,
    inset = 4
  ): [number, number, number] {
    const { width, height, data } = imageData;
    if (width < 12 || height < 12) return [0, 255, 0];

    const sampledR: number[] = [];
    const sampledG: number[] = [];
    const sampledB: number[] = [];

    const sample = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Ignore fully transparent pixels or dark letterbox bars
      if (a < 50 || (r < 18 && g < 18 && b < 18)) return;

      sampledR.push(r);
      sampledG.push(g);
      sampledB.push(b);
    };

    const step = 3;
    const clampedInset = Math.min(inset, Math.floor(Math.min(width, height) / 4));

    // Top and Bottom borders
    for (let x = clampedInset; x < width - clampedInset; x += step) {
      sample(x, clampedInset);
      sample(x, height - 1 - clampedInset);
    }
    // Left and Right borders
    for (let y = clampedInset; y < height - clampedInset; y += step) {
      sample(clampedInset, y);
      sample(width - 1 - clampedInset, y);
    }

    if (sampledR.length === 0) {
      return [0, 255, 0]; // Default green
    }

    const getMedian = (arr: number[]) => {
      arr.sort((a, b) => a - b);
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
    };

    return [getMedian(sampledR), getMedian(sampledG), getMedian(sampledB)];
  }

  /**
   * Renders a soft contact drop-shadow under the character's feet
   */
  public static applyDropShadow(
    targetCanvas: HTMLCanvasElement,
    opacity = 0.45,
    scalePercent = 60
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const w = targetCanvas.width;
    const h = targetCanvas.height;

    // Scan the canvas image data to find the lowest non-transparent pixels (feet) and horizontal center
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const alpha = data[(rowOffset + x) * 4 + 3];
        if (alpha > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY === 0) return;

    const charW = maxX - minX;
    const cx = minX + charW / 2;
    const feetY = maxY;

    // Radius of shadow ellipse
    const radiusX = Math.max(10, Math.round((charW * (scalePercent / 100)) / 2));
    const radiusY = Math.max(3, Math.round(radiusX * 0.28));

    // Draw shadow on a temporary canvas, then compose behind character
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = w;
    shadowCanvas.height = h;
    const sCtx = shadowCanvas.getContext('2d')!;

    const grad = sCtx.createRadialGradient(cx, feetY, radiusY * 0.2, cx, feetY, radiusX);
    grad.addColorStop(0, `rgba(0, 0, 0, ${opacity.toFixed(2)})`);
    grad.addColorStop(0.5, `rgba(0, 0, 0, ${(opacity * 0.6).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    sCtx.save();
    sCtx.translate(cx, feetY);
    sCtx.scale(1, radiusY / radiusX);
    sCtx.beginPath();
    sCtx.arc(0, 0, radiusX, 0, Math.PI * 2);
    sCtx.fillStyle = grad;
    sCtx.fill();
    sCtx.restore();

    // Composite: shadow behind character
    const charCanvas = document.createElement('canvas');
    charCanvas.width = w;
    charCanvas.height = h;
    charCanvas.getContext('2d')!.drawImage(targetCanvas, 0, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(shadowCanvas, 0, 0);
    ctx.drawImage(charCanvas, 0, 0);
  }

  /**
   * Tints an RGBA canvas with a solid color while preserving its alpha silhouette
   * Used for Onion Skinning (e.g. coral red for previous, cyan for next)
   */
  public static createTintedGhost(
    sourceCanvas: HTMLCanvasElement,
    color: [number, number, number],
    opacity: number = 0.35
  ): HTMLCanvasElement {
    const ghost = document.createElement('canvas');
    ghost.width = sourceCanvas.width;
    ghost.height = sourceCanvas.height;
    const ctx = ghost.getContext('2d');
    if (!ctx) return ghost;

    // Draw source
    ctx.drawImage(sourceCanvas, 0, 0);

    // Tint silhouette
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.fillRect(0, 0, ghost.width, ghost.height);

    // Apply opacity
    const out = document.createElement('canvas');
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height;
    const outCtx = out.getContext('2d');
    if (!outCtx) return ghost;
    outCtx.globalAlpha = Math.max(0.05, Math.min(1.0, opacity));
    outCtx.drawImage(ghost, 0, 0);

    return out;
  }
}
