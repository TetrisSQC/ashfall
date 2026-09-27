// First-person controller: momentum movement, sprint/crouch/slide/jump, camera feel
// (recoil, shake, bob, tilt), health with regeneration.
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera; this.world = world; this.audio = audio;
    this.pos = new THREE.Vector3(0, 0, 80);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.recoilP = 0; this.recoilY = 0;
    this.keys = {};
    this.mouseDX = 0; this.mouseDY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.sens = 0.0021;
    this.grounded = true;
    this.crouching = false; this.crouchK = 0;
    this.sliding = 0; this.slideDir = new THREE.Vector3();
    this.eye = 1.62;
    this.hp = 100; this.maxHp = 100; this.regenDelay = 0;
    this.alive = true;
    this.trauma = 0;
    this.stepDist = 0;
    this.bob = 0; this.tilt = 0;
    this.fovKick = 0;
    this.difficulty = 1;
    this.damageEvents = [];
    this.aiming = false; this.firing = false;
    this.airTime = 0; this.fallSpeed = 0;
  }

  reset() {
    this.pos.set(0, 0, 80); this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0; this.hp = 100; this.alive = true; this.trauma = 0; this.sliding = 0;
  }

  get moving() { return Math.hypot(this.vel.x, this.vel.z) > 1.2; }
  get sprinting() { return this.keys.ShiftLeft && this.keys.KeyW && !this.aiming && !this.crouching && this.sliding <= 0 && !this.firing; }

  headPos(out) { return out.set(this.pos.x, this.pos.y + this.eye, this.pos.z); }

  onMouse(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }

  addRecoil(p, y) { this.recoilP += p; this.recoilY += y; }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  takeDamage(amount, fromPos) {
    if (!this.alive) return;
    this.hp -= amount * this.difficulty;
    this.regenDelay = 4.5;
    this.shake(0.18);
    this.audio.hurt();
    this.damageEvents.push({ from: fromPos.clone(), t: 0 });
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  crouchPressed() {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.keys.ShiftLeft && speed > 5.5 && this.grounded && this.sliding <= 0) {
      this.sliding = 0.85;
      this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
      this.vel.x = this.slideDir.x * 10.5; this.vel.z = this.slideDir.z * 10.5;
      this.shake(0.05);
      this.audio.step('dirt', true);
      this.crouching = true;
      return;
    }
    this.crouching = !this.crouching;
  }

  update(dt) {
    // --- look
    const sensMul = this.aiming ? 0.62 : 1;
    const dYaw = -this.mouseDX * this.sens * sensMul;
    const dPitch = -this.mouseDY * this.sens * sensMul;
    this.mouseDX = 0; this.mouseDY = 0;
    this.yaw += dYaw; this.pitch += dPitch;
    this.lookDX = dYaw; this.lookDY = dPitch;
    // recoil: applied immediately then recovers
    const rp = this.recoilP * Math.min(1, dt * 18), ry = this.recoilY * Math.min(1, dt * 18);
    this.pitch += rp; this.yaw += ry;
    this.recoilP -= rp; this.recoilY -= ry;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);

    // --- movement
    const k = this.keys;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (k.KeyW) wish.add(fwd); if (k.KeyS) wish.sub(fwd);
    if (k.KeyD) wish.add(right); if (k.KeyA) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();
    let maxSpeed = 4.8;
    if (this.sprinting) maxSpeed = 7.4;
    if (this.crouching) maxSpeed = 2.4;
    if (this.aiming) maxSpeed = Math.min(maxSpeed, 2.9);
    if (!this.alive) maxSpeed = 0;

    if (this.sliding > 0) {
      this.sliding -= dt;
      const f = Math.exp(-2.2 * dt);
      this.vel.x *= f; this.vel.z *= f;
      if (this.sliding <= 0) this.sliding = 0;
    } else if (this.grounded) {
      const accel = 60, fric = 11;
      const target = wish.clone().multiplyScalar(maxSpeed);
      const dvx = target.x - this.vel.x, dvz = target.z - this.vel.z;
      const rate = wish.lengthSq() > 0 ? accel : fric * Math.max(2, Math.hypot(this.vel.x, this.vel.z));
      const dl = Math.hypot(dvx, dvz), step = Math.min(dl, rate * dt);
      if (dl > 1e-5) { this.vel.x += (dvx / dl) * step; this.vel.z += (dvz / dl) * step; }
    } else {
      // air control
      this.vel.x += wish.x * 8 * dt; this.vel.z += wish.z * 8 * dt;
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > 8) { this.vel.x *= 8 / hs; this.vel.z *= 8 / hs; }
    }
    if (k.Space && this.grounded && this.alive) {
      this.vel.y = 5.2; this.grounded = false; k.Space = false;
      if (this.crouching) this.crouching = false;
      if (this.sliding > 0) { this.sliding = 0; }
    }
    this.vel.y -= 16 * dt;
    const wasGrounded = this.grounded;
    const vy = this.vel.y;
    this.pos.addScaledVector(this.vel, dt);
    const height = this.crouching || this.sliding > 0 ? 1.15 : 1.8;
    this.grounded = this.world.collide(this.pos, this.vel, 0.33, height);
    if (!wasGrounded && this.grounded && vy < -3) {
      this.landImpact = -vy;
      this.audio.step('concrete', true);
      this.shake(Math.min(0.2, -vy * 0.015));
    }
    // un-crouch blocked by ceiling? (ignore, open level)

    // --- camera
    this.crouchK = damp(this.crouchK, this.sliding > 0 ? 1.3 : this.crouching ? 1 : 0, 12, dt);
    this.eye = 1.62 - this.crouchK * 0.55;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && speed > 0.5 && this.sliding <= 0) {
      this.bob += dt * speed * 1.55;
      this.stepDist += speed * dt;
      const stride = this.sprinting ? 2.3 : 1.9;
      if (this.stepDist > stride) { this.stepDist = 0; this.audio.step('concrete', this.sprinting); }
    }
    const bobK = this.aiming ? 0.15 : 1;
    const bobY = Math.sin(this.bob * 2) * 0.03 * Math.min(1, speed / 5) * bobK;
    const bobX = Math.cos(this.bob) * 0.02 * Math.min(1, speed / 5) * bobK;
    // strafe tilt + slide tilt
    const lateral = this.vel.dot(right);
    this.tilt = damp(this.tilt, -lateral * 0.004 + (this.sliding > 0 ? 0.08 : 0), 8, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const sh = this.trauma * this.trauma;
    const t = performance.now() / 1000;
    const shX = sh * 0.05 * (Math.sin(t * 47.3) + Math.sin(t * 31.1) * 0.5);
    const shY = sh * 0.05 * (Math.sin(t * 43.7 + 1) + Math.sin(t * 27.9) * 0.5);
    const shR = sh * 0.04 * Math.sin(t * 39.1 + 2);

    this.camera.position.set(this.pos.x + right.x * bobX, this.pos.y + this.eye + bobY, this.pos.z + right.z * bobX);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + shY, this.yaw + shX, this.tilt + shR);

    // fov
    const targetFov = (this.sprinting ? 69 : 63) - (this.aiming ? 19 : 0) + (this.sliding > 0 ? 5 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 10, dt);
    this.camera.updateProjectionMatrix();

    // health regen
    if (this.alive) {
      this.regenDelay -= dt;
      if (this.regenDelay <= 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 30 * dt);
    }
    for (const e of this.damageEvents) e.t += dt;
    this.damageEvents = this.damageEvents.filter((e) => e.t < 1.6);
  }
}
