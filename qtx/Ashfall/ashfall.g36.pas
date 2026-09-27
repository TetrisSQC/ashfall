unit ashfall.g36;

// Decoding helpers for the baked HK G36 mesh data. The data itself stays in the
// generated g36data.js ("Low-Poly HK G36" by TastyTony, CC-BY-4.0), which index.html
// loads and publishes as window.G36.

interface

uses
  ashfall.host, ashfall.three;

type
  JG36Chunk = class external 'Object'
  public
    m: String;                 // source material name
    c: array of Float;         // base colour
    min, max: array of Float;  // quantization bounds
    p, n, i: String;           // base64 positions (uint16), normals (int8), indices (uint16)
  end;

  JG36Data = class external 'Object'
  public
    body, bolt, mag: array of JG36Chunk;
  end;

var G36 external 'G36': JG36Data;

function DecodeChunk(c: JG36Chunk): JBufferGeometry;

implementation

function B64Buffer(str: String): JArrayBuffer;
begin
  var bin := Atob(str);
  var u := JUint8Array.Create(bin.Length);
  for var k := 0 to bin.Length - 1 do u[k] := CharCode(bin, k);
  Result := u.buffer;
end;

// dequantize one baked material chunk into a BufferGeometry
function DecodeChunk(c: JG36Chunk): JBufferGeometry;
begin
  var q := JUint16Array.Create(B64Buffer(c.p));
  var n := JInt8Array.Create(B64Buffer(c.n));
  var idx := JUint16Array.Create(B64Buffer(c.i));
  var pos := JFloat32Array.Create(q.&length);
  var nrm := JFloat32Array.Create(n.&length);
  for var k := 0 to q.&length - 1 do begin
    var a := k mod 3;
    pos[k] := c.min[a] + (q[k] / 65535) * (c.max[a] - c.min[a]);
  end;
  for var k := 0 to n.&length - 1 do nrm[k] := n[k] / 127;
  var g := JBufferGeometry.Create;
  g.setAttribute('position', JBufferAttribute.Create(pos, 3));
  g.setAttribute('normal', JBufferAttribute.Create(nrm, 3));
  g.setIndex(JBufferAttribute.Create(idx, 1));
  Result := g;
end;

end.
