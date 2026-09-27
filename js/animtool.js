// Standalone animation lab for the enemy soldier. Uses the real Enemy class from the game,
// drives its inputs (speed, facing, crouch, aim, deaths) directly and visualizes what the
// procedural control rig and the retargeted Mixamo skeleton are doing.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Enemy, loadSoldier } from './enemies.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2e33);
scene.fog = new THREE.Fog(0x2a2e33, 25, 70);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 200);
camera.position.set(3.2, 1.8, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x3a3228, 1.2));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.6);
sun.position.set(4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(200, 200, 0x5a6168, 0x464c53);
grid.position.y = 0.002;
scene.add(grid);

// "player" marker the AI path mode faces
const playerMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0x3a86ff, transparent: true, opacity: 0.35 }));
playerMarker.position.set(0, 0.9, 0);
playerMarker.visible = false;
scene.add(playerMarker);

const world = { colliders: [], collide() { return true; }, raycast() { return null; }, lineOfSight() { return true; } };

// ---------------------------------------------------------------- UI state
const ui = {
  mode: 'walk', paused: false, stepOnce: false, ready: 'auto',
  get speed() { return +$('speed').value; },
  get facing() { return THREE.MathUtils.degToRad(+$('facing').value); },
  get crouch() { return +$('crouch').value; },
  get pitch() { return +$('pitch').value; },
  get timescale() { return +$('timescale').value; },
};
for (const id of ['speed', 'facing', 'crouch', 'pitch', 'timescale']) {
  const el = $(id), out = el.parentElement.querySelector('output');
  const upd = () => { out.textContent = id === 'facing' ? el.value + '°' : (+el.value).toFixed(2); };
  el.addEventListener('input', upd); upd();
}
const MODES = {
  idle: { speed: 0, facing: 0, crouch: 0 }, walk: { speed: 1.6, facing: 0, crouch: 0 }, run: { speed: 3.6, facing: 0, crouch: 0 },
  strafe: { speed: 1.6, facing: 90, crouch: 0 }, back: { speed: 1.4, facing: 180, crouch: 0 }, crouch: { speed: 0, facing: 0, crouch: 1 },
  crouchwalk: { speed: 1.0, facing: 0, crouch: 1 }, ai: { speed: 2.2, facing: 0, crouch: 0 }, turn: { speed: 0, facing: 0, crouch: 0 },
};
function setMode(m) {
  ui.mode = m;
  const p = MODES[m];
  $('speed').value = p.speed; $('facing').value = p.facing; $('crouch').value = p.crouch;
  for (const id of ['speed', 'facing', 'crouch']) $(id).dispatchEvent(new Event('input'));
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  playerMarker.visible = m === 'ai';
  resetEnemy();
}
document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------------------------------------------------------------- enemy + debug visuals
let enemy = null, travel = 0, prevPos = new THREE.Vector3();
const origRetarget = Enemy.prototype.retarget;

function resetEnemy() {
  if (enemy) enemy.dispose();
  enemy = new Enemy(scene, world, new THREE.Vector3(0, 0, 0));
  enemy.awareness = 1;
  enemy.readyOverride = ui.ready === 'auto' ? undefined : +ui.ready;
  if (!$('retarget').checked) enemy.retarget = () => {};
  enemy.model.visible = $('showModel').checked;
  travel = 0; prevPos.set(0, 0, 0);
  skel.setTarget(enemy.model);
  trail.clear();
  hist.length = 0;
}

// control-rig lines (drawn on top)
const rigGeo = new THREE.BufferGeometry();
rigGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
const rigLines = new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x00e5ff, depthTest: false, transparent: true }));
rigLines.renderOrder = 10; rigLines.frustumCulled = false; rigLines.visible = false;
scene.add(rigLines);
const rigJoints = new THREE.Points(rigGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false, depthTest: false }));
rigJoints.renderOrder = 11; rigJoints.frustumCulled = false; rigJoints.visible = false;
scene.add(rigJoints);

function updateRigLines() {
  const e = enemy, W = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
  const segs = [
    [W(e.hips), W(e.spine)], [W(e.spine), W(e.spine, 0, 0.5, 0)], [W(e.spine, 0, 0.5, 0), W(e.head)],
    [W(e.spine, 0, 0.42, 0), W(e.armL.sh)], [W(e.spine, 0, 0.42, 0), W(e.armR.sh)],
  ];
  for (const A of [e.armL, e.armR]) segs.push([W(A.sh), W(A.el)], [W(A.el), W(A.el, 0, -0.28, 0)]);
  for (const L of [e.legL, e.legR]) segs.push([W(e.hips), W(L.hp)], [W(L.hp), W(L.kn)], [W(L.kn), W(L.kn, 0, -0.44, 0)]);
  const arr = rigGeo.attributes.position.array;
  let i = 0;
  for (const [a, b] of segs) { arr.set([a.x, a.y, a.z, b.x, b.y, b.z], i); i += 6; }
  rigGeo.setDrawRange(0, segs.length * 2);
  rigGeo.attributes.position.needsUpdate = true;
}

// Mixamo skeleton helper
const skel = {
  helper: null,
  setTarget(obj) {
    if (this.helper) scene.remove(this.helper);
    this.helper = new THREE.SkeletonHelper(obj);
    this.helper.material.depthTest = false;
    this.helper.renderOrder = 12;
    this.helper.visible = $('showSkel').checked;
    scene.add(this.helper);
  },
};

// footprints: dots dropped where each foot is while it is on the ground
const trail = {
  max: 1200, n: 0,
  mesh: new THREE.InstancedMesh(new THREE.CircleGeometry(0.018, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ vertexColors: false }), 1200),
  clear() { this.n = 0; this.mesh.count = 0; },
  add(p, color) {
    const i = this.n % this.max; this.n++;
    this.mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, 0.004, p.z));
    this.mesh.setColorAt(i, color);
    this.mesh.count = Math.min(this.n, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  },
};
trail.mesh.frustumCulled = false;
scene.add(trail.mesh);
const COL_L = new THREE.Color(0xffa31a), COL_R = new THREE.Color(0x4aa3ff);

// toggles
$('showModel').addEventListener('change', (e) => { enemy.model.visible = e.target.checked; });
$('showRig').addEventListener('change', (e) => { rigLines.visible = rigJoints.visible = e.target.checked; });
$('showSkel').addEventListener('change', (e) => { skel.helper.visible = e.target.checked; });
$('showTrail').addEventListener('change', (e) => { trail.mesh.visible = e.target.checked; });
$('retarget').addEventListener('change', (e) => { enemy.retarget = e.target.checked ? origRetarget : () => {}; if (!e.target.checked) resetEnemy(); });
document.querySelectorAll('#ready button').forEach((b) => b.addEventListener('click', () => {
  ui.ready = b.dataset.ready;
  enemy.readyOverride = ui.ready === 'auto' ? undefined : +ui.ready;
  document.querySelectorAll('#ready button').forEach((x) => x.classList.toggle('on', x === b));
}));
// camera presets relative to the soldier's facing
function camPreset(kind) {
  const e = enemy, hp = e.hips.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  controls.target.set(hp.x, 1.3, hp.z);
  const off = kind === 'front' ? fwd.clone().multiplyScalar(2.2).setY(0.25) : kind === 'side' ? right.clone().multiplyScalar(-2.2).setY(0.2) : fwd.clone().multiplyScalar(0.3).setY(2.2);
  camera.position.copy(controls.target).add(off);
  controls.update();
}
$('camFront').addEventListener('click', () => camPreset('front'));
$('camSide').addEventListener('click', () => camPreset('side'));
$('camTop').addEventListener('click', () => camPreset('top'));
window.__camPreset = camPreset;
$('flinch').addEventListener('click', () => { enemy.flinch = 1; });
$('die0').addEventListener('click', () => enemy.damage(500, new THREE.Vector3(Math.sin(enemy.yaw), 0, Math.cos(enemy.yaw)).negate(), 'body'));
$('die1').addEventListener('click', () => enemy.damage(500, new THREE.Vector3(Math.sin(enemy.yaw), 0, Math.cos(enemy.yaw)).negate(), 'head'));
$('pause').addEventListener('click', (e) => { ui.paused = !ui.paused; e.target.classList.toggle('on', ui.paused); });
$('step').addEventListener('click', () => { ui.stepOnce = true; });
$('reset').addEventListener('click', resetEnemy);

// ---------------------------------------------------------------- simulation
const hist = [];
let footPrev = { L: null, R: null }, slipAvg = 0, dropT = 0, simT = 0;

function drive(dt) {
  const e = enemy;
  simT += dt;
  if (!e.alive) { e.updateDeath(dt); return; }
  let moveYaw = 0, speed = ui.speed, faceYaw;
  const pos = e.root.position;
  if (ui.mode === 'ai') {
    // circle around the player marker while facing it: what enemies do in combat
    const r = 6, w = speed / r;
    const a = simT * w;
    const target = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const v = target.clone().sub(pos);
    pos.copy(target);
    moveYaw = Math.atan2(v.x, v.z);
    faceYaw = Math.atan2(-pos.x, -pos.z);
  } else if (ui.mode === 'turn') {
    speed = 0;
    faceYaw = Math.sin(simT * 1.3) * 1.6;
  } else {
    // straight track back and forth along x
    travel += speed * dt;
    const L = 12, t = travel % (2 * L), dirSign = t < L ? 1 : -1;
    moveYaw = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    pos.x = dirSign > 0 ? t - L / 2 : L * 1.5 - t;
    faceYaw = moveYaw + ui.facing;
  }
  // game-like smoothing of yaw (same rate as Enemy.update)
  let dy = faceYaw - e.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  e.yaw += dy * Math.min(1, dt * 8);
  e.root.rotation.y = e.yaw;
  e.speed = speed;
  e.crouch = ui.crouch;
  e.aimPitch = ui.pitch;
  e.vel.set(Math.sin(moveYaw) * speed, 0, Math.cos(moveYaw) * speed);
  e.flinch = Math.max(0, e.flinch - dt * 4);
  e.animate(dt);
  e._moveYaw = moveYaw;
}

function measure(dt) {
  const e = enemy;
  if (!e.bones.LeftFoot) return;
  const fL = e.bones.LeftFoot.getWorldPosition(new THREE.Vector3());
  const fR = e.bones.RightFoot.getWorldPosition(new THREE.Vector3());
  // stance foot = the lower one; how fast does it move over the ground?
  const stance = fL.y < fR.y ? 'L' : 'R';
  const cur = stance === 'L' ? fL : fR;
  const prev = footPrev[stance];
  if (prev && dt > 0) {
    const slip = Math.hypot(cur.x - prev.x, cur.z - prev.z) / dt;
    slipAvg += (slip - slipAvg) * Math.min(1, dt * 4);
  }
  footPrev = { L: fL.clone(), R: fR.clone() };
  dropT += dt;
  if (dropT > 0.04) {
    dropT = 0;
    const low = Math.min(fL.y, fR.y);
    if (fL.y < low + 0.03) trail.add(fL, COL_L);
    if (fR.y < low + 0.03) trail.add(fR, COL_R);
  }
  const speed = e.speed;
  const stepsPerSec = (2.2 + speed * 2.1) / Math.PI;
  const wanted = stepsPerSec > 0 ? speed / stepsPerSec : 0;
  const k = Math.min(1, speed / 3.5);
  const legLen = 0.87;
  const actual = 2 * legLen * Math.sin(0.7 * k);
  const slipEl = $('slip');
  slipEl.textContent = slipAvg.toFixed(2) + ' m/s';
  slipEl.className = slipAvg < 0.2 ? 'good' : slipAvg < 0.5 ? '' : 'bad';
  $('cadence').textContent = stepsPerSec.toFixed(2) + ' /s';
  const sEl = $('stride');
  sEl.textContent = wanted.toFixed(2) + ' / ' + actual.toFixed(2) + ' m';
  sEl.className = speed < 0.05 || Math.abs(wanted - actual) < 0.15 ? 'good' : 'bad';
  let rel = THREE.MathUtils.radToDeg((e._moveYaw ?? e.yaw) - e.yaw);
  rel = ((rel + 540) % 360) - 180;
  const dEl = $('dir');
  dEl.textContent = speed > 0.05 ? rel.toFixed(0) + '°' : '–';
  dEl.className = speed > 0.05 && Math.abs(rel) > 35 ? 'bad' : '';
  $('hipy').textContent = e.hips.position.y.toFixed(2) + ' m';
  hist.push([e.legL.hp.rotation.x, e.legR.hp.rotation.x, e.legL.kn.rotation.x, e.legR.kn.rotation.x, slipAvg]);
  if (hist.length > 250) hist.shift();
}

function drawGraph() {
  const c = $('graph'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#2a2f35'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  const series = [[0, '#f2c14e', []], [1, '#4aa3ff', []], [2, '#f2c14e', [4, 4]], [3, '#4aa3ff', [4, 4]], [4, '#ff5a4f', []]];
  for (const [idx, col, dash] of series) {
    g.strokeStyle = col; g.setLineDash(dash); g.lineWidth = 2; g.beginPath();
    hist.forEach((h, i) => {
      const x = (i / 250) * W;
      const y = idx === 4 ? H - h[idx] * H * 0.5 : H / 2 - h[idx] * H * 0.3;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }
  g.setLineDash([]);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!ui.paused || ui.stepOnce) {
    const dt = ui.stepOnce ? 1 / 60 : real * ui.timescale;
    ui.stepOnce = false;
    drive(dt);
    measure(dt);
    drawGraph();
  }
  if (rigLines.visible) updateRigLines();
  if ($('follow').checked) {
    const hp = enemy.hips.getWorldPosition(new THREE.Vector3());
    const delta = hp.clone().sub(controls.target);
    delta.y = 0;
    controls.target.add(delta); camera.position.add(delta);
  }
  sun.target.position.copy(controls.target); sun.position.copy(controls.target).add(new THREE.Vector3(4, 8, 5));
  controls.update();
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await loadSoldier();
$('loading').remove();
resetEnemy();
setMode('walk');
window.__lab = { get enemy() { return enemy; }, setMode, ui, camera, controls };
import("../js/enemies.js").then((m) => { window.__E = m; });
document.title = 'READY';
requestAnimationFrame(loop);
