import React, { useState } from 'react';
import { X, Copy, Check, Code2 } from 'lucide-react';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  animName: string;
  filename: string;
  isAdvancedPack?: boolean;
}

type EngineTab = 'pixi' | 'phaser' | 'godot' | 'spine';

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  isOpen,
  onClose,
  animName,
  filename,
  isAdvancedPack = true,
}) => {
  const [activeTab, setActiveTab] = useState<EngineTab>('pixi');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const baseName = (filename || 'character_anim').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'character';
  const cleanAnim = (animName || 'attack').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'attack';

  const snippets: Record<EngineTab, { title: string; language: string; code: string; notes: string }> = {
    pixi: {
      title: 'Pixi.js v7 / v8 (iGaming & WebGL Standard)',
      language: 'javascript',
      code: `// 1. Load the generated spritesheet JSON in Pixi.js
import * as PIXI from 'pixi.js';

async function initCharacter() {
  const app = new PIXI.Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x17181c });
  document.body.appendChild(app.canvas);

  // Load Spritesheet (reads ${baseName}.json & ${baseName}.png)
  const sheet = await PIXI.Assets.load('./${baseName}.json');

  // Create AnimatedSprite from animation frames
  const anim = new PIXI.AnimatedSprite(sheet.animations['${cleanAnim}'] || Object.values(sheet.animations)[0]);
  
  anim.animationSpeed = 0.25; // Adjust playback speed
  anim.loop = true;
  anim.anchor.set(0.5, 0.95); // Align pivot to feet
  anim.position.set(400, 450);
  
  anim.play();
  app.stage.addChild(anim);
}`,
      notes: 'Pixi.js automatically applies trimmed whitespace offsets from our JSON for 100% smooth animation.',
    },
    phaser: {
      title: 'Phaser 3 (HTML5 Casino & Action Games)',
      language: 'javascript',
      code: `// Inside your Phaser.Scene
class GameScene extends Phaser.Scene {
  preload() {
    // Load the atlas texture and Aseprite/TexturePacker JSON
    this.load.atlas('${baseName}', '${baseName}.png', '${baseName}.json');
  }

  create() {
    // Generate animation from atlas frame names
    this.anims.create({
      key: '${cleanAnim}',
      frames: this.anims.generateFrameNames('${baseName}', {
        prefix: '${cleanAnim}_',
        start: 0,
        end: 15, // Number of keyframes
        zeroPad: 0,
      }),
      frameRate: 16,
      repeat: -1, // Infinite loop
    });

    const sprite = this.add.sprite(400, 300, '${baseName}');
    sprite.setOrigin(0.5, 0.95); // Pivot at feet
    sprite.play('${cleanAnim}');
  }
}`,
      notes: 'Supports tight trimmed bounding boxes without sprite jittering.',
    },
    godot: {
      title: 'Godot 4 (GDScript & AnimatedSprite2D)',
      language: 'gdscript',
      code: `# Godot 4 Character Script (extends CharacterBody2D or Node2D)
extends CharacterBody2D

@onready var anim_sprite: AnimatedSprite2D = $AnimatedSprite2D

func _ready() -> void:
    # 1. Load the pre-generated SpriteFrames resource
    var frames_res: SpriteFrames = load("res://${baseName}.tres")
    anim_sprite.sprite_frames = frames_res
    
    # 2. Play the animation
    anim_sprite.play("${cleanAnim}")

# Or spawn dynamically:
static func spawn_character() -> AnimatedSprite2D:
    var spr := AnimatedSprite2D.new()
    spr.sprite_frames = load("res://${baseName}.tres")
    spr.play("${cleanAnim}")
    return spr`,
      notes: 'The exported .tscn already includes CharacterBody2D, CollisionShape2D (feet), and Hitboxes.',
    },
    spine: {
      title: 'Spine / libGDX (.atlas format for C++, WebGL, Unity, Defold)',
      language: 'text',
      code: `// The file ${baseName}.atlas matches the official Spine / libGDX specification:
//
// ${baseName}.png
// size: 2048,2048
// format: RGBA8888
// filter: Linear,Linear
// repeat: none
// ${cleanAnim}_0
//   rotate: false
//   xy: 4, 4
//   size: 210, 340
//   orig: 512, 512
//   offset: 150, 86
//   index: -1

// In Unity (with Spine-Unity runtime or TexturePacker loader):
// Drop ${baseName}.png and ${baseName}.atlas into Assets/
// Unity automatically parses the trimmed regions and offsets.`,
      notes: 'Universal text format recognized by libGDX, Spine-Unity, Defold, Raylib, and custom C++ game engines.',
    },
  };

  const current = snippets[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#17181c',
          border: '1px solid #2D2E37',
          borderRadius: 10,
          boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: '#121316',
            borderBottom: '1px solid #2D2E37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code2 size={16} color="#FF551F" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              Engine Integration Code Snippets
            </span>
            {isAdvancedPack && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#FF551F',
                  background: '#2B2D37',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 85, 31, 0.3)',
                }}
              >
                Advanced Pack
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Engine Tabs */}
        <div
          style={{
            display: 'flex',
            background: '#121316',
            padding: '4px 12px 0',
            gap: 6,
            borderBottom: '1px solid #2D2E37',
          }}
        >
          {(
            [
              { id: 'pixi', label: 'Pixi.js (iGaming)' },
              { id: 'phaser', label: 'Phaser 3' },
              { id: 'godot', label: 'Godot 4' },
              { id: 'spine', label: 'Spine / libGDX' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCopied(false);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '6px 6px 0 0',
                  background: isActive ? '#17181c' : 'transparent',
                  border: isActive ? '1px solid #2D2E37' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid #17181c' : '1px solid transparent',
                  color: isActive ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {current.title}
            </span>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: copied ? '#1e3828' : '#2B2D37',
                border: copied ? '1px solid #00f084' : '1px solid #2D2E37',
                color: copied ? '#00f084' : '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code display */}
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: '#0e0f12',
              border: '1px solid #2D2E37',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              color: '#d8dce2',
              maxHeight: 280,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.45,
            }}
          >
            {current.code}
          </pre>

          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
            💡 {current.notes}
          </div>
        </div>
      </div>
    </div>
  );
};
