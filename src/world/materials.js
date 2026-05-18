import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

function makeTexture(renderer, size, painter, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  painter(ctx, size);
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createMaterials(renderer) {
  const asphalt = makeTexture(renderer, 512, (ctx, size) => {
    ctx.fillStyle = '#24272a';
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = noise2D(x * 0.035, y * 0.035);
        const lane = x > size * 0.485 && x < size * 0.515 && y % 96 < 54 ? 115 : 0;
        const v = 42 + n * 18 + lane;
        const i = (y * size + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v + 2;
        img.data[i + 2] = v + 4;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, 1, 10);

  const grass = makeTexture(renderer, 512, (ctx, size) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = noise2D(x * 0.018, y * 0.018);
        const i = (y * size + x) * 4;
        img.data[i] = 42 + n * 18;
        img.data[i + 1] = 88 + n * 32;
        img.data[i + 2] = 54 + n * 15;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, 30, 30);

  const concrete = makeTexture(renderer, 512, (ctx, size) => {
    ctx.fillStyle = '#8d928c';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3200; i += 1) {
      const shade = 105 + Math.random() * 80;
      ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 2}, 0.18)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  }, 2, 3);

  const brick = makeTexture(renderer, 512, (ctx, size) => {
    ctx.fillStyle = '#6d4d43';
    ctx.fillRect(0, 0, size, size);
    const rowH = size / 16;
    ctx.strokeStyle = 'rgba(30, 22, 18, 0.65)';
    ctx.lineWidth = 4;
    for (let row = 0; row < 16; row += 1) {
      const offset = row % 2 ? 64 : 0;
      for (let x = -offset; x < size; x += 128) {
        const shade = 86 + Math.random() * 42;
        ctx.fillStyle = `rgb(${shade + 30}, ${shade - 2}, ${shade - 16})`;
        ctx.fillRect(x, row * rowH, 128, rowH);
        ctx.strokeRect(x, row * rowH, 128, rowH);
      }
    }
  }, 3, 5);

  const windows = makeTexture(renderer, 512, (ctx, size) => {
    ctx.fillStyle = '#19262c';
    ctx.fillRect(0, 0, size, size);
    for (let y = 28; y < size; y += 74) {
      for (let x = 24; x < size; x += 72) {
        ctx.fillStyle = Math.random() > 0.36 ? 'rgba(255, 205, 110, 0.86)' : 'rgba(61, 96, 112, 0.65)';
        ctx.fillRect(x, y, 34, 42);
      }
    }
  }, 2, 4);

  return {
    asphalt: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.72, metalness: 0.03 }),
    grass: new THREE.MeshStandardMaterial({ map: grass, roughness: 0.92 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.84 }),
    brick: new THREE.MeshStandardMaterial({ map: brick, roughness: 0.78 }),
    windows: new THREE.MeshStandardMaterial({
      map: windows,
      roughness: 0.26,
      metalness: 0.18,
      emissive: new THREE.Color(0xffbe67),
      emissiveIntensity: 0.18,
    }),
    glass: new THREE.MeshStandardMaterial({ color: 0x74d7ff, roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x080909, roughness: 0.7 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x1a2024, roughness: 0.42, metalness: 0.7 }),
    light: new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffcf77, emissiveIntensity: 1.7 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xff6545, roughness: 0.5, metalness: 0.1 }),
  };
}
