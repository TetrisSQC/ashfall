// Procedural PBR texture generation. Every map is tileable and produced at load time
// on a 2D canvas: albedo (sRGB), tangent-space normal (derived from a height field)
// and roughness. Cavity occlusion is baked into albedo.
import * as THREE from 'three';

// ---------------------------------------------------------------- noise primitives
function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// tileable value noise, period in lattice cells
function vnoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// fractal noise on the unit square, tileable. freq = integer base frequency
export function fbm(u, v, freq, oct = 5, seed = 1, gain = 0.5) {
  let sum = 0, amp = 0.5, norm = 0, f = freq;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(u * f, v * f, f, seed + i * 17) * amp;
    norm += amp; amp *= gain; f *= 2;
  }
  return sum / norm;
}

// anisotropic fbm (different x/y frequencies), still tileable
function fbmA(u, v, fx, fy, oct, seed) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) {
    const px = fx << i, py = fy << i;
    sum += vnoise2(u * px, v * py, px, py, seed + i * 31) * amp;
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}
function vnoise2(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
  const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// tileable worley: returns [F1, F2, cellHash]
const _w = [0, 0, 0];
function worley(u, v, n, seed) {
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const px = cx + hash2(wx, wy, seed), py = cy + hash2(wx, wy, seed + 7);
    const dx = px - x, dy = py - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; id = hash2(wx, wy, seed + 13); } else if (d < f2) f2 = d;
  }
  _w[0] = f1; _w[1] = f2; _w[2] = id;
  return _w;
}

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- map builder
let maxAniso = 8;
export function setAnisotropy(a) { maxAniso = a; }

function build(size, fn, { normal = 2.0, repeat = 1, cavity = 0.6 } = {}) {
  const N = size * size;
  const col = new Float32Array(N * 3);
  const hgt = new Float32Array(N);
  const rgh = new Float32Array(N);
  const met = new Float32Array(N);
  const o = { r: 0, g: 0, b: 0, h: 0, rough: 0.8, metal: 0 };
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      o.metal = 0;
      fn(u, v, o);
      const i = y * size + x;
      col[i * 3] = o.r; col[i * 3 + 1] = o.g; col[i * 3 + 2] = o.b;
      hgt[i] = o.h; rgh[i] = o.rough; met[i] = o.metal;
    }
  }
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const cA = mk(), cN = mk(), cR = mk();
  const ctxA = cA.getContext('2d'), ctxN = cN.getContext('2d'), ctxR = cR.getContext('2d');
  const iA = ctxA.createImageData(size, size), iN = ctxN.createImageData(size, size), iR = ctxR.createImageData(size, size);
  const s = normal * size / 256;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size, yp = ((y + 1) % size) * size, yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const i = yc + x;
      const dhdu = (hgt[yc + xp] - hgt[yc + xm]) * 0.5 * s;
      const dhdv = (hgt[ym + x] - hgt[yp + x]) * 0.5 * s;
      let nx = -dhdu, ny = -dhdv, nz = 1;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nx *= l; ny *= l; nz *= l;
      const p = i * 4;
      iN.data[p] = (nx * 0.5 + 0.5) * 255; iN.data[p + 1] = (ny * 0.5 + 0.5) * 255; iN.data[p + 2] = (nz * 0.5 + 0.5) * 255; iN.data[p + 3] = 255;
      // cavity: compare with local average (cheap 4-tap laplacian)
      const avg = (hgt[yc + xp] + hgt[yc + xm] + hgt[ym + x] + hgt[yp + x]) * 0.25;
      const cav = clamp(1 + (hgt[i] - avg) * cavity * size * 0.25, 0.55, 1.1);
      iA.data[p] = clamp(col[i * 3] * cav) * 255; iA.data[p + 1] = clamp(col[i * 3 + 1] * cav) * 255; iA.data[p + 2] = clamp(col[i * 3 + 2] * cav) * 255; iA.data[p + 3] = 255;
      iR.data[p] = met[i] * 255; iR.data[p + 1] = clamp(rgh[i]) * 255; iR.data[p + 2] = met[i] * 255; iR.data[p + 3] = 255;
    }
  }
  ctxA.putImageData(iA, 0, 0); ctxN.putImageData(iN, 0, 0); ctxR.putImageData(iR, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.repeat.set(repeat, repeat);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: tex(cA, true), normalMap: tex(cN, false), roughnessMap: tex(cR, false), metalnessMap: tex(cR, false) };
}

// sRGB 0-255 helpers -> linear-ish working values in 0..1 (we write sRGB into the canvas)
const C = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

// ---------------------------------------------------------------- materials
export const Gen = {
  // sidewalk slabs: 2x2 slabs per tile
  sidewalk(size = 1024) {
    return build(size, (u, v, o) => {
      const su = u * 2, sv = v * 2;
      const fu = su - Math.floor(su), fv = sv - Math.floor(sv);
      const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
      const seam = smooth(0.004, 0.018, edge);
      const slab = hash2(Math.floor(su), Math.floor(sv), 3);
      const n = fbm(u, v, 8, 6, 11);
      const fine = fbm(u, v, 64, 3, 5);
      const w = worley(u, v, 90, 9);
      const pit = w[0] < 0.12 ? (0.12 - w[0]) * 3 : 0;
      const stain = smooth(0.45, 0.8, fbm(u, v, 3, 5, 21));
      const g = 0.44 + (slab - 0.5) * 0.08 + (n - 0.5) * 0.18 + (fine - 0.5) * 0.08 - stain * 0.18;
      o.r = g * 0.99; o.g = g * 0.97; o.b = g * 0.93;
      o.h = seam * (0.7 + n * 0.25 + fine * 0.08) - pit * 0.6 + (1 - seam) * 0.0;
      o.rough = 0.82 + fine * 0.12 - stain * 0.1 + (1 - seam) * 0.06;
    }, { normal: 3.2, cavity: 0.9 });
  },

  concreteWall(size = 1024, tint = 0xb8b2a6) {
    const t = C(tint);
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 6, 6, 41);
      const fine = fbm(u, v, 48, 3, 43);
      const streak = fbmA(u, v, 24, 2, 4, 47);
      const w = worley(u, v, 60, 51);
      const pit = w[0] < 0.1 ? (0.1 - w[0]) * 4 : 0;
      // formwork panel lines + tie holes
      const pv = v * 4;
      const fpv = pv - Math.floor(pv);
      const line = smooth(0.0, 0.01, Math.min(fpv, 1 - fpv));
      const hu = (u * 4) % 1, hv = (v * 4 + 0.5) % 1;
      const hole = Math.hypot(hu - 0.5, hv - 0.5) < 0.025 ? 1 : 0;
      const dirt = smooth(0.35, 0.9, streak) * (0.4 + 0.6 * smooth(0.3, 0.7, n));
      const g = 0.85 + (n - 0.5) * 0.3 + (fine - 0.5) * 0.08 - dirt * 0.35 - hole * 0.5;
      o.r = t[0] * g; o.g = t[1] * g; o.b = t[2] * g;
      o.h = n * 0.3 + fine * 0.1 - pit * 0.5 - (1 - line) * 0.3 - hole * 0.6;
      o.rough = 0.86 + fine * 0.1 - dirt * 0.08;
    }, { normal: 2.4, cavity: 0.8 });
  },

  asphalt(size = 1024) {
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 4, 6, 61);
      const w = worley(u, v, 180, 63);
      const grain = w[1] - w[0];
      const stone = smooth(0.02, 0.12, grain);
      const shade = w[2];
      const crackN = fbm(u, v, 5, 6, 67);
      const crack = 1 - smooth(0.0, 0.012, Math.abs(crackN - 0.5));
      const crackMask = smooth(0.45, 0.65, fbm(u, v, 3, 3, 69));
      const cr = crack * crackMask;
      const patch = smooth(0.62, 0.64, fbm(u, v, 2, 3, 71));
      const pN = fbm(u, v, 2, 5, 73);
      const puddle = smooth(0.7, 0.73, pN);
      const wet = smooth(0.6, 0.7, pN);
      let g = 0.16 + (n - 0.5) * 0.06 + stone * (0.05 + shade * 0.12) - patch * 0.04;
      g *= 1 - cr * 0.7;
      g *= 1 - wet * 0.3;
      o.r = g * 1.0; o.g = g * 0.99; o.b = g * 0.97;
      o.h = stone * 0.25 + n * 0.2 - cr * 0.8 + patch * 0.05 - puddle * stone * 0.25;
      o.rough = mix(mix(0.8 + (1 - stone) * 0.12, 0.45, wet), 0.05, puddle) + cr * 0.1;
    }, { normal: 2.2, cavity: 0.7 });
  },

  brick(size = 1024, base = 0x8a4b36) {
    const bc = C(base);
    const rows = 16, cols = 4;
    return build(size, (u, v, o) => {
      const rv = v * rows;
      const row = Math.floor(rv);
      const off = (row % 2) * 0.5;
      const cu = u * cols + off;
      const col = Math.floor(cu);
      const fu = cu - col, fv = rv - row;
      const mortarW = 0.035, mortarH = 0.12;
      const eu = Math.min(fu, 1 - fu), ev = Math.min(fv, 1 - fv);
      const inBrick = smooth(mortarW * 0.5, mortarW, eu) * smooth(mortarH * 0.5, mortarH, ev);
      const id = hash2(((col % cols) + cols) % cols, row, 91);
      const id2 = hash2(((col % cols) + cols) % cols, row, 97);
      const n = fbm(u, v, 16, 5, 93);
      const fine = fbm(u, v, 96, 2, 95);
      const soot = smooth(0.4, 0.85, fbmA(u, v, 6, 2, 5, 99));
      const chip = smooth(0.72, 0.78, fbm(u, v, 24, 4, 101)) * inBrick;
      const bright = 0.75 + id * 0.45 - (id2 > 0.88 ? 0.35 : 0);
      let r = bc[0] * bright, g = bc[1] * bright * (0.92 + id2 * 0.16), b = bc[2] * bright;
      const m = 0.62 + (n - 0.5) * 0.2;
      r = mix(m, r, inBrick); g = mix(m * 0.97, g, inBrick); b = mix(m * 0.9, b, inBrick);
      const k = (1 - soot * 0.55) * (0.9 + fine * 0.2) * (1 - chip * 0.25);
      o.r = r * k; o.g = g * k; o.b = b * k;
      o.h = inBrick * (0.55 + n * 0.25 + fine * 0.1) - chip * 0.3;
      o.rough = mix(0.95, 0.8 + fine * 0.1, inBrick);
    }, { normal: 3.0, cavity: 0.8 });
  },

  plaster(size = 1024, base = 0xc9b79a) {
    const bc = C(base);
    const brick = C(0x7a5646);
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 8, 6, 111);
      const fine = fbm(u, v, 80, 3, 113);
      const streak = fbmA(u, v, 30, 3, 4, 117);
      const chipN = fbm(u, v, 6, 6, 119);
      const chip = smooth(0.765, 0.775, chipN);
      const chipEdge = smooth(0.745, 0.765, chipN) - chip;
      const grime = smooth(0.35, 1.0, streak) * smooth(0.2, 0.9, v * 0.4 + n * 0.6);
      const k = 0.9 + (n - 0.5) * 0.18 + (fine - 0.5) * 0.08 - grime * 0.4;
      // exposed brick under chipped plaster
      const rv = v * 24, row = Math.floor(rv), cu = u * 6 + (row % 2) * 0.5;
      const fb = Math.min(cu % 1, 1 - (cu % 1)) > 0.04 && Math.min(rv % 1, 1 - (rv % 1)) > 0.1 ? 1 : 0;
      const br = mix(0.55, 1, fb);
      o.r = mix(bc[0] * k, brick[0] * br * 0.85, chip);
      o.g = mix(bc[1] * k, brick[1] * br * 0.85, chip);
      o.b = mix(bc[2] * k, brick[2] * br * 0.85, chip);
      o.r *= 1 - chipEdge * 0.25; o.g *= 1 - chipEdge * 0.25; o.b *= 1 - chipEdge * 0.25;
      o.h = (1 - chip) * (0.6 + fine * 0.12 + n * 0.1) + chip * fb * 0.25;
      o.rough = 0.9 + fine * 0.08;
    }, { normal: 2.6, cavity: 0.9 });
  },

  corrugated(size = 512, base = 0x3d5a4a) {
    const bc = C(base);
    const rust = C(0x5e4130);
    return build(size, (u, v, o) => {
      const ridge = Math.sin(u * Math.PI * 2 * 12);
      const n = fbm(u, v, 6, 6, 131);
      const fine = fbm(u, v, 64, 3, 133);
      const rustM = smooth(0.7, 0.85, fbm(u, v, 5, 6, 137) + (1 - v) * 0.12 * fbmA(u, v, 16, 2, 3, 139));
      const scratch = smooth(0.985, 1, fbmA(u, v, 2, 64, 3, 141));
      const streak = smooth(0.5, 0.9, fbmA(u, v, 32, 2, 3, 143));
      const pk = (0.9 + (n - 0.5) * 0.2 - streak * 0.2);
      const rk = 0.7 + fine * 0.5;
      o.r = mix(bc[0] * pk, rust[0] * rk, rustM) + scratch * 0.25;
      o.g = mix(bc[1] * pk, rust[1] * rk, rustM) + scratch * 0.25;
      o.b = mix(bc[2] * pk, rust[2] * rk, rustM) + scratch * 0.25;
      o.h = ridge * 0.5 + 0.5 + rustM * fine * 0.25;
      o.rough = mix(0.55 + fine * 0.15, 0.92, rustM) - scratch * 0.2;
      o.metal = mix(0.25, 0.0, rustM) + scratch * 0.6;
    }, { normal: 1.4, cavity: 0.3 });
  },

  wood(size = 512, base = 0x8b6a45) {
    const bc = C(base);
    return build(size, (u, v, o) => {
      const planks = 5;
      const pv = v * planks, pi = Math.floor(pv), fv = pv - pi;
      const gap = smooth(0.0, 0.04, Math.min(fv, 1 - fv));
      const id = hash2(pi, 0, 151);
      const grain = fbmA(u + id, v, 2, 48, 5, 153 + pi);
      const ring = Math.sin((grain * 12 + fv * 3) * Math.PI) * 0.5 + 0.5;
      const knotW = worley(u, v, 5, 155);
      const knot = smooth(0.08, 0.0, knotW[0]);
      const dirt = smooth(0.5, 0.9, fbm(u, v, 4, 5, 157));
      const k = (0.75 + id * 0.35) * (0.85 + ring * 0.2) * (1 - knot * 0.5) * (1 - dirt * 0.3);
      o.r = bc[0] * k; o.g = bc[1] * k; o.b = bc[2] * k;
      o.r *= mix(0.3, 1, gap); o.g *= mix(0.3, 1, gap); o.b *= mix(0.3, 1, gap);
      o.h = gap * (0.6 + ring * 0.1) - knot * 0.1;
      o.rough = 0.8 + ring * 0.1;
    }, { normal: 2.5, cavity: 0.6 });
  },

  cloth(size = 512, base = 0x8f7f5c) {
    const bc = C(base);
    return build(size, (u, v, o) => {
      const f = 160;
      const wu = Math.sin(u * Math.PI * 2 * f), wv = Math.sin(v * Math.PI * 2 * f);
      const weave = (Math.sin(u * Math.PI * 2 * f) > 0) === (Math.sin(v * Math.PI * 2 * f) > 0) ? wu : wv;
      const n = fbm(u, v, 6, 6, 171);
      const dirt = smooth(0.4, 0.9, fbm(u, v, 3, 5, 173));
      const k = 0.85 + weave * 0.08 + (n - 0.5) * 0.25 - dirt * 0.35;
      o.r = bc[0] * k; o.g = bc[1] * k; o.b = bc[2] * k;
      o.h = weave * 0.15 + n * 0.6;
      o.rough = 0.95;
    }, { normal: 2.5, cavity: 0.5 });
  },

  dirt(size = 1024) {
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 6, 7, 181);
      const w = worley(u, v, 40, 183);
      const rock = smooth(0.18, 0.05, w[0]) * smooth(0.45, 0.7, fbm(u, v, 4, 4, 185));
      const w2 = worley(u, v, 140, 187);
      const pebble = smooth(0.2, 0.05, w2[0]);
      const dark = smooth(0.4, 0.8, fbm(u, v, 3, 5, 189));
      const g = 0.42 + (n - 0.5) * 0.3 - dark * 0.12;
      const rr = 0.5 + w[2] * 0.2;
      o.r = mix(mix(g * 1.0, g * 0.9 + 0.05, pebble * 0.5), rr, rock);
      o.g = mix(mix(g * 0.86, g * 0.84 + 0.05, pebble * 0.5), rr * 0.96, rock);
      o.b = mix(mix(g * 0.68, g * 0.75 + 0.05, pebble * 0.5), rr * 0.9, rock);
      o.h = n * 0.5 + rock * 0.8 + pebble * 0.2;
      o.rough = 0.95 - rock * 0.1;
    }, { normal: 3.0, cavity: 0.8 });
  },

  carPaint(size = 512, base = 0x6b6f5e) {
    const bc = C(base);
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 4, 5, 191);
      const dust = smooth(0.35, 0.8, fbm(u, v, 5, 6, 193));
      const rust = smooth(0.7, 0.78, fbm(u, v, 6, 6, 197));
      const scratch = smooth(0.975, 1, fbmA(u, v, 64, 3, 3, 199)) + smooth(0.98, 1, fbmA(u, v, 3, 64, 3, 201));
      const k = 0.9 + (n - 0.5) * 0.1;
      o.r = mix(mix(bc[0] * k, 0.45, dust * 0.6), 0.38, rust) + scratch * 0.2;
      o.g = mix(mix(bc[1] * k, 0.4, dust * 0.6), 0.2, rust) + scratch * 0.2;
      o.b = mix(mix(bc[2] * k, 0.33, dust * 0.6), 0.1, rust) + scratch * 0.2;
      o.h = rust * fbm(u, v, 40, 3, 203) * 0.8 - scratch * 0.2;
      o.rough = mix(mix(0.32, 0.85, dust), 0.95, rust);
      o.metal = mix(0.4, 0.0, Math.max(dust, rust)) + scratch * 0.5;
    }, { normal: 2.0, cavity: 0.4 });
  },

  camo(size = 512) {
    const cols = [C(0x6d6b4e), C(0x4b4a35), C(0x8a7d5c), C(0x2f2e24)];
    return build(size, (u, v, o) => {
      const a = fbm(u, v, 4, 5, 211), b = fbm(u, v, 6, 5, 213), c = fbm(u, v, 8, 4, 217);
      let k = cols[0];
      if (a > 0.55) k = cols[1];
      if (b > 0.6) k = cols[2];
      if (c > 0.62) k = cols[3];
      const f = 160;
      const weave = Math.sin(u * Math.PI * 2 * f) * Math.sin(v * Math.PI * 2 * f);
      const n = fbm(u, v, 32, 3, 219);
      const s = 0.9 + weave * 0.05 + (n - 0.5) * 0.15;
      o.r = k[0] * s; o.g = k[1] * s; o.b = k[2] * s;
      o.h = weave * 0.2 + fbm(u, v, 5, 5, 221) * 0.8;
      o.rough = 0.95;
    }, { normal: 2.0, cavity: 0.4 });
  },

  gunMetal(size = 256, base = 0x2a2b2d, roughBase = 0.45) {
    const bc = C(base);
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 8, 5, 231);
      const fine = fbm(u, v, 64, 3, 233);
      const wear = smooth(0.7, 0.85, fbm(u, v, 5, 5, 237));
      const k = 0.9 + (n - 0.5) * 0.2;
      o.r = mix(bc[0] * k, 0.55, wear * 0.5); o.g = mix(bc[1] * k, 0.55, wear * 0.5); o.b = mix(bc[2] * k, 0.55, wear * 0.5);
      o.h = fine * 0.15 + n * 0.1;
      o.rough = roughBase + fine * 0.15 - wear * 0.15;
      o.metal = 0.5 + wear * 0.5;
    }, { normal: 0.8, cavity: 0.2 });
  },

  polymer(size = 256, base = 0x2b2a27) {
    const bc = C(base);
    return build(size, (u, v, o) => {
      const stipple = fbm(u, v, 96, 2, 241);
      const n = fbm(u, v, 6, 4, 243);
      const k = 0.92 + (n - 0.5) * 0.15;
      o.r = bc[0] * k; o.g = bc[1] * k; o.b = bc[2] * k;
      o.h = stipple * 0.5;
      o.rough = 0.62 + stipple * 0.2;
    }, { normal: 1.5, cavity: 0.2 });
  },

  roof(size = 512) {
    return build(size, (u, v, o) => {
      const n = fbm(u, v, 5, 6, 251);
      const fine = fbm(u, v, 80, 3, 253);
      const g = 0.25 + (n - 0.5) * 0.12 + fine * 0.05;
      o.r = g; o.g = g * 0.98; o.b = g * 0.95;
      o.h = fine * 0.5 + n * 0.3;
      o.rough = 0.9;
    }, { normal: 2.0 });
  },
};

// ---------------------------------------------------------------- sprites / small canvases
function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export function spriteTex(kind) {
  let c;
  if (kind === 'smoke') {
    c = canvas(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const d = Math.hypot(u - 0.5, v - 0.5) * 2;
        const n = fbm(u, v, 4, 5, 301);
        const a = clamp((1 - d) * 1.6 - (1 - n) * 0.9) ;
        const p = (y * w + x) * 4;
        const s = 200 + n * 55;
        img.data[p] = s; img.data[p + 1] = s; img.data[p + 2] = s; img.data[p + 3] = a * a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  } else if (kind === 'flash') {
    c = canvas(256, 256, (g, w, h) => {
      g.translate(w / 2, h / 2);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.12, 'rgba(255,230,160,0.95)');
      grd.addColorStop(0.35, 'rgba(255,150,40,0.45)'); grd.addColorStop(1, 'rgba(255,90,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        g.rotate((Math.PI * 2) / 7 + Math.random() * 0.3);
        const lg = g.createLinearGradient(0, 0, w / 2, 0);
        lg.addColorStop(0, 'rgba(255,240,200,0.9)'); lg.addColorStop(1, 'rgba(255,120,20,0)');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(0, -6); g.lineTo(w * (0.32 + Math.random() * 0.18), 0); g.lineTo(0, 6); g.fill();
      }
    });
  } else if (kind === 'flashSide') {
    c = canvas(256, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.3, 'rgba(255,200,90,0.8)'); grd.addColorStop(1, 'rgba(255,90,0,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, h / 2 - 14);
      for (let i = 0; i <= 10; i++) { const x = (i / 10) * w; const hh = (1 - i / 10) * (h / 2) * (0.5 + Math.random() * 0.5); g.lineTo(x, h / 2 - hh); }
      for (let i = 10; i >= 0; i--) { const x = (i / 10) * w; const hh = (1 - i / 10) * (h / 2) * (0.5 + Math.random() * 0.5); g.lineTo(x, h / 2 + hh); }
      g.fill();
    });
  } else if (kind === 'spark') {
    c = canvas(64, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,220,150,0.9)'); grd.addColorStop(1, 'rgba(255,120,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
  } else if (kind === 'fire') {
    c = canvas(128, 128, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const vv = 1 - v; // 0 bottom .. 1 top (canvas y down)
        const width = 0.36 * Math.pow(Math.max(0, 1 - vv), 0.7) * (0.6 + 0.4 * Math.sin(vv * 3.14));
        const n = fbm(u, v * 0.7, 5, 5, 311);
        const dx = Math.abs(u - 0.5 + (n - 0.5) * 0.25 * vv);
        const core = clamp(1 - dx / (width + 0.001));
        const a = clamp(Math.pow(core, 1.2) * (0.6 + n * 0.8) * smooth(0.0, 0.18, vv + 0.05));
        const p = (y * w + x) * 4;
        img.data[p] = 255; img.data[p + 1] = 170 + core * 85; img.data[p + 2] = 90 + core * 140; img.data[p + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  } else if (kind === 'blood') {
    c = canvas(128, 128, (g, w, h) => {
      for (let i = 0; i < 18; i++) {
        const r = 6 + Math.random() * 22, x = w / 2 + (Math.random() - 0.5) * 60, y = h / 2 + (Math.random() - 0.5) * 60;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(120,6,4,0.9)'); grd.addColorStop(1, 'rgba(90,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
  } else if (kind === 'hole') {
    c = canvas(128, 128, (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      // scorched ring / chipped material
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 38;
        g.fillStyle = `rgba(20,18,16,${0.08 + Math.random() * 0.15})`;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, r * 0.5, r * 0.2, a, 0, Math.PI * 2); g.fill();
      }
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 30);
      grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.35, 'rgba(10,8,6,0.95)'); grd.addColorStop(0.6, 'rgba(60,55,50,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
    });
  } else if (kind === 'scorch') {
    c = canvas(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, d = Math.hypot(u - 0.5, v - 0.5) * 2;
        const n = fbm(u, v, 5, 5, 321);
        const a = clamp((1 - d) * 1.4 - (1 - n) * 0.5);
        const p = (y * w + x) * 4;
        img.data[p] = 12; img.data[p + 1] = 10; img.data[p + 2] = 8; img.data[p + 3] = a * 235;
      }
      g.putImageData(img, 0, 0);
    });
  } else if (kind === 'glow') {
    c = canvas(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
  } else if (kind === 'reddot') {
    c = canvas(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 16);
      grd.addColorStop(0, 'rgba(255,90,70,1)'); grd.addColorStop(0.35, 'rgba(255,40,25,1)'); grd.addColorStop(0.55, 'rgba(255,20,10,0.35)'); grd.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(w / 2, h / 2, 16, 0, Math.PI * 2); g.fill();
    });
  } else if (kind === 'window') {
    // interior silhouette texture for dark rooms behind glass
    c = canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#2a2520'; g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(90,78,62,0.6)'); grd.addColorStop(1, 'rgba(15,12,10,0.4)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(w * 0.1, h * 0.55, w * 0.35, h * 0.45);
      g.fillRect(w * 0.6, h * 0.3, w * 0.25, h * 0.7);
      g.fillStyle = 'rgba(120,100,80,0.18)';
      g.fillRect(0, 0, w * 0.08, h); g.fillRect(w * 0.92, 0, w * 0.08, h);
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- signage / decals / foliage
const SHOPS = [
  ['PHARMACY', 'صيدلية', '#1f6f4a', '#f2efe6'], ['CAFE AL-NOOR', 'مقهى النور', '#7a2e1f', '#f5d9a8'], ['MARKET', 'سوق', '#1d3f73', '#ffffff'],
  ['HOTEL SAFA', 'فندق الصفا', '#2b2b2b', '#e8c46a'], ['BAKERY', 'مخبز', '#b8741a', '#fff4dc'], ['ELECTRONICS', 'إلكترونيات', '#0f5c7a', '#f0f0f0'],
  ['TAILOR', 'خياط', '#5a3a6e', '#f5ecd7'], ['AUTO PARTS', 'قطع غيار', '#a31f1f', '#ffffff'], ['MOBILE', 'موبايل', '#e0b400', '#1a1a1a'],
  ['RESTAURANT', 'مطعم', '#6e1d1d', '#ffe9b0'], ['BARBER', 'حلاق', '#e8e2d0', '#233a6b'], ['EXCHANGE', 'صرافة', '#1b4d2e', '#f7e27a'],
];
export const SIGN_COUNT = SHOPS.length;

function weather(g, w, h, amt, seed) {
  const img = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const n = fbm(u, v * (h / w), 6, 5, seed);
    const streak = fbmA(u, v, 32, 2, 3, seed + 3);
    const dirt = smooth(0.45, 0.85, n * 0.7 + streak * 0.5 * v) * amt;
    const rust = smooth(0.72, 0.8, fbm(u, v, 8, 4, seed + 9)) * amt;
    const p = (y * w + x) * 4;
    img.data[p] = mix(img.data[p], 70, dirt * 0.6) * (1 - rust * 0.4) + rust * 60;
    img.data[p + 1] = mix(img.data[p + 1], 60, dirt * 0.6) * (1 - rust * 0.5) + rust * 25;
    img.data[p + 2] = mix(img.data[p + 2], 50, dirt * 0.6) * (1 - rust * 0.6);
  }
  g.putImageData(img, 0, 0);
}

export function signTex(i) {
  const [en, ar, bg, fg] = SHOPS[i % SHOPS.length];
  const c = canvas(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 52px "Arial Black", Impact, sans-serif';
    g.fillText(en, w * 0.36, h * 0.52, w * 0.6);
    g.font = 'bold 50px "Geeza Pro", "Noto Naskh Arabic", "Arial", sans-serif';
    g.fillText(ar, w * 0.82, h * 0.52, w * 0.3);
    weather(g, w, h, 1, 400 + i * 7);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function graffitiTex(i) {
  const c = canvas(512, 256, (g, w, h) => {
    let seed = 1000 + i * 17;
    const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cols = ['#c1121f', '#e36414', '#e9c46a', '#2a9d8f', '#f1faee', '#111111', '#3a86ff', '#8338ec'];
    const words = ['FREEDOM', 'NO WAR', 'RESIST', 'ZONE 7', 'HOPE', 'حرية', 'ASHFALL', 'LIVE'];
    const word = words[i % words.length];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(w / 2, h / 2); g.rotate((R() - 0.5) * 0.18);
    g.font = `bold ${100 + R() * 30}px "Marker Felt", "Chalkboard SE", "Arial Black", sans-serif`;
    const outline = cols[Math.floor(R() * cols.length)], fill = cols[Math.floor(R() * cols.length)];
    g.shadowColor = outline; g.shadowBlur = 18;
    g.lineWidth = 16; g.strokeStyle = outline; g.strokeText(word, 0, 0, w * 0.92);
    g.shadowBlur = 6; g.shadowColor = fill;
    g.fillStyle = fill; g.fillText(word, 0, 0, w * 0.92);
    g.restore();
    // drips
    g.globalAlpha = 0.55; g.fillStyle = fill;
    for (let k = 0; k < 10; k++) { const x = 60 + R() * (w - 120); g.fillRect(x, h * 0.62, 2.5, 10 + R() * 50); }
    g.globalAlpha = 1;
    // weather: erode paint with noise
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const n = fbm(x / w, y / h, 8, 4, 900 + i);
      img.data[p + 3] *= clamp(0.35 + n * 1.1) * 0.9;
    }
    g.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function posterTex(i) {
  const c = canvas(256, 256, (g, w, h) => {
    const n = 1 + (i % 2);
    const pal = [['#b23a2b', '#f1e3c6'], ['#2d4a3e', '#e9dfc4'], ['#1f3a5f', '#efe6d0'], ['#6b4b2a', '#f3e7cf']][i % 4];
    for (let k = 0; k < n; k++) {
      const pw = (w - 16) / n - 6, x = 8 + k * (pw + 6), y = 10 + k * 8, ph = h - 30;
      g.fillStyle = pal[1]; g.fillRect(x, y, pw, ph);
      g.fillStyle = pal[0]; g.fillRect(x, y, pw, ph * 0.22);
      g.fillStyle = pal[1]; g.font = `bold ${Math.floor(pw / 6)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center';
      g.fillText(['UNITY', 'VOTE', 'SERVE', 'STAND'][(i + k) % 4], x + pw / 2, y + ph * 0.16, pw - 10);
      // portrait silhouette
      g.fillStyle = pal[0]; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(x + pw / 2, y + ph * 0.45, pw * 0.14, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + pw / 2, y + ph * 0.72, pw * 0.3, pw * 0.2, 0, Math.PI, 0); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(30,30,30,0.7)';
      for (let l = 0; l < 3; l++) g.fillRect(x + pw * 0.15, y + ph * 0.8 + l * 9, pw * 0.7 * (1 - l * 0.15), 4);
      // torn corner
      g.clearRect(x + pw - 16 - k * 6, y, 16 + k * 6, 12 + k * 4);
    }
    weather(g, w, h, 0.9, 600 + i);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function leafTex() {
  const c = canvas(256, 256, (g, w, h) => {
    for (let k = 0; k < 70; k++) {
      const x = 20 + Math.random() * (w - 40), y = 20 + Math.random() * (h - 40), s = 9 + Math.random() * 12, a = Math.random() * Math.PI * 2;
      const shade = 0.55 + Math.random() * 0.45;
      g.fillStyle = `rgb(${Math.floor(92 * shade)}, ${Math.floor(104 * shade)}, ${Math.floor(46 * shade)})`;
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.55, s, 0); g.quadraticCurveTo(0, s * 0.55, -s, 0); g.fill();
      g.restore();
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function skylineTex() {
  const c = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#8c857a'; g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
      const lit = Math.random();
      g.fillStyle = lit < 0.06 ? '#c9a46a' : lit < 0.5 ? '#2b2c2e' : '#3a3b3c';
      g.fillRect(fx * 32 + 9, fy * 32 + 8, 14, 17);
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let fy = 0; fy < 8; fy++) g.fillRect(0, fy * 32 + 28, w, 3);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  return t;
}

export function paperTex() {
  const c = canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,40,40,0.5)';
    for (let l = 0; l < 10; l++) g.fillRect(12, 14 + l * 10, 60 + Math.random() * 44, 3);
    weather(g, w, h, 1, 777);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
