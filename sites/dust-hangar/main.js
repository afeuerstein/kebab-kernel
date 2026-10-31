import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ensureAudio, playFlashbang, playPin, playThrow, startAmbience, setMuted, isMuted } from '/shared/audio.js';
import { FlashState } from '/shared/flash.js';
import { galleryNav, soundToggle, hint, bootScreen, setStats } from '/shared/ui.js';

const flash = new FlashState(); flash.mount();
galleryNav(); soundToggle(isMuted, setMuted);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.useLegacyLights = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0806);
scene.fog = new THREE.FogExp2(0x0a0806, 0.028);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 2.1, 7.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 3.2; controls.maxDistance = 13;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotate = true; controls.autoRotateSpeed = 0.35;

// ---------- lights ----------
const key = new THREE.SpotLight(0xffd9a0, 260, 60, Math.PI / 5.2, 0.45, 1.6);
key.position.set(6, 9, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0x7fa8ff, 2.2);
rim.position.set(-7, 5, -6);
scene.add(rim);
scene.add(new THREE.AmbientLight(0x2a2118, 2.4));

const flashLight = new THREE.PointLight(0xffffff, 0, 40, 1.8);
scene.add(flashLight);

// ---------- hangar (procedural) ----------
const sand = new THREE.Color(0xb59a6b);
const metal = new THREE.Color(0x4a463f);
const metalDark = new THREE.Color(0x2e2b26);

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m); return m;
}

const floorMat = new THREE.MeshStandardMaterial({ color: sand, roughness: 0.95, metalness: 0.02 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

// procedural sand texture via canvas
function noiseTex(size, base, vary, speck) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * vary;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  if (speck) {
    g.fillStyle = speck;
    for (let i = 0; i < size * 2; i++) g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10);
  return t;
}
floorMat.map = noiseTex(256, '#b59a6b', 34, 'rgba(60,45,25,.5)');
floorMat.needsUpdate = true;

const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a744f, roughness: 0.9 });
wallMat.map = noiseTex(256, '#8a744f', 26, 'rgba(50,38,22,.55)');
// walls
box(60, 12, 1.2, wallMat, 0, 6, -14);
box(60, 12, 1.2, wallMat, 0, 6, 14);
box(1.2, 12, 28, wallMat, -16, 6, 0);
box(1.2, 12, 28, wallMat, 16, 6, 0);
// corrugated roof beams
for (let i = -5; i <= 5; i++) box(0.5, 0.6, 28, new THREE.MeshStandardMaterial({ color: metalDark, roughness: 0.6, metalness: 0.6 }), i * 5.4, 11.4, 0);
box(60, 0.6, 28, new THREE.MeshStandardMaterial({ color: 0x35322c, roughness: 0.7, metalness: 0.4 }), 0, 12, 0);
// pillars
for (const x of [-12, -4, 4, 12]) box(1.1, 12, 1.1, new THREE.MeshStandardMaterial({ color: metal, roughness: 0.55, metalness: 0.5 }), x, 6, -10);
// crates
const crateMat = new THREE.MeshStandardMaterial({ color: 0x77603a, roughness: 0.85 });
crateMat.map = noiseTex(128, '#77603a', 20, 'rgba(40,30,15,.6)');
box(2.2, 2.2, 2.2, crateMat, -6, 1.1, -6, 0.4);
box(1.6, 1.6, 1.6, crateMat, -4.2, 0.8, -6.4, 0.1);
box(2.8, 1.4, 1.8, crateMat, 7, 0.7, -8, -0.2);
box(1.8, 3.4, 1.8, crateMat, 7.6, 1.7, -5.6, 0.3);
// barrels
const barrelMat = new THREE.MeshStandardMaterial({ color: 0x51543f, roughness: 0.5, metalness: 0.7 });
for (const [x, z] of [[-8, -3], [-7, -1.6], [9, -4]]) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 20), barrelMat);
  b.position.set(x, 0.75, z); b.castShadow = b.receiveShadow = true; scene.add(b);
}
// hanging lamp above center
const lampCord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 6), metalDark);
lampCord.position.set(0, 10.5, 0); scene.add(lampCord);
const lampShade = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x22211e, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide }));
lampShade.position.set(0, 9.1, 0); scene.add(lampShade);
const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }));
lampBulb.position.set(0, 8.8, 0); scene.add(lampBulb);
const lampLight = new THREE.PointLight(0xffd9a0, 60, 26, 1.8);
lampLight.position.set(0, 8.7, 0); scene.add(lampLight);

// ---------- the flashbang (hero) ----------
const nade = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.45, metalness: 0.75 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 24), bodyMat);
body.castShadow = true;
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x8a2f22, roughness: 0.5, metalness: 0.4 }));
band.position.y = 0.1;
const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
top.position.y = 0.21; top.castShadow = true;
const lever = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.09), new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.9, roughness: 0.3 }));
lever.position.set(0.09, 0.34, 0);
const ringPull = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 10, 24), new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.9, roughness: 0.3 }));
ringPull.position.set(0.2, 0.34, 0); ringPull.rotation.y = Math.PI / 2;
nade.add(body, band, top, lever, ringPull);
nade.position.set(0, 1.05, 0);
scene.add(nade);

// pedestal
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 32), new THREE.MeshStandardMaterial({ color: metal, roughness: 0.4, metalness: 0.7 }));
pedestal.position.set(0, 0.25, 0); pedestal.castShadow = pedestal.receiveShadow = true;
scene.add(pedestal);

// ---------- dust particles ----------
const N = 900;
const pos = new Float32Array(N * 3);
const seed = new Float32Array(N * 2);
for (let i = 0; i < N; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 26;
  pos[i * 3 + 1] = Math.random() * 10;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
  seed[i * 2] = Math.random() * Math.PI * 2;
  seed[i * 2 + 1] = 0.2 + Math.random() * 0.8;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xd8c49a, size: 0.035, transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(dust);

// shockwave ring mesh (scaled up on detonation)
const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
const shock = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
shock.rotation.x = -Math.PI / 2;
shock.position.y = 0.06;
scene.add(shock);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.7, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- interaction ----------
let thrown = 0;
let throwing = false;
let throwAnim = 0;
const nadeStart = nade.position.clone();
const throwTarget = new THREE.Vector3(0, 1.4, 4.5);
let flight = null;

function detonate() {
  thrown++;
  document.getElementById('cnt').textContent = thrown;
  flash.detonate(1);
  playFlashbang(1);
  flashLight.position.copy(nade.position);
  flashLight.color.setHSL(0.08, 0.2, 1);
  shock.position.set(nade.position.x, 0.06, nade.position.z);
  shock.material.opacity = 0.9;
  shock.scale.setScalar(0.3);
  controls.autoRotate = false;
  setTimeout(() => controls.autoRotate = true, 2600);
}

function throwNade() {
  if (throwing) return;
  throwing = true; throwAnim = 0;
  ensureAudio(); playPin();
  setTimeout(() => { playThrow(); }, 240);
  flight = { t: 0 };
}

addEventListener('pointerdown', e => {
  if (e.target instanceof Element && e.target.closest('a,button,.sound-btn')) return;
  ensureAudio();
  if (!started) return;
  throwNade();
});
addEventListener('keydown', e => {
  if (e.key === ' ' && started) { e.preventDefault(); ensureAudio(); throwNade(); }
});
document.getElementById('btn').addEventListener('click', e => { e.stopPropagation(); ensureAudio(); if (started) throwNade(); });

// ---------- loop ----------
const clock = new THREE.Clock();
let started = false;
const tinnitusEl = document.getElementById('tinnitus');

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // idle nade bob + spin
  if (!throwing) {
    nade.position.y = nadeStart.y + Math.sin(t * 1.6) * 0.05;
    nade.rotation.y = t * 0.8;
  }
  // throw arc
  if (throwing) {
    throwAnim += dt * 1.4;
    if (throwAnim >= 1) {
      throwing = false;
      nade.position.copy(throwTarget);
      detonate();
      // reset after flash recovers
      setTimeout(() => { nade.position.copy(nadeStart); nade.rotation.set(0, 0, 0); }, 2600);
    } else {
      const a = throwAnim;
      nade.position.lerpVectors(nadeStart, throwTarget, a);
      nade.position.y += Math.sin(a * Math.PI) * 2.2;
      nade.rotation.x += dt * 9; nade.rotation.z += dt * 7;
    }
  }

  // flash light + shockwave
  if (flash.peak > 0 || flashLight.intensity > 0) {
    const I = flash.intensity;
    flashLight.intensity = I * 900;
    bloom.strength = 0.55 + I * 2.6;
    renderer.toneMappingExposure = 1.05 + I * 2.4;
    camera.fov = 55 + I * 14;
    camera.updateProjectionMatrix();
    // camera shake
    camera.position.x += (Math.random() - 0.5) * I * 0.12;
    camera.position.y += (Math.random() - 0.5) * I * 0.1;
    tinnitusEl.style.opacity = Math.min(1, I * 1.4);
  } else {
    bloom.strength += (0.55 - bloom.strength) * dt * 2;
    renderer.toneMappingExposure += (1.05 - renderer.toneMappingExposure) * dt * 2;
    if (Math.abs(camera.fov - 55) > 0.01) { camera.fov += (55 - camera.fov) * dt * 3; camera.updateProjectionMatrix(); }
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 2600);
    tinnitusEl.style.opacity = 0;
  }
  if (shock.material.opacity > 0) {
    shock.scale.addScalar(dt * 26);
    shock.material.opacity = Math.max(0, shock.material.opacity - dt * 1.6);
  }

  // dust drift in the light shaft
  const p = dustGeo.attributes.position.array;
  for (let i = 0; i < N; i++) {
    p[i * 3 + 1] -= dt * seed[i * 2 + 1] * 0.25;
    p[i * 3] += Math.sin(t * 0.5 + seed[i * 2]) * dt * 0.12;
    if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 10;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // lamp sway
  lampShade.rotation.z = Math.sin(t * 0.7) * 0.04;
  lampBulb.position.x = Math.sin(t * 0.7) * 0.06;
  lampLight.position.x = Math.sin(t * 0.7) * 0.06;

  flash.update(dt);
  controls.update();
  composer.render();
  setStats({ flashes: thrown, flashIntensity: +flash.intensity.toFixed(3), fps: Math.round(1 / Math.max(dt, 1e-4)) });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

bootScreen(['flsh.me', 'concept 01 / 05 — dust hangar', 'loading m67 flashbang…'], () => {
  started = true;
  ensureAudio(); startAmbience();
  hint('drag to orbit · click anywhere to throw the flashbang');
  window.__ready = true;
});
tick();
