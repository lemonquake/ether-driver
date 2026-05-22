export const PREMIUM_RARITIES = {
  REGULAR: { id: 'regular', name: 'Regular', color: '#b0b0b0', multiplier: 1.0 },
  RARE: { id: 'rare', name: 'Rare', color: '#55ff55', multiplier: 1.5 },
  DELUXE: { id: 'deluxe', name: 'Deluxe', color: '#33bbff', multiplier: 2.2 },
  ELITE: { id: 'elite', name: 'Elite', color: '#b991ff', multiplier: 3.5 },
  XFACTOR: { id: 'xfactor', name: 'X-Factor', color: '#ffcc66', multiplier: 6.0 },
  ETHER: { id: 'ether', name: 'Ether', color: '#82ffcf', multiplier: 12.0 },
};

// Base parts to derive visual styles from, to save time on creating 50 unique models
export const premiumPartDefinitions = [
  // --- CHASSIS ---
  { id: 'chas-reg-01', type: 'chassis', rarity: 'regular', name: 'Stock Striker', baseStyle: 'razorback', price: 100, stats: { maxForwardSpeed: 0.5, acceleration: 0.2 }, blurb: 'A slightly tuned razorback.' },
  { id: 'chas-reg-02', type: 'chassis', rarity: 'regular', name: 'Heavy Hauler', baseStyle: 'bulwark', price: 150, stats: { maxHealth: 15 }, blurb: 'More armor for cheap.' },
  { id: 'chas-rar-01', type: 'chassis', rarity: 'rare', name: 'Venom Strider', baseStyle: 'strider', price: 400, stats: { maxForwardSpeed: 1.2, steerResponse: 0.5 }, blurb: 'Tuned for aggressive strikes.' },
  { id: 'chas-rar-02', type: 'chassis', rarity: 'rare', name: 'Steel Mantis', baseStyle: 'mantis-rail', price: 500, stats: { acceleration: 0.8, maxHealth: 10 }, blurb: 'Sturdier insectoid frame.' },
  { id: 'chas-del-01', type: 'chassis', rarity: 'deluxe', name: 'Phantom Ghost', baseStyle: 'ghost-wedge', price: 1200, stats: { maxForwardSpeed: 2.5, acceleration: 1.5, collisionSpeedLoss: 0.05 }, blurb: 'Aerodynamic perfection.' },
  { id: 'chas-del-02', type: 'chassis', rarity: 'deluxe', name: 'Iron Bastion', baseStyle: 'bastion-brick', price: 1300, stats: { maxHealth: 40, crashDamageResistance: 0.2 }, blurb: 'Mobile fortress chassis.' },
  { id: 'chas-eli-01', type: 'chassis', rarity: 'elite', name: 'Obsidian Spear', baseStyle: 'comet-spear', price: 3500, stats: { maxForwardSpeed: 4.0, acceleration: 2.0, maxHealth: -5 }, blurb: 'Elite racing spear.' },
  { id: 'chas-eli-02', type: 'chassis', rarity: 'elite', name: 'Warhammer Rig', baseStyle: 'atlas-hauler', price: 3800, stats: { maxHealth: 60, crashDamageResistance: 0.4 }, blurb: 'Unstoppable mass.' },
  { id: 'chas-xf-01', type: 'chassis', rarity: 'xfactor', name: 'Vortex Sled', baseStyle: 'rift-sled', price: 8000, stats: { maxForwardSpeed: 5.5, acceleration: 3.0, steerRate: 0.2 }, blurb: 'Defies conventional physics.' },
  { id: 'chas-eth-01', type: 'chassis', rarity: 'ether', name: 'ETHER DRAGON', baseStyle: 'war-kite', price: 25000, stats: { maxForwardSpeed: 6.0, acceleration: 3.5, maxHealth: 30, steerRate: 0.3 }, blurb: 'The ultimate apex predator frame.' },

  // --- CABIN ---
  { id: 'cab-reg-01', type: 'cabin', rarity: 'regular', name: 'Tinted Aero', baseStyle: 'aero-canopy', price: 80, stats: { maxForwardSpeed: 0.2 }, blurb: 'Aerodynamic glass.' },
  { id: 'cab-rar-01', type: 'cabin', rarity: 'rare', name: 'Armored Command', baseStyle: 'command-cab', price: 300, stats: { maxHealth: 15 }, blurb: 'Bulletproof glass.' },
  { id: 'cab-del-01', type: 'cabin', rarity: 'deluxe', name: 'Split Stream', baseStyle: 'split-cockpit', price: 900, stats: { acceleration: 0.8, steerResponse: 0.4 }, blurb: 'Dual driver pods.' },
  { id: 'cab-eli-01', type: 'cabin', rarity: 'elite', name: 'Void Canopy', baseStyle: 'aero-canopy', price: 2500, stats: { maxForwardSpeed: 1.5, turretTurnRate: 0.5 }, blurb: 'Lightweight void-glass.' },
  { id: 'cab-xf-01', type: 'cabin', rarity: 'xfactor', name: 'Overlord Cab', baseStyle: 'command-cab', price: 6500, stats: { maxHealth: 35, turretTurnRate: 1.0 }, blurb: 'Excellent handling.' },
  { id: 'cab-eth-01', type: 'cabin', rarity: 'ether', name: 'ETHER NEURAL', baseStyle: 'split-cockpit', price: 20000, stats: { acceleration: 2.0, maxHealth: 20, maxForwardSpeed: 2.0 }, blurb: 'Mind-machine interface cockpit.' },

  // --- WHEEL ---
  { id: 'whl-reg-01', type: 'wheel', rarity: 'regular', name: 'Street Slicks', baseStyle: 'rally-slicks', price: 120, stats: { steerResponse: 0.2 }, blurb: 'Standard grip.' },
  { id: 'whl-reg-02', type: 'wheel', rarity: 'regular', name: 'Dirt Treads', baseStyle: 'crusher-treads', price: 150, stats: { maxHealth: 5 }, blurb: 'Offroad capable.' },
  { id: 'whl-rar-01', type: 'wheel', rarity: 'rare', name: 'Neon Spokes', baseStyle: 'ion-spokes', price: 450, stats: { maxForwardSpeed: 0.8, acceleration: 0.4 }, blurb: 'Light and flashy.' },
  { id: 'whl-rar-02', type: 'wheel', rarity: 'rare', name: 'Sawtooth Grips', baseStyle: 'sawtooth-beadlocks', price: 500, stats: { crashDamageResistance: 0.1, steerResponse: 0.6 }, blurb: 'Aggressive bite.' },
  { id: 'whl-del-01', type: 'wheel', rarity: 'deluxe', name: 'Hyper Maglevs', baseStyle: 'maglev-rings', price: 1400, stats: { acceleration: 1.5, maxForwardSpeed: 1.2 }, blurb: 'Frictionless hovering hubs.' },
  { id: 'whl-del-02', type: 'wheel', rarity: 'deluxe', name: 'Dune Paddles', baseStyle: 'sand-paddles', price: 1500, stats: { steerRate: 0.2, rollingFriction: -0.8 }, blurb: 'Unstoppable on loose ground.' },
  { id: 'whl-eli-01', type: 'wheel', rarity: 'elite', name: 'Hex Drifters', baseStyle: 'hex-hubs', price: 3200, stats: { steerResponse: 1.8, brakeDeceleration: 1.5 }, blurb: 'Perfect cornering.' },
  { id: 'whl-eli-02', type: 'wheel', rarity: 'elite', name: 'Titan Crawlers', baseStyle: 'spiked-crawlers', price: 3400, stats: { maxHealth: 25, crashDamageResistance: 0.2 }, blurb: 'Heavy spiked rollers.' },
  { id: 'whl-xf-01', type: 'wheel', rarity: 'xfactor', name: 'Reactor Donuts', baseStyle: 'reactor-donuts', price: 7500, stats: { acceleration: 2.5, turretTurnRate: 1.0, maxForwardSpeed: 1.5 }, blurb: 'Nuclear torque output.' },
  { id: 'whl-eth-01', type: 'wheel', rarity: 'ether', name: 'ETHER RINGS', baseStyle: 'solar-spokes', price: 28000, stats: { maxForwardSpeed: 3.5, acceleration: 3.0, steerResponse: 2.5 }, blurb: 'Tires made of pure light.' },

  // --- TURRET ---
  { id: 'tur-reg-01', type: 'turret', rarity: 'regular', name: 'Quick Pulse', baseStyle: 'pulse-crown', price: 200, stats: { turretTurnRate: 0.5 }, blurb: 'Faster tracking.' },
  { id: 'tur-reg-02', type: 'turret', rarity: 'regular', name: 'Heavy Mortar', baseStyle: 'nova-mortar', price: 250, stats: { turretMagazineSize: 2 }, blurb: 'More ammo, slower turn.' },
  { id: 'tur-rar-01', type: 'turret', rarity: 'rare', name: 'Twin Striker', baseStyle: 'twin-viper', price: 600, stats: { turretTurnRate: 0.8, turretMagazineSize: 4 }, blurb: 'Dual barrel assault.' },
  { id: 'tur-rar-02', type: 'turret', rarity: 'rare', name: 'Coil Sniper', baseStyle: 'coil-harpoon', price: 700, stats: { turretReloadTime: -0.2 }, blurb: 'Faster reloads for snipers.' },
  { id: 'tur-del-01', type: 'turret', rarity: 'deluxe', name: 'Ion Storm', baseStyle: 'ion-needle', price: 1800, stats: { turretReloadTime: -0.3, turretTurnRate: 1.2 }, blurb: 'Rapid surgical fire.' },
  { id: 'tur-del-02', type: 'turret', rarity: 'deluxe', name: 'Flak Hurricane', baseStyle: 'flak-bloom', price: 2000, stats: { turretMagazineSize: 15, turretTurnRate: -0.2 }, blurb: 'Massive ammo capacity.' },
  { id: 'tur-eli-01', type: 'turret', rarity: 'elite', name: 'Cyclops Annihilator', baseStyle: 'cyclops-beam', price: 4500, stats: { turretReloadTime: -0.4, turretTurnRate: 0.8 }, blurb: 'Devastating beam optics.' },
  { id: 'tur-eli-02', type: 'turret', rarity: 'elite', name: 'Thunder God', baseStyle: 'thunder-drum', price: 4800, stats: { turretMagazineSize: 25, turretReloadTime: 0.1 }, blurb: 'Never stop firing.' },
  { id: 'tur-xf-01', type: 'turret', rarity: 'xfactor', name: 'Rift Destroyer', baseStyle: 'rift-tuner', price: 9500, stats: { turretTurnRate: 2.5, turretReloadTime: -0.5, turretMagazineSize: 10 }, blurb: 'Tears through reality.' },
  { id: 'tur-eth-01', type: 'turret', rarity: 'ether', name: 'ETHER CANNON', baseStyle: 'crown-splitter', price: 35000, stats: { turretTurnRate: 3.0, turretReloadTime: -0.8, turretMagazineSize: 30 }, blurb: 'The ultimate weapon of destruction.' },

  // --- ARMOR ---
  { id: 'arm-reg-01', type: 'armor', rarity: 'regular', name: 'Light Weave', baseStyle: 'feather', price: 150, stats: { maxForwardSpeed: 0.5 }, blurb: 'A bit faster.' },
  { id: 'arm-reg-02', type: 'armor', rarity: 'regular', name: 'Hard Slabs', baseStyle: 'reactive', price: 180, stats: { maxHealth: 10 }, blurb: 'A bit tougher.' },
  { id: 'arm-rar-01', type: 'armor', rarity: 'rare', name: 'Ceramic Plating', baseStyle: 'ceramic-scales', price: 500, stats: { maxHealth: 25, crashDamageResistance: 0.1 }, blurb: 'Heat resistant scales.' },
  { id: 'arm-rar-02', type: 'armor', rarity: 'rare', name: 'Chrome Ribs', baseStyle: 'chrome-cage', price: 550, stats: { maxHealth: 15, maxForwardSpeed: 0.5 }, blurb: 'Shiny and sturdy.' },
  { id: 'arm-del-01', type: 'armor', rarity: 'deluxe', name: 'Obsidian Core', baseStyle: 'obsidian-shell', price: 1600, stats: { maxHealth: 50, crashDamageResistance: 0.25 }, blurb: 'Near impenetrable.' },
  { id: 'arm-del-02', type: 'armor', rarity: 'deluxe', name: 'Ablative Mesh', baseStyle: 'ablative-tiles', price: 1700, stats: { maxHealth: 30, turretReloadTime: -0.1 }, blurb: 'Smart reactive armor.' },
  { id: 'arm-eli-01', type: 'armor', rarity: 'elite', name: 'Titanium Ribbing', baseStyle: 'titan-ribbing', price: 3800, stats: { maxHealth: 70, crashDamageResistance: 0.4 }, blurb: 'Super heavy defense.' },
  { id: 'arm-eli-02', type: 'armor', rarity: 'elite', name: 'Glassbone Ghost', baseStyle: 'glassbone-light', price: 4000, stats: { maxForwardSpeed: 3.0, acceleration: 1.5 }, blurb: 'Incredibly fragile but fast.' },
  { id: 'arm-xf-01', type: 'armor', rarity: 'xfactor', name: 'Voltage Core', baseStyle: 'voltage-lattice', price: 8500, stats: { maxHealth: 45, turretTurnRate: 1.5, acceleration: 1.0 }, blurb: 'Electrified defensive grid.' },
  { id: 'arm-eth-01', type: 'armor', rarity: 'ether', name: 'ETHER SHIELD', baseStyle: 'shielded', price: 30000, stats: { maxHealth: 100, crashDamageResistance: 0.6, maxForwardSpeed: 1.5 }, blurb: 'Pure energy shielding.' },

  // --- PAINT ---
  { id: 'pnt-reg-01', type: 'paintJob', rarity: 'regular', name: 'Blue Steel', baseStyle: 'matte-black-ops', price: 50, colors: ['#2c3e50', '#34495e', '#ecf0f1'], texture: 'matte', stats: { maxHealth: 1 }, blurb: 'Cool matte finish.' },
  { id: 'pnt-rar-01', type: 'paintJob', rarity: 'rare', name: 'Neon Nights', baseStyle: 'neon-graffiti', price: 200, colors: ['#140026', '#ff007f', '#00f0ff'], texture: 'graffiti', stats: { maxForwardSpeed: 0.5 }, blurb: 'Synthwave vibes.' },
  { id: 'pnt-del-01', type: 'paintJob', rarity: 'deluxe', name: 'Gold Flake', baseStyle: 'chrome-flake', price: 800, colors: ['#d4af37', '#ffd700', '#ffffff'], texture: 'flake', stats: { maxHealth: 5, maxForwardSpeed: 0.5 }, blurb: 'Pure luxury.' },
  { id: 'pnt-eli-01', type: 'paintJob', rarity: 'elite', name: 'Blood Lava', baseStyle: 'lava-veins', price: 2200, colors: ['#1a0000', '#ff0000', '#ff6600'], texture: 'lava', stats: { turretReloadTime: -0.1 }, blurb: 'Burning hot.' },
  { id: 'pnt-xf-01', type: 'paintJob', rarity: 'xfactor', name: 'Quantum Grid', baseStyle: 'synthwave-grid', price: 5000, colors: ['#000000', '#00ffcc', '#ff00ff'], texture: 'grid', stats: { maxForwardSpeed: 1.0, turretTurnRate: 0.5 }, blurb: 'Animated gridlines.' },
  { id: 'pnt-eth-01', type: 'paintJob', rarity: 'ether', name: 'ETHER GLOW', baseStyle: 'circuit-board', price: 15000, colors: ['#001a11', '#82ffcf', '#ffffff'], texture: 'circuit', stats: { maxForwardSpeed: 1.5, maxHealth: 10, acceleration: 0.5 }, blurb: 'The signature Ether look.' },

  // --- PROJECTILES ---
  { id: 'proj-neon-plasma', type: 'turretProjectile', rarity: 'rare', name: 'Neon Plasma Sphere', baseStyle: 'proj-standard', price: 400, stats: { turretTurnRate: 0.4 }, blurb: 'Cyan plasma sphere with rotating ring.' },
  { id: 'proj-fireball', type: 'turretProjectile', rarity: 'deluxe', name: 'Magma Fireball', baseStyle: 'proj-standard', price: 1500, stats: { crashDamageResistance: 0.1 }, blurb: 'Fiery magma star.' },
  { id: 'proj-electric-star', type: 'turretProjectile', rarity: 'elite', name: 'Electric Star', baseStyle: 'proj-standard', price: 4000, stats: { turretReloadTime: -0.05 }, blurb: 'High-voltage lime crackling energy.' },
  { id: 'proj-void-ring', type: 'turretProjectile', rarity: 'ether', name: 'ETHER VOID HOOP', baseStyle: 'proj-standard', price: 18000, stats: { maxForwardSpeed: 0.5, acceleration: 0.2 }, blurb: 'Dark gravitational void hoop.' },
];
