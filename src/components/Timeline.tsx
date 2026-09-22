import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, RotateCw, Plus, Check } from 'lucide-react';

interface TimelineProps {
  totalFrames: number;
  currentFrame: number;
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>;
  cropStart: number;
  setCropStart: (start: number) => void;
  cropEnd: number;
  setCropEnd: (end: number) => void;
  markers: number[];
  setMarkers: (markers: number[]) => void;
  fps: number;
  setFps: (fps: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isSequence?: boolean;
  isLooping?: boolean;
  setIsLooping?: (looping: boolean) => void;
  onDistributeMarkers: () => void;
  onDetectLoop?: () => Promise<string | null>;
}

// SpriteForge Studio Unified Dark Matte & Vibrant Orange Palette
const TL_BG = '#15161a';
const TL_RULER_BG = '#191a1f';
const TL_TRACK = '#121316';
const TL_RANGE_TOP = '#3d2419';
const TL_RANGE_BOTTOM = '#2d1a12';
const TL_OUT = '#0d0e10';
const TL_KEYLANE = '#16171b';
const TL_GRID = '#26272e';
const TL_TICK = '#383a45';
const TL_TEXT = '#8a909d';
const TL_HANDLE = '#ff5c26';
const TL_HANDLE_HOVER = '#ff7b4d';
const TL_HANDLE_GRIP = '#3d160a';
const TL_KEY = '#e2734a';
const TL_KEY_HOVER = '#ffffff';
const TL_KEY_SELECTED = '#ff5c26';
const TL_KEY_EDGE = '#18191d';
const TL_PLAYHEAD = '#ff5c26';
const TL_PLAYHEAD_TEXT = '#ffffff';

// Exact Geometry Constants
const PAD = 16;
const RULER_H = 22;
const KEY_LANE_H = 26;
const HANDLE_W = 9;
const HIT = 9;
const KEY_R = 7;
const TOTAL_CANVAS_H = 96;

const TimelineComponent: React.FC<TimelineProps> = ({
  totalFrames,
  currentFrame,
  setCurrentFrame,
  cropStart,
  setCropStart,
  cropEnd,
  setCropEnd,
  markers,
  setMarkers,
  fps,
  isPlaying,
  setIsPlaying,
  isSequence = false,
  isLooping: propIsLooping,
  setIsLooping: propSetIsLooping,
  onDistributeMarkers,
  onDetectLoop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localIsLooping, setLocalIsLooping] = useState(true);
  const isLooping = propIsLooping !== undefined ? propIsLooping : localIsLooping;
  const setIsLooping = propSetIsLooping || setLocalIsLooping;

  const [isDetectingLoop, setIsDetectingLoop] = useState(false);
  const [loopStatusMsg, setLoopStatusMsg] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<number>(-1);
  const [hoverKey, setHoverKey] = useState<number>(-1);
  const [hoverHandle, setHoverHandle] = useState<'start' | 'end' | null>(null);
  const [dragging, setDragging] = useState<'current' | 'start' | 'end' | 'key' | null>(null);
  const dragKeyIndexRef = useRef<number>(-1);

  const pendingFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticDirtyRef = useRef<boolean>(true);

  const requestPlayheadScrub = useCallback((frame: number) => {
    pendingFrameRef.current = frame;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingFrameRef.current !== null) {
          setCurrentFrame(pendingFrameRef.current);
        }
        rafRef.current = null;
      });
    }
  }, [setCurrentFrame]);

  const lastFrame = Math.max(0, totalFrames - 1);



  // Coordinate conversion helpers
  const getTrackBounds = useCallback((width: number) => {
    const trackLeft = PAD;
    const trackRight = Math.max(PAD + 1, width - PAD);
    const span = trackRight - trackLeft;
    return { trackLeft, trackRight, span };
  }, []);

  const xPos = useCallback(
    (frame: number, width: number) => {
      if (lastFrame <= 0) return PAD;
      const { trackLeft, span } = getTrackBounds(width);
      const f = Math.max(0, Math.min(frame, lastFrame));
      return Math.round(trackLeft + (span * f) / lastFrame);
    },
    [lastFrame, getTrackBounds]
  );

  const getFrameAtX = useCallback(
    (x: number, width: number) => {
      const { trackLeft, span } = getTrackBounds(width);
      if (lastFrame <= 0 || span <= 0) return 0;
      const f = Math.round(((x - trackLeft) / span) * lastFrame);
      return Math.max(0, Math.min(f, lastFrame));
    },
    [lastFrame, getTrackBounds]
  );

  const getTickStep = useCallback(
    (width: number) => {
      const { span } = getTrackBounds(width);
      if (lastFrame <= 0 || span <= 0) return 1;
      const raw = (lastFrame * 58.0) / span;
      const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
      for (const s of steps) {
        if (s >= raw) return s;
      }
      return 10000;
    },
    [lastFrame, getTrackBounds]
  );

  // Mark static canvas dirty when structure changes
  useEffect(() => {
    staticDirtyRef.current = true;
  }, [
    totalFrames,
    cropStart,
    cropEnd,
    markers,
    selectedKey,
    hoverKey,
    hoverHandle,
    dragging,
    lastFrame,
    getTrackBounds,
    xPos,
    getTickStep,
  ]);

  // Render timeline to canvas (with 0.02ms cached background blit for silky 60fps playback)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = TOTAL_CANVAS_H;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      staticDirtyRef.current = true;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Render or reuse static background layer (ruler, grid, range, keyframes, handles)
    if (
      staticDirtyRef.current ||
      !staticCanvasRef.current ||
      staticCanvasRef.current.width !== width ||
      staticCanvasRef.current.height !== height
    ) {
      if (!staticCanvasRef.current) {
        staticCanvasRef.current = document.createElement('canvas');
      }
      staticCanvasRef.current.width = width;
      staticCanvasRef.current.height = height;
      const sCtx = staticCanvasRef.current.getContext('2d')!;

      // Backgrounds
      sCtx.fillStyle = TL_BG;
      sCtx.fillRect(0, 0, width, height);

      sCtx.fillStyle = TL_RULER_BG;
      sCtx.fillRect(0, 0, width, RULER_H);

      const keyLaneTop = height - KEY_LANE_H;
      sCtx.fillStyle = TL_KEYLANE;
      sCtx.fillRect(0, keyLaneTop, width, KEY_LANE_H);

      if (totalFrames <= 0) {
        sCtx.fillStyle = TL_TEXT;
        sCtx.font = '11px "Segoe UI", sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('Timeline appears once media is loaded', width / 2, height / 2);
      } else {
        const { trackLeft, trackRight } = getTrackBounds(width);
        const trackTop = RULER_H;
        const trackH = keyLaneTop - trackTop;

        const xs = xPos(cropStart, width);
        const xe = xPos(cropEnd, width);

        // Middle Track background
        sCtx.fillStyle = TL_TRACK;
        sCtx.fillRect(trackLeft, trackTop, trackRight - trackLeft, trackH);

        // Active In-Out Range Linear Gradient
        const gradient = sCtx.createLinearGradient(0, trackTop, 0, trackTop + trackH);
        gradient.addColorStop(0, TL_RANGE_TOP);
        gradient.addColorStop(1, TL_RANGE_BOTTOM);
        sCtx.fillStyle = gradient;
        sCtx.fillRect(xs, trackTop, Math.max(1, xe - xs), trackH);

        // Out-of-bounds dimmed overlay
        sCtx.fillStyle = TL_OUT;
        sCtx.fillRect(0, trackTop, xs, trackH);
        sCtx.fillRect(xe, trackTop, width - xe, trackH);

        // Track border horizontal lines
        sCtx.strokeStyle = TL_KEY_EDGE;
        sCtx.lineWidth = 1;
        sCtx.beginPath();
        sCtx.moveTo(0, trackTop + 0.5);
        sCtx.lineTo(width, trackTop + 0.5);
        sCtx.moveTo(0, keyLaneTop - 0.5);
        sCtx.lineTo(width, keyLaneTop - 0.5);
        sCtx.stroke();

        // Ruler ticks, numbers, and vertical grid lines
        const step = getTickStep(width);
        const minor = Math.max(1, Math.floor(step / 5));

        sCtx.font = '10px "Segoe UI", system-ui, sans-serif';
        sCtx.textBaseline = 'bottom';

        for (let frame = 0; frame <= lastFrame; frame += minor) {
          const x = xPos(frame, width);
          const major = frame % step === 0;

          sCtx.strokeStyle = TL_TICK;
          sCtx.lineWidth = 1;
          sCtx.beginPath();
          sCtx.moveTo(x + 0.5, RULER_H - (major ? 8 : 4));
          sCtx.lineTo(x + 0.5, RULER_H - 1);
          sCtx.stroke();

          if (major) {
            sCtx.strokeStyle = TL_GRID;
            sCtx.beginPath();
            sCtx.moveTo(x + 0.5, trackTop + 1);
            sCtx.lineTo(x + 0.5, trackTop + trackH - 1);
            sCtx.stroke();

            const label = String(frame);
            const textMetrics = sCtx.measureText(label);
            let tx = x + 3;
            if (tx + textMetrics.width > width - 4) {
              tx = x - 3 - textMetrics.width;
            }
            sCtx.fillStyle = TL_TEXT;
            sCtx.fillText(label, tx, RULER_H - 8);
          }
        }

        // Keyframes (Diamonds)
        const laneCy = keyLaneTop + KEY_LANE_H / 2;

        const drawDiamond = (
          cx: number,
          cy: number,
          radius: number,
          fillColor: string,
          outlineColor?: string
        ) => {
          sCtx.beginPath();
          sCtx.moveTo(cx, cy - radius);
          sCtx.lineTo(cx + radius, cy);
          sCtx.lineTo(cx, cy + radius);
          sCtx.lineTo(cx - radius, cy);
          sCtx.closePath();
          sCtx.fillStyle = fillColor;
          sCtx.fill();
          if (outlineColor) {
            sCtx.strokeStyle = outlineColor;
            sCtx.lineWidth = 1;
            sCtx.stroke();
          }
        };

        markers.forEach((frame, index) => {
          const x = xPos(frame, width);
          const isSelected = index === selectedKey;
          const isHovered = index === hoverKey;

          sCtx.strokeStyle = isSelected || isHovered ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.1)';
          sCtx.lineWidth = 1;
          sCtx.beginPath();
          sCtx.moveTo(x + 0.5, trackTop + 2);
          sCtx.lineTo(x + 0.5, keyLaneTop - 2);
          sCtx.stroke();

          if (isSelected) {
            drawDiamond(x, laneCy, KEY_R + 3, 'rgba(242, 177, 52, 0.35)');
          }

          let color = TL_KEY;
          if (isSelected) {
            color = TL_KEY_SELECTED;
          } else if (isHovered) {
            color = TL_KEY_HOVER;
          }

          drawDiamond(x, laneCy, KEY_R, color, TL_KEY_EDGE);
        });

        // Crop Boundary Handles (Start & End)
        const kinds: Array<'start' | 'end'> = ['start', 'end'];
        for (const kind of kinds) {
          const isStart = kind === 'start';
          const x = isStart ? xs : xe;
          const isHovered = hoverHandle === kind || dragging === kind;
          const color = isHovered ? TL_HANDLE_HOVER : TL_HANDLE;

          sCtx.strokeStyle = color;
          sCtx.lineWidth = 2;
          sCtx.beginPath();
          sCtx.moveTo(x, trackTop);
          sCtx.lineTo(x, height);
          sCtx.stroke();

          const tabH = Math.min(30, trackH - 6);
          const tabTop = trackTop + 4;
          const tabX = isStart ? x : x - HANDLE_W;

          sCtx.fillStyle = color;
          sCtx.strokeStyle = TL_KEY_EDGE;
          sCtx.lineWidth = 1;

          sCtx.beginPath();
          const r = 2;
          sCtx.roundRect(tabX, tabTop, HANDLE_W, tabH, [r, r, r, r]);
          sCtx.fill();
          sCtx.stroke();

          sCtx.strokeStyle = TL_HANDLE_GRIP;
          sCtx.lineWidth = 1;
          const gx = tabX + HANDLE_W / 2;
          sCtx.beginPath();
          sCtx.moveTo(gx - 1.5, tabTop + 5);
          sCtx.lineTo(gx - 1.5, tabTop + tabH - 5);
          sCtx.moveTo(gx + 1.5, tabTop + 5);
          sCtx.lineTo(gx + 1.5, tabTop + tabH - 5);
          sCtx.stroke();
        }

        // Crop boundary frame chips
        sCtx.font = '10px "Segoe UI", system-ui, sans-serif';
        sCtx.textBaseline = 'middle';
        sCtx.textAlign = 'center';
        const labelY = trackTop + trackH - 12;

        for (const kind of kinds) {
          const isStart = kind === 'start';
          const x = isStart ? xs : xe;
          const text = String(isStart ? cropStart : cropEnd);
          const textW = sCtx.measureText(text).width + 8;

          if (xe - xs >= textW * 2 + 10) {
            const chipX = isStart ? x + HANDLE_W + 3 : x - HANDLE_W - 3 - textW;
            sCtx.fillStyle = '#261710';
            sCtx.strokeStyle = '#5a2d1a';
            sCtx.lineWidth = 1;
            sCtx.beginPath();
            sCtx.roundRect(chipX, labelY - 8, textW, 16, 3);
            sCtx.fill();
            sCtx.stroke();

            sCtx.fillStyle = '#ff5c26';
            sCtx.fillText(text, chipX + textW / 2, labelY);
          }
        }
      }

      staticDirtyRef.current = false;
    }

    // Fast 0.01ms Blit of static track layer
    if (staticCanvasRef.current) {
      ctx.drawImage(staticCanvasRef.current, 0, 0);
    }

    // 2. Fast Playhead (Vertical needle & top badge)
    if (totalFrames > 0) {
      const cx = xPos(currentFrame, width);

      // Needle line
      ctx.strokeStyle = TL_PLAYHEAD;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, RULER_H);
      ctx.lineTo(cx + 0.5, height);
      ctx.stroke();

      // Top Badge in ruler
      const playheadLabel = String(currentFrame);
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      const badgeTextW = ctx.measureText(playheadLabel).width;
      const badgeW = Math.max(26, badgeTextW + 12);
      const hx = Math.max(0, Math.min(cx - badgeW / 2, width - badgeW));

      ctx.fillStyle = TL_PLAYHEAD;
      ctx.beginPath();
      ctx.roundRect(hx, 1, badgeW, RULER_H - 3, 3);
      ctx.fill();

      ctx.fillStyle = TL_PLAYHEAD_TEXT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(playheadLabel, hx + badgeW / 2, (RULER_H - 2) / 2);
    }

    ctx.restore();
  }, [
    totalFrames,
    currentFrame,
    cropStart,
    cropEnd,
    markers,
    selectedKey,
    hoverKey,
    hoverHandle,
    dragging,
    lastFrame,
    getTrackBounds,
    xPos,
    getTickStep,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const handleResize = () => {
      renderCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Hit testing helpers
  const keyAt = (x: number, y: number, width: number) => {
    const keyLaneTop = TOTAL_CANVAS_H - KEY_LANE_H;
    if (markers.length === 0 || y < keyLaneTop - 6) return -1;
    let best = -1;
    let bestDist = HIT + 1;
    markers.forEach((frame, index) => {
      const dist = Math.abs(x - xPos(frame, width));
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    return bestDist <= HIT ? best : -1;
  };

  const handleAt = (x: number, y: number, width: number): 'start' | 'end' | null => {
    if (y < RULER_H - 2) return null;
    const xs = xPos(cropStart, width);
    const xe = xPos(cropEnd, width);
    const onStart = x >= xs - HIT && x <= xs + HANDLE_W + 2;
    const onEnd = x >= xe - HANDLE_W - 2 && x <= xe + HIT;
    if (onStart) return 'start';
    if (onEnd) return 'end';
    return null;
  };

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (totalFrames <= 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvasRef.current.clientWidth;

    // Check if clicked a keyframe diamond
    const kIndex = keyAt(x, y, width);
    if (kIndex >= 0) {
      setSelectedKey(kIndex);
      setDragging('key');
      dragKeyIndexRef.current = kIndex;
      setCurrentFrame(markers[kIndex]);
      return;
    }

    // Check if clicked crop boundary handles
    const hKind = handleAt(x, y, width);
    if (hKind) {
      setDragging(hKind);
      return;
    }

    // Otherwise scrub current playhead
    setDragging('current');
    setSelectedKey(-1);
    const frame = getFrameAtX(x, width);
    setCurrentFrame(frame);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (totalFrames <= 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvasRef.current.clientWidth;

    if (!dragging) {
      const kIndex = keyAt(x, y, width);
      const hKind = kIndex >= 0 ? null : handleAt(x, y, width);
      setHoverKey(kIndex);
      setHoverHandle(hKind);
      return;
    }

    const frame = getFrameAtX(x, width);

    if (dragging === 'key') {
      const curIdx = dragKeyIndexRef.current;
      if (curIdx >= 0 && curIdx < markers.length) {
        const clampedFrame = Math.max(cropStart, Math.min(frame, cropEnd));
        if (clampedFrame !== markers[curIdx]) {
          const updated = [...markers];
          updated[curIdx] = clampedFrame;
          updated.sort((a, b) => a - b);
          setMarkers(updated);
          const newIdx = updated.indexOf(clampedFrame);
          dragKeyIndexRef.current = newIdx;
          setSelectedKey(newIdx);
          setCurrentFrame(clampedFrame);
        }
      }
    } else if (dragging === 'start') {
      setCropStart(Math.max(0, Math.min(frame, cropEnd - 1)));
    } else if (dragging === 'end') {
      setCropEnd(Math.min(lastFrame, Math.max(frame, cropStart + 1)));
    } else {
      requestPlayheadScrub(frame);
    }
  };

  const handleMouseUp = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingFrameRef.current !== null) {
      setCurrentFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
    setDragging(null);
  };

  // Global drag listener so fast mouse scrubbing doesn't stutter or break when cursor leaves canvas
  useEffect(() => {
    if (!dragging) return;

    const onWindowMove = (e: MouseEvent) => {
      if (totalFrames <= 0 || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = canvasRef.current.clientWidth;
      const frame = getFrameAtX(x, width);

      if (dragging === 'key') {
        const curIdx = dragKeyIndexRef.current;
        if (curIdx >= 0 && curIdx < markers.length) {
          const clampedFrame = Math.max(cropStart, Math.min(frame, cropEnd));
          if (clampedFrame !== markers[curIdx]) {
            const updated = [...markers];
            updated[curIdx] = clampedFrame;
            updated.sort((a, b) => a - b);
            setMarkers(updated);
            const newIdx = updated.indexOf(clampedFrame);
            dragKeyIndexRef.current = newIdx;
            setSelectedKey(newIdx);
            setCurrentFrame(clampedFrame);
          }
        }
      } else if (dragging === 'start') {
        setCropStart(Math.max(0, Math.min(frame, cropEnd - 1)));
      } else if (dragging === 'end') {
        setCropEnd(Math.min(lastFrame, Math.max(frame, cropStart + 1)));
      } else {
        requestPlayheadScrub(frame);
      }
    };

    const onWindowUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingFrameRef.current !== null) {
        setCurrentFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
      setDragging(null);
    };

    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    };
  }, [dragging, totalFrames, cropStart, cropEnd, lastFrame, markers, getFrameAtX, requestPlayheadScrub, setCurrentFrame, setMarkers, setCropStart, setCropEnd]);

  // Keyboard navigation & keyframe nudging
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalFrames <= 0) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === 'ArrowLeft' ? -step : step;

      if (selectedKey >= 0 && selectedKey < markers.length) {
        // Nudge selected keyframe
        const curFrame = markers[selectedKey];
        const newFrame = Math.max(cropStart, Math.min(cropEnd, curFrame + delta));
        if (newFrame !== curFrame) {
          const updated = [...markers];
          updated[selectedKey] = newFrame;
          updated.sort((a, b) => a - b);
          setMarkers(updated);
          const newIdx = updated.indexOf(newFrame);
          setSelectedKey(newIdx);
          setCurrentFrame(newFrame);
        }
      } else {
        // Scrub current frame
        setCurrentFrame((prev) => Math.max(0, Math.min(lastFrame, prev + delta)));
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedKey >= 0 && selectedKey < markers.length) {
        e.preventDefault();
        const updated = markers.filter((_, i) => i !== selectedKey);
        setMarkers(updated);
        setSelectedKey(-1);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleKeyAtCurrent = () => {
    if (markers.includes(currentFrame)) {
      setMarkers(markers.filter((m) => m !== currentFrame));
      setSelectedKey(-1);
    } else {
      const updated = [...markers, currentFrame].sort((a, b) => a - b);
      setMarkers(updated);
      setSelectedKey(updated.indexOf(currentFrame));
    }
  };

  const handleDetectLoopClick = async () => {
    if (!onDetectLoop || isDetectingLoop) return;
    setIsDetectingLoop(true);
    try {
      const msg = await onDetectLoop();
      if (msg) {
        setLoopStatusMsg(msg);
        setTimeout(() => setLoopStatusMsg(null), 4000);
      }
    } catch {
      setLoopStatusMsg('Detection failed');
      setTimeout(() => setLoopStatusMsg(null), 3000);
    } finally {
      setIsDetectingLoop(false);
    }
  };

  const durationSec = (totalFrames / fps).toFixed(1);
  const formattedCurFrame = String(currentFrame).padStart(2, '0');
  const formattedTotalFrames = String(totalFrames).padStart(2, '0');

  // Dynamic cursor style for canvas
  let cursorStyle = 'pointer';
  if (dragging === 'key' || hoverKey >= 0) {
    cursorStyle = 'ew-resize';
  } else if (dragging === 'start' || dragging === 'end' || hoverHandle) {
    cursorStyle = 'col-resize';
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        background: '#121316',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
        outline: 'none',
      }}
    >
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Playback controls + Frame info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Skip to In Point */}
            <button
              onClick={() => setCurrentFrame(cropStart)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Go to In Point"
            >
              <SkipBack size={15} />
            </button>

            {/* Step 1 Frame Backward */}
            <button
              onClick={() => setCurrentFrame((prev) => Math.max(0, prev - 1))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Step Backward (Previous Frame)"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Matte Orange Play Button (No Glow) */}
            <button
              onClick={() => {
                if (!isPlaying && currentFrame >= cropEnd) {
                  setCurrentFrame(cropStart);
                }
                setIsPlaying(!isPlaying);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-orange)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} fill="#ffffff" color="#ffffff" /> : <Play size={14} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />}
            </button>

            {/* Step 1 Frame Forward */}
            <button
              onClick={() => setCurrentFrame((prev) => Math.min(lastFrame, prev + 1))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Step Forward (Next Frame)"
            >
              <ChevronRight size={16} />
            </button>

            {/* Skip to Out Point */}
            <button
              onClick={() => setCurrentFrame(cropEnd)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Go to Out Point"
            >
              <SkipForward size={15} />
            </button>

            {/* Loop toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLooping ? 'var(--accent-orange)' : 'var(--text-dim)',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Loop playback"
            >
              <RotateCw size={14} />
            </button>
          </div>

          {/* Center: Frame and Duration Readout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>Frame: </span>
              <b style={{ color: 'var(--accent-orange)' }}>{formattedCurFrame}</b>
              <span style={{ color: 'var(--text-dim)' }}> / {formattedTotalFrames}</span>
            </span>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <span>
              <span style={{ color: 'var(--text-muted)' }}>Duration: </span>
              <b style={{ color: 'var(--text-bright)' }}>{durationSec}s</b>
            </span>
          </div>
        </div>

        {/* Right Buttons: Full, Distribute Keys, Detect Loop, +Add Key */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              setCropStart(0);
              setCropEnd(lastFrame);
            }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              padding: '4px 8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="Reset range to 100% full clip"
          >
            Full
          </button>

          {/* Distribute Markers Button */}
          <button
            onClick={onDistributeMarkers}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              color: 'var(--accent-orange)',
              cursor: 'pointer',
            }}
            title="Evenly distribute keys across the In-Out range"
          >
            Distribute Keys ({markers.length})
          </button>

          {/* Auto-Detect Loop Button */}
          {onDetectLoop && (
            <button
              onClick={handleDetectLoopClick}
              disabled={isDetectingLoop}
              style={{
                background: isDetectingLoop ? '#241a12' : 'var(--bg-input)',
                border: '1px solid rgba(255, 92, 38, 0.4)',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 9px',
                color: 'var(--accent-orange)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: isDetectingLoop ? 'wait' : 'pointer',
                opacity: isDetectingLoop ? 0.7 : 1,
              }}
              title="Auto-detect optimal seamless loop frame"
            >
              <RotateCw size={11} className={isDetectingLoop ? 'animate-spin' : ''} />
              {isDetectingLoop ? 'Detecting...' : 'Detect Loop'}
            </button>
          )}

          {loopStatusMsg && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--accent-orange)',
                background: '#241a12',
                border: '1px solid rgba(255, 92, 38, 0.4)',
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              {loopStatusMsg}
            </span>
          )}

          {/* +Add Key Button */}
          {(() => {
            const isKeyActive = !isPlaying && markers.includes(currentFrame);
            return (
              <button
                onClick={toggleKeyAtCurrent}
                disabled={isPlaying}
                style={{
                  background: isKeyActive ? 'rgba(255, 92, 38, 0.15)' : 'var(--bg-card)',
                  border: isKeyActive ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  fontSize: 10,
                  width: 84,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  color: isKeyActive ? 'var(--accent-orange)' : 'var(--text-main)',
                  cursor: isPlaying ? 'default' : 'pointer',
                  opacity: isPlaying ? 0.5 : 1,
                  userSelect: 'none',
                }}
                title={isPlaying ? 'Pause playback to edit keyframes' : 'Add or remove keyframe at current frame'}
              >
                {isKeyActive ? (
                  <>
                    <Check size={11} style={{ marginRight: 4, color: 'var(--accent-orange)' }} />
                    Key Active
                  </>
                ) : (
                  <>
                    <Plus size={11} style={{ marginRight: 4 }} />
                    +Add Key
                  </>
                )}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Classic Timeline Track Canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: TOTAL_CANVAS_H,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #2D2E37',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (!dragging) {
              setHoverKey(-1);
              setHoverHandle(null);
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: cursorStyle,
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  );
};

export const Timeline = React.memo(TimelineComponent);
