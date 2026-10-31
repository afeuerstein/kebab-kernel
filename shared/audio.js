// Procedural WebAudio: no audio files needed. All CS-flavored.
let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 22; comp.ratio.value = 8;
  comp.attack.value = 0.002; comp.release.value = 0.24;
  master.connect(comp).connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}
export function isMuted() { return muted; }

function env(node, t0, a, peak, d, sustain = 0.0001, r = 0.1) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
}

// The flashbang detonation: bright noise crack -> low boom -> tinnitus ring
export function playFlashbang(intensity = 1) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  // crack: short bright noise burst with fast highpass sweep
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
  hp.frequency.setValueAtTime(4000, t0);
  hp.frequency.exponentialRampToValueAtTime(300, t0 + 0.09);
  const g = ctx.createGain();
  env(g, t0, 0.001, 1.15 * intensity, 0.12, 0.0001, 0.25);
  src.connect(hp).connect(g).connect(master);
  src.start(t0); src.stop(t0 + 0.5);
  // body: lowpassed noise thump
  const src2 = ctx.createBufferSource(); src2.buffer = noiseBuf; src2.playbackRate.value = 0.4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g2 = ctx.createGain();
  env(g2, t0, 0.004, 0.9 * intensity, 0.5, 0.0001, 0.6);
  src2.connect(lp).connect(g2).connect(master);
  src2.start(t0); src2.stop(t0 + 1.4);
  // boom sine drop
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(160, t0);
  o.frequency.exponentialRampToValueAtTime(38, t0 + 0.7);
  const g3 = ctx.createGain();
  env(g3, t0, 0.003, 0.85 * intensity, 0.8, 0.0001, 0.9);
  o.connect(g3).connect(master);
  o.start(t0); o.stop(t0 + 1.8);
  // tinnitus: decaying high ring, fades over ~6-10s (the "flashbang ringing")
  const ring = ctx.createOscillator(); ring.type = 'sine'; ring.frequency.value = 8200 + Math.random() * 600;
  const ring2 = ctx.createOscillator(); ring2.type = 'triangle'; ring2.frequency.value = 12400;
  const g4 = ctx.createGain();
  const t1 = t0 + 0.05;
  g4.gain.setValueAtTime(0.0001, t1);
  g4.gain.linearRampToValueAtTime(0.055 * intensity, t1 + 0.08);
  g4.gain.exponentialRampToValueAtTime(0.0001, t1 + 7 + Math.random() * 3);
  ring.connect(g4); ring2.connect(g4); g4.connect(master);
  ring.start(t1); ring.stop(t1 + 11); ring2.start(t1); ring2.stop(t1 + 11);
}

// Grenade pin pull
export function playPin() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1900;
  const g = ctx.createGain(); env(g, t0, 0.001, 0.12, 0.05, 0.0001, 0.03);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.15);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
  const g2 = ctx.createGain(); env(g2, t0 + 0.02, 0.001, 0.2, 0.03, 0.0001, 0.02);
  src.connect(bp).connect(g2).connect(master); src.start(t0); src.stop(t0 + 0.1);
}

export function playThrow() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(600, t0);
  bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.35);
  const g = ctx.createGain(); env(g, t0, 0.01, 0.16, 0.4, 0.0001, 0.15);
  src.connect(bp).connect(g).connect(master); src.start(t0); src.stop(t0 + 0.7);
}

// Rifle shot (for the corridor scene)
export function playShot() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(5200, t0);
  lp.frequency.exponentialRampToValueAtTime(400, t0 + 0.12);
  const g = ctx.createGain(); env(g, t0, 0.001, 0.9, 0.1, 0.0001, 0.1);
  src.connect(lp).connect(g).connect(master); src.start(t0); src.stop(t0 + 0.3);
  const o = ctx.createOscillator(); o.type = 'square';
  o.frequency.setValueAtTime(220, t0);
  o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
  const g2 = ctx.createGain(); env(g2, t0, 0.001, 0.35, 0.09, 0.0001, 0.06);
  o.connect(g2).connect(master); o.start(t0); o.stop(t0 + 0.2);
}

// Grenade bounce tick
export function playBounce(vol = 0.25) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(300 + Math.random() * 120, t0);
  o.frequency.exponentialRampToValueAtTime(90, t0 + 0.07);
  const g = ctx.createGain(); env(g, t0, 0.001, vol, 0.08, 0.0001, 0.05);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
}

// Retro boot beep
export function playBeep(f = 880, dur = 0.09, vol = 0.12) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = ctx.createGain(); env(g, t0, 0.002, vol, dur, 0.0001, 0.03);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.1);
}

// UI tick
export function playTick(f = 1200, vol = 0.06) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = ctx.createGain(); env(g, t0, 0.001, vol, 0.03, 0.0001, 0.02);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.08);
}

// Ambient wind/hum loop for scenes
export function startAmbience() {
  if (!ctx || muted) return null;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = 0.3;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
  const g = ctx.createGain(); g.gain.value = 0.0;
  g.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 90;
  lfo.connect(lfoG).connect(lp.frequency);
  src.connect(lp).connect(g).connect(master);
  src.start(); lfo.start();
  return { stop() { try { src.stop(); lfo.stop(); } catch {} } };
}
