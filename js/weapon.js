// First-person viewmodel: HK G36 (baked mesh) + gloved arms built from primitives,
// with procedural animation (sway, bob, recoil springs, ADS, sprint, reload, melee).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Gen, spriteTex } from './textures.js';
import { G36, decodeChunk } from './g36.js';

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ease = (t) => t * t * (3 - 2 * t);

class Spring {
  constructor(k = 120, d = 14) { this.k = k; this.d = d; this.x = new THREE.Vector3(); this.v = new THREE.Vector3(); }
  update(dt) {
    const a = this.x.clone().multiplyScalar(-this.k).addScaledVector(this.v, -this.d);
    this.v.addScaledVector(a, dt); this.x.addScaledVector(this.v, dt);
  }
  impulse(x, y, z) { this.v.x += x; this.v.y += y; this.v.z += z; }
}

export class Weapon {
  constructor(renderer, audio) {
    this.audio = audio;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
    this.scene.add(this.camera);
    this.root = new THREE.Group();      // animated pivot
    this.camera.add(this.root);
    this.buildLights();
    this.buildModel();

    // state
    this.stats = { name: 'HK G36', rpm: 800, damage: 34, mag: 30, reserveMax: 180, reload: 2.35, reloadEmpty: 2.8, hipSpread: 0.03, adsSpread: 0.0015, range: 250 };
    this.ammo = 30; this.reserve = 150;
    this.cooldown = 0;
    this.aim = 0; this.sprint = 0; this.reloading = 0; this.reloadDur = 1; this.reloadEmpty = false;
    this.melee = 0; this.throwT = 0; this.equipT = 0.6;
    this.bobPhase = 0; this.bobAmt = 0;
    this.swayTarget = new THREE.Vector2(); this.sway = new THREE.Vector2();
    this.kickPos = new Spring(180, 16); this.kickRot = new Spring(160, 13);
    this.land = new Spring(90, 10);
    this.flashT = 1;
    this.breath = 0;
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xcfd8e6, 0x4a3d30, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd7a8, 2.2);
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0x9fb4cc, 0.35);
    this.fill.position.set(-1, 0.2, 1);
    this.camera.add(this.fill);
    this.flashLight = new THREE.PointLight(0xffa850, 0, 2.5, 2);
    this.root.add(this.flashLight);
  }

  buildModel() {
    const M = {};
    const gm = Gen.gunMetal(256, 0x1e1f21, 0.42);
    M.metal = new THREE.MeshStandardMaterial({ map: gm.map, normalMap: gm.normalMap, roughnessMap: gm.roughnessMap, metalnessMap: gm.metalnessMap, roughness: 1, metalness: 1, envMapIntensity: 1.1 });
    const pb = Gen.polymer(256, 0x1f1e1c);
    M.poly = new THREE.MeshStandardMaterial({ map: pb.map, normalMap: pb.normalMap, roughnessMap: pb.roughnessMap, roughness: 1, metalness: 0 });
    const gl = Gen.cloth(256, 0x2c2a26);
    M.glove = new THREE.MeshStandardMaterial({ map: gl.map, normalMap: gl.normalMap, roughness: 0.85, color: 0xbbbbbb });
    const gl2 = Gen.polymer(256, 0x4a4238);
    M.knuckle = new THREE.MeshStandardMaterial({ map: gl2.map, normalMap: gl2.normalMap, roughness: 0.7 });
    const cm = Gen.camo(512);
    cm.map.repeat.set(2, 2); cm.normalMap.repeat.set(2, 2);
    M.sleeve = new THREE.MeshStandardMaterial({ map: cm.map, normalMap: cm.normalMap, roughness: 0.95 });
    M.lens = new THREE.MeshStandardMaterial({ color: 0x1c2a33, metalness: 0.6, roughness: 0.25, transparent: true, opacity: 0.18, envMapIntensity: 0.5, depthWrite: false });
    M.brass = new THREE.MeshStandardMaterial({ color: 0xc09a50, metalness: 1, roughness: 0.3 });
    this.M = M;

    const gun = this.gun = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = gun) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
    };
    const rb = (w, h, d, r = 0.004, s = 2) => new RoundedBoxGeometry(w, h, d, s, r);

    // --- HK G36 (baked mesh data, see g36data.js for attribution)
    const g36Mat = (c) => {
      if (c.m === 'Material.012') return M.lens;
      if (c.m === 'Material.001' || c.m === 'Material.002' || c.m === 'Material.003') return M.brass;
      if (c.m === 'Material.006') return M.g36mag;
      if (c.m === 'Material.011') return M.metal;
      const k = c.c[0] * 1.4 + 0.009;
      const key = 'g36_' + c.m;
      if (!M[key]) M[key] = new THREE.MeshStandardMaterial({ color: new THREE.Color(k, k, k * 1.04), roughness: c.m === 'Material.009' ? 0.5 : 0.78, metalness: c.m === 'Material.009' ? 0.45 : 0.0, envMapIntensity: 0.55, side: THREE.DoubleSide });
      return M[key];
    };
    M.g36mag = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.055, 0.046), roughness: 0.32, metalness: 0, transparent: true, opacity: 0.9 });
    const buildPart = (chunks, parent, pivot) => {
      for (const c of chunks) {
        const g = decodeChunk(c);
        if (pivot) g.translate(-pivot.x, -pivot.y, -pivot.z);
        const mesh = new THREE.Mesh(g, g36Mat(c));
        parent.add(mesh);
      }
    };
    buildPart(G36.body, gun);
    this.bolt = new THREE.Group(); gun.add(this.bolt);
    buildPart(G36.bolt, this.bolt);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.004, -0.64); gun.add(this.muzzle);
    this.mag = new THREE.Group();
    const magPivot = new THREE.Vector3(0, -0.02, -0.06);
    this.mag.position.copy(magPivot);
    gun.add(this.mag);
    buildPart(G36.mag, this.mag, magPivot);
    this.magRest = this.mag.position.clone();
    // --- red dot optic
    const optic = new THREE.Group(); optic.position.set(0, 0.123, 0.07); gun.add(optic);
    add(rb(0.03, 0.012, 0.05, 0.003), M.metal, 0, -0.016, 0, 0, 0, 0, optic);         // mount
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 20, 1, true).rotateX(Math.PI / 2), M.metal, 0, 0.006, 0, 0, 0, 0, optic);
    // inner wall of the tube (the open cylinder is single-sided, so its inside would be culled)
    add(new THREE.CylinderGeometry(0.0185, 0.0185, 0.07, 20, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.85, side: THREE.BackSide }), 0, 0.006, 0, 0, 0, 0, optic);
    add(new THREE.TorusGeometry(0.02, 0.003, 8, 24), M.metal, 0, 0.006, -0.035, 0, 0, 0, optic);
    add(new THREE.TorusGeometry(0.02, 0.003, 8, 24), M.metal, 0, 0.006, 0.035, 0, 0, 0, optic);
    add(rb(0.012, 0.012, 0.02, 0.003), M.metal, 0.024, 0.006, 0.0, 0, 0, 0, optic);   // brightness knob
    add(rb(0.012, 0.012, 0.018, 0.003), M.metal, 0, 0.03, 0.0, 0, 0, 0, optic);       // elevation turret
    const lens = add(new THREE.CircleGeometry(0.018, 24), M.lens, 0, 0.006, -0.03, 0, 0, 0, optic);
    lens.renderOrder = 5;
    this.dot = new THREE.Group(); this.dot.position.set(0, 0.006, -2.4); optic.add(this.dot);
    add(new THREE.CircleGeometry(0.0068, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.0, 0.03), depthTest: false, depthWrite: false, transparent: true }), 0, 0, 0, 0, 0, 0, this.dot);
    add(new THREE.CircleGeometry(0.013, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.0, 0.0), depthTest: false, depthWrite: false, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }), 0, 0, 0, 0, 0, 0, this.dot);
    this.dot.traverse((o) => { o.renderOrder = 20; });
    this.dot.renderOrder = 20;
    this.opticCenter = new THREE.Vector3(0, 0.123 + 0.006, 0.07);

    // --- arms
    const arms = this.arms = new THREE.Group();
    gun.add(arms);
    const hand = (mirror) => {
      // local frame: +y = toward fingertips, +z = palm normal, -y = forearm
      const h = new THREE.Group();
      add(rb(0.056, 0.075, 0.028, 0.012, 3), M.glove, 0, 0, 0, 0, 0, 0, h);
      add(rb(0.058, 0.03, 0.022, 0.009, 2), M.knuckle, 0, 0.026, -0.012, 0, 0, 0, h);
      add(rb(0.03, 0.03, 0.01, 0.004, 2), M.knuckle, 0, -0.01, -0.016, 0, 0, 0, h); // back-of-hand strap
      const seg = new THREE.CapsuleGeometry(0.0082, 0.018, 4, 8);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Group(); f.position.set(-0.021 + i * 0.014, 0.037 - Math.abs(i - 1.2) * 0.003, 0.002); h.add(f);
        f.rotation.x = 1.0 + i * 0.06;
        add(seg, M.glove, 0, 0.013, 0, 0, 0, 0, f);
        const j = new THREE.Group(); j.position.set(0, 0.028, 0); f.add(j); j.rotation.x = 1.25;
        add(seg, M.glove, 0, 0.011, 0, 0, 0, 0, j);
      }
      const t = new THREE.Group(); t.position.set(0.026, -0.012, 0.012); t.rotation.set(0.7, 0, -0.7); h.add(t);
      add(new THREE.CapsuleGeometry(0.0095, 0.024, 4, 8), M.glove, 0, 0.018, 0, 0, 0, 0, t);
      const t2 = new THREE.Group(); t2.position.set(0, 0.036, 0); t2.rotation.x = 0.6; t.add(t2);
      add(new THREE.CapsuleGeometry(0.0088, 0.016, 4, 8), M.glove, 0, 0.012, 0, 0, 0, 0, t2);
      // cuff, sleeve, rolled cuff
      add(new THREE.CylinderGeometry(0.029, 0.027, 0.045, 14), M.glove, 0, -0.055, -0.002, 0, 0, 0, h);
      add(new THREE.CylinderGeometry(0.038, 0.047, 0.34, 18), M.sleeve, 0, -0.25, -0.004, 0, 0, 0, h);
      add(new THREE.TorusGeometry(0.039, 0.009, 8, 18), M.sleeve, 0, -0.085, -0.004, Math.PI / 2, 0, 0, h);
      add(rb(0.05, 0.05, 0.035, 0.01), M.poly, 0, -0.16, -0.035, 0, 0, 0, h); // watch/gear on sleeve
      if (mirror) h.scale.x = -1;
      return h;
    };
    this.rHand = hand(false); arms.add(this.rHand);
    this.lHand = hand(true); arms.add(this.lHand);
    this.handPose = {
      r: { pos: new THREE.Vector3(0.031, -0.078, 0.103), elbow: new THREE.Vector3(0.13, -0.3, 0.34), palm: new THREE.Vector3(-1, 0.1, 0) },
      l: { pos: new THREE.Vector3(-0.037, 0.016, -0.3), elbow: new THREE.Vector3(-0.19, -0.25, -0.07), palm: new THREE.Vector3(1, 0.25, 0.1) },
      lMag: { pos: new THREE.Vector3(-0.035, -0.12, -0.03), elbow: new THREE.Vector3(-0.2, -0.36, 0.12), palm: new THREE.Vector3(1, 0, 0) },
    };
    this.poseHand(this.rHand, this.handPose.r.pos, this.handPose.r.elbow, this.handPose.r.palm);
    this.poseHand(this.lHand, this.handPose.l.pos, this.handPose.l.elbow, this.handPose.l.palm);

    gun.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.root.add(gun);

    // --- muzzle flash
    const fm = (tex) => new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(4, 3, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    this.muzzle.add(this.flash);
    this.flashFront = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), fm(spriteTex('flash')));
    this.flash.add(this.flashFront);
    const sideTex = spriteTex('flashSide');
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.22, 0.09); g.translate(0.11, 0, 0); g.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(g, fm(sideTex)); m.rotation.z = (i / 3) * Math.PI; this.flash.add(m);
    }
    this.flash.visible = false;
    this.flash.traverse((o) => { o.renderOrder = 30; });

    // poses: gun group local transform
    this.hipPos = new THREE.Vector3(0.14, -0.172, -0.39);
    // ADS: put optic centre on the view axis
    this.adsPos = new THREE.Vector3(-this.opticCenter.x, -this.opticCenter.y, -0.25 - this.opticCenter.z);
    this.ejectPort = new THREE.Object3D(); this.ejectPort.position.set(0.022, 0.03, -0.05); gun.add(this.ejectPort);
  }

  poseHand(h, pos, elbow, palm) {
    const f = pos.clone().sub(elbow).normalize();
    const n = palm.clone().addScaledVector(f, -palm.dot(f)).normalize();
    const x = new THREE.Vector3().crossVectors(f, n);
    h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, f, n));
    h.position.copy(pos);
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  get fireInterval() { return 60 / this.stats.rpm; }
  get isReloading() { return this.reloading > 0; }
  get busy() { return this.reloading > 0 || this.melee > 0 || this.throwT > 0 || this.equipT > 0; }

  canFire() { return this.cooldown <= 0 && !this.busy && this.sprint < 0.3; }

  fire() {
    if (this.ammo <= 0) { if (this.cooldown <= 0) { this.audio.dry(); this.cooldown = 0.25; } return false; }
    this.ammo--;
    this.cooldown = this.fireInterval;
    const a = this.aim;
    this.kickPos.impulse((Math.random() - 0.5) * 0.08, 0.05 * (1 - a * 0.6), 0.9 * (1 - a * 0.55));
    this.kickRot.impulse(2.2 * (1 - a * 0.7), (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6);
    this.flashT = 0;
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI * 2;
    const s = 0.7 + Math.random() * 0.6;
    this.flash.scale.set(s, s, 0.8 + Math.random() * 0.5);
    this.flashLight.intensity = 6;
    this.flashLight.position.copy(this.muzzle.position).add(this.gun.position);
    this.audio.gunshot();
    return true;
  }

  startReload() {
    if (this.reloading > 0 || this.ammo >= this.stats.mag || this.reserve <= 0 || this.melee > 0) return false;
    this.reloadEmpty = this.ammo === 0;
    this.reloadDur = this.reloadEmpty ? this.stats.reloadEmpty : this.stats.reload;
    this.reloading = this.reloadDur;
    this.audio.reload(this.reloadDur);
    return true;
  }

  finishReload() {
    const need = this.stats.mag - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take; this.reserve -= take;
  }

  startMelee() { if (this.melee > 0 || this.reloading > 0) return false; this.melee = 0.55; this.audio.melee(); return true; }
  startThrow() { if (this.throwT > 0) return false; this.throwT = 0.7; return true; }

  onLand(v) { this.land.impulse(0, -Math.min(v, 12) * 0.035, 0); }

  // look delta in radians this frame; move = {speed, grounded, crouch}
  update(dt, mainCam, input) {
    const { aiming, sprinting, lookDX, lookDY, moveSpeed, grounded, crouch } = input;
    this.camera.position.copy(mainCam.position);
    this.camera.quaternion.copy(mainCam.quaternion);
    this.cooldown -= dt;
    this.equipT = Math.max(0, this.equipT - dt);

    this.aim = damp(this.aim, aiming && !this.busy ? 1 : 0, 14, dt);
    this.sprint = damp(this.sprint, sprinting && !this.busy ? 1 : 0, 9, dt);

    // sway lags behind look
    this.swayTarget.set(THREE.MathUtils.clamp(-lookDX * 1.4, -0.12, 0.12), THREE.MathUtils.clamp(-lookDY * 1.4, -0.12, 0.12));
    this.sway.x = damp(this.sway.x, this.swayTarget.x, 10, dt);
    this.sway.y = damp(this.sway.y, this.swayTarget.y, 10, dt);

    // bob
    const moving = grounded ? Math.min(moveSpeed / 5, 1.6) : 0;
    this.bobAmt = damp(this.bobAmt, moving, 8, dt);
    this.bobPhase += dt * (moveSpeed * 1.55 + 0.001);
    this.breath += dt;

    this.kickPos.update(dt); this.kickRot.update(dt); this.land.update(dt);

    const a = this.aim, sp = this.sprint * (1 - a);
    const bobScale = lerp(1, 0.12, a);
    const bx = Math.sin(this.bobPhase) * 0.011 * this.bobAmt * bobScale;
    const by = -Math.abs(Math.cos(this.bobPhase)) * 0.012 * this.bobAmt * bobScale;
    const breathY = Math.sin(this.breath * 1.3) * 0.0015 * (1 - a * 0.7);
    const breathX = Math.sin(this.breath * 0.7) * 0.001 * (1 - a * 0.7);

    // base pose
    const p = new THREE.Vector3().lerpVectors(this.hipPos, this.adsPos, ease(a));
    const r = new THREE.Euler(0, 0, 0);
    // crouch cant
    r.z += crouch * 0.06 * (1 - a);
    // sprint pose
    p.x += sp * -0.04; p.y += sp * -0.03; p.z += sp * 0.02;
    r.x += sp * -0.35; r.y += sp * 0.75; r.z += sp * 0.35;
    const sprintBob = Math.sin(this.bobPhase) * sp;
    p.x += sprintBob * 0.02; p.y += Math.abs(sprintBob) * -0.012;
    r.z += sprintBob * 0.06;

    // reload animation
    let magOff = 0, magVis = true, lh = 0;
    if (this.reloading > 0) {
      this.reloading -= dt;
      const t = 1 - this.reloading / this.reloadDur;
      const tilt = ease(Math.min(1, t / 0.15)) * (1 - ease(Math.max(0, (t - 0.85) / 0.15)));
      r.z += tilt * 0.42; r.x += tilt * 0.12; r.y += tilt * -0.12;
      p.y += tilt * -0.035; p.x += tilt * -0.045; p.z += tilt * 0.03;
      if (t < 0.2) magOff = 0;
      else if (t < 0.35) { magOff = ease((t - 0.2) / 0.15) * 0.35; }
      else if (t < 0.45) { magOff = 0.35; magVis = false; }
      else if (t < 0.6) { magOff = (1 - ease((t - 0.45) / 0.15)) * 0.35; }
      else magOff = 0;
      if (t > 0.58 && t < 0.62) { this.kickRot.impulse(1.2, 0, 0.5); }
      lh = t > 0.18 && t < 0.62 ? 1 : 0;
      if (this.reloadEmpty && t > 0.78 && t < 0.83) this.kickPos.impulse(0, 0, 0.35);
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
    this.mag.position.set(this.magRest.x, this.magRest.y - magOff, this.magRest.z + magOff * 0.15);
    this.mag.visible = magVis;
    // left hand follows mag during reload
    this._lhk = damp(this._lhk || 0, lh, 12, dt);
    const HP = this.handPose, k = this._lhk;
    const lp = HP.l.pos.clone().lerp(HP.lMag.pos, k); lp.y += (this.mag.position.y - this.magRest.y) * k;
    this.poseHand(this.lHand, lp, HP.l.elbow.clone().lerp(HP.lMag.elbow, k), HP.l.palm.clone().lerp(HP.lMag.palm, k));

    // melee: jab forward with stock swing
    if (this.melee > 0) {
      this.melee -= dt;
      const t = 1 - this.melee / 0.55;
      const k = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      p.z -= k * 0.12; p.x -= k * 0.08; r.y += k * 0.6; r.z += k * 0.4;
    }
    // grenade throw: weapon dips out
    if (this.throwT > 0) {
      this.throwT -= dt;
      const t = 1 - this.throwT / 0.7;
      const k = Math.sin(t * Math.PI);
      p.y -= k * 0.18; r.x -= k * 0.6;
    }
    if (this.equipT > 0) { const k = ease(this.equipT / 0.6); p.y -= k * 0.25; r.x -= k * 0.8; }

    // apply sway, bob, recoil
    p.x += bx + breathX + this.sway.x * 0.35 * (1 - a * 0.8) + this.kickPos.x.x * 0.01;
    p.y += by + breathY + this.sway.y * 0.35 * (1 - a * 0.8) + this.kickPos.x.y * 0.01 + this.land.x.y;
    p.z += this.kickPos.x.z * 0.035;
    r.x += this.kickRot.x.x * 0.03 + this.sway.y * 0.6 * (1 - a * 0.7) + this.land.x.y * -1.5;
    r.y += this.kickRot.x.y * 0.02 + this.sway.x * 0.8 * (1 - a * 0.7);
    r.z += this.kickRot.x.z * 0.02 + this.sway.x * 0.9 + bx * 2;

    this.gun.position.copy(p);
    this.gun.rotation.copy(r);
    this.camera.fov = lerp(50, 36, a);
    this.camera.updateProjectionMatrix();

    // muzzle flash lifetime
    this.flashT += dt;
    // charging handle cycles back with each shot
    this.bolt.position.z = Math.max(0, 1 - this.flashT / 0.055) * 0.028;
    if (this.flashT > 0.045) this.flash.visible = false;
    this.flashLight.intensity = Math.max(0, 6 * (1 - this.flashT / 0.06));
    this.dot.visible = a > 0.85;
  }

  muzzleWorld(out) { this.camera.updateMatrixWorld(true); return this.muzzle.getWorldPosition(out); }
  ejectWorld(out) { return this.ejectPort.getWorldPosition(out); }
}
