import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ensureAudio, playFlashbang, playPin, playBounce, playBeep, playTick, setMuted, isMuted } from '/shared/audio.js';
import { galleryNav, soundToggle, setStats } from '/shared/ui.js';

galleryNav(); soundToggle(isMuted, setMuted);

// ---------- background 3D: wireframe flashbang on a green grid ----------
const canvas = document.getElementById('crt3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.useLegacyLights = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.05);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2.4, 7);

// grid
const grid = new THREE.GridHelper(40, 40, 0x1d5c2c, 0x0e3317);
scene.add(grid);
// wireframe nade
const wireMat = new THREE.MeshBasicMaterial({ color: 0x54ff7e, wireframe: true, transparent: true, opacity: 0.9 });
const nade = new THREE.Group();
nade.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), wireMat));
nade.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), wireMat));
nade.children[1].position.y = 0.45;
nade.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), wireMat));
nade.children[2].rotation.x = Math.PI / 2; nade.children[2].position.y = 0.5;
nade.position.y = 2;
scene.add(nade);
// explosion wire sphere (expands on detonation)
const burst = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xbaffc9, wireframe: true, transparent: true, opacity: 0 }));
burst.position.y = 2;
scene.add(burst);
const flashLight = new THREE.PointLight(0xaaffbb, 0, 40, 1.5);
flashLight.position.set(0, 2, 0);
scene.add(flashLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// green phosphor tint + vignette + chromatic aberration-ish via simple shader
const crtShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uFlash;
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      uv.x += sin(uv.y*40.0 + uTime*6.0) * 0.0015;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.35, 0.75, d) * 0.55;
      col += vec3(0.0, 0.12, 0.04) * (1.0 - d);
      col = mix(col, vec3(1.0), uFlash * 0.92);
      gl_FragColor = vec4(col, 1.0);
    }`
};
const crtPass = new ShaderPass(crtShader);
composer.addPass(crtPass);
composer.addPass(new OutputPass());

// ---------- terminal ----------
const content = document.getElementById('content');
const screenEl = document.getElementById('screen');
const bootEl = document.getElementById('boot');
const flashCountEl = document.getElementById('flashCount');
let lines = [];
let flashes = 0;
let booted = false;
let flashEnv = 0; // 0..1 for screen flash + shader

function print(txt, cls = '') {
  lines.push({ txt, cls });
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = txt;
  content.appendChild(d);
  while (content.children.length > 24) content.firstChild.remove();
  content.scrollTop = content.scrollHeight;
}

function boot() {
  if (booted) return;
  booted = true;
  ensureAudio();
  playBeep(660, 0.07);
  bootEl.style.transition = 'opacity .5s';
  bootEl.style.opacity = 0;
  setTimeout(() => bootEl.remove(), 600);
  const seq = [
    ['FLSH BIOS v1.6 — memory test: 640K OK', 'dim'],
    ['detecting flashbang .......... M67 FOUND', ''],
    ['loading de_flsh ............. OK', 'dim'],
    ['connecting to flsh.me ....... OK', 'dim'],
    ['', 'dim'],
    ['  ███████╗██╗     ███████╗██╗  ██╗', ''],
    ['  ██╔════╝██║     ██╔════╝██║  ██║', ''],
    ['  █████╗  ██║     ███████╗███████║', 'amber'],
    ['  ██╔══╝  ██║     ╚════██║██╔══██║', ''],
    ['  ██║     ███████╗███████║██║  ██║', ''],
    ['  ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝', ''],
    ['', 'dim'],
    ['> round start. you are CT. hold the angle.', ''],
    ['> enemy spotted: "the flasher".', 'red'],
    ['> type THROW (or press T) to counter-flash.', 'amber'],
    ['', 'dim'],
  ];
  let i = 0;
  const iv = setInterval(() => {
    if (i >= seq.length) { clearInterval(iv); prompt(); return; }
    print(seq[i][0], seq[i][1]);
    playTick(500 + i * 60, 0.03);
    i++;
  }, 130);
  window.__ready = true;
}
function prompt() { print('> _', 'blink'); }

function throwFlash() {
  if (!booted) return;
  flashes++;
  flashCountEl.textContent = 'flashes: ' + flashes;
  print('> THROW', 'amber');
  playPin();
  setTimeout(() => playBounce(0.3), 500);
  setTimeout(() => playBounce(0.22), 800);
  setTimeout(() => {
    print('> *FLASH*', 'red');
    playFlashbang(1);
    flashEnv = 1;
    screenEl.classList.add('flashing');
    burst.material.opacity = 0.95;
    burst.scale.setScalar(0.2);
    print('> screen luminance: 1000000 nits', 'red');
    print('> your vision: recovering...', 'dim');
    setTimeout(() => screenEl.classList.remove('flashing'), 260);
    setTimeout(prompt, 900);
  }, 1000);
}

bootEl.addEventListener('click', boot);
bootEl.addEventListener('keydown', boot);
addEventListener('keydown', e => {
  if (!booted) { boot(); return; }
  if (e.key === 't' || e.key === 'T' || e.key === ' ') { e.preventDefault(); throwFlash(); }
});
document.getElementById('throwKey').addEventListener('click', throwFlash);
addEventListener('pointerdown', e => {
  if (e.target instanceof Element && e.target.closest('a,button,.sound-btn')) return;
  if (!booted) { boot(); return; }
  throwFlash();
});

// ---------- loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  nade.rotation.y = t * 0.9;
  nade.position.y = 2 + Math.sin(t * 1.8) * 0.15;
  grid.position.y = Math.sin(t * 0.6) * 0.05;
  if (burst.material.opacity > 0) {
    burst.scale.addScalar(dt * 9);
    burst.material.opacity = Math.max(0, burst.material.opacity - dt * 0.55);
    burst.rotation.y += dt * 2; burst.rotation.x += dt * 1.3;
  }
  flashEnv = Math.max(0, flashEnv - dt * 0.55);
  flashLight.intensity = flashEnv * 300;
  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uFlash.value = flashEnv;
  camera.position.x = Math.sin(t * 0.2) * 1.2;
  camera.lookAt(0, 2, 0);
  composer.render();
  setStats({ flashes, flashEnv: +flashEnv.toFixed(3) });
}
tick();
