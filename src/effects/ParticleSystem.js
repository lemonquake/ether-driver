import * as THREE from 'three';

function makeParticleTexture(colorInner, colorOuter) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
  gradient.addColorStop(0, colorInner);
  gradient.addColorStop(1, colorOuter);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createParticleMaterial(texture, color, additive = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      pointTexture: { value: texture },
      baseColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;

      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(82.0, max(0.0, aSize * (220.0 / max(1.0, -mvPosition.z))));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D pointTexture;
      uniform vec3 baseColor;
      varying float vAlpha;

      void main() {
        vec4 texel = texture2D(pointTexture, gl_PointCoord);
        float alpha = texel.a * vAlpha;
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(texel.rgb * baseColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function makePool(scene, count, texture, color, additive = false) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const baseSizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const lives = new Float32Array(count);
  const maxLives = new Float32Array(count);
  const active = new Int32Array(count);
  const activeSlots = new Int32Array(count);
  activeSlots.fill(-1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.computeBoundingSphere();

  const points = new THREE.Points(geometry, createParticleMaterial(texture, color, additive));
  points.frustumCulled = false;
  scene.add(points);

  return {
    active,
    activeCount: 0,
    activeSlots,
    alphas,
    baseSizes,
    count,
    cursor: 0,
    geometry,
    lives,
    maxLives,
    positions,
    sizes,
    velocities,
  };
}

function activate(pool, index) {
  if (pool.activeSlots[index] !== -1) return;
  pool.activeSlots[index] = pool.activeCount;
  pool.active[pool.activeCount] = index;
  pool.activeCount += 1;
}

function removeActive(pool, activeIndex, particleIndex) {
  const lastIndex = pool.activeCount - 1;
  const lastParticle = pool.active[lastIndex];
  pool.active[activeIndex] = lastParticle;
  pool.activeSlots[lastParticle] = activeIndex;
  pool.activeSlots[particleIndex] = -1;
  pool.activeCount = lastIndex;
}

function emit(pool, x, y, z, vx, vy, vz, life, size) {
  const index = pool.cursor;
  pool.cursor = (pool.cursor + 1) % pool.count;
  activate(pool, index);

  const offset = index * 3;
  pool.positions[offset] = x;
  pool.positions[offset + 1] = y;
  pool.positions[offset + 2] = z;
  pool.velocities[offset] = vx;
  pool.velocities[offset + 1] = vy;
  pool.velocities[offset + 2] = vz;
  pool.lives[index] = life;
  pool.maxLives[index] = life;
  pool.baseSizes[index] = size;
  pool.sizes[index] = size;
  pool.alphas[index] = 1;
}

function markPoolDirty(pool) {
  pool.geometry.attributes.position.needsUpdate = true;
  pool.geometry.attributes.aSize.needsUpdate = true;
  pool.geometry.attributes.aAlpha.needsUpdate = true;
}

export function createParticleSystem(scene) {
  const textures = {
    smoke: makeParticleTexture('rgba(210, 220, 215, 0.62)', 'rgba(210, 220, 215, 0)'),
    spark: makeParticleTexture('rgba(255, 224, 128, 0.95)', 'rgba(255, 80, 20, 0)'),
    plasma: makeParticleTexture('rgba(130, 255, 207, 0.95)', 'rgba(130, 255, 207, 0)'),
    fire: makeParticleTexture('rgba(255, 170, 50, 0.95)', 'rgba(255, 40, 10, 0)'),
    dust: makeParticleTexture('rgba(210, 190, 145, 0.74)', 'rgba(110, 92, 62, 0)'),
    toxic: makeParticleTexture('rgba(85, 255, 85, 0.9)', 'rgba(85, 255, 85, 0)'),
    gravity: makeParticleTexture('rgba(148, 0, 211, 0.95)', 'rgba(75, 0, 130, 0)'),
  };
  const pools = {
    smoke: makePool(scene, 220, textures.smoke, 0xb6bab2, false),
    spark: makePool(scene, 240, textures.spark, 0xffb15a, true),
    plasma: makePool(scene, 220, textures.plasma, 0x82ffcf, true),
    fire: makePool(scene, 220, textures.fire, 0xff6545, true),
    dust: makePool(scene, 160, textures.dust, 0xc9b789, false),
    toxic: makePool(scene, 150, textures.toxic, 0x55ff55, false),
    gravity: makePool(scene, 150, textures.gravity, 0x9400d3, true),
  };
  const poolKeys = Object.keys(pools);
  const poolValues = poolKeys.map((k) => pools[k]);
  // Per-frame emission budget to prevent particle storms on multi-death frames
  let frameEmissions = 0;
  const MAX_FRAME_EMISSIONS = 60;

  function emitTo(poolName, x, y, z, vx, vy, vz, life, size) {
    if (frameEmissions >= MAX_FRAME_EMISSIONS) return;
    emit(pools[poolName], x, y, z, vx, vy, vz, life, size);
    frameEmissions += 1;
  }

  return {
    emitSmoke(x, z, amount = 3) {
      for (let i = 0; i < amount; i += 1) {
        emitTo(
          'smoke',
          x + (Math.random() - 0.5) * 1.4,
          0.25,
          z + (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 0.8,
          0.8 + Math.random() * 1.0,
          (Math.random() - 0.5) * 0.8,
          0.8 + Math.random() * 0.5,
          0.7 + Math.random() * 0.8,
        );
      }
    },
    emitImpact(x, z, normal = { x: 0, z: 1 }, amount = 10) {
      for (let i = 0; i < amount; i += 1) {
        emitTo(
          'spark',
          x,
          0.35,
          z,
          normal.x * (1 + Math.random() * 3) + (Math.random() - 0.5),
          1 + Math.random() * 2,
          normal.z * (1 + Math.random() * 3) + (Math.random() - 0.5),
          0.35 + Math.random() * 0.25,
          0.18 + Math.random() * 0.16,
        );
      }
    },
    emitDamageFireImpact(x, z, normal = { x: 0, z: 1 }, damageType = 'kinetic', damage = 1, options = {}) {
      const heavy = options.lethal || damage >= 24;
      const amount = Math.max(3, Math.min(16, Math.round(3 + Math.sqrt(Math.max(0, damage)) * (heavy ? 1.8 : 1.25))));
      const accentType = damageType === 'plasma' || damageType === 'shock'
        ? 'plasma'
        : damageType === 'fire' || damageType === 'explosive'
          ? 'fire'
          : damageType === 'chemical' || damageType === 'toxic' || damageType === 'acid'
            ? 'toxic'
            : 'spark';

      for (let i = 0; i < amount; i += 1) {
        const spread = (Math.random() - 0.5) * 1.3;
        const lift = 0.7 + Math.random() * (heavy ? 2.4 : 1.5);
        const speed = 0.7 + Math.random() * (heavy ? 2.3 : 1.4);
        const pool = i % 5 === 0 ? 'smoke' : i % 3 === 0 ? accentType : 'fire';
        emitTo(
          pool,
          x + (Math.random() - 0.5) * 0.7,
          0.45 + Math.random() * 0.55,
          z + (Math.random() - 0.5) * 0.7,
          normal.x * speed + spread,
          lift,
          normal.z * speed + (Math.random() - 0.5) * 1.3,
          pool === 'smoke' ? 0.55 + Math.random() * 0.4 : 0.28 + Math.random() * 0.28,
          pool === 'smoke' ? 0.35 + Math.random() * 0.36 : 0.2 + Math.random() * (heavy ? 0.28 : 0.16),
        );
      }
    },
    emitWorldImpact(x, z, normal = { x: 0, z: 1 }, materialType = 'building', amount = 12) {
      const metallic = ['barrier', 'parked-car', 'base'].includes(materialType);
      for (let i = 0; i < amount; i += 1) {
        emitTo(
          metallic ? 'spark' : 'dust',
          x + normal.x * 0.18,
          0.45 + Math.random() * 0.45,
          z + normal.z * 0.18,
          normal.x * (0.8 + Math.random() * 2.5) + (Math.random() - 0.5) * 1.2,
          0.5 + Math.random() * 2.0,
          normal.z * (0.8 + Math.random() * 2.5) + (Math.random() - 0.5) * 1.2,
          metallic ? 0.32 + Math.random() * 0.2 : 0.62 + Math.random() * 0.4,
          metallic ? 0.14 + Math.random() * 0.14 : 0.42 + Math.random() * 0.34,
        );
      }
    },
    emitExplosion(x, z, radius = 5, amount = 34, poolType = 'fire', options = {}) {
      const isDevastator = radius > 10;
      const budgetScale = options.budgetScale ?? 1;
      const actualAmount = Math.max(3, Math.round((isDevastator ? amount * 1.5 : amount) * budgetScale));
      for (let i = 0; i < actualAmount; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const force = 1.5 + Math.random() * radius * (isDevastator ? 1.5 : 0.85);
        emitTo(
          i % 4 === 0 ? 'smoke' : poolType,
          x + cos * 0.6,
          0.55 + Math.random() * 0.5,
          z + sin * 0.6,
          cos * force,
          1.4 + Math.random() * (isDevastator ? 4.2 : 2.2),
          sin * force,
          (0.55 + Math.random() * 0.8) * (isDevastator ? 1.8 : 1),
          (0.8 + Math.random() * 1.2) * (isDevastator ? 1.8 : 1),
        );
      }
      this.emitImpact(x, z, { x: 0, z: 1 }, Math.max(2, Math.round((isDevastator ? 24 : 10) * budgetScale)));
      const smokeLoops = Math.max(1, Math.round((isDevastator ? 6 : 2) * budgetScale));
      const smokePerLoop = options.smokeAmount ?? 2;
      for (let i = 0; i < smokeLoops; i += 1) this.emitSmoke(x, z, smokePerLoop);
    },
    emitGravityImplosion(x, z, radius = 5) {
      for (let i = 0; i < 35; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dist = 1 + Math.random() * radius;
        emitTo(
          'gravity',
          x + cos * dist,
          0.55 + Math.random(),
          z + sin * dist,
          -cos * dist * 1.5,
          Math.random() * 2,
          -sin * dist * 1.5,
          0.8 + Math.random() * 0.5,
          0.9 + Math.random() * 1.2,
        );
      }
    },
    emitToxicCloud(x, z, radius = 5) {
      for (let i = 0; i < 40; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const force = 0.5 + Math.random() * radius * 0.5;
        emitTo(
          i % 3 === 0 ? 'smoke' : 'toxic',
          x + cos * (Math.random() * radius),
          0.2 + Math.random() * 1.5,
          z + sin * (Math.random() * radius),
          cos * force,
          Math.random() * 0.8,
          sin * force,
          1.5 + Math.random() * 1.5,
          1.5 + Math.random() * 2.0,
        );
      }
    },
    emitDeathExplosion(x, z, options = {}) {
      const playerDeath = Boolean(options.playerDeath);
      this.emitExplosion(x, z, 4, playerDeath ? 6 : 10, 'fire', {
        budgetScale: playerDeath ? 0.35 : 0.6,
        smokeAmount: playerDeath ? 1 : 2,
      });
    },
    emitTrail(x, y, z, color = 'plasma') {
      let finalY = 0.55;
      let finalZ = z;
      let finalColor = color;
      
      if (typeof y === 'string') {
        finalY = 0.55;
        finalZ = y;
        finalColor = z || 'plasma';
      } else if (y !== undefined && z !== undefined) {
        finalY = y;
        finalZ = z;
      } else {
        finalZ = z !== undefined ? z : y;
      }
      
      const type = poolKeys.includes(finalColor) ? finalColor : 'plasma';
      emitTo(
        type,
        x,
        finalY,
        finalZ,
        (Math.random() - 0.5) * 0.3,
        0.25,
        (Math.random() - 0.5) * 0.3,
        0.35,
        0.35,
      );
    },
    update(dt) {
      // Reset per-frame emission budget
      frameEmissions = 0;
      for (let p = 0; p < poolValues.length; p += 1) {
        const pool = poolValues[p];
        for (let i = pool.activeCount - 1; i >= 0; i -= 1) {
          const index = pool.active[i];
          pool.lives[index] -= dt;
          if (pool.lives[index] <= 0) {
            pool.alphas[index] = 0;
            pool.sizes[index] = 0;
            removeActive(pool, i, index);
            continue;
          }

          const offset = index * 3;
          pool.velocities[offset + 1] -= 1.2 * dt;
          pool.positions[offset] += pool.velocities[offset] * dt;
          pool.positions[offset + 1] += pool.velocities[offset + 1] * dt;
          pool.positions[offset + 2] += pool.velocities[offset + 2] * dt;
          const t = pool.lives[index] / pool.maxLives[index];
          pool.alphas[index] = t * t;
          pool.sizes[index] = pool.baseSizes[index] * (1 + (1 - t) * 1.8);
        }
        if (pool.activeCount > 0) markPoolDirty(pool);
      }
    },
  };
}
