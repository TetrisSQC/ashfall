import * as THREE from 'three';

const NOISE = /* glsl */`
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// Art-directed golden-hour sky with haze, mie glow, sun disk and drifting clouds (linear HDR out)
export const SkyShader = {
  uniforms: {
    sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
    horizon: { value: new THREE.Color(0.78, 0.66, 0.52) },
    zenith: { value: new THREE.Color(0.13, 0.24, 0.46) },
    time: { value: 0 },
    cloudAmt: { value: 1.0 },
    sunDisk: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 sunDir, horizon, zenith;
    uniform float time, cloudAmt, sunDisk;
    varying vec3 vDir;
    ${NOISE}
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      float sd = max(dot(d, sunDir), 0.0);
      float t = pow(clamp(h, 0.0, 1.0), 0.5);
      vec3 col = mix(horizon, zenith, t);
      // warm band around the horizon, strongest toward the sun
      col += vec3(0.55, 0.28, 0.1) * pow(1.0 - abs(h), 12.0) * (0.35 + 0.65 * pow(sd, 2.0));
      if (h < 0.0) col = mix(horizon, horizon * vec3(0.72, 0.66, 0.6), clamp(-h * 5.0, 0.0, 1.0));
      // mie scattering glow
      col += vec3(1.0, 0.6, 0.28) * (pow(sd, 6.0) * 0.55 + pow(sd, 48.0) * 1.6 + pow(sd, 700.0) * 6.0);
      // clouds
      if (h > 0.0 && cloudAmt > 0.0) {
        vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(time * 0.006, time * 0.002);
        float c = fbm(uv * 1.1);
        float c2 = fbm(uv * 3.1 + 5.0);
        float cov = smoothstep(0.48, 0.78, c * 0.8 + c2 * 0.3) * smoothstep(0.0, 0.12, h) * cloudAmt;
        vec3 lit = vec3(1.9, 1.15, 0.62) * (0.4 + 1.3 * pow(sd, 3.0));
        vec3 shade = vec3(0.42, 0.38, 0.4);
        vec3 cc = mix(shade, lit, smoothstep(0.35, 0.9, c2 + pow(sd, 2.0) * 0.4));
        col = mix(col, cc, cov * 0.88);
        // silver lining
        col += vec3(2.0, 1.2, 0.6) * pow(sd, 20.0) * cov * (1.0 - cov) * 3.0;
      }
      col += vec3(60.0, 42.0, 26.0) * smoothstep(0.99955, 0.9998, sd) * sunDisk;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// screen-space radial light shafts from bright sky around the sun (HDR, pre-tonemap)
export const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    sunPos: { value: new THREE.Vector2(0.5, 0.5) },
    intensity: { value: 0.5 },
    aspect: { value: 1.7 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 sunPos;
    uniform float intensity, aspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (intensity <= 0.001) { gl_FragColor = base; return; }
      const int N = 40;
      vec2 delta = (vUv - sunPos) * (0.92 / float(N));
      vec2 uv = vUv - delta * hash(vUv * 1000.0);
      float decay = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < N; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        acc += s * smoothstep(1.8, 4.0, l) * decay;
        decay *= 0.955;
      }
      vec2 dd = (vUv - sunPos) * vec2(aspect, 1.0);
      float fall = exp(-dot(dd, dd) * 1.6);
      gl_FragColor = vec4(base.rgb + acc / float(N) * intensity * vec3(1.0, 0.78, 0.5) * (0.35 + fall), base.a);
    }
  `,
};

// final display-space grade: split tone, contrast, vignette, chromatic aberration, grain, damage
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    damage: { value: 0 },
    aberration: { value: 0.0012 },
    adsVignette: { value: 0 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, damage, aberration, adsVignette;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * aberration * 10.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // split toning: cool shadows, warm highlights
      col += vec3(-0.012, 0.004, 0.026) * (1.0 - smoothstep(0.0, 0.5, l));
      col += vec3(0.022, 0.008, -0.018) * smoothstep(0.45, 1.0, l);
      // gentle S-curve contrast
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
      // saturation (drops when hurt)
      l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.06 - damage * 0.5);
      // vignette (stronger when aiming)
      float v = smoothstep(0.95, 0.25, length(c * vec2(1.0, 0.85)) * (1.0 + adsVignette * 0.35));
      col *= mix(0.62, 1.0, v);
      // damage: red edges
      float edge = smoothstep(0.32, 0.85, length(c));
      col = mix(col, col * vec3(1.1, 0.3, 0.25), damage * edge * 0.7);
      // film grain
      float g = hash(vUv * 1733.0 + fract(time * 7.13) * 91.0) - 0.5;
      col += g * 0.03 * (1.0 - l * 0.5);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

// Exponential height fog with sun in-scattering, patched into every built-in material.
export function installFog(sunDir, sunColor, heightFalloff = 0.045) {
  const v3 = (v) => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
  const c3 = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying vec3 vFogWorld;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogWorld = (inverse(viewMatrix) * vec4(mvPosition.xyz, 1.0)).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  vec3 fogRay = vFogWorld - cameraPosition;
  float fogDist = length(fogRay);
  vec3 fogDir = fogRay / max(fogDist, 1e-4);
  const float HF = ${heightFalloff.toFixed(4)};
  float fy0 = max(cameraPosition.y, 0.0), fdy = fogRay.y;
  float heightInt = abs(fdy) > 0.05 ? (exp(-HF * fy0) - exp(-HF * (fy0 + fdy))) / (HF * fdy) : exp(-HF * fy0);
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDist * (0.3 + 1.7 * clamp(heightInt, 0.0, 1.5)));
  #else
    float fogFactor = smoothstep(fogNear, fogFar, fogDist);
  #endif
  float sunAmt = pow(max(dot(fogDir, ${v3(sunDir)}), 0.0), 6.0) * smoothstep(10.0, 90.0, fogDist);
  vec3 fogCol = mix(fogColor, ${c3(sunColor)}, sunAmt * 0.8);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogCol, fogFactor);
#endif`;
}
