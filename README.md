# Ashfall: Frontline

A first-person shooter in the browser, written in vanilla JavaScript on top of three.js (loaded from a CDN via an import map). There's no build step and no Node, and no separate asset files. Textures, the level and all sound are generated in code when the page loads. The G36 rifle and the enemy soldier are embedded as data in `js/g36data.js` and `js/soldierdata.js`.

## Run

ES modules can't load over `file://`, so serve the folder:

```sh
cd cod
python3 serve.py
# open http://127.0.0.1:8123
```

`serve.py` is a tiny threaded static server. The stock `python3 -m http.server` works too, but its small listen backlog can drop some of the parallel module requests.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| LMB / RMB | Fire / Aim down sights |
| Shift | Sprint |
| C / Ctrl | Crouch (Shift+C while sprinting: slide) |
| Space | Jump |
| R | Reload |
| G | Frag grenade |
| V | Melee |
| Q | Cycle graphics quality (Ultra / High / Medium) |
| Esc | Pause |

## What's in it

- **Rendering**: PBR materials with procedural albedo, normal and roughness maps. Shadows use a single 4096² cascade that follows the camera and snaps to texels. There's a custom golden-hour sky with clouds, exponential height fog that brightens toward the sun, and a warm bounce light.
- **Post-processing**: GTAO ambient occlusion, screen-space god rays, bloom, ACES tone mapping, a colour grade (split toning, vignette, chromatic aberration, film grain) and SMAA.
- **World**: a war-torn city intersection. Facades have recessed windows and furnished shop fronts, bilingual shop signs, graffiti and posters. The streets have wrecked cars, jersey barriers, sandbags, shipping containers, trees, wires, rubble and litter, plus burning wrecks and distant smoke plumes.
- **Weapon**: an HK G36 viewmodel (see Credits) with gloved hands, drawn in its own pass with its own FOV. It has a spring-based recoil model, sway, bob, ADS with a parallax-free red dot, sprint pose, and reload, melee and throw animations. Also muzzle flash, tracers, ejected casings and bullet decals.
- **Enemies**: a textured, skinned FSB operator with an AKS-74U (Mixamo rig, see Credits). An invisible procedural control rig handles locomotion, crouching and death falls, and the model's bones are retargeted onto it every frame. Hand placement and finger curl on the rifle come from the model's own idle animation; 2-bone IK keeps the hands on the rifle while it blends between shouldered (fighting) and low ready (running). They seek cover that can see you, hunt you down after a few seconds out of sight, fire in bursts, have head/body/leg hit zones, and fall in the direction of the killing shot.
- **Game loop**: waves, CoD-style health regeneration, a resupply after each wave, score and headshot bonuses, a killfeed, hitmarkers, damage-direction indicators, a rotating minimap and a compass.
- **Audio**: synthesized with WebAudio. Includes HRTF positional sound, a street-canyon reverb, bullet whizz and snap, and distant battle ambience.

Graphics quality drops a level automatically if frame times stay above about 24 ms.

## Debug views

`?shot=<name>` loads a fixed camera pose for screenshots. Names: `street`, `ads`, `fire`, `boom`, `soldier`, `death`, `cross`, `back`, `menu`, `play`, `longplay`.

## Enemy animation lab

`http://127.0.0.1:8123/anim.html` runs the real `Enemy` class on its own. You can switch between idle, walk, run, strafe, backpedal, crouch, AI path and turning, adjust speed, facing, crouch, aim pitch and time scale, and trigger hits and deaths. It can show the procedural control rig, the Mixamo skeleton and footprints, and it measures how much the planted foot slips.

## Credits

- **HK G36 model**: ["Low-Poly HK G36"](https://sketchfab.com/3d-models/low-poly-hk-g36-526ae321f20c4d62a0fddd5c93783a79) by [TastyTony](https://sketchfab.com/TastyTony), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Changes: skinning baked to the bind pose, split into body, magazine and charging-handle parts, rescaled, re-oriented and quantized into `js/g36data.js`. The original `.glb` isn't needed at runtime.
- **Enemy soldier model**: ["FSB Operator"](https://sketchfab.com/3d-models/fsb-operator-43a561e941704eefb1ab0614be4f0049) by [Mateusz Woliński](https://sketchfab.com/jeandiz), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Changes: skinned meshes baked to the bind pose and merged per material, pouches and spare magazines attached to bones, the AKS-74U split into its own frame and decimated, hand/finger grip and the low-ready pose sampled from the model's idle animation, textures downscaled, geometry quantized; stored in `js/soldierdata.js`. The original `.glb` isn't needed at runtime.
