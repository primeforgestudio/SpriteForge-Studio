/**
 * AI & Smart Non-Chroma Background Removal Engine
 * Supports:
 * 1) Neural AI Matting (ISNet ONNX via @imgly/background-removal) for arbitrary complex backgrounds.
 * 2) Instant Offline Edge-Aware Border Flood Segmentation for fast local matting without downloads.
 */

export class AiBackgroundRemover {
  /**
   * Neural AI background removal using ISNet/ONNX model.
   * Downloads & caches model in browser storage on first run.
   * Returns a per-pixel alpha mask (Uint8ClampedArray of length width * height).
   */
  public static async extractNeuralAlphaMask(
    source: ImageData,
    onProgress?: (percent: number, stage: string) => void
  ): Promise<Uint8ClampedArray> {
    const { width, height } = source;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) throw new Error('Failed to create 2D canvas context');
    tCtx.putImageData(source, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      tempCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const { removeBackground } = await import('@imgly/background-removal');

    const resultBlob = await removeBackground(blob, {
      model: 'isnet_quint8',
      output: {
        format: 'image/png',
        quality: 1.0,
      },
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          const pct = Math.min(100, Math.round((current / total) * 100));
          const stage = key.includes('fetch') ? 'Downloading AI Model' : 'AI Matting Inference';
          onProgress(pct, stage);
        }
      },
    });

    const bitmap = await createImageBitmap(resultBlob);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const oCtx = outCanvas.getContext('2d');
    if (!oCtx) throw new Error('Failed to create output 2D context');
    oCtx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outData = oCtx.getImageData(0, 0, width, height).data;
    const alphaMask = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alphaMask.length; i++) {
      alphaMask[i] = outData[i * 4 + 3];
    }

    return alphaMask;
  }

  /**
   * Instant Offline Edge-Aware Flood-Fill Segmentation (no green screen & no model download required).
   * Analyzes border pixels, computes local edge gradients, and flood-fills background inward.
   */
  public static extractSmartFloodAlphaMask(
    source: ImageData,
    tolerance: number = 28
  ): Uint8ClampedArray {
    const { width, height, data } = source;
    const n = width * height;
    const alpha = new Uint8ClampedArray(n);
    alpha.fill(255);

    if (width < 4 || height < 4) return alpha;

    // 1. Sample border pixels into quantized color buckets to represent background palette
    const bgSamples: [number, number, number][] = [];
    const stepX = Math.max(1, Math.floor(width / 48));
    const stepY = Math.max(1, Math.floor(height / 48));

    const addSample = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Avoid duplicates closer than 12 distance
      for (let i = 0; i < bgSamples.length; i++) {
        const s = bgSamples[i];
        if (Math.abs(r - s[0]) + Math.abs(g - s[1]) + Math.abs(b - s[2]) < 18) {
          return;
        }
      }
      if (bgSamples.length < 32) {
        bgSamples.push([r, g, b]);
      }
    };

    for (let x = 0; x < width; x += stepX) {
      addSample(x, 0);
      addSample(x, height - 1);
    }
    for (let y = 0; y < height; y += stepY) {
      addSample(0, y);
      addSample(width - 1, y);
    }

    const tolSq = tolerance * tolerance * 3.2;

    const matchesBgSample = (idx4: number): boolean => {
      const r = data[idx4];
      const g = data[idx4 + 1];
      const b = data[idx4 + 2];
      for (let i = 0; i < bgSamples.length; i++) {
        const s = bgSamples[i];
        const dr = r - s[0];
        const dg = g - s[1];
        const db = b - s[2];
        if (dr * dr + dg * dg + db * db <= tolSq) return true;
      }
      return false;
    };

    // 2. BFS Flood Fill from all 4 outer borders
    const visited = new Uint8Array(n);
    const isBg = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;

    const trySeed = (x: number, y: number) => {
      const p = y * width + x;
      if (visited[p]) return;
      visited[p] = 1;
      if (matchesBgSample(p * 4)) {
        isBg[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < width; x++) {
      trySeed(x, 0);
      trySeed(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      trySeed(0, y);
      trySeed(width - 1, y);
    }

    const neighborTolSq = Math.max(12, tolerance * 0.72) ** 2 * 3.0;

    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = (p - x) / width;
      const p4 = p * 4;
      const pr = data[p4];
      const pg = data[p4 + 1];
      const pb = data[p4 + 2];

      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];

      for (let k = 0; k < 4; k++) {
        const np = neighbors[k];
        if (np < 0 || visited[np]) continue;
        visited[np] = 1;
        const np4 = np * 4;
        const dr = data[np4] - pr;
        const dg = data[np4 + 1] - pg;
        const db = data[np4 + 2] - pb;
        const localDiffSq = dr * dr + dg * dg + db * db;

        if (localDiffSq <= neighborTolSq && matchesBgSample(np4)) {
          isBg[np] = 1;
          queue[tail++] = np;
        }
      }
    }

    // 3. Soft edge feathering along background boundary
    for (let p = 0; p < n; p++) {
      if (isBg[p]) {
        alpha[p] = 0;
      } else {
        const x = p % width;
        const y = (p - x) / width;
        let bgNeighbors = 0;
        if (x > 0 && isBg[p - 1]) bgNeighbors++;
        if (x < width - 1 && isBg[p + 1]) bgNeighbors++;
        if (y > 0 && isBg[p - width]) bgNeighbors++;
        if (y < height - 1 && isBg[p + width]) bgNeighbors++;
        if (bgNeighbors >= 2) {
          alpha[p] = 150;
        } else if (bgNeighbors === 1) {
          alpha[p] = 215;
        }
      }
    }

    return alpha;
  }

  /**
   * Applies an alpha mask onto an ImageData or HTMLCanvasElement in place.
   */
  public static applyAlphaMaskToCanvas(
    canvas: HTMLCanvasElement,
    mask: Uint8ClampedArray
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = Math.min(mask.length, canvas.width * canvas.height);
    for (let i = 0; i < len; i++) {
      // Combine with existing alpha (e.g. if retouch erased some pixels)
      data[i * 4 + 3] = Math.min(data[i * 4 + 3], mask[i]);
    }
    ctx.putImageData(imgData, 0, 0);
  }
}
