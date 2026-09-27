// Fully synthesized positional audio (WebAudio). No sample files.
import * as THREE from 'three';

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    // reverb bus
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.6);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain).connect(this.master);
    // noise buffers
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.enabled = true;
    this.ambience();
  }

  impulse(dur, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections (street canyon slapback) + diffuse tail
        const er = (i % Math.floor(ctx.sampleRate * (0.031 + c * 0.007)) < 30) ? 0.6 * (1 - t) : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er * (Math.random() * 2 - 1)) * 0.5;
      }
    }
    return buf;
  }

  updateListener(cam) {
    if (!this.enabled) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.position.x, t, 0.01); L.positionY.setTargetAtTime(cam.position.y, t, 0.01); L.positionZ.setTargetAtTime(cam.position.z, t, 0.01);
      L.forwardX.setTargetAtTime(f.x, t, 0.01); L.forwardY.setTargetAtTime(f.y, t, 0.01); L.forwardZ.setTargetAtTime(f.z, t, 0.01);
      L.upX.setTargetAtTime(u.x, t, 0.01); L.upY.setTargetAtTime(u.y, t, 0.01); L.upZ.setTargetAtTime(u.z, t, 0.01);
    } else {
      L.setPosition(cam.position.x, cam.position.y, cam.position.z);
      L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    this.listenerPos = cam.position;
  }

  // output node: optionally positional
  out(pos, gain = 1, rev = 0.3) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = gain;
    let head = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.1; p.maxDistance = 400;
      p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); p.connect(this.master); head = g;
      // distance-dependent air absorption
      if (this.listenerPos) {
        const dist = this.listenerPos.distanceTo(pos);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(900, 18000 - dist * 260);
        lp.connect(g); head = lp;
        const s = ctx.createGain(); s.gain.value = rev * Math.min(1.5, 0.4 + dist / 40);
        g.connect(s).connect(this.reverb);
        return head;
      }
    } else {
      g.connect(this.master);
    }
    const s = ctx.createGain(); s.gain.value = rev;
    g.connect(s).connect(this.reverb);
    return head;
  }

  noiseSrc(buf = this.noise) {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    s.loopStart = 0; s.loopEnd = buf.duration;
    return s;
  }

  env(g, t, a, peak, dec, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + dec);
  }

  burst(dst, t, { type = 'bandpass', freq = 1000, q = 1, peak = 1, a = 0.001, dec = 0.1, buf, sweepTo } = {}) {
    const ctx = this.ctx;
    const n = this.noiseSrc(buf);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + a + dec);
    const g = ctx.createGain();
    this.env(g, t, a, peak, dec);
    n.connect(f).connect(g).connect(dst);
    n.start(t, Math.random() * 1.5); n.stop(t + a + dec + 0.05);
  }

  tone(dst, t, { type = 'sine', f0 = 100, f1 = 40, peak = 1, a = 0.002, dec = 0.15 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + dec);
    const g = ctx.createGain(); this.env(g, t, a, peak, dec);
    o.connect(g).connect(dst); o.start(t); o.stop(t + a + dec + 0.05);
  }

  // ------------------------------------------------------------- sounds
  gunshot() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime, p = 0.94 + Math.random() * 0.12;
    const o = this.out(null, 0.9, 0.55);
    this.burst(o, t, { type: 'highpass', freq: 2500 * p, q: 0.7, peak: 1.2, dec: 0.045 });
    this.burst(o, t, { type: 'bandpass', freq: 900 * p, q: 0.9, peak: 1.4, dec: 0.13, sweepTo: 300 });
    this.burst(o, t, { type: 'lowpass', freq: 400, q: 0.5, peak: 1.6, dec: 0.22, buf: this.brown });
    this.tone(o, t, { f0: 150 * p, f1: 38, peak: 1.3, dec: 0.16 });
    // mechanical clack
    this.burst(o, t + 0.03, { type: 'bandpass', freq: 3800, q: 6, peak: 0.25, dec: 0.02 });
    // distant slapback off buildings
    this.burst(o, t + 0.09, { type: 'bandpass', freq: 700, q: 0.8, peak: 0.35, dec: 0.25, sweepTo: 250 });
  }

  enemyShot(pos) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime, p = 0.85 + Math.random() * 0.15;
    const o = this.out(pos, 1.1, 0.7);
    this.burst(o, t, { type: 'highpass', freq: 2000 * p, q: 0.7, peak: 0.9, dec: 0.04 });
    this.burst(o, t, { type: 'bandpass', freq: 750 * p, q: 0.9, peak: 1.2, dec: 0.15, sweepTo: 250 });
    this.tone(o, t, { f0: 120 * p, f1: 35, peak: 1.0, dec: 0.15 });
  }

  whiz(pos) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.5, 0.05);
    this.burst(o, t, { type: 'bandpass', freq: 5000, q: 3, peak: 0.8, a: 0.03, dec: 0.12, sweepTo: 1500 });
    this.burst(o, t + 0.02, { type: 'highpass', freq: 6000, q: 1, peak: 0.4, dec: 0.02 }); // supersonic crack
  }

  impact(pos, surf) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.6, 0.2);
    if (surf === 'metal') {
      this.tone(o, t, { type: 'triangle', f0: 2200 + Math.random() * 1500, f1: 1800, peak: 0.3, dec: 0.25 });
      this.burst(o, t, { type: 'highpass', freq: 3000, peak: 0.5, dec: 0.03 });
    } else if (surf === 'wood') {
      this.burst(o, t, { type: 'bandpass', freq: 600, q: 2, peak: 0.8, dec: 0.08 });
    } else if (surf === 'flesh') {
      this.burst(o, t, { type: 'lowpass', freq: 500, peak: 1.0, dec: 0.08 });
    } else {
      this.burst(o, t, { type: 'bandpass', freq: 1800, q: 1.2, peak: 0.6, dec: 0.05 });
      this.burst(o, t + 0.01, { type: 'highpass', freq: 4000, peak: 0.2, dec: 0.12 }); // debris trickle
    }
  }

  shell(pos) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.25, 0.1);
    const f = 3500 + Math.random() * 2500;
    this.tone(o, t, { type: 'sine', f0: f, f1: f * 0.98, peak: 0.25, dec: 0.12 });
    this.tone(o, t, { type: 'sine', f0: f * 1.47, f1: f * 1.45, peak: 0.12, dec: 0.08 });
  }

  step(surf = 'concrete', sprint = false) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, sprint ? 0.32 : 0.2, 0.05);
    this.burst(o, t, { type: 'lowpass', freq: 380, peak: 0.9, dec: 0.07, buf: this.brown });
    this.burst(o, t + 0.005, { type: 'bandpass', freq: 2400 + Math.random() * 1500, q: 1.5, peak: surf === 'dirt' ? 0.35 : 0.18, dec: 0.05 });
    // gear rattle
    if (sprint && Math.random() < 0.6) this.burst(o, t + 0.02, { type: 'bandpass', freq: 5200, q: 4, peak: 0.08, dec: 0.04 });
  }

  click(freq = 3000, vol = 0.3, delay = 0) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const o = this.out(null, vol, 0.08);
    this.burst(o, t, { type: 'bandpass', freq, q: 5, peak: 1, dec: 0.025 });
    this.tone(o, t, { type: 'square', f0: freq * 0.3, f1: freq * 0.2, peak: 0.15, dec: 0.02 });
  }

  reload(dur) {
    this.click(1800, 0.35, 0.18);            // mag release
    this.click(900, 0.25, 0.26);             // mag slide out
    this.click(2400, 0.45, dur * 0.55);      // mag seat
    this.click(1400, 0.3, dur * 0.58);
    this.click(3200, 0.45, dur * 0.82);      // bolt release
    this.click(1100, 0.35, dur * 0.84);
  }

  dry() { this.click(4200, 0.35); }

  hitmarker(kill = false, head = false) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, kill ? 0.5 : 0.35, 0.02);
    this.tone(o, t, { type: 'square', f0: head ? 2600 : 2000, f1: head ? 2400 : 1800, peak: 0.25, dec: 0.03 });
    if (kill) this.tone(o, t + 0.04, { type: 'triangle', f0: 900, f1: 600, peak: 0.4, dec: 0.12 });
  }

  explosion(pos) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 2.4, 0.9);
    this.burst(o, t, { type: 'lowpass', freq: 3000, q: 0.5, peak: 1.6, dec: 0.5, sweepTo: 200 });
    this.burst(o, t, { type: 'lowpass', freq: 250, q: 0.7, peak: 2.2, dec: 1.8, buf: this.brown });
    this.tone(o, t, { f0: 70, f1: 22, peak: 2.0, dec: 0.9 });
    this.burst(o, t + 0.3, { type: 'highpass', freq: 3000, peak: 0.12, dec: 1.4 }); // debris rain
  }

  hurt() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.5, 0.05);
    this.tone(o, t, { f0: 90, f1: 45, peak: 0.8, dec: 0.15 });
    this.burst(o, t, { type: 'lowpass', freq: 800, peak: 0.6, dec: 0.1 });
  }

  heartbeat() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.45, 0);
    this.tone(o, t, { f0: 60, f1: 40, peak: 1, dec: 0.12 });
    this.tone(o, t + 0.18, { f0: 55, f1: 38, peak: 0.7, dec: 0.12 });
  }

  melee() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.5, 0.1);
    this.burst(o, t, { type: 'bandpass', freq: 1200, q: 1, peak: 0.6, a: 0.04, dec: 0.12, sweepTo: 400 });
  }

  ambience() {
    const ctx = this.ctx;
    // wind bed
    const n = this.noiseSrc(this.brown);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.18;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 250;
    lfo.connect(lg).connect(f.frequency);
    n.connect(f).connect(g).connect(this.master);
    n.start(); lfo.start();
    // distant battle: booms and gunfire bursts scheduled randomly
    const distant = () => {
      if (!this.enabled) return;
      const t = ctx.currentTime;
      const a = Math.random() * Math.PI * 2;
      const lp = this.listenerPos || new THREE.Vector3();
      const pos = new THREE.Vector3(lp.x + Math.cos(a) * 250, 20, lp.z + Math.sin(a) * 250);
      const o = this.out(pos, 6, 1.2);
      if (Math.random() < 0.35) {
        this.burst(o, t, { type: 'lowpass', freq: 300, peak: 1.4, dec: 1.6, buf: this.brown });
        this.tone(o, t, { f0: 55, f1: 25, peak: 1.0, dec: 1.0 });
      } else {
        const shots = 3 + Math.floor(Math.random() * 8), rate = 0.07 + Math.random() * 0.06;
        for (let i = 0; i < shots; i++) this.burst(o, t + i * rate, { type: 'bandpass', freq: 600, q: 0.8, peak: 0.9, dec: 0.12 });
      }
      setTimeout(distant, 1500 + Math.random() * 5000);
    };
    setTimeout(distant, 2000);
  }
}
