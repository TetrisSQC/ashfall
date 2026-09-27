unit ashfall.enemies;

// Hostile infantry: textured, skinned soldier model (Mixamo rig) driven by an invisible
// procedural control rig: locomotion, cover-seeking AI, burst fire, hit zones, death falls.

interface

uses
  ashfall.host, ashfall.three, ashfall.world, ashfall.audio, ashfall.effects, ashfall.player;

type
  TRestBone = class
  public
    Q: JQuaternion;
    P, Dir: JVector3;
  end;

  TLimb = class
  public
    Upper, Lower: JGroup;   // shoulder/elbow or hip/knee
  end;

  // grip of one hand on the rifle, sampled from the model's idle animation
  TGrip = class
  public
    Pos, Pole: JVector3;
    Quat: JQuaternion;
  end;

  TTexCallback = procedure(t: JTexture);

  // ---- packed soldier data (soldierdata.js, published as window.SOLDIER)
  JQuantArray = class external 'Object'
  public
    q: String;
    min, max: array of Float;
  end;

  JSoldierGeo = class external 'Object'
  public
    mat, nrm, idx: String;
    pos, uv: JQuantArray;
    si, sw: variant;
    big: Boolean;
    bone: Integer;
  end;

  JSoldierMat = class external 'Object'
  public
    color: array of Float;
    rough, metal, map, normal, rm: variant;
    transparent: Boolean;
  end;

  JSoldierMats = class external 'Object'
  public
    function GetItem(name: String): JSoldierMat; external array;
    property Items[name: String]: JSoldierMat read GetItem; default;
  end;

  JSoldierBone = class external 'Object'
  public
    n: String;
    p: Integer;
    t, q: array of Float;
  end;

  JQuatMap = class external 'Object'
  public
    function GetItem(name: String): array of Float; external array;
    property Items[name: String]: array of Float read GetItem; default;
  end;

  JGripData = class external 'Object'
  public
    pos, quat, pole: array of Float;
  end;

  JHands = class external 'Object'
  public
    Left, Right: JGripData;
  end;

  JPoseData = class external 'Object'
  public
    pos, quat: array of Float;
  end;

  JSoldierRig = class external 'Object'
  public
    hands: JHands;
    fingers, upper: JQuatMap;
    lowReady, gunInChest: JPoseData;
    butt, muzzle: array of Float;
  end;

  JSoldierData = class external 'Object'
  public
    bones: array of JSoldierBone;
    meshes, props, gun: array of JSoldierGeo;
    mats: JSoldierMats;
    rig: JSoldierRig;
  end;

  TZoneHit = class
  public
    T: Float;
    Zone: String;
  end;

  TEnemy = class;

  TEnemyCtx = class
  public
    Player: TPlayer;
    Audio: TAudio;
    Effects: TEffects;
    Enemies: array of TEnemy;
    CoverPoints: array of JVector3;
  end;

  TEnemy = class
  private
    FScene: JScene;
    FWorld: TWorld;
    FModel: JObject3D;
    FBones: array [String] of JObject3D;
    FTarget: JVector3;
    FVel, FLastPos, FDeathAxis: JVector3;
    FWalkPhase, FStateTimer, FStuckTimer, FFlinch, FCrouch, FStrafeDir, FUnseen: Float;
    FDeathStyle: Integer;
    FFiringRecent: Boolean;
    procedure SetBoneWorld(bone: JObject3D; worldQ: JQuaternion);
    function Rel(group: JObject3D; target: JQuaternion): JQuaternion;
    procedure ApplyDelta(name: String; delta: JQuaternion);
    function AimBone(name: String; dirW: JVector3): JQuaternion;
    procedure Retarget;
    procedure PickCover(points: array of JVector3; player: TPlayer);
    procedure MoveToward(t: JVector3; dt, spd: Float);
    procedure Combat(dt, dist: Float; sees: Boolean; player: TPlayer; audio: TAudio; effects: TEffects);
    procedure Shoot(dist: Float; player: TPlayer; audio: TAudio; effects: TEffects);
    function WorldToLocalAxis(a: JVector3): JVector3;
  public
    Root, Body, Hips, Spine, Head, Gun, Muzzle: JGroup;
    ArmR, ArmL, LegR, LegL: TLimb;
    HP, Speed, Yaw, AimPitch, Awareness, DeathT, ShotTimer, BurstCooldown: Float;
    Ready: Float;           // 0 = shouldered / aiming, 1 = low ready
    ReadyOverride: Float;   // < 0 = automatic
    BurstLeft: Integer;
    Alive: Boolean;
    State: String;
    constructor Create(scene: JScene; world: TWorld; pos: JVector3);
    function EyePos(target: JVector3): JVector3;
    function HitTest(o, d: JVector3; maxT: Float): TZoneHit;
    function Damage(amount: Float; dir: JVector3; zone: String): Boolean;
    procedure Update(dt: Float; ctx: TEnemyCtx);
    procedure Animate(dt: Float);
    procedure UpdateDeath(dt: Float);
    procedure Dispose;
  end;

// Build the soldier template, the rifle and the grip data once. Must finish before any Enemy is created.
procedure LoadSoldier(done: TProc);

implementation

var SOLDIER external 'SOLDIER': JSoldierData;

var _v, _v2, _v3, DOWN, _a, _b, _n: JVector3;
var _q, _q2, _qb, _qp, _qa, _qc: JQuaternion;

// bones the retargeter drives, by short Mixamo name
var RIG: array of String;

// shared template: soldier scene, rest pose, rifle and grip data
var Tmpl: JGroup;
var Rest: array [String] of TRestBone;
var LenUpper, LenFore: Float;
var GunTmpl: JGroup;
var GripL, GripR: TGrip;
var FingerNames: array of String;
var FingerQuats: array of JQuaternion;
var UpperNames: array of String;
var UpperQuats: array of JQuaternion;
var Butt, MuzzleOfs, Pocket: JVector3;
var GunInChest: JMatrix4;
var SMats: array [String] of JMaterial;
var Loaded: Boolean;

// strip 'mixamorig' / 'mixamorig:' prefix and a trailing '_<digits>' suffix
function ShortName(n: String): String;
begin
  var s := n;
  if Copy(s, 1, 9) = 'mixamorig' then begin
    s := Copy(s, 10, Length(s));
    if Copy(s, 1, 1) = ':' then s := Copy(s, 2, Length(s));
  end;
  var i := Length(s);
  while (i > 0) and (s[i] >= '0') and (s[i] <= '9') do i -= 1;
  if (i < Length(s)) and (i > 0) and (s[i] = '_') then s := Copy(s, 1, i - 1);
  Result := s;
end;

// matches /Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/
function IsFingerBone(n: String): Boolean;
begin
  for var f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] do
    for var d := 1 to 3 do begin
      var tail := 'Hand' + f + IntStr(d);
      if (Length(n) >= Length(tail)) and (Copy(n, Length(n) - Length(tail) + 1, Length(tail)) = tail) then Exit(true);
    end;
  Result := false;
end;

// JavaScript's (v ?? d)
function Coalesce(v: variant; d: Float): Float;
begin
  asm @Result = (@v ?? @d); end;
end;

// ---- decoding of the packed soldier data (see soldierdata.js)
function Bytes(str: String): JUint8Array;
begin
  var bin := Atob(str);
  Result := JUint8Array.Create(bin.Length);
  for var i := 0 to bin.Length - 1 do Result[i] := CharCode(bin, i);
end;

function Dequant(q: JQuantArray; comps: Integer): JFloat32Array;
begin
  var src := JUint16Array.Create(Bytes(q.q).buffer);
  Result := JFloat32Array.Create(src.&length);
  for var i := 0 to src.&length - 1 do begin
    var k := i mod comps;
    Result[i] := q.min[k] + (src[i] / 65535) * (q.max[k] - q.min[k]);
  end;
end;

function BuildGeo(m: JSoldierGeo): JBufferGeometry;
begin
  var g := JBufferGeometry.Create;
  g.setAttribute('position', JBufferAttribute.Create(Dequant(m.pos, 3), 3));
  var n := JInt8Array.Create(Bytes(m.nrm).buffer);
  var nf := JFloat32Array.Create(n.&length);
  for var i := 0 to n.&length - 1 do nf[i] := n[i] / 127;
  g.setAttribute('normal', JBufferAttribute.Create(nf, 3));
  if Assigned(m.uv) then g.setAttribute('uv', JBufferAttribute.Create(Dequant(m.uv, 2), 2));
  if m.si then begin
    g.setAttribute('skinIndex', JUint8BufferAttribute.Create(Bytes(m.si), 4));
    g.setAttribute('skinWeight', JBufferAttribute.Create(Bytes(m.sw), 4, true));
  end;
  var ib := Bytes(m.idx).buffer;
  if m.big then g.setIndex(JBufferAttribute.Create(JUint32Array.Create(ib), 1))
  else g.setIndex(JBufferAttribute.Create(JUint16Array.Create(ib), 1));
  Result := g;
end;

procedure LoadTex(url: variant; srgb: Boolean; cb: TTexCallback);
begin
  if not url then begin
    cb(nil);
    Exit;
  end;
  var img := JImage.Create;
  img.onload := procedure
    begin
      var t := JTexture.Create(img);
      t.flipY := false;
      t.colorSpace := if srgb then SRGBColorSpace else NoColorSpace;
      t.wrapS := RepeatWrapping; t.wrapT := RepeatWrapping;
      t.anisotropy := 4;
      t.needsUpdate := true;
      cb(t);
    end;
  img.onerror := procedure begin cb(nil); end;
  img.src := url;
end;

// one material: waits for its three textures, then calls done
procedure LoadMat(mname: String; m: JSoldierMat; done: TProc);
begin
  var left := 3;
  var tMap, tNrm, tRm: JTexture;
  var fin := procedure
    begin
      left -= 1;
      if left > 0 then Exit;
      var tr: Boolean := m.transparent;
      SMats[mname] := JMeshStandardMaterial.Create(class
        name: String := mname; color := JColor.Create(0, 0, 0).fromArray(m.color);
        map: variant := tMap; normalMap: variant := tNrm; roughnessMap: variant := tRm; metalnessMap: variant := tRm;
        roughness: Float := Coalesce(m.rough, 1); metalness: Float := Coalesce(m.metal, 0);
        transparent: Boolean := tr; alphaTest: Float := if tr then 0.3 else 0;
      end);
      done();
    end;
  LoadTex(m.map, true, procedure(t: JTexture) begin tMap := t; fin(); end);
  LoadTex(m.normal, false, procedure(t: JTexture) begin tNrm := t; fin(); end);
  LoadTex(m.rm, false, procedure(t: JTexture) begin tRm := t; fin(); end);
end;

procedure BuildShared;
begin
  var D := SOLDIER;
  // skeleton from world-space bind pose
  Tmpl := JGroup.Create;
  var bones: array of JObject3D;
  var worlds: array of JMatrix4;
  for var b in D.bones do begin
    var o := JBone.Create;
    o.name := b.n;
    bones.Add(o);
    worlds.Add(JMatrix4.Create.compose(V3Zero.fromArray(b.t), JQuaternion.Create.fromArray(b.q), V3(1, 1, 1)));
  end;
  for var i := 0 to D.bones.Length - 1 do begin
    var b := D.bones[i];
    var lm := if b.p >= 0 then worlds[b.p].clone.invert.multiply(worlds[i]) else worlds[i].clone;
    lm.decompose(bones[i].position, bones[i].quaternion, bones[i].scale);
    var parent: JObject3D := if b.p >= 0 then bones[b.p] else Tmpl;
    parent.add(bones[i]);
  end;
  Tmpl.updateMatrixWorld(true);
  var skeleton := JSkeleton.Create(bones);
  for var m in D.meshes do begin
    var sm := JSkinnedMesh.Create(BuildGeo(m), SMats[m.mat]);
    sm.castShadow := true; sm.receiveShadow := true; sm.frustumCulled := false;
    Tmpl.add(sm);
    sm.bind(skeleton, JMatrix4.Create);
  end;
  for var p in D.props do begin
    var mesh := JMesh.Create(BuildGeo(p), SMats[p.mat]);
    mesh.castShadow := true;
    bones[p.bone].add(mesh);
  end;
  // rest pose in model space (feet at origin, facing +z)
  for var o in bones do begin
    var n := ShortName(o.name);
    if RIG.IndexOf(n) >= 0 then begin
      var r := TRestBone.Create;
      r.Q := o.getWorldQuaternion(JQuaternion.Create);
      r.P := o.getWorldPosition(V3Zero);
      Rest[n] := r;
    end;
  end;
  var parents: array of String := ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
  var childs: array of String := ['LeftForeArm', 'LeftHand', 'RightForeArm', 'RightHand', 'LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot'];
  for var k := 0 to parents.Length - 1 do
    Rest[parents[k]].Dir := Rest[childs[k]].P.clone.sub(Rest[parents[k]].P).normalize;
  LenUpper := Rest['RightForeArm'].P.distanceTo(Rest['RightArm'].P);
  LenFore := Rest['RightHand'].P.distanceTo(Rest['RightForeArm'].P);
  // rifle (AKS-74U) in its own frame: barrel +z, up +y
  GunTmpl := JGroup.Create;
  for var g in D.gun do begin
    var m := JMesh.Create(BuildGeo(g), SMats[g.mat]);
    m.castShadow := true;
    GunTmpl.add(m);
  end;
  // grip data sampled from the model's idle animation
  var rig := D.rig;
  GripL := TGrip.Create;
  GripL.Pos := V3Zero.fromArray(rig.hands.Left.pos); GripL.Quat := JQuaternion.Create.fromArray(rig.hands.Left.quat); GripL.Pole := V3Zero.fromArray(rig.hands.Left.pole);
  GripR := TGrip.Create;
  GripR.Pos := V3Zero.fromArray(rig.hands.Right.pos); GripR.Quat := JQuaternion.Create.fromArray(rig.hands.Right.quat); GripR.Pole := V3Zero.fromArray(rig.hands.Right.pole);
  for var n in ObjectKeys(rig.fingers) do begin
    FingerNames.Add(ShortName(n));
    FingerQuats.Add(JQuaternion.Create.fromArray(rig.fingers[n]));
  end;
  // gun poses in control-spine space (spine sits 1.03 m above the feet at rest)
  var spineY := 1.03;
  Butt := V3Zero.fromArray(rig.butt);
  MuzzleOfs := V3Zero.fromArray(rig.muzzle);
  var shoulder := Rest['RightArm'].P.clone.sub(V3(0, spineY, 0));
  Pocket := shoulder.add(V3(0.07, 0.05, 0.07)); // just inside the right shoulder joint
  // low ready: upper-body rotations of the source idle frame + rifle pose relative to the chest bone
  for var n in ObjectKeys(rig.upper) do begin
    UpperNames.Add(n);
    UpperQuats.Add(JQuaternion.Create.fromArray(rig.upper[n]));
  end;
  GunInChest := JMatrix4.Create.compose(V3Zero.fromArray(rig.gunInChest.pos), JQuaternion.Create.fromArray(rig.gunInChest.quat), V3(1, 1, 1));
  Loaded := true;
end;

procedure LoadSoldier(done: TProc);
begin
  if Loaded then begin
    done();
    Exit;
  end;
  var names := ObjectKeys(SOLDIER.mats);
  var left := names.Length;
  for var n in names do
    LoadMat(n, SOLDIER.mats[n], procedure
      begin
        left -= 1;
        if left = 0 then begin
          BuildShared;
          done();
        end;
      end);
end;

function Grp(parent: JObject3D; x: Float = 0; y: Float = 0; z: Float = 0): JGroup;
begin
  Result := JGroup.Create;
  Result.position.&set(x, y, z);
  parent.add(Result);
end;

// two-bone IK in world space: returns upper and fore directions
procedure IK(S, T: JVector3; L1, L2: Float; pole: JVector3; var up, fore: JVector3);
begin
  var a := T.clone.sub(S);
  var d := ClampF(a.length, 0.05, L1 + L2 - 0.002);
  a.normalize;
  var ang := ACos(ClampF((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  var n := V3Zero.crossVectors(a, pole).normalize;
  up := a.clone.applyAxisAngle(n, ang);
  var E := S.clone.addScaledVector(up, L1);
  fore := T.clone.sub(E).normalize;
end;

procedure SolveArm(arm: TLimb; side: Float; target: JVector3);
begin
  var L1 := 0.28;
  var L2 := 0.28;
  var S := arm.Upper.position;
  _a.subVectors(target, S);
  var d := ClampF(_a.length, 0.05, L1 + L2 - 0.002);
  _a.normalize;
  var pole := _b.&set(side * 0.7, -1, -0.15).normalize;
  var ang := ACos(ClampF((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  _n.crossVectors(_a, pole).normalize;
  var upper := _a.clone.applyAxisAngle(_n, ang);
  var E := S.clone.addScaledVector(upper, L1);
  var fore := _b.subVectors(target, E).normalize;
  _qa.setFromUnitVectors(DOWN, upper);
  arm.Upper.quaternion.copy(_qa);
  _qc.setFromUnitVectors(DOWN, fore);
  arm.Lower.quaternion.copy(_qa.invert.multiply(_qc));
end;

// ray/sphere distance, or -1 on a miss
function RaySphere(o, d, c: JVector3; r: Float): Float;
begin
  var ox := o.x - c.x;
  var oy := o.y - c.y;
  var oz := o.z - c.z;
  var b := ox * d.x + oy * d.y + oz * d.z;
  var cc := ox * ox + oy * oy + oz * oz - r * r;
  var h := b * b - cc;
  if h < 0 then Exit(-1);
  Result := -b - Sqrt(h);
end;

// ray vs capsule (segment a-b, radius r); iq's formulation. -1 on a miss
function RayCapsule(ro, rd, pa, pb: JVector3; r: Float): Float;
begin
  var ba := V3Zero.subVectors(pb, pa);
  var oa := V3Zero.subVectors(ro, pa);
  var baba := ba.dot(ba);
  var bard := ba.dot(rd);
  var baoa := ba.dot(oa);
  var rdoa := rd.dot(oa);
  var oaoa := oa.dot(oa);
  var a := baba - bard * bard;
  var b := baba * rdoa - baoa * bard;
  var c := baba * oaoa - baoa * baoa - r * r * baba;
  var h := b * b - a * c;
  if h >= 0 then begin
    var t := (-b - Sqrt(h)) / a;
    var y := baoa + t * bard;
    if (y > 0) and (y < baba) then Exit(t);
    var oc := if y <= 0 then oa else V3Zero.subVectors(ro, pb);
    var bb := rd.dot(oc);
    var cc := oc.dot(oc) - r * r;
    var hh := bb * bb - cc;
    if hh > 0 then Exit(-bb - Sqrt(hh));
  end;
  Result := -1;
end;

{ TEnemy }

constructor TEnemy.Create(scene: JScene; world: TWorld; pos: JVector3);

  function MakeLimb(parent: JObject3D; x, y, len: Float): TLimb;
  begin
    Result := TLimb.Create;
    Result.Upper := Grp(parent, x, y, 0);
    Result.Lower := Grp(Result.Upper, 0, len, 0);
  end;

begin
  FScene := scene; FWorld := world;
  Root := JGroup.Create;
  Root.position.copy(pos);
  scene.add(Root);
  Body := Grp(Root);                       // pivot for death fall
  // invisible control rig (joint conventions: limbs hang along -y at rest)
  Hips := Grp(Body, 0, 0.95, 0);
  Spine := Grp(Hips, 0, 0.08, 0);
  Head := Grp(Spine, 0, 0.62, 0.02);
  ArmR := MakeLimb(Spine, -0.2, 0.42, -0.28);
  ArmL := MakeLimb(Spine, 0.2, 0.42, -0.28);
  LegR := MakeLimb(Hips, -0.1, -0.05, -0.43);
  LegL := MakeLimb(Hips, 0.1, -0.05, -0.43);
  // rifle at the shoulder
  Gun := Grp(Spine);
  Gun.add(GunTmpl.clone);
  Muzzle := Grp(Gun, MuzzleOfs.x, MuzzleOfs.y, MuzzleOfs.z + 0.02);

  // visible soldier
  FModel := SkeletonClone(Tmpl);
  Body.add(FModel);
  FModel.traverse(procedure(o: JObject3D)
    begin
      if o.isBone then begin
        var n := ShortName(o.name);
        if (RIG.IndexOf(n) >= 0) or IsFingerBone(n) then FBones[n] := o;
      end;
    end);
  ReadyOverride := -1;
  // fingers keep the grip pose from the source animation
  for var i := 0 to FingerNames.Length - 1 do
    if Assigned(FBones[FingerNames[i]]) then FBones[FingerNames[i]].quaternion.copy(FingerQuats[i]);

  HP := 100;
  Alive := true;
  State := 'advance';
  FVel := V3Zero;
  FWalkPhase := Rnd * 10;
  BurstCooldown := 1 + Rnd * 2;
  FLastPos := pos.clone;
  FDeathAxis := V3(1, 0, 0);
  FStrafeDir := if Rnd < 0.5 then -1 else 1;
end;

// ---- retargeting: drive the Mixamo skeleton from the control rig
procedure TEnemy.SetBoneWorld(bone: JObject3D; worldQ: JQuaternion);
begin
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert.multiply(worldQ));
  bone.updateMatrixWorld(true);
end;

// rotation of a control-rig group relative to the body
function TEnemy.Rel(group: JObject3D; target: JQuaternion): JQuaternion;
begin
  Result := target.copy(_qb).invert.multiply(group.getWorldQuaternion(_q2));
end;

// world quaternion = delta(body frame) * rest
procedure TEnemy.ApplyDelta(name: String; delta: JQuaternion);
begin
  var r := Rest[name];
  _q.copy(_qb).multiply(delta).multiply(r.Q);
  SetBoneWorld(FBones[name], _q);
end;

// aim a limb bone along a world direction (minimal rotation from its rest direction)
function TEnemy.AimBone(name: String; dirW: JVector3): JQuaternion;
begin
  var r := Rest[name];
  var restW := _v3.copy(r.Dir).applyQuaternion(_qb);
  var align := JQuaternion.Create.setFromUnitVectors(restW, dirW);
  _q.copy(_qb).multiply(r.Q).premultiply(align);
  SetBoneWorld(FBones[name], _q);
  Result := align;
end;

procedure TEnemy.Retarget;
var
  q: JQuaternion;

  procedure Leg(side: String; L: TLimb);
  begin
    var hipW := L.Upper.getWorldPosition(V3Zero);
    var kneeW := L.Lower.getWorldPosition(V3Zero);
    var ankleW := L.Lower.localToWorld(V3(0, -0.44, 0));
    AimBone(side + 'UpLeg', kneeW.clone.sub(hipW).normalize);
    AimBone(side + 'Leg', ankleW.clone.sub(kneeW).normalize);
    ApplyDelta(side + 'Foot', Rel(L.Lower, q));
  end;

  procedure Arm(side: String; A: TLimb; G: TGrip; gq: JQuaternion);
  var
    up, fore: JVector3;
  begin
    var sh := FBones[side + 'Arm'].getWorldPosition(V3Zero);
    if Alive then begin
      var lg := G.Pos.clone;
      var wrist := Gun.localToWorld(lg.clone);
      // support hand slides back along the handguard until the arm can reach it
      var i := 0;
      while (i < 12) and (side = 'Left') and (sh.distanceTo(wrist) > LenUpper + LenFore - 0.01) do begin
        lg.z := lg.z - 0.025;
        wrist := Gun.localToWorld(lg.clone);
        i += 1;
      end;
      IK(sh, wrist, LenUpper, LenFore, G.Pole.clone.applyQuaternion(_qb).normalize, up, fore);
    end else begin
      var e := A.Lower.getWorldPosition(V3Zero);
      var h := A.Lower.localToWorld(V3(0, -0.28, 0));
      up := e.clone.sub(A.Upper.getWorldPosition(V3Zero)).normalize;
      fore := h.sub(e).normalize;
    end;
    AimBone(side + 'Arm', up);
    var align := AimBone(side + 'ForeArm', fore);
    if Alive then _q.copy(gq).multiply(G.Quat)
    else _q.copy(_qb).multiply(Rest[side + 'Hand'].Q).premultiply(align);
    SetBoneWorld(FBones[side + 'Hand'], _q);
  end;

begin
  Body.updateMatrixWorld(true);
  Body.getWorldQuaternion(_qb);
  var dHips := Rel(Hips, JQuaternion.Create);
  var dSpine := Rel(Spine, JQuaternion.Create);
  var dHead := Rel(Head, JQuaternion.Create);
  // hips translation follows the control rig's pelvis offset
  var hipOff := Body.worldToLocal(Hips.getWorldPosition(V3Zero));
  var want := Rest['Hips'].P.clone.add(hipOff.sub(V3(0, 0.95, 0)));
  Body.localToWorld(want);
  FBones['Hips'].position.copy(FBones['Hips'].parent.worldToLocal(want));
  ApplyDelta('Hips', dHips);
  q := JQuaternion.Create;
  ApplyDelta('Spine', q.slerpQuaternions(dHips, dSpine, 0.34));
  ApplyDelta('Spine1', q.slerpQuaternions(dHips, dSpine, 0.67));
  ApplyDelta('Spine2', dSpine);
  ApplyDelta('LeftShoulder', dSpine);
  ApplyDelta('RightShoulder', dSpine);
  ApplyDelta('Neck', q.slerpQuaternions(dSpine, dHead, 0.5));
  ApplyDelta('Head', dHead);
  // legs from control-rig joint positions
  Leg('Left', LegL);
  Leg('Right', LegR);
  // low ready: pull the upper body toward the source idle frame and carry the rifle with the chest
  if Alive and (Ready > 0.001) then begin
    for var i := 0 to UpperNames.Length - 1 do
      if Assigned(FBones[UpperNames[i]]) then FBones[UpperNames[i]].quaternion.slerp(UpperQuats[i], Ready);
    FBones['Spine'].updateMatrixWorld(true);
    var t := V3Zero;
    var qq := JQuaternion.Create;
    var sc := V3Zero;
    FBones['Spine2'].matrixWorld.decompose(t, qq, sc);
    var lowW := JMatrix4.Create.compose(t, qq, V3(1, 1, 1)).multiply(GunInChest);
    var lp := V3Zero;
    var lq := JQuaternion.Create;
    lowW.decompose(lp, lq, sc);
    var ap := Gun.getWorldPosition(V3Zero);
    var aq := Gun.getWorldQuaternion(JQuaternion.Create);
    ap.lerp(lp, Ready);
    aq.slerp(lq, Ready);
    // back into the control spine's local space
    var pq := Gun.parent.getWorldQuaternion(JQuaternion.Create);
    Gun.position.copy(Gun.parent.worldToLocal(ap));
    Gun.quaternion.copy(pq.invert.multiply(aq));
    Gun.updateMatrixWorld(true);
  end;
  // arms: hands placed exactly where the source animation holds the rifle
  var gq := Gun.getWorldQuaternion(JQuaternion.Create);
  Arm('Left', ArmL, GripL, gq);
  Arm('Right', ArmR, GripR, gq);
end;

function TEnemy.EyePos(target: JVector3): JVector3;
begin
  Result := target.&set(Root.position.x, Root.position.y + 1.6 - FCrouch * 0.5, Root.position.z);
end;

// analytic hit test. returns nearest zone hit or nil
function TEnemy.HitTest(o, d: JVector3; maxT: Float): TZoneHit;
var
  best: TZoneHit;

  procedure Test(t: Float; zone: String);
  begin
    if (t > 0) and (t < maxT) and ((best = nil) or (t < best.T)) then begin
      best := TZoneHit.Create;
      best.T := t;
      best.Zone := zone;
    end;
  end;

begin
  if not Alive then Exit(nil);
  Root.updateMatrixWorld(true);
  best := nil;
  var headW := Head.getWorldPosition(_v);
  Test(RaySphere(o, d, headW, 0.15), 'head');
  var hipW := Hips.getWorldPosition(_v2);
  var neck := _v3.&set(0, 0.54, 0);
  Spine.localToWorld(neck);
  Test(RayCapsule(o, d, hipW, neck, 0.25), 'body');
  var foot := V3(Root.position.x, Root.position.y + 0.1, Root.position.z);
  Test(RayCapsule(o, d, foot, hipW, 0.17), 'legs');
  Result := best;
end;

function TEnemy.Damage(amount: Float; dir: JVector3; zone: String): Boolean;
begin
  if not Alive then Exit(false);
  HP -= amount;
  FFlinch := 1;
  Awareness := 1;
  if HP <= 0 then begin
    Alive := false;
    State := 'dead';
    _v.&set(dir.x, 0, dir.z).normalize;
    FDeathAxis.crossVectors(V3(0, 1, 0), _v).normalize;
    FDeathStyle := if zone = 'head' then 1 else if Rnd < 0.5 then 0 else 2;
    Exit(true);
  end;
  Result := false;
end;

procedure TEnemy.Update(dt: Float; ctx: TEnemyCtx);
begin
  var player := ctx.Player;
  var audio := ctx.Audio;
  var effects := ctx.Effects;
  if not Alive then begin
    UpdateDeath(dt);
    Exit;
  end;
  var pos := Root.position;
  var eye := EyePos(V3Zero);
  var pHead := player.HeadPos(V3Zero);
  var toP := _v.subVectors(pHead, eye);
  var dist := toP.length;
  var sees := (dist < 110) and FWorld.LineOfSight(eye, pHead);
  Awareness := if sees then MinF(1, Awareness + dt * 0.8) else MaxF(0.35, Awareness - dt * 0.1);
  FUnseen := if sees then 0 else FUnseen + dt;
  FStateTimer -= dt;
  FFlinch := MaxF(0, FFlinch - dt * 4);
  FFiringRecent := (BurstLeft > 0) or (ShotTimer > -0.8) or (sees and (Awareness > 0.8) and (dist < 45));

  // --- decisions
  if State = 'advance' then begin
    if (FTarget = nil) or (FStateTimer < 0) then PickCover(ctx.CoverPoints, player);
    var dx := FTarget.x - pos.x;
    var dz := FTarget.z - pos.z;
    var d := Hypot(dx, dz);
    if d < 0.8 then begin
      State := 'cover';
      FStateTimer := 3 + Rnd * 5;
    end else
      MoveToward(FTarget, dt, if sees and (dist < 30) then 2.2 else 3.6);
    // shoot while moving if very aware
    if sees and (Awareness > 0.8) and (dist < 45) then Combat(dt, dist, sees, player, audio, effects);
  end else if State = 'cover' then begin
    Speed := Damp(Speed, 0, 8, dt);
    // strafe a little to peek
    if sees then begin
      _v2.&set(-toP.z, 0, toP.x).normalize.multiplyScalar(FStrafeDir * 0.8);
      FVel.x := Damp(FVel.x, _v2.x, 3, dt); FVel.z := Damp(FVel.z, _v2.z, 3, dt);
      if Rnd < dt * 0.4 then FStrafeDir := -FStrafeDir;
    end else begin
      FVel.x := Damp(FVel.x, 0, 6, dt); FVel.z := Damp(FVel.z, 0, 6, dt);
    end;
    FCrouch := Damp(FCrouch, if sees then 0 else 1, 4, dt);
    pos.x := pos.x + FVel.x * dt; pos.z := pos.z + FVel.z * dt;
    Speed := Hypot(FVel.x, FVel.z);
    Combat(dt, dist, sees, player, audio, effects);
    if (FStateTimer < 0) or (dist < 6) or (not sees and (FUnseen > 3.5)) then begin
      State := 'advance';
      FTarget := nil;
    end;
  end;
  // face player when aware, else travel direction
  var desiredYaw := Yaw;
  if (Awareness > 0.5) and (sees or (State = 'cover')) then desiredYaw := Atan2(toP.x, toP.z)
  else if FVel.lengthSq > 0.1 then desiredYaw := Atan2(FVel.x, FVel.z);
  var dy := desiredYaw - Yaw;
  while dy > PI do dy -= PI * 2;
  while dy < -PI do dy += PI * 2;
  Yaw += dy * MinF(1, dt * 8);
  Root.rotation.y := Yaw;
  AimPitch := Atan2(toP.y, Hypot(toP.x, toP.z));

  // separation
  for var o in ctx.Enemies do begin
    if (o = Self) or not o.Alive then continue;
    var ddx := pos.x - o.Root.position.x;
    var ddz := pos.z - o.Root.position.z;
    var dd := ddx * ddx + ddz * ddz;
    if (dd < 1) and (dd > 0.0001) then begin
      var k := (1 - Sqrt(dd)) * dt * 3;
      pos.x := pos.x + ddx * k; pos.z := pos.z + ddz * k;
    end;
  end;
  // collide with level
  var v := V3(FVel.x, -1, FVel.z);
  pos.y := MaxF(pos.y - dt * 4, 0);
  FWorld.Collide(pos, v, 0.3, 1.7);
  // stuck detection
  FStuckTimer += dt;
  if FStuckTimer > 1.5 then begin
    if (pos.distanceTo(FLastPos) < 0.6) and (State = 'advance') then begin
      FTarget := nil;
      FStrafeDir := -FStrafeDir;
    end;
    FLastPos.copy(pos);
    FStuckTimer := 0;
  end;
  Animate(dt);
end;

procedure TEnemy.PickCover(points: array of JVector3; player: TPlayer);
begin
  var pp := player.Pos;
  var pHead := player.HeadPos(V3Zero);
  var myD := Root.position.distanceTo(pp);
  var best: JVector3 := nil;
  var bestScore := 1e30;
  var eye := V3Zero;
  for var c in points do begin
    var dp := c.distanceTo(pp);
    if (dp < 8) or (dp > 45) then continue;
    var ds := c.distanceTo(Root.position);
    if ds > 45 then continue;
    eye.&set(c.x, 1.5, c.z);
    var los := FWorld.LineOfSight(eye, pHead);
    var score := ds * 0.45 + Abs(dp - 18) * 0.8 + (if los then 0 else 16) + (if dp > myD + 4 then 10 else 0) + Rnd * 7;
    if score < bestScore then begin
      bestScore := score;
      best := c;
    end;
  end;
  if (best = nil) or (FUnseen > 6) then begin
    // hunt: push toward the player's position with some flank offset
    var a := Rnd * PI * 2;
    best := V3(pp.x + Cos(a) * 7, 0, pp.z + Sin(a) * 7);
    FUnseen := 0;
  end;
  FTarget := best.clone.add(V3((Rnd - 0.5) * 1.5, 0, (Rnd - 0.5) * 1.5));
  FStateTimer := 12;
end;

procedure TEnemy.MoveToward(t: JVector3; dt, spd: Float);
begin
  var pos := Root.position;
  _v2.&set(t.x - pos.x, 0, t.z - pos.z).normalize;
  // simple obstacle avoidance: probe ahead at knee height
  var probe := V3(pos.x, 0.5, pos.z);
  var h := FWorld.Raycast(probe, _v2, 1.8);
  if Assigned(h) and (h.T < 1.8) then begin
    _v3.&set(-_v2.z, 0, _v2.x).multiplyScalar(FStrafeDir);
    _v2.lerp(_v3, 0.85).normalize;
  end;
  FVel.x := Damp(FVel.x, _v2.x * spd, 6, dt);
  FVel.z := Damp(FVel.z, _v2.z * spd, 6, dt);
  pos.x := pos.x + FVel.x * dt; pos.z := pos.z + FVel.z * dt;
  Speed := Hypot(FVel.x, FVel.z);
  FCrouch := Damp(FCrouch, 0, 5, dt);
end;

procedure TEnemy.Combat(dt, dist: Float; sees: Boolean; player: TPlayer; audio: TAudio; effects: TEffects);
begin
  ShotTimer -= dt;
  BurstCooldown -= dt;
  if not sees or (Awareness < 0.6) or (FFlinch > 0.5) then Exit;
  if (BurstLeft <= 0) and (BurstCooldown <= 0) then BurstLeft := 3 + Floor(Rnd * 4);
  if (BurstLeft > 0) and (ShotTimer <= 0) and (Ready < 0.35) then begin
    BurstLeft -= 1;
    ShotTimer := 0.1 + Rnd * 0.04;
    if BurstLeft = 0 then BurstCooldown := 0.9 + Rnd * 1.4;
    Shoot(dist, player, audio, effects);
  end;
end;

procedure TEnemy.Shoot(dist: Float; player: TPlayer; audio: TAudio; effects: TEffects);
begin
  var mz := Muzzle.getWorldPosition(V3Zero);
  var target := player.HeadPos(V3Zero).add(V3(0, -0.35, 0));
  // hit probability
  var p := 0.42 - dist * 0.008;
  p *= if player.Moving then 0.6 else 1;
  p *= if player.Crouching then 0.75 else 1;
  p *= Awareness;
  p := MaxF(0.05, p) * player.Difficulty;
  var hit := Rnd < p;
  var dir := target.clone.sub(mz).normalize;
  if not hit then begin
    var spread := 0.02 + Rnd * 0.03;
    dir.x := dir.x + (Rnd - 0.5) * spread * 2;
    dir.y := dir.y + (Rnd - 0.3) * spread;
    dir.z := dir.z + (Rnd - 0.5) * spread * 2;
    dir.normalize;
  end;
  var h := FWorld.Raycast(mz, dir, 200);
  var e := if Assigned(h) then h.Point else mz.clone.addScaledVector(dir, 200);
  effects.Flash(mz, 25, 0.05, $ffa850, 8);
  effects.Glow.Spawn(mz, nil, 0.05).SetSize(0.35, 0.2).SetAlpha(1, 0).SetColor(4, 2.6, 1.2);
  if Rnd < 0.5 then effects.Tracer(mz, e, 300);
  audio.EnemyShot(mz);
  if hit then
    player.TakeDamage(6 + Rnd * 5, mz)
  else begin
    if Assigned(h) then begin
      effects.Impact(h.Point, h.Normal, h.Surf, dir);
      if (h.T > 3) and (h.Point.distanceTo(player.Pos) < 8) then audio.Impact(h.Point, h.Surf);
    end;
    // near miss whiz
    var pp := player.HeadPos(V3Zero);
    var toP := pp.clone.sub(mz);
    var proj := toP.dot(dir);
    if proj > 0 then begin
      var closest := mz.clone.addScaledVector(dir, proj);
      if closest.distanceTo(pp) < 2.5 then audio.Whiz(closest);
    end;
  end;
end;

procedure TEnemy.Animate(dt: Float);
begin
  var s := Speed;
  FWalkPhase += dt * (2.2 + s * 2.1);
  var k := MinF(1, s / 3.5);
  var ph := FWalkPhase;
  var crouch := FCrouch;
  // legs
  var swing := Sin(ph) * 0.7 * k;
  LegR.Upper.rotation.x := -swing - crouch * 1.2;
  LegL.Upper.rotation.x := swing - crouch * 0.4;
  LegR.Lower.rotation.x := MaxF(0, Sin(ph + 1.4)) * 1.0 * k + crouch * 1.9;
  LegL.Lower.rotation.x := MaxF(0, Sin(ph + PI + 1.4)) * 1.0 * k + crouch * 0.9;
  Hips.position.y := 0.95 - Abs(Cos(ph)) * 0.05 * k - crouch * 0.45;
  Hips.rotation.y := Sin(ph) * 0.12 * k;
  // shouldered when fighting, low ready when running without shooting
  var wantLow := if ReadyOverride >= 0 then ReadyOverride
    else if FFiringRecent then 0.0 else if s > 2.6 then 1.0 else if Awareness > 0.7 then 0.0 else 1.0;
  Ready := Damp(Ready, wantLow, 6, dt);
  var aimK := 1 - Ready;
  var pitch := AimPitch;
  // spine leans into motion, bladed stance (right shoulder back) while aiming
  Spine.rotation.x := 0.12 * k + crouch * 0.25 - pitch * 0.5 - FFlinch * 0.3 + Ready * 0.08;
  Spine.rotation.y := -Hips.rotation.y - 0.5 * aimK;
  // cheek on the stock: head drops and cants toward the rifle
  Head.rotation.&set(-pitch * 0.4 + 0.2 * aimK, 0.22 * aimK, -0.12 * aimK);
  // rifle: aim = barrel forward with the butt in the shoulder pocket, low = the source idle pose
  var aimQ := JQuaternion.Create.setFromEuler(JEuler.Create(-pitch * 0.5, 0.5, 0));
  var aimP := Pocket.clone.sub(Butt.clone.applyQuaternion(aimQ));
  Gun.quaternion.copy(aimQ);
  Gun.position.copy(aimP);
  Gun.updateMatrix;
  SolveArm(ArmR, -1, _v.copy(GripR.Pos).applyMatrix4(Gun.matrix));
  SolveArm(ArmL, 1, _v.copy(GripL.Pos).applyMatrix4(Gun.matrix));
  Retarget;
end;

procedure TEnemy.UpdateDeath(dt: Float);
begin
  DeathT += dt;
  var t := MinF(1, DeathT / (if FDeathStyle = 1 then 0.5 else 0.8));
  var e := if t < 1 then t * t * (1.8 - 0.8 * t) else 1.0;
  var fall := e * (PI / 2 - 0.08);
  Body.quaternion.setFromAxisAngle(WorldToLocalAxis(FDeathAxis), fall);
  // crumple
  LegR.Lower.rotation.x := Damp(LegR.Lower.rotation.x, 0.6 + FDeathStyle * 0.3, 6, dt);
  LegL.Lower.rotation.x := Damp(LegL.Lower.rotation.x, 0.2, 6, dt);
  Hips.position.y := Damp(Hips.position.y, 0.95 - (if FDeathStyle = 2 then 0.3 else 0), 5, dt);
  ArmR.Upper.rotation.x := Damp(ArmR.Upper.rotation.x, -2.6, 3, dt);
  ArmL.Upper.rotation.x := Damp(ArmL.Upper.rotation.x, -0.5, 3, dt);
  ArmL.Upper.rotation.z := Damp(ArmL.Upper.rotation.z, -1.2, 3, dt);
  Head.rotation.x := Damp(Head.rotation.x, 0.4, 3, dt);
  if (DeathT > 1.5) and (Gun.parent = Spine) then begin
    // drop rifle
    Gun.getWorldPosition(_v);
    FScene.add(Gun);
    Gun.position.&set(_v.x + 0.3, 0.04, _v.z);
    Gun.rotation.&set(0, Rnd * 6, PI / 2);
  end;
  if DeathT > 12 then Root.position.y := Root.position.y - dt * 0.3;
  Retarget;
end;

function TEnemy.WorldToLocalAxis(a: JVector3): JVector3;
begin
  var q := JQuaternion.Create.setFromAxisAngle(V3(0, 1, 0), -Yaw);
  Result := a.clone.applyQuaternion(q);
end;

procedure TEnemy.Dispose;
begin
  FScene.remove(Root);
  if Gun.parent = FScene then FScene.remove(Gun);
end;

initialization
  _v := V3Zero; _v2 := V3Zero; _v3 := V3Zero;
  DOWN := V3(0, -1, 0); _a := V3Zero; _b := V3Zero; _n := V3Zero;
  _q := JQuaternion.Create; _q2 := JQuaternion.Create; _qb := JQuaternion.Create; _qp := JQuaternion.Create;
  _qa := JQuaternion.Create; _qc := JQuaternion.Create;
  RIG := ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder',
    'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
end.
