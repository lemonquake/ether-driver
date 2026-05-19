import * as THREE from 'three';
import {
  overlapsBaseSafetyZone,
  register,
  addRoad,
  addBuilding,
  addBarrier,
  addCrateStack,
  addParkedCar,
  addLamp,
  addTurboTile,
  addJumpTile,
  addRamp,
  addBorderWalls,
  addTrafficArch,
  addPipeline,
  addTeslaCoil
} from '../world/MapSystem.js';

export const mapRegistry = {
  city: {
    id: 'city',
    name: 'Megalopolis Mayhem',
    size: 480,
    tagline: 'High-Density Concrete Block Grids',
    description: 'Welcome to the neon-drenched concrete jungle where heavy metal meets heavy wreckage! Features dense grid-locked skyscraper blocks, continuous surrounding loop-highways, and 4 massive symmetrical concrete launch ramps. Perfect for setting speed traps and launching orbital strikes on unsuspecting racers below.',
    build: function (ctx, materials) {
      const size = this.size;
      ctx.currentMapSize = size;
      ctx.specialTiles = [];
      ctx.ramps = [];
      
      // Lighting
      const hemi = new THREE.HemisphereLight(0x9ed7ff, 0x314329, 0.75);
      ctx.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff0c7, 0.85);
      sun.position.set(-80, 120, 60);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      ctx.scene.add(sun);

      // Ground
      const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), materials.grass);
      ground.position.y = -0.54;
      ground.receiveShadow = true;
      ground.geometry.computeBoundsTree();
      ctx.scene.add(ground);
      ctx.aimMeshes = [ground];

      // Surrounding loop-highways and cross lanes
      addRoad(ctx, materials, 0, 0, 30, size - 100);
      addRoad(ctx, materials, 0, 0, size - 100, 30);
      addRoad(ctx, materials, -size * 0.25, -size * 0.25, 26, size * 0.45);
      addRoad(ctx, materials, size * 0.25, size * 0.25, 26, size * 0.45);
      addRoad(ctx, materials, -size * 0.2, size * 0.25, size * 0.45, 24);
      addRoad(ctx, materials, size * 0.25, -size * 0.2, size * 0.45, 24);

      // Boundaries
      addBorderWalls(ctx, size, 0x82ffcf, materials);

      // Symmetrical Traffic Arches at main crossroads
      addTrafficArch(ctx, 0, -120, 0, materials);
      addTrafficArch(ctx, 0, 120, 0, materials);
      addTrafficArch(ctx, -120, 0, Math.PI * 0.5, materials);
      addTrafficArch(ctx, 120, 0, Math.PI * 0.5, materials);

      // Skyscraper block clusters
      const bMats = [materials.brick, materials.concrete, materials.windows];
      const skyscraperBlocks = [
        [-80, -80, 35, 24, 35, bMats[0]],
        [80, -80, 40, 38, 30, bMats[1]],
        [-160, -45, 32, 28, 48, bMats[2]],
        [160, 45, 38, 32, 45, bMats[0]],
        [-85, 85, 35, 45, 30, bMats[2]],
        [85, 85, 28, 24, 38, bMats[1]],
        [-160, 140, 45, 28, 32, bMats[1]],
        [140, -160, 38, 42, 38, bMats[2]],
        [-30, 160, 26, 20, 38, bMats[0]],
        [45, -160, 32, 24, 30, bMats[1]],
        [-170, -170, 35, 20, 35, bMats[0]],
        [170, 170, 45, 38, 28, bMats[2]],
      ];
      skyscraperBlocks.forEach((b) => addBuilding(ctx, materials, ...b));

      // Add blinking red warning beacon lights on skyscraper roofs
      skyscraperBlocks.forEach((b) => {
        const bx = b[0];
        const bz = b[1];
        const bh = b[3];
        
        const beaconGroup = new THREE.Group();
        beaconGroup.position.set(bx, bh + 0.22, bz);
        
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), beaconMat);
        beaconGroup.add(beaconMesh);
        
        const beaconLight = new THREE.PointLight(0xff0000, 2.5, 12, 1.8);
        beaconLight.castShadow = false;
        beaconGroup.add(beaconLight);
        
        ctx.scene.add(beaconGroup);
        
        if (!ctx.beacons) ctx.beacons = [];
        ctx.beacons.push({ mesh: beaconMesh, light: beaconLight, timer: Math.random() * Math.PI });
      });

      // Symmetrical Tactical Launch Ramps (4 Ramps pointing to center crossroad)
      addRamp(ctx, materials, -55, 0, 14, 25, Math.PI * 0.5, 0.1, 7.5); // points East (into center)
      addRamp(ctx, materials, 55, 0, 14, 25, -Math.PI * 0.5, 0.1, 7.5); // points West (into center)
      addRamp(ctx, materials, 0, -55, 14, 25, 0, 0.1, 7.5); // points South (into center)
      addRamp(ctx, materials, 0, 55, 14, 25, Math.PI, 0.1, 7.5); // points North (into center)

      // Obstacles
      addBarrier(ctx, materials, -15, -100, 0.1);
      addBarrier(ctx, materials, 25, 110, -0.2);
      addBarrier(ctx, materials, -110, 35, Math.PI / 2 + 0.1);
      addBarrier(ctx, materials, 130, -50, Math.PI / 2 - 0.2);
      addCrateStack(ctx, materials, 50, 120);
      addCrateStack(ctx, materials, -150, -100);
      addCrateStack(ctx, materials, 140, 100);
      addParkedCar(ctx, materials, -40, -25, 0xffc857, Math.PI * 0.5);
      addParkedCar(ctx, materials, 85, 25, 0x5bd3ff, -Math.PI * 0.5);
      addParkedCar(ctx, materials, -125, 125, 0xd4416a, 0.08);

      // Cyber Lamps
      for (let z = -180; z <= 180; z += 60) addLamp(ctx, materials, -22, z);
      for (let x = -180; x <= 180; x += 60) addLamp(ctx, materials, x, 22);

      // Speed turbo grids & Jump tiles
      addTurboTile(ctx, materials, 0, 95, 0);
      addTurboTile(ctx, materials, 0, -95, Math.PI);
      addTurboTile(ctx, materials, 95, 0, Math.PI / 2);
      addTurboTile(ctx, materials, -95, 0, -Math.PI / 2);
      addJumpTile(ctx, materials, 0, 130, 0);
      addJumpTile(ctx, materials, 0, -130, 0);
      addJumpTile(ctx, materials, 130, 0, 0);
      addJumpTile(ctx, materials, -130, 0, 0);

      // Pickups & Temp Turret Weapons!
      ctx.pickups.push(
        { x: -95, z: 0, weapon: 'swarm-missiles' },
        { x: 95, z: 0, weapon: 'rail-slug' },
        { x: 0, z: -95, weapon: 'devastator-nuke' },
        { x: 0, z: 95, weapon: 'gravity-imploder' },
        { x: -160, z: 80, weapon: 'toxic-cask' },
        { x: 160, z: -80, weapon: 'boom-missile' },
        { x: -80, z: -160, weapon: 'bouncy-wouncy' },
        { x: 80, z: 160, weapon: 'shock-lance' },
        { x: 0, z: 0, weapon: 'health-kit' },
        { x: -60, z: -60, weapon: 'armor-pack' },
        { x: 60, z: 60, weapon: 'tool-box' },
        { x: -60, z: 60, weapon: 'speed-booster' },
        { x: 60, z: -60, weapon: 'health-kit' },
        
        // Temp Turret Pickup Enhancements
        { x: -35, z: -35, weapon: 'turret-hyper-plasma' },
        { x: 35, z: -35, weapon: 'turret-rail-slugger' },
        { x: -35, z: 35, weapon: 'turret-shock-beam' },
        { x: 35, z: 35, weapon: 'turret-magma-spitter' },
        { x: 0, z: 160, weapon: 'turret-flak-barrage' },
        
        // Extended roster
        { x: 110, z: 110, weapon: 'phantom-seeker' },
        { x: -110, z: -110, weapon: 'plasma-wraith' },
        { x: -110, z: 110, weapon: 'magma-drone' },
        { x: 110, z: -110, weapon: 'volt-hunter' },
        { x: -140, z: 0, weapon: 'void-stalker' },
        { x: 140, z: 0, weapon: 'void-stalker' }
      );
    }
  },
  basin: {
    id: 'basin',
    name: 'Doom Basin',
    size: 520,
    tagline: 'Wasteland Crater Depression & High-Velocity Ring-Roads',
    description: 'A desolate industrial slag basin featuring a massive crater depression in the center and raised loop-highways along the perimeter. Features giant dual central jumping ramps that vault vehicles directly across the central hazardous pit. One bad slide and you will plummet straight into the burning radioactive magma slag below!',
    build: function (ctx, materials) {
      const size = this.size;
      ctx.currentMapSize = size;
      ctx.specialTiles = [];
      ctx.ramps = [];

      // Darker desert-like wasteland lighting
      const hemi = new THREE.HemisphereLight(0xffa500, 0x4a2300, 0.65);
      ctx.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xff7700, 1.2);
      sun.position.set(90, 80, -90);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      ctx.scene.add(sun);

      // Sand/dirt ground
      const desertMat = new THREE.MeshStandardMaterial({
        color: 0x3d2719,
        roughness: 0.9,
        metalness: 0.1
      });
      const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), desertMat);
      ground.position.y = -0.54;
      ground.receiveShadow = true;
      ground.geometry.computeBoundsTree();
      ctx.scene.add(ground);
      ctx.aimMeshes = [ground];

      // Perimeter outer roads and central cross loop
      addRoad(ctx, materials, 0, -size * 0.38, size * 0.8, 26);
      addRoad(ctx, materials, 0, size * 0.38, size * 0.8, 26);
      addRoad(ctx, materials, -size * 0.38, 0, 26, size * 0.8);
      addRoad(ctx, materials, size * 0.38, 0, 26, size * 0.8);
      
      // Giant central bypass roads
      addRoad(ctx, materials, 0, 0, 24, 180);

      // Boundaries
      addBorderWalls(ctx, size, 0xff5f00, materials);

      // Industrial Pipelines along perimeter highways
      addPipeline(ctx, -160, -180, 160, -180, 3.5, materials);
      addPipeline(ctx, -160, 180, 160, 180, 3.5, materials);

      // Warning spotlights pointing at the center magma pit
      const addMagmaSpotlight = (x, z, tx, tz) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4, 8), materials.lamp);
        pole.position.set(x, 2, z);
        ctx.scene.add(pole);

        const target = new THREE.Object3D();
        target.position.set(tx, 0.1, tz);
        ctx.scene.add(target);

        const spot = new THREE.SpotLight(0xff3c00, 8, 25, Math.PI / 6, 0.5, 1);
        spot.position.set(x, 3.8, z);
        spot.target = target;
        spot.castShadow = false;
        ctx.scene.add(spot);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3c00 }));
        bulb.position.set(x, 3.9, z);
        ctx.scene.add(bulb);
      };
      addMagmaSpotlight(-16, -22, 0, 0);
      addMagmaSpotlight(16, -22, 0, 0);
      addMagmaSpotlight(-16, 22, 0, 0);
      addMagmaSpotlight(16, 22, 0, 0);

      // Industrial storage silos in four quadrants
      const addSilo = (x, z) => {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const silo = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 14, 12), materials.concrete);
        silo.position.y = 7;
        silo.castShadow = true;
        silo.receiveShadow = true;
        group.add(silo);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 12), materials.lamp);
        dome.position.y = 14;
        dome.castShadow = true;
        group.add(dome);

        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xff5f00,
          emissive: 0xff5f00,
          emissiveIntensity: 2.5
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.18, 4, 16), ringMat);
        ring.position.y = 10;
        ring.rotation.x = Math.PI * 0.5;
        group.add(ring);

        ctx.scene.add(group);
        register(ctx, 'building', x, z, 9, 9);
      };
      addSilo(-100, -100);
      addSilo(100, -100);
      addSilo(-100, 100);
      addSilo(100, 100);

      // Giant crater basin structures and concrete pylons
      const bMats = [materials.concrete, materials.brick];
      [
        [-140, -140, 28, 28, 28, bMats[0]],
        [140, -140, 32, 28, 28, bMats[0]],
        [-140, 140, 32, 28, 28, bMats[0]],
        [140, 140, 28, 28, 28, bMats[0]],
        
        // Hazard reactor towers surrounding the crater pit
        [-70, -70, 45, 18, 18, materials.windows],
        [70, -70, 45, 18, 18, materials.windows],
        [-70, 70, 45, 18, 18, materials.windows],
        [70, 70, 45, 18, 18, materials.windows],
      ].forEach((b) => addBuilding(ctx, materials, ...b));

      // GIANT JUMPING RAMPS (Launches vehicles across the center)
      addRamp(ctx, materials, 0, -45, 16, 32, 0, 0.1, 10.5); // Ramps pointing North into center
      addRamp(ctx, materials, 0, 45, 16, 32, Math.PI, 0.1, 10.5); // Ramps pointing South into center

      // Decorative magma center pool visual in the gap
      const magmaMat = new THREE.MeshStandardMaterial({
        color: 0xff3c00,
        emissive: 0xff1f00,
        emissiveIntensity: 3.5,
        roughness: 0.9,
        metalness: 0.1
      });
      const magmaMesh = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 36), magmaMat);
      magmaMesh.position.set(0, 0.05, 0);
      ctx.scene.add(magmaMesh);

      // Obstacles/barriers guarding the perimeter
      addBarrier(ctx, materials, -50, -160, 0);
      addBarrier(ctx, materials, 50, -160, 0);
      addBarrier(ctx, materials, -50, 160, 0);
      addBarrier(ctx, materials, 50, 160, 0);
      addCrateStack(ctx, materials, -120, -40);
      addCrateStack(ctx, materials, 120, 40);
      addCrateStack(ctx, materials, 0, -120);
      addCrateStack(ctx, materials, 0, 120);

      // Speed tiles before the jump ramps!
      addTurboTile(ctx, materials, 0, -85, 0);
      addTurboTile(ctx, materials, 0, 85, Math.PI);
      addTurboTile(ctx, materials, -150, 0, Math.PI / 2);
      addTurboTile(ctx, materials, 150, 0, -Math.PI / 2);
      
      addJumpTile(ctx, materials, -160, -160, 0);
      addJumpTile(ctx, materials, 160, -160, 0);
      addJumpTile(ctx, materials, -160, 160, 0);
      addJumpTile(ctx, materials, 160, 160, 0);

      // Pickups & Temp Turret Weapons
      ctx.pickups.push(
        { x: -160, z: 0, weapon: 'swarm-missiles' },
        { x: 160, z: 0, weapon: 'rail-slug' },
        { x: 0, z: -160, weapon: 'devastator-nuke' },
        { x: 0, z: 160, weapon: 'gravity-imploder' },
        { x: -120, z: 120, weapon: 'toxic-cask' },
        { x: 120, z: -120, weapon: 'boom-missile' },
        { x: -120, z: -120, weapon: 'bouncy-wouncy' },
        { x: 120, z: 120, weapon: 'shock-lance' },
        { x: 0, z: 0, weapon: 'health-kit' },
        { x: -80, z: -80, weapon: 'armor-pack' },
        { x: 80, z: 80, weapon: 'tool-box' },
        { x: -80, z: 80, weapon: 'speed-booster' },
        { x: 80, z: -80, weapon: 'health-kit' },
        
        // Add Temp Turrets!
        { x: 0, z: -105, weapon: 'turret-hyper-plasma' },
        { x: 0, z: 105, weapon: 'turret-rail-slugger' },
        { x: -150, z: -150, weapon: 'turret-shock-beam' },
        { x: 150, z: 150, weapon: 'turret-magma-spitter' },
        { x: 0, z: -40, weapon: 'turret-flak-barrage' },
        
        // Extended roster
        { x: 130, z: 130, weapon: 'phantom-seeker' },
        { x: -130, z: -130, weapon: 'plasma-wraith' },
        { x: -130, z: 130, weapon: 'magma-drone' },
        { x: 130, z: -130, weapon: 'volt-hunter' }
      );
    }
  },
  outpost: {
    id: 'outpost',
    name: 'Neon Outpost',
    size: 460,
    tagline: 'High-Voltage Reactor Grid & Maximum Speed-Tiles',
    description: 'A dense futuristic laboratory zoning sector packed with high-voltage reactor coils and barricade grids. Overloaded with intensive turbo-tile patterns, hyper-speed jump grids, and narrow lane dividers. Speed runs, electric arcing, and instantaneous explosion counts are guaranteed!',
    build: function (ctx, materials) {
      const size = this.size;
      ctx.currentMapSize = size;
      ctx.specialTiles = [];
      ctx.ramps = [];

      // High contrast cyan/magenta lighting
      const hemi = new THREE.HemisphereLight(0x00ffff, 0xff00ff, 0.75);
      ctx.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0x00ffcc, 0.95);
      sun.position.set(-60, 90, 60);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      ctx.scene.add(sun);

      // Dark cyber metal floor
      const cyberMat = new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.35,
        metalness: 0.85
      });
      const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), cyberMat);
      ground.position.y = -0.54;
      ground.receiveShadow = true;
      ground.geometry.computeBoundsTree();
      ctx.scene.add(ground);
      ctx.aimMeshes = [ground];

      // Multi-lane grids
      addRoad(ctx, materials, 0, 0, 40, size - 80);
      addRoad(ctx, materials, 0, 0, size - 80, 40);
      addRoad(ctx, materials, -size * 0.3, 0, 20, size * 0.6);
      addRoad(ctx, materials, size * 0.3, 0, 20, size * 0.6);
      addRoad(ctx, materials, 0, -size * 0.3, size * 0.6, 20);
      addRoad(ctx, materials, 0, size * 0.3, size * 0.6, 20);

      // Boundaries
      addBorderWalls(ctx, size, 0xff00ff, materials);

      // Central high-voltage research spires (Tesla Coils)
      addTeslaCoil(ctx, -55, -55, 12, materials);
      addTeslaCoil(ctx, 55, -55, 12, materials);
      addTeslaCoil(ctx, -55, 55, 12, materials);
      addTeslaCoil(ctx, 55, 55, 12, materials);

      // High voltage core barriers and walls
      const bMats = [materials.concrete, materials.windows];
      [
        [-110, -110, 40, 25, 40, bMats[0]],
        [110, -110, 40, 25, 40, bMats[0]],
        [-110, 110, 40, 25, 40, bMats[0]],
        [110, 110, 40, 25, 40, bMats[0]],
        
        // Reactor cores (emissive cylinders)
        [-150, 0, 50, 12, 12, materials.windows],
        [150, 0, 50, 12, 12, materials.windows],
        [0, -150, 50, 12, 12, materials.windows],
        [0, 150, 50, 12, 12, materials.windows],
      ].forEach((b) => addBuilding(ctx, materials, ...b));

      // Dual Tactical launch ramps bridging the reactor cores
      addRamp(ctx, materials, -75, -75, 12, 22, Math.PI * 0.25, 0.1, 6.0); // angle ramp
      addRamp(ctx, materials, 75, 75, 12, 22, -Math.PI * 0.75, 0.1, 6.0); // angle ramp

      // Intensive barricades and safety zoning dividers
      addBarrier(ctx, materials, -20, -50, Math.PI / 2);
      addBarrier(ctx, materials, 20, -50, Math.PI / 2);
      addBarrier(ctx, materials, -20, 50, Math.PI / 2);
      addBarrier(ctx, materials, 20, 50, Math.PI / 2);
      
      addCrateStack(ctx, materials, -90, 30);
      addCrateStack(ctx, materials, 90, -30);

      // Speed boost grids and hyper tiles everywhere!
      for (let z = -120; z <= 120; z += 60) {
        if (z !== 0) {
          addTurboTile(ctx, materials, -z, z, Math.PI / 4);
          addTurboTile(ctx, materials, z, -z, -Math.PI / 4);
        }
      }
      
      // Intensive jump nodes surrounding the central crossroads
      addJumpTile(ctx, materials, -25, -25, 0);
      addJumpTile(ctx, materials, 25, -25, 0);
      addJumpTile(ctx, materials, -25, 25, 0);
      addJumpTile(ctx, materials, 25, 25, 0);

      // Pickups & Temp Turret Weapons
      ctx.pickups.push(
        { x: -120, z: 0, weapon: 'swarm-missiles' },
        { x: 120, z: 0, weapon: 'rail-slug' },
        { x: 0, z: -120, weapon: 'devastator-nuke' },
        { x: 0, z: 120, weapon: 'gravity-imploder' },
        { x: -100, z: 100, weapon: 'toxic-cask' },
        { x: 100, z: -100, weapon: 'boom-missile' },
        { x: -100, z: -100, weapon: 'bouncy-wouncy' },
        { x: 100, z: 100, weapon: 'shock-lance' },
        { x: 0, z: 0, weapon: 'health-kit' },
        { x: -50, z: -50, weapon: 'armor-pack' },
        { x: 50, z: 50, weapon: 'tool-box' },
        { x: -50, z: 50, weapon: 'speed-booster' },
        { x: 50, z: -50, weapon: 'health-kit' },

        // Temp Turrets!
        { x: -60, z: 0, weapon: 'turret-hyper-plasma' },
        { x: 60, z: 0, weapon: 'turret-rail-slugger' },
        { x: 0, z: -60, weapon: 'turret-shock-beam' },
        { x: 0, z: 60, weapon: 'turret-magma-spitter' },
        { x: -80, z: -80, weapon: 'turret-flak-barrage' },
        
        // Extended roster
        { x: 90, z: 90, weapon: 'phantom-seeker' },
        { x: -90, z: -90, weapon: 'plasma-wraith' },
        { x: -90, z: 90, weapon: 'magma-drone' },
        { x: 90, z: -90, weapon: 'volt-hunter' }
      );
    }
  },
  military: {
    id: 'military',
    name: 'Sector 04: Tactical Compound',
    size: 440,
    tagline: 'Armored Blast Walls & Central Acid Pool',
    description: 'Welcome to the Tactical Military Compound! A top-secret combat zone surrounded by olive-green armored blast walls. Features defensive security checkpoints, high-speed launch ramps, and a bubbling green Acid Pool at the center that eats away at heavy chassis armor. Watch your step and maintain high velocity!',
    build: function (ctx, materials) {
      const size = this.size;
      ctx.currentMapSize = size;
      ctx.specialTiles = [];
      ctx.ramps = [];

      // Military Green Lighting
      const hemi = new THREE.HemisphereLight(0x71a97d, 0x223625, 0.7);
      ctx.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xa5ffb5, 0.85);
      sun.position.set(-60, 110, 50);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      ctx.scene.add(sun);

      // Ground (Concrete base)
      const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), materials.concrete);
      ground.position.y = -0.54;
      ground.receiveShadow = true;
      ground.geometry.computeBoundsTree();
      ctx.scene.add(ground);
      ctx.aimMeshes = [ground];

      // Surrounding loops and checkpoints
      addRoad(ctx, materials, 0, 0, 36, size - 80);
      addRoad(ctx, materials, 0, 0, size - 80, 36);

      // Boundaries
      addBorderWalls(ctx, size, 0x8cff5e, materials);

      // Symmetrical bunkers/barracks at the four corners
      addBuilding(ctx, materials, -100, -100, 34, 16, 34, materials.concrete);
      addBuilding(ctx, materials, 100, -100, 34, 16, 34, materials.concrete);
      addBuilding(ctx, materials, -100, 100, 34, 16, 34, materials.concrete);
      addBuilding(ctx, materials, 100, 100, 34, 16, 34, materials.concrete);

      // Defensive security gates and barricades guarding barracks access
      addBarrier(ctx, materials, -40, -70, Math.PI / 2);
      addBarrier(ctx, materials, 40, -70, Math.PI / 2);
      addBarrier(ctx, materials, -40, 70, Math.PI / 2);
      addBarrier(ctx, materials, 40, 70, Math.PI / 2);
      
      addCrateStack(ctx, materials, -75, -45);
      addCrateStack(ctx, materials, 75, 45);

      // Speed boost grids and launch ramps
      addTurboTile(ctx, materials, 0, 110, 0);
      addTurboTile(ctx, materials, 0, -110, Math.PI);
      addTurboTile(ctx, materials, 110, 0, Math.PI / 2);
      addTurboTile(ctx, materials, -110, 0, -Math.PI / 2);

      // 4 Launch ramps jumping directly across the central Acid Pool!
      addRamp(ctx, materials, -55, 0, 14, 25, Math.PI * 0.5, 0.1, 7.5);
      addRamp(ctx, materials, 55, 0, 14, 25, -Math.PI * 0.5, 0.1, 7.5);
      addRamp(ctx, materials, 0, -55, 14, 25, 0, 0.1, 7.5);
      addRamp(ctx, materials, 0, 55, 14, 25, Math.PI, 0.1, 7.5);

      // Bubbling Green Acid Pool in the center gap (36x36)
      const acidMat = new THREE.MeshStandardMaterial({
        color: 0x39ff14,
        emissive: 0x1fbf1f,
        emissiveIntensity: 3.5,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85
      });
      const acidMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 0.2, 36), acidMat);
      acidMesh.position.set(0, 0.05, 0);
      ctx.scene.add(acidMesh);

      // 4 Symmetrical Extra Acid Pools in the four quadrants (20x20)
      const acidMesh1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), acidMat);
      acidMesh1.position.set(-100, 0.05, 50);
      ctx.scene.add(acidMesh1);

      const acidMesh2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), acidMat);
      acidMesh2.position.set(100, 0.05, -50);
      ctx.scene.add(acidMesh2);

      const acidMesh3 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), acidMat);
      acidMesh3.position.set(-100, 0.05, -50);
      ctx.scene.add(acidMesh3);

      const acidMesh4 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), acidMat);
      acidMesh4.position.set(100, 0.05, 50);
      ctx.scene.add(acidMesh4);

      // Pickups & Weapons
      ctx.pickups.push(
        { x: -110, z: 0, weapon: 'swarm-missiles' },
        { x: 110, z: 0, weapon: 'rail-slug' },
        { x: 0, z: -110, weapon: 'devastator-nuke' },
        { x: 0, z: 110, weapon: 'gravity-imploder' },
        { x: -100, z: 50, weapon: 'toxic-cask' }, // inside top-left acid pool
        { x: 100, z: -50, weapon: 'boom-missile' }, // inside bottom-right acid pool
        { x: -100, z: -50, weapon: 'bouncy-wouncy' }, // inside bottom-left acid pool
        { x: 100, z: 50, weapon: 'shock-lance' }, // inside top-right acid pool
        { x: 0, z: 0, weapon: 'health-kit' },
        { x: -50, z: -50, weapon: 'armor-pack' },
        { x: 50, z: 50, weapon: 'tool-box' },

        // Spawn central heavy turrets
        { x: -75, z: 0, weapon: 'turret-hyper-plasma' },
        { x: 75, z: 0, weapon: 'turret-rail-slugger' },
        { x: 0, z: -75, weapon: 'turret-shock-beam' },
        { x: 0, z: 75, weapon: 'turret-magma-spitter' }
      );
    }
  },
  hangar: {
    id: 'hangar',
    name: 'Sector 05: Elevated Hangar',
    size: 460,
    tagline: 'Multi-Level Platforms & Central Lava Pits',
    description: 'Welcome to the Elevated Hangar! A multi-story aircraft hangar with steel columns, elevated concrete platforms, and inclined ramps. Spans concrete platform structures at 5.0m and 10.0m heights linked by massive vehicle ramps. Watch out for the bottom floor—it has massive bubbling thermal Lava Pits centered at (0, 0) that melt chassis in seconds!',
    build: function (ctx, materials) {
      const size = this.size;
      ctx.currentMapSize = size;
      ctx.specialTiles = [];
      ctx.ramps = [];

      // Warm Hangar / Lava Lighting
      const hemi = new THREE.HemisphereLight(0xffa500, 0x1f2636, 0.65);
      ctx.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xff6500, 0.9);
      sun.position.set(70, 95, -70);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      ctx.scene.add(sun);

      // Ground (Concrete base)
      const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), materials.concrete);
      ground.position.y = -0.54;
      ground.receiveShadow = true;
      ground.geometry.computeBoundsTree();
      ctx.scene.add(ground);
      ctx.aimMeshes = [ground];

      // Surrounding loop asphalt roads
      addRoad(ctx, materials, 0, -size * 0.35, size * 0.75, 26);
      addRoad(ctx, materials, 0, size * 0.35, size * 0.75, 26);
      addRoad(ctx, materials, -size * 0.35, 0, 26, size * 0.75);
      addRoad(ctx, materials, size * 0.35, 0, 26, size * 0.75);

      // Boundaries
      addBorderWalls(ctx, size, 0xff5f00, materials);

      // Central Lava Pit visual in the gap (32x48)
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xff3c00,
        emissive: 0xff1f00,
        emissiveIntensity: 3.5,
        roughness: 0.9,
        metalness: 0.1
      });
      const lavaMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 0.2, 48), lavaMat);
      lavaMesh.position.set(0, 0.05, 0);
      ctx.scene.add(lavaMesh);

      // 2 Extra ground-level Boiling Lava Pits (20x30)
      const lavaMesh1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 30), lavaMat);
      lavaMesh1.position.set(-90, 0.05, 15);
      ctx.scene.add(lavaMesh1);

      const lavaMesh2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 30), lavaMat);
      lavaMesh2.position.set(90, 0.05, -15);
      ctx.scene.add(lavaMesh2);

      // Elevated Concrete Platforms
      // Platform 1: Second Floor (Height = 5.0m), centered at (-90, -90), size 60x60
      addBuilding(ctx, materials, -90, -90, 60, 5, 60, materials.concrete, 5.0);
      ctx.ramps.push({ x: -90, z: -90, w: 60, d: 60, yaw: 0, hStart: 5.0, hEnd: 5.0 });

      // Platform 2: Third Floor (Height = 10.0m), centered at (90, 90), size 60x60
      addBuilding(ctx, materials, 90, 90, 60, 10, 60, materials.concrete, 10.0);
      ctx.ramps.push({ x: 90, z: 90, w: 60, d: 60, yaw: 0, hStart: 10.0, hEnd: 10.0 });

      // Platform 3: Second Floor (Height = 5.0m), centered at (-90, 90), size 50x50
      addBuilding(ctx, materials, -90, 90, 50, 5, 50, materials.concrete, 5.0);
      ctx.ramps.push({ x: -90, z: 90, w: 50, d: 50, yaw: 0, hStart: 5.0, hEnd: 5.0 });

      // Platform 4: Elevated Deck (Height = 7.5m), centered at (90, -90), size 50x50
      addBuilding(ctx, materials, 90, -90, 50, 7.5, 50, materials.concrete, 7.5);
      ctx.ramps.push({ x: 90, z: -90, w: 50, d: 50, yaw: 0, hStart: 7.5, hEnd: 7.5 });

      // Metal Inclined Ramps leading up to platforms
      // 1. Inclined ramp rising from 0 to 5.0m leading up to Platform 1 (-90, -90)
      addRamp(ctx, materials, -90, -45, 16, 30, Math.PI, 0.1, 5.0);

      // 2. Inclined ramp rising from 0 to 10.0m leading up to Platform 2 (90, 90)
      addRamp(ctx, materials, 90, 45, 16, 40, 0, 0.1, 10.0);

      // 3. Inclined ramp rising from 0 to 5.0m leading up to Platform 3 (-90, 90)
      addRamp(ctx, materials, -50, 90, 16, 30, -Math.PI * 0.5, 0.1, 5.0);

      // 4. Inclined ramp rising from 0 to 7.5m leading up to Platform 4 (90, -90)
      addRamp(ctx, materials, 50, -90, 16, 35, Math.PI * 0.5, 0.1, 7.5);

      // Obstacles
      addBarrier(ctx, materials, -30, -150, 0);
      addBarrier(ctx, materials, 30, 150, Math.PI / 2);
      addCrateStack(ctx, materials, -120, -120);
      addCrateStack(ctx, materials, 120, 120);

      // Speed turbo grids and jump tiles
      addTurboTile(ctx, materials, -145, 0, Math.PI / 2);
      addTurboTile(ctx, materials, 145, 0, -Math.PI / 2);
      addJumpTile(ctx, materials, 0, -120, 0);
      addJumpTile(ctx, materials, 0, 120, 0);

      // Pickups & Weapons
      ctx.pickups.push(
        { x: -145, z: 0, weapon: 'swarm-missiles' },
        { x: 145, z: 0, weapon: 'rail-slug' },
        { x: 0, z: -145, weapon: 'devastator-nuke' },
        { x: 0, z: 145, weapon: 'gravity-imploder' },
        { x: -120, z: 80, weapon: 'toxic-cask' },
        { x: 120, z: -80, weapon: 'boom-missile' },
        { x: -80, z: -80, weapon: 'bouncy-wouncy' },
        { x: 80, z: 80, weapon: 'shock-lance' },
        { x: 0, z: 0, weapon: 'health-kit' },
        { x: -90, z: -90, weapon: 'armor-pack' },
        { x: 90, z: 90, weapon: 'tool-box' },

        // Temp Turrets
        { x: -60, z: 0, weapon: 'turret-hyper-plasma' },
        { x: 60, z: 0, weapon: 'turret-rail-slugger' },
        { x: 0, z: -60, weapon: 'turret-shock-beam' },
        { x: 0, z: 60, weapon: 'turret-magma-spitter' }
      );
    }
  }
};
