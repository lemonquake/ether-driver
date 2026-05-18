import * as THREE from 'three';
import { createVehicleUpgrades, getVehicleStats, vehicleCatalog } from '../data/vehicleCatalog.js';
import { buildGarageVehicleDefinition, sanitizeGarageBlueprint } from '../data/vehicleParts.js';

function makeCanvasTexture(size, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function cssColor(value) {
  return typeof value === 'number' ? `#${value.toString(16).padStart(6, '0')}` : value;
}

const globalTextureLoader = new THREE.TextureLoader();
const textureCache = {};
const customTextureCache = new Map();

function loadPaintTexture(textureId, repeatX = 2, repeatY = 2) {
  if (!textureId) return null;
  const cacheKey = `${textureId}_${repeatX}_${repeatY}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const mapName = {
    'carbon': 'carbon.png',
    'rust': 'rust.png',
    'digital': 'digital_camo.png',
    'hazard': 'hazard.png',
    'oil': 'oil_slick.png',
    'camo': 'desert_camo.png',
    'graffiti': 'graffiti.png',
    'flake': 'metal_flake.png',
    'matte': 'matte_metal.png',
    'circuit': 'circuit.png',
    'tiger': 'tiger.png',
    'interceptor': 'interceptor.png',
    'lava': 'lava.png',
    'pearl': 'pearl.png',
    'panel': 'mecha_panels.png',
    'hex-camo': 'hex_camo.png',
    'dust': 'moon_dust.png',
    'shark': 'shark_art.png',
    'grid': 'synth_grid.png',
    'scar': 'scratched_primer.png'
  };

  const filename = mapName[textureId] || 'carbon.png';
  const texture = globalTextureLoader.load(`/textures/${filename}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  
  textureCache[cacheKey] = texture;
  return texture;
}

function loadCustomPaintTexture(dataUrl, repeatX = 2, repeatY = 2) {
  if (!dataUrl) return null;
  const cacheKey = `${dataUrl.slice(0, 96)}_${dataUrl.length}_${repeatX}_${repeatY}`;
  if (customTextureCache.has(cacheKey)) return customTextureCache.get(cacheKey);
  const texture = globalTextureLoader.load(dataUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  customTextureCache.set(cacheKey, texture);
  return texture;
}

function paintTextureForDefinition(def) {
  if (def.appearance?.customTextureData) return loadCustomPaintTexture(def.appearance.customTextureData, 2, 2);
  if (def.appearance?.materialStyle === 'carbon') return loadPaintTexture('carbon', 3, 3);
  return loadPaintTexture(def.paintJob?.texture, 2, 2);
}

function partTextureForDefinition(def, key, repeatX = 2, repeatY = 2) {
  const paint = def.appearance?.[key];
  if (paint?.customTextureData) return loadCustomPaintTexture(paint.customTextureData, repeatX, repeatY);
  if (paint?.textureId) return loadPaintTexture(paint.textureId, repeatX, repeatY);
  return null;
}

function colorWithIntensity(color, intensity = 1) {
  return new THREE.Color(color).multiplyScalar(Math.max(0, intensity));
}

function tintColorForTexture(color, tint = 1) {
  const base = new THREE.Color(color);
  return new THREE.Color(1, 1, 1).lerp(base, THREE.MathUtils.clamp(tint, 0, 1));
}

function panelTexture(color = '#101820', trim = '#d9f7ff', textureStyle = 'panel') {
  return makeCanvasTexture(256, (ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);

    const scratch = (count, alpha = 0.16) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 6 + Math.random() * 46, y + (Math.random() - 0.5) * 16);
        ctx.stroke();
      }
    };

    const noise = (count, alpha = 0.11) => {
      for (let i = 0; i < count; i += 1) {
        const shade = 24 + Math.random() * 90;
        ctx.fillStyle = `rgba(${shade}, ${shade + 10}, ${shade + 18}, ${alpha})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 7, 1 + Math.random() * 2);
      }
    };

    noise(280);

    if (textureStyle === 'carbon') {
      for (let y = 0; y < size; y += 12) {
        for (let x = 0; x < size; x += 12) {
          ctx.fillStyle = (x + y) % 24 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.28)';
          ctx.fillRect(x, y, 12, 6);
          ctx.fillRect(x + 6, y + 6, 6, 6);
        }
      }
    } else if (['digital', 'camo', 'hex-camo'].includes(textureStyle)) {
      const blocks = textureStyle === 'digital' ? [trim, '#7df9ff', '#6e8792'] : textureStyle === 'hex-camo' ? ['#1d4a2d', '#7ea35b', trim] : ['#6f5830', '#c59b5f', '#3f3a25'];
      for (let i = 0; i < 90; i += 1) {
        ctx.fillStyle = blocks[i % blocks.length];
        const unit = textureStyle === 'hex-camo' ? 18 : 10 + Math.random() * 24;
        ctx.globalAlpha = 0.18 + Math.random() * 0.24;
        ctx.fillRect(Math.random() * size, Math.random() * size, unit, unit * (0.6 + Math.random()));
      }
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'hazard') {
      ctx.fillStyle = trim;
      ctx.globalAlpha = 0.68;
      for (let x = -size; x < size * 2; x += 38) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 18, 0);
        ctx.lineTo(x - 62, size);
        ctx.lineTo(x - 80, size);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'oil' || textureStyle === 'pearl') {
      const gradient = ctx.createRadialGradient(size * 0.45, size * 0.42, 8, size * 0.5, size * 0.5, size * 0.72);
      gradient.addColorStop(0, textureStyle === 'pearl' ? 'rgba(255,255,255,0.55)' : 'rgba(125,249,255,0.55)');
      gradient.addColorStop(0.45, 'rgba(185,145,255,0.32)');
      gradient.addColorStop(1, 'rgba(255,95,125,0.15)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    } else if (textureStyle === 'rust') {
      for (let i = 0; i < 120; i += 1) {
        ctx.fillStyle = `rgba(${110 + Math.random() * 90}, ${48 + Math.random() * 45}, ${18 + Math.random() * 26}, 0.26)`;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 3 + Math.random() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (textureStyle === 'graffiti') {
      ['#f659ff', '#7df9ff', '#ffcc66', '#82ffcf'].forEach((paint, index) => {
        ctx.strokeStyle = paint;
        ctx.lineWidth = 5 + index;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        for (let i = 0; i < 5; i += 1) ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'flake' || textureStyle === 'dust' || textureStyle === 'scar') {
      for (let i = 0; i < 180; i += 1) {
        ctx.fillStyle = textureStyle === 'dust' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.36)';
        ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      if (textureStyle === 'scar') scratch(42, 0.24);
    } else if (textureStyle === 'circuit') {
      ctx.strokeStyle = trim;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      for (let x = 18; x < size; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size * 0.36);
        ctx.lineTo((x + 42) % size, size * 0.36);
        ctx.lineTo((x + 42) % size, size);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'tiger' || textureStyle === 'lava') {
      ctx.strokeStyle = textureStyle === 'lava' ? '#ff5f7d' : trim;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = textureStyle === 'lava' ? 4 : 8;
      for (let i = 0; i < 15; i += 1) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, 0);
        ctx.bezierCurveTo(Math.random() * size, size * 0.25, Math.random() * size, size * 0.75, Math.random() * size, size);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'interceptor') {
      ctx.fillStyle = '#101820';
      ctx.globalAlpha = 0.72;
      ctx.fillRect(0, size * 0.38, size, size * 0.24);
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(0, size * 0.48, size, 4);
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'panel') {
      ctx.strokeStyle = 'rgba(0,0,0,0.58)';
      ctx.lineWidth = 3;
      for (let x = 20; x < size; x += 44) ctx.strokeRect(x, 18, 30, size - 36);
    } else if (textureStyle === 'shark') {
      ctx.fillStyle = '#f4f7fb';
      ctx.globalAlpha = 0.85;
      for (let x = 14; x < size; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, size * 0.5);
        ctx.lineTo(x + 11, size * 0.68);
        ctx.lineTo(x + 22, size * 0.5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (textureStyle === 'grid') {
      ctx.strokeStyle = trim;
      ctx.globalAlpha = 0.34;
      for (let i = 0; i < size; i += 18) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      scratch(18, 0.11);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let x = 18; x < size; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, size);
      ctx.stroke();
    }
    ctx.strokeStyle = trim;
    ctx.globalAlpha = 0.35;
    ctx.strokeRect(16, 16, size - 32, size - 32);
    ctx.globalAlpha = 1;
  }, 2, 3);
}

function carbonTexture(color = '#d9f7ff') {
  return makeCanvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#111519';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        ctx.fillStyle = (x + y) % 16 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.24)';
        ctx.fillRect(x, y, 8, 8);
      }
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(size, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, 2, 2);
}

function tireTexture() {
  return makeCanvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#070809';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 4;
    for (let x = -size; x < size * 2; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 42, size);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let y = 18; y < size; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }, 1, 3);
}

function makePaintMaterial(def) {
  const style = def.appearance?.materialStyle || 'metal';
  const map = paintTextureForDefinition(def);
  const paintTint = map ? tintColorForTexture(def.colors.paint, def.appearance?.paintTint ?? 0) : colorWithIntensity(def.colors.paint, Math.max(0.2, def.appearance?.paintTint ?? 1));
  const presets = {
    metal: { roughness: 0.24, metalness: 0.82, clearcoat: 0.85, clearcoatRoughness: 0.16 },
    matte: { roughness: 0.88, metalness: 0.06, clearcoat: 0.04, clearcoatRoughness: 0.72 },
    carbon: { roughness: 0.48, metalness: 0.32, clearcoat: 0.32, clearcoatRoughness: 0.28 },
    glow: { roughness: 0.36, metalness: 0.18, clearcoat: 0.46, clearcoatRoughness: 0.22 },
  };
  const preset = presets[style] || presets.metal;
  const glowIntensity = def.appearance?.glowIntensity ?? 1;
  const emissive = style === 'glow' ? colorWithIntensity(def.colors.accent, glowIntensity) : new THREE.Color(0x000000);
  return new THREE.MeshPhysicalMaterial({
    color: paintTint,
    map,
    roughness: preset.roughness,
    metalness: preset.metalness,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: preset.clearcoatRoughness,
    emissive,
    emissiveIntensity: style === 'glow' ? 0.25 + glowIntensity * 0.7 : 0,
  });
}

function makeTrimMaterial(def) {
  const trimIntensity = def.appearance?.trimIntensity ?? 1;
  return new THREE.MeshStandardMaterial({
    color: colorWithIntensity(def.colors.trim || def.colors.accent, trimIntensity),
    map: loadPaintTexture('carbon', 4, 4),
    roughness: 0.42,
    metalness: 0.64,
  });
}

function makePartPaintMaterial(def, key, fallbackColor, options = {}) {
  const paint = def.appearance?.[key] || {};
  const map = partTextureForDefinition(def, key, options.repeatX ?? 2, options.repeatY ?? 2);
  const color = paint.color || fallbackColor || def.colors.trim || def.colors.paint;
  return new THREE.MeshPhysicalMaterial({
    color: map ? tintColorForTexture(color, paint.tint ?? 0) : new THREE.Color(color),
    map,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.45,
    clearcoat: options.clearcoat ?? 0.28,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.3,
  });
}

function mesh(geometry, material, position, rotation) {
  const item = new THREE.Mesh(geometry, material);
  if (position) item.position.set(position.x || 0, position.y || 0, position.z || 0);
  if (rotation) item.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function createLabelSprite(text = '', color = '#82ffcf') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 2.55, 0);
  sprite.scale.set(4.3, 1.2, 1);
  return { sprite, canvas, texture, text, color };
}

function drawLabel(label, text, teamName, color) {
  const ctx = label.canvas.getContext('2d');
  ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
  ctx.fillStyle = 'rgba(5, 8, 10, 0.58)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.roundRect(8, 8, 240, 54, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '800 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(teamName.toUpperCase(), 128, 28);
  ctx.fillStyle = '#f4f7fb';
  ctx.font = '900 23px Inter, sans-serif';
  ctx.fillText(text, 128, 53);
  label.texture.needsUpdate = true;
}

function resolveDefinition(spec) {
  if (typeof spec === 'object') return buildGarageVehicleDefinition(sanitizeGarageBlueprint(spec));
  return vehicleCatalog[spec] || vehicleCatalog['ether-runner'];
}

function createTurret(def, trimMaterial) {
  const accent = new THREE.Color(def.colors.accent);
  const turret = new THREE.Group();
  turret.position.set(def.turretMount.x, def.turretMount.y, def.turretMount.z);
  const style = def.parts?.turret?.style || 'ring';
  const turretGlowMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 2.3,
    transparent: true,
    opacity: 0.78,
  });
  turret.add(mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.24, 24), trimMaterial, { y: 0.04 }));
  const core = mesh(new THREE.TorusGeometry(style === 'mortar' ? 0.48 : 0.58, 0.045, 8, 32), turretGlowMaterial, { y: 0.2 }, { x: Math.PI / 2 });
  turret.add(core);
  const barrelMaterial = trimMaterial;
  const barrelLength = def.parts?.turret?.barrelLength || 1.25;

  const addBoxBarrel = (x, y, z, sx = 0.18, sy = 0.14, length = barrelLength, mat = barrelMaterial) => {
    turret.add(mesh(new THREE.BoxGeometry(sx, sy, length), mat, { x, y, z }));
  };
  const addTube = (x, y, z, radius = 0.16, length = barrelLength, mat = barrelMaterial) => {
    turret.add(mesh(new THREE.CylinderGeometry(radius * 0.82, radius, length, 18), mat, { x, y, z }, { x: Math.PI / 2 }));
  };

  if (style === 'rail') {
    turret.add(mesh(new THREE.BoxGeometry(0.16, 0.12, barrelLength), barrelMaterial, { y: 0.12, z: 0.62 }));
    turret.add(mesh(new THREE.BoxGeometry(0.5, 0.055, barrelLength * 0.82), turretGlowMaterial, { y: 0.23, z: 0.56 }));
  } else if (style === 'mortar') {
    turret.add(mesh(new THREE.CylinderGeometry(0.19, 0.25, barrelLength, 18), barrelMaterial, { y: 0.18, z: 0.52 }, { x: Math.PI / 2 }));
    turret.add(mesh(new THREE.SphereGeometry(0.2, 18, 10), turretGlowMaterial, { y: 0.18, z: 1.08 }));
  } else if (style === 'twin') {
    [-0.14, 0.14].forEach((x) => addBoxBarrel(x, 0.12, 0.66, 0.12, 0.12));
    turret.add(mesh(new THREE.BoxGeometry(0.42, 0.09, 0.58), turretGlowMaterial, { y: 0.24, z: 0.54 }));
  } else if (style === 'coil' || style === 'needle' || style === 'beam') {
    addTube(0, 0.14, 0.72, style === 'beam' ? 0.2 : 0.09);
    turret.add(mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 18), turretGlowMaterial, { y: 0.16, z: 0.42 }, { x: Math.PI / 2 }));
    turret.add(mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 18), turretGlowMaterial, { y: 0.16, z: 0.82 }, { x: Math.PI / 2 }));
  } else if (style === 'bloom' || style === 'fan') {
    const count = style === 'bloom' ? 6 : 5;
    for (let i = 0; i < count; i += 1) {
      const x = (i - (count - 1) / 2) * 0.13;
      addTube(x, 0.13 + Math.abs(x) * 0.16, 0.54, 0.075, barrelLength * 0.74);
    }
    turret.add(mesh(new THREE.BoxGeometry(0.8, 0.06, 0.28), turretGlowMaterial, { y: 0.25, z: 0.42 }));
  } else if (style === 'bell' || style === 'cask') {
    addTube(0, 0.16, 0.54, style === 'bell' ? 0.28 : 0.23, barrelLength * 0.82);
    turret.add(mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.28, 24), trimMaterial, { y: 0.16, z: 0.96 }, { x: Math.PI / 2 }));
  } else if (style === 'antler' || style === 'fork' || style === 'tuner') {
    [-0.22, 0.22].forEach((x) => {
      addBoxBarrel(x, 0.15, 0.66, 0.08, 0.1, barrelLength * 0.9);
      turret.add(mesh(new THREE.BoxGeometry(0.06, 0.18, barrelLength * 0.55), turretGlowMaterial, { x: x * 0.72, y: 0.27, z: 0.62 }));
    });
    turret.add(mesh(new THREE.SphereGeometry(0.14, 16, 10), turretGlowMaterial, { y: 0.18, z: 0.34 }));
  } else if (style === 'halo') {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      addTube(Math.cos(a) * 0.32, 0.18 + Math.sin(a) * 0.1, 0.58, 0.055, barrelLength * 0.58);
    }
    turret.add(mesh(new THREE.TorusGeometry(0.38, 0.026, 8, 28), turretGlowMaterial, { y: 0.18, z: 0.46 }, { x: Math.PI / 2 }));
  } else if (style === 'rack' || style === 'nest') {
    const rows = style === 'nest' ? 3 : 2;
    const cols = style === 'nest' ? 4 : 5;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        addTube((col - (cols - 1) / 2) * 0.12, 0.08 + row * 0.12, 0.46 + row * 0.05, 0.045, barrelLength * 0.5);
      }
    }
    turret.add(mesh(new THREE.BoxGeometry(0.78, 0.3, 0.3), trimMaterial, { y: 0.1, z: 0.28 }));
  } else if (style === 'drum') {
    turret.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.52, 24), trimMaterial, { y: 0.17, z: 0.42 }, { z: Math.PI / 2 }));
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      addTube(Math.cos(a) * 0.16, 0.17 + Math.sin(a) * 0.16, 0.72, 0.045, barrelLength * 0.82);
    }
  } else if (style === 'pod') {
    turret.add(mesh(new THREE.BoxGeometry(0.66, 0.34, 0.58), trimMaterial, { y: 0.12, z: 0.38 }));
    [-0.18, 0, 0.18].forEach((x) => addBoxBarrel(x, 0.15, 0.78, 0.08, 0.1, barrelLength * 0.72));
  } else if (style === 'splitter') {
    [-0.24, 0.24].forEach((x) => addBoxBarrel(x, 0.13, 0.7, 0.1, 0.12));
    addBoxBarrel(0, 0.26, 0.56, 0.06, 0.22, barrelLength * 0.72, turretGlowMaterial);
  } else {
    turret.add(mesh(new THREE.BoxGeometry(0.18, 0.14, barrelLength), barrelMaterial, { y: 0.1, z: 0.68 }));
    turret.add(mesh(new THREE.BoxGeometry(0.06, 0.22, barrelLength * 0.74), turretGlowMaterial, { y: 0.19, z: 0.62 }));
  }
  const teamLight = new THREE.PointLight(accent, 0.75, 6);
  teamLight.position.set(0, 0.72, 0);
  turret.add(teamLight);
  return { turret, turretGlowMaterial, teamLight, idleParts: [core] };
}

function createWheel(part, trimMaterial, glowMaterial) {
  const { radius, width, style = 'slick' } = part;
  const tireMaterial = trimMaterial;
  const wheel = new THREE.Group();
  const segments = ['hex', 'bone'].includes(style) ? 6 : ['saw', 'spike'].includes(style) ? 18 : 36;
  const tire = mesh(new THREE.CylinderGeometry(radius, radius, width, segments), tireMaterial, null, { z: Math.PI / 2 });
  const hubRadius = ['maglev', 'razor', 'solar'].includes(style) ? radius * 0.38 : radius * 0.52;
  const hub = mesh(new THREE.CylinderGeometry(hubRadius, hubRadius, width + 0.04, ['hex', 'bone'].includes(style) ? 6 : 18), trimMaterial, null, { z: Math.PI / 2 });
  const glow = mesh(new THREE.TorusGeometry(radius * 0.64, style === 'maglev' ? 0.032 : 0.018, 6, 24), glowMaterial, null, { y: Math.PI / 2 });
  wheel.add(tire, hub, glow);

  if (['chunky', 'paddle', 'claw', 'tread', 'chain'].includes(style)) {
    const treadCount = style === 'tread' ? 12 : 10;
    for (let i = 0; i < treadCount; i += 1) {
      const angle = (i / treadCount) * Math.PI * 2;
      const block = mesh(
        new THREE.BoxGeometry(width + 0.08, 0.045, style === 'paddle' ? 0.22 : 0.12),
        style === 'chain' ? trimMaterial : tireMaterial,
        { y: Math.sin(angle) * radius, z: Math.cos(angle) * radius },
        { x: -angle },
      );
      wheel.add(block);
    }
  }

  if (['saw', 'spike', 'bone'].includes(style)) {
    const toothCount = style === 'spike' ? 12 : 10;
    for (let i = 0; i < toothCount; i += 1) {
      const angle = (i / toothCount) * Math.PI * 2;
      const tooth = mesh(
        new THREE.ConeGeometry(0.055, style === 'spike' ? 0.22 : 0.15, 5),
        trimMaterial,
        { y: Math.sin(angle) * (radius + 0.02), z: Math.cos(angle) * (radius + 0.02) },
        { x: Math.PI * 0.5 - angle, z: Math.PI / 2 },
      );
      wheel.add(tooth);
    }
  }

  if (['spoke', 'solar', 'whitewall', 'gyro', 'reactor'].includes(style)) {
    const spokeCount = style === 'solar' ? 12 : 8;
    for (let i = 0; i < spokeCount; i += 1) {
      const angle = (i / spokeCount) * Math.PI * 2;
      wheel.add(mesh(new THREE.BoxGeometry(width + 0.08, 0.025, radius * 0.92), style === 'reactor' ? glowMaterial : trimMaterial, null, { x: angle, z: Math.PI / 2 }));
    }
  }

  if (['dish', 'duplex', 'balloon'].includes(style)) {
    [-1, 1].forEach((side) => {
      wheel.add(mesh(new THREE.TorusGeometry(radius * 0.52, 0.018, 6, 22), trimMaterial, { x: side * width * 0.5 }, { y: Math.PI / 2 }));
    });
  }

  if (style === 'maglev') {
    tire.visible = false;
    [-1, 1].forEach((side) => wheel.add(mesh(new THREE.TorusGeometry(radius, 0.035, 8, 32), glowMaterial, { x: side * width * 0.32 }, { y: Math.PI / 2 })));
  }

  return { wheel, tire };
}

function buildLegacyRenderable(def, materials) {
  const group = new THREE.Group();
  const paint = makePaintMaterial({ ...def, colors: { ...def.colors, trim: '#d9f7ff' } });
  const glass = materials.glass.clone();
  glass.color.setHex(def.colors.glass);
  group.add(mesh(new THREE.BoxGeometry(1.92, 0.72, 3.72), paint, { y: 0.03 }));
  group.add(mesh(new THREE.BoxGeometry(1.7, 0.28, 1.1), paint, { y: 0.36, z: 0.95 }));
  group.add(mesh(new THREE.BoxGeometry(1.36, 0.74, 1.28), glass, { y: 0.75, z: -0.24 }));
  const trim = new THREE.MeshStandardMaterial({ color: def.colors.accent, metalness: 0.6, roughness: 0.28 });
  const { turret, turretGlowMaterial, teamLight, idleParts } = createTurret({ ...def, colors: { ...def.colors, accent: `#${def.colors.accent.toString(16).padStart(6, '0')}` } }, trim);
  group.add(turret);
  const brakeLightMaterial = new THREE.MeshStandardMaterial({ color: 0xff1f2f, emissive: 0xff1f2f, emissiveIntensity: 1.2 });
  [-0.55, 0.55].forEach((sx) => {
    group.add(mesh(new THREE.BoxGeometry(0.42, 0.15, 0.06), materials.light, { x: sx, y: 0.22, z: 1.9 }));
    group.add(mesh(new THREE.BoxGeometry(0.44, 0.16, 0.06), brakeLightMaterial, { x: sx, y: 0.24, z: -1.9 }));
  });
  const wheelPivots = [];
  const wheelMeshes = [];
  [[-1.03, -0.36, 1.23, true], [1.03, -0.36, 1.23, true], [-1.03, -0.36, -1.18, false], [1.03, -0.36, -1.18, false]].forEach(([x, y, z, front]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.34, 32), materials.rubber);
    wheel.rotation.z = Math.PI / 2;
    pivot.add(wheel);
    group.add(pivot);
    wheelPivots.push({ pivot, front });
    wheelMeshes.push(wheel);
  });
  return { group, turret, wheelPivots, wheelMeshes, brakeLightMaterial, turretGlowMaterial, teamLight, idleParts, glowMaterials: [turretGlowMaterial] };
}

function addChassisDetails(group, chassis, paint, trim, glowMaterial) {
  const { width, length, height } = chassis.dimensions;
  const sideX = width * 0.56;
  const style = chassis.style;
  const pair = (fn) => [-1, 1].forEach(fn);
  const addSideRails = (railWidth = 0.12, railHeight = 0.16, railLength = length * 0.8, y = height * 0.3, mat = trim, x = sideX) => {
    pair((side) => group.add(mesh(new THREE.BoxGeometry(railWidth, railHeight, railLength), mat, { x: side * x, y, z: 0 })));
  };
  const addNose = (noseWidth = width * 0.7, noseLength = length * 0.26, mat = trim) => {
    group.add(mesh(new THREE.BoxGeometry(noseWidth, height * 0.18, noseLength), mat, { y: height * 0.5, z: length * 0.38 }, { x: -0.12 }));
  };
  const addCenterKeel = (keelWidth = width * 0.16, keelHeight = height * 0.14, keelLength = length * 0.86, y = height * 0.58) => {
    group.add(mesh(new THREE.BoxGeometry(keelWidth, keelHeight, keelLength), glowMaterial, { y, z: 0 }));
  };
  const addBladeNose = (noseWidth = width * 0.36, noseLength = length * 0.36, y = height * 0.56, mat = trim) => {
    group.add(mesh(new THREE.ConeGeometry(noseWidth, noseLength, 4), mat, { y, z: length * 0.46 }, { x: Math.PI / 2, y: Math.PI / 4 }));
  };
  const addBullBar = (barWidth = width * 1.08, z = length * 0.54, mat = trim) => {
    group.add(mesh(new THREE.BoxGeometry(barWidth, height * 0.14, 0.1), mat, { y: height * 0.42, z }));
    pair((side) => group.add(mesh(new THREE.BoxGeometry(0.08, height * 0.48, 0.08), mat, { x: side * barWidth * 0.42, y: height * 0.36, z })));
  };
  const addRibs = (count = 5, span = length * 0.72, mat = trim) => {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      group.add(mesh(new THREE.BoxGeometry(width * 0.96, 0.055, 0.08), mat, { y: height * 0.7, z: -span * 0.5 + span * t }));
    }
  };
  const addOutriggers = (count = 3, mat = trim) => {
    pair((side) => {
      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0 : i / (count - 1);
        const z = -length * 0.34 + t * length * 0.68;
        group.add(mesh(new THREE.BoxGeometry(width * 0.44, 0.07, 0.11), mat, { x: side * width * 0.62, y: height * 0.38, z }, { z: side * 0.42 }));
      }
    });
  };
  const addWingPlate = (side, x, z, sx, sz, angle, mat = trim) => {
    group.add(mesh(new THREE.BoxGeometry(sx, height * 0.1, sz), mat, { x: side * x, y: height * 0.48, z }, { y: side * angle }));
  };

  if (style === 'wedge') {
    addNose(width * 0.96, length * 0.38, trim);
    addBladeNose(width * 0.4, length * 0.35, height * 0.5, paint);
    addCenterKeel(width * 0.25, height * 0.15, length * 0.98, height * 0.7);
    pair((side) => {
      addWingPlate(side, width * 0.45, -length * 0.1, width * 0.25, length * 0.8, 0.2, trim);
      group.add(mesh(new THREE.BoxGeometry(width * 0.15, height * 0.2, length * 0.4), glowMaterial, { x: side * width * 0.35, y: height * 0.55, z: length * 0.1 }, { x: -0.2 }));
    });
    group.add(mesh(new THREE.ConeGeometry(width * 0.6, length * 0.4, 3), trim, { y: height * 0.4, z: length * 0.5 }, { x: Math.PI / 2, y: Math.PI }));
  } else if (style === 'ghost') {
    addNose(width * 0.78, length * 0.42, glowMaterial);
    addCenterKeel(width * 0.12, height * 0.18, length * 1.04, height * 0.62);
    addSideRails(0.055, height * 0.12, length * 0.7, height * 0.36, glowMaterial, width * 0.5);
    pair((side) => group.add(mesh(new THREE.BoxGeometry(width * 0.16, height * 0.1, length * 0.32), paint, { x: side * width * 0.36, y: height * 0.46, z: -length * 0.2 })));
  } else if (style === 'sled') {
    addNose(width * 0.82, length * 0.26, glowMaterial);
    addCenterKeel(width * 0.52, height * 0.07, length * 1.02, height * 0.32);
    addSideRails(0.1, height * 0.13, length * 0.94, height * 0.24, trim, width * 0.48);
    pair((side) => group.add(mesh(new THREE.BoxGeometry(width * 0.18, height * 0.08, length * 0.8), glowMaterial, { x: side * width * 0.32, y: height * 0.18, z: 0 })));
  } else if (style === 'heavy' || style === 'brick') {
    addSideRails(style === 'brick' ? 0.32 : 0.18, height * 0.8, length * 0.98, height * 0.4);
    group.add(mesh(new THREE.BoxGeometry(width * 1.05, height * 0.3, length * 0.25), trim, { y: height * 0.65, z: length * 0.42 }));
    group.add(mesh(new THREE.BoxGeometry(width * 0.85, height * 0.25, length * 0.2), trim, { y: height * 0.68, z: -length * 0.42 }));
    addBullBar(width * (style === 'brick' ? 1.2 : 1.12), length * 0.56);
    if (style === 'brick') {
      addRibs(6, length * 0.65, glowMaterial);
      pair((side) => group.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, length * 0.9, 8), trim, { x: side * width * 0.55, y: height * 0.8, z: 0 }, { x: Math.PI / 2 })));
    }
  } else if (style === 'long') {
    addCenterKeel(width * 0.22, height * 0.35, length * 1.1, height * 0.6);
    addNose(width * 0.3, length * 0.6, trim);
    addSideRails(0.12, height * 0.25, length * 1.05, height * 0.4, glowMaterial, width * 0.35);
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(width * 0.2, height * 0.15, length * 0.4), paint, { x: side * width * 0.45, y: height * 0.5, z: -length * 0.3 }));
      group.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, length * 0.5, 8), glowMaterial, { x: side * width * 0.25, y: height * 0.6, z: length * 0.2 }, { x: Math.PI / 2 }));
    });
  } else if (style === 'spear') {
    addCenterKeel(width * 0.12, height * 0.32, length * 1.04, height * 0.54);
    addBladeNose(width * 0.18, length * 0.48, height * 0.62, trim);
    pair((side) => addWingPlate(side, width * 0.32, -length * 0.28, width * 0.12, length * 0.36, 0.26, glowMaterial));
  } else if (style === 'mantis') {
    addSideRails(0.075, height * 0.16, length * 0.9, height * 0.34);
    addOutriggers(4, trim);
    pair((side) => group.add(mesh(new THREE.BoxGeometry(width * 0.15, height * 0.08, length * 0.72), glowMaterial, { x: side * width * 0.36, y: height * 0.6, z: -length * 0.04 }, { y: side * 0.16 })));
  } else if (style === 'spiderline') {
    addSideRails(0.06, height * 0.14, length * 0.96, height * 0.28, trim, width * 0.58);
    addOutriggers(5, trim);
    addCenterKeel(width * 0.1, height * 0.14, length * 0.92, height * 0.58);
    addRibs(6, length * 0.78, glowMaterial);
  } else if (style === 'tail') {
    addNose(width * 0.58, length * 0.22, trim);
    group.add(mesh(new THREE.BoxGeometry(width * 0.14, height * 0.28, length * 0.48), glowMaterial, { y: height * 0.7, z: -length * 0.42 }, { x: 0.22 }));
    group.add(mesh(new THREE.ConeGeometry(width * 0.12, length * 0.2, 4), trim, { y: height * 0.84, z: -length * 0.62 }, { x: -Math.PI / 2, y: Math.PI / 4 }));
    pair((side) => addWingPlate(side, width * 0.32, length * 0.1, width * 0.16, length * 0.46, 0.22, trim));
  } else if (style === 'hauler') {
    addSideRails(0.22, height * 0.58, length * 0.96);
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(0.52, height * 0.3, length * 0.22), trim, { x: side * width * 0.3, y: height * 0.66, z: length * 0.36 }));
      group.add(mesh(new THREE.BoxGeometry(0.42, height * 0.24, length * 0.18), trim, { x: side * width * 0.34, y: height * 0.58, z: -length * 0.36 }));
    });
    addBullBar(width * 1.08, length * 0.52);
  } else if (style === 'longhorn') {
    addSideRails(0.18, height * 0.48, length * 0.98);
    addBullBar(width * 1.18, length * 0.55);
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(0.08, height * 0.12, length * 0.34), glowMaterial, { x: side * width * 0.34, y: height * 0.7, z: length * 0.42 }, { y: side * 0.34 }));
      group.add(mesh(new THREE.ConeGeometry(0.08, length * 0.28, 5), trim, { x: side * width * 0.48, y: height * 0.54, z: length * 0.58 }, { x: Math.PI / 2, y: side * 0.72 }));
    });
  } else if (style === 'skiff') {
    group.add(mesh(new THREE.BoxGeometry(width * 0.66, height * 0.1, length * 0.96), glowMaterial, { y: height * 0.34, z: 0 }));
    addBladeNose(width * 0.2, length * 0.48, height * 0.5, trim);
    pair((side) => addWingPlate(side, width * 0.36, -length * 0.08, width * 0.16, length * 0.84, 0.12, paint));
  } else if (style === 'vulture') {
    addSideRails(0.1, height * 0.2, length * 0.86);
    addRibs(7, length * 0.86, trim);
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(width * 0.18, height * 0.14, length * 0.62), glowMaterial, { x: side * width * 0.46, y: height * 0.72, z: -length * 0.08 }, { y: side * 0.28 }));
    });
  } else if (style === 'hammerhead') {
    group.add(mesh(new THREE.BoxGeometry(width * 1.22, height * 0.26, length * 0.2), trim, { y: height * 0.5, z: length * 0.43 }));
    group.add(mesh(new THREE.BoxGeometry(width * 0.72, height * 0.1, length * 0.12), glowMaterial, { y: height * 0.68, z: length * 0.54 }));
    addSideRails(0.12, height * 0.28, length * 0.72);
    pair((side) => group.add(mesh(new THREE.BoxGeometry(width * 0.22, height * 0.16, length * 0.28), trim, { x: side * width * 0.46, y: height * 0.45, z: length * 0.34 })));
  } else if (style === 'monorail') {
    group.add(mesh(new THREE.BoxGeometry(width * 0.12, height * 0.4, length * 1.04), glowMaterial, { y: height * 0.48, z: 0 }));
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(width * 0.28, height * 0.22, length * 0.44), paint, { x: side * width * 0.38, y: height * 0.48, z: -length * 0.1 }));
      group.add(mesh(new THREE.BoxGeometry(width * 0.18, height * 0.08, length * 0.3), glowMaterial, { x: side * width * 0.48, y: height * 0.68, z: -length * 0.08 }));
    });
  } else if (style === 'fang') {
    pair((side) => {
      group.add(mesh(new THREE.BoxGeometry(width * 0.24, height * 0.16, length * 0.58), trim, { x: side * width * 0.25, y: height * 0.5, z: length * 0.26 }, { y: side * 0.2 }));
      group.add(mesh(new THREE.ConeGeometry(width * 0.08, length * 0.22, 4), trim, { x: side * width * 0.36, y: height * 0.52, z: length * 0.56 }, { x: Math.PI / 2, y: side * 0.42 }));
    });
    group.add(mesh(new THREE.BoxGeometry(width * 0.48, 0.05, length * 0.36), glowMaterial, { y: height * 0.7, z: -length * 0.22 }));
  } else if (style === 'splitfin') {
    pair((side) => {
      addWingPlate(side, width * 0.38, -length * 0.2, width * 0.26, length * 0.64, 0.34, trim);
      addWingPlate(side, width * 0.34, length * 0.24, width * 0.18, length * 0.44, -0.18, glowMaterial);
    });
    group.add(mesh(new THREE.BoxGeometry(width * 0.5, 0.05, length * 0.68), glowMaterial, { y: height * 0.68, z: 0 }));
  } else if (style === 'pod') {
    group.add(mesh(new THREE.SphereGeometry(width * 0.65, 32, 16), paint, { y: height * 0.5, z: 0 }));
    group.add(mesh(new THREE.TorusGeometry(width * 0.68, 0.05, 12, 48), glowMaterial, { y: height * 0.5, z: 0 }, { x: Math.PI / 2 }));
    group.add(mesh(new THREE.TorusGeometry(width * 0.68, 0.05, 12, 48), glowMaterial, { y: height * 0.5, z: 0 }, { y: Math.PI / 2 }));
    pair((side) => group.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, width * 1.5, 8), trim, { y: height * 0.5, z: 0 }, { z: Math.PI / 2 })));
  } else if (style === 'kite') {
    pair((side) => {
      addWingPlate(side, width * 0.3, 0, width * 0.5, length * 0.62, 0.42, trim);
      addWingPlate(side, width * 0.38, -length * 0.18, width * 0.24, length * 0.34, -0.34, glowMaterial);
    });
    group.add(mesh(new THREE.BoxGeometry(width * 0.18, height * 0.14, length * 0.96), glowMaterial, { y: height * 0.56, z: 0 }));
  }
}

function addArmorDetails(group, armor, chassis, trim, glowMaterial) {
  const { width, length, height } = chassis.dimensions;
  const style = armor.style || 'balanced';
  const sideX = width * 0.57;
  const plateMat = ['shield', 'lattice', 'glassbone'].includes(style) ? glowMaterial : trim;

  if (style === 'balanced') {
    [-1, 1].forEach((side) => group.add(mesh(new THREE.BoxGeometry(0.08, height * 0.38, length * 0.62), trim, { x: side * sideX, y: height * 0.28, z: 0 })));
  } else if (['slab', 'shell', 'slats'].includes(style)) {
    [-1, 1].forEach((side) => {
      for (let i = -2; i <= 2; i += 1) group.add(mesh(new THREE.BoxGeometry(0.1, height * 0.34, length * 0.14), trim, { x: side * sideX, y: height * 0.38, z: i * length * 0.16 }));
    });
  } else if (['scales', 'tiles', 'honeycomb'].includes(style)) {
    for (let row = 0; row < 3; row += 1) {
      for (let i = -3; i <= 3; i += 1) {
        group.add(mesh(new THREE.BoxGeometry(width * 0.18, 0.035, length * 0.11), plateMat, { x: i * width * 0.12 + (row % 2) * 0.08, y: height * (0.58 + row * 0.08), z: -length * 0.22 + row * length * 0.16 }));
      }
    }
  } else if (['cage', 'mesh', 'ribs'].includes(style)) {
    for (let i = -2; i <= 2; i += 1) group.add(mesh(new THREE.BoxGeometry(width * 1.08, 0.055, 0.07), trim, { y: height * 0.72, z: i * length * 0.18 }));
    [-1, 1].forEach((side) => group.add(mesh(new THREE.BoxGeometry(0.06, height * 0.62, length * 0.76), trim, { x: side * width * 0.48, y: height * 0.45, z: 0 })));
  } else if (['fins', 'serrated'].includes(style)) {
    for (let i = -3; i <= 3; i += 1) {
      group.add(mesh(new THREE.BoxGeometry(width * 0.72, height * 0.24, 0.04), trim, { y: height * 0.72, z: i * length * 0.11 }, { x: style === 'fins' ? 0.38 : 0 }));
    }
  } else if (['skirts', 'weave', 'foam'].includes(style)) {
    [-1, 1].forEach((side) => group.add(mesh(new THREE.BoxGeometry(0.13, height * 0.5, length * 0.92), plateMat, { x: side * sideX, y: -height * 0.08, z: 0 })));
  } else if (['shield', 'lattice'].includes(style)) {
    group.add(mesh(new THREE.TorusGeometry(width * 0.46, 0.025, 8, 32), glowMaterial, { y: height * 0.74, z: 0 }, { x: Math.PI / 2 }));
    [-1, 1].forEach((side) => group.add(mesh(new THREE.BoxGeometry(0.04, height * 0.46, length * 0.84), glowMaterial, { x: side * sideX, y: height * 0.34, z: 0 })));
  } else if (style === 'patchwork' || style === 'liner') {
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 ? -1 : 1;
      group.add(mesh(new THREE.BoxGeometry(0.09, height * (0.2 + (i % 3) * 0.06), length * 0.12), trim, { x: side * sideX, y: height * 0.3, z: -length * 0.38 + i * length * 0.08 }));
    }
  }
}

function buildCustomRenderable(def) {
  const group = new THREE.Group();
  const paint = makePaintMaterial(def);
  const trim = makeTrimMaterial(def);
  const glowIntensity = def.appearance?.glowIntensity ?? 1;
  const glowColor = colorWithIntensity(def.colors.accent, glowIntensity);
  const glowMaterial = new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 1.2 + glowIntensity * 1.2, transparent: true, opacity: 0.82 });
  const glass = new THREE.MeshPhysicalMaterial({ color: colorWithIntensity(def.colors.glass, Math.max(0.45, glowIntensity)), emissive: glowColor, emissiveIntensity: 0.2 + glowIntensity * 0.22, roughness: 0.05, metalness: 0.12, transparent: true, opacity: 0.56 });
  const wheelPaint = makePartPaintMaterial(def, 'wheelPaint', '#111519', { roughness: 0.72, metalness: 0.18, clearcoat: 0.18, repeatX: 1, repeatY: 3 });
  const turretPaint = makePartPaintMaterial(def, 'turretPaint', def.colors.trim, { roughness: 0.32, metalness: 0.78, clearcoat: 0.52 });
  const { chassis, cabin, wheel, armor } = def.parts;
  const { width, length, height } = chassis.dimensions;

  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'chassis';
  chassisGroup.add(mesh(new THREE.BoxGeometry(width, height, length), paint, { y: 0.06 }));
  chassisGroup.add(mesh(new THREE.BoxGeometry(width * 0.78, height * 0.35, length * 0.34), paint, { y: height * 0.48, z: length * 0.24 }));
  addChassisDetails(chassisGroup, chassis, paint, trim, glowMaterial);
  group.add(chassisGroup);

  const armorGroup = new THREE.Group();
  armorGroup.name = 'armor';
  addArmorDetails(armorGroup, armor, chassis, trim, glowMaterial);
  group.add(armorGroup);

  const cabinPart = def.parts.cabin;
  const cabinSocket = chassis.cabinSocket;
  const cabinGroup = new THREE.Group();
  cabinGroup.name = 'cabin';

  if (cabinPart.style === 'aero') {
    cabinGroup.add(mesh(new THREE.CylinderGeometry(cabinPart.size.w * 0.45, cabinPart.size.w * 0.55, cabinPart.size.d, 16), glass, { x: cabinSocket.x + cabinPart.offset.x, y: cabinSocket.y + cabinPart.offset.y, z: cabinSocket.z + cabinPart.offset.z }, { x: Math.PI / 2, z: Math.PI / 2 }));
    cabinGroup.add(mesh(new THREE.BoxGeometry(cabinPart.size.w, cabinPart.size.h * 0.4, cabinPart.size.d * 1.1), trim, { x: cabinSocket.x, y: cabinSocket.y - cabinPart.size.h * 0.3, z: cabinSocket.z }));
  } else if (cabinPart.style === 'command') {
    cabinGroup.add(mesh(new THREE.CylinderGeometry(cabinPart.size.w * 0.6, cabinPart.size.w * 0.7, cabinPart.size.h, 6), glass, { x: cabinSocket.x + cabinPart.offset.x, y: cabinSocket.y + cabinPart.offset.y, z: cabinSocket.z + cabinPart.offset.z }, { y: Math.PI / 6 }));
    cabinGroup.add(mesh(new THREE.BoxGeometry(cabinPart.size.w * 1.1, cabinPart.size.h * 0.2, cabinPart.size.d * 1.1), trim, { x: cabinSocket.x, y: cabinSocket.y + cabinPart.size.h * 0.45, z: cabinSocket.z }));
  } else if (cabinPart.style === 'split') {
    [-0.42, 0.42].forEach((sx) => {
      cabinGroup.add(mesh(new THREE.BoxGeometry(0.35, cabinPart.size.h, cabinPart.size.d), glass, { x: cabinSocket.x + sx, y: cabinSocket.y + cabinPart.offset.y, z: cabinSocket.z + cabinPart.offset.z }));
      cabinGroup.add(mesh(new THREE.BoxGeometry(0.4, 0.14, cabinPart.size.d * 1.08), trim, { x: cabinSocket.x + sx, y: cabinSocket.y + cabinPart.size.h * 0.4, z: cabinSocket.z }));
    });
    cabinGroup.add(mesh(new THREE.BoxGeometry(0.4, cabinPart.size.h * 0.6, cabinPart.size.d * 0.8), glowMaterial, { x: cabinSocket.x, y: cabinSocket.y, z: cabinSocket.z }));
  } else {
    cabinGroup.add(mesh(
      new THREE.BoxGeometry(cabinPart.size.w, cabinPart.size.h, cabinPart.size.d),
      glass,
      {
        x: cabinSocket.x + cabinPart.offset.x,
        y: cabinSocket.y + cabinPart.offset.y,
        z: cabinSocket.z + cabinPart.offset.z,
      },
    ));
  }
  
  group.add(cabinGroup);

  const brakeLightMaterial = new THREE.MeshStandardMaterial({ color: 0xff1f2f, emissive: 0xff1f2f, emissiveIntensity: 1.2 });
  [-0.56, 0.56].forEach((sx) => {
    group.add(mesh(new THREE.BoxGeometry(0.36, 0.12, 0.06), glowMaterial, { x: sx, y: 0.18, z: length * 0.5 + 0.035 }));
    group.add(mesh(new THREE.BoxGeometry(0.38, 0.13, 0.06), brakeLightMaterial, { x: sx, y: 0.18, z: -length * 0.5 - 0.035 }));
  });
  group.add(mesh(new THREE.BoxGeometry(width * 0.7, 0.04, length * 0.72), glowMaterial, { y: -0.26, z: 0 }));

  const { turret, turretGlowMaterial, teamLight, idleParts } = createTurret(def, turretPaint);
  turret.name = 'turret';
  group.add(turret);
  const wheelPivots = [];
  const wheelMeshes = [];
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'wheel';
  chassis.wheelSockets.forEach((socket) => {
    const pivot = new THREE.Group();
    pivot.position.set(socket.x, socket.y, socket.z);
    const builtWheel = createWheel(wheel, wheelPaint, glowMaterial);
    pivot.add(builtWheel.wheel);
    wheelGroup.add(pivot);
    wheelPivots.push({ pivot, front: socket.front });
    wheelMeshes.push(builtWheel.wheel);
  });
  group.add(wheelGroup);

  return {
    group,
    turret,
    wheelPivots,
    wheelMeshes,
    brakeLightMaterial,
    turretGlowMaterial,
    teamLight,
    idleParts,
    glowMaterials: [glowMaterial, turretGlowMaterial],
    customGlowColor: `#${glowColor.getHexString()}`,
  };
}

export function createVehiclePreviewGroup(materials, spec) {
  const def = resolveDefinition(spec);
  const renderable = def.custom ? buildCustomRenderable(def, materials) : buildLegacyRenderable(def, materials);
  return { def, group: renderable.group, renderable };
}

export function createGaragePartPortraitGroup(materials, spec, categoryKey) {
  const def = resolveDefinition(spec);
  if (!def.custom || !['wheel', 'turret'].includes(categoryKey)) return createVehiclePreviewGroup(materials, spec);

  const group = new THREE.Group();
  const glowIntensity = def.appearance?.glowIntensity ?? 1;
  const glowColor = colorWithIntensity(def.colors.accent, glowIntensity);
  const glowMaterial = new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 1.2 + glowIntensity * 1.2, transparent: true, opacity: 0.82 });

  if (categoryKey === 'wheel') {
    const wheelPaint = makePartPaintMaterial(def, 'wheelPaint', '#111519', { roughness: 0.72, metalness: 0.18, clearcoat: 0.18, repeatX: 1, repeatY: 3 });
    const builtWheel = createWheel(def.parts.wheel, wheelPaint, glowMaterial);
    builtWheel.wheel.name = 'wheel';
    builtWheel.wheel.rotation.y = -0.25;
    group.add(builtWheel.wheel);
    return { def, group, renderable: { group, wheelMeshes: [builtWheel.wheel], glowMaterials: [glowMaterial], customGlowColor: `#${glowColor.getHexString()}` } };
  }

  const turretPaint = makePartPaintMaterial(def, 'turretPaint', def.colors.trim, { roughness: 0.32, metalness: 0.78, clearcoat: 0.52 });
  const { turret, turretGlowMaterial, teamLight, idleParts } = createTurret({ ...def, turretMount: { x: 0, y: 0, z: 0 } }, turretPaint);
  turret.name = 'turret';
  turret.position.set(0, 0, 0);
  group.add(turret);
  return { def, group, renderable: { group, turret, turretGlowMaterial, teamLight, idleParts, glowMaterials: [glowMaterial, turretGlowMaterial], customGlowColor: `#${glowColor.getHexString()}` } };
}

export function applyVehicleTeamVisuals(entity, team, displayName) {
  const teamColor = new THREE.Color(team.color);
  const glowColor = entity.renderable.customGlowColor ? new THREE.Color(entity.renderable.customGlowColor) : teamColor;
  entity.teamName = team.name;
  entity.teamColor = team.color;
  if (entity.renderable.turretGlowMaterial) {
    entity.renderable.turretGlowMaterial.color.copy(glowColor);
    entity.renderable.turretGlowMaterial.emissive.copy(glowColor);
  }
  if (entity.renderable.teamLight) entity.renderable.teamLight.color.copy(teamColor);
  if (entity.renderable.label) drawLabel(entity.renderable.label, displayName, team.name, team.color);
}

export function createVehicleEntity(ctx, materials, spec, position, yaw = 0, controlledBy = 'ai') {
  const def = resolveDefinition(spec);
  const renderable = def.custom ? buildCustomRenderable(def, materials) : buildLegacyRenderable(def, materials);
  const { group } = renderable;
  group.position.set(position.x, def.stats.rideHeight, position.z);
  group.rotation.set(0, yaw, 0);
  const label = createLabelSprite(def.name, def.colors.accent);
  group.add(label.sprite);
  ctx.scene.add(group);

  const stats = getVehicleStats({ vehicle: { stats: { ...def.stats }, upgrades: createVehicleUpgrades() } });
  return ctx.ecs.add({
    id: `${def.id}-${Math.random().toString(36).slice(2)}`,
    team: def.team,
    vehicle: {
      catalogId: def.id,
      name: def.name,
      stats: { ...def.stats },
      upgrades: createVehicleUpgrades(),
      armorType: def.armorType,
      controlledBy,
      customBlueprint: def.blueprint || null,
    },
    transform: { x: position.x, z: position.z, yaw, y: def.stats.rideHeight },
    velocity: { speed: 0, wheelSpin: 0, steer: 0, smokeTimer: 0, collisionCooldown: 0, vehicleCollisionCooldowns: new Map() },
    stability: { pitch: 0, roll: 0, angularPitch: 0, angularRoll: 0, upsideDownTimer: 0, recoveryTimer: 0, recovering: false },
    health: { current: def.stats.maxHealth, max: def.stats.maxHealth, dead: false, hitFlash: 0 },
    respawn: { timer: 0, invulnerableTimer: 0, baseId: null },
    weaponSlots: {
      turret: { weaponId: 'turret', ammoInMagazine: stats.turretMagazineSize, magazineSize: stats.turretMagazineSize, reserveAmmo: Infinity, cooldown: 0, reloadTime: stats.turretReloadTime, reloadRemaining: 0, isReloading: false },
      q: def.weaponSlots.q ? { weaponId: def.weaponSlots.q, ammo: 3, cooldown: 0 } : null,
      e: def.weaponSlots.e ? { weaponId: def.weaponSlots.e, ammo: 3, cooldown: 0 } : null,
    },
    turret: { group: renderable.turret, yaw: 0, targetYaw: yaw },
    renderable: { ...renderable, label },
  });
}
