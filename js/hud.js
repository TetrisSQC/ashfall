// DOM HUD: compass, rotating minimap, dynamic crosshair, hitmarkers, killfeed,
// damage direction indicators, ammo / equipment, wave banners.
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(world) {
    this.world = world;
    this.el = $('hud');
    this.mm = $('minimap'); this.mmx = this.mm.getContext('2d');
    this.buildCompass();
    this.buildMapImage();
    this.hitT = 1; this.hitKind = '';
    this.chSpread = 10;
    this.ind = new Map();
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  buildCompass() {
    const strip = $('compass-strip');
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    this.pxPerDeg = 4.2;
    let html = '';
    for (let rep = -1; rep <= 1; rep++) {
      for (let d = 0; d < 360; d += 15) {
        const x = (d + rep * 360) * this.pxPerDeg;
        if (labels[d]) html += `<span class="card" style="left:${x}px">${labels[d]}</span>`;
        else html += `<span style="left:${x}px">${d}</span>`;
        html += `<span class="tick" style="left:${x}px"></span>`;
      }
    }
    strip.innerHTML = html;
    this.compassStrip = strip;
    this.compassEnemies = [];
  }

  buildMapImage() {
    const S = 1024, scale = 4; // px per meter, centered at 0
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.fillStyle = '#353836';
    g.fillRect(-7 * scale, -100 * scale, 14 * scale, 200 * scale);
    g.fillRect(-70 * scale, -7 * scale, 140 * scale, 14 * scale);
    g.fillStyle = '#2a2c2b';
    for (const c2 of this.world.colliders) {
      const h = c2.max.y - c2.min.y;
      if (h < 0.3) continue;
      const w = c2.max.x - c2.min.x, d = c2.max.z - c2.min.z;
      if (w > 200) continue;
      g.fillStyle = h > 3 ? '#5b605c' : '#8a8f86';
      g.fillRect(c2.min.x * scale, c2.min.z * scale, w * scale, d * scale);
      if (h > 3) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(c2.min.x * scale, c2.min.z * scale, w * scale, d * scale); }
    }
    this.mapImg = c; this.mapScale = scale; this.mapSize = S;
  }

  update(dt, s) {
    const { player, weapon, enemies } = s;
    // compass (yaw 0 = looking -z = north)
    const deg = ((-player.yaw * 180) / Math.PI) % 360;
    const heading = (deg + 360) % 360;
    this.compassStrip.style.transform = `translateX(${260 - heading * this.pxPerDeg}px)`;

    // minimap
    const g = this.mmx, W = this.mm.width, R = W / 2;
    const zoom = 1.3; // px per meter on minimap
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    g.translate(R, R);
    g.rotate(player.yaw);
    const k = zoom / this.mapScale;
    g.scale(k, k);
    g.globalAlpha = 0.9;
    g.drawImage(this.mapImg, -this.mapSize / 2 - player.pos.x * this.mapScale, -this.mapSize / 2 - player.pos.z * this.mapScale);
    g.globalAlpha = 1;
    g.restore();
    g.save();
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    g.translate(R, R);
    // view cone
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
    // enemies (visible ones and ones that fired recently)
    const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
    const pips = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.root.position.x - player.pos.x, dz = e.root.position.z - player.pos.z;
      const rx = (dx * cy - dz * sy) * zoom, rz = (dx * sy + dz * cy) * zoom;
      if (e.burstLeft > 0 || e.shotTimer > -1.5) {
        const r = Math.hypot(rx, rz);
        const f = r > R - 8 ? (R - 8) / r : 1;
        g.fillStyle = '#ff3b30'; g.shadowColor = 'rgba(255,0,0,0.8)'; g.shadowBlur = 6;
        g.beginPath(); g.arc(rx * f, rz * f, 4.5, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        pips.push(Math.atan2(dx, -dz));
      }
    }
    // player arrow
    g.fillStyle = '#f2c14e';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();

    // compass enemy markers
    const strip = this.compassStrip;
    while (this.compassEnemies.length < pips.length) { const sp = document.createElement('span'); sp.className = 'enemy'; strip.appendChild(sp); this.compassEnemies.push(sp); }
    this.compassEnemies.forEach((sp, i) => {
      if (i < pips.length) {
        let d = (pips[i] * 180) / Math.PI; d = (d + 360) % 360;
        let rel = d - heading; while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
        sp.style.display = Math.abs(rel) < 60 ? '' : 'none';
        sp.style.left = (heading + rel) * this.pxPerDeg + 'px';
      } else sp.style.display = 'none';
    });

    // crosshair
    const spread = s.spread;
    const px = 6 + spread * 700;
    this.chSpread += (px - this.chSpread) * Math.min(1, dt * 18);
    const ch = document.getElementById('crosshair');
    ch.style.opacity = weapon.aim > 0.5 || player.sprinting || weapon.isReloading ? 0 : 1;
    const c = this.chSpread;
    ch.children[0].style.transform = `translateY(${-c - 10}px)`;
    ch.children[1].style.transform = `translateY(${c}px)`;
    ch.children[2].style.transform = `translateX(${-c - 10}px)`;
    ch.children[3].style.transform = `translateX(${c}px)`;

    // hitmarker
    this.hitT += dt;
    const hm = $('hitmarker');
    const a = Math.max(0, 1 - this.hitT / 0.3);
    hm.style.opacity = a;
    const sc = 1 + (1 - a) * 0.3;
    hm.style.transform = `scale(${this.hitKind === 'kill' ? sc * 1.2 : sc})`;

    // ammo
    $('ammo-mag').textContent = weapon.ammo;
    $('ammo-mag').classList.toggle('low', weapon.ammo <= 8);
    $('ammo-reserve').textContent = '/ ' + weapon.reserve;
    $('ammo-bar').style.width = (weapon.ammo / weapon.stats.mag) * 210 + 'px';
    const nades = document.querySelectorAll('#equipment .nade');
    nades.forEach((n, i) => n.classList.toggle('used', i >= s.grenades));

    // prompt
    let prompt = '';
    if (weapon.ammo === 0 && weapon.reserve > 0 && !weapon.isReloading) prompt = 'PRESS <b style="color:#f2c14e">R</b> TO RELOAD';
    else if (weapon.ammo <= 8 && weapon.reserve > 0 && !weapon.isReloading) prompt = '<span style="color:#f2c14e">LOW AMMO</span>';
    else if (weapon.ammo === 0 && weapon.reserve === 0) prompt = '<span style="color:#ff3b30">NO AMMO</span>';
    if (weapon.isReloading) prompt = 'RELOADING';
    const pe = $('prompt');
    if (pe.innerHTML !== prompt) pe.innerHTML = prompt;

    // blood / low-health
    const hpK = Math.max(0, (0.75 - player.hp / player.maxHp) / 0.75);
    $('blood').style.opacity = Math.min(0.85, hpK * 1.1);

    // damage indicators
    const di = $('dmg-indicators');
    for (const ev of player.damageEvents) {
      let el = this.ind.get(ev);
      if (!el) { el = document.createElement('div'); el.className = 'dmg-ind'; di.appendChild(el); this.ind.set(ev, el); }
      const dx = ev.from.x - player.pos.x, dz = ev.from.z - player.pos.z;
      const ang = Math.atan2(dx, -dz) + player.yaw;
      el.style.transform = `rotate(${ang}rad)`;
      el.style.opacity = Math.max(0, 1 - ev.t / 1.6);
    }
    for (const [ev, el] of this.ind) if (!player.damageEvents.includes(ev)) { el.remove(); this.ind.delete(ev); }

    $('score-num').textContent = s.score;
    $('wave-num').textContent = s.wave;
    $('hostiles-num').textContent = s.hostiles;
  }

  hit(kind) {
    this.hitT = 0; this.hitKind = kind;
    const hm = $('hitmarker');
    hm.className = kind === 'kill' ? 'kill' : kind === 'head' ? 'head' : '';
  }

  kill(name, head) {
    const kf = $('killfeed');
    const row = document.createElement('div');
    row.className = 'kf';
    row.innerHTML = `<span class="you">YOU</span><span class="wpn">[ G36 ]${head ? ' ⌖' : ''}</span><span class="foe">${name}</span>`;
    kf.prepend(row);
    setTimeout(() => row.remove(), 5000);
    while (kf.children.length > 5) kf.lastChild.remove();
  }

  pop(text, sub) {
    const p = $('score-pops');
    const d = document.createElement('div');
    d.className = 'pop';
    d.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    p.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  banner(title, sub, dur = 3) {
    $('banner-title').textContent = title; $('banner-sub').textContent = sub;
    const b = $('banner'); b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), dur * 1000);
  }

  flash(v) { $('flash').style.opacity = v; }
}
