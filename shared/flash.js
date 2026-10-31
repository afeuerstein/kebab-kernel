// Shared flashbang state machine used by every site.
// Drives a full-screen white overlay (opacity via CSS var) + exposes
// intensity 0..1 to the 3D scene (camera exposure, shake, ringing).
export class FlashState {
  constructor() {
    this.overlay = null;
    this.intensity = 0;      // current perceived flash 0..1
    this.peak = 0;           // max since detonation
    this.t = 0;
    this.onFlash = [];
    this.elapsed = 0;
  }
  mount() {
    const el = document.createElement('div');
    el.id = 'flash-overlay';
    el.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:60;
      background:#fff; opacity:0; mix-blend-mode:screen;`;
    document.body.appendChild(el);
    this.overlay = el;
    return el;
  }
  detonate(strength = 1) {
    this.t = 0;
    this.peak = strength;
    this.elapsed = 0;
    this.onFlash.forEach(f => f(strength));
  }
  // call each frame with dt seconds. CS flash: instant white, then slow
  // exponential-ish recovery over ~4-7s, with a long faint tail.
  update(dt) {
    this.elapsed += dt;
    if (this.peak > 0) {
      const e = this.elapsed;
      // fast attack already applied; decay curve
      const decay = Math.exp(-e * 0.9) * 0.85 + Math.exp(-e * 0.28) * 0.35;
      this.intensity = Math.min(1, this.peak * Math.max(0, decay - 0.18));
      if (this.elapsed > 14) { this.peak = 0; this.intensity = 0; }
    } else {
      this.intensity = Math.max(0, this.intensity - dt * 0.5);
    }
    if (this.overlay) this.overlay.style.opacity = Math.min(1, this.intensity).toFixed(3);
  }
}
