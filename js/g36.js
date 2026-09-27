// Decoding helpers for the baked HK G36 mesh data (see g36data.js for attribution).
import * as THREE from 'three';
import { G36 } from './g36data.js';

export { G36 };

function b64(str, Type) {
  const bin = atob(str), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Type(u.buffer);
}

// dequantize one baked material chunk into a BufferGeometry
export function decodeChunk(c) {
  const q = b64(c.p, Uint16Array), n = b64(c.n, Int8Array), idx = b64(c.i, Uint16Array);
  const pos = new Float32Array(q.length), nrm = new Float32Array(n.length);
  for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = c.min[k] + (q[i] / 65535) * (c.max[k] - c.min[k]); }
  for (let i = 0; i < n.length; i++) nrm[i] = n[i] / 127;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
