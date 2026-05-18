export const baseVehicleStats = {
  rideHeight: 0.78,
  maxForwardSpeed: 18,
  maxReverseSpeed: -6,
  acceleration: 7,
  reverseAcceleration: 4,
  brakeDeceleration: 18,
  rollingFriction: 6,
  handbrakeFriction: 20,
  steerRate: 0.78,
  steerResponse: 8.5,
  collisionRestitution: 0.22,
  collisionSpeedLoss: 0.48,
  smokeIntensity: 1,
  carHalfWidth: 1.05,
  carHalfLength: 1.95,
  turretTurnRate: 8,
  maxHealth: 120,
  turretMagazineSize: 30,
  turretReloadTime: 1,
  crashDamageResistance: 1,
  vehicleCollisionRestitution: 0.34,
  impactAngularResponse: 0.85,
  uprightRecoveryDelay: 0.5,
};

export const vehicleCatalog = {
  'ether-runner': {
    id: 'ether-runner',
    name: 'Ether Runner',
    armorType: 'medium',
    team: 'player',
    colors: { paint: 0x0b1519, glass: 0x74d7ff, accent: 0x82ffcf },
    stats: { ...baseVehicleStats },
    turretMount: { x: 0, y: 1.32, z: 0.2 },
    weaponSlots: { q: null, e: null },
  },
  'iron-jackal': {
    id: 'iron-jackal',
    name: 'Iron Jackal',
    armorType: 'heavy',
    team: 'enemy',
    colors: { paint: 0x4a5158, glass: 0xffb15a, accent: 0xff6545 },
    stats: { ...baseVehicleStats, maxHealth: 165, maxForwardSpeed: 14, acceleration: 5.4, steerRate: 0.62 },
    turretMount: { x: 0, y: 1.35, z: 0.05 },
    weaponSlots: { q: 'boom-missile', e: 'fire-mine' },
  },
  'pulse-wasp': {
    id: 'pulse-wasp',
    name: 'Pulse Wasp',
    armorType: 'light',
    team: 'enemy',
    colors: { paint: 0x22205e, glass: 0x9afcff, accent: 0xf659ff },
    stats: { ...baseVehicleStats, maxHealth: 85, maxForwardSpeed: 22, acceleration: 8.5, steerRate: 1.05 },
    turretMount: { x: 0, y: 1.24, z: 0.25 },
    weaponSlots: { q: 'shock-lance', e: 'bouncy-wouncy' },
  },
};

export function createVehicleUpgrades() {
  return {
    maxForwardSpeed: 0,
    maxReverseSpeed: 0,
    acceleration: 0,
    reverseAcceleration: 0,
    brakeDeceleration: 0,
    rollingFriction: 0,
    handbrakeFriction: 0,
    steerRate: 0,
    steerResponse: 0,
    collisionRestitution: 0,
    collisionSpeedLoss: 0,
    smokeIntensity: 0,
    carHalfWidth: 0,
    carHalfLength: 0,
    turretTurnRate: 0,
    maxHealth: 0,
    turretMagazineSize: 0,
    turretReloadTime: 0,
    crashDamageResistance: 0,
    vehicleCollisionRestitution: 0,
    impactAngularResponse: 0,
    uprightRecoveryDelay: 0,
  };
}

export function getVehicleStats(entity) {
  const base = entity.vehicle.stats;
  const upgrades = entity.vehicle.upgrades;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value + (upgrades[key] || 0)]));
}
