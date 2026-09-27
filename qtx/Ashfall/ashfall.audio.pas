unit ashfall.audio;

// Fully synthesized positional audio (WebAudio). No sample files.

interface

uses
  ashfall.host, ashfall.three;

type
  TAudio = class
  private
    FMaster, FRevGain: JGainNode;
    FReverb: JConvolverNode;
    FNoise, FBrown: JAudioBuffer;
    function Impulse(dur, decay: Float): JAudioBuffer;
    function Output(pos: JVector3; gain: Float = 1; rev: Float = 0.3): JAudioNode;
    function NoiseSrc(buf: JAudioBuffer = nil): JBufferSourceNode;
    procedure Env(g: JGainNode; t, a, peak, decay: Float; &end: Float = 0.0001);
    procedure Burst(dst: JAudioNode; t: Float; typ: String = 'bandpass'; freq: Float = 1000; q: Float = 1; peak: Float = 1;
      a: Float = 0.001; decay: Float = 0.1; buf: JAudioBuffer = nil; sweepTo: Float = 0);
    procedure Tone(dst: JAudioNode; t: Float; typ: String = 'sine'; f0: Float = 100; f1: Float = 40; peak: Float = 1;
      a: Float = 0.002; decay: Float = 0.15);
    procedure Ambience;
  public
    Ctx: JAudioContext;
    Enabled: Boolean;
    ListenerPos: JVector3;
    procedure Init;
    procedure UpdateListener(cam: JCamera);
    procedure Gunshot;
    procedure EnemyShot(pos: JVector3);
    procedure Whiz(pos: JVector3);
    procedure Impact(pos: JVector3; surf: String);
    procedure Shell(pos: JVector3);
    procedure Step(surf: String = 'concrete'; sprint: Boolean = false);
    procedure Click(freq: Float = 3000; vol: Float = 0.3; delay: Float = 0);
    procedure Reload(dur: Float);
    procedure Dry;
    procedure Hitmarker(kill: Boolean = false; head: Boolean = false);
    procedure Explosion(pos: JVector3);
    procedure Hurt;
    procedure Heartbeat;
    procedure Melee;
  end;

implementation

procedure TAudio.Init;
begin
  if Assigned(Ctx) then begin
    Ctx.resume;
    Exit;
  end;
  Ctx := JAudioContext.Create;
  var c := Ctx;
  FMaster := c.createGain; FMaster.gain.value := 0.8;
  var comp := c.createDynamicsCompressor;
  comp.threshold.value := -14; comp.knee.value := 8; comp.ratio.value := 5; comp.attack.value := 0.002; comp.release.value := 0.2;
  FMaster.connect(comp).connect(c.destination);
  // reverb bus
  FReverb := c.createConvolver;
  FReverb.buffer := Impulse(2.8, 2.6);
  FRevGain := c.createGain; FRevGain.gain.value := 0.55;
  FReverb.connect(FRevGain).connect(FMaster);
  // noise buffers
  var len := Floor(c.sampleRate * 2);
  FNoise := c.createBuffer(1, len, c.sampleRate);
  var d := FNoise.getChannelData(0);
  for var i := 0 to len - 1 do d[i] := Rnd * 2 - 1;
  FBrown := c.createBuffer(1, len, c.sampleRate);
  var b := FBrown.getChannelData(0);
  var last := 0.0;
  for var i := 0 to len - 1 do begin
    last := (last + 0.02 * (Rnd * 2 - 1)) / 1.02;
    b[i] := last * 3.5;
  end;
  Enabled := true;
  Ambience;
end;

function TAudio.Impulse(dur, decay: Float): JAudioBuffer;
begin
  var len := Floor(Ctx.sampleRate * dur);
  var buf := Ctx.createBuffer(2, len, Ctx.sampleRate);
  for var c := 0 to 1 do begin
    var d := buf.getChannelData(c);
    var period := Floor(Ctx.sampleRate * (0.031 + c * 0.007));
    for var i := 0 to len - 1 do begin
      var t := i / len;
      // early reflections (street canyon slapback) + diffuse tail
      var er := if (i mod period) < 30 then 0.6 * (1 - t) else 0.0;
      d[i] := ((Rnd * 2 - 1) * Power(1 - t, decay) + er * (Rnd * 2 - 1)) * 0.5;
    end;
  end;
  Result := buf;
end;

procedure TAudio.UpdateListener(cam: JCamera);
begin
  if not Enabled then Exit;
  var L := Ctx.listener;
  var t := Ctx.currentTime;
  var f := V3(0, 0, -1).applyQuaternion(cam.quaternion);
  var u := V3(0, 1, 0).applyQuaternion(cam.quaternion);
  if Assigned(L.positionX) then begin
    L.positionX.setTargetAtTime(cam.position.x, t, 0.01); L.positionY.setTargetAtTime(cam.position.y, t, 0.01); L.positionZ.setTargetAtTime(cam.position.z, t, 0.01);
    L.forwardX.setTargetAtTime(f.x, t, 0.01); L.forwardY.setTargetAtTime(f.y, t, 0.01); L.forwardZ.setTargetAtTime(f.z, t, 0.01);
    L.upX.setTargetAtTime(u.x, t, 0.01); L.upY.setTargetAtTime(u.y, t, 0.01); L.upZ.setTargetAtTime(u.z, t, 0.01);
  end else begin
    L.setPosition(cam.position.x, cam.position.y, cam.position.z);
    L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
  end;
  ListenerPos := cam.position;
end;

// output node: optionally positional
function TAudio.Output(pos: JVector3; gain: Float = 1; rev: Float = 0.3): JAudioNode;
begin
  var g := Ctx.createGain;
  g.gain.value := gain;
  Result := g;
  if Assigned(pos) then begin
    var p := Ctx.createPanner;
    p.panningModel := 'HRTF'; p.distanceModel := 'inverse'; p.refDistance := 3; p.rolloffFactor := 1.1; p.maxDistance := 400;
    if Assigned(p.positionX) then begin
      p.positionX.value := pos.x; p.positionY.value := pos.y; p.positionZ.value := pos.z;
    end else
      p.setPosition(pos.x, pos.y, pos.z);
    g.connect(p); p.connect(FMaster);
    // distance-dependent air absorption
    if Assigned(ListenerPos) then begin
      var dist := ListenerPos.distanceTo(pos);
      var lp := Ctx.createBiquadFilter;
      lp.&type := 'lowpass';
      lp.frequency.value := MaxF(900, 18000 - dist * 260);
      lp.connect(g);
      var s := Ctx.createGain;
      s.gain.value := rev * MinF(1.5, 0.4 + dist / 40);
      g.connect(s).connect(FReverb);
      Exit(lp);
    end;
  end else
    g.connect(FMaster);
  var s := Ctx.createGain;
  s.gain.value := rev;
  g.connect(s).connect(FReverb);
end;

function TAudio.NoiseSrc(buf: JAudioBuffer = nil): JBufferSourceNode;
begin
  if buf = nil then buf := FNoise;
  var s := Ctx.createBufferSource;
  s.buffer := buf;
  s.loop := true;
  s.loopStart := 0;
  s.loopEnd := buf.duration;
  Result := s;
end;

procedure TAudio.Env(g: JGainNode; t, a, peak, decay: Float; &end: Float = 0.0001);
begin
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(&end, t + a + decay);
end;

procedure TAudio.Burst(dst: JAudioNode; t: Float; typ: String = 'bandpass'; freq: Float = 1000; q: Float = 1; peak: Float = 1;
  a: Float = 0.001; decay: Float = 0.1; buf: JAudioBuffer = nil; sweepTo: Float = 0);
begin
  var n := NoiseSrc(buf);
  var f := Ctx.createBiquadFilter;
  f.&type := typ;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value := q;
  if sweepTo <> 0 then f.frequency.exponentialRampToValueAtTime(sweepTo, t + a + decay);
  var g := Ctx.createGain;
  Env(g, t, a, peak, decay);
  n.connect(f).connect(g).connect(dst);
  n.start(t, Rnd * 1.5);
  n.stop(t + a + decay + 0.05);
end;

procedure TAudio.Tone(dst: JAudioNode; t: Float; typ: String = 'sine'; f0: Float = 100; f1: Float = 40; peak: Float = 1;
  a: Float = 0.002; decay: Float = 0.15);
begin
  var o := Ctx.createOscillator;
  o.&type := typ;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(MaxF(1, f1), t + a + decay);
  var g := Ctx.createGain;
  Env(g, t, a, peak, decay);
  o.connect(g).connect(dst);
  o.start(t);
  o.stop(t + a + decay + 0.05);
end;

// ------------------------------------------------------------- sounds
procedure TAudio.Gunshot;
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var p := 0.94 + Rnd * 0.12;
  var o := Output(nil, 0.9, 0.55);
  Burst(o, t, 'highpass', 2500 * p, 0.7, 1.2, 0.001, 0.045);
  Burst(o, t, 'bandpass', 900 * p, 0.9, 1.4, 0.001, 0.13, nil, 300);
  Burst(o, t, 'lowpass', 400, 0.5, 1.6, 0.001, 0.22, FBrown);
  Tone(o, t, 'sine', 150 * p, 38, 1.3, 0.002, 0.16);
  // mechanical clack
  Burst(o, t + 0.03, 'bandpass', 3800, 6, 0.25, 0.001, 0.02);
  // distant slapback off buildings
  Burst(o, t + 0.09, 'bandpass', 700, 0.8, 0.35, 0.001, 0.25, nil, 250);
end;

procedure TAudio.EnemyShot(pos: JVector3);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var p := 0.85 + Rnd * 0.15;
  var o := Output(pos, 1.1, 0.7);
  Burst(o, t, 'highpass', 2000 * p, 0.7, 0.9, 0.001, 0.04);
  Burst(o, t, 'bandpass', 750 * p, 0.9, 1.2, 0.001, 0.15, nil, 250);
  Tone(o, t, 'sine', 120 * p, 35, 1.0, 0.002, 0.15);
end;

procedure TAudio.Whiz(pos: JVector3);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(pos, 0.5, 0.05);
  Burst(o, t, 'bandpass', 5000, 3, 0.8, 0.03, 0.12, nil, 1500);
  Burst(o, t + 0.02, 'highpass', 6000, 1, 0.4, 0.001, 0.02); // supersonic crack
end;

procedure TAudio.Impact(pos: JVector3; surf: String);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(pos, 0.6, 0.2);
  if surf = 'metal' then begin
    Tone(o, t, 'triangle', 2200 + Rnd * 1500, 1800, 0.3, 0.002, 0.25);
    Burst(o, t, 'highpass', 3000, 1, 0.5, 0.001, 0.03);
  end else if surf = 'wood' then
    Burst(o, t, 'bandpass', 600, 2, 0.8, 0.001, 0.08)
  else if surf = 'flesh' then
    Burst(o, t, 'lowpass', 500, 1, 1.0, 0.001, 0.08)
  else begin
    Burst(o, t, 'bandpass', 1800, 1.2, 0.6, 0.001, 0.05);
    Burst(o, t + 0.01, 'highpass', 4000, 1, 0.2, 0.001, 0.12); // debris trickle
  end;
end;

procedure TAudio.Shell(pos: JVector3);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(pos, 0.25, 0.1);
  var f := 3500 + Rnd * 2500;
  Tone(o, t, 'sine', f, f * 0.98, 0.25, 0.002, 0.12);
  Tone(o, t, 'sine', f * 1.47, f * 1.45, 0.12, 0.002, 0.08);
end;

procedure TAudio.Step(surf: String = 'concrete'; sprint: Boolean = false);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(nil, if sprint then 0.32 else 0.2, 0.05);
  Burst(o, t, 'lowpass', 380, 1, 0.9, 0.001, 0.07, FBrown);
  Burst(o, t + 0.005, 'bandpass', 2400 + Rnd * 1500, 1.5, if surf = 'dirt' then 0.35 else 0.18, 0.001, 0.05);
  // gear rattle
  if sprint and (Rnd < 0.6) then Burst(o, t + 0.02, 'bandpass', 5200, 4, 0.08, 0.001, 0.04);
end;

procedure TAudio.Click(freq: Float = 3000; vol: Float = 0.3; delay: Float = 0);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime + delay;
  var o := Output(nil, vol, 0.08);
  Burst(o, t, 'bandpass', freq, 5, 1, 0.001, 0.025);
  Tone(o, t, 'square', freq * 0.3, freq * 0.2, 0.15, 0.002, 0.02);
end;

procedure TAudio.Reload(dur: Float);
begin
  Click(1800, 0.35, 0.18);            // mag release
  Click(900, 0.25, 0.26);             // mag slide out
  Click(2400, 0.45, dur * 0.55);      // mag seat
  Click(1400, 0.3, dur * 0.58);
  Click(3200, 0.45, dur * 0.82);      // bolt release
  Click(1100, 0.35, dur * 0.84);
end;

procedure TAudio.Dry;
begin
  Click(4200, 0.35);
end;

procedure TAudio.Hitmarker(kill: Boolean = false; head: Boolean = false);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(nil, if kill then 0.5 else 0.35, 0.02);
  Tone(o, t, 'square', if head then 2600 else 2000, if head then 2400 else 1800, 0.25, 0.002, 0.03);
  if kill then Tone(o, t + 0.04, 'triangle', 900, 600, 0.4, 0.002, 0.12);
end;

procedure TAudio.Explosion(pos: JVector3);
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(pos, 2.4, 0.9);
  Burst(o, t, 'lowpass', 3000, 0.5, 1.6, 0.001, 0.5, nil, 200);
  Burst(o, t, 'lowpass', 250, 0.7, 2.2, 0.001, 1.8, FBrown);
  Tone(o, t, 'sine', 70, 22, 2.0, 0.002, 0.9);
  Burst(o, t + 0.3, 'highpass', 3000, 1, 0.12, 0.001, 1.4); // debris rain
end;

procedure TAudio.Hurt;
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(nil, 0.5, 0.05);
  Tone(o, t, 'sine', 90, 45, 0.8, 0.002, 0.15);
  Burst(o, t, 'lowpass', 800, 1, 0.6, 0.001, 0.1);
end;

procedure TAudio.Heartbeat;
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(nil, 0.45, 0);
  Tone(o, t, 'sine', 60, 40, 1, 0.002, 0.12);
  Tone(o, t + 0.18, 'sine', 55, 38, 0.7, 0.002, 0.12);
end;

procedure TAudio.Melee;
begin
  if not Enabled then Exit;
  var t := Ctx.currentTime;
  var o := Output(nil, 0.5, 0.1);
  Burst(o, t, 'bandpass', 1200, 1, 0.6, 0.04, 0.12, nil, 400);
end;

procedure TAudio.Ambience;
var
  distant: TProc;
begin
  var c := Ctx;
  // wind bed
  var n := NoiseSrc(FBrown);
  var f := c.createBiquadFilter;
  f.&type := 'lowpass'; f.frequency.value := 500; f.Q.value := 0.8;
  var g := c.createGain; g.gain.value := 0.18;
  var lfo := c.createOscillator; lfo.frequency.value := 0.07;
  var lg := c.createGain; lg.gain.value := 250;
  lfo.connect(lg).connect(f.frequency);
  n.connect(f).connect(g).connect(FMaster);
  n.start; lfo.start;
  // distant battle: booms and gunfire bursts scheduled randomly
  distant := procedure
    begin
      if not Enabled then Exit;
      var t := c.currentTime;
      var a := Rnd * PI * 2;
      var lp := if Assigned(ListenerPos) then ListenerPos else V3Zero;
      var pos := V3(lp.x + Cos(a) * 250, 20, lp.z + Sin(a) * 250);
      var o := Output(pos, 6, 1.2);
      if Rnd < 0.35 then begin
        Burst(o, t, 'lowpass', 300, 1, 1.4, 0.001, 1.6, FBrown);
        Tone(o, t, 'sine', 55, 25, 1.0, 0.002, 1.0);
      end else begin
        var shots := 3 + Floor(Rnd * 8);
        var rate := 0.07 + Rnd * 0.06;
        for var i := 0 to shots - 1 do Burst(o, t + i * rate, 'bandpass', 600, 0.8, 0.9, 0.001, 0.12);
      end;
      SetTimeout(distant, 1500 + Rnd * 5000);
    end;
  SetTimeout(distant, 2000);
end;

end.
