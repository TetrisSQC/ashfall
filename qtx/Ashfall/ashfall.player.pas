unit ashfall.player;

// First-person controller: momentum movement, sprint/crouch/slide/jump, camera feel
// (recoil, shake, bob, tilt), health with regeneration.

interface

uses
  ashfall.host, ashfall.three, ashfall.world, ashfall.audio;

type
  TDamageEvent = class
  public
    From: JVector3;
    T: Float;
    El: JElement;   // HUD indicator bound to this event
  end;

  TPlayer = class
  private
    FCamera: JPerspectiveCamera;
    FWorld: TWorld;
    FAudio: TAudio;
    FRecoilP, FRecoilY, FMouseDX, FMouseDY, FSens, FRegenDelay, FStepDist, FBob, FTilt: Float;
    FSlideDir: JVector3;
  public
    Pos, Vel: JVector3;
    Yaw, Pitch, LookDX, LookDY, CrouchK, Eye, HP, MaxHP, Trauma, Sliding, Difficulty, LandImpact: Float;
    Keys: array [String] of Boolean;
    Grounded, Crouching, Alive, Aiming, Firing: Boolean;
    DamageEvents: array of TDamageEvent;
    constructor Create(camera: JPerspectiveCamera; world: TWorld; audio: TAudio);
    procedure Reset;
    function Moving: Boolean;
    function Sprinting: Boolean;
    function HeadPos(target: JVector3): JVector3;
    procedure OnMouse(dx, dy: Float);
    procedure AddRecoil(p, y: Float);
    procedure Shake(amount: Float);
    procedure TakeDamage(amount: Float; fromPos: JVector3);
    procedure CrouchPressed;
    procedure Update(dt: Float);
  end;

implementation

constructor TPlayer.Create(camera: JPerspectiveCamera; world: TWorld; audio: TAudio);
begin
  FCamera := camera; FWorld := world; FAudio := audio;
  Pos := V3(0, 0, 80);
  Vel := V3Zero;
  FSens := 0.0021;
  Grounded := true;
  FSlideDir := V3Zero;
  Eye := 1.62;
  HP := 100; MaxHP := 100;
  Alive := true;
  Difficulty := 1;
end;

procedure TPlayer.Reset;
begin
  Pos.&set(0, 0, 80); Vel.&set(0, 0, 0);
  Yaw := 0; Pitch := 0; HP := 100; Alive := true; Trauma := 0; Sliding := 0;
end;

function TPlayer.Moving: Boolean;
begin
  Result := Hypot(Vel.x, Vel.z) > 1.2;
end;

function TPlayer.Sprinting: Boolean;
begin
  Result := Keys['ShiftLeft'] and Keys['KeyW'] and not Aiming and not Crouching and (Sliding <= 0) and not Firing;
end;

function TPlayer.HeadPos(target: JVector3): JVector3;
begin
  Result := target.&set(Pos.x, Pos.y + Eye, Pos.z);
end;

procedure TPlayer.OnMouse(dx, dy: Float);
begin
  FMouseDX += dx;
  FMouseDY += dy;
end;

procedure TPlayer.AddRecoil(p, y: Float);
begin
  FRecoilP += p;
  FRecoilY += y;
end;

procedure TPlayer.Shake(amount: Float);
begin
  Trauma := MinF(1, Trauma + amount);
end;

procedure TPlayer.TakeDamage(amount: Float; fromPos: JVector3);
begin
  if not Alive then Exit;
  HP -= amount * Difficulty;
  FRegenDelay := 4.5;
  Shake(0.18);
  FAudio.Hurt;
  var ev := TDamageEvent.Create;
  ev.From := fromPos.clone;
  DamageEvents.Add(ev);
  if HP <= 0 then begin
    HP := 0;
    Alive := false;
  end;
end;

procedure TPlayer.CrouchPressed;
begin
  var speed := Hypot(Vel.x, Vel.z);
  if Keys['ShiftLeft'] and (speed > 5.5) and Grounded and (Sliding <= 0) then begin
    Sliding := 0.85;
    FSlideDir.&set(Vel.x, 0, Vel.z).normalize;
    Vel.x := FSlideDir.x * 10.5; Vel.z := FSlideDir.z * 10.5;
    Shake(0.05);
    FAudio.Step('dirt', true);
    Crouching := true;
    Exit;
  end;
  Crouching := not Crouching;
end;

procedure TPlayer.Update(dt: Float);
begin
  // --- look
  var sensMul := if Aiming then 0.62 else 1.0;
  var dYaw := -FMouseDX * FSens * sensMul;
  var dPitch := -FMouseDY * FSens * sensMul;
  FMouseDX := 0; FMouseDY := 0;
  Yaw += dYaw; Pitch += dPitch;
  LookDX := dYaw; LookDY := dPitch;
  // recoil: applied immediately then recovers
  var rp := FRecoilP * MinF(1, dt * 18);
  var ry := FRecoilY * MinF(1, dt * 18);
  Pitch += rp; Yaw += ry;
  FRecoilP -= rp; FRecoilY -= ry;
  Pitch := ClampF(Pitch, -1.5, 1.5);

  // --- movement
  var fwd := V3(-Sin(Yaw), 0, -Cos(Yaw));
  var right := V3(Cos(Yaw), 0, -Sin(Yaw));
  var wish := V3Zero;
  if Keys['KeyW'] then wish.add(fwd);
  if Keys['KeyS'] then wish.sub(fwd);
  if Keys['KeyD'] then wish.add(right);
  if Keys['KeyA'] then wish.sub(right);
  if wish.lengthSq > 0 then wish.normalize;
  var maxSpeed := 4.8;
  if Sprinting then maxSpeed := 7.4;
  if Crouching then maxSpeed := 2.4;
  if Aiming then maxSpeed := MinF(maxSpeed, 2.9);
  if not Alive then maxSpeed := 0;

  if Sliding > 0 then begin
    Sliding -= dt;
    var f := Exp(-2.2 * dt);
    Vel.x := Vel.x * f; Vel.z := Vel.z * f;
    if Sliding <= 0 then Sliding := 0;
  end else if Grounded then begin
    var accel := 60.0;
    var fric := 11.0;
    var target := wish.clone.multiplyScalar(maxSpeed);
    var dvx := target.x - Vel.x;
    var dvz := target.z - Vel.z;
    var rate := if wish.lengthSq > 0 then accel else fric * MaxF(2, Hypot(Vel.x, Vel.z));
    var dl := Hypot(dvx, dvz);
    var step := MinF(dl, rate * dt);
    if dl > 1e-5 then begin
      Vel.x := Vel.x + (dvx / dl) * step;
      Vel.z := Vel.z + (dvz / dl) * step;
    end;
  end else begin
    // air control
    Vel.x := Vel.x + wish.x * 8 * dt; Vel.z := Vel.z + wish.z * 8 * dt;
    var hs := Hypot(Vel.x, Vel.z);
    if hs > 8 then begin
      Vel.x := Vel.x * 8 / hs; Vel.z := Vel.z * 8 / hs;
    end;
  end;
  if Keys['Space'] and Grounded and Alive then begin
    Vel.y := 5.2; Grounded := false; Keys['Space'] := false;
    if Crouching then Crouching := false;
    if Sliding > 0 then Sliding := 0;
  end;
  Vel.y := Vel.y - 16 * dt;
  var wasGrounded := Grounded;
  var vy := Vel.y;
  Pos.addScaledVector(Vel, dt);
  var height := if Crouching or (Sliding > 0) then 1.15 else 1.8;
  Grounded := FWorld.Collide(Pos, Vel, 0.33, height);
  if not wasGrounded and Grounded and (vy < -3) then begin
    LandImpact := -vy;
    FAudio.Step('concrete', true);
    Shake(MinF(0.2, -vy * 0.015));
  end;
  // un-crouch blocked by ceiling? (ignore, open level)

  // --- camera
  CrouchK := Damp(CrouchK, if Sliding > 0 then 1.3 else if Crouching then 1 else 0, 12, dt);
  Eye := 1.62 - CrouchK * 0.55;
  var speed := Hypot(Vel.x, Vel.z);
  if Grounded and (speed > 0.5) and (Sliding <= 0) then begin
    FBob += dt * speed * 1.55;
    FStepDist += speed * dt;
    var stride := if Sprinting then 2.3 else 1.9;
    if FStepDist > stride then begin
      FStepDist := 0;
      FAudio.Step('concrete', Sprinting);
    end;
  end;
  var bobK := if Aiming then 0.15 else 1.0;
  var bobY := Sin(FBob * 2) * 0.03 * MinF(1, speed / 5) * bobK;
  var bobX := Cos(FBob) * 0.02 * MinF(1, speed / 5) * bobK;
  // strafe tilt + slide tilt
  var lateral := Vel.dot(right);
  FTilt := Damp(FTilt, -lateral * 0.004 + (if Sliding > 0 then 0.08 else 0), 8, dt);

  Trauma := MaxF(0, Trauma - dt * 1.4);
  var sh := Trauma * Trauma;
  var t := Now / 1000;
  var skX := sh * 0.05 * (Sin(t * 47.3) + Sin(t * 31.1) * 0.5);
  var skY := sh * 0.05 * (Sin(t * 43.7 + 1) + Sin(t * 27.9) * 0.5);
  var skR := sh * 0.04 * Sin(t * 39.1 + 2);

  FCamera.position.&set(Pos.x + right.x * bobX, Pos.y + Eye + bobY, Pos.z + right.z * bobX);
  FCamera.rotation.order := 'YXZ';
  FCamera.rotation.&set(Pitch + skY, Yaw + skX, FTilt + skR);

  // fov
  var targetFov := (if Sprinting then 69 else 63) - (if Aiming then 19 else 0) + (if Sliding > 0 then 5 else 0);
  FCamera.fov := Damp(FCamera.fov, targetFov, 10, dt);
  FCamera.updateProjectionMatrix;

  // health regen
  if Alive then begin
    FRegenDelay -= dt;
    if (FRegenDelay <= 0) and (HP < MaxHP) then HP := MinF(MaxHP, HP + 30 * dt);
  end;
  for var e in DamageEvents do e.T += dt;
  for var i := DamageEvents.Length - 1 downto 0 do
    if DamageEvents[i].T >= 1.6 then DamageEvents.Delete(i);
end;

end.
