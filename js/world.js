// Urban warzone level: streets, facades with recessed windows, cover props, rubble,
// skyline. Static geometry is merged per material and per spatial cell so draw calls stay
// low while frustum culling still works. Collision is a flat list of AABBs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Gen, spriteTex, signTex, graffitiTex, posterTex, leafTex, paperTex, skylineTex, SIGN_COUNT } from './textures.js';

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL = 40;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

export class World {
  constructor(scene, progress) {
    this.scene = scene;
    this.colliders = [];
    this.coverPoints = [];
    this.fires = [];       // {pos, scale}
    this.smokeStacks = []; // distant plumes
    this.groups = new Map();
    this.mats = {};
    this.progress = progress || (() => {});
    this.R = rng(1337);
  }

  // ---------------------------------------------------------------- materials
  async buildMaterials() {
    const std = (tex, { metal, ...opts } = {}) => {
      const m = new THREE.MeshStandardMaterial({
        map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap,
        roughness: 1, metalness: 0, ...opts,
      });
      if (metal) { m.metalnessMap = tex.metalnessMap; m.metalness = 1; }
      m.normalScale = new THREE.Vector2(1, 1);
      return m;
    };
    const steps = [
      ['asphalt', () => ({ m: std(Gen.asphalt()), s: 7 })],
      ['sidewalk', () => ({ m: std(Gen.sidewalk()), s: 3 })],
      ['concrete', () => ({ m: std(Gen.concreteWall(1024, 0xbab4a8)), s: 4 })],
      ['concreteDark', () => ({ m: std(Gen.concreteWall(512, 0x8a867e)), s: 3 })],
      ['brick', () => ({ m: std(Gen.brick(1024, 0x8e4a35)), s: 1.8 })],
      ['brick2', () => ({ m: std(Gen.brick(1024, 0x6e5a4c)), s: 1.8 })],
      ['plaster', () => ({ m: std(Gen.plaster(1024, 0xcdb898)), s: 5 })],
      ['plaster2', () => ({ m: std(Gen.plaster(1024, 0x9fa6a3)), s: 5 })],
      ['plaster3', () => ({ m: std(Gen.plaster(1024, 0xc49a6a)), s: 5 })],
      ['containerRed', () => ({ m: std(Gen.corrugated(512, 0x7c2f22), { metal: true }), s: 3.6 })],
      ['containerBlue', () => ({ m: std(Gen.corrugated(512, 0x2b4b6b), { metal: true }), s: 3.6 })],
      ['containerGreen', () => ({ m: std(Gen.corrugated(512, 0x3f5a3c), { metal: true }), s: 3.6 })],
      ['shutter', () => ({ m: std(Gen.corrugated(512, 0x8d8f8a), { metal: true }), s: 2.4 })],
      ['wood', () => ({ m: std(Gen.wood(512, 0x9a7a52)), s: 1.4 })],
      ['cloth', () => ({ m: std(Gen.cloth(512, 0x9a8a64)), s: 0.8 })],
      ['dirt', () => ({ m: std(Gen.dirt()), s: 6 })],
      ['carA', () => ({ m: std(Gen.carPaint(512, 0x5d6450), { metal: true }), s: 2 })],
      ['carB', () => ({ m: std(Gen.carPaint(512, 0x7a2a22), { metal: true }), s: 2 })],
      ['carC', () => ({ m: std(Gen.carPaint(512, 0xb9b6ad), { metal: true }), s: 2 })],
      ['burnt', () => ({ m: std(Gen.carPaint(512, 0x1d1a18), { metal: true }), s: 2 })],
      ['metal', () => ({ m: std(Gen.gunMetal(256, 0x3a3c3e, 0.55), { metal: true }), s: 1 })],
      ['roof', () => ({ m: std(Gen.roof()), s: 4 })],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [k, f] = steps[i];
      const r = f();
      this.mats[k] = r.m; r.m.userData.scale = r.s;
      this.progress(0.05 + (i / steps.length) * 0.6, 'GENERATING MATERIALS · ' + k.toUpperCase());
      await new Promise((res) => setTimeout(res, 0));
    }
    const M = this.mats;
    M.glass = new THREE.MeshStandardMaterial({ color: 0x1a1f24, roughness: 0.04, metalness: 1.0, envMapIntensity: 1.4 });
    M.glass.userData.scale = 1;
    M.glassDirty = new THREE.MeshStandardMaterial({ color: 0x3a3e3c, roughness: 0.35, metalness: 0.8 });
    M.glassDirty.userData.scale = 1;
    M.frame = new THREE.MeshStandardMaterial({ color: 0x2e2c29, roughness: 0.6, metalness: 0.3 });
    M.frame.userData.scale = 1;
    M.trim = M.concrete;
    M.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
    M.rubber.userData.scale = 1;
    M.paintWhite = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.75, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    M.paintWhite.userData.scale = 1;
    M.paintYellow = new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.75, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    M.paintYellow.userData.scale = 1;
    const winTex = spriteTex('window');
    M.interior = new THREE.MeshStandardMaterial({ map: winTex, roughness: 1, color: 0xc8bdb0 });
    M.interior.userData.scale = 1;
    M.interiorLit = new THREE.MeshStandardMaterial({ map: winTex, roughness: 1, color: 0x201810, emissive: 0xffa860, emissiveIntensity: 0.9, emissiveMap: winTex });
    M.interiorLit.userData.scale = 1;
    M.light = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, emissive: 0xffd9a0, emissiveIntensity: 0.15, roughness: 0.1 });
    M.light.userData.scale = 1;
    M.redLight = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 1.2 });
    M.redLight.userData.scale = 1;
    M.wire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    M.wire.userData.scale = 1;
    M.skyline = new THREE.MeshStandardMaterial({ map: skylineTex(), color: 0xb0a898, roughness: 1 });
    M.skyline.userData.scale = 22;
    for (let i = 0; i < SIGN_COUNT; i++) { M['sign' + i] = new THREE.MeshStandardMaterial({ map: signTex(i), roughness: 0.65, metalness: 0.15 }); M['sign' + i].userData.scale = 1; }
    for (let i = 0; i < 6; i++) { M['graf' + i] = new THREE.MeshStandardMaterial({ map: graffitiTex(i), roughness: 0.85, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }); M['graf' + i].userData.scale = 1; }
    for (let i = 0; i < 4; i++) { M['poster' + i] = new THREE.MeshStandardMaterial({ map: posterTex(i), roughness: 0.9, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }); M['poster' + i].userData.scale = 1; }
    M.leaves = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
    M.leaves.userData.scale = 1;
    M.paper = new THREE.MeshStandardMaterial({ map: paperTex(), side: THREE.DoubleSide, roughness: 0.9 });
    M.paper.userData.scale = 1;
    M.trashbag = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.32, metalness: 0.1 });
    M.trashbag.userData.scale = 1;
    const bark = Gen.wood(256, 0x4a3a2c); M.bark = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95 });
    M.bark.userData.scale = 1.2;
  }

  // ---------------------------------------------------------------- geometry helpers
  add(geo, matKey, matrix, { worldUV = true, uvScale } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (matrix) g.applyMatrix4(matrix);
    const mat = this.mats[matKey];
    if (worldUV) {
      const s = uvScale || mat.userData.scale || 1;
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (ny >= nx && ny >= nz) uv.setXY(i, x / s, z / s);
        else if (nx >= nz) uv.setXY(i, (n.getX(i) > 0 ? -z : z) / s, y / s);
        else uv.setXY(i, (n.getZ(i) > 0 ? x : -x) / s, y / s);
      }
    }
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(_p);
    const key = matKey + '|' + Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL);
    if (!this.groups.has(key)) this.groups.set(key, { mat: matKey, geos: [] });
    this.groups.get(key).geos.push(g);
  }

  // axis-aligned (optionally y-rotated) box. x,y,z = center
  box(x, y, z, w, h, d, mat, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, 1));
    if (o.parent) _m.premultiply(o.parent);
    this.add(g, mat, _m, o);
    if (o.collide) this.colliderFromBox(w, h, d, _m.clone(), o.surf || 'concrete');
    return g;
  }

  colliderFromBox(w, h, d, matrix, surf) {
    const b = new THREE.Box3(new THREE.Vector3(-w / 2, -h / 2, -d / 2), new THREE.Vector3(w / 2, h / 2, d / 2));
    b.applyMatrix4(matrix);
    this.colliders.push({ min: b.min, max: b.max, surf });
  }

  collider(minX, minY, minZ, maxX, maxY, maxZ, surf = 'concrete') {
    this.colliders.push({ min: new THREE.Vector3(minX, minY, minZ), max: new THREE.Vector3(maxX, maxY, maxZ), surf });
  }

  mesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, parent, opts) {
    _e.set(rx, ry, rz);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    if (parent) _m.premultiply(parent);
    this.add(geo, mat, _m, opts);
  }

  finalize() {
    for (const [, grp] of this.groups) {
      const merged = mergeGeometries(grp.geos, false);
      merged.computeBoundingSphere();
      const mat = this.mats[grp.mat];
      const m = new THREE.Mesh(merged, mat);
      const noShadow = grp.mat === 'paintWhite' || grp.mat === 'paintYellow' || grp.mat === 'skyline';
      m.castShadow = !noShadow && !mat.transparent;
      m.receiveShadow = grp.mat !== 'skyline';
      m.matrixAutoUpdate = false;
      this.scene.add(m);
      for (const g of grp.geos) g.dispose();
    }
    this.groups.clear();
  }

  // ---------------------------------------------------------------- level
  async build() {
    await this.buildMaterials();
    this.progress(0.7, 'CONSTRUCTING DISTRICT');
    await new Promise((r) => setTimeout(r, 0));
    this.ground();
    this.buildings();
    this.progress(0.8, 'PLACING COVER');
    await new Promise((r) => setTimeout(r, 0));
    this.props();
    this.skyline();
    this.bounds();
    this.progress(0.88, 'MERGING GEOMETRY');
    await new Promise((r) => setTimeout(r, 0));
    this.finalize();
  }

  ground() {
    // dirt outside the play space
    this.box(0, -0.35, 0, 520, 0.5, 520, 'dirt');
    // main street N-S and cross street E-W
    this.box(0, -0.1, 0, 14, 0.2, 200, 'asphalt');
    this.box(0, -0.1, 0, 140, 0.2, 14, 'asphalt');
    // sidewalks + curbs
    const sw = (x0, x1, z0, z1) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      this.box(cx, 0.075, cz, w, 0.15, d, 'sidewalk', { collide: true });
    };
    const curbAlongZ = (x, z0, z1) => this.box(x, 0.08, (z0 + z1) / 2, 0.25, 0.16, z1 - z0, 'concreteDark');
    const curbAlongX = (z, x0, x1) => this.box((x0 + x1) / 2, 0.08, z, x1 - x0, 0.16, 0.25, 'concreteDark');
    for (const s of [-1, 1]) {
      // along main street
      sw(s > 0 ? 7 : -11, s > 0 ? 11 : -7, 11, 100);
      sw(s > 0 ? 7 : -11, s > 0 ? 11 : -7, -100, -11);
      curbAlongZ(s * 7.12, 7, 100); curbAlongZ(s * 7.12, -100, -7);
      // along cross street
      sw(11, 70, s > 0 ? 7 : -11, s > 0 ? 11 : -7);
      sw(-70, -11, s > 0 ? 7 : -11, s > 0 ? 11 : -7);
      curbAlongX(s * 7.12, 7, 70); curbAlongX(s * 7.12, -70, -7);
      // corner squares
      sw(s > 0 ? 7 : -11, s > 0 ? 11 : -7, 7, 11);
      sw(s > 0 ? 7 : -11, s > 0 ? 11 : -7, -11, -7);
    }
    // road markings (dashed centre line, crosswalks, stop lines)
    const Y = 0.004;
    for (let z = -96; z < 96; z += 6) {
      if (Math.abs(z) < 12) continue;
      this.box(0, Y, z, 0.14, 0.004, 3, 'paintYellow', { worldUV: false });
    }
    for (let x = -66; x < 66; x += 6) {
      if (Math.abs(x) < 12) continue;
      this.box(x, Y, 0, 3, 0.004, 0.14, 'paintYellow', { worldUV: false });
    }
    for (const s of [-1, 1]) {
      for (let i = -6; i <= 6; i++) {
        this.box(i * 1.0, Y, s * 9.5, 0.5, 0.004, 3, 'paintWhite', { worldUV: false });
        this.box(s * 9.5, Y, i * 1.0, 3, 0.004, 0.5, 'paintWhite', { worldUV: false });
      }
      this.box(s > 0 ? -3.5 : 3.5, Y, s * 11.6, 7, 0.004, 0.3, 'paintWhite', { worldUV: false });
      for (const e of [-1, 1]) this.box(e * 6.6, Y, s * 50, 0.12, 0.004, 80, 'paintWhite', { worldUV: false });
    }
  }

  // --------------------------------------------------------- buildings
  buildings() {
    const R = this.R;
    const styles = [
      { wall: 'brick', trim: 'concrete', floorH: 3.3 },
      { wall: 'plaster', trim: 'concrete', floorH: 3.4 },
      { wall: 'brick2', trim: 'concreteDark', floorH: 3.2 },
      { wall: 'plaster2', trim: 'concrete', floorH: 3.5 },
      { wall: 'plaster3', trim: 'concreteDark', floorH: 3.3 },
      { wall: 'concrete', trim: 'concreteDark', floorH: 3.6 },
    ];
    const pick = () => styles[Math.floor(R() * styles.length)];
    // main street rows: facade on x = ±11, facing inward, extending along z
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      let z = 11;
      while (z < 96) {
        const w = Math.min(10 + Math.floor(R() * 4) * 3, 96 - z);
        if (w < 6) break;
        const floors = 2 + Math.floor(R() * 5);
        const zc = sz * (z + w / 2);
        // local facade frame: origin at facade centre bottom, +z points toward street
        const rot = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.building(sx * 11, zc, rot, w, 16, floors, pick(), z === 11 ? -sx * sz : 0);
        z += w;
      }
      // cross street rows: facade on z = ±11 facing inward, extending along x from 27
      let x = 27;
      while (x < 66) {
        const w = Math.min(9 + Math.floor(R() * 4) * 3, 66 - x);
        if (w < 6) break;
        const floors = 2 + Math.floor(R() * 4);
        const rot = sz > 0 ? Math.PI : 0;
        this.building(sx * (x + w / 2), sz * 11, rot, w, 14, floors, pick());
        x += w;
      }
    }
    // end walls: large buildings closing each street
    for (const s of [-1, 1]) {
      this.building(0, s * 100, s > 0 ? Math.PI : 0, 22, 14, 6, styles[s > 0 ? 0 : 5]);
      this.building(s * 70, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 22, 14, 4, styles[s > 0 ? 1 : 2]);
    }
  }

  // facade faces local +z. rot = rotation about y. (fx,fz) = facade centre on ground.
  building(fx, fz, rot, W, D, floors, st, corner = 0) {
    const R = this.R;
    const T = new THREE.Matrix4().compose(new THREE.Vector3(fx, 0, fz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    const P = { parent: T };
    const gf = 4.2; // ground floor height
    const fh = st.floorH;
    const H = gf + (floors - 1) * fh;
    const t = 0.35; // wall thickness
    const wall = st.wall, trim = st.trim;
    // core volume behind facade
    const cw = W - (corner ? 2 : 0), cx = corner ? -corner : 0;
    this.box(cx, H / 2, -(D + 2) / 2, cw, H, D - 2, wall, P);
    for (const e of [-1, 1]) if (e !== corner) this.box(e * (W / 2 - 0.15), H / 2, -1.0, 0.3, H, 2.0, wall, P);
    // roof slab + parapet
    this.box(0, H + 0.05, -D / 2, W, 0.1, D, 'roof', P);
    this.box(0, H + 0.45, -0.2, W + 0.1, 0.9, 0.4, trim, P);
    this.box(-W / 2 + 0.15, H + 0.45, -D / 2, 0.3, 0.9, D, trim, P);
    this.box(W / 2 - 0.15, H + 0.45, -D / 2, 0.3, 0.9, D, trim, P);
    this.box(0, H + 0.45, -D + 0.15, W, 0.9, 0.3, trim, P);
    // cornice
    this.box(0, H - 0.2, 0.12, W + 0.3, 0.35, 0.5, trim, P);
    // rooftop clutter
    if (R() < 0.7) this.box((R() - 0.5) * W * 0.5, H + 0.7, -D * 0.5, 2.2, 1.3, 1.6, 'metal', P);
    if (R() < 0.5) { // water tank
      const g = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16);
      this.mesh(g, 'wood', (R() - 0.5) * W * 0.4, H + 2.6, -D * 0.6, 0, 0, 0, 1, 1, 1, T);
      for (const a of [-0.7, 0.7]) for (const b of [-0.7, 0.7]) this.box(a + (0), H + 0.8, -D * 0.6 + b, 0.12, 1.5, 0.12, 'metal', P);
    }

    this.facade(T, W, floors, st, gf, fh, H);
    if (corner) {
      const T2 = T.clone().multiply(new THREE.Matrix4().makeTranslation(corner * W / 2, 0, -D / 2)).multiply(new THREE.Matrix4().makeRotationY(corner * Math.PI / 2));
      this.facade(T2, D, floors, st, gf, fh, H);
    }

    // drain pipe
    const px = W / 2 - 0.25;
    this.mesh(new THREE.CylinderGeometry(0.06, 0.06, H, 8), 'metal', px, H / 2, 0.12, 0, 0, 0, 1, 1, 1, T);
    // collider: whole building volume
    const b = new THREE.Box3(new THREE.Vector3(-W / 2, 0, -D), new THREE.Vector3(W / 2, H + 1, 0)).applyMatrix4(T);
    this.colliders.push({ min: b.min, max: b.max, surf: 'concrete' });
  }

  facade(T, W, floors, st, gf, fh, H) {
    const R = this.R;
    const P = { parent: T };
    const t = 0.35;
    const wall = st.wall, trim = st.trim;
    // ---- ground floor: storefront
    const nShops = Math.max(1, Math.round(W / 6));
    const shopW = W / nShops;
    this.box(0, 0.25, -t / 2, W, 0.5, t, trim, P); // plinth
    for (let i = 0; i <= nShops; i++) {
      const bx = -W / 2 + shopW * i;
      const pw = i === 0 || i === nShops ? 0.6 : 1.2;
      const pc = i === 0 ? bx + 0.3 : i === nShops ? bx - 0.3 : bx;
      this.box(pc, gf / 2, -t / 2 + 0.05, pw, gf, t + 0.1, trim, P);
      if (R() < 0.35 && pw > 1) this.mesh(new THREE.PlaneGeometry(0.95, 0.95), 'poster' + Math.floor(R() * 4), pc, 1.5 + R() * 0.4, 0.103, 0, 0, (R() - 0.5) * 0.1, 1, 1, 1, T, { worldUV: false });
    }
    for (let i = 0; i < nShops; i++) {
      const cx = -W / 2 + shopW * (i + 0.5);
      const openW = shopW - 1.2, openH = 3.0;
      // lintel
      this.box(cx, (openH + 0.5 + gf) / 2, -t / 2, shopW, gf - openH - 0.5, t, wall, P);
      // recessed shop interior
      this.box(cx, 0.5 + openH / 2, -1.8, openW, openH, 0.1, R() < 0.25 ? 'interiorLit' : 'interior', { ...P, worldUV: false });
      this.box(cx, 0.48, -1.05, openW, 0.04, 1.5, 'concreteDark', P);
      this.box(cx, 0.5 + openH + 0.02, -1.05, openW, 0.04, 1.5, 'concreteDark', P);
      for (const e of [-1, 1]) this.box(cx + e * (openW / 2 + 0.02), 0.5 + openH / 2, -1.05, 0.04, openH, 1.5, 'concreteDark', P);
      // shop fittings: back shelving + counter
      this.box(cx - openW * 0.2, 0.5 + 1.0, -1.6, openW * 0.5, 2.0, 0.35, 'wood', { ...P, uvScale: 1 });
      for (let k = 0; k < 4; k++) this.box(cx - openW * 0.2, 0.5 + 0.35 + k * 0.5, -1.42, openW * 0.48, 0.04, 0.05, 'frame', P);
      if (R() < 0.7) this.box(cx + openW * 0.18, 0.5 + 0.5, -0.95, openW * 0.4, 1.0, 0.5, R() < 0.5 ? 'wood' : 'metal', P);
      const kind = R();
      if (kind < 0.45) {
        // roller shutter partially down
        const down = 0.3 + R() * 0.7;
        const sh = openH * down;
        this.box(cx, 0.5 + openH - sh / 2, -0.12, openW, sh, 0.06, 'shutter', P);
        if (R() < 0.55 && sh > 1.4) this.mesh(new THREE.PlaneGeometry(Math.min(openW * 0.8, 3), Math.min(openW * 0.4, 1.5)), 'graf' + Math.floor(R() * 6), cx + (R() - 0.5) * 0.4, 0.5 + openH - sh + Math.min(sh * 0.5, 1.1), -0.085, 0, 0, (R() - 0.5) * 0.06, 1, 1, 1, T, { worldUV: false });
        this.box(cx, 0.5 + openH + 0.15, -0.05, openW + 0.2, 0.35, 0.3, 'metal', P);
      } else if (kind < 0.8) {
        // shop glass with mullions
        this.box(cx, 0.5 + openH / 2, -0.2, openW, openH, 0.04, R() < 0.5 ? 'glass' : 'glassDirty', { ...P, worldUV: false });
        this.box(cx, 0.5 + openH * 0.72, -0.14, openW, 0.08, 0.1, 'frame', P);
        this.box(cx, 0.55, -0.14, openW, 0.1, 0.12, 'frame', P);
      } // else broken open storefront
      // sign board
      if (R() < 0.75) {
        const sw = Math.min(openW * 0.92, 2.8), sh = sw / 4;
        const sy = 0.5 + openH + 0.1 + sh / 2;
        this.box(cx, sy, 0.06, sw + 0.08, sh + 0.08, 0.1, 'frame', P);
        this.mesh(new THREE.PlaneGeometry(sw, sh), 'sign' + Math.floor(R() * SIGN_COUNT), cx, sy, 0.112, 0, 0, 0, 1, 1, 1, T, { worldUV: false });
      }

      // awning frame
      if (R() < 0.35) this.box(cx, 0.5 + openH + 0.02, 0.55, openW, 0.06, 1.1, 'shutter', { ...P, rx: 0.25 });
    }
    // floor band above ground floor
    this.box(0, gf - 0.1, 0.08, W + 0.2, 0.25, 0.3, trim, P);

    // ---- upper floors
    const winW = 1.3, winH = 1.75, sill = 0.9;
    const nWin = Math.max(1, Math.floor((W - 1) / 3.0));
    const bay = W / nWin;
    const blown = R() < 0.25 ? Math.floor(R() * nWin) : -1;
    for (let f = 1; f < floors; f++) {
      const y0 = gf + (f - 1) * fh;
      // spandrel below windows and above windows
      this.box(0, y0 + sill / 2, -t / 2, W, sill, t, wall, P);
      this.box(0, y0 + sill + winH + (fh - sill - winH) / 2, -t / 2, W, fh - sill - winH, t, wall, P);
      for (let i = 0; i < nWin; i++) {
        const cx = -W / 2 + bay * (i + 0.5);
        // piers: left piece of each bay (+ the last right piece)
        const pw = (bay - winW) / 2;
        this.box(cx - winW / 2 - pw / 2, y0 + sill + winH / 2, -t / 2, pw, winH, t, wall, P);
        this.box(cx + winW / 2 + pw / 2, y0 + sill + winH / 2, -t / 2, pw, winH, t, wall, P);
        const wy = y0 + sill + winH / 2;
        const isBlown = i === blown && f === floors - 1;
        // interior room box behind opening
        this.box(cx, wy, -t - 1.4, winW, winH, 0.05, R() < 0.12 ? 'interiorLit' : 'interior', { ...P, worldUV: false });
        this.box(cx, y0 + sill - 0.02, -t - 0.7, winW, 0.04, 1.4, 'concreteDark', P);
        this.box(cx, y0 + sill + winH + 0.02, -t - 0.7, winW, 0.04, 1.4, 'concreteDark', P);
        this.box(cx - winW / 2 - 0.02, wy, -t - 0.7, 0.04, winH, 1.4, 'concreteDark', P);
        this.box(cx + winW / 2 + 0.02, wy, -t - 0.7, 0.04, winH, 1.4, 'concreteDark', P);
        // sill + lintel
        this.box(cx, y0 + sill - 0.06, 0.04, winW + 0.3, 0.12, 0.2, trim, P);
        this.box(cx, y0 + sill + winH + 0.08, 0.02, winW + 0.2, 0.16, 0.12, trim, P);
        if (!isBlown) {
          const broken = R() < 0.3;
          // frame
          this.box(cx, wy, -0.22, winW, 0.07, 0.08, 'frame', P);
          this.box(cx, y0 + sill + 0.035, -0.22, winW, 0.07, 0.1, 'frame', P);
          this.box(cx, y0 + sill + winH - 0.035, -0.22, winW, 0.07, 0.1, 'frame', P);
          this.box(cx - winW / 2 + 0.035, wy, -0.22, 0.07, winH, 0.1, 'frame', P);
          this.box(cx + winW / 2 - 0.035, wy, -0.22, 0.07, winH, 0.1, 'frame', P);
          this.box(cx, wy, -0.22, 0.06, winH, 0.08, 'frame', P);
          if (!broken) this.box(cx, wy, -0.24, winW - 0.1, winH - 0.1, 0.02, R() < 0.7 ? 'glass' : 'glassDirty', { ...P, worldUV: false });
          // wooden shutters on some
          if (R() < 0.15) {
            this.box(cx - winW / 2 - 0.35, wy, 0.03, 0.62, winH, 0.05, 'wood', { ...P, ry: 0.1 });
            this.box(cx + winW / 2 + 0.35, wy, 0.03, 0.62, winH, 0.05, 'wood', { ...P, ry: -0.3 });
          }
        } else {
          // blast damage: scorch-dark jagged opening edges
          this.box(cx, wy + 0.2, 0.02, winW + 0.6, winH + 0.6, 0.02, 'burnt', { ...P, worldUV: true });
          this.box(cx, wy, -t - 0.7, winW + 0.1, winH, 1.4, 'interior', { ...P, worldUV: false });
        }
        // AC units and balconies
        if (R() < 0.18) this.box(cx + 0.2, y0 + 0.5, 0.35, 0.9, 0.6, 0.6, 'carC', P);
        if (R() < 0.12 && f > 1) {
          this.box(cx, y0 + 0.08, 0.6, winW + 1.0, 0.16, 1.2, trim, P);
          for (let k = -4; k <= 4; k++) this.box(cx + k * ((winW + 0.9) / 8), y0 + 0.6, 1.15, 0.03, 0.9, 0.03, 'metal', P);
          this.box(cx, y0 + 1.05, 1.15, winW + 1.0, 0.05, 0.05, 'metal', P);
        }
      }
      // floor band
      if (f < floors - 1) this.box(0, y0 + fh, 0.05, W + 0.1, 0.14, 0.2, trim, P);
    }
    // rubble at base of blown facade
    if (blown >= 0) {
      const cx = -W / 2 + bay * (blown + 0.5);
      const rp = new THREE.Vector3(cx, 0, 2.5).applyMatrix4(T);
      this.rubblePile(rp.x, rp.z, 2.4, 60, 0.9);
    }
    return blown;
  }

  rubblePile(x, z, radius, count, height) {
    const R = this.R;
    const geoA = new THREE.DodecahedronGeometry(1, 0);
    const geoB = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * radius;
      const h = (1 - r / radius) * height;
      const s = 0.08 + R() * 0.35 * (1 - r / radius * 0.5);
      const mat = R() < 0.45 ? 'concrete' : R() < 0.6 ? 'brick' : R() < 0.8 ? 'concreteDark' : 'plaster';
      this.mesh(R() < 0.6 ? geoA : geoB, mat, x + Math.cos(a) * r, h * R() + s * 0.3, z + Math.sin(a) * r, R() * 3, R() * 3, R() * 3, s * (0.8 + R()), s * (0.5 + R() * 0.6), s * (0.8 + R()));
    }
    // broken slabs with rebar
    for (let i = 0; i < 3; i++) {
      const a = R() * Math.PI * 2, r = R() * radius * 0.6;
      const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
      const ry = R() * Math.PI;
      this.box(sx, height * 0.4, sz, 1.4 + R(), 0.18, 0.9 + R() * 0.6, 'concrete', { rx: (R() - 0.5) * 0.9, ry, rz: (R() - 0.5) * 0.9 });
      for (let k = 0; k < 3; k++) {
        this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 4), 'metal', sx + (R() - 0.5), height * 0.5 + 0.2, sz + (R() - 0.5), (R() - 0.5) * 1.5, 0, (R() - 0.5) * 1.5);
      }
    }
    if (height > 0.6) this.collider(x - radius * 0.5, 0, z - radius * 0.5, x + radius * 0.5, height * 0.6, z + radius * 0.5, 'concrete');
  }

  // --------------------------------------------------------- props
  props() {
    const R = this.R;
    // wrecked cars
    const cars = [
      [-3.2, 58, 0.25, 'carA', false], [3.8, 40, -0.4, 'carC', false], [-2, 24, 1.3, 'burnt', true],
      [4.2, -18, 3.3, 'carB', false], [-4.5, -38, 0.15, 'burnt', true], [2.5, -58, -0.2, 'carA', false],
      [22, 3.5, 1.5, 'carC', false], [-26, -3.2, 1.7, 'burnt', true], [40, -2, 1.45, 'carB', false], [-44, 3.8, 1.6, 'carA', false],
      [5, 72, 0.05, 'carB', false],
    ];
    for (const c of cars) this.car(c[0], c[1], c[2], c[3], c[4]);

    // jersey barriers
    const jb = [
      [0, 66, 0.0], [-3.2, 66, 0.1], [3.4, 65.5, -0.15],
      [-1.5, 32, 0.3], [2.8, 12, 0.0], [-4, -10, 0.2], [0.5, -28, -0.1], [-2.5, -48, 0.05], [3.5, -48, -0.2],
      [16, -1, 1.57], [-16, 1.5, 1.4], [32, 2, 1.57], [-34, -1.5, 1.6], [48, 0, 1.5], [-52, 2, 1.57], [0, -70, 0], [-3.2, -70, 0.05], [3.3, -70.2, 0],
    ];
    for (const j of jb) this.jersey(j[0], j[1], j[2]);

    // sandbag positions
    const sb = [[-5, 46, 0.1, 5], [5.2, 28, -0.3, 4], [-5.2, 5, 0.1, 5], [0, -40, 0, 6], [5, -65, 0.2, 4], [-18, 5, 1.57, 5], [26, -5, 1.5, 4], [-5.5, -60, -0.1, 4]];
    for (const s of sb) this.sandbags(s[0], s[1], s[2], s[3]);

    // containers
    this.container(-4.2, 14, 0.12, 'containerRed');
    this.container(3.6, -32, 0.05, 'containerBlue');
    this.container(3.6, -32, 0.1, 'containerGreen', 2.6);
    this.container(-36, 3.5, 1.52, 'containerGreen');
    this.container(18, 88, 1.5708, 'containerRed');

    // crates & barrels
    const crates = [[5.5, 50], [6.2, 51.2], [5.8, 50.6, 1], [-6, 20], [-6.3, 21.2], [6, -8], [-5.8, -24], [-6, -25.2], [-6, -24.6, 1], [12, 5], [-40, -5], [30, 4.5]];
    for (const c of crates) this.crate(c[0], c[1], c[2] || 0);
    const barrels = [[6.2, 44, 'carB'], [6.6, 44.7, 'containerBlue'], [-6.4, 36, 'burnt', true], [-6.5, -14, 'carB'], [6.4, -44, 'burnt', true], [13, -5, 'containerGreen'], [-14, 5.5, 'carB'], [20, -5, 'burnt', true]];
    for (const b of barrels) this.barrel(b[0], b[1], b[2], b[3]);

    // rubble piles along the street
    const piles = [[-6, 70, 2, 50, 0.6], [6, 10, 2.2, 60, 0.8], [-5.5, -30, 1.8, 40, 0.5], [5.5, -52, 2.4, 70, 0.9], [-30, 6, 2, 50, 0.6], [44, -6, 2, 50, 0.6], [1, 80, 1.5, 30, 0.35]];
    for (const p of piles) this.rubblePile(p[0], p[1], p[2], p[3], p[4]);
    // loose debris everywhere
    const deb = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 700; i++) {
      const onCross = R() < 0.3;
      const x = onCross ? (R() - 0.5) * 120 : (R() - 0.5) * 20;
      const z = onCross ? (R() - 0.5) * 20 : (R() - 0.5) * 180;
      const s = 0.03 + R() * 0.09;
      const surfY = Math.abs(onCross ? z : x) > 7 ? 0.15 : 0;
      this.mesh(deb, R() < 0.7 ? 'concrete' : 'brick', x, surfY + s * 0.3, z, R() * 3, R() * 3, R() * 3, s, s * 0.6, s * 1.2);
    }

    this.litter();
    for (let z = -84; z <= 84; z += 14) {
      if (Math.abs(z) < 16 || R() < 0.35) continue;
      this.tree(z % 28 === 0 ? 8.7 : -8.7, z + (R() - 0.5) * 3);
    }
    for (const x of [-40, -22, 22, 40]) if (R() < 0.8) this.tree(x + (R() - 0.5) * 4, x > 0 ? -8.7 : 8.7);
    // street lamps + utility poles with sagging wires
    for (let z = -84; z <= 84; z += 24) {
      if (Math.abs(z) < 14) continue;
      this.lamp(-9.6, z, 1); this.lamp(9.6, z + 12, -1);
    }
    const poles = [];
    for (let z = -88; z <= 88; z += 22) { if (Math.abs(z) < 12) continue; poles.push(this.pole(10.3, z)); }
    for (let i = 0; i < poles.length - 1; i++) {
      if (Math.sign(poles[i].z) !== Math.sign(poles[i + 1].z)) continue;
      for (const off of [-0.8, 0, 0.8]) this.wire(new THREE.Vector3(poles[i].x + off, poles[i].y, poles[i].z), new THREE.Vector3(poles[i + 1].x + off, poles[i + 1].y, poles[i + 1].z), 0.6);
    }
    // wires across the street to buildings
    for (let z = -80; z <= 80; z += 22) { if (Math.abs(z) < 12) continue; this.wire(new THREE.Vector3(10.3, 8.4, z - 0.5), new THREE.Vector3(-11, 7.5 + R() * 3, z + (R() - 0.5) * 8), 1.2); }
    // traffic lights at intersection corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.trafficLight(sx * 8.2, sz * 8.2, sx, sz);

    // fires
    this.fires.push({ pos: new THREE.Vector3(-2, 1.2, 24), scale: 1.3 }, { pos: new THREE.Vector3(-4.5, 1.2, -38), scale: 1.2 }, { pos: new THREE.Vector3(-26, 1.2, -3.2), scale: 1.2 },
      { pos: new THREE.Vector3(-6.4, 0.95, 36), scale: 0.6 }, { pos: new THREE.Vector3(6.4, 0.95, -44), scale: 0.6 }, { pos: new THREE.Vector3(20, 0.95, -5), scale: 0.6 });
    this.smokeStacks.push(new THREE.Vector3(-60, 0, -160), new THREE.Vector3(90, 0, -120), new THREE.Vector3(-110, 0, 60), new THREE.Vector3(40, 0, 180), new THREE.Vector3(140, 0, 30));
  }

  car(x, z, ry, paint, burnt) {
    const T = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const P = { parent: T };
    if (!this._carGeo) {
      const ext = (shape, depth, bevel) => {
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
        g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals();
        return g;
      };
      const b = new THREE.Shape();
      b.moveTo(-2.2, 0.38); b.lineTo(-2.24, 0.8); b.quadraticCurveTo(-2.2, 0.93, -1.95, 0.95); b.lineTo(-1.25, 0.97);
      b.lineTo(1.0, 0.96); b.quadraticCurveTo(1.7, 0.93, 2.1, 0.84); b.quadraticCurveTo(2.26, 0.8, 2.25, 0.62); b.lineTo(2.22, 0.4);
      b.lineTo(1.82, 0.36); b.absarc(1.4, 0.36, 0.42, 0, Math.PI, false); b.lineTo(-0.98, 0.36);
      b.absarc(-1.4, 0.36, 0.42, 0, Math.PI, false); b.lineTo(-2.2, 0.38);
      const gh = new THREE.Shape();
      gh.moveTo(-1.28, 0.95); gh.quadraticCurveTo(-0.95, 1.36, -0.72, 1.41); gh.lineTo(0.32, 1.42); gh.quadraticCurveTo(0.55, 1.38, 1.05, 0.95); gh.lineTo(-1.28, 0.95);
      const rf = new THREE.Shape();
      rf.moveTo(-0.74, 1.4); rf.lineTo(0.34, 1.41); rf.lineTo(0.3, 1.45); rf.lineTo(-0.7, 1.44); rf.lineTo(-0.74, 1.4);
      this._carGeo = { body: ext(b, 1.66, 0.07), glass: ext(gh, 1.42, 0.05), roof: ext(rf, 1.4, 0.04) };
    }
    const CG = this._carGeo;
    this.mesh(CG.body, paint, 0, 0, 0, 0, 0, 0, 1, 1, 1, T);
    this.mesh(CG.glass, burnt ? 'interior' : 'glass', 0, 0, 0, 0, 0, 0, 1, 1, 1, T, { worldUV: false });
    this.mesh(CG.roof, paint, 0, 0.005, 0, 0, 0, 0, 1, 1, 1, T);
    // pillars + door seams + mirrors + grille
    for (const sx of [-1, 1]) {
      this.box(sx * 0.9, 0.7, -0.2, 0.012, 0.5, 0.012, 'rubber', { ...P, worldUV: false });
      this.box(sx * 0.93, 1.0, 0.92, 0.1, 0.07, 0.13, paint, P);
    }
    if (!burnt) this.box(0, 0.62, 2.28, 1.2, 0.18, 0.04, 'frame', P);
    // wheels
    const tire = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 20);
    const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12);
    for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) {
      const tilt = burnt ? 0.15 : 0;
      this.mesh(tire, 'rubber', sx * 0.76, burnt ? 0.28 : 0.35, sz, 0, 0, Math.PI / 2 + tilt * sx, 1, 1, 1, T, { worldUV: false });
      this.mesh(rim, 'metal', sx * 0.775, burnt ? 0.28 : 0.35, sz, 0, 0, Math.PI / 2, 1, 1, 1, T);
    }
    // bumpers, lights
    this.box(0, 0.45, 2.27, 1.86, 0.22, 0.12, 'rubber', { ...P, worldUV: false });
    this.box(0, 0.45, -2.27, 1.86, 0.22, 0.12, 'rubber', { ...P, worldUV: false });
    if (!burnt) {
      for (const s of [-1, 1]) {
        this.box(s * 0.65, 0.78, 2.24, 0.34, 0.14, 0.05, 'light', { ...P, worldUV: false });
        this.box(s * 0.68, 0.8, -2.24, 0.3, 0.14, 0.05, 'redLight', { ...P, worldUV: false });
      }
    }
    this.colliderFromBox(1.9, 1.62, 4.6, new THREE.Matrix4().multiplyMatrices(T, new THREE.Matrix4().makeTranslation(0, 0.81, 0)), 'metal');
    this.coverFor(x, z, ry);
  }

  litter() {
    const R = this.R;
    const paper = new THREE.PlaneGeometry(0.21, 0.3);
    for (let i = 0; i < 260; i++) {
      const cross = R() < 0.3;
      const along = (R() - 0.5) * (cross ? 120 : 180);
      const across = (R() < 0.5 ? -1 : 1) * (6.5 + R() * 4);
      const x = cross ? along : across, z = cross ? across : along;
      const y = Math.abs(across) > 7 ? 0.152 : 0.003;
      this.mesh(paper, 'paper', x, y + R() * 0.004, z, -Math.PI / 2 + (R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3, 0.6 + R() * 0.8, 0.6 + R() * 0.8, 1, null, { worldUV: false });
    }
    // trash bag piles along building fronts
    const bag = new THREE.SphereGeometry(0.32, 12, 9);
    for (let i = 0; i < 26; i++) {
      const side = R() < 0.5 ? -1 : 1;
      const cross = R() < 0.3;
      const along = (R() - 0.5) * (cross ? 100 : 170);
      if (Math.abs(along) < 13) continue;
      const bx = cross ? along : side * 10.35, bz = cross ? side * 10.35 : along;
      const n = 2 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        this.mesh(bag, 'trashbag', bx + (R() - 0.5) * 0.9, 0.15 + 0.2 + (k > 2 ? 0.35 : 0), bz + (R() - 0.5) * 1.2, R(), R() * 6, R(), 1 + R() * 0.3, 0.75 + R() * 0.3, 1 + R() * 0.2);
      }
      for (let k = 0; k < 2; k++) this.box(bx + (R() - 0.5) * 1.4, 0.15 + 0.18, bz + (R() - 0.5) * 1.4, 0.5, 0.36, 0.4, 'wood', { ry: R() * 3, uvScale: 0.8 });
    }
    // scattered tires
    const tire = new THREE.TorusGeometry(0.3, 0.12, 8, 18);
    for (let i = 0; i < 14; i++) {
      const x = (R() - 0.5) * 16, z = (R() - 0.5) * 170;
      if (Math.abs(z) < 12) continue;
      this.mesh(tire, 'rubber', x, 0.12, z, Math.PI / 2 + (R() - 0.5) * 0.3, 0, R() * 3, 1, 1, 1, null, { worldUV: false });
    }
  }

  tree(x, z) {
    const R = this.R;
    // planter
    this.box(x, 0.3, z, 1.3, 0.3, 1.3, 'concreteDark', { collide: true });
    this.box(x, 0.46, z, 1.1, 0.04, 1.1, 'dirt');
    const leafGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const branch = (p, dir, len, rad, depth) => {
      const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 7);
      g.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
      this.add(g, 'bark', m);
      const end = p.clone().addScaledVector(dir, len);
      if (depth >= 3 || rad < 0.03) {
        const n = 5 + Math.floor(R() * 4);
        for (let k = 0; k < n; k++) {
          const lp = end.clone().add(new THREE.Vector3((R() - 0.5) * 1.2, (R() - 0.3) * 0.9, (R() - 0.5) * 1.2));
          const s = 0.8 + R() * 0.7;
          this.mesh(leafGeo, 'leaves', lp.x, lp.y, lp.z, R() * 3, R() * 3, R() * 3, s, s, s, null, { worldUV: false });
        }
        return;
      }
      const kids = depth === 0 ? 3 : 2 + (R() < 0.4 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const nd = dir.clone().add(new THREE.Vector3((R() - 0.5) * 1.4, 0.35 + R() * 0.5, (R() - 0.5) * 1.4)).normalize();
        branch(end, nd, len * (0.62 + R() * 0.15), rad * 0.62, depth + 1);
      }
    };
    const h = 2.4 + R() * 1.2;
    branch(new THREE.Vector3(x, 0.45, z), new THREE.Vector3((R() - 0.5) * 0.15, 1, (R() - 0.5) * 0.15).normalize(), h, 0.13 + R() * 0.04, 0);
    this.collider(x - 0.18, 0, z - 0.18, x + 0.18, 4, z + 0.18, 'wood');
  }

  coverFor(x, z, ry) {
    // points on both long sides of an obstacle
    const dx = Math.cos(ry), dz = -Math.sin(ry);
    this.coverPoints.push(new THREE.Vector3(x + dx * 1.6, 0, z + dz * 1.6), new THREE.Vector3(x - dx * 1.6, 0, z - dz * 1.6));
  }

  jersey(x, z, ry) {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.08); s.lineTo(0.11, 0.3); s.lineTo(0.08, 0.81); s.lineTo(-0.08, 0.81); s.lineTo(-0.11, 0.3); s.lineTo(-0.3, 0.08); s.lineTo(-0.3, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 });
    g.translate(0, 0, -1.5);
    g.computeVertexNormals();
    this.mesh(g, 'concrete', x, 0, z, 0, ry, 0);
    const T = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.41, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    this.colliderFromBox(0.6, 0.82, 3.0, T, 'concrete');
    this.coverFor(x, z, ry);
  }

  sandbags(x, z, ry, n) {
    const R = this.R;
    const T = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const bag = new RoundedBoxGeometry(0.62, 0.17, 0.36, 3, 0.075);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 0.31;
      const count = n - (r === rows - 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const lx = -((n - 1) * 0.6) / 2 + i * 0.6 + off - (r % 2 ? 0.15 : 0);
        for (const lz of [-0.2, 0.2]) {
          this.mesh(bag, 'cloth', lx + (R() - 0.5) * 0.04, 0.085 + r * 0.155, lz + (R() - 0.5) * 0.04, (R() - 0.5) * 0.12, (R() - 0.5) * 0.2, (R() - 0.5) * 0.1, 1 + (R() - 0.5) * 0.1, 1, 1, T);
        }
      }
    }
    const len = n * 0.6;
    this.colliderFromBox(len, rows * 0.155 + 0.05, 0.8, new THREE.Matrix4().multiplyMatrices(T, new THREE.Matrix4().makeTranslation(0, (rows * 0.155) / 2, 0)), 'cloth');
    this.coverFor(x, z, ry);
  }

  container(x, z, ry, mat, y = 0) {
    const T = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const P = { parent: T };
    const L = 6.06, Wd = 2.44, H = 2.59;
    this.box(0, H / 2, 0, Wd - 0.1, H - 0.1, L - 0.1, mat, { ...P, uvScale: 3.6 });
    // frame rails
    for (const sx of [-1, 1]) for (const sy of [0, 1]) this.box(sx * (Wd / 2 - 0.05), 0.08 + sy * (H - 0.16), 0, 0.12, 0.16, L, 'metal', P);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(sx * (Wd / 2 - 0.08), H / 2, sz * (L / 2 - 0.08), 0.16, H, 0.16, 'metal', P);
    // door lock bars
    for (let i = 0; i < 4; i++) this.mesh(new THREE.CylinderGeometry(0.025, 0.025, H - 0.3, 6), 'metal', -0.9 + i * 0.6, H / 2, L / 2 + 0.02, 0, 0, 0, 1, 1, 1, T);
    this.colliderFromBox(Wd, H, L, new THREE.Matrix4().multiplyMatrices(T, new THREE.Matrix4().makeTranslation(0, H / 2, 0)), 'metal');
    if (y === 0) this.coverFor(x, z, ry);
  }

  crate(x, z, stack) {
    const s = 1.1, y = stack ? s : 0;
    const ry = this.R() * 0.5;
    const T = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.15 + y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const P = { parent: T };
    this.box(0, s / 2, 0, s - 0.04, s - 0.04, s - 0.04, 'wood', P);
    const e = 0.09;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      this.box(a * (s / 2 - e / 2), s / 2, b * (s / 2 - e / 2), e, s, e, 'wood', { ...P, uvScale: 0.9 });
      this.box(0, s / 2 + a * (s / 2 - e / 2), b * (s / 2 - e / 2), s, e, e, 'wood', { ...P, uvScale: 0.9 });
      this.box(a * (s / 2 - e / 2), s / 2 + b * (s / 2 - e / 2), 0, e, e, s, 'wood', { ...P, uvScale: 0.9 });
    }
    this.colliderFromBox(s, s, s, new THREE.Matrix4().multiplyMatrices(T, new THREE.Matrix4().makeTranslation(0, s / 2, 0)), 'wood');
  }

  barrel(x, z, mat, burning) {
    const g = new THREE.CylinderGeometry(0.3, 0.3, 0.88, 20, 1, burning);
    this.mesh(g, mat, x, 0.15 + 0.44, z);
    const rib = new THREE.TorusGeometry(0.305, 0.018, 6, 24);
    for (const y of [0.3, 0.58]) this.mesh(rib, mat, x, 0.15 + y, z, Math.PI / 2, 0, 0);
    this.collider(x - 0.3, 0.15, z - 0.3, x + 0.3, 1.03, z + 0.3, 'metal');
  }

  lamp(x, z, dir) {
    const g = new THREE.CylinderGeometry(0.07, 0.11, 7, 10);
    this.mesh(g, 'metal', x, 3.65, z);
    this.box(x + dir * 0.9, 7.1, z, 1.8, 0.08, 0.08, 'metal');
    this.box(x + dir * 1.75, 7.0, z, 0.55, 0.14, 0.28, 'metal');
    this.box(x + dir * 1.75, 6.92, z, 0.45, 0.03, 0.2, 'glassDirty', { worldUV: false });
    this.collider(x - 0.12, 0, z - 0.12, x + 0.12, 7, z + 0.12, 'metal');
  }

  pole(x, z) {
    const g = new THREE.CylinderGeometry(0.13, 0.16, 9, 10);
    this.mesh(g, 'wood', x, 4.65, z);
    this.box(x, 8.6, z, 2.2, 0.12, 0.12, 'wood');
    for (const o of [-0.8, 0, 0.8]) this.mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), 'glassDirty', x + o, 8.72, z);
    if (this.R() < 0.4) this.mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 12), 'metal', x + 0.35, 7.6, z);
    this.collider(x - 0.16, 0, z - 0.16, x + 0.16, 9, z + 0.16, 'wood');
    return new THREE.Vector3(x, 8.75, z);
  }

  wire(a, b, sag) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 4, false);
    this.add(g, 'wire', null, { worldUV: false });
  }

  trafficLight(x, z, sx, sz) {
    this.mesh(new THREE.CylinderGeometry(0.09, 0.1, 5.5, 10), 'metal', x, 2.9, z);
    // arm over the road
    const armLen = 5;
    this.box(x - sx * armLen / 2, 5.5, z, armLen, 0.1, 0.1, 'metal');
    const hx = x - sx * (armLen - 0.4);
    this.box(hx, 5.0, z, 0.35, 1.0, 0.3, 'frame');
    for (let i = 0; i < 3; i++) this.box(hx, 5.3 - i * 0.3, z - sz * 0.16, 0.2, 0.2, 0.02, i === 0 ? 'redLight' : 'glassDirty', { worldUV: false });
    this.collider(x - 0.12, 0, z - 0.12, x + 0.12, 5.6, z + 0.12, 'metal');
  }

  skyline() {
    const R = rng(99);
    for (let i = 0; i < 90; i++) {
      const a = R() * Math.PI * 2;
      const r = 130 + R() * 150;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = 15 + R() * 30, d = 15 + R() * 30, h = 15 + R() * 60;
      this.box(x, h / 2, z, w, h, d, 'skyline', { ry: R() * 0.5 });
      if (R() < 0.3) this.box(x, h + 4, z, 1, 8, 1, 'skyline', { worldUV: false });
    }
  }

  bounds() {
    // invisible walls at play-area edge (streets are closed by end buildings already)
    this.collider(-12, 0, 99, 12, 30, 102, 'concrete');
    this.collider(-12, 0, -102, 12, 30, -99, 'concrete');
    this.collider(69, 0, -12, 72, 30, 12, 'concrete');
    this.collider(-72, 0, -12, -69, 30, 12, 'concrete');
    for (const s of [-1, 1]) for (const e of [-1, 1]) {
      // gaps between street rows and the end buildings
      this.collider(e > 0 ? 10.5 : -32, 0, s > 0 ? 94.5 : -101, e > 0 ? 32 : -10.5, 30, s > 0 ? 101 : -94.5, 'concrete');
      this.collider(e > 0 ? 64.5 : -71, 0, s > 0 ? 10.5 : -32, e > 0 ? 71 : -64.5, 30, s > 0 ? 32 : -10.5, 'concrete');
    }
  }

  // ---------------------------------------------------------------- queries
  // ray vs all AABB colliders. returns {t, point, normal, surf} or null
  raycast(origin, dir, maxDist = 500) {
    let best = maxDist, hit = null, nAxis = 0, nSign = 0;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const ix = 1 / dir.x, iy = 1 / dir.y, iz = 1 / dir.z;
    for (let i = 0, n = this.colliders.length; i < n; i++) {
      const c = this.colliders[i];
      let t1 = (c.min.x - ox) * ix, t2 = (c.max.x - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
      t1 = (c.min.y - oy) * iy; t2 = (c.max.y - oy) * iy;
      let a = Math.min(t1, t2), b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 1; }
      if (b < tmax) tmax = b;
      t1 = (c.min.z - oz) * iz; t2 = (c.max.z - oz) * iz;
      a = Math.min(t1, t2); b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 2; }
      if (b < tmax) tmax = b;
      if (tmax >= Math.max(tmin, 0) && tmin < best && tmin > 0) {
        best = tmin; hit = c; nAxis = ax;
        nSign = ax === 0 ? -Math.sign(dir.x) : ax === 1 ? -Math.sign(dir.y) : -Math.sign(dir.z);
      }
    }
    // ground plane y=0
    if (dir.y < 0) {
      const t = -oy / dir.y;
      if (t > 0 && t < best) { best = t; hit = { surf: 'asphalt' }; nAxis = 1; nSign = 1; }
    }
    if (!hit) return null;
    const normal = new THREE.Vector3(nAxis === 0 ? nSign : 0, nAxis === 1 ? nSign : 0, nAxis === 2 ? nSign : 0);
    return { t: best, point: origin.clone().addScaledVector(dir, best), normal, surf: hit.surf, collider: hit };
  }

  lineOfSight(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    d.divideScalar(len);
    const h = this.raycast(a, d, len);
    return !h || h.t >= len - 0.05;
  }

  // resolve a vertical cylinder-ish AABB against the level. mutates pos, returns {grounded}
  // pos = feet position. radius, height.
  collide(pos, vel, radius, height, stepUp = 0.45) {
    let grounded = false;
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0, n = this.colliders.length; i < n; i++) {
        const c = this.colliders[i];
        if (pos.x + radius <= c.min.x || pos.x - radius >= c.max.x) continue;
        if (pos.z + radius <= c.min.z || pos.z - radius >= c.max.z) continue;
        if (pos.y + height <= c.min.y || pos.y >= c.max.y) continue;
        // penetration depths on each axis
        const top = c.max.y - pos.y;
        if (top <= stepUp && vel.y <= 0.01) {
          pos.y = c.max.y; if (vel.y < 0) vel.y = 0; grounded = true; continue;
        }
        const px1 = c.max.x - (pos.x - radius), px2 = (pos.x + radius) - c.min.x;
        const pz1 = c.max.z - (pos.z - radius), pz2 = (pos.z + radius) - c.min.z;
        const py2 = (pos.y + height) - c.min.y;
        const mx = Math.min(px1, px2), mz = Math.min(pz1, pz2);
        if (py2 < mx && py2 < mz && py2 < 0.5 && vel.y > 0) { pos.y = c.min.y - height; vel.y = 0; continue; }
        if (mx < mz) { pos.x += px1 < px2 ? px1 : -px2; vel.x = 0; }
        else { pos.z += pz1 < pz2 ? pz1 : -pz2; vel.z = 0; }
      }
    }
    if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; grounded = true; }
    // ground probe: stand on something just below?
    if (!grounded) {
      for (const c of this.colliders) {
        if (pos.x + radius * 0.7 <= c.min.x || pos.x - radius * 0.7 >= c.max.x) continue;
        if (pos.z + radius * 0.7 <= c.min.z || pos.z - radius * 0.7 >= c.max.z) continue;
        if (Math.abs(pos.y - c.max.y) < 0.02 && vel.y <= 0) { grounded = true; break; }
      }
    }
    return grounded;
  }
}
