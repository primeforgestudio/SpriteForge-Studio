import React from 'react';
import { AppMode } from '../core/types';
import { RefreshCw, Download, FileText, Film } from 'lucide-react';

interface AtlasPreviewProps {
  mode: AppMode;
  atlasCanvas: HTMLCanvasElement | null;
  spritesCanvases: HTMLCanvasElement[];
  exportFilename: string;
  setExportFilename: (name: string) => void;
  onExport: () => void;
  isExporting: boolean;
  hasMedia: boolean;
  // Normal Map & GIF
  generateNormalMap?: boolean;
  setGenerateNormalMap?: (val: boolean) => void;
  onExportGif?: () => void;
  isExportingGif?: boolean;
  // Master Atlas
  exportScope?: 'single' | 'master';
  masterTracksCount?: number;
}

export const AtlasPreview: React.FC<AtlasPreviewProps> = ({
  mode,
  atlasCanvas,
  spritesCanvases,
  exportFilename,
  setExportFilename,
  onExport,
  isExporting,
  hasMedia,
  generateNormalMap = false,
  setGenerateNormalMap,
  onExportGif,
  isExportingGif = false,
  exportScope = 'single',
  masterTracksCount = 1,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {/* Section Header with Dimension Readout */}
      <div className="sidebar-section-title">
        <span>{mode === 'atlas' ? 'Atlas Preview' : 'Sprites Preview'}</span>
        {mode === 'atlas' && atlasCanvas && (
          <span style={{ fontSize: 11, color: 'var(--accent-orange)', fontWeight: 700, fontFamily: 'monospace' }}>
            {atlasCanvas.width} × {atlasCanvas.height}
          </span>
        )}
      </div>

      {/* Checkerboard Preview Box (taller, comfortable) */}
      <div
        className="checkerboard"
        style={{
          width: '100%',
          height: 160,
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
        }}
      >
        {mode === 'atlas' ? (
          atlasCanvas ? (
            <img
              src={atlasCanvas.toDataURL()}
              alt="Atlas Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
              }}
            />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No atlas generated</span>
          )
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
              gap: 6,
              width: '100%',
              height: '100%',
              overflowY: 'auto',
            }}
          >
            {spritesCanvases.map((c, i) => (
              <img
                key={i}
                src={c.toDataURL()}
                alt={`Sprite ${i}`}
                style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', background: '#0a0e0d', borderRadius: 4 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Export File Name Field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Export File Name</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            {mode === 'atlas' ? '.png / .json / .tres' : '.zip'}
          </span>
        </div>
        <div
          style={{
            height: 34,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 10px',
            gap: 6,
          }}
        >
          <FileText size={13} color="var(--accent-green)" />
          <input
            type="text"
            value={exportFilename}
            onChange={(e) => setExportFilename(e.target.value)}
            placeholder="character_animation"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-bright)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Generate Normal Map Checkbox */}
      {mode === 'atlas' && setGenerateNormalMap && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: generateNormalMap ? 'var(--accent-cyan)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={generateNormalMap}
            onChange={(e) => setGenerateNormalMap(e.target.checked)}
            style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          />
          <span>Generate Normal Map (_normal.png)</span>
        </label>
      )}

      {/* Master Atlas Scope Banner */}
      {mode === 'atlas' && exportScope === 'master' && (
        <div
          style={{
            padding: '6px 10px',
            background: '#241a0d',
            border: '1px solid #754128',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--accent-orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>★ Master Atlas Set</span>
          <span style={{ fontWeight: 700 }}>{masterTracksCount} Animations</span>
        </div>
      )}

      {/* Bottom Glowing Green Convert & Export Button (Taller and bold) */}
      <button
        onClick={onExport}
        disabled={!hasMedia || isExporting}
        className="btn-mint"
        style={{
          width: '100%',
          height: 44,
          fontSize: 13,
          fontWeight: 700,
          marginTop: 4,
          borderRadius: 7,
          letterSpacing: '0.3px',
          background: exportScope === 'master' ? 'var(--accent-orange)' : undefined,
          borderColor: exportScope === 'master' ? 'var(--accent-orange)' : undefined,
          boxShadow: exportScope === 'master' ? '0 0 16px rgba(255, 122, 69, 0.4)' : undefined,
        }}
      >
        {isExporting ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
        {isExporting
          ? 'Exporting...'
          : exportScope === 'master'
          ? `Export Master Atlas (${masterTracksCount} Anims)`
          : 'Convert & Export'}
      </button>

      {/* Export Animated GIF Button */}
      {mode === 'atlas' && onExportGif && (
        <button
          onClick={onExportGif}
          disabled={!hasMedia || isExportingGif}
          style={{
            width: '100%',
            height: 34,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            background: '#122533',
            border: '1px solid #1e608a',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: !hasMedia || isExportingGif ? 'not-allowed' : 'pointer',
            opacity: !hasMedia ? 0.5 : 1,
            marginTop: 2,
          }}
          title="Export transparent animated GIF for Discord, social media, and web previews"
        >
          {isExportingGif ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Film size={13} />
          )}
          {isExportingGif ? 'Encoding GIF...' : 'Export Animated GIF'}
        </button>
      )}
    </div>
  );
};
