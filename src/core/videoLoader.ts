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
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
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

  private seekLock: Promise<any> = Promise.resolve();
  private latestRequestedFrame: number = -1;

  public async loadVideoFile(file: File, customFps = 30): Promise<MediaMetadata> {
    this.close();

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

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
    this.latestRequestedFrame = clampedIndex;

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
      const data = this.offscreenCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      this.frameCache.set(clampedIndex, data);
      return data;
    }

    if (!this.videoElement) return null;

    // Fast seek without chaining stalled backlog
    return new Promise<ImageData | null>((resolve) => {
      this.seekLock = this.seekLock.then(() => {
        return new Promise<void>((nextSeek) => {
          const video = this.videoElement;
          if (!video) {
            resolve(null);
            nextSeek();
            return;
          }

          // If another frame was requested while waiting in lock, jump immediately
          const targetIndex = this.latestRequestedFrame >= 0 ? this.latestRequestedFrame : clampedIndex;
          if (this.frameCache.has(targetIndex)) {
            resolve(this.frameCache.get(targetIndex)!);
            nextSeek();
            return;
          }

          const targetTime = targetIndex === 0 ? 0.001 : targetIndex / this.metadata.fps;
          const seekTime = Math.min(targetTime, Math.max(0, (video.duration || 0) - 0.001));

          const capture = (): ImageData | null => {
            this.offscreenCanvas.width = video.videoWidth;
            this.offscreenCanvas.height = video.videoHeight;
            this.offscreenCtx.clearRect(0, 0, video.videoWidth, video.videoHeight);
            this.offscreenCtx.drawImage(video, 0, 0);
            const data = this.offscreenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
            if (this.isFrameValid(data)) {
              this.frameCache.set(targetIndex, data);
              return data;
            }
            return null;
          };

          // If already at seek time and video is ready
          if (Math.abs(video.currentTime - seekTime) < 0.003 && video.readyState >= 2) {
            const data = capture();
            if (data) {
              resolve(data);
              nextSeek();
              return;
            }
          }

          let timeoutId: any;
          let settled = false;

          const onSeekComplete = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            video.removeEventListener('seeked', onSeekComplete);

            const data = capture();
            resolve(data);
            nextSeek();
          };

          // If currentTime is already at seekTime, setting currentTime will not trigger 'seeked'
          if (Math.abs(video.currentTime - seekTime) < 0.001) {
            onSeekComplete();
            return;
          }

          timeoutId = setTimeout(onSeekComplete, 120);
          video.addEventListener('seeked', onSeekComplete, { once: true });
          video.currentTime = seekTime;
        });
      });
    });
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
  }

  public close() {
    if (this.videoElement) {
      this.videoElement.src = '';
      this.videoElement.load();
      this.videoElement = null;
    }
    this.imageFiles = [];
    this.imageElements = [];
    this.frameCache.clear();
    this.isSequence = false;
    this.isImageList = false;
  }
}
