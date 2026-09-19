/**
 * Lightweight, zero-dependency pure TypeScript GIF89a animated GIF encoder
 * Supports transparent backgrounds and configurable frame delays (FPS).
 */
export class GifEncoder {
  /**
   * Encodes an array of HTMLCanvasElement frames into an animated GIF Blob.
   */
  public static encodeCanvasesToGif(
    frames: HTMLCanvasElement[],
    fps = 15
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        if (frames.length === 0) {
          throw new Error('No frames provided for GIF encoding');
        }

        const width = frames[0].width;
        const height = frames[0].height;
        const delayHundredths = Math.max(2, Math.round(100 / Math.max(1, fps)));

        const bytes: number[] = [];

        // 1. Header: GIF89a
        this.writeString(bytes, 'GIF89a');

        // 2. Logical Screen Descriptor
        this.writeShort(bytes, width);
        this.writeShort(bytes, height);
        // GCT Flag: 0x87 (GCT follows, 8 bits/pixel, 256 colors)
        bytes.push(0x87, 0x00, 0x00);

        // 3. Global Color Table (standard 6x6x6 color cube + 16 grayscale + transparent at index 0)
        // Index 0: Transparent (Black with key flag in GCE)
        bytes.push(0x00, 0x00, 0x00);
        for (let r = 0; r < 6; r++) {
          for (let g = 0; g < 6; g++) {
            for (let b = 0; b < 6; b++) {
              if (r === 0 && g === 0 && b === 0) continue; // Skip index 0
              bytes.push(
                Math.round((r * 255) / 5),
                Math.round((g * 255) / 5),
                Math.round((b * 255) / 5)
              );
            }
          }
        }
        // Fill remaining palette slots up to 256
        while (bytes.length < 13 + 256 * 3) {
          bytes.push(128, 128, 128);
        }

        // 4. Netscape 2.0 Loop Block (infinite loop)
        bytes.push(0x21, 0xff, 0x0b);
        this.writeString(bytes, 'NETSCAPE2.0');
        bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

        // 5. Encode each frame
        for (const frame of frames) {
          const ctx = frame.getContext('2d');
          if (!ctx) continue;
          const imgData = ctx.getImageData(0, 0, width, height).data;

          // Graphic Control Extension (disposal: 2 = restore to background, transparency = true)
          bytes.push(0x21, 0xf9, 0x04);
          bytes.push(0x09); // Packed fields: disposal 2, transparent color flag
          this.writeShort(bytes, delayHundredths);
          bytes.push(0x00); // Transparent color index = 0
          bytes.push(0x00); // Block terminator

          // Image Descriptor
          bytes.push(0x2c);
          this.writeShort(bytes, 0); // Left
          this.writeShort(bytes, 0); // Top
          this.writeShort(bytes, width);
          this.writeShort(bytes, height);
          bytes.push(0x00); // No local color table

          // LZW Min Code Size
          const minCodeSize = 8;
          bytes.push(minCodeSize);

          // Convert pixels to palette indices
          const pixelIndices = new Uint8Array(width * height);
          for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const a = imgData[idx + 3];
            if (a < 64) {
              pixelIndices[i] = 0; // Transparent
            } else {
              const r = Math.min(5, Math.round((imgData[idx] / 255) * 5));
              const g = Math.min(5, Math.round((imgData[idx + 1] / 255) * 5));
              const b = Math.min(5, Math.round((imgData[idx + 2] / 255) * 5));
              const palIdx = r * 36 + g * 6 + b;
              pixelIndices[i] = palIdx === 0 ? 1 : Math.min(255, palIdx);
            }
          }

          // Encode LZW sub-blocks
          this.writeLZW(bytes, minCodeSize, pixelIndices);
          bytes.push(0x00); // Frame terminator
        }

        // 6. GIF Trailer
        bytes.push(0x3b);

        const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
        resolve(blob);
      } catch (err) {
        reject(err);
      }
    });
  }

  private static writeString(bytes: number[], str: string) {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
  }

  private static writeShort(bytes: number[], val: number) {
    bytes.push(val & 0xff);
    bytes.push((val >> 8) & 0xff);
  }

  /**
   * LZW compression encoder for GIF sub-blocks
   */
  private static writeLZW(bytes: number[], minCodeSize: number, pixels: Uint8Array) {
    const clearCode = 1 << minCodeSize; // 256
    const eoiCode = clearCode + 1; // 257

    let codeSize = minCodeSize + 1;
    let nextCode = clearCode + 2;

    const dict = new Map<string, number>();

    const resetDict = () => {
      dict.clear();
      codeSize = minCodeSize + 1;
      nextCode = clearCode + 2;
    };

    resetDict();

    const bitBuffer: number[] = [];
    let curBits = 0;
    let bitCount = 0;

    const emitBits = (code: number, size: number) => {
      curBits |= code << bitCount;
      bitCount += size;
      while (bitCount >= 8) {
        bitBuffer.push(curBits & 0xff);
        curBits >>= 8;
        bitCount -= 8;
      }
    };

    emitBits(clearCode, codeSize);

    let prefix = '';
    for (let i = 0; i < pixels.length; i++) {
      const k = String(pixels[i]);
      const combined = prefix === '' ? k : prefix + ',' + k;

      if (dict.has(combined) || (prefix === '' && pixels[i] < clearCode)) {
        prefix = combined;
      } else {
        const code = prefix.includes(',') ? dict.get(prefix)! : parseInt(prefix, 10);
        emitBits(code, codeSize);

        if (nextCode < 4096) {
          dict.set(combined, nextCode++);
          if (nextCode > 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          emitBits(clearCode, codeSize);
          resetDict();
        }
        prefix = k;
      }
    }

    if (prefix !== '') {
      const code = prefix.includes(',') ? dict.get(prefix)! : parseInt(prefix, 10);
      emitBits(code, codeSize);
    }

    emitBits(eoiCode, codeSize);

    if (bitCount > 0) {
      bitBuffer.push(curBits & 0xff);
    }

    // Write bitBuffer in sub-blocks of max 254 bytes
    let offset = 0;
    while (offset < bitBuffer.length) {
      const blockSize = Math.min(254, bitBuffer.length - offset);
      bytes.push(blockSize);
      for (let b = 0; b < blockSize; b++) {
        bytes.push(bitBuffer[offset + b]);
      }
      offset += blockSize;
    }
  }
}
