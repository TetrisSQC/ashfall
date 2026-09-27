unit ashfall.game;

// Game orchestration: renderer, sky and lights, post-processing, input, the wave /
// combat game loop and the ?shot=<name> screenshot / debug poses.

interface

procedure StartAshfall;

implementation

uses
  ashfall.host, ashfall.three, ashfall.textures, ashfall.shaders, ashfall.world, ashfall.audio,
  ashfall.effects, ashfall.weapon, ashfall.player, ashfall.enemies, ashfall.hud;

type
  TGame = class
  public
    State: String;
    Wave, Score, Kills, Headshots, ToSpawn, Grenades, Shots, Hits: Integer;
    SpawnTimer, WaveBreak, Time, Bloom, HB: Float;
    procedure Reset;
  end;

  // frame statistics, exposed as window.__perf; a plain JS object so the field names
  // stay exactly as in the original (Pascal class fields may get renamed)
  TPerf = class external 'Object'
  public
    frames: array of Float;
    calls, tris: Integer;
    cpu, acc, lastNow, prev: Float;
    slow, n: Integer;
    userSet: Boolean;
  end;

  TPasses = class
  public
    Render, WeaponPass: JRenderPass;
    GTAO: JGTAOPass;
    Rays, Grade: JShaderPass;
  end;

  TGrenade = class
  public
    Mesh: JMesh;
    Vel: JVector3;
    Fuse: Float;
  end;

  // window.__dbg / window.__game handles for debugging and screenshot tooling
  TDebugHandles = class
  public
    player: TPlayer;
    weapon: TWeapon;
    enemies: array of TEnemy;
    world: TWorld;
    effects: TEffects;
    camera: JPerspectiveCamera;
    scene: JScene;
    renderer: JWebGLRenderer;
    game: TGame;
  end;

  TShotPose = class
  public
    PX, PY, PZ, Yaw, Pitch: Float;
    ADS, Fire, Boom, Reload, Sprint, GunSide, GunTop, Soldier, Play, Long, Death: Boolean;
    Enemies: String;   // '', 'yes' or 'close'
  end;

const QUALITY_NAMES: array [0..2] of String = ('ULTRA', 'HIGH', 'MEDIUM');
const SH = 55;

var
  Params: JURLSearchParams;
  Shot: String;
  Renderer: JWebGLRenderer;
  Perf: TPerf;
  Quality: Integer;
  Scene: JScene;
  Camera: JPerspectiveCamera;
  SUN_DIR: JVector3;
  FOG_COLOR: JColor;
  Sky: JMesh;
  SkyMat: JShaderMaterial;
  Sun: JDirectionalLight;
  Hemi: JHemisphereLight;
  Bounce: JDirectionalLight;
  Audio: TAudio;
  World: TWorld;
  Effects: TEffects;
  Weapon: TWeapon;
  Player: TPlayer;
  HUD: THUD;
  Composer: JEffectComposer;
  Passes: TPasses;
  Enemies: array of TEnemy;
  GrenadesLive: array of TGrenade;
  Game: TGame;
  Canvas: JElement;
  MouseDown, RMB: Boolean;
  ResizeT: variant;
  SPAWNS: array of JVector3;
  NAMES: array of String;
  NadeGeo: JSphereGeometry;
  NadeMat: JMeshStandardMaterial;
  Last: Float;
  ShotFrames: Integer;
  SHOTMENU: Boolean;
  _o, _d, _sp: JVector3;

procedure TGame.Reset;
begin
  Wave := 0; Score := 0; Kills := 0; Headshots := 0; ToSpawn := 0; SpawnTimer := 0; WaveBreak := 0;
  Grenades := 3; Shots := 0; Hits := 0;
end;

procedure Progress(p: Float; text: String);
begin
  El('load-fill').style.width := ToFixed(p * 100, 0) + '%';
  if text <> '' then El('load-text').textContent := text;
end;

function ShotFramesTarget: Integer;
begin
  var v := WindowObj.__shotFrames;
  Result := if v then Integer(v) else 90;
end;

procedure SetShotFrames(n: Integer);
begin
  WindowObj.__shotFrames := n;
end;

function DebugHandles: TDebugHandles;
begin
  Result := TDebugHandles.Create;
  Result.player := Player; Result.weapon := Weapon; Result.enemies := Enemies; Result.world := World;
  Result.effects := Effects; Result.camera := Camera; Result.scene := Scene; Result.renderer := Renderer; Result.game := Game;
end;

// ------------------------------------------------------------------ atmosphere
procedure BuildAtmosphere;
begin
  SUN_DIR := V3(-0.62, 0.2, -0.76).normalize;
  FOG_COLOR := Col(0.7, 0.62, 0.52);         // linear, matches sky horizon
  InstallFog(SUN_DIR, Col(1.45, 0.98, 0.58), 0.06);
  Scene.fog := JFogExp2.Create(FOG_COLOR.clone, 0.003);

  var sd := SkyShader;
  SkyMat := JShaderMaterial.Create(class
    uniforms: variant := sd.Uniforms; vertexShader := sd.VertexShader; fragmentShader := sd.FragmentShader;
    side := BackSide; depthWrite := false; fog := false;
  end);
  Sky := JMesh.Create(JSphereGeometry.Create(1000, 48, 24), SkyMat);
  JVector3(SkyMat.uniforms['sunDir'].value).copy(SUN_DIR);
  JColor(SkyMat.uniforms['horizon'].value).copy(FOG_COLOR);
  Sky.userData.noAO := true;
  Sky.frustumCulled := false;
  Sky.renderOrder := -1;
  Scene.add(Sky);

  Sun := JDirectionalLight.Create($ffcf9a, 5.0);
  Sun.castShadow := true;
  Sun.shadow.mapSize.&set(4096, 4096);
  var sc := Sun.shadow.camera;
  sc.left := -SH; sc.right := SH; sc.top := SH; sc.bottom := -SH; sc.near := 1; sc.far := 260;
  Sun.shadow.bias := -0.00025;
  Sun.shadow.normalBias := 0.035;
  Sun.shadow.radius := 2;
  Scene.add(Sun); Scene.add(Sun.target);
  Hemi := JHemisphereLight.Create($9db4d4, $6b5842, 0.3);
  Scene.add(Hemi);
  // fake bounce: warm light reflected off sunlit facades/ground into the shadowed side of the street
  Bounce := JDirectionalLight.Create($ffc28a, 0.45);
  Bounce.position.&set(-SUN_DIR.x, 0.25, -SUN_DIR.z);
  Scene.add(Bounce);
end;

// environment map from the sky only
function BuildEnv: JTexture;
begin
  var pm := JPMREMGenerator.Create(Renderer);
  var envScene := JScene.Create;
  var s2 := JMesh(Sky.clone);
  var m2 := JShaderMaterial(SkyMat.clone);
  s2.material := m2;
  m2.uniforms['cloudAmt'].value := 0.0;
  JVector3(m2.uniforms['sunDir'].value).copy(SUN_DIR);
  JColor(m2.uniforms['horizon'].value).copy(FOG_COLOR);
  m2.uniforms['sunDisk'].value := 0.0;
  envScene.add(s2);
  // warm ground bounce hemisphere below horizon
  var ground := JMesh.Create(JCircleGeometry.Create(900, 32), JMeshBasicMaterial.Create(class color := Col(0.22, 0.17, 0.12); end));
  ground.rotation.x := -PI / 2;
  ground.position.y := -30;
  envScene.add(ground);
  var rt := pm.fromScene(envScene, 0, 1, 2000);
  Scene.environment := rt.texture;
  Scene.environmentIntensity := 0.7;
  pm.dispose;
  Result := rt.texture;
end;

// ------------------------------------------------------------------ post processing
procedure BuildComposer;
begin
  var dpr := if Quality = 0 then MinF(Window.devicePixelRatio, 1.5) else 1.0;
  Renderer.setPixelRatio(dpr);
  Renderer.setSize(Window.innerWidth, Window.innerHeight);
  var w := Floor(Window.innerWidth * dpr);
  var h := Floor(Window.innerHeight * dpr);
  Sun.shadow.mapSize.setScalar(if Quality = 2 then 2048 else 4096);
  if Sun.shadow.map then begin
    Sun.shadow.map.dispose();
    Sun.shadow.map := null;
  end;
  var rt := JRenderTarget.Create(w, h, class &type := HalfFloatType; samples := 0; end);
  Composer := JEffectComposer.Create(Renderer, rt);
  Composer.setPixelRatio(1);
  Composer.setSize(w, h);
  Passes.Render := JRenderPass.Create(Scene, Camera);
  Composer.addPass(Passes.Render);
  if Quality < 2 then begin
    var gtao := JGTAOPass.Create(Scene, Camera, w, h);
    gtao.output := GTAOOutputDefault;
    gtao.blendIntensity := 1.0;
    gtao.updateGtaoMaterial(class radius := 0.9; distanceExponent := 1.4; thickness := 1.2; scale := 1.1; samples: Integer := if Quality = 0 then 16 else 12; end);
    gtao.updatePdMaterial(class lumaPhi := 10; depthPhi := 2; normalPhi := 3; radius := 6; rings := 2; samples := 16; end);
    var cache := gtao._visibilityCache;
    gtao.overrideVisibility := procedure
      begin
        Scene.traverse(procedure(o: JObject3D)
          begin
            cache.&set(o, o.visible);
            if o.isPoints or o.isLine or (o.userData.noAO = true) then o.visible := false;
          end);
      end;
    Composer.addPass(gtao);
    Passes.GTAO := gtao;
  end else
    Passes.GTAO := nil;
  Passes.Rays := JShaderPass.Create(ShaderPassDef(GodRayShader));
  Composer.addPass(Passes.Rays);
  Passes.WeaponPass := JRenderPass.Create(Weapon.Scene, Weapon.Camera);
  Passes.WeaponPass.clear := false;
  Passes.WeaponPass.clearDepth := true;
  Passes.WeaponPass.enabled := (Game.State <> 'menu') or ((Shot <> '') and not SHOTMENU);
  Composer.addPass(Passes.WeaponPass);
  Composer.addPass(JUnrealBloomPass.Create(JVector2.Create(w / 2, h / 2), 0.32, 0.55, 0.92));
  Composer.addPass(JOutputPass.Create);
  Passes.Grade := JShaderPass.Create(ShaderPassDef(GradeShader));
  Composer.addPass(Passes.Grade);
  Composer.addPass(JSMAAPass.Create(w, h));
  Weapon.SetAspect(Window.innerWidth / Window.innerHeight);
  El('quality-val').textContent := QUALITY_NAMES[Quality];
end;

procedure DisposeComposer;
begin
  for var p in Composer.passes do p.dispose;
  Composer.dispose;
end;

procedure SetQuality(q: Integer);
begin
  Quality := q;
  LocalSet('quality', QUALITY_NAMES[q]);
  DisposeComposer;
  BuildComposer;
end;

// ------------------------------------------------------------------ waves
procedure NextWave;
begin
  Game.Wave += 1;
  Game.ToSpawn := 4 + Game.Wave * 2;
  Game.SpawnTimer := 1.5;
  HUD.Banner('WAVE ' + IntStr(Game.Wave), if Game.Wave = 1 then 'HOLD THE INTERSECTION' else 'HOSTILE REINFORCEMENTS INBOUND', 3.2);
end;

procedure SpawnEnemy;
begin
  var cands: array of JVector3;
  for var s in SPAWNS do
    if s.distanceTo(Player.Pos) > 40 then cands.Add(s);
  var s := if cands.Length > 0 then cands[Floor(Rnd * cands.Length)] else SPAWNS[0];
  var e := TEnemy.Create(Scene, World, s.clone.add(V3((Rnd - 0.5) * 3, 0, (Rnd - 0.5) * 3)));
  Enemies.Add(e);
end;

// ------------------------------------------------------------------ game state
procedure Pause; forward;

procedure LockPointer;
begin
  if Params.has('nolock') then Exit;
  try
    var r: variant := Canvas.requestPointerLock(class unadjustedMovement := true; end);
    if r then
      JVoidPromise(r).catch(procedure
        begin
          var r2: variant := Canvas.requestPointerLock;
          if r2 then
            JVoidPromise(r2).catch(procedure
              begin
                if (Game.State = 'playing') and (Shot = '') then Pause;
              end);
        end);
  except
    // ignore
  end;
end;

procedure StartGame;
begin
  El('menu').classList.add('hidden');
  Passes.WeaponPass.enabled := true;
  HUD.Show(true);
  Game.State := 'playing';
  LockPointer;
  if Game.Wave = 0 then NextWave;
end;

procedure Pause;
begin
  Game.State := 'paused';
  MouseDown := false; RMB := false;
  Player.Keys.Clear;
  El('menu').classList.remove('hidden');
  El('deploy').textContent := 'RESUME';
  HUD.Show(false);
end;

procedure Restart;
begin
  for var e in Enemies do e.Dispose;
  Enemies.Clear;
  Game.Reset;
  Player.Reset;
  Weapon.Ammo := 30; Weapon.Reserve := 150; Weapon.Reloading := 0;
  El('gameover').classList.add('hidden');
  StartGame;
end;

procedure Die;
begin
  Game.State := 'dead';
  Document.exitPointerLock;
  MouseDown := false; RMB := false;
  HUD.Show(false);
  var acc := if Game.Shots > 0 then JSRound((Game.Hits / Game.Shots) * 100) else 0.0;
  El('go-stats').innerHTML := 'WAVE REACHED <b>' + IntStr(Game.Wave) + '</b><br>KILLS <b>' + IntStr(Game.Kills) + '</b> ' + #$00B7 +
    ' HEADSHOTS <b>' + IntStr(Game.Headshots) + '</b><br>ACCURACY <b>' + Num(acc) + '%</b><br>SCORE <b>' + IntStr(Game.Score) + '</b>';
  El('gameover').classList.remove('hidden');
end;

// ------------------------------------------------------------------ combat
function CurrentSpread: Float;
begin
  var s := Weapon.Stats;
  var move := MinF(1, Hypot(Player.Vel.x, Player.Vel.z) / 5);
  var sp := Mix(s.HipSpread, s.ADSSpread, Weapon.Aim);
  sp *= 1 + move * 1.2 * (1 - Weapon.Aim * 0.8);
  if Player.Crouching then sp *= 0.7;
  if not Player.Grounded then sp *= 2.5;
  sp += Game.Bloom * (1 - Weapon.Aim * 0.7);
  Result := sp;
end;

procedure OnKill(e: TEnemy; head: Boolean);
begin
  Game.Kills += 1;
  if head then Game.Headshots += 1;
  var pts := 100 + (if head then 50 else 0);
  Game.Score += pts;
  HUD.Kill(NAMES[Floor(Rnd * NAMES.Length)], head);
  HUD.Pop('+' + IntStr(pts), if head then 'HEADSHOT' else 'KILL');
end;

procedure PlayerFire;
begin
  if not Weapon.CanFire then Exit;
  if not Weapon.Fire then Exit;
  Game.Shots += 1;
  Game.Bloom := MinF(0.03, Game.Bloom + 0.004);
  // camera recoil
  var a := Weapon.Aim;
  var n := Weapon.Stats.Mag - Weapon.Ammo;
  Player.AddRecoil(0.011 * (1 - a * 0.35) + Min(n, 10) * 0.0004, (Rnd - 0.35) * 0.006 * (1 - a * 0.4));
  // ray
  Camera.getWorldPosition(_o);
  Camera.getWorldDirection(_d);
  var sp := CurrentSpread;
  var r := Sqrt(Rnd) * sp;
  var th := Rnd * PI * 2;
  var right := V3Zero.setFromMatrixColumn(Camera.matrixWorld, 0);
  var up := V3Zero.setFromMatrixColumn(Camera.matrixWorld, 1);
  _d.addScaledVector(right, Cos(th) * r).addScaledVector(up, Sin(th) * r).normalize;
  var wh := World.Raycast(_o, _d, Weapon.Stats.Range);
  var maxT := if Assigned(wh) then wh.T else Weapon.Stats.Range;
  var eh: TZoneHit := nil;
  var target: TEnemy := nil;
  for var e in Enemies do begin
    var h := e.HitTest(_o, _d, maxT);
    if Assigned(h) and ((eh = nil) or (h.T < eh.T)) then begin
      eh := h;
      target := e;
    end;
  end;
  var muzzle := Weapon.MuzzleWorld(V3Zero);
  var hitEnd := if Assigned(eh) then _o.clone.addScaledVector(_d, eh.T) else if Assigned(wh) then wh.Point else _o.clone.addScaledVector(_d, maxT);
  if Game.Shots mod 2 = 0 then Effects.Tracer(muzzle.clone.addScaledVector(_d, 0.5), hitEnd, 420);
  Effects.Flash(muzzle.clone.addScaledVector(_d, 0.3), 60, 0.05, $ffb060, 12);
  Effects.MuzzleSmoke(muzzle, _d);
  // shell casing
  var ep := Weapon.EjectWorld(V3Zero);
  var ev := right.clone.multiplyScalar(2.2 + Rnd).addScaledVector(up, 1.4 + Rnd * 0.6).addScaledVector(_d, -0.4).add(Player.Vel);
  Effects.EjectShell(ep, ev, Camera.quaternion);

  if Assigned(eh) then begin
    var mult := if eh.Zone = 'head' then 2.6 else if eh.Zone = 'legs' then 0.8 else 1.0;
    var dmg := Weapon.Stats.Damage * mult * (if maxT > 60 then 0.85 else 1);
    var killed := target.Damage(dmg, _d, eh.Zone);
    Game.Hits += 1;
    Effects.BloodHit(hitEnd, _d);
    Audio.Impact(hitEnd, 'flesh');
    HUD.Hit(if killed then 'kill' else if eh.Zone = 'head' then 'head' else '');
    Audio.Hitmarker(killed, eh.Zone = 'head');
    if killed then OnKill(target, eh.Zone = 'head');
  end else if Assigned(wh) then begin
    Effects.Impact(wh.Point, wh.Normal, wh.Surf, _d);
    Audio.Impact(wh.Point, wh.Surf);
  end;
end;

procedure DoMelee;
begin
  if not Weapon.StartMelee then Exit;
  SetTimeout(procedure
    begin
      Camera.getWorldDirection(_d);
      for var e in Enemies do begin
        if not e.Alive then continue;
        var toE := e.Root.position.clone.sub(Player.Pos);
        toE.y := 0;
        if (toE.length < 2.2) and (toE.normalize.dot(V3(_d.x, 0, _d.z).normalize) > 0.6) then begin
          e.Damage(200, _d, 'body'); OnKill(e, false); HUD.Hit('kill'); Audio.Hitmarker(true); Audio.Impact(e.Root.position, 'flesh');
          Player.Shake(0.15);
          break;
        end;
      end;
    end, 180);
end;

// grenades
procedure ThrowGrenade;
begin
  if (Game.Grenades <= 0) or not Weapon.StartThrow then Exit;
  Game.Grenades -= 1;
  SetTimeout(procedure
    begin
      Camera.getWorldDirection(_d);
      var m := JMesh.Create(NadeGeo, NadeMat);
      m.castShadow := true;
      var p := Camera.position.clone.addScaledVector(_d, 0.5).add(V3(0, -0.1, 0));
      m.position.copy(p);
      Scene.add(m);
      var g := TGrenade.Create;
      g.Mesh := m;
      g.Vel := _d.clone.multiplyScalar(17).add(V3(0, 4, 0)).add(Player.Vel);
      g.Fuse := 2.4;
      GrenadesLive.Add(g);
      Audio.Click(700, 0.3);
    end, 260);
end;

procedure Explode(pos: JVector3);
begin
  Effects.Explosion(pos);
  Audio.Explosion(pos);
  var dp := pos.distanceTo(Player.HeadPos(V3Zero));
  Player.Shake(MaxF(0, 1 - dp / 30));
  if (dp < 7) and World.LineOfSight(pos.clone.setY(pos.y + 0.3), Player.HeadPos(V3Zero)) then Player.TakeDamage(140 * (1 - dp / 7), pos);
  for var e in Enemies do begin
    if not e.Alive then continue;
    var d := e.Root.position.distanceTo(pos);
    if (d < 8) and World.LineOfSight(pos.clone.setY(pos.y + 0.3), e.EyePos(V3Zero).setY(e.Root.position.y + 1.0)) then begin
      var dmg := 180 * (1 - d / 8);
      var dir := e.Root.position.clone.sub(pos).setY(0.3).normalize;
      if e.Damage(dmg, dir, 'body') then begin
        OnKill(e, false);
        HUD.Hit('kill');
      end else
        HUD.Hit('');
    end;
  end;
end;

procedure UpdateGrenades(dt: Float);
begin
  for var i := GrenadesLive.Length - 1 downto 0 do begin
    var g := GrenadesLive[i];
    g.Fuse -= dt;
    g.Vel.y := g.Vel.y - 9.8 * dt;
    var p := g.Mesh.position;
    var next := p.clone.addScaledVector(g.Vel, dt);
    var len := g.Vel.length * dt;
    if len > 0 then begin
      var dir := g.Vel.clone.normalize;
      var h := World.Raycast(p, dir, len + 0.05);
      if Assigned(h) then begin
        g.Vel.reflect(h.Normal).multiplyScalar(0.4);
        next.copy(h.Point).addScaledVector(h.Normal, 0.05);
        if g.Vel.length > 1.5 then Audio.Impact(h.Point, 'metal');
      end;
    end;
    p.copy(next);
    if p.y < 0.045 then begin
      p.y := 0.045; g.Vel.y := Abs(g.Vel.y) * 0.35; g.Vel.x := g.Vel.x * 0.7; g.Vel.z := g.Vel.z * 0.7;
    end;
    g.Mesh.rotation.x := g.Mesh.rotation.x + g.Vel.length * dt * 3;
    if g.Fuse <= 0 then begin
      Explode(p.clone);
      Scene.remove(g.Mesh);
      GrenadesLive.Delete(i);
    end;
  end;
end;

// ------------------------------------------------------------------ per-frame helpers
procedure UpdateShadowCamera;
begin
  // follow camera, snapped to shadow texels to avoid shimmering
  var center := Camera.position.clone;
  var fwd := V3Zero;
  Camera.getWorldDirection(fwd);
  fwd.y := 0;
  fwd.normalize;
  center.addScaledVector(fwd, 20);
  var texel := (SH * 2) / Sun.shadow.mapSize.x;
  var lightRot := JMatrix4.Create.lookAt(V3Zero, SUN_DIR.clone.negate, V3(0, 1, 0));
  var inv := lightRot.clone.invert;
  center.applyMatrix4(inv);
  center.x := JSRound(center.x / texel) * texel;
  center.y := JSRound(center.y / texel) * texel;
  center.applyMatrix4(lightRot);
  Sun.target.position.copy(center);
  Sun.position.copy(center).addScaledVector(SUN_DIR, 150);
  Sun.target.updateMatrixWorld;
end;

procedure UpdatePostUniforms(dt: Float);
begin
  // sun screen position for god rays
  _sp.copy(Camera.position).addScaledVector(SUN_DIR, 500).project(Camera);
  var facing := V3Zero;
  Camera.getWorldDirection(facing);
  var vis := MaxF(0, facing.dot(SUN_DIR));
  var ru := Passes.Rays.uniforms;
  JVector2(ru['sunPos'].value).&set(_sp.x * 0.5 + 0.5, _sp.y * 0.5 + 0.5);
  ru['intensity'].value := vis * vis * 0.4;
  ru['aspect'].value := Camera.aspect;
  var g := Passes.Grade.uniforms;
  g['time'].value := g['time'].value + dt;
  var hpK := if Assigned(Player) then ClampF((0.8 - Player.HP / Player.MaxHP) / 0.6, 0, 1) else 0.0;
  g['damage'].value := Mix(g['damage'].value, hpK, 1 - Exp(-6 * dt));
  g['aberration'].value := 0.0008 + (if Assigned(Player) then Player.Trauma * 0.008 else 0);
  g['adsVignette'].value := if Assigned(Weapon) then Weapon.Aim else 0.0;
  SkyMat.uniforms['time'].value := SkyMat.uniforms['time'].value + dt;
  Sky.position.copy(Camera.position);
end;

// ------------------------------------------------------------------ main loop
procedure Loop(now: Float);
begin
  RequestAnimationFrame(Loop);
  var dt := MinF(0.05, (now - Last) / 1000);
  Last := now;
  if Shot <> '' then dt := 1 / 60;
  Game.Time += dt;

  if (Game.State = 'playing') or ((Shot <> '') and not SHOTMENU) then begin
    Player.Aiming := RMB and not Weapon.Busy;
    Player.Firing := MouseDown;
    Player.Update(dt);
    if MouseDown and Player.Alive then PlayerFire;
    Game.Bloom := MaxF(0, Game.Bloom - dt * (if MouseDown then 0.01 else 0.08));
    if (Weapon.Ammo = 0) and (Weapon.Reserve > 0) and not Weapon.IsReloading and (Weapon.Cooldown < -0.2) and ((Shot = '') or (Game.State = 'playing')) then
      Weapon.StartReload;
    // waves
    if Game.State = 'playing' then begin
      var alive := 0;
      for var e in Enemies do if e.Alive then alive += 1;
      if Game.ToSpawn > 0 then begin
        Game.SpawnTimer -= dt;
        if (Game.SpawnTimer <= 0) and (alive < 6 + Min(Game.Wave, 4)) then begin
          SpawnEnemy;
          Game.ToSpawn -= 1;
          Game.SpawnTimer := 1.2 + Rnd * 1.5;
        end;
      end else if (alive = 0) and (Game.WaveBreak <= 0) then begin
        Game.WaveBreak := 7;
        Game.Score += 500;
        Weapon.Reserve := Min(Weapon.Stats.ReserveMax, Weapon.Reserve + 90);
        Game.Grenades := Min(3, Game.Grenades + 2);
        HUD.Banner('WAVE ' + IntStr(Game.Wave) + ' CLEARED', '+500  ' + #$00B7 + '  RESUPPLY RECEIVED', 3.5);
      end;
      if Game.WaveBreak > 0 then begin
        Game.WaveBreak -= dt;
        if Game.WaveBreak <= 0 then NextWave;
      end;
      var ctx := TEnemyCtx.Create;
      ctx.Player := Player; ctx.Audio := Audio; ctx.Effects := Effects; ctx.Enemies := Enemies; ctx.CoverPoints := World.CoverPoints;
      for var e in Enemies do e.Update(dt, ctx);
      for var i := Enemies.Length - 1 downto 0 do
        if not Enemies[i].Alive and (Enemies[i].DeathT > 14) then begin
          Enemies[i].Dispose;
          Enemies.Delete(i);
        end;
      UpdateGrenades(dt);
      if not Player.Alive then Die;
      // heartbeat when low
      Game.HB -= dt;
      if (Player.HP < 35) and (Game.HB <= 0) then begin
        Audio.Heartbeat;
        Game.HB := 0.9;
      end;
    end else if Shot <> '' then begin
      for var e in Enemies do
        if e.Alive then e.Animate(dt) else e.UpdateDeath(dt);
    end;
    if Player.LandImpact <> 0 then begin
      Weapon.OnLand(Player.LandImpact);
      Player.LandImpact := 0;
    end;
    var wi := TWeaponInput.Create;
    wi.Aiming := Player.Aiming; wi.Sprinting := Player.Sprinting; wi.LookDX := Player.LookDX; wi.LookDY := Player.LookDY;
    wi.MoveSpeed := Hypot(Player.Vel.x, Player.Vel.z); wi.Grounded := Player.Grounded; wi.Crouch := Player.CrouchK; wi.Time := Game.Time;
    Weapon.Update(dt, Camera, wi);
    var hostiles := Game.ToSpawn;
    for var e in Enemies do if e.Alive then hostiles += 1;
    HUD.Update(dt, Player, Weapon, Enemies, CurrentSpread, Game.Grenades, Game.Score, Game.Wave, hostiles);
    Audio.UpdateListener(Camera);
  end else if (Game.State = 'menu') or (Game.State = 'paused') then begin
    // slow cinematic drift behind the menu
    var t := Game.Time * 0.05;
    Camera.position.&set(Sin(t) * 3, 2.2 + Sin(t * 0.7) * 0.3, 62 - Cos(t) * 2);
    Camera.rotation.&set(0.03, Sin(t * 0.8) * 0.25 - 0.1, 0);
    if Game.State = 'paused' then begin
      Camera.position.copy(Player.Pos);
      Camera.position.y := Camera.position.y + Player.Eye;
      Camera.rotation.&set(Player.Pitch, Player.Yaw, 0);
    end;
    Weapon.Update(dt, Camera, TWeaponInput.Create);
  end;

  Effects.Update(dt, Camera);
  UpdateShadowCamera;
  UpdatePostUniforms(dt);
  Renderer.info.reset;
  var t0 := Now;
  Composer.render(dt);
  Perf.calls := Renderer.info.render.calls;
  Perf.tris := Renderer.info.render.triangles;
  Perf.frames.Add(now - (if Perf.lastNow <> 0 then Perf.lastNow else now));
  Perf.lastNow := now;
  Perf.cpu := Now - t0;
  if Perf.frames.Length > 120 then Perf.frames.Delete(0);
  if (Game.State = 'playing') and (Shot = '') then begin
    Perf.acc += dt;
    if now - (if Perf.prev <> 0 then Perf.prev else now) > 24 then Perf.slow += 1;
    Perf.n += 1;
    Perf.prev := now;
    if Perf.acc > 4 then begin
      if (Perf.slow / Perf.n > 0.5) and (Quality < 2) and not Perf.userSet then begin
        SetQuality(Quality + 1);
        HUD.Banner('', 'GRAPHICS ADJUSTED ' + #$00B7 + ' ' + QUALITY_NAMES[Quality], 2);
      end;
      Perf.acc := 0; Perf.slow := 0; Perf.n := 0;
    end;
  end else
    Perf.prev := now;

  if Shot <> '' then begin
    ShotFrames += 1;
    if ShotFrames = ShotFramesTarget then begin
      Document.title := 'READY';
      WindowObj.__ready := true;
    end;
  end;
end;

// ------------------------------------------------------------------ screenshot/debug poses
function Pose(px, py, pz, yaw, pitch: Float): TShotPose;
begin
  Result := TShotPose.Create;
  Result.PX := px; Result.PY := py; Result.PZ := pz; Result.Yaw := yaw; Result.Pitch := pitch;
end;

procedure SetupShot(name: String);
var
  P: TShotPose;
begin
  if name = 'menu' then begin
    SetShotFrames(120);
    WindowObj.__game := DebugHandles;
    SHOTMENU := true;
    Exit;
  end;
  El('menu').classList.add('hidden');
  Passes.WeaponPass.enabled := true;
  HUD.Show(true);
  Game.Wave := 1;
  case name of
    'ads': begin P := Pose(1.5, 0, 74, 0.05, 0.0); P.ADS := true; end;
    'fight': begin P := Pose(-1, 0, 45, 0.0, -0.02); P.Enemies := 'yes'; P.Fire := true; end;
    'fire': begin P := Pose(-1, 0, 45, -0.15, 0.0); P.Fire := true; end;
    'cross': P := Pose(8, 0, 14, 0.9, 0.05);
    'back': P := Pose(0, 0, -20, PI, 0.05);
    'up': P := Pose(0, 0, 30, 0.3, 0.45);
    'sun': P := Pose(5, 0, 20, 0.72, 0.12);
    'wall': P := Pose(8.5, 0, 30, -1.2, 0.05);
    'enemy': begin P := Pose(0, 0, 30, 0, -0.05); P.Enemies := 'close'; end;
    'boom': begin P := Pose(0, 0, 40, 0, 0); P.Boom := true; end;
    'reload': begin P := Pose(1.5, 0, 74, 0.08, 0.02); P.Reload := true; end;
    'sprint': begin P := Pose(1.5, 0, 74, 0.08, 0.02); P.Sprint := true; end;
    'gunside': begin P := Pose(1.5, 0, 74, 0.08, 0.02); P.GunSide := true; end;
    'guntop': begin P := Pose(1.5, 0, 74, 0.08, 0.02); P.GunTop := true; end;
    'soldier': begin P := Pose(0, 0, 30, 0, -0.1); P.Soldier := true; end;
    'play': begin P := Pose(0, 0, 20, 0, 0); P.Play := true; end;
    'longplay': begin P := Pose(0, 0, 20, 0, 0); P.Play := true; P.Long := true; end;
    'death': begin P := Pose(0, 0, 30, 0, -0.1); P.Soldier := true; P.Death := true; end;
  else
    P := Pose(1.5, 0, 74, 0.08, 0.02); // street
  end;
  Player.Pos.&set(P.PX, P.PY, P.PZ);
  Player.Yaw := P.Yaw;
  Player.Pitch := P.Pitch;
  Player.Update(0.016);
  ShotFrames := 0;
  if P.ADS then RMB := true;
  if P.Enemies <> '' then begin
    var pts: array of Float;
    if P.Enemies = 'close' then pts := [-1.5, 0, 24, 0.2, 2.5, 0, 20, -0.5, 5, 0, 16, 0.4]
    else pts := [-3, 0, 22, 0, 3, 0, 18, 0.3, 0, 0, 12, -0.2, 5, 0, 30, 0.1];
    var k := 0;
    while k < pts.Length do begin
      var e := TEnemy.Create(Scene, World, V3(pts[k], pts[k + 1], pts[k + 2]));
      e.Yaw := pts[k + 3]; e.Root.rotation.y := e.Yaw; e.Speed := 2; e.AimPitch := 0;
      Enemies.Add(e);
      k += 4;
    end;
  end;
  if P.GunSide then begin
    Weapon.HipPos.&set(0, 0, 0); Weapon.Root.position.&set(0.0, -0.02, -0.75); Weapon.Root.rotation.y := PI / 2;
  end;
  if P.GunTop then begin
    Weapon.HipPos.&set(0, 0, 0); Weapon.Root.position.&set(0.0, -0.02, -0.75); Weapon.Root.rotation.x := PI / 2;
  end;
  if P.Soldier then begin
    var e1 := TEnemy.Create(Scene, World, V3(-0.8, 0, 26.5));
    e1.Yaw := 0.5; e1.Root.rotation.y := e1.Yaw; e1.Speed := 0; e1.AimPitch := 0; Enemies.Add(e1);
    var e2 := TEnemy.Create(Scene, World, V3(1.4, 0, 25.5));
    e2.Yaw := -0.9; e2.Root.rotation.y := e2.Yaw; e2.Speed := 3; e2.AimPitch := 0; Enemies.Add(e2);
  end;
  if P.Play then begin
    Game.Wave := 0; Game.State := 'playing'; NextWave; Game.SpawnTimer := 0;
    for var i := 0 to 4 do begin
      SpawnEnemy;
      Game.ToSpawn -= 1;
    end;
    for var e in Enemies do e.Root.position.z := MinF(e.Root.position.z, -20);
    SetShotFrames(if P.Long then 4200 else 900);
    Player.Difficulty := if P.Long then 0.05 else 0.2;
    var bot: TFrameProc;
    bot := procedure(now: Float)
      begin
        // debug bot: aim at nearest visible enemy and fire in bursts
        var best: JVector3 := nil;
        var bd := 1e9;
        var eye := Player.HeadPos(V3Zero);
        for var e in Enemies do begin
          if not e.Alive then continue;
          var hp := e.Head.getWorldPosition(V3Zero).add(V3(0, -0.35, 0));
          var d := hp.distanceTo(eye);
          if (d < bd) and World.LineOfSight(eye, hp) then begin
            bd := d;
            best := hp;
          end;
        end;
        if Assigned(best) then begin
          var dir := best.clone.sub(eye).normalize;
          var ty := Atan2(-dir.x, -dir.z);
          var tp := ASin(dir.y);
          Player.Yaw += (ty - Player.Yaw) * 0.15;
          Player.Pitch += (tp - Player.Pitch) * 0.15;
          MouseDown := (Abs(ty - Player.Yaw) < 0.05) and ((ShotFrames mod 40) < 22);
          RMB := true;
        end else begin
          MouseDown := false;
          RMB := false;
        end;
        if ShotFrames < ShotFramesTarget then RequestAnimationFrame(bot);
      end;
    bot(0);
  end;
  if P.Death then begin
    SetTimeout(procedure
      begin
        Enemies[0].Damage(200, V3(0.3, 0, -1).normalize, 'head');
        Enemies[1].Damage(200, V3(1, 0, -0.4).normalize, 'body');
        Effects.BloodHit(Enemies[0].Head.getWorldPosition(V3Zero), V3(0, 0, -1));
      end, 400);
    SetShotFrames(160);
  end;
  if P.Sprint then begin
    Player.Keys['ShiftLeft'] := true;
    Player.Keys['KeyW'] := true;
    ShotFrames := -60;
  end;
  if P.Reload then begin
    Weapon.Ammo := 10;
    SetTimeout(procedure begin Weapon.StartReload; end, 600);
    SetShotFrames(125);
  end;
  if P.Fire then begin
    SetShotFrames(100);
    var fire: TFrameProc;
    fire := procedure(now: Float)
      begin
        MouseDown := ShotFrames > 70;
        if ShotFrames < 100 then RequestAnimationFrame(fire);
      end;
    fire(0);
  end;
  if P.Boom then begin
    SetTimeout(procedure begin Explode(V3(1, 0.1, 25)); end, 800);
    SetShotFrames(60);
  end;
  WindowObj.__game := DebugHandles;
end;

// ------------------------------------------------------------------ input
procedure BindInput;
begin
  Canvas := Renderer.domElement;
  El('deploy').addEventListener('click', procedure(e: JEvent) begin Audio.Init; StartGame; end);
  El('redeploy').addEventListener('click', procedure(e: JEvent) begin Audio.Init; Restart; end);
  Document.addEventListener('pointerlockchange', procedure(e: JEvent)
    begin
      if (Document.pointerLockElement <> Canvas) and (Game.State = 'playing') then Pause;
    end);
  Canvas.addEventListener('click', procedure(e: JEvent)
    begin
      if (Game.State = 'playing') and (Document.pointerLockElement <> Canvas) then LockPointer;
    end);
  Document.addEventListener('mousemove', procedure(e: JEvent)
    begin
      var me := JMouseEvent(e);
      if (Document.pointerLockElement = Canvas) and Assigned(Player) then Player.OnMouse(me.movementX, me.movementY);
    end);
  Document.addEventListener('mousedown', procedure(e: JEvent)
    begin
      if Game.State <> 'playing' then Exit;
      var me := JMouseEvent(e);
      if me.button = 0 then MouseDown := true;
      if me.button = 2 then RMB := true;
    end);
  Document.addEventListener('mouseup', procedure(e: JEvent)
    begin
      var me := JMouseEvent(e);
      if me.button = 0 then MouseDown := false;
      if me.button = 2 then RMB := false;
    end);
  Document.addEventListener('contextmenu', procedure(e: JEvent) begin e.preventDefault; end);
  Document.addEventListener('keydown', procedure(e: JEvent)
    begin
      var ke := JKeyEvent(e);
      if (ke.code = 'KeyQ') and Assigned(Composer) then begin
        Perf.userSet := true;
        SetQuality((Quality + 1) mod 3);
        Exit;
      end;
      if (Player = nil) or (Game.State <> 'playing') then Exit;
      if ke.&repeat then Exit;
      Player.Keys[ke.code] := true;
      if ke.code = 'KeyR' then Weapon.StartReload;
      if (ke.code = 'KeyC') or (ke.code = 'ControlLeft') then Player.CrouchPressed;
      if ke.code = 'KeyG' then ThrowGrenade;
      if ke.code = 'KeyV' then DoMelee;
      if ke.code = 'Tab' then e.preventDefault;
    end);
  Document.addEventListener('keyup', procedure(e: JEvent)
    begin
      if Assigned(Player) then Player.Keys[JKeyEvent(e).code] := false;
    end);
  Window.addEventListener('resize', procedure(e: JEvent)
    begin
      Camera.aspect := Window.innerWidth / Window.innerHeight;
      Camera.updateProjectionMatrix;
      ClearTimeout(ResizeT);
      ResizeT := SetTimeout(procedure
        begin
          if Assigned(Composer) then begin
            DisposeComposer;
            BuildComposer;
          end;
        end, 150);
    end);
end;

// ------------------------------------------------------------------ init
procedure Fail(msg: String);
begin
  Console.error(msg);
  Document.title := 'ERROR ' + msg;
  El('load-text').textContent := 'ERROR: ' + msg;
end;

procedure FinishInit;
begin
  var envTex := BuildEnv;
  Effects := TEffects.Create(Scene, World, Audio);
  Effects.SetFog(FOG_COLOR);
  for var f in World.Fires do Effects.AddFire(f.Pos, f.Scale, f.Scale > 1);
  for var p in World.SmokeStacks do Effects.AddPlume(p);
  for var s in Effects.Systems do s.Mesh.userData.noAO := true;
  for var t in Effects.Tracers do t.Mesh.userData.noAO := true;

  Weapon := TWeapon.Create(Audio);
  Weapon.Scene.environment := envTex;
  Weapon.Scene.environmentIntensity := 0.8;
  Weapon.Sun.position.copy(SUN_DIR).multiplyScalar(10);
  Player := TPlayer.Create(Camera, World, Audio);
  HUD := THUD.Create(World);
  BuildComposer;
  Progress(0.97, 'COMPILING SHADERS');
  SetTimeout(procedure
    begin
      try
        // warm up: pre-simulate smoke so the scene starts alive
        for var i := 0 to 239 do Effects.Update(1 / 30, Camera);
        Player.Update(0.016);
        Weapon.Update(0.016, Camera, TWeaponInput.Create);
        // pre-warm every shader variant so the first fight doesn't hitch
        var dummy := TEnemy.Create(Scene, World, V3(0, 0, 70));
        var warm: array of JObject3D;
        for var t in Effects.Tracers do warm.Add(t.Mesh);
        for var s in Effects.Shells do warm.Add(s.Mesh);
        for var c in Effects.Chunks do warm.Add(c.Mesh);
        warm.Add(Weapon.FlashGroup);
        warm.Add(Weapon.Dot);
        for var o in warm do o.visible := true;
        var nade := JMesh.Create(NadeGeo, NadeMat);
        nade.position.&set(0, 1, 70);
        Scene.add(nade);
        for var f in Effects.FlashLights do f.Light.intensity := 1;
        Renderer.compile(Scene, Camera);
        Renderer.compile(Weapon.Scene, Weapon.Camera);
        Composer.render(0.016);
        for var o in warm do o.visible := false;
        for var f in Effects.FlashLights do f.Light.intensity := 0;
        Scene.remove(nade);
        dummy.Dispose;
        Composer.render(0.016);
        Progress(1, 'READY');
        El('loading').classList.add('hidden');
        El('deploy').classList.remove('hidden');
        El('menu').classList.remove('loading');
        if Shot <> '' then SetupShot(Shot);
        WindowObj.__dbg := DebugHandles;
        RequestAnimationFrame(Loop);
      except
        on ex: Exception do Fail(ex.Message);
      end;
    end, 0);
end;

procedure StartAshfall;
begin
  Params := JURLSearchParams.Create(Location.search);
  var shotParam := Params.get('shot');
  Shot := if shotParam then String(shotParam) else '';

  // ------------------------------------------------------------------ renderer
  Renderer := JWebGLRenderer.Create(class
    antialias := false; powerPreference := 'high-performance'; stencil := false; preserveDrawingBuffer: Boolean := Shot <> '';
  end);
  Renderer.setSize(Window.innerWidth, Window.innerHeight);
  Renderer.shadowMap.enabled := true;
  Renderer.shadowMap.&type := PCFSoftShadowMap;
  Renderer.toneMapping := ACESFilmicToneMapping;
  Renderer.toneMappingExposure := 1.0;
  Renderer.outputColorSpace := SRGBColorSpace;
  El('game').appendChild(Renderer.domElement);
  SetAnisotropy(Renderer.capabilities.getMaxAnisotropy);
  Renderer.info.autoReset := false;
  var perfObj: variant := class
    frames: array of Float; calls := 0; tris := 0; cpu := 0.0; acc := 0.0; lastNow := 0.0; prev := 0.0;
    slow := 0; n := 0; userSet := false;
  end;
  Perf := TPerf(perfObj);
  WindowObj.__perf := Perf;

  var qs := LocalGet('quality');
  Quality := 0;
  for var qi := 0 to 2 do
    if QUALITY_NAMES[qi] = qs then Quality := qi;

  Scene := JScene.Create;
  Camera := JPerspectiveCamera.Create(63, Window.innerWidth / Window.innerHeight, 0.05, 1400);
  Camera.rotation.order := 'YXZ';
  BuildAtmosphere;

  // ------------------------------------------------------------------ systems
  Audio := TAudio.Create;
  El('menu').classList.add('loading');
  World := TWorld.Create(Scene, Progress);
  Game := TGame.Create;
  Game.State := 'menu';
  Game.Grenades := 3;
  Passes := TPasses.Create;
  SPAWNS := [V3(-3, 0, -88), V3(3, 0, -86), V3(0, 0, -76), V3(-60, 0, 2), V3(60, 0, -2), V3(-55, 0, -3), V3(56, 0, 3),
    V3(-4, 0, -60), V3(5, 0, 88), V3(-5, 0, 90)];
  NAMES := ['Viper-2', 'Kestrel', 'Grim', 'Rook', 'Sokol', 'Hydra-6', 'Mako', 'Warden', 'Ash', 'Nomad', 'Tusk', 'Raven-4'];
  NadeGeo := JSphereGeometry.Create(0.045, 12, 10);
  NadeMat := JMeshStandardMaterial.Create(class color := $3f4633; roughness := 0.6; metalness := 0.3; end);
  _o := V3Zero; _d := V3Zero; _sp := V3Zero;
  Last := Now;
  BindInput;
  Window.addEventListener('error', procedure(e: JEvent) begin Document.title := 'ERROR ' + JErrorEvent(e).message; end);

  try
    World.Build(procedure
      begin
        try
          Progress(0.9, 'LOADING INFANTRY');
          LoadSoldier(procedure
            begin
              try
                Progress(0.92, 'LIGHTING');
                SetTimeout(procedure
                  begin
                    try
                      FinishInit;
                    except
                      on ex: Exception do Fail(ex.Message);
                    end;
                  end, 0);
              except
                on ex: Exception do Fail(ex.Message);
              end;
            end);
        except
          on ex: Exception do Fail(ex.Message);
        end;
      end);
  except
    on ex: Exception do Fail(ex.Message);
  end;
end;

end.
