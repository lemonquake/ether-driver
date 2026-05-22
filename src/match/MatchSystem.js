import { aiNames } from '../data/names.js';
import { killLines } from '../data/killLines.js';
import { cloneDefaultTeams } from '../data/teams.js';
import { vehicleCatalog } from '../data/vehicleCatalog.js';
import { applyVehicleTeamVisuals, createVehicleEntity } from '../vehicles/VehicleFactory.js';
import { attachAI } from '../ai/AISystem.js';
import { clearTeamBases, createTeamBases, findBaseForTeam } from '../world/BaseSystem.js';
import { garagePartCatalog, recordGarageTemplateMatchStats } from '../data/vehicleParts.js';
import { grantMatchReward, addExp, addGold, recordLifetimeStats, loadProgression } from '../core/ProgressionSystem.js';

const vehicleIds = ['ether-runner', 'pulse-wasp', 'iron-jackal'];

function generateRandomBlueprint() {
  const parts = garagePartCatalog;
  const randomPart = (category) => parts[category][Math.floor(Math.random() * parts[category].length)].id;
  const paint = parts.paintJob[Math.floor(Math.random() * parts.paintJob.length)];
  return {
    chassisId: randomPart('chassis'),
    cabinId: randomPart('cabin'),
    wheelId: randomPart('wheel'),
    turretId: randomPart('turret'),
    armorId: randomPart('armor'),
    paintJobId: paint.id,
    paintColor: paint.colors ? paint.colors[0] : '#ffffff',
    trimColor: paint.colors ? paint.colors[1] : '#ffffff',
    glowColor: paint.colors ? paint.colors[2] : '#ffffff',
    paintTint: Math.floor(Math.random() * 100),
    trimIntensity: 80 + Math.floor(Math.random() * 40),
    glowIntensity: 80 + Math.floor(Math.random() * 40),
    materialStyle: ['metal', 'matte', 'carbon', 'glow'][Math.floor(Math.random() * 4)],
    wheelPaintColor: '#111519',
    wheelPaintTextureId: '',
    wheelPaintTint: 0,
    turretPaintColor: paint.colors ? paint.colors[1] : '#ffffff',
    turretPaintTextureId: '',
    turretPaintTint: 0,
  };
}

function randomName(index) {
  return aiNames[index % aiNames.length];
}

function teamSpawn(teamIndex, memberIndex, teamCount) {
  const angle = Math.PI * 2 * (teamIndex / teamCount) + Math.PI;
  const side = memberIndex % 2 === 0 ? -1 : 1;
  const row = Math.floor(memberIndex / 2);
  const radius = 128 - row * 8;
  const tangent = angle + Math.PI / 2;
  return {
    x: Math.sin(angle) * radius + Math.sin(tangent) * side * (8 + row * 3),
    z: Math.cos(angle) * radius + Math.cos(tangent) * side * (8 + row * 3),
    yaw: angle + Math.PI,
  };
}

function spawnForTeam(ctx, team, memberIndex, teamIndex, teamCount) {
  const base = findBaseForTeam(ctx, team.id);
  if (!base?.spawnPoints?.length) return teamSpawn(teamIndex, memberIndex, teamCount);
  return base.spawnPoints[memberIndex % base.spawnPoints.length];
}

export function createDefaultMatchState() {
  const teams = cloneDefaultTeams(2);
  return {
    active: false,
    ended: false,
    paused: false,
    teamCount: 2,
    teams,
    playerTeamId: teams[0].id,
    playerName: 'Player',
    enabledWeapons: new Set(['boom-missile', 'bouncy-wouncy', 'shock-lance', 'fire-mine']),
    bases: [],
    scoreboardOpen: false,
    noEnd: false,
    killLimit: 0,
    teamKillLimit: 0,
    killFeed: [],
    killLog: [],
    killBannerQueue: [],
    nextName: 0,
    playerRewards: {
      turretHits: { exp: 0, gold: 0 },
      weaponHits: { exp: 0, gold: 0 },
      kills: { exp: 0, gold: 0 },
      match: { exp: 0, gold: 0 },
      total: { exp: 0, gold: 0 },
    },
  };
}

export function setupScore(entity, displayName, team) {
  entity.displayName = displayName;
  entity.teamId = team.id;
  entity.team = team.id;
  entity.teamName = team.name;
  entity.teamColor = team.color;
  entity.score = { kills: 0, deaths: 0, damageDealt: 0, weaponDamage: {}, weaponsPickedUp: 0, specialFloorUses: { turbo: 0, jump: 0 } };
  applyVehicleTeamVisuals(entity, team, displayName);
}

export function clearVehicles(ctx, physics) {
  clearTeamBases(ctx);
  for (const entity of [...ctx.ecs.entities.filter((e) => e.vehicle || e.projectile)]) {
    if (entity.renderable?.group) ctx.scene.remove(entity.renderable.group);
    if (entity.rapierBody && physics) physics.remove(entity.rapierBody);
    ctx.ecs.remove(entity);
  }
}

export function startMatch(ctx, materials, options, physics) {
  clearVehicles(ctx, physics);
  const optionTeams = options.teams?.length ? options.teams : cloneDefaultTeams(2);
  const playerTeamId = optionTeams.some((team) => team.id === options.playerTeamId) ? options.playerTeamId : optionTeams[0].id;
  const teams = optionTeams.map((team) => ({
    ...team,
    playerCount: options.isCampaign ? (Number(team.playerCount) || 0) : Math.max(1, Math.min(7, Number(team.playerCount) || 1)),
    isPlayerTeam: team.id === playerTeamId,
  }));
  ctx.match.active = true;
  ctx.match.ended = false;
  ctx.match.paused = false;
  ctx.match.winner = null;
  ctx.match.killFeed = [];
  ctx.match.killLog = [];
  ctx.match.killBannerQueue = [];
  ctx.match.teamCount = teams.length;
  ctx.match.teams = teams;
  ctx.match.noEnd = !(options.killLimit > 0 || options.teamKillLimit > 0);
  ctx.match.killLimit = options.killLimit || 0;
  ctx.match.teamKillLimit = options.teamKillLimit || 0;
  ctx.match.scoreboardOpen = false;
  ctx.match.playerTeamId = playerTeamId;
  ctx.match.playerName = options.playerName || 'Player';
  ctx.match.enabledWeapons = new Set(options.enabledWeapons);
  ctx.match.nextName = 0;
  ctx.match.isCampaign = !!options.isCampaign;
  ctx.match.playerRewards = {
    turretHits: { exp: 0, gold: 0 },
    weaponHits: { exp: 0, gold: 0 },
    kills: { exp: 0, gold: 0 },
    match: { exp: 0, gold: 0 },
    total: { exp: 0, gold: 0 },
  };

  let aiIndex = 0;
  createTeamBases(ctx, materials, teams);
  teams.forEach((team, teamIndex) => {
    for (let memberIndex = 0; memberIndex < team.playerCount; memberIndex += 1) {
      const isPlayer = team.id === playerTeamId && memberIndex === 0;
      const spawn = spawnForTeam(ctx, team, memberIndex, teamIndex, teams.length);
      const vehicleSpec = isPlayer && options.playerBlueprint ? options.playerBlueprint : generateRandomBlueprint();
      const entity = createVehicleEntity(ctx, materials, vehicleSpec, spawn, spawn.yaw, isPlayer ? 'player' : 'ai');
      entity.respawn.baseId = team.baseId;
      if (!ctx.match.isCampaign) {
        entity.respawn.invulnerableTimer = 8.0;
      }
      setupScore(entity, isPlayer ? ctx.match.playerName : randomName(ctx.match.nextName++), team);
      if (isPlayer) ctx.player = entity;
      else attachAI(entity, aiIndex++, ctx);
    }
  });
}

export function formatKillLine(killer, victim) {
  const template = killLines[Math.floor(Math.random() * killLines.length)];
  return template.replaceAll('{killer}', killer.displayName || killer.vehicle.name).replaceAll('{victim}', victim.displayName || victim.vehicle.name);
}

export function pushKillFeed(ctx, line, color = '#82ffcf') {
  if (!ctx?.match) return;
  if (ctx.match.isCampaign) return;
  ctx.match.killFeed.unshift({ line, color, time: 5 });
  ctx.match.killFeed = ctx.match.killFeed.slice(0, 6);
  ctx.match.killBannerQueue.push({ line, color, id: Date.now() + Math.random() });
  ctx.match.killBannerQueue = ctx.match.killBannerQueue.slice(-6);
}

function resetVehicleAtSpawn(entity, spawn, ctx) {
  entity.transform.x = spawn.x;
  entity.transform.z = spawn.z;
  entity.transform.yaw = spawn.yaw;
  entity.velocity.speed = 0;
  entity.velocity.steer = 0;
  entity.velocity.wheelSpin = 0;
  entity.health.current = entity.health.max;
  entity.health.dead = false;
  entity.health.hitFlash = 0;
  entity.health.specialHitFlash = 0;
  entity.respawn.timer = 0;
  entity.respawn.invulnerableTimer = (ctx && !ctx.match?.isCampaign) ? 8.0 : 1.25;
  entity.stability.pitch = 0;
  entity.stability.roll = 0;
  entity.stability.angularPitch = 0;
  entity.stability.angularRoll = 0;
  entity.stability.upsideDownTimer = 0;
  entity.stability.recoveryTimer = 0;
  entity.stability.recovering = false;
  const turret = entity.weaponSlots.turret;
  turret.ammoInMagazine = turret.magazineSize;
  turret.cooldown = 0;
  turret.reloadRemaining = 0;
  turret.isReloading = false;
  ['q', 'e'].forEach((slotName) => {
    if (entity.weaponSlots[slotName]) entity.weaponSlots[slotName].cooldown = 0;
  });
}

function updateRespawns(ctx, dt) {
  const entities = ctx.ecs.entities;
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.vehicle || !entity.respawn) continue;
    entity.respawn.invulnerableTimer = Math.max(0, entity.respawn.invulnerableTimer - dt);
    if (!entity.health.dead) continue;
    entity.respawn.timer = Math.max(0, entity.respawn.timer - dt);
    if (entity.respawn.timer > 0) continue;
    const base = findBaseForTeam(ctx, entity.teamId);
    const spawnIndex = (entity.score?.deaths || 0) % (base?.spawnPoints?.length || 1);
    const spawn = base?.spawnPoints?.[spawnIndex] || { x: 0, z: 0, yaw: 0 };
    resetVehicleAtSpawn(entity, spawn, ctx);
  }
}

export function updateMatch(ctx, dt) {
  if (!ctx.match.active || ctx.match.ended) return;
  updateRespawns(ctx, dt);
  ctx.match.killFeed.forEach((item) => {
    item.time -= dt;
  });
  ctx.match.killFeed = ctx.match.killFeed.filter((item) => item.time > 0);

  const wasActive = ctx.match.active;

  // Kill limit — individual player
  if (ctx.match.killLimit > 0) {
    const vehicles = ctx.ecs.entities.filter((e) => e.vehicle);
    for (const v of vehicles) {
      if ((v.score?.kills || 0) >= ctx.match.killLimit) {
        ctx.match.ended = true;
        ctx.match.active = false;
        ctx.match.winner = v.teamName || 'Unknown';
        ctx.match.mvpName = v.displayName;
        break;
      }
    }
  }

  // Team kill limit
  if (!ctx.match.ended && ctx.match.teamKillLimit > 0) {
    const vehicles = ctx.ecs.entities.filter((e) => e.vehicle);
    for (const team of ctx.match.teams) {
      const teamKills = vehicles.filter((v) => v.teamId === team.id).reduce((sum, v) => sum + (v.score?.kills || 0), 0);
      if (teamKills >= ctx.match.teamKillLimit) {
        ctx.match.ended = true;
        ctx.match.active = false;
        ctx.match.winner = team.name || 'Unknown';
        break;
      }
    }
  }

  if (!ctx.match.ended && !ctx.match.noEnd) {
    const vehicles = ctx.ecs.entities.filter((e) => e.vehicle);
    const aliveTeams = ctx.match.teams.filter((team) => vehicles.some((e) => e.teamId === team.id && !e.health.dead));
    if (aliveTeams.length <= 1) {
      ctx.match.ended = true;
      ctx.match.active = false;
      ctx.match.winner = aliveTeams[0]?.name || 'NO TEAM';
    }
  }

  if (wasActive && ctx.match.ended) {
    const playerTeam = ctx.match.teams.find(t => t.id === ctx.match.playerTeamId);
    const playerWon = playerTeam && ctx.match.winner === playerTeam.name;
    const matchBaseReward = grantMatchReward(playerWon);
    
    // Accumulate total match rewards
    const pr = ctx.match.playerRewards;
    pr.match.exp = matchBaseReward.expGain;
    pr.match.gold = matchBaseReward.goldGain;
    
    // Add all hit/kill rewards to progression now
    const extraExp = pr.turretHits.exp + pr.weaponHits.exp + pr.kills.exp;
    const extraGold = pr.turretHits.gold + pr.weaponHits.gold + pr.kills.gold;
    
    const state = loadProgression();
    addExp(state, extraExp);
    addGold(state, extraGold);
    
    pr.total.exp = pr.match.exp + extraExp;
    pr.total.gold = pr.match.gold + extraGold;
    
    // Track stats
    if (ctx.player) {
      recordLifetimeStats({
        damageDealt: ctx.player.score?.damageDealt || 0,
        kills: ctx.player.score?.kills || 0,
        deaths: ctx.player.score?.deaths || 0,
      });
      recordGarageTemplateMatchStats({
        kills: ctx.player.score?.kills || 0,
        deaths: ctx.player.score?.deaths || 0,
        damage: ctx.player.score?.damageDealt || 0,
        won: playerWon,
        pickups: ctx.player.score?.weaponsPickedUp || 0,
        turbo: ctx.player.score?.specialFloorUses?.turbo || 0,
        jump: ctx.player.score?.specialFloorUses?.jump || 0,
      });
    }

    ctx.match.reward = pr.total;
  }
}

export function getScoreRows(ctx) {
  return ctx.ecs.entities
    .filter((e) => e.vehicle)
    .map((e) => ({
      name: e.displayName || e.vehicle.name,
      team: e.teamName || e.teamId || e.team,
      teamId: e.teamId || e.team,
      teamColor: e.teamColor || '#82ffcf',
      kills: e.score?.kills || 0,
      deaths: e.score?.deaths || 0,
      damage: Math.round(e.score?.damageDealt || 0),
      health: Math.round(e.health.current),
      respawn: e.health.dead ? Math.ceil(e.respawn?.timer || 0) : 0,
      turretAmmo: e.weaponSlots.turret ? `${Math.ceil(e.weaponSlots.turret.ammoInMagazine)}/${e.weaponSlots.turret.magazineSize}` : '-',
      q: e.weaponSlots.q?.weaponId || '-',
      e: e.weaponSlots.e?.weaponId || '-',
      isPlayer: e === ctx.player,
    }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

export const availableVehicleIds = Object.keys(vehicleCatalog);
