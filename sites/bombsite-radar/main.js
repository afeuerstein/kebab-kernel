import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ensureAudio, playFlashbang, playPin, playThrow, playBounce, playTick, setMuted, isMuted } from '/shared/audio.js';
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
scene.background = new THREE.Color(0x0a140d);
scene.fog = new THREE.FogExp2(0x0a140d, 0.035);

// top-down-ish tactical camera
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 26, 10);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x223c29, 1.0));
const sun = new THREE.DirectionalLight(0x9fe8b8, 6.0);
sun.position.set(8, 20, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
scene.add(sun);
const flashLight = new THREE.PointLight(0xffffff, 0, 60, 1.6);
scene.add(flashLight);

// ---------- bombsite map (top view), ~30x24m ----------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5240, roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
// ground grid paint (site markings)
function paint(w, h, color, x, z, ry = 0, op = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
  m.position.set(x, 0.02, z);
  scene.add(m); return m;
}
paint(6, 6, 0xff5d3a, -8, -6);           // site A circle-ish square
paint(6, 6, 0xff5d3a, 8, 6, 0, 0.35);     // site B
paint(30, 0.25, 0xcfe3c8, 0, 0, 0, 0.35); // mid line
paint(0.25, 20, 0xcfe3c8, 0, 0, 0, 0.25);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x5f7057, roughness: 0.85 });
function wall(w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
}
// outer walls
wall(34, 3, 0.6, 0, 1.5, -13); wall(34, 3, 0.6, 0, 1.5, 13);
wall(0.6, 3, 26, -17, 1.5, 0); wall(0.6, 3, 26, 17, 1.5, 0);
// site A structure
wall(8, 3, 0.6, -8, 1.5, -9); wall(0.6, 3, 6, -12, 1.5, -6); wall(0.6, 3, 6, -4, 1.5, -6);
wall(5, 3, 0.6, -8, 1.5, -3, );
// site B structure
wall(8, 3, 0.6, 8, 1.5, 9); wall(0.6, 3, 6, 4, 1.5, 6); wall(0.6, 3, 6, 12, 1.5, 6);
// mid doors
wall(4, 3, 0.6, -3, 1.5, 0); wall(4, 3, 0.6, 3, 1.5, 0);
// long corridor walls
wall(0.6, 3, 12, -14, 1.5, 6); wall(0.6, 3, 12, -10, 1.5, 6);
// crates
const crateMat = new THREE.MeshStandardMaterial({ color: 0x77633e, roughness: 0.9 });
function crate(x, z, s = 1.4) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
  m.position.set(x, s / 2, z); m.rotation.y = Math.random() * 0.6;
  m.castShadow = m.receiveShadow = true; scene.add(m);
}
[[-6, -5], [-10, -7], [6, 7], [10, 5], [0, -3], [-1, 3], [2, 8], [-5, 0]].forEach(([x, z]) => crate(x, z));

// ---------- player markers (dots with team colors) ----------
const markers = [];
function marker(x, z, color, label) {
  const g = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
  dot.rotation.x = -Math.PI / 2; dot.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  g.add(dot, ring);
  g.position.set(x, 0, z);
  scene.add(g);
  markers.push({ g, ring, label, base: color });
  return g;
}
// CT (blue) and T (orange)
marker(-8, -7.5, 0x4da3ff, 'CT'); marker(-9.5, -5, 0x4da3ff); marker(-6.5, -5.2, 0x4da3ff);
marker(8, 7.5, 0xff9a3d, 'T'); marker(9.5, 5.5, 0xff9a3d);

// ---------- the flashbang, flying ----------
const nade = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 20),
  new THREE.MeshStandardMaterial({ color: 0x3d4a3a, metalness: 0.75, roughness: 0.45 }));
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.12, 20),
  new THREE.MeshStandardMaterial({ color: 0x8a2f22, metalness: 0.4, roughness: 0.5 }));
band.position.y = 0.13;
nade.add(body, band);
nade.position.set(0, 1, 0);
scene.add(nade);

// shockwave rings on ground
const rings = [];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.07;
  scene.add(r); rings.push(r);
}

// radar sweep line (thin bright plane rotating)
const sweep = new THREE.Mesh(new THREE.PlaneGeometry(34, 1.4),
  new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
sweep.rotation.x = -Math.PI / 2; sweep.position.y = 0.09;
scene.add(sweep);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 0.75);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- game logic ----------
let thrown = 0;
let flying = null;
let started = false;
const feedEl = document.getElementById('feed');
const timerEl = document.getElementById('timer');
let roundTime = 115;

function feed(msg, cls) {
  const d = document.createElement('div');
  d.className = 'f ' + cls; d.textContent = msg;
  feedEl.prepend(d);
  requestAnimationFrame(() => d.classList.add('show'));
  while (feedEl.children.length > 6) feedEl.lastChild.remove();
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); }, 4200);
}

function detonate() {
  thrown++;
  flash.detonate(1);
  playFlashbang(1);
  flashLight.position.copy(nade.position);
  rings.forEach((r, i) => {
    r.position.x = nade.position.x; r.position.z = nade.position.z;
    r.material.opacity = 0.85 - i * 0.25;
    r.scale.setScalar(0.4);
    r.userData.delay = i * 0.12;
  });
  // enemy markers "flashed" -> blink white
  markers.forEach(m => { m.flashed = 6 + Math.random() * 3; });
  feed('FLASHBANG DETONATED — site A', 'foe');
  setTimeout(() => feed('5 enemies flashed', 'foe'), 300);
}

function throwNade() {
  if (flying || !started) return;
  ensureAudio(); playPin();
  setTimeout(() => playThrow(), 200);
  const from = new THREE.Vector3(-14, 3, 8);
  const to = new THREE.Vector3(-8, 0.3, -6); // lands on site A
  flying = { t: 0, from, to };
  nade.position.copy(from);
  nade.visible = true;
}

addEventListener('pointerdown', e => {
  ensureAudio();
  if (e.target instanceof Element && e.target.closest('a,.sound-btn')) return;
  if (started) throwNade();
});
addEventListener('keydown', e => {
  if ((e.key === 'f' || e.key === 'F' || e.key === ' ') && started) { e.preventDefault(); ensureAudio(); throwNade(); }
});
document.getElementById('throwBtn').addEventListener('click', e => { e.stopPropagation(); ensureAudio(); if (started) throwNade(); });

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // sweep
  sweep.rotation.z = t * 0.7;

  // camera slow drift
  camera.position.x = Math.sin(t * 0.11) * 2.5;
  camera.position.y = 26 + Math.sin(t * 0.17) * 1.2;
  camera.lookAt(0, 0, 0);

  // nade flight (parabola, with bounces)
  if (flying) {
    flying.t += dt * 0.55;
    const a = Math.min(flying.t, 1);
    nade.position.lerpVectors(flying.from, flying.to, a);
    nade.position.y = Math.sin(a * Math.PI) * 4 + 0.3;
    nade.rotation.x += dt * 10; nade.rotation.z += dt * 8;
    if (Math.sin(a * Math.PI) * 4 + 0.3 < 0.45 && a > 0.4 && !flying.bounced) {
      flying.bounced = true; playBounce();
    }
    if (a >= 1) { flying = null; playBounce(0.4); detonate(); setTimeout(() => { nade.position.set(0, -5, 0); }, 2500); }
  } else {
    nade.position.y = -5; // hidden
  }

  // flash light & rings
  const I = flash.intensity;
  flashLight.intensity = I * 1400;
  bloom.strength = 0.7 + I * 2.8;
  renderer.toneMappingExposure = 1.0 + I * 2.2;
  rings.forEach(r => {
    if (r.material.opacity > 0) {
      if (r.userData.delay > 0) { r.userData.delay -= dt; return; }
      r.scale.addScalar(dt * 30);
      r.material.opacity = Math.max(0, r.material.opacity - dt * 1.2);
    }
  });
  // flashed markers blink
  markers.forEach(m => {
    if (m.flashed > 0) {
      m.flashed -= dt;
      const blink = (Math.sin(t * 22) > 0) ? 0xffffff : m.base;
      m.g.children[0].material.color.setHex(blink);
      m.g.children[1].material.color.setHex(blink);
      if (m.flashed <= 0) { m.g.children[0].material.color.setHex(m.base); m.g.children[1].material.color.setHex(m.base); }
    }
    m.ring.scale.setScalar(1 + Math.sin(t * 3 + m.g.position.x) * 0.12);
  });

  // round timer
  if (started) {
    roundTime -= dt;
    if (roundTime < 0) roundTime = 115;
    const m = Math.floor(roundTime / 60), s = Math.floor(roundTime % 60);
    timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  flash.update(dt);
  composer.render();
  setStats({ flashes: thrown, flashIntensity: +flash.intensity.toFixed(3) });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

bootScreen(['flsh.me', 'concept 02 / 05 — bombsite radar', 'connecting to de_flsh…'], () => {
  started = true;
  ensureAudio(); playTick(880);
  feed('connected · de_flsh · 5v5', 'me');
  setTimeout(() => feed('you are spectating CT', 'me'), 900);
  window.__ready = true;
});
tick();
