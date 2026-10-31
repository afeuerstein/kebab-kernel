import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ensureAudio, playFlashbang, playPin, playThrow, playShot, playBounce, startAmbience, setMuted, isMuted } from '/shared/audio.js';
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
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.FogExp2(0x0a0908, 0.028);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.62, 0);

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0x3a4048, 1.1));
const c1 = new THREE.PointLight(0xffd9b0, 80, 24, 1.5); c1.position.set(-2, 2.6, -6); scene.add(c1);
const c2 = new THREE.PointLight(0xffe8cc, 60, 22, 1.5); c2.position.set(3, 2.6, -14); scene.add(c2);
const c3 = new THREE.PointLight(0xcfe0ff, 65, 24, 1.5); c3.position.set(-1, 2.6, -22); scene.add(c3);
const flashLight = new THREE.PointLight(0xffffff, 0, 60, 1.4);
flashLight.position.set(0, 1.6, -12);
scene.add(flashLight);
// muzzle-ish fill so the viewmodel reads against dark floor
const viewFill = new THREE.PointLight(0xffe0c0, 5, 4, 1.8);
viewFill.position.set(0.2, 1.4, -0.5);
scene.add(viewFill);
// muzzle flash light
const muzzleLight = new THREE.PointLight(0xffc266, 0, 10, 2);
muzzleLight.position.set(0, 1.5, -1.2);
scene.add(muzzleLight);

// ---------- corridor geometry ----------
const L = 34; // corridor length
const W = 5.2; // width
const H = 3.2; // height
const wallMat = new THREE.MeshStandardMaterial({ color: 0x948d80, roughness: 0.92 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x786f60, roughness: 0.95 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.95 });

function noiseTex(size, base, vary) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * vary; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
wallMat.map = noiseTex(256, "#948d80", 22); wallMat.map.repeat.set(6, 1);
floorMat.map = noiseTex(256, "#786f60", 26); floorMat.map.repeat.set(4, 14);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.z = -L / 2; floor.receiveShadow = true;
scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -L / 2); ceil.receiveShadow = true;
scene.add(ceil);
for (const sx of [-1, 1]) {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
  w.rotation.y = sx * Math.PI / 2;
  w.position.set(sx * W / 2, H / 2, -L / 2);
  w.receiveShadow = true;
  scene.add(w);
}
// end walls
const endNear = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
endNear.position.set(0, H / 2, 0.01); endNear.rotation.y = Math.PI; scene.add(endNear);
const endFar = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
endFar.position.set(0, H / 2, -L); scene.add(endFar);
// door frames along walls
for (let i = 0; i < 5; i++) {
  const z = -4 - i * 6;
  for (const sx of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.8 }));
    door.rotation.y = sx * Math.PI / 2;
    door.position.set(sx * (W / 2 - 0.02), 1.2, z);
    scene.add(door);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x3a3833, roughness: 0.7 }));
    frame.position.set(sx * (W / 2 - 0.08), 1.3, z);
    scene.add(frame);
  }
}
// ceiling lamps
for (let i = 0; i < 5; i++) {
  const z = -3 - i * 6.5;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
  lamp.position.set(0, H - 0.05, z);
  scene.add(lamp);
}
// pipes along ceiling
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.8, roughness: 0.4 });
for (const x of [-2.2, 2.2]) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, L, 12), pipeMat);
  p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.25, -L / 2);
  scene.add(p);
}
// crates near far end
const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 });
function crate(x, y, z, s) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
  m.position.set(x, y + s / 2, z); m.rotation.y = Math.random() * 0.5;
  m.castShadow = m.receiveShadow = true; scene.add(m);
}
crate(-1.4, 0, -26, 1.6); crate(-1.2, 1.6, -25.6, 1.2); crate(1.6, 0, -28, 1.8); crate(0.2, 0, -30.5, 1.4);
// sandbag stack
for (let i = 0; i < 3; i++) {
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.6, 6, 12), new THREE.MeshStandardMaterial({ color: 0x7a6f4e, roughness: 1 }));
  bag.rotation.z = Math.PI / 2; bag.rotation.y = 0.2;
  bag.position.set(-0.6 + i * 0.5, 0.42, -24.5 - i * 0.5);
  bag.castShadow = true;
  scene.add(bag);
}

// ---------- viewmodel USP (bottom-right of camera) ----------
const view = new THREE.Group();
const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.85, roughness: 0.35 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, metalness: 0.3, roughness: 0.8 });
const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), gunMetal);
const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.3), gunMetal);
frame.position.set(0, -0.05, 0.02);
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), gripMat);
grip.position.set(0, -0.12, 0.12); grip.rotation.x = 0.25;
const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff }));
sight.position.set(0, 0.055, -0.15);
view.add(slide, frame, grip, sight);
view.position.set(0.22, -0.2, -0.45);
view.rotation.y = 0.04;
camera.add(view);
scene.add(camera);

// ---------- enemy (T player silhouette at far end) ----------
const enemy = new THREE.Group();
const eMat = new THREE.MeshStandardMaterial({ color: 0xa8825a, roughness: 0.85, emissive: 0x2a1a08, emissiveIntensity: 0.6 });
const eHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd9b48c, roughness: 0.75, emissive: 0x33200e, emissiveIntensity: 0.7 }));
eHead.position.y = 1.72;
const eBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.75, 8, 14), eMat);
eBody.position.y = 1.15;
const eLegL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.7, 6, 10), eMat);
eLegL.position.set(-0.14, 0.45, 0);
const eLegR = eLegL.clone(); eLegR.position.x = 0.14;
const eArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 6, 10), eMat);
eArm.position.set(0.34, 1.3, -0.1); eArm.rotation.z = -1.2;
enemy.add(eHead, eBody, eLegL, eLegR, eArm);
enemy.position.set(0.8, 0, -29);
enemy.visible = false; // appears when round starts
scene.add(enemy);

// enemy's flashbang that flies in
const nade = new THREE.Group();
const nBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 14),
  new THREE.MeshStandardMaterial({ color: 0x3d4a3a, metalness: 0.7, roughness: 0.5, emissive: 0x1a2416, emissiveIntensity: 0.8 }));
nade.add(nBody);
nade.position.set(0, 5, -20);
scene.add(nade);

// impact puff sprite
const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), puffMat);
scene.add(puff);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- input / game ----------
let started = false;
let mouseX = 0, mouseY = 0;
let yaw = 0, pitch = 0;
let recoil = 0;
let ammo = 24;
let roundState = 'waiting'; // waiting -> live -> flashed
let flashTimer = 0;
let nadeFlight = null;
let flashCount = 0;
const flashResultEl = document.getElementById('flashResult');
const flashMsEl = document.getElementById('flashMs');
const muzzleEl = document.getElementById('muzzle');

addEventListener('mousemove', e => {
  if (!started) return;
  mouseX = (e.clientX / innerWidth - 0.5) * 2;
  mouseY = (e.clientY / innerHeight - 0.5) * 2;
});
addEventListener('pointerdown', e => {
  if (e.target instanceof Element && e.target.closest('a,button,.sound-btn')) return;
  ensureAudio();
  if (!started || flash.intensity > 0.25) return;
  // fire
  if (ammo > 0) {
    ammo--;
    document.querySelector('#bottomR .ammo').firstChild.textContent = ammo;
    playShot();
    recoil = 0.09;
    muzzleLight.intensity = 30;
    muzzleEl.style.transition = 'none'; muzzleEl.style.opacity = 0.85;
    requestAnimationFrame(() => { muzzleEl.style.transition = 'opacity .12s'; muzzleEl.style.opacity = 0; });
    setTimeout(() => muzzleLight.intensity = 0, 60);
    // hit enemy?
    if (enemy.visible && roundState === 'live') {
      enemy.visible = false;
      feedHit();
    }
  }
});
function feedHit() {
  flashResultEl.querySelector('.big').textContent = 'headshot';
  flashResultEl.querySelector('.sub').textContent = 'enemy eliminated';
  flashResultEl.style.opacity = 1;
  setTimeout(() => flashResultEl.style.opacity = 0, 1600);
  setTimeout(startRound, 2200);
}

addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') { ammo = 24; document.querySelector('#bottomR .ammo').firstChild.textContent = ammo; }
});

function startRound() {
  roundState = 'live';
  enemy.visible = true;
  enemy.position.x = 0.8;
  // enemy peeks + throws a flash into the corridor after a beat
  setTimeout(() => { if (roundState === 'live') { playPin(); } }, 1400);
  setTimeout(() => {
    if (roundState !== 'live') return;
    roundState = 'enemy-threw';
    playThrow();
    nadeFlight = { t: 0, from: new THREE.Vector3(1.6, 1.5, -27), to: new THREE.Vector3(-0.4, 1.3, -13) };
  }, 2200);
}

function detonate() {
  flashCount++;
  flash.detonate(1);
  playFlashbang(1);
  flashLight.position.copy(nade.position);
  puff.position.copy(nade.position);
  puff.material.opacity = 0.9;
  puff.scale.setScalar(0.4);
  roundState = 'flashed';
  const blind = 4 + Math.random() * 2.5;
  flashTimer = blind;
  flashResultEl.querySelector('.big').textContent = 'flashed';
  flashMsEl.textContent = `blind for ${blind.toFixed(2)}s`;
  flashResultEl.style.opacity = 1;
  setTimeout(() => { if (roundState === 'flashed') flashResultEl.style.opacity = 0; }, 1800);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let bob = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // look
  yaw -= mouseX * dt * 1.6;
  pitch -= mouseY * dt * 1.2;
  pitch = Math.max(-0.5, Math.min(0.55, pitch));
  // when flashed, view swims
  const swim = flash.intensity;
  camera.rotation.set(pitch + swim * Math.sin(t * 2.2) * 0.25 + (Math.random() - 0.5) * swim * 0.08,
    yaw + swim * Math.cos(t * 1.7) * 0.3, (Math.random() - 0.5) * swim * 0.06);

  // head bob
  bob += dt * 7;
  camera.position.y = 1.62 + Math.sin(bob) * 0.035 * (1 - swim * 0.7);
  camera.position.x = Math.sin(bob * 0.5) * 0.03;

  // recoil recovery
  recoil = Math.max(0, recoil - dt * 0.5);
  view.position.z = -0.45 + recoil;
  view.rotation.x = recoil * 1.6;
  // idle sway
  view.position.x = 0.22 + Math.sin(t * 1.3) * 0.006;
  view.position.y = -0.2 + Math.sin(bob) * 0.008;

  // nade flight
  if (nadeFlight) {
    nadeFlight.t += dt * 1.1;
    const a = Math.min(nadeFlight.t, 1);
    nade.position.lerpVectors(nadeFlight.from, nadeFlight.to, a);
    nade.position.y += Math.sin(a * Math.PI) * 1.6;
    if (Math.random() < dt * 8) playBounce(0.12);
    if (a >= 1) { nadeFlight = null; detonate(); }
  }

  // enemy idle anim
  if (enemy.visible) {
    enemy.position.x = 0.8 + Math.sin(t * 0.8) * 0.25;
    eArm.rotation.z = -1.2 + Math.sin(t * 2) * 0.06;
  }

  // flash fx
  const I = flash.intensity;
  flashLight.intensity = I * 2600;
  puff.material.opacity = Math.max(0, puff.material.opacity - dt * 0.8);
  puff.scale.addScalar(dt * 14);
  bloom.strength = 0.35 + I * 3.2;
  renderer.toneMappingExposure = 1.0 + I * 2.6;
  camera.fov = 72 + I * 22;
  camera.updateProjectionMatrix();

  if (roundState === 'flashed') {
    flashTimer -= dt;
    if (flashTimer <= 0) { roundState = 'waiting'; setTimeout(startRound, 1500 + Math.random() * 2000); }
  }

  flash.update(dt);
  composer.render();
  setStats({ flashes: flashCount, flashIntensity: +flash.intensity.toFixed(3), roundState, ammo });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

bootScreen(['flsh.me', 'concept 03 / 05 — corridor 1v1', 'buy phase skipped. you hold mid.'], () => {
  started = true;
  ensureAudio(); startAmbience();
  window.__ready = true;
  setTimeout(startRound, 1200);
});
tick();
