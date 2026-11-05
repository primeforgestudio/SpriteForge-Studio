import { MediaMetadata } from './types';

export class VideoLoader {
  public videoElement: HTMLVideoElement | null = null;
  public isSequence = false;
  public isImageList = false;
  public imageFiles: File[] = [];
  public imageElements: HTMLImageElement[] = [];
  public metadata: MediaMetadata = {
    filename: '',
    sourceType: 'video',
    width: 0,
    height: 0,
    duration: 0,
    fps: 30,
    totalFrames: 0,
  };

  private frameCache = new Map<number, ImageData>();
  private keyedFrameCache = new Map<string, ImageData>();
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  // Dual-Stream / Alpha Matte Track
  public maskVideoElement: HTMLVideoElement | null = null;
  public maskImageFiles: File[] = [];
  public hasMaskMedia = false;
  public maskFilename = '';
  public invertMask = false;
  private maskOffscreenCanvas: HTMLCanvasElement;
  private maskOffscreenCtx: CanvasRenderingContext2D;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
    this.maskOffscreenCanvas = document.createElement('canvas');
    this.maskOffscreenCtx = this.maskOffscreenCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
  }

  private isFrameValid(data: ImageData): boolean {
    const d = data.data;
    // Check if at least some pixels have non-zero alpha and non-zero RGB
    for (let i = 0; i < d.length; i += 32) {
      if (d[i + 3] > 0 && (d[i] > 0 || d[i + 1] > 0 || d[i + 2] > 0)) {
        return true;
      }
    }
    return false;
  }

  private isSeeking = false;
  private pendingSeekFrame: number | null = null;
  private pendingSeekResolvers: ((data: ImageData | null) => void)[] = [];

  public async loadVideoFile(file: File, customFps = 30): Promise<MediaMetadata> {
    this.close();

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.position = 'fixed';
      video.style.bottom = '0';
      video.style.right = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-9999';
      document.body.appendChild(video);

      const url = URL.createObjectURL(file);
      video.src = url;

      let resolved = false;
      const onReady = async () => {
        if (resolved) return;

        const duration = video.duration || 0;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        const fps = customFps;
        const totalFrames = Math.max(1, Math.round(duration * fps));

        this.videoElement = video;
        this.isSequence = false;
        this.isImageList = false;
        this.metadata = {
          filename: file.name,
          sourceType: 'video',
          width,
          height,
          duration,
          fps,
          totalFrames,
        };

        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;

        // Force hardware decode of the very first frame immediately!
        try {
          video.currentTime = 0.001;
          await new Promise<void>((r) => {
            if (video.readyState >= 2) return r();
            const done = () => {
              video.removeEventListener('loadeddata', done);
              video.removeEventListener('seeked', done);
              r();
            };
            video.addEventListener('loadeddata', done, { once: true });
            video.addEventListener('seeked', done, { once: true });
            setTimeout(done, 300);
          });

          this.offscreenCtx.clearRect(0, 0, width, height);
          this.offscreenCtx.drawImage(video, 0, 0);
          const firstData = this.offscreenCtx.getImageData(0, 0, width, height);
          if (this.isFrameValid(firstData)) {
            this.frameCache.set(0, firstData);
          }
        } catch (e) {
          console.warn('Initial frame decode warning:', e);
        }

        resolved = true;
        resolve(this.metadata);
      };

      video.onloadedmetadata = () => {
        onReady();
      };

      video.addEventListener('loadeddata', onReady, { once: true });

      if (video.readyState >= 2) {
        onReady();
      }

      video.onerror = () => {
        reject(new Error(`Failed to load video: ${video.error?.message || 'unknown error'}`));
      };
    });
  }

  public getCachedFrame(frameIndex: number): ImageData | null {
    const clamped = Math.max(0, Math.min(this.metadata.totalFrames - 1, frameIndex));
    return this.frameCache.get(clamped) || null;
  }

  public setCachedFrame(frameIndex: number, data: ImageData): void {
    const clamped = Math.max(0, Math.min(this.metadata.totalFrames - 1, frameIndex));
    this.frameCache.set(clamped, data);
  }

  public isVideoPlaying(): boolean {
    return !!(this.videoElement && !this.videoElement.paused && !this.videoElement.ended);
  }

  public captureCurrentPlayingFrame(): ImageData | null {
    if (!this.videoElement || this.videoElement.readyState < 2) return null;
    const v = this.videoElement;
    if (this.offscreenCanvas.width !== v.videoWidth || this.offscreenCanvas.height !== v.videoHeight) {
      this.offscreenCanvas.width = v.videoWidth;
      this.offscreenCanvas.height = v.videoHeight;
    }
    this.offscreenCtx.drawImage(v, 0, 0);
    return this.offscreenCtx.getImageData(0, 0, v.videoWidth, v.videoHeight);
  }

  public getKeyedFrame(frameIndex: number, settingsKey: string): ImageData | null {
    const key = `${frameIndex}_${settingsKey}`;
    return this.keyedFrameCache.get(key) || null;
  }

  public setKeyedFrame(frameIndex: number, settingsKey: string, data: ImageData): void {
    const key = `${frameIndex}_${settingsKey}`;
    this.keyedFrameCache.set(key, data);
  }

  public clearKeyedCache(): void {
    this.keyedFrameCache.clear();
  }

  public captureFrameToCache(frameIndex: number): ImageData | null {
    const data = this.captureCurrentPlayingFrame();
    if (data && this.isFrameValid(data)) {
      this.setCachedFrame(frameIndex, data);
      return data;
    }
    return null;
  }

  public async loadImageFiles(
    files: File[],
    isImageList = false,
    fps = 30
  ): Promise<MediaMetadata> {
    this.close();

    // Natural sort by filename
    const sortedFiles = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (sortedFiles.length === 0) {
      throw new Error('No files provided');
    }

    this.imageFiles = sortedFiles;
    this.isSequence = true;
    this.isImageList = isImageList;

    // Load first image to get dimensions
    const firstImg = await this.loadImageElement(sortedFiles[0]);
    const width = firstImg.naturalWidth;
    const height = firstImg.naturalHeight;
    const totalFrames = sortedFiles.length;
    const duration = totalFrames / fps;

    this.metadata = {
      filename: sortedFiles[0].name,
      sourceType: isImageList ? 'image_list' : 'png_sequence',
      width,
      height,
      duration,
      fps,
      totalFrames,
    };

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    return this.metadata;
  }

  public setFps(fps: number) {
    this.metadata.fps = fps;
    if (!this.isSequence && this.videoElement) {
      this.metadata.totalFrames = Math.max(1, Math.round(this.metadata.duration * fps));
      this.frameCache.clear();
    }
  }

  public async getFrame(frameIndex: number): Promise<ImageData | null> {
    const clampedIndex = Math.max(0, Math.min(this.metadata.totalFrames - 1, frameIndex));

    if (this.frameCache.has(clampedIndex)) {
      const cached = this.frameCache.get(clampedIndex)!;
      if (this.isFrameValid(cached)) {
        return cached;
      }
      this.frameCache.delete(clampedIndex);
    }

    if (this.isSequence) {
      const file = this.imageFiles[clampedIndex];
      if (!file) return null;
      const img = await this.loadImageElement(file);
      this.offscreenCanvas.width = img.naturalWidth;
      this.offscreenCanvas.height = img.naturalHeight;
      this.offscreenCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
      this.offscreenCtx.drawImage(img, 0, 0);
      let data = this.offscreenCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      if (this.hasMaskMedia) {
        data = await this.applyMatteIfActive(data, clampedIndex);
      }
      this.frameCache.set(clampedIndex, data);
      return data;
    }

    if (!this.videoElement) return null;

    // If video is actively playing, never interrupt playback with a seek!
    if (this.isVideoPlaying()) {
      return this.frameCache.get(clampedIndex) || null;
    }

    // 2. If already seeking, record this target as the latest pending frame
    // This drops all intermediate skipped frames and eliminates backlog!
    if (this.isSeeking) {
      this.pendingSeekFrame = clampedIndex;
      return new Promise<ImageData | null>((resolve) => {
        this.pendingSeekResolvers.push(resolve);
      });
    }

    // 3. Initiate single non-blocking seek
    return this.executeSeek(clampedIndex);
  }

  private executeSeek(targetIndex: number): Promise<ImageData | null> {
    const video = this.videoElement;
    if (!video) return Promise.resolve(null);
    if (this.isVideoPlaying()) return Promise.resolve(this.frameCache.get(targetIndex) || null);

    this.isSeeking = true;

    return new Promise<ImageData | null>((resolve) => {
      const targetTime = targetIndex === 0 ? 0.001 : targetIndex / this.metadata.fps;
      const seekTime = Math.min(targetTime, Math.max(0, (video.duration || 0) - 0.001));

      const capture = async (): Promise<ImageData | null> => {
        if (this.offscreenCanvas.width !== video.videoWidth || this.offscreenCanvas.height !== video.videoHeight) {
          this.offscreenCanvas.width = video.videoWidth;
          this.offscreenCanvas.height = video.videoHeight;
        }
        this.offscreenCtx.drawImage(video, 0, 0);
        let data = this.offscreenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
        if (this.isFrameValid(data)) {
          if (this.hasMaskMedia) {
            data = await this.applyMatteIfActive(data, targetIndex);
          }
          this.frameCache.set(targetIndex, data);
          return data;
        }
        return null;
      };

      // If already at seek time and video is ready
      if (Math.abs(video.currentTime - seekTime) < 0.003 && video.readyState >= 2) {
        capture().then((data) => this.finishSeek(data, resolve));
        return;
      }

      let timeoutId: any;
      let settled = false;

      const onSeekComplete = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeEventListener('seeked', onSeekComplete);

        capture().then((data) => this.finishSeek(data, resolve));
      };

      timeoutId = setTimeout(onSeekComplete, 180);
      video.addEventListener('seeked', onSeekComplete, { once: true });
      video.currentTime = seekTime;
    });
  }

  private finishSeek(data: ImageData | null, currentResolve: (val: ImageData | null) => void) {
    currentResolve(data);
    this.isSeeking = false;

    // If another frame was requested while seeking, jump directly to the latest target!
    if (this.pendingSeekFrame !== null) {
      const nextIndex = this.pendingSeekFrame;
      const resolvers = [...this.pendingSeekResolvers];
      this.pendingSeekFrame = null;
      this.pendingSeekResolvers = [];

      this.executeSeek(nextIndex).then((nextData) => {
        resolvers.forEach((r) => r(nextData));
      });
    }
  }

  public async preloadMarkers(markers: number[]): Promise<void> {
    if (!this.videoElement || this.isSequence || this.isVideoPlaying()) return;
    for (const f of markers) {
      if (!this.videoElement || this.isSequence || this.isVideoPlaying()) return;
      if (!this.frameCache.has(f)) {
        await this.getFrame(f);
      }
    }
  }

  public play(): Promise<void> {
    if (this.maskVideoElement) {
      this.maskVideoElement.play().catch(() => {});
    }
    if (this.videoElement) {
      return this.videoElement.play();
    }
    return Promise.resolve();
  }

  public pause(): void {
    if (this.maskVideoElement) {
      this.maskVideoElement.pause();
    }
    if (this.videoElement) {
      this.videoElement.pause();
    }
  }

  public async loadMaskVideoFile(file: File): Promise<void> {
    this.removeMaskMedia();
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.position = 'fixed';
      video.style.bottom = '0';
      video.style.right = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-9999';
      document.body.appendChild(video);

      const url = URL.createObjectURL(file);
      video.src = url;

      let resolved = false;
      const onReady = () => {
        if (resolved) return;
        resolved = true;
        this.maskVideoElement = video;
        this.hasMaskMedia = true;
        this.maskFilename = file.name;
        this.frameCache.clear();
        this.keyedFrameCache.clear();
        resolve();
      };

      video.onloadedmetadata = onReady;
      video.addEventListener('loadeddata', onReady, { once: true });
      if (video.readyState >= 2) onReady();
      video.onerror = () => reject(new Error('Failed to load mask video'));
    });
  }

  public async loadMaskImageFiles(files: File[]): Promise<void> {
    this.removeMaskMedia();
    const sorted = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    this.maskImageFiles = sorted;
    this.hasMaskMedia = sorted.length > 0;
    this.maskFilename = sorted[0]?.name || '';
    this.frameCache.clear();
    this.keyedFrameCache.clear();
  }

  public removeMaskMedia(): void {
    if (this.maskVideoElement) {
      this.maskVideoElement.pause();
      this.maskVideoElement.removeAttribute('src');
      this.maskVideoElement.load();
      if (this.maskVideoElement.parentNode) {
        this.maskVideoElement.parentNode.removeChild(this.maskVideoElement);
      }
      this.maskVideoElement = null;
    }
    this.maskImageFiles = [];
    this.hasMaskMedia = false;
    this.maskFilename = '';
    this.frameCache.clear();
    this.keyedFrameCache.clear();
  }

  public async getRawMaskFrame(frameIndex: number, targetW: number, targetH: number): Promise<ImageData | null> {
    if (!this.hasMaskMedia) return null;

    if (this.maskImageFiles.length > 0) {
      const file = this.maskImageFiles[Math.min(frameIndex, this.maskImageFiles.length - 1)];
      if (!file) return null;
      const img = await this.loadImageElement(file);
      this.maskOffscreenCanvas.width = targetW;
      this.maskOffscreenCanvas.height = targetH;
      this.maskOffscreenCtx.clearRect(0, 0, targetW, targetH);
      this.maskOffscreenCtx.drawImage(img, 0, 0, targetW, targetH);
      return this.maskOffscreenCtx.getImageData(0, 0, targetW, targetH);
    }

    if (this.maskVideoElement) {
      const v = this.maskVideoElement;
      const targetTime = frameIndex === 0 ? 0.001 : frameIndex / this.metadata.fps;
      const seekTime = Math.min(targetTime, Math.max(0, (v.duration || 0) - 0.001));

      if (Math.abs(v.currentTime - seekTime) > 0.01) {
        await new Promise<void>((r) => {
          let done = false;
          const handler = () => {
            if (!done) {
              done = true;
              v.removeEventListener('seeked', handler);
              r();
            }
          };
          v.addEventListener('seeked', handler);
          v.currentTime = seekTime;
          setTimeout(handler, 150);
        });
      }

      this.maskOffscreenCanvas.width = targetW;
      this.maskOffscreenCanvas.height = targetH;
      this.maskOffscreenCtx.drawImage(v, 0, 0, targetW, targetH);
      return this.maskOffscreenCtx.getImageData(0, 0, targetW, targetH);
    }

    return null;
  }

  private async applyMatteIfActive(data: ImageData, frameIndex: number): Promise<ImageData> {
    if (!this.hasMaskMedia) return data;
    const maskData = await this.getRawMaskFrame(frameIndex, data.width, data.height);
    if (!maskData) return data;

    const d = data.data;
    const md = maskData.data;
    const len = d.length;
    for (let i = 0; i < len; i += 4) {
      const luma = Math.round(0.299 * md[i] + 0.587 * md[i + 1] + 0.114 * md[i + 2]);
      d[i + 3] = this.invertMask ? (255 - luma) : luma;
    }
    return data;
  }

  private loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load image ${file.name}`));
      };
      img.src = url;
    });
  }

  public clearCache() {
    this.frameCache.clear();
    this.keyedFrameCache.clear();
  }

  public close() {
    this.removeMaskMedia();
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.load();
      if (this.videoElement.parentNode) {
        this.videoElement.parentNode.removeChild(this.videoElement);
      }
      this.videoElement = null;
    }
    this.imageFiles = [];
    this.imageElements = [];
    this.frameCache.clear();
    this.keyedFrameCache.clear();
    this.isSequence = false;
    this.isImageList = false;
    this.isSeeking = false;
    this.pendingSeekFrame = null;
    this.pendingSeekResolvers = [];
  }
}
