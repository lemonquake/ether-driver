import './styles.css';
import * as THREE from 'three';
import { createGameContext, resizeContext } from './core/GameContext.js';
import { setupInput } from './core/InputSystem.js';
import { createRapierPhysics } from './physics/RapierPhysics.js';
import { createMaterials } from './world/materials.js';
import { mapRegistry } from './data/maps.js';
import { updateVehicles } from './vehicles/VehicleSystem.js';
import { createParticleSystem } from './effects/ParticleSystem.js';
import { createCameraEffects } from './effects/CameraEffectsSystem.js';
import { createPickups, updatePickups, clearPickups } from './pickups/PickupSystem.js';
import { updateAim } from './combat/AimSystem.js';
import { updateWeapons } from './combat/WeaponSystem.js';
import { updateDamageVisuals } from './combat/DamageSystem.js';
import { updateAI } from './ai/AISystem.js';
import { generateNavigationGraph } from './ai/NavigationSystem.js';
import { createRouteRecorder } from './ai/AIRouteRecorder.js';
import { createHUD, drawMinimap, updateHUD, cleanupMVPPortrait } from './ui/HUDSystem.js';
import { getVehicleStats } from './data/vehicleCatalog.js';
import { buildGarageVehicleDefinition, garageMaterialStyles, garagePartCatalog, getGarageStats, loadGarageBlueprint, saveGarageBlueprint, sanitizeGarageBlueprint } from './data/vehicleParts.js';
import { createDefaultMatchState, startMatch, updateMatch, clearVehicles } from './match/MatchSystem.js';
import { cloneDefaultTeams } from './data/teams.js';
import { createGaragePartPortraitGroup, createVehiclePreviewGroup } from './vehicles/VehicleFactory.js';
import { loadProgression, buyPremiumPart, upgradeStat, UPGRADE_MAX_LEVELS, getExpRequirement } from './core/ProgressionSystem.js';
import { premiumPartDefinitions, PREMIUM_RARITIES } from './data/premiumParts.js';
import { GARAGE_BUILD_LIMIT, clearActiveGarageTemplateId, createGarageTemplate, deleteGarageTemplate, getActiveGarageTemplateId, loadGarageTemplates, recordGarageTemplateUse, refreshGarageCatalog, renameGarageTemplate, setActiveGarageTemplateId, updateGarageTemplate } from './data/vehicleParts.js';

const canvas = document.querySelector('#game');
const ctx = createGameContext(canvas);
const physics = await createRapierPhysics();
const materials = createMaterials(ctx.renderer);
const effects = createParticleSystem(ctx.scene);
ctx.cameraEffects = createCameraEffects();
ctx.materials = materials;
ctx._vehicleFactory = { createVehiclePreviewGroup };
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
let gameSetupKillLimit = 0;
let gameSetupTeamKillLimit = 0;
const pendingTeamColors = {};
let activeColorPickerTeamId = null;
const presetColors = [
  '#00a7ff', // Ion Blue
  '#ff2bd6', // Neon Magenta
  '#ffe600', // Hazard Yellow
  '#7c3cff', // Void Violet
  '#00f0ff', // Arc Cyan
  '#ff4a1c', // Reactor Orange
  '#d7ff19', // Acid Signal
  '#ff0055', // Laser Red
  '#b300ff', // Ultraviolet
  '#ffffff', // Pure White
  '#151bff', // Deep Core
  '#111827'  // Graphite
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

let selectedMapId = 'city';

function rebuildGameMap(mapId) {
  ctx.activeMapId = mapId;
  // 1. Traverse and dispose old map assets inside mapGroup to prevent memory leaks
  if (ctx.mapGroup) {
    ctx.mapGroup.traverse((object) => {
      if (object.isMesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
    ctx.scene.remove(ctx.mapGroup);
  }

  // 2. Setup fresh map group container
  ctx.mapGroup = new THREE.Group();
  ctx.scene.add(ctx.mapGroup);

  // Clear system collision/minimap/ramp/road arrays
  ctx.collisionShapes = [];
  ctx.minimapObjects = [];
  ctx.roads = [];
  ctx.specialTiles = [];
  ctx.ramps = [];
  ctx.pickups = [];
  ctx.beacons = [];

  // 3. Remove old pickups meshes and physical sensors
  clearPickups(ctx, physics);

  // 4. Override scene.add temporarily to group everything added by builders under mapGroup
  const originalSceneAdd = ctx.scene.add;
  ctx.scene.add = function (object) {
    if (ctx.mapGroup) {
      ctx.mapGroup.add(object);
    } else {
      originalSceneAdd.call(ctx.scene, object);
    }
  };

  // 5. Build selected map
  const mapData = mapRegistry[mapId] || mapRegistry.city;
  mapData.build(ctx, materials);

  // Restore scene.add
  ctx.scene.add = originalSceneAdd;

  // 6. Generate pathfinding grid and spawn pickup physical sensors
  ctx.navigation = generateNavigationGraph(ctx);
  createPickups(ctx, physics);

  // 7. Tune shadow-casting directional lights for soft, high-quality shadows
  ctx.scene.traverse((node) => {
    if (node.isDirectionalLight) {
      node.shadow.bias = -0.0005;
      node.shadow.camera.near = 0.5;
      node.shadow.camera.far = 450;
      node.shadow.camera.left = -250;
      node.shadow.camera.right = 250;
      node.shadow.camera.top = 250;
      node.shadow.camera.bottom = -250;
      node.shadow.mapSize.set(2048, 2048);
      node.shadow.needsUpdate = true;
    }
  });

  // 8. Generate dynamic PMREM reflection environment map & high-fidelity custom skybox backgrounds
  if (ctx.scene.background && ctx.scene.background.dispose) {
    ctx.scene.background.dispose();
  }
  if (ctx.scene.environment) {
    ctx.scene.environment.dispose();
    ctx.scene.environment = null;
  }

  // A. Build the High-Resolution Skybox (2048 x 1024)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2048;
  skyCanvas.height = 1024;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 1024);

  // B. Build the PMREM Reflections Gradient Canvas (512 x 256)
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 256;
  const envCtx = envCanvas.getContext('2d');
  const envGrad = envCtx.createLinearGradient(0, 0, 0, 256);

  if (mapId === 'city') {
    // High-fidelity Cyber Skybox
    skyGrad.addColorStop(0, '#06040c');     // deep space
    skyGrad.addColorStop(0.35, '#0b0818');  // cyber blue night
    skyGrad.addColorStop(0.6, '#260a3c');   // neon violet glow
    skyGrad.addColorStop(0.72, '#5a134a');  // cyber magenta haze
    skyGrad.addColorStop(0.85, '#75143a');  // horizon cyber glow
    skyGrad.addColorStop(1.0, '#090714');   // deep ground shadow

    // Reflection Map Gradient
    envGrad.addColorStop(0, '#090714');
    envGrad.addColorStop(0.45, '#12395a');
    envGrad.addColorStop(0.8, '#701452');
    envGrad.addColorStop(1.0, '#100a14');

    ctx.scene.fog = new THREE.FogExp2(0x090714, 0.0055);
  } else if (mapId === 'basin') {
    // High-fidelity Magma Wasteland Skybox
    skyGrad.addColorStop(0, '#0a0604');     // sulfur vacuum
    skyGrad.addColorStop(0.3, '#210c03');    // volcanic haze
    skyGrad.addColorStop(0.55, '#4f1401');   // obsidian red clouds
    skyGrad.addColorStop(0.72, '#922000');   // burning magma flare
    skyGrad.addColorStop(0.85, '#c53802');   // bright lava horizon
    skyGrad.addColorStop(1.0, '#180f0b');    // ash ground shadow

    // Reflection Map Gradient
    envGrad.addColorStop(0, '#180f0b');
    envGrad.addColorStop(0.45, '#6c2900');
    envGrad.addColorStop(0.8, '#911000');
    envGrad.addColorStop(1.0, '#0f0603');

    ctx.scene.fog = new THREE.FogExp2(0x180f0b, 0.0065);
  } else if (mapId === 'outpost') {
    // High-fidelity Sci-Fi Reactor Void Skybox
    skyGrad.addColorStop(0, '#030107');     // electromagnetic void
    skyGrad.addColorStop(0.35, '#0a051c');  // core purple
    skyGrad.addColorStop(0.55, '#04222c');  // deep tech cyan
    skyGrad.addColorStop(0.7, '#08483b');   // radioactive emerald
    skyGrad.addColorStop(0.85, '#0f6e52');  // bright toxic neon horizon
    skyGrad.addColorStop(1.0, '#0a0312');   // void ground shadow

    // Reflection Map Gradient
    envGrad.addColorStop(0, '#0a0312');
    envGrad.addColorStop(0.45, '#006575');
    envGrad.addColorStop(0.8, '#137018');
    envGrad.addColorStop(1.0, '#05010a');

    ctx.scene.fog = new THREE.FogExp2(0x0a0312, 0.0075);
  } else if (mapId === 'military') {
    // High-fidelity Tactical Military Green Skybox
    skyGrad.addColorStop(0, '#040806');     // deep tactical void
    skyGrad.addColorStop(0.35, '#07120a');  // tactical olive green
    skyGrad.addColorStop(0.55, '#0f2413');  // dark laser green
    skyGrad.addColorStop(0.72, '#183c1d');  // military green core
    skyGrad.addColorStop(0.85, '#2f5b35');  // bright tactical green horizon
    skyGrad.addColorStop(1.0, '#040806');   // deep ground shadow

    // Reflection Map Gradient
    envGrad.addColorStop(0, '#040806');
    envGrad.addColorStop(0.45, '#0f3c1d');
    envGrad.addColorStop(0.8, '#55ff55');
    envGrad.addColorStop(1.0, '#040806');

    ctx.scene.fog = new THREE.FogExp2(0x040806, 0.0065);
  } else if (mapId === 'hangar') {
    // High-fidelity Industrial Hangar Steel Skybox
    skyGrad.addColorStop(0, '#06070a');     // deep steel space
    skyGrad.addColorStop(0.35, '#12161f');  // cold industrial grey
    skyGrad.addColorStop(0.55, '#2c221e');  // warm rust glow
    skyGrad.addColorStop(0.72, '#5e381b');  // industrial orange glow
    skyGrad.addColorStop(0.85, '#8c4815');  // boiling lava horizon reflection
    skyGrad.addColorStop(1.0, '#06070a');   // deep ground shadow

    // Reflection Map Gradient
    envGrad.addColorStop(0, '#06070a');
    envGrad.addColorStop(0.45, '#35485a');
    envGrad.addColorStop(0.8, '#ff5f00');
    envGrad.addColorStop(1.0, '#06070a');

    ctx.scene.fog = new THREE.FogExp2(0x06070a, 0.0075);
  } else {
    // Default Sky
    skyGrad.addColorStop(0, '#8fb5d0');
    skyGrad.addColorStop(1.0, '#ffd8c4');

    envGrad.addColorStop(0, '#8fb5d0');
    envGrad.addColorStop(1.0, '#ffd8c4');

    ctx.scene.fog = new THREE.FogExp2(0x8fb5d0, 0.0065);
  }

  // Paint the gradients
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 2048, 1024);

  envCtx.fillStyle = envGrad;
  envCtx.fillRect(0, 0, 512, 256);

  // Paint intricate details onto the Skybox
  if (mapId === 'city') {
    // 1. Draw 250 gorgeous stars
    skyCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 250; i++) {
      const sx = Math.random() * 2048;
      const sy = Math.random() * 650; // top half of sky
      const size = Math.random() * 1.8 + 0.5;
      
      // Star dot
      skyCtx.beginPath();
      skyCtx.arc(sx, sy, size, 0, Math.PI * 2);
      skyCtx.fill();

      // Occasional glowing lens flare cross (4-point star)
      if (i % 24 === 0) {
        skyCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        skyCtx.lineWidth = 0.8;
        skyCtx.beginPath();
        skyCtx.moveTo(sx - 6, sy);
        skyCtx.lineTo(sx + 6, sy);
        skyCtx.moveTo(sx, sy - 6);
        skyCtx.lineTo(sx, sy + 6);
        skyCtx.stroke();
      }
    }

    // 2. Draw giant digital cyber moon
    const mx = 512;  // Left-ish sky position
    const my = 350;  // Slightly above horizon
    const mr = 110;  // Moon radius

    // Moon Glow
    const moonGlow = skyCtx.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * 2.2);
    moonGlow.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
    moonGlow.addColorStop(0.3, 'rgba(130, 255, 207, 0.15)');
    moonGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    skyCtx.fillStyle = moonGlow;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, mr * 2.2, 0, Math.PI * 2);
    skyCtx.fill();

    // Concentric digital neon rings
    skyCtx.strokeStyle = 'rgba(130, 255, 207, 0.28)';
    skyCtx.lineWidth = 1.5;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, mr * 1.35, 0, Math.PI * 2);
    skyCtx.stroke();

    skyCtx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    skyCtx.lineWidth = 1.0;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, mr * 1.6, 0, Math.PI * 2);
    skyCtx.stroke();

    // Moon Core Body (glowing cyan circle)
    const moonCore = skyCtx.createRadialGradient(mx, my, 0, mx, my, mr);
    moonCore.addColorStop(0, '#ffffff');
    moonCore.addColorStop(0.2, '#d7fffa');
    moonCore.addColorStop(0.8, '#82ffcf');
    moonCore.addColorStop(1.0, '#35cfb0');
    skyCtx.fillStyle = moonCore;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, mr, 0, Math.PI * 2);
    skyCtx.fill();

    // Horizontal scanning digital incisions/cuts
    skyCtx.fillStyle = '#06040c'; // Matches dark background color
    for (let y = my - mr; y < my + mr; y += 18) {
      if (Math.abs(y - my) < mr * 0.88) {
        const thickness = 2.8 + Math.sin((y - my) * 0.15) * 1.2;
        const moonW = Math.sqrt(mr * mr - (y - my) * (y - my));
        skyCtx.fillRect(mx - moonW - 2, y, moonW * 2 + 4, thickness);
      }
    }

    // 3. Draw a tech horizon wireframe grid
    skyCtx.strokeStyle = 'rgba(130, 255, 207, 0.08)';
    skyCtx.lineWidth = 1;
    const horizonY = 700;
    // Horizontal perspective lines
    for (let y = horizonY; y < 850; y += 16) {
      const opacity = (1.0 - (y - horizonY) / 150) * 0.12;
      skyCtx.strokeStyle = `rgba(130, 255, 207, ${opacity})`;
      skyCtx.beginPath();
      skyCtx.moveTo(0, y);
      skyCtx.lineTo(2048, y);
      skyCtx.stroke();
    }
  } else if (mapId === 'basin') {
    // Volcanic Sun and Heat Haze
    // 1. Draw solar embers
    for (let i = 0; i < 180; i++) {
      const sx = Math.random() * 2048;
      const sy = Math.random() * 700;
      const size = Math.random() * 2.8 + 0.8;
      
      const glow = skyCtx.createRadialGradient(sx, sy, 0, sx, sy, size * 2.5);
      glow.addColorStop(0, 'rgba(255, 120, 0, 0.8)');
      glow.addColorStop(0.4, 'rgba(255, 60, 0, 0.35)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      
      skyCtx.fillStyle = glow;
      skyCtx.beginPath();
      skyCtx.arc(sx, sy, size * 2.5, 0, Math.PI * 2);
      skyCtx.fill();
    }

    // 2. Draw giant dying solar giant (magma sun)
    const sx = 1433; // Right-ish sky
    const sy = 400;  // High horizon
    const sr = 170;  // Giant radius

    // Huge solar atmosphere glow
    const sunGlow = skyCtx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.8);
    sunGlow.addColorStop(0, 'rgba(255, 95, 0, 0.5)');
    sunGlow.addColorStop(0.4, 'rgba(180, 30, 0, 0.22)');
    sunGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    skyCtx.fillStyle = sunGlow;
    skyCtx.beginPath();
    skyCtx.arc(sx, sy, sr * 2.8, 0, Math.PI * 2);
    skyCtx.fill();

    // Sun core (burning yellow/white with magma dark spots)
    const sunCore = skyCtx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sunCore.addColorStop(0, '#ffffff');
    sunCore.addColorStop(0.2, '#ffe066');
    sunCore.addColorStop(0.6, '#ff6c00');
    sunCore.addColorStop(0.9, '#a51500');
    sunCore.addColorStop(1.0, '#3a0200');
    skyCtx.fillStyle = sunCore;
    skyCtx.beginPath();
    skyCtx.arc(sx, sy, sr, 0, Math.PI * 2);
    skyCtx.fill();

    // Magma solar flares (wavy horizontal dark plumes)
    skyCtx.fillStyle = 'rgba(20, 4, 0, 0.72)'; // Dark ash plumes
    for (let i = 0; i < 6; i++) {
      const py = sy - sr * 0.7 + Math.random() * sr * 1.4;
      const pw = Math.sqrt(sr * sr - (py - sy) * (py - sy)) * 1.6;
      skyCtx.beginPath();
      skyCtx.ellipse(sx + (Math.random() - 0.5) * 60, py, pw * 0.6, 6 + Math.random() * 8, 0.08, 0, Math.PI * 2);
      skyCtx.fill();
    }
  } else if (mapId === 'outpost') {
    // 1. Constellation digital grid network
    const points = [];
    for (let i = 0; i < 30; i++) {
      points.push({
        x: 100 + Math.random() * 1848,
        y: 100 + Math.random() * 500,
        r: Math.random() * 2.2 + 0.8
      });
    }

    // Draw glowing tech lines connecting nearest points
    skyCtx.strokeStyle = 'rgba(0, 255, 204, 0.14)';
    skyCtx.lineWidth = 1.0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const p2 = points[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 260) {
          skyCtx.beginPath();
          skyCtx.moveTo(p1.x, p1.y);
          skyCtx.lineTo(p2.x, p2.y);
          skyCtx.stroke();
        }
      }
    }

    // Draw point stars
    skyCtx.fillStyle = '#00ffcc';
    points.forEach(p => {
      skyCtx.beginPath();
      skyCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      skyCtx.fill();
      
      if (p.r > 2.0) {
        skyCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        skyCtx.beginPath();
        skyCtx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
        skyCtx.fill();
        skyCtx.fillStyle = '#00ffcc';
      }
    });

    // 2. Draw ringed gas giant planet (Neon Giant)
    const px = 1024; // Center sky
    const py = 320;  // High sky
    const pr = 140;  // Radius

    // Planet Atmospheric Outer Glow
    const planetGlow = skyCtx.createRadialGradient(px, py, pr * 0.8, px, py, pr * 2.0);
    planetGlow.addColorStop(0, 'rgba(0, 100, 255, 0.38)');
    planetGlow.addColorStop(0.4, 'rgba(0, 255, 204, 0.16)');
    planetGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    skyCtx.fillStyle = planetGlow;
    skyCtx.beginPath();
    skyCtx.arc(px, py, pr * 2.0, 0, Math.PI * 2);
    skyCtx.fill();

    // Planet Body (striped cyan, blue, purple)
    const bodyGrad = skyCtx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
    bodyGrad.addColorStop(0, '#0a051c');
    bodyGrad.addColorStop(0.35, '#2b0a5a');
    bodyGrad.addColorStop(0.6, '#006575');
    bodyGrad.addColorStop(0.85, '#00ffcc');
    bodyGrad.addColorStop(1.0, '#ffffff');

    skyCtx.fillStyle = bodyGrad;
    skyCtx.beginPath();
    skyCtx.arc(px, py, pr, 0, Math.PI * 2);
    skyCtx.fill();

    // Dynamic planetary rings (drawn as an inclined ellipse)
    skyCtx.save();
    skyCtx.strokeStyle = 'rgba(0, 255, 204, 0.62)';
    skyCtx.lineWidth = 14;
    skyCtx.beginPath();
    skyCtx.ellipse(px, py, pr * 2.2, pr * 0.35, -Math.PI / 9, 0, Math.PI * 2);
    skyCtx.stroke();
    
    skyCtx.strokeStyle = 'rgba(100, 50, 255, 0.28)';
    skyCtx.lineWidth = 6;
    skyCtx.beginPath();
    skyCtx.ellipse(px, py, pr * 2.45, pr * 0.40, -Math.PI / 9, 0, Math.PI * 2);
    skyCtx.stroke();
    skyCtx.restore();

    // Redraw front half of the planet to overlay the rings correctly!
    skyCtx.save();
    skyCtx.beginPath();
    skyCtx.arc(px, py, pr, -Math.PI * 0.9, Math.PI * 0.1);
    skyCtx.clip();
    skyCtx.fillStyle = bodyGrad;
    skyCtx.beginPath();
    skyCtx.arc(px, py, pr, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.restore();

    // 3. Draw arcing tech lightning path in the background
    skyCtx.strokeStyle = 'rgba(255, 43, 214, 0.35)';
    skyCtx.lineWidth = 2.5;
    skyCtx.shadowColor = '#ff2bd6';
    skyCtx.shadowBlur = 15;
    skyCtx.beginPath();
    let lx = 300 + Math.random() * 200;
    let ly = 100;
    skyCtx.moveTo(lx, ly);
    for (let i = 0; i < 8; i++) {
      lx += (Math.random() - 0.5) * 80 + 40;
      ly += Math.random() * 60 + 40;
      skyCtx.lineTo(lx, ly);
    }
    skyCtx.stroke();
    skyCtx.shadowBlur = 0; // Reset
  } else if (mapId === 'military') {
    // 1. Bubbling tactical green stars
    skyCtx.fillStyle = 'rgba(85, 255, 120, 0.65)';
    for (let i = 0; i < 180; i++) {
      const sx = Math.random() * 2048;
      const sy = Math.random() * 650;
      const size = Math.random() * 1.5 + 0.5;
      skyCtx.beginPath();
      skyCtx.arc(sx, sy, size, 0, Math.PI * 2);
      skyCtx.fill();
    }

    // 2. Giant holographic tactical radar crosshair scope
    const rx = 1500;
    const ry = 380;
    const rd = 120;

    // Glowing scope background circular waves
    skyCtx.strokeStyle = 'rgba(85, 255, 85, 0.22)';
    skyCtx.lineWidth = 1.5;
    skyCtx.beginPath();
    skyCtx.arc(rx, ry, rd, 0, Math.PI * 2);
    skyCtx.stroke();
    
    skyCtx.strokeStyle = 'rgba(85, 255, 85, 0.08)';
    skyCtx.beginPath();
    skyCtx.arc(rx, ry, rd * 1.45, 0, Math.PI * 2);
    skyCtx.stroke();

    // Crosshairs lines
    skyCtx.strokeStyle = 'rgba(85, 255, 85, 0.35)';
    skyCtx.lineWidth = 1.0;
    skyCtx.beginPath();
    // Horizontal crosshair
    skyCtx.moveTo(rx - rd * 1.6, ry);
    skyCtx.lineTo(rx - rd * 0.2, ry);
    skyCtx.moveTo(rx + rd * 0.2, ry);
    skyCtx.lineTo(rx + rd * 1.6, ry);
    // Vertical crosshair
    skyCtx.moveTo(rx, ry - rd * 1.6);
    skyCtx.lineTo(rx, ry - rd * 0.2);
    skyCtx.moveTo(rx, ry + rd * 0.2);
    skyCtx.lineTo(rx, ry + rd * 1.6);
    skyCtx.stroke();

    // Small telemetry data texts and dashes
    skyCtx.fillStyle = 'rgba(85, 255, 85, 0.45)';
    skyCtx.font = '10px Courier New, monospace';
    skyCtx.fillText('TARGET LOCK: SEC_04', rx - 55, ry - rd * 1.1);
    skyCtx.fillText('GRID REF: 50.1130', rx - 55, ry + rd * 1.15);

    // 3. Horizontal green scanner laser lines running across the sky
    skyCtx.strokeStyle = 'rgba(85, 255, 85, 0.05)';
    skyCtx.lineWidth = 1.0;
    for (let y = 150; y < 650; y += 45) {
      skyCtx.beginPath();
      skyCtx.moveTo(0, y);
      skyCtx.lineTo(2048, y);
      skyCtx.stroke();
    }
  } else if (mapId === 'hangar') {
    // 1. Rising warm embers from the lava deck
    skyCtx.fillStyle = 'rgba(255, 120, 30, 0.6)';
    for (let i = 0; i < 75; i++) {
      const sx = Math.random() * 2048;
      const sy = Math.random() * 700;
      const size = Math.random() * 2.2 + 0.8;
      skyCtx.beginPath();
      skyCtx.arc(sx, sy, size, 0, Math.PI * 2);
      skyCtx.fill();
    }

    // 2. High-altitude steel structural hangar trusses
    // Draw heavy diagonal truss beams
    skyCtx.strokeStyle = 'rgba(16, 18, 22, 0.96)';
    skyCtx.lineWidth = 26;
    skyCtx.beginPath();
    
    // Draw diagonal grid pattern
    for (let x = -200; x < 2200; x += 400) {
      skyCtx.moveTo(x, 0);
      skyCtx.lineTo(x + 400, 550);
      skyCtx.moveTo(x + 400, 0);
      skyCtx.lineTo(x, 550);
    }
    skyCtx.stroke();

    // Draw horizontal support chord beams
    skyCtx.lineWidth = 16;
    skyCtx.beginPath();
    skyCtx.moveTo(0, 100);
    skyCtx.lineTo(2048, 100);
    skyCtx.moveTo(0, 380);
    skyCtx.lineTo(2048, 380);
    skyCtx.stroke();

    // Draw glowing safety indicators & rivets at truss intersections
    skyCtx.fillStyle = 'rgba(255, 95, 0, 0.85)';
    for (let x = 0; x <= 2048; x += 200) {
      // Small glowing orange warning lights on the trusses
      skyCtx.beginPath();
      skyCtx.arc(x, 100, 4.5, 0, Math.PI * 2);
      skyCtx.arc(x, 380, 4.5, 0, Math.PI * 2);
      skyCtx.fill();
    }
  }

  // Create High-Res Sky Texture
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  ctx.scene.background = skyTexture;

  // C. Create PMREM Environment reflection texture using the blurred reflections gradient canvas
  const pmremGenerator = new THREE.PMREMGenerator(ctx.renderer);
  pmremGenerator.compileEquirectangularShader();

  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  const envRt = pmremGenerator.fromEquirectangular(envTexture);
  ctx.scene.environment = envRt.texture;

  // Clean up textures and generators to prevent memory leaks
  envTexture.dispose();
  pmremGenerator.dispose();

  // 9. Pre-allocate projectile PointLights & Meshes pool to completely eliminate real-time WebGL shader recompilation and mesh instantiation lag
  if (ctx.projectileLightPool) {
    ctx.projectileLightPool.forEach((light) => {
      ctx.scene.remove(light);
    });
  }
  ctx.projectileLightPool = [];
  for (let i = 0; i < 45; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 15, 1.8);
    light.position.set(0, -1000, 0);
    light.castShadow = false;
    ctx.scene.add(light);
    ctx.projectileLightPool.push(light);
  }

  if (ctx.projectileMeshPool) {
    if (ctx.projectileMeshPool.length > 0) {
      ctx.projectileMeshPool[0].geometry.dispose(); // Shared geometry
    }
    ctx.projectileMeshPool.forEach((mesh) => {
      ctx.scene.remove(mesh);
      mesh.material.dispose();
    });
  }
  ctx.projectileMeshPool = [];
  const projGeom = new THREE.SphereGeometry(1, 8, 8); // Reusable base geometry
  for (let i = 0; i < 45; i++) {
    const projMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(projGeom, projMat);
    mesh.position.set(0, -1000, 0);
    mesh.visible = false;
    mesh.isPooled = true; // Mark as pooled for high-performance recycling
    ctx.scene.add(mesh);
    ctx.projectileMeshPool.push(mesh);
  }
}

// --- Map Blueprint Drawings & Radar Sweeps ---
const radarBlips = {
  city: [
    { x: 90, y: 60, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 190, y: 130, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 80, y: 140, angle: 0, distance: 0, lastIntensity: 0 }
  ],
  basin: [
    { x: 60, y: 110, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 220, y: 70, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 140, y: 50, angle: 0, distance: 0, lastIntensity: 0 }
  ],
  outpost: [
    { x: 180, y: 60, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 100, y: 130, angle: 0, distance: 0, lastIntensity: 0 },
    { x: 70, y: 70, angle: 0, distance: 0, lastIntensity: 0 }
  ]
};

// Precompute blip angles and distances relative to the canvas center (140, 90)
Object.keys(radarBlips).forEach(mapId => {
  radarBlips[mapId].forEach(blip => {
    const dx = blip.x - 140;
    const dy = blip.y - 90;
    blip.angle = Math.atan2(dy, dx);
    if (blip.angle < 0) blip.angle += Math.PI * 2;
    blip.distance = Math.sqrt(dx * dx + dy * dy);
  });
});

let radarAngle = 0;

function drawMapBlueprints() {
  const mapIds = ['city', 'basin', 'outpost'];
  mapIds.forEach((mapId) => {
    const canvasEl = document.querySelector(`.map-blueprint-canvas[data-canvas-map="${mapId}"]`);
    if (!canvasEl) return;
    const c = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    
    // Clear canvas
    c.clearRect(0, 0, w, h);
    
    // Draw background tech grid lines
    c.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    c.lineWidth = 1;
    for (let x = 10; x < w; x += 20) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = 10; y < h; y += 20) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    
    if (mapId === 'city') {
      // --- Megalopolis Mayhem Blueprint ---
      // Outer border box
      c.strokeStyle = 'rgba(130, 255, 207, 0.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.rect(15, 10, w - 30, h - 20);
      c.stroke();
      
      // Corners crosshairs/indicators
      c.strokeStyle = 'rgba(130, 255, 207, 0.6)';
      c.lineWidth = 1;
      const cornerSize = 8;
      // top-left
      c.beginPath(); c.moveTo(10, 10); c.lineTo(10 + cornerSize, 10); c.moveTo(10, 10); c.lineTo(10, 10 + cornerSize); c.stroke();
      // top-right
      c.beginPath(); c.moveTo(w - 10, 10); c.lineTo(w - 10 - cornerSize, 10); c.moveTo(w - 10, 10); c.lineTo(w - 10, 10 + cornerSize); c.stroke();
      // bottom-left
      c.beginPath(); c.moveTo(10, h - 10); c.lineTo(10 + cornerSize, h - 10); c.moveTo(10, h - 10); c.lineTo(10, h - 10 - cornerSize); c.stroke();
      // bottom-right
      c.beginPath(); c.moveTo(w - 10, h - 10); c.lineTo(w - 10 - cornerSize, h - 10); c.moveTo(w - 10, h - 10); c.lineTo(w - 10, h - 10 - cornerSize); c.stroke();
      
      // Symmetrical Skyscraper blocks (drawn as structured grid squares)
      c.fillStyle = 'rgba(130, 255, 207, 0.08)';
      c.strokeStyle = 'rgba(130, 255, 207, 0.25)';
      c.lineWidth = 1;
      
      // Left blocks
      c.fillRect(40, 25, 45, 35); c.strokeRect(40, 25, 45, 35);
      c.fillRect(40, 72, 45, 35); c.strokeRect(40, 72, 45, 35);
      c.fillRect(40, 120, 45, 35); c.strokeRect(40, 120, 45, 35);
      
      // Right blocks
      c.fillRect(w - 85, 25, 45, 35); c.strokeRect(w - 85, 25, 45, 35);
      c.fillRect(w - 85, 72, 45, 35); c.strokeRect(w - 85, 72, 45, 35);
      c.fillRect(w - 85, 120, 45, 35); c.strokeRect(w - 85, 120, 45, 35);
      
      // Center roads lanes
      c.strokeStyle = 'rgba(130, 255, 207, 0.12)';
      c.beginPath();
      // Vertical central road
      c.moveTo(140, 10); c.lineTo(140, h - 10);
      // Horizontal central road
      c.moveTo(15, 90); c.lineTo(w - 15, 90);
      c.stroke();
      
      // Symmetrical launch ramps (wedges pointing inward to center 140, 90)
      c.fillStyle = 'rgba(130, 255, 207, 0.7)';
      c.strokeStyle = '#82ffcf';
      c.lineWidth = 1;
      
      // West ramp (points East)
      c.beginPath();
      c.moveTo(95, 83); c.lineTo(110, 90); c.lineTo(95, 97); c.closePath();
      c.fill(); c.stroke();
      
      // East ramp (points West)
      c.beginPath();
      c.moveTo(185, 83); c.lineTo(170, 90); c.lineTo(185, 97); c.closePath();
      c.fill(); c.stroke();
      
      // North ramp (points South)
      c.beginPath();
      c.moveTo(133, 50); c.lineTo(140, 65); c.lineTo(147, 50); c.closePath();
      c.fill(); c.stroke();
      
      // South ramp (points North)
      c.beginPath();
      c.moveTo(133, 130); c.lineTo(140, 115); c.lineTo(147, 130); c.closePath();
      c.fill(); c.stroke();
      
      // Overlay Tech Labels
      c.fillStyle = '#82ffcf';
      c.font = '700 8px monospace';
      c.fillText('GRID SIM: ACTIVE', 25, 22);
      c.fillText('SYS: CITY_MAYHEM', 25, 32);
      c.fillText('SCALE: 1:2.4KM', 190, 160);
      
    } else if (mapId === 'basin') {
      // --- Doom Basin Blueprint ---
      // Outer circular wasteland boundary
      c.strokeStyle = 'rgba(255, 101, 0, 0.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(140, 90, 78, 0, Math.PI * 2);
      c.stroke();
      
      // Radial ring loops
      c.strokeStyle = 'rgba(255, 101, 0, 0.12)';
      c.beginPath();
      c.arc(140, 90, 60, 0, Math.PI * 2);
      c.arc(140, 90, 42, 0, Math.PI * 2);
      c.stroke();
      
      // Corners crosshairs/indicators
      c.strokeStyle = 'rgba(255, 101, 0, 0.5)';
      c.lineWidth = 1;
      const cornerSize = 8;
      // top-left
      c.beginPath(); c.moveTo(10, 10); c.lineTo(10 + cornerSize, 10); c.moveTo(10, 10); c.lineTo(10, 10 + cornerSize); c.stroke();
      // top-right
      c.beginPath(); c.moveTo(w - 10, 10); c.lineTo(w - 10 - cornerSize, 10); c.moveTo(w - 10, 10); c.lineTo(w - 10, 10 + cornerSize); c.stroke();
      // bottom-left
      c.beginPath(); c.moveTo(10, h - 10); c.lineTo(10 + cornerSize, h - 10); c.moveTo(10, h - 10); c.lineTo(10, h - 10 - cornerSize); c.stroke();
      // bottom-right
      c.beginPath(); c.moveTo(w - 10, h - 10); c.lineTo(w - 10 - cornerSize, h - 10); c.moveTo(w - 10, h - 10); c.lineTo(w - 10, h - 10 - cornerSize); c.stroke();

      // Central Magma Pit boiling effect
      const grad = c.createRadialGradient(140, 90, 5, 140, 90, 26);
      grad.addColorStop(0, 'rgba(255, 60, 0, 0.7)');
      grad.addColorStop(0.5, 'rgba(255, 101, 0, 0.3)');
      grad.addColorStop(1, 'rgba(255, 30, 0, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(140, 90, 26, 0, Math.PI * 2);
      c.fill();
      
      c.strokeStyle = 'rgba(255, 60, 0, 0.4)';
      c.beginPath();
      c.arc(140, 90, 26, 0, Math.PI * 2);
      c.stroke();
      
      // Giant central ramps pointing North/South into the pit
      c.fillStyle = 'rgba(255, 101, 0, 0.75)';
      c.strokeStyle = '#ff6500';
      c.lineWidth = 1;
      
      // South-to-center ramp (points North)
      c.beginPath();
      c.moveTo(133, 62); c.lineTo(140, 48); c.lineTo(147, 62); c.closePath();
      c.fill(); c.stroke();
      
      // North-to-center ramp (points South)
      c.beginPath();
      c.moveTo(133, 118); c.lineTo(140, 132); c.lineTo(147, 118); c.closePath();
      c.fill(); c.stroke();
      
      // Corner pylons (desolate pillars)
      c.fillStyle = 'rgba(255, 101, 0, 0.1)';
      c.strokeStyle = 'rgba(255, 101, 0, 0.25)';
      const pylons = [[85, 45], [195, 45], [85, 135], [195, 135]];
      pylons.forEach(([px, py]) => {
        c.beginPath();
        c.arc(px, py, 6, 0, Math.PI * 2);
        c.fill(); c.stroke();
      });
      
      // Overlay Tech Labels
      c.fillStyle = '#ff6500';
      c.font = '700 8px monospace';
      c.fillText('ZONE: CRATER_DEPR', 25, 22);
      c.fillText('THERMAL: DANGER', 25, 32);
      c.fillText('SCALE: 1:3.2KM', 190, 160);
      
    } else if (mapId === 'outpost') {
      // --- Neon Outpost Blueprint ---
      // Cropped corner boundary outline (Octagon style for futuristic lab look)
      c.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(35, 10);
      c.lineTo(w - 35, 10);
      c.lineTo(w - 15, 30);
      c.lineTo(w - 15, h - 30);
      c.lineTo(w - 35, h - 10);
      c.lineTo(35, h - 10);
      c.lineTo(15, h - 30);
      c.lineTo(15, 30);
      c.closePath();
      c.stroke();
      
      // Corner crosshairs/indicators
      c.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      c.lineWidth = 1;
      const cornerSize = 8;
      // top-left
      c.beginPath(); c.moveTo(10, 10); c.lineTo(10 + cornerSize, 10); c.moveTo(10, 10); c.lineTo(10, 10 + cornerSize); c.stroke();
      // top-right
      c.beginPath(); c.moveTo(w - 10, 10); c.lineTo(w - 10 - cornerSize, 10); c.moveTo(w - 10, 10); c.lineTo(w - 10, 10 + cornerSize); c.stroke();
      // bottom-left
      c.beginPath(); c.moveTo(10, h - 10); c.lineTo(10 + cornerSize, h - 10); c.moveTo(10, h - 10); c.lineTo(10, h - 10 - cornerSize); c.stroke();
      // bottom-right
      c.beginPath(); c.moveTo(w - 10, h - 10); c.lineTo(w - 10 - cornerSize, h - 10); c.moveTo(w - 10, h - 10); c.lineTo(w - 10, h - 10 - cornerSize); c.stroke();
      
      // Symmetrical cross lanes/roads
      c.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      c.beginPath();
      c.moveTo(15, 90); c.lineTo(w - 15, 90);
      c.moveTo(140, 10); c.lineTo(140, h - 10);
      c.stroke();
      
      // High-voltage reactor cores (emissive cylinder shadows)
      c.fillStyle = 'rgba(0, 255, 204, 0.08)';
      c.strokeStyle = 'rgba(0, 255, 204, 0.3)';
      const cores = [[140, 90], [70, 90], [210, 90], [140, 45], [140, 135]];
      cores.forEach(([cx, cy], index) => {
        // Draw concentric glowing reactor structures
        c.beginPath();
        c.arc(cx, cy, index === 0 ? 12 : 8, 0, Math.PI * 2);
        c.fill(); c.stroke();
        
        c.beginPath();
        c.arc(cx, cy, index === 0 ? 6 : 4, 0, Math.PI * 2);
        c.stroke();
      });
      
      // Turbo grid tiles (chevrons drawn as high-speed vectors)
      c.strokeStyle = 'rgba(0, 255, 204, 0.4)';
      c.lineWidth = 1;
      const chevrons = [
        [100, 90], [110, 90], [120, 90], // pointing right ->
        [180, 90], [170, 90], [160, 90], // pointing left <-
      ];
      chevrons.forEach(([cx, cy]) => {
        c.beginPath();
        if (cx < 140) {
          c.moveTo(cx - 3, cy - 4); c.lineTo(cx + 1, cy); c.lineTo(cx - 3, cy + 4);
        } else {
          c.moveTo(cx + 3, cy - 4); c.lineTo(cx - 1, cy); c.lineTo(cx + 3, cy + 4);
        }
        c.stroke();
      });
      
      // Angle launching ramps bridging reactor walls
      c.fillStyle = 'rgba(255, 43, 214, 0.75)';
      c.strokeStyle = '#ff2bd6';
      c.lineWidth = 1;
      
      // Top-left diagonal ramp pointing South-East
      c.beginPath();
      c.moveTo(85, 52); c.lineTo(98, 65); c.lineTo(89, 74); c.closePath();
      c.fill(); c.stroke();
      
      // Bottom-right diagonal ramp pointing North-West
      c.beginPath();
      c.moveTo(195, 128); c.lineTo(182, 115); c.lineTo(191, 106); c.closePath();
      c.fill(); c.stroke();
      
      // Overlay Tech Labels
      c.fillStyle = '#00f0ff';
      c.font = '700 8px monospace';
      c.fillText('GRID: ULTRA_CHARGED', 25, 22);
      c.fillText('OUTPOST: ENERGIZED', 25, 32);
      c.fillText('SCALE: 1:1.9KM', 190, 160);
    }
  });
}

function animateRadars() {
  requestAnimationFrame(animateRadars);
  
  if (activeSetupStep !== 'game' || ui.matchMenu.classList.contains('hidden')) {
    return;
  }
  
  radarAngle = (radarAngle + 0.024) % (Math.PI * 2);
  
  const mapIds = ['city', 'basin', 'outpost'];
  mapIds.forEach((mapId) => {
    const canvasEl = document.querySelector(`.map-radar-canvas[data-canvas-radar="${mapId}"]`);
    if (!canvasEl) return;
    const c = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    
    c.clearRect(0, 0, w, h);
    
    // Draw sweep trail lines
    c.lineWidth = 1.2;
    for (let i = 0; i < 35; i++) {
      const angle = radarAngle - i * 0.012;
      const alpha = (1 - i / 35) * 0.12;
      c.strokeStyle = mapId === 'city' ? `rgba(130, 255, 207, ${alpha})` :
                      mapId === 'basin' ? `rgba(255, 101, 0, ${alpha})` :
                      `rgba(0, 240, 255, ${alpha})`;
      c.beginPath();
      c.moveTo(140, 90);
      c.lineTo(140 + Math.cos(angle) * 125, 90 + Math.sin(angle) * 125);
      c.stroke();
    }
    
    // Draw main sweep hand
    c.lineWidth = 2.0;
    c.strokeStyle = mapId === 'city' ? 'rgba(130, 255, 207, 0.85)' :
                    mapId === 'basin' ? 'rgba(255, 101, 0, 0.85)' :
                    'rgba(0, 240, 255, 0.85)';
    c.beginPath();
    c.moveTo(140, 90);
    c.lineTo(140 + Math.cos(radarAngle) * 125, 90 + Math.sin(radarAngle) * 125);
    c.stroke();
    
    // Draw center blip representing radar core
    c.fillStyle = mapId === 'city' ? 'rgba(130, 255, 207, 0.9)' :
                  mapId === 'basin' ? 'rgba(255, 101, 0, 0.9)' :
                  'rgba(0, 240, 255, 0.9)';
    c.beginPath();
    c.arc(140, 90, 2.5, 0, Math.PI * 2);
    c.fill();
    
    // Threat blips updating
    const blips = radarBlips[mapId];
    blips.forEach(blip => {
      let diff = radarAngle - blip.angle;
      if (diff < 0) diff += Math.PI * 2;
      
      if (diff >= 0 && diff < 0.08) {
        blip.lastIntensity = 1.0;
      } else {
        blip.lastIntensity = Math.max(0, blip.lastIntensity - 0.0075);
      }
      
      if (blip.lastIntensity > 0) {
        // Outer glowing ring
        c.fillStyle = `rgba(255, 30, 30, ${blip.lastIntensity * 0.35})`;
        c.beginPath();
        c.arc(blip.x, blip.y, 6.5, 0, Math.PI * 2);
        c.fill();
        
        // Inner hot core
        c.fillStyle = `rgba(255, 60, 60, ${blip.lastIntensity})`;
        c.beginPath();
        c.arc(blip.x, blip.y, 2.5, 0, Math.PI * 2);
        c.fill();
        
        // Threat flag text
        c.fillStyle = `rgba(255, 60, 60, ${blip.lastIntensity * 0.85})`;
        c.font = '700 6px monospace';
        c.fillText('ACTV', blip.x + 5, blip.y - 3);
      }
    });
  });
}

rebuildGameMap(selectedMapId);
drawMapBlueprints();
animateRadars();
routeRecorder = createRouteRecorder(ctx, document.querySelector('#recordRouteButton'));

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
          <button type="button" class="team-color-trigger" data-team-color-trigger="${team.id}" style="--team-swatch:${pendingTeamColors[team.id] || team.color}; background-color: ${pendingTeamColors[team.id] || team.color}" aria-label="Open color picker"></button>
          <span class="team-color-hex-label">${(pendingTeamColors[team.id] || team.color).toUpperCase()}</span>
        </div>
        
        ${isPickerActive ? `
        <div class="team-color-picker-panel">
          <div class="preset-swatches">
            ${presetColors.map((c) => `
              <button type="button" class="color-swatch ${c === (pendingTeamColors[team.id] || team.color) ? 'selected' : ''}" data-team-swatch="${team.id}" data-color="${c}" style="--swatch:${c}; background-color: ${c}" aria-label="Select color ${c}"></button>
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

function disposePreviewGroupGeometry(group) {
  group?.traverse((item) => {
    item.geometry?.dispose?.();
  });
}

function createBuildPreviewManager() {
  const items = new Map();
  const disposeItem = (item) => {
    if (!item) return;
    item.scene.remove(item.group);
    disposePreviewGroupGeometry(item.group);
    item.renderer.dispose();
  };
  return {
    clear() {
      items.forEach(disposeItem);
      items.clear();
    },
    register(canvasEl, key, blueprint) {
      if (!canvasEl || !blueprint) return;
      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
      camera.position.set(5.2, 3.3, 6);
      camera.lookAt(0, 0.35, 0);
      scene.add(new THREE.HemisphereLight(0xeaffff, 0x111419, 1.9));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
      keyLight.position.set(4, 5, 4);
      scene.add(keyLight);
      const rim = new THREE.PointLight(0x82ffcf, 1.6, 10);
      rim.position.set(-3.4, 2, -3.2);
      scene.add(rim);

      const preview = createVehiclePreviewGroup(materials, blueprint);
      preview.group.position.set(0, -0.34, 0);
      scene.add(preview.group);
      items.set(key, { canvasEl, renderer, scene, camera, group: preview.group, time: Math.random() * Math.PI * 2 });
    },
    update(dt) {
      items.forEach((item, key) => {
        if (!item.canvasEl.isConnected) {
          disposeItem(item);
          items.delete(key);
          return;
        }
        const width = Math.max(180, item.canvasEl.clientWidth || 220);
        const height = Math.max(150, item.canvasEl.clientHeight || 180);
        item.renderer.setSize(width, height, false);
        item.camera.aspect = width / height;
        item.camera.updateProjectionMatrix();
        item.time += dt;
        item.group.rotation.set(-0.08, item.time * 0.5, 0);
        item.group.position.y = -0.34 + Math.sin(item.time * 1.8) * 0.025;
        item.renderer.render(item.scene, item.camera);
      });
    },
  };
}

const buildPreviewManager = createBuildPreviewManager();

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
  const editingTemplate = getEditingTemplate();
  if (ui.garageTitle) ui.garageTitle.textContent = editingTemplate ? `${editingTemplate.name}${garageBuildDirty ? ' *' : ''}` : def.name;
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
  refreshGarageBuildActions();
}

function readMatchOptions() {
  const enabledWeapons = ui.weaponToggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value);
  return {
    playerName: ui.playerNameInput.value.trim() || 'Player',
    teams: setupTeams,
    playerTeamId: setupPlayerTeamId,
    playerBlueprint: garageBlueprint,
    killLimit: gameSetupKillLimit,
    teamKillLimit: gameSetupTeamKillLimit,
    enabledWeapons: enabledWeapons.length ? enabledWeapons : ['boom-missile', 'bouncy-wouncy', 'shock-lance', 'fire-mine', 'swarm-missiles', 'gravity-imploder', 'rail-slug', 'toxic-cask', 'devastator-nuke'],
  };
}

function renderSetupStep(step = activeSetupStep) {
  activeSetupStep = step;
  ui.teamSetupStep?.classList.toggle('active', step === 'team');
  ui.garagePanel?.classList.toggle('active', step === 'vehicle');
  ui.gameSetupStep?.classList.toggle('active', step === 'game');
  document.getElementById('shopMenuStep')?.classList.toggle('active', step === 'shop');
  ui.matchMenu?.classList.toggle('vehicle-mode', step === 'vehicle');
  ui.matchMenu?.classList.toggle('game-mode', step === 'game');
  ui.matchMenu?.classList.toggle('shop-mode', step === 'shop');

  if (step === 'game') {
    // Sync kill limit button highlights
    document.querySelectorAll('[data-kill-limit]').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.killLimit) === gameSetupKillLimit);
    });
    // Sync team kill limit button highlights
    document.querySelectorAll('[data-team-kill-limit]').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.teamKillLimit) === gameSetupTeamKillLimit);
    });
    // Sync map tab buttons
    document.querySelectorAll('.map-tab-btn').forEach((b) => {
      const isSelected = b.dataset.mapId === selectedMapId;
      b.classList.toggle('selected', isSelected);
      b.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    // Sync map detail panels
    document.querySelectorAll('.map-detail-panel').forEach((p) => {
      p.classList.toggle('selected', p.dataset.detailMap === selectedMapId);
    });
  } else if (step === 'team') {
    renderTeamBuilder();
  }

  refreshQuickTips();
}

function openMenu(paused = true) {
  document.getElementById('mainMenuScreen')?.classList.remove('active');
  ui.matchMenu.classList.remove('hidden');
  renderSetupStep('team');
  if (ctx.match.active) ctx.match.paused = paused;
}

function openMainMenu() {
  document.getElementById('mainMenuScreen')?.classList.add('active');
  ui.matchMenu.classList.add('hidden');
  refreshQuickTips();
}

const QUICK_TIPS_ENABLED_KEY = 'ether-driver.quickTips.enabled.v1';
const QUICK_TIPS_DISMISSED_KEY = 'ether-driver.quickTips.dismissed.session.v1';
sessionStorage.removeItem(QUICK_TIPS_DISMISSED_KEY);
const quickTips = [
  { id: 'vehicle-builds-access', context: ['vehicle'], target: '#openBuildsFromGarageButton', title: 'Vehicle Builds', body: 'Open Vehicle Builds here to save, load, and edit tuned templates without leaving setup.' },
  { id: 'builds-save-load', context: ['builds', 'main'], target: '#navVehicleBuildsButton, #templatesModal .modal-header h2', title: 'Save Templates', body: 'Vehicle Builds stores complete part, paint, and stat setups so you can return to a favorite driver fast.' },
  { id: 'builds-rename', context: ['builds'], target: '[data-build-name-input]', title: 'Rename Builds', body: 'Click a saved build name, type a clearer label, then press Enter or click away to save it.' },
  { id: 'builds-edit', context: ['builds'], target: '[data-template-edit]', title: 'Edit Saved Builds', body: 'Edit loads that saved build into the garage. Your slot is not overwritten until you press Save Changes.' },
  { id: 'builds-save-changes', context: ['vehicle'], target: '#saveEditedBuildButton', title: 'Save Changes', body: 'After editing a saved build, this button updates the same slot while keeping its history stats.' },
  { id: 'builds-save-variant', context: ['vehicle'], target: '#saveBuildVariantButton', title: 'Save As New', body: 'Use Save As New when you want a speed, armor, or paint variant without replacing the original.' },
  { id: 'match-exp', context: ['game', 'results', 'play'], target: '#startMatchButton, #resultsRewards, #quickTipsToggle', title: 'Match EXP', body: 'Every match pays lifetime EXP, so experimenting still moves your profile forward.' },
  { id: 'match-gold', context: ['shop', 'results', 'play'], target: '#shopStatsHeader, #resultsRewards, #quickTipsToggle', title: 'Gold Rewards', body: 'Gold comes from match rewards and combat performance, then funds premium parts and upgrades.' },
  { id: 'turret-hit-rewards', context: ['play', 'results'], target: '#weaponPanel, #resultsRewards', title: 'Hit Rewards', body: 'Turret hits and weapon hits add extra reward lines. Accurate pressure pays even before a kill.' },
  { id: 'kill-rewards', context: ['play', 'results'], target: '#killFeed, #resultsRewards', title: 'Kill Rewards', body: 'Kills add bonus EXP and Gold, but assists through damage still help your match total.' },
  { id: 'lifetime-achievements', context: ['main', 'results'], target: '#navAchievementsButton, #resultsBody', title: 'Lifetime Stats', body: 'Lifetime Achievements track wins, damage, kills, EXP, and Gold across all plays.' },
  { id: 'premium-shop', context: ['team', 'shop', 'main'], target: '#openShopFromMenuButton, #navPremiumShopButton', title: 'Spend Gold', body: 'The shop converts earned Gold into premium parts and stat upgrades for future builds.' },
  { id: 'level-stat-points', context: ['shop', 'results'], target: '#shopStatsHeader, #resultsRewards', title: 'Level Ups', body: 'Leveling up grants stat points. Spend them on upgrades that fit how you drive and fight.' },
  { id: 'handling-upgrade', context: ['shop'], target: '[data-upgrade-stat=\"handling\"]', title: 'Handling Upgrade', body: 'Handling upgrades make fast builds easier to correct after slides, impacts, and hard turns.' },
  { id: 'firing-upgrade', context: ['shop'], target: '[data-upgrade-stat=\"firingRate\"]', title: 'Firing Rate', body: 'Firing Rate upgrades reduce turret downtime, which helps veteran players keep pressure on targets.' },
  { id: 'ammo-upgrade', context: ['shop'], target: '[data-upgrade-stat=\"maxAmmo\"]', title: 'Max Ammo', body: 'Max Ammo upgrades support longer fights and make missed shots less punishing.' },
  { id: 'heavy-armor', context: ['vehicle'], target: '[data-garage-category=\"armor\"]', title: 'Heavy Armor', body: 'Heavy armor survives longer and rams better, but the speed and launch tradeoffs are real.' },
  { id: 'light-builds', context: ['vehicle'], target: '[data-garage-category=\"chassis\"]', title: 'Light Builds', body: 'Light frames reward clean lanes, quick pickups, and spacing. Avoid trading hits for free.' },
  { id: 'turret-rate', context: ['vehicle'], target: '[data-garage-category=\"turret\"]', title: 'Turret Turn Rate', body: 'Turret turn rate matters most in close fights where targets cross your aim quickly.' },
  { id: 'team-kill-limit', context: ['game'], target: '.team-kill-limit-options', title: 'Team Kill Limit', body: 'Team Kill Limit creates a cleaner team objective than individual kills when squads are large.' },
  { id: 'pickup-toggles', context: ['team'], target: '.weapon-fieldset', title: 'Pickup Weapons', body: 'Disable specific pickups to tune chaos, practice fundamentals, or create a focused ruleset.' },
  { id: 'scoreboard', context: ['play'], target: '#scoreboard', title: 'Scoreboard Momentum', body: 'Open the scoreboard to read team kills, damage, weapon loadouts, and who needs help.' },
  { id: 'results-breakdown', context: ['results'], target: '#resultsRewards', title: 'Reward Breakdown', body: 'Match results show exactly where EXP and Gold came from, including hits, kills, and completion.' },
  { id: 'quick-tips-toggle', context: ['main', 'team', 'vehicle', 'game', 'shop', 'builds', 'settings', 'play'], target: '#quickTipsToggle', title: 'Quick Tips Control', body: 'Turn Quick Tips back on from the top-left button or from Options whenever you want guidance again.' },
];

let quickTipIndex = 0;
let quickTipTimer = 0;
let activeQuickTipId = '';

function readQuickTipsEnabled() {
  return localStorage.getItem(QUICK_TIPS_ENABLED_KEY) !== 'false';
}

function setQuickTipsEnabled(enabled) {
  localStorage.setItem(QUICK_TIPS_ENABLED_KEY, enabled ? 'true' : 'false');
  syncQuickTipsControls();
  refreshQuickTips();
}

function readDismissedQuickTips() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(QUICK_TIPS_DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function dismissQuickTip(tipId) {
  const dismissed = readDismissedQuickTips();
  dismissed.add(tipId);
  sessionStorage.setItem(QUICK_TIPS_DISMISSED_KEY, JSON.stringify([...dismissed]));
  activeQuickTipId = '';
  quickTipIndex += 1;
  refreshQuickTips();
}

function syncQuickTipsControls() {
  const enabled = readQuickTipsEnabled();
  const toggle = document.getElementById('quickTipsToggle');
  const settingsToggle = document.getElementById('quickTipsSettingsToggle');
  if (toggle) {
    toggle.classList.toggle('off', !enabled);
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggle.textContent = enabled ? 'Quick Tips' : 'Tips Off';
  }
  if (settingsToggle) settingsToggle.checked = enabled;
}

function currentQuickTipContext() {
  if (!document.getElementById('templatesModal')?.classList.contains('hidden')) return 'builds';
  if (!ui.settingsMenu?.classList.contains('hidden')) return 'settings';
  if (ui.resultsOverlay?.classList.contains('visible')) return 'results';
  if (document.getElementById('mainMenuScreen')?.classList.contains('active')) return 'main';
  if (!ui.matchMenu?.classList.contains('hidden')) return activeSetupStep;
  return 'play';
}

function resolveTipTarget(selectorList, fallback = true) {
  const isVisible = (el) => {
    if (el.closest('.hidden')) return false;
    const mainMenu = el.closest('#mainMenuScreen');
    if (mainMenu && !mainMenu.classList.contains('active')) return false;
    const matchMenu = el.closest('#matchMenu');
    if (matchMenu && matchMenu.classList.contains('hidden')) return false;
    const modal = el.closest('.modal-overlay');
    if (modal && modal.classList.contains('hidden')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
  };
  const target = selectorList
    .split(',')
    .map((selector) => document.querySelector(selector.trim()))
    .find((el) => {
      if (!el || !isVisible(el)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  return target || (fallback ? document.getElementById('quickTipsToggle') : null);
}

function renderQuickTip(tip, target) {
  const layer = document.getElementById('quickTipsLayer');
  if (!layer || !target) return;
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, Math.max(230, vw - 32));
  const preferRight = rect.left + rect.width + width + 24 < vw;
  const preferLeft = rect.left - width - 24 > 0;
  const left = preferRight ? rect.right + 12 : preferLeft ? rect.left - width - 12 : Math.min(Math.max(16, rect.left), vw - width - 16);
  const below = rect.top < vh * 0.55;
  const top = below ? Math.min(rect.bottom + 12, vh - 150) : Math.max(72, rect.top - 136);
  layer.innerHTML = `
    <span class="quick-tip-spotlight" style="left:${Math.max(8, rect.left - 8)}px;top:${Math.max(8, rect.top - 8)}px;width:${rect.width + 16}px;height:${rect.height + 16}px"></span>
    <article class="quick-tip-card" style="left:${left}px;top:${top}px;width:${width}px">
      <header>
        <strong>${esc(tip.title)}</strong>
        <button type="button" data-quick-tip-dismiss="${esc(tip.id)}" aria-label="Dismiss quick tip">&#10003;</button>
      </header>
      <p>${esc(tip.body)}</p>
    </article>
  `;
}

function refreshQuickTips() {
  const layer = document.getElementById('quickTipsLayer');
  if (!layer) return;
  syncQuickTipsControls();
  if (!readQuickTipsEnabled()) {
    layer.innerHTML = '';
    return;
  }
  const context = currentQuickTipContext();
  const dismissed = readDismissedQuickTips();
  const available = quickTips.filter((tip) => tip.context.includes(context) && !dismissed.has(tip.id) && resolveTipTarget(tip.target, false));
  if (!available.length) {
    layer.innerHTML = '';
    return;
  }
  const tip = available[quickTipIndex % available.length];
  const target = resolveTipTarget(tip.target);
  activeQuickTipId = tip.id;
  renderQuickTip(tip, target);
}

function setupCyberMenuInteractions() {
  const mainMenu = document.getElementById('mainMenuScreen');
  const pressTargets = '.main-nav-btn, .menu-panel button, .pause-actions button, .shop-tabs button, .modal-panel button, .results-actions button';

  const triggerPress = (button) => {
    if (!button || button.disabled || button.classList.contains('disabled')) return;
    button.classList.remove('is-gear-press');
    void button.offsetWidth;
    button.classList.add('is-gear-press');
    window.setTimeout(() => button.classList.remove('is-gear-press'), 520);
  };

  document.querySelectorAll(pressTargets).forEach((button) => {
    button.addEventListener('pointerdown', () => triggerPress(button));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') triggerPress(button);
    });
  });

  mainMenu?.addEventListener('pointermove', (event) => {
    const rect = mainMenu.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5).toFixed(3);
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5).toFixed(3);
    mainMenu.style.setProperty('--cursor-x', x);
    mainMenu.style.setProperty('--cursor-y', y);
  });
}

setupCyberMenuInteractions();

// Main Menu Navigation
document.getElementById('navCustomMatchButton')?.addEventListener('click', () => {
  openMenu(false);
});

document.getElementById('navPremiumShopButton')?.addEventListener('click', () => {
  shopOrigin = 'main';
  openMenu(false);
  renderSetupStep('shop');
  renderShop();
});

document.getElementById('navVehicleBuildsButton')?.addEventListener('click', () => {
  openTemplatesModal();
});

document.getElementById('navAchievementsButton')?.addEventListener('click', () => {
  document.getElementById('achievementsModal')?.classList.remove('hidden');
  renderAchievementsModal();
});

document.getElementById('closeAchievementsButton')?.addEventListener('click', () => {
  document.getElementById('achievementsModal')?.classList.add('hidden');
  refreshQuickTips();
});

document.getElementById('closeTemplatesButton')?.addEventListener('click', () => {
  document.getElementById('templatesModal')?.classList.add('hidden');
  buildPreviewManager.clear();
  refreshQuickTips();
});

let pendingBuildLoadId = null;
let editingGarageTemplateId = '';
let garageBuildDirty = false;

function cloneBlueprint(blueprint) {
  return JSON.parse(JSON.stringify(sanitizeGarageBlueprint(blueprint)));
}

function getEditingTemplate() {
  if (!editingGarageTemplateId) return null;
  return loadGarageTemplates().find((template) => template.id === editingGarageTemplateId) || null;
}

function refreshGarageBuildActions() {
  const editButton = document.getElementById('saveEditedBuildButton');
  const variantButton = document.getElementById('saveBuildVariantButton');
  const editingTemplate = getEditingTemplate();
  if (editButton) {
    editButton.disabled = !editingTemplate || !garageBuildDirty;
    editButton.textContent = editingTemplate ? (garageBuildDirty ? 'Save Changes' : 'Saved') : 'Save Changes';
  }
  if (variantButton) {
    variantButton.disabled = loadGarageTemplates().length >= GARAGE_BUILD_LIMIT;
  }
}

function setGarageEditingTemplate(template, { dirty = false } = {}) {
  editingGarageTemplateId = template?.id || '';
  garageBuildDirty = Boolean(dirty);
  if (template && !garageBuildDirty) setActiveGarageTemplateId(template.id);
  if (!template) clearActiveGarageTemplateId();
  refreshGarageBuildActions();
}

function openTemplatesModal() {
  pendingBuildLoadId = null;
  document.getElementById('templatesModal')?.classList.remove('hidden');
  renderTemplatesModal();
  refreshQuickTips();
}

function renderAchievementsModal() {
  const state = loadProgression();
  const ls = state.lifetimeStats || {};
  document.getElementById('achievementsGrid').innerHTML = `
    <div class="achievement-card"><span>Damage Dealt</span><strong>${Math.round(ls.damageDealt || 0)}</strong></div>
    <div class="achievement-card"><span>Kills</span><strong>${ls.kills || 0}</strong></div>
    <div class="achievement-card"><span>Deaths</span><strong>${ls.deaths || 0}</strong></div>
    <div class="achievement-card"><span>Game Wins</span><strong>${ls.gameWins || 0}</strong></div>
    <div class="achievement-card"><span>Gold Gained</span><strong>${ls.goldGained || 0}</strong></div>
    <div class="achievement-card"><span>Gold Spent</span><strong>${ls.goldSpent || 0}</strong></div>
    <div class="achievement-card"><span>EXP Gained</span><strong>${ls.expGained || 0}</strong></div>
  `;
}

function renderBuildPerformanceStats(blueprint) {
  const stats = getGarageStats(blueprint);
  return renderGarageStats(stats);
}

function renderBuildHistoryStats(stats = {}) {
  const rows = [
    ['Uses', stats.uses || 0],
    ['Kills', stats.kills || 0],
    ['Deaths', stats.deaths || 0],
    ['Damage', Math.round(stats.damage || 0)],
    ['Wins', stats.wins || 0],
    ['Pickups', stats.pickups || 0],
    ['Turbo', stats.turbo || 0],
    ['Jump', stats.jump || 0],
  ];
  return rows.map(([label, value]) => `
    <span class="build-history-stat">
      <b>${esc(value)}</b>
      <em>${esc(label)}</em>
    </span>
  `).join('');
}

function renderBuildSlot(template, index, activeBuildId) {
  if (!template) {
    return `
      <article class="vehicle-build-card empty-build-slot">
        <div class="build-slot-number">#${index + 1}</div>
        <div class="build-empty-pedestal">
          <span></span>
        </div>
        <h4>Empty Build Slot</h4>
        <p>Save your Current Build to place a vehicle here.</p>
        <button type="button" data-save-current-build>Save Current Build</button>
      </article>
    `;
  }
  const def = buildGarageVehicleDefinition(template.blueprint);
  const isActive = template.id === activeBuildId;
  const isPending = template.id === pendingBuildLoadId;
  const isEditing = template.id === editingGarageTemplateId;
  const title = template.name || def.name;
  return `
    <article class="vehicle-build-card ${isActive ? 'active-build' : ''} ${isPending ? 'confirming' : ''} ${isEditing ? 'editing-build' : ''}" data-build-id="${esc(template.id)}">
      <div class="build-slot-number">#${index + 1}</div>
      <div class="build-preview-shell">
        <canvas class="build-preview-canvas" data-build-preview="${esc(template.id)}"></canvas>
      </div>
      <header>
        <span>${isEditing ? (garageBuildDirty ? 'Editing - Unsaved' : 'Editing') : isActive ? 'Current Build' : 'Saved Build'}</span>
        <input type="text" class="build-name-input" data-build-name-input="${esc(template.id)}" value="${esc(title)}" maxlength="24" readonly aria-label="Rename ${esc(title)}" />
      </header>
      <div class="build-performance">${renderBuildPerformanceStats(template.blueprint)}</div>
      <div class="build-history-grid">${renderBuildHistoryStats(template.stats)}</div>
      <div class="build-card-actions">
        ${isPending ? `
          <button type="button" class="template-load-btn" data-confirm-build="${esc(template.id)}">Confirm</button>
          <button type="button" data-cancel-build-load>Cancel</button>
        ` : `
          <button type="button" data-template-edit="${esc(template.id)}">Edit</button>
          <button type="button" class="template-load-btn" data-template-load="${esc(template.id)}">Use</button>
          <button type="button" class="template-delete-btn" data-template-delete="${esc(template.id)}">Delete</button>
        `}
      </div>
    </article>
  `;
}

function renderCurrentBuildPanel(templates) {
  const activeBuildId = getActiveGarageTemplateId();
  const activeTemplate = templates.find((template) => template.id === activeBuildId);
  const editingTemplate = getEditingTemplate();
  const def = buildGarageVehicleDefinition(garageBlueprint);
  const displayName = editingTemplate?.name || activeTemplate?.name || def.name;
  const status = editingTemplate
    ? (garageBuildDirty ? 'Editing saved build - unsaved changes' : 'Editing saved build')
    : activeTemplate ? 'Loaded from saved build' : 'Default or unsaved custom build';
  return `
    <article class="vehicle-build-card current-build-card">
      <div class="build-preview-shell">
        <canvas class="build-preview-canvas" data-build-preview="current"></canvas>
      </div>
      <div class="current-build-copy">
        <p class="menu-kicker">Current Build</p>
        <h3>${esc(displayName)}</h3>
        <span>${esc(status)}</span>
        <div class="build-performance">${renderBuildPerformanceStats(garageBlueprint)}</div>
      </div>
    </article>
  `;
}

function renderTemplatesModal() {
  const templates = loadGarageTemplates();
  const activeBuildId = getActiveGarageTemplateId();
  const currentPanel = document.getElementById('currentBuildPanel');
  const grid = document.getElementById('templatesGrid');
  if (currentPanel) currentPanel.innerHTML = renderCurrentBuildPanel(templates);
  if (grid) {
    grid.innerHTML = Array.from({ length: GARAGE_BUILD_LIMIT }, (_, index) => renderBuildSlot(templates[index], index, activeBuildId)).join('');
  }
  buildPreviewManager.clear();
  document.querySelectorAll('[data-build-preview]').forEach((canvasEl) => {
    const key = canvasEl.dataset.buildPreview;
    const template = templates.find((item) => item.id === key);
    buildPreviewManager.register(canvasEl, key, key === 'current' ? garageBlueprint : template?.blueprint);
  });
  refreshGarageBuildActions();
}

function saveCurrentBuildToSlot() {
  const templates = loadGarageTemplates();
  if (templates.length >= GARAGE_BUILD_LIMIT) {
    alert("Maximum 10 templates allowed. Delete one first.");
    return;
  }
  const name = document.getElementById('templateNameInput').value.trim() || 'My Build';
  saveGarageBlueprint(garageBlueprint);
  const template = createGarageTemplate(name, cloneBlueprint(garageBlueprint));
  if (template) setGarageEditingTemplate(template, { dirty: false });
  document.getElementById('templateNameInput').value = '';
  pendingBuildLoadId = null;
  renderTemplatesModal();
  renderGarageBuilder();
}

function saveGarageBuildVariant() {
  const editingTemplate = getEditingTemplate();
  const fallbackName = editingTemplate?.name || buildGarageVehicleDefinition(garageBlueprint).name || 'My Build';
  const inputName = document.getElementById('templateNameInput')?.value?.trim();
  const template = createGarageTemplate(inputName || `${fallbackName} Copy`, cloneBlueprint(garageBlueprint));
  if (!template) {
    alert("Maximum 10 templates allowed. Delete one first.");
    return;
  }
  document.getElementById('templateNameInput').value = '';
  setGarageEditingTemplate(template, { dirty: false });
  saveGarageBlueprint(garageBlueprint);
  pendingBuildLoadId = null;
  renderGarageBuilder();
  renderTemplatesModal();
}

function saveEditedGarageBuild() {
  const editingTemplate = getEditingTemplate();
  if (!editingTemplate || !garageBuildDirty) return;
  const template = updateGarageTemplate(editingTemplate.id, { blueprint: cloneBlueprint(garageBlueprint) });
  if (!template) return;
  setGarageEditingTemplate(template, { dirty: false });
  saveGarageBlueprint(garageBlueprint);
  pendingBuildLoadId = null;
  renderGarageBuilder();
  renderTemplatesModal();
}

function loadTemplateIntoGarage(template, { editing = false } = {}) {
  if (!template) return;
  garageBlueprint = cloneBlueprint(template.blueprint);
  saveGarageBlueprint(garageBlueprint);
  pendingBuildLoadId = null;
  setGarageEditingTemplate(editing ? template : null, { dirty: false });
  if (!editing) setActiveGarageTemplateId(template.id);
  renderGarageBuilder();
}

document.getElementById('saveTemplateButton')?.addEventListener('click', () => {
  saveCurrentBuildToSlot();
});

document.getElementById('saveEditedBuildButton')?.addEventListener('click', () => {
  saveEditedGarageBuild();
});

document.getElementById('saveBuildVariantButton')?.addEventListener('click', () => {
  saveGarageBuildVariant();
});

document.getElementById('openBuildsFromGarageButton')?.addEventListener('click', () => {
  openTemplatesModal();
});

document.getElementById('quickTipsToggle')?.addEventListener('click', () => {
  setQuickTipsEnabled(!readQuickTipsEnabled());
});

document.getElementById('quickTipsSettingsToggle')?.addEventListener('change', (event) => {
  setQuickTipsEnabled(event.target.checked);
});

document.getElementById('quickTipsLayer')?.addEventListener('click', (event) => {
  const dismissButton = event.target.closest('[data-quick-tip-dismiss]');
  if (!dismissButton) return;
  dismissQuickTip(dismissButton.dataset.quickTipDismiss);
});

document.getElementById('templatesGrid')?.addEventListener('click', (e) => {
  const templates = loadGarageTemplates();
  const saveButton = e.target.closest('[data-save-current-build]');
  const nameInput = e.target.closest('[data-build-name-input]');
  const editButton = e.target.closest('[data-template-edit]');
  const requestLoadButton = e.target.closest('[data-template-load]');
  const confirmButton = e.target.closest('[data-confirm-build]');
  const cancelButton = e.target.closest('[data-cancel-build-load]');
  const deleteButton = e.target.closest('[data-template-delete]');
  const buildCard = e.target.closest('[data-build-id]');

  if (nameInput) {
    e.stopPropagation();
    nameInput.dataset.originalName = nameInput.value;
    nameInput.readOnly = false;
    nameInput.focus();
    nameInput.select();
  } else if (saveButton) {
    saveCurrentBuildToSlot();
  } else if (editButton) {
    const template = templates.find((item) => item.id === editButton.dataset.templateEdit);
    if (!template) return;
    loadTemplateIntoGarage(template, { editing: true });
    document.getElementById('templatesModal')?.classList.add('hidden');
    buildPreviewManager.clear();
    if (ui.matchMenu.classList.contains('hidden')) openMenu(false);
    renderSetupStep('vehicle');
  } else if (requestLoadButton) {
    pendingBuildLoadId = requestLoadButton.dataset.templateLoad;
    renderTemplatesModal();
  } else if (confirmButton) {
    const template = templates.find((item) => item.id === confirmButton.dataset.confirmBuild);
    if (!template) return;
    loadTemplateIntoGarage(template, { editing: false });
    renderTemplatesModal();
  } else if (cancelButton) {
    pendingBuildLoadId = null;
    renderTemplatesModal();
  } else if (deleteButton) {
    if (editingGarageTemplateId === deleteButton.dataset.templateDelete) {
      setGarageEditingTemplate(null, { dirty: false });
      garageBuildDirty = false;
    }
    deleteGarageTemplate(deleteButton.dataset.templateDelete);
    if (pendingBuildLoadId === deleteButton.dataset.templateDelete) pendingBuildLoadId = null;
    renderGarageBuilder();
    renderTemplatesModal();
  } else if (buildCard && buildCard.dataset.buildId) {
    pendingBuildLoadId = buildCard.dataset.buildId;
    renderTemplatesModal();
  }
});

document.getElementById('templatesGrid')?.addEventListener('keydown', (e) => {
  const input = e.target.closest('[data-build-name-input]');
  if (!input) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    input.blur();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    input.value = input.dataset.originalName || input.defaultValue;
    input.dataset.cancelRename = 'true';
    input.blur();
  }
});

document.getElementById('templatesGrid')?.addEventListener('focusout', (e) => {
  const input = e.target.closest('[data-build-name-input]');
  if (!input || input.readOnly) return;
  const buildId = input.dataset.buildNameInput;
  const cancelled = input.dataset.cancelRename === 'true';
  const nextName = input.value.trim();
  input.readOnly = true;
  delete input.dataset.cancelRename;
  if (cancelled || !nextName) {
    input.value = input.dataset.originalName || input.defaultValue;
    return;
  }
  const template = renameGarageTemplate(buildId, nextName);
  if (template && editingGarageTemplateId === buildId) renderGarageBuilder();
  renderTemplatesModal();
});

function markGarageBlueprintEdited() {
  garageBuildDirty = Boolean(editingGarageTemplateId);
  clearActiveGarageTemplateId();
  pendingBuildLoadId = null;
  refreshGarageBuildActions();
}

function compressImageFileForStorage(file, maxSize = 512, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
      const canvasEl = document.createElement('canvas');
      canvasEl.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
      canvasEl.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
      const c = canvasEl.getContext('2d');
      c.drawImage(image, 0, 0, canvasEl.width, canvasEl.height);
      let dataUrl = canvasEl.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvasEl.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read imported texture image.'));
    };
    image.src = objectUrl;
  });
}

function beginMatch() {
  recordGarageTemplateUse();
  rebuildGameMap(selectedMapId);
  startMatch(ctx, materials, readMatchOptions(), physics);
  ui.matchMenu.classList.add('hidden');
  ui.resultsOverlay.classList.remove('visible');
  ctx.input.keys.clear();
  canvas.focus();
}

ui.startMatchButton.addEventListener('click', beginMatch);
document.getElementById('backToMainMenuFromSetupButton')?.addEventListener('click', () => {
  openMainMenu();
});
ui.continueToGarageButton?.addEventListener('click', () => renderSetupStep('vehicle'));
ui.backToTeamButton?.addEventListener('click', () => renderSetupStep('team'));
ui.continueToGameButton?.addEventListener('click', () => renderSetupStep('game'));
ui.backToGarageButton?.addEventListener('click', () => renderSetupStep('vehicle'));

function closeMatchResults() {
  cleanupMVPPortrait();
  ui.resultsOverlay.classList.remove('visible');
  ctx.match.ended = false;
  ctx.match.active = false;
}

ui.restartMatchButton.addEventListener('click', () => {
  closeMatchResults();
  openMenu(false);
});

ui.resultsMainMenuButton?.addEventListener('click', () => {
  closeMatchResults();
  openMainMenu();
});

let activeShopTab = 'upgrades';

function renderShop() {
  const progression = loadProgression();
  const header = document.getElementById('shopStatsHeader');
  if (header) {
    const expReq = getExpRequirement(progression.level);
    header.innerHTML = `
      <span class="shop-stats-level">LVL <b>${progression.level}</b></span>
      <span>EXP <b>${progression.exp} / ${expReq}</b></span>
      <span class="shop-stats-gold">GOLD <b>${progression.gold}</b></span>
      <span>PTS <b>${progression.statPoints}</b></span>
    `;
  }
  
  const tabs = document.querySelectorAll('.shop-tabs button');
  tabs.forEach(tab => tab.classList.toggle('selected', tab.dataset.shopTab === activeShopTab));
  
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  
    if (activeShopTab === 'upgrades') {
    const renderUpgrade = (key, label, max) => {
      const current = progression.upgrades[key] || 0;
      const pct = (current / max) * 100;
      const canUpgrade = progression.statPoints > 0 && current < max;
      return `
        <div class="shop-card upgrade-card">
          <h4>${label}</h4>
          <div class="upgrade-level">${current} / ${max}</div>
          <div class="upgrade-progress"><div style="width: ${pct}%"></div></div>
          <button type="button" class="shop-buy-btn" data-upgrade-stat="${key}" ${canUpgrade ? '' : 'disabled'}>
            Upgrade (1 PT)
          </button>
        </div>
      `;
    };
    grid.innerHTML = `
      ${renderUpgrade('handling', 'Handling', UPGRADE_MAX_LEVELS.handling)}
      ${renderUpgrade('acceleration', 'Acceleration', UPGRADE_MAX_LEVELS.acceleration)}
      ${renderUpgrade('maxAmmo', 'Max Ammo', UPGRADE_MAX_LEVELS.maxAmmo)}
      ${renderUpgrade('firingRate', 'Firing Rate', UPGRADE_MAX_LEVELS.firingRate)}
    `;
  } else {
    const parts = premiumPartDefinitions.filter(p => p.type === activeShopTab);
    grid.innerHTML = parts.map(part => {
      const rarityDef = PREMIUM_RARITIES[part.rarity.toUpperCase()];
      const owned = progression.inventory.includes(part.id);
      const canAfford = progression.gold >= part.price;
      const statsHtml = Object.entries(part.stats || {}).map(([k, v]) => {
        const sign = v > 0 ? '+' : '';
        const cl = v > 0 ? 'positive' : 'negative';
        return `<span class="shop-stat ${cl}">${k}: ${sign}${v}</span>`;
      }).join('');
      return `
        <div class="shop-card rarity-${part.rarity}" style="--rarity-color: ${rarityDef.color}">
          <header>
            <h4>${part.name}</h4>
            <span class="shop-rarity">${rarityDef.name}</span>
          </header>
          <p>${part.blurb}</p>
          <div class="shop-stats">${statsHtml}</div>
          <div class="shop-actions">
            <span class="shop-price">${part.price} G</span>
            <button type="button" class="shop-buy-btn" data-buy-part="${part.id}" ${owned || !canAfford ? 'disabled' : ''}>
              ${owned ? 'Owned' : 'Buy'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  refreshQuickTips();
}

document.querySelector('.shop-tabs')?.addEventListener('click', e => {
  if (e.target.dataset.shopTab) {
    activeShopTab = e.target.dataset.shopTab;
    renderShop();
  }
});

document.getElementById('shopGrid')?.addEventListener('click', e => {
  const buyBtn = e.target.closest('[data-buy-part]');
  if (buyBtn) {
    if (buyPremiumPart(buyBtn.dataset.buyPart)) {
      refreshGarageCatalog();
      renderGarageBuilder();
      renderShop();
    }
  }
  
  const upgradeBtn = e.target.closest('[data-upgrade-stat]');
  if (upgradeBtn) {
    if (upgradeStat(upgradeBtn.dataset.upgradeStat)) {
      renderGarageBuilder();
      renderShop();
    }
  }
});

let shopOrigin = 'team';

document.getElementById('openShopFromMenuButton')?.addEventListener('click', () => {
  shopOrigin = 'team';
  renderSetupStep('shop');
  renderShop();
});

document.getElementById('openShopFromPauseButton')?.addEventListener('click', () => {
  shopOrigin = 'pause';
  ui.pauseMenu.classList.add('hidden');
  ui.matchMenu.classList.remove('hidden');
  renderSetupStep('shop');
  renderShop();
});

document.getElementById('backFromShopButton')?.addEventListener('click', () => {
  if (shopOrigin === 'pause') {
    ui.matchMenu.classList.add('hidden');
    ui.pauseMenu.classList.remove('hidden');
  } else if (shopOrigin === 'main') {
    openMainMenu();
  } else {
    renderSetupStep('team');
  }
  shopOrigin = 'team';
});

// Game Setup — Kill limit buttons
document.querySelector('.kill-limit-options')?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-kill-limit]');
  if (!btn) return;
  gameSetupKillLimit = Number(btn.dataset.killLimit);
  document.querySelectorAll('[data-kill-limit]').forEach((b) => b.classList.toggle('selected', Number(b.dataset.killLimit) === gameSetupKillLimit));
});

document.querySelector('.team-kill-limit-options')?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-team-kill-limit]');
  if (!btn) return;
  gameSetupTeamKillLimit = Number(btn.dataset.teamKillLimit);
  document.querySelectorAll('[data-team-kill-limit]').forEach((b) => b.classList.toggle('selected', Number(b.dataset.teamKillLimit) === gameSetupTeamKillLimit));
});

// Game Setup — Map Selection Tabs click listener
document.querySelector('.map-tab-list')?.addEventListener('click', (event) => {
  const btn = event.target.closest('.map-tab-btn');
  if (!btn) return;
  const mapId = btn.dataset.mapId;
  if (!mapId) return;
  selectedMapId = mapId;
  
  // Toggle selected active tabs
  document.querySelectorAll('.map-tab-btn').forEach((b) => {
    const isSelected = b.dataset.mapId === selectedMapId;
    b.classList.toggle('selected', isSelected);
    b.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  // Toggle selected active panels
  document.querySelectorAll('.map-detail-panel').forEach((p) => {
    p.classList.toggle('selected', p.dataset.detailMap === selectedMapId);
  });
  
  rebuildGameMap(selectedMapId);
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
  refreshQuickTips();
});
ui.closeSettingsButton.addEventListener('click', () => {
  ui.settingsMenu.classList.add('hidden');
  ui.pauseMenu.classList.remove('hidden');
  refreshQuickTips();
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
  let blueprintChanged = false;
  if (categoryButton) activeGarageCategory = categoryButton.dataset.garageCategory;
  if (partButton) {
    const category = garageCategories.find((item) => item.key === activeGarageCategory);
    garageBlueprint[category.field] = partButton.dataset.garagePart;
    garageFlash = { part: category.key, timer: 1.0 };
    blueprintChanged = true;
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
  if (materialButton) {
    garageBlueprint.materialStyle = materialButton.dataset.garageMaterial;
    blueprintChanged = true;
  }
  if (textureButton) {
    const target = partPaintTargets[textureButton.dataset.garagePartTextureTarget];
    if (target) {
      garageBlueprint[target.textureKey] = textureButton.dataset.garagePartTexture;
      garageBlueprint[target.customDataKey] = '';
      garageBlueprint[target.customNameKey] = '';
      garageBlueprint[target.tintKey] = textureButton.dataset.garagePartTexture ? 0 : 100;
      blueprintChanged = true;
    }
  }
  if (clearTextureButton) {
    const targetKey = clearTextureButton.dataset.garageClearTexture;
    const target = partPaintTargets[targetKey];
    if (target) {
      garageBlueprint[target.customDataKey] = '';
      garageBlueprint[target.customNameKey] = '';
      garageBlueprint[target.tintKey] = garageBlueprint[target.textureKey] ? 0 : 100;
      blueprintChanged = true;
    } else {
      garageBlueprint.customTextureData = '';
      garageBlueprint.customTextureName = '';
      garageBlueprint.paintTint = 0;
      blueprintChanged = true;
    }
  }
  if (categoryButton || partButton || materialButton || textureButton || clearTextureButton) {
    if (blueprintChanged) markGarageBlueprintEdited();
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
  if (changed) {
    markGarageBlueprintEdited();
    renderGarageBuilder();
  }
});
ui.garageControls.addEventListener('change', async (event) => {
  const hexKey = event.target.dataset.garageColorHex;
  if (hexKey) {
    if (/^#[0-9a-f]{6}$/i.test(event.target.value)) garageBlueprint[hexKey] = event.target.value;
    markGarageBlueprintEdited();
    renderGarageBuilder();
    return;
  }
  const importInput = event.target.closest('[data-garage-texture-import]');
  const file = importInput?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  try {
    const textureData = await compressImageFileForStorage(file);
    const target = partPaintTargets[importInput.dataset.garageTextureImport];
    if (target) {
      garageBlueprint[target.customDataKey] = textureData;
      garageBlueprint[target.customNameKey] = file.name;
      garageBlueprint[target.tintKey] = 0;
    } else {
      garageBlueprint.customTextureData = textureData;
      garageBlueprint.customTextureName = file.name;
      garageBlueprint.paintTint = 0;
    }
    markGarageBlueprintEdited();
    renderGarageBuilder();
  } catch (error) {
    alert(error.message || 'Could not import that texture image.');
  }
});

refreshGarageCatalog();

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
        if (!ui.matchMenu.classList.contains('hidden')) openMainMenu();
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
    if (ctx.camera.fov !== 65) {
      ctx.camera.fov = 65;
      ctx.camera.updateProjectionMatrix();
    }
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

  // Dynamic Camera FOV Speed Warping (Tunnel Vision Effect)
  const baseFov = 65;
  const speed = Math.abs(ctx.player.velocity.speed);
  const flyHeight = Math.max(0, (ctx.player.transform.y || 0));
  const targetFov = baseFov + Math.min(25, (speed / 140) * 16 + flyHeight * 0.9);
  ctx.camera.fov = THREE.MathUtils.lerp(ctx.camera.fov, targetFov, Math.min(1, dt * 6.0));
  ctx.camera.updateProjectionMatrix();
}

let lastFrameTime = performance.now();
function animate() {
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

  // Blinking skyscraper warning beacons animation
  if (ctx.beacons) {
    ctx.beacons.forEach((b) => {
      b.timer += dt * 4.0;
      const intensity = Math.sin(b.timer) * 0.5 + 0.5;
      b.mesh.material.color.setRGB(intensity, 0, 0);
      b.light.intensity = intensity * 2.8;
    });
  }

  routeRecorder.update(dt);
  effects.update(dt);
  updateGaragePreview(dt);
  buildPreviewManager.update(dt);
  quickTipTimer += dt;
  if (quickTipTimer > 10 || (activeQuickTipId && !document.querySelector('.quick-tip-card'))) {
    quickTipTimer = 0;
    quickTipIndex += 1;
    refreshQuickTips();
  }
  physics.step();
  updateCamera(dt);
  updateHUD(ctx, ui, dt);
  drawMinimap(ctx, ui, dt);
  ctx.composer.render();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => resizeContext(ctx));
window.etherDebug = { ctx, physics };
animate();
canvas.focus();
