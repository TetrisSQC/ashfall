import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { World } from './world.js';
import { setAnisotropy } from './textures.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Weapon } from './weapon.js';
import { Player } from './player.js';
import { Enemy, loadSoldier } from './enemies.js';
import { HUD } from './hud.js';
import { SkyShader, GodRayShader, GradeShader, installFog } from './shaders.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');           // screenshot / debug mode
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: !!SHOT });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
setAnisotropy(renderer.capabilities.getMaxAnisotropy());
renderer.info.autoReset = false;
const perf = { frames: [], calls: 0, tris: 0 };
window.__perf = perf;

const QUALITY = ['ULTRA', 'HIGH', 'MEDIUM'];
let quality = Math.max(0, QUALITY.indexOf(localStorageGet('quality') || 'ULTRA'));
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(63, innerWidth / innerHeight, 0.05, 1400);
camera.rotation.order = 'YXZ';

// ------------------------------------------------------------------ atmosphere
const SUN_DIR = new THREE.Vector3(-0.62, 0.2, -0.76).normalize();
const FOG_COLOR = new THREE.Color(0.7, 0.62, 0.52);         // linear, matches sky horizon
installFog(SUN_DIR, new THREE.Color(1.45, 0.98, 0.58), 0.06);
scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.003);

const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.ShaderMaterial({
  ...SkyShader, side: THREE.BackSide, depthWrite: false, fog: false,
}));
sky.material.uniforms.sunDir.value.copy(SUN_DIR);
sky.material.uniforms.horizon.value.copy(FOG_COLOR);
sky.userData.noAO = true;
sky.frustumCulled = false;
sky.renderOrder = -1;
scene.add(sky);

const sun = new THREE.DirectionalLight(0xffcf9a, 5.0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const SH = 55;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 260 });
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0x9db4d4, 0x6b5842, 0.3);
scene.add(hemi);
// fake bounce: warm light reflected off sunlit facades/ground into the shadowed side of the street
const bounce = new THREE.DirectionalLight(0xffc28a, 0.45);
bounce.position.set(-SUN_DIR.x, 0.25, -SUN_DIR.z);
scene.add(bounce);

// environment map from the sky only
function buildEnv() {
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const s2 = sky.clone(); s2.material = sky.material.clone(); s2.material.uniforms.cloudAmt.value = 0.0;
  s2.material.uniforms.sunDir.value.copy(SUN_DIR); s2.material.uniforms.horizon.value.copy(FOG_COLOR);
  s2.material.uniforms.sunDisk.value = 0.0;
  envScene.add(s2);
  // warm ground bounce hemisphere below horizon
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.17, 0.12) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -30;
  envScene.add(ground);
  const rt = pm.fromScene(envScene, 0, 1, 2000);
  scene.environment = rt.texture;
  scene.environmentIntensity = 0.7;
  pm.dispose();
  return rt.texture;
}

// ------------------------------------------------------------------ systems
const audio = new Audio();
const loadFill = $('load-fill'), loadText = $('load-text');
const progress = (p, text) => { loadFill.style.width = (p * 100).toFixed(0) + '%'; if (text) loadText.textContent = text; };
$('menu').classList.add('loading');

const world = new World(scene, progress);
let effects, weapon, player, hud, composer, passes = {};
const enemies = [];
const grenadesLive = [];
const game = { state: 'menu', wave: 0, score: 0, kills: 0, headshots: 0, toSpawn: 0, spawnTimer: 0, waveBreak: 0, grenades: 3, shots: 0, hits: 0, time: 0 };

async function init() {
  await world.build();
  progress(0.9, 'LOADING INFANTRY');
  await loadSoldier();
  progress(0.92, 'LIGHTING');
  await tick();
  const envTex = buildEnv();
  effects = new Effects(scene, world, audio);
  effects.setFog(FOG_COLOR);
  for (const f of world.fires) effects.addFire(f.pos, f.scale, f.scale > 1);
  for (const p of world.smokeStacks) effects.addPlume(p);
  for (const s of [effects.smoke, effects.dust, effects.fire, effects.sparks, effects.blood, effects.glow, effects.motes]) s.mesh.userData.noAO = true;
  for (const t of effects.tracers) t.mesh.userData.noAO = true;

  weapon = new Weapon(renderer, audio);
  weapon.scene.environment = envTex;
  weapon.scene.environmentIntensity = 0.8;
  weapon.sun.position.copy(SUN_DIR).multiplyScalar(10);
  player = new Player(camera, world, audio);
  hud = new HUD(world);
  buildComposer();
  progress(0.97, 'COMPILING SHADERS');
  await tick();
  // warm up: pre-simulate smoke so the scene starts alive
  for (let i = 0; i < 240; i++) effects.update(1 / 30, camera);
  player.update(0.016);
  weapon.update(0.016, camera, { aiming: false, sprinting: false, lookDX: 0, lookDY: 0, moveSpeed: 0, grounded: true, crouch: 0 });
  // pre-warm every shader variant so the first fight doesn't hitch
  const dummy = new Enemy(scene, world, new THREE.Vector3(0, 0, 70));
  const warm = [...effects.tracers.map((t) => t.mesh), ...effects.shells.map((x) => x.mesh), ...effects.chunks.map((x) => x.mesh), weapon.flash, weapon.dot];
  for (const o of warm) o.visible = true;
  const nade = new THREE.Mesh(nadeGeo, nadeMat); nade.position.set(0, 1, 70); scene.add(nade);
  for (const f of effects.flashLights) f.light.intensity = 1;
  renderer.compile(scene, camera);
  renderer.compile(weapon.scene, weapon.camera);
  composer.render(0.016);
  for (const o of warm) o.visible = false;
  for (const f of effects.flashLights) f.light.intensity = 0;
  scene.remove(nade); dummy.dispose();
  composer.render(0.016);
  progress(1, 'READY');
  $('loading').classList.add('hidden');
  $('deploy').classList.remove('hidden');
  $('menu').classList.remove('loading');
  if (SHOT) setupShot(SHOT);
  window.__dbg = { player, weapon, enemies, world, effects, camera, scene, renderer, game };
  requestAnimationFrame(loop);
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// ------------------------------------------------------------------ post processing
function buildComposer() {
  const dpr = quality === 0 ? Math.min(devicePixelRatio, 1.5) : 1;
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  const w = innerWidth * dpr, h = innerHeight * dpr;
  sun.shadow.mapSize.setScalar(quality === 2 ? 2048 : 4096);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  passes.render = new RenderPass(scene, camera);
  composer.addPass(passes.render);
  if (quality < 2) {
    const gtao = new GTAOPass(scene, camera, w, h);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 1.0;
    gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: quality === 0 ? 16 : 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    const cache = gtao._visibilityCache;
    gtao.overrideVisibility = function () {
      scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false; });
    };
    composer.addPass(gtao);
    passes.gtao = gtao;
  } else passes.gtao = null;
  passes.rays = new ShaderPass(GodRayShader);
  composer.addPass(passes.rays);
  passes.weapon = new RenderPass(weapon.scene, weapon.camera);
  passes.weapon.clear = false; passes.weapon.clearDepth = true;
  passes.weapon.enabled = game.state !== 'menu' || (!!SHOT && !SHOTMENU);
  composer.addPass(passes.weapon);
  passes.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.55, 0.92);
  composer.addPass(passes.bloom);
  composer.addPass(new OutputPass());
  passes.grade = new ShaderPass(GradeShader);
  composer.addPass(passes.grade);
  passes.smaa = new SMAAPass(w, h);
  composer.addPass(passes.smaa);
  weapon.setAspect(innerWidth / innerHeight);
  $('quality-val').textContent = QUALITY[quality];
}

function setQuality(q) {
  quality = q; localStorageSet('quality', QUALITY[q]);
  disposeComposer();
  buildComposer();
}

let resizeT = 0;
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (composer) { disposeComposer(); buildComposer(); } }, 150);
});
function disposeComposer() {
  for (const p of composer.passes) p.dispose?.();
  composer.dispose?.();
}

// ------------------------------------------------------------------ input
const canvas = renderer.domElement;
let mouseDown = false, rmb = false;
$('deploy').addEventListener('click', () => { audio.init(); startGame(); });
$('redeploy').addEventListener('click', () => { audio.init(); restart(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && game.state === 'playing') pause();
});
canvas.addEventListener('click', () => { if (game.state === 'playing' && document.pointerLockElement !== canvas) lockPointer(); });
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas && player) player.onMouse(e.movementX, e.movementY); });
document.addEventListener('mousedown', (e) => {
  if (game.state !== 'playing') return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) rmb = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyQ' && composer) { perf.userSet = true; setQuality((quality + 1) % 3); return; }
  if (!player || game.state !== 'playing') return;
  if (e.repeat) return;
  player.keys[e.code] = true;
  if (e.code === 'KeyR') weapon.startReload();
  if (e.code === 'KeyC' || e.code === 'ControlLeft') player.crouchPressed();
  if (e.code === 'KeyG') throwGrenade();
  if (e.code === 'KeyV') doMelee();
  if (e.code === 'Tab') e.preventDefault();
});
document.addEventListener('keyup', (e) => { if (player) player.keys[e.code] = false; });

function lockPointer() {
  if (params.has('nolock')) return;
  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(() => { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => { if (game.state === 'playing' && !SHOT) pause(); }); });
  } catch { /* ignore */ }
}
function startGame() {
  $('menu').classList.add('hidden');
  passes.weapon.enabled = true;
  hud.show(true);
  game.state = 'playing';
  lockPointer();
  if (game.wave === 0) nextWave();
}
function pause() {
  game.state = 'paused';
  mouseDown = false; rmb = false;
  player.keys = {};
  $('menu').classList.remove('hidden');
  $('deploy').textContent = 'RESUME';
  hud.show(false);
}
function restart() {
  for (const e of enemies) e.dispose();
  enemies.length = 0;
  Object.assign(game, { wave: 0, score: 0, kills: 0, headshots: 0, toSpawn: 0, spawnTimer: 0, waveBreak: 0, grenades: 3, shots: 0, hits: 0 });
  player.reset();
  weapon.ammo = 30; weapon.reserve = 150; weapon.reloading = 0;
  $('gameover').classList.add('hidden');
  startGame();
}

// ------------------------------------------------------------------ waves
const SPAWNS = [
  new THREE.Vector3(-3, 0, -88), new THREE.Vector3(3, 0, -86), new THREE.Vector3(0, 0, -76),
  new THREE.Vector3(-60, 0, 2), new THREE.Vector3(60, 0, -2), new THREE.Vector3(-55, 0, -3), new THREE.Vector3(56, 0, 3),
  new THREE.Vector3(-4, 0, -60), new THREE.Vector3(5, 0, 88), new THREE.Vector3(-5, 0, 90),
];
function nextWave() {
  game.wave++;
  game.toSpawn = 4 + game.wave * 2;
  game.spawnTimer = 1.5;
  hud.banner('WAVE ' + game.wave, game.wave === 1 ? 'HOLD THE INTERSECTION' : 'HOSTILE REINFORCEMENTS INBOUND', 3.2);
}
function spawnEnemy() {
  const cands = SPAWNS.filter((s) => s.distanceTo(player.pos) > 40);
  const s = cands[Math.floor(Math.random() * cands.length)] || SPAWNS[0];
  const e = new Enemy(scene, world, s.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)));
  enemies.push(e);
}
const NAMES = ['Viper-2', 'Kestrel', 'Grim', 'Rook', 'Sokol', 'Hydra-6', 'Mako', 'Warden', 'Ash', 'Nomad', 'Tusk', 'Raven-4'];

// ------------------------------------------------------------------ combat
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3();
function currentSpread() {
  const s = weapon.stats;
  const move = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 5);
  let sp = THREE.MathUtils.lerp(s.hipSpread, s.adsSpread, weapon.aim);
  sp *= 1 + move * 1.2 * (1 - weapon.aim * 0.8);
  if (player.crouching) sp *= 0.7;
  if (!player.grounded) sp *= 2.5;
  sp += (game.bloom || 0) * (1 - weapon.aim * 0.7);
  return sp;
}

function playerFire() {
  if (!weapon.canFire()) return;
  if (!weapon.fire()) return;
  game.shots++;
  game.bloom = Math.min(0.03, (game.bloom || 0) + 0.004);
  // camera recoil
  const a = weapon.aim;
  const n = weapon.stats.mag - weapon.ammo;
  player.addRecoil(0.011 * (1 - a * 0.35) + Math.min(n, 10) * 0.0004, (Math.random() - 0.35) * 0.006 * (1 - a * 0.4));
  // ray
  camera.getWorldPosition(_o);
  camera.getWorldDirection(_d);
  const sp = currentSpread();
  const r = Math.sqrt(Math.random()) * sp, th = Math.random() * Math.PI * 2;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  _d.addScaledVector(right, Math.cos(th) * r).addScaledVector(up, Math.sin(th) * r).normalize();
  const wh = world.raycast(_o, _d, weapon.stats.range);
  const maxT = wh ? wh.t : weapon.stats.range;
  let eh = null, target = null;
  for (const e of enemies) { const h = e.hitTest(_o, _d, maxT); if (h && (!eh || h.t < eh.t)) { eh = h; target = e; } }
  const muzzle = weapon.muzzleWorld(new THREE.Vector3());
  const end = eh ? _o.clone().addScaledVector(_d, eh.t) : wh ? wh.point : _o.clone().addScaledVector(_d, maxT);
  if (game.shots % 2 === 0) effects.tracer(muzzle.clone().addScaledVector(_d, 0.5), end, 420);
  effects.flash(muzzle.clone().addScaledVector(_d, 0.3), 60, 0.05, 0xffb060, 12);
  effects.muzzleSmoke(muzzle, _d);
  // shell casing
  const ep = weapon.ejectWorld(new THREE.Vector3());
  const ev = right.clone().multiplyScalar(2.2 + Math.random()).addScaledVector(up, 1.4 + Math.random() * 0.6).addScaledVector(_d, -0.4).add(player.vel);
  effects.ejectShell(ep, ev, camera.quaternion);

  if (eh) {
    const mult = eh.zone === 'head' ? 2.6 : eh.zone === 'legs' ? 0.8 : 1;
    const dmg = weapon.stats.damage * mult * (maxT > 60 ? 0.85 : 1);
    const killed = target.damage(dmg, _d, eh.zone);
    game.hits++;
    effects.bloodHit(end, _d);
    audio.impact(end, 'flesh');
    hud.hit(killed ? 'kill' : eh.zone === 'head' ? 'head' : '');
    audio.hitmarker(killed, eh.zone === 'head');
    if (killed) onKill(target, eh.zone === 'head');
  } else if (wh) {
    effects.impact(wh.point, wh.normal, wh.surf, _d);
    audio.impact(wh.point, wh.surf);
  }
}

function onKill(e, head) {
  game.kills++;
  if (head) game.headshots++;
  const pts = 100 + (head ? 50 : 0);
  game.score += pts;
  hud.kill(NAMES[Math.floor(Math.random() * NAMES.length)], head);
  hud.pop('+' + pts, head ? 'HEADSHOT' : 'KILL');
}

function doMelee() {
  if (!weapon.startMelee()) return;
  setTimeout(() => {
    camera.getWorldDirection(_d);
    for (const e of enemies) {
      if (!e.alive) continue;
      const to = e.root.position.clone().sub(player.pos); to.y = 0;
      if (to.length() < 2.2 && to.normalize().dot(new THREE.Vector3(_d.x, 0, _d.z).normalize()) > 0.6) {
        e.damage(200, _d, 'body'); onKill(e, false); hud.hit('kill'); audio.hitmarker(true); audio.impact(e.root.position, 'flesh');
        player.shake(0.15);
        break;
      }
    }
  }, 180);
}

// grenades
const nadeGeo = new THREE.SphereGeometry(0.045, 12, 10);
const nadeMat = new THREE.MeshStandardMaterial({ color: 0x3f4633, roughness: 0.6, metalness: 0.3 });
function throwGrenade() {
  if (game.grenades <= 0 || !weapon.startThrow()) return;
  game.grenades--;
  setTimeout(() => {
    camera.getWorldDirection(_d);
    const m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow = true;
    const p = camera.position.clone().addScaledVector(_d, 0.5).add(new THREE.Vector3(0, -0.1, 0));
    m.position.copy(p);
    scene.add(m);
    const v = _d.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4, 0)).add(player.vel);
    grenadesLive.push({ mesh: m, vel: v, fuse: 2.4 });
    audio.click(700, 0.3);
  }, 260);
}
function updateGrenades(dt) {
  for (let i = grenadesLive.length - 1; i >= 0; i--) {
    const g = grenadesLive[i];
    g.fuse -= dt;
    g.vel.y -= 9.8 * dt;
    const p = g.mesh.position;
    const next = p.clone().addScaledVector(g.vel, dt);
    const len = g.vel.length() * dt;
    if (len > 0) {
      const dir = g.vel.clone().normalize();
      const h = world.raycast(p, dir, len + 0.05);
      if (h) {
        g.vel.reflect(h.normal).multiplyScalar(0.4);
        next.copy(h.point).addScaledVector(h.normal, 0.05);
        if (g.vel.length() > 1.5) audio.impact(h.point, 'metal');
      }
    }
    p.copy(next);
    if (p.y < 0.045) { p.y = 0.045; g.vel.y = Math.abs(g.vel.y) * 0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    g.mesh.rotation.x += g.vel.length() * dt * 3;
    if (g.fuse <= 0) {
      explode(p.clone());
      scene.remove(g.mesh);
      grenadesLive.splice(i, 1);
    }
  }
}
function explode(pos) {
  effects.explosion(pos);
  audio.explosion(pos);
  const dp = pos.distanceTo(player.headPos(new THREE.Vector3()));
  player.shake(Math.max(0, 1 - dp / 30));
  if (dp < 7 && world.lineOfSight(pos.clone().setY(pos.y + 0.3), player.headPos(new THREE.Vector3()))) player.takeDamage(140 * (1 - dp / 7), pos);
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = e.root.position.distanceTo(pos);
    if (d < 8 && world.lineOfSight(pos.clone().setY(pos.y + 0.3), e.eyePos(new THREE.Vector3()).setY(e.root.position.y + 1.0))) {
      const dmg = 180 * (1 - d / 8);
      const dir = e.root.position.clone().sub(pos).setY(0.3).normalize();
      if (e.damage(dmg, dir, 'body')) { onKill(e, false); hud.hit('kill'); }
      else hud.hit('');
    }
  }
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let shotFrames = 0;
let SHOTMENU = false;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (SHOT) dt = 1 / 60;
  game.time += dt;

  if (game.state === 'playing' || (SHOT && !SHOTMENU)) {
    player.aiming = rmb && !weapon.busy;
    player.firing = mouseDown;
    player.update(dt);
    if (mouseDown && player.alive) playerFire();
    game.bloom = Math.max(0, (game.bloom || 0) - dt * (mouseDown ? 0.01 : 0.08));
    if (weapon.ammo === 0 && weapon.reserve > 0 && !weapon.isReloading && weapon.cooldown < -0.2 && (!SHOT || game.state === 'playing')) weapon.startReload();
    // waves
    if (game.state === 'playing') {
      const alive = enemies.filter((e) => e.alive).length;
      if (game.toSpawn > 0) {
        game.spawnTimer -= dt;
        if (game.spawnTimer <= 0 && alive < 6 + Math.min(game.wave, 4)) { spawnEnemy(); game.toSpawn--; game.spawnTimer = 1.2 + Math.random() * 1.5; }
      } else if (alive === 0 && game.waveBreak <= 0) {
        game.waveBreak = 7;
        game.score += 500;
        weapon.reserve = Math.min(weapon.stats.reserveMax, weapon.reserve + 90);
        game.grenades = Math.min(3, game.grenades + 2);
        hud.banner('WAVE ' + game.wave + ' CLEARED', '+500  ·  RESUPPLY RECEIVED', 3.5);
      }
      if (game.waveBreak > 0) { game.waveBreak -= dt; if (game.waveBreak <= 0) nextWave(); }
      const ctx = { player, audio, effects, enemies, coverPoints: world.coverPoints };
      for (const e of enemies) e.update(dt, ctx);
      for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive && enemies[i].deathT > 14) { enemies[i].dispose(); enemies.splice(i, 1); }
      updateGrenades(dt);
      if (!player.alive) die();
      // heartbeat when low
      game.hb = (game.hb || 0) - dt;
      if (player.hp < 35 && game.hb <= 0) { audio.heartbeat(); game.hb = 0.9; }
    } else if (SHOT) {
      for (const e of enemies) { if (e.alive) e.animate(dt); else e.updateDeath(dt); }
    }
    if (player.landImpact) { weapon.onLand(player.landImpact); player.landImpact = 0; }
    weapon.update(dt, camera, {
      aiming: player.aiming, sprinting: player.sprinting, lookDX: player.lookDX, lookDY: player.lookDY,
      moveSpeed: Math.hypot(player.vel.x, player.vel.z), grounded: player.grounded, crouch: player.crouchK, time: game.time,
    });
    hud.update(dt, { player, weapon, enemies, camera, spread: currentSpread(), grenades: game.grenades, score: game.score, wave: game.wave, hostiles: enemies.filter((e) => e.alive).length + game.toSpawn });
    audio.updateListener(camera);
  } else if (game.state === 'menu' || game.state === 'paused') {
    // slow cinematic drift behind the menu
    const t = game.time * 0.05;
    camera.position.set(Math.sin(t) * 3, 2.2 + Math.sin(t * 0.7) * 0.3, 62 - Math.cos(t) * 2);
    camera.rotation.set(0.03, Math.sin(t * 0.8) * 0.25 - 0.1, 0);
    if (game.state === 'paused') { camera.position.copy(player.pos).y += player.eye; camera.rotation.set(player.pitch, player.yaw, 0); }
    weapon.update(dt, camera, { aiming: false, sprinting: false, lookDX: 0, lookDY: 0, moveSpeed: 0, grounded: true, crouch: 0 });
  }

  effects.update(dt, camera);
  updateShadowCamera();
  updatePostUniforms(dt);
  renderer.info.reset();
  const t0 = performance.now();
  composer.render(dt);
  perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles;
  perf.frames.push(now - (perf.lastNow || now)); perf.lastNow = now; perf.cpu = performance.now() - t0;
  if (perf.frames.length > 120) perf.frames.shift();
  if (game.state === 'playing' && !SHOT) {
    perf.acc = (perf.acc || 0) + dt; perf.slow = (perf.slow || 0) + (now - (perf.prev || now) > 24 ? 1 : 0); perf.n = (perf.n || 0) + 1; perf.prev = now;
    if (perf.acc > 4) {
      if (perf.slow / perf.n > 0.5 && quality < 2 && !perf.userSet) { setQuality(quality + 1); hud.banner('', 'GRAPHICS ADJUSTED · ' + QUALITY[quality], 2); }
      perf.acc = 0; perf.slow = 0; perf.n = 0;
    }
  } else perf.prev = now;

  if (SHOT) {
    shotFrames++;
    if (shotFrames === (window.__shotFrames || 90)) { document.title = 'READY'; window.__ready = true; }
  }
}

function updateShadowCamera() {
  // follow camera, snapped to shadow texels to avoid shimmering
  const center = camera.position.clone();
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  center.addScaledVector(fwd, 20);
  const texel = (SH * 2) / sun.shadow.mapSize.x;
  const lightRot = new THREE.Matrix4().lookAt(new THREE.Vector3(), SUN_DIR.clone().negate(), new THREE.Vector3(0, 1, 0));
  const inv = lightRot.clone().invert();
  center.applyMatrix4(inv);
  center.x = Math.round(center.x / texel) * texel; center.y = Math.round(center.y / texel) * texel;
  center.applyMatrix4(lightRot);
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(SUN_DIR, 150);
  sun.target.updateMatrixWorld();
}

const _sp = new THREE.Vector3();
function updatePostUniforms(dt) {
  // sun screen position for god rays
  _sp.copy(camera.position).addScaledVector(SUN_DIR, 500).project(camera);
  const facing = new THREE.Vector3(); camera.getWorldDirection(facing);
  const vis = Math.max(0, facing.dot(SUN_DIR));
  const ru = passes.rays.uniforms;
  ru.sunPos.value.set(_sp.x * 0.5 + 0.5, _sp.y * 0.5 + 0.5);
  ru.intensity.value = vis * vis * 0.4;
  ru.aspect.value = camera.aspect;
  const g = passes.grade.uniforms;
  g.time.value += dt;
  const hpK = player ? THREE.MathUtils.clamp((0.8 - player.hp / player.maxHp) / 0.6, 0, 1) : 0;
  g.damage.value = THREE.MathUtils.lerp(g.damage.value, hpK, 1 - Math.exp(-6 * dt));
  g.aberration.value = 0.0008 + (player ? player.trauma * 0.008 : 0);
  g.adsVignette.value = weapon ? weapon.aim : 0;
  sky.material.uniforms.time.value += dt;
  sky.position.copy(camera.position);
}

function die() {
  game.state = 'dead';
  document.exitPointerLock();
  mouseDown = false; rmb = false;
  hud.show(false);
  $('go-stats').innerHTML = `WAVE REACHED <b>${game.wave}</b><br>KILLS <b>${game.kills}</b> · HEADSHOTS <b>${game.headshots}</b><br>ACCURACY <b>${game.shots ? Math.round((game.hits / game.shots) * 100) : 0}%</b><br>SCORE <b>${game.score}</b>`;
  $('gameover').classList.remove('hidden');
}

// ------------------------------------------------------------------ screenshot/debug poses
function setupShot(name) {
  if (name === 'menu') { window.__shotFrames = 120; window.__game = { player, weapon, enemies, world, effects, camera, scene, renderer, game }; SHOTMENU = true; return; }
  $('menu').classList.add('hidden');
  passes.weapon.enabled = true;
  hud.show(true);
  game.wave = 1;
  const poses = {
    street: { p: [1.5, 0, 74], yaw: 0.08, pitch: 0.02 },
    ads: { p: [1.5, 0, 74], yaw: 0.05, pitch: 0.0, ads: true },
    fight: { p: [-1, 0, 45], yaw: 0.0, pitch: -0.02, enemies: true, fire: true },
    fire: { p: [-1, 0, 45], yaw: -0.15, pitch: 0.0, fire: true },
    cross: { p: [8, 0, 14], yaw: 0.9, pitch: 0.05 },
    back: { p: [0, 0, -20], yaw: Math.PI, pitch: 0.05 },
    up: { p: [0, 0, 30], yaw: 0.3, pitch: 0.45 },
    sun: { p: [5, 0, 20], yaw: 0.72, pitch: 0.12 },
    wall: { p: [8.5, 0, 30], yaw: -1.2, pitch: 0.05 },
    enemy: { p: [0, 0, 30], yaw: 0, pitch: -0.05, enemies: 'close' },
    boom: { p: [0, 0, 40], yaw: 0, pitch: 0, boom: true },
    reload: { p: [1.5, 0, 74], yaw: 0.08, pitch: 0.02, reload: true },
    sprint: { p: [1.5, 0, 74], yaw: 0.08, pitch: 0.02, sprint: true },
    gunside: { p: [1.5, 0, 74], yaw: 0.08, pitch: 0.02, gunside: true },
    guntop: { p: [1.5, 0, 74], yaw: 0.08, pitch: 0.02, guntop: true },
    soldier: { p: [0, 0, 30], yaw: 0, pitch: -0.1, soldier: true },
    play: { p: [0, 0, 20], yaw: 0, pitch: 0, play: true },
    longplay: { p: [0, 0, 20], yaw: 0, pitch: 0, play: true, long: true },
    death: { p: [0, 0, 30], yaw: 0, pitch: -0.1, soldier: true, death: true },
  };
  const P = poses[name] || poses.street;
  player.pos.set(...P.p); player.yaw = P.yaw; player.pitch = P.pitch;
  player.update(0.016);
  shotFrames = 0;
  if (P.ads) rmb = true;
  if (P.enemies) {
    const pts = P.enemies === 'close'
      ? [[-1.5, 0, 24, 0.2], [2.5, 0, 20, -0.5], [5, 0, 16, 0.4]]
      : [[-3, 0, 22, 0], [3, 0, 18, 0.3], [0, 0, 12, -0.2], [5, 0, 30, 0.1]];
    for (const [x, y, z, yaw] of pts) {
      const e = new Enemy(scene, world, new THREE.Vector3(x, y, z));
      e.yaw = yaw; e.root.rotation.y = yaw; e.speed = 2; e.aimPitch = 0;
      enemies.push(e);
    }
  }
  if (P.gunside) { weapon.hipPos.set(0, 0, 0); weapon.root.position.set(0.0, -0.02, -0.75); weapon.root.rotation.y = Math.PI / 2; }
  if (P.guntop) { weapon.hipPos.set(0, 0, 0); weapon.root.position.set(0.0, -0.02, -0.75); weapon.root.rotation.x = Math.PI / 2; }
  if (P.soldier) {
    const e1 = new Enemy(scene, world, new THREE.Vector3(-0.8, 0, 26.5)); e1.yaw = 0.5; e1.root.rotation.y = e1.yaw; e1.speed = 0; e1.aimPitch = 0; enemies.push(e1);
    const e2 = new Enemy(scene, world, new THREE.Vector3(1.4, 0, 25.5)); e2.yaw = -0.9; e2.root.rotation.y = e2.yaw; e2.speed = 3; e2.aimPitch = 0; enemies.push(e2);
  }
  if (P.play) {
    game.wave = 0; game.state = 'playing'; nextWave(); game.spawnTimer = 0;
    for (let i = 0; i < 5; i++) { spawnEnemy(); game.toSpawn--; }
    for (const e of enemies) e.root.position.z = Math.min(e.root.position.z, -20);
    window.__shotFrames = P.long ? 4200 : 900;
    player.difficulty = P.long ? 0.05 : 0.2;
    const f = () => {
      // debug bot: aim at nearest visible enemy and fire in bursts
      let best = null, bd = 1e9;
      const eye = player.headPos(new THREE.Vector3());
      for (const e of enemies) {
        if (!e.alive) continue;
        const hp = e.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.35, 0));
        const d = hp.distanceTo(eye);
        if (d < bd && world.lineOfSight(eye, hp)) { bd = d; best = hp; }
      }
      if (best) {
        const dir = best.clone().sub(eye).normalize();
        const ty = Math.atan2(-dir.x, -dir.z), tp = Math.asin(dir.y);
        player.yaw += (ty - player.yaw) * 0.15; player.pitch += (tp - player.pitch) * 0.15;
        mouseDown = Math.abs(ty - player.yaw) < 0.05 && (shotFrames % 40) < 22;
        rmb = true;
      } else { mouseDown = false; rmb = false; }
      if (shotFrames < window.__shotFrames) requestAnimationFrame(f);
    }; f();
  }
  if (P.death) {
    setTimeout(() => { enemies[0].damage(200, new THREE.Vector3(0.3, 0, -1).normalize(), 'head'); enemies[1].damage(200, new THREE.Vector3(1, 0, -0.4).normalize(), 'body'); effects.bloodHit(enemies[0].head.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1)); }, 400);
    window.__shotFrames = 160;
  }
  if (P.sprint) { player.keys.ShiftLeft = true; player.keys.KeyW = true; shotFrames = -60; }
  if (P.reload) { weapon.ammo = 10; setTimeout(() => weapon.startReload(), 600); window.__shotFrames = 125; }
  if (P.fire) {
    window.__shotFrames = 100;
    const f = () => { mouseDown = shotFrames > 70; if (shotFrames < 100) requestAnimationFrame(f); };
    f();
  }
  if (P.boom) { setTimeout(() => explode(new THREE.Vector3(1, 0.1, 25)), 800); window.__shotFrames = 60; }
  window.__game = { player, weapon, enemies, world, effects, camera, scene, renderer, game };
}

init().catch((e) => { console.error(e); document.title = 'ERROR ' + e.message; $('load-text').textContent = 'ERROR: ' + e.message; });
window.addEventListener('error', (e) => { document.title = 'ERROR ' + e.message; });
