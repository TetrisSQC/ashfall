// Particles (instanced camera-facing quads), decals, tracers, shell casings, lights.
import * as THREE from 'three';
import { spriteTex } from './textures.js';

const VERT = /* glsl */`
  attribute vec3 iPos;
  attribute vec4 iData;   // size, rotation, alpha, stretch
  attribute vec3 iColor;
  attribute vec3 iVel;
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vFog;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    vec2 corner = position.xy;
    float size = iData.x;
    if (iData.w > 0.0) {
      vec4 mv2 = modelViewMatrix * vec4(iPos + iVel * 0.016, 1.0);
      vec2 d = mv2.xy - mv.xy;
      float len = length(d);
      vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
      vec2 perp = vec2(-dir.y, dir.x);
      mv.xy += dir * corner.x * (size + len * iData.w) + perp * corner.y * size * 0.35;
    } else {
      float c = cos(iData.y), s = sin(iData.y);
      mv.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
    }
    vCol = vec4(iColor, iData.z);
    vFog = 1.0 - exp(-0.00012 * dot(mv.xyz, mv.xyz));
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  uniform sampler2D map;
  uniform vec3 fogColor;
  uniform float fogAmt;
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vFog;
  void main() {
    vec4 t = texture2D(map, vUv);
    vec4 c = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
    c.rgb = mix(c.rgb, fogColor * c.a, vFog * fogAmt);
    gl_FragColor = c;
    #include <colorspace_fragment>
  }
`;

export class ParticleSystem {
  constructor(scene, tex, { max = 1000, additive = false, sort = false, fog = 1 } = {}) {
    this.max = max; this.sort = sort;
    this.p = [];
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(2, 2);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iData', this.aData);
    geo.setAttribute('iColor', this.aCol); geo.setAttribute('iVel', this.aVel);
    geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color(0xc9b8a0) }, fogAmt: { value: fog } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      premultipliedAlpha: false,
    });
    if (!additive) { this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.SrcAlphaFactor; this.mat.blendDst = THREE.OneMinusSrcAlphaFactor; }
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
    scene.add(this.mesh);
    this.geo = geo;
  }

  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      pos: o.pos.clone(), vel: o.vel ? o.vel.clone() : new THREE.Vector3(),
      life: o.life || 1, age: 0,
      s0: o.size0 ?? 1, s1: o.size1 ?? o.size0 ?? 1,
      rot: o.rot ?? Math.random() * Math.PI * 2, rv: o.rotVel ?? 0,
      a0: o.alpha0 ?? 1, a1: o.alpha1 ?? 0, fadeIn: o.fadeIn ?? 0,
      c0: o.color ? o.color.clone() : new THREE.Color(1, 1, 1), c1: o.color1 ? o.color1.clone() : null,
      drag: o.drag ?? 0, grav: o.gravity ?? 0, stretch: o.stretch ?? 0,
      bounce: o.bounce ?? false,
    });
  }

  update(dt, camera) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.age += dt;
      if (q.age >= q.life) { P.splice(i, 1); continue; }
      q.vel.y -= q.grav * dt;
      if (q.drag) q.vel.multiplyScalar(Math.max(0, 1 - q.drag * dt));
      q.pos.addScaledVector(q.vel, dt);
      if (q.bounce && q.pos.y < 0.02) { q.pos.y = 0.02; q.vel.y *= -0.35; q.vel.x *= 0.6; q.vel.z *= 0.6; }
      q.rot += q.rv * dt;
    }
    if (this.sort && camera) {
      const cp = camera.position;
      for (const q of P) q.d = q.pos.distanceToSquared(cp);
      P.sort((a, b) => b.d - a.d);
    }
    const pos = this.aPos.array, dat = this.aData.array, col = this.aCol.array, vel = this.aVel.array;
    for (let i = 0; i < P.length; i++) {
      const q = P[i], t = q.age / q.life;
      pos[i * 3] = q.pos.x; pos[i * 3 + 1] = q.pos.y; pos[i * 3 + 2] = q.pos.z;
      vel[i * 3] = q.vel.x; vel[i * 3 + 1] = q.vel.y; vel[i * 3 + 2] = q.vel.z;
      let a = q.a0 + (q.a1 - q.a0) * t;
      if (q.fadeIn > 0 && t < q.fadeIn) a *= t / q.fadeIn;
      dat[i * 4] = q.s0 + (q.s1 - q.s0) * Math.sqrt(t); dat[i * 4 + 1] = q.rot; dat[i * 4 + 2] = a; dat[i * 4 + 3] = q.stretch;
      if (q.c1) { col[i * 3] = q.c0.r + (q.c1.r - q.c0.r) * t; col[i * 3 + 1] = q.c0.g + (q.c1.g - q.c0.g) * t; col[i * 3 + 2] = q.c0.b + (q.c1.b - q.c0.b) * t; }
      else { col[i * 3] = q.c0.r; col[i * 3 + 1] = q.c0.g; col[i * 3 + 2] = q.c0.b; }
    }
    this.geo.instanceCount = P.length;
    this.aPos.needsUpdate = this.aData.needsUpdate = this.aCol.needsUpdate = this.aVel.needsUpdate = true;
    this.aPos.clearUpdateRanges?.();
  }
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    const smokeTex = spriteTex('smoke');
    this.smoke = new ParticleSystem(scene, smokeTex, { max: 900, sort: true });
    this.dust = new ParticleSystem(scene, smokeTex, { max: 500, sort: false });
    this.fire = new ParticleSystem(scene, spriteTex('fire'), { max: 500, additive: true, fog: 0.4 });
    this.sparks = new ParticleSystem(scene, spriteTex('spark'), { max: 600, additive: true, fog: 0.2 });
    this.blood = new ParticleSystem(scene, spriteTex('blood'), { max: 300 });
    this.glow = new ParticleSystem(scene, spriteTex('glow'), { max: 200, additive: true, fog: 0.3 });
    this.motes = new ParticleSystem(scene, spriteTex('glow'), { max: 400, additive: true, fog: 0.6 });

    // decals
    this.decalTex = spriteTex('hole');
    this.bloodTex = spriteTex('blood');
    this.scorchTex = spriteTex('scorch');
    const dm = (map, opacity = 1) => new THREE.MeshStandardMaterial({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.9 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.decalSets = {};
    for (const [kind, map, op, max] of [['hole', this.decalTex, 1, 300], ['blood', this.bloodTex, 0.9, 80], ['scorch', this.scorchTex, 0.95, 24]]) {
      const im = new THREE.InstancedMesh(this.decalGeo, dm(map, op), max);
      im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.userData.noAO = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.decalSets[kind] = { im, max, next: 0 };
    }
    this._dm = new THREE.Matrix4(); this._dq = new THREE.Quaternion(); this._ds = new THREE.Vector3(); this._dp = new THREE.Vector3();

    // tracers
    this.tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 2.0), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1);
    this.tracers = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(this.tracerGeo, this.tracerMat); m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tracers.push({ mesh: m, active: false });
    }

    // shell casings
    const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 });
    this.shellGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.045, 8);
    this.shellGeo.rotateX(Math.PI / 2);
    this.shells = [];
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(this.shellGeo, brass); m.visible = false; m.castShadow = true; scene.add(m);
      this.shells.push({ mesh: m, active: false, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, bounced: 0 });
    }

    // debris chunks for explosions / impacts
    const chunkMat = new THREE.MeshStandardMaterial({ color: 0x777069, roughness: 0.95 });
    this.chunkGeo = new THREE.DodecahedronGeometry(1, 0);
    this.chunks = [];
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(this.chunkGeo, chunkMat); m.visible = false; m.castShadow = true; scene.add(m);
      this.chunks.push({ mesh: m, active: false, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0 });
    }

    // dynamic flash lights (fixed count so shaders never recompile)
    this.flashLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 14, 2);
      scene.add(l);
      this.flashLights.push({ light: l, t: 0, dur: 0.05, peak: 0 });
    }
    this.fireLights = [];
    this.emitters = [];
    this.time = 0;
  }

  addFire(pos, scale, withLight) {
    this.emitters.push({ type: 'fire', pos: pos.clone(), scale, acc: 0 });
    if (withLight && this.fireLights.length < 3) {
      const l = new THREE.PointLight(0xff7a30, 30 * scale, 16 * scale, 2);
      l.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
      this.scene.add(l);
      this.fireLights.push({ light: l, base: 30 * scale, seed: Math.random() * 100 });
    }
  }
  addPlume(pos) { this.emitters.push({ type: 'plume', pos: pos.clone(), acc: 0 }); }

  flash(pos, peak = 40, dur = 0.06, color = 0xffb060, dist = 14) {
    let best = this.flashLights[0];
    for (const f of this.flashLights) if (f.t >= f.dur) { best = f; break; }
    best.light.position.copy(pos); best.light.color.set(color); best.light.distance = dist;
    best.t = 0; best.dur = dur; best.peak = peak;
  }

  decal(point, normal, kind = 'hole', size = 0.12) {
    const set = this.decalSets[kind];
    const i = set.next; set.next = (set.next + 1) % set.max;
    set.im.count = Math.max(set.im.count, i + 1);
    this._dp.copy(point).addScaledVector(normal, 0.004 + Math.random() * 0.003);
    this._dq.setFromUnitVectors(_z, normal);
    _q.setFromAxisAngle(_z, Math.random() * Math.PI * 2);
    this._dq.multiply(_q);
    this._ds.setScalar(size * (0.8 + Math.random() * 0.4));
    this._dm.compose(this._dp, this._dq, this._ds);
    set.im.setMatrixAt(i, this._dm);
    set.im.instanceMatrix.needsUpdate = true;
  }

  impact(point, normal, surf, dir) {
    const refl = dir.clone().reflect(normal);
    const base = { concrete: [0.62, 0.6, 0.56], asphalt: [0.3, 0.29, 0.28], metal: [0.4, 0.4, 0.4], wood: [0.55, 0.42, 0.28], cloth: [0.6, 0.53, 0.38], dirt: [0.45, 0.38, 0.28] }[surf] || [0.6, 0.58, 0.54];
    // dust puff
    for (let i = 0; i < 5; i++) {
      _v.copy(normal).multiplyScalar(1 + Math.random() * 2).add(refl.clone().multiplyScalar(Math.random())).add(_v2.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(0.8));
      this.dust.spawn({ pos: point, vel: _v, life: 0.9 + Math.random() * 0.9, size0: 0.05, size1: 0.45 + Math.random() * 0.4, alpha0: 0.55, alpha1: 0, color: new THREE.Color(base[0] * 1.3, base[1] * 1.3, base[2] * 1.3), drag: 3.5, gravity: -0.15, rotVel: (Math.random() - 0.5) * 1.2 });
    }
    // chips
    const chips = surf === 'metal' ? 0 : 5;
    for (let i = 0; i < chips; i++) {
      _v.copy(normal).multiplyScalar(2 + Math.random() * 3).add(_v2.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3));
      this.dust.spawn({ pos: point, vel: _v, life: 0.6, size0: 0.02, size1: 0.015, alpha0: 1, alpha1: 1, color: new THREE.Color(base[0] * 0.5, base[1] * 0.5, base[2] * 0.5), gravity: 9.8, drag: 0.5, bounce: true });
    }
    // sparks for metal & concrete
    const sparks = surf === 'metal' ? 12 : surf === 'concrete' || surf === 'asphalt' ? 3 : 0;
    for (let i = 0; i < sparks; i++) {
      _v.copy(refl).multiplyScalar(3 + Math.random() * 6).add(_v2.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).multiplyScalar(5));
      this.sparks.spawn({ pos: point, vel: _v, life: 0.15 + Math.random() * 0.3, size0: 0.012, size1: 0.006, alpha0: 1, alpha1: 0.2, color: new THREE.Color(4, 2.4, 1.0), gravity: 9.8, stretch: 3 });
    }
    if (surf === 'metal') this.glow.spawn({ pos: point.clone().addScaledVector(normal, 0.02), life: 0.06, size0: 0.25, size1: 0.1, alpha0: 1, alpha1: 0, color: new THREE.Color(4, 2.8, 1.5) });
    this.decal(point, normal, 'hole', surf === 'metal' ? 0.07 : 0.12);
  }

  bloodHit(point, dir) {
    for (let i = 0; i < 6; i++) {
      _v.copy(dir).multiplyScalar(1 + Math.random() * 2.5).add(_v2.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(1.6));
      this.blood.spawn({ pos: point, vel: _v, life: 0.35 + Math.random() * 0.4, size0: 0.08, size1: 0.35, alpha0: 0.95, alpha1: 0, color: new THREE.Color(0.55, 0.05, 0.03), gravity: 4, drag: 2 });
    }
    // splatter on nearby wall behind target
    const h = this.world.raycast(point, dir, 2.5);
    if (h) this.decal(h.point, h.normal, 'blood', 0.5 + Math.random() * 0.4);
  }

  tracer(from, to, speed = 380) {
    const t = this.tracers.find((x) => !x.active) || this.tracers[0];
    t.active = true; t.from = from.clone(); t.to = to.clone();
    t.len = from.distanceTo(to); t.dist = 0; t.speed = speed;
    t.dir = to.clone().sub(from).normalize();
    t.mesh.visible = true;
    t.mesh.quaternion.setFromUnitVectors(_z, t.dir);
  }

  ejectShell(pos, vel, quat) {
    const s = this.shells.find((x) => !x.active) || this.shells[0];
    s.active = true; s.age = 0; s.bounced = 0;
    s.mesh.visible = true; s.mesh.position.copy(pos); s.mesh.quaternion.copy(quat);
    s.vel.copy(vel); s.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  }

  muzzleSmoke(pos, dir) {
    if (Math.random() < 0.5) {
      this.smoke.spawn({ pos, vel: dir.clone().multiplyScalar(0.6 + Math.random()).add(_v.set(0, 0.3, 0)), life: 0.7 + Math.random() * 0.5, size0: 0.04, size1: 0.3, alpha0: 0.08, alpha1: 0, color: new THREE.Color(0.45, 0.44, 0.42), drag: 2 });
    }
  }

  explosion(pos) {
    this.flash(pos.clone().add(_v.set(0, 1, 0)), 900, 0.35, 0xffa050, 40);
    for (let i = 0; i < 40; i++) {
      _v.set(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 8);
      this.fire.spawn({ pos: pos.clone().add(_v2.set(0, 0.3, 0)), vel: _v, life: 0.35 + Math.random() * 0.4, size0: 0.6, size1: 2.2 + Math.random() * 1.2, alpha0: 1, alpha1: 0, color: new THREE.Color(3, 1.5, 0.6), color1: new THREE.Color(1.2, 0.3, 0.05), drag: 5, gravity: -2 });
    }
    for (let i = 0; i < 26; i++) {
      _v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 4);
      this.smoke.spawn({ pos: pos.clone().add(_v2.set(0, 0.5, 0)), vel: _v, life: 4 + Math.random() * 3, size0: 0.8, size1: 4 + Math.random() * 2.5, alpha0: 0.75, alpha1: 0, fadeIn: 0.05, color: new THREE.Color(0.28, 0.26, 0.24), color1: new THREE.Color(0.55, 0.52, 0.48), drag: 1.6, gravity: -0.35, rotVel: (Math.random() - 0.5) * 0.6 });
    }
    for (let i = 0; i < 50; i++) {
      _v.set(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 16);
      this.sparks.spawn({ pos: pos.clone().add(_v2.set(0, 0.3, 0)), vel: _v, life: 0.5 + Math.random() * 0.8, size0: 0.03, size1: 0.01, alpha0: 1, alpha1: 0.4, color: new THREE.Color(4, 2.2, 0.8), gravity: 9.8, stretch: 2.5, drag: 0.6 });
    }
    for (let i = 0; i < 16; i++) {
      const c = this.chunks.find((x) => !x.active) || this.chunks[i];
      c.active = true; c.age = 0; c.mesh.visible = true;
      c.mesh.position.copy(pos).add(_v.set(0, 0.2, 0));
      c.mesh.scale.setScalar(0.03 + Math.random() * 0.08);
      c.vel.set(Math.random() - 0.5, Math.random() * 0.8 + 0.4, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 9);
      c.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    }
    // ground dust ring
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.dust.spawn({ pos: pos.clone().add(_v2.set(0, 0.2, 0)), vel: _v.set(Math.cos(a) * 9, 0.4, Math.sin(a) * 9), life: 2.2, size0: 0.5, size1: 2.8, alpha0: 0.55, alpha1: 0, color: new THREE.Color(0.6, 0.55, 0.47), drag: 2.5 });
    }
    this.decal(pos.clone().setY(Math.max(pos.y, 0.0) + 0.01), new THREE.Vector3(0, 1, 0), 'scorch', 3.5);
  }

  update(dt, camera) {
    this.time += dt;
    // emitters
    for (const e of this.emitters) {
      if (e.type === 'fire') {
        e.acc += dt * 110 * e.scale;
        e.gacc = (e.gacc || 0) + dt;
        if (e.gacc > 0.06) { e.gacc = 0; this.glow.spawn({ pos: e.pos.clone().add(_v2.set(0, 0.35 * e.scale, 0)), life: 0.12, size0: 1.9 * e.scale, size1: 2.1 * e.scale, alpha0: 0.22 + Math.random() * 0.08, alpha1: 0.2, color: new THREE.Color(2.2, 0.9, 0.3) }); }
        while (e.acc > 1) {
          e.acc -= 1;
          const s = e.scale;
          _v2.set((Math.random() - 0.5) * 0.7 * s, 0, (Math.random() - 0.5) * 0.7 * s);
          const r = Math.random();
          _v2.multiplyScalar(0.6 + (1 - r) * 0.6);
          this.fire.spawn({ pos: e.pos.clone().add(_v2), vel: _v.set((Math.random() - 0.5) * 0.4, 0.9 + r * 2.2, (Math.random() - 0.5) * 0.4).multiplyScalar(s), life: 0.3 + Math.random() * 0.5, size0: (0.16 + Math.random() * 0.16) * s, size1: 0.03 * s, alpha0: 0.55, alpha1: 0, fadeIn: 0.15, color: new THREE.Color(3.6, 1.7, 0.55), color1: new THREE.Color(1.6, 0.32, 0.04), rotVel: (Math.random() - 0.5) * 4, drag: 0.8 });
          if (Math.random() < 0.13) this.smoke.spawn({ pos: e.pos.clone().add(_v2).add(_v.set(0, 1.0 * s, 0)), vel: _v.set(0.35 + Math.random() * 0.3, 1.4 + Math.random(), 0.1).multiplyScalar(s), life: 5 + Math.random() * 3, size0: 0.4 * s, size1: 3.2 * s, alpha0: 0.55, alpha1: 0, fadeIn: 0.1, color: new THREE.Color(0.09, 0.085, 0.08), color1: new THREE.Color(0.32, 0.3, 0.28), drag: 0.25, rotVel: (Math.random() - 0.5) * 0.4 });
          if (Math.random() < 0.08) this.sparks.spawn({ pos: e.pos.clone().add(_v2), vel: _v.set((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 1.5), life: 1.2 + Math.random(), size0: 0.012, size1: 0.005, alpha0: 1, alpha1: 0, color: new THREE.Color(3, 1.4, 0.4), gravity: -0.2, drag: 0.5, stretch: 1 });
        }
      } else if (e.type === 'plume') {
        e.acc += dt * 5;
        while (e.acc > 1) {
          e.acc -= 1;
          this.smoke.spawn({ pos: e.pos.clone().add(_v2.set((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6)), vel: _v.set(1.8 + Math.random(), 3.5 + Math.random() * 2, 0.4), life: 22, size0: 6, size1: 34, alpha0: 0.5, alpha1: 0, fadeIn: 0.05, color: new THREE.Color(0.14, 0.13, 0.12), color1: new THREE.Color(0.5, 0.47, 0.44), drag: 0.02, rotVel: (Math.random() - 0.5) * 0.1 });
        }
      }
    }
    // ambient floating ash/dust motes around camera
    if (camera && Math.random() < dt * 30) {
      const cp = camera.position;
      this.motes.spawn({ pos: _v.set(cp.x + (Math.random() - 0.5) * 16, cp.y + Math.random() * 5 - 1, cp.z + (Math.random() - 0.5) * 16), vel: _v2.set(0.25 + Math.random() * 0.2, -0.08, (Math.random() - 0.5) * 0.2), life: 7, size0: 0.012, size1: 0.012, alpha0: 0.0, alpha1: 0.0, color: new THREE.Color(1.6, 1.3, 0.9) });
      const m = this.motes.p[this.motes.p.length - 1]; m.a0 = 0.7; m.a1 = 0; m.fadeIn = 0.2;
    }

    // flash lights
    for (const f of this.flashLights) {
      f.t += dt;
      const k = f.t < f.dur ? 1 - f.t / f.dur : 0;
      f.light.intensity = f.peak * k * k;
    }
    for (const f of this.fireLights) {
      const t = this.time * 9 + f.seed;
      f.light.intensity = f.base * (0.75 + 0.18 * Math.sin(t) + 0.12 * Math.sin(t * 2.7 + 1.3) + 0.08 * Math.random());
    }
    // tracers
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.dist += t.speed * dt;
      const segLen = Math.min(4, t.len);
      if (t.dist - segLen > t.len) { t.active = false; t.mesh.visible = false; continue; }
      const head = Math.min(t.dist, t.len), tail = Math.max(0, t.dist - segLen);
      const mid = (head + tail) / 2;
      t.mesh.position.copy(t.from).addScaledVector(t.dir, mid);
      t.mesh.scale.set(1, 1, Math.max(0.01, head - tail));
    }
    // shells
    for (const s of this.shells) {
      if (!s.active) continue;
      s.age += dt;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; s.mesh.rotation.z += s.spin.z * dt;
      const floor = this.floorAt(s.mesh.position);
      if (s.mesh.position.y < floor + 0.006) {
        s.mesh.position.y = floor + 0.006;
        if (Math.abs(s.vel.y) > 0.6) {
          if (s.bounced < 2 && this.audio) this.audio.shell(s.mesh.position);
          s.bounced++;
        }
        s.vel.y = Math.abs(s.vel.y) * 0.3; s.vel.x *= 0.5; s.vel.z *= 0.5; s.spin.multiplyScalar(0.5);
        if (s.vel.y < 0.2) { s.vel.set(0, 0, 0); s.spin.set(0, 0, 0); s.mesh.rotation.x = Math.PI / 2 * 0; }
      }
      if (s.age > 6) { s.active = false; s.mesh.visible = false; }
    }
    for (const c of this.chunks) {
      if (!c.active) continue;
      c.age += dt;
      c.vel.y -= 9.8 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt;
      const floor = this.floorAt(c.mesh.position);
      if (c.mesh.position.y < floor + c.mesh.scale.x * 0.5) { c.mesh.position.y = floor + c.mesh.scale.x * 0.5; c.vel.y *= -0.3; c.vel.x *= 0.6; c.vel.z *= 0.6; c.spin.multiplyScalar(0.6); }
      if (c.age > 8) { c.active = false; c.mesh.visible = false; }
    }
    this.smoke.update(dt, camera); this.dust.update(dt, camera); this.fire.update(dt, camera);
    this.sparks.update(dt, camera); this.blood.update(dt, camera); this.glow.update(dt, camera); this.motes.update(dt, camera);
  }

  // top surface below a point (cheap)
  floorAt(p) {
    let y = 0;
    for (const c of this.world.colliders) {
      if (p.x < c.min.x || p.x > c.max.x || p.z < c.min.z || p.z > c.max.z) continue;
      if (c.max.y <= p.y + 0.05 && c.max.y > y) y = c.max.y;
    }
    return y;
  }

  setFog(color) {
    for (const s of [this.smoke, this.dust, this.fire, this.sparks, this.blood, this.glow, this.motes]) s.mat.uniforms.fogColor.value.copy(color);
  }
}
