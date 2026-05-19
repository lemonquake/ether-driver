import * as THREE from 'three';
import { World as ECSWorld } from '@miniplex/core';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createGameContext(canvas) {
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Ether Driver game viewport');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb5d0);
  scene.fog = new THREE.FogExp2(0x8fb5d0, 0.0065);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 7, 12);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.45, 0.78));
  composer.addPass(new OutputPass());



  const ecs = new ECSWorld();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  return {
    canvas,
    renderer,
    scene,
    camera,
    composer,
    ecs,
    raycaster,
    mouse,
    collisionShapes: [],
    minimapObjects: [],
    roads: [],
    pickups: [],
    damageNumbers: { active: [], queue: [] },
    input: {
      keys: new Set(),
      mouseDown: false,
      lockHeld: false,
      aimPoint: new THREE.Vector3(0, 0, 0),
      crosshairNDC: new THREE.Vector2(),
      targetScreenNDC: new THREE.Vector2(),
      hoverTarget: null,
      lockedTarget: null,
      lockState: 'idle',
      lockPulse: 0,
      lockLostTimer: 0,
      hudFull: false,
    },
  };
}

export function resizeContext(ctx) {
  ctx.camera.aspect = window.innerWidth / window.innerHeight;
  ctx.camera.updateProjectionMatrix();
  ctx.renderer.setSize(window.innerWidth, window.innerHeight);
  ctx.composer.setSize(window.innerWidth, window.innerHeight);
}
