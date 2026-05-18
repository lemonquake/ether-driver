import { weaponCatalog } from '../data/weapons.js';
import { getScoreRows } from '../match/MatchSystem.js';
import { getWeaponIcon } from './WeaponIcons.js';
import * as THREE from 'three';

export function createHUD(ctx) {
  const ui = {
    hud: document.querySelector('#hud'),
    speed: document.querySelector('#speed'),
    rpm: document.querySelector('#rpm'),
    gear: document.querySelector('#gear'),
    drift: document.querySelector('#drift'),
    driveMode: document.querySelector('#driveMode'),
    speedNeedle: document.querySelector('.speed-needle'),
    steeringWheel: document.querySelector('#steeringWheel'),
    throttleFill: document.querySelector('#throttleFill'),
    brakeFill: document.querySelector('#brakeFill'),
    minimapContainer: document.querySelector('#minimapContainer'),
    minimap: document.querySelector('#minimap'),
    healthFill: document.querySelector('#healthFill'),
    armorText: document.querySelector('#armorText'),
    weaponPanel: document.querySelector('#weaponPanel'),
    weaponCardQ: document.querySelector('#weaponCardQ'),
    weaponCardE: document.querySelector('#weaponCardE'),
    weaponIconQ: document.querySelector('#weaponIconQ'),
    weaponIconE: document.querySelector('#weaponIconE'),
    weaponNameQ: document.querySelector('#weaponNameQ'),
    weaponNameE: document.querySelector('#weaponNameE'),
    weaponAmmoQ: document.querySelector('#weaponAmmoQ'),
    weaponAmmoE: document.querySelector('#weaponAmmoE'),
    weaponCooldownQ: document.querySelector('#weaponCooldownQ'),
    weaponCooldownE: document.querySelector('#weaponCooldownE'),
    crosshair: document.querySelector('#crosshair'),
    lockText: document.querySelector('#lockText'),
    targetName: document.querySelector('#targetName'),
    targetRange: document.querySelector('#targetRange'),
    worldLabels: document.querySelector('#worldLabels'),
    killFeed: document.querySelector('#killFeed'),
    killBanner: document.querySelector('#killBanner'),
    scoreboard: document.querySelector('#scoreboard'),
    scoreboardBody: document.querySelector('#scoreboardBody'),
    matchMenu: document.querySelector('#matchMenu'),
    teamSetupStep: document.querySelector('#teamSetupStep'),
    continueToGarageButton: document.querySelector('#continueToGarageButton'),
    backToTeamButton: document.querySelector('#backToTeamButton'),
    playerNameInput: document.querySelector('#playerNameInput'),
    teamBuilder: document.querySelector('#teamBuilder'),
    garagePanel: document.querySelector('#garagePanel'),
    garageTitle: document.querySelector('#garageTitle'),
    garagePreview: document.querySelector('#garagePreview'),
    garageControls: document.querySelector('#garageControls'),
    garageStats: document.querySelector('#garageStats'),
    teamCountButtons: [...document.querySelectorAll('[data-team-count]')],
    weaponToggles: [...document.querySelectorAll('[data-weapon-toggle]')],
    startMatchButton: document.querySelector('#startMatchButton'),
    resultsOverlay: document.querySelector('#resultsOverlay'),
    resultsTitle: document.querySelector('#resultsTitle'),
    resultsBody: document.querySelector('#resultsBody'),
    restartMatchButton: document.querySelector('#restartMatchButton'),
    pauseMenu: document.querySelector('#pauseMenu'),
    resumeGameButton: document.querySelector('#resumeGameButton'),
    settingsButton: document.querySelector('#settingsButton'),
    restartGameButton: document.querySelector('#restartGameButton'),
    mainMenuButton: document.querySelector('#mainMenuButton'),
    settingsMenu: document.querySelector('#settingsMenu'),
    closeSettingsButton: document.querySelector('#closeSettingsButton'),
  };
  if (ui.worldLabels) {
    ui.worldLabels.textContent = '';
    ui.vehicleLabelsLayer = document.createElement('div');
    ui.vehicleLabelsLayer.className = 'world-label-layer';
    ui.damageNumbersLayer = document.createElement('div');
    ui.damageNumbersLayer.className = 'damage-number-layer';
    ui.worldLabels.append(ui.vehicleLabelsLayer, ui.damageNumbersLayer);
  }
  ui.minimapCtx = ui.minimap.getContext('2d');
  ui._minimapShakeTimer = 0;
  ui._minimapGlitchTimer = 0;
  ui._prevWeaponQ = null;
  ui._prevWeaponE = null;
  ui._activeBanners = [];
  return ui;
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderScoreRows(rows) {
  return rows.map((row) => `
    <div class="scoreboard-grid" style="--team-color:${esc(row.teamColor)}">
      <span>${esc(row.name)}</span>
      <span style="color:${esc(row.teamColor)}">${esc(row.team)}</span>
      <span>${row.kills}</span>
      <span>${row.deaths}</span>
      <span>${row.respawn ? `RESP ${row.respawn}` : row.health}</span>
      <span>${esc(row.turretAmmo)} | ${esc(row.q)} / ${esc(row.e)}</span>
    </div>
  `).join('');
}

function renderTeamScoreboard(ctx) {
  const rows = getScoreRows(ctx);
  const teams = (ctx.match?.teams || [])
    .map((team) => {
      const teamRows = rows.filter((row) => row.teamId === team.id);
      const kills = teamRows.reduce((sum, row) => sum + row.kills, 0);
      const damage = teamRows.reduce((sum, row) => sum + row.damage, 0);
      return { ...team, rows: teamRows, kills, damage };
    })
    .sort((a, b) => b.kills - a.kills || b.damage - a.damage);
  return teams.map((team) => `
    <section class="score-team" style="--team-color:${esc(team.color)}">
      <header><strong>${esc(team.name)}</strong><span>${team.kills} KILLS · ${team.damage} DMG</span></header>
      ${renderScoreRows(team.rows)}
    </section>
  `).join('');
}

export function updateMatchUI(ctx, ui) {
  // Only rebuild kill feed when content actually changes
  const feedLen = ctx.match?.killFeed?.length || 0;
  const feedKey = feedLen > 0 ? `${feedLen}-${ctx.match.killFeed[0]?.line}` : '0';
  if (ui._lastFeedKey !== feedKey) {
    ui._lastFeedKey = feedKey;
    if (ui.killFeed) {
      ui.killFeed.innerHTML = (ctx.match?.killFeed || []).map((item) => `<p style="--team-color:${esc(item.color || '#82ffcf')}">${esc(item.line)}</p>`).join('');
    }
  }
  // Only rebuild scoreboard when it's actually visible
  const sbVisible = Boolean(ctx.match?.scoreboardOpen || ctx.match?.ended);
  if (ui.scoreboard) ui.scoreboard.classList.toggle('visible', sbVisible);
  if (sbVisible) {
    const rows = getScoreRows(ctx);
    if (ui.scoreboardBody) ui.scoreboardBody.innerHTML = renderTeamScoreboard(ctx) || renderScoreRows(rows);
    if (ui.resultsOverlay) {
      const visible = Boolean(ctx.match?.ended);
      ui.resultsOverlay.classList.toggle('visible', visible);
      if (visible) {
        ui.resultsTitle.textContent = `${ctx.match.winner} WINS`;
        ui.resultsBody.innerHTML = renderScoreRows(rows);
      }
    }
  }
}

// ── Weapon Cards ─────────────────────────────────────────────
function updateWeaponCard(slot, cardEl, iconEl, nameEl, ammoEl, cooldownEl, prevWeaponRef, refKey, ui) {
  if (!slot) {
    cardEl.classList.remove('active', 'depleting', 'on-cooldown');
    cardEl.classList.add('empty');
    iconEl.innerHTML = '';
    nameEl.textContent = 'EMPTY';
    ammoEl.textContent = '';
    cooldownEl.style.setProperty('--cooldown-progress', '0');
    ui[refKey] = null;
    return;
  }

  const weapon = weaponCatalog[slot.weaponId];
  if (!weapon) return;

  cardEl.classList.remove('empty');
  cardEl.classList.add('active');

  // Update icon only when weapon changes
  if (ui[refKey] !== slot.weaponId) {
    iconEl.innerHTML = getWeaponIcon(slot.weaponId);
    ui[refKey] = slot.weaponId;
  }

  nameEl.textContent = weapon.name;
  const ammo = Number.isFinite(slot.ammo) ? slot.ammo : '∞';
  ammoEl.textContent = `×${ammo}`;

  // Cooldown visual — conic-gradient sweep
  const cooldownProgress = slot.cooldown > 0 ? slot.cooldown / weapon.cooldown : 0;
  cooldownEl.style.setProperty('--cooldown-progress', cooldownProgress.toFixed(3));
  cardEl.classList.toggle('on-cooldown', slot.cooldown > 0);

  // Depleting flash — ammo <= 1
  const depleting = Number.isFinite(slot.ammo) && slot.ammo <= 1;
  cardEl.classList.toggle('depleting', depleting);
}

function updateWeaponPanel(ctx, ui) {
  const player = ctx.player;
  if (!player) return;
  updateWeaponCard(player.weaponSlots.q, ui.weaponCardQ, ui.weaponIconQ, ui.weaponNameQ, ui.weaponAmmoQ, ui.weaponCooldownQ, ui._prevWeaponQ, '_prevWeaponQ', ui);
  updateWeaponCard(player.weaponSlots.e, ui.weaponCardE, ui.weaponIconE, ui.weaponNameE, ui.weaponAmmoE, ui.weaponCooldownE, ui._prevWeaponE, '_prevWeaponE', ui);
}

// ── Kill Banner ──────────────────────────────────────────────
function processKillBanners(ctx, ui) {
  if (!ctx.match?.killBannerQueue?.length) return;
  const perFrameLimit = 2;
  let processed = 0;
  while (ctx.match.killBannerQueue.length > 0 && processed < perFrameLimit) {
    const item = ctx.match.killBannerQueue.shift();
    showKillBanner(ui, item.line, item.color);
    processed += 1;
  }
  if (ctx.match.killBannerQueue.length > 4) {
    ctx.match.killBannerQueue.splice(0, ctx.match.killBannerQueue.length - 4);
  }
}

function showKillBanner(ui, line, color) {
  const el = document.createElement('div');
  el.className = 'kill-banner-line';
  el.textContent = line;
  el.style.setProperty('--kill-color', color);
  ui.killBanner.appendChild(el);

  // Remove after animation completes
  setTimeout(() => {
    el.classList.add('kill-banner-exit');
    setTimeout(() => el.remove(), 600);
  }, 2800);

  // Cap max visible banners
  const children = ui.killBanner.children;
  while (children.length > 4) {
    children[0].remove();
  }
}

// ── Main HUD Update ─────────────────────────────────────────
export function updateHUD(ctx, ui, dt = 0.016) {
  const player = ctx.player;
  updateMatchUI(ctx, ui);
  processKillBanners(ctx, ui);
  if (!player) {
    ui.crosshair?.classList.remove('acquired', 'locked', 'lost');
    if (ui.lockText) ui.lockText.textContent = 'NO LOCK';
    if (ui.targetName) ui.targetName.textContent = '';
    if (ui.targetRange) ui.targetRange.textContent = '';
    return;
  }
  const speedKmh = Math.abs(player.velocity.speed) * 3.6;
  const speedAngle = -128 + Math.min(speedKmh, 180) / 180 * 260;
  const keys = ctx.input.keys;
  ui.speed.textContent = `${Math.round(speedKmh)}`;
  ui.rpm.textContent = `${Math.round(900 + speedKmh * 42 + (keys.has('KeyW') ? 2200 : 0))}`;
  ui.gear.textContent = player.velocity.speed < -1 ? 'R' : Math.abs(player.velocity.speed) < 1 ? 'N' : 'D';
  ui.drift.textContent = `${Math.round(Math.abs(player.velocity.steer) * 100)}%`;
  ui.driveMode.textContent = ctx.input.lockedTarget ? 'target locked' : ctx.input.hoverTarget ? 'target acquired' : 'combat run';
  ui.speedNeedle.style.transform = `rotate(${speedAngle}deg)`;
  ui.steeringWheel.style.transform = `rotate(${player.velocity.steer * 118}deg)`;
  ui.throttleFill.style.height = `${keys.has('KeyW') ? 100 : 0}%`;
  ui.brakeFill.style.height = `${keys.has('KeyS') || keys.has('Space') ? 100 : 0}%`;
  ui.healthFill.style.width = `${Math.max(0, player.health.current / player.health.max * 100)}%`;
  ui.healthFill.style.setProperty('--team-color', player.teamColor || '#82ffcf');
  ui.healthFill.parentElement?.style.setProperty('--team-color', player.teamColor || '#82ffcf');
  ui.armorText.textContent = `${player.displayName || 'PLAYER'} · ${player.teamName || 'TEAM'} · ${player.vehicle.armorType.toUpperCase()}`;

  // Turret ammo — show in drive mode text area
  const turret = player.weaponSlots.turret;
  const reloadProgress = turret?.isReloading ? 1 - turret.reloadRemaining / turret.reloadTime : 0;

  // Weapon panel update
  updateWeaponPanel(ctx, ui);

  const lockState = ctx.input.lockState || 'idle';
  const target = ctx.input.lockedTarget || ctx.input.hoverTarget;
  ui.crosshair.classList.toggle('acquired', lockState === 'acquired');
  ui.crosshair.classList.toggle('locked', lockState === 'locked');
  ui.crosshair.classList.toggle('lost', lockState === 'lost');
  if (ui.lockText) {
    if (lockState === 'locked') ui.lockText.textContent = 'TARGET LOCKED';
    else if (lockState === 'acquired') ui.lockText.textContent = 'HOLD RMB TO LOCK';
    else ui.lockText.textContent = 'NO LOCK';
  }
  if (ui.targetName) ui.targetName.textContent = target ? target.vehicle.name : '';
  if (ui.targetRange) {
    const range = target ? Math.hypot(target.transform.x - player.transform.x, target.transform.z - player.transform.z) : 0;
    ui.targetRange.textContent = target ? `${Math.round(range)}M / ${target.health.current.toFixed(0)}HP` : '';
  }

  // Position crosshair using delayed NDC
  if (ctx.input.crosshairNDC) {
    const cx = (ctx.input.crosshairNDC.x * 0.5 + 0.5) * window.innerWidth;
    const cy = (-ctx.input.crosshairNDC.y * 0.5 + 0.5) * window.innerHeight;
    ui.crosshair.style.left = `${cx}px`;
    ui.crosshair.style.top = `${cy}px`;
    ui.crosshair.style.transform = `translate(-50%, -50%)`; // Clean up old transform
  }

  updateWorldLabels(ctx, ui);
  updateDamageNumbers(ctx, ui, dt);

  // Minimap effects — low HP flash and hit shake
  const hpPercent = player.health.current / player.health.max;
  const isCritical = hpPercent <= 0.25 && hpPercent > 0;
  ui.minimapContainer?.classList.toggle('minimap-critical', isCritical);

  const hitBySpecial = player.health.specialHitFlash > 0;
  if (hitBySpecial && ui._minimapShakeTimer <= 0) {
    ui._minimapShakeTimer = 0.4;
    ui._minimapGlitchTimer = 0.3;
    ui.minimapContainer?.classList.add('minimap-hit');
    setTimeout(() => ui.minimapContainer?.classList.remove('minimap-hit'), 400);
  }

  const canvas = ctx.canvas;
  canvas.dataset.speed = speedKmh.toFixed(1);
  canvas.dataset.altitude = player.transform.y.toFixed(2);
  canvas.dataset.position = `${player.transform.x.toFixed(2)},${player.transform.z.toFixed(2)}`;
  canvas.dataset.forwardSpeed = player.velocity.speed.toFixed(2);
  canvas.dataset.grounded = 'true';
  canvas.dataset.collisionShapes = String(ctx.collisionShapes.length);
  canvas.dataset.entities = String(ctx.ecs.entities.length);
}

const _tempVec3 = new THREE.Vector3();
function updateWorldLabels(ctx, ui) {
  if (!ui.worldLabels || !ctx.camera) return;
  const labels = ui.vehicleLabelsLayer || ui.worldLabels;
  const children = Array.from(labels.children);
  let childIdx = 0;

  for (const entity of ctx.ecs.entities) {
    if (!entity.vehicle || !entity.health || entity.health.dead) continue;
    
    _tempVec3.set(entity.transform.x, (entity.transform.y || 0) + 2.4, entity.transform.z);
    _tempVec3.project(ctx.camera);
    
    // Ignore if behind camera
    if (_tempVec3.z > 1) continue;

    const x = (_tempVec3.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_tempVec3.y * 0.5 + 0.5) * window.innerHeight;

    let el = children[childIdx];
    if (!el) {
      el = document.createElement('div');
      el.className = 'world-label';
      el.innerHTML = `
        <div class="world-label-name"></div>
        <div class="world-label-hp-bg"><div class="world-label-hp-fill"></div></div>
      `;
      labels.appendChild(el);
      children.push(el);
    }
    
    el.style.transform = `translate(calc(-50% + ${x}px), calc(-100% + ${y}px))`;
    el.style.setProperty('--team-color', entity.teamColor || '#82ffcf');
    el.classList.add('visible');
    
    const nameEl = el.querySelector('.world-label-name');
    const name = entity.displayName || entity.vehicle.name;
    if (nameEl.textContent !== name) nameEl.textContent = name;
    
    const hpFill = el.querySelector('.world-label-hp-fill');
    const hpPct = Math.max(0, entity.health.current / entity.health.max);
    hpFill.style.transform = `scaleX(${hpPct})`;
    
    childIdx++;
  }

  for (let i = childIdx; i < children.length; i++) {
    children[i].classList.remove('visible');
  }
}

// ── Minimap ──────────────────────────────────────────────────
const DAMAGE_NUMBER_MAX_ACTIVE = 32;
const _damageVec3 = new THREE.Vector3();

function damageColor(damageType) {
  if (damageType === 'explosive') return '#ff8f3d';
  if (damageType === 'fire') return '#ff5f3d';
  if (damageType === 'plasma') return '#82ffcf';
  if (damageType === 'shock') return '#7df9ff';
  return '#ffcc66';
}

function updateDamageNumbers(ctx, ui, dt) {
  const layer = ui.damageNumbersLayer || ui.worldLabels;
  if (!layer || !ctx.camera) return;
  const state = ctx.damageNumbers || (ctx.damageNumbers = { active: [], queue: [] });
  const active = state.active;

  for (let i = active.length - 1; i >= 0; i -= 1) {
    active[i].age += dt;
    if (active[i].age >= active[i].life) active.splice(i, 1);
  }

  while (state.queue.length && active.length < DAMAGE_NUMBER_MAX_ACTIVE) {
    active.push(state.queue.shift());
  }

  const pool = ui._damageNumberEls || (ui._damageNumberEls = []);
  for (let i = 0; i < active.length; i += 1) {
    const entry = active[i];
    let el = pool[i];
    if (!el) {
      el = document.createElement('div');
      el.className = 'damage-number';
      layer.appendChild(el);
      pool[i] = el;
    }

    const targetTransform = entry.target?.transform;
    const worldX = targetTransform?.x ?? entry.x;
    const worldY = targetTransform?.y ?? entry.y;
    const worldZ = targetTransform?.z ?? entry.z;
    const progress = Math.min(1, entry.age / entry.life);
    _damageVec3.set(worldX, worldY + 2.55 + progress * 0.75, worldZ);
    _damageVec3.project(ctx.camera);

    if (_damageVec3.z > 1) {
      el.classList.remove('visible');
      el.style.opacity = '0';
      continue;
    }

    const x = (_damageVec3.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_damageVec3.y * 0.5 + 0.5) * window.innerHeight;
    const driftX = Math.sin(entry.seed * 19.13 + progress * 2.4) * 18 * progress;
    const rise = 18 + progress * 34;
    const scale = entry.lethal ? 1.32 : entry.critical ? 1.16 : 1;
    const opacity = Math.max(0, 1 - progress * progress);

    el.textContent = entry.value;
    el.className = `damage-number visible${entry.critical ? ' critical' : ''}${entry.lethal ? ' lethal' : ''}`;
    el.style.setProperty('--damage-color', damageColor(entry.damageType));
    el.style.opacity = opacity.toFixed(3);
    el.style.transform = `translate(calc(-50% + ${x + driftX}px), calc(-50% + ${y - rise}px)) scale(${scale})`;
  }

  for (let i = active.length; i < pool.length; i += 1) {
    pool[i].classList.remove('visible');
    pool[i].style.opacity = '0';
  }
}

export function drawMinimap(ctx, ui, dt) {
  if (!ui.minimapCtx) return;
  const player = ctx.player;
  const c = ui.minimap;
  const m = ui.minimapCtx;
  const hw = c.width / 2;
  const hh = c.height / 2;

  // Timers
  ui._minimapShakeTimer = Math.max(0, (ui._minimapShakeTimer || 0) - (dt || 0.016));
  ui._minimapGlitchTimer = Math.max(0, (ui._minimapGlitchTimer || 0) - (dt || 0.016));

  // Dynamic scale — centered on player, zoom based on speed
  const baseScale = c.width / 460;
  const speedZoom = player ? Math.max(0.85, 1 - Math.abs(player.velocity.speed) * 0.003) : 1;
  const scale = baseScale * speedZoom;

  const centerX = player ? player.transform.x : 0;
  const centerZ = player ? player.transform.z : 0;

  // Background
  m.clearRect(0, 0, c.width, c.height);

  // Dark background with subtle grid
  m.fillStyle = 'rgba(5, 9, 12, 0.94)';
  m.fillRect(0, 0, c.width, c.height);

  // Grid lines
  m.strokeStyle = 'rgba(130, 255, 207, 0.06)';
  m.lineWidth = 0.5;
  const gridStep = 40 * scale;
  const offsetX = (hw - centerX * scale) % gridStep;
  const offsetZ = (hh - centerZ * scale) % gridStep;
  for (let x = offsetX; x < c.width; x += gridStep) {
    m.beginPath(); m.moveTo(x, 0); m.lineTo(x, c.height); m.stroke();
  }
  for (let y = offsetZ; y < c.height; y += gridStep) {
    m.beginPath(); m.moveTo(0, y); m.lineTo(c.width, y); m.stroke();
  }

  m.save();
  m.translate(hw - centerX * scale, hh - centerZ * scale);
  m.scale(scale, scale);

  // Roads
  m.fillStyle = 'rgba(214, 221, 221, 0.22)';
  ctx.roads.forEach((road) => m.fillRect(road.x - road.w / 2, road.z - road.d / 2, road.w, road.d));

  // Buildings and objects
  ctx.minimapObjects.forEach((obj) => {
    m.save();
    m.translate(obj.x, obj.z);
    m.rotate(obj.r || 0);
    if (obj.type === 'base') {
      m.fillStyle = obj.teamColor;
      m.globalAlpha = 0.35;
    } else if (obj.type === 'building') {
      m.fillStyle = 'rgba(255, 204, 102, 0.45)';
    } else {
      m.fillStyle = 'rgba(255, 95, 125, 0.5)';
    }
    m.fillRect(-obj.w / 2, -obj.d / 2, obj.w, obj.d);
    m.globalAlpha = 1;
    m.restore();
  });

  // Pickups — small diamond pips
  for (const pickup of ctx.ecs.entities.filter((e) => e.pickup && e.renderable?.group.visible)) {
    const weapon = pickup.pickup.weaponId;
    const wx = pickup.transform.x;
    const wz = pickup.transform.z;
    m.save();
    m.translate(wx, wz);
    m.rotate(Math.PI / 4);
    m.fillStyle = 'rgba(255, 255, 255, 0.6)';
    m.fillRect(-2, -2, 4, 4);
    m.restore();
  }

  // Vehicles
  const time = performance.now() * 0.001;
  for (const vehicle of ctx.ecs.entities.filter((e) => e.vehicle && !e.health.dead)) {
    const isPlayer = vehicle === player;
    m.save();
    m.translate(vehicle.transform.x, vehicle.transform.z);
    m.rotate(-vehicle.transform.yaw);

    const color = vehicle.teamColor || '#82ffcf';

    // Pulse for non-player vehicles
    if (!isPlayer) {
      const pulse = 0.6 + Math.sin(time * 3 + vehicle.transform.x) * 0.2;
      m.globalAlpha = pulse;
    }

    // Vehicle arrow — larger for player
    const sz = isPlayer ? 7 : 5.5;
    m.fillStyle = color;
    m.beginPath();
    m.moveTo(0, sz);
    m.lineTo(sz * 0.65, -sz * 0.8);
    m.lineTo(-sz * 0.65, -sz * 0.8);
    m.closePath();
    m.fill();

    // Player gets an outer glow ring
    if (isPlayer) {
      m.strokeStyle = color;
      m.lineWidth = 1.2;
      m.globalAlpha = 0.4 + Math.sin(time * 4) * 0.2;
      m.beginPath();
      m.arc(0, 0, 10, 0, Math.PI * 2);
      m.stroke();
    }

    m.globalAlpha = 1;
    m.restore();
  }

  m.restore();

  // Compass markers
  m.fillStyle = 'rgba(255, 255, 255, 0.4)';
  m.font = '9px Inter, sans-serif';
  m.textAlign = 'center';
  m.fillText('N', hw, 10);
  m.fillText('S', hw, c.height - 4);
  m.textAlign = 'left';
  m.fillText('W', 3, hh + 3);
  m.textAlign = 'right';
  m.fillText('E', c.width - 3, hh + 3);

  // Glitch effect — scanlines on hit
  if (ui._minimapGlitchTimer > 0) {
    const intensity = ui._minimapGlitchTimer / 0.3;
    m.globalAlpha = intensity * 0.6;
    for (let y = 0; y < c.height; y += 3) {
      if (Math.random() > 0.5) {
        m.fillStyle = `rgba(255, ${Math.random() > 0.5 ? '50, 80' : '255, 255'}, ${0.3 + Math.random() * 0.4})`;
        const offset = (Math.random() - 0.5) * 8 * intensity;
        m.fillRect(offset, y, c.width, 1);
      }
    }
    m.globalAlpha = 1;
  }

  // Border vignette
  const gradient = m.createRadialGradient(hw, hh, hw * 0.6, hw, hh, hw * 1.1);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(1, 'rgba(5, 9, 12, 0.8)');
  m.fillStyle = gradient;
  m.fillRect(0, 0, c.width, c.height);
}
