import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCw, Plus, Check } from 'lucide-react';

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
  onDistributeMarkers: () => void;
  onDetectLoop?: () => Promise<string | null>;
}

// Exact Palette from classic AtlasConverter Qt painter
const TL_BG = '#333333';
const TL_RULER_BG = '#2c2c2c';
const TL_TRACK = '#242424';
const TL_RANGE_TOP = '#4a5460';
const TL_RANGE_BOTTOM = '#3a424c';
const TL_OUT = '#1c1c1c';
const TL_KEYLANE = '#2a2a2a';
const TL_GRID = '#3f3f3f';
const TL_TICK = '#606060';
const TL_TEXT = '#a8a8a8';
const TL_HANDLE = '#8fb8de';
const TL_HANDLE_HOVER = '#cbe2f7';
const TL_HANDLE_GRIP = '#1d2a36';
const TL_KEY = '#c9d2da';
const TL_KEY_HOVER = '#ffffff';
const TL_KEY_SELECTED = '#f2b134';
const TL_KEY_EDGE = '#161616';
const TL_PLAYHEAD = '#e2574c';
const TL_PLAYHEAD_TEXT = '#ffffff';

// Exact Geometry Constants
const PAD = 16;
const RULER_H = 22;
const KEY_LANE_H = 26;
const HANDLE_W = 9;
const HIT = 9;
const KEY_R = 7;
const TOTAL_CANVAS_H = 96;

export const Timeline: React.FC<TimelineProps> = ({
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
  onDistributeMarkers,
  onDetectLoop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLooping, setIsLooping] = useState(true);
  const [isDetectingLoop, setIsDetectingLoop] = useState(false);
  const [loopStatusMsg, setLoopStatusMsg] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<number>(-1);
  const [hoverKey, setHoverKey] = useState<number>(-1);
  const [hoverHandle, setHoverHandle] = useState<'start' | 'end' | null>(null);
  const [dragging, setDragging] = useState<'current' | 'start' | 'end' | 'key' | null>(null);
  const dragKeyIndexRef = useRef<number>(-1);

  const lastFrame = Math.max(0, totalFrames - 1);

  // Smooth Playback Loop
  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) return;

    let animId: number;
    let lastTime = performance.now();
    const frameDuration = 1000 / fps;

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      if (elapsed >= frameDuration) {
        const framesToAdvance = Math.floor(elapsed / frameDuration);
        lastTime = now - (elapsed % frameDuration);

        setCurrentFrame((prev) => {
          let next = prev + framesToAdvance;
          if (next > cropEnd) {
            if (isLooping) {
              next = cropStart;
            } else {
              setIsPlaying(false);
              return cropEnd;
            }
          }
          return next;
        });
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, fps, totalFrames, cropStart, cropEnd, isLooping, setCurrentFrame, setIsPlaying]);

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

  // Render timeline to canvas
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
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = TL_BG;
    ctx.fillRect(0, 0, width, height);

    // 2. Top ruler background
    ctx.fillStyle = TL_RULER_BG;
    ctx.fillRect(0, 0, width, RULER_H);

    // 3. Bottom keyframe lane background
    const keyLaneTop = height - KEY_LANE_H;
    ctx.fillStyle = TL_KEYLANE;
    ctx.fillRect(0, keyLaneTop, width, KEY_LANE_H);

    if (totalFrames <= 0) {
      ctx.fillStyle = TL_TEXT;
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Timeline appears once media is loaded', width / 2, height / 2);
      ctx.restore();
      return;
    }

    const { trackLeft, trackRight } = getTrackBounds(width);
    const trackTop = RULER_H;
    const trackH = keyLaneTop - trackTop;

    const xs = xPos(cropStart, width);
    const xe = xPos(cropEnd, width);

    // 4. Middle Track background
    ctx.fillStyle = TL_TRACK;
    ctx.fillRect(trackLeft, trackTop, trackRight - trackLeft, trackH);

    // 5. Active In-Out Range Linear Gradient
    const gradient = ctx.createLinearGradient(0, trackTop, 0, trackTop + trackH);
    gradient.addColorStop(0, TL_RANGE_TOP);
    gradient.addColorStop(1, TL_RANGE_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(xs, trackTop, Math.max(1, xe - xs), trackH);

    // 6. Out-of-bounds dimmed overlay
    ctx.fillStyle = TL_OUT;
    ctx.fillRect(0, trackTop, xs, trackH);
    ctx.fillRect(xe, trackTop, width - xe, trackH);

    // 7. Track border horizontal lines
    ctx.strokeStyle = TL_KEY_EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, trackTop + 0.5);
    ctx.lineTo(width, trackTop + 0.5);
    ctx.moveTo(0, keyLaneTop - 0.5);
    ctx.lineTo(width, keyLaneTop - 0.5);
    ctx.stroke();

    // 8. Ruler ticks, numbers, and vertical grid lines
    const step = getTickStep(width);
    const minor = Math.max(1, Math.floor(step / 5));

    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'bottom';

    for (let frame = 0; frame <= lastFrame; frame += minor) {
      const x = xPos(frame, width);
      const major = frame % step === 0;

      // Tick line in ruler
      ctx.strokeStyle = TL_TICK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, RULER_H - (major ? 8 : 4));
      ctx.lineTo(x + 0.5, RULER_H - 1);
      ctx.stroke();

      if (major) {
        // Vertical grid line through track
        ctx.strokeStyle = TL_GRID;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, trackTop + 1);
        ctx.lineTo(x + 0.5, trackTop + trackH - 1);
        ctx.stroke();

        // Label number in ruler
        const label = String(frame);
        const textMetrics = ctx.measureText(label);
        let tx = x + 3;
        if (tx + textMetrics.width > width - 4) {
          tx = x - 3 - textMetrics.width;
        }
        ctx.fillStyle = TL_TEXT;
        ctx.fillText(label, tx, RULER_H - 8);
      }
    }

    // 9. Keyframes (Diamonds)
    const laneCy = keyLaneTop + KEY_LANE_H / 2;

    const drawDiamond = (
      cx: number,
      cy: number,
      radius: number,
      fillColor: string,
      outlineColor?: string
    ) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx + radius, cy);
      ctx.lineTo(cx, cy + radius);
      ctx.lineTo(cx - radius, cy);
      ctx.closePath();

      ctx.fillStyle = fillColor;
      ctx.fill();

      if (outlineColor) {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    markers.forEach((frame, index) => {
      const x = xPos(frame, width);
      const isSelected = index === selectedKey;
      const isHovered = index === hoverKey;

      // Vertical guide line from diamond up through the track
      ctx.strokeStyle = isSelected || isHovered ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, trackTop + 2);
      ctx.lineTo(x + 0.5, keyLaneTop - 2);
      ctx.stroke();

      // Halo for selected keyframe
      if (isSelected) {
        drawDiamond(x, laneCy, KEY_R + 3, 'rgba(242, 177, 52, 0.35)');
      }

      // Diamond fill color
      let color = TL_KEY;
      if (isSelected) {
        color = TL_KEY_SELECTED;
      } else if (isHovered) {
        color = TL_KEY_HOVER;
      }

      drawDiamond(x, laneCy, KEY_R, color, TL_KEY_EDGE);
    });

    // 10. Crop Boundary Handles (Start & End)
    const kinds: Array<'start' | 'end'> = ['start', 'end'];
    for (const kind of kinds) {
      const isStart = kind === 'start';
      const x = isStart ? xs : xe;
      const isHovered = hoverHandle === kind || dragging === kind;
      const color = isHovered ? TL_HANDLE_HOVER : TL_HANDLE;

      // Vertical span line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, trackTop);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Tab rounded rectangle
      const tabH = Math.min(30, trackH - 6);
      const tabTop = trackTop + 4;
      const tabX = isStart ? x : x - HANDLE_W;

      ctx.fillStyle = color;
      ctx.strokeStyle = TL_KEY_EDGE;
      ctx.lineWidth = 1;

      // Rounded rect tab
      ctx.beginPath();
      const r = 2;
      ctx.roundRect(tabX, tabTop, HANDLE_W, tabH, [r, r, r, r]);
      ctx.fill();
      ctx.stroke();

      // Grip lines inside tab
      ctx.strokeStyle = TL_HANDLE_GRIP;
      ctx.lineWidth = 1;
      const gx = tabX + HANDLE_W / 2;
      ctx.beginPath();
      ctx.moveTo(gx - 1.5, tabTop + 5);
      ctx.lineTo(gx - 1.5, tabTop + tabH - 5);
      ctx.moveTo(gx + 1.5, tabTop + 5);
      ctx.lineTo(gx + 1.5, tabTop + tabH - 5);
      ctx.stroke();
    }

    // Crop boundary frame chips
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const labelY = trackTop + trackH - 12;

    for (const kind of kinds) {
      const isStart = kind === 'start';
      const x = isStart ? xs : xe;
      const text = String(isStart ? cropStart : cropEnd);
      const textW = ctx.measureText(text).width + 8;

      if (xe - xs >= textW * 2 + 10) {
        const chipX = isStart ? x + HANDLE_W + 3 : x - HANDLE_W - 3 - textW;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(chipX, labelY - 8, textW, 16, 3);
        ctx.fill();

        ctx.fillStyle = TL_HANDLE_HOVER;
        ctx.fillText(text, chipX + textW / 2, labelY);
      }
    }

    // 11. Playhead (Vertical needle & top badge)
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
      setCurrentFrame(frame);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

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
        background: '#141a17',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Skip Back */}
            <button
              onClick={() => setCurrentFrame(cropStart)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
              title="Go to In Point"
            >
              <SkipBack size={15} />
            </button>

            {/* Neon Mint Green Play Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)',
                color: '#000000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px var(--accent-green-glow)',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} fill="#000" /> : <Play size={14} fill="#000" style={{ marginLeft: 2 }} />}
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => setCurrentFrame(cropEnd)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
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
                color: isLooping ? 'var(--accent-green)' : 'var(--text-dim)',
                padding: '4px',
                cursor: 'pointer',
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
              <b style={{ color: 'var(--accent-green)' }}>{formattedCurFrame}</b>
              <span style={{ color: 'var(--text-dim)' }}> / {formattedTotalFrames}</span>
            </span>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <span>
              <span style={{ color: 'var(--text-muted)' }}>Duration: </span>
              <b style={{ color: 'var(--text-bright)' }}>{durationSec}s</b>
            </span>
          </div>
        </div>

        {/* Right Buttons: Set In [4], Set Out [12], Full, Distribute Keys, Detect Loop, +Add Key */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCropStart(currentFrame)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              padding: '4px 8px',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
            title="Set In Marker"
          >
            Set In [{cropStart}]
          </button>

          <button
            onClick={() => setCropEnd(currentFrame)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              padding: '4px 8px',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
            title="Set Out Marker"
          >
            Set Out [{cropEnd}]
          </button>

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
              padding: '4px 8px',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
            title="Reset range to full duration"
          >
            Full
          </button>

          {/* Distribute Keys Button */}
          <button
            onClick={onDistributeMarkers}
            style={{
              background: '#0d241a',
              border: '1px solid #1c4535',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              color: 'var(--accent-green)',
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
                background: isDetectingLoop ? '#0a1a13' : '#0d241a',
                border: '1px solid var(--accent-green)',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 9px',
                color: 'var(--accent-green)',
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
                color: 'var(--accent-green)',
                background: '#0b1f16',
                border: '1px solid #1a4d35',
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
                  background: isKeyActive ? '#0e2b1e' : 'var(--bg-card)',
                  border: isKeyActive ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  fontSize: 10,
                  width: 84,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  color: isKeyActive ? 'var(--accent-green)' : 'var(--text-main)',
                  cursor: isPlaying ? 'default' : 'pointer',
                  opacity: isPlaying ? 0.5 : 1,
                  userSelect: 'none',
                }}
                title={isPlaying ? 'Pause playback to edit keyframes' : 'Add or remove keyframe at current frame'}
              >
                {isKeyActive ? (
                  <>
                    <Check size={11} style={{ marginRight: 4, color: 'var(--accent-green)' }} />
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
          border: '1px solid #222b26',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setHoverKey(-1);
            setHoverHandle(null);
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
