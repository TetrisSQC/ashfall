unit ashfall.effects;

// Particles (instanced camera-facing quads), decals, tracers, shell casings, lights.

interface

uses
  ashfall.host, ashfall.three, ashfall.textures, ashfall.world, ashfall.audio;

type
  // one live particle; the Set* methods replace the original's spawn option object
  TParticle = class
  public
    Pos, Vel: JVector3;
    Life, Age, S0, S1, Rot, RotVel, A0, A1, FadeIn, Drag, Grav, Stretch, D: Float;
    R0, G0, B0, R1, G1, B1: Float;
    HasC1, Bounce: Boolean;
    function SetSize(a, b: Float): TParticle;
    function SetAlpha(a, b: Float): TParticle;
    function SetColor(r, g, b: Float): TParticle;
    function SetColor1(r, g, b: Float): TParticle;
    function SetDrag(v: Float): TParticle;
    function SetGravity(v: Float): TParticle;
    function SetStretch(v: Float): TParticle;
    function SetRotVel(v: Float): TParticle;
    function SetFadeIn(v: Float): TParticle;
    function SetBounce: TParticle;
  end;

  TParticleSystem = class
  private
    FMax: Integer;
    FSort: Boolean;
    FGeo: JInstancedBufferGeometry;
    FAPos, FAData, FACol, FAVel: JInstancedBufferAttribute;
    FPos, FDat, FCol, FVel: JFloat32Array;
  public
    P: array of TParticle;
    Mat: JShaderMaterial;
    Mesh: JMesh;
    constructor Create(scene: JScene; tex: JTexture; max: Integer = 1000; additive: Boolean = false; sort: Boolean = false; fog: Float = 1);
    function Spawn(pos: JVector3; vel: JVector3; life: Float): TParticle;
    procedure Update(dt: Float; camera: JCamera);
  end;

  TDecalSet = class
  public
    Im: JInstancedMesh;
    Max, Next: Integer;
  end;

  TTracer = class
  public
    Mesh: JMesh;
    Active: Boolean;
    From, Dest, Dir: JVector3;
    Len, Dist, Speed: Float;
  end;

  // shell casings and explosion debris
  TDebris = class
  public
    Mesh: JMesh;
    Active: Boolean;
    Vel, Spin: JVector3;
    Age: Float;
    Bounced: Integer;
  end;

  TFlashLight = class
  public
    Light: JPointLight;
    T, Dur, Peak: Float;
  end;

  TFireLight = class
  public
    Light: JPointLight;
    Base, Seed: Float;
  end;

  TEmitter = class
  public
    Kind: String;
    Pos: JVector3;
    Scale, Acc, GAcc: Float;
  end;

  TEffects = class
  private
    FScene: JScene;
    FWorld: TWorld;
    FAudio: TAudio;
    FDecalSets: array [String] of TDecalSet;
    FDm: JMatrix4;
    FDq: JQuaternion;
    FDs, FDp: JVector3;
    FFireLights: array of TFireLight;
    FEmitters: array of TEmitter;
    FTime: Float;
    function FloorAt(p: JVector3): Float;
  public
    Smoke, Dust, Fire, Sparks, Blood, Glow, Motes: TParticleSystem;
    Tracers: array of TTracer;
    Shells, Chunks: array of TDebris;
    FlashLights: array of TFlashLight;
    constructor Create(scene: JScene; world: TWorld; audio: TAudio);
    function Systems: array of TParticleSystem;
    procedure AddFire(pos: JVector3; scale: Float; withLight: Boolean);
    procedure AddPlume(pos: JVector3);
    procedure Flash(pos: JVector3; peak: Float = 40; dur: Float = 0.06; color: Integer = $ffb060; dist: Float = 14);
    procedure Decal(point, normal: JVector3; kind: String = 'hole'; size: Float = 0.12);
    procedure Impact(point, normal: JVector3; surf: String; dir: JVector3);
    procedure BloodHit(point, dir: JVector3);
    procedure Tracer(from, dest: JVector3; speed: Float = 380);
    procedure EjectShell(pos, vel: JVector3; quat: JQuaternion);
    procedure MuzzleSmoke(pos, dir: JVector3);
    procedure Explosion(pos: JVector3);
    procedure Update(dt: Float; camera: JCamera);
    procedure SetFog(color: JColor);
  end;

implementation

const VERT = #"
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
";

const FRAG = #"
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
";

var _v, _v2, _z: JVector3;
var _q: JQuaternion;

{ TParticle }

function TParticle.SetSize(a, b: Float): TParticle;
begin
  S0 := a; S1 := b; Result := Self;
end;

function TParticle.SetAlpha(a, b: Float): TParticle;
begin
  A0 := a; A1 := b; Result := Self;
end;

function TParticle.SetColor(r, g, b: Float): TParticle;
begin
  R0 := r; G0 := g; B0 := b; Result := Self;
end;

function TParticle.SetColor1(r, g, b: Float): TParticle;
begin
  R1 := r; G1 := g; B1 := b; HasC1 := true; Result := Self;
end;

function TParticle.SetDrag(v: Float): TParticle;
begin
  Drag := v; Result := Self;
end;

function TParticle.SetGravity(v: Float): TParticle;
begin
  Grav := v; Result := Self;
end;

function TParticle.SetStretch(v: Float): TParticle;
begin
  Stretch := v; Result := Self;
end;

function TParticle.SetRotVel(v: Float): TParticle;
begin
  RotVel := v; Result := Self;
end;

function TParticle.SetFadeIn(v: Float): TParticle;
begin
  FadeIn := v; Result := Self;
end;

function TParticle.SetBounce: TParticle;
begin
  Bounce := true; Result := Self;
end;

{ TParticleSystem }

constructor TParticleSystem.Create(scene: JScene; tex: JTexture; max: Integer = 1000; additive: Boolean = false; sort: Boolean = false; fog: Float = 1);
begin
  FMax := max;
  FSort := sort;
  var geo := JInstancedBufferGeometry.Create;
  var base := JPlaneGeometry.Create(2, 2);
  geo.index := base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  FPos := JFloat32Array.Create(max * 3);
  FDat := JFloat32Array.Create(max * 4);
  FCol := JFloat32Array.Create(max * 3);
  FVel := JFloat32Array.Create(max * 3);
  FAPos := JInstancedBufferAttribute.Create(FPos, 3);
  FAData := JInstancedBufferAttribute.Create(FDat, 4);
  FACol := JInstancedBufferAttribute.Create(FCol, 3);
  FAVel := JInstancedBufferAttribute.Create(FVel, 3);
  FAPos.setUsage(DynamicDrawUsage);
  FAData.setUsage(DynamicDrawUsage);
  FACol.setUsage(DynamicDrawUsage);
  FAVel.setUsage(DynamicDrawUsage);
  geo.setAttribute('iPos', FAPos); geo.setAttribute('iData', FAData);
  geo.setAttribute('iColor', FACol); geo.setAttribute('iVel', FAVel);
  geo.instanceCount := 0;
  Mat := JShaderMaterial.Create(class
    uniforms := class
      map := Uni(tex);
      fogColor := Uni(JColor.Create($c9b8a0));
      fogAmt := Uni(fog);
    end;
    vertexShader := VERT;
    fragmentShader := FRAG;
    transparent := true;
    depthWrite := false;
    blending: Integer := if additive then AdditiveBlending else NormalBlending;
    premultipliedAlpha := false;
  end);
  if not additive then begin
    Mat.blending := CustomBlending;
    Mat.blendSrc := SrcAlphaFactor;
    Mat.blendDst := OneMinusSrcAlphaFactor;
  end;
  Mesh := JMesh.Create(geo, Mat);
  Mesh.frustumCulled := false;
  Mesh.renderOrder := if additive then 11 else 10;
  scene.add(Mesh);
  FGeo := geo;
end;

function TParticleSystem.Spawn(pos: JVector3; vel: JVector3; life: Float): TParticle;
begin
  if P.Length >= FMax then P.Delete(0);
  var q := TParticle.Create;
  q.Pos := pos.clone;
  q.Vel := if Assigned(vel) then vel.clone else V3Zero;
  q.Life := if life <> 0 then life else 1;
  q.S0 := 1; q.S1 := 1;
  q.Rot := Rnd * PI * 2;
  q.A0 := 1; q.A1 := 0;
  q.R0 := 1; q.G0 := 1; q.B0 := 1;
  P.Add(q);
  Result := q;
end;

procedure TParticleSystem.Update(dt: Float; camera: JCamera);
begin
  for var i := P.Length - 1 downto 0 do begin
    var q := P[i];
    q.Age += dt;
    if q.Age >= q.Life then begin
      P.Delete(i);
      continue;
    end;
    q.Vel.y := q.Vel.y - q.Grav * dt;
    if q.Drag <> 0 then q.Vel.multiplyScalar(MaxF(0, 1 - q.Drag * dt));
    q.Pos.addScaledVector(q.Vel, dt);
    if q.Bounce and (q.Pos.y < 0.02) then begin
      q.Pos.y := 0.02; q.Vel.y := q.Vel.y * -0.35; q.Vel.x := q.Vel.x * 0.6; q.Vel.z := q.Vel.z * 0.6;
    end;
    q.Rot += q.RotVel * dt;
  end;
  if FSort and Assigned(camera) then begin
    var cp := camera.position;
    for var q in P do q.D := q.Pos.distanceToSquared(cp);
    P.Sort(function(a, b: TParticle): Integer
      begin
        Result := if b.D > a.D then 1 else if b.D < a.D then -1 else 0;
      end);
  end;
  var pos := FPos;
  var dat := FDat;
  var col := FCol;
  var vel := FVel;
  for var i := 0 to P.Length - 1 do begin
    var q := P[i];
    var t := q.Age / q.Life;
    pos[i * 3] := q.Pos.x; pos[i * 3 + 1] := q.Pos.y; pos[i * 3 + 2] := q.Pos.z;
    vel[i * 3] := q.Vel.x; vel[i * 3 + 1] := q.Vel.y; vel[i * 3 + 2] := q.Vel.z;
    var a := q.A0 + (q.A1 - q.A0) * t;
    if (q.FadeIn > 0) and (t < q.FadeIn) then a *= t / q.FadeIn;
    dat[i * 4] := q.S0 + (q.S1 - q.S0) * Sqrt(t); dat[i * 4 + 1] := q.Rot; dat[i * 4 + 2] := a; dat[i * 4 + 3] := q.Stretch;
    if q.HasC1 then begin
      col[i * 3] := q.R0 + (q.R1 - q.R0) * t; col[i * 3 + 1] := q.G0 + (q.G1 - q.G0) * t; col[i * 3 + 2] := q.B0 + (q.B1 - q.B0) * t;
    end else begin
      col[i * 3] := q.R0; col[i * 3 + 1] := q.G0; col[i * 3 + 2] := q.B0;
    end;
  end;
  FGeo.instanceCount := P.Length;
  FAPos.needsUpdate := true;
  FAData.needsUpdate := true;
  FACol.needsUpdate := true;
  FAVel.needsUpdate := true;
  FAPos.clearUpdateRanges;
end;

{ TEffects }

constructor TEffects.Create(scene: JScene; world: TWorld; audio: TAudio);
begin
  FScene := scene; FWorld := world; FAudio := audio;
  var smokeTex := SpriteTex('smoke');
  Smoke := TParticleSystem.Create(scene, smokeTex, 900, false, true);
  Dust := TParticleSystem.Create(scene, smokeTex, 500, false, false);
  Fire := TParticleSystem.Create(scene, SpriteTex('fire'), 500, true, false, 0.4);
  Sparks := TParticleSystem.Create(scene, SpriteTex('spark'), 600, true, false, 0.2);
  Blood := TParticleSystem.Create(scene, SpriteTex('blood'), 300);
  Glow := TParticleSystem.Create(scene, SpriteTex('glow'), 200, true, false, 0.3);
  Motes := TParticleSystem.Create(scene, SpriteTex('glow'), 400, true, false, 0.6);

  // decals
  var decalGeo := JPlaneGeometry.Create(1, 1);
  var kinds: array of String := ['hole', 'blood', 'scorch'];
  var texs: array of JTexture := [SpriteTex('hole'), SpriteTex('blood'), SpriteTex('scorch')];
  var ops: array of Float := [1, 0.9, 0.95];
  var maxs: array of Integer := [300, 80, 24];
  for var k := 0 to 2 do begin
    var mat := JMeshStandardMaterial.Create(class
      map := texs[k]; transparent := true; opacity := ops[k]; depthWrite := false;
      polygonOffset := true; polygonOffsetFactor := -4; polygonOffsetUnits := -4; roughness := 0.9;
    end);
    var im := JInstancedMesh.Create(decalGeo, mat, maxs[k]);
    im.count := 0; im.frustumCulled := false; im.receiveShadow := true; im.userData.noAO := true;
    im.instanceMatrix.setUsage(DynamicDrawUsage);
    scene.add(im);
    var ds := TDecalSet.Create;
    ds.Im := im; ds.Max := maxs[k]; ds.Next := 0;
    FDecalSets[kinds[k]] := ds;
  end;
  FDm := JMatrix4.Create; FDq := JQuaternion.Create; FDs := V3Zero; FDp := V3Zero;

  // tracers
  var tracerMat := JMeshBasicMaterial.Create(class color := Col(6, 4.2, 2.0); transparent := true; opacity := 0.9; blending := AdditiveBlending; depthWrite := false; end);
  var tracerGeo := JBoxGeometry.Create(0.018, 0.018, 1);
  for var i := 0 to 39 do begin
    var m := JMesh.Create(tracerGeo, tracerMat);
    m.visible := false; m.frustumCulled := false; scene.add(m);
    var t := TTracer.Create;
    t.Mesh := m;
    Tracers.Add(t);
  end;

  // shell casings
  var brass := JMeshStandardMaterial.Create(class color := $c8a050; metalness := 1; roughness := 0.3; end);
  var shellGeo := JCylinderGeometry.Create(0.0055, 0.0055, 0.045, 8);
  shellGeo.rotateX(PI / 2);
  for var i := 0 to 29 do begin
    var m := JMesh.Create(shellGeo, brass);
    m.visible := false; m.castShadow := true; scene.add(m);
    var s := TDebris.Create;
    s.Mesh := m; s.Vel := V3Zero; s.Spin := V3Zero;
    Shells.Add(s);
  end;

  // debris chunks for explosions / impacts
  var chunkMat := JMeshStandardMaterial.Create(class color := $777069; roughness := 0.95; end);
  var chunkGeo := JDodecahedronGeometry.Create(1, 0);
  for var i := 0 to 59 do begin
    var m := JMesh.Create(chunkGeo, chunkMat);
    m.visible := false; m.castShadow := true; scene.add(m);
    var c := TDebris.Create;
    c.Mesh := m; c.Vel := V3Zero; c.Spin := V3Zero;
    Chunks.Add(c);
  end;

  // dynamic flash lights (fixed count so shaders never recompile)
  for var i := 0 to 2 do begin
    var l := JPointLight.Create($ffb060, 0, 14, 2);
    scene.add(l);
    var f := TFlashLight.Create;
    f.Light := l; f.Dur := 0.05;
    FlashLights.Add(f);
  end;
end;

function TEffects.Systems: array of TParticleSystem;
begin
  Result := [Smoke, Dust, Fire, Sparks, Blood, Glow, Motes];
end;

procedure TEffects.AddFire(pos: JVector3; scale: Float; withLight: Boolean);
begin
  var e := TEmitter.Create;
  e.Kind := 'fire'; e.Pos := pos.clone; e.Scale := scale;
  FEmitters.Add(e);
  if withLight and (FFireLights.Length < 3) then begin
    var l := JPointLight.Create($ff7a30, 30 * scale, 16 * scale, 2);
    l.position.copy(pos).add(V3(0, 0.6, 0));
    FScene.add(l);
    var f := TFireLight.Create;
    f.Light := l; f.Base := 30 * scale; f.Seed := Rnd * 100;
    FFireLights.Add(f);
  end;
end;

procedure TEffects.AddPlume(pos: JVector3);
begin
  var e := TEmitter.Create;
  e.Kind := 'plume'; e.Pos := pos.clone;
  FEmitters.Add(e);
end;

procedure TEffects.Flash(pos: JVector3; peak: Float = 40; dur: Float = 0.06; color: Integer = $ffb060; dist: Float = 14);
begin
  var best := FlashLights[0];
  for var f in FlashLights do
    if f.T >= f.Dur then begin
      best := f;
      break;
    end;
  best.Light.position.copy(pos);
  best.Light.color.&set(color);
  best.Light.distance := dist;
  best.T := 0; best.Dur := dur; best.Peak := peak;
end;

procedure TEffects.Decal(point, normal: JVector3; kind: String = 'hole'; size: Float = 0.12);
begin
  var ds := FDecalSets[kind];
  var i := ds.Next;
  ds.Next := (ds.Next + 1) mod ds.Max;
  ds.Im.count := Max(ds.Im.count, i + 1);
  FDp.copy(point).addScaledVector(normal, 0.004 + Rnd * 0.003);
  FDq.setFromUnitVectors(_z, normal);
  _q.setFromAxisAngle(_z, Rnd * PI * 2);
  FDq.multiply(_q);
  FDs.setScalar(size * (0.8 + Rnd * 0.4));
  FDm.compose(FDp, FDq, FDs);
  ds.Im.setMatrixAt(i, FDm);
  ds.Im.instanceMatrix.needsUpdate := true;
end;

procedure TEffects.Impact(point, normal: JVector3; surf: String; dir: JVector3);
begin
  var refl := dir.clone.reflect(normal);
  var br, bg, bb: Float;
  case surf of
    'concrete': begin br := 0.62; bg := 0.6; bb := 0.56; end;
    'asphalt': begin br := 0.3; bg := 0.29; bb := 0.28; end;
    'metal': begin br := 0.4; bg := 0.4; bb := 0.4; end;
    'wood': begin br := 0.55; bg := 0.42; bb := 0.28; end;
    'cloth': begin br := 0.6; bg := 0.53; bb := 0.38; end;
    'dirt': begin br := 0.45; bg := 0.38; bb := 0.28; end;
  else
    br := 0.6; bg := 0.58; bb := 0.54;
  end;
  // dust puff
  for var i := 0 to 4 do begin
    _v.copy(normal).multiplyScalar(1 + Rnd * 2).add(refl.clone.multiplyScalar(Rnd)).add(_v2.&set(Rnd - 0.5, Rnd - 0.3, Rnd - 0.5).multiplyScalar(0.8));
    Dust.Spawn(point, _v, 0.9 + Rnd * 0.9).SetSize(0.05, 0.45 + Rnd * 0.4).SetAlpha(0.55, 0)
      .SetColor(br * 1.3, bg * 1.3, bb * 1.3).SetDrag(3.5).SetGravity(-0.15).SetRotVel((Rnd - 0.5) * 1.2);
  end;
  // chips
  var chips := if surf = 'metal' then 0 else 5;
  for var i := 0 to chips - 1 do begin
    _v.copy(normal).multiplyScalar(2 + Rnd * 3).add(_v2.&set(Rnd - 0.5, Rnd, Rnd - 0.5).multiplyScalar(3));
    Dust.Spawn(point, _v, 0.6).SetSize(0.02, 0.015).SetAlpha(1, 1).SetColor(br * 0.5, bg * 0.5, bb * 0.5)
      .SetGravity(9.8).SetDrag(0.5).SetBounce;
  end;
  // sparks for metal & concrete
  var sparkCount := if surf = 'metal' then 12 else if (surf = 'concrete') or (surf = 'asphalt') then 3 else 0;
  for var i := 0 to sparkCount - 1 do begin
    _v.copy(refl).multiplyScalar(3 + Rnd * 6).add(_v2.&set(Rnd - 0.5, Rnd - 0.2, Rnd - 0.5).multiplyScalar(5));
    Sparks.Spawn(point, _v, 0.15 + Rnd * 0.3).SetSize(0.012, 0.006).SetAlpha(1, 0.2).SetColor(4, 2.4, 1.0)
      .SetGravity(9.8).SetStretch(3);
  end;
  if surf = 'metal' then
    Glow.Spawn(point.clone.addScaledVector(normal, 0.02), nil, 0.06).SetSize(0.25, 0.1).SetAlpha(1, 0).SetColor(4, 2.8, 1.5);
  Decal(point, normal, 'hole', if surf = 'metal' then 0.07 else 0.12);
end;

procedure TEffects.BloodHit(point, dir: JVector3);
begin
  for var i := 0 to 5 do begin
    _v.copy(dir).multiplyScalar(1 + Rnd * 2.5).add(_v2.&set(Rnd - 0.5, Rnd * 0.8, Rnd - 0.5).multiplyScalar(1.6));
    Blood.Spawn(point, _v, 0.35 + Rnd * 0.4).SetSize(0.08, 0.35).SetAlpha(0.95, 0).SetColor(0.55, 0.05, 0.03)
      .SetGravity(4).SetDrag(2);
  end;
  // splatter on nearby wall behind target
  var h := FWorld.Raycast(point, dir, 2.5);
  if Assigned(h) then Decal(h.Point, h.Normal, 'blood', 0.5 + Rnd * 0.4);
end;

procedure TEffects.Tracer(from, dest: JVector3; speed: Float = 380);
begin
  var t := Tracers[0];
  for var x in Tracers do
    if not x.Active then begin
      t := x;
      break;
    end;
  t.Active := true; t.From := from.clone; t.Dest := dest.clone;
  t.Len := from.distanceTo(dest); t.Dist := 0; t.Speed := speed;
  t.Dir := dest.clone.sub(from).normalize;
  t.Mesh.visible := true;
  t.Mesh.quaternion.setFromUnitVectors(_z, t.Dir);
end;

procedure TEffects.EjectShell(pos, vel: JVector3; quat: JQuaternion);
begin
  var s := Shells[0];
  for var x in Shells do
    if not x.Active then begin
      s := x;
      break;
    end;
  s.Active := true; s.Age := 0; s.Bounced := 0;
  s.Mesh.visible := true; s.Mesh.position.copy(pos); s.Mesh.quaternion.copy(quat);
  s.Vel.copy(vel); s.Spin.&set((Rnd - 0.5) * 30, (Rnd - 0.5) * 30, (Rnd - 0.5) * 30);
end;

procedure TEffects.MuzzleSmoke(pos, dir: JVector3);
begin
  if Rnd < 0.5 then
    Smoke.Spawn(pos, dir.clone.multiplyScalar(0.6 + Rnd).add(_v.&set(0, 0.3, 0)), 0.7 + Rnd * 0.5).SetSize(0.04, 0.3)
      .SetAlpha(0.08, 0).SetColor(0.45, 0.44, 0.42).SetDrag(2);
end;

procedure TEffects.Explosion(pos: JVector3);
begin
  Flash(pos.clone.add(_v.&set(0, 1, 0)), 900, 0.35, $ffa050, 40);
  for var i := 0 to 39 do begin
    _v.&set(Rnd - 0.5, Rnd * 0.9, Rnd - 0.5).normalize.multiplyScalar(2 + Rnd * 8);
    Fire.Spawn(pos.clone.add(_v2.&set(0, 0.3, 0)), _v, 0.35 + Rnd * 0.4).SetSize(0.6, 2.2 + Rnd * 1.2).SetAlpha(1, 0)
      .SetColor(3, 1.5, 0.6).SetColor1(1.2, 0.3, 0.05).SetDrag(5).SetGravity(-2);
  end;
  for var i := 0 to 25 do begin
    _v.&set(Rnd - 0.5, Rnd * 0.8 + 0.2, Rnd - 0.5).normalize.multiplyScalar(1.5 + Rnd * 4);
    Smoke.Spawn(pos.clone.add(_v2.&set(0, 0.5, 0)), _v, 4 + Rnd * 3).SetSize(0.8, 4 + Rnd * 2.5).SetAlpha(0.75, 0).SetFadeIn(0.05)
      .SetColor(0.28, 0.26, 0.24).SetColor1(0.55, 0.52, 0.48).SetDrag(1.6).SetGravity(-0.35).SetRotVel((Rnd - 0.5) * 0.6);
  end;
  for var i := 0 to 49 do begin
    _v.&set(Rnd - 0.5, Rnd * 0.9 + 0.1, Rnd - 0.5).normalize.multiplyScalar(8 + Rnd * 16);
    Sparks.Spawn(pos.clone.add(_v2.&set(0, 0.3, 0)), _v, 0.5 + Rnd * 0.8).SetSize(0.03, 0.01).SetAlpha(1, 0.4)
      .SetColor(4, 2.2, 0.8).SetGravity(9.8).SetStretch(2.5).SetDrag(0.6);
  end;
  for var i := 0 to 15 do begin
    var c := Chunks[i];
    for var x in Chunks do
      if not x.Active then begin
        c := x;
        break;
      end;
    c.Active := true; c.Age := 0; c.Mesh.visible := true;
    c.Mesh.position.copy(pos).add(_v.&set(0, 0.2, 0));
    c.Mesh.scale.setScalar(0.03 + Rnd * 0.08);
    c.Vel.&set(Rnd - 0.5, Rnd * 0.8 + 0.4, Rnd - 0.5).normalize.multiplyScalar(5 + Rnd * 9);
    c.Spin.&set(Rnd * 20, Rnd * 20, Rnd * 20);
  end;
  // ground dust ring
  for var i := 0 to 17 do begin
    var a := (i / 18) * PI * 2;
    Dust.Spawn(pos.clone.add(_v2.&set(0, 0.2, 0)), _v.&set(Cos(a) * 9, 0.4, Sin(a) * 9), 2.2).SetSize(0.5, 2.8).SetAlpha(0.55, 0)
      .SetColor(0.6, 0.55, 0.47).SetDrag(2.5);
  end;
  Decal(pos.clone.setY(MaxF(pos.y, 0.0) + 0.01), V3(0, 1, 0), 'scorch', 3.5);
end;

procedure TEffects.Update(dt: Float; camera: JCamera);
begin
  FTime += dt;
  // emitters
  for var e in FEmitters do begin
    if e.Kind = 'fire' then begin
      e.Acc += dt * 110 * e.Scale;
      e.GAcc += dt;
      if e.GAcc > 0.06 then begin
        e.GAcc := 0;
        Glow.Spawn(e.Pos.clone.add(_v2.&set(0, 0.35 * e.Scale, 0)), nil, 0.12).SetSize(1.9 * e.Scale, 2.1 * e.Scale)
          .SetAlpha(0.22 + Rnd * 0.08, 0.2).SetColor(2.2, 0.9, 0.3);
      end;
      while e.Acc > 1 do begin
        e.Acc -= 1;
        var s := e.Scale;
        _v2.&set((Rnd - 0.5) * 0.7 * s, 0, (Rnd - 0.5) * 0.7 * s);
        var r := Rnd;
        _v2.multiplyScalar(0.6 + (1 - r) * 0.6);
        Fire.Spawn(e.Pos.clone.add(_v2), _v.&set((Rnd - 0.5) * 0.4, 0.9 + r * 2.2, (Rnd - 0.5) * 0.4).multiplyScalar(s), 0.3 + Rnd * 0.5)
          .SetSize((0.16 + Rnd * 0.16) * s, 0.03 * s).SetAlpha(0.55, 0).SetFadeIn(0.15).SetColor(3.6, 1.7, 0.55)
          .SetColor1(1.6, 0.32, 0.04).SetRotVel((Rnd - 0.5) * 4).SetDrag(0.8);
        if Rnd < 0.13 then
          Smoke.Spawn(e.Pos.clone.add(_v2).add(_v.&set(0, 1.0 * s, 0)), _v.&set(0.35 + Rnd * 0.3, 1.4 + Rnd, 0.1).multiplyScalar(s), 5 + Rnd * 3)
            .SetSize(0.4 * s, 3.2 * s).SetAlpha(0.55, 0).SetFadeIn(0.1).SetColor(0.09, 0.085, 0.08).SetColor1(0.32, 0.3, 0.28)
            .SetDrag(0.25).SetRotVel((Rnd - 0.5) * 0.4);
        if Rnd < 0.08 then
          Sparks.Spawn(e.Pos.clone.add(_v2), _v.&set((Rnd - 0.5) * 1.5, 2 + Rnd * 2.5, (Rnd - 0.5) * 1.5), 1.2 + Rnd)
            .SetSize(0.012, 0.005).SetAlpha(1, 0).SetColor(3, 1.4, 0.4).SetGravity(-0.2).SetDrag(0.5).SetStretch(1);
      end;
    end else if e.Kind = 'plume' then begin
      e.Acc += dt * 5;
      while e.Acc > 1 do begin
        e.Acc -= 1;
        Smoke.Spawn(e.Pos.clone.add(_v2.&set((Rnd - 0.5) * 6, Rnd * 4, (Rnd - 0.5) * 6)), _v.&set(1.8 + Rnd, 3.5 + Rnd * 2, 0.4), 22)
          .SetSize(6, 34).SetAlpha(0.5, 0).SetFadeIn(0.05).SetColor(0.14, 0.13, 0.12).SetColor1(0.5, 0.47, 0.44)
          .SetDrag(0.02).SetRotVel((Rnd - 0.5) * 0.1);
      end;
    end;
  end;
  // ambient floating ash/dust motes around camera
  if Assigned(camera) and (Rnd < dt * 30) then begin
    var cp := camera.position;
    Motes.Spawn(_v.&set(cp.x + (Rnd - 0.5) * 16, cp.y + Rnd * 5 - 1, cp.z + (Rnd - 0.5) * 16), _v2.&set(0.25 + Rnd * 0.2, -0.08, (Rnd - 0.5) * 0.2), 7)
      .SetSize(0.012, 0.012).SetColor(1.6, 1.3, 0.9).SetAlpha(0.7, 0).SetFadeIn(0.2);
  end;

  // flash lights
  for var f in FlashLights do begin
    f.T += dt;
    var k := if f.T < f.Dur then 1 - f.T / f.Dur else 0.0;
    f.Light.intensity := f.Peak * k * k;
  end;
  for var f in FFireLights do begin
    var t := FTime * 9 + f.Seed;
    f.Light.intensity := f.Base * (0.75 + 0.18 * Sin(t) + 0.12 * Sin(t * 2.7 + 1.3) + 0.08 * Rnd);
  end;
  // tracers
  for var t in Tracers do begin
    if not t.Active then continue;
    t.Dist += t.Speed * dt;
    var segLen := MinF(4, t.Len);
    if t.Dist - segLen > t.Len then begin
      t.Active := false; t.Mesh.visible := false; continue;
    end;
    var head := MinF(t.Dist, t.Len);
    var tail := MaxF(0, t.Dist - segLen);
    var mid := (head + tail) / 2;
    t.Mesh.position.copy(t.From).addScaledVector(t.Dir, mid);
    t.Mesh.scale.&set(1, 1, MaxF(0.01, head - tail));
  end;
  // shells
  for var s in Shells do begin
    if not s.Active then continue;
    s.Age += dt;
    s.Vel.y := s.Vel.y - 9.8 * dt;
    s.Mesh.position.addScaledVector(s.Vel, dt);
    s.Mesh.rotation.x := s.Mesh.rotation.x + s.Spin.x * dt;
    s.Mesh.rotation.y := s.Mesh.rotation.y + s.Spin.y * dt;
    s.Mesh.rotation.z := s.Mesh.rotation.z + s.Spin.z * dt;
    var fl := FloorAt(s.Mesh.position);
    if s.Mesh.position.y < fl + 0.006 then begin
      s.Mesh.position.y := fl + 0.006;
      if Abs(s.Vel.y) > 0.6 then begin
        if (s.Bounced < 2) and Assigned(FAudio) then FAudio.Shell(s.Mesh.position);
        s.Bounced += 1;
      end;
      s.Vel.y := Abs(s.Vel.y) * 0.3; s.Vel.x := s.Vel.x * 0.5; s.Vel.z := s.Vel.z * 0.5; s.Spin.multiplyScalar(0.5);
      if s.Vel.y < 0.2 then begin
        s.Vel.&set(0, 0, 0); s.Spin.&set(0, 0, 0); s.Mesh.rotation.x := 0;
      end;
    end;
    if s.Age > 6 then begin
      s.Active := false; s.Mesh.visible := false;
    end;
  end;
  for var c in Chunks do begin
    if not c.Active then continue;
    c.Age += dt;
    c.Vel.y := c.Vel.y - 9.8 * dt;
    c.Mesh.position.addScaledVector(c.Vel, dt);
    c.Mesh.rotation.x := c.Mesh.rotation.x + c.Spin.x * dt;
    c.Mesh.rotation.y := c.Mesh.rotation.y + c.Spin.y * dt;
    var fl := FloorAt(c.Mesh.position);
    if c.Mesh.position.y < fl + c.Mesh.scale.x * 0.5 then begin
      c.Mesh.position.y := fl + c.Mesh.scale.x * 0.5;
      c.Vel.y := c.Vel.y * -0.3; c.Vel.x := c.Vel.x * 0.6; c.Vel.z := c.Vel.z * 0.6; c.Spin.multiplyScalar(0.6);
    end;
    if c.Age > 8 then begin
      c.Active := false; c.Mesh.visible := false;
    end;
  end;
  Smoke.Update(dt, camera); Dust.Update(dt, camera); Fire.Update(dt, camera);
  Sparks.Update(dt, camera); Blood.Update(dt, camera); Glow.Update(dt, camera); Motes.Update(dt, camera);
end;

// top surface below a point (cheap)
function TEffects.FloorAt(p: JVector3): Float;
begin
  var y := 0.0;
  for var c in FWorld.Colliders do begin
    if (p.x < c.Min.x) or (p.x > c.Max.x) or (p.z < c.Min.z) or (p.z > c.Max.z) then continue;
    if (c.Max.y <= p.y + 0.05) and (c.Max.y > y) then y := c.Max.y;
  end;
  Result := y;
end;

procedure TEffects.SetFog(color: JColor);
begin
  for var s in Systems do JColor(s.Mat.uniforms['fogColor'].value).copy(color);
end;

initialization
  _v := V3Zero;
  _v2 := V3Zero;
  _z := V3(0, 0, 1);
  _q := JQuaternion.Create;
end.
