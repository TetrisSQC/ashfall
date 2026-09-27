unit ashfall.hud;

// DOM HUD: compass, rotating minimap, dynamic crosshair, hitmarkers, killfeed,
// damage direction indicators, ammo / equipment, wave banners.

interface

uses
  ashfall.host, ashfall.three, ashfall.world, ashfall.weapon, ashfall.player, ashfall.enemies;

type
  THUD = class
  private
    FWorld: TWorld;
    FEl, FMM: JElement;
    FMMX: JCanvas2D;
    FHitT: Float;
    FHitKind: String;
    FChSpread, FPxPerDeg: Float;
    FCompassStrip: JElement;
    FCompassEnemies: array of JElement;
    FMapImg: JElement;
    FMapScale, FMapSize: Float;
    FIndicators: array of TDamageEvent;
    FBannerTimer: variant;
    procedure BuildCompass;
    procedure BuildMapImage;
  public
    constructor Create(world: TWorld);
    procedure Show(v: Boolean);
    procedure Update(dt: Float; player: TPlayer; weapon: TWeapon; enemies: array of TEnemy; spread: Float;
      grenades, score, wave, hostiles: Integer);
    procedure Hit(kind: String);
    procedure Kill(name: String; head: Boolean);
    procedure Pop(text, sub: String);
    procedure Banner(title, sub: String; dur: Float = 3);
    procedure Flash(v: Float);
  end;

implementation

constructor THUD.Create(world: TWorld);
begin
  FWorld := world;
  FEl := El('hud');
  FMM := El('minimap');
  FMMX := FMM.getContext('2d');
  BuildCompass;
  BuildMapImage;
  FHitT := 1;
  FHitKind := '';
  FChSpread := 10;
end;

procedure THUD.Show(v: Boolean);
begin
  FEl.classList.toggle('hidden', not v);
end;

procedure THUD.BuildCompass;
begin
  var strip := El('compass-strip');
  FPxPerDeg := 4.2;
  var html := '';
  for var rep := -1 to 1 do begin
    var d := 0;
    while d < 360 do begin
      var x := (d + rep * 360) * FPxPerDeg;
      var lbl := '';
      case d of
        0: lbl := 'N';
        45: lbl := 'NE';
        90: lbl := 'E';
        135: lbl := 'SE';
        180: lbl := 'S';
        225: lbl := 'SW';
        270: lbl := 'W';
        315: lbl := 'NW';
      end;
      if lbl <> '' then html += '<span class="card" style="left:' + Num(x) + 'px">' + lbl + '</span>'
      else html += '<span style="left:' + Num(x) + 'px">' + IntStr(d) + '</span>';
      html += '<span class="tick" style="left:' + Num(x) + 'px"></span>';
      d += 15;
    end;
  end;
  strip.innerHTML := html;
  FCompassStrip := strip;
end;

procedure THUD.BuildMapImage;
begin
  var S := 1024;
  var scale := 4.0; // px per meter, centered at 0
  var c := NewCanvas(S, S);
  var g := c.getContext('2d');
  g.fillStyle := '#1b1d1c'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.fillStyle := '#353836';
  g.fillRect(-7 * scale, -100 * scale, 14 * scale, 200 * scale);
  g.fillRect(-70 * scale, -7 * scale, 140 * scale, 14 * scale);
  g.fillStyle := '#2a2c2b';
  for var c2 in FWorld.Colliders do begin
    var h := c2.Max.y - c2.Min.y;
    if h < 0.3 then continue;
    var w := c2.Max.x - c2.Min.x;
    var d := c2.Max.z - c2.Min.z;
    if w > 200 then continue;
    g.fillStyle := if h > 3 then '#5b605c' else '#8a8f86';
    g.fillRect(c2.Min.x * scale, c2.Min.z * scale, w * scale, d * scale);
    if h > 3 then begin
      g.strokeStyle := 'rgba(0,0,0,0.5)';
      g.lineWidth := 2;
      g.strokeRect(c2.Min.x * scale, c2.Min.z * scale, w * scale, d * scale);
    end;
  end;
  FMapImg := c;
  FMapScale := scale;
  FMapSize := S;
end;

procedure THUD.Update(dt: Float; player: TPlayer; weapon: TWeapon; enemies: array of TEnemy; spread: Float;
  grenades, score, wave, hostiles: Integer);
begin
  // compass (yaw 0 = looking -z = north)
  var deg := FMod((-player.Yaw * 180) / PI, 360);
  var heading := FMod(deg + 360, 360);
  FCompassStrip.style.transform := 'translateX(' + Num(260 - heading * FPxPerDeg) + 'px)';

  // minimap
  var g := FMMX;
  var MW := FMM.width;
  var Rad := MW / 2;
  var zoom := 1.3; // px per meter on minimap
  g.save;
  g.clearRect(0, 0, MW, MW);
  g.beginPath; g.arc(Rad, Rad, Rad, 0, PI * 2); g.clip;
  g.translate(Rad, Rad);
  g.rotate(player.Yaw);
  var k := zoom / FMapScale;
  g.scale(k, k);
  g.globalAlpha := 0.9;
  g.drawImage(FMapImg, -FMapSize / 2 - player.Pos.x * FMapScale, -FMapSize / 2 - player.Pos.z * FMapScale);
  g.globalAlpha := 1;
  g.restore;
  g.save;
  g.beginPath; g.arc(Rad, Rad, Rad, 0, PI * 2); g.clip;
  g.translate(Rad, Rad);
  // view cone
  var grd := g.createRadialGradient(0, 0, 0, 0, 0, Rad);
  grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle := grd;
  g.beginPath; g.moveTo(0, 0); g.arc(0, 0, Rad, -PI / 2 - 0.55, -PI / 2 + 0.55); g.closePath; g.fill;
  // enemies (visible ones and ones that fired recently)
  var cy := Cos(player.Yaw);
  var sy := Sin(player.Yaw);
  var pips: array of Float;
  for var e in enemies do begin
    if not e.Alive then continue;
    var dx := e.Root.position.x - player.Pos.x;
    var dz := e.Root.position.z - player.Pos.z;
    var rx := (dx * cy - dz * sy) * zoom;
    var rz := (dx * sy + dz * cy) * zoom;
    if (e.BurstLeft > 0) or (e.ShotTimer > -1.5) then begin
      var rr := Hypot(rx, rz);
      var f := if rr > Rad - 8 then (Rad - 8) / rr else 1.0;
      g.fillStyle := '#ff3b30'; g.shadowColor := 'rgba(255,0,0,0.8)'; g.shadowBlur := 6;
      g.beginPath; g.arc(rx * f, rz * f, 4.5, 0, PI * 2); g.fill;
      g.shadowBlur := 0;
      pips.Add(Atan2(dx, -dz));
    end;
  end;
  // player arrow
  g.fillStyle := '#f2c14e';
  g.beginPath; g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath; g.fill;
  g.restore;

  // compass enemy markers
  var strip := FCompassStrip;
  while FCompassEnemies.Length < pips.Length do begin
    var sp := Document.createElement('span');
    sp.className := 'enemy';
    strip.appendChild(sp);
    FCompassEnemies.Add(sp);
  end;
  for var i := 0 to FCompassEnemies.Length - 1 do begin
    var sp := FCompassEnemies[i];
    if i < pips.Length then begin
      var d := (pips[i] * 180) / PI;
      d := FMod(d + 360, 360);
      var rel := d - heading;
      while rel > 180 do rel -= 360;
      while rel < -180 do rel += 360;
      sp.style.display := if Abs(rel) < 60 then '' else 'none';
      sp.style.left := Num((heading + rel) * FPxPerDeg) + 'px';
    end else
      sp.style.display := 'none';
  end;

  // crosshair
  var px := 6 + spread * 700;
  FChSpread += (px - FChSpread) * MinF(1, dt * 18);
  var ch := El('crosshair');
  ch.style.opacity := if (weapon.Aim > 0.5) or player.Sprinting or weapon.IsReloading then '0' else '1';
  var c := FChSpread;
  ch.children[0].style.transform := 'translateY(' + Num(-c - 10) + 'px)';
  ch.children[1].style.transform := 'translateY(' + Num(c) + 'px)';
  ch.children[2].style.transform := 'translateX(' + Num(-c - 10) + 'px)';
  ch.children[3].style.transform := 'translateX(' + Num(c) + 'px)';

  // hitmarker
  FHitT += dt;
  var hm := El('hitmarker');
  var a := MaxF(0, 1 - FHitT / 0.3);
  hm.style.opacity := Num(a);
  var sc := 1 + (1 - a) * 0.3;
  hm.style.transform := 'scale(' + Num(if FHitKind = 'kill' then sc * 1.2 else sc) + ')';

  // ammo
  El('ammo-mag').textContent := IntStr(weapon.Ammo);
  El('ammo-mag').classList.toggle('low', weapon.Ammo <= 8);
  El('ammo-reserve').textContent := '/ ' + IntStr(weapon.Reserve);
  El('ammo-bar').style.width := Num((weapon.Ammo / weapon.Stats.Mag) * 210) + 'px';
  var nades := Document.querySelectorAll('#equipment .nade');
  for var i := 0 to nades.&length - 1 do nades[i].classList.toggle('used', i >= grenades);

  // prompt
  var prompt := '';
  if (weapon.Ammo = 0) and (weapon.Reserve > 0) and not weapon.IsReloading then prompt := 'PRESS <b style="color:#f2c14e">R</b> TO RELOAD'
  else if (weapon.Ammo <= 8) and (weapon.Reserve > 0) and not weapon.IsReloading then prompt := '<span style="color:#f2c14e">LOW AMMO</span>'
  else if (weapon.Ammo = 0) and (weapon.Reserve = 0) then prompt := '<span style="color:#ff3b30">NO AMMO</span>';
  if weapon.IsReloading then prompt := 'RELOADING';
  var pe := El('prompt');
  if pe.innerHTML <> prompt then pe.innerHTML := prompt;

  // blood / low-health
  var hpK := MaxF(0, (0.75 - player.HP / player.MaxHP) / 0.75);
  El('blood').style.opacity := Num(MinF(0.85, hpK * 1.1));

  // damage indicators
  var di := El('dmg-indicators');
  for var ev in player.DamageEvents do begin
    if ev.El = nil then begin
      ev.El := Document.createElement('div');
      ev.El.className := 'dmg-ind';
      di.appendChild(ev.El);
      FIndicators.Add(ev);
    end;
    var dx := ev.From.x - player.Pos.x;
    var dz := ev.From.z - player.Pos.z;
    var ang := Atan2(dx, -dz) + player.Yaw;
    ev.El.style.transform := 'rotate(' + Num(ang) + 'rad)';
    ev.El.style.opacity := Num(MaxF(0, 1 - ev.T / 1.6));
  end;
  for var i := FIndicators.Length - 1 downto 0 do begin
    var ev := FIndicators[i];
    if player.DamageEvents.IndexOf(ev) < 0 then begin
      ev.El.remove;
      FIndicators.Delete(i);
    end;
  end;

  El('score-num').textContent := IntStr(score);
  El('wave-num').textContent := IntStr(wave);
  El('hostiles-num').textContent := IntStr(hostiles);
end;

procedure THUD.Hit(kind: String);
begin
  FHitT := 0;
  FHitKind := kind;
  El('hitmarker').className := if kind = 'kill' then 'kill' else if kind = 'head' then 'head' else '';
end;

procedure THUD.Kill(name: String; head: Boolean);
begin
  var kf := El('killfeed');
  var row := Document.createElement('div');
  row.className := 'kf';
  row.innerHTML := '<span class="you">YOU</span><span class="wpn">[ G36 ]' + (if head then ' ' + #$2316 else '') +
    '</span><span class="foe">' + name + '</span>';
  kf.prepend(row);
  SetTimeout(procedure begin row.remove; end, 5000);
  while kf.children.Length > 5 do kf.lastChild.remove;
end;

procedure THUD.Pop(text, sub: String);
begin
  var p := El('score-pops');
  var d := Document.createElement('div');
  d.className := 'pop';
  d.innerHTML := text + (if sub <> '' then '<small>' + sub + '</small>' else '');
  p.appendChild(d);
  SetTimeout(procedure begin d.remove; end, 1300);
end;

procedure THUD.Banner(title, sub: String; dur: Float = 3);
begin
  El('banner-title').textContent := title;
  El('banner-sub').textContent := sub;
  var b := El('banner');
  b.classList.add('show');
  ClearTimeout(FBannerTimer);
  FBannerTimer := SetTimeout(procedure begin b.classList.remove('show'); end, dur * 1000);
end;

procedure THUD.Flash(v: Float);
begin
  El('flash').style.opacity := Num(v);
end;

end.
