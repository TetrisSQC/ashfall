unit ashfall.host;

// Browser host bindings: DOM, canvas 2D, WebAudio, typed arrays, timers, and the
// small math helpers shared by every other unit. Written against the raw browser
// API (no RTL widgets) so the generated JavaScript stays close to the original.

interface

type
  TProc = procedure;
  TFrameProc = procedure(now: Float);

  // ---------------------------------------------------------------- typed arrays
  JArrayBuffer = class external 'ArrayBuffer'
  public
    byteLength: Integer;
  end;

  JFloat32Array = class external 'Float32Array'
  public
    &length: Integer;
    buffer: JArrayBuffer;
    function GetItem(i: Integer): Float; external array;
    procedure SetItem(i: Integer; v: Float); external array;
    property Items[i: Integer]: Float read GetItem write SetItem; default;
    constructor Create(n: Integer); overload;
    constructor Create(buf: JArrayBuffer); overload;
  end;

  JInt8Array = class external 'Int8Array'
  public
    &length: Integer;
    function GetItem(i: Integer): Integer; external array;
    property Items[i: Integer]: Integer read GetItem; default;
    constructor Create(buf: JArrayBuffer);
  end;

  JUint8Array = class external 'Uint8Array'
  public
    &length: Integer;
    buffer: JArrayBuffer;
    function GetItem(i: Integer): Integer; external array;
    procedure SetItem(i: Integer; v: Integer); external array;
    property Items[i: Integer]: Integer read GetItem write SetItem; default;
    constructor Create(n: Integer); overload;
    constructor Create(buf: JArrayBuffer); overload;
  end;

  JUint32Array = class external 'Uint32Array'
  public
    constructor Create(buf: JArrayBuffer);
  end;

  JUint16Array = class external 'Uint16Array'
  public
    &length: Integer;
    function GetItem(i: Integer): Integer; external array;
    property Items[i: Integer]: Integer read GetItem; default;
    constructor Create(buf: JArrayBuffer);
  end;

  // pixel data: float writes are clamped and rounded by the browser
  JPixels = class external 'Uint8ClampedArray'
  public
    &length: Integer;
    function GetItem(i: Integer): Float; external array;
    procedure SetItem(i: Integer; v: Float); external array;
    property Items[i: Integer]: Float read GetItem write SetItem; default;
  end;

  // ---------------------------------------------------------------- DOM
  JStyle = class external 'CSSStyleDeclaration'
  public
    width, height, opacity, transform, display, left: String;
  end;

  JClassList = class external 'DOMTokenList'
  public
    procedure add(c: String);
    procedure remove(c: String);
    function toggle(c: String; force: Boolean): Boolean;
    function contains(c: String): Boolean;
  end;

  JEvent = class external 'Event'
  public
    procedure preventDefault;
  end;

  JMouseEvent = class external 'MouseEvent' (JEvent)
  public
    button: Integer;
    movementX, movementY: Float;
  end;

  JKeyEvent = class external 'KeyboardEvent' (JEvent)
  public
    code: String;
    &repeat: Boolean; external 'repeat';
  end;

  JErrorEvent = class external 'ErrorEvent' (JEvent)
  public
    message: String;
  end;

  JCanvas2D = class;

  JElement = class external 'HTMLElement'
  public
    id, className, textContent, innerHTML: String;
    style: JStyle;
    classList: JClassList;
    width, height: Integer;
    parentNode: JElement;
    lastChild: JElement;
    children: array of JElement;
    childElementCount: Integer;
    procedure appendChild(e: JElement);
    procedure prepend(e: JElement);
    procedure remove;
    procedure addEventListener(ev: String; cb: procedure(e: JEvent));
    function getContext(kind: String): JCanvas2D;
    function requestPointerLock(opts: variant): variant; overload;
    function requestPointerLock: variant; overload;
  end;

  JImage = class external 'Image' (JElement)
  public
    src: String;
    onload, onerror: TProc;
    constructor Create;
  end;

  JElementList = class external 'NodeList'
  public
    &length: Integer;
    function GetItem(i: Integer): JElement; external array;
    property Items[i: Integer]: JElement read GetItem; default;
  end;

  JDocument = class external 'Document'
  public
    title: String;
    pointerLockElement: JElement;
    function getElementById(id: String): JElement;
    function createElement(tag: String): JElement;
    function querySelectorAll(sel: String): JElementList;
    procedure addEventListener(ev: String; cb: procedure(e: JEvent));
    procedure exitPointerLock;
  end;

  JURLSearchParams = class external 'URLSearchParams'
  public
    constructor Create(query: String);
    function get(name: String): variant;
    function has(name: String): Boolean;
  end;

  JLocation = class external 'Location'
  public
    search: String;
  end;

  JWindow = class external 'Window'
  public
    innerWidth, innerHeight: Integer;
    devicePixelRatio: Float;
    procedure addEventListener(ev: String; cb: procedure(e: JEvent));
  end;

  JConsole = class external 'Console'
  public
    procedure error(v: variant);
    procedure log(v: variant);
  end;

  JVoidPromise = class external 'Promise'
  public
    procedure catch(cb: TProc);
  end;

  JStorage = class external 'Storage'
  public
    function getItem(k: String): variant;
    procedure setItem(k: String; v: String);
  end;

  // ---------------------------------------------------------------- canvas 2D
  JImageData = class external 'ImageData'
  public
    width, height: Integer;
    data: JPixels;
  end;

  JGradient = class external 'CanvasGradient'
  public
    procedure addColorStop(offset: Float; color: String);
  end;

  JCanvas2D = class external 'CanvasRenderingContext2D'
  public
    fillStyle, strokeStyle: variant;
    lineWidth, globalAlpha, shadowBlur: Float;
    globalCompositeOperation, textAlign, textBaseline, font, shadowColor: String;
    procedure fillRect(x, y, w, h: Float);
    procedure strokeRect(x, y, w, h: Float);
    procedure clearRect(x, y, w, h: Float);
    procedure beginPath;
    procedure closePath;
    procedure moveTo(x, y: Float);
    procedure lineTo(x, y: Float);
    procedure quadraticCurveTo(cx, cy, x, y: Float);
    procedure arc(x, y, r, a0, a1: Float);
    procedure ellipse(x, y, rx, ry, rot, a0, a1: Float);
    procedure fill;
    procedure clip;
    procedure save;
    procedure restore;
    procedure translate(x, y: Float);
    procedure rotate(a: Float);
    procedure scale(x, y: Float);
    procedure fillText(s: String; x, y, maxW: Float);
    procedure strokeText(s: String; x, y, maxW: Float);
    procedure drawImage(img: JElement; x, y: Float);
    function createRadialGradient(x0, y0, r0, x1, y1, r1: Float): JGradient;
    function createLinearGradient(x0, y0, x1, y1: Float): JGradient;
    function createImageData(w, h: Integer): JImageData;
    function getImageData(x, y, w, h: Integer): JImageData;
    procedure putImageData(img: JImageData; x, y: Integer);
  end;

  // ---------------------------------------------------------------- WebAudio
  JAudioParam = class external 'AudioParam'
  public
    value: Float;
    procedure setValueAtTime(v, t: Float);
    procedure exponentialRampToValueAtTime(v, t: Float);
    procedure setTargetAtTime(v, t, k: Float);
  end;

  JAudioNode = class external 'AudioNode'
  public
    function connect(dst: JAudioNode): JAudioNode; overload;
    procedure connect(dst: JAudioParam); overload;
  end;

  JAudioBuffer = class external 'AudioBuffer'
  public
    duration: Float;
    function getChannelData(c: Integer): JFloat32Array;
  end;

  JGainNode = class external 'GainNode' (JAudioNode)
  public
    gain: JAudioParam;
  end;

  JCompressorNode = class external 'DynamicsCompressorNode' (JAudioNode)
  public
    threshold, knee, ratio, attack, release: JAudioParam;
  end;

  JConvolverNode = class external 'ConvolverNode' (JAudioNode)
  public
    buffer: JAudioBuffer;
  end;

  JBiquadNode = class external 'BiquadFilterNode' (JAudioNode)
  public
    &type: String; external 'type';
    frequency, Q: JAudioParam;
  end;

  JBufferSourceNode = class external 'AudioBufferSourceNode' (JAudioNode)
  public
    buffer: JAudioBuffer;
    loop: Boolean;
    loopStart, loopEnd: Float;
    procedure start(when, offset: Float); overload;
    procedure start; overload;
    procedure stop(when: Float);
  end;

  JOscillatorNode = class external 'OscillatorNode' (JAudioNode)
  public
    &type: String; external 'type';
    frequency: JAudioParam;
    procedure start(when: Float); overload;
    procedure start; overload;
    procedure stop(when: Float);
  end;

  JPannerNode = class external 'PannerNode' (JAudioNode)
  public
    panningModel, distanceModel: String;
    refDistance, rolloffFactor, maxDistance: Float;
    positionX, positionY, positionZ: JAudioParam;
    procedure setPosition(x, y, z: Float);
  end;

  JAudioListener = class external 'AudioListener'
  public
    positionX, positionY, positionZ, forwardX, forwardY, forwardZ, upX, upY, upZ: JAudioParam;
    procedure setPosition(x, y, z: Float);
    procedure setOrientation(fx, fy, fz, ux, uy, uz: Float);
  end;

  JAudioContext = class external 'AudioContext'
  public
    currentTime, sampleRate: Float;
    destination: JAudioNode;
    listener: JAudioListener;
    constructor Create;
    procedure resume;
    function createGain: JGainNode;
    function createDynamicsCompressor: JCompressorNode;
    function createConvolver: JConvolverNode;
    function createBuffer(channels, len: Integer; rate: Float): JAudioBuffer;
    function createBufferSource: JBufferSourceNode;
    function createBiquadFilter: JBiquadNode;
    function createOscillator: JOscillatorNode;
    function createPanner: JPannerNode;
  end;

// ---------------------------------------------------------------- globals
var Document external 'document': JDocument;
var Window external 'window': JWindow;
var WindowObj external 'window': variant;
var Location external 'location': JLocation;
var Console external 'console': JConsole;

function Now: Float; external 'performance.now';
function Rnd: Float; external 'Math.random';
function IMul(a, b: Integer): Integer; external 'Math.imul';
function Atan2(y, x: Float): Float; external 'Math.atan2';
function Hypot(x, y: Float): Float; external 'Math.hypot';
function ACos(x: Float): Float; external 'Math.acos';
function ASin(x: Float): Float; external 'Math.asin';
function Atob(s: String): String; external 'atob';
function SetTimeout(cb: TProc; ms: Float): variant; external 'setTimeout';
procedure ClearTimeout(h: variant); external 'clearTimeout';
function RequestAnimationFrame(cb: TFrameProc): variant; external 'requestAnimationFrame';
function ObjectKeys(o: variant): array of String; external 'Object.keys';

// ---------------------------------------------------------------- helpers
const PI2 = PI * 2;

function Clamp01(x: Float): Float;
function ClampF(x, a, b: Float): Float;
function Smooth(a, b, x: Float): Float;
function Mix(a, b, t: Float): Float;
function Damp(a, b, k, dt: Float): Float;
function Ease(t: Float): Float;
function FMod(a, b: Float): Float;
function FSign(x: Float): Float;
function JSRound(x: Float): Float;
function ToFixed(x: Float; digits: Integer): String;
function Num(x: Float): String;
function IntStr(x: Integer): String;
function MaxF(a, b: Float): Float;
function MinF(a, b: Float): Float;
function El(id: String): JElement;
function NewCanvas(w, h: Integer): JElement;
function LocalGet(k: String): String;
procedure LocalSet(k, v: String);
function CharCode(s: String; i: Integer): Integer;
procedure RunSteps(steps: array of TProc; i: Integer = 0);

implementation

function Clamp01(x: Float): Float;
begin
  if x < 0 then Result := 0
  else if x > 1 then Result := 1
  else Result := x;
end;

function ClampF(x, a, b: Float): Float;
begin
  if x < a then Result := a
  else if x > b then Result := b
  else Result := x;
end;

function Smooth(a, b, x: Float): Float;
begin
  var t := Clamp01((x - a) / (b - a));
  Result := t * t * (3 - 2 * t);
end;

function Mix(a, b, t: Float): Float;
begin
  Result := a + (b - a) * t;
end;

function Damp(a, b, k, dt: Float): Float;
begin
  Result := a + (b - a) * (1 - Exp(-k * dt));
end;

function Ease(t: Float): Float;
begin
  Result := t * t * (3 - 2 * t);
end;

// JavaScript '%' on floats (sign follows the dividend)
function FMod(a, b: Float): Float;
begin
  Result := a - Trunc(a / b) * b;
end;

function FSign(x: Float): Float;
begin
  if x > 0 then Result := 1
  else if x < 0 then Result := -1
  else Result := 0;
end;

// Math.round semantics (half rounds up), unlike Pascal banker's rounding
function JSRound(x: Float): Float;
begin
  Result := Floor(x + 0.5);
end;

// locale-independent number formatting
function ToFixed(x: Float; digits: Integer): String;
begin
  asm @Result = (@x).toFixed(@digits); end;
end;

function Num(x: Float): String;
begin
  asm @Result = String(@x); end;
end;

function IntStr(x: Integer): String;
begin
  asm @Result = String(@x); end;
end;

function MaxF(a, b: Float): Float;
begin
  if a > b then Result := a else Result := b;
end;

function MinF(a, b: Float): Float;
begin
  if a < b then Result := a else Result := b;
end;

function El(id: String): JElement;
begin
  Result := Document.getElementById(id);
end;

function NewCanvas(w, h: Integer): JElement;
begin
  Result := Document.createElement('canvas');
  Result.width := w;
  Result.height := h;
end;

function LocalGet(k: String): String;
begin
  Result := '';
  try
    var v: variant;
    asm @v = window.localStorage.getItem(@k); end;
    if not VarIsNull(v) then Result := v;
  except
  end;
end;

procedure LocalSet(k, v: String);
begin
  try
    asm window.localStorage.setItem(@k, @v); end;
  except
  end;
end;

function CharCode(s: String; i: Integer): Integer;
begin
  asm @Result = (@s).charCodeAt(@i); end;
end;

// run each step in its own macrotask so the page can repaint in between
// (the original awaited setTimeout(0) between loading stages)
procedure RunSteps(steps: array of TProc; i: Integer = 0);
begin
  if i >= steps.Length then Exit;
  steps[i]();
  SetTimeout(procedure begin RunSteps(steps, i + 1); end, 0);
end;

end.
