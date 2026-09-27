unit ashfall.world;

// Urban warzone level: streets, facades with recessed windows, cover props, rubble,
// skyline. Static geometry is merged per material and per spatial cell so draw calls stay
// low while frustum culling still works. Collision is a flat list of AABBs.

interface

uses
  ashfall.host, ashfall.three, ashfall.textures;

type
  TRandFunc = function: Float;
  TProgressProc = procedure(p: Float; text: String);

  TCollider = class
  public
    Min, Max: JVector3;
    Surf: String;
    constructor Create(amin, amax: JVector3; asurf: String);
  end;

  THit = class
  public
    T: Float;
    Point, Normal: JVector3;
    Surf: String;
    Collider: TCollider;
  end;

  TFire = class
  public
    Pos: JVector3;
    Scale: Float;
    constructor Create(apos: JVector3; ascale: Float);
  end;

  // placement options for World.Box / World.Mesh (the original's option objects)
  TBoxOpts = class
  public
    Parent: JMatrix4;
    WorldUV, Collide: Boolean;
    UVScale, RX, RY, RZ: Float;
    Surf: String;
    constructor Create;
    function NoUV: TBoxOpts;
    function UV(s: Float): TBoxOpts;
    function Rot(ax, ay, az: Float): TBoxOpts;
    function Coll: TBoxOpts;
  end;

  TGeoGroup = class
  public
    Mat: String;
    Geos: array of JBufferGeometry;
  end;

  TStyle = class
  public
    Wall, Trim: String;
    FloorH: Float;
    constructor Create(awall, atrim: String; afloorH: Float);
  end;

  TWorld = class
  private
    FGroups: array [String] of TGeoGroup;
    FGroupKeys: array of String;
    FCarBody, FCarGlass, FCarRoof: JBufferGeometry;
    procedure Std(key: String; tex: TPBRMaps; s: Float; metal: Boolean = false);
    procedure MakeMaterial(i: Integer);
    procedure FinishMaterials;
    procedure Finalize;
    procedure Ground;
    procedure Buildings;
    procedure Building(fx, fz, rot, W, D: Float; floors: Integer; st: TStyle; corner: Integer = 0);
    procedure Facade(T: JMatrix4; W: Float; floors: Integer; st: TStyle; gf, fh, H: Float);
    procedure RubblePile(x, z, radius: Float; count: Integer; height: Float);
    procedure Props;
    procedure Car(x, z, ry: Float; paint: String; burnt: Boolean);
    procedure Litter;
    procedure Tree(x, z: Float);
    procedure CoverFor(x, z, ry: Float);
    procedure Jersey(x, z, ry: Float);
    procedure Sandbags(x, z, ry: Float; n: Integer);
    procedure Container(x, z, ry: Float; mat: String; y: Float = 0);
    procedure Crate(x, z: Float; stack: Integer);
    procedure Barrel(x, z: Float; mat: String; burning: Boolean);
    procedure Lamp(x, z, dir: Float);
    function Pole(x, z: Float): JVector3;
    procedure Wire(a, b: JVector3; sag: Float);
    procedure TrafficLight(x, z, sx, sz: Float);
    procedure Skyline;
    procedure Bounds;
  public
    Scene: JScene;
    Colliders: array of TCollider;
    CoverPoints: array of JVector3;
    Fires: array of TFire;
    SmokeStacks: array of JVector3;
    Mats: array [String] of JMeshStandardMaterial;
    Progress: TProgressProc;
    Rand: TRandFunc;
    constructor Create(ascene: JScene; aprogress: TProgressProc);
    procedure Build(done: TProc);
    procedure Add(geo: JBufferGeometry; matKey: String; matrix: JMatrix4; o: TBoxOpts = nil);
    procedure Box(x, y, z, w, h, d: Float; mat: String; o: TBoxOpts = nil);
    procedure ColliderFromBox(w, h, d: Float; matrix: JMatrix4; surf: String);
    procedure Collider(minX, minY, minZ, maxX, maxY, maxZ: Float; surf: String = 'concrete');
    procedure Mesh(geo: JBufferGeometry; mat: String; x, y, z: Float; rx: Float = 0; ry: Float = 0; rz: Float = 0;
      sx: Float = 1; sy: Float = 1; sz: Float = 1; parent: JMatrix4 = nil; opts: TBoxOpts = nil);
    function Raycast(origin, dir: JVector3; maxDist: Float = 500): THit;
    function LineOfSight(a, b: JVector3): Boolean;
    function Collide(pos, vel: JVector3; radius, height: Float; stepUp: Float = 0.45): Boolean;
  end;

function Rng(seed: Integer): TRandFunc;
function Opt: TBoxOpts;
function Par(T: JMatrix4): TBoxOpts;

implementation

const CELL = 40;
const MAT_STEPS = 22;
const MAT_KEYS: array [0..MAT_STEPS - 1] of String = ('asphalt', 'sidewalk', 'concrete', 'concreteDark', 'brick', 'brick2',
  'plaster', 'plaster2', 'plaster3', 'containerRed', 'containerBlue', 'containerGreen', 'shutter', 'wood', 'cloth', 'dirt',
  'carA', 'carB', 'carC', 'burnt', 'metal', 'roof');

var _m: JMatrix4;
var _q: JQuaternion;
var _s, _p: JVector3;
var _e: JEuler;

// mulberry32
function Rng(seed: Integer): TRandFunc;
begin
  var s := seed;
  Result := function: Float
  begin
    s := s or 0;
    s := (s + $6D2B79F5) or 0;
    var t := IMul(s xor (s shr 15), 1 or s);
    t := (t + IMul(t xor (t shr 7), 61 or t)) xor t;
    var u := t xor (t shr 14);
    if u < 0 then u := u + 4294967296;
    Result := u / 4294967296;
  end;
end;

function YRot(x, y, z, ry: Float): JMatrix4;
begin
  Result := JMatrix4.Create.compose(V3(x, y, z), JQuaternion.Create.setFromAxisAngle(V3(0, 1, 0), ry), V3(1, 1, 1));
end;

function Translated(T: JMatrix4; x, y, z: Float): JMatrix4;
begin
  Result := JMatrix4.Create.multiplyMatrices(T, JMatrix4.Create.makeTranslation(x, y, z));
end;

{ TCollider / TFire / TStyle }

constructor TCollider.Create(amin, amax: JVector3; asurf: String);
begin
  Min := amin; Max := amax; Surf := asurf;
end;

constructor TFire.Create(apos: JVector3; ascale: Float);
begin
  Pos := apos; Scale := ascale;
end;

constructor TStyle.Create(awall, atrim: String; afloorH: Float);
begin
  Wall := awall; Trim := atrim; FloorH := afloorH;
end;

{ TBoxOpts }

constructor TBoxOpts.Create;
begin
  WorldUV := true;
  Surf := 'concrete';
end;

function TBoxOpts.NoUV: TBoxOpts;
begin
  WorldUV := false;
  Result := Self;
end;

function TBoxOpts.UV(s: Float): TBoxOpts;
begin
  UVScale := s;
  Result := Self;
end;

function TBoxOpts.Rot(ax, ay, az: Float): TBoxOpts;
begin
  RX := ax; RY := ay; RZ := az;
  Result := Self;
end;

function TBoxOpts.Coll: TBoxOpts;
begin
  Collide := true;
  Result := Self;
end;

function Opt: TBoxOpts;
begin
  Result := TBoxOpts.Create;
end;

function Par(T: JMatrix4): TBoxOpts;
begin
  Result := TBoxOpts.Create;
  Result.Parent := T;
end;

{ TWorld }

constructor TWorld.Create(ascene: JScene; aprogress: TProgressProc);
begin
  Scene := ascene;
  Progress := aprogress;
  Rand := Rng(1337);
end;

// ---------------------------------------------------------------- materials
procedure TWorld.Std(key: String; tex: TPBRMaps; s: Float; metal: Boolean = false);
begin
  var m := JMeshStandardMaterial.Create(class
    map := tex.Map; normalMap := tex.NormalMap; roughnessMap := tex.RoughnessMap;
    roughness := 1; metalness := 0;
  end);
  if metal then begin
    m.metalnessMap := tex.MetalnessMap;
    m.metalness := 1;
  end;
  m.normalScale := JVector2.Create(1, 1);
  m.userData.scale := s;
  Mats[key] := m;
end;

procedure TWorld.MakeMaterial(i: Integer);
begin
  case i of
    0: Std('asphalt', GenAsphalt, 7);
    1: Std('sidewalk', GenSidewalk, 3);
    2: Std('concrete', GenConcreteWall(1024, $bab4a8), 4);
    3: Std('concreteDark', GenConcreteWall(512, $8a867e), 3);
    4: Std('brick', GenBrick(1024, $8e4a35), 1.8);
    5: Std('brick2', GenBrick(1024, $6e5a4c), 1.8);
    6: Std('plaster', GenPlaster(1024, $cdb898), 5);
    7: Std('plaster2', GenPlaster(1024, $9fa6a3), 5);
    8: Std('plaster3', GenPlaster(1024, $c49a6a), 5);
    9: Std('containerRed', GenCorrugated(512, $7c2f22), 3.6, true);
    10: Std('containerBlue', GenCorrugated(512, $2b4b6b), 3.6, true);
    11: Std('containerGreen', GenCorrugated(512, $3f5a3c), 3.6, true);
    12: Std('shutter', GenCorrugated(512, $8d8f8a), 2.4, true);
    13: Std('wood', GenWood(512, $9a7a52), 1.4);
    14: Std('cloth', GenCloth(512, $9a8a64), 0.8);
    15: Std('dirt', GenDirt, 6);
    16: Std('carA', GenCarPaint(512, $5d6450), 2, true);
    17: Std('carB', GenCarPaint(512, $7a2a22), 2, true);
    18: Std('carC', GenCarPaint(512, $b9b6ad), 2, true);
    19: Std('burnt', GenCarPaint(512, $1d1a18), 2, true);
    20: Std('metal', GenGunMetal(256, $3a3c3e, 0.55), 1, true);
    21: Std('roof', GenRoof, 4);
  end;
end;

procedure TWorld.FinishMaterials;

  procedure Put(key: String; m: JMeshStandardMaterial; scale: Float = 1);
  begin
    m.userData.scale := scale;
    Mats[key] := m;
  end;

begin
  Put('glass', JMeshStandardMaterial.Create(class color := $1a1f24; roughness := 0.04; metalness := 1.0; envMapIntensity := 1.4; end));
  Put('glassDirty', JMeshStandardMaterial.Create(class color := $3a3e3c; roughness := 0.35; metalness := 0.8; end));
  Put('frame', JMeshStandardMaterial.Create(class color := $2e2c29; roughness := 0.6; metalness := 0.3; end));
  Mats['trim'] := Mats['concrete'];
  Put('rubber', JMeshStandardMaterial.Create(class color := $151515; roughness := 0.92; end));
  Put('paintWhite', JMeshStandardMaterial.Create(class color := $d8d4c8; roughness := 0.75; transparent := true; opacity := 0.85; polygonOffset := true; polygonOffsetFactor := -2; end));
  Put('paintYellow', JMeshStandardMaterial.Create(class color := $c9a13a; roughness := 0.75; transparent := true; opacity := 0.85; polygonOffset := true; polygonOffsetFactor := -2; end));
  var winTex := SpriteTex('window');
  Put('interior', JMeshStandardMaterial.Create(class map := winTex; roughness := 1; color := $c8bdb0; end));
  Put('interiorLit', JMeshStandardMaterial.Create(class map := winTex; roughness := 1; color := $201810; emissive := $ffa860; emissiveIntensity := 0.9; emissiveMap := winTex; end));
  Put('light', JMeshStandardMaterial.Create(class color := $d8d0c0; emissive := $ffd9a0; emissiveIntensity := 0.15; roughness := 0.1; end));
  Put('redLight', JMeshStandardMaterial.Create(class color := $400000; emissive := $ff2010; emissiveIntensity := 1.2; end));
  Put('wire', JMeshStandardMaterial.Create(class color := $111111; roughness := 0.7; end));
  Put('skyline', JMeshStandardMaterial.Create(class map := SkylineTex; color := $b0a898; roughness := 1; end), 22);
  for var i := 0 to SIGN_COUNT - 1 do
    Put('sign' + IntStr(i), JMeshStandardMaterial.Create(class map := SignTex(i); roughness := 0.65; metalness := 0.15; end));
  for var i := 0 to 5 do
    Put('graf' + IntStr(i), JMeshStandardMaterial.Create(class map := GraffitiTex(i); roughness := 0.85; transparent := true; depthWrite := false; polygonOffset := true; polygonOffsetFactor := -3; end));
  for var i := 0 to 3 do
    Put('poster' + IntStr(i), JMeshStandardMaterial.Create(class map := PosterTex(i); roughness := 0.9; alphaTest := 0.5; polygonOffset := true; polygonOffsetFactor := -2; end));
  Put('leaves', JMeshStandardMaterial.Create(class map := LeafTex; alphaTest := 0.45; side := DoubleSide; roughness := 0.8; end));
  Put('paper', JMeshStandardMaterial.Create(class map := PaperTex; side := DoubleSide; roughness := 0.9; end));
  Put('trashbag', JMeshStandardMaterial.Create(class color := $141516; roughness := 0.32; metalness := 0.1; end));
  var bark := GenWood(256, $4a3a2c);
  Put('bark', JMeshStandardMaterial.Create(class map := bark.Map; normalMap := bark.NormalMap; roughness := 0.95; end), 1.2);
end;

// ---------------------------------------------------------------- geometry helpers
procedure TWorld.Add(geo: JBufferGeometry; matKey: String; matrix: JMatrix4; o: TBoxOpts = nil);
begin
  var g := if Assigned(geo.index) then geo.toNonIndexed else geo.clone;
  for var k in ObjectKeys(g.attributes) do
    if (k <> 'position') and (k <> 'normal') and (k <> 'uv') then g.deleteAttribute(k);
  if not Assigned(g.attributes.uv) then
    g.setAttribute('uv', JBufferAttribute.Create(JFloat32Array.Create(g.attributes.position.count * 2), 2));
  g.clearGroups;
  if Assigned(matrix) then g.applyMatrix4(matrix);
  var mat := Mats[matKey];
  if (o = nil) or o.WorldUV then begin
    var s := 1.0;
    if Assigned(o) and (o.UVScale <> 0) then s := o.UVScale
    else if mat.userData.scale then s := mat.userData.scale;
    var p := g.attributes.position;
    var n := g.attributes.normal;
    var uv := g.attributes.uv;
    for var i := 0 to p.count - 1 do begin
      var nx := Abs(n.getX(i));
      var ny := Abs(n.getY(i));
      var nz := Abs(n.getZ(i));
      var x := p.getX(i);
      var y := p.getY(i);
      var z := p.getZ(i);
      if (ny >= nx) and (ny >= nz) then uv.setXY(i, x / s, z / s)
      else if nx >= nz then uv.setXY(i, (if n.getX(i) > 0 then -z else z) / s, y / s)
      else uv.setXY(i, (if n.getZ(i) > 0 then x else -x) / s, y / s);
    end;
  end;
  g.computeBoundingBox;
  var c := g.boundingBox.getCenter(_p);
  var key := matKey + '|' + IntStr(Floor(c.x / CELL)) + ',' + IntStr(Floor(c.z / CELL));
  var grp := FGroups[key];
  if grp = nil then begin
    grp := TGeoGroup.Create;
    grp.Mat := matKey;
    FGroups[key] := grp;
    FGroupKeys.Add(key);
  end;
  grp.Geos.Add(g);
end;

// axis-aligned (optionally y-rotated) box. x,y,z = center
procedure TWorld.Box(x, y, z, w, h, d: Float; mat: String; o: TBoxOpts = nil);
begin
  if o = nil then o := Opt;
  var g := JBoxGeometry.Create(w, h, d);
  _e.&set(o.RX, o.RY, o.RZ);
  _m.compose(_p.&set(x, y, z), _q.setFromEuler(_e), _s.&set(1, 1, 1));
  if Assigned(o.Parent) then _m.premultiply(o.Parent);
  Add(g, mat, _m, o);
  if o.Collide then ColliderFromBox(w, h, d, _m.clone, o.Surf);
end;

procedure TWorld.ColliderFromBox(w, h, d: Float; matrix: JMatrix4; surf: String);
begin
  var b := JBox3.Create(V3(-w / 2, -h / 2, -d / 2), V3(w / 2, h / 2, d / 2));
  b.applyMatrix4(matrix);
  Colliders.Add(TCollider.Create(b.min, b.max, surf));
end;

procedure TWorld.Collider(minX, minY, minZ, maxX, maxY, maxZ: Float; surf: String = 'concrete');
begin
  Colliders.Add(TCollider.Create(V3(minX, minY, minZ), V3(maxX, maxY, maxZ), surf));
end;

procedure TWorld.Mesh(geo: JBufferGeometry; mat: String; x, y, z: Float; rx: Float = 0; ry: Float = 0; rz: Float = 0;
  sx: Float = 1; sy: Float = 1; sz: Float = 1; parent: JMatrix4 = nil; opts: TBoxOpts = nil);
begin
  _e.&set(rx, ry, rz);
  _m.compose(_p.&set(x, y, z), _q.setFromEuler(_e), _s.&set(sx, sy, sz));
  if Assigned(parent) then _m.premultiply(parent);
  Add(geo, mat, _m, opts);
end;

procedure TWorld.Finalize;
begin
  for var key in FGroupKeys do begin
    var grp := FGroups[key];
    var merged := MergeGeometries(grp.Geos, false);
    merged.computeBoundingSphere;
    var mat := Mats[grp.Mat];
    var m := JMesh.Create(merged, mat);
    var noShadow := (grp.Mat = 'paintWhite') or (grp.Mat = 'paintYellow') or (grp.Mat = 'skyline');
    m.castShadow := (not noShadow) and (not mat.transparent);
    m.receiveShadow := grp.Mat <> 'skyline';
    m.matrixAutoUpdate := false;
    Scene.add(m);
    for var g in grp.Geos do g.dispose;
  end;
  FGroups.Clear;
  FGroupKeys.Clear;
end;

// ---------------------------------------------------------------- level
procedure TWorld.Build(done: TProc);
begin
  var steps: array of TProc;
  for var i := 0 to MAT_STEPS - 1 do
    steps.Add(procedure
    begin
      MakeMaterial(i);
      Progress(0.05 + (i / MAT_STEPS) * 0.6, 'GENERATING MATERIALS ' + #$00B7 + ' ' + UpperCase(MAT_KEYS[i]));
    end);
  steps.Add(procedure
  begin
    FinishMaterials;
    Progress(0.7, 'CONSTRUCTING DISTRICT');
  end);
  steps.Add(procedure
  begin
    Ground;
    Buildings;
    Progress(0.8, 'PLACING COVER');
  end);
  steps.Add(procedure
  begin
    Props;
    Skyline;
    Bounds;
    Progress(0.88, 'MERGING GEOMETRY');
  end);
  steps.Add(procedure
  begin
    Finalize;
    done();
  end);
  RunSteps(steps);
end;

procedure TWorld.Ground;

  procedure SW(x0, x1, z0, z1: Float);
  begin
    var cx := (x0 + x1) / 2;
    var cz := (z0 + z1) / 2;
    Box(cx, 0.075, cz, x1 - x0, 0.15, z1 - z0, 'sidewalk', Opt.Coll);
  end;

  procedure CurbAlongZ(x, z0, z1: Float);
  begin
    Box(x, 0.08, (z0 + z1) / 2, 0.25, 0.16, z1 - z0, 'concreteDark');
  end;

  procedure CurbAlongX(z, x0, x1: Float);
  begin
    Box((x0 + x1) / 2, 0.08, z, x1 - x0, 0.16, 0.25, 'concreteDark');
  end;

begin
  // dirt outside the play space
  Box(0, -0.35, 0, 520, 0.5, 520, 'dirt');
  // main street N-S and cross street E-W
  Box(0, -0.1, 0, 14, 0.2, 200, 'asphalt');
  Box(0, -0.1, 0, 140, 0.2, 14, 'asphalt');
  // sidewalks + curbs
  for var s in [-1, 1] do begin
    // along main street
    SW(if s > 0 then 7 else -11, if s > 0 then 11 else -7, 11, 100);
    SW(if s > 0 then 7 else -11, if s > 0 then 11 else -7, -100, -11);
    CurbAlongZ(s * 7.12, 7, 100); CurbAlongZ(s * 7.12, -100, -7);
    // along cross street
    SW(11, 70, if s > 0 then 7 else -11, if s > 0 then 11 else -7);
    SW(-70, -11, if s > 0 then 7 else -11, if s > 0 then 11 else -7);
    CurbAlongX(s * 7.12, 7, 70); CurbAlongX(s * 7.12, -70, -7);
    // corner squares
    SW(if s > 0 then 7 else -11, if s > 0 then 11 else -7, 7, 11);
    SW(if s > 0 then 7 else -11, if s > 0 then 11 else -7, -11, -7);
  end;
  // road markings (dashed centre line, crosswalks, stop lines)
  var Y := 0.004;
  var z := -96;
  while z < 96 do begin
    if Abs(z) >= 12 then Box(0, Y, z, 0.14, 0.004, 3, 'paintYellow', Opt.NoUV);
    z += 6;
  end;
  var x := -66;
  while x < 66 do begin
    if Abs(x) >= 12 then Box(x, Y, 0, 3, 0.004, 0.14, 'paintYellow', Opt.NoUV);
    x += 6;
  end;
  for var s in [-1, 1] do begin
    for var i := -6 to 6 do begin
      Box(i * 1.0, Y, s * 9.5, 0.5, 0.004, 3, 'paintWhite', Opt.NoUV);
      Box(s * 9.5, Y, i * 1.0, 3, 0.004, 0.5, 'paintWhite', Opt.NoUV);
    end;
    Box(if s > 0 then -3.5 else 3.5, Y, s * 11.6, 7, 0.004, 0.3, 'paintWhite', Opt.NoUV);
    for var e in [-1, 1] do Box(e * 6.6, Y, s * 50, 0.12, 0.004, 80, 'paintWhite', Opt.NoUV);
  end;
end;

// --------------------------------------------------------- buildings
procedure TWorld.Buildings;
begin
  var styles: array of TStyle;
  styles.Add(TStyle.Create('brick', 'concrete', 3.3));
  styles.Add(TStyle.Create('plaster', 'concrete', 3.4));
  styles.Add(TStyle.Create('brick2', 'concreteDark', 3.2));
  styles.Add(TStyle.Create('plaster2', 'concrete', 3.5));
  styles.Add(TStyle.Create('plaster3', 'concreteDark', 3.3));
  styles.Add(TStyle.Create('concrete', 'concreteDark', 3.6));
  var pick := function: TStyle
    begin
      Result := styles[Floor(Rand() * styles.Length)];
    end;
  // main street rows: facade on x = +-11, facing inward, extending along z
  for var sx in [-1, 1] do
    for var sz in [-1, 1] do begin
      var z := 11;
      while z < 96 do begin
        var w := Min(10 + Floor(Rand() * 4) * 3, 96 - z);
        if w < 6 then break;
        var floors := 2 + Floor(Rand() * 5);
        var zc := sz * (z + w / 2);
        // local facade frame: origin at facade centre bottom, +z points toward street
        var rot := if sx > 0 then -PI / 2 else PI / 2;
        Building(sx * 11, zc, rot, w, 16, floors, pick(), if z = 11 then -sx * sz else 0);
        z += w;
      end;
      // cross street rows: facade on z = +-11 facing inward, extending along x from 27
      var x := 27;
      while x < 66 do begin
        var w := Min(9 + Floor(Rand() * 4) * 3, 66 - x);
        if w < 6 then break;
        var floors := 2 + Floor(Rand() * 4);
        var rot := if sz > 0 then PI else 0.0;
        Building(sx * (x + w / 2), sz * 11, rot, w, 14, floors, pick());
        x += w;
      end;
    end;
  // end walls: large buildings closing each street
  for var s in [-1, 1] do begin
    Building(0, s * 100, if s > 0 then PI else 0.0, 22, 14, 6, styles[if s > 0 then 0 else 5]);
    Building(s * 70, 0, if s > 0 then -PI / 2 else PI / 2, 22, 14, 4, styles[if s > 0 then 1 else 2]);
  end;
end;

// facade faces local +z. rot = rotation about y. (fx,fz) = facade centre on ground.
procedure TWorld.Building(fx, fz, rot, W, D: Float; floors: Integer; st: TStyle; corner: Integer = 0);
begin
  var T := YRot(fx, 0, fz, rot);
  var gf := 4.2; // ground floor height
  var fh := st.FloorH;
  var H := gf + (floors - 1) * fh;
  var wall := st.Wall;
  var trim := st.Trim;
  // core volume behind facade
  var cw := W - (if corner <> 0 then 2 else 0);
  var cx := if corner <> 0 then -corner else 0;
  Box(cx, H / 2, -(D + 2) / 2, cw, H, D - 2, wall, Par(T));
  for var e in [-1, 1] do
    if e <> corner then Box(e * (W / 2 - 0.15), H / 2, -1.0, 0.3, H, 2.0, wall, Par(T));
  // roof slab + parapet
  Box(0, H + 0.05, -D / 2, W, 0.1, D, 'roof', Par(T));
  Box(0, H + 0.45, -0.2, W + 0.1, 0.9, 0.4, trim, Par(T));
  Box(-W / 2 + 0.15, H + 0.45, -D / 2, 0.3, 0.9, D, trim, Par(T));
  Box(W / 2 - 0.15, H + 0.45, -D / 2, 0.3, 0.9, D, trim, Par(T));
  Box(0, H + 0.45, -D + 0.15, W, 0.9, 0.3, trim, Par(T));
  // cornice
  Box(0, H - 0.2, 0.12, W + 0.3, 0.35, 0.5, trim, Par(T));
  // rooftop clutter
  if Rand() < 0.7 then Box((Rand() - 0.5) * W * 0.5, H + 0.7, -D * 0.5, 2.2, 1.3, 1.6, 'metal', Par(T));
  if Rand() < 0.5 then begin // water tank
    var g := JCylinderGeometry.Create(1.1, 1.1, 2.2, 16);
    Mesh(g, 'wood', (Rand() - 0.5) * W * 0.4, H + 2.6, -D * 0.6, 0, 0, 0, 1, 1, 1, T);
    for var a in [-0.7, 0.7] do
      for var b in [-0.7, 0.7] do
        Box(a + 0, H + 0.8, -D * 0.6 + b, 0.12, 1.5, 0.12, 'metal', Par(T));
  end;

  Facade(T, W, floors, st, gf, fh, H);
  if corner <> 0 then begin
    var T2 := T.clone.multiply(JMatrix4.Create.makeTranslation(corner * W / 2, 0, -D / 2)).multiply(JMatrix4.Create.makeRotationY(corner * PI / 2));
    Facade(T2, D, floors, st, gf, fh, H);
  end;

  // drain pipe
  var px := W / 2 - 0.25;
  Mesh(JCylinderGeometry.Create(0.06, 0.06, H, 8), 'metal', px, H / 2, 0.12, 0, 0, 0, 1, 1, 1, T);
  // collider: whole building volume
  var b := JBox3.Create(V3(-W / 2, 0, -D), V3(W / 2, H + 1, 0)).applyMatrix4(T);
  Colliders.Add(TCollider.Create(b.min, b.max, 'concrete'));
end;

procedure TWorld.Facade(T: JMatrix4; W: Float; floors: Integer; st: TStyle; gf, fh, H: Float);
begin
  var wt := 0.35;
  var wall := st.Wall;
  var trim := st.Trim;
  // ---- ground floor: storefront
  var nShops := Max(1, Floor(W / 6 + 0.5));
  var shopW := W / nShops;
  Box(0, 0.25, -wt / 2, W, 0.5, wt, trim, Par(T)); // plinth
  for var i := 0 to nShops do begin
    var bx := -W / 2 + shopW * i;
    var pw := if (i = 0) or (i = nShops) then 0.6 else 1.2;
    var pc := if i = 0 then bx + 0.3 else if i = nShops then bx - 0.3 else bx;
    Box(pc, gf / 2, -wt / 2 + 0.05, pw, gf, wt + 0.1, trim, Par(T));
    if (Rand() < 0.35) and (pw > 1) then
      Mesh(JPlaneGeometry.Create(0.95, 0.95), 'poster' + IntStr(Floor(Rand() * 4)), pc, 1.5 + Rand() * 0.4, 0.103, 0, 0, (Rand() - 0.5) * 0.1, 1, 1, 1, T, Opt.NoUV);
  end;
  for var i := 0 to nShops - 1 do begin
    var cx := -W / 2 + shopW * (i + 0.5);
    var openW := shopW - 1.2;
    var openH := 3.0;
    // lintel
    Box(cx, (openH + 0.5 + gf) / 2, -wt / 2, shopW, gf - openH - 0.5, wt, wall, Par(T));
    // recessed shop interior
    Box(cx, 0.5 + openH / 2, -1.8, openW, openH, 0.1, if Rand() < 0.25 then 'interiorLit' else 'interior', Par(T).NoUV);
    Box(cx, 0.48, -1.05, openW, 0.04, 1.5, 'concreteDark', Par(T));
    Box(cx, 0.5 + openH + 0.02, -1.05, openW, 0.04, 1.5, 'concreteDark', Par(T));
    for var e in [-1, 1] do Box(cx + e * (openW / 2 + 0.02), 0.5 + openH / 2, -1.05, 0.04, openH, 1.5, 'concreteDark', Par(T));
    // shop fittings: back shelving + counter
    Box(cx - openW * 0.2, 0.5 + 1.0, -1.6, openW * 0.5, 2.0, 0.35, 'wood', Par(T).UV(1));
    for var k := 0 to 3 do Box(cx - openW * 0.2, 0.5 + 0.35 + k * 0.5, -1.42, openW * 0.48, 0.04, 0.05, 'frame', Par(T));
    if Rand() < 0.7 then Box(cx + openW * 0.18, 0.5 + 0.5, -0.95, openW * 0.4, 1.0, 0.5, if Rand() < 0.5 then 'wood' else 'metal', Par(T));
    var kind := Rand();
    if kind < 0.45 then begin
      // roller shutter partially down
      var down := 0.3 + Rand() * 0.7;
      var sh := openH * down;
      Box(cx, 0.5 + openH - sh / 2, -0.12, openW, sh, 0.06, 'shutter', Par(T));
      if (Rand() < 0.55) and (sh > 1.4) then
        Mesh(JPlaneGeometry.Create(MinF(openW * 0.8, 3), MinF(openW * 0.4, 1.5)), 'graf' + IntStr(Floor(Rand() * 6)), cx + (Rand() - 0.5) * 0.4, 0.5 + openH - sh + MinF(sh * 0.5, 1.1), -0.085, 0, 0, (Rand() - 0.5) * 0.06, 1, 1, 1, T, Opt.NoUV);
      Box(cx, 0.5 + openH + 0.15, -0.05, openW + 0.2, 0.35, 0.3, 'metal', Par(T));
    end else if kind < 0.8 then begin
      // shop glass with mullions
      Box(cx, 0.5 + openH / 2, -0.2, openW, openH, 0.04, if Rand() < 0.5 then 'glass' else 'glassDirty', Par(T).NoUV);
      Box(cx, 0.5 + openH * 0.72, -0.14, openW, 0.08, 0.1, 'frame', Par(T));
      Box(cx, 0.55, -0.14, openW, 0.1, 0.12, 'frame', Par(T));
    end; // else broken open storefront
    // sign board
    if Rand() < 0.75 then begin
      var sw := MinF(openW * 0.92, 2.8);
      var sh := sw / 4;
      var sy := 0.5 + openH + 0.1 + sh / 2;
      Box(cx, sy, 0.06, sw + 0.08, sh + 0.08, 0.1, 'frame', Par(T));
      Mesh(JPlaneGeometry.Create(sw, sh), 'sign' + IntStr(Floor(Rand() * SIGN_COUNT)), cx, sy, 0.112, 0, 0, 0, 1, 1, 1, T, Opt.NoUV);
    end;

    // awning frame
    if Rand() < 0.35 then Box(cx, 0.5 + openH + 0.02, 0.55, openW, 0.06, 1.1, 'shutter', Par(T).Rot(0.25, 0, 0));
  end;
  // floor band above ground floor
  Box(0, gf - 0.1, 0.08, W + 0.2, 0.25, 0.3, trim, Par(T));

  // ---- upper floors
  var winW := 1.3;
  var winH := 1.75;
  var sill := 0.9;
  var nWin := Max(1, Floor((W - 1) / 3.0));
  var bay := W / nWin;
  var blown := if Rand() < 0.25 then Floor(Rand() * nWin) else -1;
  for var f := 1 to floors - 1 do begin
    var y0 := gf + (f - 1) * fh;
    // spandrel below windows and above windows
    Box(0, y0 + sill / 2, -wt / 2, W, sill, wt, wall, Par(T));
    Box(0, y0 + sill + winH + (fh - sill - winH) / 2, -wt / 2, W, fh - sill - winH, wt, wall, Par(T));
    for var i := 0 to nWin - 1 do begin
      var cx := -W / 2 + bay * (i + 0.5);
      // piers: left piece of each bay (+ the last right piece)
      var pw := (bay - winW) / 2;
      Box(cx - winW / 2 - pw / 2, y0 + sill + winH / 2, -wt / 2, pw, winH, wt, wall, Par(T));
      Box(cx + winW / 2 + pw / 2, y0 + sill + winH / 2, -wt / 2, pw, winH, wt, wall, Par(T));
      var wy := y0 + sill + winH / 2;
      var isBlown := (i = blown) and (f = floors - 1);
      // interior room box behind opening
      Box(cx, wy, -wt - 1.4, winW, winH, 0.05, if Rand() < 0.12 then 'interiorLit' else 'interior', Par(T).NoUV);
      Box(cx, y0 + sill - 0.02, -wt - 0.7, winW, 0.04, 1.4, 'concreteDark', Par(T));
      Box(cx, y0 + sill + winH + 0.02, -wt - 0.7, winW, 0.04, 1.4, 'concreteDark', Par(T));
      Box(cx - winW / 2 - 0.02, wy, -wt - 0.7, 0.04, winH, 1.4, 'concreteDark', Par(T));
      Box(cx + winW / 2 + 0.02, wy, -wt - 0.7, 0.04, winH, 1.4, 'concreteDark', Par(T));
      // sill + lintel
      Box(cx, y0 + sill - 0.06, 0.04, winW + 0.3, 0.12, 0.2, trim, Par(T));
      Box(cx, y0 + sill + winH + 0.08, 0.02, winW + 0.2, 0.16, 0.12, trim, Par(T));
      if not isBlown then begin
        var broken := Rand() < 0.3;
        // frame
        Box(cx, wy, -0.22, winW, 0.07, 0.08, 'frame', Par(T));
        Box(cx, y0 + sill + 0.035, -0.22, winW, 0.07, 0.1, 'frame', Par(T));
        Box(cx, y0 + sill + winH - 0.035, -0.22, winW, 0.07, 0.1, 'frame', Par(T));
        Box(cx - winW / 2 + 0.035, wy, -0.22, 0.07, winH, 0.1, 'frame', Par(T));
        Box(cx + winW / 2 - 0.035, wy, -0.22, 0.07, winH, 0.1, 'frame', Par(T));
        Box(cx, wy, -0.22, 0.06, winH, 0.08, 'frame', Par(T));
        if not broken then Box(cx, wy, -0.24, winW - 0.1, winH - 0.1, 0.02, if Rand() < 0.7 then 'glass' else 'glassDirty', Par(T).NoUV);
        // wooden shutters on some
        if Rand() < 0.15 then begin
          Box(cx - winW / 2 - 0.35, wy, 0.03, 0.62, winH, 0.05, 'wood', Par(T).Rot(0, 0.1, 0));
          Box(cx + winW / 2 + 0.35, wy, 0.03, 0.62, winH, 0.05, 'wood', Par(T).Rot(0, -0.3, 0));
        end;
      end else begin
        // blast damage: scorch-dark jagged opening edges
        Box(cx, wy + 0.2, 0.02, winW + 0.6, winH + 0.6, 0.02, 'burnt', Par(T));
        Box(cx, wy, -wt - 0.7, winW + 0.1, winH, 1.4, 'interior', Par(T).NoUV);
      end;
      // AC units and balconies
      if Rand() < 0.18 then Box(cx + 0.2, y0 + 0.5, 0.35, 0.9, 0.6, 0.6, 'carC', Par(T));
      if (Rand() < 0.12) and (f > 1) then begin
        Box(cx, y0 + 0.08, 0.6, winW + 1.0, 0.16, 1.2, trim, Par(T));
        for var k := -4 to 4 do Box(cx + k * ((winW + 0.9) / 8), y0 + 0.6, 1.15, 0.03, 0.9, 0.03, 'metal', Par(T));
        Box(cx, y0 + 1.05, 1.15, winW + 1.0, 0.05, 0.05, 'metal', Par(T));
      end;
    end;
    // floor band
    if f < floors - 1 then Box(0, y0 + fh, 0.05, W + 0.1, 0.14, 0.2, trim, Par(T));
  end;
  // rubble at base of blown facade
  if blown >= 0 then begin
    var cx := -W / 2 + bay * (blown + 0.5);
    var rp := V3(cx, 0, 2.5).applyMatrix4(T);
    RubblePile(rp.x, rp.z, 2.4, 60, 0.9);
  end;
end;

procedure TWorld.RubblePile(x, z, radius: Float; count: Integer; height: Float);
begin
  var geoA: JBufferGeometry := JDodecahedronGeometry.Create(1, 0);
  var geoB: JBufferGeometry := JBoxGeometry.Create(1, 1, 1);
  for var i := 0 to count - 1 do begin
    var a := Rand() * PI * 2;
    var r := Sqrt(Rand()) * radius;
    var h := (1 - r / radius) * height;
    var s := 0.08 + Rand() * 0.35 * (1 - r / radius * 0.5);
    var mat := if Rand() < 0.45 then 'concrete' else if Rand() < 0.6 then 'brick' else if Rand() < 0.8 then 'concreteDark' else 'plaster';
    Mesh(if Rand() < 0.6 then geoA else geoB, mat, x + Cos(a) * r, h * Rand() + s * 0.3, z + Sin(a) * r, Rand() * 3, Rand() * 3, Rand() * 3,
      s * (0.8 + Rand()), s * (0.5 + Rand() * 0.6), s * (0.8 + Rand()));
  end;
  // broken slabs with rebar
  for var i := 0 to 2 do begin
    var a := Rand() * PI * 2;
    var r := Rand() * radius * 0.6;
    var sx := x + Cos(a) * r;
    var sz := z + Sin(a) * r;
    var ry := Rand() * PI;
    Box(sx, height * 0.4, sz, 1.4 + Rand(), 0.18, 0.9 + Rand() * 0.6, 'concrete', Opt.Rot((Rand() - 0.5) * 0.9, ry, (Rand() - 0.5) * 0.9));
    for var k := 0 to 2 do
      Mesh(JCylinderGeometry.Create(0.012, 0.012, 1.2, 4), 'metal', sx + (Rand() - 0.5), height * 0.5 + 0.2, sz + (Rand() - 0.5), (Rand() - 0.5) * 1.5, 0, (Rand() - 0.5) * 1.5);
  end;
  if height > 0.6 then Collider(x - radius * 0.5, 0, z - radius * 0.5, x + radius * 0.5, height * 0.6, z + radius * 0.5, 'concrete');
end;

// --------------------------------------------------------- props
procedure TWorld.Props;
begin
  // wrecked cars
  Car(-3.2, 58, 0.25, 'carA', false); Car(3.8, 40, -0.4, 'carC', false); Car(-2, 24, 1.3, 'burnt', true);
  Car(4.2, -18, 3.3, 'carB', false); Car(-4.5, -38, 0.15, 'burnt', true); Car(2.5, -58, -0.2, 'carA', false);
  Car(22, 3.5, 1.5, 'carC', false); Car(-26, -3.2, 1.7, 'burnt', true); Car(40, -2, 1.45, 'carB', false); Car(-44, 3.8, 1.6, 'carA', false);
  Car(5, 72, 0.05, 'carB', false);

  // jersey barriers
  Jersey(0, 66, 0.0); Jersey(-3.2, 66, 0.1); Jersey(3.4, 65.5, -0.15);
  Jersey(-1.5, 32, 0.3); Jersey(2.8, 12, 0.0); Jersey(-4, -10, 0.2); Jersey(0.5, -28, -0.1); Jersey(-2.5, -48, 0.05); Jersey(3.5, -48, -0.2);
  Jersey(16, -1, 1.57); Jersey(-16, 1.5, 1.4); Jersey(32, 2, 1.57); Jersey(-34, -1.5, 1.6); Jersey(48, 0, 1.5); Jersey(-52, 2, 1.57);
  Jersey(0, -70, 0); Jersey(-3.2, -70, 0.05); Jersey(3.3, -70.2, 0);

  // sandbag positions
  Sandbags(-5, 46, 0.1, 5); Sandbags(5.2, 28, -0.3, 4); Sandbags(-5.2, 5, 0.1, 5); Sandbags(0, -40, 0, 6);
  Sandbags(5, -65, 0.2, 4); Sandbags(-18, 5, 1.57, 5); Sandbags(26, -5, 1.5, 4); Sandbags(-5.5, -60, -0.1, 4);

  // containers
  Container(-4.2, 14, 0.12, 'containerRed');
  Container(3.6, -32, 0.05, 'containerBlue');
  Container(3.6, -32, 0.1, 'containerGreen', 2.6);
  Container(-36, 3.5, 1.52, 'containerGreen');
  Container(18, 88, 1.5708, 'containerRed');

  // crates & barrels
  Crate(5.5, 50, 0); Crate(6.2, 51.2, 0); Crate(5.8, 50.6, 1); Crate(-6, 20, 0); Crate(-6.3, 21.2, 0); Crate(6, -8, 0);
  Crate(-5.8, -24, 0); Crate(-6, -25.2, 0); Crate(-6, -24.6, 1); Crate(12, 5, 0); Crate(-40, -5, 0); Crate(30, 4.5, 0);
  Barrel(6.2, 44, 'carB', false); Barrel(6.6, 44.7, 'containerBlue', false); Barrel(-6.4, 36, 'burnt', true); Barrel(-6.5, -14, 'carB', false);
  Barrel(6.4, -44, 'burnt', true); Barrel(13, -5, 'containerGreen', false); Barrel(-14, 5.5, 'carB', false); Barrel(20, -5, 'burnt', true);

  // rubble piles along the street
  RubblePile(-6, 70, 2, 50, 0.6); RubblePile(6, 10, 2.2, 60, 0.8); RubblePile(-5.5, -30, 1.8, 40, 0.5); RubblePile(5.5, -52, 2.4, 70, 0.9);
  RubblePile(-30, 6, 2, 50, 0.6); RubblePile(44, -6, 2, 50, 0.6); RubblePile(1, 80, 1.5, 30, 0.35);
  // loose debris everywhere
  var deb := JDodecahedronGeometry.Create(1, 0);
  for var i := 0 to 699 do begin
    var onCross := Rand() < 0.3;
    var x := if onCross then (Rand() - 0.5) * 120 else (Rand() - 0.5) * 20;
    var z := if onCross then (Rand() - 0.5) * 20 else (Rand() - 0.5) * 180;
    var s := 0.03 + Rand() * 0.09;
    var surfY := if Abs(if onCross then z else x) > 7 then 0.15 else 0.0;
    Mesh(deb, if Rand() < 0.7 then 'concrete' else 'brick', x, surfY + s * 0.3, z, Rand() * 3, Rand() * 3, Rand() * 3, s, s * 0.6, s * 1.2);
  end;

  Litter;
  var z := -84;
  while z <= 84 do begin
    if not ((Abs(z) < 16) or (Rand() < 0.35)) then
      Tree(if z mod 28 = 0 then 8.7 else -8.7, z + (Rand() - 0.5) * 3);
    z += 14;
  end;
  for var x in [-40, -22, 22, 40] do
    if Rand() < 0.8 then Tree(x + (Rand() - 0.5) * 4, if x > 0 then -8.7 else 8.7);
  // street lamps + utility poles with sagging wires
  z := -84;
  while z <= 84 do begin
    if Abs(z) >= 14 then begin
      Lamp(-9.6, z, 1); Lamp(9.6, z + 12, -1);
    end;
    z += 24;
  end;
  var poles: array of JVector3;
  z := -88;
  while z <= 88 do begin
    if Abs(z) >= 12 then poles.Add(Pole(10.3, z));
    z += 22;
  end;
  for var i := 0 to poles.Length - 2 do begin
    if FSign(poles[i].z) <> FSign(poles[i + 1].z) then continue;
    for var off in [-0.8, 0.0, 0.8] do
      Wire(V3(poles[i].x + off, poles[i].y, poles[i].z), V3(poles[i + 1].x + off, poles[i + 1].y, poles[i + 1].z), 0.6);
  end;
  // wires across the street to buildings
  z := -80;
  while z <= 80 do begin
    if Abs(z) >= 12 then Wire(V3(10.3, 8.4, z - 0.5), V3(-11, 7.5 + Rand() * 3, z + (Rand() - 0.5) * 8), 1.2);
    z += 22;
  end;
  // traffic lights at intersection corners
  for var sx in [-1, 1] do
    for var sz in [-1, 1] do TrafficLight(sx * 8.2, sz * 8.2, sx, sz);

  // fires
  Fires.Add(TFire.Create(V3(-2, 1.2, 24), 1.3)); Fires.Add(TFire.Create(V3(-4.5, 1.2, -38), 1.2)); Fires.Add(TFire.Create(V3(-26, 1.2, -3.2), 1.2));
  Fires.Add(TFire.Create(V3(-6.4, 0.95, 36), 0.6)); Fires.Add(TFire.Create(V3(6.4, 0.95, -44), 0.6)); Fires.Add(TFire.Create(V3(20, 0.95, -5), 0.6));
  SmokeStacks.Add(V3(-60, 0, -160)); SmokeStacks.Add(V3(90, 0, -120)); SmokeStacks.Add(V3(-110, 0, 60));
  SmokeStacks.Add(V3(40, 0, 180)); SmokeStacks.Add(V3(140, 0, 30));
end;

procedure TWorld.Car(x, z, ry: Float; paint: String; burnt: Boolean);

  function Ext(shape: JShape; dep, bev: Float): JBufferGeometry;
  begin
    Result := JExtrudeGeometry.Create(shape, class
      depth: Float := dep; bevelEnabled := true; bevelThickness: Float := bev; bevelSize: Float := bev;
      bevelSegments := 3; curveSegments := 14;
    end);
    Result.translate(0, 0, -dep / 2);
    Result.rotateY(-PI / 2);
    Result.computeVertexNormals;
  end;

begin
  var T := YRot(x, 0, z, ry);
  if FCarBody = nil then begin
    var b := JShape.Create;
    b.moveTo(-2.2, 0.38); b.lineTo(-2.24, 0.8); b.quadraticCurveTo(-2.2, 0.93, -1.95, 0.95); b.lineTo(-1.25, 0.97);
    b.lineTo(1.0, 0.96); b.quadraticCurveTo(1.7, 0.93, 2.1, 0.84); b.quadraticCurveTo(2.26, 0.8, 2.25, 0.62); b.lineTo(2.22, 0.4);
    b.lineTo(1.82, 0.36); b.absarc(1.4, 0.36, 0.42, 0, PI, false); b.lineTo(-0.98, 0.36);
    b.absarc(-1.4, 0.36, 0.42, 0, PI, false); b.lineTo(-2.2, 0.38);
    var gh := JShape.Create;
    gh.moveTo(-1.28, 0.95); gh.quadraticCurveTo(-0.95, 1.36, -0.72, 1.41); gh.lineTo(0.32, 1.42); gh.quadraticCurveTo(0.55, 1.38, 1.05, 0.95); gh.lineTo(-1.28, 0.95);
    var rf := JShape.Create;
    rf.moveTo(-0.74, 1.4); rf.lineTo(0.34, 1.41); rf.lineTo(0.3, 1.45); rf.lineTo(-0.7, 1.44); rf.lineTo(-0.74, 1.4);
    FCarBody := Ext(b, 1.66, 0.07);
    FCarGlass := Ext(gh, 1.42, 0.05);
    FCarRoof := Ext(rf, 1.4, 0.04);
  end;
  Mesh(FCarBody, paint, 0, 0, 0, 0, 0, 0, 1, 1, 1, T);
  Mesh(FCarGlass, if burnt then 'interior' else 'glass', 0, 0, 0, 0, 0, 0, 1, 1, 1, T, Opt.NoUV);
  Mesh(FCarRoof, paint, 0, 0.005, 0, 0, 0, 0, 1, 1, 1, T);
  // pillars + door seams + mirrors + grille
  for var sx in [-1, 1] do begin
    Box(sx * 0.9, 0.7, -0.2, 0.012, 0.5, 0.012, 'rubber', Par(T).NoUV);
    Box(sx * 0.93, 1.0, 0.92, 0.1, 0.07, 0.13, paint, Par(T));
  end;
  if not burnt then Box(0, 0.62, 2.28, 1.2, 0.18, 0.04, 'frame', Par(T));
  // wheels
  var tire := JCylinderGeometry.Create(0.35, 0.35, 0.26, 20);
  var rim := JCylinderGeometry.Create(0.2, 0.2, 0.27, 12);
  for var sx in [-1, 1] do
    for var sz in [-1.4, 1.4] do begin
      var tilt := if burnt then 0.15 else 0.0;
      Mesh(tire, 'rubber', sx * 0.76, if burnt then 0.28 else 0.35, sz, 0, 0, PI / 2 + tilt * sx, 1, 1, 1, T, Opt.NoUV);
      Mesh(rim, 'metal', sx * 0.775, if burnt then 0.28 else 0.35, sz, 0, 0, PI / 2, 1, 1, 1, T);
    end;
  // bumpers, lights
  Box(0, 0.45, 2.27, 1.86, 0.22, 0.12, 'rubber', Par(T).NoUV);
  Box(0, 0.45, -2.27, 1.86, 0.22, 0.12, 'rubber', Par(T).NoUV);
  if not burnt then
    for var s in [-1, 1] do begin
      Box(s * 0.65, 0.78, 2.24, 0.34, 0.14, 0.05, 'light', Par(T).NoUV);
      Box(s * 0.68, 0.8, -2.24, 0.3, 0.14, 0.05, 'redLight', Par(T).NoUV);
    end;
  ColliderFromBox(1.9, 1.62, 4.6, Translated(T, 0, 0.81, 0), 'metal');
  CoverFor(x, z, ry);
end;

procedure TWorld.Litter;
begin
  var paper := JPlaneGeometry.Create(0.21, 0.3);
  for var i := 0 to 259 do begin
    var cross := Rand() < 0.3;
    var along := (Rand() - 0.5) * (if cross then 120 else 180);
    var across := (if Rand() < 0.5 then -1 else 1) * (6.5 + Rand() * 4);
    var x := if cross then along else across;
    var z := if cross then across else along;
    var y := if Abs(across) > 7 then 0.152 else 0.003;
    Mesh(paper, 'paper', x, y + Rand() * 0.004, z, -PI / 2 + (Rand() - 0.5) * 0.3, Rand() * 6, (Rand() - 0.5) * 0.3, 0.6 + Rand() * 0.8, 0.6 + Rand() * 0.8, 1, nil, Opt.NoUV);
  end;
  // trash bag piles along building fronts
  var bag := JSphereGeometry.Create(0.32, 12, 9);
  for var i := 0 to 25 do begin
    var side := if Rand() < 0.5 then -1 else 1;
    var cross := Rand() < 0.3;
    var along := (Rand() - 0.5) * (if cross then 100 else 170);
    if Abs(along) < 13 then continue;
    var bx := if cross then along else side * 10.35;
    var bz := if cross then side * 10.35 else along;
    var n := 2 + Floor(Rand() * 4);
    for var k := 0 to n - 1 do
      Mesh(bag, 'trashbag', bx + (Rand() - 0.5) * 0.9, 0.15 + 0.2 + (if k > 2 then 0.35 else 0), bz + (Rand() - 0.5) * 1.2, Rand(), Rand() * 6, Rand(), 1 + Rand() * 0.3, 0.75 + Rand() * 0.3, 1 + Rand() * 0.2);
    for var k := 0 to 1 do
      Box(bx + (Rand() - 0.5) * 1.4, 0.15 + 0.18, bz + (Rand() - 0.5) * 1.4, 0.5, 0.36, 0.4, 'wood', Opt.Rot(0, Rand() * 3, 0).UV(0.8));
  end;
  // scattered tires
  var tire := JTorusGeometry.Create(0.3, 0.12, 8, 18);
  for var i := 0 to 13 do begin
    var x := (Rand() - 0.5) * 16;
    var z := (Rand() - 0.5) * 170;
    if Abs(z) < 12 then continue;
    Mesh(tire, 'rubber', x, 0.12, z, PI / 2 + (Rand() - 0.5) * 0.3, 0, Rand() * 3, 1, 1, 1, nil, Opt.NoUV);
  end;
end;

procedure TWorld.Tree(x, z: Float);
var
  leafGeo: JPlaneGeometry;

  procedure Branch(p, dir: JVector3; len, rad: Float; depth: Integer);
  begin
    var g := JCylinderGeometry.Create(rad * 0.7, rad, len, 7);
    g.translate(0, len / 2, 0);
    var q := JQuaternion.Create.setFromUnitVectors(V3(0, 1, 0), dir);
    var m := JMatrix4.Create.compose(p, q, V3(1, 1, 1));
    Add(g, 'bark', m);
    var e := p.clone.addScaledVector(dir, len);
    if (depth >= 3) or (rad < 0.03) then begin
      var n := 5 + Floor(Rand() * 4);
      for var k := 0 to n - 1 do begin
        var lp := e.clone.add(V3((Rand() - 0.5) * 1.2, (Rand() - 0.3) * 0.9, (Rand() - 0.5) * 1.2));
        var s := 0.8 + Rand() * 0.7;
        Mesh(leafGeo, 'leaves', lp.x, lp.y, lp.z, Rand() * 3, Rand() * 3, Rand() * 3, s, s, s, nil, Opt.NoUV);
      end;
      Exit;
    end;
    var kids := if depth = 0 then 3 else 2 + (if Rand() < 0.4 then 1 else 0);
    for var k := 0 to kids - 1 do begin
      var nd := dir.clone.add(V3((Rand() - 0.5) * 1.4, 0.35 + Rand() * 0.5, (Rand() - 0.5) * 1.4)).normalize;
      Branch(e, nd, len * (0.62 + Rand() * 0.15), rad * 0.62, depth + 1);
    end;
  end;

begin
  // planter
  Box(x, 0.3, z, 1.3, 0.3, 1.3, 'concreteDark', Opt.Coll);
  Box(x, 0.46, z, 1.1, 0.04, 1.1, 'dirt');
  leafGeo := JPlaneGeometry.Create(1.2, 1.2);
  var h := 2.4 + Rand() * 1.2;
  var start := V3(x, 0.45, z);
  var dir := V3((Rand() - 0.5) * 0.15, 1, (Rand() - 0.5) * 0.15).normalize;
  Branch(start, dir, h, 0.13 + Rand() * 0.04, 0);
  Collider(x - 0.18, 0, z - 0.18, x + 0.18, 4, z + 0.18, 'wood');
end;

procedure TWorld.CoverFor(x, z, ry: Float);
begin
  // points on both long sides of an obstacle
  var dx := Cos(ry);
  var dz := -Sin(ry);
  CoverPoints.Add(V3(x + dx * 1.6, 0, z + dz * 1.6));
  CoverPoints.Add(V3(x - dx * 1.6, 0, z - dz * 1.6));
end;

procedure TWorld.Jersey(x, z, ry: Float);
begin
  var s := JShape.Create;
  s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.08); s.lineTo(0.11, 0.3); s.lineTo(0.08, 0.81); s.lineTo(-0.08, 0.81); s.lineTo(-0.11, 0.3); s.lineTo(-0.3, 0.08); s.lineTo(-0.3, 0);
  var g := JExtrudeGeometry.Create(s, class depth := 3; bevelEnabled := true; bevelThickness := 0.02; bevelSize := 0.015; bevelSegments := 1; end);
  g.translate(0, 0, -1.5);
  g.computeVertexNormals;
  Mesh(g, 'concrete', x, 0, z, 0, ry, 0);
  ColliderFromBox(0.6, 0.82, 3.0, YRot(x, 0.41, z, ry), 'concrete');
  CoverFor(x, z, ry);
end;

procedure TWorld.Sandbags(x, z, ry: Float; n: Integer);
begin
  var T := YRot(x, 0, z, ry);
  var bag := JRoundedBoxGeometry.Create(0.62, 0.17, 0.36, 3, 0.075);
  var rows := 5;
  for var r := 0 to rows - 1 do begin
    var off := (r mod 2) * 0.31;
    var count := n - (if r = rows - 1 then 1 else 0);
    for var i := 0 to count - 1 do begin
      var lx := -((n - 1) * 0.6) / 2 + i * 0.6 + off - (if r mod 2 <> 0 then 0.15 else 0);
      for var lz in [-0.2, 0.2] do
        Mesh(bag, 'cloth', lx + (Rand() - 0.5) * 0.04, 0.085 + r * 0.155, lz + (Rand() - 0.5) * 0.04, (Rand() - 0.5) * 0.12, (Rand() - 0.5) * 0.2, (Rand() - 0.5) * 0.1, 1 + (Rand() - 0.5) * 0.1, 1, 1, T);
    end;
  end;
  var len := n * 0.6;
  ColliderFromBox(len, rows * 0.155 + 0.05, 0.8, Translated(T, 0, (rows * 0.155) / 2, 0), 'cloth');
  CoverFor(x, z, ry);
end;

procedure TWorld.Container(x, z, ry: Float; mat: String; y: Float = 0);
begin
  var T := YRot(x, y, z, ry);
  var L := 6.06;
  var Wd := 2.44;
  var H := 2.59;
  Box(0, H / 2, 0, Wd - 0.1, H - 0.1, L - 0.1, mat, Par(T).UV(3.6));
  // frame rails
  for var sx in [-1, 1] do
    for var sy in [0, 1] do Box(sx * (Wd / 2 - 0.05), 0.08 + sy * (H - 0.16), 0, 0.12, 0.16, L, 'metal', Par(T));
  for var sx in [-1, 1] do
    for var sz in [-1, 1] do Box(sx * (Wd / 2 - 0.08), H / 2, sz * (L / 2 - 0.08), 0.16, H, 0.16, 'metal', Par(T));
  // door lock bars
  for var i := 0 to 3 do Mesh(JCylinderGeometry.Create(0.025, 0.025, H - 0.3, 6), 'metal', -0.9 + i * 0.6, H / 2, L / 2 + 0.02, 0, 0, 0, 1, 1, 1, T);
  ColliderFromBox(Wd, H, L, Translated(T, 0, H / 2, 0), 'metal');
  if y = 0 then CoverFor(x, z, ry);
end;

procedure TWorld.Crate(x, z: Float; stack: Integer);
begin
  var s := 1.1;
  var y := if stack <> 0 then s else 0.0;
  var ry := Rand() * 0.5;
  var T := YRot(x, 0.15 + y, z, ry);
  Box(0, s / 2, 0, s - 0.04, s - 0.04, s - 0.04, 'wood', Par(T));
  var e := 0.09;
  for var a in [-1, 1] do
    for var b in [-1, 1] do begin
      Box(a * (s / 2 - e / 2), s / 2, b * (s / 2 - e / 2), e, s, e, 'wood', Par(T).UV(0.9));
      Box(0, s / 2 + a * (s / 2 - e / 2), b * (s / 2 - e / 2), s, e, e, 'wood', Par(T).UV(0.9));
      Box(a * (s / 2 - e / 2), s / 2 + b * (s / 2 - e / 2), 0, e, e, s, 'wood', Par(T).UV(0.9));
    end;
  ColliderFromBox(s, s, s, Translated(T, 0, s / 2, 0), 'wood');
end;

procedure TWorld.Barrel(x, z: Float; mat: String; burning: Boolean);
begin
  var g := JCylinderGeometry.Create(0.3, 0.3, 0.88, 20, 1, burning);
  Mesh(g, mat, x, 0.15 + 0.44, z);
  var rib := JTorusGeometry.Create(0.305, 0.018, 6, 24);
  for var y in [0.3, 0.58] do Mesh(rib, mat, x, 0.15 + y, z, PI / 2, 0, 0);
  Collider(x - 0.3, 0.15, z - 0.3, x + 0.3, 1.03, z + 0.3, 'metal');
end;

procedure TWorld.Lamp(x, z, dir: Float);
begin
  var g := JCylinderGeometry.Create(0.07, 0.11, 7, 10);
  Mesh(g, 'metal', x, 3.65, z);
  Box(x + dir * 0.9, 7.1, z, 1.8, 0.08, 0.08, 'metal');
  Box(x + dir * 1.75, 7.0, z, 0.55, 0.14, 0.28, 'metal');
  Box(x + dir * 1.75, 6.92, z, 0.45, 0.03, 0.2, 'glassDirty', Opt.NoUV);
  Collider(x - 0.12, 0, z - 0.12, x + 0.12, 7, z + 0.12, 'metal');
end;

function TWorld.Pole(x, z: Float): JVector3;
begin
  var g := JCylinderGeometry.Create(0.13, 0.16, 9, 10);
  Mesh(g, 'wood', x, 4.65, z);
  Box(x, 8.6, z, 2.2, 0.12, 0.12, 'wood');
  for var o in [-0.8, 0.0, 0.8] do Mesh(JCylinderGeometry.Create(0.04, 0.05, 0.14, 6), 'glassDirty', x + o, 8.72, z);
  if Rand() < 0.4 then Mesh(JCylinderGeometry.Create(0.28, 0.28, 0.8, 12), 'metal', x + 0.35, 7.6, z);
  Collider(x - 0.16, 0, z - 0.16, x + 0.16, 9, z + 0.16, 'wood');
  Result := V3(x, 8.75, z);
end;

procedure TWorld.Wire(a, b: JVector3; sag: Float);
begin
  var pts: array of JVector3;
  for var i := 0 to 16 do begin
    var t := i / 16;
    var p := a.clone.lerp(b, t);
    p.y := p.y - Sin(t * PI) * sag;
    pts.Add(p);
  end;
  var g := JTubeGeometry.Create(JCatmullRomCurve3.Create(pts), 24, 0.014, 4, false);
  Add(g, 'wire', nil, Opt.NoUV);
end;

procedure TWorld.TrafficLight(x, z, sx, sz: Float);
begin
  Mesh(JCylinderGeometry.Create(0.09, 0.1, 5.5, 10), 'metal', x, 2.9, z);
  // arm over the road
  var armLen := 5.0;
  Box(x - sx * armLen / 2, 5.5, z, armLen, 0.1, 0.1, 'metal');
  var hx := x - sx * (armLen - 0.4);
  Box(hx, 5.0, z, 0.35, 1.0, 0.3, 'frame');
  for var i := 0 to 2 do Box(hx, 5.3 - i * 0.3, z - sz * 0.16, 0.2, 0.2, 0.02, if i = 0 then 'redLight' else 'glassDirty', Opt.NoUV);
  Collider(x - 0.12, 0, z - 0.12, x + 0.12, 5.6, z + 0.12, 'metal');
end;

procedure TWorld.Skyline;
begin
  var rr := Rng(99);
  for var i := 0 to 89 do begin
    var a := rr() * PI * 2;
    var r := 130 + rr() * 150;
    var x := Cos(a) * r;
    var z := Sin(a) * r;
    var w := 15 + rr() * 30;
    var d := 15 + rr() * 30;
    var h := 15 + rr() * 60;
    Box(x, h / 2, z, w, h, d, 'skyline', Opt.Rot(0, rr() * 0.5, 0));
    if rr() < 0.3 then Box(x, h + 4, z, 1, 8, 1, 'skyline', Opt.NoUV);
  end;
end;

procedure TWorld.Bounds;
begin
  // invisible walls at play-area edge (streets are closed by end buildings already)
  Collider(-12, 0, 99, 12, 30, 102, 'concrete');
  Collider(-12, 0, -102, 12, 30, -99, 'concrete');
  Collider(69, 0, -12, 72, 30, 12, 'concrete');
  Collider(-72, 0, -12, -69, 30, 12, 'concrete');
  for var s in [-1, 1] do
    for var e in [-1, 1] do begin
      // gaps between street rows and the end buildings
      Collider(if e > 0 then 10.5 else -32, 0, if s > 0 then 94.5 else -101, if e > 0 then 32 else -10.5, 30, if s > 0 then 101 else -94.5, 'concrete');
      Collider(if e > 0 then 64.5 else -71, 0, if s > 0 then 10.5 else -32, if e > 0 then 71 else -64.5, 30, if s > 0 then 32 else -10.5, 'concrete');
    end;
end;

// ---------------------------------------------------------------- queries
// ray vs all AABB colliders. returns hit or nil
function TWorld.Raycast(origin, dir: JVector3; maxDist: Float = 500): THit;
begin
  var best := maxDist;
  var hit: TCollider := nil;
  var hitGround := false;
  var nAxis := 0;
  var nSign := 0.0;
  var ox := origin.x;
  var oy := origin.y;
  var oz := origin.z;
  var ix := 1 / dir.x;
  var iy := 1 / dir.y;
  var iz := 1 / dir.z;
  for var i := 0 to Colliders.Length - 1 do begin
    var c := Colliders[i];
    var t1 := (c.Min.x - ox) * ix;
    var t2 := (c.Max.x - ox) * ix;
    var tmin := MinF(t1, t2);
    var tmax := MaxF(t1, t2);
    var ax := 0;
    t1 := (c.Min.y - oy) * iy; t2 := (c.Max.y - oy) * iy;
    var a := MinF(t1, t2);
    var b := MaxF(t1, t2);
    if a > tmin then begin tmin := a; ax := 1; end;
    if b < tmax then tmax := b;
    t1 := (c.Min.z - oz) * iz; t2 := (c.Max.z - oz) * iz;
    a := MinF(t1, t2); b := MaxF(t1, t2);
    if a > tmin then begin tmin := a; ax := 2; end;
    if b < tmax then tmax := b;
    if (tmax >= MaxF(tmin, 0)) and (tmin < best) and (tmin > 0) then begin
      best := tmin; hit := c; nAxis := ax;
      nSign := if ax = 0 then -FSign(dir.x) else if ax = 1 then -FSign(dir.y) else -FSign(dir.z);
    end;
  end;
  // ground plane y=0
  if dir.y < 0 then begin
    var t := -oy / dir.y;
    if (t > 0) and (t < best) then begin
      best := t; hit := nil; hitGround := true; nAxis := 1; nSign := 1;
    end;
  end;
  if (hit = nil) and not hitGround then Exit(nil);
  Result := THit.Create;
  Result.T := best;
  Result.Point := origin.clone.addScaledVector(dir, best);
  Result.Normal := V3(if nAxis = 0 then nSign else 0, if nAxis = 1 then nSign else 0, if nAxis = 2 then nSign else 0);
  Result.Surf := if hitGround then 'asphalt' else hit.Surf;
  Result.Collider := hit;
end;

function TWorld.LineOfSight(a, b: JVector3): Boolean;
begin
  var d := V3Zero.subVectors(b, a);
  var len := d.length;
  d.divideScalar(len);
  var h := Raycast(a, d, len);
  Result := (h = nil) or (h.T >= len - 0.05);
end;

// resolve a vertical cylinder-ish AABB against the level. mutates pos, returns grounded
// pos = feet position. radius, height.
function TWorld.Collide(pos, vel: JVector3; radius, height: Float; stepUp: Float = 0.45): Boolean;
begin
  var grounded := false;
  for var iter := 0 to 2 do
    for var i := 0 to Colliders.Length - 1 do begin
      var c := Colliders[i];
      if (pos.x + radius <= c.Min.x) or (pos.x - radius >= c.Max.x) then continue;
      if (pos.z + radius <= c.Min.z) or (pos.z - radius >= c.Max.z) then continue;
      if (pos.y + height <= c.Min.y) or (pos.y >= c.Max.y) then continue;
      // penetration depths on each axis
      var top := c.Max.y - pos.y;
      if (top <= stepUp) and (vel.y <= 0.01) then begin
        pos.y := c.Max.y;
        if vel.y < 0 then vel.y := 0;
        grounded := true;
        continue;
      end;
      var px1 := c.Max.x - (pos.x - radius);
      var px2 := (pos.x + radius) - c.Min.x;
      var pz1 := c.Max.z - (pos.z - radius);
      var pz2 := (pos.z + radius) - c.Min.z;
      var py2 := (pos.y + height) - c.Min.y;
      var mx := MinF(px1, px2);
      var mz := MinF(pz1, pz2);
      if (py2 < mx) and (py2 < mz) and (py2 < 0.5) and (vel.y > 0) then begin
        pos.y := c.Min.y - height; vel.y := 0; continue;
      end;
      if mx < mz then begin
        pos.x := pos.x + (if px1 < px2 then px1 else -px2); vel.x := 0;
      end else begin
        pos.z := pos.z + (if pz1 < pz2 then pz1 else -pz2); vel.z := 0;
      end;
    end;
  if pos.y <= 0 then begin
    pos.y := 0;
    if vel.y < 0 then vel.y := 0;
    grounded := true;
  end;
  // ground probe: stand on something just below?
  if not grounded then
    for var c in Colliders do begin
      if (pos.x + radius * 0.7 <= c.Min.x) or (pos.x - radius * 0.7 >= c.Max.x) then continue;
      if (pos.z + radius * 0.7 <= c.Min.z) or (pos.z - radius * 0.7 >= c.Max.z) then continue;
      if (Abs(pos.y - c.Max.y) < 0.02) and (vel.y <= 0) then begin grounded := true; break; end;
    end;
  Result := grounded;
end;

initialization
  _m := JMatrix4.Create;
  _q := JQuaternion.Create;
  _s := V3Zero;
  _p := V3Zero;
  _e := JEuler.Create;
end.
