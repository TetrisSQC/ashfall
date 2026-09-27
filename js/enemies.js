// Hostile infantry: textured, skinned soldier model (Mixamo rig) driven by an invisible
// procedural control rig: locomotion, cover-seeking AI, burst fire, hit zones, death falls.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { SOLDIER } from './soldierdata.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// bones the retargeter drives, by short Mixamo name
const RIG = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const CHILD = { LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot' };
const shortName = (n) => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');

let SHARED = null;
export const debugShared = () => SHARED;

// ---- decoding of the packed soldier data (see soldierdata.js)
function bytes(str) { const bin = atob(str), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function dequant(q, comps) {
  const src = new Uint16Array(bytes(q.q).buffer), out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) { const k = i % comps; out[i] = q.min[k] + (src[i] / 65535) * (q.max[k] - q.min[k]); }
  return out;
}
function buildGeo(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dequant(m.pos, 3), 3));
  const n = new Int8Array(bytes(m.nrm).buffer), nf = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) nf[i] = n[i] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nf, 3));
  if (m.uv) g.setAttribute('uv', new THREE.BufferAttribute(dequant(m.uv, 2), 2));
  if (m.si) {
    g.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(bytes(m.si), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(bytes(m.sw), 4, true));
  }
  const ib = bytes(m.idx).buffer;
  g.setIndex(new THREE.BufferAttribute(m.big ? new Uint32Array(ib) : new Uint16Array(ib), 1));
  return g;
}
function loadTex(url, srgb) {
  if (!url) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; res(t); };
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Build the soldier template, the rifle and the grip data once. Must finish before any Enemy is created.
export async function loadSoldier() {
  if (SHARED) return SHARED;
  const D = SOLDIER;
  const mats = {};
  await Promise.all(Object.entries(D.mats).map(async ([name, m]) => {
    const [map, normalMap, rm] = await Promise.all([loadTex(m.map, true), loadTex(m.normal, false), loadTex(m.rm, false)]);
    mats[name] = new THREE.MeshStandardMaterial({
      name, color: new THREE.Color().fromArray(m.color), map, normalMap, roughnessMap: rm, metalnessMap: rm,
      roughness: m.rough ?? 1, metalness: m.metal ?? 0, transparent: !!m.transparent, alphaTest: m.transparent ? 0.3 : 0,
    });
  }));
  // skeleton from world-space bind pose
  const tmpl = new THREE.Group();
  const bones = D.bones.map((b) => { const o = new THREE.Bone(); o.name = b.n; return o; });
  const world = D.bones.map((b) => new THREE.Matrix4().compose(new THREE.Vector3().fromArray(b.t), new THREE.Quaternion().fromArray(b.q), new THREE.Vector3(1, 1, 1)));
  D.bones.forEach((b, i) => {
    const local = b.p >= 0 ? world[b.p].clone().invert().multiply(world[i]) : world[i].clone();
    local.decompose(bones[i].position, bones[i].quaternion, bones[i].scale);
    (b.p >= 0 ? bones[b.p] : tmpl).add(bones[i]);
  });
  tmpl.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const m of D.meshes) {
    const sm = new THREE.SkinnedMesh(buildGeo(m), mats[m.mat]);
    sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    tmpl.add(sm);
    sm.bind(skeleton, new THREE.Matrix4());
  }
  for (const p of D.props) {
    const mesh = new THREE.Mesh(buildGeo(p), mats[p.mat]);
    mesh.castShadow = true;
    bones[p.bone].add(mesh);
  }
  // rest pose in model space (feet at origin, facing +z)
  const rest = {};
  for (const o of bones) {
    const n = shortName(o.name);
    if (RIG.includes(n)) rest[n] = { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()) };
  }
  for (const n of Object.keys(CHILD)) rest[n].dir = rest[CHILD[n]].p.clone().sub(rest[n].p).normalize();
  rest.len = {
    upper: rest.RightForeArm.p.distanceTo(rest.RightArm.p),
    fore: rest.RightHand.p.distanceTo(rest.RightForeArm.p),
  };
  // rifle (AKS-74U) in its own frame: barrel +z, up +y
  const gun = new THREE.Group();
  for (const g of D.gun) { const m = new THREE.Mesh(buildGeo(g), mats[g.mat]); m.castShadow = true; gun.add(m); }
  // grip data sampled from the model's idle animation
  const rig = D.rig;
  const grip = {};
  for (const side of ['Left', 'Right']) {
    const h = rig.hands[side];
    grip[side] = { pos: new THREE.Vector3().fromArray(h.pos), quat: new THREE.Quaternion().fromArray(h.quat), pole: new THREE.Vector3().fromArray(h.pole) };
  }
  const fingers = Object.entries(rig.fingers).map(([n, q]) => [shortName(n), new THREE.Quaternion().fromArray(q)]);
  // gun poses in control-spine space (spine sits 1.03 m above the feet at rest)
  const spineY = 1.03;
  const low = { pos: new THREE.Vector3().fromArray(rig.lowReady.pos).sub(new THREE.Vector3(0, spineY, 0)), quat: new THREE.Quaternion().fromArray(rig.lowReady.quat) };
  const butt = new THREE.Vector3().fromArray(rig.butt), muzzle = new THREE.Vector3().fromArray(rig.muzzle);
  const shoulder = rest.RightArm.p.clone().sub(new THREE.Vector3(0, spineY, 0));
  const pocket = shoulder.add(new THREE.Vector3(0.07, 0.05, 0.07)); // just inside the right shoulder joint
  // low ready: upper-body rotations of the source idle frame + rifle pose relative to the chest bone
  const upper = Object.entries(rig.upper).map(([n, q]) => [n, new THREE.Quaternion().fromArray(q)]);
  const gunInChest = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(rig.gunInChest.pos), new THREE.Quaternion().fromArray(rig.gunInChest.quat), new THREE.Vector3(1, 1, 1));
  SHARED = { tmpl, rest, gun, grip, fingers, low, butt, muzzle, pocket, upper, gunInChest };
  return SHARED;
}

export class Enemy {
  constructor(scene, world, pos) {
    this.scene = scene; this.world = world;
    const { tmpl, gun, fingers, muzzle } = SHARED;
    const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };

    this.root = new THREE.Group();
    this.root.position.copy(pos);
    scene.add(this.root);
    this.body = grp(this.root);                       // pivot for death fall
    // invisible control rig (joint conventions: limbs hang along -y at rest)
    this.hips = grp(this.body, 0, 0.95, 0);
    this.spine = grp(this.hips, 0, 0.08, 0);
    this.head = grp(this.spine, 0, 0.62, 0.02);
    const arm = (side) => {
      const sh = grp(this.spine, side * 0.2, 0.42, 0);
      const el = grp(sh, 0, -0.28, 0);
      return { sh, el };
    };
    this.armR = arm(-1); this.armL = arm(1);
    const leg = (side) => {
      const hp = grp(this.hips, side * 0.1, -0.05, 0);
      const kn = grp(hp, 0, -0.43, 0);
      return { hp, kn };
    };
    this.legR = leg(-1); this.legL = leg(1);
    // rifle at the shoulder
    this.gun = grp(this.spine);
    this.gun.add(gun.clone());
    this.muzzle = grp(this.gun, muzzle.x, muzzle.y, muzzle.z + 0.02);

    // visible soldier
    this.model = SkeletonUtils.clone(tmpl);
    this.body.add(this.model);
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) { const n = shortName(o.name); if (RIG.includes(n) || /Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(n)) this.bones[n] = o; } });
    this.ready = 0; // 0 = shouldered / aiming, 1 = low ready
    // fingers keep the grip pose from the source animation
    for (const [n, q] of fingers) if (this.bones[n]) this.bones[n].quaternion.copy(q);

    this.hp = 100;
    this.alive = true;
    this.state = 'advance';
    this.target = null;
    this.speed = 0;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = Math.random() * 10;
    this.burstLeft = 0; this.shotTimer = 0; this.burstCooldown = 1 + Math.random() * 2;
    this.stateTimer = 0; this.stuckTimer = 0; this.lastPos = pos.clone();
    this.awareness = 0;
    this.deathT = 0; this.deathAxis = new THREE.Vector3(1, 0, 0);
    this.flinch = 0;
    this.crouch = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }

  // ---- retargeting: drive the Mixamo skeleton from the control rig
  setBoneWorld(bone, worldQ) {
    bone.parent.getWorldQuaternion(_qp);
    bone.quaternion.copy(_qp.invert().multiply(worldQ));
    bone.updateMatrixWorld(true);
  }

  // rotation of a control-rig group relative to the body
  rel(group, out) { return out.copy(_qb).invert().multiply(group.getWorldQuaternion(_q2)); }

  // world quaternion = delta(body frame) * rest
  applyDelta(name, delta) {
    const r = SHARED.rest[name];
    _q.copy(_qb).multiply(delta).multiply(r.q);
    this.setBoneWorld(this.bones[name], _q);
  }

  // aim a limb bone along a world direction (minimal rotation from its rest direction)
  aim(name, dirW) {
    const r = SHARED.rest[name];
    const restW = _v3.copy(r.dir).applyQuaternion(_qb);
    const align = new THREE.Quaternion().setFromUnitVectors(restW, dirW);
    _q.copy(_qb).multiply(r.q).premultiply(align);
    this.setBoneWorld(this.bones[name], _q);
    return align;
  }

  retarget() {
    const B = this.bones, R = SHARED.rest;
    this.body.updateMatrixWorld(true);
    this.body.getWorldQuaternion(_qb);
    const dHips = this.rel(this.hips, new THREE.Quaternion());
    const dSpine = this.rel(this.spine, new THREE.Quaternion());
    const dHead = this.rel(this.head, new THREE.Quaternion());
    // hips translation follows the control rig's pelvis offset
    const hp = this.body.worldToLocal(this.hips.getWorldPosition(new THREE.Vector3()));
    const want = R.Hips.p.clone().add(hp.sub(new THREE.Vector3(0, 0.95, 0)));
    this.body.localToWorld(want);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(want));
    this.applyDelta('Hips', dHips);
    const q = new THREE.Quaternion();
    this.applyDelta('Spine', q.slerpQuaternions(dHips, dSpine, 0.34));
    this.applyDelta('Spine1', q.slerpQuaternions(dHips, dSpine, 0.67));
    this.applyDelta('Spine2', dSpine);
    this.applyDelta('LeftShoulder', dSpine);
    this.applyDelta('RightShoulder', dSpine);
    this.applyDelta('Neck', q.slerpQuaternions(dSpine, dHead, 0.5));
    this.applyDelta('Head', dHead);
    // legs from control-rig joint positions
    for (const [side, L] of [['Left', this.legL], ['Right', this.legR]]) {
      const hipW = L.hp.getWorldPosition(new THREE.Vector3());
      const kneeW = L.kn.getWorldPosition(new THREE.Vector3());
      const ankleW = L.kn.localToWorld(new THREE.Vector3(0, -0.44, 0));
      this.aim(side + 'UpLeg', kneeW.clone().sub(hipW).normalize());
      this.aim(side + 'Leg', ankleW.clone().sub(kneeW).normalize());
      this.applyDelta(side + 'Foot', this.rel(L.kn, q));
    }
    // low ready: pull the upper body toward the source idle frame and carry the rifle with the chest
    if (this.alive && this.ready > 0.001) {
      for (const [n, uq] of SHARED.upper) if (B[n]) B[n].quaternion.slerp(uq, this.ready);
      B.Spine.updateMatrixWorld(true);
      const t = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
      B.Spine2.matrixWorld.decompose(t, qq, sc);
      const lowW = new THREE.Matrix4().compose(t, qq, new THREE.Vector3(1, 1, 1)).multiply(SHARED.gunInChest);
      const lp = new THREE.Vector3(), lq = new THREE.Quaternion();
      lowW.decompose(lp, lq, sc);
      const ap = this.gun.getWorldPosition(new THREE.Vector3()), aq = this.gun.getWorldQuaternion(new THREE.Quaternion());
      ap.lerp(lp, this.ready); aq.slerp(lq, this.ready);
      // back into the control spine's local space
      const pq = this.gun.parent.getWorldQuaternion(new THREE.Quaternion());
      this.gun.position.copy(this.gun.parent.worldToLocal(ap));
      this.gun.quaternion.copy(pq.invert().multiply(aq));
      this.gun.updateMatrixWorld(true);
    }
    // arms: hands placed exactly where the source animation holds the rifle
    const G = SHARED.grip;
    const gq = this.gun.getWorldQuaternion(new THREE.Quaternion());
    for (const [side, A] of [['Left', this.armL], ['Right', this.armR]]) {
      const S = B[side + 'Arm'].getWorldPosition(new THREE.Vector3());
      let up, fore;
      if (this.alive) {
        const local = G[side].pos.clone();
        let wrist = this.gun.localToWorld(local.clone());
        // support hand slides back along the handguard until the arm can reach it
        for (let i = 0; i < 12 && side === 'Left' && S.distanceTo(wrist) > R.len.upper + R.len.fore - 0.01; i++) {
          local.z -= 0.025;
          wrist = this.gun.localToWorld(local.clone());
        }
        [up, fore] = ik(S, wrist, R.len.upper, R.len.fore, G[side].pole.clone().applyQuaternion(_qb).normalize());
      } else {
        const e = A.el.getWorldPosition(new THREE.Vector3()), h = A.el.localToWorld(new THREE.Vector3(0, -0.28, 0));
        up = e.clone().sub(A.sh.getWorldPosition(new THREE.Vector3())).normalize();
        fore = h.sub(e).normalize();
      }
      this.aim(side + 'Arm', up);
      const align = this.aim(side + 'ForeArm', fore);
      if (this.alive) _q.copy(gq).multiply(G[side].quat);
      else _q.copy(_qb).multiply(R[side + 'Hand'].q).premultiply(align);
      this.setBoneWorld(B[side + 'Hand'], _q);
    }
  }

  eyePos(out) { return out.set(this.root.position.x, this.root.position.y + 1.6 - this.crouch * 0.5, this.root.position.z); }

  // analytic hit test. returns {t, zone} or null
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    this.root.updateMatrixWorld(true);
    let best = null;
    const test = (t, zone) => { if (t !== null && t > 0 && t < maxT && (!best || t < best.t)) best = { t, zone }; };
    const hp = this.head.getWorldPosition(_v);
    test(raySphere(o, d, hp, 0.15), 'head');
    const hipW = this.hips.getWorldPosition(_v2);
    const neck = _v3.set(0, 0.54, 0); this.spine.localToWorld(neck);
    test(rayCapsule(o, d, hipW, neck, 0.25), 'body');
    const foot = new THREE.Vector3(this.root.position.x, this.root.position.y + 0.1, this.root.position.z);
    test(rayCapsule(o, d, foot, hipW, 0.17), 'legs');
    return best;
  }

  damage(amount, dir, zone) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flinch = 1;
    this.awareness = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      _v.set(dir.x, 0, dir.z).normalize();
      this.deathAxis.crossVectors(new THREE.Vector3(0, 1, 0), _v).normalize();
      this.deathStyle = zone === 'head' ? 1 : Math.random() < 0.5 ? 0 : 2;
      return true;
    }
    return false;
  }

  update(dt, ctx) {
    const { player, audio, effects, enemies, coverPoints } = ctx;
    if (!this.alive) { this.updateDeath(dt); return; }
    const pos = this.root.position;
    const eye = this.eyePos(new THREE.Vector3());
    const pHead = player.headPos(new THREE.Vector3());
    const toP = _v.subVectors(pHead, eye);
    const dist = toP.length();
    const sees = dist < 110 && this.world.lineOfSight(eye, pHead);
    this.awareness = sees ? Math.min(1, this.awareness + dt * 0.8) : Math.max(0.35, this.awareness - dt * 0.1);
    this.unseen = sees ? 0 : (this.unseen || 0) + dt;
    this.stateTimer -= dt;
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this._firingRecent = this.burstLeft > 0 || this.shotTimer > -0.8 || (sees && this.awareness > 0.8 && dist < 45);

    // --- decisions
    if (this.state === 'advance') {
      if (!this.target || this.stateTimer < 0) this.pickCover(coverPoints, player);
      const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) { this.state = 'cover'; this.stateTimer = 3 + Math.random() * 5; }
      else this.moveToward(this.target, dt, sees && dist < 30 ? 2.2 : 3.6);
      // shoot while moving if very aware
      if (sees && this.awareness > 0.8 && dist < 45) this.combat(dt, dist, sees, player, audio, effects);
    } else if (this.state === 'cover') {
      this.speed = damp(this.speed, 0, 8, dt);
      // strafe a little to peek
      if (sees) {
        _v2.set(-toP.z, 0, toP.x).normalize().multiplyScalar(this.strafeDir * 0.8);
        this.vel.x = damp(this.vel.x, _v2.x, 3, dt); this.vel.z = damp(this.vel.z, _v2.z, 3, dt);
        if (Math.random() < dt * 0.4) this.strafeDir *= -1;
      } else { this.vel.x = damp(this.vel.x, 0, 6, dt); this.vel.z = damp(this.vel.z, 0, 6, dt); }
      this.crouch = damp(this.crouch, sees ? 0 : 1, 4, dt);
      pos.x += this.vel.x * dt; pos.z += this.vel.z * dt;
      this.speed = Math.hypot(this.vel.x, this.vel.z);
      this.combat(dt, dist, sees, player, audio, effects);
      if (this.stateTimer < 0 || dist < 6 || (!sees && this.unseen > 3.5)) { this.state = 'advance'; this.target = null; }
    }
    // face player when aware, else travel direction
    let desiredYaw = this.yaw;
    if (this.awareness > 0.5 && (sees || this.state === 'cover')) desiredYaw = Math.atan2(toP.x, toP.z);
    else if (this.vel.lengthSq() > 0.1) desiredYaw = Math.atan2(this.vel.x, this.vel.z);
    let dy = desiredYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);
    this.root.rotation.y = this.yaw;
    this.aimPitch = Math.atan2(toP.y, Math.hypot(toP.x, toP.z));

    // separation
    for (const o of enemies) {
      if (o === this || !o.alive) continue;
      const ddx = pos.x - o.root.position.x, ddz = pos.z - o.root.position.z;
      const dd = ddx * ddx + ddz * ddz;
      if (dd < 1 && dd > 0.0001) { const k = (1 - Math.sqrt(dd)) * dt * 3; pos.x += ddx * k; pos.z += ddz * k; }
    }
    // collide with level
    const v = new THREE.Vector3(this.vel.x, -1, this.vel.z);
    pos.y = Math.max(pos.y - dt * 4, 0);
    this.world.collide(pos, v, 0.3, 1.7);
    // stuck detection
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.5) {
      if (pos.distanceTo(this.lastPos) < 0.6 && this.state === 'advance') { this.target = null; this.strafeDir *= -1; }
      this.lastPos.copy(pos); this.stuckTimer = 0;
    }
    this.animate(dt);
  }

  pickCover(points, player) {
    const pp = player.pos;
    const head = player.headPos(new THREE.Vector3());
    const myD = this.root.position.distanceTo(pp);
    let best = null, bestScore = Infinity;
    const eye = new THREE.Vector3();
    for (const c of points) {
      const dp = c.distanceTo(pp);
      if (dp < 8 || dp > 45) continue;
      const ds = c.distanceTo(this.root.position);
      if (ds > 45) continue;
      eye.set(c.x, 1.5, c.z);
      const los = this.world.lineOfSight(eye, head);
      const score = ds * 0.45 + Math.abs(dp - 18) * 0.8 + (los ? 0 : 16) + (dp > myD + 4 ? 10 : 0) + Math.random() * 7;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (!best || this.unseen > 6) {
      // hunt: push toward the player's position with some flank offset
      const a = Math.random() * Math.PI * 2;
      best = new THREE.Vector3(pp.x + Math.cos(a) * 7, 0, pp.z + Math.sin(a) * 7);
      this.unseen = 0;
    }
    this.target = best.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5));
    this.stateTimer = 12;
  }

  moveToward(t, dt, speed) {
    const pos = this.root.position;
    _v2.set(t.x - pos.x, 0, t.z - pos.z).normalize();
    // simple obstacle avoidance: probe ahead at knee height
    const probe = new THREE.Vector3(pos.x, 0.5, pos.z);
    const h = this.world.raycast(probe, _v2, 1.8);
    if (h && h.t < 1.8) {
      _v3.set(-_v2.z, 0, _v2.x).multiplyScalar(this.strafeDir);
      _v2.lerp(_v3, 0.85).normalize();
    }
    this.vel.x = damp(this.vel.x, _v2.x * speed, 6, dt);
    this.vel.z = damp(this.vel.z, _v2.z * speed, 6, dt);
    pos.x += this.vel.x * dt; pos.z += this.vel.z * dt;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.crouch = damp(this.crouch, 0, 5, dt);
  }

  combat(dt, dist, sees, player, audio, effects) {
    this.shotTimer -= dt;
    this.burstCooldown -= dt;
    if (!sees || this.awareness < 0.6 || this.flinch > 0.5) return;
    if (this.burstLeft <= 0 && this.burstCooldown <= 0) { this.burstLeft = 3 + Math.floor(Math.random() * 4); }
    if (this.burstLeft > 0 && this.shotTimer <= 0 && this.ready < 0.35) {
      this.burstLeft--; this.shotTimer = 0.1 + Math.random() * 0.04;
      if (this.burstLeft === 0) this.burstCooldown = 0.9 + Math.random() * 1.4;
      this.shoot(dist, player, audio, effects);
    }
  }

  shoot(dist, player, audio, effects) {
    const mz = this.muzzle.getWorldPosition(new THREE.Vector3());
    const target = player.headPos(new THREE.Vector3()).add(new THREE.Vector3(0, -0.35, 0));
    // hit probability
    let p = 0.42 - dist * 0.008;
    p *= player.moving ? 0.6 : 1;
    p *= player.crouching ? 0.75 : 1;
    p *= this.awareness;
    p = Math.max(0.05, p) * player.difficulty;
    const hit = Math.random() < p;
    const dir = target.clone().sub(mz).normalize();
    if (!hit) {
      const spread = 0.02 + Math.random() * 0.03;
      dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.3) * spread; dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
    }
    const h = this.world.raycast(mz, dir, 200);
    const end = h ? h.point : mz.clone().addScaledVector(dir, 200);
    effects.flash(mz, 25, 0.05, 0xffa850, 8);
    effects.glow.spawn({ pos: mz, life: 0.05, size0: 0.35, size1: 0.2, alpha0: 1, alpha1: 0, color: new THREE.Color(4, 2.6, 1.2) });
    if (Math.random() < 0.5) effects.tracer(mz, end, 300);
    audio.enemyShot(mz);
    if (hit) player.takeDamage(6 + Math.random() * 5, mz);
    else {
      if (h) { effects.impact(h.point, h.normal, h.surf, dir); if (h.t > 3 && h.point.distanceTo(player.pos) < 8) audio.impact(h.point, h.surf); }
      // near miss whiz
      const pp = player.headPos(new THREE.Vector3());
      const toP = pp.clone().sub(mz), proj = toP.dot(dir);
      if (proj > 0) { const closest = mz.clone().addScaledVector(dir, proj); if (closest.distanceTo(pp) < 2.5) audio.whiz(closest); }
    }
  }

  animate(dt) {
    const s = this.speed;
    this.walkPhase += dt * (2.2 + s * 2.1);
    const k = Math.min(1, s / 3.5);
    const ph = this.walkPhase;
    const crouch = this.crouch;
    // legs
    const swing = Math.sin(ph) * 0.7 * k;
    this.legR.hp.rotation.x = -swing - crouch * 1.2;
    this.legL.hp.rotation.x = swing - crouch * 0.4;
    this.legR.kn.rotation.x = Math.max(0, Math.sin(ph + 1.4)) * 1.0 * k + crouch * 1.9;
    this.legL.kn.rotation.x = Math.max(0, Math.sin(ph + Math.PI + 1.4)) * 1.0 * k + crouch * 0.9;
    this.hips.position.y = 0.95 - Math.abs(Math.cos(ph)) * 0.05 * k - crouch * 0.45;
    this.hips.rotation.y = Math.sin(ph) * 0.12 * k;
    // shouldered when fighting, low ready when running without shooting
    const wantLow = this.readyOverride ?? (this._firingRecent ? 0 : s > 2.6 ? 1 : this.awareness > 0.7 ? 0 : 1);
    this.ready = damp(this.ready, wantLow, 6, dt);
    const aimK = 1 - this.ready, pitch = this.aimPitch || 0;
    // spine leans into motion, bladed stance (right shoulder back) while aiming
    this.spine.rotation.x = 0.12 * k + crouch * 0.25 - pitch * 0.5 - this.flinch * 0.3 + this.ready * 0.08;
    this.spine.rotation.y = -this.hips.rotation.y - 0.5 * aimK;
    // cheek on the stock: head drops and cants toward the rifle
    this.head.rotation.set(-pitch * 0.4 + 0.2 * aimK, 0.22 * aimK, -0.12 * aimK);
    // rifle: aim = barrel forward with the butt in the shoulder pocket, low = the source idle pose
    const S0 = SHARED;
    const aimQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * 0.5, 0.5, 0));
    const aimP = S0.pocket.clone().sub(S0.butt.clone().applyQuaternion(aimQ));
    this.gun.quaternion.copy(aimQ);
    this.gun.position.copy(aimP);
    this.gun.updateMatrix();
    solveArm(this.armR, -1, _v.copy(SHARED.grip.Right.pos).applyMatrix4(this.gun.matrix));
    solveArm(this.armL, 1, _v.copy(SHARED.grip.Left.pos).applyMatrix4(this.gun.matrix));
    this.retarget();
  }

  updateDeath(dt) {
    this.deathT += dt;
    const t = Math.min(1, this.deathT / (this.deathStyle === 1 ? 0.5 : 0.8));
    const e = t < 1 ? t * t * (1.8 - 0.8 * t) : 1;
    const fall = e * (Math.PI / 2 - 0.08);
    this.body.quaternion.setFromAxisAngle(this.worldToLocalAxis(this.deathAxis), fall);
    // crumple
    this.legR.kn.rotation.x = damp(this.legR.kn.rotation.x, 0.6 + this.deathStyle * 0.3, 6, dt);
    this.legL.kn.rotation.x = damp(this.legL.kn.rotation.x, 0.2, 6, dt);
    this.hips.position.y = damp(this.hips.position.y, 0.95 - (this.deathStyle === 2 ? 0.3 : 0), 5, dt);
    this.armR.sh.rotation.x = damp(this.armR.sh.rotation.x, -2.6, 3, dt);
    this.armL.sh.rotation.x = damp(this.armL.sh.rotation.x, -0.5, 3, dt);
    this.armL.sh.rotation.z = damp(this.armL.sh.rotation.z, -1.2, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, 0.4, 3, dt);
    if (this.deathT > 1.5 && this.gun.parent === this.spine) {
      // drop rifle
      this.gun.getWorldPosition(_v); this.scene.add(this.gun); this.gun.position.set(_v.x + 0.3, 0.04, _v.z); this.gun.rotation.set(0, Math.random() * 6, Math.PI / 2);
    }
    if (this.deathT > 12) this.root.position.y -= dt * 0.3;
    this.retarget();
  }

  worldToLocalAxis(a) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
    return a.clone().applyQuaternion(q);
  }

  dispose() { this.scene.remove(this.root); if (this.gun.parent === this.scene) this.scene.remove(this.gun); }
}

const DOWN = new THREE.Vector3(0, -1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qc = new THREE.Quaternion();
// two-bone IK in world space: returns [upperDir, foreDir]
function ik(S, T, L1, L2, pole) {
  const a = T.clone().sub(S);
  const d = THREE.MathUtils.clamp(a.length(), 0.05, L1 + L2 - 0.002);
  a.normalize();
  const ang = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const n = new THREE.Vector3().crossVectors(a, pole).normalize();
  const up = a.clone().applyAxisAngle(n, ang);
  const E = S.clone().addScaledVector(up, L1);
  return [up, T.clone().sub(E).normalize()];
}

function solveArm(arm, side, target) {
  const L1 = 0.28, L2 = 0.28;
  const S = arm.sh.position;
  _a.subVectors(target, S);
  const d = THREE.MathUtils.clamp(_a.length(), 0.05, L1 + L2 - 0.002);
  _a.normalize();
  const pole = _b.set(side * 0.7, -1, -0.15).normalize();
  const ang = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  _n.crossVectors(_a, pole).normalize();
  const upper = _a.clone().applyAxisAngle(_n, ang);
  const E = S.clone().addScaledVector(upper, L1);
  const fore = _b.subVectors(target, E).normalize();
  _qa.setFromUnitVectors(DOWN, upper);
  arm.sh.quaternion.copy(_qa);
  _qc.setFromUnitVectors(DOWN, fore);
  arm.el.quaternion.copy(_qa.invert().multiply(_qc));
}

function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return null;
  return -b - Math.sqrt(h);
}

// ray vs capsule (segment a-b, radius r); iq's formulation
function rayCapsule(ro, rd, pa, pb, r) {
  const ba = new THREE.Vector3().subVectors(pb, pa), oa = new THREE.Vector3().subVectors(ro, pa);
  const baba = ba.dot(ba), bard = ba.dot(rd), baoa = ba.dot(oa), rdoa = rd.dot(oa), oaoa = oa.dot(oa);
  const a = baba - bard * bard;
  const b = baba * rdoa - baoa * bard;
  const c = baba * oaoa - baoa * baoa - r * r * baba;
  const h = b * b - a * c;
  if (h >= 0) {
    const t = (-b - Math.sqrt(h)) / a;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
    const oc = y <= 0 ? oa : new THREE.Vector3().subVectors(ro, pb);
    const bb = rd.dot(oc), cc = oc.dot(oc) - r * r;
    const hh = bb * bb - cc;
    if (hh > 0) return -bb - Math.sqrt(hh);
  }
  return null;
}
