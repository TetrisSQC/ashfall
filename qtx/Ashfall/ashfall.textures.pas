unit ashfall.textures;

// Procedural PBR texture generation. Every map is tileable and produced at load time
// on a 2D canvas: albedo (sRGB), tangent-space normal (derived from a height field)
// and roughness. Cavity occlusion is baked into albedo.

interface

uses
  ashfall.host, ashfall.three;

type
  // per-texel output of a material function
  TTexel = class
  public
    R, G, B, H, Rough, Metal: Float;
  end;

  TTexelFunc = procedure(u, v: Float; o: TTexel);

  TPBRMaps = class
  public
    Map, NormalMap, RoughnessMap, MetalnessMap: JTexture;
  end;

  TDrawFunc = procedure(g: JCanvas2D; w, h: Integer);

const
  SIGN_COUNT = 12;

function FBM(u, v: Float; freq: Integer; oct: Integer = 5; seed: Integer = 1; gain: Float = 0.5): Float;
procedure SetAnisotropy(a: Integer);

function GenSidewalk(size: Integer = 1024): TPBRMaps;
function GenConcreteWall(size: Integer = 1024; tint: Integer = $b8b2a6): TPBRMaps;
function GenAsphalt(size: Integer = 1024): TPBRMaps;
function GenBrick(size: Integer = 1024; base: Integer = $8a4b36): TPBRMaps;
function GenPlaster(size: Integer = 1024; base: Integer = $c9b79a): TPBRMaps;
function GenCorrugated(size: Integer = 512; base: Integer = $3d5a4a): TPBRMaps;
function GenWood(size: Integer = 512; base: Integer = $8b6a45): TPBRMaps;
function GenCloth(size: Integer = 512; base: Integer = $8f7f5c): TPBRMaps;
function GenDirt(size: Integer = 1024): TPBRMaps;
function GenCarPaint(size: Integer = 512; base: Integer = $6b6f5e): TPBRMaps;
function GenCamo(size: Integer = 512): TPBRMaps;
function GenGunMetal(size: Integer = 256; base: Integer = $2a2b2d; roughBase: Float = 0.45): TPBRMaps;
function GenPolymer(size: Integer = 256; base: Integer = $2b2a27): TPBRMaps;
function GenRoof(size: Integer = 512): TPBRMaps;

function SpriteTex(kind: String): JTexture;
function SignTex(i: Integer): JTexture;
function GraffitiTex(i: Integer): JTexture;
function PosterTex(i: Integer): JTexture;
function LeafTex: JTexture;
function SkylineTex: JTexture;
function PaperTex: JTexture;

implementation

// ---------------------------------------------------------------- noise primitives
function Hash2(x, y, s: Integer): Float;
begin
  var h := IMul(x, 374761393) + IMul(y, 668265263) + IMul(s, 1442695041);
  h := IMul(h xor (h shr 13), 1274126177);
  h := h xor (h shr 16);
  // h is an int32 here; reinterpret as unsigned like (h >>> 0)
  if h < 0 then h := h + 4294967296;
  Result := h / 4294967295;
end;

// tileable value noise, period in lattice cells
function VNoise(x, y: Float; period, seed: Integer): Float;
begin
  var xi := Floor(x);
  var yi := Floor(y);
  var xf := x - xi;
  var yf := y - yi;
  var x0 := ((xi mod period) + period) mod period;
  var y0 := ((yi mod period) + period) mod period;
  var x1 := (x0 + 1) mod period;
  var y1 := (y0 + 1) mod period;
  var u := xf * xf * (3 - 2 * xf);
  var v := yf * yf * (3 - 2 * yf);
  var a := Hash2(x0, y0, seed);
  var b := Hash2(x1, y0, seed);
  var c := Hash2(x0, y1, seed);
  var d := Hash2(x1, y1, seed);
  Result := a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
end;

// fractal noise on the unit square, tileable. freq = integer base frequency
function FBM(u, v: Float; freq: Integer; oct: Integer = 5; seed: Integer = 1; gain: Float = 0.5): Float;
begin
  var sum := 0.0;
  var amp := 0.5;
  var norm := 0.0;
  var f := freq;
  for var i := 0 to oct - 1 do begin
    sum += VNoise(u * f, v * f, f, seed + i * 17) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  end;
  Result := sum / norm;
end;

function VNoise2(x, y: Float; px, py, seed: Integer): Float;
begin
  var xi := Floor(x);
  var yi := Floor(y);
  var xf := x - xi;
  var yf := y - yi;
  var x0 := ((xi mod px) + px) mod px;
  var y0 := ((yi mod py) + py) mod py;
  var x1 := (x0 + 1) mod px;
  var y1 := (y0 + 1) mod py;
  var u := xf * xf * (3 - 2 * xf);
  var v := yf * yf * (3 - 2 * yf);
  var a := Hash2(x0, y0, seed);
  var b := Hash2(x1, y0, seed);
  var c := Hash2(x0, y1, seed);
  var d := Hash2(x1, y1, seed);
  Result := a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
end;

// anisotropic fbm (different x/y frequencies), still tileable
function FBMA(u, v: Float; fx, fy, oct, seed: Integer): Float;
begin
  var sum := 0.0;
  var amp := 0.5;
  var norm := 0.0;
  for var i := 0 to oct - 1 do begin
    var px := fx shl i;
    var py := fy shl i;
    sum += VNoise2(u * px, v * py, px, py, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
  end;
  Result := sum / norm;
end;

// tileable worley: results in W0 (F1), W1 (F2), W2 (cell hash)
var W0, W1, W2: Float;

procedure Worley(u, v: Float; n, seed: Integer);
begin
  var x := u * n;
  var y := v * n;
  var xi := Floor(x);
  var yi := Floor(y);
  var f1 := 9.0;
  var f2 := 9.0;
  var id := 0.0;
  for var j := -1 to 1 do
    for var i := -1 to 1 do begin
      var cx := xi + i;
      var cy := yi + j;
      var wx := ((cx mod n) + n) mod n;
      var wy := ((cy mod n) + n) mod n;
      var px := cx + Hash2(wx, wy, seed);
      var py := cy + Hash2(wx, wy, seed + 7);
      var dx := px - x;
      var dy := py - y;
      var d := Sqrt(dx * dx + dy * dy);
      if d < f1 then begin
        f2 := f1; f1 := d; id := Hash2(wx, wy, seed + 13);
      end else if d < f2 then
        f2 := d;
    end;
  W0 := f1; W1 := f2; W2 := id;
end;

// ---------------------------------------------------------------- map builder
var MaxAniso: Integer = 8;

procedure SetAnisotropy(a: Integer);
begin
  MaxAniso := a;
end;

function MakeTex(c: JElement; srgb: Boolean; rep: Float): JTexture;
begin
  var t := JCanvasTexture.Create(c);
  t.wrapS := RepeatWrapping;
  t.wrapT := RepeatWrapping;
  t.anisotropy := MaxAniso;
  t.colorSpace := if srgb then SRGBColorSpace else NoColorSpace;
  t.&repeat.&set(rep, rep);
  t.generateMipmaps := true;
  t.minFilter := LinearMipmapLinearFilter;
  Result := t;
end;

function Build(size: Integer; fn: TTexelFunc; normal: Float = 2.0; cavity: Float = 0.6; rep: Float = 1): TPBRMaps;
begin
  var N := size * size;
  var col := JFloat32Array.Create(N * 3);
  var hgt := JFloat32Array.Create(N);
  var rgh := JFloat32Array.Create(N);
  var met := JFloat32Array.Create(N);
  var o := TTexel.Create;
  o.Rough := 0.8;
  for var y := 0 to size - 1 do begin
    var v := y / size;
    for var x := 0 to size - 1 do begin
      var u := x / size;
      o.Metal := 0;
      fn(u, v, o);
      var i := y * size + x;
      col[i * 3] := o.R; col[i * 3 + 1] := o.G; col[i * 3 + 2] := o.B;
      hgt[i] := o.H; rgh[i] := o.Rough; met[i] := o.Metal;
    end;
  end;
  var cA := NewCanvas(size, size);
  var cN := NewCanvas(size, size);
  var cR := NewCanvas(size, size);
  var ctxA := cA.getContext('2d');
  var ctxN := cN.getContext('2d');
  var ctxR := cR.getContext('2d');
  var imgA := ctxA.createImageData(size, size);
  var imgN := ctxN.createImageData(size, size);
  var imgR := ctxR.createImageData(size, size);
  var dA := imgA.data;
  var dN := imgN.data;
  var dR := imgR.data;
  var s := normal * size / 256;
  for var y := 0 to size - 1 do begin
    var ym := ((y - 1 + size) mod size) * size;
    var yp := ((y + 1) mod size) * size;
    var yc := y * size;
    for var x := 0 to size - 1 do begin
      var xm := (x - 1 + size) mod size;
      var xp := (x + 1) mod size;
      var i := yc + x;
      var dhdu := (hgt[yc + xp] - hgt[yc + xm]) * 0.5 * s;
      var dhdv := (hgt[ym + x] - hgt[yp + x]) * 0.5 * s;
      var nx := -dhdu;
      var ny := -dhdv;
      var nz := 1.0;
      var l := 1 / Sqrt(nx * nx + ny * ny + 1);
      nx *= l; ny *= l; nz *= l;
      var p := i * 4;
      dN[p] := (nx * 0.5 + 0.5) * 255; dN[p + 1] := (ny * 0.5 + 0.5) * 255; dN[p + 2] := (nz * 0.5 + 0.5) * 255; dN[p + 3] := 255;
      // cavity: compare with local average (cheap 4-tap laplacian)
      var avg := (hgt[yc + xp] + hgt[yc + xm] + hgt[ym + x] + hgt[yp + x]) * 0.25;
      var cav := ClampF(1 + (hgt[i] - avg) * cavity * size * 0.25, 0.55, 1.1);
      dA[p] := Clamp01(col[i * 3] * cav) * 255; dA[p + 1] := Clamp01(col[i * 3 + 1] * cav) * 255; dA[p + 2] := Clamp01(col[i * 3 + 2] * cav) * 255; dA[p + 3] := 255;
      dR[p] := met[i] * 255; dR[p + 1] := Clamp01(rgh[i]) * 255; dR[p + 2] := met[i] * 255; dR[p + 3] := 255;
    end;
  end;
  ctxA.putImageData(imgA, 0, 0); ctxN.putImageData(imgN, 0, 0); ctxR.putImageData(imgR, 0, 0);
  Result := TPBRMaps.Create;
  Result.Map := MakeTex(cA, true, rep);
  Result.NormalMap := MakeTex(cN, false, rep);
  Result.RoughnessMap := MakeTex(cR, false, rep);
  Result.MetalnessMap := MakeTex(cR, false, rep);
end;

// sRGB 0-255 helpers -> working values in 0..1 (we write sRGB into the canvas)
type
  TRGB = array [0..2] of Float;

function C(hex: Integer): TRGB;
begin
  Result[0] := ((hex shr 16) and 255) / 255;
  Result[1] := ((hex shr 8) and 255) / 255;
  Result[2] := (hex and 255) / 255;
end;

// ---------------------------------------------------------------- materials
// sidewalk slabs: 2x2 slabs per tile
function GenSidewalk(size: Integer = 1024): TPBRMaps;
begin
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var su := u * 2;
    var sv := v * 2;
    var fu := su - Floor(su);
    var fv := sv - Floor(sv);
    var edge := MinF(MinF(fu, 1 - fu), MinF(fv, 1 - fv));
    var seam := Smooth(0.004, 0.018, edge);
    var slab := Hash2(Floor(su), Floor(sv), 3);
    var n := FBM(u, v, 8, 6, 11);
    var fine := FBM(u, v, 64, 3, 5);
    Worley(u, v, 90, 9);
    var pit := if W0 < 0.12 then (0.12 - W0) * 3 else 0.0;
    var stain := Smooth(0.45, 0.8, FBM(u, v, 3, 5, 21));
    var g := 0.44 + (slab - 0.5) * 0.08 + (n - 0.5) * 0.18 + (fine - 0.5) * 0.08 - stain * 0.18;
    o.R := g * 0.99; o.G := g * 0.97; o.B := g * 0.93;
    o.H := seam * (0.7 + n * 0.25 + fine * 0.08) - pit * 0.6 + (1 - seam) * 0.0;
    o.Rough := 0.82 + fine * 0.12 - stain * 0.1 + (1 - seam) * 0.06;
  end, 3.2, 0.9);
end;

function GenConcreteWall(size: Integer = 1024; tint: Integer = $b8b2a6): TPBRMaps;
begin
  var t := C(tint);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 6, 6, 41);
    var fine := FBM(u, v, 48, 3, 43);
    var streak := FBMA(u, v, 24, 2, 4, 47);
    Worley(u, v, 60, 51);
    var pit := if W0 < 0.1 then (0.1 - W0) * 4 else 0.0;
    // formwork panel lines + tie holes
    var pv := v * 4;
    var fpv := pv - Floor(pv);
    var line := Smooth(0.0, 0.01, MinF(fpv, 1 - fpv));
    var hu := FMod(u * 4, 1);
    var hv := FMod(v * 4 + 0.5, 1);
    var hole := if Hypot(hu - 0.5, hv - 0.5) < 0.025 then 1.0 else 0.0;
    var dirt := Smooth(0.35, 0.9, streak) * (0.4 + 0.6 * Smooth(0.3, 0.7, n));
    var g := 0.85 + (n - 0.5) * 0.3 + (fine - 0.5) * 0.08 - dirt * 0.35 - hole * 0.5;
    o.R := t[0] * g; o.G := t[1] * g; o.B := t[2] * g;
    o.H := n * 0.3 + fine * 0.1 - pit * 0.5 - (1 - line) * 0.3 - hole * 0.6;
    o.Rough := 0.86 + fine * 0.1 - dirt * 0.08;
  end, 2.4, 0.8);
end;

function GenAsphalt(size: Integer = 1024): TPBRMaps;
begin
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 4, 6, 61);
    Worley(u, v, 180, 63);
    var grain := W1 - W0;
    var stone := Smooth(0.02, 0.12, grain);
    var shade := W2;
    var crackN := FBM(u, v, 5, 6, 67);
    var crack := 1 - Smooth(0.0, 0.012, Abs(crackN - 0.5));
    var crackMask := Smooth(0.45, 0.65, FBM(u, v, 3, 3, 69));
    var cr := crack * crackMask;
    var patch := Smooth(0.62, 0.64, FBM(u, v, 2, 3, 71));
    var pN := FBM(u, v, 2, 5, 73);
    var puddle := Smooth(0.7, 0.73, pN);
    var wet := Smooth(0.6, 0.7, pN);
    var g := 0.16 + (n - 0.5) * 0.06 + stone * (0.05 + shade * 0.12) - patch * 0.04;
    g *= 1 - cr * 0.7;
    g *= 1 - wet * 0.3;
    o.R := g * 1.0; o.G := g * 0.99; o.B := g * 0.97;
    o.H := stone * 0.25 + n * 0.2 - cr * 0.8 + patch * 0.05 - puddle * stone * 0.25;
    o.Rough := Mix(Mix(0.8 + (1 - stone) * 0.12, 0.45, wet), 0.05, puddle) + cr * 0.1;
  end, 2.2, 0.7);
end;

function GenBrick(size: Integer = 1024; base: Integer = $8a4b36): TPBRMaps;
begin
  var bc := C(base);
  var rows := 16;
  var cols := 4;
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var rv := v * rows;
    var row := Floor(rv);
    var off := (row mod 2) * 0.5;
    var cu := u * cols + off;
    var col := Floor(cu);
    var fu := cu - col;
    var fv := rv - row;
    var mortarW := 0.035;
    var mortarH := 0.12;
    var eu := MinF(fu, 1 - fu);
    var ev := MinF(fv, 1 - fv);
    var inBrick := Smooth(mortarW * 0.5, mortarW, eu) * Smooth(mortarH * 0.5, mortarH, ev);
    var id := Hash2(((col mod cols) + cols) mod cols, row, 91);
    var id2 := Hash2(((col mod cols) + cols) mod cols, row, 97);
    var n := FBM(u, v, 16, 5, 93);
    var fine := FBM(u, v, 96, 2, 95);
    var soot := Smooth(0.4, 0.85, FBMA(u, v, 6, 2, 5, 99));
    var chip := Smooth(0.72, 0.78, FBM(u, v, 24, 4, 101)) * inBrick;
    var bright := 0.75 + id * 0.45 - (if id2 > 0.88 then 0.35 else 0.0);
    var r := bc[0] * bright;
    var g := bc[1] * bright * (0.92 + id2 * 0.16);
    var b := bc[2] * bright;
    var m := 0.62 + (n - 0.5) * 0.2;
    r := Mix(m, r, inBrick); g := Mix(m * 0.97, g, inBrick); b := Mix(m * 0.9, b, inBrick);
    var k := (1 - soot * 0.55) * (0.9 + fine * 0.2) * (1 - chip * 0.25);
    o.R := r * k; o.G := g * k; o.B := b * k;
    o.H := inBrick * (0.55 + n * 0.25 + fine * 0.1) - chip * 0.3;
    o.Rough := Mix(0.95, 0.8 + fine * 0.1, inBrick);
  end, 3.0, 0.8);
end;

function GenPlaster(size: Integer = 1024; base: Integer = $c9b79a): TPBRMaps;
begin
  var bc := C(base);
  var brick := C($7a5646);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 8, 6, 111);
    var fine := FBM(u, v, 80, 3, 113);
    var streak := FBMA(u, v, 30, 3, 4, 117);
    var chipN := FBM(u, v, 6, 6, 119);
    var chip := Smooth(0.765, 0.775, chipN);
    var chipEdge := Smooth(0.745, 0.765, chipN) - chip;
    var grime := Smooth(0.35, 1.0, streak) * Smooth(0.2, 0.9, v * 0.4 + n * 0.6);
    var k := 0.9 + (n - 0.5) * 0.18 + (fine - 0.5) * 0.08 - grime * 0.4;
    // exposed brick under chipped plaster
    var rv := v * 24;
    var row := Floor(rv);
    var cu := u * 6 + (row mod 2) * 0.5;
    var fb := if (MinF(FMod(cu, 1), 1 - FMod(cu, 1)) > 0.04) and (MinF(FMod(rv, 1), 1 - FMod(rv, 1)) > 0.1) then 1.0 else 0.0;
    var br := Mix(0.55, 1, fb);
    o.R := Mix(bc[0] * k, brick[0] * br * 0.85, chip);
    o.G := Mix(bc[1] * k, brick[1] * br * 0.85, chip);
    o.B := Mix(bc[2] * k, brick[2] * br * 0.85, chip);
    o.R *= 1 - chipEdge * 0.25; o.G *= 1 - chipEdge * 0.25; o.B *= 1 - chipEdge * 0.25;
    o.H := (1 - chip) * (0.6 + fine * 0.12 + n * 0.1) + chip * fb * 0.25;
    o.Rough := 0.9 + fine * 0.08;
  end, 2.6, 0.9);
end;

function GenCorrugated(size: Integer = 512; base: Integer = $3d5a4a): TPBRMaps;
begin
  var bc := C(base);
  var rust := C($5e4130);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var ridge := Sin(u * PI * 2 * 12);
    var n := FBM(u, v, 6, 6, 131);
    var fine := FBM(u, v, 64, 3, 133);
    var rustM := Smooth(0.7, 0.85, FBM(u, v, 5, 6, 137) + (1 - v) * 0.12 * FBMA(u, v, 16, 2, 3, 139));
    var scratch := Smooth(0.985, 1, FBMA(u, v, 2, 64, 3, 141));
    var streak := Smooth(0.5, 0.9, FBMA(u, v, 32, 2, 3, 143));
    var pk := 0.9 + (n - 0.5) * 0.2 - streak * 0.2;
    var rk := 0.7 + fine * 0.5;
    o.R := Mix(bc[0] * pk, rust[0] * rk, rustM) + scratch * 0.25;
    o.G := Mix(bc[1] * pk, rust[1] * rk, rustM) + scratch * 0.25;
    o.B := Mix(bc[2] * pk, rust[2] * rk, rustM) + scratch * 0.25;
    o.H := ridge * 0.5 + 0.5 + rustM * fine * 0.25;
    o.Rough := Mix(0.55 + fine * 0.15, 0.92, rustM) - scratch * 0.2;
    o.Metal := Mix(0.25, 0.0, rustM) + scratch * 0.6;
  end, 1.4, 0.3);
end;

function GenWood(size: Integer = 512; base: Integer = $8b6a45): TPBRMaps;
begin
  var bc := C(base);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var planks := 5;
    var pv := v * planks;
    var pln := Floor(pv);
    var fv := pv - pln;
    var gap := Smooth(0.0, 0.04, MinF(fv, 1 - fv));
    var id := Hash2(pln, 0, 151);
    var grain := FBMA(u + id, v, 2, 48, 5, 153 + pln);
    var ring := Sin((grain * 12 + fv * 3) * PI) * 0.5 + 0.5;
    Worley(u, v, 5, 155);
    var knot := Smooth(0.08, 0.0, W0);
    var dirt := Smooth(0.5, 0.9, FBM(u, v, 4, 5, 157));
    var k := (0.75 + id * 0.35) * (0.85 + ring * 0.2) * (1 - knot * 0.5) * (1 - dirt * 0.3);
    o.R := bc[0] * k; o.G := bc[1] * k; o.B := bc[2] * k;
    o.R *= Mix(0.3, 1, gap); o.G *= Mix(0.3, 1, gap); o.B *= Mix(0.3, 1, gap);
    o.H := gap * (0.6 + ring * 0.1) - knot * 0.1;
    o.Rough := 0.8 + ring * 0.1;
  end, 2.5, 0.6);
end;

function GenCloth(size: Integer = 512; base: Integer = $8f7f5c): TPBRMaps;
begin
  var bc := C(base);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var f := 160;
    var wu := Sin(u * PI * 2 * f);
    var wv := Sin(v * PI * 2 * f);
    var weave := if (Sin(u * PI * 2 * f) > 0) = (Sin(v * PI * 2 * f) > 0) then wu else wv;
    var n := FBM(u, v, 6, 6, 171);
    var dirt := Smooth(0.4, 0.9, FBM(u, v, 3, 5, 173));
    var k := 0.85 + weave * 0.08 + (n - 0.5) * 0.25 - dirt * 0.35;
    o.R := bc[0] * k; o.G := bc[1] * k; o.B := bc[2] * k;
    o.H := weave * 0.15 + n * 0.6;
    o.Rough := 0.95;
  end, 2.5, 0.5);
end;

function GenDirt(size: Integer = 1024): TPBRMaps;
begin
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 6, 7, 181);
    Worley(u, v, 40, 183);
    var rock := Smooth(0.18, 0.05, W0) * Smooth(0.45, 0.7, FBM(u, v, 4, 4, 185));
    // the original reuses one result array for both worley calls, so the cell hash
    // used for the rock colour below comes from the second (pebble) lookup
    Worley(u, v, 140, 187);
    var pebble := Smooth(0.2, 0.05, W0);
    var dark := Smooth(0.4, 0.8, FBM(u, v, 3, 5, 189));
    var g := 0.42 + (n - 0.5) * 0.3 - dark * 0.12;
    var rr := 0.5 + W2 * 0.2;
    o.R := Mix(Mix(g * 1.0, g * 0.9 + 0.05, pebble * 0.5), rr, rock);
    o.G := Mix(Mix(g * 0.86, g * 0.84 + 0.05, pebble * 0.5), rr * 0.96, rock);
    o.B := Mix(Mix(g * 0.68, g * 0.75 + 0.05, pebble * 0.5), rr * 0.9, rock);
    o.H := n * 0.5 + rock * 0.8 + pebble * 0.2;
    o.Rough := 0.95 - rock * 0.1;
  end, 3.0, 0.8);
end;

function GenCarPaint(size: Integer = 512; base: Integer = $6b6f5e): TPBRMaps;
begin
  var bc := C(base);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 4, 5, 191);
    var dust := Smooth(0.35, 0.8, FBM(u, v, 5, 6, 193));
    var rust := Smooth(0.7, 0.78, FBM(u, v, 6, 6, 197));
    var scratch := Smooth(0.975, 1, FBMA(u, v, 64, 3, 3, 199)) + Smooth(0.98, 1, FBMA(u, v, 3, 64, 3, 201));
    var k := 0.9 + (n - 0.5) * 0.1;
    o.R := Mix(Mix(bc[0] * k, 0.45, dust * 0.6), 0.38, rust) + scratch * 0.2;
    o.G := Mix(Mix(bc[1] * k, 0.4, dust * 0.6), 0.2, rust) + scratch * 0.2;
    o.B := Mix(Mix(bc[2] * k, 0.33, dust * 0.6), 0.1, rust) + scratch * 0.2;
    o.H := rust * FBM(u, v, 40, 3, 203) * 0.8 - scratch * 0.2;
    o.Rough := Mix(Mix(0.32, 0.85, dust), 0.95, rust);
    o.Metal := Mix(0.4, 0.0, MaxF(dust, rust)) + scratch * 0.5;
  end, 2.0, 0.4);
end;

function GenCamo(size: Integer = 512): TPBRMaps;
begin
  var c0 := C($6d6b4e);
  var c1 := C($4b4a35);
  var c2 := C($8a7d5c);
  var c3 := C($2f2e24);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var a := FBM(u, v, 4, 5, 211);
    var b := FBM(u, v, 6, 5, 213);
    var c := FBM(u, v, 8, 4, 217);
    var k := c0;
    if a > 0.55 then k := c1;
    if b > 0.6 then k := c2;
    if c > 0.62 then k := c3;
    var f := 160;
    var weave := Sin(u * PI * 2 * f) * Sin(v * PI * 2 * f);
    var n := FBM(u, v, 32, 3, 219);
    var s := 0.9 + weave * 0.05 + (n - 0.5) * 0.15;
    o.R := k[0] * s; o.G := k[1] * s; o.B := k[2] * s;
    o.H := weave * 0.2 + FBM(u, v, 5, 5, 221) * 0.8;
    o.Rough := 0.95;
  end, 2.0, 0.4);
end;

function GenGunMetal(size: Integer = 256; base: Integer = $2a2b2d; roughBase: Float = 0.45): TPBRMaps;
begin
  var bc := C(base);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 8, 5, 231);
    var fine := FBM(u, v, 64, 3, 233);
    var wear := Smooth(0.7, 0.85, FBM(u, v, 5, 5, 237));
    var k := 0.9 + (n - 0.5) * 0.2;
    o.R := Mix(bc[0] * k, 0.55, wear * 0.5); o.G := Mix(bc[1] * k, 0.55, wear * 0.5); o.B := Mix(bc[2] * k, 0.55, wear * 0.5);
    o.H := fine * 0.15 + n * 0.1;
    o.Rough := roughBase + fine * 0.15 - wear * 0.15;
    o.Metal := 0.5 + wear * 0.5;
  end, 0.8, 0.2);
end;

function GenPolymer(size: Integer = 256; base: Integer = $2b2a27): TPBRMaps;
begin
  var bc := C(base);
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var stipple := FBM(u, v, 96, 2, 241);
    var n := FBM(u, v, 6, 4, 243);
    var k := 0.92 + (n - 0.5) * 0.15;
    o.R := bc[0] * k; o.G := bc[1] * k; o.B := bc[2] * k;
    o.H := stipple * 0.5;
    o.Rough := 0.62 + stipple * 0.2;
  end, 1.5, 0.2);
end;

function GenRoof(size: Integer = 512): TPBRMaps;
begin
  Result := Build(size, procedure(u, v: Float; o: TTexel)
  begin
    var n := FBM(u, v, 5, 6, 251);
    var fine := FBM(u, v, 80, 3, 253);
    var g := 0.25 + (n - 0.5) * 0.12 + fine * 0.05;
    o.R := g; o.G := g * 0.98; o.B := g * 0.95;
    o.H := fine * 0.5 + n * 0.3;
    o.Rough := 0.9;
  end, 2.0);
end;

// ---------------------------------------------------------------- sprites / small canvases
function Canvas(w, h: Integer; draw: TDrawFunc): JElement;
begin
  Result := NewCanvas(w, h);
  draw(Result.getContext('2d'), w, h);
end;

function SrgbTex(c: JElement): JTexture;
begin
  Result := JCanvasTexture.Create(c);
  Result.colorSpace := SRGBColorSpace;
end;

function SpriteTex(kind: String): JTexture;
var
  c: JElement;
begin
  case kind of
    'smoke':
      c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var img := g.createImageData(w, h);
        var d := img.data;
        for var y := 0 to h - 1 do
          for var x := 0 to w - 1 do begin
            var u := x / w;
            var v := y / h;
            var dd := Hypot(u - 0.5, v - 0.5) * 2;
            var n := FBM(u, v, 4, 5, 301);
            var a := Clamp01((1 - dd) * 1.6 - (1 - n) * 0.9);
            var p := (y * w + x) * 4;
            var s := 200 + n * 55;
            d[p] := s; d[p + 1] := s; d[p + 2] := s; d[p + 3] := a * a * 255;
          end;
        g.putImageData(img, 0, 0);
      end);
    'flash':
      c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
      begin
        g.translate(w / 2, h / 2);
        var grd := g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
        grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.12, 'rgba(255,230,160,0.95)');
        grd.addColorStop(0.35, 'rgba(255,150,40,0.45)'); grd.addColorStop(1, 'rgba(255,90,0,0)');
        g.fillStyle := grd; g.beginPath; g.arc(0, 0, w / 2, 0, PI * 2); g.fill;
        g.globalCompositeOperation := 'lighter';
        for var i := 0 to 6 do begin
          g.rotate((PI * 2) / 7 + Rnd * 0.3);
          var lg := g.createLinearGradient(0, 0, w / 2, 0);
          lg.addColorStop(0, 'rgba(255,240,200,0.9)'); lg.addColorStop(1, 'rgba(255,120,20,0)');
          g.fillStyle := lg;
          g.beginPath; g.moveTo(0, -6); g.lineTo(w * (0.32 + Rnd * 0.18), 0); g.lineTo(0, 6); g.fill;
        end;
      end);
    'flashSide':
      c := Canvas(256, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var grd := g.createLinearGradient(0, 0, w, 0);
        grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.3, 'rgba(255,200,90,0.8)'); grd.addColorStop(1, 'rgba(255,90,0,0)');
        g.fillStyle := grd;
        g.beginPath; g.moveTo(0, h / 2 - 14);
        for var i := 0 to 10 do begin
          var x := (i / 10) * w;
          var hh := (1 - i / 10) * (h / 2) * (0.5 + Rnd * 0.5);
          g.lineTo(x, h / 2 - hh);
        end;
        for var i := 10 downto 0 do begin
          var x := (i / 10) * w;
          var hh := (1 - i / 10) * (h / 2) * (0.5 + Rnd * 0.5);
          g.lineTo(x, h / 2 + hh);
        end;
        g.fill;
      end);
    'spark':
      c := Canvas(64, 64, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var grd := g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,220,150,0.9)'); grd.addColorStop(1, 'rgba(255,120,0,0)');
        g.fillStyle := grd; g.fillRect(0, 0, w, h);
      end);
    'fire':
      c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var img := g.createImageData(w, h);
        var d := img.data;
        for var y := 0 to h - 1 do
          for var x := 0 to w - 1 do begin
            var u := x / w;
            var v := y / h;
            var vv := 1 - v; // 0 bottom .. 1 top (canvas y down)
            var width := 0.36 * Power(MaxF(0, 1 - vv), 0.7) * (0.6 + 0.4 * Sin(vv * 3.14));
            var n := FBM(u, v * 0.7, 5, 5, 311);
            var dx := Abs(u - 0.5 + (n - 0.5) * 0.25 * vv);
            var core := Clamp01(1 - dx / (width + 0.001));
            var a := Clamp01(Power(core, 1.2) * (0.6 + n * 0.8) * Smooth(0.0, 0.18, vv + 0.05));
            var p := (y * w + x) * 4;
            d[p] := 255; d[p + 1] := 170 + core * 85; d[p + 2] := 90 + core * 140; d[p + 3] := a * 255;
          end;
        g.putImageData(img, 0, 0);
      end);
    'blood':
      c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        for var i := 0 to 17 do begin
          var r := 6 + Rnd * 22;
          var x := w / 2 + (Rnd - 0.5) * 60;
          var y := h / 2 + (Rnd - 0.5) * 60;
          var grd := g.createRadialGradient(x, y, 0, x, y, r);
          grd.addColorStop(0, 'rgba(120,6,4,0.9)'); grd.addColorStop(1, 'rgba(90,0,0,0)');
          g.fillStyle := grd; g.beginPath; g.arc(x, y, r, 0, PI * 2); g.fill;
        end;
      end);
    'hole':
      c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var cx := w / 2;
        var cy := h / 2;
        // scorched ring / chipped material
        for var i := 0 to 25 do begin
          var a := Rnd * PI * 2;
          var r := 10 + Rnd * 38;
          g.fillStyle := 'rgba(20,18,16,' + Num(0.08 + Rnd * 0.15) + ')';
          g.beginPath; g.ellipse(cx + Cos(a) * r * 0.4, cy + Sin(a) * r * 0.4, r * 0.5, r * 0.2, a, 0, PI * 2); g.fill;
        end;
        var grd := g.createRadialGradient(cx, cy, 0, cx, cy, 30);
        grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.35, 'rgba(10,8,6,0.95)'); grd.addColorStop(0.6, 'rgba(60,55,50,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle := grd; g.beginPath; g.arc(cx, cy, 30, 0, PI * 2); g.fill;
      end);
    'scorch':
      c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var img := g.createImageData(w, h);
        var d := img.data;
        for var y := 0 to h - 1 do
          for var x := 0 to w - 1 do begin
            var u := x / w;
            var v := y / h;
            var dd := Hypot(u - 0.5, v - 0.5) * 2;
            var n := FBM(u, v, 5, 5, 321);
            var a := Clamp01((1 - dd) * 1.4 - (1 - n) * 0.5);
            var p := (y * w + x) * 4;
            d[p] := 12; d[p + 1] := 10; d[p + 2] := 8; d[p + 3] := a * 235;
          end;
        g.putImageData(img, 0, 0);
      end);
    'glow':
      c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var grd := g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle := grd; g.fillRect(0, 0, w, h);
      end);
    'reddot':
      c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
      begin
        var grd := g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 16);
        grd.addColorStop(0, 'rgba(255,90,70,1)'); grd.addColorStop(0.35, 'rgba(255,40,25,1)'); grd.addColorStop(0.55, 'rgba(255,20,10,0.35)'); grd.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle := grd; g.beginPath; g.arc(w / 2, h / 2, 16, 0, PI * 2); g.fill;
      end);
    'window':
      // interior silhouette texture for dark rooms behind glass
      c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
      begin
        g.fillStyle := '#2a2520'; g.fillRect(0, 0, w, h);
        var grd := g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, 'rgba(90,78,62,0.6)'); grd.addColorStop(1, 'rgba(15,12,10,0.4)');
        g.fillStyle := grd; g.fillRect(0, 0, w, h);
        g.fillStyle := 'rgba(0,0,0,0.6)';
        g.fillRect(w * 0.1, h * 0.55, w * 0.35, h * 0.45);
        g.fillRect(w * 0.6, h * 0.3, w * 0.25, h * 0.7);
        g.fillStyle := 'rgba(120,100,80,0.18)';
        g.fillRect(0, 0, w * 0.08, h); g.fillRect(w * 0.92, 0, w * 0.08, h);
      end);
  end;
  Result := SrgbTex(c);
end;

// ---------------------------------------------------------------- signage / decals / foliage
type
  TShop = record
    En, Ar, Bg, Fg: String;
  end;

const SHOPS: array [0..SIGN_COUNT - 1] of TShop = (
  (En: 'PHARMACY'; Ar: #$0635#$064A#$062F#$0644#$064A#$0629; Bg: '#1f6f4a'; Fg: '#f2efe6'),
  (En: 'CAFE AL-NOOR'; Ar: #$0645#$0642#$0647#$0649#$0020#$0627#$0644#$0646#$0648#$0631; Bg: '#7a2e1f'; Fg: '#f5d9a8'),
  (En: 'MARKET'; Ar: #$0633#$0648#$0642; Bg: '#1d3f73'; Fg: '#ffffff'),
  (En: 'HOTEL SAFA'; Ar: #$0641#$0646#$062F#$0642#$0020#$0627#$0644#$0635#$0641#$0627; Bg: '#2b2b2b'; Fg: '#e8c46a'),
  (En: 'BAKERY'; Ar: #$0645#$062E#$0628#$0632; Bg: '#b8741a'; Fg: '#fff4dc'),
  (En: 'ELECTRONICS'; Ar: #$0625#$0644#$0643#$062A#$0631#$0648#$0646#$064A#$0627#$062A; Bg: '#0f5c7a'; Fg: '#f0f0f0'),
  (En: 'TAILOR'; Ar: #$062E#$064A#$0627#$0637; Bg: '#5a3a6e'; Fg: '#f5ecd7'),
  (En: 'AUTO PARTS'; Ar: #$0642#$0637#$0639#$0020#$063A#$064A#$0627#$0631; Bg: '#a31f1f'; Fg: '#ffffff'),
  (En: 'MOBILE'; Ar: #$0645#$0648#$0628#$0627#$064A#$0644; Bg: '#e0b400'; Fg: '#1a1a1a'),
  (En: 'RESTAURANT'; Ar: #$0645#$0637#$0639#$0645; Bg: '#6e1d1d'; Fg: '#ffe9b0'),
  (En: 'BARBER'; Ar: #$062D#$0644#$0627#$0642; Bg: '#e8e2d0'; Fg: '#233a6b'),
  (En: 'EXCHANGE'; Ar: #$0635#$0631#$0627#$0641#$0629; Bg: '#1b4d2e'; Fg: '#f7e27a')
);

procedure Weather(g: JCanvas2D; w, h: Integer; amt: Float; seed: Integer);
begin
  var img := g.getImageData(0, 0, w, h);
  var d := img.data;
  for var y := 0 to h - 1 do
    for var x := 0 to w - 1 do begin
      var u := x / w;
      var v := y / h;
      var n := FBM(u, v * (h / w), 6, 5, seed);
      var streak := FBMA(u, v, 32, 2, 3, seed + 3);
      var dirt := Smooth(0.45, 0.85, n * 0.7 + streak * 0.5 * v) * amt;
      var rust := Smooth(0.72, 0.8, FBM(u, v, 8, 4, seed + 9)) * amt;
      var p := (y * w + x) * 4;
      d[p] := Mix(d[p], 70, dirt * 0.6) * (1 - rust * 0.4) + rust * 60;
      d[p + 1] := Mix(d[p + 1], 60, dirt * 0.6) * (1 - rust * 0.5) + rust * 25;
      d[p + 2] := Mix(d[p + 2], 50, dirt * 0.6) * (1 - rust * 0.6);
    end;
  g.putImageData(img, 0, 0);
end;

function AnisoTex(c: JElement): JTexture;
begin
  Result := SrgbTex(c);
  Result.anisotropy := MaxAniso;
end;

function SignTex(i: Integer): JTexture;
begin
  var shop := SHOPS[i mod SIGN_COUNT];
  var c := Canvas(512, 128, procedure(g: JCanvas2D; w, h: Integer)
  begin
    g.fillStyle := shop.Bg; g.fillRect(0, 0, w, h);
    g.strokeStyle := shop.Fg; g.globalAlpha := 0.6; g.lineWidth := 4; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha := 1;
    g.fillStyle := shop.Fg; g.textAlign := 'center'; g.textBaseline := 'middle';
    g.font := 'bold 52px "Arial Black", Impact, sans-serif';
    g.fillText(shop.En, w * 0.36, h * 0.52, w * 0.6);
    g.font := 'bold 50px "Geeza Pro", "Noto Naskh Arabic", "Arial", sans-serif';
    g.fillText(shop.Ar, w * 0.82, h * 0.52, w * 0.3);
    Weather(g, w, h, 1, 400 + i * 7);
  end);
  Result := AnisoTex(c);
end;

function GraffitiTex(i: Integer): JTexture;
begin
  var c := Canvas(512, 256, procedure(g: JCanvas2D; w, h: Integer)
  begin
    var seed := 1000 + i * 17;
    var R := function: Float
      begin
        seed := (seed * 16807) mod 2147483647;
        Result := seed / 2147483647;
      end;
    var cols: array of String := ['#c1121f', '#e36414', '#e9c46a', '#2a9d8f', '#f1faee', '#111111', '#3a86ff', '#8338ec'];
    var words: array of String := ['FREEDOM', 'NO WAR', 'RESIST', 'ZONE 7', 'HOPE', #$062D#$0631#$064A#$0629, 'ASHFALL', 'LIVE'];
    var word := words[i mod words.Length];
    g.textAlign := 'center'; g.textBaseline := 'middle';
    g.save; g.translate(w / 2, h / 2); g.rotate((R() - 0.5) * 0.18);
    g.font := 'bold ' + Num(100 + R() * 30) + 'px "Marker Felt", "Chalkboard SE", "Arial Black", sans-serif';
    var outline := cols[Floor(R() * cols.Length)];
    var fill := cols[Floor(R() * cols.Length)];
    g.shadowColor := outline; g.shadowBlur := 18;
    g.lineWidth := 16; g.strokeStyle := outline; g.strokeText(word, 0, 0, w * 0.92);
    g.shadowBlur := 6; g.shadowColor := fill;
    g.fillStyle := fill; g.fillText(word, 0, 0, w * 0.92);
    g.restore;
    // drips
    g.globalAlpha := 0.55; g.fillStyle := fill;
    for var k := 0 to 9 do begin
      var x := 60 + R() * (w - 120);
      g.fillRect(x, h * 0.62, 2.5, 10 + R() * 50);
    end;
    g.globalAlpha := 1;
    // weather: erode paint with noise
    var img := g.getImageData(0, 0, w, h);
    var d := img.data;
    for var y := 0 to h - 1 do
      for var x := 0 to w - 1 do begin
        var p := (y * w + x) * 4;
        var n := FBM(x / w, y / h, 8, 4, 900 + i);
        d[p + 3] := d[p + 3] * Clamp01(0.35 + n * 1.1) * 0.9;
      end;
    g.putImageData(img, 0, 0);
  end);
  Result := AnisoTex(c);
end;

function PosterTex(i: Integer): JTexture;
begin
  var c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
  begin
    var n := 1 + (i mod 2);
    var pal0, pal1: String;
    case i mod 4 of
      0: begin pal0 := '#b23a2b'; pal1 := '#f1e3c6'; end;
      1: begin pal0 := '#2d4a3e'; pal1 := '#e9dfc4'; end;
      2: begin pal0 := '#1f3a5f'; pal1 := '#efe6d0'; end;
    else
      pal0 := '#6b4b2a'; pal1 := '#f3e7cf';
    end;
    var words: array of String := ['UNITY', 'VOTE', 'SERVE', 'STAND'];
    for var k := 0 to n - 1 do begin
      var pw := (w - 16) / n - 6;
      var x := 8 + k * (pw + 6);
      var y := 10 + k * 8;
      var ph := h - 30;
      g.fillStyle := pal1; g.fillRect(x, y, pw, ph);
      g.fillStyle := pal0; g.fillRect(x, y, pw, ph * 0.22);
      g.fillStyle := pal1; g.font := 'bold ' + IntStr(Floor(pw / 6)) + 'px "Arial Black", Impact, sans-serif'; g.textAlign := 'center';
      g.fillText(words[(i + k) mod 4], x + pw / 2, y + ph * 0.16, pw - 10);
      // portrait silhouette
      g.fillStyle := pal0; g.globalAlpha := 0.85;
      g.beginPath; g.arc(x + pw / 2, y + ph * 0.45, pw * 0.14, 0, PI * 2); g.fill;
      g.beginPath; g.ellipse(x + pw / 2, y + ph * 0.72, pw * 0.3, pw * 0.2, 0, PI, 0); g.fill;
      g.globalAlpha := 1;
      g.fillStyle := 'rgba(30,30,30,0.7)';
      for var l := 0 to 2 do g.fillRect(x + pw * 0.15, y + ph * 0.8 + l * 9, pw * 0.7 * (1 - l * 0.15), 4);
      // torn corner
      g.clearRect(x + pw - 16 - k * 6, y, 16 + k * 6, 12 + k * 4);
    end;
    Weather(g, w, h, 0.9, 600 + i);
  end);
  Result := AnisoTex(c);
end;

function LeafTex: JTexture;
begin
  var c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
  begin
    for var k := 0 to 69 do begin
      var x := 20 + Rnd * (w - 40);
      var y := 20 + Rnd * (h - 40);
      var s := 9 + Rnd * 12;
      var a := Rnd * PI * 2;
      var shade := 0.55 + Rnd * 0.45;
      g.fillStyle := 'rgb(' + IntStr(Floor(92 * shade)) + ', ' + IntStr(Floor(104 * shade)) + ', ' + IntStr(Floor(46 * shade)) + ')';
      g.save; g.translate(x, y); g.rotate(a);
      g.beginPath; g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.55, s, 0); g.quadraticCurveTo(0, s * 0.55, -s, 0); g.fill;
      g.restore;
    end;
  end);
  Result := AnisoTex(c);
end;

function SkylineTex: JTexture;
begin
  var c := Canvas(256, 256, procedure(g: JCanvas2D; w, h: Integer)
  begin
    g.fillStyle := '#8c857a'; g.fillRect(0, 0, w, h);
    for var fy := 0 to 7 do
      for var fx := 0 to 7 do begin
        var lit := Rnd;
        g.fillStyle := if lit < 0.06 then '#c9a46a' else if lit < 0.5 then '#2b2c2e' else '#3a3b3c';
        g.fillRect(fx * 32 + 9, fy * 32 + 8, 14, 17);
      end;
    g.fillStyle := 'rgba(0,0,0,0.15)';
    for var fy := 0 to 7 do g.fillRect(0, fy * 32 + 28, w, 3);
  end);
  Result := AnisoTex(c);
  Result.wrapS := RepeatWrapping;
  Result.wrapT := RepeatWrapping;
end;

function PaperTex: JTexture;
begin
  var c := Canvas(128, 128, procedure(g: JCanvas2D; w, h: Integer)
  begin
    g.fillStyle := '#d9d2c3'; g.fillRect(0, 0, w, h);
    g.fillStyle := 'rgba(40,40,40,0.5)';
    for var l := 0 to 9 do g.fillRect(12, 14 + l * 10, 60 + Rnd * 44, 3);
    Weather(g, w, h, 1, 777);
  end);
  Result := SrgbTex(c);
end;

end.
