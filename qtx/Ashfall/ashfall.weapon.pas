unit ashfall.weapon;

// First-person viewmodel: HK G36 (baked mesh) + gloved arms built from primitives,
// with procedural animation (sway, bob, recoil springs, ADS, sprint, reload, melee).

interface

uses
  ashfall.host, ashfall.three, ashfall.textures, ashfall.audio, ashfall.g36;

type
  TSpring = class
  public
    K, D: Float;
    X, V: JVector3;
    constructor Create(ak: Float = 120; ad: Float = 14);
    procedure Update(dt: Float);
    procedure Impulse(ax, ay, az: Float);
  end;

  TWeaponStats = class
  public
    Name: String;
    RPM, Damage, Reload, ReloadEmpty, HipSpread, ADSSpread, Range: Float;
    Mag, ReserveMax: Integer;
  end;

  THandPose = class
  public
    Pos, Elbow, Palm: JVector3;
    constructor Create(apos, aelbow, apalm: JVector3);
  end;

  // per-frame movement / look state handed in by the game loop
  TWeaponInput = class
  public
    Aiming, Sprinting, Grounded: Boolean;
    LookDX, LookDY, MoveSpeed, Crouch, Time: Float;
  end;

  TWeapon = class
  private
    FAudio: TAudio;
    FM: array [String] of JMaterial;
    FGun, FBolt, FMag, FArms, FRHand, FLHand: JGroup;
    FMuzzle, FEjectPort: JObject3D;
    FMagRest, FOpticCenter: JVector3;
    FHandR, FHandL, FHandLMag: THandPose;
    FHemi: JHemisphereLight;
    FFill: JDirectionalLight;
    FFlashLight: JPointLight;
    FSprint, FReloadDur, FMelee, FThrowT, FEquipT, FBobPhase, FBobAmt, FFlashT, FBreath, FLhk: Float;
    FReloadEmpty: Boolean;
    FSwayTarget, FSway: JVector2;
    FKickPos, FKickRot, FLand: TSpring;
    procedure BuildLights;
    procedure BuildModel;
    procedure PoseHand(h: JObject3D; pos, elbow, palm: JVector3);
    procedure FinishReload;
  public
    Scene: JScene;
    Camera: JPerspectiveCamera;
    Root: JGroup;
    Sun: JDirectionalLight;
    Dot, FlashGroup: JGroup;
    HipPos, ADSPos: JVector3;
    Stats: TWeaponStats;
    Ammo, Reserve: Integer;
    Cooldown, Aim, Reloading: Float;
    constructor Create(audio: TAudio);
    procedure SetAspect(a: Float);
    function FireInterval: Float;
    function IsReloading: Boolean;
    function Busy: Boolean;
    function CanFire: Boolean;
    function Fire: Boolean;
    function StartReload: Boolean;
    function StartMelee: Boolean;
    function StartThrow: Boolean;
    procedure OnLand(v: Float);
    procedure Update(dt: Float; mainCam: JCamera; input: TWeaponInput);
    function MuzzleWorld(target: JVector3): JVector3;
    function EjectWorld(target: JVector3): JVector3;
  end;

implementation

{ TSpring }

constructor TSpring.Create(ak: Float = 120; ad: Float = 14);
begin
  K := ak; D := ad;
  X := V3Zero; V := V3Zero;
end;

procedure TSpring.Update(dt: Float);
begin
  var a := X.clone.multiplyScalar(-K).addScaledVector(V, -D);
  V.addScaledVector(a, dt);
  X.addScaledVector(V, dt);
end;

procedure TSpring.Impulse(ax, ay, az: Float);
begin
  V.x := V.x + ax; V.y := V.y + ay; V.z := V.z + az;
end;

constructor THandPose.Create(apos, aelbow, apalm: JVector3);
begin
  Pos := apos; Elbow := aelbow; Palm := apalm;
end;

{ TWeapon }

constructor TWeapon.Create(audio: TAudio);
begin
  FAudio := audio;
  Scene := JScene.Create;
  Camera := JPerspectiveCamera.Create(52, 1, 0.01, 10);
  Scene.add(Camera);
  Root := JGroup.Create;      // animated pivot
  Camera.add(Root);
  BuildLights;
  BuildModel;

  // state
  Stats := TWeaponStats.Create;
  Stats.Name := 'HK G36'; Stats.RPM := 800; Stats.Damage := 34; Stats.Mag := 30; Stats.ReserveMax := 180;
  Stats.Reload := 2.35; Stats.ReloadEmpty := 2.8; Stats.HipSpread := 0.03; Stats.ADSSpread := 0.0015; Stats.Range := 250;
  Ammo := 30; Reserve := 150;
  FReloadDur := 1;
  FEquipT := 0.6;
  FSwayTarget := JVector2.Create; FSway := JVector2.Create;
  FKickPos := TSpring.Create(180, 16); FKickRot := TSpring.Create(160, 13);
  FLand := TSpring.Create(90, 10);
  FFlashT := 1;
end;

procedure TWeapon.BuildLights;
begin
  FHemi := JHemisphereLight.Create($cfd8e6, $4a3d30, 0.9);
  Scene.add(FHemi);
  Sun := JDirectionalLight.Create($ffd7a8, 2.2);
  Scene.add(Sun); Scene.add(Sun.target);
  FFill := JDirectionalLight.Create($9fb4cc, 0.35);
  FFill.position.&set(-1, 0.2, 1);
  Camera.add(FFill);
  FFlashLight := JPointLight.Create($ffa850, 0, 2.5, 2);
  Root.add(FFlashLight);
end;

procedure TWeapon.BuildModel;
var
  gun: JGroup;

  function AddM(geo: JBufferGeometry; mat: JMaterial; x, y, z: Float; rx: Float = 0; ry: Float = 0; rz: Float = 0; parent: JObject3D = nil): JMesh;
  begin
    Result := JMesh.Create(geo, mat);
    Result.position.&set(x, y, z);
    Result.rotation.&set(rx, ry, rz);
    if parent = nil then parent := gun;
    parent.add(Result);
  end;

  function RB(w, h, d: Float; r: Float = 0.004; s: Integer = 2): JBufferGeometry;
  begin
    Result := JRoundedBoxGeometry.Create(w, h, d, s, r);
  end;

  // --- HK G36 (baked mesh data, see g36data.js for attribution)
  function G36Mat(c: JG36Chunk): JMaterial;
  begin
    if c.m = 'Material.012' then Exit(FM['lens']);
    if (c.m = 'Material.001') or (c.m = 'Material.002') or (c.m = 'Material.003') then Exit(FM['brass']);
    if c.m = 'Material.006' then Exit(FM['g36mag']);
    if c.m = 'Material.011' then Exit(FM['metal']);
    var k := c.c[0] * 1.4 + 0.009;
    var key := 'g36_' + c.m;
    if FM[key] = nil then
      FM[key] := JMeshStandardMaterial.Create(class
        color := Col(k, k, k * 1.04);
        roughness: Float := if c.m = 'Material.009' then 0.5 else 0.78;
        metalness: Float := if c.m = 'Material.009' then 0.45 else 0.0;
        envMapIntensity := 0.55; side := DoubleSide;
      end);
    Result := FM[key];
  end;

  procedure BuildPart(chunks: array of JG36Chunk; parent: JObject3D; pivot: JVector3 = nil);
  begin
    for var c in chunks do begin
      var g := DecodeChunk(c);
      if Assigned(pivot) then g.translate(-pivot.x, -pivot.y, -pivot.z);
      parent.add(JMesh.Create(g, G36Mat(c)));
    end;
  end;

  function Hand(mirror: Boolean): JGroup;
  begin
    // local frame: +y = toward fingertips, +z = palm normal, -y = forearm
    var h := JGroup.Create;
    AddM(RB(0.056, 0.075, 0.028, 0.012, 3), FM['glove'], 0, 0, 0, 0, 0, 0, h);
    AddM(RB(0.058, 0.03, 0.022, 0.009, 2), FM['knuckle'], 0, 0.026, -0.012, 0, 0, 0, h);
    AddM(RB(0.03, 0.03, 0.01, 0.004, 2), FM['knuckle'], 0, -0.01, -0.016, 0, 0, 0, h); // back-of-hand strap
    var seg := JCapsuleGeometry.Create(0.0082, 0.018, 4, 8);
    for var i := 0 to 3 do begin
      var f := JGroup.Create;
      f.position.&set(-0.021 + i * 0.014, 0.037 - Abs(i - 1.2) * 0.003, 0.002);
      h.add(f);
      f.rotation.x := 1.0 + i * 0.06;
      AddM(seg, FM['glove'], 0, 0.013, 0, 0, 0, 0, f);
      var j := JGroup.Create;
      j.position.&set(0, 0.028, 0);
      f.add(j);
      j.rotation.x := 1.25;
      AddM(seg, FM['glove'], 0, 0.011, 0, 0, 0, 0, j);
    end;
    var t := JGroup.Create;
    t.position.&set(0.026, -0.012, 0.012); t.rotation.&set(0.7, 0, -0.7); h.add(t);
    AddM(JCapsuleGeometry.Create(0.0095, 0.024, 4, 8), FM['glove'], 0, 0.018, 0, 0, 0, 0, t);
    var t2 := JGroup.Create;
    t2.position.&set(0, 0.036, 0); t2.rotation.x := 0.6; t.add(t2);
    AddM(JCapsuleGeometry.Create(0.0088, 0.016, 4, 8), FM['glove'], 0, 0.012, 0, 0, 0, 0, t2);
    // cuff, sleeve, rolled cuff
    AddM(JCylinderGeometry.Create(0.029, 0.027, 0.045, 14), FM['glove'], 0, -0.055, -0.002, 0, 0, 0, h);
    AddM(JCylinderGeometry.Create(0.038, 0.047, 0.34, 18), FM['sleeve'], 0, -0.25, -0.004, 0, 0, 0, h);
    AddM(JTorusGeometry.Create(0.039, 0.009, 8, 18), FM['sleeve'], 0, -0.085, -0.004, PI / 2, 0, 0, h);
    AddM(RB(0.05, 0.05, 0.035, 0.01), FM['poly'], 0, -0.16, -0.035, 0, 0, 0, h); // watch/gear on sleeve
    if mirror then h.scale.x := -1;
    Result := h;
  end;

begin
  var gm := GenGunMetal(256, $1e1f21, 0.42);
  FM['metal'] := JMeshStandardMaterial.Create(class map := gm.Map; normalMap := gm.NormalMap; roughnessMap := gm.RoughnessMap; metalnessMap := gm.MetalnessMap; roughness := 1; metalness := 1; envMapIntensity := 1.1; end);
  var pb := GenPolymer(256, $1f1e1c);
  FM['poly'] := JMeshStandardMaterial.Create(class map := pb.Map; normalMap := pb.NormalMap; roughnessMap := pb.RoughnessMap; roughness := 1; metalness := 0; end);
  var gl := GenCloth(256, $2c2a26);
  FM['glove'] := JMeshStandardMaterial.Create(class map := gl.Map; normalMap := gl.NormalMap; roughness := 0.85; color := $bbbbbb; end);
  var gl2 := GenPolymer(256, $4a4238);
  FM['knuckle'] := JMeshStandardMaterial.Create(class map := gl2.Map; normalMap := gl2.NormalMap; roughness := 0.7; end);
  var cm := GenCamo(512);
  cm.Map.&repeat.&set(2, 2); cm.NormalMap.&repeat.&set(2, 2);
  FM['sleeve'] := JMeshStandardMaterial.Create(class map := cm.Map; normalMap := cm.NormalMap; roughness := 0.95; end);
  FM['lens'] := JMeshStandardMaterial.Create(class color := $1c2a33; metalness := 0.6; roughness := 0.25; transparent := true; opacity := 0.18; envMapIntensity := 0.5; depthWrite := false; end);
  FM['brass'] := JMeshStandardMaterial.Create(class color := $c09a50; metalness := 1; roughness := 0.3; end);

  gun := JGroup.Create;
  FGun := gun;
  FM['g36mag'] := JMeshStandardMaterial.Create(class color := Col(0.05, 0.055, 0.046); roughness := 0.32; metalness := 0; transparent := true; opacity := 0.9; end);
  BuildPart(G36.body, gun);
  FBolt := JGroup.Create; gun.add(FBolt);
  BuildPart(G36.bolt, FBolt);
  FMuzzle := JObject3D.Create; FMuzzle.position.&set(0, 0.004, -0.64); gun.add(FMuzzle);
  FMag := JGroup.Create;
  var magPivot := V3(0, -0.02, -0.06);
  FMag.position.copy(magPivot);
  gun.add(FMag);
  BuildPart(G36.mag, FMag, magPivot);
  FMagRest := FMag.position.clone;
  // --- red dot optic
  var optic := JGroup.Create; optic.position.&set(0, 0.123, 0.07); gun.add(optic);
  AddM(RB(0.03, 0.012, 0.05, 0.003), FM['metal'], 0, -0.016, 0, 0, 0, 0, optic);         // mount
  AddM(JCylinderGeometry.Create(0.02, 0.02, 0.07, 20, 1, true).rotateX(PI / 2), FM['metal'], 0, 0.006, 0, 0, 0, 0, optic);
  // inner wall of the tube (the open cylinder is single-sided, so its inside would be culled)
  AddM(JCylinderGeometry.Create(0.0185, 0.0185, 0.07, 20, 1, true).rotateX(PI / 2), JMeshStandardMaterial.Create(class color := $0b0b0c; roughness := 0.85; side := BackSide; end), 0, 0.006, 0, 0, 0, 0, optic);
  AddM(JTorusGeometry.Create(0.02, 0.003, 8, 24), FM['metal'], 0, 0.006, -0.035, 0, 0, 0, optic);
  AddM(JTorusGeometry.Create(0.02, 0.003, 8, 24), FM['metal'], 0, 0.006, 0.035, 0, 0, 0, optic);
  AddM(RB(0.012, 0.012, 0.02, 0.003), FM['metal'], 0.024, 0.006, 0.0, 0, 0, 0, optic);   // brightness knob
  AddM(RB(0.012, 0.012, 0.018, 0.003), FM['metal'], 0, 0.03, 0.0, 0, 0, 0, optic);       // elevation turret
  var lens := AddM(JCircleGeometry.Create(0.018, 24), FM['lens'], 0, 0.006, -0.03, 0, 0, 0, optic);
  lens.renderOrder := 5;
  Dot := JGroup.Create; Dot.position.&set(0, 0.006, -2.4); optic.add(Dot);
  AddM(JCircleGeometry.Create(0.0068, 20), JMeshBasicMaterial.Create(class color := Col(1.5, 0.0, 0.03); depthTest := false; depthWrite := false; transparent := true; end), 0, 0, 0, 0, 0, 0, Dot);
  AddM(JCircleGeometry.Create(0.013, 20), JMeshBasicMaterial.Create(class color := Col(0.9, 0.0, 0.0); depthTest := false; depthWrite := false; transparent := true; opacity := 0.25; blending := AdditiveBlending; end), 0, 0, 0, 0, 0, 0, Dot);
  Dot.traverse(procedure(o: JObject3D) begin o.renderOrder := 20; end);
  Dot.renderOrder := 20;
  FOpticCenter := V3(0, 0.123 + 0.006, 0.07);

  // --- arms
  FArms := JGroup.Create;
  gun.add(FArms);
  FRHand := Hand(false); FArms.add(FRHand);
  FLHand := Hand(true); FArms.add(FLHand);
  FHandR := THandPose.Create(V3(0.031, -0.078, 0.103), V3(0.13, -0.3, 0.34), V3(-1, 0.1, 0));
  FHandL := THandPose.Create(V3(-0.037, 0.016, -0.3), V3(-0.19, -0.25, -0.07), V3(1, 0.25, 0.1));
  FHandLMag := THandPose.Create(V3(-0.035, -0.12, -0.03), V3(-0.2, -0.36, 0.12), V3(1, 0, 0));
  PoseHand(FRHand, FHandR.Pos, FHandR.Elbow, FHandR.Palm);
  PoseHand(FLHand, FHandL.Pos, FHandL.Elbow, FHandL.Palm);

  gun.traverse(procedure(o: JObject3D)
    begin
      if o.isMesh then begin
        o.castShadow := false;
        o.receiveShadow := false;
      end;
    end);
  Root.add(gun);

  // --- muzzle flash
  var flashMat := function(tex: JTexture): JMaterial
    begin
      Result := JMeshBasicMaterial.Create(class map := tex; color := Col(4, 3, 2); transparent := true; blending := AdditiveBlending; depthWrite := false; side := DoubleSide; end);
    end;
  FlashGroup := JGroup.Create;
  FMuzzle.add(FlashGroup);
  FlashGroup.add(JMesh.Create(JPlaneGeometry.Create(0.14, 0.14), flashMat(SpriteTex('flash'))));
  var sideTex := SpriteTex('flashSide');
  for var i := 0 to 2 do begin
    var g := JPlaneGeometry.Create(0.22, 0.09);
    g.translate(0.11, 0, 0);
    g.rotateY(PI / 2);
    var m := JMesh.Create(g, flashMat(sideTex));
    m.rotation.z := (i / 3) * PI;
    FlashGroup.add(m);
  end;
  FlashGroup.visible := false;
  FlashGroup.traverse(procedure(o: JObject3D) begin o.renderOrder := 30; end);

  // poses: gun group local transform
  HipPos := V3(0.14, -0.172, -0.39);
  // ADS: put optic centre on the view axis
  ADSPos := V3(-FOpticCenter.x, -FOpticCenter.y, -0.25 - FOpticCenter.z);
  FEjectPort := JObject3D.Create; FEjectPort.position.&set(0.022, 0.03, -0.05); gun.add(FEjectPort);
end;

procedure TWeapon.PoseHand(h: JObject3D; pos, elbow, palm: JVector3);
begin
  var f := pos.clone.sub(elbow).normalize;
  var n := palm.clone.addScaledVector(f, -palm.dot(f)).normalize;
  var x := V3Zero.crossVectors(f, n);
  h.quaternion.setFromRotationMatrix(JMatrix4.Create.makeBasis(x, f, n));
  h.position.copy(pos);
end;

procedure TWeapon.SetAspect(a: Float);
begin
  Camera.aspect := a;
  Camera.updateProjectionMatrix;
end;

function TWeapon.FireInterval: Float;
begin
  Result := 60 / Stats.RPM;
end;

function TWeapon.IsReloading: Boolean;
begin
  Result := Reloading > 0;
end;

function TWeapon.Busy: Boolean;
begin
  Result := (Reloading > 0) or (FMelee > 0) or (FThrowT > 0) or (FEquipT > 0);
end;

function TWeapon.CanFire: Boolean;
begin
  Result := (Cooldown <= 0) and not Busy and (FSprint < 0.3);
end;

function TWeapon.Fire: Boolean;
begin
  if Ammo <= 0 then begin
    if Cooldown <= 0 then begin
      FAudio.Dry;
      Cooldown := 0.25;
    end;
    Exit(false);
  end;
  Ammo -= 1;
  Cooldown := FireInterval;
  var a := Aim;
  FKickPos.Impulse((Rnd - 0.5) * 0.08, 0.05 * (1 - a * 0.6), 0.9 * (1 - a * 0.55));
  FKickRot.Impulse(2.2 * (1 - a * 0.7), (Rnd - 0.5) * 1.2, (Rnd - 0.5) * 1.6);
  FFlashT := 0;
  FlashGroup.visible := true;
  FlashGroup.rotation.z := Rnd * PI * 2;
  var s := 0.7 + Rnd * 0.6;
  FlashGroup.scale.&set(s, s, 0.8 + Rnd * 0.5);
  FFlashLight.intensity := 6;
  FFlashLight.position.copy(FMuzzle.position).add(FGun.position);
  FAudio.Gunshot;
  Result := true;
end;

function TWeapon.StartReload: Boolean;
begin
  if (Reloading > 0) or (Ammo >= Stats.Mag) or (Reserve <= 0) or (FMelee > 0) then Exit(false);
  FReloadEmpty := Ammo = 0;
  FReloadDur := if FReloadEmpty then Stats.ReloadEmpty else Stats.Reload;
  Reloading := FReloadDur;
  FAudio.Reload(FReloadDur);
  Result := true;
end;

procedure TWeapon.FinishReload;
begin
  var need := Stats.Mag - Ammo;
  var take := Min(need, Reserve);
  Ammo += take;
  Reserve -= take;
end;

function TWeapon.StartMelee: Boolean;
begin
  if (FMelee > 0) or (Reloading > 0) then Exit(false);
  FMelee := 0.55;
  FAudio.Melee;
  Result := true;
end;

function TWeapon.StartThrow: Boolean;
begin
  if FThrowT > 0 then Exit(false);
  FThrowT := 0.7;
  Result := true;
end;

procedure TWeapon.OnLand(v: Float);
begin
  FLand.Impulse(0, -MinF(v, 12) * 0.035, 0);
end;

// look delta in radians this frame
procedure TWeapon.Update(dt: Float; mainCam: JCamera; input: TWeaponInput);
begin
  Camera.position.copy(mainCam.position);
  Camera.quaternion.copy(mainCam.quaternion);
  Cooldown -= dt;
  FEquipT := MaxF(0, FEquipT - dt);

  Aim := Damp(Aim, if input.Aiming and not Busy then 1 else 0, 14, dt);
  FSprint := Damp(FSprint, if input.Sprinting and not Busy then 1 else 0, 9, dt);

  // sway lags behind look
  FSwayTarget.&set(ClampF(-input.LookDX * 1.4, -0.12, 0.12), ClampF(-input.LookDY * 1.4, -0.12, 0.12));
  FSway.x := Damp(FSway.x, FSwayTarget.x, 10, dt);
  FSway.y := Damp(FSway.y, FSwayTarget.y, 10, dt);

  // bob
  var moving := if input.Grounded then MinF(input.MoveSpeed / 5, 1.6) else 0.0;
  FBobAmt := Damp(FBobAmt, moving, 8, dt);
  FBobPhase += dt * (input.MoveSpeed * 1.55 + 0.001);
  FBreath += dt;

  FKickPos.Update(dt); FKickRot.Update(dt); FLand.Update(dt);

  var a := Aim;
  var sp := FSprint * (1 - a);
  var bobScale := Mix(1, 0.12, a);
  var bx := Sin(FBobPhase) * 0.011 * FBobAmt * bobScale;
  var by := -Abs(Cos(FBobPhase)) * 0.012 * FBobAmt * bobScale;
  var breathY := Sin(FBreath * 1.3) * 0.0015 * (1 - a * 0.7);
  var breathX := Sin(FBreath * 0.7) * 0.001 * (1 - a * 0.7);

  // base pose
  var p := V3Zero.lerpVectors(HipPos, ADSPos, Ease(a));
  var rx := 0.0;
  var ry := 0.0;
  var rz := 0.0;
  // crouch cant
  rz += input.Crouch * 0.06 * (1 - a);
  // sprint pose
  p.x := p.x + sp * -0.04; p.y := p.y + sp * -0.03; p.z := p.z + sp * 0.02;
  rx += sp * -0.35; ry += sp * 0.75; rz += sp * 0.35;
  var sprintBob := Sin(FBobPhase) * sp;
  p.x := p.x + sprintBob * 0.02; p.y := p.y + Abs(sprintBob) * -0.012;
  rz += sprintBob * 0.06;

  // reload animation
  var magOff := 0.0;
  var magVis := true;
  var lh := 0.0;
  if Reloading > 0 then begin
    Reloading -= dt;
    var t := 1 - Reloading / FReloadDur;
    var tilt := Ease(MinF(1, t / 0.15)) * (1 - Ease(MaxF(0, (t - 0.85) / 0.15)));
    rz += tilt * 0.42; rx += tilt * 0.12; ry += tilt * -0.12;
    p.y := p.y + tilt * -0.035; p.x := p.x + tilt * -0.045; p.z := p.z + tilt * 0.03;
    if t < 0.2 then magOff := 0
    else if t < 0.35 then magOff := Ease((t - 0.2) / 0.15) * 0.35
    else if t < 0.45 then begin magOff := 0.35; magVis := false; end
    else if t < 0.6 then magOff := (1 - Ease((t - 0.45) / 0.15)) * 0.35
    else magOff := 0;
    if (t > 0.58) and (t < 0.62) then FKickRot.Impulse(1.2, 0, 0.5);
    lh := if (t > 0.18) and (t < 0.62) then 1 else 0;
    if FReloadEmpty and (t > 0.78) and (t < 0.83) then FKickPos.Impulse(0, 0, 0.35);
    if Reloading <= 0 then begin
      Reloading := 0;
      FinishReload;
    end;
  end;
  FMag.position.&set(FMagRest.x, FMagRest.y - magOff, FMagRest.z + magOff * 0.15);
  FMag.visible := magVis;
  // left hand follows mag during reload
  FLhk := Damp(FLhk, lh, 12, dt);
  var k := FLhk;
  var lp := FHandL.Pos.clone.lerp(FHandLMag.Pos, k);
  lp.y := lp.y + (FMag.position.y - FMagRest.y) * k;
  PoseHand(FLHand, lp, FHandL.Elbow.clone.lerp(FHandLMag.Elbow, k), FHandL.Palm.clone.lerp(FHandLMag.Palm, k));

  // melee: jab forward with stock swing
  if FMelee > 0 then begin
    FMelee -= dt;
    var t := 1 - FMelee / 0.55;
    var mk := Sin(MinF(1, t * 1.6) * PI);
    p.z := p.z - mk * 0.12; p.x := p.x - mk * 0.08; ry += mk * 0.6; rz += mk * 0.4;
  end;
  // grenade throw: weapon dips out
  if FThrowT > 0 then begin
    FThrowT -= dt;
    var t := 1 - FThrowT / 0.7;
    var tk := Sin(t * PI);
    p.y := p.y - tk * 0.18; rx -= tk * 0.6;
  end;
  if FEquipT > 0 then begin
    var ek := Ease(FEquipT / 0.6);
    p.y := p.y - ek * 0.25; rx -= ek * 0.8;
  end;

  // apply sway, bob, recoil
  p.x := p.x + bx + breathX + FSway.x * 0.35 * (1 - a * 0.8) + FKickPos.X.x * 0.01;
  p.y := p.y + by + breathY + FSway.y * 0.35 * (1 - a * 0.8) + FKickPos.X.y * 0.01 + FLand.X.y;
  p.z := p.z + FKickPos.X.z * 0.035;
  rx += FKickRot.X.x * 0.03 + FSway.y * 0.6 * (1 - a * 0.7) + FLand.X.y * -1.5;
  ry += FKickRot.X.y * 0.02 + FSway.x * 0.8 * (1 - a * 0.7);
  rz += FKickRot.X.z * 0.02 + FSway.x * 0.9 + bx * 2;

  FGun.position.copy(p);
  FGun.rotation.&set(rx, ry, rz);
  Camera.fov := Mix(50, 36, a);
  Camera.updateProjectionMatrix;

  // muzzle flash lifetime
  FFlashT += dt;
  // charging handle cycles back with each shot
  FBolt.position.z := MaxF(0, 1 - FFlashT / 0.055) * 0.028;
  if FFlashT > 0.045 then FlashGroup.visible := false;
  FFlashLight.intensity := MaxF(0, 6 * (1 - FFlashT / 0.06));
  Dot.visible := a > 0.85;
end;

function TWeapon.MuzzleWorld(target: JVector3): JVector3;
begin
  Camera.updateMatrixWorld(true);
  Result := FMuzzle.getWorldPosition(target);
end;

function TWeapon.EjectWorld(target: JVector3): JVector3;
begin
  Result := FEjectPort.getWorldPosition(target);
end;

end.
