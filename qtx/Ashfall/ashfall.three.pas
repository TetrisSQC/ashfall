unit ashfall.three;

// External class bindings for three.js r170 and the addons the game uses.
// index.html imports the ES modules and publishes them as window.THREE (core) and
// window.THREEX (addons) before the compiled program starts. Only the parts of the
// API that the game touches are declared.

interface

uses
  ashfall.host;

const
  // three.js r170 constants
  FrontSide = 0;
  BackSide = 1;
  DoubleSide = 2;
  NormalBlending = 1;
  AdditiveBlending = 2;
  CustomBlending = 5;
  SrcAlphaFactor = 204;
  OneMinusSrcAlphaFactor = 205;
  PCFSoftShadowMap = 2;
  ACESFilmicToneMapping = 4;
  RepeatWrapping = 1000;
  LinearMipmapLinearFilter = 1008;
  HalfFloatType = 1016;
  DynamicDrawUsage = 35048;
  NoColorSpace = '';
  SRGBColorSpace = 'srgb';
  GTAOOutputDefault = 0;

type
  JMatrix4 = class;
  JQuaternion = class;
  JEuler = class;

  JVector2 = class external 'THREE.Vector2'
  public
    x, y: Float;
    constructor Create(ax, ay: Float); overload;
    constructor Create; overload;
    function &set(ax, ay: Float): JVector2;
    function setScalar(s: Float): JVector2;
  end;

  JVector3 = class external 'THREE.Vector3'
  public
    x, y, z: Float;
    constructor Create(ax, ay, az: Float); overload;
    constructor Create; overload;
    function &set(ax, ay, az: Float): JVector3;
    function setScalar(s: Float): JVector3;
    function setY(v: Float): JVector3;
    function copy(v: JVector3): JVector3;
    function clone: JVector3;
    function add(v: JVector3): JVector3;
    function sub(v: JVector3): JVector3;
    function addScaledVector(v: JVector3; s: Float): JVector3;
    function subVectors(a, b: JVector3): JVector3;
    function crossVectors(a, b: JVector3): JVector3;
    function multiplyScalar(s: Float): JVector3;
    function divideScalar(s: Float): JVector3;
    function normalize: JVector3;
    function negate: JVector3;
    function length: Float;
    function lengthSq: Float;
    function dot(v: JVector3): Float;
    function distanceTo(v: JVector3): Float;
    function distanceToSquared(v: JVector3): Float;
    function lerp(v: JVector3; t: Float): JVector3;
    function lerpVectors(a, b: JVector3; t: Float): JVector3;
    function reflect(n: JVector3): JVector3;
    function applyQuaternion(q: JQuaternion): JVector3;
    function applyMatrix4(m: JMatrix4): JVector3;
    function applyAxisAngle(axis: JVector3; angle: Float): JVector3;
    function project(camera: variant): JVector3;
    function setFromMatrixColumn(m: JMatrix4; index: Integer): JVector3;
    function fromArray(a: array of Float): JVector3;
  end;

  JQuaternion = class external 'THREE.Quaternion'
  public
    x, y, z, w: Float;
    constructor Create;
    function copy(q: JQuaternion): JQuaternion;
    function clone: JQuaternion;
    function invert: JQuaternion;
    function multiply(q: JQuaternion): JQuaternion;
    function premultiply(q: JQuaternion): JQuaternion;
    function slerpQuaternions(a, b: JQuaternion; t: Float): JQuaternion;
    function setFromEuler(e: JEuler): JQuaternion;
    function setFromAxisAngle(axis: JVector3; angle: Float): JQuaternion;
    function setFromUnitVectors(a, b: JVector3): JQuaternion;
    function setFromRotationMatrix(m: JMatrix4): JQuaternion;
    function slerp(q: JQuaternion; t: Float): JQuaternion;
    function fromArray(a: array of Float): JQuaternion;
  end;

  JEuler = class external 'THREE.Euler'
  public
    x, y, z: Float;
    order: String;
    constructor Create(ax, ay, az: Float); overload;
    constructor Create; overload;
    function &set(ax, ay, az: Float): JEuler;
    function copy(e: JEuler): JEuler;
  end;

  JMatrix4 = class external 'THREE.Matrix4'
  public
    constructor Create;
    function clone: JMatrix4;
    function copy(m: JMatrix4): JMatrix4;
    function compose(p: JVector3; q: JQuaternion; s: JVector3): JMatrix4;
    function multiply(m: JMatrix4): JMatrix4;
    function premultiply(m: JMatrix4): JMatrix4;
    function multiplyMatrices(a, b: JMatrix4): JMatrix4;
    function makeTranslation(x, y, z: Float): JMatrix4;
    function makeRotationY(a: Float): JMatrix4;
    function makeBasis(x, y, z: JVector3): JMatrix4;
    function lookAt(eye, target, up: JVector3): JMatrix4;
    function invert: JMatrix4;
    procedure decompose(p: JVector3; q: JQuaternion; s: JVector3);
  end;

  JColor = class external 'THREE.Color'
  public
    r, g, b: Float;
    constructor Create(ar, ag, ab: Float); overload;
    constructor Create(hex: Integer); overload;
    function &set(hex: Integer): JColor;
    function copy(c: JColor): JColor;
    function clone: JColor;
    function fromArray(a: array of Float): JColor;
  end;

  JBox3 = class external 'THREE.Box3'
  public
    min, max: JVector3;
    constructor Create(amin, amax: JVector3);
    function applyMatrix4(m: JMatrix4): JBox3;
    function getCenter(target: JVector3): JVector3;
  end;

  // ---------------------------------------------------------------- textures
  JTexture = class external 'THREE.Texture'
  public
    wrapS, wrapT, anisotropy, minFilter: Integer;
    colorSpace: String;
    &repeat: JVector2; external 'repeat';
    generateMipmaps, needsUpdate, flipY: Boolean;
    constructor Create(image: JElement);
  end;

  JCanvasTexture = class external 'THREE.CanvasTexture' (JTexture)
  public
    constructor Create(canvas: JElement);
  end;

  // ---------------------------------------------------------------- geometry
  JBufferAttribute = class external 'THREE.BufferAttribute'
  public
    count, itemSize: Integer;
    needsUpdate: Boolean;
    &array: variant; external 'array';
    constructor Create(arr: variant; itemSize: Integer); overload;
    constructor Create(arr: variant; itemSize: Integer; normalized: Boolean); overload;
    function getX(i: Integer): Float;
    function getY(i: Integer): Float;
    function getZ(i: Integer): Float;
    procedure setXY(i: Integer; x, y: Float);
    function setUsage(u: Integer): JBufferAttribute;
    procedure clearUpdateRanges;
  end;

  JUint8BufferAttribute = class external 'THREE.Uint8BufferAttribute' (JBufferAttribute)
  public
    constructor Create(arr: variant; itemSize: Integer);
  end;

  JInstancedBufferAttribute = class external 'THREE.InstancedBufferAttribute' (JBufferAttribute)
  public
    constructor Create(arr: JFloat32Array; itemSize: Integer);
  end;

  JAttributes = class external 'Object'
  public
    position, normal, uv: JBufferAttribute;
  end;

  JBufferGeometry = class external 'THREE.BufferGeometry'
  public
    index: JBufferAttribute;
    attributes: JAttributes;
    boundingBox: JBox3;
    constructor Create;
    function setAttribute(name: String; a: JBufferAttribute): JBufferGeometry;
    procedure deleteAttribute(name: String);
    procedure setIndex(a: JBufferAttribute);
    procedure clearGroups;
    function applyMatrix4(m: JMatrix4): JBufferGeometry;
    procedure computeBoundingBox;
    procedure computeBoundingSphere;
    procedure computeVertexNormals;
    function translate(x, y, z: Float): JBufferGeometry;
    function rotateX(a: Float): JBufferGeometry;
    function rotateY(a: Float): JBufferGeometry;
    function toNonIndexed: JBufferGeometry;
    function clone: JBufferGeometry;
    procedure dispose;
  end;

  JInstancedBufferGeometry = class external 'THREE.InstancedBufferGeometry' (JBufferGeometry)
  public
    instanceCount: Integer;
    constructor Create;
  end;

  JBoxGeometry = class external 'THREE.BoxGeometry' (JBufferGeometry)
  public
    constructor Create(w, h, d: Float);
  end;

  JPlaneGeometry = class external 'THREE.PlaneGeometry' (JBufferGeometry)
  public
    constructor Create(w, h: Float);
  end;

  JCylinderGeometry = class external 'THREE.CylinderGeometry' (JBufferGeometry)
  public
    constructor Create(rt, rb, h: Float; radial: Integer); overload;
    constructor Create(rt, rb, h: Float; radial, hseg: Integer; openEnded: Boolean); overload;
  end;

  JSphereGeometry = class external 'THREE.SphereGeometry' (JBufferGeometry)
  public
    constructor Create(r: Float; ws, hs: Integer);
  end;

  JDodecahedronGeometry = class external 'THREE.DodecahedronGeometry' (JBufferGeometry)
  public
    constructor Create(r: Float; detail: Integer);
  end;

  JTorusGeometry = class external 'THREE.TorusGeometry' (JBufferGeometry)
  public
    constructor Create(r, tube: Float; rs, ts: Integer);
  end;

  JCircleGeometry = class external 'THREE.CircleGeometry' (JBufferGeometry)
  public
    constructor Create(r: Float; segs: Integer);
  end;

  JCapsuleGeometry = class external 'THREE.CapsuleGeometry' (JBufferGeometry)
  public
    constructor Create(r, len: Float; capSegs, radialSegs: Integer);
  end;

  JShape = class external 'THREE.Shape'
  public
    constructor Create;
    procedure moveTo(x, y: Float);
    procedure lineTo(x, y: Float);
    procedure quadraticCurveTo(cx, cy, x, y: Float);
    procedure absarc(x, y, r, a0, a1: Float; clockwise: Boolean);
  end;

  JExtrudeGeometry = class external 'THREE.ExtrudeGeometry' (JBufferGeometry)
  public
    constructor Create(shape: JShape; opts: variant);
  end;

  JCatmullRomCurve3 = class external 'THREE.CatmullRomCurve3'
  public
    constructor Create(points: array of JVector3);
  end;

  JTubeGeometry = class external 'THREE.TubeGeometry' (JBufferGeometry)
  public
    constructor Create(path: JCatmullRomCurve3; tubular: Integer; radius: Float; radial: Integer; closed: Boolean);
  end;

  JRoundedBoxGeometry = class external 'THREEX.RoundedBoxGeometry' (JBufferGeometry)
  public
    constructor Create(w, h, d: Float; segs: Integer; r: Float);
  end;

  // ---------------------------------------------------------------- materials
  JUniform = class external 'Object'
  public
    value: variant;
  end;

  JUniforms = class external 'Object'
  public
    function GetItem(name: String): JUniform; external array;
    property Items[name: String]: JUniform read GetItem; default;
  end;

  JMaterial = class external 'THREE.Material'
  public
    transparent, depthWrite, depthTest, needsUpdate, polygonOffset: Boolean;
    opacity, alphaTest: Float;
    side, blending, blendSrc, blendDst: Integer;
    userData: variant;
    function clone: JMaterial;
  end;

  JMeshStandardMaterial = class external 'THREE.MeshStandardMaterial' (JMaterial)
  public
    map, normalMap, roughnessMap, metalnessMap: JTexture;
    roughness, metalness, envMapIntensity: Float;
    color, emissive: JColor;
    normalScale: JVector2;
    constructor Create(params: variant);
  end;

  JMeshBasicMaterial = class external 'THREE.MeshBasicMaterial' (JMaterial)
  public
    color: JColor;
    constructor Create(params: variant);
  end;

  JShaderMaterial = class external 'THREE.ShaderMaterial' (JMaterial)
  public
    uniforms: JUniforms;
    constructor Create(params: variant);
  end;

  // ---------------------------------------------------------------- scene graph
  JObject3D = class;
  TObjectVisitor = procedure(o: JObject3D);

  JObject3D = class external 'THREE.Object3D'
  public
    name: String;
    position, scale: JVector3;
    rotation: JEuler;
    quaternion: JQuaternion;
    matrix, matrixWorld: JMatrix4;
    visible, castShadow, receiveShadow, frustumCulled, matrixAutoUpdate: Boolean;
    isMesh, isBone, isSkinnedMesh, isPoints, isLine: Boolean;
    renderOrder: Integer;
    userData: variant;
    parent: JObject3D;
    children: array of JObject3D;
    constructor Create;
    procedure add(o: JObject3D);
    procedure remove(o: JObject3D);
    procedure traverse(cb: TObjectVisitor);
    procedure updateMatrix;
    procedure updateMatrixWorld(force: Boolean); overload;
    procedure updateMatrixWorld; overload;
    function getWorldPosition(target: JVector3): JVector3;
    function getWorldQuaternion(target: JQuaternion): JQuaternion;
    function getWorldDirection(target: JVector3): JVector3;
    function localToWorld(v: JVector3): JVector3;
    function worldToLocal(v: JVector3): JVector3;
    function clone: JObject3D;
  end;

  JGroup = class external 'THREE.Group' (JObject3D)
  public
    constructor Create;
  end;

  JMesh = class external 'THREE.Mesh' (JObject3D)
  public
    geometry: JBufferGeometry;
    material: variant;
    constructor Create(geo: JBufferGeometry; mat: JMaterial);
  end;

  JSkeleton = class external 'THREE.Skeleton'
  public
    constructor Create(bones: array of JObject3D);
  end;

  JBone = class external 'THREE.Bone' (JObject3D)
  public
    constructor Create;
  end;

  JSkinnedMesh = class external 'THREE.SkinnedMesh' (JMesh)
  public
    constructor Create(geo: JBufferGeometry; mat: JMaterial);
    procedure bind(skeleton: JSkeleton; bindMatrix: JMatrix4);
  end;

  JInstancedMesh = class external 'THREE.InstancedMesh' (JMesh)
  public
    count: Integer;
    instanceMatrix: JBufferAttribute;
    constructor Create(geo: JBufferGeometry; mat: JMaterial; count: Integer);
    procedure setMatrixAt(i: Integer; m: JMatrix4);
  end;

  JFogExp2 = class external 'THREE.FogExp2'
  public
    color: JColor;
    density: Float;
    constructor Create(color: JColor; density: Float);
  end;

  JScene = class external 'THREE.Scene' (JObject3D)
  public
    fog: JFogExp2;
    environment: JTexture;
    environmentIntensity: Float;
    constructor Create;
  end;

  JCamera = class external 'THREE.Camera' (JObject3D)
  end;

  JPerspectiveCamera = class external 'THREE.PerspectiveCamera' (JCamera)
  public
    fov, aspect, near, far: Float;
    constructor Create(fov, aspect, near, far: Float);
    procedure updateProjectionMatrix;
  end;

  JOrthoCamera = class external 'THREE.OrthographicCamera' (JCamera)
  public
    left, right, top, bottom, near, far: Float;
  end;

  JLightShadow = class external 'THREE.LightShadow'
  public
    mapSize: JVector2;
    camera: JOrthoCamera;
    bias, normalBias, radius: Float;
    map: variant;
  end;

  JLight = class external 'THREE.Light' (JObject3D)
  public
    color: JColor;
    intensity: Float;
  end;

  JDirectionalLight = class external 'THREE.DirectionalLight' (JLight)
  public
    target: JObject3D;
    shadow: JLightShadow;
    constructor Create(color: Integer; intensity: Float);
  end;

  JHemisphereLight = class external 'THREE.HemisphereLight' (JLight)
  public
    constructor Create(sky, ground: Integer; intensity: Float);
  end;

  JPointLight = class external 'THREE.PointLight' (JLight)
  public
    distance, decay: Float;
    constructor Create(color: Integer; intensity, distance, decay: Float);
  end;

  // ---------------------------------------------------------------- renderer
  JRenderTarget = class external 'THREE.WebGLRenderTarget'
  public
    texture: JTexture;
    constructor Create(w, h: Integer; opts: variant);
  end;

  JShadowMapSettings = class external 'Object'
  public
    enabled: Boolean;
    &type: Integer; external 'type';
  end;

  JRenderInfoRender = class external 'Object'
  public
    calls, triangles: Integer;
  end;

  JRenderInfo = class external 'Object'
  public
    autoReset: Boolean;
    render: JRenderInfoRender;
    procedure reset;
  end;

  JCapabilities = class external 'Object'
  public
    function getMaxAnisotropy: Integer;
  end;

  JWebGLRenderer = class external 'THREE.WebGLRenderer'
  public
    domElement: JElement;
    shadowMap: JShadowMapSettings;
    toneMapping: Integer;
    toneMappingExposure: Float;
    outputColorSpace: String;
    capabilities: JCapabilities;
    info: JRenderInfo;
    constructor Create(params: variant);
    procedure setSize(w, h: Float);
    procedure setPixelRatio(r: Float);
    procedure compile(scene: JObject3D; camera: JCamera);
  end;

  JPMREMGenerator = class external 'THREE.PMREMGenerator'
  public
    constructor Create(renderer: JWebGLRenderer);
    function fromScene(scene: JScene; sigma, near, far: Float): JRenderTarget;
    procedure dispose;
  end;

  // ---------------------------------------------------------------- post processing (addons)
  JPass = class external 'Object'
  public
    enabled, clear, clearDepth: Boolean;
    procedure dispose;
  end;

  JRenderPass = class external 'THREEX.RenderPass' (JPass)
  public
    constructor Create(scene: JScene; camera: JCamera);
  end;

  JJSMap = class external 'Map'
  public
    procedure &set(k, v: variant); external 'set';
  end;

  JGTAOPass = class external 'THREEX.GTAOPass' (JPass)
  public
    output: Integer;
    blendIntensity: Float;
    _visibilityCache: JJSMap;
    overrideVisibility: TProc;
    constructor Create(scene: JScene; camera: JCamera; w, h: Integer);
    procedure updateGtaoMaterial(params: variant);
    procedure updatePdMaterial(params: variant);
  end;

  JShaderPass = class external 'THREEX.ShaderPass' (JPass)
  public
    uniforms: JUniforms;
    constructor Create(shader: variant);
  end;

  JUnrealBloomPass = class external 'THREEX.UnrealBloomPass' (JPass)
  public
    constructor Create(res: JVector2; strength, radius, threshold: Float);
  end;

  JOutputPass = class external 'THREEX.OutputPass' (JPass)
  public
    constructor Create;
  end;

  JSMAAPass = class external 'THREEX.SMAAPass' (JPass)
  public
    constructor Create(w, h: Integer);
  end;

  JEffectComposer = class external 'THREEX.EffectComposer'
  public
    passes: array of JPass;
    constructor Create(renderer: JWebGLRenderer; rt: JRenderTarget);
    procedure addPass(p: JPass);
    procedure setPixelRatio(r: Float);
    procedure setSize(w, h: Integer);
    procedure render(dt: Float);
    procedure dispose;
  end;

function MergeGeometries(geos: array of JBufferGeometry; useGroups: Boolean): JBufferGeometry; external 'THREEX.mergeGeometries';
function SkeletonClone(o: JObject3D): JObject3D; external 'THREEX.SkeletonUtils.clone';

// small constructors
function V3(x, y, z: Float): JVector3;
function V3Zero: JVector3;
function Col(r, g, b: Float): JColor;
function Uni(v: variant): variant;

implementation

function V3(x, y, z: Float): JVector3;
begin
  Result := JVector3.Create(x, y, z);
end;

function V3Zero: JVector3;
begin
  Result := JVector3.Create;
end;

function Col(r, g, b: Float): JColor;
begin
  Result := JColor.Create(r, g, b);
end;

// shader uniform slot { value: v }
function Uni(v: variant): variant;
begin
  Result := class value: variant := v; end;
end;

end.
