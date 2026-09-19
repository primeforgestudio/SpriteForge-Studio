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
      const onReady = () => {
        if (resolved) return;
        resolved = true;

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

        resolve(this.metadata);
      };

      video.onloadedmetadata = () => {
        onReady();
      };

      video.addEventListener('loadeddata', onReady, { once: true });

      if (video.readyState >= 1) {
        onReady();
      }

      video.onerror = () => {
        reject(new Error(`Failed to load video: ${video.error?.message || 'unknown error'}`));
      };
    });
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

  private seekLock: Promise<any> = Promise.resolve();

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
      const data = this.offscreenCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      this.frameCache.set(clampedIndex, data);
      return data;
    }

    if (!this.videoElement) return null;

    // Sequential seek queue to prevent decoder lockup
    return new Promise<ImageData | null>((resolve) => {
      this.seekLock = this.seekLock.then(() => {
        return new Promise<void>((nextSeek) => {
          const video = this.videoElement;
          if (!video) {
            resolve(null);
            nextSeek();
            return;
          }

          const targetTime = clampedIndex === 0 ? 0.001 : clampedIndex / this.metadata.fps;
          const seekTime = Math.min(targetTime, Math.max(0, (video.duration || 0) - 0.001));

          const capture = (): ImageData | null => {
            this.offscreenCanvas.width = video.videoWidth;
            this.offscreenCanvas.height = video.videoHeight;
            this.offscreenCtx.clearRect(0, 0, video.videoWidth, video.videoHeight);
            this.offscreenCtx.drawImage(video, 0, 0);
            const data = this.offscreenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
            if (this.isFrameValid(data)) {
              this.frameCache.set(clampedIndex, data);
              return data;
            }
            return null;
          };

          // If already at target time and video has ready frame
          if (Math.abs(video.currentTime - seekTime) < 0.002 && video.readyState >= 2) {
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

            this.offscreenCanvas.width = video.videoWidth;
            this.offscreenCanvas.height = video.videoHeight;
            this.offscreenCtx.clearRect(0, 0, video.videoWidth, video.videoHeight);
            this.offscreenCtx.drawImage(video, 0, 0);
            const data = this.offscreenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
            if (this.isFrameValid(data)) {
              this.frameCache.set(clampedIndex, data);
            }
            resolve(data);
            nextSeek();
          };

          // If currentTime is already at seekTime, setting currentTime will not trigger 'seeked'
          if (Math.abs(video.currentTime - seekTime) < 0.001) {
            onSeekComplete();
            return;
          }

          timeoutId = setTimeout(onSeekComplete, 300);
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
