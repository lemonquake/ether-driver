import * as THREE from 'three';
import { distance2D } from '../core/collision.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { register } from '../world/MapSystem.js';

let ctxRef = null;

// Campaign State Variables
export const campaignState = {
  active: false,
  state: 'menu', // 'menu', 'briefing', 'dialogue', 'playing', 'victory', 'defeat'
  enemies: [],
  portalActive: false,
  portalPosition: { x: -80, z: -80 },
  portalMesh: null,
  gates: [],
  activeGateIndex: -1,
  dialogueSequence: [],
  dialogueIndex: 0,
  dialogueCharIndex: 0,
  dialogueTextTimer: 0,
  dialogueTyping: false,
  onDialogueComplete: null,
};

// Dialogue sequences definition
const dialogues = [
  // Sequence 0: Startup (Gate 1)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'Driver, do you copy? You have entered the Sector 4 compound perimeter. Automated security systems are fully hostile.' },
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'You will face Rogue Static Turrets and mobile Floating Drones. Stay light on the throttle. Your weapons are online.' },
    { speaker: 'DRIVER', portrait: 'textures/driver_portrait.png', text: 'Loud and clear, Commander. Booting up weapon systems now. Ready to engage.' }
  ],
  // Sequence 1: Entering Turret Alley (Gate 2)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'Warning: High energy signatures detected in the corridor. Three heavy Static Turrets are online. Take cover and return fire!' },
    { speaker: 'DRIVER', portrait: 'textures/driver_portrait.png', text: 'Understood. Using the L-walls for cover.' }
  ],
  // Sequence 2: Entering Drone Zone (Gate 3)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'Security Drones incoming! Floating Drones detected in the lower sector. They are mobile and will try to flank you. Keep moving!' }
  ],
  // Sequence 3: Approaching Exit Portal (Gate 4)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'The extraction zone is just ahead. Once all hostiles are offline, the portal will stabilize. Secure the perimeter!' }
  ],
  // Sequence 4: All Enemies Dead (Portal Active)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'All hostiles neutralized! The exit portal is fully active at the top-left coordinates (-80, -80). Get to extraction, now!' }
  ]
];

// Line-of-sight wall collision checking (prevent turrets from shooting through walls)
function lineIntersectsBox(p1, p2, box) {
  const minX = box.x - box.w / 2;
  const maxX = box.x + box.w / 2;
  const minZ = box.z - box.d / 2;
  const maxZ = box.z + box.d / 2;

  // Simple line segment intersection check
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;

  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-6) {
    if (p1.x < minX || p1.x > maxX) return false;
  } else {
    const tx1 = (minX - p1.x) / dx;
    const tx2 = (maxX - p1.x) / dx;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (Math.abs(dz) < 1e-6) {
    if (p1.z < minZ || p1.z > maxZ) return false;
  } else {
    const tz1 = (minZ - p1.z) / dz;
    const tz2 = (maxZ - p1.z) / dz;
    tMin = Math.max(tMin, Math.min(tz1, tz2));
    tMax = Math.min(tMax, Math.max(tz1, tz2));
  }

  return tMin <= tMax;
}

function hasLineOfSight(from, to, collisionShapes) {
  for (const s of collisionShapes) {
    if (s.type === 'building' || s.type === 'barrier' || s.type === 'crate') {
      if (lineIntersectsBox(from, to, s)) return false;
    }
  }
  return true;
}

// Custom 3D Mesh Builders
function createStaticTurretMesh() {
  const group = new THREE.Group();
  
  // Base Cylinder
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x444d56, metalness: 0.8, roughness: 0.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 1.5, 12), baseMat);
  base.position.y = 0.75;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Glowing warning ring
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 2.0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.1, 8, 16), ringMat);
  ring.position.y = 1.45;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Rotating head group
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.0;

  const headMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, metalness: 0.9, roughness: 0.1 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), headMat);
  head.castShadow = true;
  headGroup.add(head);

  // Dual Barrels
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.9, roughness: 0.1 });
  const barrelGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8);
  
  const barrelLeft = new THREE.Mesh(barrelGeom, barrelMat);
  barrelLeft.position.set(-0.3, 0, 0.6);
  barrelLeft.rotation.x = Math.PI / 2;
  barrelLeft.castShadow = true;
  headGroup.add(barrelLeft);

  const barrelRight = new THREE.Mesh(barrelGeom, barrelMat);
  barrelRight.position.set(0.3, 0, 0.6);
  barrelRight.rotation.x = Math.PI / 2;
  barrelRight.castShadow = true;
  headGroup.add(barrelRight);

  // Muzzle glows
  const muzzleMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 3.0 });
  const muzzleGeom = new THREE.SphereGeometry(0.13, 8, 8);
  const muzzleL = new THREE.Mesh(muzzleGeom, muzzleMat);
  muzzleL.position.set(-0.3, 0, 1.3);
  headGroup.add(muzzleL);
  const muzzleR = new THREE.Mesh(muzzleGeom, muzzleMat);
  muzzleR.position.set(0.3, 0, 1.3);
  headGroup.add(muzzleR);

  group.add(headGroup);

  return { group, headGroup };
}

function createFloatingDroneMesh() {
  const group = new THREE.Group();

  // Hovering Sphere Body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3a2f, metalness: 0.7, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Red glowing sensor eye
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 4.0 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
  eye.position.set(0, 0, 0.45);
  group.add(eye);

  // Thruster wings
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x1c2a1f, metalness: 0.8, roughness: 0.2 });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.6), wingMat);
  wingL.position.set(-0.65, 0, 0);
  wingL.rotation.z = 0.2;
  group.add(wingL);

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.6), wingMat);
  wingR.position.set(0.65, 0, 0);
  wingR.rotation.z = -0.2;
  group.add(wingR);

  // Small bottom thruster fire glow
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), fireMat);
  fire.position.y = -0.62;
  fire.rotation.x = Math.PI;
  group.add(fire);

  return group;
}

function createExitPortalMesh() {
  const group = new THREE.Group();

  // Cyan glowing cylinder outer boundary
  const ringGeom = new THREE.TorusGeometry(3.8, 0.12, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 3.5, transparent: true, opacity: 0.8 });
  
  const ring1 = new THREE.Mesh(ringGeom, ringMat);
  ring1.rotation.x = Math.PI / 2;
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.08, 8, 32), ringMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.1;
  group.add(ring2);

  // Vertical light beacon cylinder
  const beaconGeom = new THREE.CylinderGeometry(3.5, 3.5, 6, 16, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide
  });
  const beacon = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.y = 3;
  group.add(beacon);

  return group;
}

// Enemy Spawning helpers
function spawnStaticTurret(ctx, x, z) {
  const { group, headGroup } = createStaticTurretMesh();
  group.position.set(x, 0, z);
  ctx.scene.add(group);

  // Register obstacle in collisionShapes so vehicles collide with the base
  const coll = {
    type: 'static-turret',
    x,
    z,
    w: 2.0,
    d: 2.0,
    r: 0,
    padding: 0.25,
    height: 3.0,
  };
  ctx.collisionShapes.push(coll);

  const entity = {
    id: `campaign-turret-${campaignState.enemies.length}`,
    isCampaignEnemy: true,
    campaignEnemyType: 'turret',
    teamId: 'red',
    team: 'red',
    teamColor: '#ff3333',
    teamName: 'Security Grid',
    displayName: 'STATIC TURRET',
    health: { current: 70, max: 70, dead: false, hitFlash: 0 },
    transform: { x, y: 0, z, yaw: 0 },
    renderable: { group, headGroup },
    cooldown: 0,
    collisionShapeRef: coll,
  };
  
  ctx.ecs.add(entity);
  campaignState.enemies.push(entity);
}

function spawnFloatingDrone(ctx, x, z, physics) {
  const group = createFloatingDroneMesh();
  group.position.set(x, 2.0, z);
  ctx.scene.add(group);

  // Create kinematic sensor or body in physics so standard things could sweep (though we handle movement via JS translation)
  const sensor = physics.createSensorSphere(1.2, x, 2.0, z);

  const entity = {
    id: `campaign-drone-${campaignState.enemies.length}`,
    isCampaignEnemy: true,
    campaignEnemyType: 'drone',
    teamId: 'red',
    team: 'red',
    teamColor: '#ff3333',
    teamName: 'Security Grid',
    displayName: 'FLOATING DRONE',
    health: { current: 55, max: 55, dead: false, hitFlash: 0 },
    transform: { x, y: 2.0, z, yaw: 0 },
    renderable: { group },
    rapierBody: sensor,
    cooldown: 0.5 + Math.random(),
    patrolAngle: Math.random() * Math.PI * 2,
  };

  ctx.ecs.add(entity);
  campaignState.enemies.push(entity);
}

// Spawning Enemy security pulses
export function spawnEnemyBullet(ctx, physics, startX, startY, startZ, yaw, targetPoint) {
  const weapon = {
    id: 'enemy-bullet',
    name: 'Security Pulse',
    damage: 2.0,
    speed: 60.0,
    radius: 0.16,
    lifetime: 2.6,
    color: 0xff2222,
    impactForce: 0.6,
  };

  const dx = targetPoint.x - startX;
  const dz = targetPoint.z - startZ;
  const aimYaw = Math.atan2(dx, dz);
  const dirX = Math.sin(aimYaw);
  const dirZ = Math.cos(aimYaw);

  let mesh;
  if (ctx.projectileMeshPool && ctx.projectileMeshPool.length > 0) {
    mesh = ctx.projectileMeshPool.pop();
    mesh.scale.setScalar(weapon.radius);
    mesh.material.color.set(weapon.color);
    mesh.position.set(startX, startY, startZ);
    mesh.visible = true;
  } else {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(weapon.radius, 8, 8),
      new THREE.MeshBasicMaterial({ color: weapon.color })
    );
    mesh.position.set(startX, startY, startZ);
    ctx.scene.add(mesh);
  }

  let pLight = null;
  if (ctx.projectileLightPool && ctx.projectileLightPool.length > 0) {
    pLight = ctx.projectileLightPool.pop();
    pLight.color.set(weapon.color);
    pLight.intensity = 2.0;
    pLight.distance = 12;
    pLight.position.set(startX, startY, startZ);
  }

  const rapier = physics.createProjectileBody(weapon.radius, startX, startY, startZ);
  ctx.ecs.add({
    projectile: {
      weaponId: 'enemy-bullet',
      weapon,
      owner: { team: 'red', teamId: 'red' },
      team: 'red',
      teamId: 'red',
      age: 0,
      bounces: 0,
      pierce: 0,
      armTime: 0,
      pointLight: pLight,
    },
    transform: { x: startX, y: startY, z: startZ, yaw: aimYaw },
    velocity: { x: dirX * weapon.speed, y: 0, z: dirZ * weapon.speed },
    renderable: { group: mesh },
    rapierBody: rapier,
  });
}

// Campaign Initialization
export function initCampaignMatch(ctx, physics) {
  ctxRef = ctx;
  campaignState.active = true;
  campaignState.state = 'playing';
  campaignState.enemies = [];
  campaignState.portalActive = false;
  campaignState.activeGateIndex = -1;

  // Clear any existing campaign portal
  if (campaignState.portalMesh) {
    ctx.scene.remove(campaignState.portalMesh);
    campaignState.portalMesh = null;
  }

  // 1. Spawning custom campaign walls/collision triggers
  // We represent the 4 yellow gates in JS
  campaignState.gates = [
    { id: 'gate_1', x1: 34, x2: 46, z1: 50, z2: 100, triggered: false, dialogueIndex: 0, mesh: null },
    { id: 'gate_2', x1: 44, x2: 56, z1: -50, z2: 0, triggered: false, dialogueIndex: 1, mesh: null },
    { id: 'gate_3', x1: -60, x2: -20, z1: -56, z2: -44, triggered: false, dialogueIndex: 2, mesh: null },
    { id: 'gate_4', x1: -100, x2: -60, z1: 14, z2: 26, triggered: false, dialogueIndex: 3, mesh: null },
  ];

  // Spawn visual meshes for the yellow gates
  campaignState.gates.forEach((gate) => {
    const w = Math.abs(gate.x2 - gate.x1);
    const d = Math.abs(gate.z2 - gate.z1);
    const cx = (gate.x1 + gate.x2) / 2;
    const cz = (gate.z1 + gate.z2) / 2;

    const gateGeom = new THREE.BoxGeometry(w, 0.1, d);
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffea00,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.35
    });
    const mesh = new THREE.Mesh(gateGeom, gateMat);
    mesh.position.set(cx, 0.1, cz);
    ctx.scene.add(mesh);
    gate.mesh = mesh;
  });

  // 2. Spawning Custom Enemies
  // Static Turrets
  spawnStaticTurret(ctx, -10, -35);
  spawnStaticTurret(ctx, 25, -35);
  spawnStaticTurret(ctx, 45, -65);

  // Floating Drones
  spawnFloatingDrone(ctx, -45, 60, physics);
  spawnFloatingDrone(ctx, -30, 75, physics);

  // 3. Setup Exit Portal mesh (starts invisible/inactive)
  const portalMesh = createExitPortalMesh();
  portalMesh.position.set(campaignState.portalPosition.x, 0.05, campaignState.portalPosition.z);
  portalMesh.visible = false;
  ctx.scene.add(portalMesh);
  campaignState.portalMesh = portalMesh;

  // 4. Initialize HUD indicators
  showCampaignObjectiveHUD(5);
  showCampaignQuestsHUD();
  campaignState.reminderTimer = 0;
  campaignState.lastCompletedQuestCount = 0;
}

// Start Campaign initial dialogue sequence
export function startCampaignDialogue() {
  triggerDialogueSequence(0, () => {
    // Resume gameplay
  });
}

// Dialogue Actions
export function triggerDialogueSequence(index, onComplete = null) {
  console.log(`[CampaignSystem] triggerDialogueSequence called with index: ${index}`);
  campaignState.dialogueSequence = dialogues[index] || [];
  console.log(`[CampaignSystem] dialogueSequence length: ${campaignState.dialogueSequence.length}`);
  campaignState.dialogueIndex = 0;
  campaignState.onDialogueComplete = onComplete;
  campaignState.state = 'dialogue';
  if (ctxRef) {
    console.log('[CampaignSystem] Pausing match physics/updates');
    ctxRef.match.paused = true; // Pause physics & updates
  } else {
    console.log('[CampaignSystem] WARNING: ctxRef is null, cannot pause match physics!');
  }
  showDialogueBox();
}

function showDialogueBox() {
  const container = document.getElementById('dialogueContainer');
  console.log('[CampaignSystem] showDialogueBox called. container found:', container);
  if (!container) {
    console.log('[CampaignSystem] container not found in DOM, calling injectDialogueHTML');
    injectDialogueHTML();
    showDialogueBox();
    return;
  }
  console.log('[CampaignSystem] Removing "hidden" class from dialogue container');
  container.classList.remove('hidden');
  startTypingLine();
}

function startTypingLine() {
  const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
  console.log(`[CampaignSystem] startTypingLine called for index ${campaignState.dialogueIndex}. Line content:`, line);
  if (!line) {
    console.log('[CampaignSystem] No line found at current index, calling closeDialogue');
    closeDialogue();
    return;
  }

  // Sync Portrait & Name
  const portraitEl = document.getElementById('dialoguePortrait');
  const speakerEl = document.getElementById('dialogueSpeaker');
  const textEl = document.getElementById('dialogueText');
  console.log('[CampaignSystem] Synced portrait, speaker, text elements:', { portraitEl, speakerEl, textEl });

  if (portraitEl) {
    portraitEl.src = line.portrait;
    console.log(`[CampaignSystem] Portrait source set to: ${line.portrait}`);
  }
  if (speakerEl) {
    speakerEl.textContent = line.speaker;
    speakerEl.className = `dialogue-speaker ${line.speaker.toLowerCase()}`;
    console.log(`[CampaignSystem] Speaker set to: ${line.speaker}`);
  }
  
  campaignState.dialogueCharIndex = 0;
  campaignState.dialogueTextTimer = 0;
  campaignState.dialogueTyping = true;
  if (textEl) textEl.textContent = '';
  
  // Sync buttons
  syncDialogueButtons();
}

function syncDialogueButtons() {
  const prevBtn = document.getElementById('dialoguePrevBtn');
  const nextBtn = document.getElementById('dialogueNextBtn');
  if (prevBtn) {
    prevBtn.disabled = campaignState.dialogueIndex === 0;
    prevBtn.classList.toggle('disabled', campaignState.dialogueIndex === 0);
  }
  if (nextBtn) {
    const isLast = campaignState.dialogueIndex === campaignState.dialogueSequence.length - 1;
    nextBtn.textContent = isLast ? 'CLOSE' : 'NEXT';
  }
}

export function handleDialogueNext() {
  if (campaignState.dialogueTyping) {
    // Skip typing and show full text
    const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
    if (line) {
      const textEl = document.getElementById('dialogueText');
      if (textEl) textEl.textContent = line.text;
      campaignState.dialogueTyping = false;
    }
  } else {
    // Next slide
    if (campaignState.dialogueIndex < campaignState.dialogueSequence.length - 1) {
      campaignState.dialogueIndex++;
      startTypingLine();
    } else {
      closeDialogue();
    }
  }
}

export function handleDialoguePrev() {
  if (campaignState.dialogueIndex > 0) {
    campaignState.dialogueIndex--;
    startTypingLine();
    // Complete typing immediately for history review
    const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
    const textEl = document.getElementById('dialogueText');
    if (line && textEl) textEl.textContent = line.text;
    campaignState.dialogueTyping = false;
  }
}

function closeDialogue() {
  console.log('[CampaignSystem] closeDialogue called');
  const container = document.getElementById('dialogueContainer');
  if (container) {
    console.log('[CampaignSystem] Adding "hidden" class to dialogue container');
    container.classList.add('hidden');
  }
  campaignState.state = 'playing';
  if (ctxRef) {
    console.log('[CampaignSystem] Unpausing match physics/updates');
    ctxRef.match.paused = false; // Unpause match loop
  }
  if (campaignState.onDialogueComplete) {
    console.log('[CampaignSystem] Triggering onDialogueComplete callback');
    campaignState.onDialogueComplete();
    campaignState.onDialogueComplete = null;
  }
}

// Injects dialogue markup dynamically if it is not inside index.html yet
function injectDialogueHTML() {
  const container = document.createElement('div');
  container.id = 'dialogueContainer';
  container.className = 'dialogue-container hidden';
  container.innerHTML = `
    <div class="dialogue-noise-overlay"></div>
    <div class="dialogue-scanlines"></div>
    <canvas id="dialogueStaticCanvas" width="128" height="128"></canvas>
    <div class="dialogue-frame">
      <div class="dialogue-portrait-wrapper">
        <img id="dialoguePortrait" src="" alt="Portrait">
        <div class="dialogue-portrait-scanner"></div>
      </div>
      <div class="dialogue-content">
        <div id="dialogueSpeaker" class="dialogue-speaker">COMMANDER</div>
        <div id="dialogueText" class="dialogue-text">Initializing dialogue link...</div>
        <div class="dialogue-actions">
          <button id="dialoguePrevBtn" type="button" class="dialogue-btn">BACK</button>
          <button id="dialogueNextBtn" type="button" class="dialogue-btn">NEXT</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(container);

  // Bind click event listeners
  document.getElementById('dialoguePrevBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    handleDialoguePrev();
  });
  document.getElementById('dialogueNextBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    handleDialogueNext();
  });
  container.addEventListener('click', () => {
    handleDialogueNext();
  });
}

// Dynamic noise frame rendering tick
function updateDialogueStatic() {
  const canvas = document.getElementById('dialogueStaticCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.random() * 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 20; // 0.08 opacity static overlay
  }
  ctx.putImageData(imgData, 0, 0);
}

export function updateCampaignDebugHUD() {
  if (!campaignState.active) {
    const hud = document.getElementById('campaignDebugHUD');
    if (hud) hud.classList.add('hidden');
    return;
  }
  
  let hud = document.getElementById('campaignDebugHUD');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'campaignDebugHUD';
    hud.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 99999;
      background: rgba(8, 12, 16, 0.85);
      border: 1px solid rgba(255, 85, 0, 0.4);
      border-radius: 4px;
      padding: 10px 14px;
      color: #ffaa55;
      font-family: 'Outfit', 'Inter', monospace;
      font-size: 11px;
      pointer-events: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      letter-spacing: 0.5px;
      width: 250px;
    `;
    document.body.appendChild(hud);
  }
  
  hud.classList.remove('hidden');
  
  const container = document.getElementById('dialogueContainer');
  const containerVisible = container ? !container.classList.contains('hidden') : 'NOT_FOUND';
  
  hud.innerHTML = `
    <div style="font-weight: 900; border-bottom: 1px solid rgba(255,85,0,0.25); padding-bottom: 4px; margin-bottom: 6px; color:#ff5500;">
      // TACTICAL SYSTEM MONITOR
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CAMPAIGN ACTIVE:</span>
      <span style="color:#00ff88;">TRUE</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CAMPAIGN STATE:</span>
      <span style="color:#00e0ff;">${campaignState.state.toUpperCase()}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>DIALOGUE ACTIVE:</span>
      <span style="color:${campaignState.state === 'dialogue' ? '#00ff88' : '#888'};">${campaignState.state === 'dialogue' ? 'YES' : 'NO'}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>DIALOGUE SEQ INDEX:</span>
      <span>${campaignState.dialogueIndex}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>TYPING LINE:</span>
      <span style="color:${campaignState.dialogueTyping ? '#ffcc00' : '#888'};">${campaignState.dialogueTyping ? 'TRUE' : 'FALSE'}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CONTAINER VISIBLE:</span>
      <span style="color:${containerVisible === true ? '#00ff88' : '#ff3333'}; font-weight:bold;">${containerVisible.toString().toUpperCase()}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <span>GATES PASSED:</span>
      <span>${campaignState.gates.filter(g => g.triggered).length} / ${campaignState.gates.length}</span>
    </div>
  `;
}

// Main Campaign Update Loop Hook
export function updateCampaign(ctx, dt, physics) {
  ctxRef = ctx;
  if (!campaignState.active) {
    const hud = document.getElementById('campaignDebugHUD');
    if (hud) hud.classList.add('hidden');
    return;
  }

  updateCampaignDebugHUD();

  // 1. Dialogue overlay ticking (Typewriter effect & TV Static)
  if (campaignState.state === 'dialogue') {
    updateDialogueStatic();
    
    if (campaignState.dialogueTyping) {
      campaignState.dialogueTextTimer += dt;
      // Print 40 chars per second
      if (campaignState.dialogueTextTimer >= 0.025) {
        campaignState.dialogueTextTimer = 0;
        const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
        if (line) {
          campaignState.dialogueCharIndex++;
          const textEl = document.getElementById('dialogueText');
          if (textEl) {
            textEl.textContent = line.text.substring(0, campaignState.dialogueCharIndex);
          }
          if (campaignState.dialogueCharIndex >= line.text.length) {
            campaignState.dialogueTyping = false;
          }
        }
      }
    }
    return; // Freeze rest of the campaign tick while dialogue is active
  }

  // 2. Scan dialogue trigger gates
  if (ctx.player && !ctx.player.health.dead) {
    const playerPos = ctx.player.transform;
    for (let i = 0; i < campaignState.gates.length; i++) {
      const gate = campaignState.gates[i];
      if (!gate.triggered) {
        // Simple 2D bounding box overlap check
        if (playerPos.x >= gate.x1 && playerPos.x <= gate.x2 &&
            playerPos.z >= gate.z1 && playerPos.z <= gate.z2) {
          gate.triggered = true;
          campaignState.activeGateIndex = i;
          
          // Fade out / remove gate visual mesh
          if (gate.mesh) {
            ctx.scene.remove(gate.mesh);
            gate.mesh = null;
          }

          // Trigger dialogue sequence
          triggerDialogueSequence(gate.dialogueIndex);
          updateQuestsHUD();
          checkQuestCompletionNotifications();
          break;
        }
      }
    }
  }

  // 3. Update Campaign Enemies AI (Static Turrets & Floating Drones)
  const player = ctx.player;
  const aliveEnemies = campaignState.enemies.filter(e => !e.health.dead);
  
  aliveEnemies.forEach((enemy) => {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);

    if (player && !player.health.dead) {
      const playerPos = player.transform;
      const dist = distance2D(enemy.transform, playerPos);

      if (enemy.campaignEnemyType === 'turret') {
        const renderGroup = enemy.renderable.group;
        const headGroup = enemy.renderable.headGroup;

        // 1. Aim head smoothly towards player
        const dx = playerPos.x - enemy.transform.x;
        const dz = playerPos.z - enemy.transform.z;
        const targetYaw = Math.atan2(dx, dz);

        // Smooth angle interpolation
        let diff = targetYaw - headGroup.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        headGroup.rotation.y += diff * dt * 5.5;

        // 2. Fire if within range (45 meters) and has Line of Sight
        if (dist <= 45 && enemy.cooldown <= 0) {
          if (hasLineOfSight(enemy.transform, playerPos, ctx.collisionShapes)) {
            // Fire Dual Security Pulses from muzzle positions
            spawnEnemyBullet(ctx, physics, enemy.transform.x, 2.0, enemy.transform.z, headGroup.rotation.y, playerPos);
            enemy.cooldown = 1.25; // Firing rate
          }
        }
      } 
      else if (enemy.campaignEnemyType === 'drone') {
        // 1. Bobbing movement up & down
        enemy.transform.y = 2.0 + Math.sin(performance.now() * 0.004) * 0.15;
        enemy.renderable.group.position.y = enemy.transform.y;

        const dx = playerPos.x - enemy.transform.x;
        const dz = playerPos.z - enemy.transform.z;
        const targetYaw = Math.atan2(dx, dz);
        enemy.renderable.group.rotation.y = targetYaw;

        // 2. Floating AI pathfinding/movement: drift towards player if they are in range (50m) but stay at a distance
        if (dist <= 50) {
          if (dist > 15) {
            const moveSpeed = 8.5; // Drones drift speed
            enemy.transform.x += (dx / dist) * moveSpeed * dt;
            enemy.transform.z += (dz / dist) * moveSpeed * dt;
            physics.setTranslation(enemy.rapierBody.body, enemy.transform.x, enemy.transform.y, enemy.transform.z);
            enemy.renderable.group.position.set(enemy.transform.x, enemy.transform.y, enemy.transform.z);
          }

          // 3. Fire security pulse
          if (enemy.cooldown <= 0 && hasLineOfSight(enemy.transform, playerPos, ctx.collisionShapes)) {
            spawnEnemyBullet(ctx, physics, enemy.transform.x, enemy.transform.y, enemy.transform.z, targetYaw, playerPos);
            enemy.cooldown = 1.6; // Firing rate for drone
          }
        } else {
          // Idle patrol drift around spawn area
          enemy.patrolAngle += dt * 0.4;
          const patrolSpeed = 2.0;
          enemy.transform.x += Math.sin(enemy.patrolAngle) * patrolSpeed * dt;
          enemy.transform.z += Math.cos(enemy.patrolAngle) * patrolSpeed * dt;
          physics.setTranslation(enemy.rapierBody.body, enemy.transform.x, enemy.transform.y, enemy.transform.z);
          enemy.renderable.group.position.set(enemy.transform.x, enemy.transform.y, enemy.transform.z);
        }
      }
    }
  });

  // Handle cleanup of dead enemies (hide, remove collision shape, remove from ECS)
  campaignState.enemies.forEach((enemy) => {
    if (enemy.health.dead && !enemy.cleanedUp) {
      enemy.cleanedUp = true;
      
      // Remove visual mesh from scene
      if (enemy.renderable?.group) {
        ctx.scene.remove(enemy.renderable.group);
      }
      
      // Remove static turret collision shape
      if (enemy.collisionShapeRef) {
        const idx = ctx.collisionShapes.indexOf(enemy.collisionShapeRef);
        if (idx !== -1) ctx.collisionShapes.splice(idx, 1);
      }
      
      // Remove physical sensor from Rapier
      if (enemy.rapierBody && physics) {
        physics.remove(enemy.rapierBody);
      }

      // Remove from ECS
      ctx.ecs.remove(enemy);

      // Trigger Victory sequence if all enemies are dead
      const remaining = campaignState.enemies.filter(e => !e.health.dead).length;
      updateObjectivesHUD(remaining);
      updateQuestsHUD();
      checkQuestCompletionNotifications();
      
      if (remaining === 0 && !campaignState.portalActive) {
        activateExitPortal(ctx);
      }
    }
  });

  // 4. Update Portal rotation and victory checks
  if (campaignState.portalActive && campaignState.portalMesh) {
    campaignState.portalMesh.rotation.y += dt * 1.2;

    if (player && !player.health.dead) {
      const dist = distance2D(player.transform, campaignState.portalPosition);
      if (dist < 4.2) {
        // Player enters portal: trigger Campaign Match Victory!
        triggerCampaignVictory(ctx);
      }
    }
  }

  // 5. Quest Reminder Timer
  if (campaignState.state === 'playing') {
    campaignState.reminderTimer = (campaignState.reminderTimer || 0) + dt;
    if (campaignState.reminderTimer >= 40.0) {
      campaignState.reminderTimer = 0;
      triggerQuestReminder();
    }
  }
}

function activateExitPortal(ctx) {
  campaignState.portalActive = true;
  if (campaignState.portalMesh) {
    campaignState.portalMesh.visible = true;
  }
  updateQuestsHUD();
  checkQuestCompletionNotifications();
  
  // Play portal stabilization audio/visual notification or triggers Dialogue Sequence 4
  triggerDialogueSequence(4);
}

function updateObjectivesHUD(remainingCount) {
  const countEl = document.getElementById('campaignObjectiveCounter');
  if (countEl) {
    countEl.textContent = `HOSTILES REMAINING: ${remainingCount}`;
    if (remainingCount === 0) {
      countEl.innerHTML = `<span style="color: #00f0ff;">PORTAL SECURE // HEAD TO EXTRACTION (-80, -80)</span>`;
    }
  }
}

function triggerCampaignVictory(ctx) {
  campaignState.active = false;
  ctx.match.active = false;
  ctx.match.ended = true;
  ctx.match.winner = ctx.match.playerName || 'Player';
  
  // Custom campaign rewards: huge boost!
  const pr = ctx.match.playerRewards;
  pr.match.exp = 250;
  pr.match.gold = 150;
  pr.total.exp = pr.match.exp + pr.turretHits.exp + pr.weaponHits.exp + pr.kills.exp;
  pr.total.gold = pr.match.gold + pr.turretHits.gold + pr.weaponHits.gold + pr.kills.gold;
  
  import('../core/ProgressionSystem.js').then(({ loadProgression, addExp, addGold, recordLifetimeStats }) => {
    const state = loadProgression();
    addExp(state, pr.total.exp);
    addGold(state, pr.total.gold);
    recordLifetimeStats({
      damageDealt: ctx.player?.score?.damageDealt || 0,
      kills: 5,
      deaths: ctx.player?.score?.deaths || 0,
      gameWins: 1
    });
  });

  // Display the Match Results Overlay!
  const resultsOverlay = document.getElementById('resultsOverlay');
  if (resultsOverlay) {
    resultsOverlay.classList.add('visible');
    
    // Sync summary values
    document.getElementById('resultsHeader').innerHTML = `<h2 class="victory-anim">MISSION COMPLETED</h2><p>Sector 4 cleared successfully</p>`;
    document.getElementById('resultsWinnerText').textContent = 'WINNER: ' + ctx.match.playerName.toUpperCase();
    document.getElementById('resultsMVPText').textContent = 'MVP: ' + ctx.match.playerName.toUpperCase();
    
    const rows = `
      <div class="result-reward-row"><span>MISSION BONUS EXP</span><strong>+250 EXP</strong></div>
      <div class="result-reward-row"><span>MISSION BONUS GOLD</span><strong>+150 GOLD</strong></div>
      <div class="result-reward-row"><span>COMBAT KILLS EXP</span><strong>+${pr.kills.exp} EXP</strong></div>
      <div class="result-reward-row"><span>WEAPON ACCURACY EXP</span><strong>+${pr.weaponHits.exp} EXP</strong></div>
      <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 8px 0;" />
      <div class="result-reward-row" style="color: #82ffcf;"><span>TOTAL GAINED</span><strong>+${pr.total.exp} EXP / +${pr.total.gold} G</strong></div>
    `;
    document.getElementById('resultsRewards').innerHTML = rows;
  }
}

// Injects the hud counter directly
export function showCampaignObjectiveHUD(remainingCount) {
  let hudContainer = document.getElementById('campaignObjectiveHUD');
  if (!hudContainer) {
    hudContainer = document.createElement('div');
    hudContainer.id = 'campaignObjectiveHUD';
    hudContainer.className = 'campaign-objective-hud';
    hudContainer.innerHTML = `
      <div class="objective-header">// CAMPAIGN OBJECTIVE</div>
      <div id="campaignObjectiveCounter" class="objective-counter">HOSTILES REMAINING: ${remainingCount}</div>
    `;
    document.getElementById('hud').appendChild(hudContainer);
  }
  hudContainer.classList.remove('hidden');
  updateObjectivesHUD(remainingCount);
}

export function hideCampaignObjectiveHUD() {
  const hudContainer = document.getElementById('campaignObjectiveHUD');
  if (hudContainer) hudContainer.classList.add('hidden');
  hideCampaignQuestsHUD();
}

export function showCampaignQuestsHUD() {
  let questsContainer = document.getElementById('campaignQuests');
  if (!questsContainer) {
    questsContainer = document.createElement('div');
    questsContainer.id = 'campaignQuests';
    questsContainer.className = 'campaign-quests';
    questsContainer.innerHTML = `
      <div class="quests-header">Campaign Quests</div>
      <div class="quests-list" id="questsList"></div>
    `;
    document.getElementById('hud').appendChild(questsContainer);
  }
  questsContainer.classList.remove('hidden');
  updateQuestsHUD();
}

export function hideCampaignQuestsHUD() {
  const questsContainer = document.getElementById('campaignQuests');
  if (questsContainer) questsContainer.classList.add('hidden');
  
  const popup = document.getElementById('questReminderPopup');
  if (popup) popup.classList.remove('show');
}

export function updateQuestsHUD() {
  const listEl = document.getElementById('questsList');
  if (!listEl) return;

  const gate1Triggered = campaignState.gates?.[0]?.triggered || false;
  const totalEnemies = 5;
  const killedEnemies = campaignState.enemies ? campaignState.enemies.filter(e => e.health.dead).length : 0;
  const defensesCleared = (killedEnemies >= totalEnemies);
  const portalActive = campaignState.portalActive || false;

  const quests = [
    {
      title: 'Infiltrate Compound',
      completed: gate1Triggered,
      active: !gate1Triggered
    },
    {
      title: `Neutralize Defenses (${killedEnemies}/${totalEnemies})`,
      completed: defensesCleared,
      active: gate1Triggered && !defensesCleared
    },
    {
      title: 'Secure the Exit',
      completed: portalActive,
      active: defensesCleared && !portalActive
    },
    {
      title: 'Reach Extraction',
      completed: false,
      active: portalActive
    }
  ];

  listEl.innerHTML = quests.map(q => {
    const statusClass = q.completed ? 'completed' : '';
    const opacityStyle = q.active ? 'opacity: 1;' : 'opacity: 0.55;';
    return `
      <div class="quest-item ${statusClass}" style="${opacityStyle}">
        <div class="quest-checkbox"></div>
        <div class="quest-text">${q.title}</div>
      </div>
    `;
  }).join('');
}

function triggerQuestReminder() {
  const gate1Triggered = campaignState.gates?.[0]?.triggered || false;
  const killedEnemies = campaignState.enemies ? campaignState.enemies.filter(e => e.health.dead).length : 0;
  const defensesCleared = (killedEnemies >= 5);
  const portalActive = campaignState.portalActive || false;

  let activeDesc = 'Infiltrate the compound area.';
  if (portalActive) {
    activeDesc = 'Get to the exit portal at coordinate (-80, -80) to extract!';
  } else if (defensesCleared) {
    activeDesc = 'Secure the exit perimeter to stabilize the portal.';
  } else if (gate1Triggered) {
    activeDesc = `Clear out automated defenses (${killedEnemies}/5 neutralized).`;
  }

  let popup = document.getElementById('questReminderPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'questReminderPopup';
    popup.className = 'quest-reminder-popup';
    popup.innerHTML = `
      <div class="quest-reminder-title">SYS_ALERT: CURRENT OBJECTIVE</div>
      <div id="questReminderDesc" class="quest-reminder-desc"></div>
    `;
    document.getElementById('hud').appendChild(popup);
  }
  
  const descEl = document.getElementById('questReminderDesc');
  if (descEl) descEl.textContent = activeDesc;

  popup.classList.add('show');

  try {
    if (window.Tone) {
      const synth = new Tone.Synth().toDestination();
      synth.triggerAttackRelease("E5", "16n", undefined, 0.03);
    }
  } catch (e) {}

  setTimeout(() => {
    popup.classList.remove('show');
  }, 4500);
}

function checkQuestCompletionNotifications() {
  const gate1Triggered = campaignState.gates?.[0]?.triggered || false;
  const killedEnemies = campaignState.enemies ? campaignState.enemies.filter(e => e.health.dead).length : 0;
  const defensesCleared = (killedEnemies >= 5);
  const portalActive = campaignState.portalActive || false;

  let currentCompleted = 0;
  let lastCompletedName = '';
  
  if (gate1Triggered) {
    currentCompleted++;
    lastCompletedName = 'Infiltrate Compound';
  }
  if (defensesCleared) {
    currentCompleted++;
    lastCompletedName = 'Neutralize Defenses';
  }
  if (portalActive) {
    currentCompleted++;
    lastCompletedName = 'Secure the Exit';
  }

  if (campaignState.lastCompletedQuestCount === undefined) {
    campaignState.lastCompletedQuestCount = 0;
  }

  if (currentCompleted > campaignState.lastCompletedQuestCount) {
    showQuestCompletionPopup(lastCompletedName);
    campaignState.lastCompletedQuestCount = currentCompleted;
    campaignState.reminderTimer = 0;
  }
}

function showQuestCompletionPopup(questName) {
  let popup = document.getElementById('questReminderPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'questReminderPopup';
    popup.className = 'quest-reminder-popup';
    document.getElementById('hud').appendChild(popup);
  }
  popup.innerHTML = `
    <div class="quest-reminder-title" style="color: #82ffcf; text-shadow: 0 0 8px rgba(130, 255, 207, 0.5);">✓ OBJECTIVE COMPLETED</div>
    <div class="quest-reminder-desc">${questName.toUpperCase()}</div>
  `;
  popup.classList.add('show');
  
  try {
    if (window.Tone) {
      const synth = new Tone.Synth().toDestination();
      synth.triggerAttackRelease("A5", "16n", undefined, 0.04);
    }
  } catch (e) {}

  setTimeout(() => {
    popup.classList.remove('show');
  }, 4000);
}
