/**
 * TemperatureMaterial.ts — Custom ShaderMaterial for temperature-based coloring.
 *
 * Uses a per-vertex `temperature` attribute that drives a vivid scientific
 * colormap (Jet/Turbo-like) in the fragment shader.
 *
 * Global normalization: 10°C → 30°C
 * Rendering: unlit / emissive — the temperature color IS the final color.
 *
 * Ported from sih_apraxia/frontend/src/TemperatureMaterial.ts
 */

import * as THREE from 'three';

/** Fixed global display range */
export const DISPLAY_TEMP_MIN = 10.0;
export const DISPLAY_TEMP_MAX = 30.0;

const vertexShader = /* glsl */ `
  attribute float temperature;
  varying float vTemp;

  void main() {
    vTemp = temperature;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTempMin;
  uniform float uTempMax;

  varying float vTemp;

  // 11-stop Jet/Turbo-like scientific colormap
  // Matches: 10°C deep-blue → 30°C deep-red
  vec3 temperatureColor(float t) {
    t = clamp(t, 0.0, 1.0);

    vec3 c00 = vec3(0.090, 0.090, 0.722);  // 10°C  #1717B8 dark blue
    vec3 c01 = vec3(0.165, 0.165, 0.878);  // 12°C  #2A2AE0 deep blue
    vec3 c02 = vec3(0.000, 0.333, 1.000);  // 14°C  #0055FF blue
    vec3 c03 = vec3(0.000, 0.467, 1.000);  // 16°C  #0077FF blue-cyan
    vec3 c04 = vec3(0.000, 0.749, 1.000);  // 18°C  #00BFFF cyan
    vec3 c05 = vec3(0.000, 0.902, 0.463);  // 20°C  #00E676 green
    vec3 c06 = vec3(0.875, 1.000, 0.000);  // 22°C  #DFFF00 yellow-green
    vec3 c07 = vec3(1.000, 0.816, 0.000);  // 24°C  #FFD000 yellow-orange
    vec3 c08 = vec3(1.000, 0.549, 0.000);  // 26°C  #FF8C00 orange
    vec3 c09 = vec3(1.000, 0.271, 0.000);  // 28°C  #FF4500 red-orange
    vec3 c10 = vec3(0.816, 0.000, 0.000);  // 30°C  #D00000 deep red

    float s = t * 10.0;

    if (s < 1.0) return mix(c00, c01, s);
    if (s < 2.0) return mix(c01, c02, s - 1.0);
    if (s < 3.0) return mix(c02, c03, s - 2.0);
    if (s < 4.0) return mix(c03, c04, s - 3.0);
    if (s < 5.0) return mix(c04, c05, s - 4.0);
    if (s < 6.0) return mix(c05, c06, s - 5.0);
    if (s < 7.0) return mix(c06, c07, s - 6.0);
    if (s < 8.0) return mix(c07, c08, s - 7.0);
    if (s < 9.0) return mix(c08, c09, s - 8.0);
    return mix(c09, c10, s - 9.0);
  }

  void main() {
    if (vTemp < -900.0) discard;

    float t = clamp((vTemp - uTempMin) / (uTempMax - uTempMin), 0.0, 1.0);
    vec3 color = temperatureColor(t);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createTemperatureMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTempMin: { value: DISPLAY_TEMP_MIN },
      uTempMax: { value: DISPLAY_TEMP_MAX },
    },
    side: THREE.DoubleSide,
    transparent: false,
  });
}

/**
 * Procedural terrain shader for land regions on the top surface.
 * Uses position-based noise to create a subtle, muted terrain appearance
 * in dark olive / brown / forest green tones — visually distinct from
 * both the ocean temperature colormap and the dark background.
 */
const landVertexShader = /* glsl */ `
  varying vec3 vWorldPos;

  void main() {
    vWorldPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const landFragmentShader = /* glsl */ `
  varying vec3 vWorldPos;

  // Simple hash-based pseudo-random for procedural noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Value noise with smooth interpolation
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal brownian motion for organic terrain variation
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.2;
      amplitude *= 0.45;
    }
    return value;
  }

  void main() {
    // Use world XZ as noise coordinates (scaled for terrain-like detail)
    vec2 uv = vWorldPos.xz * 1.8;
    float n = fbm(uv);

    // Three muted terrain base colors
    vec3 darkOlive   = vec3(0.18, 0.22, 0.12);  // #2E3820
    vec3 earthBrown   = vec3(0.22, 0.18, 0.13);  // #382E21
    vec3 forestGreen  = vec3(0.14, 0.20, 0.14);  // #243324

    // Mix between terrain tones based on noise
    vec3 color = mix(darkOlive, earthBrown, smoothstep(0.3, 0.7, n));

    // Second noise layer for more variation
    float n2 = fbm(uv * 1.5 + 5.0);
    color = mix(color, forestGreen, smoothstep(0.4, 0.65, n2) * 0.6);

    // Subtle brightness variation for depth
    float brightness = 0.85 + 0.15 * fbm(uv * 0.7 + 10.0);
    color *= brightness;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Muted procedural terrain material for land on the top surface */
export function createLandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: landVertexShader,
    fragmentShader: landFragmentShader,
    side: THREE.DoubleSide,
  });
}
