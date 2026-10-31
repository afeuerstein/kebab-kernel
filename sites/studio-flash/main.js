import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ensureAudio, playFlashbang, playPin, setMuted, isMuted, startAmbience } from '/shared/audio.js';
import { FlashState } from '/shared/flash.js';
import { galleryNav, soundToggle, bootScreen, setStats } from '/shared/ui.js';

const flash = new FlashState(); flash.mount();
galleryNav(); soundToggle(isMuted, setMuted);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.useLegacyLights = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene_env_setup();
function scene_env_setup() {}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0c);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, 1.35, 4.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.05, 0);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 2.2; controls.maxDistance = 7.5;
controls.autoRotate = true; controls.autoRotateSpeed = 0.8;
controls.maxPolarAngle = Math.PI * 0.55; controls.minPolarAngle = Math.PI * 0.32;

// soft key light for product feel
const key = new THREE.SpotLight(0xffffff, 90, 30, Math.PI / 6, 0.5, 1.8);
key.position.set(3.5, 5, 3);
key.castShadow = true;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xbfd4ff, 1.1);
fill.position.set(-4, 2, -3);
scene.add(fill);
const flashLight = new THREE.PointLight(0xffffff, 0, 50, 1.5);
scene.add(flashLight);

// ---------- pedestal ----------
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.05, 1.25, 0.16, 48),
  new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.35, metalness: 0.2 })
);
pedestal.position.y = 0.08; pedestal.receiveShadow = true;
scene.add(pedestal);
const pedTop = new THREE.Mesh(
  new THREE.CylinderGeometry(1.05, 1.05, 0.02, 48),
  new THREE.MeshStandardMaterial({ color: 0x232327, roughness: 0.25, metalness: 0.3 })
);
pedTop.position.y = 0.17; scene.add(pedTop);

// soft contact shadow blob
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.181;
scene.add(blob);

// ---------- the flashbang (detailed product model) ----------
const nade = new THREE.Group();
let bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.32, metalness: 0.65 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.52, 48), bodyMat);
body.castShadow = true;
// knurled grip rings
for (let i = 0; i < 5; i++) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.012, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x2c3829, roughness: 0.4, metalness: 0.7 }));
  r.rotation.x = Math.PI / 2;
  r.position.y = -0.18 + i * 0.075;
  nade.add(r);
}
const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
topCap.position.y = 0.26; topCap.castShadow = true;
const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.11),
  new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.95, roughness: 0.25 }));
spoon.position.set(0.12, 0.42, 0);
const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 10, 32),
  new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.95, roughness: 0.25 }));
pinRing.position.set(0.26, 0.42, 0); pinRing.rotation.y = Math.PI / 2;
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.13, 48),
  new THREE.MeshStandardMaterial({ color: 0xb03a24, roughness: 0.45, metalness: 0.3 }));
band.position.y = 0.12;
// stencil label
labelTex();
function labelTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1c1c1e';
  g.font = 'bold 44px monospace'; g.textAlign = 'center';
  g.fillText('M67', 128, 58);
  g.font = '20px monospace';
  g.fillText('FLASHBANG', 128, 92);
  const t = new THREE.CanvasTexture(c);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.16, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  label.position.y = -0.06;
  nade.add(label);
}
nade.add(body, topCap, spoon, pinRing, band);
nade.position.y = 0.18 + 0.26;
scene.add(nade);

// floating spec rings (thin torus orbiting)
const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.006, 8, 100),
  new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.8 }));
orbitRing.position.y = 1.05;
scene.add(orbitRing);
const orbitRing2 = orbitRing.clone();
orbitRing2.scale.setScalar(1.25); orbitRing2.material = orbitRing.material.clone();
orbitRing2.material.opacity = 0.4;
scene.add(orbitRing2);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- interaction ----------
let count = 0;
let started = false;
let spinBoost = 0;

function detonate() {
  count++;
  flash.detonate(1);
  playFlashbang(1);
  flashLight.position.copy(nade.getWorldPosition(new THREE.Vector3()));
  spinBoost = 6;
  controls.autoRotateSpeed = 6;
  setTimeout(() => { controls.autoRotateSpeed = 0.8; }, 2400);
}

addEventListener('pointerdown', e => {
  if (e.target instanceof Element && e.target.closest('a,button,.sound-btn,#swatch')) return;
  ensureAudio();
  if (started) detonate();
});
addEventListener('keydown', e => {
  if (e.key === ' ' && started) { e.preventDefault(); ensureAudio(); detonate(); }
});
document.getElementById('demoBtn').addEventListener('click', e => { e.stopPropagation(); ensureAudio(); if (started) detonate(); });
document.querySelectorAll('#swatch .dot').forEach(d => {
  d.addEventListener('click', () => {
    document.querySelectorAll('#swatch .dot').forEach(x => x.classList.remove('on'));
    d.classList.add('on');
    bodyMat.color.set(d.dataset.c);
  });
});

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  nade.position.y = 0.44 + Math.sin(t * 1.4) * 0.05;
  nade.rotation.y = t * 0.5 + spinBoost;
  spinBoost = Math.max(0, spinBoost - dt * 3);
  orbitRing.rotation.x = t * 0.4;
  orbitRing.rotation.y = t * 0.25;
  orbitRing2.rotation.x = -t * 0.3;
  orbitRing2.rotation.z = t * 0.2;

  const I = flash.intensity;
  flashLight.intensity = I * 1200;
  bloom.strength = 0.4 + I * 3.0;
  renderer.toneMappingExposure = 1.1 + I * 2.2;
  camera.fov = 40 + I * 12;
  camera.updateProjectionMatrix();

  flash.update(dt);
  controls.update();
  composer.render();
  setStats({ detonations: count, flashIntensity: +flash.intensity.toFixed(3) });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

bootScreen(['flsh.me studio', 'concept 04 / 05 — product film', 'rendering m67…'], () => {
  started = true;
  ensureAudio(); startAmbience();
  window.__ready = true;
});
tick();
