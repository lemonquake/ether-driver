import './styles.css';
import * as THREE from 'three';
import { createGameContext, resizeContext } from './core/GameContext.js';
import { setupInput } from './core/InputSystem.js';
import { createRapierPhysics } from './physics/RapierPhysics.js';
import { createMaterials } from './world/materials.js';
import { buildMap } from './world/MapSystem.js';
import { updateVehicles } from './vehicles/VehicleSystem.js';
import { createParticleSystem } from './effects/ParticleSystem.js';
import { createCameraEffects } from './effects/CameraEffectsSystem.js';
import { createPickups, updatePickups } from './pickups/PickupSystem.js';
import { updateAim } from './combat/AimSystem.js';
import { updateWeapons } from './combat/WeaponSystem.js';
import { updateDamageVisuals } from './combat/DamageSystem.js';
import { updateAI } from './ai/AISystem.js';
import { generateNavigationGraph } from './ai/NavigationSystem.js';
import { createRouteRecorder } from './ai/AIRouteRecorder.js';
import { createHUD, drawMinimap, updateHUD } from './ui/HUDSystem.js';
import { getVehicleStats } from './data/vehicleCatalog.js';
import { buildGarageVehicleDefinition, garageMaterialStyles, garagePartCatalog, getGarageStats, loadGarageBlueprint, saveGarageBlueprint, sanitizeGarageBlueprint } from './data/vehicleParts.js';
import { createDefaultMatchState, startMatch, updateMatch, clearVehicles } from './match/MatchSystem.js';
import { cloneDefaultTeams } from './data/teams.js';
import { createGaragePartPortraitGroup, createVehiclePreviewGroup } from './vehicles/VehicleFactory.js';

const canvas = document.querySelector('#game');
const ctx = createGameContext(canvas);
const physics = await createRapierPhysics();
const materials = createMaterials(ctx.renderer);
const effects = createParticleSystem(ctx.scene);
ctx.cameraEffects = createCameraEffects();
ctx.match = createDefaultMatchState();
const ui = createHUD(ctx);
let routeRecorder;
let setupTeamCount = 2;
let setupPlayerTeamId = 'team-1';
let setupTeams = cloneDefaultTeams(setupTeamCount);
let garageBlueprint = loadGarageBlueprint();
let activeGarageCategory = 'chassis';
let activeSetupStep = 'team';
let garageFlash = { part: null, timer: 0 };
const pendingTeamColors = {};
let activeColorPickerTeamId = null;
const presetColors = [
  '#82ffcf', // Aurora Mint
  '#ff5f7d', // Crimson Pink
  '#ffcc66', // Volt Gold
  '#b991ff', // Phantom Violet
  '#33bbff', // Sky Blue
  '#ff8233', // Neon Orange
  '#55ff55', // Acid Green
  '#ff2200', // Crimson Red
  '#ff00ff', // Hot Pink
  '#ffd700', // Gold
  '#00ffcc', // Aqua
  '#ffffff'  // Pure White
];
const partSnapshotCache = new Map();
let partSnapshotRenderer = null;
const garageCategories = [
  { key: 'chassis', field: 'chassisId', label: 'Chassis' },
  { key: 'cabin', field: 'cabinId', label: 'Cabin' },
  { key: 'wheel', field: 'wheelId', label: 'Wheels' },
  { key: 'turret', field: 'turretId', label: 'Turret' },
  { key: 'armor', field: 'armorId', label: 'Armor' },
  { key: 'paintJob', field: 'paintJobId', label: 'Paint' },
];
const paintTextureFiles = {
  carbon: 'carbon.png',
  rust: 'rust.png',
  digital: 'digital_camo.png',
  hazard: 'hazard.png',
  oil: 'oil_slick.png',
  camo: 'desert_camo.png',
  graffiti: 'graffiti.png',
  flake: 'metal_flake.png',
  matte: 'matte_metal.png',
  circuit: 'circuit.png',
  tiger: 'tiger.png',
  interceptor: 'interceptor.png',
  lava: 'lava.png',
  pearl: 'pearl.png',
  panel: 'mecha_panels.png',
  'hex-camo': 'hex_camo.png',
  dust: 'moon_dust.png',
  shark: 'shark_art.png',
  grid: 'synth_grid.png',
  scar: 'scratched_primer.png',
};
const partPaintTargets = {
  wheel: {
    title: 'Wheels Paint',
    colorKey: 'wheelPaintColor',
    textureKey: 'wheelPaintTextureId',
    customDataKey: 'wheelCustomTextureData',
    customNameKey: 'wheelCustomTextureName',
    tintKey: 'wheelPaintTint',
  },
  turret: {
    title: 'Turret Paint',
    colorKey: 'turretPaintColor',
    textureKey: 'turretPaintTextureId',
    customDataKey: 'turretCustomTextureData',
    customNameKey: 'turretCustomTextureName',
    tintKey: 'turretPaintTint',
  },
};
setupTeams.forEach((team) => {
  pendingTeamColors[team.id] = team.color;
});

buildMap(ctx, materials);
ctx.navigation = generateNavigationGraph(ctx);
routeRecorder = createRouteRecorder(ctx, document.querySelector('#recordRouteButton'));
createPickups(ctx, physics);

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTeamBuilder() {
  ui.teamCountButtons.forEach((button) => {
    button.classList.toggle('selected', Number(button.dataset.teamCount) === setupTeamCount);
  });
  ui.teamBuilder.innerHTML = setupTeams.map((team) => {
    const isPickerActive = activeColorPickerTeamId === team.id;
    return `
    <article class="team-card ${team.id === setupPlayerTeamId ? 'selected' : ''} ${isPickerActive ? 'has-picker' : ''}" style="--team-color:${pendingTeamColors[team.id] || team.color}" data-team-id="${team.id}">
      <button class="team-flag" type="button" data-team-flag="${team.id}" aria-label="Join ${esc(team.name)}">
        <span>${esc(team.flagLabel)}</span>
      </button>
      <label>
        <span>Team Name</span>
        <input data-team-name="${team.id}" maxlength="16" value="${esc(team.name)}" />
      </label>
      
      <div class="team-color-section">
        <span>Color</span>
        <div class="team-color-trigger-row">
          <button type="button" class="team-color-trigger" data-team-color-trigger="${team.id}" style="background-color: ${pendingTeamColors[team.id] || team.color}" aria-label="Open color picker"></button>
          <span class="team-color-hex-label">${(pendingTeamColors[team.id] || team.color).toUpperCase()}</span>
        </div>
        
        ${isPickerActive ? `
        <div class="team-color-picker-panel">
          <div class="preset-swatches">
            ${presetColors.map((c) => `
              <button type="button" class="color-swatch ${c === (pendingTeamColors[team.id] || team.color) ? 'selected' : ''}" data-team-swatch="${team.id}" data-color="${c}" style="background-color: ${c}" aria-label="Select color ${c}"></button>
            `).join('')}
          </div>
          <div class="custom-color-row">
            <div class="custom-color-input-wrapper">
              <input type="color" data-team-custom-color="${team.id}" value="${pendingTeamColors[team.id] || team.color}" aria-label="Custom color picker" />
              <input type="text" data-team-custom-hex="${team.id}" value="${(pendingTeamColors[team.id] || team.color).toUpperCase()}" maxlength="7" aria-label="Custom color hex" />
            </div>
            <button type="button" class="team-color-accept-btn" data-team-color-accept="${team.id}">OK</button>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="team-size-stepper">
        <span>Players</span>
        <button type="button" data-team-dec="${team.id}">-</button>
        <strong>${team.playerCount}</strong>
        <button type="button" data-team-inc="${team.id}">+</button>
      </div>
      <p>${team.id === setupPlayerTeamId ? 'Your squad' : 'AI squad'}</p>
    </article>
    `;
  }).join('');
}

function setTeamCount(count) {
  setupTeamCount = count;
  const previous = new Map(setupTeams.map((team) => [team.id, team]));
  setupTeams = cloneDefaultTeams(count).map((team) => ({ ...team, ...(previous.get(team.id) || {}) }));
  setupTeams.forEach((team) => {
    pendingTeamColors[team.id] = pendingTeamColors[team.id] || team.color;
  });
  if (!setupTeams.some((team) => team.id === setupPlayerTeamId)) setupPlayerTeamId = setupTeams[0].id;
  renderTeamBuilder();
}

function statPercent(value, min, max) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function renderGarageStats(stats) {
  const rows = [
    ['Speed', statPercent(stats.maxForwardSpeed, 12, 24), stats.maxForwardSpeed.toFixed(1)],
    ['Launch', statPercent(stats.acceleration, 4, 10), stats.acceleration.toFixed(1)],
    ['Armor', statPercent(stats.maxHealth, 70, 180), Math.round(stats.maxHealth)],
    ['Handling', statPercent(stats.steerRate + stats.steerResponse * 0.08, 0.9, 1.95), stats.steerRate.toFixed(2)],
    ['Turret', statPercent(stats.turretTurnRate, 5, 11), stats.turretTurnRate.toFixed(1)],
  ];
  return rows.map(([label, pct, value]) => `
    <div class="garage-stat">
      <span>${label}</span>
      <b><i style="width:${pct}%"></i></b>
      <strong>${value}</strong>
    </div>
  `).join('');
}

const statDeltaSpecs = [
  ['Speed', (stats) => stats.maxForwardSpeed, 1],
  ['Launch', (stats) => stats.acceleration, 1],
  ['Armor', (stats) => stats.maxHealth, 0],
  ['Handling', (stats) => stats.steerRate + stats.steerResponse * 0.08, 2],
  ['Turret', (stats) => stats.turretTurnRate, 1],
];

function formatDelta(value, decimals) {
  const rounded = Number(value.toFixed(decimals));
  if (Math.abs(rounded) <= (decimals ? 0.01 : 0)) return null;
  return `${rounded > 0 ? '+' : ''}${decimals ? rounded.toFixed(decimals) : Math.round(rounded)}`;
}

function renderPartDeltas(field, partId) {
  const currentStats = buildGarageVehicleDefinition(garageBlueprint).stats;
  const nextStats = buildGarageVehicleDefinition({ ...garageBlueprint, [field]: partId }).stats;
  const rows = statDeltaSpecs
    .map(([label, read, decimals]) => {
      const text = formatDelta(read(nextStats) - read(currentStats), decimals);
      if (!text) return '';
      const positive = text.startsWith('+');
      return `<span class="part-delta ${positive ? 'positive' : 'negative'}"><b>${label}</b>${text}</span>`;
    })
    .filter(Boolean);
  return rows.length ? `<span class="part-deltas">${rows.join('')}</span>` : '<span class="part-deltas neutral"><span>Current balance</span></span>';
}

function createGaragePreview() {
  if (!ui.garagePreview) return null;
  const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ui.garagePreview.appendChild(previewRenderer.domElement);
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  previewCamera.position.set(4.8, 3.1, 6.1);
  previewCamera.lookAt(0, 0.45, 0);
  previewScene.add(new THREE.HemisphereLight(0xdffcff, 0x141516, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 6, 3);
  previewScene.add(key);
  const rim = new THREE.PointLight(0x82ffcf, 2.2, 9);
  rim.position.set(-3.8, 2.1, -3.2);
  previewScene.add(rim);
  const preview = {
    renderer: previewRenderer,
    scene: previewScene,
    camera: previewCamera,
    model: null,
    time: 0,
    yaw: 0,
    pitch: 0,
    dragging: false,
    idleTimer: 0,
    lastPointer: { x: 0, y: 0 },
  };
  ui.garagePreview.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    preview.dragging = true;
    preview.idleTimer = 0;
    preview.lastPointer.x = event.clientX;
    preview.lastPointer.y = event.clientY;
    try {
      ui.garagePreview.setPointerCapture?.(event.pointerId);
    } catch {}
  });
  ui.garagePreview.addEventListener('pointermove', (event) => {
    if (!preview.dragging) return;
    event.preventDefault();
    const dx = event.clientX - preview.lastPointer.x;
    const dy = event.clientY - preview.lastPointer.y;
    preview.yaw += dx * 0.01;
    preview.pitch = THREE.MathUtils.clamp(preview.pitch + dy * 0.007, -0.72, 0.72);
    preview.lastPointer.x = event.clientX;
    preview.lastPointer.y = event.clientY;
  });
  const stopDrag = (event) => {
    if (!preview.dragging) return;
    preview.dragging = false;
    preview.idleTimer = 0;
    try {
      ui.garagePreview.releasePointerCapture?.(event.pointerId);
    } catch {}
  };
  ui.garagePreview.addEventListener('pointerup', stopDrag);
  ui.garagePreview.addEventListener('pointercancel', stopDrag);
  ui.garagePreview.addEventListener('pointerleave', stopDrag);
  return preview;
}

const garagePreview = createGaragePreview();

function rebuildGaragePreview() {
  if (!garagePreview) return;
  if (garagePreview.model) {
    garagePreview.scene.remove(garagePreview.model);
    garagePreview.model.traverse((item) => {
      if (item.geometry) item.geometry.dispose?.();
    });
  }
  const preview = partPaintTargets[activeGarageCategory]
    ? createGaragePartPortraitGroup(materials, garageBlueprint, activeGarageCategory)
    : createVehiclePreviewGroup(materials, garageBlueprint);
  garagePreview.model = preview.group;
  garagePreview.model.position.y = activeGarageCategory === 'wheel' ? 0.3 : activeGarageCategory === 'turret' ? 0.05 : -0.3;
  garagePreview.model.scale.setScalar(activeGarageCategory === 'wheel' ? 3.4 : activeGarageCategory === 'turret' ? 1.8 : 1);
  garagePreview.scene.add(garagePreview.model);
}

function updateGaragePreview(dt) {
  if (!garagePreview || !ui.garagePreview || ui.matchMenu.classList.contains('hidden') || activeSetupStep !== 'vehicle') return;
  const width = Math.max(260, ui.garagePreview.clientWidth || 360);
  const height = Math.max(220, ui.garagePreview.clientHeight || 260);
  garagePreview.renderer.setSize(width, height, false);
  garagePreview.camera.aspect = width / height;
  if (activeGarageCategory === 'wheel') {
    garagePreview.camera.position.set(2.1, 1.25, 2.6);
    garagePreview.camera.lookAt(0, 0.25, 0);
  } else if (activeGarageCategory === 'turret') {
    garagePreview.camera.position.set(2.6, 1.8, 3.25);
    garagePreview.camera.lookAt(0, 0.3, 0.4);
  } else {
    garagePreview.camera.position.set(4.8, 3.1, 6.1);
    garagePreview.camera.lookAt(0, 0.45, 0);
  }
  garagePreview.camera.updateProjectionMatrix();
  garagePreview.time += dt;
  if (garagePreview.model) {
    if (garagePreview.dragging) garagePreview.idleTimer = 0;
    else {
      garagePreview.idleTimer += dt;
      if (garagePreview.idleTimer > 1.3) garagePreview.yaw += dt * 0.62;
    }
    garagePreview.model.rotation.set(garagePreview.pitch, garagePreview.yaw, 0);
    const baseY = activeGarageCategory === 'wheel' ? 0.3 : activeGarageCategory === 'turret' ? 0.05 : -0.3;
    garagePreview.model.position.y = baseY + Math.sin(garagePreview.time * 2.4) * 0.035;
    
    if (garageFlash.timer > 0) {
      garageFlash.timer -= dt;
      // paintJob doesn't have a distinct group, fallback to chassis or root
      const targetGroup = garagePreview.model.getObjectByName(garageFlash.part) || garagePreview.model.getObjectByName('chassis') || garagePreview.model;
      if (targetGroup) {
        targetGroup.visible = Math.floor(garageFlash.timer * 12) % 2 === 0;
        if (garageFlash.timer <= 0) targetGroup.visible = true;
      }
    }
  }
  garagePreview.renderer.render(garagePreview.scene, garagePreview.camera);
}

function renderColorControl(key, label, intensityKey, intensityLabel) {
  const color = garageBlueprint[key];
  const intensity = garageBlueprint[intensityKey];
  return `
    <article class="garage-color-control" style="--picked:${esc(color)}">
      <header>
        <span>${label}</span>
        <b>${esc(color.toUpperCase())}</b>
      </header>
      <div class="garage-color-picker-row">
        <input type="color" data-garage-color="${key}" value="${esc(color)}" aria-label="${label} color" />
        <input type="text" data-garage-color-hex="${key}" value="${esc(color.toUpperCase())}" maxlength="7" aria-label="${label} hex color" />
      </div>
      <label class="garage-slider">
        <span>${intensityLabel}</span>
        <input type="range" data-garage-slider="${intensityKey}" min="0" max="200" step="1" value="${intensity}" />
        <output>${intensity}%</output>
      </label>
    </article>
  `;
}

function paintTextureUrl(textureId) {
  const file = paintTextureFiles[textureId];
  return file ? `/textures/${file}` : '';
}

function renderPaintCards() {
  return `
    <div class="paint-card-grid">
      ${garagePartCatalog.paintJob.map((part) => {
        const colors = part.colors || ['#232323', '#868686', '#d6a24a'];
        const textureUrl = paintTextureUrl(part.texture);
        const selected = garageBlueprint.paintJobId === part.id;
        const previewStyle = [
          `--paint-a:${colors[0]}`,
          `--paint-b:${colors[1]}`,
          `--paint-c:${colors[2]}`,
          textureUrl ? `--paint-preview:url('${textureUrl}')` : '',
        ].filter(Boolean).join(';');
        return `
          <button type="button" class="paint-card ${selected ? 'selected' : ''}" data-garage-part="${part.id}" style="${previewStyle}">
            <span class="paint-preview"></span>
            <span class="paint-copy">
              <strong>${esc(part.name)}</strong>
              <em>${esc(part.blurb)}</em>
              <i class="paint-palette">
                ${colors.map((color) => `<b style="--chip:${esc(color)}"></b>`).join('')}
              </i>
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function textureLabel(textureId) {
  if (!textureId) return 'Solid Color';
  return garagePartCatalog.paintJob.find((part) => part.texture === textureId)?.name || 'Texture';
}

function renderPartPaintControls(category) {
  const target = partPaintTargets[category.key];
  if (!target) return '';
  const color = garageBlueprint[target.colorKey];
  const textureId = garageBlueprint[target.textureKey];
  const customName = garageBlueprint[target.customNameKey];
  const hasImport = Boolean(garageBlueprint[target.customDataKey]);
  const textureOptions = [
    { id: '', name: 'Solid Color', blurb: 'Clean uninterrupted paint.', colors: [color, color, color] },
    ...garagePartCatalog.paintJob.map((part) => ({ id: part.texture, name: part.name, blurb: part.blurb, colors: part.colors })),
  ];

  return `
    <section class="part-paint-panel" data-part-paint-panel="${category.key}">
      <header>
        <span>${target.title}</span>
        <b>${hasImport ? esc(customName || 'Imported texture') : esc(textureLabel(textureId))}</b>
      </header>
      <div class="garage-color-grid part-paint-color-grid">
        ${renderColorControl(target.colorKey, target.title, target.tintKey, 'Texture Tint')}
      </div>
      <div class="part-texture-grid">
        ${textureOptions.map((part) => {
          const colors = part.colors || [color, color, color];
          const textureUrl = paintTextureUrl(part.id);
          const selected = !hasImport && textureId === part.id;
          const previewStyle = [
            `--paint-a:${colors[0]}`,
            `--paint-b:${colors[1]}`,
            `--paint-c:${colors[2]}`,
            textureUrl ? `--paint-preview:url('${textureUrl}')` : '',
          ].filter(Boolean).join(';');
          return `
            <button type="button" class="part-texture-card ${selected ? 'selected' : ''}" data-garage-part-texture-target="${category.key}" data-garage-part-texture="${esc(part.id)}" style="${previewStyle}">
              <span class="paint-preview"></span>
              <strong>${esc(part.name)}</strong>
            </button>
          `;
        }).join('')}
      </div>
      <div class="garage-import-actions">
        <label class="garage-import-button">
          <input type="file" data-garage-texture-import="${category.key}" accept="image/*" />
          <span>Import Texture</span>
        </label>
        <button type="button" data-garage-clear-texture="${category.key}" ${hasImport ? '' : 'disabled'}>Clear Import</button>
      </div>
    </section>
  `;
}

function snapshotCacheKey(category, partId) {
  const textureKey = garageBlueprint.customTextureData ? `${garageBlueprint.customTextureName}:${garageBlueprint.customTextureData.length}` : '';
  const wheelTextureKey = garageBlueprint.wheelCustomTextureData ? `${garageBlueprint.wheelCustomTextureName}:${garageBlueprint.wheelCustomTextureData.length}` : '';
  const turretTextureKey = garageBlueprint.turretCustomTextureData ? `${garageBlueprint.turretCustomTextureName}:${garageBlueprint.turretCustomTextureData.length}` : '';
  return [
    category.key,
    partId,
    garageBlueprint.chassisId,
    garageBlueprint.cabinId,
    garageBlueprint.wheelId,
    garageBlueprint.turretId,
    garageBlueprint.armorId,
    garageBlueprint.paintJobId,
    garageBlueprint.paintColor,
    garageBlueprint.trimColor,
    garageBlueprint.glowColor,
    garageBlueprint.paintTint,
    garageBlueprint.wheelPaintColor,
    garageBlueprint.wheelPaintTextureId,
    garageBlueprint.wheelPaintTint,
    wheelTextureKey,
    garageBlueprint.turretPaintColor,
    garageBlueprint.turretPaintTextureId,
    garageBlueprint.turretPaintTint,
    turretTextureKey,
    garageBlueprint.trimIntensity,
    garageBlueprint.glowIntensity,
    garageBlueprint.materialStyle,
    textureKey,
  ].join('|');
}

function disposePreviewGroup(group) {
  group?.traverse((item) => {
    item.geometry?.dispose?.();
  });
}

function createSnapshotRenderer() {
  if (partSnapshotRenderer) return partSnapshotRenderer;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(180, 118, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 180 / 118, 0.1, 70);
  camera.position.set(4.8, 2.9, 5.6);
  camera.lookAt(0, 0.35, 0);
  scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x191a1d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6a24a, 1.35);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  partSnapshotRenderer = { renderer, scene, camera };
  return partSnapshotRenderer;
}

function renderPartSnapshot(category, partId) {
  const key = snapshotCacheKey(category, partId);
  if (partSnapshotCache.has(key)) return partSnapshotCache.get(key);
  const { renderer, scene, camera } = createSnapshotRenderer();
  const spec = { ...garageBlueprint, [category.field]: partId };
  const preview = partPaintTargets[category.key]
    ? createGaragePartPortraitGroup(materials, spec, category.key)
    : createVehiclePreviewGroup(materials, spec);
  if (category.key === 'wheel') {
    camera.position.set(1.45, 0.92, 1.85);
    camera.lookAt(0, 0.05, 0);
    preview.group.position.set(0, 0, 0);
    preview.group.scale.setScalar(2.35);
    preview.group.rotation.set(-0.1, 0.82, 0);
  } else if (category.key === 'turret') {
    camera.position.set(1.9, 1.35, 2.45);
    camera.lookAt(0, 0.24, 0.45);
    preview.group.position.set(0, 0, 0);
    preview.group.scale.setScalar(1.45);
    preview.group.rotation.set(-0.1, 0.62, 0);
  } else {
    camera.position.set(4.8, 2.9, 5.6);
    camera.lookAt(0, 0.35, 0);
    preview.group.position.set(0, -0.28, 0);
    preview.group.scale.setScalar(1);
    preview.group.rotation.set(-0.1, 0.72, 0);
  }
  scene.add(preview.group);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/webp', 0.82);
  scene.remove(preview.group);
  disposePreviewGroup(preview.group);
  partSnapshotCache.set(key, dataUrl);
  if (partSnapshotCache.size > 240) partSnapshotCache.delete(partSnapshotCache.keys().next().value);
  return dataUrl;
}

function updatePartSnapshots(category) {
  if (category.key === 'paintJob') return;
  const images = [...ui.garageControls.querySelectorAll('[data-part-snapshot]')];
  let index = 0;
  const pump = () => {
    const end = Math.min(images.length, index + 4);
    for (; index < end; index += 1) {
      const img = images[index];
      const [key, partId] = img.dataset.partSnapshot.split(':');
      const snapshotCategory = garageCategories.find((item) => item.key === key);
      if (!snapshotCategory) continue;
      img.src = renderPartSnapshot(snapshotCategory, partId);
    }
    if (index < images.length) window.setTimeout(pump, 0);
  };
  window.setTimeout(pump, 0);
}

function renderGaragePartCards(currentCategory) {
  if (currentCategory.key === 'paintJob') return renderPaintCards();
  return `
    <div class="garage-part-grid">
      ${garagePartCatalog[currentCategory.key].map((part) => `
        <button type="button" class="garage-part ${garageBlueprint[currentCategory.field] === part.id ? 'selected' : ''}" data-garage-part="${part.id}">
          <img class="part-snapshot" data-part-snapshot="${currentCategory.key}:${part.id}" alt="${esc(part.name)} 3D preview" />
          <span class="part-copy">
            <strong>${esc(part.name)}</strong>
            <em>${esc(part.blurb)}</em>
            ${renderPartDeltas(currentCategory.field, part.id)}
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderGarageBuilder() {
  garageBlueprint = sanitizeGarageBlueprint(garageBlueprint);
  const def = buildGarageVehicleDefinition(garageBlueprint);
  const currentCategory = garageCategories.find((item) => item.key === activeGarageCategory) || garageCategories[0];
  if (ui.garageTitle) ui.garageTitle.textContent = def.name;
  ui.garageControls.innerHTML = `
    <div class="garage-tabs">
      ${garageCategories.map((cat) => `<button type="button" class="${cat.key === currentCategory.key ? 'selected' : ''}" data-garage-category="${cat.key}">${cat.label}</button>`).join('')}
    </div>
    ${renderGaragePartCards(currentCategory)}
    ${renderPartPaintControls(currentCategory)}
    <div class="garage-color-grid">
      ${renderColorControl('paintColor', 'Paint', 'paintTint', 'Texture Tint')}
      ${renderColorControl('trimColor', 'Trim', 'trimIntensity', 'Trim Intensity')}
      ${renderColorControl('glowColor', 'Glow', 'glowIntensity', 'Glow Intensity')}
    </div>
    <div class="garage-appearance-panel">
      <section class="garage-material-picker">
        <header>
          <span>Material</span>
          <b>${esc(garageMaterialStyles.find((style) => style.id === garageBlueprint.materialStyle)?.name || 'Metal')}</b>
        </header>
        <div class="garage-material-options">
          ${garageMaterialStyles.map((style) => `
            <button type="button" class="${style.id === garageBlueprint.materialStyle ? 'selected' : ''}" data-garage-material="${style.id}">
              <strong>${esc(style.name)}</strong>
              <span>${esc(style.blurb)}</span>
            </button>
          `).join('')}
        </div>
      </section>
      <section class="garage-texture-import">
        <header>
          <span>Texture Source</span>
          <b>${garageBlueprint.customTextureData ? esc(garageBlueprint.customTextureName || 'Imported texture') : esc(def.paintJob.name)}</b>
        </header>
        <div class="garage-import-actions">
          <label class="garage-import-button">
            <input type="file" data-garage-texture-import="body" accept="image/*" />
            <span>Import Texture</span>
          </label>
          <button type="button" data-garage-clear-texture="body" ${garageBlueprint.customTextureData ? '' : 'disabled'}>Use Paint Texture</button>
        </div>
      </section>
    </div>
  `;
  ui.garageStats.innerHTML = renderGarageStats(getGarageStats(garageBlueprint));
  saveGarageBlueprint(garageBlueprint);
  rebuildGaragePreview();
  updatePartSnapshots(currentCategory);
}

function readMatchOptions() {
  const enabledWeapons = ui.weaponToggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value);
  return {
    playerName: ui.playerNameInput.value.trim() || 'Player',
    teams: setupTeams,
    playerTeamId: setupPlayerTeamId,
    playerBlueprint: garageBlueprint,
    enabledWeapons: enabledWeapons.length ? enabledWeapons : ['boom-missile', 'bouncy-wouncy', 'shock-lance', 'fire-mine', 'swarm-missiles', 'gravity-imploder', 'rail-slug', 'toxic-cask', 'devastator-nuke'],
  };
}

function renderSetupStep(step = activeSetupStep) {
  activeSetupStep = step;
  ui.teamSetupStep?.classList.toggle('active', step === 'team');
  ui.garagePanel?.classList.toggle('active', step === 'vehicle');
  ui.matchMenu?.classList.toggle('vehicle-mode', step === 'vehicle');
}

function openMenu(paused = true) {
  ui.matchMenu.classList.remove('hidden');
  renderSetupStep('team');
  if (ctx.match.active) ctx.match.paused = paused;
}

function beginMatch() {
  startMatch(ctx, materials, readMatchOptions(), physics);
  ui.matchMenu.classList.add('hidden');
  ui.resultsOverlay.classList.remove('visible');
  ctx.input.keys.clear();
  canvas.focus();
}

ui.startMatchButton.addEventListener('click', beginMatch);
ui.continueToGarageButton?.addEventListener('click', () => renderSetupStep('vehicle'));
ui.backToTeamButton?.addEventListener('click', () => renderSetupStep('team'));
ui.restartMatchButton.addEventListener('click', () => {
  ui.resultsOverlay.classList.remove('visible');
  openMenu(false);
});

function togglePauseMenu(show) {
  if (show) {
    ui.pauseMenu.classList.remove('hidden');
    ctx.match.paused = true;
  } else {
    ui.pauseMenu.classList.add('hidden');
    ui.settingsMenu.classList.add('hidden');
    ctx.match.paused = false;
  }
}

ui.resumeGameButton.addEventListener('click', () => togglePauseMenu(false));
ui.settingsButton.addEventListener('click', () => {
  ui.pauseMenu.classList.add('hidden');
  ui.settingsMenu.classList.remove('hidden');
});
ui.closeSettingsButton.addEventListener('click', () => {
  ui.settingsMenu.classList.add('hidden');
  ui.pauseMenu.classList.remove('hidden');
});
ui.restartGameButton.addEventListener('click', () => {
  togglePauseMenu(false);
  beginMatch();
});
ui.mainMenuButton.addEventListener('click', () => {
  togglePauseMenu(false);
  ctx.match.active = false;
  clearVehicles(ctx, physics);
  openMenu(false);
});

ui.teamCountButtons.forEach((button) => button.addEventListener('click', () => setTeamCount(Number(button.dataset.teamCount))));
ui.teamBuilder.addEventListener('click', (event) => {
  const flag = event.target.closest('[data-team-flag]');
  const dec = event.target.closest('[data-team-dec]');
  const inc = event.target.closest('[data-team-inc]');
  const colorTrigger = event.target.closest('[data-team-color-trigger]');
  const swatch = event.target.closest('[data-team-swatch]');
  const acceptBtn = event.target.closest('[data-team-color-accept]');

  if (flag) setupPlayerTeamId = flag.dataset.teamFlag;
  if (dec || inc) {
    const id = (dec || inc).dataset.teamDec || (dec || inc).dataset.teamInc;
    const team = setupTeams.find((item) => item.id === id);
    team.playerCount = Math.max(1, Math.min(7, team.playerCount + (inc ? 1 : -1)));
  }
  if (colorTrigger) {
    const id = colorTrigger.dataset.teamColorTrigger;
    activeColorPickerTeamId = activeColorPickerTeamId === id ? null : id;
  }
  if (swatch) {
    const id = swatch.dataset.teamSwatch;
    const color = swatch.dataset.color;
    const team = setupTeams.find((item) => item.id === id);
    pendingTeamColors[id] = color;
    if (team) team.color = color;
    event.target.closest('.team-card')?.style.setProperty('--team-color', color);
  }
  if (acceptBtn) {
    activeColorPickerTeamId = null;
  }
  renderTeamBuilder();
});
ui.teamBuilder.addEventListener('input', (event) => {
  const nameId = event.target.dataset.teamName;
  const customColorId = event.target.dataset.teamCustomColor;
  const customHexId = event.target.dataset.teamCustomHex;

  if (nameId) setupTeams.find((team) => team.id === nameId).name = event.target.value || 'Team';
  if (customColorId) {
    const team = setupTeams.find((item) => item.id === customColorId);
    pendingTeamColors[customColorId] = event.target.value;
    if (team) team.color = event.target.value;
    
    const triggerBtn = event.target.closest('.team-card')?.querySelector('.team-color-trigger');
    if (triggerBtn) triggerBtn.style.backgroundColor = event.target.value;
    
    const hexLabel = event.target.closest('.team-card')?.querySelector('.team-color-hex-label');
    if (hexLabel) hexLabel.textContent = event.target.value.toUpperCase();
    
    const textInput = event.target.closest('.custom-color-input-wrapper')?.querySelector('input[type="text"]');
    if (textInput) textInput.value = event.target.value.toUpperCase();
    
    event.target.closest('.team-card')?.style.setProperty('--team-color', event.target.value);
  }
  if (customHexId) {
    let val = event.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-f]{6}$/i.test(val)) {
      const team = setupTeams.find((item) => item.id === customHexId);
      pendingTeamColors[customHexId] = val;
      if (team) team.color = val;
      
      const triggerBtn = event.target.closest('.team-card')?.querySelector('.team-color-trigger');
      if (triggerBtn) triggerBtn.style.backgroundColor = val;
      
      const hexLabel = event.target.closest('.team-card')?.querySelector('.team-color-hex-label');
      if (hexLabel) hexLabel.textContent = val.toUpperCase();
      
      const colorInput = event.target.closest('.custom-color-input-wrapper')?.querySelector('input[type="color"]');
      if (colorInput) colorInput.value = val;
      
      event.target.closest('.team-card')?.style.setProperty('--team-color', val);
    }
  }
});
ui.teamBuilder.addEventListener('change', (event) => {
  if (event.target.dataset.teamName) renderTeamBuilder();
});
ui.garageControls.addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-garage-category]');
  const partButton = event.target.closest('[data-garage-part]');
  const materialButton = event.target.closest('[data-garage-material]');
  const textureButton = event.target.closest('[data-garage-part-texture]');
  const clearTextureButton = event.target.closest('[data-garage-clear-texture]');
  if (categoryButton) activeGarageCategory = categoryButton.dataset.garageCategory;
  if (partButton) {
    const category = garageCategories.find((item) => item.key === activeGarageCategory);
    garageBlueprint[category.field] = partButton.dataset.garagePart;
    garageFlash = { part: category.key, timer: 1.0 };
    if (category.key === 'paintJob') {
      const paintJob = garagePartCatalog.paintJob.find((part) => part.id === partButton.dataset.garagePart);
      if (paintJob?.colors) {
        [garageBlueprint.paintColor, garageBlueprint.trimColor, garageBlueprint.glowColor] = paintJob.colors;
        garageBlueprint.paintTint = 0;
        garageBlueprint.trimIntensity = 100;
        garageBlueprint.glowIntensity = 100;
        garageBlueprint.customTextureData = '';
        garageBlueprint.customTextureName = '';
      }
    }
  }
  if (materialButton) garageBlueprint.materialStyle = materialButton.dataset.garageMaterial;
  if (textureButton) {
    const target = partPaintTargets[textureButton.dataset.garagePartTextureTarget];
    if (target) {
      garageBlueprint[target.textureKey] = textureButton.dataset.garagePartTexture;
      garageBlueprint[target.customDataKey] = '';
      garageBlueprint[target.customNameKey] = '';
      garageBlueprint[target.tintKey] = textureButton.dataset.garagePartTexture ? 0 : 100;
    }
  }
  if (clearTextureButton) {
    const targetKey = clearTextureButton.dataset.garageClearTexture;
    const target = partPaintTargets[targetKey];
    if (target) {
      garageBlueprint[target.customDataKey] = '';
      garageBlueprint[target.customNameKey] = '';
      garageBlueprint[target.tintKey] = garageBlueprint[target.textureKey] ? 0 : 100;
    } else {
      garageBlueprint.customTextureData = '';
      garageBlueprint.customTextureName = '';
      garageBlueprint.paintTint = 0;
    }
  }
  if (categoryButton || partButton || materialButton || textureButton || clearTextureButton) {
    renderGarageBuilder();
    if (categoryButton) ui.garageControls.scrollTop = 0;
  }
});
ui.garageControls.addEventListener('input', (event) => {
  const colorKey = event.target.dataset.garageColor;
  const hexKey = event.target.dataset.garageColorHex;
  const sliderKey = event.target.dataset.garageSlider;
  let changed = false;
  if (colorKey) garageBlueprint[colorKey] = event.target.value;
  if (colorKey) changed = true;
  if (hexKey && /^#[0-9a-f]{6}$/i.test(event.target.value)) {
    garageBlueprint[hexKey] = event.target.value;
    changed = true;
  }
  if (sliderKey) garageBlueprint[sliderKey] = Number(event.target.value);
  if (sliderKey) changed = true;
  if (changed) renderGarageBuilder();
});
ui.garageControls.addEventListener('change', (event) => {
  const hexKey = event.target.dataset.garageColorHex;
  if (hexKey) {
    if (/^#[0-9a-f]{6}$/i.test(event.target.value)) garageBlueprint[hexKey] = event.target.value;
    renderGarageBuilder();
    return;
  }
  const importInput = event.target.closest('[data-garage-texture-import]');
  const file = importInput?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const target = partPaintTargets[importInput.dataset.garageTextureImport];
    if (target) {
      garageBlueprint[target.customDataKey] = String(reader.result || '');
      garageBlueprint[target.customNameKey] = file.name;
      garageBlueprint[target.tintKey] = 0;
    } else {
      garageBlueprint.customTextureData = String(reader.result || '');
      garageBlueprint.customTextureName = file.name;
      garageBlueprint.paintTint = 0;
    }
    renderGarageBuilder();
  });
  reader.readAsDataURL(file);
});
renderTeamBuilder();
renderGarageBuilder();
renderSetupStep('team');

setupInput(ctx, {
  onHudToggle(full) {
    ui.hud.classList.toggle('hud-full', full);
  },
  onKeyDown(code) {
    if (code === 'Tab') {
      ctx.match.scoreboardOpen = !ctx.match.scoreboardOpen;
      return;
    }
    if (code === 'Escape' && !ctx.match.ended) {
      if (!ctx.match.active) {
        if (ui.matchMenu.classList.contains('hidden')) openMenu(true);
      } else {
        if (ui.pauseMenu.classList.contains('hidden')) {
          togglePauseMenu(true);
        } else {
          togglePauseMenu(false);
        }
      }
      return;
    }
    if (!ctx.player || ctx.match.paused || ctx.match.ended) return;
    if (code === 'KeyR') return;
    const stats = getVehicleStats(ctx.player);
    if (code === 'KeyW') ctx.player.velocity.speed = Math.min(stats.maxForwardSpeed, ctx.player.velocity.speed + 3.5);
    if (code === 'KeyS') ctx.player.velocity.speed = ctx.player.velocity.speed > 1 ? Math.max(0, ctx.player.velocity.speed - 2.5) : Math.max(stats.maxReverseSpeed, ctx.player.velocity.speed - 1.8);
    if (code === 'KeyA') ctx.player.transform.yaw += 0.02 * Math.sign(ctx.player.velocity.speed || 1);
    if (code === 'KeyD') ctx.player.transform.yaw -= 0.02 * Math.sign(ctx.player.velocity.speed || 1);
  },
});

const cameraMenuPosition = new THREE.Vector3(0, 42, 68);
const cameraForward = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraShakeOffset = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();
let previousCameraMode = 'follow';

function updateCamera(dt) {
  if (!ctx.player) {
    ctx.camera.position.lerp(cameraMenuPosition, Math.min(1, dt * 2));
    ctx.camera.lookAt(0, 0, 0);
    return;
  }
  if (!ctx.cameraBasePos) ctx.cameraBasePos = ctx.camera.position.clone();

  cameraForward.set(Math.sin(ctx.player.transform.yaw), 0, Math.cos(ctx.player.transform.yaw));
  const carPosition = ctx.player.renderable.group.position;
  const rearView = ctx.input.keys.has('KeyX');
  const cameraMode = rearView ? 'rear' : 'follow';
  ctx.cameraMode = cameraMode;
  cameraDesired.copy(carPosition).addScaledVector(cameraForward, rearView ? 11 : -11);
  cameraDesired.y += 5.2;
  if (cameraMode !== previousCameraMode) ctx.cameraBasePos.copy(cameraDesired);
  else ctx.cameraBasePos.lerp(cameraDesired, Math.min(1, dt * 5));
  previousCameraMode = cameraMode;
  
  const shake = ctx.cameraEffects.update(dt);
  cameraShakeOffset.set(shake.x, shake.y, shake.z);
  ctx.camera.position.copy(ctx.cameraBasePos).add(cameraShakeOffset);
  
  cameraLookAt.copy(carPosition).addScaledVector(cameraForward, rearView ? -8 : 8);
  cameraLookAt.y += 1.4;
  ctx.camera.lookAt(cameraLookAt);
}

let lastFrameTime = performance.now();
function animate() {
  ctx.stats.begin();
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.033);
  lastFrameTime = now;

  updateAim(ctx, dt);
  if (ctx.match.active && !ctx.match.paused && !ctx.match.ended) {
    updateAI(ctx, dt);
    updateVehicles(ctx, dt, effects);
    updatePickups(ctx, dt);
    updateWeapons(ctx, physics, dt, effects);
    updateDamageVisuals(ctx, dt);
    updateMatch(ctx, dt);
  }
  routeRecorder.update(dt);
  effects.update(dt);
  updateGaragePreview(dt);
  physics.step();
  updateCamera(dt);
  updateHUD(ctx, ui, dt);
  drawMinimap(ctx, ui, dt);
  ctx.composer.render();
  ctx.stats.end();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => resizeContext(ctx));
window.etherDebug = { ctx, physics };
animate();
canvas.focus();
