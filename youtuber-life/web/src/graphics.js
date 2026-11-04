// ============================================================================
// Gráficos: materiales PBR con detalle procedural en coordenadas de mundo (sin texturas externas),
// fachadas con ventanas, aceras con baldosas, césped y asfalto con grano, agua animada,
// cielo con degradado, sol y nubes, reflejos del cielo (mapa de entorno) y halos de las farolas.
// ============================================================================
"use strict";
const GFX = {
  time: { value: 0 }, night: { value: 0 }, noise: null, sky: null, envScene: null, envRT: null, pmrem: null,
  glows: [], glowPts: null, lastEnvKey: "", envT: 0,
};

// ---------------------------------------------------------------- Todos los materiales pasan a ser PBR
(function () {
  const Std = THREE.MeshStandardMaterial;
  const make = (p, rough) => {
    p = Object.assign({}, p || {});
    let r = rough;
    if (p.shininess !== undefined) { r = Math.max(0.08, Math.min(1, 1 - p.shininess / 110)); delete p.shininess; }
    delete p.specular; delete p.combine; delete p.reflectivity;
    return new Std(Object.assign({ roughness: r, metalness: 0, envMapIntensity: 0.55 }, p));
  };
  THREE.MeshLambertMaterial = function (p) { return make(p, 0.88); };
  THREE.MeshPhongMaterial = function (p) { return make(p, 0.35); };
})();

// Colores 0-255 (sRGB) → color lineal correcto (antes se veían lavados)
GFX.rgb = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

// ---------------------------------------------------------------- Textura de ruido periódica (R fino, G grueso, B celdas)
GFX.makeNoise = function () {
  const N = 256, data = new Uint8Array(N * N * 4);
  const lattice = (cells, seed) => { const a = new Float32Array(cells * cells); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
  const sm = t => t * t * (3 - 2 * t);
  const octave = (x, y, cells, lat) => {
    const fx = x / N * cells, fy = y / N * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const g = (i, j) => lat[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx, b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx;
    return a + (b - a) * ty;
  };
  const fineL = [lattice(16, 7), lattice(32, 11), lattice(64, 13), lattice(128, 17)];
  const coarseL = [lattice(4, 19), lattice(8, 23), lattice(16, 29)];
  const cellL = lattice(8, 31);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = octave(x, y, 16, fineL[0]) * 0.4 + octave(x, y, 32, fineL[1]) * 0.3 + octave(x, y, 64, fineL[2]) * 0.2 + octave(x, y, 128, fineL[3]) * 0.1;
    const c = octave(x, y, 4, coarseL[0]) * 0.5 + octave(x, y, 8, coarseL[1]) * 0.3 + octave(x, y, 16, coarseL[2]) * 0.2;
    const cl = cellL[Math.floor(y / N * 8) * 8 + Math.floor(x / N * 8)];
    const i = (y * N + x) * 4; data[i] = f * 255; data[i + 1] = c * 255; data[i + 2] = cl * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
};

// ---------------------------------------------------------------- Inyección de código en los shaders estándar
const GFX_HELPERS = `
varying vec3 vWPos; varying vec3 vWNor;
uniform sampler2D uNoise; uniform float uTime; uniform float uNight;
vec4 gTri(float s) { vec3 w = abs(vWNor); w /= (w.x + w.y + w.z + 1e-4);
  return texture2D(uNoise, vWPos.zy * s) * w.x + texture2D(uNoise, vWPos.xz * s) * w.y + texture2D(uNoise, vWPos.xy * s) * w.z; }
float gHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;
GFX.patch = function (mat, key, code) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNoise = { value: GFX.noise }; sh.uniforms.uTime = GFX.time; sh.uniforms.uNight = GFX.night;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos; varying vec3 vWNor;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);");
    let f = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + GFX_HELPERS);
    if (code.color) f = f.replace("#include <color_fragment>", "#include <color_fragment>\n" + code.color);
    if (code.rough) f = f.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + code.rough);
    if (code.metal) f = f.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + code.metal);
    if (code.normal) f = f.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + code.normal);
    if (code.emissive) f = f.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + code.emissive);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => "gfx-" + key;
  return mat;
};

// Grano general + oclusión ambiental falsa en la base de las paredes
const GFX_SOLID = `
  vec4 gN = gTri(0.11); vec4 gC = gTri(0.013);
  float gVert = 1.0 - abs(vWNor.y);
  float gAO = mix(1.0, 0.58 + 0.42 * smoothstep(0.0, 3.2, vWPos.y - 0.3), gVert);
  diffuseColor.rgb *= (0.84 + 0.26 * gN.r * (0.55 + 0.9 * gC.g)) * gAO;
`;
// Fachadas: rejilla de ventanas en las caras verticales; de noche algunas se encienden
const GFX_FACADE = `
  vec4 gN = gTri(0.11); vec4 gC = gTri(0.013);
  float gVert = step(abs(vWNor.y), 0.3);
  float gU = abs(vWNor.x) > 0.5 ? vWPos.z : vWPos.x;
  float gV = vWPos.y - 0.3;
  vec2 gCell = vec2(gU / 4.6, (gV - 5.2) / 4.4);
  vec2 gF = fract(gCell);
  float gWin = gVert * step(0.0, gV - 5.2) * step(0.16, gF.x) * step(gF.x, 0.84) * step(0.2, gF.y) * step(gF.y, 0.84);
  float gLit = step(0.6, gHash(floor(gCell) + floor(vWPos.xz / 61.0) * 17.0));
  float gAO = mix(1.0, 0.6 + 0.4 * smoothstep(0.0, 3.2, gV), gVert);
  vec3 gGlass = mix(vec3(0.035, 0.06, 0.1), vec3(0.2, 0.3, 0.42), gF.y * 0.7 + gN.r * 0.3);
  gGlass = mix(gGlass, vec3(0.12, 0.1, 0.07), gLit * uNight * 0.6);
  float gSill = gVert * step(0.0, gV - 5.2) * step(gF.y, 0.2) * step(0.12, gF.y) * step(0.12, gF.x) * step(gF.x, 0.88);
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.86 + 0.22 * gN.r * (0.6 + 0.8 * gC.g)) * gAO * (1.0 - gSill * 0.25), gGlass, gWin);
`;
const GFX_FACADE_ROUGH = `roughnessFactor = mix(roughnessFactor, 0.12, gWin);`;
const GFX_FACADE_METAL = `metalnessFactor = mix(metalnessFactor, 0.35, gWin);`;
const GFX_FACADE_EMIS = `float gH2 = gHash(floor(gCell) * 1.7 + 3.1);
  vec3 gLc = mix(vec3(1.0, 0.68, 0.32), vec3(0.8, 0.88, 1.0), step(0.78, gH2));
  totalEmissiveRadiance += gLc * gWin * gLit * uNight * (0.45 + 0.9 * gH2);`;
// Suelo: asfalto con manchas, baldosas en las aceras claras, césped con variación
const GFX_GROUND = `
  vec3 gc = diffuseColor.rgb;
  vec4 gN = texture2D(uNoise, vWPos.xz * 0.09); vec4 gC = texture2D(uNoise, vWPos.xz * 0.012);
  float gLum = dot(gc, vec3(0.299, 0.587, 0.114));
  float gSat = max(gc.r, max(gc.g, gc.b)) - min(gc.r, min(gc.g, gc.b));
  float gGreen = clamp((gc.g - max(gc.r, gc.b)) * 7.0, 0.0, 1.0);
  gc *= 0.82 + 0.32 * gN.r * (0.5 + gC.g);
  gc = mix(gc, gc * vec3(1.18, 1.06, 0.62), gGreen * smoothstep(0.42, 0.8, gC.g) * 0.7);
  gc *= mix(1.0, 0.72 + 0.5 * texture2D(uNoise, vWPos.xz * 0.45).r, gGreen);
  gc = mix(gc, vec3(dot(gc, vec3(0.299, 0.587, 0.114))), gGreen * 0.2);
  float gTile = (1.0 - gGreen) * step(0.3, gLum) * step(gSat, 0.06);
  vec2 gG = abs(fract(vWPos.xz / 3.0) - 0.5);
  gc *= 1.0 - gTile * smoothstep(0.46, 0.5, max(gG.x, gG.y)) * 0.32;
  float gAsph = step(gLum, 0.08) * step(gSat, 0.03);
  gc *= 1.0 - gAsph * (0.3 * smoothstep(0.55, 0.9, gC.r) - 0.25 * smoothstep(0.7, 1.0, gN.r));
  diffuseColor.rgb = gc;
`;
const GFX_GROUND_ROUGH = `roughnessFactor = clamp(roughnessFactor - 0.25 * step(diffuseColor.r, 0.08) * smoothstep(0.6, 0.9, texture2D(uNoise, vWPos.xz * 0.012).r), 0.0, 1.0);`;
// Agua: olas animadas en la normal (el reflejo del cielo viene del mapa de entorno)
const GFX_WATER_N = `
  vec2 gw = vWPos.xz; float gt = uTime;
  vec2 gd = vec2(cos(gw.x * 0.11 + gt * 1.1), cos(gw.y * 0.09 + gt * 0.9)) * 0.1
          + vec2(cos((gw.x + gw.y) * 0.23 + gt * 1.7), cos((gw.x - gw.y) * 0.19 - gt * 1.3)) * 0.06
          + (texture2D(uNoise, gw * 0.015 + gt * 0.008).rg - 0.5) * 0.3;
  normal = normalize(normal + (viewMatrix * vec4(gd.x, 0.0, gd.y, 0.0)).xyz);
`;
const GFX_WATER_C = `diffuseColor.rgb *= 0.75 + 0.35 * texture2D(uNoise, vWPos.xz * 0.01 + uTime * 0.004).g;`;

GFX.solid = () => GFX.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.5 }), "solid", { color: GFX_SOLID });
GFX.facade = () => GFX.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, envMapIntensity: 0.8, emissive: 0x000000 }), "facade", { color: GFX_FACADE, rough: GFX_FACADE_ROUGH, metal: GFX_FACADE_METAL, emissive: GFX_FACADE_EMIS });
GFX.ground = () => GFX.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.35 }), "ground", { color: GFX_GROUND, rough: GFX_GROUND_ROUGH });
GFX.water = () => GFX.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.2 }), "water", { color: GFX_WATER_C, normal: GFX_WATER_N });

// ---------------------------------------------------------------- Cielo: degradado, sol, nubes
const GFX_SKY_V = `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; }`;
const GFX_SKY_F = `
varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform vec3 uCloudCol; uniform float uCloud; uniform float uTime; uniform sampler2D uNoise; uniform float uSunVis;
void main() {
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uBot, clamp(-h * 5.0, 0.0, 1.0));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * uSunVis * (pow(s, 1200.0) * 8.0 + pow(s, 40.0) * 0.25 + pow(s, 6.0) * 0.12);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.15) * 0.22 + vec2(uTime * 0.0035, uTime * 0.0015);
    float n = texture2D(uNoise, uv).g * 0.55 + texture2D(uNoise, uv * 2.9).r * 0.3 + texture2D(uNoise, uv * 7.3).r * 0.15;
    float c = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.22, n) * smoothstep(0.0, 0.2, h);
    vec3 cc = mix(uCloudCol, uCloudCol * 0.62, smoothstep(0.55, 1.0, n)) + uSunCol * uSunVis * pow(s, 5.0) * 0.35;
    col = mix(col, cc, c * 0.93);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
GFX.initSky = function (scene) {
  GFX.noise = GFX.noise || GFX.makeNoise();
  const uniforms = {
    uTop: { value: new THREE.Color(0x3a78c8) }, uHor: { value: new THREE.Color(0xb8daf5) }, uBot: { value: new THREE.Color(0x6a7a6a) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5) }, uSunCol: { value: new THREE.Color(0xfff2d8) }, uSunVis: { value: 1 },
    uCloudCol: { value: new THREE.Color(0xffffff) }, uCloud: { value: 0.4 }, uTime: GFX.time, uNoise: { value: GFX.noise },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: GFX_SKY_V, fragmentShader: GFX_SKY_F, side: THREE.BackSide, depthWrite: false, fog: false });
  GFX.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
  GFX.sky.renderOrder = -10; GFX.sky.frustumCulled = false;
  scene.add(GFX.sky);
  // escena aparte con el mismo cielo para generar los reflejos (mapa de entorno)
  GFX.envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat); GFX.envScene.add(envSky);
  const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(45, 24), new THREE.MeshBasicMaterial({ color: 0x55604f }));
  groundDisc.rotation.x = -Math.PI / 2; groundDisc.position.y = -3; GFX.envScene.add(groundDisc); GFX.envGround = groundDisc;
  // halos de luz de las farolas (se rellenan al construir el mundo)
  GFX.glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.25, "rgba(255,210,140,.55)"); gr.addColorStop(1, "rgba(255,180,90,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
};
GFX.glowAt = (x, y, z) => GFX.glows.push(x, y, z);
GFX.buildGlows = function (scene) {
  if (!GFX.glows.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(GFX.glows, 3));
  GFX.glowPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 16, map: GFX.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: true, fog: true }));
  scene.add(GFX.glowPts);
};

// Colores del cielo según la hora y el clima (llamado desde W.updateSky)
GFX.updateSky = function (hour, weather, renderer, scene) {
  if (!GFX.sky) return;
  const u = GFX.sky.material.uniforms;
  const t = hour / 24 * Math.PI * 2 - Math.PI / 2, elev = Math.sin(t);
  const day = clamp(elev * 2.5 + 0.3, 0, 1), dusk = clamp(1 - Math.abs(elev) * 4, 0, 1) * (elev > -0.2 ? 1 : 0);
  const wDim = { Cloudy: 0.3, Rain: 0.55, Fog: 0.45, Storm: 0.7 }[weather] || 0;
  const H = h => new THREE.Color(h);
  const top = H(0x050a1e).lerp(H(0x2f6fc4), day).lerp(H(0x4a4f8a), dusk * 0.5).lerp(H(0x5a6270), wDim * day * 0.9);
  const hor = H(0x0e1630).lerp(H(0xbfdcf2), day).lerp(H(0xff9a5a), dusk * 0.75).lerp(H(0x9aa2ac), wDim * day * 0.8);
  u.uTop.value.copy(top); u.uHor.value.copy(hor); u.uBot.value.copy(hor.clone().multiplyScalar(0.55));
  u.uCloud.value = { Clear: 0.38, Cloudy: 0.72, Rain: 0.92, Fog: 0.6, Storm: 0.97 }[weather] || 0.4;
  u.uCloudCol.value.copy(H(0x1a1f2e).lerp(H(0xffffff), day).lerp(H(0xffc8a0), dusk * 0.6).multiplyScalar(1 - wDim * 0.45));
  u.uSunCol.value.copy(dusk > 0.3 ? H(0xffb070) : H(0xfff2d8)); u.uSunVis.value = clamp(elev * 6 + 0.4, 0, 1) * (1 - wDim * 0.85);
  if (W.sunDir) u.uSunDir.value.copy(W.sunDir);
  GFX.night.value = clamp(1 - day * 1.6, 0, 1);
  if (GFX.glowPts) GFX.glowPts.material.opacity = GFX.night.value * 0.95;
  scene.fog.color.copy(hor);
  scene.background = null;
  GFX.envGround.material.color.copy(H(0x3a4636).multiplyScalar(0.25 + 0.75 * day));
  // reflejos: regenerar el mapa de entorno solo cuando el cielo cambia de verdad
  const key = Math.round(hour * 2) + weather;
  if (key !== GFX.lastEnvKey && renderer) {
    GFX.lastEnvKey = key;
    GFX.pmrem = GFX.pmrem || new THREE.PMREMGenerator(renderer);
    const old = GFX.envRT; GFX.envRT = GFX.pmrem.fromScene(GFX.envScene, 0.02); scene.environment = GFX.envRT.texture; if (old) old.dispose();
  }
};
GFX.update = function (dt, camera) {
  GFX.time.value += dt;
  if (GFX.sky) GFX.sky.position.copy(camera.position);
};
