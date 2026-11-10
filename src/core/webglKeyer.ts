/**
 * SpriteForge Studio - High-Performance WebGL Chroma Key & Viewport Renderer
 * Executes KeyForge Chroma Keying, Softness, Erode, Blur, Smart Defringe,
 * Garbage Matte (Cutout & Feather), and Background compositing directly on GPU.
 */

import { ChromaKeySettings, BackgroundMode } from './types';

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_texCoord;

uniform vec2 u_resolution;
uniform sampler2D u_image;
uniform bool u_enabled;
uniform vec3 u_keyColor; // RGB [0..1]
uniform float u_balance; // Screen balance [0..1]
uniform float u_gain; // Gain factor
uniform float u_clipBlack; // [0..1]
uniform float u_clipWhite; // [0..1]
uniform float u_soften; // [0..1]
uniform float u_erodePx; // [0..5]
uniform float u_blurPx; // [0..10]
uniform bool u_despill;
uniform float u_despillAmt; // [0..1]
uniform bool u_despillWarmSafe; // Protects red cloth and skin from khaki shift
uniform float u_khakiSuppress; // Suppresses dark khaki/shadow green in holes [0..1]
uniform bool u_hasSecondaryKey;
uniform vec3 u_secondaryKeyColor;
uniform float u_secondaryGain;
uniform bool u_defringe;
uniform float u_defringeRadius; // [1..6]
uniform float u_defringeStrength; // [0..1]
uniform bool u_showMask;

// Garbage Matte Cutout
uniform bool u_hasGarbageMatte;
uniform vec4 u_garbageMatte; // x, y, w, h [0..1]
uniform float u_garbageFeather; // in pixels
uniform bool u_garbageInvert;

// Background compositing
uniform int u_bgMode; // 0 = checkerboard (transparent output), 1 = solid color
uniform vec3 u_bgColor; // RGB [0..1]

// Evaluates KeyForge + YCbCr alpha for a specific key color
float computeKeyAlphaForColor(vec4 color, vec3 keyCol, float gainVal) {
    float r = color.r;
    float g = color.g;
    float b = color.b;

    float sr = keyCol.r;
    float sg = keyCol.g;
    float sb = keyCol.b;

    // 1. Screen excess calculation (KeyForge RGB model)
    float sComp = u_balance * sr + (1.0 - u_balance) * sb;
    float sExcess = max(0.001, sg - sComp);

    float pComp = u_balance * r + (1.0 - u_balance) * b;
    float pExcess = max(0.0, g - pComp);

    float rgbAlpha = 1.0 - (pExcess / sExcess) * gainVal;

    // 2. YCbCr Chrominance model (isolates green chroma independent of luminance/shadows)
    float pCb = -0.1687 * r - 0.3313 * g + 0.5 * b + 0.5;
    float pCr = 0.5 * r - 0.4187 * g - 0.0813 * b + 0.5;
    float sCb = -0.1687 * sr - 0.3313 * sg + 0.5 * sb + 0.5;
    float sCr = 0.5 * sr - 0.4187 * sg - 0.0813 * sb + 0.5;

    float chromaDist = length(vec2(pCb - sCb, pCr - sCr));
    float chromaFactor = smoothstep(0.02, 0.18, chromaDist);

    return min(rgbAlpha, chromaFactor);
}

// Pure functional hybrid alpha calculation with Secondary Key and Khaki Hole Suppression
float computeKeyAlpha(vec4 color) {
    if (!u_enabled) return color.a;

    float rawAlpha = computeKeyAlphaForColor(color, u_keyColor, u_gain);

    if (u_hasSecondaryKey) {
        float secAlpha = computeKeyAlphaForColor(color, u_secondaryKeyColor, u_secondaryGain);
        rawAlpha = min(rawAlpha, secAlpha);
    }

    // Khaki / Shadow Hole Suppressor:
    // Wipes out dirty yellow-green / olive remnants in crumbling gaps and shadows
    if (u_khakiSuppress > 0.001) {
        float maxVal = max(color.r, max(color.g, color.b));
        float minVal = min(color.r, min(color.g, color.b));
        float delta = maxVal - minVal;
        // Check if green dominates over blue and is close to red (khaki/olive: g > b and g >= r * 0.7)
        if (delta > 0.03 && color.g > color.b && color.g >= color.r * 0.7) {
            float khakiWeight = (color.g - color.b) / max(0.05, maxVal);
            float suppFactor = clamp(khakiWeight * u_khakiSuppress * 2.2, 0.0, 1.0);
            rawAlpha = mix(rawAlpha, 0.0, suppFactor);
        }
    }
    
    // Softness curve transition
    if (u_soften > 0.001) {
        float sHalf = u_soften * 0.35;
        float bStart = max(0.0, u_clipBlack - sHalf);
        float wEnd = min(1.0, u_clipWhite + sHalf);
        return clamp(smoothstep(bStart, wEnd, rawAlpha), 0.0, 1.0);
    } else {
        float span = max(0.001, u_clipWhite - u_clipBlack);
        return clamp((rawAlpha - u_clipBlack) / span, 0.0, 1.0);
    }
}

void main() {
    // WebGL textures have origin at bottom-left; flip Y for screen alignment
    vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
    vec4 src = texture2D(u_image, uv);

    if (!u_enabled && !u_hasGarbageMatte) {
        if (u_bgMode == 1) {
            gl_FragColor = vec4(mix(u_bgColor, src.rgb, src.a), 1.0);
        } else {
            gl_FragColor = src;
        }
        return;
    }

    // 1. Base KeyForge Alpha
    float alpha = computeKeyAlpha(src);

    // 2. Erode (Matte Shrink) with Ink Outline Protector
    if (u_enabled && u_erodePx > 0.05) {
        vec2 eStep = vec2(u_erodePx) / u_resolution;
        float a1 = computeKeyAlpha(texture2D(u_image, uv - vec2(eStep.x, 0.0)));
        float a2 = computeKeyAlpha(texture2D(u_image, uv + vec2(eStep.x, 0.0)));
        float a3 = computeKeyAlpha(texture2D(u_image, uv - vec2(0.0, eStep.y)));
        float a4 = computeKeyAlpha(texture2D(u_image, uv + vec2(0.0, eStep.y)));
        float eroded = min(alpha, min(min(a1, a2), min(a3, a4)));

        // Black Edge / Ink Outline Snapping: protect dark border lines from being eaten
        float lum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
        if (lum < 0.28 && alpha > 0.12) {
            alpha = max(eroded, alpha * 0.95);
        } else {
            alpha = eroded;
        }
    }

    // 3. Blur (Matte Smoothing)
    if (u_enabled && u_blurPx > 0.05) {
        vec2 bStep = vec2(u_blurPx) / u_resolution;
        float sum = alpha * 0.28;
        sum += (computeKeyAlpha(texture2D(u_image, uv - vec2(bStep.x, 0.0))) +
                computeKeyAlpha(texture2D(u_image, uv + vec2(bStep.x, 0.0)))) * 0.18;
        sum += (computeKeyAlpha(texture2D(u_image, uv - vec2(0.0, bStep.y))) +
                computeKeyAlpha(texture2D(u_image, uv + vec2(0.0, bStep.y)))) * 0.18;
        sum += (computeKeyAlpha(texture2D(u_image, uv - bStep)) +
                computeKeyAlpha(texture2D(u_image, uv + bStep))) * 0.09;
        sum += (computeKeyAlpha(texture2D(u_image, uv + vec2(bStep.x, -bStep.y))) +
                computeKeyAlpha(texture2D(u_image, uv + vec2(-bStep.x, bStep.y)))) * 0.09;
        alpha = clamp(sum, 0.0, 1.0);
    }

    // 4. Despill with Warm Surface Protection & Low-Alpha Glare Suppression
    if (u_enabled) {
        float pComp = u_balance * src.r + (1.0 - u_balance) * src.b;
        // Warm Surface Safe Despill: prevents red cloth and skin from turning khaki/olive
        if (u_despillWarmSafe && src.r > src.b) {
            pComp = min(pComp, max(src.b * 1.25, 0.08));
        }
        if (u_despill && src.g > pComp) {
            float oldLum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
            src.g = mix(src.g, pComp, u_despillAmt);
            float newLum = dot(src.rgb, vec3(0.299, 0.587, 0.114));
            // Only boost luminance on solid foreground, avoiding turning dark gaps into white patches
            if (newLum > 0.001 && alpha > 0.2) {
                float boost = min(1.3, oldLum / newLum);
                src.rgb *= mix(1.0, boost, clamp((alpha - 0.2) * 2.5, 0.0, 1.0));
            }
        }
    }

    // 5. Smart Defringe (Edge color reconstruction)
    if (u_enabled && u_defringe && alpha > 0.01 && alpha < 0.98) {
        vec2 dStep = vec2(u_defringeRadius) / u_resolution;
        vec3 solidColor = src.rgb;
        float found = 0.0;

        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                vec4 nCol = texture2D(u_image, uv + vec2(float(dx), float(dy)) * dStep);
                if (computeKeyAlpha(nCol) > 0.85) {
                    solidColor = nCol.rgb;
                    found = 1.0;
                    break;
                }
            }
            if (found > 0.0) break;
        }

        if (found > 0.0) {
            float bleed = u_defringeStrength * (1.0 - alpha * 0.5);
            src.rgb = mix(src.rgb, solidColor, clamp(bleed, 0.0, 1.0));
        }
    }

    // 6. Garbage Matte Cutout & Feathering
    if (u_hasGarbageMatte) {
        vec2 pPx = uv * u_resolution;
        vec2 b0Px = u_garbageMatte.xy * u_resolution;
        vec2 b1Px = (u_garbageMatte.xy + u_garbageMatte.zw) * u_resolution;

        float dL = pPx.x - b0Px.x;
        float dR = b1Px.x - pPx.x;
        float dT = pPx.y - b0Px.y;
        float dB = b1Px.y - pPx.y;

        float minD = min(min(dL, dR), min(dT, dB));
        float matteFactor = 1.0;

        if (u_garbageFeather <= 0.5) {
            matteFactor = minD >= 0.0 ? 1.0 : 0.0;
        } else {
            matteFactor = clamp(minD / u_garbageFeather, 0.0, 1.0);
        }

        if (u_garbageInvert) {
            matteFactor = 1.0 - matteFactor;
        }

        alpha *= matteFactor;
    }

    // 7. Render Output Mode
    if (u_showMask) {
        gl_FragColor = vec4(vec3(alpha), 1.0);
        return;
    }

    if (u_bgMode == 1) {
        // Solid background blend
        gl_FragColor = vec4(mix(u_bgColor, src.rgb, alpha), 1.0);
    } else {
        // Transparent checkerboard output
        gl_FragColor = vec4(src.rgb * alpha, alpha);
    }
}
`;

export class WebGLKeyer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private texBuffer: WebGLBuffer | null = null;
  private uniformLocs: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement) {
    this.initGL();
  }

  private initGL() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      console.warn('[WebGLKeyer] WebGL not supported, falling back');
      return;
    }

    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[WebGLKeyer] Program link error:', gl.getProgramInfoLog(prog));
      return;
    }

    this.program = prog;

    // Uniform locations
    const uniforms = [
      'u_resolution',
      'u_image',
      'u_enabled',
      'u_keyColor',
      'u_balance',
      'u_gain',
      'u_clipBlack',
      'u_clipWhite',
      'u_soften',
      'u_erodePx',
      'u_blurPx',
      'u_despill',
      'u_despillAmt',
      'u_despillWarmSafe',
      'u_khakiSuppress',
      'u_hasSecondaryKey',
      'u_secondaryKeyColor',
      'u_secondaryGain',
      'u_defringe',
      'u_defringeRadius',
      'u_defringeStrength',
      'u_showMask',
      'u_hasGarbageMatte',
      'u_garbageMatte',
      'u_garbageFeather',
      'u_garbageInvert',
      'u_bgMode',
      'u_bgColor',
    ];

    for (const name of uniforms) {
      this.uniformLocs[name] = gl.getUniformLocation(prog, name);
    }

    // Geometry buffers (fullscreen quad)
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    this.texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW
    );

    // Create persistent texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[WebGLKeyer] Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public render(
    source: TexImageSource | ImageData,
    width: number,
    height: number,
    keying: ChromaKeySettings,
    showMask: boolean,
    bgMode: BackgroundMode,
    bgColor: [number, number, number]
  ): boolean {
    const gl = this.gl;
    if (!gl || !this.program || !this.texture) return false;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(this.program);

    // Bind and upload texture from source (video, canvas, image, or ImageData)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (source instanceof ImageData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        source.width,
        source.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source.data
      );
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    gl.uniform1i(this.uniformLocs['u_image'], 0);
    gl.uniform2f(this.uniformLocs['u_resolution'], width, height);

    // Set KeyForge uniforms
    gl.uniform1i(this.uniformLocs['u_enabled'], keying.enabled ? 1 : 0);
    gl.uniform3f(
      this.uniformLocs['u_keyColor'],
      keying.keyColor[0] / 255.0,
      keying.keyColor[1] / 255.0,
      keying.keyColor[2] / 255.0
    );
    gl.uniform1f(this.uniformLocs['u_balance'], (keying.screenBalance ?? 50) / 100.0);
    gl.uniform1f(this.uniformLocs['u_gain'], (keying.gain ?? 100) / 100.0);
    gl.uniform1f(this.uniformLocs['u_clipBlack'], (keying.clipBlack ?? 0) / 100.0);
    gl.uniform1f(this.uniformLocs['u_clipWhite'], (keying.clipWhite ?? 100) / 100.0);
    gl.uniform1f(this.uniformLocs['u_soften'], (keying.soften ?? 0) / 100.0);
    gl.uniform1f(this.uniformLocs['u_erodePx'], keying.erodePx ?? 0.0);
    gl.uniform1f(this.uniformLocs['u_blurPx'], keying.blurPx ?? 0.0);

    // Despill
    gl.uniform1i(this.uniformLocs['u_despill'], keying.despill ? 1 : 0);
    gl.uniform1f(this.uniformLocs['u_despillAmt'], (keying.despillAmount ?? 100) / 100.0);
    gl.uniform1i(this.uniformLocs['u_despillWarmSafe'], keying.despillWarmSafe !== false ? 1 : 0);
    gl.uniform1f(this.uniformLocs['u_khakiSuppress'], (keying.khakiSuppress ?? 0) / 100.0);

    // Secondary Key (Shadow / Khaki / Dark Crevice Key)
    const secKey = keying.secondaryKey;
    if (secKey && secKey.enabled) {
      gl.uniform1i(this.uniformLocs['u_hasSecondaryKey'], 1);
      gl.uniform3f(
        this.uniformLocs['u_secondaryKeyColor'],
        secKey.color[0] / 255.0,
        secKey.color[1] / 255.0,
        secKey.color[2] / 255.0
      );
      gl.uniform1f(this.uniformLocs['u_secondaryGain'], (secKey.gain ?? 100) / 100.0);
    } else {
      gl.uniform1i(this.uniformLocs['u_hasSecondaryKey'], 0);
    }

    // Smart Defringe
    gl.uniform1i(this.uniformLocs['u_defringe'], keying.defringe ? 1 : 0);
    gl.uniform1f(this.uniformLocs['u_defringeRadius'], keying.defringeRadius ?? 2);
    gl.uniform1f(this.uniformLocs['u_defringeStrength'], (keying.defringeStrength ?? 85) / 100.0);

    gl.uniform1i(this.uniformLocs['u_showMask'], showMask ? 1 : 0);

    // Garbage matte
    const gm = keying.garbageMatte;
    if (gm && gm.enabled) {
      gl.uniform1i(this.uniformLocs['u_hasGarbageMatte'], 1);
      gl.uniform4f(this.uniformLocs['u_garbageMatte'], gm.x, gm.y, gm.width, gm.height);
      gl.uniform1f(this.uniformLocs['u_garbageFeather'], gm.feather ?? 0);
      gl.uniform1i(this.uniformLocs['u_garbageInvert'], gm.invert ? 1 : 0);
    } else {
      gl.uniform1i(this.uniformLocs['u_hasGarbageMatte'], 0);
    }

    // Background
    gl.uniform1i(this.uniformLocs['u_bgMode'], bgMode === 'solid' ? 1 : 0);
    gl.uniform3f(
      this.uniformLocs['u_bgColor'],
      bgColor[0] / 255.0,
      bgColor[1] / 255.0,
      bgColor[2] / 255.0
    );

    // Bind vertex attributes
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const aTex = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(aTex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    // Draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return true;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public dispose() {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.posBuffer) this.gl.deleteBuffer(this.posBuffer);
      if (this.texBuffer) this.gl.deleteBuffer(this.texBuffer);
    }
    this.gl = null;
  }
}
