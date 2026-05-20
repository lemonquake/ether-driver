import * as THREE from 'three';
import { distance2D, makeObb, findObbCollision } from '../core/collision.js';
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
  dialogueDelay: 0,
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
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'Wait... Energy spikes are off the charts near the extraction portal! Something massive is warping in!' },
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'It\'s the SECTOR WARDEN heavy combat Mech! It is armed with dual sweeping gatling lasers and proximity EMP mines!' },
    { speaker: 'WARDEN AI', portrait: 'textures/commander_portrait.png', text: 'WARNING: MAXIMUM LOCKDOWN SECURITY ACTIVE. HOSTILE RACER CORRUPTING COMPILER PERIMETER. INITIALIZING PURGE PROTOCOL.' }
  ],
  // Sequence 4: All Enemies Dead (Portal Active)
  [
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'Incredible! The Sector Warden has been completely dismantled. Security overrides are disabled.' },
    { speaker: 'COMMANDER', portrait: 'textures/commander_portrait.png', text: 'The exit portal at coordinates (-80, -80) is now stable! Get through it and escape Sector 4 before reinforcements arrive!' }
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
    isCampaignEnemy: true,
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

  const coll = {
    type: 'drone',
    x,
    z,
    w: 2.4,
    d: 2.4,
    r: 0,
    padding: 0.25,
    height: 3.5,
    isCampaignEnemy: true,
  };
  ctx.collisionShapes.push(coll);

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
    collisionShapeRef: coll,
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
  const targetY = targetPoint.y !== undefined ? targetPoint.y + 0.75 : 0.75;
  const dy = targetY - startY;
  const dist3D = Math.hypot(dx, dy, dz) || 1.0;
  
  const dirX = dx / dist3D;
  const dirY = dy / dist3D;
  const dirZ = dz / dist3D;
  const aimYaw = Math.atan2(dx, dz);

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
    velocity: { x: dirX * weapon.speed, y: dirY * weapon.speed, z: dirZ * weapon.speed },
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
  campaignState.bossSpawned = false;
  campaignState.bossDefeated = false;
  campaignState.debugTimer = 0;

  // Clear boss UI
  const oldBossContainer = document.getElementById('bossHealthBarContainer');
  if (oldBossContainer) oldBossContainer.remove();

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
    mesh.visible = false; // Dialogue triggers are invisible to the player
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
let typingSynth = null;
let interfaceSynth = null;

function getTypingSynth() {
  if (typingSynth) return typingSynth;
  if (window.Tone) {
    try {
      typingSynth = new window.Tone.MonoSynth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 },
        filter: { Q: 1, type: "lowpass", frequency: 1200 },
        filterEnvelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 }
      }).toDestination();
      typingSynth.volume.value = -28; // Subtle mechanical terminal ticks
    } catch (e) {
      console.warn("[CampaignSystem] Error creating typing synth:", e);
    }
  }
  return typingSynth;
}

function getInterfaceSynth() {
  if (interfaceSynth) return interfaceSynth;
  if (window.Tone) {
    try {
      interfaceSynth = new window.Tone.PolySynth(window.Tone.Synth).toDestination();
      interfaceSynth.set({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
      });
      interfaceSynth.volume.value = -18; // Clean UI sound volume
    } catch (e) {
      console.warn("[CampaignSystem] Error creating interface synth:", e);
    }
  }
  return interfaceSynth;
}

function playTypingSound(charIndex) {
  if (charIndex % 2 !== 0) return;
  const synth = getTypingSynth();
  if (synth && window.Tone.context && window.Tone.context.state === 'running') {
    try {
      const pitch = 900 + Math.random() * 300;
      synth.triggerAttackRelease(pitch, "64n");
    } catch (e) {}
  }
}

function playInterfaceSound(type) {
  const synth = getInterfaceSynth();
  if (synth && window.Tone.context && window.Tone.context.state === 'running') {
    try {
      if (type === 'next') {
        synth.triggerAttackRelease(["E5", "G5"], "16n");
      } else if (type === 'prev') {
        synth.triggerAttackRelease(["G4", "E4"], "16n");
      } else if (type === 'close') {
        synth.triggerAttackRelease(["C5", "C4"], "8n");
      } else if (type === 'open') {
        synth.triggerAttackRelease(["C4", "G4", "C5"], "8n");
      }
    } catch (e) {}
  }
}

function handleDialogueKeyDown(e) {
  if (campaignState.state !== 'dialogue') return;
  
  if (e.key === 'Escape') {
    e.preventDefault();
    closeDialogue();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    handleDialogueNext();
  } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
    e.preventDefault();
    handleDialoguePrev();
  }
}

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
  console.log('[CampaignSystem] showDialogueBox called');
  
  // Inject/recreate the dialogue structure
  injectDialogueHTML();
  
  const container = document.getElementById('dialogueContainer');
  if (container) {
    container.classList.remove('hidden');
  }
  
  // Bind escape/arrows key listeners
  window.removeEventListener('keydown', handleDialogueKeyDown);
  window.addEventListener('keydown', handleDialogueKeyDown);
  
  playInterfaceSound('open');
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

  const container = document.getElementById('dialogueContainer');
  const portraitEl = document.getElementById('dialoguePortrait');
  const speakerEl = document.getElementById('dialogueSpeaker');
  const textEl = document.getElementById('dialogueText');

  const oldSpeaker = speakerEl ? speakerEl.textContent : '';
  const isSpeakerChanged = oldSpeaker && oldSpeaker !== line.speaker;

  if (container) {
    container.className = 'dialogue-container';
    container.classList.add(`speaker-${line.speaker.toLowerCase()}`);
    container.classList.add('is-typing');
  }

  if (portraitEl) {
    portraitEl.src = line.portrait;
  }
  if (speakerEl) {
    speakerEl.textContent = line.speaker;
  }

  // Visual portrait glitch sweep on speaker change
  const glitchEl = container ? container.querySelector('.dialogue-portrait-glitch') : null;
  if (glitchEl && isSpeakerChanged) {
    glitchEl.style.opacity = '0.7';
    setTimeout(() => {
      glitchEl.style.opacity = '0';
    }, 150);
  }
  
  campaignState.dialogueCharIndex = 0;
  campaignState.dialogueTextTimer = 0;
  campaignState.dialogueDelay = 0;
  campaignState.dialogueTyping = true;
  if (textEl) textEl.textContent = '';
  
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
      
      const container = document.getElementById('dialogueContainer');
      if (container) container.classList.remove('is-typing');
      
      playInterfaceSound('next');
    }
  } else {
    // Next slide
    if (campaignState.dialogueIndex < campaignState.dialogueSequence.length - 1) {
      campaignState.dialogueIndex++;
      playInterfaceSound('next');
      startTypingLine();
    } else {
      closeDialogue();
    }
  }
}

export function handleDialoguePrev() {
  if (campaignState.dialogueIndex > 0) {
    campaignState.dialogueIndex--;
    playInterfaceSound('prev');
    startTypingLine();
    // Complete typing immediately for history review
    const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
    const textEl = document.getElementById('dialogueText');
    if (line && textEl) textEl.textContent = line.text;
    campaignState.dialogueTyping = false;
    
    const container = document.getElementById('dialogueContainer');
    if (container) container.classList.remove('is-typing');
  }
}

function closeDialogue() {
  console.log('[CampaignSystem] closeDialogue called');
  const container = document.getElementById('dialogueContainer');
  
  window.removeEventListener('keydown', handleDialogueKeyDown);
  
  if (container) {
    container.classList.add('dialogue-closing');
    playInterfaceSound('close');
    
    setTimeout(() => {
      container.classList.add('hidden');
      container.classList.remove('dialogue-closing');
      container.remove(); // Clean cleanup
      
      campaignState.state = 'playing';
      if (ctxRef) {
        ctxRef.match.paused = false; // Unpause match loop
      }
      if (campaignState.onDialogueComplete) {
        campaignState.onDialogueComplete();
        campaignState.onDialogueComplete = null;
      }
    }, 300);
  } else {
    campaignState.state = 'playing';
    if (ctxRef) {
      ctxRef.match.paused = false;
    }
    if (campaignState.onDialogueComplete) {
      campaignState.onDialogueComplete();
      campaignState.onDialogueComplete = null;
    }
  }
}

// Injects dialogue markup dynamically if it is not inside index.html yet
function injectDialogueHTML() {
  const oldContainer = document.getElementById('dialogueContainer');
  if (oldContainer) {
    oldContainer.remove();
  }

  const container = document.createElement('div');
  container.id = 'dialogueContainer';
  container.className = 'dialogue-container hidden';
  container.innerHTML = `
    <div class="dialogue-grid-bg"></div>
    <div class="dialogue-scanlines"></div>
    <canvas id="dialogueStaticCanvas" width="128" height="128"></canvas>
    <div class="dialogue-frame">
      <div class="dialogue-portrait-section">
        <div class="dialogue-portrait-wrapper">
          <img id="dialoguePortrait" src="" alt="Portrait">
          <div class="dialogue-portrait-scanner"></div>
          <div class="dialogue-portrait-glitch"></div>
        </div>
        <div class="dialogue-audio-waveform">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </div>
      </div>
      <div class="dialogue-body-section">
        <div class="dialogue-header">
          <div class="dialogue-speaker-badge">
            <span class="bracket">[</span>
            <span id="dialogueSpeaker" class="dialogue-speaker">COMMANDER</span>
            <span class="bracket">]</span>
          </div>
          <div class="dialogue-live-tag">
            <span class="live-pulse"></span>
            <span class="live-text">LIVE SIGNAL</span>
          </div>
        </div>
        <div class="dialogue-text-wrapper">
          <div id="dialogueText" class="dialogue-text">Initializing dialogue link...</div>
        </div>
        <div class="dialogue-footer">
          <div class="dialogue-tips">
            <span class="key-tip">SPACE / CLICK</span> to advance • <span class="key-tip">ESC</span> to skip
          </div>
          <div class="dialogue-actions">
            <button id="dialoguePrevBtn" type="button" class="dialogue-btn">
              <span class="btn-arrow">◀</span> BACK
            </button>
            <button id="dialogueNextBtn" type="button" class="dialogue-btn primary">
              NEXT <span class="btn-arrow">▶</span>
            </button>
          </div>
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
  container.addEventListener('click', (e) => {
    if (e.target.closest('.dialogue-btn')) return;
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
    data[i + 3] = 16; // Subtle static opacity overlay
  }
  ctx.putImageData(imgData, 0, 0);
}

export function updateCampaignDebugHUD(ctx) {
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
  
  const aliveEnemies = campaignState.enemies.filter(e => !e.health.dead);
  let closestDist = 'N/A';
  let closestSees = 'N/A';
  let closestType = 'N/A';
  if (ctx.player && !ctx.player.health.dead && aliveEnemies.length > 0) {
    let bestDist = Infinity;
    let bestEnemy = null;
    aliveEnemies.forEach(e => {
      const d = distance2D(e.transform, ctx.player.transform);
      if (d < bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    });
    if (bestEnemy) {
      closestDist = bestDist.toFixed(1) + 'm';
      closestType = bestEnemy.campaignEnemyType.toUpperCase();
      closestSees = hasLineOfSight(bestEnemy.transform, ctx.player.transform, ctx.collisionShapes) ? 'YES' : 'NO';
    }
  }

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
      <span>ENEMIES ALIVE:</span>
      <span style="color:#ff3333; font-weight:bold;">${aliveEnemies.length}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CLOSEST ENEMY:</span>
      <span>${closestType}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CLOSEST DIST:</span>
      <span>${closestDist}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>CLOSEST SEES:</span>
      <span style="color:${closestSees === 'YES' ? '#00ff88' : '#ff3333'}; font-weight:bold;">${closestSees}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>PLAYER TEAM:</span>
      <span style="color:#00ff88;">${ctx.player ? ctx.player.teamId : 'N/A'}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
      <span>PLAYER HEALTH:</span>
      <span style="color:#00ff88;">${ctx.player ? ctx.player.health.current.toFixed(1) : 'N/A'}</span>
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

  // Throttle the Debug HUD updating to prevent heavy DOM rendering and distance loops every frame (lag fix)
  campaignState.debugTimer = (campaignState.debugTimer || 0) + dt;
  if (campaignState.debugTimer >= 0.15) {
    campaignState.debugTimer = 0;
    updateCampaignDebugHUD(ctx);
  }

  // 1. Dialogue overlay ticking (Typewriter effect & TV Static)
  if (campaignState.state === 'dialogue') {
    updateDialogueStatic();
    
    if (campaignState.dialogueTyping) {
      if (campaignState.dialogueDelay && campaignState.dialogueDelay > 0) {
        campaignState.dialogueDelay -= dt;
      } else {
        campaignState.dialogueTextTimer += dt;
        // Print 50 chars per second
        if (campaignState.dialogueTextTimer >= 0.02) {
          campaignState.dialogueTextTimer = 0;
          const line = campaignState.dialogueSequence[campaignState.dialogueIndex];
          if (line) {
            campaignState.dialogueCharIndex++;
            const textEl = document.getElementById('dialogueText');
            if (textEl) {
              textEl.textContent = line.text.substring(0, campaignState.dialogueCharIndex);
            }
            
            // Play mechanical tick beep sound
            playTypingSound(campaignState.dialogueCharIndex);

            if (campaignState.dialogueCharIndex >= line.text.length) {
              campaignState.dialogueTyping = false;
              const container = document.getElementById('dialogueContainer');
              if (container) container.classList.remove('is-typing');
            } else {
              // Pause delays on punctuation to mimic actual speech delivery pacing
              const curChar = line.text[campaignState.dialogueCharIndex - 1];
              const nextChar = line.text[campaignState.dialogueCharIndex];
              if ((curChar === '.' || curChar === ',' || curChar === '!' || curChar === '?') && nextChar === ' ') {
                campaignState.dialogueDelay = curChar === ',' ? 0.15 : 0.35;
              }
            }
          }
        }
      }
    }
    return; // Freeze rest of the campaign tick while dialogue is active
  }

  // Update animated searchlights, reactor core generators, radioactive green slag and electric fences
  updateCampaignAnimationsAndHazards(ctx, dt);

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
          if (gate.dialogueIndex === 3) {
            triggerDialogueSequence(3, () => {
              spawnSectorWarden(ctx);
            });
          } else {
            triggerDialogueSequence(gate.dialogueIndex);
          }
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
        let nextX = enemy.transform.x;
        let nextZ = enemy.transform.z;

        if (dist <= 50) {
          if (dist > 15) {
            const moveSpeed = 8.5; // Drones drift speed
            nextX += (dx / dist) * moveSpeed * dt;
            nextZ += (dz / dist) * moveSpeed * dt;
          }
        } else {
          // Idle drift around spawn area
          enemy.patrolAngle += dt * 0.4;
          const patrolSpeed = 2.0;
          nextX += Math.sin(enemy.patrolAngle) * patrolSpeed * dt;
          nextZ += Math.cos(enemy.patrolAngle) * patrolSpeed * dt;
        }

        // Apply OBB collision detection against walls, buildings, and static obstacles
        const droneObb = makeObb(nextX, nextZ, 2.0, 2.0, targetYaw || 0);
        const filteredShapes = ctx.collisionShapes.filter((shape) => {
          if (shape.isCampaignEnemy) return false;
          let obstacleHeight = shape.height !== undefined && shape.height > 0 ? shape.height : 0;
          if (obstacleHeight === 0) {
            if (shape.type === 'wall' || shape.type === 'building') {
              obstacleHeight = 35;
            } else if (shape.type === 'barrier') {
              obstacleHeight = 0.6;
            } else if (shape.type === 'crate') {
              obstacleHeight = 1.8;
            } else if (shape.type === 'parked-car') {
              obstacleHeight = 1.3;
            }
          }
          return enemy.transform.y < obstacleHeight;
        });

        const collision = findObbCollision(droneObb, filteredShapes);
        if (collision) {
          enemy.transform.x = nextX + collision.normal.x * (collision.depth + 0.05);
          enemy.transform.z = nextZ + collision.normal.z * (collision.depth + 0.05);
          if (dist > 50) {
            // Divert patrol angle
            enemy.patrolAngle = Math.atan2(collision.normal.x, collision.normal.z) + (Math.random() - 0.5) * 1.5;
          }
        } else {
          enemy.transform.x = nextX;
          enemy.transform.z = nextZ;
        }

        physics.setTranslation(enemy.rapierBody.body, enemy.transform.x, enemy.transform.y, enemy.transform.z);
        enemy.renderable.group.position.set(enemy.transform.x, enemy.transform.y, enemy.transform.z);

        // Update the collision shape coordinates as the drone moves!
        if (enemy.collisionShapeRef) {
          enemy.collisionShapeRef.x = enemy.transform.x;
          enemy.collisionShapeRef.z = enemy.transform.z;
        }

        // 3. Fire security pulse
        if (dist <= 50 && enemy.cooldown <= 0 && hasLineOfSight(enemy.transform, playerPos, ctx.collisionShapes)) {
          spawnEnemyBullet(ctx, physics, enemy.transform.x, enemy.transform.y, enemy.transform.z, targetYaw, playerPos);
          enemy.cooldown = 1.6; // Firing rate for drone
        }
      }
      else if (enemy.campaignEnemyType === 'boss') {
        // Bobbing vertical movement
        enemy.transform.y = 2.5 + Math.sin(performance.now() * 0.005) * 0.25;
        enemy.renderable.group.position.y = enemy.transform.y;

        const dx = playerPos.x - enemy.transform.x;
        const dz = playerPos.z - enemy.transform.z;
        const targetYaw = Math.atan2(dx, dz);

        // Slowly rotate boss chassis toward player
        let diff = targetYaw - enemy.renderable.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        enemy.renderable.group.rotation.y += diff * dt * 3.2;
        enemy.transform.yaw = enemy.renderable.group.rotation.y;

        if (enemy.collisionShapeRef) {
          enemy.collisionShapeRef.x = enemy.transform.x;
          enemy.collisionShapeRef.z = enemy.transform.z;
        }

        // Maintain combat distance
        if (dist > 28) {
          const driftSpeed = 5.0;
          enemy.transform.x += (dx / dist) * driftSpeed * dt;
          enemy.transform.z += (dz / dist) * driftSpeed * dt;
          enemy.renderable.group.position.x = enemy.transform.x;
          enemy.renderable.group.position.z = enemy.transform.z;
        } else if (dist < 15) {
          const backSpeed = 4.0;
          enemy.transform.x -= (dx / dist) * backSpeed * dt;
          enemy.transform.z -= (dz / dist) * backSpeed * dt;
          enemy.renderable.group.position.x = enemy.transform.x;
          enemy.renderable.group.position.z = enemy.transform.z;
        }

        // Update HUD Health Bar Fill dynamically (optimized with cached elements & dirty checks to avoid layout thrashing)
        const pct = Math.max(0, (enemy.health.current / enemy.health.max) * 100);
        if (enemy.lastPct === undefined || enemy.lastPct !== pct) {
          enemy.lastPct = pct;
          const fillEl = enemy.hud?.fill || document.getElementById('bossHealthBarFill');
          if (fillEl) {
            fillEl.style.width = `${pct}%`;
            const statusEl = enemy.hud?.status || fillEl.parentElement?.nextElementSibling;
            if (statusEl) {
              if (pct > 60) {
                statusEl.textContent = `SYSTEMS: NOMINAL // HEALTH: ${pct.toFixed(0)}%`;
              } else if (pct > 25) {
                statusEl.textContent = `WARNING: HULL INTEGRITY CRITICAL // EMP MINES ARMED`;
                statusEl.style.color = '#ff9f1a';
              } else {
                statusEl.textContent = `CRITICAL FAILURE IMMINENT // MELTDOWN SEQUENCE ACTIVE`;
                statusEl.style.color = '#ff4757';
                statusEl.style.animation = 'warningTextPulse 0.2s infinite alternate';
              }
            }
          }
        }

        // Combat Phases
        enemy.phaseTimer += dt;
        if (enemy.phase === 'gatling') {
          if (enemy.cooldown <= 0 && dist < 50 && hasLineOfSight(enemy.transform, playerPos, ctx.collisionShapes)) {
            const yaw = enemy.transform.yaw;
            const mlx = enemy.transform.x - Math.cos(yaw) * 2.5 + Math.sin(yaw) * 2.65;
            const mlz = enemy.transform.z + Math.sin(yaw) * 2.5 + Math.cos(yaw) * 2.65;
            const mrx = enemy.transform.x + Math.cos(yaw) * 2.5 + Math.sin(yaw) * 2.65;
            const mrz = enemy.transform.z - Math.sin(yaw) * 2.5 + Math.cos(yaw) * 2.65;

            spawnEnemyBullet(ctx, physics, mlx, enemy.transform.y, mlz, yaw, playerPos);
            spawnEnemyBullet(ctx, physics, mrx, enemy.transform.y, mrz, yaw, playerPos);

            enemy.cooldown = 0.22; // rapid laser sweeps
          }

          if (enemy.phaseTimer >= 7.0) {
            enemy.phase = 'emp_deploy';
            enemy.phaseTimer = 0;
            enemy.mineDeployCount = 0;
          }
        } 
        else if (enemy.phase === 'emp_deploy') {
          if (enemy.phaseTimer >= 0.5 && enemy.mineDeployCount < 3) {
            enemy.mineDeployCount++;
            enemy.phaseTimer = 0;
            const offset = Math.random() * Math.PI * 2;
            const mx = enemy.transform.x + Math.sin(offset) * 8.0;
            const mz = enemy.transform.z + Math.cos(offset) * 8.0;
            spawnProximityEMPMine(ctx, mx, mz);
          }

          if (enemy.mineDeployCount >= 3 && enemy.phaseTimer >= 1.5) {
            enemy.phase = 'gatling';
            enemy.phaseTimer = 0;
          }
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

      if (enemy.campaignEnemyType === 'boss') {
        const bar = document.getElementById('bossHealthBarContainer');
        if (bar) bar.remove();
        campaignState.bossDefeated = true;
        
        // Disable electric fences visually
        if (ctx.campaignDecorations && ctx.campaignDecorations.electricFences) {
          ctx.campaignDecorations.electricFences.forEach((fence) => {
            if (fence.plasmaMesh) {
              fence.plasmaMesh.visible = false;
            }
            if (fence.light) {
              fence.light.intensity = 0;
            }
          });
        }
        
        // Remove collision shapes of type 'electric-fence'
        ctx.collisionShapes = ctx.collisionShapes.filter(shape => shape.type !== 'electric-fence');

        // Trigger boss kill dialogues sequence
        triggerDialogueSequence(4);
      }

      // Trigger Victory sequence if all enemies are dead
      const remaining = campaignState.enemies.filter(e => !e.health.dead).length;
      updateObjectivesHUD(remaining);
      updateQuestsHUD();
      checkQuestCompletionNotifications();
      
      if (remaining === 0 && !campaignState.portalActive) {
        if (campaignState.bossSpawned) {
          activateExitPortal(ctx);
        } else {
          const tips = document.getElementById('quickTipsLayer');
          if (tips) {
            tips.innerHTML = `<span style="color:#00f0ff; font-weight:bold;">[SECURE EXTRACTION: PROCEED TO (-80, -80)]</span>`;
            tips.style.display = 'block';
          }
        }
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
  const killedEnemies = campaignState.enemies ? campaignState.enemies.filter(e => e.health.dead && e.campaignEnemyType !== 'boss').length : 0;
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

// --- 5. MALFUNCTIONING HAZARDS & SEARCHLIGHTS ANIMATOR ---
function updateCampaignAnimationsAndHazards(ctx, dt) {
  if (!ctx.campaignDecorations) return;

  const player = ctx.player;
  const hasPlayer = player && !player.health.dead;
  const now = performance.now();
  const appEl = document.getElementById('app');

  // 0. Malfunctioning wall lights sputtering
  if (ctx.campaignDecorations.flickeringLights) {
    ctx.campaignDecorations.flickeringLights.forEach((fl) => {
      const rng = Math.random();
      if (rng < 0.08) {
        // Deep drop-out (sputtering dark state)
        fl.light.intensity = 0.05;
        fl.bulb.material.emissiveIntensity = 0.1;
      } else if (rng < 0.25) {
        // Flickering dim/unstable state
        fl.light.intensity = fl.baseIntensity * (0.2 + Math.random() * 0.3);
        fl.bulb.material.emissiveIntensity = 0.4 + Math.random() * 0.4;
      } else {
        // Full bright state
        fl.light.intensity = fl.baseIntensity * (0.9 + Math.random() * 0.2);
        fl.bulb.material.emissiveIntensity = fl.baseEmissive * (0.9 + Math.random() * 0.2);
      }
    });
  }

  // Decrement hazard cooldowns
  if (player) {
    if (player.hazardCooldown === undefined) player.hazardCooldown = 0;
    if (player.hazardCooldown > 0) player.hazardCooldown -= dt;
  }
  const aliveEnemies = campaignState.enemies ? campaignState.enemies.filter(e => !e.health.dead) : [];
  aliveEnemies.forEach((enemy) => {
    if (enemy.hazardCooldown === undefined) enemy.hazardCooldown = 0;
    if (enemy.hazardCooldown > 0) enemy.hazardCooldown -= dt;
  });

  // 1. Generator
  const gen = ctx.campaignDecorations.generator;
  if (gen) {
    gen.time += dt;
    gen.ring.rotation.z += dt * 3.5;
    if (gen.group.children[1]) {
      const core = gen.group.children[1];
      core.material.emissiveIntensity = 1.6 + Math.sin(gen.time * 8) * 0.6;
      if (Math.random() < 0.1) {
        core.material.emissiveIntensity = 4.5;
      }
    }
    if (Math.random() < 0.16) {
      gen.light.intensity = 0.3 + Math.random() * 0.7;
    } else {
      gen.light.intensity = 1.8 + Math.random() * 0.4;
    }
  }

  // 2. Searchlights
  ctx.campaignDecorations.spotlights.forEach((spot) => {
    spot.angle = (spot.angle || 0) + dt * spot.sweepSpeed;
    const sweepAngle = spot.baseAngle + Math.sin(spot.angle) * 0.7;
    
    spot.target.position.x = spot.x + Math.sin(sweepAngle) * 22;
    spot.target.position.z = spot.z + Math.cos(sweepAngle) * 22;
    spot.headGroup.lookAt(spot.target.position);

    if (hasPlayer) {
      const pPos = player.transform;
      const distToLight = Math.hypot(pPos.x - spot.target.position.x, pPos.z - spot.target.position.z);
      
      if (distToLight < 6.5) {
        if (Math.random() < 0.2) {
          spot.spotlight.color.setHex(0xff3333);
          spot.beam.material.color.setHex(0xff3333);
        } else {
          spot.spotlight.color.setHex(0x00f0ff);
          spot.beam.material.color.setHex(0x00f0ff);
        }
        
        const tips = document.getElementById('quickTipsLayer');
        if (tips) {
          tips.innerHTML = `<span style="color:#ff3333; font-weight:bold; animation: warningTextPulse 0.4s infinite alternate;">[WARNING: AREA SCAN DETECTED]</span>`;
          tips.style.display = 'block';
        }
      } else {
        spot.spotlight.color.setHex(0x00f0ff);
        spot.beam.material.color.setHex(0x00f0ff);
      }
    }
  });

  // 3. Radioactive Green Slag Puddles & EMP Mines
  let onSlag = false;
  ctx.campaignDecorations.slagPuddles.forEach((puddle) => {
    if (puddle.isMine) {
      puddle.timeActive += dt;
      puddle.flashTimer += dt;
      
      puddle.mesh.position.y = 0.45 + Math.sin(now * 0.008) * 0.12;

      if (puddle.flashTimer >= 0.5) {
        puddle.flashTimer = 0;
        puddle.light.intensity = puddle.light.intensity === 0 ? 3.0 : 0;
        if (puddle.mesh.children[1]) {
          puddle.mesh.children[1].material.emissiveIntensity = puddle.light.intensity;
        }
      }

      if (hasPlayer && !puddle.detonated) {
        const dist = Math.hypot(player.transform.x - puddle.x, player.transform.z - puddle.z);
        if (dist < 8.0) {
          puddle.detonated = true;
          puddle.light.color.setHex(0xff3333);
          if (puddle.mesh.children[1]) {
            puddle.mesh.children[1].material.color.setHex(0xff3333);
            puddle.mesh.children[1].material.emissive.setHex(0xff3333);
          }
          
          setTimeout(() => {
            if (ctx.effects) {
              ctx.effects.emitDeathExplosion(puddle.x, puddle.z, { playerDeath: false });
              ctx.effects.emitImpact?.(puddle.x, puddle.z, { x: 0, z: 1 }, 18);
            }

            const endDist = Math.hypot(player.transform.x - puddle.x, player.transform.z - puddle.z);
            if (endDist < 9.5) {
              applyDamage(player, 25.0, 'energy', null, ctx.effects, { ctx });

              if (player.weaponSlots) {
                ['q', 'e'].forEach((slot) => {
                  const w = player.weaponSlots[slot];
                  if (w && w.ammo !== undefined) {
                    w.ammo = Math.max(0, w.ammo - 2);
                  }
                });
                if (player.weaponSlots.turret && player.weaponSlots.turret.ammoInMagazine !== undefined) {
                  player.weaponSlots.turret.ammoInMagazine = Math.max(0, player.weaponSlots.turret.ammoInMagazine - 12);
                }
              }
              
              if (appEl) {
                appEl.classList.add('emp-shock-flicker');
                setTimeout(() => appEl.classList.remove('emp-shock-flicker'), 450);
              }
            }

            ctx.scene.remove(puddle.mesh);
            const listIdx = ctx.campaignDecorations.slagPuddles.indexOf(puddle);
            if (listIdx !== -1) {
              ctx.campaignDecorations.slagPuddles.splice(listIdx, 1);
            }
          }, 800);
        }
      }
      return;
    }

    puddle.mesh.material.emissiveIntensity = 2.0 + Math.sin(now * 0.005) * 0.5;

    if (hasPlayer) {
      const dist = Math.hypot(player.transform.x - puddle.x, player.transform.z - puddle.z);
      if (dist < puddle.radius + 1.8) {
        onSlag = true;
        if (player.hazardCooldown <= 0) {
          applyDamage(player, 15.0 * 0.15, 'energy', null, ctx.effects, { ctx });
          player.hazardCooldown = 0.15;
        }
      }
    }

    aliveEnemies.forEach((enemy) => {
      if (enemy.campaignEnemyType === 'boss') return; // Boss is invulnerable to traps
      let radiusBonus = 1.6;
      if (enemy.campaignEnemyType === 'turret') radiusBonus = 2.5;

      const dist = Math.hypot(enemy.transform.x - puddle.x, enemy.transform.z - puddle.z);
      if (dist < puddle.radius + radiusBonus) {
        if (enemy.hazardCooldown <= 0) {
          applyDamage(enemy, 15.0 * 0.15, 'energy', null, ctx.effects, { ctx });
          enemy.hazardCooldown = 0.15;
        }
      }
    });
  });

  if (appEl) {
    if (onSlag) {
      appEl.classList.add('cyber-screen-glitch');
      if (Math.random() < 0.1) {
        appEl.classList.add('slag-leak-flash');
        setTimeout(() => appEl.classList.remove('slag-leak-flash'), 250);
      }
    } else {
      appEl.classList.remove('cyber-screen-glitch');
    }
  }

  // 4. Electric Fences
  ctx.campaignDecorations.electricFences.forEach((fence) => {
    if (campaignState.bossDefeated) {
      if (fence.plasmaMesh) fence.plasmaMesh.visible = false;
      if (fence.light) fence.light.intensity = 0;
      return;
    }

    const noise = Math.sin(now * 0.04);
    fence.plasmaMesh.scale.x = 1.0 + noise * 0.12;
    fence.plasmaMesh.scale.z = 1.0 + noise * 0.12;
    if (Math.random() < 0.08) {
      fence.plasmaMesh.material.emissiveIntensity = 5.0;
      fence.light.intensity = 2.5;
    } else {
      fence.plasmaMesh.material.emissiveIntensity = 2.5 + noise * 0.5;
      fence.light.intensity = 1.2 + noise * 0.25;
    }

    if (hasPlayer) {
      const px = player.transform.x;
      const pz = player.transform.z;
      const dx = fence.x2 - fence.x1;
      const dz = fence.z2 - fence.z1;
      const segLenSq = dx*dx + dz*dz;
      let t = 0;
      if (segLenSq > 0) {
        t = ((px - fence.x1)*dx + (pz - fence.z1)*dz) / segLenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const closestX = fence.x1 + t*dx;
      const closestZ = fence.z1 + t*dz;
      const dist = Math.hypot(px - closestX, pz - closestZ);

      if (dist < 2.2) {
        if (player.hazardCooldown <= 0) {
          applyDamage(player, 40.0 * 0.15, 'energy', null, ctx.effects, { ctx });
          player.hazardCooldown = 0.15;
        }
        
        if (player.velocity) {
          player.velocity.speed *= 0.88;
        }

        if (appEl && !appEl.classList.contains('emp-shock-flicker')) {
          appEl.classList.add('emp-shock-flicker');
          setTimeout(() => appEl.classList.remove('emp-shock-flicker'), 400);
        }
      }
    }

    aliveEnemies.forEach((enemy) => {
      if (enemy.campaignEnemyType === 'boss') return; // Boss is invulnerable to traps
      const ex = enemy.transform.x;
      const ez = enemy.transform.z;
      const dx = fence.x2 - fence.x1;
      const dz = fence.z2 - fence.z1;
      const segLenSq = dx*dx + dz*dz;
      let t = 0;
      if (segLenSq > 0) {
        t = ((ex - fence.x1)*dx + (ez - fence.z1)*dz) / segLenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const closestX = fence.x1 + t*dx;
      const closestZ = fence.z1 + t*dz;
      const dist = Math.hypot(ex - closestX, ez - closestZ);

      let radiusBonus = 2.2;
      if (enemy.campaignEnemyType === 'turret') radiusBonus = 3.0;

      if (dist < radiusBonus) {
        if (enemy.hazardCooldown <= 0) {
          applyDamage(enemy, 40.0 * 0.15, 'energy', null, ctx.effects, { ctx });
          enemy.hazardCooldown = 0.15;
        }
        
        if (enemy.velocity) {
          enemy.velocity.speed *= 0.88;
        }
      }
    });
  });

  // 5. Particles
  ctx.campaignDecorations.steamVents.forEach((vent) => {
    vent.spawnTimer += dt;
    if (vent.spawnTimer >= (vent.isFire ? 0.06 : 0.14)) {
      vent.spawnTimer = 0;
      const geom = new THREE.SphereGeometry(vent.isFire ? 0.22 : 0.28, 5, 5);
      const mat = new THREE.MeshBasicMaterial({
        color: vent.isFire ? 0xff3e3e : 0xd1ccc0,
        transparent: true,
        opacity: vent.isFire ? 0.85 : 0.2,
        depthWrite: false
      });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        (Math.random() - 0.5) * 1.3,
        0,
        (Math.random() - 0.5) * 1.3
      );
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = vent.isFire ? 2.4 + Math.random()*2.2 : 1.1 + Math.random() * 0.8;
      p.vz = (Math.random() - 0.5) * 0.4;
      p.scaleSpeed = vent.isFire ? 0.7 : 1.4;
      p.life = vent.isFire ? 0.55 : 1.6;
      p.maxLife = p.life;
      vent.group.add(p);
      vent.particles.push(p);
    }

    for (let i = vent.particles.length - 1; i >= 0; i--) {
      const p = vent.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        vent.group.remove(p);
        vent.particles.splice(i, 1);
      } else {
        p.position.x += p.vx * dt;
        p.position.y += p.vy * dt;
        p.position.z += p.vz * dt;
        const ratio = p.life / p.maxLife;
        p.material.opacity = (vent.isFire ? 0.85 : 0.2) * ratio;
        p.scale.setScalar(1.0 + (1.0 - ratio) * p.scaleSpeed);
        if (vent.isFire) {
          p.material.color.setHSL(0.01 + 0.12 * (1.0 - ratio), 1.0, 0.55);
        }
      }
    }
  });
}

function spawnSectorWarden(ctx) {
  if (campaignState.bossSpawned) return;
  campaignState.bossSpawned = true;

  const bossGroup = new THREE.Group();
  bossGroup.position.set(-80, 2.5, -50); 
  
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222f3e, metalness: 0.9, roughness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.0, 4.0), bodyMat);
  body.castShadow = true;
  bossGroup.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.8, roughness: 0.2 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 2.5), headMat);
  head.position.set(0, 1.2, 0.8);
  head.castShadow = true;
  bossGroup.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2222, emissiveIntensity: 3.5 });
  const eye = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.1), eyeMat);
  eye.position.set(0, 1.2, 2.06);
  bossGroup.add(eye);

  const gunMat = new THREE.MeshStandardMaterial({ color: 0x57606f, metalness: 0.9, roughness: 0.15 });
  const barrelGeom = new THREE.CylinderGeometry(0.3, 0.3, 3.2, 12);
  
  const gunL = new THREE.Mesh(barrelGeom, gunMat);
  gunL.position.set(-2.5, 0, 1.0);
  gunL.rotation.x = Math.PI / 2;
  gunL.castShadow = true;
  bossGroup.add(gunL);

  const gunR = new THREE.Mesh(barrelGeom, gunMat);
  gunR.position.set(2.5, 0, 1.0);
  gunR.rotation.x = Math.PI / 2;
  gunR.castShadow = true;
  bossGroup.add(gunR);

  const muzzleGeom = new THREE.SphereGeometry(0.32, 8, 8);
  const muzL = new THREE.Mesh(muzzleGeom, eyeMat);
  muzL.position.set(-2.5, 0, 2.65);
  bossGroup.add(muzL);

  const muzR = new THREE.Mesh(muzzleGeom, eyeMat);
  muzR.position.set(2.5, 0, 2.65);
  bossGroup.add(muzR);

  const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00a8ff, emissiveIntensity: 4.0 });
  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.0, 0.8, 12), thrusterMat);
  thruster.position.y = -1.6;
  bossGroup.add(thruster);

  ctx.scene.add(bossGroup);

  const coll = {
    type: 'boss-mech',
    x: -80,
    z: -50,
    w: 6.0,
    d: 6.0,
    r: 0,
    padding: 0.3,
    height: 5.0,
    isCampaignEnemy: true
  };
  ctx.collisionShapes.push(coll);

  const entity = {
    id: 'campaign-boss-warden',
    isCampaignEnemy: true,
    campaignEnemyType: 'boss',
    teamId: 'red',
    team: 'red',
    teamColor: '#ff2222',
    teamName: 'Sector Warden AI',
    displayName: 'THE SECTOR WARDEN',
    health: { current: 600, max: 600, dead: false, hitFlash: 0 },
    transform: { x: -80, y: 2.5, z: -50, yaw: 0 },
    renderable: { group: bossGroup },
    collisionShapeRef: coll,
    cooldown: 0,
    phase: 'gatling', 
    phaseTimer: 0,
    mineDeployCount: 0
  };

  ctx.ecs.add(entity);
  campaignState.enemies.push(entity);

  showBossHUD();
  entity.hud = {
    fill: document.getElementById('bossHealthBarFill'),
    status: document.getElementById('bossHealthBarFill')?.parentElement?.nextElementSibling
  };
}

function spawnProximityEMPMine(ctx, x, z) {
  if (!ctx.campaignDecorations) return;

  const mineGroup = new THREE.Group();
  mineGroup.position.set(x, 0.4, z);

  const base = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), new THREE.MeshStandardMaterial({ color: 0x3d3d3d, metalness: 0.9, roughness: 0.2 }));
  base.castShadow = true;
  mineGroup.add(base);

  const lightRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffaa00, emissiveIntensity: 2.0 }));
  lightRing.rotation.x = Math.PI / 2;
  mineGroup.add(lightRing);

  const pointLight = new THREE.PointLight(0xffaa00, 1.2, 8);
  pointLight.position.set(0, 0, 0);
  mineGroup.add(pointLight);

  ctx.scene.add(mineGroup);

  ctx.campaignDecorations.slagPuddles.push({
    isMine: true,
    x,
    z,
    mesh: mineGroup,
    light: pointLight,
    flashTimer: 0,
    detonated: false,
    timeActive: 0
  });
}

function showBossHUD() {
  let container = document.getElementById('bossHealthBarContainer');
  if (container) container.remove();

  container = document.createElement('div');
  container.id = 'bossHealthBarContainer';
  container.className = 'boss-health-bar-container';
  container.innerHTML = `
    <div class="boss-name">SECTOR WARDEN - COMPILER MECH</div>
    <div class="boss-health-bar">
      <div id="bossHealthBarFill" class="boss-health-bar-fill" style="width: 100%;"></div>
    </div>
    <div class="boss-status">SYSTEMS: ACTIVE // EMP ONLINE</div>
  `;
  document.getElementById('app').appendChild(container);
  
  setTimeout(() => {
    container.classList.add('active');
  }, 100);
}
