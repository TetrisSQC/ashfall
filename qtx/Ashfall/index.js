function VarIsNull(v) { return (v===null) }
function UpperCase(v) { return v.toUpperCase() }
function Trunc(v) { return (v>=0)?Math.floor(v):Math.ceil(v) }
var TObject={
	$ClassName: "TObject",
	$Parent: null,
	ClassName: function (s) { return s.$ClassName },
	ClassType: function (s) { return s },
	ClassParent: function (s) { return s.$Parent },
	$Init: function (s) {},
	Create: function (s) { return s },
	Destroy: function (s) { for (var prop in s) if (s.hasOwnProperty(prop)) delete s[prop] },
	Destroy$: function(s) { return s.ClassType.Destroy(s) },
	Free: function (s) { if (s!==null) s.ClassType.Destroy(s) }
}
var Sqrt = Math.sqrt;
var Sin = Math.sin;
function Power(x,y) { return Math.pow(x,y) }
function Min$_Integer_Integer_(a,b) { return (a<b)?a:b }
function Max$_Integer_Integer_(a,b) { return (a>b)?a:b }
var Floor = Math.floor;
var Exp = Math.exp;
var Exception={
	$ClassName: "Exception",
	$Parent: TObject,
	$Init: function (s) { s.FMessage="" },
	Create: function (s,Msg) { s.FMessage=Msg; return s }
}
var Cos = Math.cos;
function Copy$_String_Integer_Integer_(s,f,n) { return s.substr(f-1,n) }
var Abs$_Integer_ = Math.abs;
var Abs$_Float_ = Math.abs;
function $W(e) { return e.ClassType?e:Exception.Create($New(Exception),(typeof e == "string") ? e : e.constructor.name+", "+e.message) }
function $VarToInt(v,z) {
	var r = parseInt(v || 0, 10);
	if (isNaN(r)) throw Exception.Create($New(Exception),"Not a valid integer: "+v+z);
	return r
}
function $VarToBool(v) { return !!(typeof v == "string" ? {"1":1,"t":1,"y":1,"true":1}[v.toLowerCase()] : v) }
function $New(c) { var i={ClassType:c}; c.$Init(i); return i }
function $Is(o,c) {
	if (o===null) return false;
	return $Inh(o.ClassType,c);
}
;
function $Inh(s,c) {
	if (s===null) return false;
	while ((s)&&(s!==c)) s=s.$Parent;
	return (s)?true:false;
}
;
function $Delete(o) { for (var m in o) delete o[m] }
function StartAshfall() {
   var shotParam,
      perfObj,
      qs = "";
   Params = new URLSearchParams(location.search);
   shotParam = Params.get("shot");
   Shot = (shotParam)?String(shotParam):"";
   Renderer = new THREE.WebGLRenderer({
      "stencil" : false
      ,"preserveDrawingBuffer" : Shot != ""
      ,"powerPreference" : "high-performance"
      ,"antialias" : false
   });
   Renderer.setSize(window.innerWidth,window.innerHeight);
   Renderer.shadowMap.enabled = true;
   Renderer.shadowMap.type = 2;
   Renderer.toneMapping = 4;
   Renderer.toneMappingExposure = 1;
   Renderer.outputColorSpace = "srgb";
   El("game").appendChild(Renderer.domElement);
   SetAnisotropy(Renderer.capabilities.getMaxAnisotropy());
   Renderer.info.autoReset = false;
   perfObj = {
      "userSet" : false
      ,"tris" : 0
      ,"slow" : 0
      ,"prev" : 0
      ,"n" : 0
      ,"lastNow" : 0
      ,"frames" : []
      ,"cpu" : 0
      ,"calls" : 0
      ,"acc" : 0
   };
   Perf = perfObj;
   window.__perf = Perf;
   qs = LocalGet("quality");
   Quality = 0;
   for(let qi=0;qi<=2;qi++) {
      if (QUALITY_NAMES[qi] == qs) {
         Quality = qi;
      }
   }
   Scene = new THREE.Scene();
   Camera = new THREE.PerspectiveCamera(63,window.innerWidth / window.innerHeight,0.05,1400);
   Camera.rotation.order = "YXZ";
   BuildAtmosphere();
   Audio = TObject.Create($New(TAudio));
   El("menu").classList.add("loading");
   World = TWorld.Create$3($New(TWorld),Scene,Progress);
   Game = TObject.Create($New(TGame));
   Game.State = "menu";
   Game.Grenades = 3;
   Passes = TObject.Create($New(TPasses));
   SPAWNS = [V3(-3,0,-88), V3(3,0,-86), V3(0,0,-76), V3(-60,0,2), V3(60,0,-2), V3(-55,0,-3), V3(56,0,3), V3(-4,0,-60), V3(5,0,88), V3(-5,0,90)];
   NAMES = ["Viper-2", "Kestrel", "Grim", "Rook", "Sokol", "Hydra-6", "Mako", "Warden", "Ash", "Nomad", "Tusk", "Raven-4"];
   NadeGeo = new THREE.SphereGeometry(0.045,12,10);
   NadeMat = new THREE.MeshStandardMaterial({
      "roughness" : 0.6
      ,"metalness" : 0.3
      ,"color" : 4146739
   });
   _o = V3Zero();
   _d = V3Zero();
   _sp = V3Zero();
   Last = performance.now();
   BindInput();
   window.addEventListener("error",function (e$1) {
      document.title = "ERROR " + e$1.message;
   });
   try {
      TWorld.Build(World,function () {
         try {
            Progress(0.9,"LOADING INFANTRY");
            LoadSoldier(function () {
               try {
                  Progress(0.92,"LIGHTING");
                  setTimeout(function () {
                     try {
                        FinishInit();
                     } catch ($e) {
                        var ex = $W($e);
                        Fail(ex.FMessage)                     }
                  },0);
               } catch ($e) {
                  var ex = $W($e);
                  Fail(ex.FMessage)               }
            });
         } catch ($e) {
            var ex = $W($e);
            Fail(ex.FMessage)         }
      });
   } catch ($e) {
      var ex = $W($e);
      Fail(ex.FMessage)   }
}
function UpdateShadowCamera() {
   var center = null,
      fwd = null,
      texel = 0,
      lightRot = null,
      inv = null;
   center = Camera.position.clone();
   fwd = V3Zero();
   Camera.getWorldDirection(fwd);
   fwd.y = 0;
   fwd.normalize();
   center.addScaledVector(fwd,20);
   texel = 110 / Sun.shadow.mapSize.x;
   lightRot = new THREE.Matrix4().lookAt(V3Zero(),SUN_DIR.clone().negate(),V3(0,1,0));
   inv = lightRot.clone().invert();
   center.applyMatrix4(inv);
   center.x = JSRound(center.x / texel) * texel;
   center.y = JSRound(center.y / texel) * texel;
   center.applyMatrix4(lightRot);
   Sun.target.position.copy(center);
   Sun.position.copy(center).addScaledVector(SUN_DIR,150);
   Sun.target.updateMatrixWorld();
}
function UpdatePostUniforms(dt$1) {
   var facing = null,
      vis = 0,
      ru = null,
      g = null,
      hpK = 0;
   _sp.copy(Camera.position).addScaledVector(SUN_DIR,500).project(Camera);
   facing = V3Zero();
   Camera.getWorldDirection(facing);
   vis = MaxF(0,facing.dot(SUN_DIR));
   ru = Passes.Rays.uniforms;
   ru["sunPos"].value.set(_sp.x * 0.5 + 0.5,_sp.y * 0.5 + 0.5);
   ru["intensity"].value = vis*vis * 0.4;
   ru["aspect"].value = Camera.aspect;
   g = Passes.Grade.uniforms;
   g["time"].value = g["time"].value + dt$1;
   hpK = (Player)?ClampF((0.8 - Player.HP / Player.MaxHP) / 0.6,0,1):0;
   g["damage"].value = Mix(Number(g["damage"].value),hpK,1 - Exp(-6 * dt$1));
   g["aberration"].value = 0.0008 + ((Player)?Player.Trauma * 0.008:0);
   g["adsVignette"].value = (Weapon)?Weapon.Aim:0;
   SkyMat.uniforms["time"].value = SkyMat.uniforms["time"].value + dt$1;
   Sky.position.copy(Camera.position);
}
function UpdateGrenades(dt$1) {
   var g$11 = null,
      p$3 = null,
      next = null,
      len = 0,
      dir = null,
      h$4 = null;
   for(let i$2=GrenadesLive.length - 1;i$2>=0;i$2--) {
      g$11 = GrenadesLive[i$2];
      g$11.Fuse -= dt$1;
      g$11.Vel.y -= 9.8 * dt$1;
      p$3 = g$11.Mesh.position;
      next = p$3.clone().addScaledVector(g$11.Vel,dt$1);
      len = g$11.Vel.length() * dt$1;
      if (len > 0) {
         dir = g$11.Vel.clone().normalize();
         h$4 = TWorld.Raycast(World,p$3,dir,len + 0.05);
         if (h$4) {
            g$11.Vel.reflect(h$4.Normal).multiplyScalar(0.4);
            next.copy(h$4.Point).addScaledVector(h$4.Normal,0.05);
            if (g$11.Vel.length() > 1.5) {
               TAudio.Impact(Audio,h$4.Point,"metal");
            }
         }
      }
      p$3.copy(next);
      if (p$3.y < 0.045) {
         p$3.y = 0.045;
         g$11.Vel.y = Abs$_Float_(g$11.Vel.y) * 0.35;
         g$11.Vel.x *= 0.7;
         g$11.Vel.z *= 0.7;
      }
      g$11.Mesh.rotation.x += g$11.Vel.length() * dt$1 * 3;
      if (g$11.Fuse <= 0) {
         Explode(p$3.clone());
         Scene.remove(g$11.Mesh);
         GrenadesLive.splice(i$2,1)
         ;
      }
   }
}
/// TShotPose = class (TObject)
var TShotPose = {
   $ClassName:"TShotPose",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.ADS = $.Boom = $.Death = $.Fire = $.GunSide = $.GunTop = $.Long = $.Play = $.Reload = $.Soldier = $.Sprint = false;
      $.Enemies = "";
      $.Pitch = $.PX = $.PY = $.PZ = $.Yaw = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TPasses = class (TObject)
var TPasses = {
   $ClassName:"TPasses",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Grade = $.GTAO = $.Rays = $.Render = $.WeaponPass = null;
   }
   ,Destroy:TObject.Destroy
};
function ThrowGrenade() {
   if (Game.Grenades <= 0 || (!(TWeapon.StartThrow(Weapon)))) {
      return;
   }
   Game.Grenades -= 1;
   setTimeout(function () {
      var m = null,
         p = null,
         g$1 = null;
      Camera.getWorldDirection(_d);
      m = new THREE.Mesh(NadeGeo,NadeMat);
      m.castShadow = true;
      p = Camera.position.clone().addScaledVector(_d,0.5).add(V3(0,-0.1,0));
      m.position.copy(p);
      Scene.add(m);
      g$1 = TObject.Create($New(TGrenade));
      g$1.Mesh = m;
      g$1.Vel = _d.clone().multiplyScalar(17).add(V3(0,4,0)).add(Player.Vel$1);
      g$1.Fuse = 2.4;
      GrenadesLive.push(g$1);
      TAudio.Click(Audio,700,0.3,0);
   },260);
}
/// TGrenade = class (TObject)
var TGrenade = {
   $ClassName:"TGrenade",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Fuse = 0;
      $.Mesh = $.Vel = null;
   }
   ,Destroy:TObject.Destroy
};
/// TGame = class (TObject)
var TGame = {
   $ClassName:"TGame",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Bloom = $.HB = $.SpawnTimer = $.Time$1 = $.WaveBreak = 0;
      $.Grenades = $.Headshots = $.Hits = $.Kills = $.Score = $.Shots = $.ToSpawn = $.Wave = 0;
      $.State = "";
   }
   /// procedure TGame.Reset()
   ,Reset$1:function(Self) {
      Self.Wave = 0;
      Self.Score = 0;
      Self.Kills = 0;
      Self.Headshots = 0;
      Self.ToSpawn = 0;
      Self.SpawnTimer = 0;
      Self.WaveBreak = 0;
      Self.Grenades = 3;
      Self.Shots = 0;
      Self.Hits = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TDebugHandles = class (TObject)
var TDebugHandles = {
   $ClassName:"TDebugHandles",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.camera = $.effects = $.game = $.player = $.renderer = $.scene = $.weapon = $.world = null;
      $.enemies = [];
   }
   ,Destroy:TObject.Destroy
};
function StartGame() {
   El("menu").classList.add("hidden");
   Passes.WeaponPass.enabled = true;
   THUD.Show(HUD,true);
   Game.State = "playing";
   LockPointer();
   if (!Game.Wave) {
      NextWave();
   }
}
function SpawnEnemy() {
   var cands = [],
      a$20 = 0,
      s$6 = null,
      s = null,
      e = null;
   var $temp1;
   for(a$20=0,$temp1=SPAWNS.length;a$20<$temp1;a$20++) {
      s$6 = SPAWNS[a$20];
      if (s$6.distanceTo(Player.Pos$4) > 40) {
         cands.push(s$6);
      }
   }
   s = (cands.length > 0)?cands[Floor(Math.random() * cands.length)]:SPAWNS[0];
   e = TEnemy.Create$82($New(TEnemy),Scene,World,s.clone().add(V3((Math.random() - 0.5) * 3,0,(Math.random() - 0.5) * 3)));
   Enemies$1.push(e);
}
function ShotFramesTarget() {
   var Result = 0;
   var v;
   v = window.__shotFrames;
   Result = (v)?$VarToInt(v,""):90;
   return Result
}
function SetupShot(name$3) {
   var P = null,
      pts$1 = [],
      k$8 = 0,
      e$1 = null,
      e1 = null,
      e2 = null,
      a$119 = 0,
      e$2 = null,
      bot = null,
      fire = null;
   if (name$3 == "menu") {
      SetShotFrames(120);
      window.__game = DebugHandles();
      SHOTMENU = true;
      return;
   }
   El("menu").classList.add("hidden");
   Passes.WeaponPass.enabled = true;
   THUD.Show(HUD,true);
   Game.Wave = 1;
   {var $temp2 = name$3;
      if ($temp2=="ads") {
         P = Pose(1.5,0,74,0.05,0);
         P.ADS = true;
      }
       else if ($temp2=="fight") {
         P = Pose(-1,0,45,0,-0.02);
         P.Enemies = "yes";
         P.Fire = true;
      }
       else if ($temp2=="fire") {
         P = Pose(-1,0,45,-0.15,0);
         P.Fire = true;
      }
       else if ($temp2=="cross") {
         P = Pose(8,0,14,0.9,0.05);
      }
       else if ($temp2=="back") {
         P = Pose(0,0,-20,3.14159265358979,0.05);
      }
       else if ($temp2=="up") {
         P = Pose(0,0,30,0.3,0.45);
      }
       else if ($temp2=="sun") {
         P = Pose(5,0,20,0.72,0.12);
      }
       else if ($temp2=="wall") {
         P = Pose(8.5,0,30,-1.2,0.05);
      }
       else if ($temp2=="enemy") {
         P = Pose(0,0,30,0,-0.05);
         P.Enemies = "close";
      }
       else if ($temp2=="boom") {
         P = Pose(0,0,40,0,0);
         P.Boom = true;
      }
       else if ($temp2=="reload") {
         P = Pose(1.5,0,74,0.08,0.02);
         P.Reload = true;
      }
       else if ($temp2=="sprint") {
         P = Pose(1.5,0,74,0.08,0.02);
         P.Sprint = true;
      }
       else if ($temp2=="gunside") {
         P = Pose(1.5,0,74,0.08,0.02);
         P.GunSide = true;
      }
       else if ($temp2=="guntop") {
         P = Pose(1.5,0,74,0.08,0.02);
         P.GunTop = true;
      }
       else if ($temp2=="soldier") {
         P = Pose(0,0,30,0,-0.1);
         P.Soldier = true;
      }
       else if ($temp2=="play") {
         P = Pose(0,0,20,0,0);
         P.Play = true;
      }
       else if ($temp2=="longplay") {
         P = Pose(0,0,20,0,0);
         P.Play = true;
         P.Long = true;
      }
       else if ($temp2=="death") {
         P = Pose(0,0,30,0,-0.1);
         P.Soldier = true;
         P.Death = true;
      }
       else {
         P = Pose(1.5,0,74,0.08,0.02);
      }
   }
   Player.Pos$4.set(P.PX,P.PY,P.PZ);
   Player.Yaw$1 = P.Yaw;
   Player.Pitch$1 = P.Pitch;
   TPlayer.Update$2(Player,0.016);
   ShotFrames = 0;
   if (P.ADS) {
      RMB = true;
   }
   if (P.Enemies != "") {
      if (P.Enemies == "close") {
         pts$1 = [-1.5, 0, 24, 0.2, 2.5, 0, 20, -0.5, 5, 0, 16, 0.4];
      } else {
         pts$1 = [-3, 0, 22, 0, 3, 0, 18, 0.3, 0, 0, 12, -0.2, 5, 0, 30, 0.1];
      }
      k$8 = 0;
      while (k$8 < pts$1.length) {
         e$1 = TEnemy.Create$82($New(TEnemy),Scene,World,V3(pts$1[k$8],pts$1[k$8 + 1],pts$1[k$8 + 2]));
         e$1.Yaw$2 = pts$1[k$8 + 3];
         e$1.Root$1.rotation.y = e$1.Yaw$2;
         e$1.Speed = 2;
         e$1.AimPitch = 0;
         Enemies$1.push(e$1);
         k$8 += 4;
      }
   }
   if (P.GunSide) {
      Weapon.HipPos.set(0,0,0);
      Weapon.Root.position.set(0,-0.02,-0.75);
      Weapon.Root.rotation.y = 1.5707963267949;
   }
   if (P.GunTop) {
      Weapon.HipPos.set(0,0,0);
      Weapon.Root.position.set(0,-0.02,-0.75);
      Weapon.Root.rotation.x = 1.5707963267949;
   }
   if (P.Soldier) {
      e1 = TEnemy.Create$82($New(TEnemy),Scene,World,V3(-0.8,0,26.5));
      e1.Yaw$2 = 0.5;
      e1.Root$1.rotation.y = e1.Yaw$2;
      e1.Speed = 0;
      e1.AimPitch = 0;
      Enemies$1.push(e1);
      e2 = TEnemy.Create$82($New(TEnemy),Scene,World,V3(1.4,0,25.5));
      e2.Yaw$2 = -0.9;
      e2.Root$1.rotation.y = e2.Yaw$2;
      e2.Speed = 3;
      e2.AimPitch = 0;
      Enemies$1.push(e2);
   }
   if (P.Play) {
      Game.Wave = 0;
      Game.State = "playing";
      NextWave();
      Game.SpawnTimer = 0;
      for(let i$2=0;i$2<=4;i$2++) {
         SpawnEnemy();
         Game.ToSpawn -= 1;
      }
      var $temp3;
      for(a$119=0,$temp3=Enemies$1.length;a$119<$temp3;a$119++) {
         e$2 = Enemies$1[a$119];
         e$2.Root$1.position.z = MinF(e$2.Root$1.position.z,-20);
      }
      SetShotFrames((P.Long)?4200:900);
      Player.Difficulty = (P.Long)?0.05:0.2;
      bot = function (now) {
         var best = null,
            bd = 0,
            eye = null,
            a$120 = 0,
            e$3 = null,
            hp = null,
            d$9 = 0,
            dir = null,
            ty = 0,
            tp = 0;
         best = null;
         bd = 1000000000;
         eye = TPlayer.HeadPos(Player,V3Zero());
         var $temp4;
         for(a$120=0,$temp4=Enemies$1.length;a$120<$temp4;a$120++) {
            e$3 = Enemies$1[a$120];
            if (!(e$3.Alive$1)) {
               continue;
            }
            hp = e$3.Head.getWorldPosition(V3Zero()).add(V3(0,-0.35,0));
            d$9 = hp.distanceTo(eye);
            if (d$9 < bd && TWorld.LineOfSight(World,eye,hp)) {
               bd = d$9;
               best = hp;
            }
         }
         if (best) {
            dir = best.clone().sub(eye).normalize();
            ty = Math.atan2(-dir.x,-dir.z);
            tp = Math.asin(dir.y);
            Player.Yaw$1 += (ty - Player.Yaw$1) * 0.15;
            Player.Pitch$1 += (tp - Player.Pitch$1) * 0.15;
            MouseDown = Abs$_Float_(ty - Player.Yaw$1) < 0.05 && ShotFrames % 40 < 22;
            RMB = true;
         } else {
            MouseDown = false;
            RMB = false;
         }
         if (ShotFrames < ShotFramesTarget()) {
            requestAnimationFrame(bot);
         }
      };
      bot(0);
   }
   if (P.Death) {
      setTimeout(function () {
         TEnemy.Damage$1(Enemies$1[0],200,V3(0.3,0,-1).normalize(),"head");
         TEnemy.Damage$1(Enemies$1[1],200,V3(1,0,-0.4).normalize(),"body");
         TEffects.BloodHit(Effects,Enemies$1[0].Head.getWorldPosition(V3Zero()),V3(0,0,-1));
      },400);
      SetShotFrames(160);
   }
   if (P.Sprint) {
      Player.Keys["ShiftLeft"]=true;
      Player.Keys["KeyW"]=true;
      ShotFrames = -60;
   }
   if (P.Reload) {
      Weapon.Ammo = 10;
      setTimeout(function () {
         TWeapon.StartReload(Weapon);
      },600);
      SetShotFrames(125);
   }
   if (P.Fire) {
      SetShotFrames(100);
      fire = function (now) {
         MouseDown = ShotFrames > 70;
         if (ShotFrames < 100) {
            requestAnimationFrame(fire);
         }
      };
      fire(0);
   }
   if (P.Boom) {
      setTimeout(function () {
         Explode(V3(1,0.1,25));
      },800);
      SetShotFrames(60);
   }
   window.__game = DebugHandles();
}
function SetShotFrames(n$22) {
   window.__shotFrames = n$22;
}
function SetQuality(q$3) {
   Quality = q$3;
   LocalSet("quality",QUALITY_NAMES[q$3]);
   DisposeComposer();
   BuildComposer();
}
function Restart() {
   var a$21 = 0,
      e$1 = null;
   var $temp5;
   for(a$21=0,$temp5=Enemies$1.length;a$21<$temp5;a$21++) {
      e$1 = Enemies$1[a$21];
      TEnemy.Dispose(e$1);
   }
   Enemies$1.length=0;
   TGame.Reset$1(Game);
   TPlayer.Reset$2(Player);
   Weapon.Ammo = 30;
   Weapon.Reserve = 150;
   Weapon.Reloading = 0;
   El("gameover").classList.add("hidden");
   StartGame();
}
function Progress(p$3, text) {
   El("load-fill").style.width = ToFixed(p$3 * 100,0) + "%";
   if (text != "") {
      El("load-text").textContent = text;
   }
}
function Pose(px, py, pz, yaw, pitch) {
   var Result = null;
   Result = TObject.Create($New(TShotPose));
   Result.PX = px;
   Result.PY = py;
   Result.PZ = pz;
   Result.Yaw = yaw;
   Result.Pitch = pitch;
   return Result
}
function PlayerFire() {
   var a = 0,
      n$2 = 0,
      sp = 0,
      r = 0,
      th = 0,
      right = null,
      up = null,
      wh = null,
      maxT = 0,
      eh = null,
      target = null,
      a$22 = 0,
      e$1 = null,
      h$4 = null,
      muzzle = null,
      hitEnd = null,
      ep = null,
      ev = null,
      mult = 0,
      dmg = 0,
      killed = false;
   if (!(TWeapon.CanFire(Weapon))) {
      return;
   }
   if (!(TWeapon.Fire$1(Weapon))) {
      return;
   }
   Game.Shots += 1;
   Game.Bloom = MinF(0.03,Game.Bloom + 0.004);
   a = Weapon.Aim;
   n$2 = Weapon.Stats.Mag - Weapon.Ammo;
   TPlayer.AddRecoil(Player,0.011 * (1 - a * 0.35) + Min$_Integer_Integer_(n$2,10) * 0.0004,(Math.random() - 0.35) * 0.006 * (1 - a * 0.4));
   Camera.getWorldPosition(_o);
   Camera.getWorldDirection(_d);
   sp = CurrentSpread();
   r = Sqrt(Math.random()) * sp;
   th = Math.random() * 3.14159265358979 * 2;
   right = V3Zero().setFromMatrixColumn(Camera.matrixWorld,0);
   up = V3Zero().setFromMatrixColumn(Camera.matrixWorld,1);
   _d.addScaledVector(right,Cos(th) * r).addScaledVector(up,Sin(th) * r).normalize();
   wh = TWorld.Raycast(World,_o,_d,Weapon.Stats.Range);
   maxT = (wh)?wh.T$1:Weapon.Stats.Range;
   eh = null;
   target = null;
   var $temp6;
   for(a$22=0,$temp6=Enemies$1.length;a$22<$temp6;a$22++) {
      e$1 = Enemies$1[a$22];
      h$4 = TEnemy.HitTest(e$1,_o,_d,maxT);
      if (!!h$4 && (!eh || h$4.T$3 < eh.T$3)) {
         eh = h$4;
         target = e$1;
      }
   }
   muzzle = TWeapon.MuzzleWorld(Weapon,V3Zero());
   hitEnd = (eh)?_o.clone().addScaledVector(_d,eh.T$3):(wh)?wh.Point:_o.clone().addScaledVector(_d,maxT);
   if (!(Game.Shots % 2)) {
      TEffects.Tracer(Effects,muzzle.clone().addScaledVector(_d,0.5),hitEnd,420);
   }
   TEffects.Flash$1(Effects,muzzle.clone().addScaledVector(_d,0.3),60,0.05,16756832,12);
   TEffects.MuzzleSmoke(Effects,muzzle,_d);
   ep = TWeapon.EjectWorld(Weapon,V3Zero());
   ev = right.clone().multiplyScalar(2.2 + Math.random()).addScaledVector(up,1.4 + Math.random() * 0.6).addScaledVector(_d,-0.4).add(Player.Vel$1);
   TEffects.EjectShell(Effects,ep,ev,Camera.quaternion);
   if (eh) {
      mult = (eh.Zone$1 == "head")?2.6:(eh.Zone$1 == "legs")?0.8:1;
      dmg = Weapon.Stats.Damage * mult * ((maxT > 60)?0.85:1);
      killed = TEnemy.Damage$1(target,dmg,_d,eh.Zone$1);
      Game.Hits += 1;
      TEffects.BloodHit(Effects,hitEnd,_d);
      TAudio.Impact(Audio,hitEnd,"flesh");
      THUD.Hit(HUD,(killed)?"kill":(eh.Zone$1 == "head")?"head":"");
      TAudio.Hitmarker(Audio,killed,eh.Zone$1 == "head");
      if (killed) {
         OnKill(target,eh.Zone$1 == "head");
      }
   } else if (wh) {
      TEffects.Impact$1(Effects,wh.Point,wh.Normal,wh.Surf,_d);
      TAudio.Impact(Audio,wh.Point,wh.Surf);
   }
}
function Pause() {
   Game.State = "paused";
   MouseDown = false;
   RMB = false;
   $Delete(Player.Keys);
   El("menu").classList.remove("hidden");
   El("deploy").textContent = "RESUME";
   THUD.Show(HUD,false);
}
function OnKill(e$1, head) {
   var pts = 0;
   Game.Kills += 1;
   if (head) {
      Game.Headshots += 1;
   }
   pts = 100 + ((head)?50:0);
   Game.Score += pts;
   THUD.Kill(HUD,NAMES[Floor(Math.random() * NAMES.length)],head);
   THUD.Pop(HUD,"+" + IntStr(pts),(head)?"HEADSHOT":"KILL");
}
function NextWave() {
   Game.Wave += 1;
   Game.ToSpawn = 4 + (Game.Wave*2);
   Game.SpawnTimer = 1.5;
   THUD.Banner(HUD,"WAVE " + IntStr(Game.Wave),(Game.Wave == 1)?"HOLD THE INTERSECTION":"HOSTILE REINFORCEMENTS INBOUND",3.2);
}
function Loop(now) {
   var dt = 0,
      alive = 0,
      a$119 = 0,
      e$1 = null,
      ctx = null,
      a$120 = 0,
      e$2 = null,
      a$121 = 0,
      e$3 = null,
      wi = null,
      hostiles = 0,
      a$122 = 0,
      e$4 = null,
      t$6 = 0,
      t0 = 0;
   requestAnimationFrame(Loop);
   dt = MinF(0.05,(now - Last) / 1000);
   Last = now;
   if (Shot != "") {
      dt = 0.0166666666666667;
   }
   Game.Time$1 += dt;
   if (Game.State == "playing" || Shot != "" && (!(SHOTMENU))) {
      Player.Aiming$1 = RMB && (!(TWeapon.Busy(Weapon)));
      Player.Firing = MouseDown;
      TPlayer.Update$2(Player,dt);
      if (MouseDown && Player.Alive) {
         PlayerFire();
      }
      Game.Bloom = MaxF(0,Game.Bloom - dt * ((MouseDown)?0.01:0.08));
      if ((Weapon.Ammo==0) && Weapon.Reserve > 0 && (!(TWeapon.IsReloading(Weapon))) && Weapon.Cooldown < -0.2 && (Shot == "" || Game.State == "playing")) {
         TWeapon.StartReload(Weapon);
      }
      if (Game.State == "playing") {
         alive = 0;
         var $temp7;
         for(a$119=0,$temp7=Enemies$1.length;a$119<$temp7;a$119++) {
            e$1 = Enemies$1[a$119];
            if (e$1.Alive$1) {
               alive++;
            }
         }
         if (Game.ToSpawn > 0) {
            Game.SpawnTimer -= dt;
            if (Game.SpawnTimer <= 0 && alive < 6 + Min$_Integer_Integer_(Game.Wave,4)) {
               SpawnEnemy();
               Game.ToSpawn -= 1;
               Game.SpawnTimer = 1.2 + Math.random() * 1.5;
            }
         } else if ((alive==0) && Game.WaveBreak <= 0) {
            Game.WaveBreak = 7;
            Game.Score += 500;
            Weapon.Reserve = Min$_Integer_Integer_(Weapon.Stats.ReserveMax,Weapon.Reserve + 90);
            Game.Grenades = Min$_Integer_Integer_(3,Game.Grenades + 2);
            THUD.Banner(HUD,"WAVE "+IntStr(Game.Wave)+" CLEARED","+500  ·  RESUPPLY RECEIVED",3.5);
         }
         if (Game.WaveBreak > 0) {
            Game.WaveBreak -= dt;
            if (Game.WaveBreak <= 0) {
               NextWave();
            }
         }
         ctx = TObject.Create($New(TEnemyCtx));
         ctx.Player$1 = Player;
         ctx.Audio$1 = Audio;
         ctx.Effects$1 = Effects;
         ctx.Enemies$2 = Enemies$1;
         ctx.CoverPoints$1 = World.CoverPoints;
         var $temp8;
         for(a$120=0,$temp8=Enemies$1.length;a$120<$temp8;a$120++) {
            e$2 = Enemies$1[a$120];
            TEnemy.Update$4(e$2,dt,ctx);
         }
         for(let i$2=Enemies$1.length - 1;i$2>=0;i$2--) {
            if ((!(Enemies$1[i$2].Alive$1)) && Enemies$1[i$2].DeathT > 14) {
               TEnemy.Dispose(Enemies$1[i$2]);
               Enemies$1.splice(i$2,1)
               ;
            }
         }
         UpdateGrenades(dt);
         if (!(Player.Alive)) {
            Die();
         }
         Game.HB -= dt;
         if (Player.HP < 35 && Game.HB <= 0) {
            TAudio.Heartbeat(Audio);
            Game.HB = 0.9;
         }
      } else if (Shot != "") {
         var $temp9;
         for(a$121=0,$temp9=Enemies$1.length;a$121<$temp9;a$121++) {
            e$3 = Enemies$1[a$121];
            if (e$3.Alive$1) {
               TEnemy.Animate(e$3,dt);
            } else {
               TEnemy.UpdateDeath(e$3,dt);
            }
         }
      }
      if (Player.LandImpact != 0) {
         TWeapon.OnLand(Weapon,Player.LandImpact);
         Player.LandImpact = 0;
      }
      wi = TObject.Create($New(TWeaponInput));
      wi.Aiming = Player.Aiming$1;
      wi.Sprinting = TPlayer.Sprinting$1(Player);
      wi.LookDX = Player.LookDX$1;
      wi.LookDY = Player.LookDY$1;
      wi.MoveSpeed = Math.hypot(Player.Vel$1.x,Player.Vel$1.z);
      wi.Grounded = Player.Grounded$1;
      wi.Crouch = Player.CrouchK;
      wi.Time$2 = Game.Time$1;
      TWeapon.Update(Weapon,dt,Camera,wi);
      hostiles = Game.ToSpawn;
      var $temp10;
      for(a$122=0,$temp10=Enemies$1.length;a$122<$temp10;a$122++) {
         e$4 = Enemies$1[a$122];
         if (e$4.Alive$1) {
            hostiles++;
         }
      }
      THUD.Update$3(HUD,dt,Player,Weapon,Enemies$1,CurrentSpread(),Game.Grenades,Game.Score,Game.Wave,hostiles);
      TAudio.UpdateListener(Audio,Camera);
   } else if (Game.State == "menu" || Game.State == "paused") {
      t$6 = Game.Time$1 * 0.05;
      Camera.position.set(Sin(t$6) * 3,2.2 + Sin(t$6 * 0.7) * 0.3,62 - Cos(t$6) * 2);
      Camera.rotation.set(0.03,Sin(t$6 * 0.8) * 0.25 - 0.1,0);
      if (Game.State == "paused") {
         Camera.position.copy(Player.Pos$4);
         Camera.position.y += Player.Eye;
         Camera.rotation.set(Player.Pitch$1,Player.Yaw$1,0);
      }
      TWeapon.Update(Weapon,dt,Camera,TObject.Create($New(TWeaponInput)));
   }
   TEffects.Update$6(Effects,dt,Camera);
   UpdateShadowCamera();
   UpdatePostUniforms(dt);
   Renderer.info.reset();
   t0 = now;
   Composer.render(dt);
   Perf.calls = Renderer.info.render.calls;
   Perf.tris = Renderer.info.render.triangles;
   Perf.frames.push(now - ((Perf.lastNow != 0)?Perf.lastNow:now));
   Perf.lastNow = now;
   Perf.cpu = now - t0;
   if (Perf.frames.length > 120) {
      Perf.frames.shift();
   }
   if (Game.State == "playing" && Shot == "") {
      Perf.acc += dt;
      if (now - ((Perf.prev != 0)?Perf.prev:now) > 24) {
         Perf.slow += 1;
      }
      Perf.n += 1;
      Perf.prev = now;
      if (Perf.acc > 4) {
         if (Perf.slow / Perf.n > 0.5 && Quality < 2 && (!(Perf.userSet))) {
            SetQuality(Quality + 1);
            THUD.Banner(HUD,"","GRAPHICS ADJUSTED · "+QUALITY_NAMES[Quality],2);
         }
         Perf.acc = 0;
         Perf.slow = 0;
         Perf.n = 0;
      }
   } else {
      Perf.prev = now;
   }
   if (Shot != "") {
      ShotFrames += 1;
      if (ShotFrames == ShotFramesTarget()) {
         document.title = "READY";
         window.__ready = true;
      }
   }
}
function LockPointer() {
   var r$3;
   if (Params.has("nolock")) {
      return;
   }
   try {
      r$3 = Canvas.requestPointerLock({
         "unadjustedMovement" : true
      });
      if (r$3) {
         r$3.catch(function () {
            var r2;
            r2 = Canvas.requestPointerLock();
            if (r2) {
               r2.catch(function () {
                  if (Game.State == "playing" && Shot == "") {
                     Pause();
                  }
               });
            }
         });
      }
   } catch ($e) {
      /* null */
   }
}
function FinishInit() {
   var envTex = null,
      a$31 = 0,
      f$3 = null,
      a$30 = 0,
      p$3 = null,
      a$29 = 0,
      s$6 = null,
      a$28 = 0,
      t$6 = null,
      a$23 = [],
      a$24 = [],
      a$25 = [],
      a$26 = [];
   envTex = BuildEnv();
   Effects = TEffects.Create$84($New(TEffects),Scene,World,Audio);
   TEffects.SetFog(Effects,FOG_COLOR);
   a$23 = World.Fires;
   var $temp11;
   for(a$31=0,$temp11=a$23.length;a$31<$temp11;a$31++) {
      f$3 = a$23[a$31];
      TEffects.AddFire(Effects,f$3.Pos$2,f$3.Scale,f$3.Scale > 1);
   }
   a$24 = World.SmokeStacks;
   var $temp12;
   for(a$30=0,$temp12=a$24.length;a$30<$temp12;a$30++) {
      p$3 = a$24[a$30];
      TEffects.AddPlume(Effects,p$3);
   }
   a$25 = TEffects.Systems(Effects);
   var $temp13;
   for(a$29=0,$temp13=a$25.length;a$29<$temp13;a$29++) {
      s$6 = a$25[a$29];
      s$6.Mesh$3.userData.noAO = true;
   }
   a$26 = Effects.Tracers;
   var $temp14;
   for(a$28=0,$temp14=a$26.length;a$28<$temp14;a$28++) {
      t$6 = a$26[a$28];
      t$6.Mesh$2.userData.noAO = true;
   }
   Weapon = TWeapon.Create$77($New(TWeapon),Audio);
   Weapon.Scene$2.environment = envTex;
   Weapon.Scene$2.environmentIntensity = 0.8;
   Weapon.Sun$1.position.copy(SUN_DIR).multiplyScalar(10);
   Player = TPlayer.Create$80($New(TPlayer),Camera,World,Audio);
   HUD = THUD.Create$81($New(THUD),World);
   BuildComposer();
   Progress(0.97,"COMPILING SHADERS");
   setTimeout(function () {
      var dummy = null,
         warm = [],
         a$120 = 0,
         t$7 = null,
         a$121 = 0,
         s$7 = null,
         a$122 = 0,
         c$12 = null,
         a$123 = 0,
         o$1 = null,
         nade = null,
         a$124 = 0,
         f$4 = null,
         a$125 = 0,
         o$2 = null,
         a$126 = 0,
         f$5 = null;
      try {
         var a$127 = [],
             a$128 = [],
             a$129 = [],
             a$130 = [],
             a$131 = [];
         for(let i$2=0;i$2<=239;i$2++) {
            TEffects.Update$6(Effects,0.0333333333333333,Camera);
         }
         TPlayer.Update$2(Player,0.016);
         TWeapon.Update(Weapon,0.016,Camera,TObject.Create($New(TWeaponInput)));
         dummy = TEnemy.Create$82($New(TEnemy),Scene,World,V3(0,0,70));
         a$127 = Effects.Tracers;
         var $temp15;
         for(a$120=0,$temp15=a$127.length;a$120<$temp15;a$120++) {
            t$7 = a$127[a$120];
            warm.push(t$7.Mesh$2);
         }
         a$131 = Effects.Shells;
         var $temp16;
         for(a$121=0,$temp16=a$131.length;a$121<$temp16;a$121++) {
            s$7 = a$131[a$121];
            warm.push(s$7.Mesh$4);
         }
         a$130 = Effects.Chunks;
         var $temp17;
         for(a$122=0,$temp17=a$130.length;a$122<$temp17;a$122++) {
            c$12 = a$130[a$122];
            warm.push(c$12.Mesh$4);
         }
         warm.push(Weapon.FlashGroup);
         warm.push(Weapon.Dot);
         var $temp18;
         for(a$123=0,$temp18=warm.length;a$123<$temp18;a$123++) {
            o$1 = warm[a$123];
            o$1.visible = true;
         }
         nade = new THREE.Mesh(NadeGeo,NadeMat);
         nade.position.set(0,1,70);
         Scene.add(nade);
         a$129 = Effects.FlashLights;
         var $temp19;
         for(a$124=0,$temp19=a$129.length;a$124<$temp19;a$124++) {
            f$4 = a$129[a$124];
            f$4.Light.intensity = 1;
         }
         Renderer.compile(Scene,Camera);
         Renderer.compile(Weapon.Scene$2,Weapon.Camera$1);
         Composer.render(0.016);
         var $temp20;
         for(a$125=0,$temp20=warm.length;a$125<$temp20;a$125++) {
            o$2 = warm[a$125];
            o$2.visible = false;
         }
         a$128 = Effects.FlashLights;
         var $temp21;
         for(a$126=0,$temp21=a$128.length;a$126<$temp21;a$126++) {
            f$5 = a$128[a$126];
            f$5.Light.intensity = 0;
         }
         Scene.remove(nade);
         TEnemy.Dispose(dummy);
         Composer.render(0.016);
         Progress(1,"READY");
         El("loading").classList.add("hidden");
         El("deploy").classList.remove("hidden");
         El("menu").classList.remove("loading");
         if (Shot != "") {
            SetupShot(Shot);
         }
         window.__dbg = DebugHandles();
         requestAnimationFrame(Loop);
      } catch ($e) {
         var ex = $W($e);
         Fail(ex.FMessage)      }
   },0);
}
function Fail(msg) {
   console.error(msg);
   document.title = "ERROR " + msg;
   El("load-text").textContent = "ERROR: " + msg;
}
function Explode(pos$4) {
   var dp = 0,
      a$32 = 0,
      e$1 = null,
      d$9 = 0,
      dmg = 0,
      dir = null;
   TEffects.Explosion$1(Effects,pos$4);
   TAudio.Explosion(Audio,pos$4);
   dp = pos$4.distanceTo(TPlayer.HeadPos(Player,V3Zero()));
   TPlayer.Shake(Player,MaxF(0,1 - dp / 30));
   if (dp < 7 && TWorld.LineOfSight(World,pos$4.clone().setY(pos$4.y + 0.3),TPlayer.HeadPos(Player,V3Zero()))) {
      TPlayer.TakeDamage(Player,140 * (1 - dp / 7),pos$4);
   }
   var $temp22;
   for(a$32=0,$temp22=Enemies$1.length;a$32<$temp22;a$32++) {
      e$1 = Enemies$1[a$32];
      if (!(e$1.Alive$1)) {
         continue;
      }
      d$9 = e$1.Root$1.position.distanceTo(pos$4);
      if (d$9 < 8 && TWorld.LineOfSight(World,pos$4.clone().setY(pos$4.y + 0.3),TEnemy.EyePos(e$1,V3Zero()).setY(e$1.Root$1.position.y + 1))) {
         dmg = 180 * (1 - d$9 / 8);
         dir = e$1.Root$1.position.clone().sub(pos$4).setY(0.3).normalize();
         if (TEnemy.Damage$1(e$1,dmg,dir,"body")) {
            OnKill(e$1,false);
            THUD.Hit(HUD,"kill");
         } else {
            THUD.Hit(HUD,"");
         }
      }
   }
}
function DoMelee() {
   if (!(TWeapon.StartMelee(Weapon))) {
      return;
   }
   setTimeout(function () {
      var a$34 = 0,
         e$1 = null,
         toE = null;
      Camera.getWorldDirection(_d);
      var $temp23;
      for(a$34=0,$temp23=Enemies$1.length;a$34<$temp23;a$34++) {
         e$1 = Enemies$1[a$34];
         if (!(e$1.Alive$1)) {
            continue;
         }
         toE = e$1.Root$1.position.clone().sub(Player.Pos$4);
         toE.y = 0;
         if (toE.length() < 2.2 && toE.normalize().dot(V3(_d.x,0,_d.z).normalize()) > 0.6) {
            TEnemy.Damage$1(e$1,200,_d,"body");
            OnKill(e$1,false);
            THUD.Hit(HUD,"kill");
            TAudio.Hitmarker(Audio,true,false);
            TAudio.Impact(Audio,e$1.Root$1.position,"flesh");
            TPlayer.Shake(Player,0.15);
            break;
         }
      }
   },180);
}
function DisposeComposer() {
   var a$36 = 0,
      p$3 = null,
      a$35 = [];
   a$35 = Composer.passes;
   var $temp24;
   for(a$36=0,$temp24=a$35.length;a$36<$temp24;a$36++) {
      p$3 = a$35[a$36];
      p$3.dispose();
   }
   Composer.dispose();
}
function Die() {
   var acc$2 = 0;
   Game.State = "dead";
   document.exitPointerLock();
   MouseDown = false;
   RMB = false;
   THUD.Show(HUD,false);
   acc$2 = (Game.Shots > 0)?JSRound(Game.Hits / Game.Shots * 100):0;
   El("go-stats").innerHTML = "WAVE REACHED <b>"+IntStr(Game.Wave)+"<\/b><br>KILLS <b>"+IntStr(Game.Kills)+"<\/b> · HEADSHOTS <b>"+IntStr(Game.Headshots)+"<\/b><br>ACCURACY <b>"+Num(acc$2)+"%<\/b><br>SCORE <b>"+IntStr(Game.Score)+"<\/b>";
   El("gameover").classList.remove("hidden");
}
function DebugHandles() {
   var Result = null;
   Result = TObject.Create($New(TDebugHandles));
   Result.player = Player;
   Result.weapon = Weapon;
   Result.enemies = Enemies$1;
   Result.world = World;
   Result.effects = Effects;
   Result.camera = Camera;
   Result.scene = Scene;
   Result.renderer = Renderer;
   Result.game = Game;
   return Result
}
function CurrentSpread() {
   var Result = 0;
   var s$1 = null,
      move = 0,
      sp$1 = 0;
   s$1 = Weapon.Stats;
   move = MinF(1,Math.hypot(Player.Vel$1.x,Player.Vel$1.z) / 5);
   sp$1 = Mix(s$1.HipSpread,s$1.ADSSpread,Weapon.Aim);
   sp$1 *= 1 + move * 1.2 * (1 - Weapon.Aim * 0.8);
   if (Player.Crouching) {
      sp$1 *= 0.7;
   }
   if (!(Player.Grounded$1)) {
      sp$1 *= 2.5;
   }
   sp$1 += Game.Bloom * (1 - Weapon.Aim * 0.7);
   Result = sp$1;
   return Result
}
function BuildEnv() {
   var Result = null;
   var pm = null,
      envScene = null,
      s2 = null,
      m2 = null,
      ground = null,
      rt = null;
   pm = new THREE.PMREMGenerator(Renderer);
   envScene = new THREE.Scene();
   s2 = Sky.clone();
   m2 = SkyMat.clone();
   s2.material = m2;
   m2.uniforms["cloudAmt"].value = 0;
   m2.uniforms["sunDir"].value.copy(SUN_DIR);
   m2.uniforms["horizon"].value.copy(FOG_COLOR);
   m2.uniforms["sunDisk"].value = 0;
   envScene.add(s2);
   ground = new THREE.Mesh(new THREE.CircleGeometry(900,32),new THREE.MeshBasicMaterial({
      "color" : Col(0.22,0.17,0.12)
   }));
   ground.rotation.x = -1.5707963267949;
   ground.position.y = -30;
   envScene.add(ground);
   rt = pm.fromScene(envScene,0,1,2000);
   Scene.environment = rt.texture;
   Scene.environmentIntensity = 0.7;
   pm.dispose();
   Result = rt.texture;
   return Result
}
function BuildComposer() {
   var dpr = 0,
      w = 0,
      h = 0,
      rt$1 = null,
      gtao = null,
      cache = null;
   dpr = (!Quality)?MinF(window.devicePixelRatio,1.5):1;
   Renderer.setPixelRatio(dpr);
   Renderer.setSize(window.innerWidth,window.innerHeight);
   w = Floor(window.innerWidth * dpr);
   h = Floor(window.innerHeight * dpr);
   Sun.shadow.mapSize.setScalar((Quality == 2)?2048:4096);
   if (Sun.shadow.map) {
      Sun.shadow.map.dispose();
      Sun.shadow.map = null;
   }
   rt$1 = new THREE.WebGLRenderTarget(w,h,{
      "type" : 1016
      ,"samples" : 0
   });
   Composer = new THREEX.EffectComposer(Renderer,rt$1);
   Composer.setPixelRatio(1);
   Composer.setSize(w,h);
   Passes.Render = new THREEX.RenderPass(Scene,Camera);
   Composer.addPass(Passes.Render);
   if (Quality < 2) {
      gtao = new THREEX.GTAOPass(Scene,Camera,w,h);
      gtao.output = 0;
      gtao.blendIntensity = 1;
      gtao.updateGtaoMaterial({
         "thickness" : 1.2
         ,"scale" : 1.1
         ,"samples" : (!Quality)?16:12
         ,"radius" : 0.9
         ,"distanceExponent" : 1.4
      });
      gtao.updatePdMaterial({
         "samples" : 16
         ,"rings" : 2
         ,"radius" : 6
         ,"normalPhi" : 3
         ,"lumaPhi" : 10
         ,"depthPhi" : 2
      });
      cache = gtao._visibilityCache;
      gtao.overrideVisibility = function () {
         Scene.traverse(function (o$1) {
            cache.set(o$1,o$1.visible);
            if (o$1.isPoints || o$1.isLine || $VarToBool(o$1.userData.noAO)) {
               o$1.visible = false;
            }
         });
      };
      Composer.addPass(gtao);
      Passes.GTAO = gtao;
   } else {
      Passes.GTAO = null;
   }
   Passes.Rays = new THREEX.ShaderPass(ShaderPassDef(GodRayShader()));
   Composer.addPass(Passes.Rays);
   Passes.WeaponPass = new THREEX.RenderPass(Weapon.Scene$2,Weapon.Camera$1);
   Passes.WeaponPass.clear = false;
   Passes.WeaponPass.clearDepth = true;
   Passes.WeaponPass.enabled = Game.State != "menu" || Shot != "" && (!(SHOTMENU));
   Composer.addPass(Passes.WeaponPass);
   Composer.addPass(new THREEX.UnrealBloomPass(new THREE.Vector2(w / 2,h / 2),0.32,0.55,0.92));
   Composer.addPass(new THREEX.OutputPass());
   Passes.Grade = new THREEX.ShaderPass(ShaderPassDef(GradeShader()));
   Composer.addPass(Passes.Grade);
   Composer.addPass(new THREEX.SMAAPass(w,h));
   TWeapon.SetAspect(Weapon,window.innerWidth / window.innerHeight);
   El("quality-val").textContent = QUALITY_NAMES[Quality];
}
function BuildAtmosphere() {
   var sd = null,
      sc = null;
   SUN_DIR = V3(-0.62,0.2,-0.76).normalize();
   FOG_COLOR = Col(0.7,0.62,0.52);
   InstallFog(SUN_DIR,Col(1.45,0.98,0.58),0.06);
   Scene.fog = new THREE.FogExp2(FOG_COLOR.clone(),0.003);
   sd = SkyShader();
   SkyMat = new THREE.ShaderMaterial({
      "vertexShader" : sd.VertexShader
      ,"uniforms" : sd.Uniforms
      ,"side" : 1
      ,"fragmentShader" : sd.FragmentShader
      ,"fog" : false
      ,"depthWrite" : false
   });
   Sky = new THREE.Mesh(new THREE.SphereGeometry(1000,48,24),SkyMat);
   SkyMat.uniforms["sunDir"].value.copy(SUN_DIR);
   SkyMat.uniforms["horizon"].value.copy(FOG_COLOR);
   Sky.userData.noAO = true;
   Sky.frustumCulled = false;
   Sky.renderOrder = -1;
   Scene.add(Sky);
   Sun = new THREE.DirectionalLight(16764826,5);
   Sun.castShadow = true;
   Sun.shadow.mapSize.set(4096,4096);
   sc = Sun.shadow.camera;
   sc.left = -55;
   sc.right = 55;
   sc.top = 55;
   sc.bottom = -55;
   sc.near = 1;
   sc.far = 260;
   Sun.shadow.bias = -0.00025;
   Sun.shadow.normalBias = 0.035;
   Sun.shadow.radius = 2;
   Scene.add(Sun);
   Scene.add(Sun.target);
   Hemi = new THREE.HemisphereLight(10335444,7034946,0.3);
   Scene.add(Hemi);
   Bounce = new THREE.DirectionalLight(16761482,0.45);
   Bounce.position.set(-SUN_DIR.x,0.25,-SUN_DIR.z);
   Scene.add(Bounce);
}
function BindInput() {
   Canvas = Renderer.domElement;
   El("deploy").addEventListener("click",function (e$1) {
      TAudio.Init(Audio);
      StartGame();
   });
   El("redeploy").addEventListener("click",function (e$1) {
      TAudio.Init(Audio);
      Restart();
   });
   document.addEventListener("pointerlockchange",function (e$1) {
      if (document.pointerLockElement !== Canvas && Game.State == "playing") {
         Pause();
      }
   });
   Canvas.addEventListener("click",function (e$1) {
      if (Game.State == "playing" && document.pointerLockElement !== Canvas) {
         LockPointer();
      }
   });
   document.addEventListener("mousemove",function (e$1) {
      var me$2 = null;
      me$2 = e$1;
      if (document.pointerLockElement === Canvas && !!Player) {
         TPlayer.OnMouse(Player,me$2.movementX,me$2.movementY);
      }
   });
   document.addEventListener("mousedown",function (e$1) {
      var me = null;
      if (Game.State != "playing") {
         return;
      }
      me = e$1;
      if (!me.button) {
         MouseDown = true;
      }
      if (me.button == 2) {
         RMB = true;
      }
   });
   document.addEventListener("mouseup",function (e$1) {
      var me$1 = null;
      me$1 = e$1;
      if (!me$1.button) {
         MouseDown = false;
      }
      if (me$1.button == 2) {
         RMB = false;
      }
   });
   document.addEventListener("contextmenu",function (e$1) {
      e$1.preventDefault();
   });
   document.addEventListener("keydown",function (e$1) {
      var ke = null;
      ke = e$1;
      if (ke.code == "KeyQ" && !!Composer) {
         Perf.userSet = true;
         SetQuality((Quality + 1) % 3);
         return;
      }
      if (!Player || Game.State != "playing") {
         return;
      }
      if (ke.repeat) {
         return;
      }
      Player.Keys[ke.code]=true;
      if (ke.code == "KeyR") {
         TWeapon.StartReload(Weapon);
      }
      if (ke.code == "KeyC" || ke.code == "ControlLeft") {
         TPlayer.CrouchPressed(Player);
      }
      if (ke.code == "KeyG") {
         ThrowGrenade();
      }
      if (ke.code == "KeyV") {
         DoMelee();
      }
      if (ke.code == "Tab") {
         e$1.preventDefault();
      }
   });
   document.addEventListener("keyup",function (e$1) {
      if (Player) {
         Player.Keys[e$1.code]=false;
      }
   });
   window.addEventListener("resize",function (e$1) {
      Camera.aspect = window.innerWidth / window.innerHeight;
      Camera.updateProjectionMatrix();
      clearTimeout(ResizeT);
      ResizeT = setTimeout(function () {
         if (Composer) {
            DisposeComposer();
            BuildComposer();
         }
      },150);
   });
}
var QUALITY_NAMES = ["ULTRA","HIGH","MEDIUM"];
function ToFixed(x$5, digits) {
   var Result = "";
   Result = (x$5).toFixed(digits);
   return Result
}
function Smooth(a$119, b$7, x$5) {
   var Result = 0;
   var t$1 = 0;
   t$1 = Clamp01((x$5 - a$119) / (b$7 - a$119));
   Result = t$1*t$1 * (3 - 2 * t$1);
   return Result
}
function RunSteps(steps, i$2) {
   if (i$2 >= steps.length) {
      return;
   }
   steps[i$2]();
   setTimeout(function () {
      RunSteps(steps,i$2 + 1);
   },0);
}
function Num(x$5) {
   var Result = "";
   Result = String(x$5);
   return Result
}
function NewCanvas(w$2, h$4) {
   var Result = null;
   Result = document.createElement("canvas");
   Result.width = w$2;
   Result.height = h$4;
   return Result
}
function Mix(a$119, b$7, t$6) {
   var Result = 0;
   Result = a$119 + (b$7 - a$119) * t$6;
   return Result
}
function MinF(a$119, b$7) {
   var Result = 0;
   if (a$119 < b$7) {
      Result = a$119;
   } else {
      Result = b$7;
   }
   return Result
}
function MaxF(a$119, b$7) {
   var Result = 0;
   if (a$119 > b$7) {
      Result = a$119;
   } else {
      Result = b$7;
   }
   return Result
}
function LocalSet(k$8, v$3) {
   try {
      window.localStorage.setItem(k$8, v$3);
   } catch ($e) {
      /* null */
   }
}
function LocalGet(k$8) {
   var Result = "";
   var v$3 = undefined;
   Result = "";
   try {
      v$3 = window.localStorage.getItem(k$8);
      if (!(VarIsNull(v$3))) {
         Result = String(v$3);
      }
   } catch ($e) {
      /* null */
   }
   return Result
}
function JSRound(x$5) {
   var Result = 0;
   Result = Floor(x$5 + 0.5);
   return Result
}
function IntStr(x$5) {
   var Result = "";
   Result = String(x$5);
   return Result
}
function FSign(x$5) {
   var Result = 0;
   if (x$5 > 0) {
      Result = 1;
   } else if (x$5 < 0) {
      Result = -1;
   } else {
      Result = 0;
   }
   return Result
}
function FMod(a$119, b$7) {
   var Result = 0;
   Result = a$119 - Trunc(a$119 / b$7) * b$7;
   return Result
}
function El(id$4) {
   var Result = null;
   Result = document.getElementById(id$4);
   return Result
}
function Ease(t$6) {
   var Result = 0;
   Result = t$6*t$6 * (3 - 2 * t$6);
   return Result
}
function Damp(a$119, b$7, k$8, dt$1) {
   var Result = 0;
   Result = a$119 + (b$7 - a$119) * (1 - Exp((-k$8) * dt$1));
   return Result
}
function ClampF(x$5, a$119, b$7) {
   var Result = 0;
   if (x$5 < a$119) {
      Result = a$119;
   } else if (x$5 > b$7) {
      Result = b$7;
   } else {
      Result = x$5;
   }
   return Result
}
function Clamp01(x$5) {
   var Result = 0;
   if (x$5 < 0) {
      Result = 0;
   } else if (x$5 > 1) {
      Result = 1;
   } else {
      Result = x$5;
   }
   return Result
}
function CharCode(s$6, i$2) {
   var Result = 0;
   Result = (s$6).charCodeAt(i$2);
   return Result
}
function V3Zero() {
   var Result = null;
   Result = new THREE.Vector3();
   return Result
}
function V3(x$5, y$5, z$3) {
   var Result = null;
   Result = new THREE.Vector3(x$5,y$5,z$3);
   return Result
}
function Uni(v$3) {
   var Result = undefined;
   Result = {
      "value" : v$3
   };
   return Result
}
function Col(r$3, g$11, b$7) {
   var Result = null;
   Result = new THREE.Color(r$3,g$11,b$7);
   return Result
}
/// TTexel = class (TObject)
var TTexel = {
   $ClassName:"TTexel",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.B = $.G = $.H = $.Metal = $.R = $.Rough = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TPBRMaps = class (TObject)
var TPBRMaps = {
   $ClassName:"TPBRMaps",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Map = $.MetalnessMap = $.NormalMap = $.RoughnessMap = null;
   }
   ,Destroy:TObject.Destroy
};
function SpriteTex(kind) {
   var Result = null;
   var c = null;
   {var $temp25 = kind;
      if ($temp25=="smoke") {
         c = Canvas$1(256,256,function (g$11, w$2, h$4) {
            var img = null,
               d = null,
               u$4 = 0,
               v$3 = 0,
               dd = 0,
               n$22 = 0,
               a$119 = 0,
               p$3 = 0,
               s$6 = 0;
            img = g$11.createImageData(w$2,h$4);
            d = img.data;
            for(let y$5=0,$temp26=h$4;y$5<$temp26;y$5++) {
               for(let x$5=0,$temp27=w$2;x$5<$temp27;x$5++) {
                  u$4 = x$5 / w$2;
                  v$3 = y$5 / h$4;
                  dd = Math.hypot(u$4 - 0.5,v$3 - 0.5) * 2;
                  n$22 = FBM(u$4,v$3,4,5,301,0.5);
                  a$119 = Clamp01((1 - dd) * 1.6 - (1 - n$22) * 0.9);
                  p$3 = (y$5 * w$2 + x$5)*4;
                  s$6 = 200 + n$22 * 55;
                  d[p$3]=s$6;
                  d[(p$3 + 1)]=s$6;
                  d[(p$3 + 2)]=s$6;
                  d[(p$3 + 3)]=(a$119*a$119 * 255);
               }
            }
            g$11.putImageData(img,0,0);
         });
      }
       else if ($temp25=="flash") {
         c = Canvas$1(256,256,function (g$11, w$2, h$4) {
            var grd$6 = null,
               lg = null;
            g$11.translate(w$2 / 2,h$4 / 2);
            grd$6 = g$11.createRadialGradient(0,0,0,0,0,w$2 / 2);
            grd$6.addColorStop(0,"rgba(255,255,240,1)");
            grd$6.addColorStop(0.12,"rgba(255,230,160,0.95)");
            grd$6.addColorStop(0.35,"rgba(255,150,40,0.45)");
            grd$6.addColorStop(1,"rgba(255,90,0,0)");
            g$11.fillStyle = grd$6;
            g$11.beginPath();
            g$11.arc(0,0,w$2 / 2,0,6.28318530717959);
            g$11.fill();
            g$11.globalCompositeOperation = "lighter";
            for(let i$2=0;i$2<=6;i$2++) {
               g$11.rotate(0.897597901025655 + Math.random() * 0.3);
               lg = g$11.createLinearGradient(0,0,w$2 / 2,0);
               lg.addColorStop(0,"rgba(255,240,200,0.9)");
               lg.addColorStop(1,"rgba(255,120,20,0)");
               g$11.fillStyle = lg;
               g$11.beginPath();
               g$11.moveTo(0,-6);
               g$11.lineTo(w$2 * (0.32 + Math.random() * 0.18),0);
               g$11.lineTo(0,6);
               g$11.fill();
            }
         });
      }
       else if ($temp25=="flashSide") {
         c = Canvas$1(256,128,function (g$11, w$2, h$4) {
            var grd = null,
               x$5 = 0,
               hh = 0,
               x$6 = 0,
               hh$1 = 0;
            grd = g$11.createLinearGradient(0,0,w$2,0);
            grd.addColorStop(0,"rgba(255,250,220,1)");
            grd.addColorStop(0.3,"rgba(255,200,90,0.8)");
            grd.addColorStop(1,"rgba(255,90,0,0)");
            g$11.fillStyle = grd;
            g$11.beginPath();
            g$11.moveTo(0,h$4 / 2 - 14);
            for(let i$2=0;i$2<=10;i$2++) {
               x$5 = i$2 / 10 * w$2;
               hh = (1 - i$2 / 10) * h$4 / 2 * (0.5 + Math.random() * 0.5);
               g$11.lineTo(x$5,h$4 / 2 - hh);
            }
            for(let i$3=10;i$3>=0;i$3--) {
               x$6 = i$3 / 10 * w$2;
               hh$1 = (1 - i$3 / 10) * h$4 / 2 * (0.5 + Math.random() * 0.5);
               g$11.lineTo(x$6,h$4 / 2 + hh$1);
            }
            g$11.fill();
         });
      }
       else if ($temp25=="spark") {
         c = Canvas$1(64,64,function (g$11, w$2, h$4) {
            var grd$5 = null;
            grd$5 = g$11.createRadialGradient(w$2 / 2,h$4 / 2,0,w$2 / 2,h$4 / 2,w$2 / 2);
            grd$5.addColorStop(0,"rgba(255,255,255,1)");
            grd$5.addColorStop(0.2,"rgba(255,220,150,0.9)");
            grd$5.addColorStop(1,"rgba(255,120,0,0)");
            g$11.fillStyle = grd$5;
            g$11.fillRect(0,0,w$2,h$4);
         });
      }
       else if ($temp25=="fire") {
         c = Canvas$1(128,128,function (g$11, w$2, h$4) {
            var img$1 = null,
               d$1 = null,
               u$4 = 0,
               v$3 = 0,
               vv = 0,
               width$3 = 0,
               n$22 = 0,
               dx = 0,
               core = 0,
               a$119 = 0,
               p$3 = 0;
            img$1 = g$11.createImageData(w$2,h$4);
            d$1 = img$1.data;
            for(let y$5=0,$temp28=h$4;y$5<$temp28;y$5++) {
               for(let x$5=0,$temp29=w$2;x$5<$temp29;x$5++) {
                  u$4 = x$5 / w$2;
                  v$3 = y$5 / h$4;
                  vv = 1 - v$3;
                  width$3 = 0.36 * Power(MaxF(0,1 - vv),0.7) * (0.6 + 0.4 * Sin(vv * 3.14));
                  n$22 = FBM(u$4,v$3 * 0.7,5,5,311,0.5);
                  dx = Abs$_Float_(u$4 - 0.5 + (n$22 - 0.5) * 0.25 * vv);
                  core = Clamp01(1 - dx / (width$3 + 0.001));
                  a$119 = Clamp01(Power(core,1.2) * (0.6 + n$22 * 0.8) * Smooth(0,0.18,vv + 0.05));
                  p$3 = (y$5 * w$2 + x$5)*4;
                  d$1[p$3]=255;
                  d$1[(p$3 + 1)]=(170 + core * 85);
                  d$1[(p$3 + 2)]=(90 + core * 140);
                  d$1[(p$3 + 3)]=(a$119 * 255);
               }
            }
            g$11.putImageData(img$1,0,0);
         });
      }
       else if ($temp25=="blood") {
         c = Canvas$1(128,128,function (g$11, w$2, h$4) {
            var r$3 = 0,
               x$5 = 0,
               y$5 = 0,
               grd$7 = null;
            for(let i$2=0;i$2<=17;i$2++) {
               r$3 = 6 + Math.random() * 22;
               x$5 = w$2 / 2 + (Math.random() - 0.5) * 60;
               y$5 = h$4 / 2 + (Math.random() - 0.5) * 60;
               grd$7 = g$11.createRadialGradient(x$5,y$5,0,x$5,y$5,r$3);
               grd$7.addColorStop(0,"rgba(120,6,4,0.9)");
               grd$7.addColorStop(1,"rgba(90,0,0,0)");
               g$11.fillStyle = grd$7;
               g$11.beginPath();
               g$11.arc(x$5,y$5,r$3,0,6.28318530717959);
               g$11.fill();
            }
         });
      }
       else if ($temp25=="hole") {
         c = Canvas$1(128,128,function (g$11, w$2, h$4) {
            var cx = 0,
               cy = 0,
               a$119 = 0,
               r$3 = 0,
               grd$1 = null;
            cx = w$2 / 2;
            cy = h$4 / 2;
            for(let i$2=0;i$2<=25;i$2++) {
               a$119 = Math.random() * 3.14159265358979 * 2;
               r$3 = 10 + Math.random() * 38;
               g$11.fillStyle = "rgba(20,18,16,"+Num(0.08 + Math.random() * 0.15)+")";
               g$11.beginPath();
               g$11.ellipse(cx + Cos(a$119) * r$3 * 0.4,cy + Sin(a$119) * r$3 * 0.4,r$3 * 0.5,r$3 * 0.2,a$119,0,6.28318530717959);
               g$11.fill();
            }
            grd$1 = g$11.createRadialGradient(cx,cy,0,cx,cy,30);
            grd$1.addColorStop(0,"rgba(0,0,0,1)");
            grd$1.addColorStop(0.35,"rgba(10,8,6,0.95)");
            grd$1.addColorStop(0.6,"rgba(60,55,50,0.5)");
            grd$1.addColorStop(1,"rgba(0,0,0,0)");
            g$11.fillStyle = grd$1;
            g$11.beginPath();
            g$11.arc(cx,cy,30,0,6.28318530717959);
            g$11.fill();
         });
      }
       else if ($temp25=="scorch") {
         c = Canvas$1(256,256,function (g$11, w$2, h$4) {
            var img$2 = null,
               d$2 = null,
               u$4 = 0,
               v$3 = 0,
               dd = 0,
               n$22 = 0,
               a$119 = 0,
               p$3 = 0;
            img$2 = g$11.createImageData(w$2,h$4);
            d$2 = img$2.data;
            for(let y$5=0,$temp30=h$4;y$5<$temp30;y$5++) {
               for(let x$5=0,$temp31=w$2;x$5<$temp31;x$5++) {
                  u$4 = x$5 / w$2;
                  v$3 = y$5 / h$4;
                  dd = Math.hypot(u$4 - 0.5,v$3 - 0.5) * 2;
                  n$22 = FBM(u$4,v$3,5,5,321,0.5);
                  a$119 = Clamp01((1 - dd) * 1.4 - (1 - n$22) * 0.5);
                  p$3 = (y$5 * w$2 + x$5)*4;
                  d$2[p$3]=12;
                  d$2[(p$3 + 1)]=10;
                  d$2[(p$3 + 2)]=8;
                  d$2[(p$3 + 3)]=(a$119 * 235);
               }
            }
            g$11.putImageData(img$2,0,0);
         });
      }
       else if ($temp25=="glow") {
         c = Canvas$1(128,128,function (g$11, w$2, h$4) {
            var grd$2 = null;
            grd$2 = g$11.createRadialGradient(w$2 / 2,h$4 / 2,0,w$2 / 2,h$4 / 2,w$2 / 2);
            grd$2.addColorStop(0,"rgba(255,255,255,1)");
            grd$2.addColorStop(0.25,"rgba(255,255,255,0.35)");
            grd$2.addColorStop(1,"rgba(255,255,255,0)");
            g$11.fillStyle = grd$2;
            g$11.fillRect(0,0,w$2,h$4);
         });
      }
       else if ($temp25=="reddot") {
         c = Canvas$1(128,128,function (g$11, w$2, h$4) {
            var grd$4 = null;
            grd$4 = g$11.createRadialGradient(w$2 / 2,h$4 / 2,0,w$2 / 2,h$4 / 2,16);
            grd$4.addColorStop(0,"rgba(255,90,70,1)");
            grd$4.addColorStop(0.35,"rgba(255,40,25,1)");
            grd$4.addColorStop(0.55,"rgba(255,20,10,0.35)");
            grd$4.addColorStop(1,"rgba(255,0,0,0)");
            g$11.fillStyle = grd$4;
            g$11.beginPath();
            g$11.arc(w$2 / 2,h$4 / 2,16,0,6.28318530717959);
            g$11.fill();
         });
      }
       else if ($temp25=="window") {
         c = Canvas$1(256,256,function (g$11, w$2, h$4) {
            var grd$3 = null;
            g$11.fillStyle = "#2a2520";
            g$11.fillRect(0,0,w$2,h$4);
            grd$3 = g$11.createLinearGradient(0,0,0,h$4);
            grd$3.addColorStop(0,"rgba(90,78,62,0.6)");
            grd$3.addColorStop(1,"rgba(15,12,10,0.4)");
            g$11.fillStyle = grd$3;
            g$11.fillRect(0,0,w$2,h$4);
            g$11.fillStyle = "rgba(0,0,0,0.6)";
            g$11.fillRect(w$2 * 0.1,h$4 * 0.55,w$2 * 0.35,h$4 * 0.45);
            g$11.fillRect(w$2 * 0.6,h$4 * 0.3,w$2 * 0.25,h$4 * 0.7);
            g$11.fillStyle = "rgba(120,100,80,0.18)";
            g$11.fillRect(0,0,w$2 * 0.08,h$4);
            g$11.fillRect(w$2 * 0.92,0,w$2 * 0.08,h$4);
         });
      }
   }
   Result = SrgbTex(c);
   return Result
}
function SkylineTex() {
   var Result = null;
   var c$1 = null;
   c$1 = Canvas$1(256,256,function (g$11, w$2, h$4) {
      var lit = 0;
      g$11.fillStyle = "#8c857a";
      g$11.fillRect(0,0,w$2,h$4);
      for(let fy=0;fy<=7;fy++) {
         for(let fx=0;fx<=7;fx++) {
            lit = Math.random();
            g$11.fillStyle = (lit < 0.06)?"#c9a46a":(lit < 0.5)?"#2b2c2e":"#3a3b3c";
            g$11.fillRect((fx*32) + 9,(fy*32) + 8,14,17);
         }
      }
      g$11.fillStyle = "rgba(0,0,0,0.15)";
      for(let fy$1=0;fy$1<=7;fy$1++) {
         g$11.fillRect(0,(fy$1*32) + 28,w$2,3);
      }
   });
   Result = AnisoTex(c$1);
   Result.wrapS = 1000;
   Result.wrapT = 1000;
   return Result
}
function SignTex(i$2) {
   var Result = null;
   var shop = {Ar:"",Bg:"",En:"",Fg:""},
      c$2 = null;
   Copy$TShop(SHOPS[i$2 % 12],shop);
   c$2 = Canvas$1(512,128,function (g$11, w$2, h$4) {
      g$11.fillStyle = shop.Bg;
      g$11.fillRect(0,0,w$2,h$4);
      g$11.strokeStyle = shop.Fg;
      g$11.globalAlpha = 0.6;
      g$11.lineWidth = 4;
      g$11.strokeRect(8,8,w$2 - 16,h$4 - 16);
      g$11.globalAlpha = 1;
      g$11.fillStyle = shop.Fg;
      g$11.textAlign = "center";
      g$11.textBaseline = "middle";
      g$11.font = "bold 52px \"Arial Black\", Impact, sans-serif";
      g$11.fillText(shop.En,w$2 * 0.36,h$4 * 0.52,w$2 * 0.6);
      g$11.font = "bold 50px \"Geeza Pro\", \"Noto Naskh Arabic\", \"Arial\", sans-serif";
      g$11.fillText(shop.Ar,w$2 * 0.82,h$4 * 0.52,w$2 * 0.3);
      Weather(g$11,w$2,h$4,1,400 + i$2 * 7);
   });
   Result = AnisoTex(c$2);
   return Result
}
function SetAnisotropy(a$119) {
   MaxAniso = a$119;
}
function PosterTex(i$2) {
   var Result = null;
   var c$3 = null;
   c$3 = Canvas$1(256,256,function (g$11, w$2, h$4) {
      var n$3 = 0,
         pal0 = "",
         pal1 = "",
         words = [],
         pw = 0,
         x$5 = 0,
         y$5 = 0,
         ph = 0;
      n$3 = 1 + i$2 % 2;
      switch ((i$2 % 4)) {
         case 0 :
            pal0 = "#b23a2b";
            pal1 = "#f1e3c6";
            break;
         case 1 :
            pal0 = "#2d4a3e";
            pal1 = "#e9dfc4";
            break;
         case 2 :
            pal0 = "#1f3a5f";
            pal1 = "#efe6d0";
            break;
         default :
            pal0 = "#6b4b2a";
            pal1 = "#f3e7cf";
      }
      words = ["UNITY", "VOTE", "SERVE", "STAND"];
      for(let k$8=0,$temp32=n$3;k$8<$temp32;k$8++) {
         pw = (w$2 - 16) / n$3 - 6;
         x$5 = 8 + k$8 * (pw + 6);
         y$5 = 10 + (k$8*8);
         ph = h$4 - 30;
         g$11.fillStyle = pal1;
         g$11.fillRect(x$5,y$5,pw,ph);
         g$11.fillStyle = pal0;
         g$11.fillRect(x$5,y$5,pw,ph * 0.22);
         g$11.fillStyle = pal1;
         g$11.font = "bold "+IntStr(Floor(pw / 6))+"px \"Arial Black\", Impact, sans-serif";
         g$11.textAlign = "center";
         g$11.fillText(words[(i$2 + k$8) % 4],x$5 + pw / 2,y$5 + ph * 0.16,pw - 10);
         g$11.fillStyle = pal0;
         g$11.globalAlpha = 0.85;
         g$11.beginPath();
         g$11.arc(x$5 + pw / 2,y$5 + ph * 0.45,pw * 0.14,0,6.28318530717959);
         g$11.fill();
         g$11.beginPath();
         g$11.ellipse(x$5 + pw / 2,y$5 + ph * 0.72,pw * 0.3,pw * 0.2,0,3.14159265358979,0);
         g$11.fill();
         g$11.globalAlpha = 1;
         g$11.fillStyle = "rgba(30,30,30,0.7)";
         for(let l=0;l<=2;l++) {
            g$11.fillRect(x$5 + pw * 0.15,y$5 + ph * 0.8 + l * 9,pw * 0.7 * (1 - l * 0.15),4);
         }
         g$11.clearRect(x$5 + pw - 16 - k$8 * 6,y$5,16 + k$8 * 6,12 + (k$8*4));
      }
      Weather(g$11,w$2,h$4,0.9,600 + i$2);
   });
   Result = AnisoTex(c$3);
   return Result
}
function PaperTex() {
   var Result = null;
   var c$4 = null;
   c$4 = Canvas$1(128,128,function (g$11, w$2, h$4) {
      g$11.fillStyle = "#d9d2c3";
      g$11.fillRect(0,0,w$2,h$4);
      g$11.fillStyle = "rgba(40,40,40,0.5)";
      for(let l=0;l<=9;l++) {
         g$11.fillRect(12,14 + l * 10,60 + Math.random() * 44,3);
      }
      Weather(g$11,w$2,h$4,1,777);
   });
   Result = SrgbTex(c$4);
   return Result
}
function LeafTex() {
   var Result = null;
   var c$5 = null;
   c$5 = Canvas$1(256,256,function (g$11, w$2, h$4) {
      var x$5 = 0,
         y$5 = 0,
         s$6 = 0,
         a$119 = 0,
         shade$1 = 0;
      for(let k$8=0;k$8<=69;k$8++) {
         x$5 = 20 + Math.random() * (w$2 - 40);
         y$5 = 20 + Math.random() * (h$4 - 40);
         s$6 = 9 + Math.random() * 12;
         a$119 = Math.random() * 3.14159265358979 * 2;
         shade$1 = 0.55 + Math.random() * 0.45;
         g$11.fillStyle = "rgb("+IntStr(Floor(92 * shade$1))+", "+IntStr(Floor(104 * shade$1))+", "+IntStr(Floor(46 * shade$1))+")";
         g$11.save();
         g$11.translate(x$5,y$5);
         g$11.rotate(a$119);
         g$11.beginPath();
         g$11.moveTo(-s$6,0);
         g$11.quadraticCurveTo(0,(-s$6) * 0.55,s$6,0);
         g$11.quadraticCurveTo(0,s$6 * 0.55,-s$6,0);
         g$11.fill();
         g$11.restore();
      }
   });
   Result = AnisoTex(c$5);
   return Result
}
function GraffitiTex(i$2) {
   var Result = null;
   var c$6 = null;
   c$6 = Canvas$1(512,256,function (g$11, w$2, h$4) {
      var seed = 0,
         R$1 = null,
         cols = [],
         words$1 = [],
         word = "",
         outline = "",
         fill$1 = "",
         x$5 = 0,
         img$3 = null,
         d$3 = null,
         p$3 = 0,
         n$22 = 0;
      seed = 1000 + i$2 * 17;
      R$1 = function () {
         var Result = 0;
         seed = seed * 16807 % 2147483647;
         Result = seed / 2147483647;
         return Result
      };
      cols = ["#c1121f", "#e36414", "#e9c46a", "#2a9d8f", "#f1faee", "#111111", "#3a86ff", "#8338ec"];
      words$1 = ["FREEDOM", "NO WAR", "RESIST", "ZONE 7", "HOPE", "\u062D\u0631\u064A\u0629", "ASHFALL", "LIVE"];
      word = words$1[i$2 % words$1.length];
      g$11.textAlign = "center";
      g$11.textBaseline = "middle";
      g$11.save();
      g$11.translate(w$2 / 2,h$4 / 2);
      g$11.rotate((R$1() - 0.5) * 0.18);
      g$11.font = "bold "+Num(100 + R$1() * 30)+"px \"Marker Felt\", \"Chalkboard SE\", \"Arial Black\", sans-serif";
      outline = cols[Floor(R$1() * cols.length)];
      fill$1 = cols[Floor(R$1() * cols.length)];
      g$11.shadowColor = outline;
      g$11.shadowBlur = 18;
      g$11.lineWidth = 16;
      g$11.strokeStyle = outline;
      g$11.strokeText(word,0,0,w$2 * 0.92);
      g$11.shadowBlur = 6;
      g$11.shadowColor = fill$1;
      g$11.fillStyle = fill$1;
      g$11.fillText(word,0,0,w$2 * 0.92);
      g$11.restore();
      g$11.globalAlpha = 0.55;
      g$11.fillStyle = fill$1;
      for(let k$8=0;k$8<=9;k$8++) {
         x$5 = 60 + R$1() * (w$2 - 120);
         g$11.fillRect(x$5,h$4 * 0.62,2.5,10 + R$1() * 50);
      }
      g$11.globalAlpha = 1;
      img$3 = g$11.getImageData(0,0,w$2,h$4);
      d$3 = img$3.data;
      for(let y$5=0,$temp33=h$4;y$5<$temp33;y$5++) {
         for(let x$6=0,$temp34=w$2;x$6<$temp34;x$6++) {
            p$3 = (y$5 * w$2 + x$6)*4;
            n$22 = FBM(x$6 / w$2,y$5 / h$4,8,4,900 + i$2,0.5);
            d$3[(p$3 + 3)]=(d$3[(p$3 + 3)] * Clamp01(0.35 + n$22 * 1.1) * 0.9);
         }
      }
      g$11.putImageData(img$3,0,0);
   });
   Result = AnisoTex(c$6);
   return Result
}
function GenWood(size, base) {
   var Result = null;
   var bc = [0,0,0];
   bc = C(base);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var planks = 0,
         pv = 0,
         pln = 0,
         fv = 0,
         gap = 0,
         id$1 = 0,
         grain = 0,
         ring = 0,
         knot = 0,
         dirt = 0,
         k = 0;
      planks = 5;
      pv = v$3 * planks;
      pln = Floor(pv);
      fv = pv - pln;
      gap = Smooth(0,0.04,MinF(fv,1 - fv));
      id$1 = Hash2(pln,0,151);
      grain = FBMA(u$4 + id$1,v$3,2,48,5,153 + pln);
      ring = Sin((grain * 12 + fv * 3) * 3.14159265358979) * 0.5 + 0.5;
      Worley(u$4,v$3,5,155);
      knot = Smooth(0.08,0,W0);
      dirt = Smooth(0.5,0.9,FBM(u$4,v$3,4,5,157,0.5));
      k = (0.75 + id$1 * 0.35) * (0.85 + ring * 0.2) * (1 - knot * 0.5) * (1 - dirt * 0.3);
      o$1.R = bc[0] * k;
      o$1.G = bc[1] * k;
      o$1.B = bc[2] * k;
      o$1.R *= Mix(0.3,1,gap);
      o$1.G *= Mix(0.3,1,gap);
      o$1.B *= Mix(0.3,1,gap);
      o$1.H = gap * (0.6 + ring * 0.1) - knot * 0.1;
      o$1.Rough = 0.8 + ring * 0.1;
   },2.5,0.6,1);
   return Result
}
function GenSidewalk(size) {
   var Result = null;
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var su = 0,
         sv = 0,
         fu = 0,
         fv$1 = 0,
         edge = 0,
         seam = 0,
         slab = 0,
         n$4 = 0,
         fine = 0,
         pit = 0,
         stain = 0,
         g$3 = 0;
      su = u$4 * 2;
      sv = v$3 * 2;
      fu = su - Floor(su);
      fv$1 = sv - Floor(sv);
      edge = MinF(MinF(fu,1 - fu),MinF(fv$1,1 - fv$1));
      seam = Smooth(0.004,0.018,edge);
      slab = Hash2(Floor(su),Floor(sv),3);
      n$4 = FBM(u$4,v$3,8,6,11,0.5);
      fine = FBM(u$4,v$3,64,3,5,0.5);
      Worley(u$4,v$3,90,9);
      pit = (W0 < 0.12)?(0.12 - W0) * 3:0;
      stain = Smooth(0.45,0.8,FBM(u$4,v$3,3,5,21,0.5));
      g$3 = 0.44 + (slab - 0.5) * 0.08 + (n$4 - 0.5) * 0.18 + (fine - 0.5) * 0.08 - stain * 0.18;
      o$1.R = g$3 * 0.99;
      o$1.G = g$3 * 0.97;
      o$1.B = g$3 * 0.93;
      o$1.H = seam * (0.7 + n$4 * 0.25 + fine * 0.08) - pit * 0.6 + (1 - seam) * 0;
      o$1.Rough = 0.82 + fine * 0.12 - stain * 0.1 + (1 - seam) * 0.06;
   },3.2,0.9,1);
   return Result
}
function GenRoof(size) {
   var Result = null;
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$5 = 0,
         fine$1 = 0,
         g$4 = 0;
      n$5 = FBM(u$4,v$3,5,6,251,0.5);
      fine$1 = FBM(u$4,v$3,80,3,253,0.5);
      g$4 = 0.25 + (n$5 - 0.5) * 0.12 + fine$1 * 0.05;
      o$1.R = g$4;
      o$1.G = g$4 * 0.98;
      o$1.B = g$4 * 0.95;
      o$1.H = fine$1 * 0.5 + n$5 * 0.3;
      o$1.Rough = 0.9;
   },2,0.6,1);
   return Result
}
function GenPolymer(size, base) {
   var Result = null;
   var bc$1 = [0,0,0];
   bc$1 = C(base);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var stipple = 0,
         n$6 = 0,
         k$1 = 0;
      stipple = FBM(u$4,v$3,96,2,241,0.5);
      n$6 = FBM(u$4,v$3,6,4,243,0.5);
      k$1 = 0.92 + (n$6 - 0.5) * 0.15;
      o$1.R = bc$1[0] * k$1;
      o$1.G = bc$1[1] * k$1;
      o$1.B = bc$1[2] * k$1;
      o$1.H = stipple * 0.5;
      o$1.Rough = 0.62 + stipple * 0.2;
   },1.5,0.2,1);
   return Result
}
function GenPlaster(size, base) {
   var Result = null;
   var bc$2 = [0,0,0],
      brick = [0,0,0];
   bc$2 = C(base);
   brick = C(8017478);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$7 = 0,
         fine$2 = 0,
         streak = 0,
         chipN = 0,
         chip = 0,
         chipEdge = 0,
         grime = 0,
         k$2 = 0,
         rv = 0,
         row = 0,
         cu = 0,
         fb = 0,
         br = 0;
      n$7 = FBM(u$4,v$3,8,6,111,0.5);
      fine$2 = FBM(u$4,v$3,80,3,113,0.5);
      streak = FBMA(u$4,v$3,30,3,4,117);
      chipN = FBM(u$4,v$3,6,6,119,0.5);
      chip = Smooth(0.765,0.775,chipN);
      chipEdge = Smooth(0.745,0.765,chipN) - chip;
      grime = Smooth(0.35,1,streak) * Smooth(0.2,0.9,v$3 * 0.4 + n$7 * 0.6);
      k$2 = 0.9 + (n$7 - 0.5) * 0.18 + (fine$2 - 0.5) * 0.08 - grime * 0.4;
      rv = v$3 * 24;
      row = Floor(rv);
      cu = u$4 * 6 + row % 2 * 0.5;
      fb = (MinF(FMod(cu,1),1 - FMod(cu,1)) > 0.04 && MinF(FMod(rv,1),1 - FMod(rv,1)) > 0.1)?1:0;
      br = Mix(0.55,1,fb);
      o$1.R = Mix(bc$2[0] * k$2,brick[0] * br * 0.85,chip);
      o$1.G = Mix(bc$2[1] * k$2,brick[1] * br * 0.85,chip);
      o$1.B = Mix(bc$2[2] * k$2,brick[2] * br * 0.85,chip);
      o$1.R *= 1 - chipEdge * 0.25;
      o$1.G *= 1 - chipEdge * 0.25;
      o$1.B *= 1 - chipEdge * 0.25;
      o$1.H = (1 - chip) * (0.6 + fine$2 * 0.12 + n$7 * 0.1) + chip * fb * 0.25;
      o$1.Rough = 0.9 + fine$2 * 0.08;
   },2.6,0.9,1);
   return Result
}
function GenGunMetal(size, base, roughBase) {
   var Result = null;
   var bc$3 = [0,0,0];
   bc$3 = C(base);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$8 = 0,
         fine$3 = 0,
         wear = 0,
         k$3 = 0;
      n$8 = FBM(u$4,v$3,8,5,231,0.5);
      fine$3 = FBM(u$4,v$3,64,3,233,0.5);
      wear = Smooth(0.7,0.85,FBM(u$4,v$3,5,5,237,0.5));
      k$3 = 0.9 + (n$8 - 0.5) * 0.2;
      o$1.R = Mix(bc$3[0] * k$3,0.55,wear * 0.5);
      o$1.G = Mix(bc$3[1] * k$3,0.55,wear * 0.5);
      o$1.B = Mix(bc$3[2] * k$3,0.55,wear * 0.5);
      o$1.H = fine$3 * 0.15 + n$8 * 0.1;
      o$1.Rough = roughBase + fine$3 * 0.15 - wear * 0.15;
      o$1.Metal = 0.5 + wear * 0.5;
   },0.8,0.2,1);
   return Result
}
function GenDirt(size) {
   var Result = null;
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$9 = 0,
         rock = 0,
         pebble = 0,
         dark = 0,
         g$5 = 0,
         rr = 0;
      n$9 = FBM(u$4,v$3,6,7,181,0.5);
      Worley(u$4,v$3,40,183);
      rock = Smooth(0.18,0.05,W0) * Smooth(0.45,0.7,FBM(u$4,v$3,4,4,185,0.5));
      Worley(u$4,v$3,140,187);
      pebble = Smooth(0.2,0.05,W0);
      dark = Smooth(0.4,0.8,FBM(u$4,v$3,3,5,189,0.5));
      g$5 = 0.42 + (n$9 - 0.5) * 0.3 - dark * 0.12;
      rr = 0.5 + W2 * 0.2;
      o$1.R = Mix(Mix(g$5 * 1,g$5 * 0.9 + 0.05,pebble * 0.5),rr,rock);
      o$1.G = Mix(Mix(g$5 * 0.86,g$5 * 0.84 + 0.05,pebble * 0.5),rr * 0.96,rock);
      o$1.B = Mix(Mix(g$5 * 0.68,g$5 * 0.75 + 0.05,pebble * 0.5),rr * 0.9,rock);
      o$1.H = n$9 * 0.5 + rock * 0.8 + pebble * 0.2;
      o$1.Rough = 0.95 - rock * 0.1;
   },3,0.8,1);
   return Result
}
function GenCorrugated(size, base) {
   var Result = null;
   var bc$4 = [0,0,0],
      rust = [0,0,0];
   bc$4 = C(base);
   rust = C(6177072);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var ridge = 0,
         n$10 = 0,
         fine$4 = 0,
         rustM = 0,
         scratch = 0,
         streak$1 = 0,
         pk = 0,
         rk = 0;
      ridge = Sin(u$4 * 3.14159265358979 * 2 * 12);
      n$10 = FBM(u$4,v$3,6,6,131,0.5);
      fine$4 = FBM(u$4,v$3,64,3,133,0.5);
      rustM = Smooth(0.7,0.85,FBM(u$4,v$3,5,6,137,0.5) + (1 - v$3) * 0.12 * FBMA(u$4,v$3,16,2,3,139));
      scratch = Smooth(0.985,1,FBMA(u$4,v$3,2,64,3,141));
      streak$1 = Smooth(0.5,0.9,FBMA(u$4,v$3,32,2,3,143));
      pk = 0.9 + (n$10 - 0.5) * 0.2 - streak$1 * 0.2;
      rk = 0.7 + fine$4 * 0.5;
      o$1.R = Mix(bc$4[0] * pk,rust[0] * rk,rustM) + scratch * 0.25;
      o$1.G = Mix(bc$4[1] * pk,rust[1] * rk,rustM) + scratch * 0.25;
      o$1.B = Mix(bc$4[2] * pk,rust[2] * rk,rustM) + scratch * 0.25;
      o$1.H = ridge * 0.5 + 0.5 + rustM * fine$4 * 0.25;
      o$1.Rough = Mix(0.55 + fine$4 * 0.15,0.92,rustM) - scratch * 0.2;
      o$1.Metal = Mix(0.25,0,rustM) + scratch * 0.6;
   },1.4,0.3,1);
   return Result
}
function GenConcreteWall(size, tint) {
   var Result = null;
   var t$2 = [0,0,0];
   t$2 = C(tint);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$11 = 0,
         fine$5 = 0,
         streak$2 = 0,
         pit$1 = 0,
         pv$1 = 0,
         fpv = 0,
         line = 0,
         hu = 0,
         hv = 0,
         hole = 0,
         dirt$1 = 0,
         g$6 = 0;
      n$11 = FBM(u$4,v$3,6,6,41,0.5);
      fine$5 = FBM(u$4,v$3,48,3,43,0.5);
      streak$2 = FBMA(u$4,v$3,24,2,4,47);
      Worley(u$4,v$3,60,51);
      pit$1 = (W0 < 0.1)?(0.1 - W0) * 4:0;
      pv$1 = v$3 * 4;
      fpv = pv$1 - Floor(pv$1);
      line = Smooth(0,0.01,MinF(fpv,1 - fpv));
      hu = FMod(u$4 * 4,1);
      hv = FMod(v$3 * 4 + 0.5,1);
      hole = (Math.hypot(hu - 0.5,hv - 0.5) < 0.025)?1:0;
      dirt$1 = Smooth(0.35,0.9,streak$2) * (0.4 + 0.6 * Smooth(0.3,0.7,n$11));
      g$6 = 0.85 + (n$11 - 0.5) * 0.3 + (fine$5 - 0.5) * 0.08 - dirt$1 * 0.35 - hole * 0.5;
      o$1.R = t$2[0] * g$6;
      o$1.G = t$2[1] * g$6;
      o$1.B = t$2[2] * g$6;
      o$1.H = n$11 * 0.3 + fine$5 * 0.1 - pit$1 * 0.5 - (1 - line) * 0.3 - hole * 0.6;
      o$1.Rough = 0.86 + fine$5 * 0.1 - dirt$1 * 0.08;
   },2.4,0.8,1);
   return Result
}
function GenCloth(size, base) {
   var Result = null;
   var bc$5 = [0,0,0];
   bc$5 = C(base);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var f = 0,
         wu = 0,
         wv = 0,
         weave = 0,
         n$12 = 0,
         dirt$2 = 0,
         k$4 = 0;
      f = 160;
      wu = Sin(u$4 * 3.14159265358979 * 2 * f);
      wv = Sin(v$3 * 3.14159265358979 * 2 * f);
      weave = (Sin(u$4 * 3.14159265358979 * 2 * f) > 0 == Sin(v$3 * 3.14159265358979 * 2 * f) > 0)?wu:wv;
      n$12 = FBM(u$4,v$3,6,6,171,0.5);
      dirt$2 = Smooth(0.4,0.9,FBM(u$4,v$3,3,5,173,0.5));
      k$4 = 0.85 + weave * 0.08 + (n$12 - 0.5) * 0.25 - dirt$2 * 0.35;
      o$1.R = bc$5[0] * k$4;
      o$1.G = bc$5[1] * k$4;
      o$1.B = bc$5[2] * k$4;
      o$1.H = weave * 0.15 + n$12 * 0.6;
      o$1.Rough = 0.95;
   },2.5,0.5,1);
   return Result
}
function GenCarPaint(size, base) {
   var Result = null;
   var bc$6 = [0,0,0];
   bc$6 = C(base);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$13 = 0,
         dust = 0,
         rust$1 = 0,
         scratch$1 = 0,
         k$5 = 0;
      n$13 = FBM(u$4,v$3,4,5,191,0.5);
      dust = Smooth(0.35,0.8,FBM(u$4,v$3,5,6,193,0.5));
      rust$1 = Smooth(0.7,0.78,FBM(u$4,v$3,6,6,197,0.5));
      scratch$1 = Smooth(0.975,1,FBMA(u$4,v$3,64,3,3,199)) + Smooth(0.98,1,FBMA(u$4,v$3,3,64,3,201));
      k$5 = 0.9 + (n$13 - 0.5) * 0.1;
      o$1.R = Mix(Mix(bc$6[0] * k$5,0.45,dust * 0.6),0.38,rust$1) + scratch$1 * 0.2;
      o$1.G = Mix(Mix(bc$6[1] * k$5,0.4,dust * 0.6),0.2,rust$1) + scratch$1 * 0.2;
      o$1.B = Mix(Mix(bc$6[2] * k$5,0.33,dust * 0.6),0.1,rust$1) + scratch$1 * 0.2;
      o$1.H = rust$1 * FBM(u$4,v$3,40,3,203,0.5) * 0.8 - scratch$1 * 0.2;
      o$1.Rough = Mix(Mix(0.32,0.85,dust),0.95,rust$1);
      o$1.Metal = Mix(0.4,0,MaxF(dust,rust$1)) + scratch$1 * 0.5;
   },2,0.4,1);
   return Result
}
function GenCamo(size) {
   var Result = null;
   var c0 = [0,0,0],
      c1 = [0,0,0],
      c2 = [0,0,0],
      c3 = [0,0,0];
   c0 = C(7170894);
   c1 = C(4934197);
   c2 = C(9076060);
   c3 = C(3092004);
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var a$85 = 0,
         b$1 = 0,
         c$7 = 0,
         k$6 = [0,0,0],
         f$1 = 0,
         weave$1 = 0,
         n$14 = 0,
         s$3 = 0;
      a$85 = FBM(u$4,v$3,4,5,211,0.5);
      b$1 = FBM(u$4,v$3,6,5,213,0.5);
      c$7 = FBM(u$4,v$3,8,4,217,0.5);
      k$6 = c0.slice(0);
      if (a$85 > 0.55) {
         k$6 = c1.slice(0);
      }
      if (b$1 > 0.6) {
         k$6 = c2.slice(0);
      }
      if (c$7 > 0.62) {
         k$6 = c3.slice(0);
      }
      f$1 = 160;
      weave$1 = Sin(u$4 * 3.14159265358979 * 2 * f$1) * Sin(v$3 * 3.14159265358979 * 2 * f$1);
      n$14 = FBM(u$4,v$3,32,3,219,0.5);
      s$3 = 0.9 + weave$1 * 0.05 + (n$14 - 0.5) * 0.15;
      o$1.R = k$6[0] * s$3;
      o$1.G = k$6[1] * s$3;
      o$1.B = k$6[2] * s$3;
      o$1.H = weave$1 * 0.2 + FBM(u$4,v$3,5,5,221,0.5) * 0.8;
      o$1.Rough = 0.95;
   },2,0.4,1);
   return Result
}
function GenBrick(size, base) {
   var Result = null;
   var bc$7 = [0,0,0],
      rows = 0,
      cols$1 = 0;
   bc$7 = C(base);
   rows = 16;
   cols$1 = 4;
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var rv$1 = 0,
         row$1 = 0,
         off = 0,
         cu$1 = 0,
         col = 0,
         fu$1 = 0,
         fv$2 = 0,
         mortarW = 0,
         mortarH = 0,
         eu = 0,
         ev$1 = 0,
         inBrick = 0,
         id$2 = 0,
         id2 = 0,
         n$15 = 0,
         fine$6 = 0,
         soot = 0,
         chip$1 = 0,
         bright = 0,
         r$2 = 0,
         g$7 = 0,
         b$2 = 0,
         m$1 = 0,
         k$7 = 0;
      rv$1 = v$3 * rows;
      row$1 = Floor(rv$1);
      off = row$1 % 2 * 0.5;
      cu$1 = u$4 * cols$1 + off;
      col = Floor(cu$1);
      fu$1 = cu$1 - col;
      fv$2 = rv$1 - row$1;
      mortarW = 0.035;
      mortarH = 0.12;
      eu = MinF(fu$1,1 - fu$1);
      ev$1 = MinF(fv$2,1 - fv$2);
      inBrick = Smooth(mortarW * 0.5,mortarW,eu) * Smooth(mortarH * 0.5,mortarH,ev$1);
      id$2 = Hash2((col % cols$1 + cols$1) % cols$1,row$1,91);
      id2 = Hash2((col % cols$1 + cols$1) % cols$1,row$1,97);
      n$15 = FBM(u$4,v$3,16,5,93,0.5);
      fine$6 = FBM(u$4,v$3,96,2,95,0.5);
      soot = Smooth(0.4,0.85,FBMA(u$4,v$3,6,2,5,99));
      chip$1 = Smooth(0.72,0.78,FBM(u$4,v$3,24,4,101,0.5)) * inBrick;
      bright = 0.75 + id$2 * 0.45 - ((id2 > 0.88)?0.35:0);
      r$2 = bc$7[0] * bright;
      g$7 = bc$7[1] * bright * (0.92 + id2 * 0.16);
      b$2 = bc$7[2] * bright;
      m$1 = 0.62 + (n$15 - 0.5) * 0.2;
      r$2 = Mix(m$1,r$2,inBrick);
      g$7 = Mix(m$1 * 0.97,g$7,inBrick);
      b$2 = Mix(m$1 * 0.9,b$2,inBrick);
      k$7 = (1 - soot * 0.55) * (0.9 + fine$6 * 0.2) * (1 - chip$1 * 0.25);
      o$1.R = r$2 * k$7;
      o$1.G = g$7 * k$7;
      o$1.B = b$2 * k$7;
      o$1.H = inBrick * (0.55 + n$15 * 0.25 + fine$6 * 0.1) - chip$1 * 0.3;
      o$1.Rough = Mix(0.95,0.8 + fine$6 * 0.1,inBrick);
   },3,0.8,1);
   return Result
}
function GenAsphalt(size) {
   var Result = null;
   Result = Build$1(size,function (u$4, v$3, o$1) {
      var n$16 = 0,
         grain$1 = 0,
         stone = 0,
         shade = 0,
         crackN = 0,
         crack = 0,
         crackMask = 0,
         cr = 0,
         patch = 0,
         pN = 0,
         puddle = 0,
         wet = 0,
         g$8 = 0;
      n$16 = FBM(u$4,v$3,4,6,61,0.5);
      Worley(u$4,v$3,180,63);
      grain$1 = W1 - W0;
      stone = Smooth(0.02,0.12,grain$1);
      shade = W2;
      crackN = FBM(u$4,v$3,5,6,67,0.5);
      crack = 1 - Smooth(0,0.012,Abs$_Float_(crackN - 0.5));
      crackMask = Smooth(0.45,0.65,FBM(u$4,v$3,3,3,69,0.5));
      cr = crack * crackMask;
      patch = Smooth(0.62,0.64,FBM(u$4,v$3,2,3,71,0.5));
      pN = FBM(u$4,v$3,2,5,73,0.5);
      puddle = Smooth(0.7,0.73,pN);
      wet = Smooth(0.6,0.7,pN);
      g$8 = 0.16 + (n$16 - 0.5) * 0.06 + stone * (0.05 + shade * 0.12) - patch * 0.04;
      g$8 *= 1 - cr * 0.7;
      g$8 *= 1 - wet * 0.3;
      o$1.R = g$8 * 1;
      o$1.G = g$8 * 0.99;
      o$1.B = g$8 * 0.97;
      o$1.H = stone * 0.25 + n$16 * 0.2 - cr * 0.8 + patch * 0.05 - puddle * stone * 0.25;
      o$1.Rough = Mix(Mix(0.8 + (1 - stone) * 0.12,0.45,wet),0.05,puddle) + cr * 0.1;
   },2.2,0.7,1);
   return Result
}
function FBM(u$4, v$3, freq, oct, seed$1, gain$1) {
   var Result = 0;
   var sum = 0,
      amp = 0,
      norm = 0,
      f$2 = 0;
   sum = 0;
   amp = 0.5;
   norm = 0;
   f$2 = freq;
   for(let i$2=0,$temp35=oct;i$2<$temp35;i$2++) {
      sum += VNoise(u$4 * f$2,v$3 * f$2,f$2,seed$1 + i$2 * 17) * amp;
      norm += amp;
      amp *= gain$1;
      f$2 *= 2;
   }
   Result = sum / norm;
   return Result
}
function Worley(u$4, v$3, n$22, seed$1) {
   var x$4 = 0,
      y$4 = 0,
      xi = 0,
      yi = 0,
      f1 = 0,
      f2 = 0,
      id$3 = 0,
      cx$1 = 0,
      cy$1 = 0,
      wx = 0,
      wy = 0,
      px = 0,
      py = 0,
      dx = 0,
      dy = 0,
      d$9 = 0;
   x$4 = u$4 * n$22;
   y$4 = v$3 * n$22;
   xi = Floor(x$4);
   yi = Floor(y$4);
   f1 = 9;
   f2 = 9;
   id$3 = 0;
   for(let j=-1;j<=1;j++) {
      for(let i$2=-1;i$2<=1;i$2++) {
         cx$1 = xi + i$2;
         cy$1 = yi + j;
         wx = (cx$1 % n$22 + n$22) % n$22;
         wy = (cy$1 % n$22 + n$22) % n$22;
         px = cx$1 + Hash2(wx,wy,seed$1);
         py = cy$1 + Hash2(wx,wy,seed$1 + 7);
         dx = px - x$4;
         dy = py - y$4;
         d$9 = Sqrt(dx*dx + dy*dy);
         if (d$9 < f1) {
            f2 = f1;
            f1 = d$9;
            id$3 = Hash2(wx,wy,seed$1 + 13);
         } else if (d$9 < f2) {
            f2 = d$9;
         }
      }
   }
   W0 = f1;
   W1 = f2;
   W2 = id$3;
}
function Weather(g$11, w$2, h$4, amt, seed$1) {
   var img$4 = null,
      d$4 = null,
      u$4 = 0,
      v$3 = 0,
      n$22 = 0,
      streak$3 = 0,
      dirt$3 = 0,
      rust$2 = 0,
      p$3 = 0;
   img$4 = g$11.getImageData(0,0,w$2,h$4);
   d$4 = img$4.data;
   for(let y$5=0,$temp36=h$4;y$5<$temp36;y$5++) {
      for(let x$5=0,$temp37=w$2;x$5<$temp37;x$5++) {
         u$4 = x$5 / w$2;
         v$3 = y$5 / h$4;
         n$22 = FBM(u$4,v$3 * h$4 / w$2,6,5,seed$1,0.5);
         streak$3 = FBMA(u$4,v$3,32,2,3,seed$1 + 3);
         dirt$3 = Smooth(0.45,0.85,n$22 * 0.7 + streak$3 * 0.5 * v$3) * amt;
         rust$2 = Smooth(0.72,0.8,FBM(u$4,v$3,8,4,seed$1 + 9,0.5)) * amt;
         p$3 = (y$5 * w$2 + x$5)*4;
         d$4[p$3]=(Mix(d$4[p$3],70,dirt$3 * 0.6) * (1 - rust$2 * 0.4) + rust$2 * 60);
         d$4[(p$3 + 1)]=(Mix(d$4[(p$3 + 1)],60,dirt$3 * 0.6) * (1 - rust$2 * 0.5) + rust$2 * 25);
         d$4[(p$3 + 2)]=(Mix(d$4[(p$3 + 2)],50,dirt$3 * 0.6) * (1 - rust$2 * 0.6));
      }
   }
   g$11.putImageData(img$4,0,0);
}
function VNoise2(x$5, y$5, px, py, seed$1) {
   var Result = 0;
   var xi$1 = 0,
      yi$1 = 0,
      xf = 0,
      yf = 0,
      x0 = 0,
      y0 = 0,
      x1 = 0,
      y1 = 0,
      u$1 = 0,
      v$1 = 0,
      a$88 = 0,
      b$3 = 0,
      c$8 = 0,
      d$5 = 0;
   xi$1 = Floor(x$5);
   yi$1 = Floor(y$5);
   xf = x$5 - xi$1;
   yf = y$5 - yi$1;
   x0 = (xi$1 % px + px) % px;
   y0 = (yi$1 % py + py) % py;
   x1 = (x0 + 1) % px;
   y1 = (y0 + 1) % py;
   u$1 = xf*xf * (3 - 2 * xf);
   v$1 = yf*yf * (3 - 2 * yf);
   a$88 = Hash2(x0,y0,seed$1);
   b$3 = Hash2(x1,y0,seed$1);
   c$8 = Hash2(x0,y1,seed$1);
   d$5 = Hash2(x1,y1,seed$1);
   Result = a$88 + (b$3 - a$88) * u$1 + (c$8 - a$88) * v$1 + (a$88 - b$3 - c$8 + d$5) * u$1 * v$1;
   return Result
}
function VNoise(x$5, y$5, period, seed$1) {
   var Result = 0;
   var xi$2 = 0,
      yi$2 = 0,
      xf$1 = 0,
      yf$1 = 0,
      x0$1 = 0,
      y0$1 = 0,
      x1$1 = 0,
      y1$1 = 0,
      u$2 = 0,
      v$2 = 0,
      a$89 = 0,
      b$4 = 0,
      c$9 = 0,
      d$6 = 0;
   xi$2 = Floor(x$5);
   yi$2 = Floor(y$5);
   xf$1 = x$5 - xi$2;
   yf$1 = y$5 - yi$2;
   x0$1 = (xi$2 % period + period) % period;
   y0$1 = (yi$2 % period + period) % period;
   x1$1 = (x0$1 + 1) % period;
   y1$1 = (y0$1 + 1) % period;
   u$2 = xf$1*xf$1 * (3 - 2 * xf$1);
   v$2 = yf$1*yf$1 * (3 - 2 * yf$1);
   a$89 = Hash2(x0$1,y0$1,seed$1);
   b$4 = Hash2(x1$1,y0$1,seed$1);
   c$9 = Hash2(x0$1,y1$1,seed$1);
   d$6 = Hash2(x1$1,y1$1,seed$1);
   Result = a$89 + (b$4 - a$89) * u$2 + (c$9 - a$89) * v$2 + (a$89 - b$4 - c$9 + d$6) * u$2 * v$2;
   return Result
}
/// TShop = record
function Copy$TShop(s,d) {
   d.Ar=s.Ar;
   d.Bg=s.Bg;
   d.En=s.En;
   d.Fg=s.Fg;
   return d;
}
function Clone$TShop($) {
   return {
      Ar:$.Ar,
      Bg:$.Bg,
      En:$.En,
      Fg:$.Fg
   }
}
function SrgbTex(c$12) {
   var Result = null;
   Result = new THREE.CanvasTexture(c$12);
   Result.colorSpace = "srgb";
   return Result
}
function MakeTex(c$12, srgb, rep) {
   var Result = null;
   var t$3 = null;
   t$3 = new THREE.CanvasTexture(c$12);
   t$3.wrapS = 1000;
   t$3.wrapT = 1000;
   t$3.anisotropy = MaxAniso;
   t$3.colorSpace = (srgb)?"srgb":"";
   t$3.repeat.set(rep,rep);
   t$3.generateMipmaps = true;
   t$3.minFilter = 1008;
   Result = t$3;
   return Result
}
function Hash2(x$5, y$5, s$6) {
   var Result = 0;
   var h$1 = 0;
   h$1 = Math.imul(x$5,374761393) + Math.imul(y$5,668265263) + Math.imul(s$6,1442695041);
   h$1 = Math.imul(h$1^(h$1>>>13),1274126177);
   h$1 = h$1^(h$1>>>16);
   if (h$1 < 0) {
      h$1+=4294967296;
   }
   Result = h$1 / 4294967295;
   return Result
}
function FBMA(u$4, v$3, fx, fy, oct, seed$1) {
   var Result = 0;
   var sum$1 = 0,
      amp$1 = 0,
      norm$1 = 0,
      px = 0,
      py = 0;
   sum$1 = 0;
   amp$1 = 0.5;
   norm$1 = 0;
   for(let i$2=0,$temp38=oct;i$2<$temp38;i$2++) {
      px = fx<<i$2;
      py = fy<<i$2;
      sum$1 += VNoise2(u$4 * px,v$3 * py,px,py,seed$1 + i$2 * 31) * amp$1;
      norm$1 += amp$1;
      amp$1 *= 0.5;
   }
   Result = sum$1 / norm$1;
   return Result
}
function Canvas$1(w$2, h$4, draw) {
   var Result = null;
   Result = NewCanvas(w$2,h$4);
   draw(Result.getContext("2d"),w$2,h$4);
   return Result
}
function C(hex) {
   var Result = [0,0,0];
   Result[0] = ((hex>>>16)&255) / 255;
   Result[1] = ((hex>>>8)&255) / 255;
   Result[2] = (hex&255) / 255;
   return Result
}
function Build$1(size, fn, normal$2, cavity, rep) {
   var Result = null;
   var N = 0,
      col$1 = null,
      hgt = null,
      rgh = null,
      met = null,
      o = null,
      v$3 = 0,
      u$4 = 0,
      i$2 = 0,
      cA = null,
      cN = null,
      cR = null,
      ctxA = null,
      ctxN = null,
      ctxR = null,
      imgA = null,
      imgN = null,
      imgR = null,
      dA = null,
      dN = null,
      dR = null,
      s$4 = 0,
      ym = 0,
      yp = 0,
      yc = 0,
      xm = 0,
      xp = 0,
      i$3 = 0,
      dhdu = 0,
      dhdv = 0,
      nx = 0,
      ny = 0,
      nz = 0,
      l = 0,
      p$3 = 0,
      avg = 0,
      cav = 0;
   N = size*size;
   col$1 = new Float32Array(N * 3);
   hgt = new Float32Array(N);
   rgh = new Float32Array(N);
   met = new Float32Array(N);
   o = TObject.Create($New(TTexel));
   o.Rough = 0.8;
   for(let y$5=0,$temp39=size;y$5<$temp39;y$5++) {
      v$3 = y$5 / size;
      for(let x$5=0,$temp40=size;x$5<$temp40;x$5++) {
         u$4 = x$5 / size;
         o.Metal = 0;
         fn(u$4,v$3,o);
         i$2 = y$5 * size + x$5;
         col$1[(i$2 * 3)]=o.R;
         col$1[(i$2 * 3 + 1)]=o.G;
         col$1[(i$2 * 3 + 2)]=o.B;
         hgt[i$2]=o.H;
         rgh[i$2]=o.Rough;
         met[i$2]=o.Metal;
      }
   }
   cA = NewCanvas(size,size);
   cN = NewCanvas(size,size);
   cR = NewCanvas(size,size);
   ctxA = cA.getContext("2d");
   ctxN = cN.getContext("2d");
   ctxR = cR.getContext("2d");
   imgA = ctxA.createImageData(size,size);
   imgN = ctxN.createImageData(size,size);
   imgR = ctxR.createImageData(size,size);
   dA = imgA.data;
   dN = imgN.data;
   dR = imgR.data;
   s$4 = normal$2 * size / 256;
   for(let y$6=0,$temp41=size;y$6<$temp41;y$6++) {
      ym = (y$6 - 1 + size) % size * size;
      yp = (y$6 + 1) % size * size;
      yc = y$6 * size;
      for(let x$6=0,$temp42=size;x$6<$temp42;x$6++) {
         xm = (x$6 - 1 + size) % size;
         xp = (x$6 + 1) % size;
         i$3 = yc + x$6;
         dhdu = (hgt[(yc + xp)] - hgt[(yc + xm)]) * 0.5 * s$4;
         dhdv = (hgt[(ym + x$6)] - hgt[(yp + x$6)]) * 0.5 * s$4;
         nx = -dhdu;
         ny = -dhdv;
         nz = 1;
         l = 1 / Sqrt(nx*nx + ny*ny + 1);
         nx *= l;
         ny *= l;
         nz *= l;
         p$3 = i$3*4;
         dN[p$3]=((nx * 0.5 + 0.5) * 255);
         dN[(p$3 + 1)]=((ny * 0.5 + 0.5) * 255);
         dN[(p$3 + 2)]=((nz * 0.5 + 0.5) * 255);
         dN[(p$3 + 3)]=255;
         avg = (hgt[(yc + xp)] + hgt[(yc + xm)] + hgt[(ym + x$6)] + hgt[(yp + x$6)]) * 0.25;
         cav = ClampF(1 + (hgt[i$3] - avg) * cavity * size * 0.25,0.55,1.1);
         dA[p$3]=(Clamp01(col$1[(i$3 * 3)] * cav) * 255);
         dA[(p$3 + 1)]=(Clamp01(col$1[(i$3 * 3 + 1)] * cav) * 255);
         dA[(p$3 + 2)]=(Clamp01(col$1[(i$3 * 3 + 2)] * cav) * 255);
         dA[(p$3 + 3)]=255;
         dR[p$3]=(met[i$3] * 255);
         dR[(p$3 + 1)]=(Clamp01(rgh[i$3]) * 255);
         dR[(p$3 + 2)]=(met[i$3] * 255);
         dR[(p$3 + 3)]=255;
      }
   }
   ctxA.putImageData(imgA,0,0);
   ctxN.putImageData(imgN,0,0);
   ctxR.putImageData(imgR,0,0);
   Result = TObject.Create($New(TPBRMaps));
   Result.Map = MakeTex(cA,true,rep);
   Result.NormalMap = MakeTex(cN,false,rep);
   Result.RoughnessMap = MakeTex(cR,false,rep);
   Result.MetalnessMap = MakeTex(cR,false,rep);
   return Result
}
function AnisoTex(c$12) {
   var Result = null;
   Result = SrgbTex(c$12);
   Result.anisotropy = MaxAniso;
   return Result
}
var SHOPS = [{Ar:"\u0635\u064A\u062F\u0644\u064A\u0629",Bg:"#1f6f4a",En:"PHARMACY",Fg:"#f2efe6"},{Ar:"\u0645\u0642\u0647\u0649 \u0627\u0644\u0646\u0648\u0631",Bg:"#7a2e1f",En:"CAFE AL-NOOR",Fg:"#f5d9a8"},{Ar:"\u0633\u0648\u0642",Bg:"#1d3f73",En:"MARKET",Fg:"#ffffff"},{Ar:"\u0641\u0646\u062F\u0642 \u0627\u0644\u0635\u0641\u0627",Bg:"#2b2b2b",En:"HOTEL SAFA",Fg:"#e8c46a"},{Ar:"\u0645\u062E\u0628\u0632",Bg:"#b8741a",En:"BAKERY",Fg:"#fff4dc"},{Ar:"\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A",Bg:"#0f5c7a",En:"ELECTRONICS",Fg:"#f0f0f0"},{Ar:"\u062E\u064A\u0627\u0637",Bg:"#5a3a6e",En:"TAILOR",Fg:"#f5ecd7"},{Ar:"\u0642\u0637\u0639 \u063A\u064A\u0627\u0631",Bg:"#a31f1f",En:"AUTO PARTS",Fg:"#ffffff"},{Ar:"\u0645\u0648\u0628\u0627\u064A\u0644",Bg:"#e0b400",En:"MOBILE",Fg:"#1a1a1a"},{Ar:"\u0645\u0637\u0639\u0645",Bg:"#6e1d1d",En:"RESTAURANT",Fg:"#ffe9b0"},{Ar:"\u062D\u0644\u0627\u0642",Bg:"#e8e2d0",En:"BARBER",Fg:"#233a6b"},{Ar:"\u0635\u0631\u0627\u0641\u0629",Bg:"#1b4d2e",En:"EXCHANGE",Fg:"#f7e27a"}];
/// TShaderDef = class (TObject)
var TShaderDef = {
   $ClassName:"TShaderDef",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.FragmentShader = $.VertexShader = "";
      $.Uniforms = undefined;
   }
   ,Destroy:TObject.Destroy
};
function SkyShader() {
   var Result = null;
   Result = TObject.Create($New(TShaderDef));
   Result.Uniforms = {
      "zenith" : Uni(Col(0.13,0.24,0.46))
      ,"time" : Uni(0)
      ,"sunDisk" : Uni(1)
      ,"sunDir" : Uni(V3(0,0.2,-1))
      ,"horizon" : Uni(Col(0.78,0.66,0.52))
      ,"cloudAmt" : Uni(1)
   };
   Result.VertexShader = "varying vec3 vDir;\r\nvoid main() {\r\n  vDir = position;\r\n  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\r\n  gl_Position = p.xyww;\r\n}\r\n";
   Result.FragmentShader = "uniform vec3 sunDir, horizon, zenith;\r\nuniform float time, cloudAmt, sunDisk;\r\nvarying vec3 vDir;\r\nfloat hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\r\nfloat vnoise(vec2 p) {\r\n  vec2 i = floor(p), f = fract(p);\r\n  vec2 u = f * f * (3.0 - 2.0 * f);\r\n  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);\r\n}\r\nfloat fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }\r\nvoid main() {\r\n  vec3 d = normalize(vDir);\r\n  float h = d.y;\r\n  float sd = max(dot(d, sunDir), 0.0);\r\n  float t = pow(clamp(h, 0.0, 1.0), 0.5);\r\n  vec3 col = mix(horizon, zenith, t);\r\n  \/\/ warm band around the horizon, strongest toward the sun\r\n  col += vec3(0.55, 0.28, 0.1) * pow(1.0 - abs(h), 12.0) * (0.35 + 0.65 * pow(sd, 2.0));\r\n  if (h < 0.0) col = mix(horizon, horizon * vec3(0.72, 0.66, 0.6), clamp(-h * 5.0, 0.0, 1.0));\r\n  \/\/ mie scattering glow\r\n  col += vec3(1.0, 0.6, 0.28) * (pow(sd, 6.0) * 0.55 + pow(sd, 48.0) * 1.6 + pow(sd, 700.0) * 6.0);\r\n  \/\/ clouds\r\n  if (h > 0.0 && cloudAmt > 0.0) {\r\n    vec2 uv = d.xz \/ (h + 0.12) * 0.9 + vec2(time * 0.006, time * 0.002);\r\n    float c = fbm(uv * 1.1);\r\n    float c2 = fbm(uv * 3.1 + 5.0);\r\n    float cov = smoothstep(0.48, 0.78, c * 0.8 + c2 * 0.3) * smoothstep(0.0, 0.12, h) * cloudAmt;\r\n    vec3 lit = vec3(1.9, 1.15, 0.62) * (0.4 + 1.3 * pow(sd, 3.0));\r\n    vec3 shade = vec3(0.42, 0.38, 0.4);\r\n    vec3 cc = mix(shade, lit, smoothstep(0.35, 0.9, c2 + pow(sd, 2.0) * 0.4));\r\n    col = mix(col, cc, cov * 0.88);\r\n    \/\/ silver lining\r\n    col += vec3(2.0, 1.2, 0.6) * pow(sd, 20.0) * cov * (1.0 - cov) * 3.0;\r\n  }\r\n  col += vec3(60.0, 42.0, 26.0) * smoothstep(0.99955, 0.9998, sd) * sunDisk;\r\n  gl_FragColor = vec4(col, 1.0);\r\n}\r\n";
   return Result
}
function ShaderPassDef(s$6) {
   var Result = undefined;
   Result = {
      "vertexShader" : s$6.VertexShader
      ,"uniforms" : s$6.Uniforms
      ,"fragmentShader" : s$6.FragmentShader
   };
   return Result
}
function InstallFog(sunDir$1, sunColor, heightFalloff) {
   THREE.ShaderChunk.fog_pars_vertex = "#ifdef USE_FOG\r\n  varying vec3 vFogWorld;\r\n#endif";
   THREE.ShaderChunk.fog_vertex = "#ifdef USE_FOG\r\n  vFogWorld = (inverse(viewMatrix) * vec4(mvPosition.xyz, 1.0)).xyz;\r\n#endif";
   THREE.ShaderChunk.fog_pars_fragment = "#ifdef USE_FOG\r\n  uniform vec3 fogColor;\r\n  varying vec3 vFogWorld;\r\n  #ifdef FOG_EXP2\r\n    uniform float fogDensity;\r\n  #else\r\n    uniform float fogNear;\r\n    uniform float fogFar;\r\n  #endif\r\n#endif";
   THREE.ShaderChunk.fog_fragment = "#ifdef USE_FOG\r\n  vec3 fogRay = vFogWorld - cameraPosition;\r\n  float fogDist = length(fogRay);\r\n  vec3 fogDir = fogRay \/ max(fogDist, 1e-4);\r\n  const float HF = "+ToFixed(heightFalloff,4)+";\r\n  float fy0 = max(cameraPosition.y, 0.0), fdy = fogRay.y;\r\n  float heightInt = abs(fdy) > 0.05 ? (exp(-HF * fy0) - exp(-HF * (fy0 + fdy))) \/ (HF * fdy) : exp(-HF * fy0);\r\n  #ifdef FOG_EXP2\r\n    float fogFactor = 1.0 - exp(-fogDensity * fogDist * (0.3 + 1.7 * clamp(heightInt, 0.0, 1.5)));\r\n  #else\r\n    float fogFactor = smoothstep(fogNear, fogFar, fogDist);\r\n  #endif\r\n  float sunAmt = pow(max(dot(fogDir, "+GlslVec3(sunDir$1.x,sunDir$1.y,sunDir$1.z)+"), 0.0), 6.0) * smoothstep(10.0, 90.0, fogDist);\r\n  vec3 fogCol = mix(fogColor, "+GlslVec3(sunColor.r,sunColor.g,sunColor.b)+", sunAmt * 0.8);\r\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogCol, fogFactor);\r\n#endif";
}
function GradeShader() {
   var Result = null;
   Result = TObject.Create($New(TShaderDef));
   Result.Uniforms = {
      "time" : Uni(0)
      ,"tDiffuse" : Uni(null)
      ,"damage" : Uni(0)
      ,"adsVignette" : Uni(0)
      ,"aberration" : Uni(0.0012)
   };
   Result.VertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
   Result.FragmentShader = "uniform sampler2D tDiffuse;\r\nuniform float time, damage, aberration, adsVignette;\r\nvarying vec2 vUv;\r\nfloat hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\r\nvoid main() {\r\n  vec2 c = vUv - 0.5;\r\n  float r2 = dot(c, c);\r\n  vec2 off = c * r2 * aberration * 10.0;\r\n  vec3 col;\r\n  col.r = texture2D(tDiffuse, vUv - off).r;\r\n  col.g = texture2D(tDiffuse, vUv).g;\r\n  col.b = texture2D(tDiffuse, vUv + off).b;\r\n  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));\r\n  \/\/ split toning: cool shadows, warm highlights\r\n  col += vec3(-0.012, 0.004, 0.026) * (1.0 - smoothstep(0.0, 0.5, l));\r\n  col += vec3(0.022, 0.008, -0.018) * smoothstep(0.45, 1.0, l);\r\n  \/\/ gentle S-curve contrast\r\n  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);\r\n  \/\/ saturation (drops when hurt)\r\n  l = dot(col, vec3(0.2126, 0.7152, 0.0722));\r\n  col = mix(vec3(l), col, 1.06 - damage * 0.5);\r\n  \/\/ vignette (stronger when aiming)\r\n  float v = smoothstep(0.95, 0.25, length(c * vec2(1.0, 0.85)) * (1.0 + adsVignette * 0.35));\r\n  col *= mix(0.62, 1.0, v);\r\n  \/\/ damage: red edges\r\n  float edge = smoothstep(0.32, 0.85, length(c));\r\n  col = mix(col, col * vec3(1.1, 0.3, 0.25), damage * edge * 0.7);\r\n  \/\/ film grain\r\n  float g = hash(vUv * 1733.0 + fract(time * 7.13) * 91.0) - 0.5;\r\n  col += g * 0.03 * (1.0 - l * 0.5);\r\n  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);\r\n}\r\n";
   return Result
}
function GodRayShader() {
   var Result = null;
   Result = TObject.Create($New(TShaderDef));
   Result.Uniforms = {
      "tDiffuse" : Uni(null)
      ,"sunPos" : Uni(new THREE.Vector2(0.5,0.5))
      ,"intensity" : Uni(0.5)
      ,"aspect" : Uni(1.7)
   };
   Result.VertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
   Result.FragmentShader = "uniform sampler2D tDiffuse;\r\nuniform vec2 sunPos;\r\nuniform float intensity, aspect;\r\nvarying vec2 vUv;\r\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\r\nvoid main() {\r\n  vec4 base = texture2D(tDiffuse, vUv);\r\n  if (intensity <= 0.001) { gl_FragColor = base; return; }\r\n  const int N = 40;\r\n  vec2 delta = (vUv - sunPos) * (0.92 \/ float(N));\r\n  vec2 uv = vUv - delta * hash(vUv * 1000.0);\r\n  float decay = 1.0;\r\n  vec3 acc = vec3(0.0);\r\n  for (int i = 0; i < N; i++) {\r\n    uv -= delta;\r\n    vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;\r\n    float l = dot(s, vec3(0.2126, 0.7152, 0.0722));\r\n    acc += s * smoothstep(1.8, 4.0, l) * decay;\r\n    decay *= 0.955;\r\n  }\r\n  vec2 dd = (vUv - sunPos) * vec2(aspect, 1.0);\r\n  float fall = exp(-dot(dd, dd) * 1.6);\r\n  gl_FragColor = vec4(base.rgb + acc \/ float(N) * intensity * vec3(1.0, 0.78, 0.5) * (0.35 + fall), base.a);\r\n}\r\n";
   return Result
}
function GlslVec3(x$5, y$5, z$3) {
   var Result = "";
   Result = "vec3("+ToFixed(x$5,4)+", "+ToFixed(y$5,4)+", "+ToFixed(z$3,4)+")";
   return Result
}
/// TWorld = class (TObject)
var TWorld = {
   $ClassName:"TWorld",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Colliders = [];
      $.CoverPoints = [];
      $.FCarBody = $.FCarGlass = $.FCarRoof = $.Progress$1 = $.Rand = $.Scene$1 = null;
      $.FGroupKeys = [];
      $.FGroups = {};
      $.Fires = [];
      $.Mats = {};
      $.SmokeStacks = [];
   }
   /// procedure TWorld.Add(geo: JBufferGeometry; matKey: String; matrix: JMatrix4; o: TBoxOpts = nil)
   ,Add:function(Self, geo, matKey, matrix$1, o$1) {
      var g$11 = null,
         a$132 = 0,
         k$8 = "",
         mat$1 = null,
         s$6 = 0,
         p$3 = null,
         n$22 = null,
         uv$2 = null,
         nx = 0,
         ny = 0,
         nz = 0,
         x$5 = 0,
         y$5 = 0,
         z$3 = 0,
         c$12 = null,
         key = "",
         grp = null,
         a$133 = [];
      g$11 = (geo.index)?geo.toNonIndexed():geo.clone();
      a$133 = Object.keys(g$11.attributes);
      var $temp43;
      for(a$132=0,$temp43=a$133.length;a$132<$temp43;a$132++) {
         k$8 = a$133[a$132];
         if (k$8 != "position" && k$8 != "normal" && k$8 != "uv") {
            g$11.deleteAttribute(k$8);
         }
      }
      if (!g$11.attributes.uv) {
         g$11.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(g$11.attributes.position.count*2),2));
      }
      g$11.clearGroups();
      if (matrix$1) {
         g$11.applyMatrix4(matrix$1);
      }
      mat$1 = (Self.Mats[matKey]||null);
      if (!o$1 || o$1.WorldUV) {
         s$6 = 1;
         if (!!o$1 && o$1.UVScale != 0) {
            s$6 = o$1.UVScale;
         } else if (mat$1.userData.scale) {
            s$6 = Number(mat$1.userData.scale);
         }
         p$3 = g$11.attributes.position;
         n$22 = g$11.attributes.normal;
         uv$2 = g$11.attributes.uv;
         for(let i$2=0,$temp44=p$3.count;i$2<$temp44;i$2++) {
            nx = Abs$_Float_(n$22.getX(i$2));
            ny = Abs$_Float_(n$22.getY(i$2));
            nz = Abs$_Float_(n$22.getZ(i$2));
            x$5 = p$3.getX(i$2);
            y$5 = p$3.getY(i$2);
            z$3 = p$3.getZ(i$2);
            if (ny >= nx && ny >= nz) {
               uv$2.setXY(i$2,x$5 / s$6,z$3 / s$6);
            } else if (nx >= nz) {
               uv$2.setXY(i$2,((n$22.getX(i$2) > 0)?-z$3:z$3) / s$6,y$5 / s$6);
            } else {
               uv$2.setXY(i$2,((n$22.getZ(i$2) > 0)?x$5:-x$5) / s$6,y$5 / s$6);
            }
         }
      }
      g$11.computeBoundingBox();
      c$12 = g$11.boundingBox.getCenter(_p);
      key = matKey+"|"+IntStr(Floor(c$12.x / 40))+","+IntStr(Floor(c$12.z / 40));
      grp = (Self.FGroups[key]||null);
      if (!grp) {
         grp = TObject.Create($New(TGeoGroup));
         grp.Mat = matKey;
         Self.FGroups[key]=grp;
         Self.FGroupKeys.push(key);
      }
      grp.Geos.push(g$11);
   }
   /// procedure TWorld.Barrel(x: Float; z: Float; mat: String; burning: Boolean)
   ,Barrel:function(Self, x$5, z$3, mat$1, burning) {
      var g$11 = null,
         rib = null,
         a$134 = 0,
         y$5 = 0,
         a$135 = [0,0];
      g$11 = new THREE.CylinderGeometry(0.3,0.3,0.88,20,1,burning);
      TWorld.Mesh$1(Self,g$11,mat$1,x$5,0.59,z$3,0,0,0,1,1,1,null,null);
      rib = new THREE.TorusGeometry(0.305,0.018,6,24);
      a$135 = [0.3, 0.58];
      for(a$134=0;a$134<=1;a$134++) {
         y$5 = a$135[a$134];
         TWorld.Mesh$1(Self,rib,mat$1,x$5,0.15 + y$5,z$3,1.5707963267949,0,0,1,1,1,null,null);
      }
      TWorld.Collider(Self,x$5 - 0.3,0.15,z$3 - 0.3,x$5 + 0.3,1.03,z$3 + 0.3,"metal");
   }
   /// procedure TWorld.Bounds()
   ,Bounds:function(Self) {
      var a$136 = 0,
         s$6 = 0,
         a$137 = 0,
         e$1 = 0,
         a$138 = [0,0];
      TWorld.Collider(Self,-12,0,99,12,30,102,"concrete");
      TWorld.Collider(Self,-12,0,-102,12,30,-99,"concrete");
      TWorld.Collider(Self,69,0,-12,72,30,12,"concrete");
      TWorld.Collider(Self,-72,0,-12,-69,30,12,"concrete");
      var a$139 = [0,0];
      a$138 = [-1, 1];
      for(a$136=0;a$136<=1;a$136++) {
         s$6 = a$138[a$136];
         a$139 = [-1, 1];
         for(a$137=0;a$137<=1;a$137++) {
            e$1 = a$139[a$137];
            TWorld.Collider(Self,(e$1 > 0)?10.5:-32,0,(s$6 > 0)?94.5:-101,(e$1 > 0)?32:-10.5,30,(s$6 > 0)?101:-94.5,"concrete");
            TWorld.Collider(Self,(e$1 > 0)?64.5:-71,0,(s$6 > 0)?10.5:-32,(e$1 > 0)?71:-64.5,30,(s$6 > 0)?32:-10.5,"concrete");
         }
      }
   }
   /// procedure TWorld.Box(x: Float; y: Float; z: Float; w: Float; h: Float; d: Float; mat: String; o: TBoxOpts = nil)
   ,Box:function(Self, x$5, y$5, z$3, w$2, h$4, d$9, mat$1, o$1) {
      var g$11 = null;
      if (!o$1) {
         o$1 = Opt();
      }
      g$11 = new THREE.BoxGeometry(w$2,h$4,d$9);
      _e.set(o$1.RX,o$1.RY,o$1.RZ);
      _m.compose(_p.set(x$5,y$5,z$3),_q.setFromEuler(_e),_s.set(1,1,1));
      if (o$1.Parent) {
         _m.premultiply(o$1.Parent);
      }
      TWorld.Add(Self,g$11,mat$1,_m,o$1);
      if (o$1.Collide$1) {
         TWorld.ColliderFromBox(Self,w$2,h$4,d$9,_m.clone(),o$1.Surf$2);
      }
   }
   /// procedure TWorld.Build(done: TProc)
   ,Build:function(Self, done) {
      var steps = [];
      for(let i$2=0;i$2<=21;i$2++) {
         steps.push(function () {
            TWorld.MakeMaterial(Self,i$2);
            Self.Progress$1(0.05 + i$2 / 22 * 0.6,"GENERATING MATERIALS · "+UpperCase(MAT_KEYS[i$2]));
         });
      }
      steps.push(function () {
         TWorld.FinishMaterials(Self);
         Self.Progress$1(0.7,"CONSTRUCTING DISTRICT");
      });
      steps.push(function () {
         TWorld.Ground(Self);
         TWorld.Buildings(Self);
         Self.Progress$1(0.8,"PLACING COVER");
      });
      steps.push(function () {
         TWorld.Props(Self);
         TWorld.Skyline(Self);
         TWorld.Bounds(Self);
         Self.Progress$1(0.88,"MERGING GEOMETRY");
      });
      steps.push(function () {
         TWorld.Finalize(Self);
         done();
      });
      RunSteps(steps,0);
   }
   /// procedure TWorld.Building(fx: Float; fz: Float; rot: Float; W: Float; D: Float; floors: Integer; st: TStyle; corner: Integer = 0)
   ,Building:function(Self, fx, fz, rot, W, D$3, floors, st, corner) {
      var T$5 = null,
         gf = 0,
         fh = 0,
         H$1 = 0,
         wall = "",
         trim = "",
         cw = 0,
         cx$1 = 0,
         a$140 = 0,
         e$1 = 0,
         g$11 = null,
         a$141 = 0,
         a$119 = 0,
         a$142 = 0,
         b$7 = 0,
         T2 = null,
         px = 0,
         b$8 = null,
         a$143 = [0,0];
      T$5 = YRot(fx,0,fz,rot);
      gf = 4.2;
      fh = st.FloorH;
      H$1 = gf + (floors - 1) * fh;
      wall = st.Wall;
      trim = st.Trim$2;
      cw = W - ((corner)?2:0);
      cx$1 = (corner)?-corner:0;
      TWorld.Box(Self,cx$1,H$1 / 2,(-(D$3 + 2)) / 2,cw,H$1,D$3 - 2,wall,Par(T$5));
      a$143 = [-1, 1];
      for(a$140=0;a$140<=1;a$140++) {
         e$1 = a$143[a$140];
         if (e$1 != corner) {
            TWorld.Box(Self,e$1 * (W / 2 - 0.15),H$1 / 2,-1,0.3,H$1,2,wall,Par(T$5));
         }
      }
      TWorld.Box(Self,0,H$1 + 0.05,(-D$3) / 2,W,0.1,D$3,"roof",Par(T$5));
      TWorld.Box(Self,0,H$1 + 0.45,-0.2,W + 0.1,0.9,0.4,trim,Par(T$5));
      TWorld.Box(Self,(-W) / 2 + 0.15,H$1 + 0.45,(-D$3) / 2,0.3,0.9,D$3,trim,Par(T$5));
      TWorld.Box(Self,W / 2 - 0.15,H$1 + 0.45,(-D$3) / 2,0.3,0.9,D$3,trim,Par(T$5));
      TWorld.Box(Self,0,H$1 + 0.45,(-D$3) + 0.15,W,0.9,0.3,trim,Par(T$5));
      TWorld.Box(Self,0,H$1 - 0.2,0.12,W + 0.3,0.35,0.5,trim,Par(T$5));
      if (Self.Rand() < 0.7) {
         TWorld.Box(Self,(Self.Rand() - 0.5) * W * 0.5,H$1 + 0.7,(-D$3) * 0.5,2.2,1.3,1.6,"metal",Par(T$5));
      }
      if (Self.Rand() < 0.5) {
         var a$144 = [0,0];
         g$11 = new THREE.CylinderGeometry(1.1,1.1,2.2,16);
         TWorld.Mesh$1(Self,g$11,"wood",(Self.Rand() - 0.5) * W * 0.4,H$1 + 2.6,(-D$3) * 0.6,0,0,0,1,1,1,T$5,null);
         var a$145 = [0,0];
         a$144 = [-0.7, 0.7];
         for(a$141=0;a$141<=1;a$141++) {
            a$119 = a$144[a$141];
            a$145 = [-0.7, 0.7];
            for(a$142=0;a$142<=1;a$142++) {
               b$7 = a$145[a$142];
               TWorld.Box(Self,a$119 + 0,H$1 + 0.8,(-D$3) * 0.6 + b$7,0.12,1.5,0.12,"metal",Par(T$5));
            }
         }
      }
      TWorld.Facade(Self,T$5,W,floors,st,gf,fh,H$1);
      if (corner) {
         T2 = T$5.clone().multiply(new THREE.Matrix4().makeTranslation(corner * W / 2,0,(-D$3) / 2)).multiply(new THREE.Matrix4().makeRotationY(corner * 3.14159265358979 / 2));
         TWorld.Facade(Self,T2,D$3,floors,st,gf,fh,H$1);
      }
      px = W / 2 - 0.25;
      TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.06,0.06,H$1,8),"metal",px,H$1 / 2,0.12,0,0,0,1,1,1,T$5,null);
      b$8 = new THREE.Box3(V3((-W) / 2,0,-D$3),V3(W / 2,H$1 + 1,0)).applyMatrix4(T$5);
      Self.Colliders.push(TCollider.Create$6($New(TCollider),b$8.min,b$8.max,"concrete"));
   }
   /// procedure TWorld.Buildings()
   ,Buildings:function(Self) {
      var styles = [],
         pick = null,
         a$146 = 0,
         sx = 0,
         a$147 = 0,
         sz = 0,
         z$3 = 0,
         w$2 = 0,
         floors = 0,
         zc = 0,
         rot = 0,
         x$5 = 0,
         w$3 = 0,
         floors$1 = 0,
         rot$1 = 0,
         a$148 = 0,
         s$6 = 0,
         a$149 = [0,0],
         a$150 = [0,0];
      styles.push(TStyle.Create$4($New(TStyle),"brick","concrete",3.3));
      styles.push(TStyle.Create$4($New(TStyle),"plaster","concrete",3.4));
      styles.push(TStyle.Create$4($New(TStyle),"brick2","concreteDark",3.2));
      styles.push(TStyle.Create$4($New(TStyle),"plaster2","concrete",3.5));
      styles.push(TStyle.Create$4($New(TStyle),"plaster3","concreteDark",3.3));
      styles.push(TStyle.Create$4($New(TStyle),"concrete","concreteDark",3.6));
      pick = function () {
         var Result = null;
         Result = styles[Floor(Self.Rand() * styles.length)];
         return Result
      };
      var a$151 = [0,0];
      a$150 = [-1, 1];
      for(a$146=0;a$146<=1;a$146++) {
         sx = a$150[a$146];
         a$151 = [-1, 1];
         for(a$147=0;a$147<=1;a$147++) {
            sz = a$151[a$147];
            z$3 = 11;
            while (z$3 < 96) {
               w$2 = Min$_Integer_Integer_(10 + Floor(Self.Rand() * 4) * 3,96 - z$3);
               if (w$2 < 6) {
                  break;
               }
               floors = 2 + Floor(Self.Rand() * 5);
               zc = sz * (z$3 + w$2 / 2);
               rot = (sx > 0)?-1.5707963267949:1.5707963267949;
               TWorld.Building(Self,sx * 11,zc,rot,w$2,16,floors,pick(),(z$3 == 11)?(-sx) * sz:0);
               z$3+=w$2;
            }
            x$5 = 27;
            while (x$5 < 66) {
               w$3 = Min$_Integer_Integer_(9 + Floor(Self.Rand() * 4) * 3,66 - x$5);
               if (w$3 < 6) {
                  break;
               }
               floors$1 = 2 + Floor(Self.Rand() * 4);
               rot$1 = (sz > 0)?3.14159265358979:0;
               TWorld.Building(Self,sx * (x$5 + w$3 / 2),sz * 11,rot$1,w$3,14,floors$1,pick(),0);
               x$5+=w$3;
            }
         }
      }
      a$149 = [-1, 1];
      for(a$148=0;a$148<=1;a$148++) {
         s$6 = a$149[a$148];
         TWorld.Building(Self,0,s$6 * 100,(s$6 > 0)?3.14159265358979:0,22,14,6,styles[(s$6 > 0)?0:5],0);
         TWorld.Building(Self,s$6 * 70,0,(s$6 > 0)?-1.5707963267949:1.5707963267949,22,14,4,styles[(s$6 > 0)?1:2],0);
      }
   }
   /// procedure TWorld.Car(x: Float; z: Float; ry: Float; paint: String; burnt: Boolean)
   ,Car:function(Self, x$5, z$3, ry, paint, burnt) {
      var T$5 = null,
         b$7 = null,
         gh = null,
         rf = null,
         a$152 = 0,
         sx = 0,
         tire = null,
         rim = null,
         a$153 = 0,
         sx$1 = 0,
         a$154 = 0,
         sz = 0,
         tilt = 0,
         a$155 = 0,
         s$6 = 0,
         a$156 = [0,0],
         a$157 = [0,0],
         a$158 = [0,0];
      function Ext(shape, dep, bev) {
         var Result = null;
         Result = new THREE.ExtrudeGeometry(shape,{
            "depth" : dep
            ,"curveSegments" : 14
            ,"bevelThickness" : bev
            ,"bevelSize" : bev
            ,"bevelSegments" : 3
            ,"bevelEnabled" : true
         });
         Result.translate(0,0,(-dep) / 2);
         Result.rotateY(-1.5707963267949);
         Result.computeVertexNormals();
         return Result
      }
      T$5 = YRot(x$5,0,z$3,ry);
      if (!Self.FCarBody) {
         b$7 = new THREE.Shape();
         b$7.moveTo(-2.2,0.38);
         b$7.lineTo(-2.24,0.8);
         b$7.quadraticCurveTo(-2.2,0.93,-1.95,0.95);
         b$7.lineTo(-1.25,0.97);
         b$7.lineTo(1,0.96);
         b$7.quadraticCurveTo(1.7,0.93,2.1,0.84);
         b$7.quadraticCurveTo(2.26,0.8,2.25,0.62);
         b$7.lineTo(2.22,0.4);
         b$7.lineTo(1.82,0.36);
         b$7.absarc(1.4,0.36,0.42,0,3.14159265358979,false);
         b$7.lineTo(-0.98,0.36);
         b$7.absarc(-1.4,0.36,0.42,0,3.14159265358979,false);
         b$7.lineTo(-2.2,0.38);
         gh = new THREE.Shape();
         gh.moveTo(-1.28,0.95);
         gh.quadraticCurveTo(-0.95,1.36,-0.72,1.41);
         gh.lineTo(0.32,1.42);
         gh.quadraticCurveTo(0.55,1.38,1.05,0.95);
         gh.lineTo(-1.28,0.95);
         rf = new THREE.Shape();
         rf.moveTo(-0.74,1.4);
         rf.lineTo(0.34,1.41);
         rf.lineTo(0.3,1.45);
         rf.lineTo(-0.7,1.44);
         rf.lineTo(-0.74,1.4);
         Self.FCarBody = Ext(b$7,1.66,0.07);
         Self.FCarGlass = Ext(gh,1.42,0.05);
         Self.FCarRoof = Ext(rf,1.4,0.04);
      }
      TWorld.Mesh$1(Self,Self.FCarBody,paint,0,0,0,0,0,0,1,1,1,T$5,null);
      TWorld.Mesh$1(Self,Self.FCarGlass,(burnt)?"interior":"glass",0,0,0,0,0,0,1,1,1,T$5,TBoxOpts.NoUV(Opt()));
      TWorld.Mesh$1(Self,Self.FCarRoof,paint,0,0.005,0,0,0,0,1,1,1,T$5,null);
      a$158 = [-1, 1];
      for(a$152=0;a$152<=1;a$152++) {
         sx = a$158[a$152];
         TWorld.Box(Self,sx * 0.9,0.7,-0.2,0.012,0.5,0.012,"rubber",TBoxOpts.NoUV(Par(T$5)));
         TWorld.Box(Self,sx * 0.93,1,0.92,0.1,0.07,0.13,paint,Par(T$5));
      }
      if (!(burnt)) {
         TWorld.Box(Self,0,0.62,2.28,1.2,0.18,0.04,"frame",Par(T$5));
      }
      tire = new THREE.CylinderGeometry(0.35,0.35,0.26,20);
      rim = new THREE.CylinderGeometry(0.2,0.2,0.27,12);
      var a$159 = [0,0];
      a$157 = [-1, 1];
      for(a$153=0;a$153<=1;a$153++) {
         sx$1 = a$157[a$153];
         a$159 = [-1.4, 1.4];
         for(a$154=0;a$154<=1;a$154++) {
            sz = a$159[a$154];
            tilt = (burnt)?0.15:0;
            TWorld.Mesh$1(Self,tire,"rubber",sx$1 * 0.76,(burnt)?0.28:0.35,sz,0,0,1.5707963267949 + tilt * sx$1,1,1,1,T$5,TBoxOpts.NoUV(Opt()));
            TWorld.Mesh$1(Self,rim,"metal",sx$1 * 0.775,(burnt)?0.28:0.35,sz,0,0,1.5707963267949,1,1,1,T$5,null);
         }
      }
      TWorld.Box(Self,0,0.45,2.27,1.86,0.22,0.12,"rubber",TBoxOpts.NoUV(Par(T$5)));
      TWorld.Box(Self,0,0.45,-2.27,1.86,0.22,0.12,"rubber",TBoxOpts.NoUV(Par(T$5)));
      if (!(burnt)) {
         a$156 = [-1, 1];
         for(a$155=0;a$155<=1;a$155++) {
            s$6 = a$156[a$155];
            TWorld.Box(Self,s$6 * 0.65,0.78,2.24,0.34,0.14,0.05,"light",TBoxOpts.NoUV(Par(T$5)));
            TWorld.Box(Self,s$6 * 0.68,0.8,-2.24,0.3,0.14,0.05,"redLight",TBoxOpts.NoUV(Par(T$5)));
         }
      }
      TWorld.ColliderFromBox(Self,1.9,1.62,4.6,Translated(T$5,0,0.81,0),"metal");
      TWorld.CoverFor(Self,x$5,z$3,ry);
   }
   /// function TWorld.Collide(pos: JVector3; vel: JVector3; radius: Float; height: Float; stepUp: Float = 0,45) : Boolean
   ,Collide:function(Self, pos$4, vel, radius$1, height$3, stepUp) {
      var Result = false;
      var grounded = false,
         c$12 = null,
         top$2 = 0,
         px1 = 0,
         px2 = 0,
         pz1 = 0,
         pz2 = 0,
         py2 = 0,
         mx = 0,
         mz = 0,
         a$160 = 0,
         c$13 = null,
         a$161 = [];
      grounded = false;
      for(let iter=0;iter<=2;iter++) {
         for(let i$2=0,$temp45=Self.Colliders.length;i$2<$temp45;i$2++) {
            c$12 = Self.Colliders[i$2];
            if (pos$4.x + radius$1 <= c$12.Min$2.x || pos$4.x - radius$1 >= c$12.Max$2.x) {
               continue;
            }
            if (pos$4.z + radius$1 <= c$12.Min$2.z || pos$4.z - radius$1 >= c$12.Max$2.z) {
               continue;
            }
            if (pos$4.y + height$3 <= c$12.Min$2.y || pos$4.y >= c$12.Max$2.y) {
               continue;
            }
            top$2 = c$12.Max$2.y - pos$4.y;
            if (top$2 <= stepUp && vel.y <= 0.01) {
               pos$4.y = c$12.Max$2.y;
               if (vel.y < 0) {
                  vel.y = 0;
               }
               grounded = true;
               continue;
            }
            px1 = c$12.Max$2.x - (pos$4.x - radius$1);
            px2 = pos$4.x + radius$1 - c$12.Min$2.x;
            pz1 = c$12.Max$2.z - (pos$4.z - radius$1);
            pz2 = pos$4.z + radius$1 - c$12.Min$2.z;
            py2 = pos$4.y + height$3 - c$12.Min$2.y;
            mx = MinF(px1,px2);
            mz = MinF(pz1,pz2);
            if (py2 < mx && py2 < mz && py2 < 0.5 && vel.y > 0) {
               pos$4.y = c$12.Min$2.y - height$3;
               vel.y = 0;
               continue;
            }
            if (mx < mz) {
               pos$4.x += (px1 < px2)?px1:-px2;
               vel.x = 0;
            } else {
               pos$4.z += (pz1 < pz2)?pz1:-pz2;
               vel.z = 0;
            }
         }
      }
      if (pos$4.y <= 0) {
         pos$4.y = 0;
         if (vel.y < 0) {
            vel.y = 0;
         }
         grounded = true;
      }
      if (!(grounded)) {
         a$161 = Self.Colliders;
         var $temp46;
         for(a$160=0,$temp46=a$161.length;a$160<$temp46;a$160++) {
            c$13 = a$161[a$160];
            if (pos$4.x + radius$1 * 0.7 <= c$13.Min$2.x || pos$4.x - radius$1 * 0.7 >= c$13.Max$2.x) {
               continue;
            }
            if (pos$4.z + radius$1 * 0.7 <= c$13.Min$2.z || pos$4.z - radius$1 * 0.7 >= c$13.Max$2.z) {
               continue;
            }
            if (Abs$_Float_(pos$4.y - c$13.Max$2.y) < 0.02 && vel.y <= 0) {
               grounded = true;
               break;
            }
         }
      }
      Result = grounded;
      return Result
   }
   /// procedure TWorld.Collider(minX: Float; minY: Float; minZ: Float; maxX: Float; maxY: Float; maxZ: Float; surf: String = 'concrete')
   ,Collider:function(Self, minX, minY, minZ, maxX, maxY, maxZ, surf) {
      Self.Colliders.push(TCollider.Create$6($New(TCollider),V3(minX,minY,minZ),V3(maxX,maxY,maxZ),surf));
   }
   /// procedure TWorld.ColliderFromBox(w: Float; h: Float; d: Float; matrix: JMatrix4; surf: String)
   ,ColliderFromBox:function(Self, w$2, h$4, d$9, matrix$1, surf) {
      var b$7 = null;
      b$7 = new THREE.Box3(V3((-w$2) / 2,(-h$4) / 2,(-d$9) / 2),V3(w$2 / 2,h$4 / 2,d$9 / 2));
      b$7.applyMatrix4(matrix$1);
      Self.Colliders.push(TCollider.Create$6($New(TCollider),b$7.min,b$7.max,surf));
   }
   /// procedure TWorld.Container(x: Float; z: Float; ry: Float; mat: String; y: Float = 0)
   ,Container:function(Self, x$5, z$3, ry, mat$1, y$5) {
      var T$5 = null,
         L = 0,
         Wd = 0,
         H$1 = 0,
         a$162 = 0,
         sx = 0,
         a$163 = 0,
         sy = 0,
         a$164 = 0,
         sx$1 = 0,
         a$165 = 0,
         sz = 0,
         a$166 = [0,0],
         a$167 = [0,0];
      T$5 = YRot(x$5,y$5,z$3,ry);
      L = 6.06;
      Wd = 2.44;
      H$1 = 2.59;
      TWorld.Box(Self,0,H$1 / 2,0,Wd - 0.1,H$1 - 0.1,L - 0.1,mat$1,TBoxOpts.UV(Par(T$5),3.6));
      var a$168 = [0,0];
      a$167 = [-1, 1];
      for(a$162=0;a$162<=1;a$162++) {
         sx = a$167[a$162];
         a$168 = [0, 1];
         for(a$163=0;a$163<=1;a$163++) {
            sy = a$168[a$163];
            TWorld.Box(Self,sx * (Wd / 2 - 0.05),0.08 + sy * (H$1 - 0.16),0,0.12,0.16,L,"metal",Par(T$5));
         }
      }
      var a$169 = [0,0];
      a$166 = [-1, 1];
      for(a$164=0;a$164<=1;a$164++) {
         sx$1 = a$166[a$164];
         a$169 = [-1, 1];
         for(a$165=0;a$165<=1;a$165++) {
            sz = a$169[a$165];
            TWorld.Box(Self,sx$1 * (Wd / 2 - 0.08),H$1 / 2,sz * (L / 2 - 0.08),0.16,H$1,0.16,"metal",Par(T$5));
         }
      }
      for(let i$2=0;i$2<=3;i$2++) {
         TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.025,0.025,H$1 - 0.3,6),"metal",-0.9 + i$2 * 0.6,H$1 / 2,L / 2 + 0.02,0,0,0,1,1,1,T$5,null);
      }
      TWorld.ColliderFromBox(Self,Wd,H$1,L,Translated(T$5,0,H$1 / 2,0),"metal");
      if (y$5 == 0) {
         TWorld.CoverFor(Self,x$5,z$3,ry);
      }
   }
   /// procedure TWorld.CoverFor(x: Float; z: Float; ry: Float)
   ,CoverFor:function(Self, x$5, z$3, ry) {
      var dx = 0,
         dz = 0;
      dx = Cos(ry);
      dz = -Sin(ry);
      Self.CoverPoints.push(V3(x$5 + dx * 1.6,0,z$3 + dz * 1.6));
      Self.CoverPoints.push(V3(x$5 - dx * 1.6,0,z$3 - dz * 1.6));
   }
   /// procedure TWorld.Crate(x: Float; z: Float; stack: Integer)
   ,Crate:function(Self, x$5, z$3, stack) {
      var s$6 = 0,
         y$5 = 0,
         ry = 0,
         T$5 = null,
         e$1 = 0,
         a$170 = 0,
         a$119 = 0,
         a$171 = 0,
         b$7 = 0,
         a$172 = [0,0];
      s$6 = 1.1;
      y$5 = (stack)?s$6:0;
      ry = Self.Rand() * 0.5;
      T$5 = YRot(x$5,0.15 + y$5,z$3,ry);
      TWorld.Box(Self,0,s$6 / 2,0,s$6 - 0.04,s$6 - 0.04,s$6 - 0.04,"wood",Par(T$5));
      e$1 = 0.09;
      var a$173 = [0,0];
      a$172 = [-1, 1];
      for(a$170=0;a$170<=1;a$170++) {
         a$119 = a$172[a$170];
         a$173 = [-1, 1];
         for(a$171=0;a$171<=1;a$171++) {
            b$7 = a$173[a$171];
            TWorld.Box(Self,a$119 * (s$6 / 2 - e$1 / 2),s$6 / 2,b$7 * (s$6 / 2 - e$1 / 2),e$1,s$6,e$1,"wood",TBoxOpts.UV(Par(T$5),0.9));
            TWorld.Box(Self,0,s$6 / 2 + a$119 * (s$6 / 2 - e$1 / 2),b$7 * (s$6 / 2 - e$1 / 2),s$6,e$1,e$1,"wood",TBoxOpts.UV(Par(T$5),0.9));
            TWorld.Box(Self,a$119 * (s$6 / 2 - e$1 / 2),s$6 / 2 + b$7 * (s$6 / 2 - e$1 / 2),0,e$1,e$1,s$6,"wood",TBoxOpts.UV(Par(T$5),0.9));
         }
      }
      TWorld.ColliderFromBox(Self,s$6,s$6,s$6,Translated(T$5,0,s$6 / 2,0),"wood");
   }
   /// constructor TWorld.Create(ascene: JScene; aprogress: TProgressProc)
   ,Create$3:function(Self, ascene, aprogress) {
      Self.Scene$1 = ascene;
      Self.Progress$1 = aprogress;
      Self.Rand = Rng(1337);
      return Self
   }
   /// procedure TWorld.Facade(T: JMatrix4; W: Float; floors: Integer; st: TStyle; gf: Float; fh: Float; H: Float)
   ,Facade:function(Self, T$5, W, floors, st, gf, fh, H$1) {
      var wt = 0,
         wall = "",
         trim = "",
         nShops = 0,
         shopW = 0,
         bx = 0,
         pw = 0,
         pc = 0,
         cx$1 = 0,
         openW = 0,
         openH = 0,
         a$174 = 0,
         e$1 = 0,
         kind = 0,
         down = 0,
         sh = 0,
         sw$1 = 0,
         sh$1 = 0,
         sy = 0,
         winW = 0,
         winH = 0,
         sill = 0,
         nWin = 0,
         bay = 0,
         blown = 0,
         y0$2 = 0,
         cx$2 = 0,
         pw$1 = 0,
         wy = 0,
         isBlown = false,
         broken = false,
         cx$3 = 0,
         rp = null;
      wt = 0.35;
      wall = st.Wall;
      trim = st.Trim$2;
      nShops = Max$_Integer_Integer_(1,Floor(W / 6 + 0.5));
      shopW = W / nShops;
      TWorld.Box(Self,0,0.25,(-wt) / 2,W,0.5,wt,trim,Par(T$5));
      for(let i$2=0,$temp47=nShops;i$2<=$temp47;i$2++) {
         bx = (-W) / 2 + shopW * i$2;
         pw = ((i$2==0) || i$2 == nShops)?0.6:1.2;
         pc = (!i$2)?bx + 0.3:(i$2 == nShops)?bx - 0.3:bx;
         TWorld.Box(Self,pc,gf / 2,(-wt) / 2 + 0.05,pw,gf,wt + 0.1,trim,Par(T$5));
         if (Self.Rand() < 0.35 && pw > 1) {
            TWorld.Mesh$1(Self,new THREE.PlaneGeometry(0.95,0.95),"poster" + IntStr(Floor(Self.Rand() * 4)),pc,1.5 + Self.Rand() * 0.4,0.103,0,0,(Self.Rand() - 0.5) * 0.1,1,1,1,T$5,TBoxOpts.NoUV(Opt()));
         }
      }
      for(let i$3=0,$temp48=nShops;i$3<$temp48;i$3++) {
         var a$175 = [0,0];
         cx$1 = (-W) / 2 + shopW * (i$3 + 0.5);
         openW = shopW - 1.2;
         openH = 3;
         TWorld.Box(Self,cx$1,(openH + 0.5 + gf) / 2,(-wt) / 2,shopW,gf - openH - 0.5,wt,wall,Par(T$5));
         TWorld.Box(Self,cx$1,0.5 + openH / 2,-1.8,openW,openH,0.1,(Self.Rand() < 0.25)?"interiorLit":"interior",TBoxOpts.NoUV(Par(T$5)));
         TWorld.Box(Self,cx$1,0.48,-1.05,openW,0.04,1.5,"concreteDark",Par(T$5));
         TWorld.Box(Self,cx$1,0.5 + openH + 0.02,-1.05,openW,0.04,1.5,"concreteDark",Par(T$5));
         a$175 = [-1, 1];
         for(a$174=0;a$174<=1;a$174++) {
            e$1 = a$175[a$174];
            TWorld.Box(Self,cx$1 + e$1 * (openW / 2 + 0.02),0.5 + openH / 2,-1.05,0.04,openH,1.5,"concreteDark",Par(T$5));
         }
         TWorld.Box(Self,cx$1 - openW * 0.2,1.5,-1.6,openW * 0.5,2,0.35,"wood",TBoxOpts.UV(Par(T$5),1));
         for(let k$8=0;k$8<=3;k$8++) {
            TWorld.Box(Self,cx$1 - openW * 0.2,0.85 + k$8 * 0.5,-1.42,openW * 0.48,0.04,0.05,"frame",Par(T$5));
         }
         if (Self.Rand() < 0.7) {
            TWorld.Box(Self,cx$1 + openW * 0.18,1,-0.95,openW * 0.4,1,0.5,(Self.Rand() < 0.5)?"wood":"metal",Par(T$5));
         }
         kind = Self.Rand();
         if (kind < 0.45) {
            down = 0.3 + Self.Rand() * 0.7;
            sh = openH * down;
            TWorld.Box(Self,cx$1,0.5 + openH - sh / 2,-0.12,openW,sh,0.06,"shutter",Par(T$5));
            if (Self.Rand() < 0.55 && sh > 1.4) {
               TWorld.Mesh$1(Self,new THREE.PlaneGeometry(MinF(openW * 0.8,3),MinF(openW * 0.4,1.5)),"graf" + IntStr(Floor(Self.Rand() * 6)),cx$1 + (Self.Rand() - 0.5) * 0.4,0.5 + openH - sh + MinF(sh * 0.5,1.1),-0.085,0,0,(Self.Rand() - 0.5) * 0.06,1,1,1,T$5,TBoxOpts.NoUV(Opt()));
            }
            TWorld.Box(Self,cx$1,0.5 + openH + 0.15,-0.05,openW + 0.2,0.35,0.3,"metal",Par(T$5));
         } else if (kind < 0.8) {
            TWorld.Box(Self,cx$1,0.5 + openH / 2,-0.2,openW,openH,0.04,(Self.Rand() < 0.5)?"glass":"glassDirty",TBoxOpts.NoUV(Par(T$5)));
            TWorld.Box(Self,cx$1,0.5 + openH * 0.72,-0.14,openW,0.08,0.1,"frame",Par(T$5));
            TWorld.Box(Self,cx$1,0.55,-0.14,openW,0.1,0.12,"frame",Par(T$5));
         }
         if (Self.Rand() < 0.75) {
            sw$1 = MinF(openW * 0.92,2.8);
            sh$1 = sw$1 / 4;
            sy = 0.5 + openH + 0.1 + sh$1 / 2;
            TWorld.Box(Self,cx$1,sy,0.06,sw$1 + 0.08,sh$1 + 0.08,0.1,"frame",Par(T$5));
            TWorld.Mesh$1(Self,new THREE.PlaneGeometry(sw$1,sh$1),"sign" + IntStr(Floor(Self.Rand() * 12)),cx$1,sy,0.112,0,0,0,1,1,1,T$5,TBoxOpts.NoUV(Opt()));
         }
         if (Self.Rand() < 0.35) {
            TWorld.Box(Self,cx$1,0.5 + openH + 0.02,0.55,openW,0.06,1.1,"shutter",TBoxOpts.Rot(Par(T$5),0.25,0,0));
         }
      }
      TWorld.Box(Self,0,gf - 0.1,0.08,W + 0.2,0.25,0.3,trim,Par(T$5));
      winW = 1.3;
      winH = 1.75;
      sill = 0.9;
      nWin = Max$_Integer_Integer_(1,Floor((W - 1) / 3));
      bay = W / nWin;
      blown = (Self.Rand() < 0.25)?Floor(Self.Rand() * nWin):-1;
      for(let f$3=1,$temp49=floors;f$3<$temp49;f$3++) {
         y0$2 = gf + (f$3 - 1) * fh;
         TWorld.Box(Self,0,y0$2 + sill / 2,(-wt) / 2,W,sill,wt,wall,Par(T$5));
         TWorld.Box(Self,0,y0$2 + sill + winH + (fh - sill - winH) / 2,(-wt) / 2,W,fh - sill - winH,wt,wall,Par(T$5));
         for(let i$4=0,$temp50=nWin;i$4<$temp50;i$4++) {
            cx$2 = (-W) / 2 + bay * (i$4 + 0.5);
            pw$1 = (bay - winW) / 2;
            TWorld.Box(Self,cx$2 - winW / 2 - pw$1 / 2,y0$2 + sill + winH / 2,(-wt) / 2,pw$1,winH,wt,wall,Par(T$5));
            TWorld.Box(Self,cx$2 + winW / 2 + pw$1 / 2,y0$2 + sill + winH / 2,(-wt) / 2,pw$1,winH,wt,wall,Par(T$5));
            wy = y0$2 + sill + winH / 2;
            isBlown = i$4 == blown && f$3 == floors - 1;
            TWorld.Box(Self,cx$2,wy,(-wt) - 1.4,winW,winH,0.05,(Self.Rand() < 0.12)?"interiorLit":"interior",TBoxOpts.NoUV(Par(T$5)));
            TWorld.Box(Self,cx$2,y0$2 + sill - 0.02,(-wt) - 0.7,winW,0.04,1.4,"concreteDark",Par(T$5));
            TWorld.Box(Self,cx$2,y0$2 + sill + winH + 0.02,(-wt) - 0.7,winW,0.04,1.4,"concreteDark",Par(T$5));
            TWorld.Box(Self,cx$2 - winW / 2 - 0.02,wy,(-wt) - 0.7,0.04,winH,1.4,"concreteDark",Par(T$5));
            TWorld.Box(Self,cx$2 + winW / 2 + 0.02,wy,(-wt) - 0.7,0.04,winH,1.4,"concreteDark",Par(T$5));
            TWorld.Box(Self,cx$2,y0$2 + sill - 0.06,0.04,winW + 0.3,0.12,0.2,trim,Par(T$5));
            TWorld.Box(Self,cx$2,y0$2 + sill + winH + 0.08,0.02,winW + 0.2,0.16,0.12,trim,Par(T$5));
            if (isBlown) {
               TWorld.Box(Self,cx$2,wy + 0.2,0.02,winW + 0.6,winH + 0.6,0.02,"burnt",Par(T$5));
               TWorld.Box(Self,cx$2,wy,(-wt) - 0.7,winW + 0.1,winH,1.4,"interior",TBoxOpts.NoUV(Par(T$5)));
            } else {
               broken = Self.Rand() < 0.3;
               TWorld.Box(Self,cx$2,wy,-0.22,winW,0.07,0.08,"frame",Par(T$5));
               TWorld.Box(Self,cx$2,y0$2 + sill + 0.035,-0.22,winW,0.07,0.1,"frame",Par(T$5));
               TWorld.Box(Self,cx$2,y0$2 + sill + winH - 0.035,-0.22,winW,0.07,0.1,"frame",Par(T$5));
               TWorld.Box(Self,cx$2 - winW / 2 + 0.035,wy,-0.22,0.07,winH,0.1,"frame",Par(T$5));
               TWorld.Box(Self,cx$2 + winW / 2 - 0.035,wy,-0.22,0.07,winH,0.1,"frame",Par(T$5));
               TWorld.Box(Self,cx$2,wy,-0.22,0.06,winH,0.08,"frame",Par(T$5));
               if (!(broken)) {
                  TWorld.Box(Self,cx$2,wy,-0.24,winW - 0.1,winH - 0.1,0.02,(Self.Rand() < 0.7)?"glass":"glassDirty",TBoxOpts.NoUV(Par(T$5)));
               }
               if (Self.Rand() < 0.15) {
                  TWorld.Box(Self,cx$2 - winW / 2 - 0.35,wy,0.03,0.62,winH,0.05,"wood",TBoxOpts.Rot(Par(T$5),0,0.1,0));
                  TWorld.Box(Self,cx$2 + winW / 2 + 0.35,wy,0.03,0.62,winH,0.05,"wood",TBoxOpts.Rot(Par(T$5),0,-0.3,0));
               }
            }
            if (Self.Rand() < 0.18) {
               TWorld.Box(Self,cx$2 + 0.2,y0$2 + 0.5,0.35,0.9,0.6,0.6,"carC",Par(T$5));
            }
            if (Self.Rand() < 0.12 && f$3 > 1) {
               TWorld.Box(Self,cx$2,y0$2 + 0.08,0.6,winW + 1,0.16,1.2,trim,Par(T$5));
               for(let k$9=-4;k$9<=4;k$9++) {
                  TWorld.Box(Self,cx$2 + k$9 * (winW + 0.9) / 8,y0$2 + 0.6,1.15,0.03,0.9,0.03,"metal",Par(T$5));
               }
               TWorld.Box(Self,cx$2,y0$2 + 1.05,1.15,winW + 1,0.05,0.05,"metal",Par(T$5));
            }
         }
         if (f$3 < floors - 1) {
            TWorld.Box(Self,0,y0$2 + fh,0.05,W + 0.1,0.14,0.2,trim,Par(T$5));
         }
      }
      if (blown >= 0) {
         cx$3 = (-W) / 2 + bay * (blown + 0.5);
         rp = V3(cx$3,0,2.5).applyMatrix4(T$5);
         TWorld.RubblePile(Self,rp.x,rp.z,2.4,60,0.9);
      }
   }
   /// procedure TWorld.Finalize()
   ,Finalize:function(Self) {
      var a$176 = 0,
         key = "",
         grp = null,
         merged = null,
         mat$1 = null,
         m$3 = null,
         noShadow = false,
         a$177 = 0,
         g$11 = null,
         a$178 = [];
      a$178 = Self.FGroupKeys;
      var $temp51;
      for(a$176=0,$temp51=a$178.length;a$176<$temp51;a$176++) {
         key = a$178[a$176];
         var a$179 = [];
         grp = (Self.FGroups[key]||null);
         merged = THREEX.mergeGeometries(grp.Geos,false);
         merged.computeBoundingSphere();
         mat$1 = (Self.Mats[grp.Mat]||null);
         m$3 = new THREE.Mesh(merged,mat$1);
         noShadow = grp.Mat == "paintWhite" || grp.Mat == "paintYellow" || grp.Mat == "skyline";
         m$3.castShadow = (!(noShadow)) && (!(mat$1.transparent));
         m$3.receiveShadow = grp.Mat != "skyline";
         m$3.matrixAutoUpdate = false;
         Self.Scene$1.add(m$3);
         a$179 = grp.Geos;
         var $temp52;
         for(a$177=0,$temp52=a$179.length;a$177<$temp52;a$177++) {
            g$11 = a$179[a$177];
            g$11.dispose();
         }
      }
      $Delete(Self.FGroups);
      Self.FGroupKeys.length=0;
   }
   /// procedure TWorld.FinishMaterials()
   ,FinishMaterials:function(Self) {
      var winTex = null,
         bark = null;
      function Put(key, m$3, scale$2) {
         m$3.userData.scale = scale$2;
         Self.Mats[key]=m$3;
      }
      Put("glass",new THREE.MeshStandardMaterial({
         "roughness" : 0.04
         ,"metalness" : 1
         ,"envMapIntensity" : 1.4
         ,"color" : 1711908
      }),1);
      Put("glassDirty",new THREE.MeshStandardMaterial({
         "roughness" : 0.35
         ,"metalness" : 0.8
         ,"color" : 3817020
      }),1);
      Put("frame",new THREE.MeshStandardMaterial({
         "roughness" : 0.6
         ,"metalness" : 0.3
         ,"color" : 3025961
      }),1);
      Self.Mats["trim"]=(Self.Mats["concrete"]||null);
      Put("rubber",new THREE.MeshStandardMaterial({
         "roughness" : 0.92
         ,"color" : 1381653
      }),1);
      Put("paintWhite",new THREE.MeshStandardMaterial({
         "transparent" : true
         ,"roughness" : 0.75
         ,"polygonOffsetFactor" : -2
         ,"polygonOffset" : true
         ,"opacity" : 0.85
         ,"color" : 14210248
      }),1);
      Put("paintYellow",new THREE.MeshStandardMaterial({
         "transparent" : true
         ,"roughness" : 0.75
         ,"polygonOffsetFactor" : -2
         ,"polygonOffset" : true
         ,"opacity" : 0.85
         ,"color" : 13214010
      }),1);
      winTex = SpriteTex("window");
      Put("interior",new THREE.MeshStandardMaterial({
         "roughness" : 1
         ,"map" : winTex
         ,"color" : 13155760
      }),1);
      Put("interiorLit",new THREE.MeshStandardMaterial({
         "roughness" : 1
         ,"map" : winTex
         ,"emissiveMap" : winTex
         ,"emissiveIntensity" : 0.9
         ,"emissive" : 16754784
         ,"color" : 2103312
      }),1);
      Put("light",new THREE.MeshStandardMaterial({
         "roughness" : 0.1
         ,"emissiveIntensity" : 0.15
         ,"emissive" : 16767392
         ,"color" : 14209216
      }),1);
      Put("redLight",new THREE.MeshStandardMaterial({
         "emissiveIntensity" : 1.2
         ,"emissive" : 16719888
         ,"color" : 4194304
      }),1);
      Put("wire",new THREE.MeshStandardMaterial({
         "roughness" : 0.7
         ,"color" : 1118481
      }),1);
      Put("skyline",new THREE.MeshStandardMaterial({
         "roughness" : 1
         ,"map" : SkylineTex()
         ,"color" : 11577496
      }),22);
      for(let i$2=0;i$2<=11;i$2++) {
         Put("sign" + IntStr(i$2),new THREE.MeshStandardMaterial({
            "roughness" : 0.65
            ,"metalness" : 0.15
            ,"map" : SignTex(i$2)
         }),1);
      }
      for(let i$3=0;i$3<=5;i$3++) {
         Put("graf" + IntStr(i$3),new THREE.MeshStandardMaterial({
            "transparent" : true
            ,"roughness" : 0.85
            ,"polygonOffsetFactor" : -3
            ,"polygonOffset" : true
            ,"map" : GraffitiTex(i$3)
            ,"depthWrite" : false
         }),1);
      }
      for(let i$4=0;i$4<=3;i$4++) {
         Put("poster" + IntStr(i$4),new THREE.MeshStandardMaterial({
            "roughness" : 0.9
            ,"polygonOffsetFactor" : -2
            ,"polygonOffset" : true
            ,"map" : PosterTex(i$4)
            ,"alphaTest" : 0.5
         }),1);
      }
      Put("leaves",new THREE.MeshStandardMaterial({
         "side" : 2
         ,"roughness" : 0.8
         ,"map" : LeafTex()
         ,"alphaTest" : 0.45
      }),1);
      Put("paper",new THREE.MeshStandardMaterial({
         "side" : 2
         ,"roughness" : 0.9
         ,"map" : PaperTex()
      }),1);
      Put("trashbag",new THREE.MeshStandardMaterial({
         "roughness" : 0.32
         ,"metalness" : 0.1
         ,"color" : 1316118
      }),1);
      bark = GenWood(256,4864556);
      Put("bark",new THREE.MeshStandardMaterial({
         "roughness" : 0.95
         ,"normalMap" : bark.NormalMap
         ,"map" : bark.Map
      }),1.2);
   }
   /// procedure TWorld.Ground()
   ,Ground:function(Self) {
      var a$180 = 0,
         s$6 = 0,
         Y = 0,
         z$3 = 0,
         x$5 = 0,
         a$181 = 0,
         s$7 = 0,
         a$182 = 0,
         e$1 = 0,
         a$183 = [0,0],
         a$184 = [0,0];
      function SW(x0$2, x1$2, z0, z1) {
         var cx$1 = 0,
            cz = 0;
         cx$1 = (x0$2 + x1$2) / 2;
         cz = (z0 + z1) / 2;
         TWorld.Box(Self,cx$1,0.075,cz,x1$2 - x0$2,0.15,z1 - z0,"sidewalk",TBoxOpts.Coll(Opt()));
      }
      function CurbAlongZ(x$6, z0, z1) {
         TWorld.Box(Self,x$6,0.08,(z0 + z1) / 2,0.25,0.16,z1 - z0,"concreteDark",null);
      }
      function CurbAlongX(z$4, x0$2, x1$2) {
         TWorld.Box(Self,(x0$2 + x1$2) / 2,0.08,z$4,x1$2 - x0$2,0.16,0.25,"concreteDark",null);
      }
      TWorld.Box(Self,0,-0.35,0,520,0.5,520,"dirt",null);
      TWorld.Box(Self,0,-0.1,0,14,0.2,200,"asphalt",null);
      TWorld.Box(Self,0,-0.1,0,140,0.2,14,"asphalt",null);
      a$183 = [-1, 1];
      for(a$180=0;a$180<=1;a$180++) {
         s$6 = a$183[a$180];
         SW((s$6 > 0)?7:-11,(s$6 > 0)?11:-7,11,100);
         SW((s$6 > 0)?7:-11,(s$6 > 0)?11:-7,-100,-11);
         CurbAlongZ(s$6 * 7.12,7,100);
         CurbAlongZ(s$6 * 7.12,-100,-7);
         SW(11,70,(s$6 > 0)?7:-11,(s$6 > 0)?11:-7);
         SW(-70,-11,(s$6 > 0)?7:-11,(s$6 > 0)?11:-7);
         CurbAlongX(s$6 * 7.12,7,70);
         CurbAlongX(s$6 * 7.12,-70,-7);
         SW((s$6 > 0)?7:-11,(s$6 > 0)?11:-7,7,11);
         SW((s$6 > 0)?7:-11,(s$6 > 0)?11:-7,-11,-7);
      }
      Y = 0.004;
      z$3 = -96;
      while (z$3 < 96) {
         if (Abs$_Integer_(z$3) >= 12) {
            TWorld.Box(Self,0,Y,z$3,0.14,0.004,3,"paintYellow",TBoxOpts.NoUV(Opt()));
         }
         z$3 += 6;
      }
      x$5 = -66;
      while (x$5 < 66) {
         if (Abs$_Integer_(x$5) >= 12) {
            TWorld.Box(Self,x$5,Y,0,3,0.004,0.14,"paintYellow",TBoxOpts.NoUV(Opt()));
         }
         x$5 += 6;
      }
      a$184 = [-1, 1];
      for(a$181=0;a$181<=1;a$181++) {
         s$7 = a$184[a$181];
         var a$185 = [0,0];
         for(let i$2=-6;i$2<=6;i$2++) {
            TWorld.Box(Self,i$2 * 1,Y,s$7 * 9.5,0.5,0.004,3,"paintWhite",TBoxOpts.NoUV(Opt()));
            TWorld.Box(Self,s$7 * 9.5,Y,i$2 * 1,3,0.004,0.5,"paintWhite",TBoxOpts.NoUV(Opt()));
         }
         TWorld.Box(Self,(s$7 > 0)?-3.5:3.5,Y,s$7 * 11.6,7,0.004,0.3,"paintWhite",TBoxOpts.NoUV(Opt()));
         a$185 = [-1, 1];
         for(a$182=0;a$182<=1;a$182++) {
            e$1 = a$185[a$182];
            TWorld.Box(Self,e$1 * 6.6,Y,s$7 * 50,0.12,0.004,80,"paintWhite",TBoxOpts.NoUV(Opt()));
         }
      }
   }
   /// procedure TWorld.Jersey(x: Float; z: Float; ry: Float)
   ,Jersey:function(Self, x$5, z$3, ry) {
      var s$6 = null,
         g$11 = null;
      s$6 = new THREE.Shape();
      s$6.moveTo(-0.3,0);
      s$6.lineTo(0.3,0);
      s$6.lineTo(0.3,0.08);
      s$6.lineTo(0.11,0.3);
      s$6.lineTo(0.08,0.81);
      s$6.lineTo(-0.08,0.81);
      s$6.lineTo(-0.11,0.3);
      s$6.lineTo(-0.3,0.08);
      s$6.lineTo(-0.3,0);
      g$11 = new THREE.ExtrudeGeometry(s$6,{
         "depth" : 3
         ,"bevelThickness" : 0.02
         ,"bevelSize" : 0.015
         ,"bevelSegments" : 1
         ,"bevelEnabled" : true
      });
      g$11.translate(0,0,-1.5);
      g$11.computeVertexNormals();
      TWorld.Mesh$1(Self,g$11,"concrete",x$5,0,z$3,0,ry,0,1,1,1,null,null);
      TWorld.ColliderFromBox(Self,0.6,0.82,3,YRot(x$5,0.41,z$3,ry),"concrete");
      TWorld.CoverFor(Self,x$5,z$3,ry);
   }
   /// procedure TWorld.Lamp(x: Float; z: Float; dir: Float)
   ,Lamp:function(Self, x$5, z$3, dir) {
      var g$11 = null;
      g$11 = new THREE.CylinderGeometry(0.07,0.11,7,10);
      TWorld.Mesh$1(Self,g$11,"metal",x$5,3.65,z$3,0,0,0,1,1,1,null,null);
      TWorld.Box(Self,x$5 + dir * 0.9,7.1,z$3,1.8,0.08,0.08,"metal",null);
      TWorld.Box(Self,x$5 + dir * 1.75,7,z$3,0.55,0.14,0.28,"metal",null);
      TWorld.Box(Self,x$5 + dir * 1.75,6.92,z$3,0.45,0.03,0.2,"glassDirty",TBoxOpts.NoUV(Opt()));
      TWorld.Collider(Self,x$5 - 0.12,0,z$3 - 0.12,x$5 + 0.12,7,z$3 + 0.12,"metal");
   }
   /// function TWorld.LineOfSight(a: JVector3; b: JVector3) : Boolean
   ,LineOfSight:function(Self, a$119, b$7) {
      var Result = false;
      var d$9 = null,
         len = 0,
         h$4 = null;
      d$9 = V3Zero().subVectors(b$7,a$119);
      len = d$9.length();
      d$9.divideScalar(len);
      h$4 = TWorld.Raycast(Self,a$119,d$9,len);
      Result = !h$4 || h$4.T$1 >= len - 0.05;
      return Result
   }
   /// procedure TWorld.Litter()
   ,Litter:function(Self) {
      var paper = null,
         cross = false,
         along = 0,
         across = 0,
         x$5 = 0,
         z$3 = 0,
         y$5 = 0,
         bag = null,
         side$2 = 0,
         cross$1 = false,
         along$1 = 0,
         bx = 0,
         bz = 0,
         n$22 = 0,
         tire = null,
         x$6 = 0,
         z$4 = 0;
      paper = new THREE.PlaneGeometry(0.21,0.3);
      for(let i$2=0;i$2<=259;i$2++) {
         cross = Self.Rand() < 0.3;
         along = (Self.Rand() - 0.5) * ((cross)?120:180);
         across = ((Self.Rand() < 0.5)?-1:1) * (6.5 + Self.Rand() * 4);
         x$5 = (cross)?along:across;
         z$3 = (cross)?across:along;
         y$5 = (Abs$_Float_(across) > 7)?0.152:0.003;
         TWorld.Mesh$1(Self,paper,"paper",x$5,y$5 + Self.Rand() * 0.004,z$3,-1.5707963267949 + (Self.Rand() - 0.5) * 0.3,Self.Rand() * 6,(Self.Rand() - 0.5) * 0.3,0.6 + Self.Rand() * 0.8,0.6 + Self.Rand() * 0.8,1,null,TBoxOpts.NoUV(Opt()));
      }
      bag = new THREE.SphereGeometry(0.32,12,9);
      for(let i$3=0;i$3<=25;i$3++) {
         side$2 = (Self.Rand() < 0.5)?-1:1;
         cross$1 = Self.Rand() < 0.3;
         along$1 = (Self.Rand() - 0.5) * ((cross$1)?100:170);
         if (Abs$_Float_(along$1) < 13) {
            continue;
         }
         bx = (cross$1)?along$1:side$2 * 10.35;
         bz = (cross$1)?side$2 * 10.35:along$1;
         n$22 = 2 + Floor(Self.Rand() * 4);
         for(let k$8=0,$temp53=n$22;k$8<$temp53;k$8++) {
            TWorld.Mesh$1(Self,bag,"trashbag",bx + (Self.Rand() - 0.5) * 0.9,0.35 + ((k$8 > 2)?0.35:0),bz + (Self.Rand() - 0.5) * 1.2,Self.Rand(),Self.Rand() * 6,Self.Rand(),1 + Self.Rand() * 0.3,0.75 + Self.Rand() * 0.3,1 + Self.Rand() * 0.2,null,null);
         }
         for(let k$9=0;k$9<=1;k$9++) {
            TWorld.Box(Self,bx + (Self.Rand() - 0.5) * 1.4,0.33,bz + (Self.Rand() - 0.5) * 1.4,0.5,0.36,0.4,"wood",TBoxOpts.UV(TBoxOpts.Rot(Opt(),0,Self.Rand() * 3,0),0.8));
         }
      }
      tire = new THREE.TorusGeometry(0.3,0.12,8,18);
      for(let i$4=0;i$4<=13;i$4++) {
         x$6 = (Self.Rand() - 0.5) * 16;
         z$4 = (Self.Rand() - 0.5) * 170;
         if (Abs$_Float_(z$4) < 12) {
            continue;
         }
         TWorld.Mesh$1(Self,tire,"rubber",x$6,0.12,z$4,1.5707963267949 + (Self.Rand() - 0.5) * 0.3,0,Self.Rand() * 3,1,1,1,null,TBoxOpts.NoUV(Opt()));
      }
   }
   /// procedure TWorld.MakeMaterial(i: Integer)
   ,MakeMaterial:function(Self, i$2) {
      switch (i$2) {
         case 0 :
            TWorld.Std(Self,"asphalt",GenAsphalt(1024),7,false);
            break;
         case 1 :
            TWorld.Std(Self,"sidewalk",GenSidewalk(1024),3,false);
            break;
         case 2 :
            TWorld.Std(Self,"concrete",GenConcreteWall(1024,12235944),4,false);
            break;
         case 3 :
            TWorld.Std(Self,"concreteDark",GenConcreteWall(512,9078398),3,false);
            break;
         case 4 :
            TWorld.Std(Self,"brick",GenBrick(1024,9325109),1.8,false);
            break;
         case 5 :
            TWorld.Std(Self,"brick2",GenBrick(1024,7232076),1.8,false);
            break;
         case 6 :
            TWorld.Std(Self,"plaster",GenPlaster(1024,13482136),5,false);
            break;
         case 7 :
            TWorld.Std(Self,"plaster2",GenPlaster(1024,10462883),5,false);
            break;
         case 8 :
            TWorld.Std(Self,"plaster3",GenPlaster(1024,12884586),5,false);
            break;
         case 9 :
            TWorld.Std(Self,"containerRed",GenCorrugated(512,8138530),3.6,true);
            break;
         case 10 :
            TWorld.Std(Self,"containerBlue",GenCorrugated(512,2837355),3.6,true);
            break;
         case 11 :
            TWorld.Std(Self,"containerGreen",GenCorrugated(512,4151868),3.6,true);
            break;
         case 12 :
            TWorld.Std(Self,"shutter",GenCorrugated(512,9277322),2.4,true);
            break;
         case 13 :
            TWorld.Std(Self,"wood",GenWood(512,10123858),1.4,false);
            break;
         case 14 :
            TWorld.Std(Self,"cloth",GenCloth(512,10127972),0.8,false);
            break;
         case 15 :
            TWorld.Std(Self,"dirt",GenDirt(1024),6,false);
            break;
         case 16 :
            TWorld.Std(Self,"carA",GenCarPaint(512,6120528),2,true);
            break;
         case 17 :
            TWorld.Std(Self,"carB",GenCarPaint(512,8006178),2,true);
            break;
         case 18 :
            TWorld.Std(Self,"carC",GenCarPaint(512,12170925),2,true);
            break;
         case 19 :
            TWorld.Std(Self,"burnt",GenCarPaint(512,1907224),2,true);
            break;
         case 20 :
            TWorld.Std(Self,"metal",GenGunMetal(256,3816510,0.55),1,true);
            break;
         case 21 :
            TWorld.Std(Self,"roof",GenRoof(512),4,false);
            break;
      }
   }
   /// procedure TWorld.Mesh(geo: JBufferGeometry; mat: String; x: Float; y: Float; z: Float; rx: Float = 0; ry: Float = 0; rz: Float = 0; sx: Float = 1; sy: Float = 1; sz: Float = 1; parent: JMatrix4 = nil; opts: TBoxOpts = nil)
   ,Mesh$1:function(Self, geo, mat$1, x$5, y$5, z$3, rx, ry, rz, sx, sy, sz, parent$2, opts) {
      _e.set(rx,ry,rz);
      _m.compose(_p.set(x$5,y$5,z$3),_q.setFromEuler(_e),_s.set(sx,sy,sz));
      if (parent$2) {
         _m.premultiply(parent$2);
      }
      TWorld.Add(Self,geo,mat$1,_m,opts);
   }
   /// function TWorld.Pole(x: Float; z: Float) : JVector3
   ,Pole:function(Self, x$5, z$3) {
      var Result = null;
      var g$11 = null,
         a$186 = 0,
         o$1 = 0,
         a$187 = [0,0,0];
      g$11 = new THREE.CylinderGeometry(0.13,0.16,9,10);
      TWorld.Mesh$1(Self,g$11,"wood",x$5,4.65,z$3,0,0,0,1,1,1,null,null);
      TWorld.Box(Self,x$5,8.6,z$3,2.2,0.12,0.12,"wood",null);
      a$187 = [-0.8, 0, 0.8];
      for(a$186=0;a$186<=2;a$186++) {
         o$1 = a$187[a$186];
         TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.04,0.05,0.14,6),"glassDirty",x$5 + o$1,8.72,z$3,0,0,0,1,1,1,null,null);
      }
      if (Self.Rand() < 0.4) {
         TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.28,0.28,0.8,12),"metal",x$5 + 0.35,7.6,z$3,0,0,0,1,1,1,null,null);
      }
      TWorld.Collider(Self,x$5 - 0.16,0,z$3 - 0.16,x$5 + 0.16,9,z$3 + 0.16,"wood");
      Result = V3(x$5,8.75,z$3);
      return Result
   }
   /// procedure TWorld.Props()
   ,Props:function(Self) {
      var deb = null,
         onCross = false,
         x$5 = 0,
         z$3 = 0,
         s$6 = 0,
         surfY = 0,
         z$4 = 0,
         a$188 = 0,
         x$6 = 0,
         poles = [],
         a$189 = 0,
         off$1 = 0,
         a$190 = 0,
         sx = 0,
         a$191 = 0,
         sz = 0,
         a$192 = [0,0],
         a$193 = [0,0,0,0];
      TWorld.Car(Self,-3.2,58,0.25,"carA",false);
      TWorld.Car(Self,3.8,40,-0.4,"carC",false);
      TWorld.Car(Self,-2,24,1.3,"burnt",true);
      TWorld.Car(Self,4.2,-18,3.3,"carB",false);
      TWorld.Car(Self,-4.5,-38,0.15,"burnt",true);
      TWorld.Car(Self,2.5,-58,-0.2,"carA",false);
      TWorld.Car(Self,22,3.5,1.5,"carC",false);
      TWorld.Car(Self,-26,-3.2,1.7,"burnt",true);
      TWorld.Car(Self,40,-2,1.45,"carB",false);
      TWorld.Car(Self,-44,3.8,1.6,"carA",false);
      TWorld.Car(Self,5,72,0.05,"carB",false);
      TWorld.Jersey(Self,0,66,0);
      TWorld.Jersey(Self,-3.2,66,0.1);
      TWorld.Jersey(Self,3.4,65.5,-0.15);
      TWorld.Jersey(Self,-1.5,32,0.3);
      TWorld.Jersey(Self,2.8,12,0);
      TWorld.Jersey(Self,-4,-10,0.2);
      TWorld.Jersey(Self,0.5,-28,-0.1);
      TWorld.Jersey(Self,-2.5,-48,0.05);
      TWorld.Jersey(Self,3.5,-48,-0.2);
      TWorld.Jersey(Self,16,-1,1.57);
      TWorld.Jersey(Self,-16,1.5,1.4);
      TWorld.Jersey(Self,32,2,1.57);
      TWorld.Jersey(Self,-34,-1.5,1.6);
      TWorld.Jersey(Self,48,0,1.5);
      TWorld.Jersey(Self,-52,2,1.57);
      TWorld.Jersey(Self,0,-70,0);
      TWorld.Jersey(Self,-3.2,-70,0.05);
      TWorld.Jersey(Self,3.3,-70.2,0);
      TWorld.Sandbags(Self,-5,46,0.1,5);
      TWorld.Sandbags(Self,5.2,28,-0.3,4);
      TWorld.Sandbags(Self,-5.2,5,0.1,5);
      TWorld.Sandbags(Self,0,-40,0,6);
      TWorld.Sandbags(Self,5,-65,0.2,4);
      TWorld.Sandbags(Self,-18,5,1.57,5);
      TWorld.Sandbags(Self,26,-5,1.5,4);
      TWorld.Sandbags(Self,-5.5,-60,-0.1,4);
      TWorld.Container(Self,-4.2,14,0.12,"containerRed",0);
      TWorld.Container(Self,3.6,-32,0.05,"containerBlue",0);
      TWorld.Container(Self,3.6,-32,0.1,"containerGreen",2.6);
      TWorld.Container(Self,-36,3.5,1.52,"containerGreen",0);
      TWorld.Container(Self,18,88,1.5708,"containerRed",0);
      TWorld.Crate(Self,5.5,50,0);
      TWorld.Crate(Self,6.2,51.2,0);
      TWorld.Crate(Self,5.8,50.6,1);
      TWorld.Crate(Self,-6,20,0);
      TWorld.Crate(Self,-6.3,21.2,0);
      TWorld.Crate(Self,6,-8,0);
      TWorld.Crate(Self,-5.8,-24,0);
      TWorld.Crate(Self,-6,-25.2,0);
      TWorld.Crate(Self,-6,-24.6,1);
      TWorld.Crate(Self,12,5,0);
      TWorld.Crate(Self,-40,-5,0);
      TWorld.Crate(Self,30,4.5,0);
      TWorld.Barrel(Self,6.2,44,"carB",false);
      TWorld.Barrel(Self,6.6,44.7,"containerBlue",false);
      TWorld.Barrel(Self,-6.4,36,"burnt",true);
      TWorld.Barrel(Self,-6.5,-14,"carB",false);
      TWorld.Barrel(Self,6.4,-44,"burnt",true);
      TWorld.Barrel(Self,13,-5,"containerGreen",false);
      TWorld.Barrel(Self,-14,5.5,"carB",false);
      TWorld.Barrel(Self,20,-5,"burnt",true);
      TWorld.RubblePile(Self,-6,70,2,50,0.6);
      TWorld.RubblePile(Self,6,10,2.2,60,0.8);
      TWorld.RubblePile(Self,-5.5,-30,1.8,40,0.5);
      TWorld.RubblePile(Self,5.5,-52,2.4,70,0.9);
      TWorld.RubblePile(Self,-30,6,2,50,0.6);
      TWorld.RubblePile(Self,44,-6,2,50,0.6);
      TWorld.RubblePile(Self,1,80,1.5,30,0.35);
      deb = new THREE.DodecahedronGeometry(1,0);
      for(let i$2=0;i$2<=699;i$2++) {
         onCross = Self.Rand() < 0.3;
         x$5 = (onCross)?(Self.Rand() - 0.5) * 120:(Self.Rand() - 0.5) * 20;
         z$3 = (onCross)?(Self.Rand() - 0.5) * 20:(Self.Rand() - 0.5) * 180;
         s$6 = 0.03 + Self.Rand() * 0.09;
         surfY = (Abs$_Float_((onCross)?z$3:x$5) > 7)?0.15:0;
         TWorld.Mesh$1(Self,deb,(Self.Rand() < 0.7)?"concrete":"brick",x$5,surfY + s$6 * 0.3,z$3,Self.Rand() * 3,Self.Rand() * 3,Self.Rand() * 3,s$6,s$6 * 0.6,s$6 * 1.2,null,null);
      }
      TWorld.Litter(Self);
      z$4 = -84;
      while (z$4 <= 84) {
         if (!(Abs$_Integer_(z$4) < 16 || Self.Rand() < 0.35)) {
            TWorld.Tree(Self,(!(z$4 % 28))?8.7:-8.7,z$4 + (Self.Rand() - 0.5) * 3);
         }
         z$4 += 14;
      }
      a$193 = [-40, -22, 22, 40];
      for(a$188=0;a$188<=3;a$188++) {
         x$6 = a$193[a$188];
         if (Self.Rand() < 0.8) {
            TWorld.Tree(Self,x$6 + (Self.Rand() - 0.5) * 4,(x$6 > 0)?-8.7:8.7);
         }
      }
      z$4 = -84;
      while (z$4 <= 84) {
         if (Abs$_Integer_(z$4) >= 14) {
            TWorld.Lamp(Self,-9.6,z$4,1);
            TWorld.Lamp(Self,9.6,z$4 + 12,-1);
         }
         z$4 += 24;
      }
      z$4 = -88;
      while (z$4 <= 88) {
         if (Abs$_Integer_(z$4) >= 12) {
            poles.push(TWorld.Pole(Self,10.3,z$4));
         }
         z$4 += 22;
      }
      for(let i$3=0,$temp54=poles.length - 2;i$3<=$temp54;i$3++) {
         var a$194 = [0,0,0];
         if (FSign(poles[i$3].z) != FSign(poles[i$3 + 1].z)) {
            continue;
         }
         a$194 = [-0.8, 0, 0.8];
         for(a$189=0;a$189<=2;a$189++) {
            off$1 = a$194[a$189];
            TWorld.Wire(Self,V3(poles[i$3].x + off$1,poles[i$3].y,poles[i$3].z),V3(poles[i$3 + 1].x + off$1,poles[i$3 + 1].y,poles[i$3 + 1].z),0.6);
         }
      }
      z$4 = -80;
      while (z$4 <= 80) {
         if (Abs$_Integer_(z$4) >= 12) {
            TWorld.Wire(Self,V3(10.3,8.4,z$4 - 0.5),V3(-11,7.5 + Self.Rand() * 3,z$4 + (Self.Rand() - 0.5) * 8),1.2);
         }
         z$4 += 22;
      }
      var a$195 = [0,0];
      a$192 = [-1, 1];
      for(a$190=0;a$190<=1;a$190++) {
         sx = a$192[a$190];
         a$195 = [-1, 1];
         for(a$191=0;a$191<=1;a$191++) {
            sz = a$195[a$191];
            TWorld.TrafficLight(Self,sx * 8.2,sz * 8.2,sx,sz);
         }
      }
      Self.Fires.push(TFire.Create$5($New(TFire),V3(-2,1.2,24),1.3));
      Self.Fires.push(TFire.Create$5($New(TFire),V3(-4.5,1.2,-38),1.2));
      Self.Fires.push(TFire.Create$5($New(TFire),V3(-26,1.2,-3.2),1.2));
      Self.Fires.push(TFire.Create$5($New(TFire),V3(-6.4,0.95,36),0.6));
      Self.Fires.push(TFire.Create$5($New(TFire),V3(6.4,0.95,-44),0.6));
      Self.Fires.push(TFire.Create$5($New(TFire),V3(20,0.95,-5),0.6));
      Self.SmokeStacks.push(V3(-60,0,-160));
      Self.SmokeStacks.push(V3(90,0,-120));
      Self.SmokeStacks.push(V3(-110,0,60));
      Self.SmokeStacks.push(V3(40,0,180));
      Self.SmokeStacks.push(V3(140,0,30));
   }
   /// function TWorld.Raycast(origin: JVector3; dir: JVector3; maxDist: Float = 500) : THit
   ,Raycast:function(Self, origin, dir, maxDist) {
      var Result = null;
      var best = 0,
         hit = null,
         hitGround = false,
         nAxis = 0,
         nSign = 0,
         ox$1 = 0,
         oy$1 = 0,
         oz$1 = 0,
         ix = 0,
         iy = 0,
         iz = 0,
         c$12 = null,
         t1 = 0,
         t2 = 0,
         tmin = 0,
         tmax = 0,
         ax = 0,
         a$119 = 0,
         b$7 = 0,
         t$6 = 0;
      best = maxDist;
      hit = null;
      hitGround = false;
      nAxis = 0;
      nSign = 0;
      ox$1 = origin.x;
      oy$1 = origin.y;
      oz$1 = origin.z;
      ix = 1 / dir.x;
      iy = 1 / dir.y;
      iz = 1 / dir.z;
      for(let i$2=0,$temp55=Self.Colliders.length;i$2<$temp55;i$2++) {
         c$12 = Self.Colliders[i$2];
         t1 = (c$12.Min$2.x - ox$1) * ix;
         t2 = (c$12.Max$2.x - ox$1) * ix;
         tmin = MinF(t1,t2);
         tmax = MaxF(t1,t2);
         ax = 0;
         t1 = (c$12.Min$2.y - oy$1) * iy;
         t2 = (c$12.Max$2.y - oy$1) * iy;
         a$119 = MinF(t1,t2);
         b$7 = MaxF(t1,t2);
         if (a$119 > tmin) {
            tmin = a$119;
            ax = 1;
         }
         if (b$7 < tmax) {
            tmax = b$7;
         }
         t1 = (c$12.Min$2.z - oz$1) * iz;
         t2 = (c$12.Max$2.z - oz$1) * iz;
         a$119 = MinF(t1,t2);
         b$7 = MaxF(t1,t2);
         if (a$119 > tmin) {
            tmin = a$119;
            ax = 2;
         }
         if (b$7 < tmax) {
            tmax = b$7;
         }
         if (tmax >= MaxF(tmin,0) && tmin < best && tmin > 0) {
            best = tmin;
            hit = c$12;
            nAxis = ax;
            nSign = (!ax)?-FSign(dir.x):(ax == 1)?-FSign(dir.y):-FSign(dir.z);
         }
      }
      if (dir.y < 0) {
         t$6 = (-oy$1) / dir.y;
         if (t$6 > 0 && t$6 < best) {
            best = t$6;
            hit = null;
            hitGround = true;
            nAxis = 1;
            nSign = 1;
         }
      }
      if (!hit && (!(hitGround))) {
         return null;
      }
      Result = TObject.Create($New(THit));
      Result.T$1 = best;
      Result.Point = origin.clone().addScaledVector(dir,best);
      Result.Normal = V3((!nAxis)?nSign:0,(nAxis == 1)?nSign:0,(nAxis == 2)?nSign:0);
      Result.Surf = (hitGround)?"asphalt":hit.Surf$1;
      Result.Collider$1 = hit;
      return Result
   }
   /// procedure TWorld.RubblePile(x: Float; z: Float; radius: Float; count: Integer; height: Float)
   ,RubblePile:function(Self, x$5, z$3, radius$1, count$2, height$3) {
      var geoA = null,
         geoB = null,
         a$119 = 0,
         r$3 = 0,
         h$4 = 0,
         s$6 = 0,
         mat$1 = "",
         a$120 = 0,
         r$4 = 0,
         sx = 0,
         sz = 0,
         ry = 0;
      geoA = new THREE.DodecahedronGeometry(1,0);
      geoB = new THREE.BoxGeometry(1,1,1);
      for(let i$2=0,$temp56=count$2;i$2<$temp56;i$2++) {
         a$119 = Self.Rand() * 3.14159265358979 * 2;
         r$3 = Sqrt(Self.Rand()) * radius$1;
         h$4 = (1 - r$3 / radius$1) * height$3;
         s$6 = 0.08 + Self.Rand() * 0.35 * (1 - r$3 / radius$1 * 0.5);
         mat$1 = (Self.Rand() < 0.45)?"concrete":(Self.Rand() < 0.6)?"brick":(Self.Rand() < 0.8)?"concreteDark":"plaster";
         TWorld.Mesh$1(Self,(Self.Rand() < 0.6)?geoA:geoB,mat$1,x$5 + Cos(a$119) * r$3,h$4 * Self.Rand() + s$6 * 0.3,z$3 + Sin(a$119) * r$3,Self.Rand() * 3,Self.Rand() * 3,Self.Rand() * 3,s$6 * (0.8 + Self.Rand()),s$6 * (0.5 + Self.Rand() * 0.6),s$6 * (0.8 + Self.Rand()),null,null);
      }
      for(let i$3=0;i$3<=2;i$3++) {
         a$120 = Self.Rand() * 3.14159265358979 * 2;
         r$4 = Self.Rand() * radius$1 * 0.6;
         sx = x$5 + Cos(a$120) * r$4;
         sz = z$3 + Sin(a$120) * r$4;
         ry = Self.Rand() * 3.14159265358979;
         TWorld.Box(Self,sx,height$3 * 0.4,sz,1.4 + Self.Rand(),0.18,0.9 + Self.Rand() * 0.6,"concrete",TBoxOpts.Rot(Opt(),(Self.Rand() - 0.5) * 0.9,ry,(Self.Rand() - 0.5) * 0.9));
         for(let k$8=0;k$8<=2;k$8++) {
            TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.012,0.012,1.2,4),"metal",sx + Self.Rand() - 0.5,height$3 * 0.5 + 0.2,sz + Self.Rand() - 0.5,(Self.Rand() - 0.5) * 1.5,0,(Self.Rand() - 0.5) * 1.5,1,1,1,null,null);
         }
      }
      if (height$3 > 0.6) {
         TWorld.Collider(Self,x$5 - radius$1 * 0.5,0,z$3 - radius$1 * 0.5,x$5 + radius$1 * 0.5,height$3 * 0.6,z$3 + radius$1 * 0.5,"concrete");
      }
   }
   /// procedure TWorld.Sandbags(x: Float; z: Float; ry: Float; n: Integer)
   ,Sandbags:function(Self, x$5, z$3, ry, n$22) {
      var T$5 = null,
         bag = null,
         rows$1 = 0,
         off$1 = 0,
         count$2 = 0,
         lx = 0,
         a$196 = 0,
         lz = 0,
         len = 0;
      T$5 = YRot(x$5,0,z$3,ry);
      bag = new THREEX.RoundedBoxGeometry(0.62,0.17,0.36,3,0.075);
      rows$1 = 5;
      for(let r$3=0,$temp57=rows$1;r$3<$temp57;r$3++) {
         off$1 = r$3 % 2 * 0.31;
         count$2 = n$22 - ((r$3 == rows$1 - 1)?1:0);
         for(let i$2=0,$temp58=count$2;i$2<$temp58;i$2++) {
            var a$197 = [0,0];
            lx = (-((n$22 - 1) * 0.6)) / 2 + i$2 * 0.6 + off$1 - ((r$3 % 2)?0.15:0);
            a$197 = [-0.2, 0.2];
            for(a$196=0;a$196<=1;a$196++) {
               lz = a$197[a$196];
               TWorld.Mesh$1(Self,bag,"cloth",lx + (Self.Rand() - 0.5) * 0.04,0.085 + r$3 * 0.155,lz + (Self.Rand() - 0.5) * 0.04,(Self.Rand() - 0.5) * 0.12,(Self.Rand() - 0.5) * 0.2,(Self.Rand() - 0.5) * 0.1,1 + (Self.Rand() - 0.5) * 0.1,1,1,T$5,null);
            }
         }
      }
      len = n$22 * 0.6;
      TWorld.ColliderFromBox(Self,len,rows$1 * 0.155 + 0.05,0.8,Translated(T$5,0,rows$1 * 0.155 / 2,0),"cloth");
      TWorld.CoverFor(Self,x$5,z$3,ry);
   }
   /// procedure TWorld.Skyline()
   ,Skyline:function(Self) {
      var rr$1 = null,
         a$119 = 0,
         r$3 = 0,
         x$5 = 0,
         z$3 = 0,
         w$2 = 0,
         d$9 = 0,
         h$4 = 0;
      rr$1 = Rng(99);
      for(let i$2=0;i$2<=89;i$2++) {
         a$119 = rr$1() * 3.14159265358979 * 2;
         r$3 = 130 + rr$1() * 150;
         x$5 = Cos(a$119) * r$3;
         z$3 = Sin(a$119) * r$3;
         w$2 = 15 + rr$1() * 30;
         d$9 = 15 + rr$1() * 30;
         h$4 = 15 + rr$1() * 60;
         TWorld.Box(Self,x$5,h$4 / 2,z$3,w$2,h$4,d$9,"skyline",TBoxOpts.Rot(Opt(),0,rr$1() * 0.5,0));
         if (rr$1() < 0.3) {
            TWorld.Box(Self,x$5,h$4 + 4,z$3,1,8,1,"skyline",TBoxOpts.NoUV(Opt()));
         }
      }
   }
   /// procedure TWorld.Std(key: String; tex: TPBRMaps; s: Float; metal: Boolean = False)
   ,Std:function(Self, key, tex, s$6, metal$1) {
      var m$3 = null;
      m$3 = new THREE.MeshStandardMaterial({
         "roughnessMap" : tex.RoughnessMap
         ,"roughness" : 1
         ,"normalMap" : tex.NormalMap
         ,"metalness" : 0
         ,"map" : tex.Map
      });
      if (metal$1) {
         m$3.metalnessMap = tex.MetalnessMap;
         m$3.metalness = 1;
      }
      m$3.normalScale = new THREE.Vector2(1,1);
      m$3.userData.scale = s$6;
      Self.Mats[key]=m$3;
   }
   /// procedure TWorld.TrafficLight(x: Float; z: Float; sx: Float; sz: Float)
   ,TrafficLight:function(Self, x$5, z$3, sx, sz) {
      var armLen = 0,
         hx = 0;
      TWorld.Mesh$1(Self,new THREE.CylinderGeometry(0.09,0.1,5.5,10),"metal",x$5,2.9,z$3,0,0,0,1,1,1,null,null);
      armLen = 5;
      TWorld.Box(Self,x$5 - sx * armLen / 2,5.5,z$3,armLen,0.1,0.1,"metal",null);
      hx = x$5 - sx * (armLen - 0.4);
      TWorld.Box(Self,hx,5,z$3,0.35,1,0.3,"frame",null);
      for(let i$2=0;i$2<=2;i$2++) {
         TWorld.Box(Self,hx,5.3 - i$2 * 0.3,z$3 - sz * 0.16,0.2,0.2,0.02,(!i$2)?"redLight":"glassDirty",TBoxOpts.NoUV(Opt()));
      }
      TWorld.Collider(Self,x$5 - 0.12,0,z$3 - 0.12,x$5 + 0.12,5.6,z$3 + 0.12,"metal");
   }
   /// procedure TWorld.Tree(x: Float; z: Float)
   ,Tree:function(Self, x$5, z$3) {
      var leafGeo = null,
         h$4 = 0,
         start$4 = null,
         dir = null;
      function Branch(p$3, dir$1, len, rad, depth) {
         var g$11 = null,
            q$3 = null,
            m$3 = null,
            e$1 = null,
            n$22 = 0,
            lp = null,
            s$6 = 0,
            kids = 0,
            nd = null;
         g$11 = new THREE.CylinderGeometry(rad * 0.7,rad,len,7);
         g$11.translate(0,len / 2,0);
         q$3 = new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),dir$1);
         m$3 = new THREE.Matrix4().compose(p$3,q$3,V3(1,1,1));
         TWorld.Add(Self,g$11,"bark",m$3,null);
         e$1 = p$3.clone().addScaledVector(dir$1,len);
         if (depth >= 3 || rad < 0.03) {
            n$22 = 5 + Floor(Self.Rand() * 4);
            for(let k$8=0,$temp59=n$22;k$8<$temp59;k$8++) {
               lp = e$1.clone().add(V3((Self.Rand() - 0.5) * 1.2,(Self.Rand() - 0.3) * 0.9,(Self.Rand() - 0.5) * 1.2));
               s$6 = 0.8 + Self.Rand() * 0.7;
               TWorld.Mesh$1(Self,leafGeo,"leaves",lp.x,lp.y,lp.z,Self.Rand() * 3,Self.Rand() * 3,Self.Rand() * 3,s$6,s$6,s$6,null,TBoxOpts.NoUV(Opt()));
            }
            return;
         }
         kids = (!depth)?3:2 + ((Self.Rand() < 0.4)?1:0);
         for(let k$9=0,$temp60=kids;k$9<$temp60;k$9++) {
            nd = dir$1.clone().add(V3((Self.Rand() - 0.5) * 1.4,0.35 + Self.Rand() * 0.5,(Self.Rand() - 0.5) * 1.4)).normalize();
            Branch(e$1,nd,len * (0.62 + Self.Rand() * 0.15),rad * 0.62,depth + 1);
         }
      }
      TWorld.Box(Self,x$5,0.3,z$3,1.3,0.3,1.3,"concreteDark",TBoxOpts.Coll(Opt()));
      TWorld.Box(Self,x$5,0.46,z$3,1.1,0.04,1.1,"dirt",null);
      leafGeo = new THREE.PlaneGeometry(1.2,1.2);
      h$4 = 2.4 + Self.Rand() * 1.2;
      start$4 = V3(x$5,0.45,z$3);
      dir = V3((Self.Rand() - 0.5) * 0.15,1,(Self.Rand() - 0.5) * 0.15).normalize();
      Branch(start$4,dir,h$4,0.13 + Self.Rand() * 0.04,0);
      TWorld.Collider(Self,x$5 - 0.18,0,z$3 - 0.18,x$5 + 0.18,4,z$3 + 0.18,"wood");
   }
   /// procedure TWorld.Wire(a: JVector3; b: JVector3; sag: Float)
   ,Wire:function(Self, a$119, b$7, sag) {
      var pts$1 = [],
         t$6 = 0,
         p$3 = null,
         g$11 = null;
      for(let i$2=0;i$2<=16;i$2++) {
         t$6 = i$2 / 16;
         p$3 = a$119.clone().lerp(b$7,t$6);
         p$3.y -= Sin(t$6 * 3.14159265358979) * sag;
         pts$1.push(p$3);
      }
      g$11 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts$1),24,0.014,4,false);
      TWorld.Add(Self,g$11,"wire",null,TBoxOpts.NoUV(Opt()));
   }
   ,Destroy:TObject.Destroy
};
/// TStyle = class (TObject)
var TStyle = {
   $ClassName:"TStyle",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.FloorH = 0;
      $.Trim$2 = $.Wall = "";
   }
   /// constructor TStyle.Create(awall: String; atrim: String; afloorH: Float)
   ,Create$4:function(Self, awall, atrim, afloorH) {
      Self.Wall = awall;
      Self.Trim$2 = atrim;
      Self.FloorH = afloorH;
      return Self
   }
   ,Destroy:TObject.Destroy
};
/// THit = class (TObject)
var THit = {
   $ClassName:"THit",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Collider$1 = $.Normal = $.Point = null;
      $.Surf = "";
      $.T$1 = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TGeoGroup = class (TObject)
var TGeoGroup = {
   $ClassName:"TGeoGroup",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Geos = [];
      $.Mat = "";
   }
   ,Destroy:TObject.Destroy
};
/// TFire = class (TObject)
var TFire = {
   $ClassName:"TFire",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Pos$2 = null;
      $.Scale = 0;
   }
   /// constructor TFire.Create(apos: JVector3; ascale: Float)
   ,Create$5:function(Self, apos, ascale) {
      Self.Pos$2 = apos;
      Self.Scale = ascale;
      return Self
   }
   ,Destroy:TObject.Destroy
};
/// TCollider = class (TObject)
var TCollider = {
   $ClassName:"TCollider",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Max$2 = $.Min$2 = null;
      $.Surf$1 = "";
   }
   /// constructor TCollider.Create(amin: JVector3; amax: JVector3; asurf: String)
   ,Create$6:function(Self, amin, amax, asurf) {
      Self.Min$2 = amin;
      Self.Max$2 = amax;
      Self.Surf$1 = asurf;
      return Self
   }
   ,Destroy:TObject.Destroy
};
/// TBoxOpts = class (TObject)
var TBoxOpts = {
   $ClassName:"TBoxOpts",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Collide$1 = $.WorldUV = false;
      $.Parent = null;
      $.RX = $.RY = $.RZ = $.UVScale = 0;
      $.Surf$2 = "";
   }
   /// function TBoxOpts.Coll() : TBoxOpts
   ,Coll:function(Self) {
      var Result = null;
      Self.Collide$1 = true;
      Result = Self;
      return Result
   }
   /// constructor TBoxOpts.Create()
   ,Create$7:function(Self) {
      Self.WorldUV = true;
      Self.Surf$2 = "concrete";
      return Self
   }
   /// function TBoxOpts.NoUV() : TBoxOpts
   ,NoUV:function(Self) {
      var Result = null;
      Self.WorldUV = false;
      Result = Self;
      return Result
   }
   /// function TBoxOpts.Rot(ax: Float; ay: Float; az: Float) : TBoxOpts
   ,Rot:function(Self, ax, ay, az) {
      var Result = null;
      Self.RX = ax;
      Self.RY = ay;
      Self.RZ = az;
      Result = Self;
      return Result
   }
   /// function TBoxOpts.UV(s: Float) : TBoxOpts
   ,UV:function(Self, s$6) {
      var Result = null;
      Self.UVScale = s$6;
      Result = Self;
      return Result
   }
   ,Destroy:TObject.Destroy
};
function Rng(seed$1) {
   var Result = null;
   var s$2 = 0;
   s$2 = seed$1;
   Result = function () {
      var Result = 0;
      var t = 0,
         u = 0;
      s$2 = s$2|0;
      s$2 = (s$2 + 1831565813)|0;
      t = Math.imul(s$2^(s$2>>>15),1|s$2);
      t = (t + Math.imul(t^(t>>>7),61|t))^t;
      u = t^(t>>>14);
      if (u < 0) {
         u+=4294967296;
      }
      Result = u / 4294967296;
      return Result
   };
   return Result
}
function Par(T$5) {
   var Result = null;
   Result = TBoxOpts.Create$7($New(TBoxOpts));
   Result.Parent = T$5;
   return Result
}
function Opt() {
   var Result = null;
   Result = TBoxOpts.Create$7($New(TBoxOpts));
   return Result
}
function YRot(x$5, y$5, z$3, ry) {
   var Result = null;
   Result = new THREE.Matrix4().compose(V3(x$5,y$5,z$3),new THREE.Quaternion().setFromAxisAngle(V3(0,1,0),ry),V3(1,1,1));
   return Result
}
function Translated(T$5, x$5, y$5, z$3) {
   var Result = null;
   Result = new THREE.Matrix4().multiplyMatrices(T$5,new THREE.Matrix4().makeTranslation(x$5,y$5,z$3));
   return Result
}
var MAT_KEYS = ["asphalt","sidewalk","concrete","concreteDark","brick","brick2","plaster","plaster2","plaster3","containerRed","containerBlue","containerGreen","shutter","wood","cloth","dirt","carA","carB","carC","burnt","metal","roof"];
/// TAudio = class (TObject)
var TAudio = {
   $ClassName:"TAudio",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Ctx = $.FBrown = $.FMaster = $.FNoise = $.FReverb = $.FRevGain = $.ListenerPos = null;
      $.Enabled = false;
   }
   /// procedure TAudio.Ambience()
   ,Ambience:function(Self) {
      var distant = null,
         c$12 = null,
         n$22 = null,
         f$3 = null,
         g$11 = null,
         lfo = null,
         lg = null;
      c$12 = Self.Ctx;
      n$22 = TAudio.NoiseSrc(Self,Self.FBrown);
      f$3 = c$12.createBiquadFilter();
      f$3.type = "lowpass";
      f$3.frequency.value = 500;
      f$3.Q.value = 0.8;
      g$11 = c$12.createGain();
      g$11.gain.value = 0.18;
      lfo = c$12.createOscillator();
      lfo.frequency.value = 0.07;
      lg = c$12.createGain();
      lg.gain.value = 250;
      lfo.connect(lg).connect(f$3.frequency);
      n$22.connect(f$3).connect(g$11).connect(Self.FMaster);
      n$22.start();
      lfo.start();
      distant = function () {
         var t$6 = 0,
            a$119 = 0,
            lp = null,
            pos$4 = null,
            o$1 = null,
            shots = 0,
            rate = 0;
         if (!(Self.Enabled)) {
            return;
         }
         t$6 = c$12.currentTime;
         a$119 = Math.random() * 3.14159265358979 * 2;
         lp = (Self.ListenerPos)?Self.ListenerPos:V3Zero();
         pos$4 = V3(lp.x + Cos(a$119) * 250,20,lp.z + Sin(a$119) * 250);
         o$1 = TAudio.Output(Self,pos$4,6,1.2);
         if (Math.random() < 0.35) {
            TAudio.Burst(Self,o$1,t$6,"lowpass",300,1,1.4,0.001,1.6,Self.FBrown,0);
            TAudio.Tone(Self,o$1,t$6,"sine",55,25,1,0.002,1);
         } else {
            shots = 3 + Floor(Math.random() * 8);
            rate = 0.07 + Math.random() * 0.06;
            for(let i$2=0,$temp61=shots;i$2<$temp61;i$2++) {
               TAudio.Burst(Self,o$1,t$6 + i$2 * rate,"bandpass",600,0.8,0.9,0.001,0.12,null,0);
            }
         }
         setTimeout(distant,1500 + Math.random() * 5000);
      };
      setTimeout(distant,2000);
   }
   /// procedure TAudio.Burst(dst: JAudioNode; t: Float; typ: String = 'bandpass'; freq: Float = 1000; q: Float = 1; peak: Float = 1; a: Float = 0,001; decay: Float = 0,1; buf: JAudioBuffer = nil; sweepTo: Float = 0)
   ,Burst:function(Self, dst, t$6, typ, freq, q$3, peak, a$119, decay$1, buf, sweepTo) {
      var n$22 = null,
         f$3 = null,
         g$11 = null;
      n$22 = TAudio.NoiseSrc(Self,buf);
      f$3 = Self.Ctx.createBiquadFilter();
      f$3.type = typ;
      f$3.frequency.setValueAtTime(freq,t$6);
      f$3.Q.value = q$3;
      if (sweepTo != 0) {
         f$3.frequency.exponentialRampToValueAtTime(sweepTo,t$6 + a$119 + decay$1);
      }
      g$11 = Self.Ctx.createGain();
      TAudio.Env(Self,g$11,t$6,a$119,peak,decay$1,0.0001);
      n$22.connect(f$3).connect(g$11).connect(dst);
      n$22.start(t$6,Math.random() * 1.5);
      n$22.stop(t$6 + a$119 + decay$1 + 0.05);
   }
   /// procedure TAudio.Click(freq: Float = 3000; vol: Float = 0,3; delay: Float = 0)
   ,Click:function(Self, freq, vol, delay) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime + delay;
      o$1 = TAudio.Output(Self,null,vol,0.08);
      TAudio.Burst(Self,o$1,t$6,"bandpass",freq,5,1,0.001,0.025,null,0);
      TAudio.Tone(Self,o$1,t$6,"square",freq * 0.3,freq * 0.2,0.15,0.002,0.02);
   }
   /// procedure TAudio.Dry()
   ,Dry:function(Self) {
      TAudio.Click(Self,4200,0.35,0);
   }
   /// procedure TAudio.EnemyShot(pos: JVector3)
   ,EnemyShot:function(Self, pos$4) {
      var t$6 = 0,
         p$3 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      p$3 = 0.85 + Math.random() * 0.15;
      o$1 = TAudio.Output(Self,pos$4,1.1,0.7);
      TAudio.Burst(Self,o$1,t$6,"highpass",2000 * p$3,0.7,0.9,0.001,0.04,null,0);
      TAudio.Burst(Self,o$1,t$6,"bandpass",750 * p$3,0.9,1.2,0.001,0.15,null,250);
      TAudio.Tone(Self,o$1,t$6,"sine",120 * p$3,35,1,0.002,0.15);
   }
   /// procedure TAudio.Env(g: JGainNode; t: Float; a: Float; peak: Float; decay: Float; end: Float = 0,0001)
   ,Env:function(Self, g$11, t$6, a$119, peak, decay$1, end) {
      g$11.gain.setValueAtTime(0.0001,t$6);
      g$11.gain.exponentialRampToValueAtTime(peak,t$6 + a$119);
      g$11.gain.exponentialRampToValueAtTime(end,t$6 + a$119 + decay$1);
   }
   /// procedure TAudio.Explosion(pos: JVector3)
   ,Explosion:function(Self, pos$4) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,pos$4,2.4,0.9);
      TAudio.Burst(Self,o$1,t$6,"lowpass",3000,0.5,1.6,0.001,0.5,null,200);
      TAudio.Burst(Self,o$1,t$6,"lowpass",250,0.7,2.2,0.001,1.8,Self.FBrown,0);
      TAudio.Tone(Self,o$1,t$6,"sine",70,22,2,0.002,0.9);
      TAudio.Burst(Self,o$1,t$6 + 0.3,"highpass",3000,1,0.12,0.001,1.4,null,0);
   }
   /// procedure TAudio.Gunshot()
   ,Gunshot:function(Self) {
      var t$6 = 0,
         p$3 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      p$3 = 0.94 + Math.random() * 0.12;
      o$1 = TAudio.Output(Self,null,0.9,0.55);
      TAudio.Burst(Self,o$1,t$6,"highpass",2500 * p$3,0.7,1.2,0.001,0.045,null,0);
      TAudio.Burst(Self,o$1,t$6,"bandpass",900 * p$3,0.9,1.4,0.001,0.13,null,300);
      TAudio.Burst(Self,o$1,t$6,"lowpass",400,0.5,1.6,0.001,0.22,Self.FBrown,0);
      TAudio.Tone(Self,o$1,t$6,"sine",150 * p$3,38,1.3,0.002,0.16);
      TAudio.Burst(Self,o$1,t$6 + 0.03,"bandpass",3800,6,0.25,0.001,0.02,null,0);
      TAudio.Burst(Self,o$1,t$6 + 0.09,"bandpass",700,0.8,0.35,0.001,0.25,null,250);
   }
   /// procedure TAudio.Heartbeat()
   ,Heartbeat:function(Self) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,null,0.45,0);
      TAudio.Tone(Self,o$1,t$6,"sine",60,40,1,0.002,0.12);
      TAudio.Tone(Self,o$1,t$6 + 0.18,"sine",55,38,0.7,0.002,0.12);
   }
   /// procedure TAudio.Hitmarker(kill: Boolean = False; head: Boolean = False)
   ,Hitmarker:function(Self, kill, head) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,null,(kill)?0.5:0.35,0.02);
      TAudio.Tone(Self,o$1,t$6,"square",(head)?2600:2000,(head)?2400:1800,0.25,0.002,0.03);
      if (kill) {
         TAudio.Tone(Self,o$1,t$6 + 0.04,"triangle",900,600,0.4,0.002,0.12);
      }
   }
   /// procedure TAudio.Hurt()
   ,Hurt:function(Self) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,null,0.5,0.05);
      TAudio.Tone(Self,o$1,t$6,"sine",90,45,0.8,0.002,0.15);
      TAudio.Burst(Self,o$1,t$6,"lowpass",800,1,0.6,0.001,0.1,null,0);
   }
   /// procedure TAudio.Impact(pos: JVector3; surf: String)
   ,Impact:function(Self, pos$4, surf) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,pos$4,0.6,0.2);
      if (surf == "metal") {
         TAudio.Tone(Self,o$1,t$6,"triangle",2200 + Math.random() * 1500,1800,0.3,0.002,0.25);
         TAudio.Burst(Self,o$1,t$6,"highpass",3000,1,0.5,0.001,0.03,null,0);
      } else if (surf == "wood") {
         TAudio.Burst(Self,o$1,t$6,"bandpass",600,2,0.8,0.001,0.08,null,0);
      } else if (surf == "flesh") {
         TAudio.Burst(Self,o$1,t$6,"lowpass",500,1,1,0.001,0.08,null,0);
      } else {
         TAudio.Burst(Self,o$1,t$6,"bandpass",1800,1.2,0.6,0.001,0.05,null,0);
         TAudio.Burst(Self,o$1,t$6 + 0.01,"highpass",4000,1,0.2,0.001,0.12,null,0);
      }
   }
   /// function TAudio.Impulse(dur: Float; decay: Float) : JAudioBuffer
   ,Impulse$1:function(Self, dur, decay$1) {
      var Result = null;
      var len = 0,
         buf = null,
         d$9 = null,
         period = 0,
         t$6 = 0,
         er = 0;
      len = Floor(Self.Ctx.sampleRate * dur);
      buf = Self.Ctx.createBuffer(2,len,Self.Ctx.sampleRate);
      for(let c$12=0;c$12<=1;c$12++) {
         d$9 = buf.getChannelData(c$12);
         period = Floor(Self.Ctx.sampleRate * (0.031 + c$12 * 0.007));
         for(let i$2=0,$temp62=len;i$2<$temp62;i$2++) {
            t$6 = i$2 / len;
            er = (i$2 % period < 30)?0.6 * (1 - t$6):0;
            d$9[i$2]=(((Math.random() * 2 - 1) * Power(1 - t$6,decay$1) + er * (Math.random() * 2 - 1)) * 0.5);
         }
      }
      Result = buf;
      return Result
   }
   /// procedure TAudio.Init()
   ,Init:function(Self) {
      var c$12 = null,
         comp = null,
         len = 0,
         d$9 = null,
         b$7 = null,
         last = 0;
      if (Self.Ctx) {
         Self.Ctx.resume();
         return;
      }
      Self.Ctx = new AudioContext();
      c$12 = Self.Ctx;
      Self.FMaster = c$12.createGain();
      Self.FMaster.gain.value = 0.8;
      comp = c$12.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      Self.FMaster.connect(comp).connect(c$12.destination);
      Self.FReverb = c$12.createConvolver();
      Self.FReverb.buffer = TAudio.Impulse$1(Self,2.8,2.6);
      Self.FRevGain = c$12.createGain();
      Self.FRevGain.gain.value = 0.55;
      Self.FReverb.connect(Self.FRevGain).connect(Self.FMaster);
      len = Floor(c$12.sampleRate * 2);
      Self.FNoise = c$12.createBuffer(1,len,c$12.sampleRate);
      d$9 = Self.FNoise.getChannelData(0);
      for(let i$2=0,$temp63=len;i$2<$temp63;i$2++) {
         d$9[i$2]=(Math.random() * 2 - 1);
      }
      Self.FBrown = c$12.createBuffer(1,len,c$12.sampleRate);
      b$7 = Self.FBrown.getChannelData(0);
      last = 0;
      for(let i$3=0,$temp64=len;i$3<$temp64;i$3++) {
         last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
         b$7[i$3]=(last * 3.5);
      }
      Self.Enabled = true;
      TAudio.Ambience(Self);
   }
   /// procedure TAudio.Melee()
   ,Melee:function(Self) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,null,0.5,0.1);
      TAudio.Burst(Self,o$1,t$6,"bandpass",1200,1,0.6,0.04,0.12,null,400);
   }
   /// function TAudio.NoiseSrc(buf: JAudioBuffer = nil) : JBufferSourceNode
   ,NoiseSrc:function(Self, buf) {
      var Result = null;
      var s$6 = null;
      if (!buf) {
         buf = Self.FNoise;
      }
      s$6 = Self.Ctx.createBufferSource();
      s$6.buffer = buf;
      s$6.loop = true;
      s$6.loopStart = 0;
      s$6.loopEnd = buf.duration;
      Result = s$6;
      return Result
   }
   /// function TAudio.Output(pos: JVector3; gain: Float = 1; rev: Float = 0,3) : JAudioNode
   ,Output:function(Self, pos$4, gain$1, rev) {
      var Result = null;
      var g$11 = null,
         p$3 = null,
         dist = 0,
         lp = null,
         s$6 = null,
         s$7 = null;
      g$11 = Self.Ctx.createGain();
      g$11.gain.value = gain$1;
      Result = g$11;
      if (pos$4) {
         p$3 = Self.Ctx.createPanner();
         p$3.panningModel = "HRTF";
         p$3.distanceModel = "inverse";
         p$3.refDistance = 3;
         p$3.rolloffFactor = 1.1;
         p$3.maxDistance = 400;
         if (p$3.positionX) {
            p$3.positionX.value = pos$4.x;
            p$3.positionY.value = pos$4.y;
            p$3.positionZ.value = pos$4.z;
         } else {
            p$3.setPosition(pos$4.x,pos$4.y,pos$4.z);
         }
         g$11.connect(p$3);
         p$3.connect(Self.FMaster);
         if (Self.ListenerPos) {
            dist = Self.ListenerPos.distanceTo(pos$4);
            lp = Self.Ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = MaxF(900,18000 - dist * 260);
            lp.connect(g$11);
            s$6 = Self.Ctx.createGain();
            s$6.gain.value = rev * MinF(1.5,0.4 + dist / 40);
            g$11.connect(s$6).connect(Self.FReverb);
            return lp;
         }
      } else {
         g$11.connect(Self.FMaster);
      }
      s$7 = Self.Ctx.createGain();
      s$7.gain.value = rev;
      g$11.connect(s$7).connect(Self.FReverb);
      return Result
   }
   /// procedure TAudio.Reload(dur: Float)
   ,Reload$2:function(Self, dur) {
      TAudio.Click(Self,1800,0.35,0.18);
      TAudio.Click(Self,900,0.25,0.26);
      TAudio.Click(Self,2400,0.45,dur * 0.55);
      TAudio.Click(Self,1400,0.3,dur * 0.58);
      TAudio.Click(Self,3200,0.45,dur * 0.82);
      TAudio.Click(Self,1100,0.35,dur * 0.84);
   }
   /// procedure TAudio.Shell(pos: JVector3)
   ,Shell:function(Self, pos$4) {
      var t$6 = 0,
         o$1 = null,
         f$3 = 0;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,pos$4,0.25,0.1);
      f$3 = 3500 + Math.random() * 2500;
      TAudio.Tone(Self,o$1,t$6,"sine",f$3,f$3 * 0.98,0.25,0.002,0.12);
      TAudio.Tone(Self,o$1,t$6,"sine",f$3 * 1.47,f$3 * 1.45,0.12,0.002,0.08);
   }
   /// procedure TAudio.Step(surf: String = 'concrete'; sprint: Boolean = False)
   ,Step:function(Self, surf, sprint) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,null,(sprint)?0.32:0.2,0.05);
      TAudio.Burst(Self,o$1,t$6,"lowpass",380,1,0.9,0.001,0.07,Self.FBrown,0);
      TAudio.Burst(Self,o$1,t$6 + 0.005,"bandpass",2400 + Math.random() * 1500,1.5,(surf == "dirt")?0.35:0.18,0.001,0.05,null,0);
      if (sprint && Math.random() < 0.6) {
         TAudio.Burst(Self,o$1,t$6 + 0.02,"bandpass",5200,4,0.08,0.001,0.04,null,0);
      }
   }
   /// procedure TAudio.Tone(dst: JAudioNode; t: Float; typ: String = 'sine'; f0: Float = 100; f1: Float = 40; peak: Float = 1; a: Float = 0,002; decay: Float = 0,15)
   ,Tone:function(Self, dst, t$6, typ, f0, f1$1, peak, a$119, decay$1) {
      var o$1 = null,
         g$11 = null;
      o$1 = Self.Ctx.createOscillator();
      o$1.type = typ;
      o$1.frequency.setValueAtTime(f0,t$6);
      o$1.frequency.exponentialRampToValueAtTime(MaxF(1,f1$1),t$6 + a$119 + decay$1);
      g$11 = Self.Ctx.createGain();
      TAudio.Env(Self,g$11,t$6,a$119,peak,decay$1,0.0001);
      o$1.connect(g$11).connect(dst);
      o$1.start(t$6);
      o$1.stop(t$6 + a$119 + decay$1 + 0.05);
   }
   /// procedure TAudio.UpdateListener(cam: JCamera)
   ,UpdateListener:function(Self, cam) {
      var L = null,
         t$6 = 0,
         f$3 = null,
         u$4 = null;
      if (!(Self.Enabled)) {
         return;
      }
      L = Self.Ctx.listener;
      t$6 = Self.Ctx.currentTime;
      f$3 = V3(0,0,-1).applyQuaternion(cam.quaternion);
      u$4 = V3(0,1,0).applyQuaternion(cam.quaternion);
      if (L.positionX) {
         L.positionX.setTargetAtTime(cam.position.x,t$6,0.01);
         L.positionY.setTargetAtTime(cam.position.y,t$6,0.01);
         L.positionZ.setTargetAtTime(cam.position.z,t$6,0.01);
         L.forwardX.setTargetAtTime(f$3.x,t$6,0.01);
         L.forwardY.setTargetAtTime(f$3.y,t$6,0.01);
         L.forwardZ.setTargetAtTime(f$3.z,t$6,0.01);
         L.upX.setTargetAtTime(u$4.x,t$6,0.01);
         L.upY.setTargetAtTime(u$4.y,t$6,0.01);
         L.upZ.setTargetAtTime(u$4.z,t$6,0.01);
      } else {
         L.setPosition(cam.position.x,cam.position.y,cam.position.z);
         L.setOrientation(f$3.x,f$3.y,f$3.z,u$4.x,u$4.y,u$4.z);
      }
      Self.ListenerPos = cam.position;
   }
   /// procedure TAudio.Whiz(pos: JVector3)
   ,Whiz:function(Self, pos$4) {
      var t$6 = 0,
         o$1 = null;
      if (!(Self.Enabled)) {
         return;
      }
      t$6 = Self.Ctx.currentTime;
      o$1 = TAudio.Output(Self,pos$4,0.5,0.05);
      TAudio.Burst(Self,o$1,t$6,"bandpass",5000,3,0.8,0.03,0.12,null,1500);
      TAudio.Burst(Self,o$1,t$6 + 0.02,"highpass",6000,1,0.4,0.001,0.02,null,0);
   }
   ,Destroy:TObject.Destroy
};
/// TTracer = class (TObject)
var TTracer = {
   $ClassName:"TTracer",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Active = false;
      $.Dest = $.Dir$1 = $.From$1 = $.Mesh$2 = null;
      $.Dist = $.Len = $.Speed$1 = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TParticleSystem = class (TObject)
var TParticleSystem = {
   $ClassName:"TParticleSystem",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.FACol = $.FAData = $.FAPos = $.FAVel = $.FCol = $.FDat = $.FGeo = $.FPos = $.FVel$1 = $.Mat$1 = $.Mesh$3 = null;
      $.FMax = 0;
      $.FSort = false;
      $.P$2 = [];
   }
   /// constructor TParticleSystem.Create(scene: JScene; tex: JTexture; max: Integer = 1000; additive: Boolean = False; sort: Boolean = False; fog: Float = 1)
   ,Create$83:function(Self, scene$1, tex, max$3, additive, sort, fog$2) {
      var geo = null,
         base = null;
      Self.FMax = max$3;
      Self.FSort = sort;
      geo = new THREE.InstancedBufferGeometry();
      base = new THREE.PlaneGeometry(2,2);
      geo.index = base.index;
      geo.setAttribute("position",base.attributes.position);
      geo.setAttribute("uv",base.attributes.uv);
      Self.FPos = new Float32Array(max$3 * 3);
      Self.FDat = new Float32Array(max$3*4);
      Self.FCol = new Float32Array(max$3 * 3);
      Self.FVel$1 = new Float32Array(max$3 * 3);
      Self.FAPos = new THREE.InstancedBufferAttribute(Self.FPos,3);
      Self.FAData = new THREE.InstancedBufferAttribute(Self.FDat,4);
      Self.FACol = new THREE.InstancedBufferAttribute(Self.FCol,3);
      Self.FAVel = new THREE.InstancedBufferAttribute(Self.FVel$1,3);
      Self.FAPos.setUsage(35048);
      Self.FAData.setUsage(35048);
      Self.FACol.setUsage(35048);
      Self.FAVel.setUsage(35048);
      geo.setAttribute("iPos",Self.FAPos);
      geo.setAttribute("iData",Self.FAData);
      geo.setAttribute("iColor",Self.FACol);
      geo.setAttribute("iVel",Self.FAVel);
      geo.instanceCount = 0;
      Self.Mat$1 = new THREE.ShaderMaterial({
         "vertexShader" : "attribute vec3 iPos;\r\nattribute vec4 iData;   \/\/ size, rotation, alpha, stretch\r\nattribute vec3 iColor;\r\nattribute vec3 iVel;\r\nvarying vec2 vUv;\r\nvarying vec4 vCol;\r\nvarying float vFog;\r\nvoid main() {\r\n  vUv = uv;\r\n  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);\r\n  vec2 corner = position.xy;\r\n  float size = iData.x;\r\n  if (iData.w > 0.0) {\r\n    vec4 mv2 = modelViewMatrix * vec4(iPos + iVel * 0.016, 1.0);\r\n    vec2 d = mv2.xy - mv.xy;\r\n    float len = length(d);\r\n    vec2 dir = len > 1e-5 ? d \/ len : vec2(1.0, 0.0);\r\n    vec2 perp = vec2(-dir.y, dir.x);\r\n    mv.xy += dir * corner.x * (size + len * iData.w) + perp * corner.y * size * 0.35;\r\n  } else {\r\n    float c = cos(iData.y), s = sin(iData.y);\r\n    mv.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;\r\n  }\r\n  vCol = vec4(iColor, iData.z);\r\n  vFog = 1.0 - exp(-0.00012 * dot(mv.xyz, mv.xyz));\r\n  gl_Position = projectionMatrix * mv;\r\n}\r\n"
         ,"uniforms" : {
            "map" : Uni(tex)
            ,"fogColor" : Uni(new THREE.Color(13220000))
            ,"fogAmt" : Uni(fog$2)
         }
         ,"transparent" : true
         ,"premultipliedAlpha" : false
         ,"fragmentShader" : "uniform sampler2D map;\r\nuniform vec3 fogColor;\r\nuniform float fogAmt;\r\nvarying vec2 vUv;\r\nvarying vec4 vCol;\r\nvarying float vFog;\r\nvoid main() {\r\n  vec4 t = texture2D(map, vUv);\r\n  vec4 c = vec4(t.rgb * vCol.rgb, t.a * vCol.a);\r\n  c.rgb = mix(c.rgb, fogColor * c.a, vFog * fogAmt);\r\n  gl_FragColor = c;\r\n  #include <colorspace_fragment>\r\n}\r\n"
         ,"depthWrite" : false
         ,"blending" : (additive)?2:1
      });
      if (!(additive)) {
         Self.Mat$1.blending = 5;
         Self.Mat$1.blendSrc = 204;
         Self.Mat$1.blendDst = 205;
      }
      Self.Mesh$3 = new THREE.Mesh(geo,Self.Mat$1);
      Self.Mesh$3.frustumCulled = false;
      Self.Mesh$3.renderOrder = (additive)?11:10;
      scene$1.add(Self.Mesh$3);
      Self.FGeo = geo;
      return Self
   }
   /// function TParticleSystem.Spawn(pos: JVector3; vel: JVector3; life: Float) : TParticle
   ,Spawn:function(Self, pos$4, vel, life) {
      var Result = null;
      var q$3 = null;
      if (Self.P$2.length >= Self.FMax) {
         Self.P$2.shift();
      }
      q$3 = TObject.Create($New(TParticle));
      q$3.Pos$6 = pos$4.clone();
      q$3.Vel$2 = (vel)?vel.clone():V3Zero();
      q$3.Life = (life != 0)?life:1;
      q$3.S0 = 1;
      q$3.S1 = 1;
      q$3.Rot$1 = Math.random() * 3.14159265358979 * 2;
      q$3.A0 = 1;
      q$3.A1 = 0;
      q$3.R0 = 1;
      q$3.G0 = 1;
      q$3.B0 = 1;
      Self.P$2.push(q$3);
      Result = q$3;
      return Result
   }
   /// procedure TParticleSystem.Update(dt: Float; camera: JCamera)
   ,Update$5:function(Self, dt$1, camera$2) {
      var q$3 = null,
         cp = null,
         a$198 = 0,
         q$4 = null,
         pos$4 = null,
         dat = null,
         col$2 = null,
         vel = null,
         q$5 = null,
         t$6 = 0,
         a$119 = 0;
      for(let i$2=Self.P$2.length - 1;i$2>=0;i$2--) {
         q$3 = Self.P$2[i$2];
         q$3.Age += dt$1;
         if (q$3.Age >= q$3.Life) {
            Self.P$2.splice(i$2,1)
            ;
            continue;
         }
         q$3.Vel$2.y -= q$3.Grav * dt$1;
         if (q$3.Drag != 0) {
            q$3.Vel$2.multiplyScalar(MaxF(0,1 - q$3.Drag * dt$1));
         }
         q$3.Pos$6.addScaledVector(q$3.Vel$2,dt$1);
         if (q$3.Bounce$1 && q$3.Pos$6.y < 0.02) {
            q$3.Pos$6.y = 0.02;
            q$3.Vel$2.y *= -0.35;
            q$3.Vel$2.x *= 0.6;
            q$3.Vel$2.z *= 0.6;
         }
         q$3.Rot$1 += q$3.RotVel * dt$1;
      }
      if (Self.FSort && !!camera$2) {
         var a$199 = [];
         cp = camera$2.position;
         a$199 = Self.P$2;
         var $temp65;
         for(a$198=0,$temp65=a$199.length;a$198<$temp65;a$198++) {
            q$4 = a$199[a$198];
            q$4.D$1 = q$4.Pos$6.distanceToSquared(cp);
         }
         Self.P$2.sort(function (a$120, b$7) {
            var Result = 0;
            Result = (b$7.D$1 > a$120.D$1)?1:(b$7.D$1 < a$120.D$1)?-1:0;
            return Result
         });
      }
      pos$4 = Self.FPos;
      dat = Self.FDat;
      col$2 = Self.FCol;
      vel = Self.FVel$1;
      for(let i$3=0,$temp66=Self.P$2.length;i$3<$temp66;i$3++) {
         q$5 = Self.P$2[i$3];
         t$6 = q$5.Age / q$5.Life;
         pos$4[(i$3 * 3)]=q$5.Pos$6.x;
         pos$4[(i$3 * 3 + 1)]=q$5.Pos$6.y;
         pos$4[(i$3 * 3 + 2)]=q$5.Pos$6.z;
         vel[(i$3 * 3)]=q$5.Vel$2.x;
         vel[(i$3 * 3 + 1)]=q$5.Vel$2.y;
         vel[(i$3 * 3 + 2)]=q$5.Vel$2.z;
         a$119 = q$5.A0 + (q$5.A1 - q$5.A0) * t$6;
         if (q$5.FadeIn > 0 && t$6 < q$5.FadeIn) {
            a$119 *= t$6 / q$5.FadeIn;
         }
         dat[(i$3*4)]=(q$5.S0 + (q$5.S1 - q$5.S0) * Sqrt(t$6));
         dat[((i$3*4) + 1)]=q$5.Rot$1;
         dat[((i$3*4) + 2)]=a$119;
         dat[((i$3*4) + 3)]=q$5.Stretch;
         if (q$5.HasC1) {
            col$2[(i$3 * 3)]=(q$5.R0 + (q$5.R1 - q$5.R0) * t$6);
            col$2[(i$3 * 3 + 1)]=(q$5.G0 + (q$5.G1 - q$5.G0) * t$6);
            col$2[(i$3 * 3 + 2)]=(q$5.B0 + (q$5.B1 - q$5.B0) * t$6);
         } else {
            col$2[(i$3 * 3)]=q$5.R0;
            col$2[(i$3 * 3 + 1)]=q$5.G0;
            col$2[(i$3 * 3 + 2)]=q$5.B0;
         }
      }
      Self.FGeo.instanceCount = Self.P$2.length;
      Self.FAPos.needsUpdate = true;
      Self.FAData.needsUpdate = true;
      Self.FACol.needsUpdate = true;
      Self.FAVel.needsUpdate = true;
      Self.FAPos.clearUpdateRanges();
   }
   ,Destroy:TObject.Destroy
};
/// TParticle = class (TObject)
var TParticle = {
   $ClassName:"TParticle",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.A0 = $.A1 = $.Age = $.B0 = $.B1 = $.D$1 = $.Drag = $.FadeIn = $.G0 = $.G1 = $.Grav = $.Life = $.R0 = $.R1 = $.Rot$1 = $.RotVel = $.S0 = $.S1 = $.Stretch = 0;
      $.Bounce$1 = $.HasC1 = false;
      $.Pos$6 = $.Vel$2 = null;
   }
   /// function TParticle.SetAlpha(a: Float; b: Float) : TParticle
   ,SetAlpha:function(Self, a$119, b$7) {
      var Result = null;
      Self.A0 = a$119;
      Self.A1 = b$7;
      Result = Self;
      return Result
   }
   /// function TParticle.SetBounce() : TParticle
   ,SetBounce:function(Self) {
      var Result = null;
      Self.Bounce$1 = true;
      Result = Self;
      return Result
   }
   /// function TParticle.SetColor(r: Float; g: Float; b: Float) : TParticle
   ,SetColor:function(Self, r$3, g$11, b$7) {
      var Result = null;
      Self.R0 = r$3;
      Self.G0 = g$11;
      Self.B0 = b$7;
      Result = Self;
      return Result
   }
   /// function TParticle.SetColor1(r: Float; g: Float; b: Float) : TParticle
   ,SetColor1:function(Self, r$3, g$11, b$7) {
      var Result = null;
      Self.R1 = r$3;
      Self.G1 = g$11;
      Self.B1 = b$7;
      Self.HasC1 = true;
      Result = Self;
      return Result
   }
   /// function TParticle.SetDrag(v: Float) : TParticle
   ,SetDrag:function(Self, v$3) {
      var Result = null;
      Self.Drag = v$3;
      Result = Self;
      return Result
   }
   /// function TParticle.SetFadeIn(v: Float) : TParticle
   ,SetFadeIn:function(Self, v$3) {
      var Result = null;
      Self.FadeIn = v$3;
      Result = Self;
      return Result
   }
   /// function TParticle.SetGravity(v: Float) : TParticle
   ,SetGravity:function(Self, v$3) {
      var Result = null;
      Self.Grav = v$3;
      Result = Self;
      return Result
   }
   /// function TParticle.SetRotVel(v: Float) : TParticle
   ,SetRotVel:function(Self, v$3) {
      var Result = null;
      Self.RotVel = v$3;
      Result = Self;
      return Result
   }
   /// function TParticle.SetSize(a: Float; b: Float) : TParticle
   ,SetSize:function(Self, a$119, b$7) {
      var Result = null;
      Self.S0 = a$119;
      Self.S1 = b$7;
      Result = Self;
      return Result
   }
   /// function TParticle.SetStretch(v: Float) : TParticle
   ,SetStretch:function(Self, v$3) {
      var Result = null;
      Self.Stretch = v$3;
      Result = Self;
      return Result
   }
   ,Destroy:TObject.Destroy
};
/// TFlashLight = class (TObject)
var TFlashLight = {
   $ClassName:"TFlashLight",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Dur = $.Peak = $.T$4 = 0;
      $.Light = null;
   }
   ,Destroy:TObject.Destroy
};
/// TFireLight = class (TObject)
var TFireLight = {
   $ClassName:"TFireLight",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Base = $.Seed = 0;
      $.Light$1 = null;
   }
   ,Destroy:TObject.Destroy
};
/// TEmitter = class (TObject)
var TEmitter = {
   $ClassName:"TEmitter",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Acc = $.GAcc = $.Scale$1 = 0;
      $.Kind = "";
      $.Pos$7 = null;
   }
   ,Destroy:TObject.Destroy
};
/// TEffects = class (TObject)
var TEffects = {
   $ClassName:"TEffects",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Blood = $.Dust = $.FAudio$2 = $.FDm = $.FDp = $.FDq = $.FDs = $.Fire$2 = $.FScene$1 = $.FWorld$3 = $.Glow = $.Motes = $.Smoke = $.Sparks = null;
      $.Chunks = [];
      $.FDecalSets = {};
      $.FEmitters = [];
      $.FFireLights = [];
      $.FlashLights = [];
      $.FTime = 0;
      $.Shells = [];
      $.Tracers = [];
   }
   /// procedure TEffects.AddFire(pos: JVector3; scale: Float; withLight: Boolean)
   ,AddFire:function(Self, pos$4, scale$2, withLight) {
      var e$1 = null,
         l = null,
         f$3 = null;
      e$1 = TObject.Create($New(TEmitter));
      e$1.Kind = "fire";
      e$1.Pos$7 = pos$4.clone();
      e$1.Scale$1 = scale$2;
      Self.FEmitters.push(e$1);
      if (withLight && Self.FFireLights.length < 3) {
         l = new THREE.PointLight(16742960,30 * scale$2,16 * scale$2,2);
         l.position.copy(pos$4).add(V3(0,0.6,0));
         Self.FScene$1.add(l);
         f$3 = TObject.Create($New(TFireLight));
         f$3.Light$1 = l;
         f$3.Base = 30 * scale$2;
         f$3.Seed = Math.random() * 100;
         Self.FFireLights.push(f$3);
      }
   }
   /// procedure TEffects.AddPlume(pos: JVector3)
   ,AddPlume:function(Self, pos$4) {
      var e$1 = null;
      e$1 = TObject.Create($New(TEmitter));
      e$1.Kind = "plume";
      e$1.Pos$7 = pos$4.clone();
      Self.FEmitters.push(e$1);
   }
   /// procedure TEffects.BloodHit(point: JVector3; dir: JVector3)
   ,BloodHit:function(Self, point, dir) {
      var h$4 = null;
      for(let i$2=0;i$2<=5;i$2++) {
         _v.copy(dir).multiplyScalar(1 + Math.random() * 2.5).add(_v2.set(Math.random() - 0.5,Math.random() * 0.8,Math.random() - 0.5).multiplyScalar(1.6));
         TParticle.SetDrag(TParticle.SetGravity(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Blood,point,_v,0.35 + Math.random() * 0.4),0.08,0.35),0.95,0),0.55,0.05,0.03),4),2);
      }
      h$4 = TWorld.Raycast(Self.FWorld$3,point,dir,2.5);
      if (h$4) {
         TEffects.Decal(Self,h$4.Point,h$4.Normal,"blood",0.5 + Math.random() * 0.4);
      }
   }
   /// constructor TEffects.Create(scene: JScene; world: TWorld; audio: TAudio)
   ,Create$84:function(Self, scene$1, world$1, audio) {
      var smokeTex = null,
         decalGeo = null,
         kinds = [],
         texs = [],
         ops = [],
         maxs = [],
         mat$1 = null,
         im = null,
         ds = null,
         tracerMat = null,
         tracerGeo = null,
         m$3 = null,
         t$6 = null,
         brass = null,
         shellGeo = null,
         m$4 = null,
         s$6 = null,
         chunkMat = null,
         chunkGeo = null,
         m$5 = null,
         c$12 = null,
         l = null,
         f$3 = null;
      Self.FScene$1 = scene$1;
      Self.FWorld$3 = world$1;
      Self.FAudio$2 = audio;
      smokeTex = SpriteTex("smoke");
      Self.Smoke = TParticleSystem.Create$83($New(TParticleSystem),scene$1,smokeTex,900,false,true,1);
      Self.Dust = TParticleSystem.Create$83($New(TParticleSystem),scene$1,smokeTex,500,false,false,1);
      Self.Fire$2 = TParticleSystem.Create$83($New(TParticleSystem),scene$1,SpriteTex("fire"),500,true,false,0.4);
      Self.Sparks = TParticleSystem.Create$83($New(TParticleSystem),scene$1,SpriteTex("spark"),600,true,false,0.2);
      Self.Blood = TParticleSystem.Create$83($New(TParticleSystem),scene$1,SpriteTex("blood"),300,false,false,1);
      Self.Glow = TParticleSystem.Create$83($New(TParticleSystem),scene$1,SpriteTex("glow"),200,true,false,0.3);
      Self.Motes = TParticleSystem.Create$83($New(TParticleSystem),scene$1,SpriteTex("glow"),400,true,false,0.6);
      decalGeo = new THREE.PlaneGeometry(1,1);
      kinds = ["hole", "blood", "scorch"];
      texs = [SpriteTex("hole"), SpriteTex("blood"), SpriteTex("scorch")];
      ops = [1, 0.9, 0.95];
      maxs = [300, 80, 24];
      for(let k$8=0;k$8<=2;k$8++) {
         mat$1 = new THREE.MeshStandardMaterial({
            "transparent" : true
            ,"roughness" : 0.9
            ,"polygonOffsetUnits" : -4
            ,"polygonOffsetFactor" : -4
            ,"polygonOffset" : true
            ,"opacity" : ops[k$8]
            ,"map" : texs[k$8]
            ,"depthWrite" : false
         });
         im = new THREE.InstancedMesh(decalGeo,mat$1,maxs[k$8]);
         im.count = 0;
         im.frustumCulled = false;
         im.receiveShadow = true;
         im.userData.noAO = true;
         im.instanceMatrix.setUsage(35048);
         scene$1.add(im);
         ds = TObject.Create($New(TDecalSet));
         ds.Im = im;
         ds.Max$3 = maxs[k$8];
         ds.Next = 0;
         Self.FDecalSets[kinds[k$8]]=ds;
      }
      Self.FDm = new THREE.Matrix4();
      Self.FDq = new THREE.Quaternion();
      Self.FDs = V3Zero();
      Self.FDp = V3Zero();
      tracerMat = new THREE.MeshBasicMaterial({
         "transparent" : true
         ,"opacity" : 0.9
         ,"depthWrite" : false
         ,"color" : Col(6,4.2,2)
         ,"blending" : 2
      });
      tracerGeo = new THREE.BoxGeometry(0.018,0.018,1);
      for(let i$2=0;i$2<=39;i$2++) {
         m$3 = new THREE.Mesh(tracerGeo,tracerMat);
         m$3.visible = false;
         m$3.frustumCulled = false;
         scene$1.add(m$3);
         t$6 = TObject.Create($New(TTracer));
         t$6.Mesh$2 = m$3;
         Self.Tracers.push(t$6);
      }
      brass = new THREE.MeshStandardMaterial({
         "roughness" : 0.3
         ,"metalness" : 1
         ,"color" : 13148240
      });
      shellGeo = new THREE.CylinderGeometry(0.0055,0.0055,0.045,8);
      shellGeo.rotateX(1.5707963267949);
      for(let i$3=0;i$3<=29;i$3++) {
         m$4 = new THREE.Mesh(shellGeo,brass);
         m$4.visible = false;
         m$4.castShadow = true;
         scene$1.add(m$4);
         s$6 = TObject.Create($New(TDebris));
         s$6.Mesh$4 = m$4;
         s$6.Vel$3 = V3Zero();
         s$6.Spin = V3Zero();
         Self.Shells.push(s$6);
      }
      chunkMat = new THREE.MeshStandardMaterial({
         "roughness" : 0.95
         ,"color" : 7827561
      });
      chunkGeo = new THREE.DodecahedronGeometry(1,0);
      for(let i$4=0;i$4<=59;i$4++) {
         m$5 = new THREE.Mesh(chunkGeo,chunkMat);
         m$5.visible = false;
         m$5.castShadow = true;
         scene$1.add(m$5);
         c$12 = TObject.Create($New(TDebris));
         c$12.Mesh$4 = m$5;
         c$12.Vel$3 = V3Zero();
         c$12.Spin = V3Zero();
         Self.Chunks.push(c$12);
      }
      for(let i$5=0;i$5<=2;i$5++) {
         l = new THREE.PointLight(16756832,0,14,2);
         scene$1.add(l);
         f$3 = TObject.Create($New(TFlashLight));
         f$3.Light = l;
         f$3.Dur = 0.05;
         Self.FlashLights.push(f$3);
      }
      return Self
   }
   /// procedure TEffects.Decal(point: JVector3; normal: JVector3; kind: String = 'hole'; size: Float = 0,12)
   ,Decal:function(Self, point, normal$2, kind, size) {
      var ds = null,
         i$2 = 0;
      ds = (Self.FDecalSets[kind]||null);
      i$2 = ds.Next;
      ds.Next = (ds.Next + 1) % ds.Max$3;
      ds.Im.count = Max$_Integer_Integer_(ds.Im.count,i$2 + 1);
      Self.FDp.copy(point).addScaledVector(normal$2,0.004 + Math.random() * 0.003);
      Self.FDq.setFromUnitVectors(_z,normal$2);
      _q$1.setFromAxisAngle(_z,Math.random() * 3.14159265358979 * 2);
      Self.FDq.multiply(_q$1);
      Self.FDs.setScalar(size * (0.8 + Math.random() * 0.4));
      Self.FDm.compose(Self.FDp,Self.FDq,Self.FDs);
      ds.Im.setMatrixAt(i$2,Self.FDm);
      ds.Im.instanceMatrix.needsUpdate = true;
   }
   /// procedure TEffects.EjectShell(pos: JVector3; vel: JVector3; quat: JQuaternion)
   ,EjectShell:function(Self, pos$4, vel, quat$2) {
      var s$6 = null,
         a$200 = 0,
         x$5 = null,
         a$201 = [];
      s$6 = Self.Shells[0];
      a$201 = Self.Shells;
      var $temp67;
      for(a$200=0,$temp67=a$201.length;a$200<$temp67;a$200++) {
         x$5 = a$201[a$200];
         if (!(x$5.Active$1)) {
            s$6 = x$5;
            break;
         }
      }
      s$6.Active$1 = true;
      s$6.Age$1 = 0;
      s$6.Bounced = 0;
      s$6.Mesh$4.visible = true;
      s$6.Mesh$4.position.copy(pos$4);
      s$6.Mesh$4.quaternion.copy(quat$2);
      s$6.Vel$3.copy(vel);
      s$6.Spin.set((Math.random() - 0.5) * 30,(Math.random() - 0.5) * 30,(Math.random() - 0.5) * 30);
   }
   /// procedure TEffects.Explosion(pos: JVector3)
   ,Explosion$1:function(Self, pos$4) {
      var c$12 = null,
         a$202 = 0,
         x$5 = null,
         a$119 = 0;
      TEffects.Flash$1(Self,pos$4.clone().add(_v.set(0,1,0)),900,0.35,16752720,40);
      for(let i$2=0;i$2<=39;i$2++) {
         _v.set(Math.random() - 0.5,Math.random() * 0.9,Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 8);
         TParticle.SetGravity(TParticle.SetDrag(TParticle.SetColor1(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Fire$2,pos$4.clone().add(_v2.set(0,0.3,0)),_v,0.35 + Math.random() * 0.4),0.6,2.2 + Math.random() * 1.2),1,0),3,1.5,0.6),1.2,0.3,0.05),5),-2);
      }
      for(let i$3=0;i$3<=25;i$3++) {
         _v.set(Math.random() - 0.5,Math.random() * 0.8 + 0.2,Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 4);
         TParticle.SetRotVel(TParticle.SetGravity(TParticle.SetDrag(TParticle.SetColor1(TParticle.SetColor(TParticle.SetFadeIn(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Smoke,pos$4.clone().add(_v2.set(0,0.5,0)),_v,4 + Math.random() * 3),0.8,4 + Math.random() * 2.5),0.75,0),0.05),0.28,0.26,0.24),0.55,0.52,0.48),1.6),-0.35),(Math.random() - 0.5) * 0.6);
      }
      for(let i$4=0;i$4<=49;i$4++) {
         _v.set(Math.random() - 0.5,Math.random() * 0.9 + 0.1,Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 16);
         TParticle.SetDrag(TParticle.SetStretch(TParticle.SetGravity(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Sparks,pos$4.clone().add(_v2.set(0,0.3,0)),_v,0.5 + Math.random() * 0.8),0.03,0.01),1,0.4),4,2.2,0.8),9.8),2.5),0.6);
      }
      for(let i$5=0;i$5<=15;i$5++) {
         var a$203 = [];
         c$12 = Self.Chunks[i$5];
         a$203 = Self.Chunks;
         var $temp68;
         for(a$202=0,$temp68=a$203.length;a$202<$temp68;a$202++) {
            x$5 = a$203[a$202];
            if (!(x$5.Active$1)) {
               c$12 = x$5;
               break;
            }
         }
         c$12.Active$1 = true;
         c$12.Age$1 = 0;
         c$12.Mesh$4.visible = true;
         c$12.Mesh$4.position.copy(pos$4).add(_v.set(0,0.2,0));
         c$12.Mesh$4.scale.setScalar(0.03 + Math.random() * 0.08);
         c$12.Vel$3.set(Math.random() - 0.5,Math.random() * 0.8 + 0.4,Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 9);
         c$12.Spin.set(Math.random() * 20,Math.random() * 20,Math.random() * 20);
      }
      for(let i$6=0;i$6<=17;i$6++) {
         a$119 = i$6 / 18 * 3.14159265358979 * 2;
         TParticle.SetDrag(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Dust,pos$4.clone().add(_v2.set(0,0.2,0)),_v.set(Cos(a$119) * 9,0.4,Sin(a$119) * 9),2.2),0.5,2.8),0.55,0),0.6,0.55,0.47),2.5);
      }
      TEffects.Decal(Self,pos$4.clone().setY(MaxF(pos$4.y,0) + 0.01),V3(0,1,0),"scorch",3.5);
   }
   /// procedure TEffects.Flash(pos: JVector3; peak: Float = 40; dur: Float = 0,06; color: Integer = 16756832; dist: Float = 14)
   ,Flash$1:function(Self, pos$4, peak, dur, color$8, dist) {
      var best = null,
         a$204 = 0,
         f$3 = null,
         a$205 = [];
      best = Self.FlashLights[0];
      a$205 = Self.FlashLights;
      var $temp69;
      for(a$204=0,$temp69=a$205.length;a$204<$temp69;a$204++) {
         f$3 = a$205[a$204];
         if (f$3.T$4 >= f$3.Dur) {
            best = f$3;
            break;
         }
      }
      best.Light.position.copy(pos$4);
      best.Light.color.set(color$8);
      best.Light.distance = dist;
      best.T$4 = 0;
      best.Dur = dur;
      best.Peak = peak;
   }
   /// function TEffects.FloorAt(p: JVector3) : Float
   ,FloorAt:function(Self, p$3) {
      var Result = 0;
      var y$5 = 0,
         a$206 = 0,
         c$12 = null,
         a$207 = [];
      y$5 = 0;
      a$207 = Self.FWorld$3.Colliders;
      var $temp70;
      for(a$206=0,$temp70=a$207.length;a$206<$temp70;a$206++) {
         c$12 = a$207[a$206];
         if (p$3.x < c$12.Min$2.x || p$3.x > c$12.Max$2.x || p$3.z < c$12.Min$2.z || p$3.z > c$12.Max$2.z) {
            continue;
         }
         if (c$12.Max$2.y <= p$3.y + 0.05 && c$12.Max$2.y > y$5) {
            y$5 = c$12.Max$2.y;
         }
      }
      Result = y$5;
      return Result
   }
   /// procedure TEffects.Impact(point: JVector3; normal: JVector3; surf: String; dir: JVector3)
   ,Impact$1:function(Self, point, normal$2, surf, dir) {
      var refl = null,
         br$1 = 0,
         bg = 0,
         bb = 0,
         chips = 0,
         sparkCount = 0;
      refl = dir.clone().reflect(normal$2);
      {var $temp71 = surf;
         if ($temp71=="concrete") {
            br$1 = 0.62;
            bg = 0.6;
            bb = 0.56;
         }
          else if ($temp71=="asphalt") {
            br$1 = 0.3;
            bg = 0.29;
            bb = 0.28;
         }
          else if ($temp71=="metal") {
            br$1 = 0.4;
            bg = 0.4;
            bb = 0.4;
         }
          else if ($temp71=="wood") {
            br$1 = 0.55;
            bg = 0.42;
            bb = 0.28;
         }
          else if ($temp71=="cloth") {
            br$1 = 0.6;
            bg = 0.53;
            bb = 0.38;
         }
          else if ($temp71=="dirt") {
            br$1 = 0.45;
            bg = 0.38;
            bb = 0.28;
         }
          else {
            br$1 = 0.6;
            bg = 0.58;
            bb = 0.54;
         }
      }
      for(let i$2=0;i$2<=4;i$2++) {
         _v.copy(normal$2).multiplyScalar(1 + Math.random() * 2).add(refl.clone().multiplyScalar(Math.random())).add(_v2.set(Math.random() - 0.5,Math.random() - 0.3,Math.random() - 0.5).multiplyScalar(0.8));
         TParticle.SetRotVel(TParticle.SetGravity(TParticle.SetDrag(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Dust,point,_v,0.9 + Math.random() * 0.9),0.05,0.45 + Math.random() * 0.4),0.55,0),br$1 * 1.3,bg * 1.3,bb * 1.3),3.5),-0.15),(Math.random() - 0.5) * 1.2);
      }
      chips = (surf == "metal")?0:5;
      for(let i$3=0,$temp72=chips;i$3<$temp72;i$3++) {
         _v.copy(normal$2).multiplyScalar(2 + Math.random() * 3).add(_v2.set(Math.random() - 0.5,Math.random(),Math.random() - 0.5).multiplyScalar(3));
         TParticle.SetBounce(TParticle.SetDrag(TParticle.SetGravity(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Dust,point,_v,0.6),0.02,0.015),1,1),br$1 * 0.5,bg * 0.5,bb * 0.5),9.8),0.5));
      }
      sparkCount = (surf == "metal")?12:(surf == "concrete" || surf == "asphalt")?3:0;
      for(let i$4=0,$temp73=sparkCount;i$4<$temp73;i$4++) {
         _v.copy(refl).multiplyScalar(3 + Math.random() * 6).add(_v2.set(Math.random() - 0.5,Math.random() - 0.2,Math.random() - 0.5).multiplyScalar(5));
         TParticle.SetStretch(TParticle.SetGravity(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Sparks,point,_v,0.15 + Math.random() * 0.3),0.012,0.006),1,0.2),4,2.4,1),9.8),3);
      }
      if (surf == "metal") {
         TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Glow,point.clone().addScaledVector(normal$2,0.02),null,0.06),0.25,0.1),1,0),4,2.8,1.5);
      }
      TEffects.Decal(Self,point,normal$2,"hole",(surf == "metal")?0.07:0.12);
   }
   /// procedure TEffects.MuzzleSmoke(pos: JVector3; dir: JVector3)
   ,MuzzleSmoke:function(Self, pos$4, dir) {
      if (Math.random() < 0.5) {
         TParticle.SetDrag(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Smoke,pos$4,dir.clone().multiplyScalar(0.6 + Math.random()).add(_v.set(0,0.3,0)),0.7 + Math.random() * 0.5),0.04,0.3),0.08,0),0.45,0.44,0.42),2);
      }
   }
   /// procedure TEffects.SetFog(color: JColor)
   ,SetFog:function(Self, color$8) {
      var a$208 = 0,
         s$6 = null,
         a$209 = [];
      a$209 = TEffects.Systems(Self);
      var $temp74;
      for(a$208=0,$temp74=a$209.length;a$208<$temp74;a$208++) {
         s$6 = a$209[a$208];
         s$6.Mat$1.uniforms["fogColor"].value.copy(color$8);
      }
   }
   /// function TEffects.Systems() : 
   ,Systems:function(Self) {
      var Result = [];
      Result = [Self.Smoke, Self.Dust, Self.Fire$2, Self.Sparks, Self.Blood, Self.Glow, Self.Motes];
      return Result
   }
   /// procedure TEffects.Tracer(from: JVector3; dest: JVector3; speed: Float = 380)
   ,Tracer:function(Self, from, dest, speed) {
      var t$6 = null,
         a$210 = 0,
         x$5 = null,
         a$211 = [];
      t$6 = Self.Tracers[0];
      a$211 = Self.Tracers;
      var $temp75;
      for(a$210=0,$temp75=a$211.length;a$210<$temp75;a$210++) {
         x$5 = a$211[a$210];
         if (!(x$5.Active)) {
            t$6 = x$5;
            break;
         }
      }
      t$6.Active = true;
      t$6.From$1 = from.clone();
      t$6.Dest = dest.clone();
      t$6.Len = from.distanceTo(dest);
      t$6.Dist = 0;
      t$6.Speed$1 = speed;
      t$6.Dir$1 = dest.clone().sub(from).normalize();
      t$6.Mesh$2.visible = true;
      t$6.Mesh$2.quaternion.setFromUnitVectors(_z,t$6.Dir$1);
   }
   /// procedure TEffects.Update(dt: Float; camera: JCamera)
   ,Update$6:function(Self, dt$1, camera$2) {
      var a$212 = 0,
         e$1 = null,
         s$6 = 0,
         r$3 = 0,
         cp = null,
         a$213 = 0,
         f$3 = null,
         k$8 = 0,
         a$214 = 0,
         f$4 = null,
         t$6 = 0,
         a$215 = 0,
         t$7 = null,
         segLen = 0,
         head = 0,
         tail = 0,
         mid = 0,
         a$216 = 0,
         s$7 = null,
         fl = 0,
         a$217 = 0,
         c$12 = null,
         fl$1 = 0,
         a$218 = [],
         a$219 = [],
         a$220 = [],
         a$221 = [],
         a$222 = [],
         a$223 = [];
      Self.FTime += dt$1;
      a$218 = Self.FEmitters;
      var $temp76;
      for(a$212=0,$temp76=a$218.length;a$212<$temp76;a$212++) {
         e$1 = a$218[a$212];
         if (e$1.Kind == "fire") {
            e$1.Acc += dt$1 * 110 * e$1.Scale$1;
            e$1.GAcc += dt$1;
            if (e$1.GAcc > 0.06) {
               e$1.GAcc = 0;
               TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Glow,e$1.Pos$7.clone().add(_v2.set(0,0.35 * e$1.Scale$1,0)),null,0.12),1.9 * e$1.Scale$1,2.1 * e$1.Scale$1),0.22 + Math.random() * 0.08,0.2),2.2,0.9,0.3);
            }
            while (e$1.Acc > 1) {
               e$1.Acc -= 1;
               s$6 = e$1.Scale$1;
               _v2.set((Math.random() - 0.5) * 0.7 * s$6,0,(Math.random() - 0.5) * 0.7 * s$6);
               r$3 = Math.random();
               _v2.multiplyScalar(0.6 + (1 - r$3) * 0.6);
               TParticle.SetDrag(TParticle.SetRotVel(TParticle.SetColor1(TParticle.SetColor(TParticle.SetFadeIn(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Fire$2,e$1.Pos$7.clone().add(_v2),_v.set((Math.random() - 0.5) * 0.4,0.9 + r$3 * 2.2,(Math.random() - 0.5) * 0.4).multiplyScalar(s$6),0.3 + Math.random() * 0.5),(0.16 + Math.random() * 0.16) * s$6,0.03 * s$6),0.55,0),0.15),3.6,1.7,0.55),1.6,0.32,0.04),(Math.random() - 0.5) * 4),0.8);
               if (Math.random() < 0.13) {
                  TParticle.SetRotVel(TParticle.SetDrag(TParticle.SetColor1(TParticle.SetColor(TParticle.SetFadeIn(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Smoke,e$1.Pos$7.clone().add(_v2).add(_v.set(0,1 * s$6,0)),_v.set(0.35 + Math.random() * 0.3,1.4 + Math.random(),0.1).multiplyScalar(s$6),5 + Math.random() * 3),0.4 * s$6,3.2 * s$6),0.55,0),0.1),0.09,0.085,0.08),0.32,0.3,0.28),0.25),(Math.random() - 0.5) * 0.4);
               }
               if (Math.random() < 0.08) {
                  TParticle.SetStretch(TParticle.SetDrag(TParticle.SetGravity(TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Sparks,e$1.Pos$7.clone().add(_v2),_v.set((Math.random() - 0.5) * 1.5,2 + Math.random() * 2.5,(Math.random() - 0.5) * 1.5),1.2 + Math.random()),0.012,0.005),1,0),3,1.4,0.4),-0.2),0.5),1);
               }
            }
         } else if (e$1.Kind == "plume") {
            e$1.Acc += dt$1 * 5;
            while (e$1.Acc > 1) {
               e$1.Acc -= 1;
               TParticle.SetRotVel(TParticle.SetDrag(TParticle.SetColor1(TParticle.SetColor(TParticle.SetFadeIn(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(Self.Smoke,e$1.Pos$7.clone().add(_v2.set((Math.random() - 0.5) * 6,Math.random() * 4,(Math.random() - 0.5) * 6)),_v.set(1.8 + Math.random(),3.5 + Math.random() * 2,0.4),22),6,34),0.5,0),0.05),0.14,0.13,0.12),0.5,0.47,0.44),0.02),(Math.random() - 0.5) * 0.1);
            }
         }
      }
      if (!!camera$2 && Math.random() < dt$1 * 30) {
         cp = camera$2.position;
         TParticle.SetFadeIn(TParticle.SetAlpha(TParticle.SetColor(TParticle.SetSize(TParticleSystem.Spawn(Self.Motes,_v.set(cp.x + (Math.random() - 0.5) * 16,cp.y + Math.random() * 5 - 1,cp.z + (Math.random() - 0.5) * 16),_v2.set(0.25 + Math.random() * 0.2,-0.08,(Math.random() - 0.5) * 0.2),7),0.012,0.012),1.6,1.3,0.9),0.7,0),0.2);
      }
      a$223 = Self.FlashLights;
      var $temp77;
      for(a$213=0,$temp77=a$223.length;a$213<$temp77;a$213++) {
         f$3 = a$223[a$213];
         f$3.T$4 += dt$1;
         k$8 = (f$3.T$4 < f$3.Dur)?1 - f$3.T$4 / f$3.Dur:0;
         f$3.Light.intensity = f$3.Peak * k$8 * k$8;
      }
      a$222 = Self.FFireLights;
      var $temp78;
      for(a$214=0,$temp78=a$222.length;a$214<$temp78;a$214++) {
         f$4 = a$222[a$214];
         t$6 = Self.FTime * 9 + f$4.Seed;
         f$4.Light$1.intensity = f$4.Base * (0.75 + 0.18 * Sin(t$6) + 0.12 * Sin(t$6 * 2.7 + 1.3) + 0.08 * Math.random());
      }
      a$221 = Self.Tracers;
      var $temp79;
      for(a$215=0,$temp79=a$221.length;a$215<$temp79;a$215++) {
         t$7 = a$221[a$215];
         if (!(t$7.Active)) {
            continue;
         }
         t$7.Dist += t$7.Speed$1 * dt$1;
         segLen = MinF(4,t$7.Len);
         if (t$7.Dist - segLen > t$7.Len) {
            t$7.Active = false;
            t$7.Mesh$2.visible = false;
            continue;
         }
         head = MinF(t$7.Dist,t$7.Len);
         tail = MaxF(0,t$7.Dist - segLen);
         mid = (head + tail) / 2;
         t$7.Mesh$2.position.copy(t$7.From$1).addScaledVector(t$7.Dir$1,mid);
         t$7.Mesh$2.scale.set(1,1,MaxF(0.01,head - tail));
      }
      a$220 = Self.Shells;
      var $temp80;
      for(a$216=0,$temp80=a$220.length;a$216<$temp80;a$216++) {
         s$7 = a$220[a$216];
         if (!(s$7.Active$1)) {
            continue;
         }
         s$7.Age$1 += dt$1;
         s$7.Vel$3.y -= 9.8 * dt$1;
         s$7.Mesh$4.position.addScaledVector(s$7.Vel$3,dt$1);
         s$7.Mesh$4.rotation.x += s$7.Spin.x * dt$1;
         s$7.Mesh$4.rotation.y += s$7.Spin.y * dt$1;
         s$7.Mesh$4.rotation.z += s$7.Spin.z * dt$1;
         fl = TEffects.FloorAt(Self,s$7.Mesh$4.position);
         if (s$7.Mesh$4.position.y < fl + 0.006) {
            s$7.Mesh$4.position.y = fl + 0.006;
            if (Abs$_Float_(s$7.Vel$3.y) > 0.6) {
               if (s$7.Bounced < 2 && !!Self.FAudio$2) {
                  TAudio.Shell(Self.FAudio$2,s$7.Mesh$4.position);
               }
               s$7.Bounced += 1;
            }
            s$7.Vel$3.y = Abs$_Float_(s$7.Vel$3.y) * 0.3;
            s$7.Vel$3.x *= 0.5;
            s$7.Vel$3.z *= 0.5;
            s$7.Spin.multiplyScalar(0.5);
            if (s$7.Vel$3.y < 0.2) {
               s$7.Vel$3.set(0,0,0);
               s$7.Spin.set(0,0,0);
               s$7.Mesh$4.rotation.x = 0;
            }
         }
         if (s$7.Age$1 > 6) {
            s$7.Active$1 = false;
            s$7.Mesh$4.visible = false;
         }
      }
      a$219 = Self.Chunks;
      var $temp81;
      for(a$217=0,$temp81=a$219.length;a$217<$temp81;a$217++) {
         c$12 = a$219[a$217];
         if (!(c$12.Active$1)) {
            continue;
         }
         c$12.Age$1 += dt$1;
         c$12.Vel$3.y -= 9.8 * dt$1;
         c$12.Mesh$4.position.addScaledVector(c$12.Vel$3,dt$1);
         c$12.Mesh$4.rotation.x += c$12.Spin.x * dt$1;
         c$12.Mesh$4.rotation.y += c$12.Spin.y * dt$1;
         fl$1 = TEffects.FloorAt(Self,c$12.Mesh$4.position);
         if (c$12.Mesh$4.position.y < fl$1 + c$12.Mesh$4.scale.x * 0.5) {
            c$12.Mesh$4.position.y = fl$1 + c$12.Mesh$4.scale.x * 0.5;
            c$12.Vel$3.y *= -0.3;
            c$12.Vel$3.x *= 0.6;
            c$12.Vel$3.z *= 0.6;
            c$12.Spin.multiplyScalar(0.6);
         }
         if (c$12.Age$1 > 8) {
            c$12.Active$1 = false;
            c$12.Mesh$4.visible = false;
         }
      }
      TParticleSystem.Update$5(Self.Smoke,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Dust,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Fire$2,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Sparks,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Blood,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Glow,dt$1,camera$2);
      TParticleSystem.Update$5(Self.Motes,dt$1,camera$2);
   }
   ,Destroy:TObject.Destroy
};
/// TDecalSet = class (TObject)
var TDecalSet = {
   $ClassName:"TDecalSet",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Im = null;
      $.Max$3 = $.Next = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TDebris = class (TObject)
var TDebris = {
   $ClassName:"TDebris",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Active$1 = false;
      $.Age$1 = 0;
      $.Bounced = 0;
      $.Mesh$4 = $.Spin = $.Vel$3 = null;
   }
   ,Destroy:TObject.Destroy
};
/// TWeaponStats = class (TObject)
var TWeaponStats = {
   $ClassName:"TWeaponStats",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.ADSSpread = $.Damage = $.HipSpread = $.Range = $.Reload$1 = $.ReloadEmpty = $.RPM = 0;
      $.Mag = $.ReserveMax = 0;
      $.Name$3 = "";
   }
   ,Destroy:TObject.Destroy
};
/// TWeaponInput = class (TObject)
var TWeaponInput = {
   $ClassName:"TWeaponInput",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Aiming = $.Grounded = $.Sprinting = false;
      $.Crouch = $.LookDX = $.LookDY = $.MoveSpeed = $.Time$2 = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TWeapon = class (TObject)
var TWeapon = {
   $ClassName:"TWeapon",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.ADSPos = $.Camera$1 = $.Dot = $.FArms = $.FAudio = $.FBolt = $.FEjectPort = $.FFill = $.FFlashLight = $.FGun = $.FHandL = $.FHandLMag = $.FHandR = $.FHemi = $.FKickPos = $.FKickRot = $.FLand = $.FlashGroup = $.FLHand = $.FMag = $.FMagRest = $.FMuzzle = $.FOpticCenter = $.FRHand = $.FSway = $.FSwayTarget = $.HipPos = $.Root = $.Scene$2 = $.Stats = $.Sun$1 = null;
      $.Aim = $.Cooldown = $.FBobAmt = $.FBobPhase = $.FBreath = $.FEquipT = $.FFlashT = $.FLhk = $.FMelee = $.FReloadDur = $.FSprint = $.FThrowT = $.Reloading = 0;
      $.Ammo = $.Reserve = 0;
      $.FM = {};
      $.FReloadEmpty = false;
   }
   /// procedure TWeapon.BuildLights()
   ,BuildLights:function(Self) {
      Self.FHemi = new THREE.HemisphereLight(13621478,4865328,0.9);
      Self.Scene$2.add(Self.FHemi);
      Self.Sun$1 = new THREE.DirectionalLight(16766888,2.2);
      Self.Scene$2.add(Self.Sun$1);
      Self.Scene$2.add(Self.Sun$1.target);
      Self.FFill = new THREE.DirectionalLight(10466508,0.35);
      Self.FFill.position.set(-1,0.2,1);
      Self.Camera$1.add(Self.FFill);
      Self.FFlashLight = new THREE.PointLight(16754768,0,2.5,2);
      Self.Root.add(Self.FFlashLight);
   }
   /// procedure TWeapon.BuildModel()
   ,BuildModel:function(Self) {
      var gun$1 = null,
         gm = null,
         pb = null,
         gl = null,
         gl2 = null,
         cm = null,
         magPivot = null,
         optic = null,
         lens = null,
         flashMat = null,
         sideTex = null,
         g$11 = null,
         m$3 = null;
      function RB(w$2, h$4, d$9, r$3, s$6) {
         var Result = null;
         Result = new THREEX.RoundedBoxGeometry(w$2,h$4,d$9,s$6,r$3);
         return Result
      }
      function Hand(mirror) {
         var Result = null;
         var h$4 = null,
            seg = null,
            f$3 = null,
            j = null,
            t$6 = null,
            t2 = null;
         h$4 = new THREE.Group();
         AddM(RB(0.056,0.075,0.028,0.012,3),(Self.FM["glove"]||null),0,0,0,0,0,0,h$4);
         AddM(RB(0.058,0.03,0.022,0.009,2),(Self.FM["knuckle"]||null),0,0.026,-0.012,0,0,0,h$4);
         AddM(RB(0.03,0.03,0.01,0.004,2),(Self.FM["knuckle"]||null),0,-0.01,-0.016,0,0,0,h$4);
         seg = new THREE.CapsuleGeometry(0.0082,0.018,4,8);
         for(let i$2=0;i$2<=3;i$2++) {
            f$3 = new THREE.Group();
            f$3.position.set(-0.021 + i$2 * 0.014,0.037 - Abs$_Float_(i$2 - 1.2) * 0.003,0.002);
            h$4.add(f$3);
            f$3.rotation.x = 1 + i$2 * 0.06;
            AddM(seg,(Self.FM["glove"]||null),0,0.013,0,0,0,0,f$3);
            j = new THREE.Group();
            j.position.set(0,0.028,0);
            f$3.add(j);
            j.rotation.x = 1.25;
            AddM(seg,(Self.FM["glove"]||null),0,0.011,0,0,0,0,j);
         }
         t$6 = new THREE.Group();
         t$6.position.set(0.026,-0.012,0.012);
         t$6.rotation.set(0.7,0,-0.7);
         h$4.add(t$6);
         AddM(new THREE.CapsuleGeometry(0.0095,0.024,4,8),(Self.FM["glove"]||null),0,0.018,0,0,0,0,t$6);
         t2 = new THREE.Group();
         t2.position.set(0,0.036,0);
         t2.rotation.x = 0.6;
         t$6.add(t2);
         AddM(new THREE.CapsuleGeometry(0.0088,0.016,4,8),(Self.FM["glove"]||null),0,0.012,0,0,0,0,t2);
         AddM(new THREE.CylinderGeometry(0.029,0.027,0.045,14),(Self.FM["glove"]||null),0,-0.055,-0.002,0,0,0,h$4);
         AddM(new THREE.CylinderGeometry(0.038,0.047,0.34,18),(Self.FM["sleeve"]||null),0,-0.25,-0.004,0,0,0,h$4);
         AddM(new THREE.TorusGeometry(0.039,0.009,8,18),(Self.FM["sleeve"]||null),0,-0.085,-0.004,1.5707963267949,0,0,h$4);
         AddM(RB(0.05,0.05,0.035,0.01,2),(Self.FM["poly"]||null),0,-0.16,-0.035,0,0,0,h$4);
         if (mirror) {
            h$4.scale.x = -1;
         }
         Result = h$4;
         return Result
      }
      function G36Mat(c$12) {
         var Result = null;
         var k$8 = 0,
            key = "";
         if (c$12.m == "Material.012") {
            return (Self.FM["lens"]||null);
         }
         if (c$12.m == "Material.001" || c$12.m == "Material.002" || c$12.m == "Material.003") {
            return (Self.FM["brass"]||null);
         }
         if (c$12.m == "Material.006") {
            return (Self.FM["g36mag"]||null);
         }
         if (c$12.m == "Material.011") {
            return (Self.FM["metal"]||null);
         }
         k$8 = c$12.c[0] * 1.4 + 0.009;
         key = "g36_" + c$12.m;
         if (!(Self.FM[key]||null)) {
            Self.FM[key]=new THREE.MeshStandardMaterial({
               "side" : 2
               ,"roughness" : (c$12.m == "Material.009")?0.5:0.78
               ,"metalness" : (c$12.m == "Material.009")?0.45:0
               ,"envMapIntensity" : 0.55
               ,"color" : Col(k$8,k$8,k$8 * 1.04)
            });
         }
         Result = (Self.FM[key]||null);
         return Result
      }
      function BuildPart(chunks, parent$2, pivot) {
         var a$224 = 0,
            c$12 = null,
            g$12 = null;
         var $temp82;
         for(a$224=0,$temp82=chunks.length;a$224<$temp82;a$224++) {
            c$12 = chunks[a$224];
            g$12 = DecodeChunk(c$12);
            if (pivot) {
               g$12.translate(-pivot.x,-pivot.y,-pivot.z);
            }
            parent$2.add(new THREE.Mesh(g$12,G36Mat(c$12)));
         }
      }
      function AddM(geo, mat$1, x$5, y$5, z$3, rx, ry, rz, parent$2) {
         var Result = null;
         Result = new THREE.Mesh(geo,mat$1);
         Result.position.set(x$5,y$5,z$3);
         Result.rotation.set(rx,ry,rz);
         if (!parent$2) {
            parent$2 = gun$1;
         }
         parent$2.add(Result);
         return Result
      }
      gm = GenGunMetal(256,1974049,0.42);
      Self.FM["metal"]=new THREE.MeshStandardMaterial({
         "roughnessMap" : gm.RoughnessMap
         ,"roughness" : 1
         ,"normalMap" : gm.NormalMap
         ,"metalnessMap" : gm.MetalnessMap
         ,"metalness" : 1
         ,"map" : gm.Map
         ,"envMapIntensity" : 1.1
      });
      pb = GenPolymer(256,2039324);
      Self.FM["poly"]=new THREE.MeshStandardMaterial({
         "roughnessMap" : pb.RoughnessMap
         ,"roughness" : 1
         ,"normalMap" : pb.NormalMap
         ,"metalness" : 0
         ,"map" : pb.Map
      });
      gl = GenCloth(256,2894374);
      Self.FM["glove"]=new THREE.MeshStandardMaterial({
         "roughness" : 0.85
         ,"normalMap" : gl.NormalMap
         ,"map" : gl.Map
         ,"color" : 12303291
      });
      gl2 = GenPolymer(256,4866616);
      Self.FM["knuckle"]=new THREE.MeshStandardMaterial({
         "roughness" : 0.7
         ,"normalMap" : gl2.NormalMap
         ,"map" : gl2.Map
      });
      cm = GenCamo(512);
      cm.Map.repeat.set(2,2);
      cm.NormalMap.repeat.set(2,2);
      Self.FM["sleeve"]=new THREE.MeshStandardMaterial({
         "roughness" : 0.95
         ,"normalMap" : cm.NormalMap
         ,"map" : cm.Map
      });
      Self.FM["lens"]=new THREE.MeshStandardMaterial({
         "transparent" : true
         ,"roughness" : 0.25
         ,"opacity" : 0.18
         ,"metalness" : 0.6
         ,"envMapIntensity" : 0.5
         ,"depthWrite" : false
         ,"color" : 1845811
      });
      Self.FM["brass"]=new THREE.MeshStandardMaterial({
         "roughness" : 0.3
         ,"metalness" : 1
         ,"color" : 12622416
      });
      gun$1 = new THREE.Group();
      Self.FGun = gun$1;
      Self.FM["g36mag"]=new THREE.MeshStandardMaterial({
         "transparent" : true
         ,"roughness" : 0.32
         ,"opacity" : 0.9
         ,"metalness" : 0
         ,"color" : Col(0.05,0.055,0.046)
      });
      BuildPart(G36.body,gun$1,null);
      Self.FBolt = new THREE.Group();
      gun$1.add(Self.FBolt);
      BuildPart(G36.bolt,Self.FBolt,null);
      Self.FMuzzle = new THREE.Object3D();
      Self.FMuzzle.position.set(0,0.004,-0.64);
      gun$1.add(Self.FMuzzle);
      Self.FMag = new THREE.Group();
      magPivot = V3(0,-0.02,-0.06);
      Self.FMag.position.copy(magPivot);
      gun$1.add(Self.FMag);
      BuildPart(G36.mag,Self.FMag,magPivot);
      Self.FMagRest = Self.FMag.position.clone();
      optic = new THREE.Group();
      optic.position.set(0,0.123,0.07);
      gun$1.add(optic);
      AddM(RB(0.03,0.012,0.05,0.003,2),(Self.FM["metal"]||null),0,-0.016,0,0,0,0,optic);
      AddM(new THREE.CylinderGeometry(0.02,0.02,0.07,20,1,true).rotateX(1.5707963267949),(Self.FM["metal"]||null),0,0.006,0,0,0,0,optic);
      AddM(new THREE.CylinderGeometry(0.0185,0.0185,0.07,20,1,true).rotateX(1.5707963267949),new THREE.MeshStandardMaterial({
         "side" : 1
         ,"roughness" : 0.85
         ,"color" : 723724
      }),0,0.006,0,0,0,0,optic);
      AddM(new THREE.TorusGeometry(0.02,0.003,8,24),(Self.FM["metal"]||null),0,0.006,-0.035,0,0,0,optic);
      AddM(new THREE.TorusGeometry(0.02,0.003,8,24),(Self.FM["metal"]||null),0,0.006,0.035,0,0,0,optic);
      AddM(RB(0.012,0.012,0.02,0.003,2),(Self.FM["metal"]||null),0.024,0.006,0,0,0,0,optic);
      AddM(RB(0.012,0.012,0.018,0.003,2),(Self.FM["metal"]||null),0,0.03,0,0,0,0,optic);
      lens = AddM(new THREE.CircleGeometry(0.018,24),(Self.FM["lens"]||null),0,0.006,-0.03,0,0,0,optic);
      lens.renderOrder = 5;
      Self.Dot = new THREE.Group();
      Self.Dot.position.set(0,0.006,-2.4);
      optic.add(Self.Dot);
      AddM(new THREE.CircleGeometry(0.0068,20),new THREE.MeshBasicMaterial({
         "transparent" : true
         ,"depthWrite" : false
         ,"depthTest" : false
         ,"color" : Col(1.5,0,0.03)
      }),0,0,0,0,0,0,Self.Dot);
      AddM(new THREE.CircleGeometry(0.013,20),new THREE.MeshBasicMaterial({
         "transparent" : true
         ,"opacity" : 0.25
         ,"depthWrite" : false
         ,"depthTest" : false
         ,"color" : Col(0.9,0,0)
         ,"blending" : 2
      }),0,0,0,0,0,0,Self.Dot);
      Self.Dot.traverse(function (o$1) {
         o$1.renderOrder = 20;
      });
      Self.Dot.renderOrder = 20;
      Self.FOpticCenter = V3(0,0.129,0.07);
      Self.FArms = new THREE.Group();
      gun$1.add(Self.FArms);
      Self.FRHand = Hand(false);
      Self.FArms.add(Self.FRHand);
      Self.FLHand = Hand(true);
      Self.FArms.add(Self.FLHand);
      Self.FHandR = THandPose.Create$79($New(THandPose),V3(0.031,-0.078,0.103),V3(0.13,-0.3,0.34),V3(-1,0.1,0));
      Self.FHandL = THandPose.Create$79($New(THandPose),V3(-0.037,0.016,-0.3),V3(-0.19,-0.25,-0.07),V3(1,0.25,0.1));
      Self.FHandLMag = THandPose.Create$79($New(THandPose),V3(-0.035,-0.12,-0.03),V3(-0.2,-0.36,0.12),V3(1,0,0));
      TWeapon.PoseHand(Self,Self.FRHand,Self.FHandR.Pos$3,Self.FHandR.Elbow,Self.FHandR.Palm);
      TWeapon.PoseHand(Self,Self.FLHand,Self.FHandL.Pos$3,Self.FHandL.Elbow,Self.FHandL.Palm);
      gun$1.traverse(function (o$1) {
         if (o$1.isMesh) {
            o$1.castShadow = false;
            o$1.receiveShadow = false;
         }
      });
      Self.Root.add(gun$1);
      flashMat = function (tex) {
         var Result = null;
         Result = new THREE.MeshBasicMaterial({
            "transparent" : true
            ,"side" : 2
            ,"map" : tex
            ,"depthWrite" : false
            ,"color" : Col(4,3,2)
            ,"blending" : 2
         });
         return Result
      };
      Self.FlashGroup = new THREE.Group();
      Self.FMuzzle.add(Self.FlashGroup);
      Self.FlashGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.14),flashMat(SpriteTex("flash"))));
      sideTex = SpriteTex("flashSide");
      for(let i$2=0;i$2<=2;i$2++) {
         g$11 = new THREE.PlaneGeometry(0.22,0.09);
         g$11.translate(0.11,0,0);
         g$11.rotateY(1.5707963267949);
         m$3 = new THREE.Mesh(g$11,flashMat(sideTex));
         m$3.rotation.z = i$2 / 3 * 3.14159265358979;
         Self.FlashGroup.add(m$3);
      }
      Self.FlashGroup.visible = false;
      Self.FlashGroup.traverse(function (o$1) {
         o$1.renderOrder = 30;
      });
      Self.HipPos = V3(0.14,-0.172,-0.39);
      Self.ADSPos = V3(-Self.FOpticCenter.x,-Self.FOpticCenter.y,-0.25 - Self.FOpticCenter.z);
      Self.FEjectPort = new THREE.Object3D();
      Self.FEjectPort.position.set(0.022,0.03,-0.05);
      gun$1.add(Self.FEjectPort);
   }
   /// function TWeapon.Busy() : Boolean
   ,Busy:function(Self) {
      var Result = false;
      Result = Self.Reloading > 0 || Self.FMelee > 0 || Self.FThrowT > 0 || Self.FEquipT > 0;
      return Result
   }
   /// function TWeapon.CanFire() : Boolean
   ,CanFire:function(Self) {
      var Result = false;
      Result = Self.Cooldown <= 0 && (!(TWeapon.Busy(Self))) && Self.FSprint < 0.3;
      return Result
   }
   /// constructor TWeapon.Create(audio: TAudio)
   ,Create$77:function(Self, audio) {
      Self.FAudio = audio;
      Self.Scene$2 = new THREE.Scene();
      Self.Camera$1 = new THREE.PerspectiveCamera(52,1,0.01,10);
      Self.Scene$2.add(Self.Camera$1);
      Self.Root = new THREE.Group();
      Self.Camera$1.add(Self.Root);
      TWeapon.BuildLights(Self);
      TWeapon.BuildModel(Self);
      Self.Stats = TObject.Create($New(TWeaponStats));
      Self.Stats.Name$3 = "HK G36";
      Self.Stats.RPM = 800;
      Self.Stats.Damage = 34;
      Self.Stats.Mag = 30;
      Self.Stats.ReserveMax = 180;
      Self.Stats.Reload$1 = 2.35;
      Self.Stats.ReloadEmpty = 2.8;
      Self.Stats.HipSpread = 0.03;
      Self.Stats.ADSSpread = 0.0015;
      Self.Stats.Range = 250;
      Self.Ammo = 30;
      Self.Reserve = 150;
      Self.FReloadDur = 1;
      Self.FEquipT = 0.6;
      Self.FSwayTarget = new THREE.Vector2();
      Self.FSway = new THREE.Vector2();
      Self.FKickPos = TSpring.Create$78($New(TSpring),180,16);
      Self.FKickRot = TSpring.Create$78($New(TSpring),160,13);
      Self.FLand = TSpring.Create$78($New(TSpring),90,10);
      Self.FFlashT = 1;
      return Self
   }
   /// function TWeapon.EjectWorld(target: JVector3) : JVector3
   ,EjectWorld:function(Self, target$2) {
      var Result = null;
      Result = Self.FEjectPort.getWorldPosition(target$2);
      return Result
   }
   /// procedure TWeapon.FinishReload()
   ,FinishReload:function(Self) {
      var need = 0,
         take = 0;
      need = Self.Stats.Mag - Self.Ammo;
      take = Min$_Integer_Integer_(need,Self.Reserve);
      Self.Ammo += take;
      Self.Reserve -= take;
   }
   /// function TWeapon.Fire() : Boolean
   ,Fire$1:function(Self) {
      var Result = false;
      var a$119 = 0,
         s$6 = 0;
      if (Self.Ammo <= 0) {
         if (Self.Cooldown <= 0) {
            TAudio.Dry(Self.FAudio);
            Self.Cooldown = 0.25;
         }
         return false;
      }
      Self.Ammo -= 1;
      Self.Cooldown = TWeapon.FireInterval(Self);
      a$119 = Self.Aim;
      TSpring.Impulse(Self.FKickPos,(Math.random() - 0.5) * 0.08,0.05 * (1 - a$119 * 0.6),0.9 * (1 - a$119 * 0.55));
      TSpring.Impulse(Self.FKickRot,2.2 * (1 - a$119 * 0.7),(Math.random() - 0.5) * 1.2,(Math.random() - 0.5) * 1.6);
      Self.FFlashT = 0;
      Self.FlashGroup.visible = true;
      Self.FlashGroup.rotation.z = Math.random() * 3.14159265358979 * 2;
      s$6 = 0.7 + Math.random() * 0.6;
      Self.FlashGroup.scale.set(s$6,s$6,0.8 + Math.random() * 0.5);
      Self.FFlashLight.intensity = 6;
      Self.FFlashLight.position.copy(Self.FMuzzle.position).add(Self.FGun.position);
      TAudio.Gunshot(Self.FAudio);
      Result = true;
      return Result
   }
   /// function TWeapon.FireInterval() : Float
   ,FireInterval:function(Self) {
      var Result = 0;
      Result = 60 / Self.Stats.RPM;
      return Result
   }
   /// function TWeapon.IsReloading() : Boolean
   ,IsReloading:function(Self) {
      var Result = false;
      Result = Self.Reloading > 0;
      return Result
   }
   /// function TWeapon.MuzzleWorld(target: JVector3) : JVector3
   ,MuzzleWorld:function(Self, target$2) {
      var Result = null;
      Self.Camera$1.updateMatrixWorld(true);
      Result = Self.FMuzzle.getWorldPosition(target$2);
      return Result
   }
   /// procedure TWeapon.OnLand(v: Float)
   ,OnLand:function(Self, v$3) {
      TSpring.Impulse(Self.FLand,0,(-MinF(v$3,12)) * 0.035,0);
   }
   /// procedure TWeapon.PoseHand(h: JObject3D; pos: JVector3; elbow: JVector3; palm: JVector3)
   ,PoseHand:function(Self, h$4, pos$4, elbow, palm) {
      var f$3 = null,
         n$22 = null,
         x$5 = null;
      f$3 = pos$4.clone().sub(elbow).normalize();
      n$22 = palm.clone().addScaledVector(f$3,-palm.dot(f$3)).normalize();
      x$5 = V3Zero().crossVectors(f$3,n$22);
      h$4.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x$5,f$3,n$22));
      h$4.position.copy(pos$4);
   }
   /// procedure TWeapon.SetAspect(a: Float)
   ,SetAspect:function(Self, a$119) {
      Self.Camera$1.aspect = a$119;
      Self.Camera$1.updateProjectionMatrix();
   }
   /// function TWeapon.StartMelee() : Boolean
   ,StartMelee:function(Self) {
      var Result = false;
      if (Self.FMelee > 0 || Self.Reloading > 0) {
         return false;
      }
      Self.FMelee = 0.55;
      TAudio.Melee(Self.FAudio);
      Result = true;
      return Result
   }
   /// function TWeapon.StartReload() : Boolean
   ,StartReload:function(Self) {
      var Result = false;
      if (Self.Reloading > 0 || Self.Ammo >= Self.Stats.Mag || Self.Reserve <= 0 || Self.FMelee > 0) {
         return false;
      }
      Self.FReloadEmpty = (Self.Ammo==0);
      Self.FReloadDur = (Self.FReloadEmpty)?Self.Stats.ReloadEmpty:Self.Stats.Reload$1;
      Self.Reloading = Self.FReloadDur;
      TAudio.Reload$2(Self.FAudio,Self.FReloadDur);
      Result = true;
      return Result
   }
   /// function TWeapon.StartThrow() : Boolean
   ,StartThrow:function(Self) {
      var Result = false;
      if (Self.FThrowT > 0) {
         return false;
      }
      Self.FThrowT = 0.7;
      Result = true;
      return Result
   }
   /// procedure TWeapon.Update(dt: Float; mainCam: JCamera; input: TWeaponInput)
   ,Update:function(Self, dt$1, mainCam, input) {
      var moving = 0,
         a$119 = 0,
         sp$2 = 0,
         bobScale = 0,
         bx = 0,
         by = 0,
         breathY = 0,
         breathX = 0,
         p$3 = null,
         rx = 0,
         ry = 0,
         rz = 0,
         sprintBob = 0,
         magOff = 0,
         magVis = false,
         lh = 0,
         t$6 = 0,
         tilt = 0,
         k$8 = 0,
         lp = null,
         t$7 = 0,
         mk = 0,
         t$8 = 0,
         tk = 0,
         ek = 0;
      Self.Camera$1.position.copy(mainCam.position);
      Self.Camera$1.quaternion.copy(mainCam.quaternion);
      Self.Cooldown -= dt$1;
      Self.FEquipT = MaxF(0,Self.FEquipT - dt$1);
      Self.Aim = Damp(Self.Aim,(input.Aiming && (!(TWeapon.Busy(Self))))?1:0,14,dt$1);
      Self.FSprint = Damp(Self.FSprint,(input.Sprinting && (!(TWeapon.Busy(Self))))?1:0,9,dt$1);
      Self.FSwayTarget.set(ClampF((-input.LookDX) * 1.4,-0.12,0.12),ClampF((-input.LookDY) * 1.4,-0.12,0.12));
      Self.FSway.x = Damp(Self.FSway.x,Self.FSwayTarget.x,10,dt$1);
      Self.FSway.y = Damp(Self.FSway.y,Self.FSwayTarget.y,10,dt$1);
      moving = (input.Grounded)?MinF(input.MoveSpeed / 5,1.6):0;
      Self.FBobAmt = Damp(Self.FBobAmt,moving,8,dt$1);
      Self.FBobPhase += dt$1 * (input.MoveSpeed * 1.55 + 0.001);
      Self.FBreath += dt$1;
      TSpring.Update$1(Self.FKickPos,dt$1);
      TSpring.Update$1(Self.FKickRot,dt$1);
      TSpring.Update$1(Self.FLand,dt$1);
      a$119 = Self.Aim;
      sp$2 = Self.FSprint * (1 - a$119);
      bobScale = Mix(1,0.12,a$119);
      bx = Sin(Self.FBobPhase) * 0.011 * Self.FBobAmt * bobScale;
      by = (-Abs$_Float_(Cos(Self.FBobPhase))) * 0.012 * Self.FBobAmt * bobScale;
      breathY = Sin(Self.FBreath * 1.3) * 0.0015 * (1 - a$119 * 0.7);
      breathX = Sin(Self.FBreath * 0.7) * 0.001 * (1 - a$119 * 0.7);
      p$3 = V3Zero().lerpVectors(Self.HipPos,Self.ADSPos,Ease(a$119));
      rx = 0;
      ry = 0;
      rz = 0;
      rz += input.Crouch * 0.06 * (1 - a$119);
      p$3.x += sp$2 * -0.04;
      p$3.y += sp$2 * -0.03;
      p$3.z += sp$2 * 0.02;
      rx += sp$2 * -0.35;
      ry += sp$2 * 0.75;
      rz += sp$2 * 0.35;
      sprintBob = Sin(Self.FBobPhase) * sp$2;
      p$3.x += sprintBob * 0.02;
      p$3.y += Abs$_Float_(sprintBob) * -0.012;
      rz += sprintBob * 0.06;
      magOff = 0;
      magVis = true;
      lh = 0;
      if (Self.Reloading > 0) {
         Self.Reloading -= dt$1;
         t$6 = 1 - Self.Reloading / Self.FReloadDur;
         tilt = Ease(MinF(1,t$6 / 0.15)) * (1 - Ease(MaxF(0,(t$6 - 0.85) / 0.15)));
         rz += tilt * 0.42;
         rx += tilt * 0.12;
         ry += tilt * -0.12;
         p$3.y += tilt * -0.035;
         p$3.x += tilt * -0.045;
         p$3.z += tilt * 0.03;
         if (t$6 < 0.2) {
            magOff = 0;
         } else if (t$6 < 0.35) {
            magOff = Ease((t$6 - 0.2) / 0.15) * 0.35;
         } else if (t$6 < 0.45) {
            magOff = 0.35;
            magVis = false;
         } else if (t$6 < 0.6) {
            magOff = (1 - Ease((t$6 - 0.45) / 0.15)) * 0.35;
         } else {
            magOff = 0;
         }
         if (t$6 > 0.58 && t$6 < 0.62) {
            TSpring.Impulse(Self.FKickRot,1.2,0,0.5);
         }
         lh = (t$6 > 0.18 && t$6 < 0.62)?1:0;
         if (Self.FReloadEmpty && t$6 > 0.78 && t$6 < 0.83) {
            TSpring.Impulse(Self.FKickPos,0,0,0.35);
         }
         if (Self.Reloading <= 0) {
            Self.Reloading = 0;
            TWeapon.FinishReload(Self);
         }
      }
      Self.FMag.position.set(Self.FMagRest.x,Self.FMagRest.y - magOff,Self.FMagRest.z + magOff * 0.15);
      Self.FMag.visible = magVis;
      Self.FLhk = Damp(Self.FLhk,lh,12,dt$1);
      k$8 = Self.FLhk;
      lp = Self.FHandL.Pos$3.clone().lerp(Self.FHandLMag.Pos$3,k$8);
      lp.y += (Self.FMag.position.y - Self.FMagRest.y) * k$8;
      TWeapon.PoseHand(Self,Self.FLHand,lp,Self.FHandL.Elbow.clone().lerp(Self.FHandLMag.Elbow,k$8),Self.FHandL.Palm.clone().lerp(Self.FHandLMag.Palm,k$8));
      if (Self.FMelee > 0) {
         Self.FMelee -= dt$1;
         t$7 = 1 - Self.FMelee / 0.55;
         mk = Sin(MinF(1,t$7 * 1.6) * 3.14159265358979);
         p$3.z -= mk * 0.12;
         p$3.x -= mk * 0.08;
         ry += mk * 0.6;
         rz += mk * 0.4;
      }
      if (Self.FThrowT > 0) {
         Self.FThrowT -= dt$1;
         t$8 = 1 - Self.FThrowT / 0.7;
         tk = Sin(t$8 * 3.14159265358979);
         p$3.y -= tk * 0.18;
         rx -= tk * 0.6;
      }
      if (Self.FEquipT > 0) {
         ek = Ease(Self.FEquipT / 0.6);
         p$3.y -= ek * 0.25;
         rx -= ek * 0.8;
      }
      p$3.x = p$3.x + bx + breathX + Self.FSway.x * 0.35 * (1 - a$119 * 0.8) + Self.FKickPos.X.x * 0.01;
      p$3.y = p$3.y + by + breathY + Self.FSway.y * 0.35 * (1 - a$119 * 0.8) + Self.FKickPos.X.y * 0.01 + Self.FLand.X.y;
      p$3.z += Self.FKickPos.X.z * 0.035;
      rx += Self.FKickRot.X.x * 0.03 + Self.FSway.y * 0.6 * (1 - a$119 * 0.7) + Self.FLand.X.y * -1.5;
      ry += Self.FKickRot.X.y * 0.02 + Self.FSway.x * 0.8 * (1 - a$119 * 0.7);
      rz += Self.FKickRot.X.z * 0.02 + Self.FSway.x * 0.9 + bx * 2;
      Self.FGun.position.copy(p$3);
      Self.FGun.rotation.set(rx,ry,rz);
      Self.Camera$1.fov = Mix(50,36,a$119);
      Self.Camera$1.updateProjectionMatrix();
      Self.FFlashT += dt$1;
      Self.FBolt.position.z = MaxF(0,1 - Self.FFlashT / 0.055) * 0.028;
      if (Self.FFlashT > 0.045) {
         Self.FlashGroup.visible = false;
      }
      Self.FFlashLight.intensity = MaxF(0,6 * (1 - Self.FFlashT / 0.06));
      Self.Dot.visible = a$119 > 0.85;
   }
   ,Destroy:TObject.Destroy
};
/// TSpring = class (TObject)
var TSpring = {
   $ClassName:"TSpring",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.D = $.K = 0;
      $.V = $.X = null;
   }
   /// constructor TSpring.Create(ak: Float = 120; ad: Float = 14)
   ,Create$78:function(Self, ak, ad) {
      Self.K = ak;
      Self.D = ad;
      Self.X = V3Zero();
      Self.V = V3Zero();
      return Self
   }
   /// procedure TSpring.Impulse(ax: Float; ay: Float; az: Float)
   ,Impulse:function(Self, ax, ay, az) {
      Self.V.x += ax;
      Self.V.y += ay;
      Self.V.z += az;
   }
   /// procedure TSpring.Update(dt: Float)
   ,Update$1:function(Self, dt$1) {
      var a$119 = null;
      a$119 = Self.X.clone().multiplyScalar(-Self.K).addScaledVector(Self.V,-Self.D);
      Self.V.addScaledVector(a$119,dt$1);
      Self.X.addScaledVector(Self.V,dt$1);
   }
   ,Destroy:TObject.Destroy
};
/// THandPose = class (TObject)
var THandPose = {
   $ClassName:"THandPose",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Elbow = $.Palm = $.Pos$3 = null;
   }
   /// constructor THandPose.Create(apos: JVector3; aelbow: JVector3; apalm: JVector3)
   ,Create$79:function(Self, apos, aelbow, apalm) {
      Self.Pos$3 = apos;
      Self.Elbow = aelbow;
      Self.Palm = apalm;
      return Self
   }
   ,Destroy:TObject.Destroy
};
function DecodeChunk(c$12) {
   var Result = null;
   var q = null,
      n$18 = null,
      idx = null,
      pos = null,
      nrm = null,
      a$119 = 0,
      g$9 = null;
   q = new Uint16Array(B64Buffer(c$12.p));
   n$18 = new Int8Array(B64Buffer(c$12.n));
   idx = new Uint16Array(B64Buffer(c$12.i));
   pos = new Float32Array(q.length);
   nrm = new Float32Array(n$18.length);
   for(let k$8=0,$temp83=q.length;k$8<$temp83;k$8++) {
      a$119 = k$8 % 3;
      pos[k$8]=(c$12.min[a$119] + q[k$8] / 65535 * (c$12.max[a$119] - c$12.min[a$119]));
   }
   for(let k$9=0,$temp84=n$18.length;k$9<$temp84;k$9++) {
      nrm[k$9]=(n$18[k$9] / 127);
   }
   g$9 = new THREE.BufferGeometry();
   g$9.setAttribute("position",new THREE.BufferAttribute(pos,3));
   g$9.setAttribute("normal",new THREE.BufferAttribute(nrm,3));
   g$9.setIndex(new THREE.BufferAttribute(idx,1));
   Result = g$9;
   return Result
}
function B64Buffer(str) {
   var Result = null;
   var bin = "",
      u$3 = null;
   bin = atob(str);
   u$3 = new Uint8Array(bin.length);
   for(let k$8=0,$temp85=bin.length;k$8<$temp85;k$8++) {
      u$3[k$8]=CharCode(bin,k$8);
   }
   Result = u$3.buffer;
   return Result
}
/// TPlayer = class (TObject)
var TPlayer = {
   $ClassName:"TPlayer",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Aiming$1 = $.Alive = $.Crouching = $.Firing = $.Grounded$1 = false;
      $.CrouchK = $.Difficulty = $.Eye = $.FBob = $.FMouseDX = $.FMouseDY = $.FRecoilP = $.FRecoilY = $.FRegenDelay = $.FSens = $.FStepDist = $.FTilt = $.HP = $.LandImpact = $.LookDX$1 = $.LookDY$1 = $.MaxHP = $.Pitch$1 = $.Sliding = $.Trauma = $.Yaw$1 = 0;
      $.DamageEvents = [];
      $.FAudio$1 = $.FCamera = $.FSlideDir = $.FWorld = $.Pos$4 = $.Vel$1 = null;
      $.Keys = {};
   }
   /// procedure TPlayer.AddRecoil(p: Float; y: Float)
   ,AddRecoil:function(Self, p$3, y$5) {
      Self.FRecoilP += p$3;
      Self.FRecoilY += y$5;
   }
   /// constructor TPlayer.Create(camera: JPerspectiveCamera; world: TWorld; audio: TAudio)
   ,Create$80:function(Self, camera$2, world$1, audio) {
      Self.FCamera = camera$2;
      Self.FWorld = world$1;
      Self.FAudio$1 = audio;
      Self.Pos$4 = V3(0,0,80);
      Self.Vel$1 = V3Zero();
      Self.FSens = 0.0021;
      Self.Grounded$1 = true;
      Self.FSlideDir = V3Zero();
      Self.Eye = 1.62;
      Self.HP = 100;
      Self.MaxHP = 100;
      Self.Alive = true;
      Self.Difficulty = 1;
      return Self
   }
   /// procedure TPlayer.CrouchPressed()
   ,CrouchPressed:function(Self) {
      var speed = 0;
      speed = Math.hypot(Self.Vel$1.x,Self.Vel$1.z);
      if ((Self.Keys["ShiftLeft"]||false) && speed > 5.5 && Self.Grounded$1 && Self.Sliding <= 0) {
         Self.Sliding = 0.85;
         Self.FSlideDir.set(Self.Vel$1.x,0,Self.Vel$1.z).normalize();
         Self.Vel$1.x = Self.FSlideDir.x * 10.5;
         Self.Vel$1.z = Self.FSlideDir.z * 10.5;
         TPlayer.Shake(Self,0.05);
         TAudio.Step(Self.FAudio$1,"dirt",true);
         Self.Crouching = true;
         return;
      }
      Self.Crouching = !(Self.Crouching);
   }
   /// function TPlayer.HeadPos(target: JVector3) : JVector3
   ,HeadPos:function(Self, target$2) {
      var Result = null;
      Result = target$2.set(Self.Pos$4.x,Self.Pos$4.y + Self.Eye,Self.Pos$4.z);
      return Result
   }
   /// function TPlayer.Moving() : Boolean
   ,Moving:function(Self) {
      var Result = false;
      Result = Math.hypot(Self.Vel$1.x,Self.Vel$1.z) > 1.2;
      return Result
   }
   /// procedure TPlayer.OnMouse(dx: Float; dy: Float)
   ,OnMouse:function(Self, dx, dy) {
      Self.FMouseDX += dx;
      Self.FMouseDY += dy;
   }
   /// procedure TPlayer.Reset()
   ,Reset$2:function(Self) {
      Self.Pos$4.set(0,0,80);
      Self.Vel$1.set(0,0,0);
      Self.Yaw$1 = 0;
      Self.Pitch$1 = 0;
      Self.HP = 100;
      Self.Alive = true;
      Self.Trauma = 0;
      Self.Sliding = 0;
   }
   /// procedure TPlayer.Shake(amount: Float)
   ,Shake:function(Self, amount) {
      Self.Trauma = MinF(1,Self.Trauma + amount);
   }
   /// function TPlayer.Sprinting() : Boolean
   ,Sprinting$1:function(Self) {
      var Result = false;
      Result = (Self.Keys["ShiftLeft"]||false) && (Self.Keys["KeyW"]||false) && (!(Self.Aiming$1)) && (!(Self.Crouching)) && Self.Sliding <= 0 && (!(Self.Firing));
      return Result
   }
   /// procedure TPlayer.TakeDamage(amount: Float; fromPos: JVector3)
   ,TakeDamage:function(Self, amount, fromPos) {
      var ev$2 = null;
      if (!(Self.Alive)) {
         return;
      }
      Self.HP -= amount * Self.Difficulty;
      Self.FRegenDelay = 4.5;
      TPlayer.Shake(Self,0.18);
      TAudio.Hurt(Self.FAudio$1);
      ev$2 = TObject.Create($New(TDamageEvent));
      ev$2.From = fromPos.clone();
      Self.DamageEvents.push(ev$2);
      if (Self.HP <= 0) {
         Self.HP = 0;
         Self.Alive = false;
      }
   }
   /// procedure TPlayer.Update(dt: Float)
   ,Update$2:function(Self, dt$1) {
      var sensMul = 0,
         dYaw = 0,
         dPitch = 0,
         rp = 0,
         ry = 0,
         fwd$1 = null,
         right$2 = null,
         wish = null,
         maxSpeed = 0,
         f$3 = 0,
         accel = 0,
         fric = 0,
         target$2 = null,
         dvx = 0,
         dvz = 0,
         rate = 0,
         dl = 0,
         step = 0,
         hs = 0,
         wasGrounded = false,
         vy = 0,
         height$3 = 0,
         speed = 0,
         stride = 0,
         bobK = 0,
         bobY = 0,
         bobX = 0,
         lateral = 0,
         sh = 0,
         t$6 = 0,
         skX = 0,
         skY = 0,
         skR = 0,
         targetFov = 0,
         a$225 = 0,
         e$1 = null,
         a$226 = [];
      sensMul = (Self.Aiming$1)?0.62:1;
      dYaw = (-Self.FMouseDX) * Self.FSens * sensMul;
      dPitch = (-Self.FMouseDY) * Self.FSens * sensMul;
      Self.FMouseDX = 0;
      Self.FMouseDY = 0;
      Self.Yaw$1 += dYaw;
      Self.Pitch$1 += dPitch;
      Self.LookDX$1 = dYaw;
      Self.LookDY$1 = dPitch;
      rp = Self.FRecoilP * MinF(1,dt$1 * 18);
      ry = Self.FRecoilY * MinF(1,dt$1 * 18);
      Self.Pitch$1 += rp;
      Self.Yaw$1 += ry;
      Self.FRecoilP -= rp;
      Self.FRecoilY -= ry;
      Self.Pitch$1 = ClampF(Self.Pitch$1,-1.5,1.5);
      fwd$1 = V3(-Sin(Self.Yaw$1),0,-Cos(Self.Yaw$1));
      right$2 = V3(Cos(Self.Yaw$1),0,-Sin(Self.Yaw$1));
      wish = V3Zero();
      if ((Self.Keys["KeyW"]||false)) {
         wish.add(fwd$1);
      }
      if ((Self.Keys["KeyS"]||false)) {
         wish.sub(fwd$1);
      }
      if ((Self.Keys["KeyD"]||false)) {
         wish.add(right$2);
      }
      if ((Self.Keys["KeyA"]||false)) {
         wish.sub(right$2);
      }
      if (wish.lengthSq() > 0) {
         wish.normalize();
      }
      maxSpeed = 4.8;
      if (TPlayer.Sprinting$1(Self)) {
         maxSpeed = 7.4;
      }
      if (Self.Crouching) {
         maxSpeed = 2.4;
      }
      if (Self.Aiming$1) {
         maxSpeed = MinF(maxSpeed,2.9);
      }
      if (!(Self.Alive)) {
         maxSpeed = 0;
      }
      if (Self.Sliding > 0) {
         Self.Sliding -= dt$1;
         f$3 = Exp(-2.2 * dt$1);
         Self.Vel$1.x *= f$3;
         Self.Vel$1.z *= f$3;
         if (Self.Sliding <= 0) {
            Self.Sliding = 0;
         }
      } else if (Self.Grounded$1) {
         accel = 60;
         fric = 11;
         target$2 = wish.clone().multiplyScalar(maxSpeed);
         dvx = target$2.x - Self.Vel$1.x;
         dvz = target$2.z - Self.Vel$1.z;
         rate = (wish.lengthSq() > 0)?accel:fric * MaxF(2,Math.hypot(Self.Vel$1.x,Self.Vel$1.z));
         dl = Math.hypot(dvx,dvz);
         step = MinF(dl,rate * dt$1);
         if (dl > 1E-5) {
            Self.Vel$1.x += dvx / dl * step;
            Self.Vel$1.z += dvz / dl * step;
         }
      } else {
         Self.Vel$1.x += wish.x * 8 * dt$1;
         Self.Vel$1.z += wish.z * 8 * dt$1;
         hs = Math.hypot(Self.Vel$1.x,Self.Vel$1.z);
         if (hs > 8) {
            Self.Vel$1.x = Self.Vel$1.x * 8 / hs;
            Self.Vel$1.z = Self.Vel$1.z * 8 / hs;
         }
      }
      if ((Self.Keys["Space"]||false) && Self.Grounded$1 && Self.Alive) {
         Self.Vel$1.y = 5.2;
         Self.Grounded$1 = false;
         Self.Keys["Space"]=false;
         if (Self.Crouching) {
            Self.Crouching = false;
         }
         if (Self.Sliding > 0) {
            Self.Sliding = 0;
         }
      }
      Self.Vel$1.y -= 16 * dt$1;
      wasGrounded = Self.Grounded$1;
      vy = Self.Vel$1.y;
      Self.Pos$4.addScaledVector(Self.Vel$1,dt$1);
      height$3 = (Self.Crouching || Self.Sliding > 0)?1.15:1.8;
      Self.Grounded$1 = TWorld.Collide(Self.FWorld,Self.Pos$4,Self.Vel$1,0.33,height$3,0.45);
      if ((!(wasGrounded)) && Self.Grounded$1 && vy < -3) {
         Self.LandImpact = -vy;
         TAudio.Step(Self.FAudio$1,"concrete",true);
         TPlayer.Shake(Self,MinF(0.2,(-vy) * 0.015));
      }
      Self.CrouchK = Damp(Self.CrouchK,(Self.Sliding > 0)?1.3:(Self.Crouching)?1:0,12,dt$1);
      Self.Eye = 1.62 - Self.CrouchK * 0.55;
      speed = Math.hypot(Self.Vel$1.x,Self.Vel$1.z);
      if (Self.Grounded$1 && speed > 0.5 && Self.Sliding <= 0) {
         Self.FBob += dt$1 * speed * 1.55;
         Self.FStepDist += speed * dt$1;
         stride = (TPlayer.Sprinting$1(Self))?2.3:1.9;
         if (Self.FStepDist > stride) {
            Self.FStepDist = 0;
            TAudio.Step(Self.FAudio$1,"concrete",TPlayer.Sprinting$1(Self));
         }
      }
      bobK = (Self.Aiming$1)?0.15:1;
      bobY = Sin(Self.FBob * 2) * 0.03 * MinF(1,speed / 5) * bobK;
      bobX = Cos(Self.FBob) * 0.02 * MinF(1,speed / 5) * bobK;
      lateral = Self.Vel$1.dot(right$2);
      Self.FTilt = Damp(Self.FTilt,(-lateral) * 0.004 + ((Self.Sliding > 0)?0.08:0),8,dt$1);
      Self.Trauma = MaxF(0,Self.Trauma - dt$1 * 1.4);
      sh = Math.pow(Self.Trauma,2);
      t$6 = performance.now() / 1000;
      skX = sh * 0.05 * (Sin(t$6 * 47.3) + Sin(t$6 * 31.1) * 0.5);
      skY = sh * 0.05 * (Sin(t$6 * 43.7 + 1) + Sin(t$6 * 27.9) * 0.5);
      skR = sh * 0.04 * Sin(t$6 * 39.1 + 2);
      Self.FCamera.position.set(Self.Pos$4.x + right$2.x * bobX,Self.Pos$4.y + Self.Eye + bobY,Self.Pos$4.z + right$2.z * bobX);
      Self.FCamera.rotation.order = "YXZ";
      Self.FCamera.rotation.set(Self.Pitch$1 + skY,Self.Yaw$1 + skX,Self.FTilt + skR);
      targetFov = ((TPlayer.Sprinting$1(Self))?69:63) - ((Self.Aiming$1)?19:0) + ((Self.Sliding > 0)?5:0);
      Self.FCamera.fov = Damp(Self.FCamera.fov,targetFov,10,dt$1);
      Self.FCamera.updateProjectionMatrix();
      if (Self.Alive) {
         Self.FRegenDelay -= dt$1;
         if (Self.FRegenDelay <= 0 && Self.HP < Self.MaxHP) {
            Self.HP = MinF(Self.MaxHP,Self.HP + 30 * dt$1);
         }
      }
      a$226 = Self.DamageEvents;
      var $temp86;
      for(a$225=0,$temp86=a$226.length;a$225<$temp86;a$225++) {
         e$1 = a$226[a$225];
         e$1.T$2 += dt$1;
      }
      for(let i$2=Self.DamageEvents.length - 1;i$2>=0;i$2--) {
         if (Self.DamageEvents[i$2].T$2 >= 1.6) {
            Self.DamageEvents.splice(i$2,1)
            ;
         }
      }
   }
   ,Destroy:TObject.Destroy
};
/// TDamageEvent = class (TObject)
var TDamageEvent = {
   $ClassName:"TDamageEvent",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.El$1 = $.From = null;
      $.T$2 = 0;
   }
   ,Destroy:TObject.Destroy
};
/// TZoneHit = class (TObject)
var TZoneHit = {
   $ClassName:"TZoneHit",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.T$3 = 0;
      $.Zone$1 = "";
   }
   ,Destroy:TObject.Destroy
};
/// TRestBone = class (TObject)
var TRestBone = {
   $ClassName:"TRestBone",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Dir = $.P$1 = $.Q$1 = null;
   }
   ,Destroy:TObject.Destroy
};
/// TLimb = class (TObject)
var TLimb = {
   $ClassName:"TLimb",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Lower = $.Upper = null;
   }
   ,Destroy:TObject.Destroy
};
/// TGrip = class (TObject)
var TGrip = {
   $ClassName:"TGrip",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Pole$1 = $.Pos$5 = $.Quat = null;
   }
   ,Destroy:TObject.Destroy
};
/// TEnemyCtx = class (TObject)
var TEnemyCtx = {
   $ClassName:"TEnemyCtx",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.Audio$1 = $.Effects$1 = $.Player$1 = null;
      $.CoverPoints$1 = [];
      $.Enemies$2 = [];
   }
   ,Destroy:TObject.Destroy
};
/// TEnemy = class (TObject)
var TEnemy = {
   $ClassName:"TEnemy",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.AimPitch = $.Awareness = $.BurstCooldown = $.DeathT = $.FCrouch = $.FFlinch = $.FStateTimer = $.FStrafeDir = $.FStuckTimer = $.FUnseen = $.FWalkPhase = $.HP$1 = $.Ready = $.ReadyOverride = $.ShotTimer = $.Speed = $.Yaw$2 = 0;
      $.Alive$1 = $.FFiringRecent = false;
      $.ArmL = $.ArmR = $.Body$1 = $.FDeathAxis = $.FLastPos = $.FModel = $.FScene = $.FTarget = $.FVel = $.FWorld$2 = $.Gun = $.Head = $.Hips = $.LegL = $.LegR = $.Muzzle = $.Root$1 = $.Spine = null;
      $.BurstLeft = $.FDeathStyle = 0;
      $.FBones = {};
      $.State$1 = "";
   }
   /// function TEnemy.AimBone(name: String; dirW: JVector3) : JQuaternion
   ,AimBone:function(Self, name$3, dirW) {
      var Result = null;
      var r$3 = null,
         restW = null,
         align = null;
      r$3 = (Rest[name$3]||null);
      restW = _v3.copy(r$3.Dir).applyQuaternion(_qb);
      align = new THREE.Quaternion().setFromUnitVectors(restW,dirW);
      _q$2.copy(_qb).multiply(r$3.Q$1).premultiply(align);
      TEnemy.SetBoneWorld(Self,(Self.FBones[name$3]||null),_q$2);
      Result = align;
      return Result
   }
   /// procedure TEnemy.Animate(dt: Float)
   ,Animate:function(Self, dt$1) {
      var s$6 = 0,
         k$8 = 0,
         ph = 0,
         crouch = 0,
         swing = 0,
         wantLow = 0,
         aimK = 0,
         pitch = 0,
         aimQ = null,
         aimP = null;
      s$6 = Self.Speed;
      Self.FWalkPhase += dt$1 * (2.2 + s$6 * 2.1);
      k$8 = MinF(1,s$6 / 3.5);
      ph = Self.FWalkPhase;
      crouch = Self.FCrouch;
      swing = Sin(ph) * 0.7 * k$8;
      Self.LegR.Upper.rotation.x = (-swing) - crouch * 1.2;
      Self.LegL.Upper.rotation.x = swing - crouch * 0.4;
      Self.LegR.Lower.rotation.x = MaxF(0,Sin(ph + 1.4)) * 1 * k$8 + crouch * 1.9;
      Self.LegL.Lower.rotation.x = MaxF(0,Sin(ph + 4.54159265358979)) * 1 * k$8 + crouch * 0.9;
      Self.Hips.position.y = 0.95 - Abs$_Float_(Cos(ph)) * 0.05 * k$8 - crouch * 0.45;
      Self.Hips.rotation.y = Sin(ph) * 0.12 * k$8;
      wantLow = (Self.ReadyOverride >= 0)?Self.ReadyOverride:(Self.FFiringRecent)?0:(s$6 > 2.6)?1:(Self.Awareness > 0.7)?0:1;
      Self.Ready = Damp(Self.Ready,wantLow,6,dt$1);
      aimK = 1 - Self.Ready;
      pitch = Self.AimPitch;
      Self.Spine.rotation.x = 0.12 * k$8 + crouch * 0.25 - pitch * 0.5 - Self.FFlinch * 0.3 + Self.Ready * 0.08;
      Self.Spine.rotation.y = (-Self.Hips.rotation.y) - 0.5 * aimK;
      Self.Head.rotation.set((-pitch) * 0.4 + 0.2 * aimK,0.22 * aimK,-0.12 * aimK);
      aimQ = new THREE.Quaternion().setFromEuler(new THREE.Euler((-pitch) * 0.5,0.5,0));
      aimP = Pocket.clone().sub(Butt.clone().applyQuaternion(aimQ));
      Self.Gun.quaternion.copy(aimQ);
      Self.Gun.position.copy(aimP);
      Self.Gun.updateMatrix();
      SolveArm(Self.ArmR,-1,_v$1.copy(GripR.Pos$5).applyMatrix4(Self.Gun.matrix));
      SolveArm(Self.ArmL,1,_v$1.copy(GripL.Pos$5).applyMatrix4(Self.Gun.matrix));
      TEnemy.Retarget(Self);
   }
   /// procedure TEnemy.ApplyDelta(name: String; delta: JQuaternion)
   ,ApplyDelta:function(Self, name$3, delta) {
      var r$3 = null;
      r$3 = (Rest[name$3]||null);
      _q$2.copy(_qb).multiply(delta).multiply(r$3.Q$1);
      TEnemy.SetBoneWorld(Self,(Self.FBones[name$3]||null),_q$2);
   }
   /// procedure TEnemy.Combat(dt: Float; dist: Float; sees: Boolean; player: TPlayer; audio: TAudio; effects: TEffects)
   ,Combat:function(Self, dt$1, dist, sees, player$1, audio, effects$1) {
      Self.ShotTimer -= dt$1;
      Self.BurstCooldown -= dt$1;
      if ((!(sees)) || Self.Awareness < 0.6 || Self.FFlinch > 0.5) {
         return;
      }
      if (Self.BurstLeft <= 0 && Self.BurstCooldown <= 0) {
         Self.BurstLeft = 3 + Floor(Math.random() * 4);
      }
      if (Self.BurstLeft > 0 && Self.ShotTimer <= 0 && Self.Ready < 0.35) {
         Self.BurstLeft -= 1;
         Self.ShotTimer = 0.1 + Math.random() * 0.04;
         if (!Self.BurstLeft) {
            Self.BurstCooldown = 0.9 + Math.random() * 1.4;
         }
         TEnemy.Shoot(Self,dist,player$1,audio,effects$1);
      }
   }
   /// constructor TEnemy.Create(scene: JScene; world: TWorld; pos: JVector3)
   ,Create$82:function(Self, scene$1, world$1, pos$4) {
      function MakeLimb(parent$2, x$5, y$5, len) {
         var Result = null;
         Result = TObject.Create($New(TLimb));
         Result.Upper = Grp(parent$2,x$5,y$5,0);
         Result.Lower = Grp(Result.Upper,0,len,0);
         return Result
      }
      Self.FScene = scene$1;
      Self.FWorld$2 = world$1;
      Self.Root$1 = new THREE.Group();
      Self.Root$1.position.copy(pos$4);
      scene$1.add(Self.Root$1);
      Self.Body$1 = Grp(Self.Root$1,0,0,0);
      Self.Hips = Grp(Self.Body$1,0,0.95,0);
      Self.Spine = Grp(Self.Hips,0,0.08,0);
      Self.Head = Grp(Self.Spine,0,0.62,0.02);
      Self.ArmR = MakeLimb(Self.Spine,-0.2,0.42,-0.28);
      Self.ArmL = MakeLimb(Self.Spine,0.2,0.42,-0.28);
      Self.LegR = MakeLimb(Self.Hips,-0.1,-0.05,-0.43);
      Self.LegL = MakeLimb(Self.Hips,0.1,-0.05,-0.43);
      Self.Gun = Grp(Self.Spine,0,0,0);
      Self.Gun.add(GunTmpl.clone());
      Self.Muzzle = Grp(Self.Gun,MuzzleOfs.x,MuzzleOfs.y,MuzzleOfs.z + 0.02);
      Self.FModel = THREEX.SkeletonUtils.clone(Tmpl);
      Self.Body$1.add(Self.FModel);
      Self.FModel.traverse(function (o$1) {
         var n$22 = "";
         if (o$1.isBone) {
            n$22 = ShortName(o$1.name);
            if (RIG.indexOf(n$22) >= 0 || IsFingerBone(n$22)) {
               Self.FBones[n$22]=o$1;
            }
         }
      });
      Self.ReadyOverride = -1;
      for(let i$2=0,$temp87=FingerNames.length;i$2<$temp87;i$2++) {
         if ((Self.FBones[FingerNames[i$2]]||null)) {
            (Self.FBones[FingerNames[i$2]]||null).quaternion.copy(FingerQuats[i$2]);
         }
      }
      Self.HP$1 = 100;
      Self.Alive$1 = true;
      Self.State$1 = "advance";
      Self.FVel = V3Zero();
      Self.FWalkPhase = Math.random() * 10;
      Self.BurstCooldown = 1 + Math.random() * 2;
      Self.FLastPos = pos$4.clone();
      Self.FDeathAxis = V3(1,0,0);
      Self.FStrafeDir = (Math.random() < 0.5)?-1:1;
      return Self
   }
   /// function TEnemy.Damage(amount: Float; dir: JVector3; zone: String) : Boolean
   ,Damage$1:function(Self, amount, dir, zone) {
      var Result = false;
      if (!(Self.Alive$1)) {
         return false;
      }
      Self.HP$1 -= amount;
      Self.FFlinch = 1;
      Self.Awareness = 1;
      if (Self.HP$1 <= 0) {
         Self.Alive$1 = false;
         Self.State$1 = "dead";
         _v$1.set(dir.x,0,dir.z).normalize();
         Self.FDeathAxis.crossVectors(V3(0,1,0),_v$1).normalize();
         Self.FDeathStyle = (zone == "head")?1:(Math.random() < 0.5)?0:2;
         return true;
      }
      Result = false;
      return Result
   }
   /// procedure TEnemy.Dispose()
   ,Dispose:function(Self) {
      Self.FScene.remove(Self.Root$1);
      if (Self.Gun.parent === Self.FScene) {
         Self.FScene.remove(Self.Gun);
      }
   }
   /// function TEnemy.EyePos(target: JVector3) : JVector3
   ,EyePos:function(Self, target$2) {
      var Result = null;
      Result = target$2.set(Self.Root$1.position.x,Self.Root$1.position.y + 1.6 - Self.FCrouch * 0.5,Self.Root$1.position.z);
      return Result
   }
   /// function TEnemy.HitTest(o: JVector3; d: JVector3; maxT: Float) : TZoneHit
   ,HitTest:function(Self, o$1, d$9, maxT$1) {
      var Result = null;
      var best = null,
         headW = null,
         hipW = null,
         neck = null,
         foot = null;
      function Test(t$6, zone) {
         if (t$6 > 0 && t$6 < maxT$1 && (!best || t$6 < best.T$3)) {
            best = TObject.Create($New(TZoneHit));
            best.T$3 = t$6;
            best.Zone$1 = zone;
         }
      }
      if (!(Self.Alive$1)) {
         return null;
      }
      Self.Root$1.updateMatrixWorld(true);
      best = null;
      headW = Self.Head.getWorldPosition(_v$1);
      Test(RaySphere(o$1,d$9,headW,0.15),"head");
      hipW = Self.Hips.getWorldPosition(_v2$1);
      neck = _v3.set(0,0.54,0);
      Self.Spine.localToWorld(neck);
      Test(RayCapsule(o$1,d$9,hipW,neck,0.25),"body");
      foot = V3(Self.Root$1.position.x,Self.Root$1.position.y + 0.1,Self.Root$1.position.z);
      Test(RayCapsule(o$1,d$9,foot,hipW,0.17),"legs");
      Result = best;
      return Result
   }
   /// procedure TEnemy.MoveToward(t: JVector3; dt: Float; spd: Float)
   ,MoveToward:function(Self, t$6, dt$1, spd) {
      var pos$4 = null,
         probe = null,
         h$4 = null;
      pos$4 = Self.Root$1.position;
      _v2$1.set(t$6.x - pos$4.x,0,t$6.z - pos$4.z).normalize();
      probe = V3(pos$4.x,0.5,pos$4.z);
      h$4 = TWorld.Raycast(Self.FWorld$2,probe,_v2$1,1.8);
      if (!!h$4 && h$4.T$1 < 1.8) {
         _v3.set(-_v2$1.z,0,_v2$1.x).multiplyScalar(Self.FStrafeDir);
         _v2$1.lerp(_v3,0.85).normalize();
      }
      Self.FVel.x = Damp(Self.FVel.x,_v2$1.x * spd,6,dt$1);
      Self.FVel.z = Damp(Self.FVel.z,_v2$1.z * spd,6,dt$1);
      pos$4.x += Self.FVel.x * dt$1;
      pos$4.z += Self.FVel.z * dt$1;
      Self.Speed = Math.hypot(Self.FVel.x,Self.FVel.z);
      Self.FCrouch = Damp(Self.FCrouch,0,5,dt$1);
   }
   /// procedure TEnemy.PickCover(points: array of JVector3; player: TPlayer)
   ,PickCover:function(Self, points, player$1) {
      var pp = null,
         pHead = null,
         myD = 0,
         best = null,
         bestScore = 0,
         eye = null,
         a$227 = 0,
         c$12 = null,
         dp$1 = 0,
         ds = 0,
         los = false,
         score = 0,
         a$119 = 0;
      pp = player$1.Pos$4;
      pHead = TPlayer.HeadPos(player$1,V3Zero());
      myD = Self.Root$1.position.distanceTo(pp);
      best = null;
      bestScore = 1E30;
      eye = V3Zero();
      var $temp88;
      for(a$227=0,$temp88=points.length;a$227<$temp88;a$227++) {
         c$12 = points[a$227];
         dp$1 = c$12.distanceTo(pp);
         if (dp$1 < 8 || dp$1 > 45) {
            continue;
         }
         ds = c$12.distanceTo(Self.Root$1.position);
         if (ds > 45) {
            continue;
         }
         eye.set(c$12.x,1.5,c$12.z);
         los = TWorld.LineOfSight(Self.FWorld$2,eye,pHead);
         score = ds * 0.45 + Abs$_Float_(dp$1 - 18) * 0.8 + ((los)?0:16) + ((dp$1 > myD + 4)?10:0) + Math.random() * 7;
         if (score < bestScore) {
            bestScore = score;
            best = c$12;
         }
      }
      if (!best || Self.FUnseen > 6) {
         a$119 = Math.random() * 3.14159265358979 * 2;
         best = V3(pp.x + Cos(a$119) * 7,0,pp.z + Sin(a$119) * 7);
         Self.FUnseen = 0;
      }
      Self.FTarget = best.clone().add(V3((Math.random() - 0.5) * 1.5,0,(Math.random() - 0.5) * 1.5));
      Self.FStateTimer = 12;
   }
   /// function TEnemy.Rel(group: JObject3D; target: JQuaternion) : JQuaternion
   ,Rel:function(Self, group, target$2) {
      var Result = null;
      Result = target$2.copy(_qb).invert().multiply(group.getWorldQuaternion(_q2));
      return Result
   }
   /// procedure TEnemy.Retarget()
   ,Retarget:function(Self) {
      var q$3 = null,
         dHips = null,
         dSpine = null,
         dHead = null,
         hipOff = null,
         want = null,
         t$6 = null,
         qq = null,
         sc$1 = null,
         lowW = null,
         lp = null,
         lq = null,
         ap = null,
         aq = null,
         pq = null,
         gq = null;
      function Leg(side$2, L) {
         var hipW = null,
            kneeW = null,
            ankleW = null;
         hipW = L.Upper.getWorldPosition(V3Zero());
         kneeW = L.Lower.getWorldPosition(V3Zero());
         ankleW = L.Lower.localToWorld(V3(0,-0.44,0));
         TEnemy.AimBone(Self,side$2 + "UpLeg",kneeW.clone().sub(hipW).normalize());
         TEnemy.AimBone(Self,side$2 + "Leg",ankleW.clone().sub(kneeW).normalize());
         TEnemy.ApplyDelta(Self,side$2 + "Foot",TEnemy.Rel(Self,L.Lower,q$3));
      }
      function Arm(side$2, A$1, G$1, gq$1) {
         var up$1 = { v : null },
            fore$1 = { v : null },
            sh = null,
            lg = null,
            wrist = null,
            i$2 = 0,
            e$1 = null,
            h$4 = null,
            align = null;
         sh = (Self.FBones[side$2 + "Arm"]||null).getWorldPosition(V3Zero());
         if (Self.Alive$1) {
            lg = G$1.Pos$5.clone();
            wrist = Self.Gun.localToWorld(lg.clone());
            i$2 = 0;
            while (i$2 < 12 && side$2 == "Left" && sh.distanceTo(wrist) > LenUpper + LenFore - 0.01) {
               lg.z -= 0.025;
               wrist = Self.Gun.localToWorld(lg.clone());
               i$2++;
            }
            IK(sh,wrist,LenUpper,LenFore,G$1.Pole$1.clone().applyQuaternion(_qb).normalize(),up$1,fore$1);
         } else {
            e$1 = A$1.Lower.getWorldPosition(V3Zero());
            h$4 = A$1.Lower.localToWorld(V3(0,-0.28,0));
            up$1.v = e$1.clone().sub(A$1.Upper.getWorldPosition(V3Zero())).normalize();
            fore$1.v = h$4.sub(e$1).normalize();
         }
         TEnemy.AimBone(Self,side$2 + "Arm",up$1.v);
         align = TEnemy.AimBone(Self,side$2 + "ForeArm",fore$1.v);
         if (Self.Alive$1) {
            _q$2.copy(gq$1).multiply(G$1.Quat);
         } else {
            _q$2.copy(_qb).multiply((Rest[side$2 + "Hand"]||null).Q$1).premultiply(align);
         }
         TEnemy.SetBoneWorld(Self,(Self.FBones[side$2 + "Hand"]||null),_q$2);
      }
      Self.Body$1.updateMatrixWorld(true);
      Self.Body$1.getWorldQuaternion(_qb);
      dHips = TEnemy.Rel(Self,Self.Hips,new THREE.Quaternion());
      dSpine = TEnemy.Rel(Self,Self.Spine,new THREE.Quaternion());
      dHead = TEnemy.Rel(Self,Self.Head,new THREE.Quaternion());
      hipOff = Self.Body$1.worldToLocal(Self.Hips.getWorldPosition(V3Zero()));
      want = (Rest["Hips"]||null).P$1.clone().add(hipOff.sub(V3(0,0.95,0)));
      Self.Body$1.localToWorld(want);
      (Self.FBones["Hips"]||null).position.copy((Self.FBones["Hips"]||null).parent.worldToLocal(want));
      TEnemy.ApplyDelta(Self,"Hips",dHips);
      q$3 = new THREE.Quaternion();
      TEnemy.ApplyDelta(Self,"Spine",q$3.slerpQuaternions(dHips,dSpine,0.34));
      TEnemy.ApplyDelta(Self,"Spine1",q$3.slerpQuaternions(dHips,dSpine,0.67));
      TEnemy.ApplyDelta(Self,"Spine2",dSpine);
      TEnemy.ApplyDelta(Self,"LeftShoulder",dSpine);
      TEnemy.ApplyDelta(Self,"RightShoulder",dSpine);
      TEnemy.ApplyDelta(Self,"Neck",q$3.slerpQuaternions(dSpine,dHead,0.5));
      TEnemy.ApplyDelta(Self,"Head",dHead);
      Leg("Left",Self.LegL);
      Leg("Right",Self.LegR);
      if (Self.Alive$1 && Self.Ready > 0.001) {
         for(let i$2=0,$temp89=UpperNames.length;i$2<$temp89;i$2++) {
            if ((Self.FBones[UpperNames[i$2]]||null)) {
               (Self.FBones[UpperNames[i$2]]||null).quaternion.slerp(UpperQuats[i$2],Self.Ready);
            }
         }
         (Self.FBones["Spine"]||null).updateMatrixWorld(true);
         t$6 = V3Zero();
         qq = new THREE.Quaternion();
         sc$1 = V3Zero();
         (Self.FBones["Spine2"]||null).matrixWorld.decompose(t$6,qq,sc$1);
         lowW = new THREE.Matrix4().compose(t$6,qq,V3(1,1,1)).multiply(GunInChest);
         lp = V3Zero();
         lq = new THREE.Quaternion();
         lowW.decompose(lp,lq,sc$1);
         ap = Self.Gun.getWorldPosition(V3Zero());
         aq = Self.Gun.getWorldQuaternion(new THREE.Quaternion());
         ap.lerp(lp,Self.Ready);
         aq.slerp(lq,Self.Ready);
         pq = Self.Gun.parent.getWorldQuaternion(new THREE.Quaternion());
         Self.Gun.position.copy(Self.Gun.parent.worldToLocal(ap));
         Self.Gun.quaternion.copy(pq.invert().multiply(aq));
         Self.Gun.updateMatrixWorld(true);
      }
      gq = Self.Gun.getWorldQuaternion(new THREE.Quaternion());
      Arm("Left",Self.ArmL,GripL,gq);
      Arm("Right",Self.ArmR,GripR,gq);
   }
   /// procedure TEnemy.SetBoneWorld(bone: JObject3D; worldQ: JQuaternion)
   ,SetBoneWorld:function(Self, bone$1, worldQ) {
      bone$1.parent.getWorldQuaternion(_qp);
      bone$1.quaternion.copy(_qp.invert().multiply(worldQ));
      bone$1.updateMatrixWorld(true);
   }
   /// procedure TEnemy.Shoot(dist: Float; player: TPlayer; audio: TAudio; effects: TEffects)
   ,Shoot:function(Self, dist, player$1, audio, effects$1) {
      var mz = null,
         target$2 = null,
         p$3 = 0,
         hit = false,
         dir = null,
         spread = 0,
         h$4 = null,
         e$1 = null,
         pp = null,
         toP = null,
         proj = 0,
         closest = null;
      mz = Self.Muzzle.getWorldPosition(V3Zero());
      target$2 = TPlayer.HeadPos(player$1,V3Zero()).add(V3(0,-0.35,0));
      p$3 = 0.42 - dist * 0.008;
      p$3 *= (TPlayer.Moving(player$1))?0.6:1;
      p$3 *= (player$1.Crouching)?0.75:1;
      p$3 *= Self.Awareness;
      p$3 = MaxF(0.05,p$3) * player$1.Difficulty;
      hit = Math.random() < p$3;
      dir = target$2.clone().sub(mz).normalize();
      if (!(hit)) {
         spread = 0.02 + Math.random() * 0.03;
         dir.x += (Math.random() - 0.5) * spread * 2;
         dir.y += (Math.random() - 0.3) * spread;
         dir.z += (Math.random() - 0.5) * spread * 2;
         dir.normalize();
      }
      h$4 = TWorld.Raycast(Self.FWorld$2,mz,dir,200);
      e$1 = (h$4)?h$4.Point:mz.clone().addScaledVector(dir,200);
      TEffects.Flash$1(effects$1,mz,25,0.05,16754768,8);
      TParticle.SetColor(TParticle.SetAlpha(TParticle.SetSize(TParticleSystem.Spawn(effects$1.Glow,mz,null,0.05),0.35,0.2),1,0),4,2.6,1.2);
      if (Math.random() < 0.5) {
         TEffects.Tracer(effects$1,mz,e$1,300);
      }
      TAudio.EnemyShot(audio,mz);
      if (hit) {
         TPlayer.TakeDamage(player$1,6 + Math.random() * 5,mz);
      } else {
         if (h$4) {
            TEffects.Impact$1(effects$1,h$4.Point,h$4.Normal,h$4.Surf,dir);
            if (h$4.T$1 > 3 && h$4.Point.distanceTo(player$1.Pos$4) < 8) {
               TAudio.Impact(audio,h$4.Point,h$4.Surf);
            }
         }
         pp = TPlayer.HeadPos(player$1,V3Zero());
         toP = pp.clone().sub(mz);
         proj = toP.dot(dir);
         if (proj > 0) {
            closest = mz.clone().addScaledVector(dir,proj);
            if (closest.distanceTo(pp) < 2.5) {
               TAudio.Whiz(audio,closest);
            }
         }
      }
   }
   /// procedure TEnemy.Update(dt: Float; ctx: TEnemyCtx)
   ,Update$4:function(Self, dt$1, ctx) {
      var player$1 = null,
         audio = null,
         effects$1 = null,
         pos$4 = null,
         eye = null,
         pHead = null,
         toP = null,
         dist = 0,
         sees = false,
         dx = 0,
         dz = 0,
         d$9 = 0,
         desiredYaw = 0,
         dy = 0,
         a$228 = 0,
         o$1 = null,
         ddx = 0,
         ddz = 0,
         dd = 0,
         k$8 = 0,
         v$3 = null,
         a$229 = [];
      player$1 = ctx.Player$1;
      audio = ctx.Audio$1;
      effects$1 = ctx.Effects$1;
      if (!(Self.Alive$1)) {
         TEnemy.UpdateDeath(Self,dt$1);
         return;
      }
      pos$4 = Self.Root$1.position;
      eye = TEnemy.EyePos(Self,V3Zero());
      pHead = TPlayer.HeadPos(player$1,V3Zero());
      toP = _v$1.subVectors(pHead,eye);
      dist = toP.length();
      sees = dist < 110 && TWorld.LineOfSight(Self.FWorld$2,eye,pHead);
      Self.Awareness = (sees)?MinF(1,Self.Awareness + dt$1 * 0.8):MaxF(0.35,Self.Awareness - dt$1 * 0.1);
      Self.FUnseen = (sees)?0:Self.FUnseen + dt$1;
      Self.FStateTimer -= dt$1;
      Self.FFlinch = MaxF(0,Self.FFlinch - dt$1 * 4);
      Self.FFiringRecent = Self.BurstLeft > 0 || Self.ShotTimer > -0.8 || sees && Self.Awareness > 0.8 && dist < 45;
      if (Self.State$1 == "advance") {
         if (!Self.FTarget || Self.FStateTimer < 0) {
            TEnemy.PickCover(Self,ctx.CoverPoints$1,player$1);
         }
         dx = Self.FTarget.x - pos$4.x;
         dz = Self.FTarget.z - pos$4.z;
         d$9 = Math.hypot(dx,dz);
         if (d$9 < 0.8) {
            Self.State$1 = "cover";
            Self.FStateTimer = 3 + Math.random() * 5;
         } else {
            TEnemy.MoveToward(Self,Self.FTarget,dt$1,(sees && dist < 30)?2.2:3.6);
         }
         if (sees && Self.Awareness > 0.8 && dist < 45) {
            TEnemy.Combat(Self,dt$1,dist,sees,player$1,audio,effects$1);
         }
      } else if (Self.State$1 == "cover") {
         Self.Speed = Damp(Self.Speed,0,8,dt$1);
         if (sees) {
            _v2$1.set(-toP.z,0,toP.x).normalize().multiplyScalar(Self.FStrafeDir * 0.8);
            Self.FVel.x = Damp(Self.FVel.x,_v2$1.x,3,dt$1);
            Self.FVel.z = Damp(Self.FVel.z,_v2$1.z,3,dt$1);
            if (Math.random() < dt$1 * 0.4) {
               Self.FStrafeDir = -Self.FStrafeDir;
            }
         } else {
            Self.FVel.x = Damp(Self.FVel.x,0,6,dt$1);
            Self.FVel.z = Damp(Self.FVel.z,0,6,dt$1);
         }
         Self.FCrouch = Damp(Self.FCrouch,(sees)?0:1,4,dt$1);
         pos$4.x += Self.FVel.x * dt$1;
         pos$4.z += Self.FVel.z * dt$1;
         Self.Speed = Math.hypot(Self.FVel.x,Self.FVel.z);
         TEnemy.Combat(Self,dt$1,dist,sees,player$1,audio,effects$1);
         if (Self.FStateTimer < 0 || dist < 6 || (!(sees)) && Self.FUnseen > 3.5) {
            Self.State$1 = "advance";
            Self.FTarget = null;
         }
      }
      desiredYaw = Self.Yaw$2;
      if (Self.Awareness > 0.5 && (sees || Self.State$1 == "cover")) {
         desiredYaw = Math.atan2(toP.x,toP.z);
      } else if (Self.FVel.lengthSq() > 0.1) {
         desiredYaw = Math.atan2(Self.FVel.x,Self.FVel.z);
      }
      dy = desiredYaw - Self.Yaw$2;
      while (dy > 3.14159265358979) {
         dy -= 6.28318530717959;
      }
      while (dy < -3.14159265358979) {
         dy += 6.28318530717959;
      }
      Self.Yaw$2 += dy * MinF(1,dt$1 * 8);
      Self.Root$1.rotation.y = Self.Yaw$2;
      Self.AimPitch = Math.atan2(toP.y,Math.hypot(toP.x,toP.z));
      a$229 = ctx.Enemies$2;
      var $temp90;
      for(a$228=0,$temp90=a$229.length;a$228<$temp90;a$228++) {
         o$1 = a$229[a$228];
         if (o$1 === Self || (!(o$1.Alive$1))) {
            continue;
         }
         ddx = pos$4.x - o$1.Root$1.position.x;
         ddz = pos$4.z - o$1.Root$1.position.z;
         dd = ddx*ddx + ddz*ddz;
         if (dd < 1 && dd > 0.0001) {
            k$8 = (1 - Sqrt(dd)) * dt$1 * 3;
            pos$4.x += ddx * k$8;
            pos$4.z += ddz * k$8;
         }
      }
      v$3 = V3(Self.FVel.x,-1,Self.FVel.z);
      pos$4.y = MaxF(pos$4.y - dt$1 * 4,0);
      TWorld.Collide(Self.FWorld$2,pos$4,v$3,0.3,1.7,0.45);
      Self.FStuckTimer += dt$1;
      if (Self.FStuckTimer > 1.5) {
         if (pos$4.distanceTo(Self.FLastPos) < 0.6 && Self.State$1 == "advance") {
            Self.FTarget = null;
            Self.FStrafeDir = -Self.FStrafeDir;
         }
         Self.FLastPos.copy(pos$4);
         Self.FStuckTimer = 0;
      }
      TEnemy.Animate(Self,dt$1);
   }
   /// procedure TEnemy.UpdateDeath(dt: Float)
   ,UpdateDeath:function(Self, dt$1) {
      var t$6 = 0,
         e$1 = 0,
         fall = 0;
      Self.DeathT += dt$1;
      t$6 = MinF(1,Self.DeathT / ((Self.FDeathStyle == 1)?0.5:0.8));
      e$1 = (t$6 < 1)?t$6*t$6 * (1.8 - 0.8 * t$6):1;
      fall = e$1 * 1.4907963267949;
      Self.Body$1.quaternion.setFromAxisAngle(TEnemy.WorldToLocalAxis(Self,Self.FDeathAxis),fall);
      Self.LegR.Lower.rotation.x = Damp(Self.LegR.Lower.rotation.x,0.6 + Self.FDeathStyle * 0.3,6,dt$1);
      Self.LegL.Lower.rotation.x = Damp(Self.LegL.Lower.rotation.x,0.2,6,dt$1);
      Self.Hips.position.y = Damp(Self.Hips.position.y,0.95 - ((Self.FDeathStyle == 2)?0.3:0),5,dt$1);
      Self.ArmR.Upper.rotation.x = Damp(Self.ArmR.Upper.rotation.x,-2.6,3,dt$1);
      Self.ArmL.Upper.rotation.x = Damp(Self.ArmL.Upper.rotation.x,-0.5,3,dt$1);
      Self.ArmL.Upper.rotation.z = Damp(Self.ArmL.Upper.rotation.z,-1.2,3,dt$1);
      Self.Head.rotation.x = Damp(Self.Head.rotation.x,0.4,3,dt$1);
      if (Self.DeathT > 1.5 && Self.Gun.parent === Self.Spine) {
         Self.Gun.getWorldPosition(_v$1);
         Self.FScene.add(Self.Gun);
         Self.Gun.position.set(_v$1.x + 0.3,0.04,_v$1.z);
         Self.Gun.rotation.set(0,Math.random() * 6,1.5707963267949);
      }
      if (Self.DeathT > 12) {
         Self.Root$1.position.y -= dt$1 * 0.3;
      }
      TEnemy.Retarget(Self);
   }
   /// function TEnemy.WorldToLocalAxis(a: JVector3) : JVector3
   ,WorldToLocalAxis:function(Self, a$119) {
      var Result = null;
      var q$3 = null;
      q$3 = new THREE.Quaternion().setFromAxisAngle(V3(0,1,0),-Self.Yaw$2);
      Result = a$119.clone().applyQuaternion(q$3);
      return Result
   }
   ,Destroy:TObject.Destroy
};
function LoadSoldier(done) {
   var names = [],
      left$2 = 0,
      a$94 = 0,
      n$22 = "";
   if (Loaded) {
      done();
      return;
   }
   names = Object.keys(SOLDIER.mats);
   left$2 = names.length;
   var $temp91;
   for(a$94=0,$temp91=names.length;a$94<$temp91;a$94++) {
      n$22 = names[a$94];
      LoadMat(n$22,SOLDIER.mats[n$22],function () {
         left$2 -= 1;
         if (!left$2) {
            BuildShared();
            done();
         }
      });
   }
}
function SolveArm(arm, side$2, target$2) {
   var L1 = 0,
      L2 = 0,
      S = null,
      d$7 = 0,
      pole$1 = null,
      ang = 0,
      upper$1 = null,
      E = null,
      fore = null;
   L1 = 0.28;
   L2 = 0.28;
   S = arm.Upper.position;
   _a.subVectors(target$2,S);
   d$7 = ClampF(_a.length(),0.05,L1 + L2 - 0.002);
   _a.normalize();
   pole$1 = _b.set(side$2 * 0.7,-1,-0.15).normalize();
   ang = Math.acos(ClampF((L1*L1 + d$7*d$7 - L2*L2) / (2 * L1 * d$7),-1,1));
   _n.crossVectors(_a,pole$1).normalize();
   upper$1 = _a.clone().applyAxisAngle(_n,ang);
   E = S.clone().addScaledVector(upper$1,L1);
   fore = _b.subVectors(target$2,E).normalize();
   _qa.setFromUnitVectors(DOWN,upper$1);
   arm.Upper.quaternion.copy(_qa);
   _qc.setFromUnitVectors(DOWN,fore);
   arm.Lower.quaternion.copy(_qa.invert().multiply(_qc));
}
function ShortName(n$22) {
   var Result = "";
   var s$5 = "",
      i$1 = 0;
   s$5 = n$22;
   if (Copy$_String_Integer_Integer_(s$5,1,9) == "mixamorig") {
      s$5 = Copy$_String_Integer_Integer_(s$5,10,s$5.length);
      if (Copy$_String_Integer_Integer_(s$5,1,1) == ":") {
         s$5 = Copy$_String_Integer_Integer_(s$5,2,s$5.length);
      }
   }
   i$1 = s$5.length;
   while (i$1 > 0 && s$5.charAt(i$1-1) >= "0" && s$5.charAt(i$1-1) <= "9") {
      i$1-=1;
   }
   if (i$1 < s$5.length && i$1 > 0 && s$5.charAt(i$1-1) == "_") {
      s$5 = Copy$_String_Integer_Integer_(s$5,1,i$1 - 1);
   }
   Result = s$5;
   return Result
}
function RaySphere(o$1, d$9, c$12, r$3) {
   var Result = 0;
   var ox = 0,
      oy = 0,
      oz = 0,
      b$5 = 0,
      cc = 0,
      h$2 = 0;
   ox = o$1.x - c$12.x;
   oy = o$1.y - c$12.y;
   oz = o$1.z - c$12.z;
   b$5 = ox * d$9.x + oy * d$9.y + oz * d$9.z;
   cc = ox*ox + oy*oy + oz*oz - r$3*r$3;
   h$2 = b$5*b$5 - cc;
   if (h$2 < 0) {
      return -1;
   }
   Result = (-b$5) - Sqrt(h$2);
   return Result
}
function RayCapsule(ro, rd, pa, pb, r$3) {
   var Result = 0;
   var ba = null,
      oa = null,
      baba = 0,
      bard = 0,
      baoa = 0,
      rdoa = 0,
      oaoa = 0,
      a$95 = 0,
      b$6 = 0,
      c$11 = 0,
      h$3 = 0,
      t$6 = 0,
      y$5 = 0,
      oc = null,
      bb = 0,
      cc$1 = 0,
      hh = 0;
   ba = V3Zero().subVectors(pb,pa);
   oa = V3Zero().subVectors(ro,pa);
   baba = ba.dot(ba);
   bard = ba.dot(rd);
   baoa = ba.dot(oa);
   rdoa = rd.dot(oa);
   oaoa = oa.dot(oa);
   a$95 = baba - bard*bard;
   b$6 = baba * rdoa - baoa * bard;
   c$11 = baba * oaoa - baoa*baoa - r$3*r$3 * baba;
   h$3 = b$6*b$6 - a$95 * c$11;
   if (h$3 >= 0) {
      t$6 = ((-b$6) - Sqrt(h$3)) / a$95;
      y$5 = baoa + t$6 * bard;
      if (y$5 > 0 && y$5 < baba) {
         return t$6;
      }
      oc = (y$5 <= 0)?oa:V3Zero().subVectors(ro,pb);
      bb = rd.dot(oc);
      cc$1 = oc.dot(oc) - r$3*r$3;
      hh = bb*bb - cc$1;
      if (hh > 0) {
         return (-bb) - Sqrt(hh);
      }
   }
   Result = -1;
   return Result
}
function LoadTex(url, srgb, cb) {
   var img$5 = null;
   if (!url) {
      cb(null);
      return;
   }
   img$5 = new Image();
   img$5.onload = function () {
      var t$5 = null;
      t$5 = new THREE.Texture(img$5);
      t$5.flipY = false;
      t$5.colorSpace = (srgb)?"srgb":"";
      t$5.wrapS = 1000;
      t$5.wrapT = 1000;
      t$5.anisotropy = 4;
      t$5.needsUpdate = true;
      cb(t$5);
   };
   img$5.onerror = function () {
      cb(null);
   };
   img$5.src = String(url);
}
function LoadMat(mname, m$3, done) {
   var left$3 = 0,
      tMap = null,
      tNrm = null,
      tRm = null,
      fin = null;
   left$3 = 3;
   fin = function () {
      var tr = false;
      left$3 -= 1;
      if (left$3 > 0) {
         return;
      }
      tr = m$3.transparent;
      SMats[mname]=new THREE.MeshStandardMaterial({
         "transparent" : tr
         ,"roughnessMap" : tRm
         ,"roughness" : Coalesce(m$3.rough,1)
         ,"normalMap" : tNrm
         ,"name" : mname
         ,"metalnessMap" : tRm
         ,"metalness" : Coalesce(m$3.metal,0)
         ,"map" : tMap
         ,"color" : new THREE.Color(0,0,0).fromArray(m$3.color)
         ,"alphaTest" : (tr)?0.3:0
      });
      done();
   };
   LoadTex(m$3.map,true,function (t$6) {
      tMap = t$6;
      fin();
   });
   LoadTex(m$3.normal,false,function (t$6) {
      tNrm = t$6;
      fin();
   });
   LoadTex(m$3.rm,false,function (t$6) {
      tRm = t$6;
      fin();
   });
}
function IsFingerBone(n$22) {
   var Result = false;
   var a$104 = 0,
      f$3 = "",
      tail = "",
      a$103 = ["","","","",""];
   a$103 = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
   for(a$104=0;a$104<=4;a$104++) {
      f$3 = a$103[a$104];
      for(let d$9=1;d$9<=3;d$9++) {
         tail = "Hand"+f$3+IntStr(d$9);
         if (n$22.length >= tail.length && Copy$_String_Integer_Integer_(n$22,n$22.length - tail.length + 1,tail.length) == tail) {
            return true;
         }
      }
   }
   Result = false;
   return Result
}
function IK(S$1, T$5, L1$1, L2$1, pole$2, up$1, fore$1) {
   var a$105 = null,
      d$8 = 0,
      ang$1 = 0,
      n$20 = null,
      E$1 = null;
   a$105 = T$5.clone().sub(S$1);
   d$8 = ClampF(a$105.length(),0.05,L1$1 + L2$1 - 0.002);
   a$105.normalize();
   ang$1 = Math.acos(ClampF((L1$1*L1$1 + d$8*d$8 - L2$1*L2$1) / (2 * L1$1 * d$8),-1,1));
   n$20 = V3Zero().crossVectors(a$105,pole$2).normalize();
   up$1.v = a$105.clone().applyAxisAngle(n$20,ang$1);
   E$1 = S$1.clone().addScaledVector(up$1.v,L1$1);
   fore$1.v = T$5.clone().sub(E$1).normalize();
}
function Grp(parent$2, x$5, y$5, z$3) {
   var Result = null;
   Result = new THREE.Group();
   Result.position.set(x$5,y$5,z$3);
   parent$2.add(Result);
   return Result
}
function Dequant(q$3, comps) {
   var Result = null;
   var src$1 = null,
      k$8 = 0;
   src$1 = new Uint16Array(Bytes(q$3.q).buffer);
   Result = new Float32Array(src$1.length);
   for(let i$2=0,$temp92=src$1.length;i$2<$temp92;i$2++) {
      k$8 = i$2 % comps;
      Result[i$2]=(q$3.min[k$8] + src$1[i$2] / 65535 * (q$3.max[k$8] - q$3.min[k$8]));
   }
   return Result
}
function Coalesce(v$3, d$9) {
   var Result = 0;
   Result = (v$3 ?? d$9);
   return Result
}
function Bytes(str) {
   var Result = null;
   var bin$1 = "";
   bin$1 = atob(str);
   Result = new Uint8Array(bin$1.length);
   for(let i$2=0,$temp93=bin$1.length;i$2<$temp93;i$2++) {
      Result[i$2]=CharCode(bin$1,i$2);
   }
   return Result
}
function BuildShared() {
   var D$2 = null,
      bones$1 = [],
      worlds = [],
      a$116 = 0,
      b$7 = null,
      o$1 = null,
      b$8 = null,
      lm = null,
      parent$2 = null,
      skeleton = null,
      a$117 = 0,
      m$3 = null,
      sm = null,
      a$107 = 0,
      p$3 = null,
      mesh = null,
      a$114 = 0,
      o$2 = null,
      n$22 = "",
      r$3 = null,
      parents = [],
      childs = [],
      a$113 = 0,
      g$11 = null,
      m$4 = null,
      rig$1 = null,
      a$111 = 0,
      n$23 = "",
      spineY = 0,
      shoulder = null,
      a$109 = 0,
      n$24 = "",
      a$106 = [],
      a$108 = [],
      a$110 = [],
      a$112 = [],
      a$115 = [],
      a$118 = [];
   D$2 = SOLDIER;
   Tmpl = new THREE.Group();
   a$106 = D$2.bones;
   var $temp94;
   for(a$116=0,$temp94=a$106.length;a$116<$temp94;a$116++) {
      b$7 = a$106[a$116];
      o$1 = new THREE.Bone();
      o$1.name = b$7.n;
      bones$1.push(o$1);
      worlds.push(new THREE.Matrix4().compose(V3Zero().fromArray(b$7.t),new THREE.Quaternion().fromArray(b$7.q),V3(1,1,1)));
   }
   for(let i$2=0,$temp95=D$2.bones.length;i$2<$temp95;i$2++) {
      b$8 = D$2.bones[i$2];
      lm = (b$8.p >= 0)?worlds[b$8.p].clone().invert().multiply(worlds[i$2]):worlds[i$2].clone();
      lm.decompose(bones$1[i$2].position,bones$1[i$2].quaternion,bones$1[i$2].scale);
      parent$2 = (b$8.p >= 0)?bones$1[b$8.p]:Tmpl;
      parent$2.add(bones$1[i$2]);
   }
   Tmpl.updateMatrixWorld(true);
   skeleton = new THREE.Skeleton(bones$1);
   a$118 = D$2.meshes;
   var $temp96;
   for(a$117=0,$temp96=a$118.length;a$117<$temp96;a$117++) {
      m$3 = a$118[a$117];
      sm = new THREE.SkinnedMesh(BuildGeo(m$3),(SMats[m$3.mat]||null));
      sm.castShadow = true;
      sm.receiveShadow = true;
      sm.frustumCulled = false;
      Tmpl.add(sm);
      sm.bind(skeleton,new THREE.Matrix4());
   }
   a$115 = D$2.props;
   var $temp97;
   for(a$107=0,$temp97=a$115.length;a$107<$temp97;a$107++) {
      p$3 = a$115[a$107];
      mesh = new THREE.Mesh(BuildGeo(p$3),(SMats[p$3.mat]||null));
      mesh.castShadow = true;
      bones$1[p$3.bone].add(mesh);
   }
   var $temp98;
   for(a$114=0,$temp98=bones$1.length;a$114<$temp98;a$114++) {
      o$2 = bones$1[a$114];
      n$22 = ShortName(o$2.name);
      if (RIG.indexOf(n$22) >= 0) {
         r$3 = TObject.Create($New(TRestBone));
         r$3.Q$1 = o$2.getWorldQuaternion(new THREE.Quaternion());
         r$3.P$1 = o$2.getWorldPosition(V3Zero());
         Rest[n$22]=r$3;
      }
   }
   parents = ["LeftArm", "LeftForeArm", "RightArm", "RightForeArm", "LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"];
   childs = ["LeftForeArm", "LeftHand", "RightForeArm", "RightHand", "LeftLeg", "LeftFoot", "RightLeg", "RightFoot"];
   for(let k$8=0,$temp99=parents.length;k$8<$temp99;k$8++) {
      (Rest[parents[k$8]]||null).Dir = (Rest[childs[k$8]]||null).P$1.clone().sub((Rest[parents[k$8]]||null).P$1).normalize();
   }
   LenUpper = (Rest["RightForeArm"]||null).P$1.distanceTo((Rest["RightArm"]||null).P$1);
   LenFore = (Rest["RightHand"]||null).P$1.distanceTo((Rest["RightForeArm"]||null).P$1);
   GunTmpl = new THREE.Group();
   a$108 = D$2.gun;
   var $temp100;
   for(a$113=0,$temp100=a$108.length;a$113<$temp100;a$113++) {
      g$11 = a$108[a$113];
      m$4 = new THREE.Mesh(BuildGeo(g$11),(SMats[g$11.mat]||null));
      m$4.castShadow = true;
      GunTmpl.add(m$4);
   }
   rig$1 = D$2.rig;
   GripL = TObject.Create($New(TGrip));
   GripL.Pos$5 = V3Zero().fromArray(rig$1.hands.Left.pos);
   GripL.Quat = new THREE.Quaternion().fromArray(rig$1.hands.Left.quat);
   GripL.Pole$1 = V3Zero().fromArray(rig$1.hands.Left.pole);
   GripR = TObject.Create($New(TGrip));
   GripR.Pos$5 = V3Zero().fromArray(rig$1.hands.Right.pos);
   GripR.Quat = new THREE.Quaternion().fromArray(rig$1.hands.Right.quat);
   GripR.Pole$1 = V3Zero().fromArray(rig$1.hands.Right.pole);
   a$112 = Object.keys(rig$1.fingers);
   var $temp101;
   for(a$111=0,$temp101=a$112.length;a$111<$temp101;a$111++) {
      n$23 = a$112[a$111];
      FingerNames.push(ShortName(n$23));
      FingerQuats.push(new THREE.Quaternion().fromArray(rig$1.fingers[n$23]));
   }
   spineY = 1.03;
   Butt = V3Zero().fromArray(rig$1.butt);
   MuzzleOfs = V3Zero().fromArray(rig$1.muzzle);
   shoulder = (Rest["RightArm"]||null).P$1.clone().sub(V3(0,spineY,0));
   Pocket = shoulder.add(V3(0.07,0.05,0.07));
   a$110 = Object.keys(rig$1.upper);
   var $temp102;
   for(a$109=0,$temp102=a$110.length;a$109<$temp102;a$109++) {
      n$24 = a$110[a$109];
      UpperNames.push(n$24);
      UpperQuats.push(new THREE.Quaternion().fromArray(rig$1.upper[n$24]));
   }
   GunInChest = new THREE.Matrix4().compose(V3Zero().fromArray(rig$1.gunInChest.pos),new THREE.Quaternion().fromArray(rig$1.gunInChest.quat),V3(1,1,1));
   Loaded = true;
}
function BuildGeo(m$3) {
   var Result = null;
   var g$10 = null,
      n$21 = null,
      nf = null,
      ib = null;
   g$10 = new THREE.BufferGeometry();
   g$10.setAttribute("position",new THREE.BufferAttribute(Dequant(m$3.pos,3),3));
   n$21 = new Int8Array(Bytes(m$3.nrm).buffer);
   nf = new Float32Array(n$21.length);
   for(let i$2=0,$temp103=n$21.length;i$2<$temp103;i$2++) {
      nf[i$2]=(n$21[i$2] / 127);
   }
   g$10.setAttribute("normal",new THREE.BufferAttribute(nf,3));
   if (m$3.uv) {
      g$10.setAttribute("uv",new THREE.BufferAttribute(Dequant(m$3.uv,2),2));
   }
   if (m$3.si) {
      g$10.setAttribute("skinIndex",new THREE.Uint8BufferAttribute(Bytes(String(m$3.si)),4));
      g$10.setAttribute("skinWeight",new THREE.BufferAttribute(Bytes(String(m$3.sw)),4,true));
   }
   ib = Bytes(m$3.idx).buffer;
   if (m$3.big) {
      g$10.setIndex(new THREE.BufferAttribute(new Uint32Array(ib),1));
   } else {
      g$10.setIndex(new THREE.BufferAttribute(new Uint16Array(ib),1));
   }
   Result = g$10;
   return Result
}
/// THUD = class (TObject)
var THUD = {
   $ClassName:"THUD",$Parent:TObject
   ,$Init:function ($) {
      TObject.$Init($);
      $.FBannerTimer = undefined;
      $.FChSpread = $.FHitT = $.FMapScale = $.FMapSize = $.FPxPerDeg = 0;
      $.FCompassEnemies = [];
      $.FCompassStrip = $.FEl = $.FMapImg = $.FMM = $.FMMX = $.FWorld$1 = null;
      $.FHitKind = "";
      $.FIndicators = [];
   }
   /// procedure THUD.Banner(title: String; sub: String; dur: Float = 3)
   ,Banner:function(Self, title$1, sub$1, dur) {
      var b$7 = null;
      El("banner-title").textContent = title$1;
      El("banner-sub").textContent = sub$1;
      b$7 = El("banner");
      b$7.classList.add("show");
      clearTimeout(Self.FBannerTimer);
      Self.FBannerTimer = setTimeout(function () {
         b$7.classList.remove("show");
      },dur * 1000);
   }
   /// procedure THUD.BuildCompass()
   ,BuildCompass:function(Self) {
      var strip = null,
         html = "",
         d$9 = 0,
         x$5 = 0,
         lbl = "";
      strip = El("compass-strip");
      Self.FPxPerDeg = 4.2;
      html = "";
      for(let rep=-1;rep<=1;rep++) {
         d$9 = 0;
         while (d$9 < 360) {
            x$5 = (d$9 + rep * 360) * Self.FPxPerDeg;
            lbl = "";
            switch (d$9) {
               case 0 :
                  lbl = "N";
                  break;
               case 45 :
                  lbl = "NE";
                  break;
               case 90 :
                  lbl = "E";
                  break;
               case 135 :
                  lbl = "SE";
                  break;
               case 180 :
                  lbl = "S";
                  break;
               case 225 :
                  lbl = "SW";
                  break;
               case 270 :
                  lbl = "W";
                  break;
               case 315 :
                  lbl = "NW";
                  break;
            }
            if (lbl != "") {
               html += "<span class=\"card\" style=\"left:"+Num(x$5)+"px\">"+lbl+"<\/span>";
            } else {
               html += "<span style=\"left:"+Num(x$5)+"px\">"+IntStr(d$9)+"<\/span>";
            }
            html += "<span class=\"tick\" style=\"left:"+Num(x$5)+"px\"><\/span>";
            d$9 += 15;
         }
      }
      strip.innerHTML = html;
      Self.FCompassStrip = strip;
   }
   /// procedure THUD.BuildMapImage()
   ,BuildMapImage:function(Self) {
      var S$1 = 0,
         scale$2 = 0,
         c$12 = null,
         g$11 = null,
         a$230 = 0,
         c2$1 = null,
         h$4 = 0,
         w$2 = 0,
         d$9 = 0,
         a$231 = [];
      S$1 = 1024;
      scale$2 = 4;
      c$12 = NewCanvas(S$1,S$1);
      g$11 = c$12.getContext("2d");
      g$11.fillStyle = "#1b1d1c";
      g$11.fillRect(0,0,S$1,S$1);
      g$11.translate(S$1 / 2,S$1 / 2);
      g$11.fillStyle = "#353836";
      g$11.fillRect(-7 * scale$2,-100 * scale$2,14 * scale$2,200 * scale$2);
      g$11.fillRect(-70 * scale$2,-7 * scale$2,140 * scale$2,14 * scale$2);
      g$11.fillStyle = "#2a2c2b";
      a$231 = Self.FWorld$1.Colliders;
      var $temp104;
      for(a$230=0,$temp104=a$231.length;a$230<$temp104;a$230++) {
         c2$1 = a$231[a$230];
         h$4 = c2$1.Max$2.y - c2$1.Min$2.y;
         if (h$4 < 0.3) {
            continue;
         }
         w$2 = c2$1.Max$2.x - c2$1.Min$2.x;
         d$9 = c2$1.Max$2.z - c2$1.Min$2.z;
         if (w$2 > 200) {
            continue;
         }
         g$11.fillStyle = (h$4 > 3)?"#5b605c":"#8a8f86";
         g$11.fillRect(c2$1.Min$2.x * scale$2,c2$1.Min$2.z * scale$2,w$2 * scale$2,d$9 * scale$2);
         if (h$4 > 3) {
            g$11.strokeStyle = "rgba(0,0,0,0.5)";
            g$11.lineWidth = 2;
            g$11.strokeRect(c2$1.Min$2.x * scale$2,c2$1.Min$2.z * scale$2,w$2 * scale$2,d$9 * scale$2);
         }
      }
      Self.FMapImg = c$12;
      Self.FMapScale = scale$2;
      Self.FMapSize = S$1;
   }
   /// constructor THUD.Create(world: TWorld)
   ,Create$81:function(Self, world$1) {
      Self.FWorld$1 = world$1;
      Self.FEl = El("hud");
      Self.FMM = El("minimap");
      Self.FMMX = Self.FMM.getContext("2d");
      THUD.BuildCompass(Self);
      THUD.BuildMapImage(Self);
      Self.FHitT = 1;
      Self.FHitKind = "";
      Self.FChSpread = 10;
      return Self
   }
   /// procedure THUD.Flash(v: Float)
   ,Flash:function(Self, v$3) {
      El("flash").style.opacity = Num(v$3);
   }
   /// procedure THUD.Hit(kind: String)
   ,Hit:function(Self, kind) {
      Self.FHitT = 0;
      Self.FHitKind = kind;
      El("hitmarker").className = (kind == "kill")?"kill":(kind == "head")?"head":"";
   }
   /// procedure THUD.Kill(name: String; head: Boolean)
   ,Kill:function(Self, name$3, head) {
      var kf = null,
         row$2 = null;
      kf = El("killfeed");
      row$2 = document.createElement("div");
      row$2.className = "kf";
      row$2.innerHTML = "<span class=\"you\">YOU<\/span><span class=\"wpn\">[ G36 ]"+((head)?" " + "\u2316":"")+"<\/span><span class=\"foe\">"+name$3+"<\/span>";
      kf.prepend(row$2);
      setTimeout(function () {
         row$2.remove();
      },5000);
      while (kf.children.length > 5) {
         kf.lastChild.remove()      }
   }
   /// procedure THUD.Pop(text: String; sub: String)
   ,Pop:function(Self, text, sub$1) {
      var p$3 = null,
         d$9 = null;
      p$3 = El("score-pops");
      d$9 = document.createElement("div");
      d$9.className = "pop";
      d$9.innerHTML = text + ((sub$1 != "")?"<small>"+sub$1+"<\/small>":"");
      p$3.appendChild(d$9);
      setTimeout(function () {
         d$9.remove();
      },1300);
   }
   /// procedure THUD.Show(v: Boolean)
   ,Show:function(Self, v$3) {
      Self.FEl.classList.toggle("hidden",!(v$3));
   }
   /// procedure THUD.Update(dt: Float; player: TPlayer; weapon: TWeapon; enemies: array of TEnemy; spread: Float; grenades: Integer; score: Integer; wave: Integer; hostiles: Integer)
   ,Update$3:function(Self, dt$1, player$1, weapon$1, enemies$1, spread, grenades, score, wave, hostiles) {
      var deg = 0,
         heading = 0,
         g$11 = null,
         MW = 0,
         Rad = 0,
         zoom = 0,
         k$8 = 0,
         grd$7 = null,
         cy$1 = 0,
         sy = 0,
         pips = [],
         a$232 = 0,
         e$1 = null,
         dx = 0,
         dz = 0,
         rx = 0,
         rz = 0,
         rr$1 = 0,
         f$3 = 0,
         strip = null,
         sp$2 = null,
         sp$3 = null,
         d$9 = 0,
         rel = 0,
         px = 0,
         ch = null,
         c$12 = 0,
         hm = null,
         a$119 = 0,
         sc$1 = 0,
         nades = null,
         prompt$1 = "",
         pe = null,
         hpK$1 = 0,
         di = null,
         a$233 = 0,
         ev$2 = null,
         dx$1 = 0,
         dz$1 = 0,
         ang$2 = 0,
         ev$3 = null,
         a$234 = [];
      deg = FMod((-player$1.Yaw$1) * 180 / 3.14159265358979,360);
      heading = FMod(deg + 360,360);
      Self.FCompassStrip.style.transform = "translateX("+Num(260 - heading * Self.FPxPerDeg)+"px)";
      g$11 = Self.FMMX;
      MW = Self.FMM.width;
      Rad = MW / 2;
      zoom = 1.3;
      g$11.save();
      g$11.clearRect(0,0,MW,MW);
      g$11.beginPath();
      g$11.arc(Rad,Rad,Rad,0,6.28318530717959);
      g$11.clip();
      g$11.translate(Rad,Rad);
      g$11.rotate(player$1.Yaw$1);
      k$8 = zoom / Self.FMapScale;
      g$11.scale(k$8,k$8);
      g$11.globalAlpha = 0.9;
      g$11.drawImage(Self.FMapImg,(-Self.FMapSize) / 2 - player$1.Pos$4.x * Self.FMapScale,(-Self.FMapSize) / 2 - player$1.Pos$4.z * Self.FMapScale);
      g$11.globalAlpha = 1;
      g$11.restore();
      g$11.save();
      g$11.beginPath();
      g$11.arc(Rad,Rad,Rad,0,6.28318530717959);
      g$11.clip();
      g$11.translate(Rad,Rad);
      grd$7 = g$11.createRadialGradient(0,0,0,0,0,Rad);
      grd$7.addColorStop(0,"rgba(255,255,255,0.22)");
      grd$7.addColorStop(1,"rgba(255,255,255,0)");
      g$11.fillStyle = grd$7;
      g$11.beginPath();
      g$11.moveTo(0,0);
      g$11.arc(0,0,Rad,-2.1207963267949,-1.0207963267949);
      g$11.closePath();
      g$11.fill();
      cy$1 = Cos(player$1.Yaw$1);
      sy = Sin(player$1.Yaw$1);
      var $temp105;
      for(a$232=0,$temp105=enemies$1.length;a$232<$temp105;a$232++) {
         e$1 = enemies$1[a$232];
         if (!(e$1.Alive$1)) {
            continue;
         }
         dx = e$1.Root$1.position.x - player$1.Pos$4.x;
         dz = e$1.Root$1.position.z - player$1.Pos$4.z;
         rx = (dx * cy$1 - dz * sy) * zoom;
         rz = (dx * sy + dz * cy$1) * zoom;
         if (e$1.BurstLeft > 0 || e$1.ShotTimer > -1.5) {
            rr$1 = Math.hypot(rx,rz);
            f$3 = (rr$1 > Rad - 8)?(Rad - 8) / rr$1:1;
            g$11.fillStyle = "#ff3b30";
            g$11.shadowColor = "rgba(255,0,0,0.8)";
            g$11.shadowBlur = 6;
            g$11.beginPath();
            g$11.arc(rx * f$3,rz * f$3,4.5,0,6.28318530717959);
            g$11.fill();
            g$11.shadowBlur = 0;
            pips.push(Math.atan2(dx,-dz));
         }
      }
      g$11.fillStyle = "#f2c14e";
      g$11.beginPath();
      g$11.moveTo(0,-8);
      g$11.lineTo(6,7);
      g$11.lineTo(0,3);
      g$11.lineTo(-6,7);
      g$11.closePath();
      g$11.fill();
      g$11.restore();
      strip = Self.FCompassStrip;
      while (Self.FCompassEnemies.length < pips.length) {
         sp$2 = document.createElement("span");
         sp$2.className = "enemy";
         strip.appendChild(sp$2);
         Self.FCompassEnemies.push(sp$2);
      }
      for(let i$2=0,$temp106=Self.FCompassEnemies.length;i$2<$temp106;i$2++) {
         sp$3 = Self.FCompassEnemies[i$2];
         if (i$2 < pips.length) {
            d$9 = pips[i$2] * 180 / 3.14159265358979;
            d$9 = FMod(d$9 + 360,360);
            rel = d$9 - heading;
            while (rel > 180) {
               rel -= 360;
            }
            while (rel < -180) {
               rel += 360;
            }
            sp$3.style.display = (Abs$_Float_(rel) < 60)?"":"none";
            sp$3.style.left = Num((heading + rel) * Self.FPxPerDeg) + "px";
         } else {
            sp$3.style.display = "none";
         }
      }
      px = 6 + spread * 700;
      Self.FChSpread += (px - Self.FChSpread) * MinF(1,dt$1 * 18);
      ch = El("crosshair");
      ch.style.opacity = (weapon$1.Aim > 0.5 || TPlayer.Sprinting$1(player$1) || TWeapon.IsReloading(weapon$1))?"0":"1";
      c$12 = Self.FChSpread;
      ch.children[0].style.transform = "translateY("+Num((-c$12) - 10)+"px)";
      ch.children[1].style.transform = "translateY("+Num(c$12)+"px)";
      ch.children[2].style.transform = "translateX("+Num((-c$12) - 10)+"px)";
      ch.children[3].style.transform = "translateX("+Num(c$12)+"px)";
      Self.FHitT += dt$1;
      hm = El("hitmarker");
      a$119 = MaxF(0,1 - Self.FHitT / 0.3);
      hm.style.opacity = Num(a$119);
      sc$1 = 1 + (1 - a$119) * 0.3;
      hm.style.transform = "scale("+Num((Self.FHitKind == "kill")?sc$1 * 1.2:sc$1)+")";
      El("ammo-mag").textContent = IntStr(weapon$1.Ammo);
      El("ammo-mag").classList.toggle("low",weapon$1.Ammo <= 8);
      El("ammo-reserve").textContent = "\/ " + IntStr(weapon$1.Reserve);
      El("ammo-bar").style.width = Num(weapon$1.Ammo / weapon$1.Stats.Mag * 210) + "px";
      nades = document.querySelectorAll("#equipment .nade");
      for(let i$3=0,$temp107=nades.length;i$3<$temp107;i$3++) {
         nades[i$3].classList.toggle("used",i$3 >= grenades);
      }
      prompt$1 = "";
      if ((weapon$1.Ammo==0) && weapon$1.Reserve > 0 && (!(TWeapon.IsReloading(weapon$1)))) {
         prompt$1 = "PRESS <b style=\"color:#f2c14e\">R<\/b> TO RELOAD";
      } else if (weapon$1.Ammo <= 8 && weapon$1.Reserve > 0 && (!(TWeapon.IsReloading(weapon$1)))) {
         prompt$1 = "<span style=\"color:#f2c14e\">LOW AMMO<\/span>";
      } else if ((weapon$1.Ammo==0) && (weapon$1.Reserve==0)) {
         prompt$1 = "<span style=\"color:#ff3b30\">NO AMMO<\/span>";
      }
      if (TWeapon.IsReloading(weapon$1)) {
         prompt$1 = "RELOADING";
      }
      pe = El("prompt");
      if (pe.innerHTML != prompt$1) {
         pe.innerHTML = prompt$1;
      }
      hpK$1 = MaxF(0,(0.75 - player$1.HP / player$1.MaxHP) / 0.75);
      El("blood").style.opacity = Num(MinF(0.85,hpK$1 * 1.1));
      di = El("dmg-indicators");
      a$234 = player$1.DamageEvents;
      var $temp108;
      for(a$233=0,$temp108=a$234.length;a$233<$temp108;a$233++) {
         ev$2 = a$234[a$233];
         if (!ev$2.El$1) {
            ev$2.El$1 = document.createElement("div");
            ev$2.El$1.className = "dmg-ind";
            di.appendChild(ev$2.El$1);
            Self.FIndicators.push(ev$2);
         }
         dx$1 = ev$2.From.x - player$1.Pos$4.x;
         dz$1 = ev$2.From.z - player$1.Pos$4.z;
         ang$2 = Math.atan2(dx$1,-dz$1) + player$1.Yaw$1;
         ev$2.El$1.style.transform = "rotate("+Num(ang$2)+"rad)";
         ev$2.El$1.style.opacity = Num(MaxF(0,1 - ev$2.T$2 / 1.6));
      }
      for(let i$4=Self.FIndicators.length - 1;i$4>=0;i$4--) {
         ev$3 = Self.FIndicators[i$4];
         if (player$1.DamageEvents.indexOf(ev$3) < 0) {
            ev$3.El$1.remove();
            Self.FIndicators.splice(i$4,1)
            ;
         }
      }
      El("score-num").textContent = IntStr(score);
      El("wave-num").textContent = IntStr(wave);
      El("hostiles-num").textContent = IntStr(hostiles);
   }
   ,Destroy:TObject.Destroy
};
var Params = null,
   Shot = "",
   Renderer = null,
   Perf = null,
   Quality = 0,
   Scene = null,
   Camera = null,
   SUN_DIR = null,
   FOG_COLOR = null,
   Sky = null,
   SkyMat = null,
   Sun = null,
   Hemi = null,
   Bounce = null,
   Audio = null,
   World = null,
   Effects = null,
   Weapon = null,
   Player = null,
   HUD = null,
   Composer = null,
   Passes = null,
   Enemies$1 = [],
   GrenadesLive = [],
   Game = null,
   Canvas = null,
   MouseDown = false,
   RMB = false,
   ResizeT = undefined,
   SPAWNS = [],
   NAMES = [],
   NadeGeo = null,
   NadeMat = null,
   Last = 0,
   ShotFrames = 0,
   SHOTMENU = false,
   _o = null,
   _d = null,
   _sp = null,
   W0 = 0,
   W1 = 0,
   W2 = 0,
   MaxAniso = 0;
var MaxAniso = 8;
var _m = null,
   _q = null,
   _s = null,
   _p = null,
   _e = null,
   _v = null,
   _v2 = null,
   _z = null,
   _q$1 = null,
   _v$1 = null,
   _v2$1 = null,
   _v3 = null,
   DOWN = null,
   _a = null,
   _b = null,
   _n = null,
   _q$2 = null,
   _q2 = null,
   _qb = null,
   _qp = null,
   _qa = null,
   _qc = null,
   RIG = [],
   Tmpl = null,
   Rest = {},
   LenUpper = 0,
   LenFore = 0,
   GunTmpl = null,
   GripL = null,
   GripR = null,
   FingerNames = [],
   FingerQuats = [],
   UpperNames = [],
   UpperQuats = [],
   Butt = null,
   MuzzleOfs = null,
   Pocket = null,
   GunInChest = null,
   SMats = {},
   Loaded = false;
var _m = new THREE.Matrix4();
var _q = new THREE.Quaternion();
var _s = V3Zero();
var _p = V3Zero();
var _e = new THREE.Euler();
var _v = V3Zero();
var _v2 = V3Zero();
var _z = V3(0,0,1);
var _q$1 = new THREE.Quaternion();
var _v$1 = V3Zero();
var _v2$1 = V3Zero();
var _v3 = V3Zero();
var DOWN = V3(0,-1,0);
var _a = V3Zero();
var _b = V3Zero();
var _n = V3Zero();
var _q$2 = new THREE.Quaternion();
var _q2 = new THREE.Quaternion();
var _qb = new THREE.Quaternion();
var _qp = new THREE.Quaternion();
var _qa = new THREE.Quaternion();
var _qc = new THREE.Quaternion();
var RIG = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "RightShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];
var main = function() {
   StartAshfall()}
