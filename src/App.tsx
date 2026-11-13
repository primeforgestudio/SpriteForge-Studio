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
import { FolderCheck, AlertTriangle, Save } from 'lucide-react';
import { isTauriEnvironment } from './core/tauriBridge';
import { ProjectManager, RecentProjectItem } from './core/projectManager';
import { ProjectLibraryManager } from './core/projectLibrary';
import { AiBackgroundRemover } from './core/aiBackgroundRemover';
import { FrameRetouchEngine } from './core/frameRetouch';
import { SpriteForgeProject, RetouchTool } from './core/types';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { LeftSidebar, LoadedFileItem } from './components/LeftSidebar';
import { Viewport } from './components/Viewport';
import { Timeline } from './components/Timeline';
import { AtlasPanel } from './components/AtlasPanel';
import { SpritesPanel } from './components/SpritesPanel';
import { AtlasPreview } from './components/AtlasPreview';
import { SettingsModal } from './components/SettingsModal';
import { SupportModal } from './components/SupportModal';
import { ProjectLibraryModal } from './components/ProjectLibraryModal';

export const App: React.FC = () => {
  // App Mode & Settings (Default to transparent checkerboard for clean cutout display)
  const [mode, setMode] = useState<AppMode>('atlas');
  const [bgMode, setBgMode] = useState<BackgroundMode>('checkerboard');
  const [bgColor, setBgColor] = useState<[number, number, number]>([0, 240, 132]);
  const [bgPresets, setBgPresets] = useState<[number, number, number][]>(DEFAULT_BG_PRESETS);

  const [keyingSettings, setKeyingSettings] = useState(DEFAULT_KEYING);
  const [atlasSettings, setAtlasSettings] = useState(DEFAULT_ATLAS);
  const [spritesSettings, setSpritesSettings] = useState(DEFAULT_SPRITES);

  // Multi-Track Animation Sets
  const [tracks, setTracks] = useState<AnimationTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [exportScope, setExportScope] = useState<ExportScope>('single');

  // Home Screen & Recent Projects
  const [showHomeScreen, setShowHomeScreen] = useState<boolean>(true);
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>(() =>
    ProjectManager.getRecentProjects()
  );

  // Viewport Loading / Processing Indicator
  const [customBusyStatus, setCustomBusyStatus] = useState<{
    title: string;
    detail?: string;
    progress?: number;
  } | null>(null);
  const [isUpdatingPreviewState, setIsUpdatingPreviewState] = useState<boolean>(false);

  // Unsaved Changes & Native Close Confirmation
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState<boolean>(false);
  const allowCloseRef = useRef<boolean>(false);
  const hasUnsavedRef = useRef<boolean>(false);
  const suppressDirtyRef = useRef<boolean>(false);

  // Project Save / Open State (.sfproj) & Character Library
  const [projectName, setProjectName] = useState<string>('');
  const [currentProjectFilePath, setCurrentProjectFilePath] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const handleSaveProjectRef = useRef<() => Promise<boolean>>(async () => false);
  const handleOpenProjectRef = useRef<() => void>(() => {});
  const loadProjectStateRef = useRef<((project: SpriteForgeProject, filePath?: string) => Promise<void>) | null>(null);

  // AI Non-Chroma Background Removal State (cached per trackId:frameIdx)
  const aiAlphaMasksRef = useRef<Map<string, Uint8ClampedArray>>(new Map());
  const [isProcessingAiBg, setIsProcessingAiBg] = useState<boolean>(false);
  const [aiBgProgress, setAiBgProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [aiMasksCount, setAiMasksCount] = useState<number>(0);

  // Per-Frame Manual Retouch State (Magic Wand / Eraser / Restore / Hidden Frames)
  const retouchMasksRef = useRef<Map<string, Uint8Array>>(new Map());
  const [retouchTool, setRetouchTool] = useState<RetouchTool>('none');
  const [retouchBrushSize, setRetouchBrushSize] = useState<number>(18);
  const [wandTolerance, setWandTolerance] = useState<number>(28);
  const [wandContiguous, setWandContiguous] = useState<boolean>(true);
  const [retouchVersion, setRetouchVersion] = useState<number>(0);
  const [hiddenFrames, setHiddenFrames] = useState<number[]>([]);

  const getFrameCacheKey = useCallback(
    (trackId: string, frameIdx: number) => `${trackId || 'default'}:${frameIdx}`,
    []
  );

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProjectRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProjectRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
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

  // Track unsaved changes whenever project state mutates with active media
  useEffect(() => {
    if (suppressDirtyRef.current) {
      suppressDirtyRef.current = false;
      return;
    }
    if (tracks.length > 0) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [tracks, keyingSettings, atlasSettings, spritesSettings, markers, hiddenFrames, retouchVersion, cropStart, cropEnd]);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges && tracks.length > 0;
  }, [hasUnsavedChanges, tracks.length]);

  // Intercept native window close (X button) to prompt saving unsaved project
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!allowCloseRef.current && hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    let unlistenTauri: (() => void) | null = null;
    let mounted = true;
    if (isTauriEnvironment()) {
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          if (!mounted) return;
          getCurrentWindow()
            .onCloseRequested((event) => {
              if (allowCloseRef.current) return;
              if (hasUnsavedRef.current) {
                event.preventDefault();
                setIsCloseConfirmOpen(true);
              }
            })
            .then((unlisten) => {
              if (mounted) unlistenTauri = unlisten;
              else unlisten();
            });
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (unlistenTauri) unlistenTauri();
    };
  }, []);

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

    const removalMode = keyingSettings.removalMode || 'chromakey';
    const frameKey = getFrameCacheKey(selectedTrackId, targetFrame);
    const cachedAiMask = aiAlphaMasksRef.current.get(frameKey);
    const retouchMask = retouchMasksRef.current.get(frameKey);
    const outlineCfg = atlasSettings.outlineSettings;

    // Helper: Apply per-frame retouch + live outline post-pass
    const applyPostPasses = () => {
      if (retouchMask) {
        FrameRetouchEngine.applyRetouchMaskToCanvas(canvas, retouchMask, rawData);
      }
      if (outlineCfg?.enabled && !showMask) {
        ImageProcessor.applyOutline(canvas, outlineCfg);
      }
      setViewportCanvas(canvas);
      setRenderTrigger((v) => (v + 1) % 1000000);
    };

    // Path A: AI Neural or Smart Flood (Non-Chroma Background Removal)
    if (removalMode === 'ai_neural' || removalMode === 'smart_flood') {
      ctx.putImageData(rawData, 0, 0);
      if (cachedAiMask) {
        AiBackgroundRemover.applyAlphaMaskToCanvas(canvas, cachedAiMask);
      } else if (removalMode === 'smart_flood') {
        const floodMask = AiBackgroundRemover.extractSmartFloodAlphaMask(
          rawData,
          keyingSettings.smartFloodTolerance ?? 28
        );
        AiBackgroundRemover.applyAlphaMaskToCanvas(canvas, floodMask);
      }
      applyPostPasses();
      return;
    }

    // Fast-path: When chroma key and masks are not active
    if (!keyingSettings.enabled && !showMask && !keyingSettings.garbageMatte?.enabled) {
      ctx.putImageData(rawData, 0, 0);
      applyPostPasses();
      return;
    }

    const keyHash = JSON.stringify({ ...keyingSettings, showMask });

    const cachedKeyed = loader.getKeyedFrame(targetFrame, keyHash);
    if (cachedKeyed) {
      ctx.putImageData(cachedKeyed, 0, 0);
      applyPostPasses();
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
        applyPostPasses();
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

    applyPostPasses();
  }, [mode, keyingSettings, showMask, selectedTrackId, atlasSettings.outlineSettings, retouchVersion, getFrameCacheKey]);

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

  // High-fidelity Keyer / AI Matter producing clean, full-resolution transparent canvas matching Viewport
  const getKeyedFrameCanvas = useCallback(
    (raw: ImageData, frameIdx?: number, trackIdOverride?: string): HTMLCanvasElement => {
      const targetTrackId = trackIdOverride ?? selectedTrackId;
      const removalMode = keyingSettings.removalMode || 'chromakey';

      const applyRetouchIfPresent = (outCanvas: HTMLCanvasElement) => {
        if (frameIdx !== undefined) {
          const rMask = retouchMasksRef.current.get(getFrameCacheKey(targetTrackId, frameIdx));
          if (rMask) {
            FrameRetouchEngine.applyRetouchMaskToCanvas(outCanvas, rMask, raw);
          }
        }
        return outCanvas;
      };

      // 1. AI Neural / Smart Flood Non-Chroma Path
      if (removalMode === 'ai_neural' || removalMode === 'smart_flood') {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = raw.width;
        outCanvas.height = raw.height;
        const ctx = outCanvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(raw, 0, 0);
          const aiMask =
            frameIdx !== undefined
              ? aiAlphaMasksRef.current.get(getFrameCacheKey(targetTrackId, frameIdx))
              : undefined;
          if (aiMask) {
            AiBackgroundRemover.applyAlphaMaskToCanvas(outCanvas, aiMask);
          } else if (removalMode === 'smart_flood') {
            const floodMask = AiBackgroundRemover.extractSmartFloodAlphaMask(
              raw,
              keyingSettings.smartFloodTolerance ?? 28
            );
            AiBackgroundRemover.applyAlphaMaskToCanvas(outCanvas, floodMask);
          }
        }
        return applyRetouchIfPresent(outCanvas);
      }

      // 2. WebGL KeyForge Chroma Key Path
      if (!keyingSettings.enabled && !keyingSettings.garbageMatte?.enabled) {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = raw.width;
        outCanvas.height = raw.height;
        outCanvas.getContext('2d')?.putImageData(raw, 0, 0);
        return applyRetouchIfPresent(outCanvas);
      }

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
              return applyRetouchIfPresent(outCanvas);
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
      return applyRetouchIfPresent(outCanvas);
    },
    [keyingSettings, selectedTrackId, getFrameCacheKey]
  );

  // Update Atlas Preview (Fast & High Quality matching Viewport)
  const isUpdatingAtlasRef = useRef(false);
  const updateAtlasPreview = useCallback(async () => {
    if (mode !== 'atlas' || isUpdatingAtlasRef.current || atlasLoaderRef.current.isVideoPlaying()) return;
    const loader = atlasLoaderRef.current;
    const activeMarkers = markers.filter((f) => !hiddenFrames.includes(f));
    if (loader.metadata.totalFrames <= 0 || activeMarkers.length === 0) return;

    isUpdatingAtlasRef.current = true;
    setIsUpdatingPreviewState(true);

    try {
      const fw = atlasSettings.frameWidth;
      const fh = atlasSettings.frameHeight;

      // High-resolution preview matching configured frame dimensions
      const maxDim = Math.max(fw, fh);
      const previewCellSize = Math.min(maxDim, 1024);
      const pScale = Math.min(1.0, previewCellSize / maxDim);
      const pfw = Math.max(32, Math.round(fw * pScale));
      const pfh = Math.max(32, Math.round(fh * pScale));

      const frameCanvases: HTMLCanvasElement[] = [];

      for (const frameIdx of activeMarkers) {
        if (loader.isVideoPlaying()) return;
        const raw = await loader.getFrame(frameIdx);
        if (raw) {
          // 1. Key / AI Matte / Retouch at full resolution
          const keyedCanvas = getKeyedFrameCanvas(raw, frameIdx);

          // 2. Uniform aspect-fit resize with bounding cropBox if active
          const smallCanvas = ImageProcessor.resizeCanvas(
            keyedCanvas,
            pfw,
            pfh,
            null,
            atlasSettings.cropBox
          );

          // 3. Apply Sprite Outline (Stroke) if enabled
          if (atlasSettings.outlineSettings?.enabled) {
            ImageProcessor.applyOutline(smallCanvas, atlasSettings.outlineSettings);
          }

          // 4. Apply Contact Drop-Shadow if enabled
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
      setIsUpdatingPreviewState(false);
    }
  }, [mode, markers, hiddenFrames, retouchVersion, atlasSettings, keyingSettings, getKeyedFrameCanvas]);

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

    setShowHomeScreen(false);
    setCustomBusyStatus({
      title: 'Loading Media & Decoding Frames...',
      detail: files[0]?.name || 'Media Sequence',
    });

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
        await renderAtlasFrame(0, false);

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
    } finally {
      setCustomBusyStatus(null);
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
    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const firstFile = e.dataTransfer.files[0];
        if (
          firstFile.name.endsWith('.sfproj') ||
          (firstFile.name.endsWith('.json') && firstFile.size < 50 * 1024 * 1024)
        ) {
          try {
            const text = await firstFile.text();
            const project = ProjectManager.parseProjectContent(text);
            if (project && loadProjectStateRef.current) {
              await loadProjectStateRef.current(project, firstFile.name);
              return;
            }
          } catch (err) {
            console.warn('Failed to parse dropped project:', err);
          }
        }
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
            ? { ...t, cropStart, cropEnd, markers, hiddenFrames, fps: atlasSettings.fps, cropBox: atlasSettings.cropBox }
            : t
        )
      );
    }

    const target = tracks.find((t) => t.id === id);
    if (!target || !target.fileRef) return;
    setSelectedTrackId(id);
    setSelectedFileId(id);
    setHiddenFrames(target.hiddenFrames || []);
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

  // ==========================================
  // SPRITEFORGE PROJECT SYSTEM (.sfproj)
  // ==========================================
  const loadProjectState = async (project: SpriteForgeProject, filePath?: string) => {
    setShowHomeScreen(false);
    setCustomBusyStatus({
      title: 'Opening Project...',
      detail: project.name || filePath || 'Restoring workspace',
    });
    try {
      suppressDirtyRef.current = true;
      if (project.appMode) setMode(project.appMode);
      if (project.exportScope) setExportScope(project.exportScope);
      if (project.exportFilename) setExportFilename(project.exportFilename);
      if (project.keyingSettings) setKeyingSettings(project.keyingSettings);
      if (project.atlasSettings) setAtlasSettings(project.atlasSettings);
      if (project.spritesSettings) setSpritesSettings(project.spritesSettings);
      if (project.maskFilename !== undefined) setMaskFilename(project.maskFilename);
      if (project.invertMask !== undefined) setInvertMask(project.invertMask);
      setBgMode(project.bgMode || 'checkerboard');
      if (project.bgColor) setBgColor(project.bgColor);

      // Reconstruct tracks and media
      const restoredTracks: AnimationTrack[] = [];
      for (const t of project.tracks) {
        const fileRef = await ProjectManager.reconstructTrackFile(t);
        restoredTracks.push({
          ...t,
          fileRef: fileRef || undefined,
          cropBox: t.cropBox ?? null,
        });
      }

      suppressDirtyRef.current = true;
      setTracks(restoredTracks);

      // Restore active track
      const targetTrackId = project.selectedTrackId || (restoredTracks[0]?.id ?? '');
      if (targetTrackId) {
        const targetTrack = restoredTracks.find((t) => t.id === targetTrackId) || restoredTracks[0];
        if (targetTrack) {
          setSelectedTrackId(targetTrack.id);
          setSelectedFileId(targetTrack.id);
          setCropStart(targetTrack.cropStart || 0);
          setCropEnd(targetTrack.cropEnd || (targetTrack.totalFrames ? targetTrack.totalFrames - 1 : 0));
          setMarkers(targetTrack.markers || [0]);
          setHiddenFrames(targetTrack.hiddenFrames || []);
          setCurrentFrame(project.currentFrame || targetTrack.cropStart || 0);

          if (targetTrack.fileRef) {
            await atlasLoaderRef.current.loadVideoFile(
              targetTrack.fileRef,
              targetTrack.fps || project.atlasSettings?.fps || 24
            );
            await renderAtlasFrame(project.currentFrame || targetTrack.cropStart || 0);
            updateAtlasPreview();
          }
        }
      }

      const displayName = filePath ? filePath.split(/[\\/]/).pop() || filePath : project.name || 'Untitled_Project.sfproj';
      if (filePath) {
        setCurrentProjectFilePath(filePath);
        setProjectName(displayName);
        const firstTrack = restoredTracks[0];
        const updatedRecent = ProjectManager.addRecentProject({
          name: displayName,
          filePath,
          thumbnailUrl: firstTrack?.thumbnailUrl,
          framesCount: firstTrack?.markers?.length || firstTrack?.totalFrames || 0,
          fps: project.atlasSettings?.fps || 24,
          savedAt: new Date().toISOString(),
        });
        setRecentProjects(updatedRecent);
      } else {
        setProjectName(displayName);
      }

      setHasUnsavedChanges(false);
      setExportToast(`✓ Loaded Project "${project.name}"`);
      setTimeout(() => setExportToast(null), 4000);
    } catch (err: any) {
      alert(`Error loading project: ${err.message}`);
    } finally {
      setCustomBusyStatus(null);
    }
  };

  const handleSaveProject = async (): Promise<boolean> => {
    if (isSavingProject) return false;
    setIsSavingProject(true);
    setCustomBusyStatus({
      title: 'Saving Project...',
      detail: 'Packaging tracks, keyframes & settings',
    });
    try {
      const activeName = (projectName || exportFilename || 'SpriteForge_Project').replace(/\.sfproj$/i, '');
      const syncedTracks = tracks.map((t) =>
        t.id === selectedTrackId
          ? { ...t, cropStart, cropEnd, markers, hiddenFrames, fps: atlasSettings.fps, cropBox: atlasSettings.cropBox }
          : t
      );
      const project = await ProjectManager.serializeProject({
        projectName: activeName,
        appMode: mode,
        exportScope,
        exportFilename,
        keyingSettings,
        atlasSettings,
        spritesSettings,
        tracks: syncedTracks,
        selectedTrackId,
        currentFrame,
        maskFilename,
        invertMask,
        bgMode,
        bgColor,
        embedMedia: true,
      });

      const res = await ProjectManager.saveProject(project, currentProjectFilePath || activeName);
      if (res.canceled) return false;
      if (res.success && res.filePath) {
        setCurrentProjectFilePath(res.filePath);
        const baseName = res.filePath.split(/[\\/]/).pop() || res.filePath;
        setProjectName(baseName);
        setHasUnsavedChanges(false);

        const firstTrack = syncedTracks[0];
        const updatedRecent = ProjectManager.addRecentProject({
          name: baseName,
          filePath: res.filePath,
          thumbnailUrl: firstTrack?.thumbnailUrl,
          framesCount: firstTrack?.markers?.length || firstTrack?.totalFrames || 0,
          fps: atlasSettings.fps || 24,
          savedAt: new Date().toISOString(),
        });
        setRecentProjects(updatedRecent);

        setExportToast(`✓ Project saved to "${baseName}"`);
        setTimeout(() => setExportToast(null), 4000);
        return true;
      } else if (res.error) {
        alert(`Failed to save project: ${res.error}`);
      }
      return false;
    } catch (e: any) {
      alert(`Error saving project: ${e.message}`);
      return false;
    } finally {
      setIsSavingProject(false);
      setCustomBusyStatus(null);
    }
  };

  const handleOpenProject = async () => {
    try {
      const res = await ProjectManager.openProject();
      if (res.canceled) return;
      if (res.success && res.project) {
        await loadProjectState(res.project, res.filePath);
      } else if (res.error) {
        alert(`Failed to open project: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error opening project: ${e.message}`);
    }
  };

  const handleOpenRecentProject = async (filePath: string) => {
    const res = await ProjectManager.openProjectByPath(filePath);
    if (res.success && res.project) {
      await loadProjectState(res.project, filePath);
    } else {
      alert(`Could not open "${filePath}": ${res.error || 'File may have been moved or deleted.'}`);
    }
  };

  const handleNewProject = () => {
    suppressDirtyRef.current = true;
    setTracks([]);
    setSelectedTrackId('');
    setSelectedFileId('');
    setViewportCanvas(null);
    setRawFrameCanvas(null);
    setAtlasCanvas(null);
    setAtlasFrames([]);
    atlasLoaderRef.current.close();
    spritesLoaderRef.current.close();
    setProjectName('');
    setCurrentProjectFilePath(null);
    setHasUnsavedChanges(false);
    setHiddenFrames([]);
    retouchMasksRef.current.clear();
    aiAlphaMasksRef.current.clear();
    setAiMasksCount(0);
    setBgMode('checkerboard');
    setShowHomeScreen(false);
  };

  const forceCloseApp = async () => {
    allowCloseRef.current = true;
    setIsCloseConfirmOpen(false);
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().destroy();
        return;
      } catch {}
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('exit_app_cmd');
      } catch {}
    } else {
      window.close();
    }
  };

  loadProjectStateRef.current = loadProjectState;
  handleSaveProjectRef.current = handleSaveProject;
  handleOpenProjectRef.current = handleOpenProject;

  // ==========================================
  // AI NON-CHROMA BACKGROUND REMOVAL
  // ==========================================
  const handleRunAiMatte = async (scope: 'current' | 'all') => {
    const loader = atlasLoaderRef.current;
    if (loader.metadata.totalFrames <= 0 || isProcessingAiBg) return;

    const targetFrames = scope === 'current' ? [currentFrame] : markers;
    if (targetFrames.length === 0) return;

    const removalMode = keyingSettings.removalMode || 'ai_neural';
    setIsProcessingAiBg(true);
    setAiBgProgress({ current: 0, total: targetFrames.length, stage: 'Preparing...' });

    try {
      for (let i = 0; i < targetFrames.length; i++) {
        const fIdx = targetFrames[i];
        const raw = await loader.getFrame(fIdx);
        if (!raw) continue;

        let alphaMask: Uint8ClampedArray;
        if (removalMode === 'ai_neural') {
          setAiBgProgress({
            current: i + 1,
            total: targetFrames.length,
            stage: `AI Matting Frame ${i + 1}/${targetFrames.length}`,
          });
          alphaMask = await AiBackgroundRemover.extractNeuralAlphaMask(raw, (pct, stage) => {
            setAiBgProgress({
              current: i + 1,
              total: targetFrames.length,
              stage: `${stage} (${pct}%)`,
            });
          });
        } else {
          setAiBgProgress({
            current: i + 1,
            total: targetFrames.length,
            stage: `Smart Flood Frame ${i + 1}/${targetFrames.length}`,
          });
          alphaMask = AiBackgroundRemover.extractSmartFloodAlphaMask(
            raw,
            keyingSettings.smartFloodTolerance ?? 28
          );
        }

        aiAlphaMasksRef.current.set(getFrameCacheKey(selectedTrackId, fIdx), alphaMask);
        setAiMasksCount(aiAlphaMasksRef.current.size);
        await new Promise((r) => setTimeout(r, 0));
      }

      await renderAtlasFrame(currentFrame, false);
      setRetouchVersion((v) => v + 1);
      setExportToast(`✓ Background removed for ${targetFrames.length} frame(s)`);
      setTimeout(() => setExportToast(null), 4000);
    } catch (e: any) {
      alert(`AI Background Removal failed: ${e.message}`);
    } finally {
      setIsProcessingAiBg(false);
      setAiBgProgress(null);
    }
  };

  const handleClearAiMasks = () => {
    const prefix = `${selectedTrackId || 'default'}:`;
    for (const k of Array.from(aiAlphaMasksRef.current.keys())) {
      if (k.startsWith(prefix)) {
        aiAlphaMasksRef.current.delete(k);
      }
    }
    setAiMasksCount(aiAlphaMasksRef.current.size);
    setRetouchVersion((v) => v + 1);
    renderAtlasFrame(currentFrame, false);
  };

  // ==========================================
  // PER-FRAME RETOUCH (MAGIC WAND, BRUSH, HIDE)
  // ==========================================
  const handleMagicWandClick = async (x: number, y: number) => {
    const canvas = viewportCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const key = getFrameCacheKey(selectedTrackId, currentFrame);
    let rMask = retouchMasksRef.current.get(key);
    if (!rMask || rMask.length !== canvas.width * canvas.height) {
      rMask = FrameRetouchEngine.createNeutralMask(canvas.width, canvas.height);
      retouchMasksRef.current.set(key, rMask);
    }

    const erased = FrameRetouchEngine.applyMagicWandErase(
      imgData,
      rMask,
      x,
      y,
      wandTolerance,
      wandContiguous
    );

    if (erased > 0) {
      setRetouchVersion((v) => v + 1);
      await renderAtlasFrame(currentFrame, false);
    }
  };

  const handleBrushStroke = async (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    brushMode: 'eraser' | 'restore'
  ) => {
    const canvas = viewportCanvasRef.current;
    if (!canvas) return;
    const key = getFrameCacheKey(selectedTrackId, currentFrame);
    let rMask = retouchMasksRef.current.get(key);
    if (!rMask || rMask.length !== canvas.width * canvas.height) {
      rMask = FrameRetouchEngine.createNeutralMask(canvas.width, canvas.height);
      retouchMasksRef.current.set(key, rMask);
    }

    FrameRetouchEngine.paintBrushStroke(
      rMask,
      canvas.width,
      canvas.height,
      x0,
      y0,
      x1,
      y1,
      retouchBrushSize,
      brushMode
    );
    setRetouchVersion((v) => v + 1);
    await renderAtlasFrame(currentFrame, true);
  };

  const handleResetFrameRetouch = async () => {
    const key = getFrameCacheKey(selectedTrackId, currentFrame);
    retouchMasksRef.current.delete(key);
    setRetouchVersion((v) => v + 1);
    await renderAtlasFrame(currentFrame, false);
  };

  const handleToggleHideFrame = (frame: number) => {
    setHiddenFrames((prev) => {
      const next = prev.includes(frame) ? prev.filter((f) => f !== frame) : [...prev, frame];
      if (selectedTrackId) {
        setTracks((tPrev) =>
          tPrev.map((t) => (t.id === selectedTrackId ? { ...t, hiddenFrames: next } : t))
        );
      }
      return next;
    });
  };

  // ==========================================
  // CHARACTER → ACTIONS LIBRARY HANDLERS
  // ==========================================
  const handleSaveCurrentToLibrary = async (characterName: string, actionName: string) => {
    const updatedTracks = tracks.map((t) =>
      t.id === selectedTrackId
        ? {
            ...t,
            characterName,
            cropStart,
            cropEnd,
            markers,
            hiddenFrames,
            fps: atlasSettings.fps,
            cropBox: atlasSettings.cropBox,
          }
        : t
    );

    const project = await ProjectManager.serializeProject({
      projectName: `${characterName}_${actionName}`,
      appMode: mode,
      exportScope,
      exportFilename: actionName || exportFilename,
      keyingSettings,
      atlasSettings,
      spritesSettings,
      tracks: updatedTracks,
      selectedTrackId,
      currentFrame,
      maskFilename,
      invertMask,
      embedMedia: true,
    });

    await ProjectLibraryManager.saveToLibrary(characterName, actionName, project);
    setExportToast(`✓ Saved "${characterName} → ${actionName}" to Library`);
    setTimeout(() => setExportToast(null), 4000);
  };

  const handleAppendActionToMaster = async (project: SpriteForgeProject) => {
    if (!project.tracks || project.tracks.length === 0) return;
    const appended: AnimationTrack[] = [];
    for (const t of project.tracks) {
      const fileRef = await ProjectManager.reconstructTrackFile(t);
      appended.push({
        ...t,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileRef: fileRef || undefined,
        cropBox: t.cropBox ?? null,
        enabled: true,
      });
    }
    setTracks((prev) => [...prev, ...appended]);
    setExportScope('master');
    setExportToast(`✓ Added ${appended.length} track(s) to Master Set`);
    setTimeout(() => setExportToast(null), 4000);
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
              ? { ...t, cropStart, cropEnd, markers, hiddenFrames, fps: atlasSettings.fps }
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

            const trackHidden = track.hiddenFrames || [];
            const rawMarkers = track.markers && track.markers.length > 0 ? track.markers : [0];
            const trackMarkers = rawMarkers.filter((f) => !trackHidden.includes(f));
            const trackCanvases: HTMLCanvasElement[] = [];

            for (const frameIdx of trackMarkers) {
              const raw = await tempLoader.getFrame(frameIdx);
              if (raw) {
                const keyed = getKeyedFrameCanvas(raw, frameIdx, track.id);
                const resized = ImageProcessor.resizeCanvas(
                  keyed,
                  fw,
                  fh,
                  null,
                  track.cropBox ?? atlasSettings.cropBox
                );
                if (atlasSettings.outlineSettings?.enabled) {
                  ImageProcessor.applyOutline(resized, atlasSettings.outlineSettings);
                }
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
        const activeMarkers = markers.filter((f) => !hiddenFrames.includes(f));
        if (loader.metadata.totalFrames <= 0 || activeMarkers.length === 0) return;

        const cols = atlasSettings.columns;
        const rows = atlasSettings.rows;

        const frameCanvases: HTMLCanvasElement[] = [];
        for (const frameIdx of activeMarkers) {
          const raw = await loader.getFrame(frameIdx);
          if (raw) {
            const keyed = getKeyedFrameCanvas(raw, frameIdx);
            const resized = ImageProcessor.resizeCanvas(
              keyed,
              fw,
              fh,
              null,
              atlasSettings.cropBox
            );
            if (atlasSettings.outlineSettings?.enabled) {
              ImageProcessor.applyOutline(resized, atlasSettings.outlineSettings);
            }
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

  const effectiveBusyStatus = customBusyStatus
    ? customBusyStatus
    : isProcessingAiBg
    ? {
        title: 'AI Background Removal',
        detail: aiBgProgress
          ? `${aiBgProgress.stage} (${aiBgProgress.current}/${aiBgProgress.total})`
          : 'Processing...',
        progress: aiBgProgress
          ? Math.round((aiBgProgress.current / Math.max(1, aiBgProgress.total)) * 100)
          : undefined,
      }
    : isSlicing8Dir
    ? {
        title: 'Slicing 8 Directions...',
        detail: 'Analyzing 3×3 directional character sectors',
      }
    : isAutoCropping
    ? {
        title: 'Tight Auto-Crop...',
        detail: 'Computing union silhouette bounds across keyframes',
      }
    : isExporting
    ? {
        title: 'Exporting Sprite Assets...',
        detail: 'Packing atlas, metadata & saving files to folder',
      }
    : isExportingGif
    ? {
        title: 'Encoding Animated GIF...',
        detail: 'Synthesizing frames into animated GIF',
      }
    : null;

  const closeConfirmModal = isCloseConfirmOpen ? (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(10, 11, 14, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={() => setIsCloseConfirmOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '94vw',
          background: '#1B1C22',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          padding: 22,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
              Save project before closing?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              You have unsaved changes in{' '}
              <span style={{ color: '#FF551F', fontWeight: 600 }}>
                {projectName || activeFilename || 'your current project'}
              </span>
              . Do you want to save a <code style={{ color: '#fff' }}>.sfproj</code> file before exiting?
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => setIsCloseConfirmOpen(false)}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 6,
              background: '#25272F',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-bright)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={forceCloseApp}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Don&apos;t Save
          </button>

          <button
            onClick={async () => {
              const saved = await handleSaveProject();
              if (saved) {
                await forceCloseApp();
              }
            }}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 6,
              background: '#FF551F',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 85, 31, 0.35)',
            }}
          >
            <Save size={13} />
            <span>Save &amp; Exit</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (showHomeScreen) {
    return (
      <>
        <HomeScreen
          recentProjects={recentProjects}
          onRemoveRecent={(fp) => setRecentProjects(ProjectManager.removeRecentProject(fp))}
          onNewProject={handleNewProject}
          onOpenProjectDialog={handleOpenProject}
          onOpenRecentProject={handleOpenRecentProject}
          onLoadMediaFiles={handleLoadFiles}
          onOpenLibraryProject={loadProjectState}
          hasActiveWorkspace={tracks.length > 0 || hasMedia}
          activeWorkspaceName={projectName || activeFilename}
          onResumeWorkspace={() => setShowHomeScreen(false)}
          onOpenSupport={() => setIsSupportOpen(true)}
        />
        <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
        {closeConfirmModal}
      </>
    );
  }

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
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onGoHome={() => setShowHomeScreen(true)}
        projectName={projectName}
        hasUnsavedChanges={hasUnsavedChanges}
        isSavingProject={isSavingProject}
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
          onRunAiMatte={handleRunAiMatte}
          onClearAiMasks={handleClearAiMasks}
          isProcessingAiBg={isProcessingAiBg}
          aiBgProgress={aiBgProgress}
          aiMasksCount={aiMasksCount}
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
            retouchTool={retouchTool}
            setRetouchTool={setRetouchTool}
            retouchBrushSize={retouchBrushSize}
            setRetouchBrushSize={setRetouchBrushSize}
            wandTolerance={wandTolerance}
            setWandTolerance={setWandTolerance}
            wandContiguous={wandContiguous}
            setWandContiguous={setWandContiguous}
            onMagicWandClick={handleMagicWandClick}
            onBrushStroke={handleBrushStroke}
            onResetFrameRetouch={handleResetFrameRetouch}
            hasFrameRetouch={retouchMasksRef.current.has(getFrameCacheKey(selectedTrackId, currentFrame))}
            isCurrentFrameHidden={hiddenFrames.includes(currentFrame)}
            busyStatus={effectiveBusyStatus}
            isUpdatingPreview={isUpdatingPreviewState}
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
              hiddenFrames={hiddenFrames}
              onToggleHideFrame={handleToggleHideFrame}
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

      {/* Character -> Actions Project Library Modal */}
      <ProjectLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        hasActiveMedia={hasMedia}
        defaultCharacterName={
          tracks.find((t) => t.id === selectedTrackId)?.characterName ||
          exportFilename.replace(/_(idle|walk|run|attack|jump)$/i, '') ||
          'Hero_Character'
        }
        defaultActionName={
          tracks.find((t) => t.id === selectedTrackId)?.name || 'idle'
        }
        onSaveCurrentToLibrary={handleSaveCurrentToLibrary}
        onLoadProjectFromLibrary={loadProjectState}
        onAppendActionToMaster={handleAppendActionToMaster}
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

      {/* Native Close Unsaved Changes Confirmation Modal */}
      {closeConfirmModal}
    </div>
  );
};
