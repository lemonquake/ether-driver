import { baseVehicleStats } from './vehicleCatalog.js';
import { loadProgression } from '../core/ProgressionSystem.js';
import { premiumPartDefinitions } from './premiumParts.js';

export const GARAGE_STORAGE_KEY = 'ether-driver.garage.v2';
export const GARAGE_BUILD_LIMIT = 10;
const GARAGE_TEMPLATES_KEY = `${GARAGE_STORAGE_KEY}.templates`;
const GARAGE_ACTIVE_BUILD_KEY = `${GARAGE_STORAGE_KEY}.activeBuildId`;
const MAX_STORED_IMAGE_DATA_LENGTH = 650000;

export const defaultGarageBlueprint = {
  chassisId: 'razorback',
  cabinId: 'aero-canopy',
  wheelId: 'rally-slicks',
  turretId: 'pulse-crown',
  armorId: 'balanced',
  paintJobId: 'carbon-venom',
  paintColor: '#101820',
  trimColor: '#d9f7ff',
  glowColor: '#82ffcf',
  paintTint: 0,
  trimIntensity: 100,
  glowIntensity: 100,
  wheelPaintColor: '#111519',
  wheelPaintTextureId: '',
  wheelCustomTextureData: '',
  wheelCustomTextureName: '',
  wheelPaintTint: 0,
  turretPaintColor: '#1f252b',
  turretPaintTextureId: '',
  turretCustomTextureData: '',
  turretCustomTextureName: '',
  turretPaintTint: 0,
  materialStyle: 'metal',
  customTextureData: '',
  customTextureName: '',
};

function sockets(width, length, y = -0.34) {
  const x = width * 0.52;
  const z = length * 0.31;
  return [
    { x: -x, y, z, front: true },
    { x, y, z, front: true },
    { x: -x, y, z: -z, front: false },
    { x, y, z: -z, front: false },
  ];
}

function chassis(id, name, blurb, style, width, length, height, stats = {}, socketBias = 0) {
  return {
    id,
    name,
    blurb,
    dimensions: { width, length, height },
    rideHeight: Math.max(0.66, height + 0.06),
    cabinSocket: { x: 0, y: height * 0.78, z: -length * (0.1 + socketBias) },
    turretSocket: { x: 0, y: height + 0.58, z: length * (0.04 - socketBias * 0.35) },
    wheelSockets: sockets(width, length),
    stats,
    style,
  };
}

export const garagePartCatalog = {
  chassis: [
    chassis('razorback', 'Razorback', 'Fast wedge frame with a low silhouette.', 'wedge', 2.0, 3.9, 0.68, { maxForwardSpeed: 2.2, acceleration: 0.8, steerRate: 0.1, maxHealth: -8 }),
    chassis('bulwark', 'Bulwark', 'Wide armored frame that takes a hit.', 'heavy', 2.28, 4.18, 0.82, { maxHealth: 34, crashDamageResistance: 0.22, maxForwardSpeed: -2.2, acceleration: -0.8, steerRate: -0.08 }),
    chassis('strider', 'Strider', 'Long technical frame with stable firing lines.', 'long', 2.08, 4.34, 0.72, { turretTurnRate: 1.4, maxHealth: 8, maxForwardSpeed: -0.6, steerResponse: 1.0 }, 0.03),
    chassis('mantis-rail', 'Mantis Rail', 'Exposed side rails and insect-cut stance.', 'mantis', 2.14, 4.05, 0.66, { steerResponse: 1.2, acceleration: 0.55, maxHealth: -10 }),
    chassis('scorpion-tail', 'Scorpion Tail', 'Rear stinger spine built for snap turns.', 'tail', 2.04, 4.28, 0.7, { steerRate: 0.16, turretTurnRate: 0.8, maxForwardSpeed: -0.5 }, 0.04),
    chassis('atlas-hauler', 'Atlas Hauler', 'Industrial cargo shoulders with brutal stability.', 'hauler', 2.42, 4.48, 0.88, { maxHealth: 44, crashDamageResistance: 0.3, acceleration: -1.0, steerResponse: -0.9 }),
    chassis('ghost-wedge', 'Ghost Wedge', 'Ultra-light stealth wedge with glassy speed.', 'ghost', 1.9, 3.72, 0.58, { maxForwardSpeed: 3.1, acceleration: 1.1, maxHealth: -28, collisionSpeedLoss: 0.08 }),
    chassis('barracuda-skiff', 'Barracuda Skiff', 'Knife-nose skimmer with a lean centerline.', 'skiff', 1.96, 4.18, 0.62, { maxForwardSpeed: 2.6, steerRate: 0.12, crashDamageResistance: -0.14 }),
    chassis('vulture-frame', 'Vulture Frame', 'Raised scavenger frame with ribbed outriggers.', 'vulture', 2.22, 4.08, 0.78, { maxHealth: 16, steerResponse: 0.7, acceleration: -0.35 }),
    chassis('hammerhead', 'Hammerhead', 'Wide front impact prow for ramming lanes.', 'hammerhead', 2.36, 4.0, 0.76, { crashDamageResistance: 0.38, maxHealth: 20, steerRate: -0.08, maxForwardSpeed: -0.8 }),
    chassis('spiderline', 'Spiderline', 'Needle chassis wrapped in skeletal side spars.', 'spiderline', 2.1, 4.22, 0.6, { steerResponse: 1.45, acceleration: 0.7, maxHealth: -18 }),
    chassis('monorail-phantom', 'Monorail Phantom', 'Single glowing keel with floating armor pods.', 'monorail', 1.86, 4.32, 0.64, { maxForwardSpeed: 2.0, turretTurnRate: 1.1, maxHealth: -14 }),
    chassis('rift-sled', 'Rift Sled', 'Low plasma sled that refuses to sit still.', 'sled', 2.06, 3.86, 0.54, { maxForwardSpeed: 2.8, acceleration: 1.4, steerRate: 0.08, maxHealth: -24 }),
    chassis('bastion-brick', 'Bastion Brick', 'Square bunker body with zero apology.', 'brick', 2.46, 4.2, 0.94, { maxHealth: 58, crashDamageResistance: 0.42, maxForwardSpeed: -3.0, acceleration: -1.2, turretTurnRate: -0.4 }),
    chassis('comet-spear', 'Comet Spear', 'Long needle-nose speed frame.', 'spear', 1.92, 4.58, 0.64, { maxForwardSpeed: 3.4, acceleration: 0.65, steerRate: -0.04, maxHealth: -16 }, 0.05),
    chassis('fang-runner', 'Fang Runner', 'Twin-pronged street predator.', 'fang', 2.04, 3.84, 0.64, { acceleration: 1.35, steerRate: 0.18, maxHealth: -12 }),
    chassis('scarab-pod', 'Scarab Pod', 'Rounded armored pod with tucked wheels.', 'pod', 2.26, 3.92, 0.86, { maxHealth: 32, collisionRestitution: 0.06, maxForwardSpeed: -1.2 }),
    chassis('longhorn-rig', 'Longhorn Rig', 'Extended rig rails and bull-bar reach.', 'longhorn', 2.34, 4.68, 0.84, { maxHealth: 26, turretTurnRate: 0.7, steerRate: -0.1, maxForwardSpeed: -1.4 }, 0.06),
    chassis('splitfin', 'Splitfin', 'Forked aero body with rear stabilizers.', 'splitfin', 2.12, 4.12, 0.62, { maxForwardSpeed: 1.7, steerResponse: 1.3, maxHealth: -8 }),
    chassis('war-kite', 'War Kite', 'Diamond body plates and angled wing armor.', 'kite', 2.32, 4.04, 0.68, { turretTurnRate: 1.2, steerRate: 0.06, maxHealth: 8 }),
  ],
  cabin: [
    { id: 'aero-canopy', name: 'Aero Canopy', blurb: 'Slim glass canopy.', size: { w: 1.18, h: 0.72, d: 1.34 }, offset: { x: 0, y: 0, z: 0 }, stats: { maxForwardSpeed: 0.8 }, style: 'aero' },
    { id: 'command-cab', name: 'Command Cab', blurb: 'Tall tactical cockpit.', size: { w: 1.42, h: 0.86, d: 1.22 }, offset: { x: 0, y: 0.04, z: 0.04 }, stats: { maxHealth: 10, turretTurnRate: 0.6 }, style: 'command' },
    { id: 'split-cockpit', name: 'Split Cockpit', blurb: 'Twin intakes and hard edges.', size: { w: 1.56, h: 0.68, d: 1.44 }, offset: { x: 0, y: -0.02, z: -0.02 }, stats: { acceleration: 0.45, steerResponse: 0.6 }, style: 'split' },
  ],
  wheel: [
    { id: 'rally-slicks', name: 'Rally Slicks', blurb: 'Balanced grip and spin-up.', radius: 0.38, width: 0.34, stats: { steerResponse: 0.7, acceleration: 0.25 }, style: 'slick' },
    { id: 'crusher-treads', name: 'Crusher Treads', blurb: 'Chunky impact tires.', radius: 0.43, width: 0.42, stats: { maxHealth: 14, crashDamageResistance: 0.16, maxForwardSpeed: -0.8 }, style: 'chunky' },
    { id: 'ion-spokes', name: 'Ion Spokes', blurb: 'Lightweight neon wheel hubs.', radius: 0.36, width: 0.3, stats: { maxForwardSpeed: 1.1, acceleration: 0.55, collisionRestitution: -0.04 }, style: 'spoke' },
    { id: 'sawtooth-beadlocks', name: 'Sawtooth Beadlocks', blurb: 'Serrated beadlocks for dirty brawls.', radius: 0.4, width: 0.38, stats: { crashDamageResistance: 0.12, steerResponse: 0.5 }, style: 'saw' },
    { id: 'maglev-rings', name: 'Maglev Rings', blurb: 'Floating glow hoops with sharp launch.', radius: 0.37, width: 0.26, stats: { acceleration: 0.9, maxForwardSpeed: 0.8, maxHealth: -8 }, style: 'maglev' },
    { id: 'sand-paddles', name: 'Sand Paddles', blurb: 'Wide scoop tires for hard slides.', radius: 0.42, width: 0.44, stats: { steerRate: 0.1, rollingFriction: -0.6, maxForwardSpeed: -0.4 }, style: 'paddle' },
    { id: 'hex-hubs', name: 'Hex Hubs', blurb: 'Hexagonal combat hubs and fast response.', radius: 0.37, width: 0.33, stats: { steerResponse: 1.0, brakeDeceleration: 1.0 }, style: 'hex' },
    { id: 'twin-dish-drifters', name: 'Twin-Dish Drifters', blurb: 'Dual-face rims for clean drift recovery.', radius: 0.36, width: 0.36, stats: { handbrakeFriction: 2.2, steerRate: 0.12 }, style: 'dish' },
    { id: 'spiked-crawlers', name: 'Spiked Crawlers', blurb: 'Heavy spines bite into the road.', radius: 0.44, width: 0.42, stats: { maxHealth: 10, collisionSpeedLoss: -0.06, acceleration: -0.5 }, style: 'spike' },
    { id: 'whitewall-blades', name: 'Whitewall Blades', blurb: 'Retro whitewalls cut with turbine fins.', radius: 0.39, width: 0.32, stats: { maxForwardSpeed: 0.7, steerRate: 0.08 }, style: 'whitewall' },
    { id: 'chainwrap-tires', name: 'Chainwrap Tires', blurb: 'Chain-banded rubber for ramming grip.', radius: 0.41, width: 0.4, stats: { crashDamageResistance: 0.18, acceleration: -0.25 }, style: 'chain' },
    { id: 'reactor-donuts', name: 'Reactor Donuts', blurb: 'Thick glowing donuts with punchy torque.', radius: 0.4, width: 0.38, stats: { acceleration: 0.75, turretTurnRate: 0.25 }, style: 'reactor' },
    { id: 'low-pro-razors', name: 'Low-Pro Razors', blurb: 'Thin racing blades for top-end speed.', radius: 0.34, width: 0.25, stats: { maxForwardSpeed: 1.8, acceleration: 0.35, maxHealth: -12 }, style: 'razor' },
    { id: 'mud-claws', name: 'Mud Claws', blurb: 'Deep claw blocks and stubborn traction.', radius: 0.43, width: 0.45, stats: { steerResponse: 0.8, rollingFriction: -0.5, maxForwardSpeed: -0.7 }, style: 'claw' },
    { id: 'gyro-wheels', name: 'Gyro Wheels', blurb: 'Inset gyros smooth violent corrections.', radius: 0.38, width: 0.34, stats: { steerResponse: 1.25, impactAngularResponse: -0.18 }, style: 'gyro' },
    { id: 'split-rim-duplex', name: 'Split-Rim Duplex', blurb: 'Layered rims with redundant bite.', radius: 0.39, width: 0.4, stats: { brakeDeceleration: 1.6, maxHealth: 6 }, style: 'duplex' },
    { id: 'tankette-treads', name: 'Tankette Treads', blurb: 'Mini tread modules for bunker builds.', radius: 0.39, width: 0.5, stats: { maxHealth: 18, crashDamageResistance: 0.22, maxForwardSpeed: -1.3, steerRate: -0.07 }, style: 'tread' },
    { id: 'solar-spokes', name: 'Solar Spokes', blurb: 'Radiant spokes with high-speed efficiency.', radius: 0.37, width: 0.3, stats: { maxForwardSpeed: 1.2, rollingFriction: -0.8 }, style: 'solar' },
    { id: 'drag-balloons', name: 'Drag Balloons', blurb: 'Fat rear-launch rubber for brutal starts.', radius: 0.45, width: 0.48, stats: { acceleration: 1.15, maxForwardSpeed: -0.5, steerResponse: -0.35 }, style: 'balloon' },
    { id: 'bone-shakers', name: 'Bone Shakers', blurb: 'Rough skeletal rims that love contact.', radius: 0.41, width: 0.37, stats: { collisionRestitution: 0.06, crashDamageResistance: 0.12, maxHealth: 6 }, style: 'bone' },
  ],
  turret: [
    { id: 'pulse-crown', name: 'Pulse Crown', blurb: 'Fast tracking pulse ring.', stats: { turretTurnRate: 1.2, turretMagazineSize: 4 }, barrelLength: 1.24, style: 'ring' },
    { id: 'rail-spine', name: 'Rail Spine', blurb: 'Long stabilizer barrel.', stats: { turretTurnRate: -0.4, turretReloadTime: -0.08, turretMagazineSize: -4 }, barrelLength: 1.54, style: 'rail' },
    { id: 'nova-mortar', name: 'Nova Mortar', blurb: 'Heavy glowing launcher.', stats: { maxHealth: 12, turretTurnRate: -0.8, turretMagazineSize: 8 }, barrelLength: 1.06, style: 'mortar' },
    { id: 'twin-viper', name: 'Twin Viper', blurb: 'Paired snap barrels with hungry tracking.', stats: { turretTurnRate: 1.0, turretMagazineSize: 6, turretReloadTime: 0.06 }, barrelLength: 1.18, style: 'twin' },
    { id: 'coil-harpoon', name: 'Coil Harpoon', blurb: 'Single charged lance with recoil bracing.', stats: { turretReloadTime: -0.12, turretMagazineSize: -6, turretTurnRate: -0.2 }, barrelLength: 1.72, style: 'coil' },
    { id: 'flak-bloom', name: 'Flak Bloom', blurb: 'Petal launchers spray the horizon.', stats: { turretMagazineSize: 12, turretTurnRate: -0.6, turretReloadTime: 0.1 }, barrelLength: 0.92, style: 'bloom' },
    { id: 'shard-fan', name: 'Shard Fan', blurb: 'Wide fan array for aggressive sweeps.', stats: { turretTurnRate: 1.5, turretMagazineSize: 2 }, barrelLength: 0.96, style: 'fan' },
    { id: 'ion-needle', name: 'Ion Needle', blurb: 'Needle barrel with surgical reloads.', stats: { turretReloadTime: -0.18, turretMagazineSize: -8, turretTurnRate: 0.35 }, barrelLength: 1.84, style: 'needle' },
    { id: 'siege-bell', name: 'Siege Bell', blurb: 'Bell-mouth bruiser, slow but terrifying.', stats: { maxHealth: 18, turretMagazineSize: 10, turretTurnRate: -1.2 }, barrelLength: 1.08, style: 'bell' },
    { id: 'plasma-antler', name: 'Plasma Antler', blurb: 'Forked glow rails that rake the sky.', stats: { turretTurnRate: 0.9, turretMagazineSize: 5, maxHealth: -4 }, barrelLength: 1.34, style: 'antler' },
    { id: 'cyclops-beam', name: 'Cyclops Beam', blurb: 'Central beam eye with a heavy barrel.', stats: { turretReloadTime: -0.1, turretMagazineSize: -3, turretTurnRate: 0.25 }, barrelLength: 1.46, style: 'beam' },
    { id: 'scatter-halo', name: 'Scatter Halo', blurb: 'Rotating halo of short scatter tubes.', stats: { turretMagazineSize: 14, turretTurnRate: 0.5, turretReloadTime: 0.16 }, barrelLength: 0.88, style: 'halo' },
    { id: 'thorn-rack', name: 'Thorn Rack', blurb: 'Angled rack of brutal thorn barrels.', stats: { turretMagazineSize: 9, turretTurnRate: -0.35, maxHealth: 6 }, barrelLength: 1.18, style: 'rack' },
    { id: 'thunder-drum', name: 'Thunder Drum', blurb: 'Rotary drum with sustained fire.', stats: { turretMagazineSize: 18, turretReloadTime: 0.2, turretTurnRate: -0.55 }, barrelLength: 1.0, style: 'drum' },
    { id: 'lance-fork', name: 'Lance Fork', blurb: 'Two long forks around a bright core.', stats: { turretReloadTime: -0.14, turretTurnRate: 0.55, turretMagazineSize: -5 }, barrelLength: 1.62, style: 'fork' },
    { id: 'ember-cask', name: 'Ember Cask', blurb: 'Cask launcher glowing like a furnace.', stats: { maxHealth: 14, turretMagazineSize: 11, turretTurnRate: -0.9 }, barrelLength: 1.0, style: 'cask' },
    { id: 'rift-tuner', name: 'Rift Tuner', blurb: 'Oscillating fork tuned for quick aim.', stats: { turretTurnRate: 1.7, turretReloadTime: 0.08, maxHealth: -6 }, barrelLength: 1.22, style: 'tuner' },
    { id: 'jackhammer-pod', name: 'Jackhammer Pod', blurb: 'Blocky recoil pod with close-range punch.', stats: { turretMagazineSize: 8, maxHealth: 10, turretTurnRate: -0.15 }, barrelLength: 0.96, style: 'pod' },
    { id: 'crown-splitter', name: 'Crown Splitter', blurb: 'Split crown rails around a hot core.', stats: { turretTurnRate: 0.75, turretReloadTime: -0.06, turretMagazineSize: 3 }, barrelLength: 1.38, style: 'splitter' },
    { id: 'wasp-nest', name: 'Wasp Nest', blurb: 'Compact nest of micro launch tubes.', stats: { turretMagazineSize: 20, turretTurnRate: 0.2, turretReloadTime: 0.24 }, barrelLength: 0.76, style: 'nest' },
  ],
  armor: [
    { id: 'balanced', name: 'Balanced Plating', blurb: 'Reliable all-round armor.', armorType: 'medium', stats: {}, style: 'balanced' },
    { id: 'feather', name: 'Feather Weave', blurb: 'Light armor, more speed.', armorType: 'light', stats: { maxHealth: -20, maxForwardSpeed: 2.1, acceleration: 0.9, steerRate: 0.12 }, style: 'weave' },
    { id: 'reactive', name: 'Reactive Slabs', blurb: 'Heavy, blast-friendly shell.', armorType: 'reactive', stats: { maxHealth: 28, crashDamageResistance: 0.28, maxForwardSpeed: -1.4, acceleration: -0.45 }, style: 'slab' },
    { id: 'shielded', name: 'Shielded Core', blurb: 'Plasma-resistant emitter skin.', armorType: 'shielded', stats: { maxHealth: 14, turretTurnRate: 0.5, brakeDeceleration: 1.4 }, style: 'shield' },
    { id: 'ceramic-scales', name: 'Ceramic Scales', blurb: 'Overlapping white-hot scale plates.', armorType: 'medium', stats: { maxHealth: 18, crashDamageResistance: 0.12, steerResponse: -0.2 }, style: 'scales' },
    { id: 'junkyard-patchwork', name: 'Junkyard Patchwork', blurb: 'Asymmetric salvage plates and straps.', armorType: 'medium', stats: { maxHealth: 24, acceleration: -0.25 }, style: 'patchwork' },
    { id: 'obsidian-shell', name: 'Obsidian Shell', blurb: 'Dense black shell for hard impacts.', armorType: 'heavy', stats: { maxHealth: 38, crashDamageResistance: 0.34, maxForwardSpeed: -1.8 }, style: 'shell' },
    { id: 'chrome-cage', name: 'Chrome Cage', blurb: 'External roll cage with reflective ribs.', armorType: 'medium', stats: { maxHealth: 16, impactAngularResponse: -0.16, acceleration: -0.15 }, style: 'cage' },
    { id: 'honeycomb-kevlar', name: 'Honeycomb Kevlar', blurb: 'Light honeycomb plates with flex.', armorType: 'light', stats: { maxHealth: -6, maxForwardSpeed: 1.2, steerResponse: 0.9 }, style: 'honeycomb' },
    { id: 'ablative-tiles', name: 'Ablative Tiles', blurb: 'Disposable tile armor for grindy fights.', armorType: 'medium', stats: { maxHealth: 22, turretReloadTime: -0.04, maxForwardSpeed: -0.45 }, style: 'tiles' },
    { id: 'serrated-apron', name: 'Serrated Apron', blurb: 'Front serrations built for contact.', armorType: 'medium', stats: { crashDamageResistance: 0.26, collisionRestitution: 0.05, steerRate: -0.04 }, style: 'serrated' },
    { id: 'riot-mesh', name: 'Riot Mesh', blurb: 'Fine mesh cage, sturdy without bulk.', armorType: 'medium', stats: { maxHealth: 12, steerResponse: 0.45, brakeDeceleration: 0.9 }, style: 'mesh' },
    { id: 'spall-liner', name: 'Spall Liner', blurb: 'Internal liner that shrugs off chaos.', armorType: 'medium', stats: { maxHealth: 20, crashDamageResistance: 0.16, impactAngularResponse: -0.12 }, style: 'liner' },
    { id: 'ferrofoam', name: 'Ferrofoam', blurb: 'Foamed metal bulk that floats lighter.', armorType: 'medium', stats: { maxHealth: 14, maxForwardSpeed: 0.6, collisionSpeedLoss: -0.04 }, style: 'foam' },
    { id: 'heat-sink-fins', name: 'Heat Sink Fins', blurb: 'Cooling fins make the turret breathe.', armorType: 'shielded', stats: { turretReloadTime: -0.12, turretTurnRate: 0.4, maxHealth: 6 }, style: 'fins' },
    { id: 'titan-ribbing', name: 'Titan Ribbing', blurb: 'Massive ribs for high-impact builds.', armorType: 'heavy', stats: { maxHealth: 46, crashDamageResistance: 0.32, acceleration: -0.75 }, style: 'ribs' },
    { id: 'glassbone-light', name: 'Glassbone Light', blurb: 'Transparent light shell, quick and risky.', armorType: 'light', stats: { maxHealth: -26, maxForwardSpeed: 2.4, acceleration: 1.0, turretTurnRate: 0.4 }, style: 'glassbone' },
    { id: 'bulwark-slats', name: 'Bulwark Slats', blurb: 'Layered side slats for bunker pressure.', armorType: 'heavy', stats: { maxHealth: 34, crashDamageResistance: 0.3, steerResponse: -0.6 }, style: 'slats' },
    { id: 'voltage-lattice', name: 'Voltage Lattice', blurb: 'Charged lattice around the core.', armorType: 'shielded', stats: { turretTurnRate: 0.8, maxHealth: 10, acceleration: 0.2 }, style: 'lattice' },
    { id: 'dune-skirts', name: 'Dune Skirts', blurb: 'Low skirts stabilize slides and dust runs.', armorType: 'medium', stats: { steerRate: 0.14, rollingFriction: -0.7, maxHealth: 8 }, style: 'skirts' },
  ],
  paintJob: [
    { id: 'carbon-venom', name: 'Carbon Venom', blurb: 'Black carbon weave with venom highlights.', texture: 'carbon', colors: ['#101820', '#d9f7ff', '#82ffcf'], stats: { maxForwardSpeed: 0.25 } },
    { id: 'rust-saint', name: 'Rust Saint', blurb: 'Oxidized panels and pale trim scars.', texture: 'rust', colors: ['#5b3425', '#d8c2a2', '#ff8f3d'], stats: { maxHealth: 4 } },
    { id: 'arctic-digital', name: 'Arctic Digital', blurb: 'Cold pixel camouflage and ice glow.', texture: 'digital', colors: ['#dce8ef', '#1f6f91', '#7df9ff'], stats: { steerResponse: 0.15 } },
    { id: 'hazard-stripes', name: 'Hazard Stripes', blurb: 'Industrial yellow warning slashwork.', texture: 'hazard', colors: ['#151515', '#ffcc66', '#ff5f7d'], stats: { crashDamageResistance: 0.03 } },
    { id: 'oil-slick', name: 'Oil Slick', blurb: 'Iridescent midnight rainbow film.', texture: 'oil', colors: ['#100c1f', '#7df9ff', '#b991ff'], stats: { maxForwardSpeed: 0.35, maxHealth: -2 } },
    { id: 'desert-camo', name: 'Desert Camo', blurb: 'Dusty broken-field camouflage.', texture: 'camo', colors: ['#a47b45', '#f0d9a2', '#ffcc66'], stats: { rollingFriction: -0.15 } },
    { id: 'neon-graffiti', name: 'Neon Graffiti', blurb: 'Spray paint chaos over dark panels.', texture: 'graffiti', colors: ['#151024', '#f4f7fb', '#f659ff'], stats: { turretTurnRate: 0.2 } },
    { id: 'chrome-flake', name: 'Chrome Flake', blurb: 'Bright metallic flake sparkle.', texture: 'flake', colors: ['#dfe6eb', '#101820', '#7df9ff'], stats: { maxForwardSpeed: 0.15, steerRate: 0.02 } },
    { id: 'matte-black-ops', name: 'Matte Black Ops', blurb: 'Dead-matte tactical scuffs.', texture: 'matte', colors: ['#06080a', '#4a5158', '#82ffcf'], stats: { turretReloadTime: -0.02 } },
    { id: 'circuit-board', name: 'Circuit Board', blurb: 'Printed traces across deep green armor.', texture: 'circuit', colors: ['#0c2f24', '#82ffcf', '#ffcc66'], stats: { turretTurnRate: 0.25 } },
    { id: 'tiger-burn', name: 'Tiger Burn', blurb: 'Hot orange tiger tears.', texture: 'tiger', colors: ['#1a0d08', '#ff8f3d', '#ffcc66'], stats: { acceleration: 0.2 } },
    { id: 'police-interceptor', name: 'Police Interceptor', blurb: 'Clean law-runner blocks and lights.', texture: 'interceptor', colors: ['#f4f7fb', '#101820', '#7df9ff'], stats: { brakeDeceleration: 0.4 } },
    { id: 'lava-veins', name: 'Lava Veins', blurb: 'Cracked black shell with hot seams.', texture: 'lava', colors: ['#160b09', '#2b2b2b', '#ff5f7d'], stats: { maxHealth: 3, turretReloadTime: -0.02 } },
    { id: 'pearl-candy', name: 'Pearl Candy', blurb: 'Gloss pearl body with candy shimmer.', texture: 'pearl', colors: ['#f4dff2', '#ffffff', '#b991ff'], stats: { steerRate: 0.03 } },
    { id: 'mecha-panel-lines', name: 'Mecha Panel Lines', blurb: 'Hard panel lines and factory decals.', texture: 'panel', colors: ['#727c86', '#101820', '#ffcc66'], stats: { maxHealth: 2, steerResponse: 0.1 } },
    { id: 'jungle-hex', name: 'Jungle Hex', blurb: 'Green hex camouflage for ambush builds.', texture: 'hex-camo', colors: ['#173823', '#7ea35b', '#82ffcf'], stats: { collisionSpeedLoss: -0.02 } },
    { id: 'moon-dust', name: 'Moon Dust', blurb: 'Pale cratered dust and gray flecks.', texture: 'dust', colors: ['#bfc4c2', '#4a5158', '#d9f7ff'], stats: { impactAngularResponse: -0.04 } },
    { id: 'sharkmouth-nose-art', name: 'Sharkmouth Nose Art', blurb: 'Painted teeth and warbird attitude.', texture: 'shark', colors: ['#33485a', '#f4f7fb', '#ff5f7d'], stats: { acceleration: 0.15, crashDamageResistance: 0.02 } },
    { id: 'synthwave-grid', name: 'Synthwave Grid', blurb: 'Purple gridlines over night paint.', texture: 'grid', colors: ['#160f31', '#7df9ff', '#f659ff'], stats: { maxForwardSpeed: 0.2, turretTurnRate: 0.15 } },
    { id: 'battle-scar-primer', name: 'Battle-Scar Primer', blurb: 'Primer gray with scrapes and field repairs.', texture: 'scar', colors: ['#5b6063', '#d9f7ff', '#ffcc66'], stats: { maxHealth: 5, acceleration: -0.05 } },
  ],
};

const partGroups = Object.keys(garagePartCatalog);

export function refreshGarageCatalog() {
  const progression = loadProgression();
  
  Object.keys(garagePartCatalog).forEach(key => {
    garagePartCatalog[key] = garagePartCatalog[key].filter(p => !p.isPremium);
  });
  
  progression.inventory.forEach(partId => {
    const def = premiumPartDefinitions.find(p => p.id === partId);
    if (!def) return;
    
    const basePart = garagePartCatalog[def.type].find(p => p.id === def.baseStyle);
    if (!basePart) return;
    
    const premiumPart = {
      ...basePart,
      id: def.id,
      name: `★ ${def.name}`,
      blurb: def.blurb,
      stats: { ...def.stats },
      isPremium: true,
      rarity: def.rarity,
    };
    
    if (def.type === 'paintJob') {
      premiumPart.colors = def.colors;
      premiumPart.texture = def.texture;
    }
    
    garagePartCatalog[def.type].push(premiumPart);
  });
}

export const garageMaterialStyles = [
  { id: 'metal', name: 'Metal', blurb: 'Glossy automotive metal with clear coat.' },
  { id: 'matte', name: 'Non-shiny', blurb: 'Flat paint with soft, tactical reflections.' },
  { id: 'carbon', name: 'Carbon', blurb: 'Carbon weave surface with crisp contrast.' },
  { id: 'glow', name: 'Glowing', blurb: 'Emissive paint that carries the accent color.' },
];

function partById(group, id) {
  return garagePartCatalog[group].find((part) => part.id === id) || garagePartCatalog[group][0];
}

function addStats(target, stats = {}) {
  Object.entries(stats).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizePercent(value, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.round(clamp(next, 0, 200));
}

function sanitizeTextureId(value) {
  if (!value) return '';
  return garagePartCatalog.paintJob.some((part) => part.texture === value) ? value : '';
}

function sanitizeImageData(value) {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= MAX_STORED_IMAGE_DATA_LENGTH ? value : '';
}

function stripStoredImages(blueprint) {
  return {
    ...blueprint,
    customTextureData: '',
    customTextureName: '',
    wheelCustomTextureData: '',
    wheelCustomTextureName: '',
    turretCustomTextureData: '',
    turretCustomTextureName: '',
  };
}

export function sanitizeGarageBlueprint(value = {}) {
  const clean = { ...defaultGarageBlueprint, ...(value || {}) };
  clean.chassisId = partById('chassis', clean.chassisId).id;
  clean.cabinId = partById('cabin', clean.cabinId).id;
  clean.wheelId = partById('wheel', clean.wheelId).id;
  clean.turretId = partById('turret', clean.turretId).id;
  clean.armorId = partById('armor', clean.armorId).id;
  clean.paintJobId = partById('paintJob', clean.paintJobId).id;
  ['paintColor', 'trimColor', 'glowColor', 'wheelPaintColor', 'turretPaintColor'].forEach((key) => {
    clean[key] = /^#[0-9a-f]{6}$/i.test(clean[key]) ? clean[key] : defaultGarageBlueprint[key];
  });
  clean.paintTint = sanitizePercent(clean.paintTint, defaultGarageBlueprint.paintTint);
  clean.trimIntensity = sanitizePercent(clean.trimIntensity, defaultGarageBlueprint.trimIntensity);
  clean.glowIntensity = sanitizePercent(clean.glowIntensity, defaultGarageBlueprint.glowIntensity);
  clean.wheelPaintTextureId = sanitizeTextureId(clean.wheelPaintTextureId);
  clean.turretPaintTextureId = sanitizeTextureId(clean.turretPaintTextureId);
  clean.wheelPaintTint = sanitizePercent(clean.wheelPaintTint, defaultGarageBlueprint.wheelPaintTint);
  clean.turretPaintTint = sanitizePercent(clean.turretPaintTint, defaultGarageBlueprint.turretPaintTint);
  if (!garageMaterialStyles.some((style) => style.id === clean.materialStyle)) clean.materialStyle = defaultGarageBlueprint.materialStyle;
  clean.customTextureData = sanitizeImageData(clean.customTextureData);
  clean.customTextureName = clean.customTextureData && typeof clean.customTextureName === 'string'
    ? clean.customTextureName.slice(0, 64)
    : '';
  clean.wheelCustomTextureData = sanitizeImageData(clean.wheelCustomTextureData);
  clean.wheelCustomTextureName = clean.wheelCustomTextureData && typeof clean.wheelCustomTextureName === 'string'
    ? clean.wheelCustomTextureName.slice(0, 64)
    : '';
  clean.turretCustomTextureData = sanitizeImageData(clean.turretCustomTextureData);
  clean.turretCustomTextureName = clean.turretCustomTextureData && typeof clean.turretCustomTextureName === 'string'
    ? clean.turretCustomTextureName.slice(0, 64)
    : '';
  return clean;
}

export function loadGarageBlueprint() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GARAGE_STORAGE_KEY));
    return sanitizeGarageBlueprint(parsed);
  } catch {
    return sanitizeGarageBlueprint(defaultGarageBlueprint);
  }
}

export function saveGarageBlueprint(blueprint) {
  const clean = sanitizeGarageBlueprint(blueprint);
  try {
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') throw error;
    const compact = sanitizeGarageBlueprint(stripStoredImages(clean));
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify(compact));
    return compact;
  }
}

export function createGarageBuildStats() {
  return {
    uses: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    wins: 0,
    pickups: 0,
    turbo: 0,
    jump: 0,
  };
}

function generateGarageBuildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanBuildStats(stats = {}) {
  const defaults = createGarageBuildStats();
  return Object.fromEntries(Object.keys(defaults).map((key) => {
    const value = Number(stats[key]);
    return [key, Number.isFinite(value) ? Math.max(0, Math.round(value)) : defaults[key]];
  }));
}

function normalizeGarageTemplate(template = {}, index = 0) {
  const now = new Date().toISOString();
  const rawBlueprint = template.blueprint || template;
  const rawName = typeof template.name === 'string' ? template.name.trim() : '';
  return {
    id: typeof template.id === 'string' && template.id ? template.id : generateGarageBuildId(),
    name: (rawName || `Build ${index + 1}`).slice(0, 24),
    blueprint: sanitizeGarageBlueprint(rawBlueprint),
    stats: cleanBuildStats(template.stats),
    createdAt: typeof template.createdAt === 'string' ? template.createdAt : now,
    updatedAt: typeof template.updatedAt === 'string' ? template.updatedAt : (typeof template.createdAt === 'string' ? template.createdAt : now),
  };
}

export function loadGarageTemplates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GARAGE_TEMPLATES_KEY));
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.slice(0, GARAGE_BUILD_LIMIT).map((template, index) => normalizeGarageTemplate(template, index));
    localStorage.setItem(GARAGE_TEMPLATES_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function saveGarageTemplates(templates) {
  const normalized = (Array.isArray(templates) ? templates : [])
    .slice(0, GARAGE_BUILD_LIMIT)
    .map((template, index) => normalizeGarageTemplate(template, index));
  try {
    localStorage.setItem(GARAGE_TEMPLATES_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') throw error;
    const compact = normalized.map((template, index) => normalizeGarageTemplate({
      ...template,
      blueprint: stripStoredImages(template.blueprint),
    }, index));
    localStorage.setItem(GARAGE_TEMPLATES_KEY, JSON.stringify(compact));
    return compact;
  }
}

export function createGarageTemplate(name, blueprint) {
  const templates = loadGarageTemplates();
  if (templates.length >= GARAGE_BUILD_LIMIT) return null;
  const now = new Date().toISOString();
  const template = normalizeGarageTemplate({
    id: generateGarageBuildId(),
    name,
    blueprint,
    stats: createGarageBuildStats(),
    createdAt: now,
    updatedAt: now,
  }, templates.length);
  saveGarageTemplates([...templates, template]);
  return template;
}

export function updateGarageTemplate(buildId, updates = {}) {
  if (!buildId) return null;
  const templates = loadGarageTemplates();
  const index = templates.findIndex((template) => template.id === buildId);
  if (index < 0) return null;

  const current = templates[index];
  const next = normalizeGarageTemplate({
    ...current,
    ...(typeof updates.name === 'string' ? { name: updates.name } : {}),
    ...(updates.blueprint ? { blueprint: updates.blueprint } : {}),
    stats: current.stats,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  }, index);

  templates[index] = next;
  saveGarageTemplates(templates);
  return next;
}

export function renameGarageTemplate(buildId, name) {
  return updateGarageTemplate(buildId, { name });
}

export function deleteGarageTemplate(buildId) {
  const templates = loadGarageTemplates();
  const next = templates.filter((template) => template.id !== buildId);
  if (next.length === templates.length) return false;
  saveGarageTemplates(next);
  if (getActiveGarageTemplateId() === buildId) clearActiveGarageTemplateId();
  return true;
}

export function getActiveGarageTemplateId() {
  try {
    return localStorage.getItem(GARAGE_ACTIVE_BUILD_KEY) || '';
  } catch {
    return '';
  }
}

export function setActiveGarageTemplateId(buildId) {
  if (!buildId) return clearActiveGarageTemplateId();
  localStorage.setItem(GARAGE_ACTIVE_BUILD_KEY, buildId);
}

export function clearActiveGarageTemplateId() {
  localStorage.removeItem(GARAGE_ACTIVE_BUILD_KEY);
}

function updateGarageTemplateStats(buildId, readNextStats) {
  if (!buildId) return false;
  const templates = loadGarageTemplates();
  const index = templates.findIndex((template) => template.id === buildId);
  if (index < 0) {
    if (getActiveGarageTemplateId() === buildId) clearActiveGarageTemplateId();
    return false;
  }
  const template = templates[index];
  templates[index] = {
    ...template,
    stats: cleanBuildStats(readNextStats(template.stats || createGarageBuildStats())),
    updatedAt: new Date().toISOString(),
  };
  saveGarageTemplates(templates);
  return true;
}

export function recordGarageTemplateUse(buildId = getActiveGarageTemplateId()) {
  return updateGarageTemplateStats(buildId, (stats) => ({
    ...stats,
    uses: (stats.uses || 0) + 1,
  }));
}

export function recordGarageTemplateMatchStats(matchStats = {}, buildId = getActiveGarageTemplateId()) {
  return updateGarageTemplateStats(buildId, (stats) => ({
    ...stats,
    kills: (stats.kills || 0) + (matchStats.kills || 0),
    deaths: (stats.deaths || 0) + (matchStats.deaths || 0),
    damage: (stats.damage || 0) + Math.round(matchStats.damage || 0),
    wins: (stats.wins || 0) + (matchStats.won ? 1 : 0),
    pickups: (stats.pickups || 0) + (matchStats.pickups || 0),
    turbo: (stats.turbo || 0) + (matchStats.turbo || 0),
    jump: (stats.jump || 0) + (matchStats.jump || 0),
  }));
}

export function getGaragePart(group, id) {
  return partById(group, id);
}

export function getGarageSelection(blueprint) {
  const clean = sanitizeGarageBlueprint(blueprint);
  return {
    chassis: partById('chassis', clean.chassisId),
    cabin: partById('cabin', clean.cabinId),
    wheel: partById('wheel', clean.wheelId),
    turret: partById('turret', clean.turretId),
    armor: partById('armor', clean.armorId),
    paintJob: partById('paintJob', clean.paintJobId),
  };
}

export function buildGarageVehicleDefinition(blueprint) {
  const clean = sanitizeGarageBlueprint(blueprint);
  const parts = getGarageSelection(clean);
  const stats = { ...baseVehicleStats };
  partGroups.forEach((group) => addStats(stats, parts[group].stats));
  
  const progression = loadProgression();
  if (progression && progression.upgrades) {
    stats.acceleration += progression.upgrades.acceleration * 0.2;
    stats.maxForwardSpeed += progression.upgrades.acceleration * 0.1;
    stats.steerRate += progression.upgrades.handling * 0.05;
    stats.turretMagazineSize += progression.upgrades.maxAmmo;
    stats.turretReloadTime -= progression.upgrades.firingRate * 0.02;
  }
  
  stats.rideHeight = parts.chassis.rideHeight;
  stats.carHalfWidth = parts.chassis.dimensions.width * 0.5;
  stats.carHalfLength = parts.chassis.dimensions.length * 0.5;
  stats.maxForwardSpeed = clamp(stats.maxForwardSpeed, 11, 26);
  stats.acceleration = clamp(stats.acceleration, 4, 11);
  stats.steerRate = clamp(stats.steerRate, 0.48, 1.18);
  stats.steerResponse = clamp(stats.steerResponse, 6, 12);
  stats.maxHealth = Math.round(clamp(stats.maxHealth, 70, 210));
  stats.turretTurnRate = clamp(stats.turretTurnRate, 4.6, 12);
  stats.turretMagazineSize = Math.round(clamp(stats.turretMagazineSize, 12, 52));
  stats.turretReloadTime = Number(clamp(stats.turretReloadTime, 0.55, 1.55).toFixed(2));
  stats.crashDamageResistance = clamp(stats.crashDamageResistance, 0.55, 1.85);
  stats.impactAngularResponse = clamp(stats.impactAngularResponse, 0.35, 1.15);
  return {
    id: 'custom-player',
    name: `${parts.paintJob.name} ${parts.chassis.name}`,
    team: 'player',
    armorType: parts.armor.armorType,
    custom: true,
    blueprint: clean,
    parts,
    stats,
    colors: {
      paint: clean.paintColor,
      trim: clean.trimColor,
      glass: clean.glowColor,
      accent: clean.glowColor,
    },
    appearance: {
      paintTint: clean.paintTint / 100,
      trimIntensity: clean.trimIntensity / 100,
      glowIntensity: clean.glowIntensity / 100,
      materialStyle: clean.materialStyle,
      customTextureData: clean.customTextureData,
      customTextureName: clean.customTextureName,
      wheelPaint: {
        color: clean.wheelPaintColor,
        textureId: clean.wheelPaintTextureId,
        customTextureData: clean.wheelCustomTextureData,
        customTextureName: clean.wheelCustomTextureName,
        tint: clean.wheelPaintTint / 100,
      },
      turretPaint: {
        color: clean.turretPaintColor,
        textureId: clean.turretPaintTextureId,
        customTextureData: clean.turretCustomTextureData,
        customTextureName: clean.turretCustomTextureName,
        tint: clean.turretPaintTint / 100,
      },
    },
    paintJob: parts.paintJob,
    turretMount: parts.chassis.turretSocket,
    weaponSlots: { q: null, e: null },
  };
}

export function getGarageStats(blueprint) {
  return buildGarageVehicleDefinition(blueprint).stats;
}
