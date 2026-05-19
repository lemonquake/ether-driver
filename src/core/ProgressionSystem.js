import { premiumPartDefinitions } from '../data/premiumParts.js';

const STORAGE_KEY = 'ether-driver.progression.v1';

export const UPGRADE_MAX_LEVELS = {
  maxAmmo: 20,
  firingRate: 20,
  handling: 20,
  acceleration: 20,
};

const defaultState = {
  level: 1,
  exp: 0,
  gold: 0,
  statPoints: 0,
  inventory: [], // array of part IDs
  upgrades: {
    maxAmmo: 0, 
    firingRate: 0, 
    handling: 0, 
    acceleration: 0, 
    turretColorsUnlocked: false,
    projectileEffectUnlocked: false,
  },
  lifetimeStats: {
    damageDealt: 0,
    kills: 0,
    deaths: 0,
    gameWins: 0,
    goldGained: 0,
    goldSpent: 0,
    expGained: 0,
  }
};

export function loadProgression() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...defaultState, ...parsed, upgrades: { ...defaultState.upgrades, ...(parsed.upgrades || {}) } };
    }
  } catch (e) {
    // ignore
  }
  return JSON.parse(JSON.stringify(defaultState));
}

export function saveProgression(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getExpRequirement(level) {
  return Math.floor(1000 * Math.pow(1.2, level - 1));
}

export function addExp(state, amount) {
  state.exp += amount;
  state.lifetimeStats.expGained += amount;
  let leveledUp = false;
  let levelsGained = 0;
  while (state.exp >= getExpRequirement(state.level)) {
    state.exp -= getExpRequirement(state.level);
    state.level++;
    state.statPoints++;
    levelsGained++;
    leveledUp = true;
  }
  saveProgression(state);
  return { leveledUp, levelsGained };
}

export function addGold(state, amount) {
  state.gold += amount;
  if (amount > 0) {
    state.lifetimeStats.goldGained += amount;
  } else {
    state.lifetimeStats.goldSpent += Math.abs(amount);
  }
  saveProgression(state);
}

export function grantKillReward() {
  const state = loadProgression();
  const goldGain = Math.floor(10 + Math.random() * 10);
  const expGain = 50;
  const { leveledUp, levelsGained } = addExp(state, expGain);
  addGold(state, goldGain);
  return { goldGain, expGain, leveledUp, levelsGained, level: state.level };
}

export function recordLifetimeStats(stats) {
  const state = loadProgression();
  if (stats.damageDealt) state.lifetimeStats.damageDealt += stats.damageDealt;
  if (stats.kills) state.lifetimeStats.kills += stats.kills;
  if (stats.deaths) state.lifetimeStats.deaths += stats.deaths;
  saveProgression(state);
}

export function grantMatchReward(won) {
  const state = loadProgression();
  const goldGain = won ? (150 + Math.floor(Math.random() * 50)) : 50;
  const expGain = won ? 500 : 150;
  const { leveledUp, levelsGained } = addExp(state, expGain);
  addGold(state, goldGain);
  if (won) state.lifetimeStats.gameWins++;
  saveProgression(state);
  return { goldGain, expGain, leveledUp, levelsGained, level: state.level };
}

export function buyPremiumPart(partId) {
  const state = loadProgression();
  if (state.inventory.includes(partId)) return false;
  
  const partDef = premiumPartDefinitions.find(p => p.id === partId);
  if (!partDef) return false;
  
  if (state.gold >= partDef.price) {
    state.gold -= partDef.price;
    state.lifetimeStats.goldSpent += partDef.price;
    state.inventory.push(partId);
    saveProgression(state);
    return true;
  }
  return false;
}

export function upgradeStat(statName) {
  const state = loadProgression();
  
  // Special handling for booleans
  if (statName === 'turretColorsUnlocked' || statName === 'projectileEffectUnlocked') {
    if (state.statPoints >= 5 && !state.upgrades[statName]) {
      state.statPoints -= 5;
      state.upgrades[statName] = true;
      saveProgression(state);
      return true;
    }
    return false;
  }
  
  if (state.statPoints > 0 && state.upgrades[statName] < UPGRADE_MAX_LEVELS[statName]) {
    state.statPoints--;
    state.upgrades[statName]++;
    saveProgression(state);
    return true;
  }
  return false;
}
