import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, BackgroundMode, SpriteTransform, AnimationTrack, ExportScope } from './core/types';
import { VideoLoader } from './core/videoLoader';
import { ImageProcessor } from './core/imageProcessor';
import { AtlasBuilder } from './core/atlasBuilder';
import { SpriteProcessor } from './core/spriteProcessor';
import { LoopDetector } from './core/loopDetector';
import { BoundingCrop, StatePreset } from './core/boundingCrop';
import { GodotExporter } from './core/godotExporter';
import { TemporalProcessor } from './core/temporalProcessor';
import { NormalMapGenerator } from './core/normalMapGenerator';
import { GifEncoder } from './core/gifEncoder';
import {
  StorageManager,
  DEFAULT_KEYING,
  DEFAULT_ATLAS,
  DEFAULT_SPRITES,
  DEFAULT_BG_PRESETS,
} from './core/storage';
import { Header } from './components/Header';
import { LeftSidebar, LoadedFileItem } from './components/LeftSidebar';
import { Viewport } from './components/Viewport';
import { Timeline } from './components/Timeline';
import { AtlasPanel } from './components/AtlasPanel';
import { SpritesPanel } from './components/SpritesPanel';
import { AtlasPreview } from './components/AtlasPreview';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  // App Mode & Settings
  const [mode, setMode] = useState<AppMode>('atlas');
  const [bgMode, setBgMode] = useState<BackgroundMode>('solid');
  const [bgColor, setBgColor] = useState<[number, number, number]>([35, 60, 48]); // Muted green matching screenshot
  const [bgPresets, setBgPresets] = useState<[number, number, number][]>(DEFAULT_BG_PRESETS);

  const [keyingSettings, setKeyingSettings] = useState(DEFAULT_KEYING);
  const [atlasSettings, setAtlasSettings] = useState(DEFAULT_ATLAS);
  const [spritesSettings, setSpritesSettings] = useState(DEFAULT_SPRITES);

  // Multi-Track Animation Sets
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [exportScope, setExportScope] = useState<ExportScope>('single');

  // Loaded Media Files list (Left Sidebar)
  const [loadedFiles, setLoadedFiles] = useState<LoadedFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');

  // Sprites Mode Transforms
  const [currentTransform, setCurrentTransform] = useState<SpriteTransform>({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  });
  const [spriteTransforms, setSpriteTransforms] = useState<Map<number, SpriteTransform>>(new Map());
  const [selectedSpriteIndex, setSelectedSpriteIndex] = useState(0);

  // Viewport & Eyedropper
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [viewportCanvas, setViewportCanvas] = useState<HTMLCanvasElement | null>(null);

  // Timeline
  const [currentFrame, setCurrentFrame] = useState(0);
  const [cropStart, setCropStart] = useState(0);
  const [cropEnd, setCropEnd] = useState(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [statePreset, setStatePreset] = useState<StatePreset>('standard');
  const [isAutoCropping, setIsAutoCropping] = useState(false);
  const [exportFilename, setExportFilename] = useState('character_atlas');
  const [showMask, setShowMask] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [showGarbageMatte, setShowGarbageMatte] = useState(false);
  const [showColliders, setShowColliders] = useState(false);
  const [onionGhosts, setOnionGhosts] = useState<{ prev?: HTMLCanvasElement | null; next?: HTMLCanvasElement | null } | null>(null);
  const [generateNormalMap, setGenerateNormalMap] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);

  // Panel Resizing State
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('converter_atlas_left_w');
    return saved ? Math.min(520, Math.max(220, Number(saved))) : 290;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem('converter_atlas_right_w');
    return saved ? Math.min(550, Math.max(240, Number(saved))) : 300;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    document.body.classList.add('resizing-active');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(520, Math.max(220, moveEvent.clientX));
      setLeftWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      setIsResizingLeft(false);
      document.body.classList.remove('resizing-active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const finalWidth = Math.min(520, Math.max(220, upEvent.clientX));
      localStorage.setItem('converter_atlas_left_w', String(finalWidth));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizingRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    document.body.classList.add('resizing-active');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(550, Math.max(240, window.innerWidth - moveEvent.clientX));
      setRightWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      setIsResizingRight(false);
      document.body.classList.remove('resizing-active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const finalWidth = Math.min(550, Math.max(240, window.innerWidth - upEvent.clientX));
      localStorage.setItem('converter_atlas_right_w', String(finalWidth));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Loaders
  const atlasLoaderRef = useRef<VideoLoader>(new VideoLoader());
  const spritesLoaderRef = useRef<VideoLoader>(new VideoLoader());

  // Previews
  const [atlasCanvas, setAtlasCanvas] = useState<HTMLCanvasElement | null>(null);
  const [spritesPreviewCanvases, setSpritesPreviewCanvases] = useState<HTMLCanvasElement[]>([]);

  // Load saved settings
  useEffect(() => {
    const saved = StorageManager.loadSettings();
    setKeyingSettings(saved.keying);
    setAtlasSettings(saved.atlas);
    setSpritesSettings(saved.sprites);
    setBgPresets(saved.bgPresets);
  }, []);

  // Save settings on change
  useEffect(() => {
    StorageManager.saveSettings({
      keying: keyingSettings,
      atlas: atlasSettings,
      sprites: spritesSettings,
      bgPresets,
    });
  }, [keyingSettings, atlasSettings, spritesSettings, bgPresets]);

  // Distribute keyframe markers evenly
  const distributeMarkers = useCallback(() => {
    const range = cropEnd - cropStart;
    const count = atlasSettings.framesCount;
    if (count <= 0 || range <= 0) {
      setMarkers([cropStart]);
      return;
    }

    const step = range / Math.max(1, count - 1);
    const newMarkers: number[] = [];
    for (let i = 0; i < count; i++) {
      newMarkers.push(Math.round(cropStart + i * step));
    }
    setMarkers(newMarkers);
  }, [cropStart, cropEnd, atlasSettings.framesCount]);

  useEffect(() => {
    if (markers.length === 0 && cropEnd > 0) {
      distributeMarkers();
    }
  }, [cropEnd, markers.length, distributeMarkers]);

  // Auto-Detect optimal seamless loop frame
  const handleDetectLoop = async (): Promise<string | null> => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 4) return null;

    const result = await LoopDetector.detectBestLoopFrame(
      loader,
      cropStart,
      loader.metadata.totalFrames,
      keyingSettings
    );

    if (result) {
      setCropEnd(result.bestFrame);
      const range = result.bestFrame - cropStart;
      const count = atlasSettings.framesCount;
      if (count > 0 && range > 0) {
        const step = range / Math.max(1, count - 1);
        const newMarkers: number[] = [];
        for (let i = 0; i < count; i++) {
          newMarkers.push(Math.round(cropStart + i * step));
        }
        setMarkers(newMarkers);
      }
      return `Loop @ Frame ${result.bestFrame} (${result.matchPercentage}% match)`;
    }
    return null;
  };

  // Auto-Crop tight character bounding box across keyframes
  const handleAutoCrop = async () => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0 || markers.length === 0) return;

    setIsAutoCropping(true);
    try {
      const result = await BoundingCrop.calculateUnionBounds(
        loader,
        markers,
        keyingSettings,
        statePreset
      );
      if (result) {
        setAtlasSettings((prev) => ({
          ...prev,
          frameWidth: result.recommendedCellW,
          frameHeight: result.recommendedCellH,
          cropBox: {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
          },
        }));
      }
    } finally {
      setIsAutoCropping(false);
    }
  };

  const handleResetCrop = () => {
    setAtlasSettings((prev) => ({
      ...prev,
      cropBox: null,
    }));
  };

  // Auto-fit feet physics collision capsule based on ground contact pixels
  const handleAutoFitFeet = async () => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0) return;
    const raw = (await loader.getFrame(currentFrame)) || (await loader.getFrame(0));
    if (!raw) return;

    const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
    if (keyingSettings.enabled) {
      ImageProcessor.applyChromaKey(processed, keyingSettings);
    }

    const bounds = BoundingCrop.detectFeetBounds(
      processed,
      atlasSettings.pivot || { x: 0.5, y: 0.95 }
    );

    setAtlasSettings((prev) => {
      const cur = prev.collisionSettings || {
        enabled: true,
        generateTscn: true,
        feet: { enabled: true, shape: 'capsule', width: 28, height: 12, offsetX: 0, offsetY: -6 },
        hurtbox: { enabled: true, width: 36, height: 64, offsetX: 0, offsetY: -36 },
        hitbox: { enabled: false, width: 32, height: 32, offsetX: 28, offsetY: -32 },
      };
      return {
        ...prev,
        collisionSettings: {
          ...cur,
          feet: {
            ...cur.feet,
            width: bounds.width,
            height: bounds.height,
            offsetX: bounds.offsetX,
            offsetY: bounds.offsetY,
          },
        },
      };
    });
    setShowColliders(true);
  };

  // Auto-Detect background chroma key color from video border pixels
  const handleAutoDetectKey = async () => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0) return;
    const raw = (await loader.getFrame(currentFrame)) || (await loader.getFrame(0));
    if (!raw) return;

    const detected = ImageProcessor.detectBorderKeyColor(raw);
    setKeyingSettings((prev) => ({ ...prev, keyColor: detected, enabled: true }));
    if (!bgPresets.some((p) => p[0] === detected[0] && p[1] === detected[1] && p[2] === detected[2])) {
      setBgPresets((prev) => [detected, ...prev.slice(0, 4)]);
    }
  };

  // Render Atlas Frame in Viewport
  const renderAtlasFrame = useCallback(async (forcedFrame?: number) => {
    if (mode !== 'atlas') return;
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0) return;
    if (loader.isVideoPlaying() && forcedFrame === undefined) return;

    const targetFrame = forcedFrame !== undefined ? forcedFrame : currentFrame;
    const rawData = loader.getCachedFrame(targetFrame) || (await loader.getFrame(targetFrame));
    if (!rawData) return;

    const canvas = document.createElement('canvas');
    canvas.width = rawData.width;
    canvas.height = rawData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const processedData = new ImageData(
      new Uint8ClampedArray(rawData.data),
      rawData.width,
      rawData.height
    );

    ImageProcessor.applyChromaKey(processedData, keyingSettings);
    if (showMask) {
      ImageProcessor.convertToAlphaMask(processedData);
    }
    ctx.putImageData(processedData, 0, 0);

    setViewportCanvas(canvas);
  }, [mode, currentFrame, keyingSettings, showMask]);

  useEffect(() => {
    renderAtlasFrame();
  }, [renderAtlasFrame]);

  // Hardware-accelerated smooth video playback loop
  useEffect(() => {
    if (mode !== 'atlas' || !isPlaying) return;
    const loader = atlasLoaderRef.current;
    const video = loader.videoElement;
    if (!video) return;

    let animId: number;
    let isCancelled = false;

    video.muted = true;
    const fps = loader.metadata.fps || 30;
    const startTime = cropStart / fps;
    const endTime = cropEnd / fps;

    if (video.currentTime < startTime || video.currentTime > endTime) {
      video.currentTime = startTime;
    }

    video.play().catch(() => {});

    const processFrame = () => {
      if (isCancelled) return;

      const curSec = video.currentTime;
      const curFrame = Math.min(cropEnd, Math.max(cropStart, Math.round(curSec * fps)));

      if (curSec > (cropEnd + 0.5) / fps) {
        video.currentTime = startTime;
      } else {
        const raw = loader.captureCurrentPlayingFrame();
        if (raw) {
          loader.setCachedFrame(curFrame, raw);
          const canvas = document.createElement('canvas');
          canvas.width = raw.width;
          canvas.height = raw.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const processedData = new ImageData(
              new Uint8ClampedArray(raw.data),
              raw.width,
              raw.height
            );
            ImageProcessor.applyChromaKey(processedData, keyingSettings);
            if (showMask) {
              ImageProcessor.convertToAlphaMask(processedData);
            }
            ctx.putImageData(processedData, 0, 0);
            setViewportCanvas(canvas);
          }
        }
      }

      if ('requestVideoFrameCallback' in video) {
        // @ts-ignore
        video.requestVideoFrameCallback(processFrame);
      } else {
        animId = requestAnimationFrame(processFrame);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      // @ts-ignore
      video.requestVideoFrameCallback(processFrame);
    } else {
      animId = requestAnimationFrame(processFrame);
    }

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      video.pause();
    };
  }, [mode, isPlaying, cropStart, cropEnd, keyingSettings, showMask]);

  // Render Sprite in Viewport (Sprites Mode)
  const renderSpriteFrame = useCallback(async () => {
    if (mode !== 'sprites') return;
    const loader = spritesLoaderRef.current;
    if (loader.metadata.totalFrames <= 0) return;

    const rawData = await loader.getFrame(selectedSpriteIndex);
    if (!rawData) return;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = rawData.width;
    baseCanvas.height = rawData.height;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(rawData, 0, 0);

    const transform = spritesSettings.applyToAll
      ? currentTransform
      : spriteTransforms.get(selectedSpriteIndex) || currentTransform;

    let processed = SpriteProcessor.processSprite(baseCanvas, transform, spritesSettings);
    if (showMask) {
      processed = ImageProcessor.canvasToAlphaMask(processed);
    }
    setViewportCanvas(processed);
  }, [mode, selectedSpriteIndex, currentTransform, spritesSettings, spriteTransforms, showMask]);

  useEffect(() => {
    renderSpriteFrame();
  }, [renderSpriteFrame]);

  // Generate Onion Skinning Ghosts (coral red for previous frame, cyan for next frame)
  useEffect(() => {
    if (!atlasSettings.enableOnionSkin || mode !== 'atlas') {
      setOnionGhosts(null);
      return;
    }

    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 1 || markers.length === 0) {
      setOnionGhosts(null);
      return;
    }

    let isMounted = true;

    const buildGhosts = async () => {
      // Find previous and next frame indices in markers
      const currIdx = markers.indexOf(currentFrame);
      let prevIdx: number;
      let nextIdx: number;

      if (currIdx >= 0) {
        prevIdx = currIdx > 0 ? markers[currIdx - 1] : markers[markers.length - 1];
        nextIdx = currIdx < markers.length - 1 ? markers[currIdx + 1] : markers[0];
      } else {
        const prevMarkers = markers.filter((m) => m < currentFrame);
        const nextMarkers = markers.filter((m) => m > currentFrame);
        prevIdx = prevMarkers.length > 0 ? prevMarkers[prevMarkers.length - 1] : markers[markers.length - 1];
        nextIdx = nextMarkers.length > 0 ? nextMarkers[0] : markers[0];
      }

      const opacity = (atlasSettings.onionOpacity ?? 35) / 100;
      let prevCanvas: HTMLCanvasElement | null = null;
      let nextCanvas: HTMLCanvasElement | null = null;

      // Build previous ghost (Coral Red: 255, 75, 75)
      if (prevIdx !== currentFrame) {
        const rawPrev = await loader.getFrame(prevIdx);
        if (rawPrev) {
          const c = document.createElement('canvas');
          c.width = rawPrev.width;
          c.height = rawPrev.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            const imgData = new ImageData(new Uint8ClampedArray(rawPrev.data), rawPrev.width, rawPrev.height);
            ImageProcessor.applyChromaKey(imgData, keyingSettings);
            ctx.putImageData(imgData, 0, 0);
            prevCanvas = ImageProcessor.createTintedGhost(c, [255, 75, 75], opacity);
          }
        }
      }

      // Build next ghost (Cyan Blue: 0, 225, 255)
      if (nextIdx !== currentFrame && nextIdx !== prevIdx) {
        const rawNext = await loader.getFrame(nextIdx);
        if (rawNext) {
          const c = document.createElement('canvas');
          c.width = rawNext.width;
          c.height = rawNext.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            const imgData = new ImageData(new Uint8ClampedArray(rawNext.data), rawNext.width, rawNext.height);
            ImageProcessor.applyChromaKey(imgData, keyingSettings);
            ctx.putImageData(imgData, 0, 0);
            nextCanvas = ImageProcessor.createTintedGhost(c, [0, 225, 255], opacity);
          }
        }
      }

      if (isMounted) {
        setOnionGhosts({ prev: prevCanvas, next: nextCanvas });
      }
    };

    buildGhosts();

    return () => {
      isMounted = false;
    };
  }, [mode, currentFrame, markers, keyingSettings, atlasSettings.enableOnionSkin, atlasSettings.onionOpacity]);

  // Update Atlas Preview (Fast & Downsampled for UI thumbnail)
  const isUpdatingAtlasRef = useRef(false);
  const updateAtlasPreview = useCallback(async () => {
    if (mode !== 'atlas' || isUpdatingAtlasRef.current) return;
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0 || markers.length === 0) return;

    isUpdatingAtlasRef.current = true;

    try {
      const fw = atlasSettings.frameWidth;
      const fh = atlasSettings.frameHeight;
      const cols = atlasSettings.columns;
      const rows = atlasSettings.rows;

      // High-resolution preview matching configured frame dimensions
      const maxDim = Math.max(fw, fh);
      const previewCellSize = Math.min(maxDim, 1024);
      const pScale = Math.min(1.0, previewCellSize / maxDim);
      const pfw = Math.max(32, Math.round(fw * pScale));
      const pfh = Math.max(32, Math.round(fh * pScale));

      const frameCanvases: HTMLCanvasElement[] = [];

      for (const frameIdx of markers) {
        const raw = await loader.getFrame(frameIdx);
        if (raw) {
          // 1. Downscale raw frame first with bounding cropBox if active
          const smallCanvas = ImageProcessor.resizeCanvas(
            raw,
            pfw,
            pfh,
            { width: fw, height: fh },
            atlasSettings.cropBox
          );
          const smallCtx = smallCanvas.getContext('2d');
          if (smallCtx) {
            const smallData = smallCtx.getImageData(0, 0, pfw, pfh);
            // 2. Apply Chroma Key on tiny 128px buffer (takes < 0.2ms!)
            ImageProcessor.applyChromaKey(smallData, keyingSettings);
            smallCtx.putImageData(smallData, 0, 0);

            // 3. Apply Contact Drop-Shadow if enabled
            if (atlasSettings.enableShadow) {
              ImageProcessor.applyDropShadow(
                smallCanvas,
                (atlasSettings.shadowOpacity ?? 45) / 100,
                atlasSettings.shadowScale ?? 60
              );
            }
          }
          frameCanvases.push(smallCanvas);
        } else {
          const blank = document.createElement('canvas');
          blank.width = pfw;
          blank.height = pfh;
          frameCanvases.push(blank);
        }
        // Yield to event loop
        await new Promise((r) => setTimeout(r, 0));
      }

      let finalFrames = frameCanvases;

      // 4. Temporal De-Flicker across sequence
      if (atlasSettings.enableDeFlicker && finalFrames.length > 2) {
        finalFrames = TemporalProcessor.applyTemporalDeFlicker(
          finalFrames,
          atlasSettings.deFlickerStrength ?? 40
        );
      }

      // 5. Ground Snap (Baseline Lock) across sequence
      if (atlasSettings.enableGroundSnap && finalFrames.length > 0) {
        const { bottomYs, targetBaselineY } = TemporalProcessor.calculateSequenceBaseline(finalFrames);
        finalFrames = finalFrames.map((c, i) =>
          TemporalProcessor.applyGroundSnap(c, bottomYs[i], targetBaselineY)
        );
      }

      const atlas = AtlasBuilder.createAtlasCanvas(finalFrames, cols, rows, pfw, pfh);
      setAtlasCanvas(atlas);
    } finally {
      isUpdatingAtlasRef.current = false;
    }
  }, [mode, markers, atlasSettings, keyingSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateAtlasPreview();
    }, 600);
    return () => clearTimeout(timer);
  }, [updateAtlasPreview]);

  // Helper to detect clean animation names
  const cleanAnimName = (filename: string): string => {
    const base = filename.replace(/\.[^/.]+$/, '').toLowerCase();
    const known = ['idle', 'walk', 'run', 'attack', 'hit', 'hurt', 'death', 'die', 'jump', 'fall', 'cast', 'dash', 'slash', 'shoot', 'roll'];
    for (const k of known) {
      if (base.includes(k)) return k;
    }
    return base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 16) || 'anim';
  };

  // Load Media Files
  const handleLoadFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const first = files[0];
    const isVideo = first.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(first.name);
    const baseName = first.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'character_atlas';
    setExportFilename(baseName);

    try {
      if (mode === 'atlas') {
        const loader = atlasLoaderRef.current;
        let meta;
        if (isVideo) {
          meta = await loader.loadVideoFile(first, atlasSettings.fps);
        } else {
          meta = await loader.loadImageFiles(files, false, atlasSettings.fps);
        }

        const range = meta.totalFrames - 1;
        const count = atlasSettings.framesCount;
        const initialMarkers: number[] = [];
        const step = range / Math.max(1, count - 1);
        for (let i = 0; i < count; i++) {
          initialMarkers.push(Math.round(i * step));
        }

        setCropStart(0);
        setCropEnd(range);
        setCurrentFrame(0);
        setMarkers(initialMarkers);
        renderAtlasFrame(0);

        // Generate thumbnail for file card in left sidebar
        const firstFrame = await loader.getFrame(0);
        let thumbUrl = '';
        if (firstFrame) {
          const c = document.createElement('canvas');
          c.width = firstFrame.width;
          c.height = firstFrame.height;
          c.getContext('2d')?.putImageData(firstFrame, 0, 0);
          thumbUrl = c.toDataURL();
        }

        const sizeMb = (first.size / (1024 * 1024)).toFixed(1);
        const newItem: LoadedFileItem = {
          id: String(Date.now()),
          name: first.name,
          framesCount: meta.totalFrames,
          sizeStr: `${sizeMb} MB`,
          thumbnailUrl: thumbUrl,
          fileRef: first,
        };

        setLoadedFiles((prev) => [newItem, ...prev]);
        setSelectedFileId(newItem.id);

        // Build AnimationTracks for all uploaded files
        const newTracks: AnimationTrack[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const aName = cleanAnimName(f.name);
          const tId = `${Date.now()}_${i}`;

          const trackMarkers = (i === 0 && initialMarkers.length > 0)
            ? initialMarkers
            : Array.from({ length: atlasSettings.framesCount }, (_, idx) =>
                Math.round((idx * (meta.totalFrames - 1)) / Math.max(1, atlasSettings.framesCount - 1))
              );

          newTracks.push({
            id: tId,
            name: aName,
            fileName: f.name,
            fileRef: f,
            thumbnailUrl: i === 0 ? thumbUrl : undefined,
            totalFrames: meta.totalFrames,
            cropStart: 0,
            cropEnd: meta.totalFrames - 1,
            markers: trackMarkers,
            fps: atlasSettings.fps,
            loop: !/attack|death|die|hit|hurt|cast|jump/i.test(aName),
            enabled: true,
          });
        }
        setTracks((prev) => [...prev, ...newTracks]);
        setSelectedTrackId(newTracks[0].id);
      } else {
        // Sprites mode
        const loader = spritesLoaderRef.current;
        const meta = await loader.loadImageFiles(files, true);
        setSelectedSpriteIndex(0);

        const previewCanvases: HTMLCanvasElement[] = [];
        for (let i = 0; i < Math.min(meta.totalFrames, 30); i++) {
          const raw = await loader.getFrame(i);
          if (raw) {
            const c = document.createElement('canvas');
            c.width = raw.width;
            c.height = raw.height;
            c.getContext('2d')?.putImageData(raw, 0, 0);
            previewCanvases.push(c);
          }
        }
        setSpritesPreviewCanvases(previewCanvases);

        // Add file items for each image
        const newItems: LoadedFileItem[] = files.slice(0, 10).map((f, i) => ({
          id: `${Date.now()}_${i}`,
          name: f.name,
          framesCount: 1,
          sizeStr: `${(f.size / 1024).toFixed(0)} KB`,
          thumbnailUrl: previewCanvases[i]?.toDataURL(),
          fileRef: f,
        }));
        setLoadedFiles(newItems);
        if (newItems.length > 0) setSelectedFileId(newItems[0].id);
      }
    } catch (e: any) {
      alert(`Error loading media: ${e.message}`);
    }
  };

  // Switch between tracks
  const handleSelectTrack = async (id: string) => {
    // 1. Save current timeline state to active track before switching
    if (selectedTrackId) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrackId
            ? { ...t, cropStart, cropEnd, markers, fps: atlasSettings.fps }
            : t
        )
      );
    }

    const target = tracks.find((t) => t.id === id);
    if (!target || !target.fileRef) return;
    setSelectedTrackId(id);
    setSelectedFileId(id);
    const baseName = target.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'character_atlas';
    setExportFilename(baseName);

    const isVideo = target.fileRef.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(target.fileName);
    if (isVideo) {
      const meta = await atlasLoaderRef.current.loadVideoFile(target.fileRef, target.fps || atlasSettings.fps);
      target.totalFrames = meta.totalFrames;

      // Ensure thumbnail exists
      if (!target.thumbnailUrl) {
        const firstFrame = await atlasLoaderRef.current.getFrame(0);
        if (firstFrame) {
          const c = document.createElement('canvas');
          c.width = firstFrame.width;
          c.height = firstFrame.height;
          c.getContext('2d')?.putImageData(firstFrame, 0, 0);
          target.thumbnailUrl = c.toDataURL();
        }
      }

      const range = meta.totalFrames - 1;
      const targetCropEnd = target.cropEnd > 0 ? Math.min(target.cropEnd, range) : range;
      setCropStart(target.cropStart || 0);
      setCropEnd(targetCropEnd);
      setCurrentFrame(target.cropStart || 0);

      if (target.markers && target.markers.length > 0) {
        setMarkers(target.markers);
      } else {
        const count = atlasSettings.framesCount;
        const step = range / Math.max(1, count - 1);
        const newMarkers: number[] = [];
        for (let i = 0; i < count; i++) {
          newMarkers.push(Math.round(i * step));
        }
        setMarkers(newMarkers);
      }

      if (target.fps) {
        setAtlasSettings((prev) => ({ ...prev, fps: target.fps }));
      }
    }
  };

  const handleUpdateTrack = (updated: AnimationTrack) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleToggleTrackEnabled = (id: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const handleMoveTrack = (id: string, dir: 'up' | 'down') => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Export Action
  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (mode === 'atlas') {
        const fw = atlasSettings.frameWidth;
        const fh = atlasSettings.frameHeight;

        if (exportScope === 'master') {
          // --- MASTER ATLAS MULTI-TRACK EXPORT ---
          const currentTracks = tracks.map((t) =>
            t.id === selectedTrackId
              ? { ...t, cropStart, cropEnd, markers, fps: atlasSettings.fps }
              : t
          );
          const activeTracks = currentTracks.filter((t) => t.enabled && t.fileRef);
          if (activeTracks.length === 0) {
            alert('No enabled tracks to export in Master Atlas');
            return;
          }

          const allProcessedCanvases: HTMLCanvasElement[] = [];
          const tracksMeta: {
            name: string;
            fps: number;
            loop: boolean;
            frameIndices: number[];
          }[] = [];

          for (const track of activeTracks) {
            const tempLoader = new VideoLoader();
            await tempLoader.loadVideoFile(track.fileRef!, track.fps || atlasSettings.fps);

            const trackMarkers = track.markers && track.markers.length > 0 ? track.markers : [0];
            const trackCanvases: HTMLCanvasElement[] = [];

            for (const frameIdx of trackMarkers) {
              const raw = await tempLoader.getFrame(frameIdx);
              if (raw) {
                const processed = new ImageData(
                  new Uint8ClampedArray(raw.data),
                  raw.width,
                  raw.height
                );
                ImageProcessor.applyChromaKey(processed, keyingSettings);
                const resized = ImageProcessor.resizeCanvas(
                  processed,
                  fw,
                  fh,
                  { width: fw, height: fh },
                  atlasSettings.cropBox
                );
                if (atlasSettings.enableShadow) {
                  ImageProcessor.applyDropShadow(
                    resized,
                    (atlasSettings.shadowOpacity ?? 45) / 100,
                    atlasSettings.shadowScale ?? 60
                  );
                }
                trackCanvases.push(resized);
              } else {
                const blank = document.createElement('canvas');
                blank.width = fw;
                blank.height = fh;
                trackCanvases.push(blank);
              }
            }

            let finalTrackFrames = trackCanvases;
            if (atlasSettings.enableDeFlicker && finalTrackFrames.length > 2) {
              finalTrackFrames = TemporalProcessor.applyTemporalDeFlicker(
                finalTrackFrames,
                atlasSettings.deFlickerStrength ?? 40
              );
            }
            if (atlasSettings.enableGroundSnap && finalTrackFrames.length > 0) {
              const { bottomYs, targetBaselineY } = TemporalProcessor.calculateSequenceBaseline(finalTrackFrames);
              finalTrackFrames = finalTrackFrames.map((c, i) =>
                TemporalProcessor.applyGroundSnap(c, bottomYs[i], targetBaselineY)
              );
            }

            const startIdx = allProcessedCanvases.length;
            const frameIndices: number[] = [];
            for (let i = 0; i < finalTrackFrames.length; i++) {
              frameIndices.push(startIdx + i);
              allProcessedCanvases.push(finalTrackFrames[i]);
            }

            tracksMeta.push({
              name: track.name || 'anim',
              fps: track.fps || atlasSettings.fps || 12,
              loop: track.loop,
              frameIndices,
            });
          }

          const totalFrames = allProcessedCanvases.length;
          const cols = Math.max(1, Math.min(16, atlasSettings.columns));
          const rows = Math.ceil(totalFrames / cols);

          const masterAtlas = AtlasBuilder.createAtlasCanvas(allProcessedCanvases, cols, rows, fw, fh);
          const pngBlob = await AtlasBuilder.canvasToBlob(masterAtlas);

          const cleanName = (exportFilename.trim() || 'character')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_') || 'character';
          const pngFilename = `${cleanName}_master_frames.png`;
          const tresFilename = `${cleanName}_master_frames.tres`;
          const asepriteFilename = `${cleanName}_master_aseprite.json`;
          const jsonFilename = `${cleanName}_master_frames.json`;

          AtlasBuilder.triggerDownload(pngBlob, pngFilename);

          if (generateNormalMap) {
            const normalCanvas = NormalMapGenerator.generateNormalMap(masterAtlas, 2.5);
            const normalBlob = await AtlasBuilder.canvasToBlob(normalCanvas);
            AtlasBuilder.triggerDownload(normalBlob, `${cleanName}_master_normal.png`);
          }

          // Godot 4 Multi-Animation SpriteFrames (.tres)
          const tresString = GodotExporter.generateMultiTrackSpriteFramesTres(
            pngFilename,
            { ...atlasSettings, columns: cols, rows },
            tracksMeta
          );
          const tresBlob = new Blob([tresString], { type: 'text/plain' });
          AtlasBuilder.triggerDownload(tresBlob, tresFilename);

          // Godot 4 CharacterBody2D Scene (.tscn) if enabled
          if (atlasSettings.collisionSettings?.generateTscn ?? true) {
            const tscnFilename = `${cleanName}_master.tscn`;
            const firstTrackName = tracksMeta[0]?.name || 'idle';
            const tscnString = GodotExporter.generateCharacterSceneTscn(
              cleanName,
              tresFilename,
              { ...atlasSettings, columns: cols, rows },
              firstTrackName
            );
            const tscnBlob = new Blob([tscnString], { type: 'text/plain' });
            AtlasBuilder.triggerDownload(tscnBlob, tscnFilename);
          }

          // Aseprite JSON with frameTags
          const asepriteMeta = AtlasBuilder.createMultiTrackAsepriteJson(
            { ...atlasSettings, columns: cols, rows },
            tracksMeta,
            pngFilename
          );
          const asepriteBlob = new Blob([JSON.stringify(asepriteMeta, null, 2)], {
            type: 'application/json',
          });
          AtlasBuilder.triggerDownload(asepriteBlob, asepriteFilename);

          // Standard Metadata JSON
          const masterJson = {
            app: 'SpriteForge',
            version: '2.0',
            name: cleanName,
            scope: 'master_set',
            frameWidth: fw,
            frameHeight: fh,
            columns: cols,
            rows,
            totalFrames,
            pivot: atlasSettings.pivot || { x: 0.5, y: 0.95 },
            tracks: tracksMeta,
          };
          const jsonBlob = new Blob([JSON.stringify(masterJson, null, 4)], {
            type: 'application/json',
          });
          AtlasBuilder.triggerDownload(jsonBlob, jsonFilename);
          return;
        }

        // --- SINGLE CLIP EXPORT ---
        const loader = atlasLoaderRef.current;
        if (loader.metadata.totalFrames <= 0 || markers.length === 0) return;

        const cols = atlasSettings.columns;
        const rows = atlasSettings.rows;

        const frameCanvases: HTMLCanvasElement[] = [];
        for (const frameIdx of markers) {
          const raw = await loader.getFrame(frameIdx);
          if (raw) {
            const processed = new ImageData(
              new Uint8ClampedArray(raw.data),
              raw.width,
              raw.height
            );
            ImageProcessor.applyChromaKey(processed, keyingSettings);
            const resized = ImageProcessor.resizeCanvas(
              processed,
              fw,
              fh,
              { width: fw, height: fh },
              atlasSettings.cropBox
            );
            if (atlasSettings.enableShadow) {
              ImageProcessor.applyDropShadow(
                resized,
                (atlasSettings.shadowOpacity ?? 45) / 100,
                atlasSettings.shadowScale ?? 60
              );
            }
            frameCanvases.push(resized);
          } else {
            const blank = document.createElement('canvas');
            blank.width = fw;
            blank.height = fh;
            frameCanvases.push(blank);
          }
        }

        let finalFrames = frameCanvases;

        // Apply Temporal De-Flicker across sequence
        if (atlasSettings.enableDeFlicker && finalFrames.length > 2) {
          finalFrames = TemporalProcessor.applyTemporalDeFlicker(
            finalFrames,
            atlasSettings.deFlickerStrength ?? 40
          );
        }

        // Apply Ground Snap (Baseline Lock) across sequence
        if (atlasSettings.enableGroundSnap && finalFrames.length > 0) {
          const { bottomYs, targetBaselineY } = TemporalProcessor.calculateSequenceBaseline(finalFrames);
          finalFrames = finalFrames.map((c, i) =>
            TemporalProcessor.applyGroundSnap(c, bottomYs[i], targetBaselineY)
          );
        }

        const finalAtlas = AtlasBuilder.createAtlasCanvas(finalFrames, cols, rows, fw, fh);
        const pngBlob = await AtlasBuilder.canvasToBlob(finalAtlas);

        const cleanName = (exportFilename.trim() || loader.metadata.filename || 'animation')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'animation';
        const pngFilename = `${cleanName}_frames.png`;
        const jsonFilename = `${cleanName}_frames.json`;
        const tresFilename = `${cleanName}_frames.tres`;
        const asepriteFilename = `${cleanName}_aseprite.json`;

        AtlasBuilder.triggerDownload(pngBlob, pngFilename);

        // Export 2D Normal Map (_normal.png) if requested
        if (generateNormalMap) {
          const normalCanvas = NormalMapGenerator.generateNormalMap(finalAtlas, 2.5);
          const normalBlob = await AtlasBuilder.canvasToBlob(normalCanvas);
          AtlasBuilder.triggerDownload(normalBlob, `${cleanName}_normal.png`);
        }

        const jsonMeta = AtlasBuilder.createAtlasJson(
          loader.metadata,
          atlasSettings,
          markers,
          cropStart,
          cropEnd
        );
        const jsonBlob = new Blob([JSON.stringify(jsonMeta, null, 4)], {
          type: 'application/json',
        });
        AtlasBuilder.triggerDownload(jsonBlob, jsonFilename);

        // Export Aseprite-compatible JSON (Phaser / Unity / Defold / Flame)
        const asepriteMeta = AtlasBuilder.createAsepriteJson(
          loader.metadata,
          atlasSettings,
          markers,
          cleanName
        );
        const asepriteBlob = new Blob([JSON.stringify(asepriteMeta, null, 2)], {
          type: 'application/json',
        });
        AtlasBuilder.triggerDownload(asepriteBlob, asepriteFilename);

        // Export native Godot 4 SpriteFrames resource (.tres) with matching relative texture
        const tresString = GodotExporter.generateSpriteFramesTres(
          cleanName,
          pngFilename,
          atlasSettings,
          markers.length,
          atlasSettings.fps
        );
        const tresBlob = new Blob([tresString], { type: 'text/plain' });
        AtlasBuilder.triggerDownload(tresBlob, tresFilename);

        // Export native Godot 4 CharacterBody2D Scene (.tscn) if enabled
        if (atlasSettings.collisionSettings?.generateTscn ?? true) {
          const tscnFilename = `${cleanName}.tscn`;
          const tscnString = GodotExporter.generateCharacterSceneTscn(
            cleanName,
            tresFilename,
            atlasSettings,
            cleanName
          );
          const tscnBlob = new Blob([tscnString], { type: 'text/plain' });
          AtlasBuilder.triggerDownload(tscnBlob, tscnFilename);
        }
      } else {
        const loader = spritesLoaderRef.current;
        if (loader.metadata.totalFrames <= 0) return;

        const filesData: { name: string; canvas: HTMLCanvasElement }[] = [];
        for (let i = 0; i < loader.imageFiles.length; i++) {
          const raw = await loader.getFrame(i);
          if (raw) {
            const c = document.createElement('canvas');
            c.width = raw.width;
            c.height = raw.height;
            c.getContext('2d')?.putImageData(raw, 0, 0);
            filesData.push({ name: loader.imageFiles[i].name, canvas: c });
          }
        }

        const zipBlob = await SpriteProcessor.exportSpritesZip(
          filesData,
          spriteTransforms,
          currentTransform,
          spritesSettings
        );

        const cleanName = (exportFilename.trim() || 'sprites')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'sprites';
        AtlasBuilder.triggerDownload(zipBlob, `${cleanName}.zip`);
      }
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // One-click Animated GIF Exporter
  const handleExportGif = async () => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0 || markers.length === 0) return;
    setIsExportingGif(true);
    try {
      const fw = atlasSettings.frameWidth;
      const fh = atlasSettings.frameHeight;

      if (exportScope === 'master') {
        const currentTracks = tracks.map((t) =>
          t.id === selectedTrackId
            ? { ...t, cropStart, cropEnd, markers, fps: atlasSettings.fps }
            : t
        );
        const activeTracks = currentTracks.filter((t) => t.enabled && t.fileRef);
        if (activeTracks.length === 0) return;

        const allGifFrames: HTMLCanvasElement[] = [];
        for (const track of activeTracks) {
          const tempLoader = new VideoLoader();
          await tempLoader.loadVideoFile(track.fileRef!, track.fps || atlasSettings.fps);
          const trackMarkers = track.markers && track.markers.length > 0 ? track.markers : [0];
          const trackCanvases: HTMLCanvasElement[] = [];

          for (const frameIdx of trackMarkers) {
            const raw = await tempLoader.getFrame(frameIdx);
            if (raw) {
              const processed = new ImageData(
                new Uint8ClampedArray(raw.data),
                raw.width,
                raw.height
              );
              ImageProcessor.applyChromaKey(processed, keyingSettings);
              const resized = ImageProcessor.resizeCanvas(
                processed,
                fw,
                fh,
                { width: fw, height: fh },
                atlasSettings.cropBox
              );
              if (atlasSettings.enableShadow) {
                ImageProcessor.applyDropShadow(
                  resized,
                  (atlasSettings.shadowOpacity ?? 45) / 100,
                  atlasSettings.shadowScale ?? 60
                );
              }
              trackCanvases.push(resized);
            }
          }

          let finalTrackFrames = trackCanvases;
          if (atlasSettings.enableDeFlicker && finalTrackFrames.length > 2) {
            finalTrackFrames = TemporalProcessor.applyTemporalDeFlicker(
              finalTrackFrames,
              atlasSettings.deFlickerStrength ?? 40
            );
          }
          if (atlasSettings.enableGroundSnap && finalTrackFrames.length > 0) {
            const { bottomYs, targetBaselineY } = TemporalProcessor.calculateSequenceBaseline(finalTrackFrames);
            finalTrackFrames = finalTrackFrames.map((c, i) =>
              TemporalProcessor.applyGroundSnap(c, bottomYs[i], targetBaselineY)
            );
          }

          allGifFrames.push(...finalTrackFrames);
        }

        if (allGifFrames.length === 0) return;
        const gifBlob = await GifEncoder.encodeCanvasesToGif(allGifFrames, atlasSettings.fps || 12);
        const cleanName = (exportFilename.trim() || 'character')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'character';
        AtlasBuilder.triggerDownload(gifBlob, `${cleanName}_master.gif`);
        return;
      }

      const frameCanvases: HTMLCanvasElement[] = [];
      for (const frameIdx of markers) {
        const raw = await loader.getFrame(frameIdx);
        if (raw) {
          const processed = new ImageData(
            new Uint8ClampedArray(raw.data),
            raw.width,
            raw.height
          );
          ImageProcessor.applyChromaKey(processed, keyingSettings);
          const resized = ImageProcessor.resizeCanvas(
            processed,
            fw,
            fh,
            { width: fw, height: fh },
            atlasSettings.cropBox
          );
          if (atlasSettings.enableShadow) {
            ImageProcessor.applyDropShadow(
              resized,
              (atlasSettings.shadowOpacity ?? 45) / 100,
              atlasSettings.shadowScale ?? 60
            );
          }
          frameCanvases.push(resized);
        }
      }

      if (frameCanvases.length === 0) return;

      let finalFrames = frameCanvases;
      if (atlasSettings.enableDeFlicker && finalFrames.length > 2) {
        finalFrames = TemporalProcessor.applyTemporalDeFlicker(
          finalFrames,
          atlasSettings.deFlickerStrength ?? 40
        );
      }
      if (atlasSettings.enableGroundSnap && finalFrames.length > 0) {
        const { bottomYs, targetBaselineY } = TemporalProcessor.calculateSequenceBaseline(finalFrames);
        finalFrames = finalFrames.map((c, i) =>
          TemporalProcessor.applyGroundSnap(c, bottomYs[i], targetBaselineY)
        );
      }

      const gifBlob = await GifEncoder.encodeCanvasesToGif(finalFrames, atlasSettings.fps || 12);
      const cleanName = (exportFilename.trim() || loader.metadata.filename || 'animation')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_') || 'animation';
      AtlasBuilder.triggerDownload(gifBlob, `${cleanName}.gif`);
    } catch (e: any) {
      alert(`GIF Export failed: ${e.message}`);
    } finally {
      setIsExportingGif(false);
    }
  };

  const currentLoader = mode === 'atlas' ? atlasLoaderRef.current : spritesLoaderRef.current;
  const hasMedia = currentLoader.metadata.totalFrames > 0;
  const activeFilename = currentLoader.metadata.filename;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <Header
        mode={mode}
        setMode={setMode}
        onLoadFiles={handleLoadFiles}
        onExport={handleExport}
        onOpenSettings={() => setIsSettingsOpen(true)}
        bgMode={bgMode}
        setBgMode={setBgMode}
        bgColor={bgColor}
        setBgColor={setBgColor}
        bgPresets={bgPresets}
        isExporting={isExporting}
        hasMedia={hasMedia}
        activeFilename={activeFilename}
        fps={atlasSettings.fps}
      />

      {/* 3-Column Body Layout (Left Sidebar | Viewport + Timeline | Right Sidebar) */}
      <div className="app-layout">
        {/* 1. Left Sidebar (Media, Chroma Key, AI Cleanup & Stabilization) */}
        <LeftSidebar
          mode={mode}
          setMode={setMode}
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={handleSelectTrack}
          onUpdateTrack={handleUpdateTrack}
          onToggleTrackEnabled={handleToggleTrackEnabled}
          onMoveTrack={handleMoveTrack}
          onAddFiles={handleLoadFiles}
          exportScope={exportScope}
          setExportScope={setExportScope}
          spritesCount={spritesLoaderRef.current.metadata.totalFrames}
          keyingSettings={keyingSettings}
          onChangeKeying={setKeyingSettings}
          isEyedropperActive={isEyedropperActive}
          setIsEyedropperActive={setIsEyedropperActive}
          onAutoDetectKey={handleAutoDetectKey}
          atlasSettings={atlasSettings}
          onChangeAtlasSettings={setAtlasSettings}
          width={leftWidth}
        />

        {/* Left Resizer Handle */}
        <div
          className={`resizer-handle resizer-left ${isResizingLeft ? 'resizing' : ''}`}
          onMouseDown={startResizingLeft}
          onDoubleClick={() => {
            setLeftWidth(290);
            localStorage.setItem('converter_atlas_left_w', '290');
          }}
          title="Drag to resize Left Panel (Double-click to reset)"
        />

        {/* 2. Center Content (Viewport + Bottom Timeline) */}
        <main className="center-content">
          <Viewport
            frameCanvas={viewportCanvas}
            bgMode={bgMode}
            setBgMode={setBgMode}
            bgColor={bgColor}
            setBgColor={setBgColor}
            isEyedropperActive={isEyedropperActive}
            setIsEyedropperActive={setIsEyedropperActive}
            onPickColor={(color) => {
              setKeyingSettings((prev) => ({ ...prev, keyColor: color, enabled: true }));
              if (!bgPresets.some((p) => p[0] === color[0] && p[1] === color[1] && p[2] === color[2])) {
                setBgPresets((prev) => [color, ...prev.slice(0, 4)]);
              }
            }}
            onFilesDropped={handleLoadFiles}
            emptyMessage={mode === 'atlas' ? 'Drop Video or PNG Sequence here' : 'Drop PNG Sprites here'}
            hasMedia={hasMedia}
            showMask={showMask}
            setShowMask={setShowMask}
            pivot={atlasSettings.pivot || { x: 0.5, y: 0.95 }}
            onUpdatePivot={(p) => setAtlasSettings((prev) => ({ ...prev, pivot: p }))}
            showPivot={showPivot}
            setShowPivot={setShowPivot}
            enableOnionSkin={atlasSettings.enableOnionSkin}
            setEnableOnionSkin={(en) => setAtlasSettings((prev) => ({ ...prev, enableOnionSkin: en }))}
            onionGhosts={onionGhosts}
            enableGroundSnap={atlasSettings.enableGroundSnap}
            garbageMatte={keyingSettings.garbageMatte}
            onUpdateGarbageMatte={(m) => setKeyingSettings((prev) => ({ ...prev, garbageMatte: m }))}
            showGarbageMatte={showGarbageMatte}
            setShowGarbageMatte={setShowGarbageMatte}
            collisionSettings={atlasSettings.collisionSettings}
            onUpdateCollisionSettings={(col) =>
              setAtlasSettings((prev) => ({ ...prev, collisionSettings: col }))
            }
            showColliders={showColliders}
            setShowColliders={setShowColliders}
          />

          {/* Timeline */}
          {mode === 'atlas' && (
            <Timeline
              totalFrames={currentLoader.metadata.totalFrames}
              currentFrame={currentFrame}
              setCurrentFrame={setCurrentFrame}
              cropStart={cropStart}
              setCropStart={setCropStart}
              cropEnd={cropEnd}
              setCropEnd={setCropEnd}
              markers={markers}
              setMarkers={setMarkers}
              fps={atlasSettings.fps}
              setFps={(fps) => {
                setAtlasSettings((prev) => ({ ...prev, fps }));
                atlasLoaderRef.current.setFps(fps);
              }}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              onDistributeMarkers={distributeMarkers}
              onDetectLoop={handleDetectLoop}
            />
          )}
        </main>

        {/* Right Resizer Handle */}
        <div
          className={`resizer-handle resizer-right ${isResizingRight ? 'resizing' : ''}`}
          onMouseDown={startResizingRight}
          onDoubleClick={() => {
            setRightWidth(300);
            localStorage.setItem('converter_atlas_right_w', '300');
          }}
          title="Drag to resize Right Panel (Double-click to reset)"
        />

        {/* 3. Right Sidebar (Grid Settings, Live Preview & Export) */}
        <aside className="right-sidebar" style={{ width: rightWidth }}>
          {mode === 'atlas' ? (
            <>
              {/* Atlas Grid Settings */}
              <AtlasPanel
                settings={atlasSettings}
                onChange={setAtlasSettings}
                onRefreshAtlas={updateAtlasPreview}
                statePreset={statePreset}
                onChangeStatePreset={setStatePreset}
                onAutoCrop={handleAutoCrop}
                isAutoCropping={isAutoCropping}
                onResetCrop={handleResetCrop}
                onAutoFitFeet={handleAutoFitFeet}
              />

              {/* Atlas Preview & Convert & Export Button */}
              <AtlasPreview
                mode="atlas"
                atlasCanvas={atlasCanvas}
                spritesCanvases={[]}
                onExport={handleExport}
                isExporting={isExporting}
                hasMedia={hasMedia}
                exportFilename={exportFilename}
                setExportFilename={setExportFilename}
                generateNormalMap={generateNormalMap}
                setGenerateNormalMap={setGenerateNormalMap}
                onExportGif={handleExportGif}
                isExportingGif={isExportingGif}
                exportScope={exportScope}
                masterTracksCount={tracks.filter((t) => t.enabled).length}
              />
            </>
          ) : (
            <>
              {/* Sprites Transform */}
              <SpritesPanel
                settings={spritesSettings}
                onChangeSettings={setSpritesSettings}
                currentTransform={currentTransform}
                onChangeTransform={(t) => {
                  setCurrentTransform(t);
                  if (!spritesSettings.applyToAll) {
                    setSpriteTransforms((prev) => new Map(prev).set(selectedSpriteIndex, t));
                  }
                }}
                spritesCount={spritesLoaderRef.current.metadata.totalFrames}
                currentIndex={selectedSpriteIndex}
                onSelectSprite={setSelectedSpriteIndex}
              />

              {/* Sprites Preview & Export */}
              <AtlasPreview
                mode="sprites"
                atlasCanvas={null}
                spritesCanvases={spritesPreviewCanvases}
                onExport={handleExport}
                isExporting={isExporting}
                hasMedia={hasMedia}
                exportFilename={exportFilename}
                setExportFilename={setExportFilename}
              />
            </>
          )}
        </aside>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={{
          keying: keyingSettings,
          atlas: atlasSettings,
          sprites: spritesSettings,
          bgPresets,
        }}
        onUpdateSettings={(newSettings) => {
          setKeyingSettings(newSettings.keying);
          setAtlasSettings(newSettings.atlas);
          setSpritesSettings(newSettings.sprites);
          setBgPresets(newSettings.bgPresets);
        }}
        onResetSettings={() => {
          setKeyingSettings(DEFAULT_KEYING);
          setAtlasSettings(DEFAULT_ATLAS);
          setSpritesSettings(DEFAULT_SPRITES);
          setBgPresets(DEFAULT_BG_PRESETS);
        }}
      />
    </div>
  );
};
