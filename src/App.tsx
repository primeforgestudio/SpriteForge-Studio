import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, BackgroundMode, SpriteTransform, AnimationTrack, ExportScope, PackedFrameItem } from './core/types';
import { VideoLoader } from './core/videoLoader';
import { ImageProcessor } from './core/imageProcessor';
import { AtlasBuilder } from './core/atlasBuilder';
import { SpriteProcessor } from './core/spriteProcessor';
import { LoopDetector } from './core/loopDetector';
import { BoundingCrop, StatePreset } from './core/boundingCrop';
import { DirectionSlicer } from './core/directionSlicer';
import { GodotExporter } from './core/godotExporter';
import { MeshGenerator } from './core/meshGenerator';
import { DuplicateEliminator } from './core/duplicateEliminator';
import { PngQuantizer, Png8Encoder } from './core/pngQuantizer';
import { PbrGenerator } from './core/pbrGenerator';
import { TemporalProcessor } from './core/temporalProcessor';
import { LoopSynthesizer } from './core/loopSynthesizer';
import { PixelArtConverter } from './core/pixelArtConverter';
import { NormalMapGenerator } from './core/normalMapGenerator';
import { GifEncoder } from './core/gifEncoder';
import { ExportManager, ExportFileItem } from './core/exportManager';
import {
  StorageManager,
  DEFAULT_KEYING,
  DEFAULT_ATLAS,
  DEFAULT_SPRITES,
  DEFAULT_BG_PRESETS,
} from './core/storage';
import { WebGLKeyer } from './core/webglKeyer';
import { globalHistory } from './core/history';
import { FolderCheck } from 'lucide-react';
import { Header } from './components/Header';
import { LeftSidebar, LoadedFileItem } from './components/LeftSidebar';
import { Viewport } from './components/Viewport';
import { Timeline } from './components/Timeline';
import { AtlasPanel } from './components/AtlasPanel';
import { SpritesPanel } from './components/SpritesPanel';
import { AtlasPreview } from './components/AtlasPreview';
import { SettingsModal } from './components/SettingsModal';
import { SupportModal } from './components/SupportModal';

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
  const [eyedropperTarget, setEyedropperTarget] = useState<'primary' | 'secondary'>('primary');
  const [viewportCanvas, setViewportCanvas] = useState<HTMLCanvasElement | null>(null);
  const viewportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglKeyerRef = useRef<WebGLKeyer | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Timeline
  const [currentFrame, setCurrentFrame] = useState(0);
  const [cropStart, setCropStart] = useState(0);
  const [cropEnd, setCropEnd] = useState(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [statePreset, setStatePreset] = useState<StatePreset>('standard');
  const [isAutoCropping, setIsAutoCropping] = useState(false);
  const [exportFilename, setExportFilename] = useState('character_atlas');
  const [exportDestinationDir, setExportDestinationDir] = useState<string>(() => {
    return ExportManager.getLastExportDirectory() || '';
  });
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [showGarbageMatte, setShowGarbageMatte] = useState(false);
  const [showColliders, setShowColliders] = useState(false);
  const [onionGhosts, setOnionGhosts] = useState<{ prev?: HTMLCanvasElement | null; next?: HTMLCanvasElement | null } | null>(null);
  const [generateNormalMap, setGenerateNormalMap] = useState(false);
  const [generatePbrPack, setGeneratePbrPack] = useState(false);
  const [generateMask, setGenerateMask] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [rawFrameCanvas, setRawFrameCanvas] = useState<HTMLCanvasElement | null>(null);
  const rawFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSelectDestinationDir = async () => {
    const chosen = await ExportManager.selectExportDirectory(exportDestinationDir);
    if (chosen) {
      setExportDestinationDir(chosen);
    }
  };

  // Panel Resizing State
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('spriteforge_left_w');
    return saved ? Math.min(520, Math.max(220, Number(saved))) : 290;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem('spriteforge_right_w');
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
      localStorage.setItem('spriteforge_left_w', String(finalWidth));
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
      localStorage.setItem('spriteforge_right_w', String(finalWidth));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Loaders
  const atlasLoaderRef = useRef<VideoLoader>(new VideoLoader());
  const spritesLoaderRef = useRef<VideoLoader>(new VideoLoader());

  // Previews
  const [atlasCanvas, setAtlasCanvas] = useState<HTMLCanvasElement | null>(null);
  const [atlasFrames, setAtlasFrames] = useState<HTMLCanvasElement[]>([]);
  const [spritesPreviewCanvases, setSpritesPreviewCanvases] = useState<HTMLCanvasElement[]>([]);

  // Dual-Stream / Alpha Matte Video State
  const [maskFilename, setMaskFilename] = useState<string>('');
  const [hasMaskMedia, setHasMaskMedia] = useState<boolean>(false);
  const [invertMask, setInvertMask] = useState<boolean>(false);

  // Undo / Redo History State
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    return globalHistory.subscribe(() => {
      setCanUndo(globalHistory.canUndo);
      setCanRedo(globalHistory.canRedo);
    });
  }, []);

  // Debounced History Snapshot on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      globalHistory.pushSnapshot({
        keyingSettings,
        atlasSettings,
        spritesSettings,
        cropStart,
        cropEnd,
        cropBox: atlasSettings.cropBox,
        bgMode,
        bgColor,
        description: 'Settings modified',
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [keyingSettings, atlasSettings, spritesSettings, cropStart, cropEnd, bgMode, bgColor]);

  const handleUndo = useCallback(() => {
    const current = {
      keyingSettings,
      atlasSettings,
      spritesSettings,
      cropStart,
      cropEnd,
      cropBox: atlasSettings.cropBox,
      bgMode,
      bgColor,
      description: 'Current State',
    };
    const prev = globalHistory.undo(current);
    if (prev) {
      setKeyingSettings(prev.keyingSettings);
      setAtlasSettings(prev.atlasSettings);
      setSpritesSettings(prev.spritesSettings);
      setCropStart(prev.cropStart);
      setCropEnd(prev.cropEnd);
      setBgMode(prev.bgMode);
      setBgColor(prev.bgColor);
      setRenderTrigger((v) => v + 1);
    }
  }, [keyingSettings, atlasSettings, spritesSettings, cropStart, cropEnd, bgMode, bgColor]);

  const handleRedo = useCallback(() => {
    const current = {
      keyingSettings,
      atlasSettings,
      spritesSettings,
      cropStart,
      cropEnd,
      cropBox: atlasSettings.cropBox,
      bgMode,
      bgColor,
      description: 'Current State',
    };
    const next = globalHistory.redo(current);
    if (next) {
      setKeyingSettings(next.keyingSettings);
      setAtlasSettings(next.atlasSettings);
      setSpritesSettings(next.spritesSettings);
      setCropStart(next.cropStart);
      setCropEnd(next.cropEnd);
      setBgMode(next.bgMode);
      setBgColor(next.bgColor);
      setRenderTrigger((v) => v + 1);
    }
  }, [keyingSettings, atlasSettings, spritesSettings, cropStart, cropEnd, bgMode, bgColor]);

  // Global Keyboard shortcuts: Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Dual-Stream Matte Actions
  const handleLoadMaskMedia = async (file: File) => {
    const isVid = !!file.name.match(/\.(mp4|webm|mov|mkv|avi)$/i);
    if (isVid) {
      await atlasLoaderRef.current.loadMaskVideoFile(file);
    } else {
      await atlasLoaderRef.current.loadMaskImageFiles([file]);
    }
    setMaskFilename(file.name);
    setHasMaskMedia(true);
    setRenderTrigger((v) => v + 1);
    updateAtlasPreview();
  };

  const handleRemoveMaskMedia = () => {
    atlasLoaderRef.current.removeMaskMedia();
    setMaskFilename('');
    setHasMaskMedia(false);
    setRenderTrigger((v) => v + 1);
    updateAtlasPreview();
  };

  const handleToggleInvertMask = () => {
    const next = !invertMask;
    atlasLoaderRef.current.invertMask = next;
    setInvertMask(next);
    atlasLoaderRef.current.clearCache();
    setRenderTrigger((v) => v + 1);
    updateAtlasPreview();
  };

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
        const newBox = {
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
        };
        setAtlasSettings((prev) => ({
          ...prev,
          frameWidth: result.recommendedCellW,
          frameHeight: result.recommendedCellH,
          cropBox: newBox,
        }));
        if (selectedTrackId) {
          setTracks((prev) =>
            prev.map((t) => (t.id === selectedTrackId ? { ...t, cropBox: newBox } : t))
          );
        }
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
    if (selectedTrackId) {
      setTracks((prev) =>
        prev.map((t) => (t.id === selectedTrackId ? { ...t, cropBox: null } : t))
      );
    }
  };

  const handleUpdateCropBox = (newCrop: { x: number; y: number; width: number; height: number } | null) => {
    setAtlasSettings((prev) => ({
      ...prev,
      cropBox: newCrop,
      frameWidth: newCrop ? newCrop.width : prev.frameWidth,
      frameHeight: newCrop ? newCrop.height : prev.frameHeight,
    }));
    if (selectedTrackId) {
      setTracks((prev) =>
        prev.map((t) => (t.id === selectedTrackId ? { ...t, cropBox: newCrop } : t))
      );
    }
  };

  const handleReorderTracks = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setTracks((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  // 8-Direction Auto-Slice for 3x3 Compass Character Sheets
  const [isSlicing8Dir, setIsSlicing8Dir] = useState(false);
  const handleSliceEightDirections = async () => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0 || markers.length === 0) return;

    setIsSlicing8Dir(true);
    try {
      const activeTrack = tracks.find((t) => t.id === selectedTrackId);
      const fileRef = activeTrack?.fileRef;
      const res = await DirectionSlicer.sliceEightDirections(
        loader,
        markers,
        keyingSettings,
        loader.metadata.filename || exportFilename,
        fileRef,
        atlasSettings.fps
      );

      if (res && res.tracks.length > 0) {
        setTracks(res.tracks);
        const first = res.tracks[0];
        setSelectedTrackId(first.id);
        setSelectedFileId(first.id);
        setAtlasSettings((prev) => ({
          ...prev,
          frameWidth: res.uniformCellW,
          frameHeight: res.uniformCellH,
          cropBox: first.cropBox ?? null,
        }));
        setExportFilename(first.name);
        setExportToast(`Sliced 8 Directional Tracks (${res.uniformCellW}×${res.uniformCellH})`);
        setTimeout(() => setExportToast(null), 4500);
      }
    } catch (e: any) {
      alert(`8-Direction Slicing failed: ${e.message}`);
    } finally {
      setIsSlicing8Dir(false);
    }
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

  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  // Render Atlas Frame in Viewport
  const renderAtlasFrame = useCallback(async (forcedFrame?: number, fastPreview: boolean = false) => {
    if (mode !== 'atlas') return;
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0) return;

    const targetFrame = forcedFrame !== undefined ? forcedFrame : currentFrameRef.current;
    const rawData = loader.getCachedFrame(targetFrame) || (await loader.getFrame(targetFrame));
    if (!rawData) return;

    if (
      !viewportCanvasRef.current ||
      viewportCanvasRef.current.width !== rawData.width ||
      viewportCanvasRef.current.height !== rawData.height
    ) {
      viewportCanvasRef.current = document.createElement('canvas');
      viewportCanvasRef.current.width = rawData.width;
      viewportCanvasRef.current.height = rawData.height;
    }
    const canvas = viewportCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preserve unkeyed raw frame for Split-Screen Wipe
    if (
      !rawFrameCanvasRef.current ||
      rawFrameCanvasRef.current.width !== rawData.width ||
      rawFrameCanvasRef.current.height !== rawData.height
    ) {
      rawFrameCanvasRef.current = document.createElement('canvas');
      rawFrameCanvasRef.current.width = rawData.width;
      rawFrameCanvasRef.current.height = rawData.height;
    }
    const rawCtx = rawFrameCanvasRef.current.getContext('2d');
    if (rawCtx) {
      rawCtx.putImageData(rawData, 0, 0);
      setRawFrameCanvas(rawFrameCanvasRef.current);
    }

    // Fast-path: When chroma key and masks are not active, skip all array allocation and processing!
    if (!keyingSettings.enabled && !showMask && !keyingSettings.garbageMatte?.enabled) {
      ctx.putImageData(rawData, 0, 0);
      setViewportCanvas(canvas);
      setRenderTrigger((v) => (v + 1) % 1000000);
      return;
    }

    const keyHash = JSON.stringify({ ...keyingSettings, showMask });

    const cachedKeyed = loader.getKeyedFrame(targetFrame, keyHash);
    if (cachedKeyed) {
      ctx.putImageData(cachedKeyed, 0, 0);
      setViewportCanvas(canvas);
      setRenderTrigger((v) => (v + 1) % 1000000);
      return;
    }

    // Hardware GPU Chroma Key Render with WebGL (< 0.1ms)
    if (!webglCanvasRef.current) {
      webglCanvasRef.current = document.createElement('canvas');
      webglKeyerRef.current = new WebGLKeyer(webglCanvasRef.current);
    }
    if (webglKeyerRef.current) {
      const ok = webglKeyerRef.current.render(
        rawData,
        rawData.width,
        rawData.height,
        keyingSettings,
        showMask,
        'checkerboard',
        [0, 0, 0]
      );
      if (ok) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(webglKeyerRef.current.getCanvas(), 0, 0);
        setViewportCanvas(canvas);
        setRenderTrigger((v) => (v + 1) % 1000000);
        return;
      }
    }

    const processedData = new ImageData(
      new Uint8ClampedArray(rawData.data),
      rawData.width,
      rawData.height
    );

    ImageProcessor.applyChromaKey(processedData, keyingSettings, fastPreview);
    if (showMask) {
      ImageProcessor.convertToAlphaMask(processedData);
    }
    loader.setKeyedFrame(targetFrame, keyHash, processedData);
    ctx.putImageData(processedData, 0, 0);

    setViewportCanvas(canvas);
    setRenderTrigger((v) => (v + 1) % 1000000);
  }, [mode, keyingSettings, showMask]);

  // When paused or scrubbing, update viewport frame
  useEffect(() => {
    if (isPlaying) return;
    renderAtlasFrame(currentFrame, false);
  }, [renderAtlasFrame, currentFrame, isPlaying]);

  // Clear keyed cache when keying parameters change so fresh keyed frames are generated
  useEffect(() => {
    atlasLoaderRef.current.clearKeyedCache();
  }, [keyingSettings, showMask]);

  // Unified Deterministic Playback Loop
  useEffect(() => {
    if (mode !== 'atlas') return;
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 1) return;

    if (!isPlaying) {
      if (loader.videoElement && !loader.videoElement.paused) {
        loader.videoElement.pause();
      }
      return;
    }

    const fps = loader.metadata.fps || 30;
    const frameDuration = 1000 / fps;
    let isCancelled = false;
    let animId: number;
    let videoFrameHandle: any;

    let currentF = currentFrameRef.current;
    if (currentF < cropStart || currentF >= cropEnd) {
      currentF = cropStart;
      setCurrentFrame(cropStart);
    }

    const keyHash = JSON.stringify({ ...keyingSettings, showMask });
    const video = loader.videoElement;

    // Check if range [cropStart, cropEnd] is already completely in memory
    const isRangeFullyCached = () => {
      for (let i = cropStart; i <= cropEnd; i++) {
        if (!loader.getCachedFrame(i)) return false;
      }
      return true;
    };

    // --- IN-MEMORY CACHE PLAYBACK ---
    // Zero seeks, zero decoding overhead, monotonic performance.now() ticks, instant 0.01ms loop wrap
    const runCachePlayback = () => {
      let lastTime = performance.now();

      const cacheTick = (now: number) => {
        if (isCancelled) return;
        const elapsed = now - lastTime;

        if (elapsed >= frameDuration) {
          const advance = Math.floor(elapsed / frameDuration);
          lastTime = now - (elapsed % frameDuration);

          let nextFrame = currentF + advance;
          if (nextFrame > cropEnd) {
            if (isLooping) {
              nextFrame = cropStart;
            } else {
              setIsPlaying(false);
              setCurrentFrame(cropEnd);
              renderAtlasFrame(cropEnd, false);
              return;
            }
          }

          currentF = nextFrame;
          setCurrentFrame(currentF);

          // Instant render from memory cache
          if (
            !viewportCanvasRef.current ||
            viewportCanvasRef.current.width !== loader.metadata.width ||
            viewportCanvasRef.current.height !== loader.metadata.height
          ) {
            viewportCanvasRef.current = document.createElement('canvas');
            viewportCanvasRef.current.width = loader.metadata.width;
            viewportCanvasRef.current.height = loader.metadata.height;
          }
          const canvas = viewportCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const keyed = loader.getKeyedFrame(currentF, keyHash);
            if (keyed) {
              ctx.putImageData(keyed, 0, 0);
            } else {
              let raw = loader.getCachedFrame(currentF);
              if (!raw) {
                // Graceful fallback to nearest cached frame so it never flashes blank
                for (let d = 1; d <= 6; d++) {
                  raw = loader.getCachedFrame(currentF - d) || loader.getCachedFrame(currentF + d);
                  if (raw) break;
                }
              }
              if (raw) {
                if (!keyingSettings.enabled && !showMask && !keyingSettings.garbageMatte?.enabled) {
                  ctx.putImageData(raw, 0, 0);
                } else {
                  if (!webglCanvasRef.current) {
                    webglCanvasRef.current = document.createElement('canvas');
                    webglKeyerRef.current = new WebGLKeyer(webglCanvasRef.current);
                  }
                  if (webglKeyerRef.current) {
                    webglKeyerRef.current.render(
                      raw,
                      raw.width,
                      raw.height,
                      keyingSettings,
                      showMask,
                      'checkerboard',
                      [0, 0, 0]
                    );
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(webglKeyerRef.current.getCanvas(), 0, 0);
                  }
                }
              }
            }
            setViewportCanvas(canvas);
            setRenderTrigger((v) => (v + 1) % 1000000);
          }
        }

        animId = requestAnimationFrame(cacheTick);
      };

      animId = requestAnimationFrame(cacheTick);
    };

    // --- HARDWARE VIDEO PLAYBACK (MP4/MOV/AVI/WEBM) ---
    if (video && !loader.isSequence) {
      let isLoopSeeking = false;
      const startSec = cropStart / fps;
      const endSec = cropEnd / fps;

      if (video.currentTime < startSec - 0.05 || video.currentTime >= endSec - 0.03 || video.ended) {
        video.currentTime = startSec;
        currentF = cropStart;
        currentFrameRef.current = cropStart;
        setCurrentFrame(cropStart);
      }

      const startPlayback = () => {
        const p = video.play();
        if (p !== undefined) {
          p.catch(() => {
            const onReady = () => {
              video.removeEventListener('canplay', onReady);
              video.play().catch(() => {});
            };
            video.addEventListener('canplay', onReady, { once: true });
          });
        }
      };
      startPlayback();

      if (!webglCanvasRef.current) {
        webglCanvasRef.current = document.createElement('canvas');
        webglKeyerRef.current = new WebGLKeyer(webglCanvasRef.current);
      }
      const keyer = webglKeyerRef.current;

      const triggerLoop = () => {
        if (isLoopSeeking) return;
        if (isLooping) {
          isLoopSeeking = true;
          video.currentTime = startSec;
          currentF = cropStart;
          currentFrameRef.current = cropStart;
          setCurrentFrame(cropStart);

          const resume = () => {
            video.removeEventListener('seeked', resume);
            isLoopSeeking = false;
            if (!isCancelled && isPlaying) video.play().catch(() => {});
          };
          video.addEventListener('seeked', resume, { once: true });

          setTimeout(() => {
            isLoopSeeking = false;
            if (!isCancelled && isPlaying) video.play().catch(() => {});
          }, 150);
        } else {
          setIsPlaying(false);
          video.pause();
          setCurrentFrame(cropEnd);
        }
      };

      const onVideoEnded = () => {
        if (!isCancelled) triggerLoop();
      };
      video.addEventListener('ended', onVideoEnded);

      const onVideoFrame = () => {
        if (isCancelled) return;

        const currentSec = video.currentTime;
        const currentCalcFrame = Math.round(currentSec * fps);

        // Check loop boundary: frame hits cropEnd, or currentTime reaches endSec, or EOF ended
        const isAtEnd =
          currentCalcFrame >= cropEnd ||
          currentSec >= (endSec - 0.03) ||
          video.ended;

        if (!isLoopSeeking && isAtEnd) {
          triggerLoop();
          animId = requestAnimationFrame(onVideoFrame);
          return;
        }

        if (isLoopSeeking) {
          animId = requestAnimationFrame(onVideoFrame);
          return;
        }

        const f = Math.max(cropStart, Math.min(cropEnd, currentCalcFrame));
        if (f !== currentFrameRef.current) {
          currentFrameRef.current = f;
          setCurrentFrame(f);
        }

        // WebGL High-Performance GPU Chroma Key rendering (< 0.1ms per frame!)
        if (keyer && (keyingSettings.enabled || showMask || keyingSettings.garbageMatte?.enabled)) {
          const ok = keyer.render(
            video,
            video.videoWidth,
            video.videoHeight,
            keyingSettings,
            showMask,
            'checkerboard',
            [0, 0, 0]
          );
          if (ok) {
            setViewportCanvas(keyer.getCanvas());
            setRenderTrigger((v) => (v + 1) % 1000000);
          }
        } else {
          // Direct hardware canvas blit when chroma key is off
          if (
            !viewportCanvasRef.current ||
            viewportCanvasRef.current.width !== video.videoWidth ||
            viewportCanvasRef.current.height !== video.videoHeight
          ) {
            viewportCanvasRef.current = document.createElement('canvas');
            viewportCanvasRef.current.width = video.videoWidth;
            viewportCanvasRef.current.height = video.videoHeight;
          }
          const canvas = viewportCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            setViewportCanvas(canvas);
            setRenderTrigger((v) => (v + 1) % 1000000);
          }
        }

        animId = requestAnimationFrame(onVideoFrame);
      };

      animId = requestAnimationFrame(onVideoFrame);

      return () => {
        isCancelled = true;
        video.removeEventListener('ended', onVideoEnded);
        if (animId) {
          cancelAnimationFrame(animId);
        }
        if (!video.paused) {
          video.pause();
        }
      };
    }

    // --- SEQUENCE IN-MEMORY PLAYBACK (PNG Sequence / Image List) ---
    runCachePlayback();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, isLooping, mode, cropStart, cropEnd, keyingSettings, showMask]);

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
    if (isPlaying || !atlasSettings.enableOnionSkin || mode !== 'atlas') {
      setOnionGhosts((prev) => (prev !== null ? null : prev));
      return;
    }

    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 1 || markers.length === 0) {
      setOnionGhosts((prev) => (prev !== null ? null : prev));
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

  // High-fidelity Keyer producing clean, full-resolution transparent canvas matching Viewport
  const getKeyedFrameCanvas = useCallback(
    (raw: ImageData): HTMLCanvasElement => {
      try {
        if (!webglCanvasRef.current) {
          webglCanvasRef.current = document.createElement('canvas');
          webglKeyerRef.current = new WebGLKeyer(webglCanvasRef.current);
        }
        if (webglKeyerRef.current) {
          const ok = webglKeyerRef.current.render(
            raw,
            raw.width,
            raw.height,
            keyingSettings,
            false,
            'checkerboard',
            [0, 0, 0]
          );
          if (ok) {
            const outCanvas = document.createElement('canvas');
            outCanvas.width = raw.width;
            outCanvas.height = raw.height;
            const ctx = outCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(webglKeyerRef.current.getCanvas(), 0, 0);
              return outCanvas;
            }
          }
        }
      } catch (e) {
        console.warn('WebGL keying fallback to CPU:', e);
      }

      // CPU fallback
      const outCanvas = document.createElement('canvas');
      outCanvas.width = raw.width;
      outCanvas.height = raw.height;
      const ctx = outCanvas.getContext('2d');
      if (ctx) {
        const copy = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
        ImageProcessor.applyChromaKey(copy, keyingSettings);
        ctx.putImageData(copy, 0, 0);
      }
      return outCanvas;
    },
    [keyingSettings]
  );

  // Update Atlas Preview (Fast & High Quality matching Viewport)
  const isUpdatingAtlasRef = useRef(false);
  const updateAtlasPreview = useCallback(async () => {
    if (mode !== 'atlas' || isUpdatingAtlasRef.current || atlasLoaderRef.current.isVideoPlaying()) return;
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
        if (loader.isVideoPlaying()) return;
        const raw = await loader.getFrame(frameIdx);
        if (raw) {
          // 1. Key at full resolution using the exact same WebGL GPU keyer as Viewport
          const keyedCanvas = getKeyedFrameCanvas(raw);

          // 2. Uniform aspect-fit resize with bounding cropBox if active
          const smallCanvas = ImageProcessor.resizeCanvas(
            keyedCanvas,
            pfw,
            pfh,
            null,
            atlasSettings.cropBox
          );

          // 3. Apply Contact Drop-Shadow if enabled
          if (atlasSettings.enableShadow) {
            ImageProcessor.applyDropShadow(
              smallCanvas,
              (atlasSettings.shadowOpacity ?? 45) / 100,
              atlasSettings.shadowScale ?? 60
            );
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

      // 6. In-Place Centering / Root Motion across sequence
      if (atlasSettings.enableInPlace && finalFrames.length > 1) {
        const inPlaceRes = TemporalProcessor.applyInPlaceCentering(
          finalFrames,
          atlasSettings.inPlaceLockAxis ?? 'x'
        );
        finalFrames = inPlaceRes.alignedCanvases;
      }

      // 6.5 Seamless Loop Blending
      if (atlasSettings.enableLoopBlend && finalFrames.length > 3) {
        finalFrames = LoopSynthesizer.createSeamlessLoop(
          finalFrames,
          atlasSettings.loopBlendFrames ?? 3
        );
      }

      // 6.6 Retro Pixel-Art Converter
      if (atlasSettings.pixelArtSettings?.enabled) {
        finalFrames = finalFrames.map((c) =>
          PixelArtConverter.convertToPixelArt(c, atlasSettings.pixelArtSettings!)
        );
      }

      // 7. Duplicate Frame Eliminator
      let framesForAtlas = finalFrames;
      if (atlasSettings.eliminateDuplicates && finalFrames.length > 1) {
        const dedup = DuplicateEliminator.eliminateDuplicates(
          finalFrames,
          atlasSettings.duplicateThreshold ?? 0.992
        );
        framesForAtlas = dedup.uniqueFrames;
      }

      let atlas: HTMLCanvasElement;
      if (atlasSettings.layoutMode === 'advanced') {
        const packRes = AtlasBuilder.packFramesAdvanced(
          framesForAtlas,
          atlasSettings.packPadding ?? 2
        );
        atlas = packRes.canvas;
      } else {
        const previewCols = Math.max(1, Math.min(atlasSettings.columns, framesForAtlas.length));
        const previewRows = Math.ceil(framesForAtlas.length / previewCols);
        atlas = AtlasBuilder.createAtlasCanvas(framesForAtlas, previewCols, previewRows, pfw, pfh);
      }

      // 8. PNG-8 NeuQuant Palette Preview
      if (atlasSettings.enablePng8) {
        const quant = PngQuantizer.quantizeCanvas(atlas, 256, true);
        atlas = quant.previewCanvas;
      }

      setAtlasFrames(framesForAtlas);
      setAtlasCanvas(atlas);
    } finally {
      isUpdatingAtlasRef.current = false;
    }
  }, [mode, markers, atlasSettings, keyingSettings, getKeyedFrameCanvas]);

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

        // Refresh atlas preview
        updateAtlasPreview();

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

  // Global window file drag-and-drop support
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleLoadFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleLoadFiles]);

  // Switch between tracks
  const handleSelectTrack = async (id: string) => {
    // 1. Save current timeline state and crop box to active track before switching
    if (selectedTrackId) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrackId
            ? { ...t, cropStart, cropEnd, markers, fps: atlasSettings.fps, cropBox: atlasSettings.cropBox }
            : t
        )
      );
    }

    const target = tracks.find((t) => t.id === id);
    if (!target || !target.fileRef) return;
    setSelectedTrackId(id);
    setSelectedFileId(id);
    const baseName = target.name || target.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'character_atlas';
    setExportFilename(baseName);

    if (target.cropBox !== undefined) {
      setAtlasSettings((prev) => ({
        ...prev,
        cropBox: target.cropBox ?? null,
        frameWidth: target.cropBox ? target.cropBox.width : prev.frameWidth,
        frameHeight: target.cropBox ? target.cropBox.height : prev.frameHeight,
      }));
    } else {
      setAtlasSettings((prev) => ({
        ...prev,
        cropBox: null,
      }));
    }

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

  const handleDeleteTrack = (id: string) => {
    setTracks((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (selectedTrackId === id) {
        if (remaining.length > 0) {
          handleSelectTrack(remaining[0].id);
        } else {
          setSelectedTrackId('');
          setViewportCanvas(null);
          setRawFrameCanvas(null);
          atlasLoaderRef.current.metadata.totalFrames = 0;
          atlasLoaderRef.current.metadata.filename = '';
          setCurrentFrame(0);
        }
      }
      return remaining;
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
                const keyed = getKeyedFrameCanvas(raw);
                const resized = ImageProcessor.resizeCanvas(
                  keyed,
                  fw,
                  fh,
                  null,
                  track.cropBox ?? atlasSettings.cropBox
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
            if (atlasSettings.enableInPlace && finalTrackFrames.length > 1) {
              const inPlaceRes = TemporalProcessor.applyInPlaceCentering(
                finalTrackFrames,
                atlasSettings.inPlaceLockAxis ?? 'x'
              );
              finalTrackFrames = inPlaceRes.alignedCanvases;
            }

            if (atlasSettings.enableLoopBlend && finalTrackFrames.length > 3) {
              finalTrackFrames = LoopSynthesizer.createSeamlessLoop(
                finalTrackFrames,
                atlasSettings.loopBlendFrames ?? 3
              );
            }

            if (atlasSettings.pixelArtSettings?.enabled) {
              finalTrackFrames = finalTrackFrames.map((c) =>
                PixelArtConverter.convertToPixelArt(c, atlasSettings.pixelArtSettings!)
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

          const cleanName = (exportFilename.trim() || 'character')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_') || 'character';
          const pngFilename = `${cleanName}_master_frames.png`;
          const tresFilename = `${cleanName}_master_frames.tres`;
          const asepriteFilename = `${cleanName}_master_aseprite.json`;
          const jsonFilename = `${cleanName}_master_frames.json`;
          const spineAtlasFilename = `${cleanName}_master.atlas`;

          let masterAtlas: HTMLCanvasElement;
          let masterPackedFrames: PackedFrameItem[] | undefined = undefined;

          if (atlasSettings.layoutMode === 'advanced') {
            const frameNames: string[] = [];
            tracksMeta.forEach((track) => {
              track.frameIndices.forEach((_, localIdx) => {
                frameNames.push(`${track.name}_${localIdx}`);
              });
            });
            const packRes = AtlasBuilder.packFramesAdvanced(
              allProcessedCanvases,
              atlasSettings.packPadding ?? 2,
              frameNames
            );
            masterAtlas = packRes.canvas;
            masterPackedFrames = packRes.packedFrames;
          } else {
            masterAtlas = AtlasBuilder.createAtlasCanvas(allProcessedCanvases, cols, rows, fw, fh);
          }

          let pngBlob: Blob;
          if (atlasSettings.enablePng8) {
            const quant = PngQuantizer.quantizeCanvas(masterAtlas, 256, true);
            pngBlob = await Png8Encoder.encodeToBlob(quant);
          } else {
            pngBlob = await AtlasBuilder.canvasToBlob(masterAtlas);
          }

          const filesToExport: ExportFileItem[] = [];
          filesToExport.push({ name: pngFilename, data: pngBlob });

          // Spine / libGDX .atlas for Master Set
          if (atlasSettings.layoutMode === 'advanced' && masterPackedFrames) {
            const spineAtlasText = AtlasBuilder.createSpineAtlas(
              masterPackedFrames,
              pngFilename,
              masterAtlas.width,
              masterAtlas.height
            );
            filesToExport.push({ name: spineAtlasFilename, text: spineAtlasText, isText: true });
          }

          // Export 2D Normal Map or Complete 2D PBR Pack
          if (generatePbrPack || generateNormalMap) {
            const normalCanvas = NormalMapGenerator.generateNormalMap(masterAtlas, 2.5);
            const normalBlob = await AtlasBuilder.canvasToBlob(normalCanvas);
            filesToExport.push({ name: `${cleanName}_master_normal.png`, data: normalBlob });

            if (generatePbrPack) {
              const roughnessCanvas = PbrGenerator.generateRoughnessMap(masterAtlas, atlasSettings.roughnessGloss ?? 50);
              const roughnessBlob = await AtlasBuilder.canvasToBlob(roughnessCanvas);
              filesToExport.push({ name: `${cleanName}_master_roughness.png`, data: roughnessBlob });

              const emissionCanvas = PbrGenerator.generateEmissionMap(masterAtlas, atlasSettings.emissionThreshold ?? 180, 1.5);
              const emissionBlob = await AtlasBuilder.canvasToBlob(emissionCanvas);
              filesToExport.push({ name: `${cleanName}_master_emission.png`, data: emissionBlob });
            }
          }

          // Export Silhouette Alpha Mask (_mask.png) if requested
          if (generateMask) {
            const maskCanvas = ImageProcessor.canvasToAlphaMask(masterAtlas);
            const maskBlob = await AtlasBuilder.canvasToBlob(maskCanvas);
            filesToExport.push({ name: `${cleanName}_master_mask.png`, data: maskBlob });
          }

          // Godot 4 Multi-Animation SpriteFrames (.tres)
          const tresString = GodotExporter.generateMultiTrackSpriteFramesTres(
            pngFilename,
            { ...atlasSettings, columns: cols, rows },
            tracksMeta,
            masterPackedFrames
          );
          filesToExport.push({ name: tresFilename, text: tresString, isText: true });

          // 2D Mesh & Overdraw Optimizer
          let masterSampleMesh: any = undefined;
          if (atlasSettings.meshSettings?.enabled) {
            const sampleFrame = allProcessedCanvases[0] || viewportCanvasRef.current;
            if (sampleFrame) {
              masterSampleMesh = MeshGenerator.generateMesh(sampleFrame, atlasSettings.meshSettings);
              const spineAttachment = MeshGenerator.generateSpineAttachment(cleanName, masterSampleMesh, fw, fh);
              const meshJson = {
                generator: 'SpriteForge Studio',
                version: '2.0',
                name: cleanName,
                vertexCount: masterSampleMesh.vertexCount,
                triangleCount: masterSampleMesh.triangleCount,
                areaSavingsPercent: masterSampleMesh.areaSavingsPercent,
                mesh: {
                  vertices: masterSampleMesh.vertices,
                  uvs: masterSampleMesh.uvs,
                  indices: masterSampleMesh.indices,
                },
                spineAttachment,
              };
              filesToExport.push({
                name: `${cleanName}_mesh.json`,
                text: JSON.stringify(meshJson, null, 2),
                isText: true,
              });
            }
          }

          // Godot 4 CharacterBody2D Scene (.tscn) if enabled
          if (atlasSettings.collisionSettings?.generateTscn ?? true) {
            const tscnFilename = `${cleanName}_master.tscn`;
            const firstTrackName = tracksMeta[0]?.name || 'idle';
            const tscnString = GodotExporter.generateCharacterSceneTscn(
              cleanName,
              tresFilename,
              { ...atlasSettings, columns: cols, rows },
              firstTrackName,
              masterSampleMesh
            );
            filesToExport.push({ name: tscnFilename, text: tscnString, isText: true });
          }

          // Aseprite JSON with frameTags
          const asepriteMeta = AtlasBuilder.createMultiTrackAsepriteJson(
            { ...atlasSettings, columns: cols, rows },
            tracksMeta,
            pngFilename,
            masterPackedFrames,
            masterAtlas.width,
            masterAtlas.height
          );
          filesToExport.push({ name: asepriteFilename, text: JSON.stringify(asepriteMeta, null, 2), isText: true });

          // Standard Metadata JSON
          const masterJson = {
            app: 'SpriteForge',
            version: '2.0',
            name: cleanName,
            scope: 'master_set',
            layoutMode: atlasSettings.layoutMode || 'grid',
            frameWidth: fw,
            frameHeight: fh,
            columns: cols,
            rows,
            totalFrames,
            pivot: atlasSettings.pivot || { x: 0.5, y: 0.95 },
            tracks: tracksMeta,
          };
          filesToExport.push({ name: jsonFilename, text: JSON.stringify(masterJson, null, 4), isText: true });

          const exportRes = await ExportManager.saveExportPackage(exportDestinationDir, cleanName, filesToExport);
          if (exportRes.canceled) return;
          if (!exportRes.success) {
            alert(`Export failed: ${exportRes.error || 'Unknown error'}`);
            return;
          }
          const lastDir = ExportManager.getLastExportDirectory();
          if (lastDir) setExportDestinationDir(lastDir);
          setExportToast(`Created folder "${cleanName}" with ${filesToExport.length} files`);
          setTimeout(() => setExportToast(null), 4500);
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
            const keyed = getKeyedFrameCanvas(raw);
            const resized = ImageProcessor.resizeCanvas(
              keyed,
              fw,
              fh,
              null,
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

        // Apply In-Place Centering if enabled
        let singleRootMotion: any[] = [];
        if (atlasSettings.enableInPlace && finalFrames.length > 1) {
          const inPlaceRes = TemporalProcessor.applyInPlaceCentering(
            finalFrames,
            atlasSettings.inPlaceLockAxis ?? 'x'
          );
          finalFrames = inPlaceRes.alignedCanvases;
          singleRootMotion = inPlaceRes.rootMotion;
        }

        if (atlasSettings.enableLoopBlend && finalFrames.length > 3) {
          finalFrames = LoopSynthesizer.createSeamlessLoop(
            finalFrames,
            atlasSettings.loopBlendFrames ?? 3
          );
        }

        if (atlasSettings.pixelArtSettings?.enabled) {
          finalFrames = finalFrames.map((c) =>
            PixelArtConverter.convertToPixelArt(c, atlasSettings.pixelArtSettings!)
          );
        }

        const cleanName = (exportFilename.trim() || loader.metadata.filename || 'animation')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'animation';
        const pngFilename = `${cleanName}_frames.png`;
        const jsonFilename = `${cleanName}_frames.json`;
        const tresFilename = `${cleanName}_frames.tres`;
        const asepriteFilename = `${cleanName}_aseprite.json`;
        const spineAtlasFilename = `${cleanName}.atlas`;

        // Duplicate Frame Eliminator
        let framesToPack = finalFrames;
        let frameIndicesMap: number[] | undefined = undefined;

        if (atlasSettings.eliminateDuplicates && finalFrames.length > 1) {
          const dedup = DuplicateEliminator.eliminateDuplicates(
            finalFrames,
            atlasSettings.duplicateThreshold ?? 0.992
          );
          framesToPack = dedup.uniqueFrames;
          frameIndicesMap = dedup.frameIndicesMap;
        }

        let finalAtlas: HTMLCanvasElement;
        let singlePackedFrames: PackedFrameItem[] | undefined = undefined;

        if (atlasSettings.layoutMode === 'advanced') {
          const frameNames = framesToPack.map((_, i) => `${cleanName}_${i}`);
          const packRes = AtlasBuilder.packFramesAdvanced(
            framesToPack,
            atlasSettings.packPadding ?? 2,
            frameNames
          );
          finalAtlas = packRes.canvas;
          singlePackedFrames = packRes.packedFrames;
        } else {
          const actualCols = Math.max(1, Math.min(cols, framesToPack.length));
          const actualRows = Math.ceil(framesToPack.length / actualCols);
          finalAtlas = AtlasBuilder.createAtlasCanvas(framesToPack, actualCols, actualRows, fw, fh);
        }

        let pngBlob: Blob;
        if (atlasSettings.enablePng8) {
          const quant = PngQuantizer.quantizeCanvas(finalAtlas, 256, true);
          pngBlob = await Png8Encoder.encodeToBlob(quant);
        } else {
          pngBlob = await AtlasBuilder.canvasToBlob(finalAtlas);
        }

        const filesToExport: ExportFileItem[] = [];
        filesToExport.push({ name: pngFilename, data: pngBlob });

        // Export Spine / libGDX .atlas when Advanced Pack is active
        if (atlasSettings.layoutMode === 'advanced' && singlePackedFrames) {
          const spineAtlasText = AtlasBuilder.createSpineAtlas(
            singlePackedFrames,
            pngFilename,
            finalAtlas.width,
            finalAtlas.height
          );
          filesToExport.push({ name: spineAtlasFilename, text: spineAtlasText, isText: true });
        }

        // Export 2D Normal Map or Complete 2D PBR Pack
        if (generatePbrPack || generateNormalMap) {
          const normalCanvas = NormalMapGenerator.generateNormalMap(finalAtlas, 2.5);
          const normalBlob = await AtlasBuilder.canvasToBlob(normalCanvas);
          filesToExport.push({ name: `${cleanName}_normal.png`, data: normalBlob });

          if (generatePbrPack) {
            const roughnessCanvas = PbrGenerator.generateRoughnessMap(finalAtlas, atlasSettings.roughnessGloss ?? 50);
            const roughnessBlob = await AtlasBuilder.canvasToBlob(roughnessCanvas);
            filesToExport.push({ name: `${cleanName}_roughness.png`, data: roughnessBlob });

            const emissionCanvas = PbrGenerator.generateEmissionMap(finalAtlas, atlasSettings.emissionThreshold ?? 180, 1.5);
            const emissionBlob = await AtlasBuilder.canvasToBlob(emissionCanvas);
            filesToExport.push({ name: `${cleanName}_emission.png`, data: emissionBlob });
          }
        }

        // Export Silhouette Alpha Mask (_mask.png) if requested
        if (generateMask) {
          const maskCanvas = ImageProcessor.canvasToAlphaMask(finalAtlas);
          const maskBlob = await AtlasBuilder.canvasToBlob(maskCanvas);
          filesToExport.push({ name: `${cleanName}_mask.png`, data: maskBlob });
        }

        const jsonMeta = {
          ...AtlasBuilder.createAtlasJson(
            loader.metadata,
            atlasSettings,
            markers,
            cropStart,
            cropEnd
          ),
          rootMotion: singleRootMotion.length > 0 ? singleRootMotion : undefined,
        };
        filesToExport.push({ name: jsonFilename, text: JSON.stringify(jsonMeta, null, 4), isText: true });

        // Export Aseprite-compatible JSON (Phaser / Unity / Defold / Flame / Pixi)
        const asepriteMeta = AtlasBuilder.createAsepriteJson(
          loader.metadata,
          atlasSettings,
          markers,
          cleanName,
          singlePackedFrames,
          finalAtlas.width,
          finalAtlas.height
        );
        filesToExport.push({ name: asepriteFilename, text: JSON.stringify(asepriteMeta, null, 2), isText: true });

        // Export native Godot 4 SpriteFrames resource (.tres) with matching relative texture
        const tresString = GodotExporter.generateSpriteFramesTres(
          cleanName,
          pngFilename,
          atlasSettings,
          markers.length,
          atlasSettings.fps,
          singlePackedFrames,
          frameIndicesMap
        );
        filesToExport.push({ name: tresFilename, text: tresString, isText: true });

        // 2D Mesh & Overdraw Optimizer
        let singleSampleMesh: any = undefined;
        if (atlasSettings.meshSettings?.enabled) {
          const sampleFrame = frameCanvases[0] || viewportCanvasRef.current;
          if (sampleFrame) {
            singleSampleMesh = MeshGenerator.generateMesh(sampleFrame, atlasSettings.meshSettings);
            const spineAttachment = MeshGenerator.generateSpineAttachment(cleanName, singleSampleMesh, fw, fh);
            const meshJson = {
              generator: 'SpriteForge Studio',
              version: '2.0',
              name: cleanName,
              vertexCount: singleSampleMesh.vertexCount,
              triangleCount: singleSampleMesh.triangleCount,
              areaSavingsPercent: singleSampleMesh.areaSavingsPercent,
              mesh: {
                vertices: singleSampleMesh.vertices,
                uvs: singleSampleMesh.uvs,
                indices: singleSampleMesh.indices,
              },
              spineAttachment,
            };
            filesToExport.push({
              name: `${cleanName}_mesh.json`,
              text: JSON.stringify(meshJson, null, 2),
              isText: true,
            });
          }
        }

        // Export native Godot 4 CharacterBody2D Scene (.tscn) if enabled
        if (atlasSettings.collisionSettings?.generateTscn ?? true) {
          const tscnFilename = `${cleanName}.tscn`;
          const tscnString = GodotExporter.generateCharacterSceneTscn(
            cleanName,
            tresFilename,
            atlasSettings,
            cleanName,
            singleSampleMesh
          );
          filesToExport.push({ name: tscnFilename, text: tscnString, isText: true });
        }

        const exportRes = await ExportManager.saveExportPackage(exportDestinationDir, cleanName, filesToExport);
        if (exportRes.canceled) return;
        if (!exportRes.success) {
          alert(`Export failed: ${exportRes.error || 'Unknown error'}`);
          return;
        }
        const lastDir = ExportManager.getLastExportDirectory();
        if (lastDir) setExportDestinationDir(lastDir);
        setExportToast(`Created folder "${cleanName}" with ${filesToExport.length} files`);
        setTimeout(() => setExportToast(null), 4500);
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

        const cleanName = (exportFilename.trim() || 'sprites')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'sprites';

        const filesToExport: ExportFileItem[] = [];
        for (const item of filesData) {
          const blob = await AtlasBuilder.canvasToBlob(item.canvas);
          filesToExport.push({ name: item.name, data: blob });
        }

        const exportRes = await ExportManager.saveExportPackage(exportDestinationDir, cleanName, filesToExport);
        if (exportRes.canceled) return;
        if (!exportRes.success) {
          alert(`Export failed: ${exportRes.error || 'Unknown error'}`);
          return;
        }
        const lastDir = ExportManager.getLastExportDirectory();
        if (lastDir) setExportDestinationDir(lastDir);
        setExportToast(`Created folder "${cleanName}" with ${filesToExport.length} sprites`);
        setTimeout(() => setExportToast(null), 4500);
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
              const keyed = getKeyedFrameCanvas(raw);
              const resized = ImageProcessor.resizeCanvas(
                keyed,
                fw,
                fh,
                null,
                track.cropBox ?? atlasSettings.cropBox
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
        const gifName = `${cleanName}_master.gif`;
        const exportRes = await ExportManager.saveExportPackage(exportDestinationDir, cleanName, [
          { name: gifName, data: gifBlob },
        ]);
        if (exportRes.canceled) return;
        if (!exportRes.success) {
          AtlasBuilder.triggerDownload(gifBlob, gifName);
        } else {
          setExportToast(`Saved ${gifName} to folder "${cleanName}"`);
          setTimeout(() => setExportToast(null), 4000);
        }
        return;
      }

      const frameCanvases: HTMLCanvasElement[] = [];
      for (const frameIdx of markers) {
        const raw = await loader.getFrame(frameIdx);
        if (raw) {
          const keyed = getKeyedFrameCanvas(raw);
          const resized = ImageProcessor.resizeCanvas(
            keyed,
            fw,
            fh,
            null,
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
      const gifName = `${cleanName}.gif`;
      const exportRes = await ExportManager.saveExportPackage(exportDestinationDir, cleanName, [
        { name: gifName, data: gifBlob },
      ]);
      if (exportRes.canceled) return;
      if (!exportRes.success) {
        AtlasBuilder.triggerDownload(gifBlob, gifName);
      } else {
        setExportToast(`Saved ${gifName} to folder "${cleanName}"`);
        setTimeout(() => setExportToast(null), 4000);
      }
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
        onOpenSupport={() => setIsSupportOpen(true)}
        bgMode={bgMode}
        setBgMode={setBgMode}
        bgColor={bgColor}
        setBgColor={setBgColor}
        bgPresets={bgPresets}
        isExporting={isExporting}
        hasMedia={hasMedia}
        activeFilename={activeFilename}
        fps={atlasSettings.fps}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
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
          onReorderTracks={handleReorderTracks}
          onDeleteTrack={handleDeleteTrack}
          onAddFiles={handleLoadFiles}
          exportScope={exportScope}
          setExportScope={setExportScope}
          spritesCount={spritesLoaderRef.current.metadata.totalFrames}
          keyingSettings={keyingSettings}
          onChangeKeying={setKeyingSettings}
          isEyedropperActive={isEyedropperActive}
          setIsEyedropperActive={setIsEyedropperActive}
          eyedropperTarget={eyedropperTarget}
          setEyedropperTarget={setEyedropperTarget}
          onAutoDetectKey={handleAutoDetectKey}
          atlasSettings={atlasSettings}
          onChangeAtlasSettings={setAtlasSettings}
          width={leftWidth}
          onLoadMaskMedia={handleLoadMaskMedia}
          onRemoveMaskMedia={handleRemoveMaskMedia}
          maskFilename={maskFilename}
          hasMaskMedia={hasMaskMedia}
          invertMask={invertMask}
          onToggleInvertMask={handleToggleInvertMask}
        />

        {/* Left Resizer Handle */}
        <div
          className={`resizer-handle resizer-left ${isResizingLeft ? 'resizing' : ''}`}
          onMouseDown={startResizingLeft}
          onDoubleClick={() => {
            setLeftWidth(290);
            localStorage.setItem('spriteforge_left_w', '290');
          }}
          title="Drag to resize Left Panel (Double-click to reset)"
        />

        {/* 2. Center Content (Viewport + Bottom Timeline) */}
        <main className="center-content">
          <Viewport
            frameCanvas={viewportCanvas}
            rawFrameCanvas={rawFrameCanvas}
            bgMode={bgMode}
            setBgMode={setBgMode}
            bgColor={bgColor}
            setBgColor={setBgColor}
            isEyedropperActive={isEyedropperActive}
            setIsEyedropperActive={setIsEyedropperActive}
            eyedropperTarget={eyedropperTarget}
            setEyedropperTarget={setEyedropperTarget}
            onPickColor={(color) => {
              if (eyedropperTarget === 'secondary') {
                setKeyingSettings((prev) => ({
                  ...prev,
                  secondaryKey: {
                    enabled: true,
                    color,
                    gain: prev.secondaryKey?.gain ?? 100,
                  },
                  enabled: true,
                }));
              } else {
                setKeyingSettings((prev) => ({ ...prev, keyColor: color, enabled: true }));
                if (!bgPresets.some((p) => p[0] === color[0] && p[1] === color[1] && p[2] === color[2])) {
                  setBgPresets((prev) => [color, ...prev.slice(0, 4)]);
                }
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
            meshSettings={atlasSettings.meshSettings}
            onUpdateMeshSettings={(mesh) =>
              setAtlasSettings((prev) => ({ ...prev, meshSettings: mesh }))
            }
            renderTrigger={renderTrigger}
            cropBox={atlasSettings.cropBox}
            cropLabel={tracks.find((t) => t.id === selectedTrackId)?.directionLabel}
            onUpdateCropBox={handleUpdateCropBox}
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
              isSequence={currentLoader.isSequence}
              isLooping={isLooping}
              setIsLooping={setIsLooping}
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
            localStorage.setItem('spriteforge_right_w', '300');
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
                onSliceEightDirections={handleSliceEightDirections}
                isSlicing8Dir={isSlicing8Dir}
              />

              {/* Atlas Preview & Convert & Export Button */}
              <AtlasPreview
                mode="atlas"
                atlasCanvas={atlasCanvas}
                atlasFrames={atlasFrames}
                spritesCanvases={[]}
                onExport={handleExport}
                isExporting={isExporting}
                hasMedia={hasMedia}
                exportFilename={exportFilename}
                setExportFilename={setExportFilename}
                destinationDir={exportDestinationDir}
                onSelectDestinationDir={handleSelectDestinationDir}
                generateNormalMap={generateNormalMap}
                setGenerateNormalMap={setGenerateNormalMap}
                generatePbrPack={generatePbrPack}
                setGeneratePbrPack={setGeneratePbrPack}
                enablePng8={atlasSettings.enablePng8}
                setEnablePng8={(val) => setAtlasSettings((prev) => ({ ...prev, enablePng8: val }))}
                generateMask={generateMask}
                setGenerateMask={setGenerateMask}
                onExportGif={handleExportGif}
                isExportingGif={isExportingGif}
                exportScope={exportScope}
                masterTracksCount={tracks.filter((t) => t.enabled).length}
                layoutMode={atlasSettings.layoutMode}
                fps={atlasSettings.fps}
                columns={atlasSettings.columns}
                rows={atlasSettings.rows}
                frameWidth={atlasSettings.frameWidth}
                frameHeight={atlasSettings.frameHeight}
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
                destinationDir={exportDestinationDir}
                onSelectDestinationDir={handleSelectDestinationDir}
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

      {/* Support Project Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Export Success Notification Toast */}
      {exportToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'rgba(12, 22, 18, 0.96)',
            border: '1px solid var(--accent-green)',
            boxShadow: '0 8px 30px rgba(0, 255, 170, 0.25)',
            borderRadius: 8,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text-bright)',
            fontSize: 12,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}
        >
          <FolderCheck size={18} color="var(--accent-green)" />
          <span>{exportToast}</span>
        </div>
      )}
    </div>
  );
};
