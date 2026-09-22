import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BackgroundMode, GarbageMatteSettings, CollisionSettings, MeshSettings, SpriteMesh } from '../core/types';
import { Plus, Minus, RotateCcw, Maximize2, Pipette, Crosshair, Layers, Scissors, Shield, Columns, Sun, Lightbulb, Eye, ChevronDown, Check, Box } from 'lucide-react';
import { NormalMapGenerator } from '../core/normalMapGenerator';
import { PbrGenerator } from '../core/pbrGenerator';
import { MeshGenerator } from '../core/meshGenerator';

interface ViewportProps {
  frameCanvas: HTMLCanvasElement | null;
  rawFrameCanvas?: HTMLCanvasElement | null;
  bgMode: BackgroundMode;
  setBgMode: (mode: BackgroundMode) => void;
  bgColor: [number, number, number];
  setBgColor: (color: [number, number, number]) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  eyedropperTarget?: 'primary' | 'secondary';
  setEyedropperTarget?: (target: 'primary' | 'secondary') => void;
  onPickColor: (color: [number, number, number]) => void;
  onFilesDropped: (files: FileList) => void;
  emptyMessage?: string;
  hasMedia: boolean;
  showMask?: boolean;
  setShowMask?: (show: boolean) => void;
  // Pivot
  pivot?: { x: number; y: number };
  onUpdatePivot?: (pivot: { x: number; y: number }) => void;
  showPivot?: boolean;
  setShowPivot?: (show: boolean) => void;
  // Onion Skinning
  enableOnionSkin?: boolean;
  setEnableOnionSkin?: (enabled: boolean) => void;
  onionGhosts?: { prev?: HTMLCanvasElement | null; next?: HTMLCanvasElement | null } | null;
  enableGroundSnap?: boolean;
  // Garbage Matte (Cutout)
  garbageMatte?: GarbageMatteSettings;
  onUpdateGarbageMatte?: (matte: GarbageMatteSettings) => void;
  showGarbageMatte?: boolean;
  setShowGarbageMatte?: (show: boolean) => void;
  // Godot 4 Colliders
  collisionSettings?: CollisionSettings;
  onUpdateCollisionSettings?: (settings: CollisionSettings) => void;
  showColliders?: boolean;
  setShowColliders?: (show: boolean) => void;
  // 2D Mesh & Overdraw
  meshSettings?: MeshSettings;
  onUpdateMeshSettings?: (settings: MeshSettings) => void;
  showMeshWireframe?: boolean;
  setShowMeshWireframe?: (show: boolean) => void;
  renderTrigger?: number;
}

const ViewportComponent: React.FC<ViewportProps> = ({
  frameCanvas,
  rawFrameCanvas,
  bgMode,
  setBgMode,
  bgColor,
  setBgColor,
  isEyedropperActive,
  setIsEyedropperActive,
  eyedropperTarget = 'primary',
  setEyedropperTarget,
  onPickColor,
  onFilesDropped,
  emptyMessage = 'Drop Video or PNG Sequence here',
  hasMedia,
  showMask = false,
  setShowMask,
  pivot = { x: 0.5, y: 0.95 },
  onUpdatePivot,
  showPivot = false,
  setShowPivot,
  enableOnionSkin = false,
  setEnableOnionSkin,
  onionGhosts,
  enableGroundSnap = false,
  garbageMatte,
  onUpdateGarbageMatte,
  showGarbageMatte = false,
  setShowGarbageMatte,
  collisionSettings,
  onUpdateCollisionSettings,
  showColliders = false,
  setShowColliders,
  meshSettings,
  onUpdateMeshSettings,
  showMeshWireframe = false,
  setShowMeshWireframe,
  renderTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverColor, setHoverColor] = useState<[number, number, number] | null>(null);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  // 2D Mesh Wireframe & Fillrate Stats State
  const [localShowMeshWireframe, setLocalShowMeshWireframe] = useState(false);
  const effectiveShowMesh = setShowMeshWireframe ? showMeshWireframe : localShowMeshWireframe;
  const [currentMeshStats, setCurrentMeshStats] = useState<SpriteMesh | null>(null);
  const currentMeshRef = useRef<SpriteMesh | null>(null);

  useEffect(() => {
    if (!frameCanvas) {
      currentMeshRef.current = null;
      setCurrentMeshStats(null);
      return;
    }
    if (effectiveShowMesh || meshSettings?.showWireframe || meshSettings?.enabled) {
      try {
        const m = MeshGenerator.generateMesh(frameCanvas, meshSettings);
        currentMeshRef.current = m;
        setCurrentMeshStats(m);
      } catch (err) {
        console.warn('Failed to compute sprite mesh:', err);
      }
    }
  }, [
    frameCanvas,
    effectiveShowMesh,
    meshSettings?.showWireframe,
    meshSettings?.enabled,
    meshSettings?.detail,
    meshSettings?.paddingPx,
    meshSettings?.alphaThreshold,
    renderTrigger,
  ]);

  // Split-Screen Wipe («Шторка До / После») State
  const [isWipeActive, setIsWipeActive] = useState(false);
  const [wipePosition, setWipePosition] = useState(0.5);
  const [isDraggingWipe, setIsDraggingWipe] = useState(false);

  // 2.5D Dynamic Light Gizmo State
  const [isLightActive, setIsLightActive] = useState(false);
  const [lightPos, setLightPos] = useState<{ x: number; y: number }>({ x: 256, y: 150 });
  const [isDraggingLight, setIsDraggingLight] = useState(false);
  const cachedNormalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedRoughnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedEmissionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedNormalSourceRef = useRef<HTMLCanvasElement | null>(null);

  // Overlays Dropdown Menu State
  const [showOverlaysDropdown, setShowOverlaysDropdown] = useState(false);
  const overlaysDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOverlaysDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overlaysDropdownRef.current && !overlaysDropdownRef.current.contains(e.target as Node)) {
        setShowOverlaysDropdown(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showOverlaysDropdown]);

  // Global mouse handlers for Split-Screen Wipe dragging
  useEffect(() => {
    if (!isDraggingWipe) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!displayCanvasRef.current) return;
      const rect = displayCanvasRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
      setWipePosition(ratio);
    };
    const handleMouseUp = () => setIsDraggingWipe(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingWipe]);

  // Global mouse handlers for 2.5D Light Gizmo dragging
  useEffect(() => {
    if (!isDraggingLight) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!displayCanvasRef.current || !frameCanvas) return;
      const rect = displayCanvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const lx = Math.max(0, Math.min(frameCanvas.width, ((e.clientX - rect.left) / rect.width) * frameCanvas.width));
      const ly = Math.max(0, Math.min(frameCanvas.height, ((e.clientY - rect.top) / rect.height) * frameCanvas.height));
      setLightPos({ x: lx, y: ly });
    };
    const handleMouseUp = () => setIsDraggingLight(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLight, frameCanvas]);

  // Garbage Matte Dragging State
  type MatteHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const [activeMatteHandle, setActiveMatteHandle] = useState<MatteHandle | null>(null);
  const matteDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialMatte: { x: number; y: number; width: number; height: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialMatte: { x: 0, y: 0, width: 1, height: 1 },
  });

  const handleMatteMouseDown = (e: React.MouseEvent, handle: MatteHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const cur = garbageMatte || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
    matteDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialMatte: { x: cur.x, y: cur.y, width: cur.width, height: cur.height },
    };
    setActiveMatteHandle(handle);
  };

  // Global mouse handlers for Garbage Matte dragging/resizing
  useEffect(() => {
    if (!activeMatteHandle || !onUpdateGarbageMatte) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasWrapperRef.current) return;
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dx = (e.clientX - matteDragStartRef.current.clientX) / rect.width;
      const dy = (e.clientY - matteDragStartRef.current.clientY) / rect.height;
      const init = matteDragStartRef.current.initialMatte;

      const curMatte = garbageMatte ?? {
        enabled: true,
        x: 0.05,
        y: 0.05,
        width: 0.9,
        height: 0.9,
        feather: 2,
        invert: false,
      };

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      const MIN_SIZE = 0.02;

      if (activeMatteHandle === 'move') {
        newX = Math.max(0, Math.min(1 - newW, init.x + dx));
        newY = Math.max(0, Math.min(1 - newH, init.y + dy));
      } else {
        // Horizontal resizing
        if (activeMatteHandle === 'w' || activeMatteHandle === 'nw' || activeMatteHandle === 'sw') {
          const maxLeft = init.x + init.width - MIN_SIZE;
          newX = Math.max(0, Math.min(maxLeft, init.x + dx));
          newW = init.x + init.width - newX;
        } else if (activeMatteHandle === 'e' || activeMatteHandle === 'ne' || activeMatteHandle === 'se') {
          newW = Math.max(MIN_SIZE, Math.min(1 - init.x, init.width + dx));
        }

        // Vertical resizing
        if (activeMatteHandle === 'n' || activeMatteHandle === 'nw' || activeMatteHandle === 'ne') {
          const maxTop = init.y + init.height - MIN_SIZE;
          newY = Math.max(0, Math.min(maxTop, init.y + dy));
          newH = init.y + init.height - newY;
        } else if (activeMatteHandle === 's' || activeMatteHandle === 'sw' || activeMatteHandle === 'se') {
          newH = Math.max(MIN_SIZE, Math.min(1 - init.y, init.height + dy));
        }
      }

      onUpdateGarbageMatte({
        ...curMatte,
        enabled: true,
        x: Math.round(newX * 1000) / 1000,
        y: Math.round(newY * 1000) / 1000,
        width: Math.round(newW * 1000) / 1000,
        height: Math.round(newH * 1000) / 1000,
      });
    };

    const handleMouseUp = () => {
      setActiveMatteHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeMatteHandle, garbageMatte, onUpdateGarbageMatte]);

  const handlePivotMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPivot(true);
  };

  // Global mouse handlers for Pivot dragging
  useEffect(() => {
    if (!isDraggingPivot) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasWrapperRef.current || !onUpdatePivot) return;
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onUpdatePivot({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    };

    const handleMouseUp = () => {
      setIsDraggingPivot(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPivot, onUpdatePivot]);

  // Global mouse handlers for Collider & Hitbox dragging/resizing
  type ColliderType = 'feet' | 'hurtbox' | 'hitbox';
  type ColliderDragMode = 'move' | 'resize';
  const [activeColliderType, setActiveColliderType] = useState<ColliderType | null>(null);
  const [activeColliderDragMode, setActiveColliderDragMode] = useState<ColliderDragMode | null>(null);
  const colliderDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialBox: { width: number; height: number; offsetX: number; offsetY: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialBox: { width: 0, height: 0, offsetX: 0, offsetY: 0 },
  });

  const handleColliderMouseDown = (e: React.MouseEvent, type: ColliderType, mode: ColliderDragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (!collisionSettings) return;
    const box = collisionSettings[type];
    colliderDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: {
        width: box.width,
        height: box.height,
        offsetX: box.offsetX,
        offsetY: box.offsetY,
      },
    };
    setActiveColliderType(type);
    setActiveColliderDragMode(mode);
  };

  useEffect(() => {
    if (!activeColliderType || !activeColliderDragMode || !onUpdateCollisionSettings || !collisionSettings) return;

    const handleMouseMove = (e: MouseEvent) => {
      const init = colliderDragStartRef.current.initialBox;
      const dx = (e.clientX - colliderDragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - colliderDragStartRef.current.clientY) / zoom;

      const currentTarget = { ...collisionSettings[activeColliderType] };

      if (activeColliderDragMode === 'move') {
        currentTarget.offsetX = Math.round(init.offsetX + dx);
        currentTarget.offsetY = Math.round(init.offsetY + dy);
      } else {
        // resize: dragging changes width & height
        currentTarget.width = Math.max(8, Math.round(init.width + dx * 2));
        currentTarget.height = Math.max(6, Math.round(init.height + dy * 2));
      }

      onUpdateCollisionSettings({
        ...collisionSettings,
        [activeColliderType]: currentTarget,
      });
    };

    const handleMouseUp = () => {
      setActiveColliderType(null);
      setActiveColliderDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeColliderType, activeColliderDragMode, collisionSettings, onUpdateCollisionSettings, zoom]);

  const render = useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !frameCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== frameCanvas.width || canvas.height !== frameCanvas.height) {
      canvas.width = frameCanvas.width;
      canvas.height = frameCanvas.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2.5D Dynamic Lighting
    let drawnFrame = frameCanvas;
    if (isLightActive && frameCanvas) {
      if (
        !cachedNormalCanvasRef.current ||
        cachedNormalSourceRef.current !== frameCanvas ||
        cachedNormalCanvasRef.current.width !== frameCanvas.width ||
        cachedNormalCanvasRef.current.height !== frameCanvas.height
      ) {
        cachedNormalCanvasRef.current = NormalMapGenerator.generateNormalMap(frameCanvas, 2.8);
        cachedRoughnessCanvasRef.current = PbrGenerator.generateRoughnessMap(frameCanvas, 50);
        cachedEmissionCanvasRef.current = PbrGenerator.generateEmissionMap(frameCanvas, 180, 1.5);
        cachedNormalSourceRef.current = frameCanvas;
      }
      drawnFrame = NormalMapGenerator.applyDynamicLight(
        frameCanvas,
        cachedNormalCanvasRef.current,
        lightPos.x,
        lightPos.y,
        75,
        380,
        [255, 245, 220],
        1.35,
        0.35,
        cachedRoughnessCanvasRef.current,
        cachedEmissionCanvasRef.current
      );
    }

    // Split-Screen Wipe («Шторка До / После»)
    if (isWipeActive && rawFrameCanvas) {
      const splitX = Math.round(canvas.width * wipePosition);

      // 1. Left side: Raw unkeyed original frame
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, canvas.height);
      ctx.clip();
      ctx.drawImage(rawFrameCanvas, 0, 0);
      ctx.restore();

      // 2. Right side: Processed (keyed / lit) frame with background
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, canvas.width - splitX, canvas.height);
      ctx.clip();
      if (showMask) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(splitX, 0, canvas.width - splitX, canvas.height);
      } else if (bgMode === 'solid') {
        ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
        ctx.fillRect(splitX, 0, canvas.width - splitX, canvas.height);
      }
      if (!showMask && enableOnionSkin && onionGhosts) {
        if (onionGhosts.prev) ctx.drawImage(onionGhosts.prev, 0, 0);
        if (onionGhosts.next) ctx.drawImage(onionGhosts.next, 0, 0);
      }
      ctx.drawImage(drawnFrame, 0, 0);
      ctx.restore();

      // 3. Divider line
      ctx.save();
      ctx.strokeStyle = '#FF551F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, canvas.height);
      ctx.stroke();
      ctx.restore();
    } else {
      // Normal full-frame draw
      if (showMask) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bgMode === 'solid') {
        ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Onion Skinning: render previous (coral) and next (cyan) keyframe ghosts
      if (!showMask && enableOnionSkin && onionGhosts) {
        if (onionGhosts.prev) {
          ctx.drawImage(onionGhosts.prev, 0, 0);
        }
        if (onionGhosts.next) {
          ctx.drawImage(onionGhosts.next, 0, 0);
        }
      }

      ctx.drawImage(drawnFrame, 0, 0);
    }

    // 2D Mesh Wireframe Overlay
    if ((effectiveShowMesh || meshSettings?.showWireframe) && currentMeshRef.current) {
      const mesh = currentMeshRef.current;
      ctx.save();
      // Semi-transparent mesh fill
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const p0 = mesh.vertices[mesh.indices[i]];
        const p1 = mesh.vertices[mesh.indices[i + 1]];
        const p2 = mesh.vertices[mesh.indices[i + 2]];
        if (p0 && p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.lineTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Wireframe triangle edges
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
      ctx.lineWidth = 1;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const p0 = mesh.vertices[mesh.indices[i]];
        const p1 = mesh.vertices[mesh.indices[i + 1]];
        const p2 = mesh.vertices[mesh.indices[i + 2]];
        if (p0 && p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.lineTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Vertices dots
      ctx.fillStyle = '#00e5ff';
      for (const pt of mesh.vertices) {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [
    frameCanvas,
    rawFrameCanvas,
    bgMode,
    bgColor,
    showMask,
    enableOnionSkin,
    onionGhosts,
    isWipeActive,
    wipePosition,
    isLightActive,
    lightPos,
    effectiveShowMesh,
    meshSettings?.showWireframe,
    currentMeshStats,
  ]);

  useEffect(() => {
    render();
  }, [
    render,
    renderTrigger,
    isWipeActive,
    wipePosition,
    isLightActive,
    lightPos,
    effectiveShowMesh,
    meshSettings?.showWireframe,
    currentMeshStats,
  ]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.1, Math.min(10.0, prev * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEyedropperActive) {
      pickColorAtEvent(e);
      setIsEyedropperActive(false);
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (isEyedropperActive && frameCanvas) {
      const color = sampleColorAtEvent(e);
      setHoverColor(color);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const sampleColorAtEvent = (e: React.MouseEvent): [number, number, number] | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  };

  const pickColorAtEvent = (e: React.MouseEvent) => {
    const color = sampleColorAtEvent(e);
    if (color) {
      onPickColor(color);
    }
  };

  const handleReset = () => {
    setZoom(0.5);
    setPan({ x: 0, y: 0 });
  };

  const handleFit = () => {
    if (!containerRef.current || !frameCanvas) return;
    const containerW = containerRef.current.clientWidth - 40;
    const containerH = containerRef.current.clientHeight - 40;
    const scaleW = containerW / frameCanvas.width;
    const scaleH = containerH / frameCanvas.height;
    setZoom(Math.min(scaleW, scaleH, 1.0));
    setPan({ x: 0, y: 0 });
  };

  // Background selector helper
  const isPresetActive = (type: 'grid' | 'green' | 'black' | 'white' | 'magenta') => {
    if (type === 'grid') return bgMode === 'checkerboard';
    if (bgMode !== 'solid') return false;
    if (type === 'green') return bgColor[1] > 180 && bgColor[0] < 100;
    if (type === 'black') return bgColor[0] === 0 && bgColor[1] === 0 && bgColor[2] === 0;
    if (type === 'white') return bgColor[0] === 255 && bgColor[1] === 255 && bgColor[2] === 255;
    if (type === 'magenta') return bgColor[0] === 255 && bgColor[1] === 0 && bgColor[2] === 255;
    return false;
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) onFilesDropped(e.dataTransfer.files);
      }}
      style={{
        flex: 1,
        position: 'relative',
        background: '#17181C',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isEyedropperActive ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Top-Left Floating Zoom Controls (from screenshot) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(23, 24, 28, 0.95)',
          padding: '3px 4px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.25))}
          style={{ background: 'transparent', border: 'none', padding: '4px 6px', color: 'var(--text-main)' }}
          title="Zoom In"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}
          style={{ background: 'transparent', border: 'none', padding: '4px 6px', color: 'var(--text-main)' }}
          title="Zoom Out"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleReset}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            color: 'var(--text-main)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="50% Zoom"
        >
          <RotateCcw size={11} style={{ marginRight: 4 }} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleFit}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            color: 'var(--text-main)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Fit to Screen"
        >
          <Maximize2 size={11} style={{ marginRight: 4 }} />
          Fit
        </button>

        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Eyedropper Button */}
        <button
          onClick={() => setIsEyedropperActive(!isEyedropperActive)}
          style={{
            background: isEyedropperActive ? '#2B2D37' : 'transparent',
            color: isEyedropperActive ? '#FF551F' : 'var(--text-main)',
            border: isEyedropperActive ? '1.5px solid #FF551F' : 'none',
            padding: '4px 6px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
          title="Eyedropper (Pick Chroma Key Color)"
        >
          <Pipette size={13} color={isEyedropperActive ? '#FF551F' : 'var(--text-main)'} />
        </button>

        {showPivot && onUpdatePivot && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 2px' }} />
            <button
              onClick={() => onUpdatePivot({ x: 0.5, y: 0.95 })}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: '#FF551F',
                cursor: 'pointer',
                borderRadius: 4,
              }}
              title="Snap Pivot to Feet (Bottom-Center: 50%, 95%)"
            >
              Snap Feet
            </button>
            <button
              onClick={() => onUpdatePivot({ x: 0.5, y: 0.5 })}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: 4,
              }}
              title="Snap Pivot to Center (50%, 50%)"
            >
              Snap Center
            </button>
          </>
        )}
      </div>

      {/* Top-Right Floating Tools: Compact & Non-overlapping */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(23, 24, 28, 0.95)',
          padding: '3px 4px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Compact Background Swatch Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 4, borderRight: '1px solid var(--border-subtle)' }}>
          {/* Grid / Checkerboard */}
          <button
            onClick={() => setBgMode('checkerboard')}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: isPresetActive('grid') ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              background: '#2B2D37',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Checkerboard (Transparent)"
          >
            <span style={{ fontSize: 11, lineHeight: 1 }}>▦</span>
          </button>

          {/* Green */}
          <button
            onClick={() => {
              setBgMode('solid');
              setBgColor([0, 240, 132]);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: isPresetActive('green') ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Green Background"
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#00f084', display: 'inline-block' }} />
          </button>

          {/* Black */}
          <button
            onClick={() => {
              setBgMode('solid');
              setBgColor([0, 0, 0]);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: isPresetActive('black') ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Black Background"
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#000000', border: '1px solid #333', display: 'inline-block' }} />
          </button>

          {/* White */}
          <button
            onClick={() => {
              setBgMode('solid');
              setBgColor([255, 255, 255]);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: isPresetActive('white') ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="White Background"
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ffffff', display: 'inline-block' }} />
          </button>

          {/* Magenta */}
          <button
            onClick={() => {
              setBgMode('solid');
              setBgColor([255, 0, 255]);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: isPresetActive('magenta') ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Magenta (High-Contrast Spill Check)"
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ff00ff', display: 'inline-block' }} />
          </button>
        </div>

        {/* Viewport Overlays Dropdown */}
        <div style={{ position: 'relative' }} ref={overlaysDropdownRef}>
          <button
            onClick={() => setShowOverlaysDropdown(!showOverlaysDropdown)}
            style={{
              background: (showPivot || showColliders || showGarbageMatte || enableOnionSkin || showOverlaysDropdown)
                ? '#2B2D37'
                : 'transparent',
              color: (showPivot || showColliders || showGarbageMatte || enableOnionSkin)
                ? '#FF551F'
                : 'var(--text-muted)',
              border: (showPivot || showColliders || showGarbageMatte || enableOnionSkin)
                ? '1px solid #FF551F'
                : '1px solid transparent',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 600,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Toggle Viewport Overlays (Pivot, Colliders, Garbage Matte, Onion Skin)"
          >
            <Layers size={12} />
            <span>Overlays</span>
            {((showPivot ? 1 : 0) + (showColliders ? 1 : 0) + (showGarbageMatte ? 1 : 0) + (enableOnionSkin ? 1 : 0)) > 0 && (
              <span
                style={{
                  background: '#FF551F',
                  color: '#ffffff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '0 4px',
                  borderRadius: 8,
                  lineHeight: '13px',
                }}
              >
                {(showPivot ? 1 : 0) + (showColliders ? 1 : 0) + (showGarbageMatte ? 1 : 0) + (enableOnionSkin ? 1 : 0)}
              </span>
            )}
            <ChevronDown size={11} style={{ opacity: 0.7 }} />
          </button>

          {showOverlaysDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                zIndex: 50,
                minWidth: 200,
                background: '#17181C',
                border: '1px solid #2D2E37',
                borderRadius: 8,
                padding: '8px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Pivot Point */}
              {setShowPivot && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px', borderRadius: 4, background: showPivot ? '#22232A' : 'transparent' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 11, color: 'var(--text-bright)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Crosshair size={12} color={showPivot ? '#FF551F' : 'var(--text-muted)'} />
                      <span style={{ fontWeight: 500 }}>Pivot Point</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showPivot}
                      onChange={() => setShowPivot(!showPivot)}
                      style={{ accentColor: '#FF551F' }}
                    />
                  </label>
                  {showPivot && onUpdatePivot && (
                    <div style={{ display: 'flex', gap: 4, paddingLeft: 18, marginTop: 2 }}>
                      <button
                        onClick={() => onUpdatePivot({ x: 0.5, y: 0.95 })}
                        style={{
                          flex: 1,
                          background: '#2B2D37',
                          border: '1px solid #FF551F',
                          color: '#FF551F',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 4px',
                          borderRadius: 3,
                          cursor: 'pointer',
                        }}
                      >
                        Feet (95%)
                      </button>
                      <button
                        onClick={() => onUpdatePivot({ x: 0.5, y: 0.5 })}
                        style={{
                          flex: 1,
                          background: '#121316',
                          border: '1px solid #2D2E37',
                          color: 'var(--text-muted)',
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '2px 4px',
                          borderRadius: 3,
                          cursor: 'pointer',
                        }}
                      >
                        Center (50%)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Godot 4 Colliders */}
              {setShowColliders && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px', borderRadius: 4, background: showColliders ? '#22232A' : 'transparent', fontSize: 11, color: 'var(--text-bright)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={12} color={showColliders ? '#00b0ff' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 500 }}>Godot 4 Colliders</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showColliders}
                    onChange={() => setShowColliders(!showColliders)}
                    style={{ accentColor: '#00b0ff' }}
                  />
                </label>
              )}

              {/* Garbage Matte */}
              {setShowGarbageMatte && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px', borderRadius: 4, background: showGarbageMatte ? '#22232A' : 'transparent', fontSize: 11, color: 'var(--text-bright)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scissors size={12} color={showGarbageMatte ? '#FF551F' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 500 }}>Garbage Matte</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showGarbageMatte}
                    onChange={() => {
                      const next = !showGarbageMatte;
                      setShowGarbageMatte(next);
                      if (next && onUpdateGarbageMatte && !garbageMatte?.enabled) {
                        onUpdateGarbageMatte({
                          enabled: true,
                          x: garbageMatte?.x ?? 0.05,
                          y: garbageMatte?.y ?? 0.05,
                          width: garbageMatte?.width ?? 0.9,
                          height: garbageMatte?.height ?? 0.9,
                          feather: garbageMatte?.feather ?? 2,
                          invert: garbageMatte?.invert ?? false,
                        });
                      }
                    }}
                    style={{ accentColor: '#FF551F' }}
                  />
                </label>
              )}

              {/* Onion Skinning */}
              {setEnableOnionSkin && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px', borderRadius: 4, background: enableOnionSkin ? '#22232A' : 'transparent', fontSize: 11, color: 'var(--text-bright)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={12} color={enableOnionSkin ? '#ff5252' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 500 }}>Onion Skinning</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableOnionSkin}
                    onChange={() => setEnableOnionSkin(!enableOnionSkin)}
                    style={{ accentColor: '#ff5252' }}
                  />
                </label>
              )}

              {/* 2D Mesh Wireframe */}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px', borderRadius: 4, background: (effectiveShowMesh || meshSettings?.showWireframe) ? '#22232A' : 'transparent', fontSize: 11, color: 'var(--text-bright)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Box size={12} color={(effectiveShowMesh || meshSettings?.showWireframe) ? '#00e5ff' : 'var(--text-muted)'} />
                  <span style={{ fontWeight: 500 }}>2D Mesh Wireframe</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!(effectiveShowMesh || meshSettings?.showWireframe)}
                  onChange={() => {
                    const nextVal = !(effectiveShowMesh || meshSettings?.showWireframe);
                    if (setShowMeshWireframe) {
                      setShowMeshWireframe(nextVal);
                    } else {
                      setLocalShowMeshWireframe(nextVal);
                    }
                    if (onUpdateMeshSettings && meshSettings) {
                      onUpdateMeshSettings({ ...meshSettings, showWireframe: nextVal });
                    }
                  }}
                  style={{ accentColor: '#00e5ff' }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Hero Visual Tools */}
        {/* Split-Screen Wipe */}
        <button
          onClick={() => setIsWipeActive(!isWipeActive)}
          style={{
            background: isWipeActive ? 'var(--bg-input)' : 'transparent',
            color: isWipeActive ? '#FF551F' : 'var(--text-muted)',
            border: isWipeActive ? '1.5px solid #FF551F' : '1px solid transparent',
            padding: '4px 8px',
            borderRadius: 5,
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Split-Screen Wipe: compare raw video vs keyed cutout"
        >
          <Columns size={11} />
          <span>Wipe</span>
        </button>

        {/* 2.5D Dynamic Light Gizmo */}
        <button
          onClick={() => setIsLightActive(!isLightActive)}
          style={{
            background: isLightActive ? 'var(--bg-input)' : 'transparent',
            color: isLightActive ? '#FFCC00' : 'var(--text-muted)',
            border: isLightActive ? '1.5px solid #FFCC00' : '1px solid transparent',
            padding: '4px 8px',
            borderRadius: 5,
            fontWeight: 600,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="2.5D Dynamic Lighting: interactive point light on normal map"
        >
          <Sun size={11} />
          <span>Light</span>
        </button>

        {/* Alpha Mask */}
        {setShowMask && (
          <button
            onClick={() => setShowMask(!showMask)}
            style={{
              background: showMask ? 'var(--bg-input)' : 'transparent',
              color: showMask ? '#ffffff' : 'var(--text-muted)',
              border: showMask ? '1.5px solid var(--accent-orange)' : '1px solid transparent',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 600,
              fontSize: 11,
              cursor: 'pointer',
            }}
            title="Toggle Alpha Mask / Matte view"
          >
            Mask
          </button>
        )}
      </div>

      {/* Eyedropper Hover Tooltip */}
      {isEyedropperActive && hoverColor && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(23, 24, 28, 0.95)',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #FF551F',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: `rgb(${hoverColor[0]},${hoverColor[1]},${hoverColor[2]})`,
              border: '1.5px solid #fff',
            }}
          />
          <span style={{ fontSize: 11, color: '#FF551F', fontWeight: 600 }}>
            {eyedropperTarget === 'secondary' ? 'Secondary / Hole Key' : 'Primary Key'}:
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-bright)' }}>
            RGB({hoverColor[0]}, {hoverColor[1]}, {hoverColor[2]})
          </span>
        </div>
      )}

      {/* Canvas or Empty State */}
      {!hasMedia ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: 'var(--text-muted)',
            border: '2px dashed var(--border-medium)',
            borderRadius: 12,
            padding: '50px 80px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-bright)', fontWeight: 600 }}>
            {emptyMessage}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Drag and drop media files or click "Load media"
          </div>
        </div>
      ) : (
        <div
          ref={canvasWrapperRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            borderRadius: 4,
            overflow: 'visible',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            position: 'relative',
          }}
          className={bgMode === 'checkerboard' ? 'checkerboard' : ''}
        >
          <canvas ref={displayCanvasRef} style={{ display: 'block', borderRadius: 4 }} />

          {/* Split-Screen Wipe Interactive Drag Handle */}
          {isWipeActive && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsDraggingWipe(true);
              }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${wipePosition * 100}%`,
                transform: 'translateX(-50%)',
                width: 20,
                cursor: 'ew-resize',
                zIndex: 35,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Drag to compare Original vs Keyed"
            >
              <div
                style={{
                  width: 2,
                  height: '100%',
                  background: '#FF551F',
                  boxShadow: '0 0 6px rgba(255, 85, 31, 0.8)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#17181C',
                  border: '1.5px solid #FF551F',
                  borderRadius: 12,
                  padding: '2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>◄ RAW</span>
                <span style={{ color: '#FF551F' }}>|</span>
                <span>KEYED ►</span>
              </div>
            </div>
          )}

          {/* 2.5D Light Gizmo */}
          {isLightActive && frameCanvas && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsDraggingLight(true);
              }}
              style={{
                position: 'absolute',
                left: `${(lightPos.x / frameCanvas.width) * 100}%`,
                top: `${(lightPos.y / frameCanvas.height) * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 36,
                cursor: isDraggingLight ? 'grabbing' : 'grab',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              title="2.5D Point Light Gizmo: drag around sprite to test dynamic normal shading"
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #FFF7D6 0%, #FFCC00 65%, rgba(255,204,0,0) 100%)',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 16px #FFCC00, 0 0 32px rgba(255, 204, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sun size={13} color="#17181C" />
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#FFCC00',
                  background: 'rgba(23, 24, 28, 0.85)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  marginTop: 3,
                  border: '1px solid rgba(255, 204, 0, 0.3)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                Light
              </span>
            </div>
          )}

          {/* Interactive Pivot Reticle */}
          {showPivot && pivot && (
            <div
              onMouseDown={handlePivotMouseDown}
              style={{
                position: 'absolute',
                left: `${pivot.x * 100}%`,
                top: `${pivot.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
                cursor: isDraggingPivot ? 'grabbing' : 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`Pivot: (${Math.round(pivot.x * 100)}%, ${Math.round(pivot.y * 100)}%). Drag to move.`}
            >
              {/* Outer Target Circle */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: '2px solid var(--accent-green)',
                  backgroundColor: 'rgba(0, 240, 132, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(0,240,132,0.6)',
                  position: 'relative',
                }}
              >
                {/* Horizontal Crosshair */}
                <div
                  style={{
                    position: 'absolute',
                    width: 38,
                    height: 1.5,
                    background: 'var(--accent-green)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Vertical Crosshair */}
                <div
                  style={{
                    position: 'absolute',
                    height: 38,
                    width: 1.5,
                    background: 'var(--accent-green)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Center Dot */}
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#ffffff',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Floating Tag */}
              <div
                style={{
                  position: 'absolute',
                  top: 28,
                  background: 'rgba(10, 15, 13, 0.92)',
                  border: '1px solid var(--accent-green)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: 'var(--accent-green)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
              >
                {Math.round(pivot.x * 100)}%, {Math.round(pivot.y * 100)}%
              </div>
            </div>
          )}

          {/* Ground Baseline Guideline (Active when Ground Snap is enabled) */}
          {enableGroundSnap && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(pivot?.y ?? 0.95) * 100}%`,
                height: 1,
                borderTop: '1.5px dashed rgba(0, 240, 132, 0.7)',
                pointerEvents: 'none',
                zIndex: 25,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 2,
                  fontSize: 8,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: 'var(--accent-green)',
                  background: 'rgba(10, 15, 13, 0.85)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid rgba(0, 240, 132, 0.3)',
                }}
              >
                GROUND BASELINE
              </span>
            </div>
          )}

          {/* Garbage Matte (Cutout) Gizmo & Dimmed Outer Regions */}
          {showGarbageMatte && (
            <>
              {/* 4 Dimmed Outer Regions (Hatched) */}
              {/* Top strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Bottom strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${((garbageMatte?.y ?? 0.05) + (garbageMatte?.height ?? 0.9)) * 100}%`,
                  width: '100%',
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Left strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  width: `${(garbageMatte?.x ?? 0.05) * 100}%`,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Right strip */}
              <div
                style={{
                  position: 'absolute',
                  left: `${((garbageMatte?.x ?? 0.05) + (garbageMatte?.width ?? 0.9)) * 100}%`,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  right: 0,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />

              {/* The Interactive Bounding Box */}
              <div
                onMouseDown={(e) => handleMatteMouseDown(e, 'move')}
                style={{
                  position: 'absolute',
                  left: `${(garbageMatte?.x ?? 0.05) * 100}%`,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  width: `${(garbageMatte?.width ?? 0.9) * 100}%`,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  border: '2px dashed #f59e0b',
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), inset 0 0 16px rgba(245, 158, 11, 0.08)',
                  cursor: activeMatteHandle === 'move' ? 'grabbing' : 'grab',
                  zIndex: 24,
                  userSelect: 'none',
                }}
                title="Garbage Matte (Cutout) Bounds. Drag to move box, drag handles to resize."
              >
                {/* Matte Info Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: -22,
                    left: 0,
                    background: 'rgba(15, 20, 18, 0.92)',
                    border: '1px solid #f59e0b',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#f59e0b',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>
                    ✂️ MATTE {Math.round((garbageMatte?.width ?? 0.9) * 100)}% ×{' '}
                    {Math.round((garbageMatte?.height ?? 0.9) * 100)}%
                  </span>
                  {garbageMatte?.invert && <span style={{ color: '#ff5252' }}>[INV]</span>}
                  {garbageMatte?.feather ? <span>(F:{garbageMatte.feather}px)</span> : null}
                </div>

                {/* 8 Resize Handles */}
                {[
                  { id: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
                  { id: 'n', left: '50%', top: 0, cursor: 'ns-resize' },
                  { id: 'ne', left: '100%', top: 0, cursor: 'nesw-resize' },
                  { id: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
                  { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
                  { id: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
                  { id: 'sw', left: 0, top: '100%', cursor: 'nesw-resize' },
                  { id: 'w', left: 0, top: '50%', cursor: 'ew-resize' },
                ].map((h) => (
                  <div
                    key={h.id}
                    onMouseDown={(e) => handleMatteMouseDown(e, h.id as any)}
                    style={{
                      position: 'absolute',
                      left: h.left,
                      top: h.top,
                      width: 10,
                      height: 10,
                      marginLeft: -5,
                      marginTop: -5,
                      borderRadius: 2,
                      background: '#f59e0b',
                      border: '1.5px solid #ffffff',
                      boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                      cursor: h.cursor,
                      zIndex: 26,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Godot 4 Colliders & Combat Hitboxes Overlay */}
          {showColliders && collisionSettings && (
            <>
              {/* 1. Feet Collider (Physics Ground Collision) */}
              {collisionSettings.feet.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'feet', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.feet.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.feet.offsetY}px)`,
                    width: collisionSettings.feet.width,
                    height: collisionSettings.feet.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: collisionSettings.feet.shape === 'capsule' ? 9999 : 3,
                    border: '1.5px solid #00f084',
                    backgroundColor: 'rgba(0, 240, 132, 0.25)',
                    boxShadow: '0 0 10px rgba(0, 240, 132, 0.4)',
                    cursor:
                      activeColliderType === 'feet' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 32,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Feet CollisionShape2D (Floor & Wall Physics). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(10, 20, 15, 0.9)',
                      border: '1px solid #00f084',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#00f084',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    FEET ({collisionSettings.feet.width}×{collisionSettings.feet.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'feet', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#00f084',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}

              {/* 2. Hurtbox (Body Damage Vulnerability Zone) */}
              {collisionSettings.hurtbox.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'hurtbox', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.hurtbox.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.hurtbox.offsetY}px)`,
                    width: collisionSettings.hurtbox.width,
                    height: collisionSettings.hurtbox.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 9999,
                    border: '1.5px dashed #00b0ff',
                    backgroundColor: 'rgba(0, 176, 255, 0.16)',
                    boxShadow: '0 0 10px rgba(0, 176, 255, 0.3)',
                    cursor:
                      activeColliderType === 'hurtbox' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 31,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Hurtbox Area2D (Body Damage Zone). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(10, 18, 25, 0.9)',
                      border: '1px solid #00b0ff',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#00b0ff',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    HURTBOX ({collisionSettings.hurtbox.width}×{collisionSettings.hurtbox.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'hurtbox', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#00b0ff',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}

              {/* 3. Hitbox (Attack Weapon Strike Zone) */}
              {collisionSettings.hitbox.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'hitbox', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.hitbox.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.hitbox.offsetY}px)`,
                    width: collisionSettings.hitbox.width,
                    height: collisionSettings.hitbox.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 4,
                    border: '1.5px solid #ff3366',
                    backgroundColor: 'rgba(255, 51, 102, 0.22)',
                    boxShadow: '0 0 10px rgba(255, 51, 102, 0.4)',
                    cursor:
                      activeColliderType === 'hitbox' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 33,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Hitbox Area2D (Weapon Attack Strike Zone). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(25, 10, 15, 0.9)',
                      border: '1px solid #ff3366',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#ff3366',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    HITBOX ({collisionSettings.hitbox.width}×{collisionSettings.hitbox.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'hitbox', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#ff3366',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 2D Mesh Overdraw HUD Badge */}
      {(effectiveShowMesh || meshSettings?.showWireframe || meshSettings?.enabled) && currentMeshStats && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(23, 24, 28, 0.95)',
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid #00e5ff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            fontSize: 11,
            color: 'var(--text-bright)',
            fontWeight: 500,
          }}
        >
          <Box size={13} color="#00e5ff" />
          <span>
            Mesh: <strong style={{ color: '#00e5ff' }}>{currentMeshStats.vertexCount}v</strong> / {currentMeshStats.triangleCount} tris
          </span>
          <span style={{ color: 'var(--border-medium)' }}>|</span>
          <span style={{ color: '#00f084', fontWeight: 700 }}>
            🟢 {currentMeshStats.areaSavingsPercent}% Fillrate Saved
          </span>
        </div>
      )}
    </div>
  );
};

export const Viewport = React.memo(ViewportComponent);
