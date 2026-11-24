// band.js — процедурная модель «De Band» и зал: трикотаж (canvas-нормали), латекс, шов, этикетка, опоры-носки,
// дубовый пол, мат, стена-зеркало, станок, бархатные шторы. Всё в сантиметрах, без внешних ассетов.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { N, BAND_W, BAND_T, CAP_R, CAP_H, MAT_Y } from './choreo.js';

export const COL = { sock: '#FBF8F6', ink: '#231A1D', red: '#A3192B', pink: '#F2B3C3', pinkHi: '#F8D3DD', wine: '#3E0D16', mirror: '#DADCE2', oak: '#C8996A' };
export const WALL_Z = -46;

/* ---------- canvas-утилиты ---------- */
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// высоты → карта нормалей (tileable)
function heightToNormal(H, w, h, strength) {
  const c = cnv(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
function tex(c, { repeat = [1, 1], srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; t.needsUpdate = true; return t;
}

/* ---------- трикотаж: колонки петель «V», рубчик 2 мм, меланж ---------- */
export function knitMaps(size = 512) {
  const w = size, h = size / 2, H = new Float32Array(w * h), A = new Float32Array(w * h), r = rng(7);
  const cols = 32, rows = 24, cw = w / cols, ch = h / rows;           // tile = 10 см × 7 см: колонка ~3 мм
  const jit = new Float32Array(cols * rows).map(() => r());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
    const fx = (x / cw - cx) * 2 - 1, fy = (y / ch - cy);
    // две наклонные «ноги» петли
    const leg = Math.abs(Math.abs(fx) - (0.15 + fy * 0.6));
    const v = Math.exp(-(leg * leg) / 0.07) * (0.75 + 0.25 * Math.sin(fy * Math.PI));
    const gap = Math.exp(-(fx * fx) / 0.01) * 0.25;                    // ложбинка между колонками
    const j = jit[(cy % rows) * cols + (cx % cols)];
    H[y * w + x] = v * (0.85 + 0.3 * j) - gap;
    A[y * w + x] = 0.9 + 0.1 * v + (r() - 0.5) * 0.05 + (j - 0.5) * 0.04;
  }
  const n = heightToNormal(H, w, h, 2.4);
  const c = cnv(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, A[i] * 255)); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { normal: n, albedo: c };
}
// латекс-нити: альфа-полосы поперёк ширины
function threadsAlpha() {
  const c = cnv(128, 4), ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 4); ctx.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) ctx.fillRect(6 + i * 10, 0, 4, 4);
  return c;
}
/* ---------- дуб: доски вдоль x ---------- */
function oakMaps() {
  const w = 1024, h = 1024, c = cnv(w, h), ctx = c.getContext('2d'), rc = cnv(w, h), rx = rc.getContext('2d'), r = rng(11);
  const boards = 8, bh = h / boards;
  for (let b = 0; b < boards; b++) {
    let x = -r() * 400;
    while (x < w) {
      const len = 380 + r() * 520, tone = r();
      const base = [200 + tone * 26 - 13, 153 + tone * 22 - 11, 106 + tone * 18 - 9];
      ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; ctx.fillRect(x, b * bh, len, bh);
      // волокна
      for (let g = 0; g < 70; g++) {
        const gy = b * bh + r() * bh, a = 0.04 + r() * 0.07, ph = r() * 6;
        ctx.strokeStyle = `rgba(${90 + r() * 30},${55 + r() * 20},${30},${a})`; ctx.lineWidth = 0.6 + r() * 1.6; ctx.beginPath();
        for (let s = 0; s <= len; s += 16) { const yy = gy + Math.sin(s * 0.012 + ph) * 3 * r(); s ? ctx.lineTo(x + s, yy) : ctx.moveTo(x + s, yy); }
        ctx.stroke();
      }
      rx.fillStyle = `rgb(${110 + tone * 40},${110 + tone * 40},${110 + tone * 40})`; rx.fillRect(x, b * bh, len, bh);
      ctx.fillStyle = 'rgba(70,40,20,.55)'; ctx.fillRect(x, b * bh, 2, bh);  // торец доски
      x += len;
    }
    ctx.fillStyle = 'rgba(60,35,18,.6)'; ctx.fillRect(0, b * bh, w, 2);   // шов между досками
    rx.fillStyle = '#ddd'; rx.fillRect(0, b * bh, w, 2);
  }
  return { map: c, rough: rc };
}
function noiseNormal(size, amp, seed) {
  const H = new Float32Array(size * size), r = rng(seed);
  for (let i = 0; i < H.length; i++) H[i] = r();
  // мягкое размытие
  const B = new Float32Array(H.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let s = 0; for (let k = -1; k <= 1; k++) for (let l = -1; l <= 1; l++) s += H[((y + k + size) % size) * size + (x + l + size) % size]; B[y * size + x] = s / 9; }
  return heightToNormal(B, size, size, amp);
}
function labelCanvas() {
  const c = cnv(512, 344), x = c.getContext('2d');
  x.fillStyle = COL.red; x.fillRect(0, 0, 512, 344);
  // тканая фактура
  for (let i = 0; i < 344; i += 3) { x.fillStyle = `rgba(0,0,0,${i % 6 ? 0.05 : 0.11})`; x.fillRect(0, i, 512, 1); }
  for (let i = 0; i < 512; i += 4) { x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(i, 0, 1, 344); }
  x.fillStyle = COL.sock; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 54px Unbounded, sans-serif'; x.fillText('STRETCHING', 256, 150);
  x.font = '500 30px "Golos Text", sans-serif'; x.fillText('ENSCHEDE · MONDAY 18:00', 256, 222);
  x.strokeStyle = 'rgba(251,248,246,.5)'; x.setLineDash([10, 8]); x.lineWidth = 3; x.strokeRect(18, 18, 476, 308);
  return c;
}
function digitsCanvas() {
  const c = cnv(2048, 640), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = '300 560px Unbounded, sans-serif'; x.fillText('18:00', 1024, 560);
  return c;
}

/* ---------- петля: оболочка (сечение — плоский скруглённый прямоугольник) ---------- */
// сечение: [a (доля ширины), b (доля толщины), na, nb]
const XS = [
  [-0.47, 0.5, 0, 1], [-0.2, 0.56, 0, 1], [0.2, 0.56, 0, 1], [0.47, 0.5, 0, 1],
  [0.5, 0.2, 0.8, 0.6], [0.5, -0.2, 0.8, -0.6],
  [0.47, -0.5, 0, -1], [0.2, -0.56, 0, -1], [-0.2, -0.56, 0, -1], [-0.47, -0.5, 0, -1],
  [-0.5, -0.2, -0.8, -0.6], [-0.5, 0.2, -0.8, 0.6],
];
const XV = [0, 0.27, 0.73, 1, 1.03, 1.06, 1.09, 1.36, 1.82, 2.09, 2.12, 2.15];
export function buildBand({ segments = 384, maps }) {
  const M = segments, K = XS.length, R = K + 1; // кольцо с замыкающей вершиной для uv
  const vCount = (M + 1) * R;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const col = new Float32Array(vCount * 3);
  for (let j = 0; j <= M; j++) for (let k = 0; k < R; k++) {
    const i = j * R + k; uv[i * 2] = (j / M) * 4.2; uv[i * 2 + 1] = k === K ? 2.18 : XV[k];
    const kk = k % K, edge = kk === 4 || kk === 5 || kk === 10 || kk === 11 ? 1.18 : kk === 0 || kk === 3 || kk === 6 || kk === 9 ? 1.06 : 0.97; // светлая кромка
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = edge;
  }
  const idx = [];
  for (let j = 0; j < M; j++) for (let k = 0; k < K; k++) { const a = j * R + k, b = a + 1, c = a + R, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 10, 0), 80);
  const mat = new THREE.MeshPhysicalMaterial({
    color: COL.pink, vertexColors: true, roughness: 0.86, metalness: 0, map: maps.albedo, normalMap: maps.normal, normalScale: new THREE.Vector2(1.3, 1.3),
    sheen: 1, sheenColor: new THREE.Color('#FFD9E2'), sheenRoughness: 0.42, envMapIntensity: 0.7,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.userData = { M, R, K, pos, nor };
  return mesh;
}
export function buildCore(M, alpha) {
  const g = new THREE.BufferGeometry(), R = 2, v = (M + 1) * R;
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), uv = new Float32Array(v * 2);
  for (let j = 0; j <= M; j++) for (let k = 0; k < R; k++) { const i = j * R + k; uv[i * 2] = k; uv[i * 2 + 1] = (j / M) * 40; }
  const idx = []; for (let j = 0; j < M; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshPhysicalMaterial({ color: '#F8D3DD', roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.castShadow = true; m.userData = { M, pos, nor }; return m;
}
export function buildSeam(count) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: COL.red, roughness: 0.7 });
  const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; m.castShadow = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m;
}
export function buildLabel() {
  const t = new THREE.CanvasTexture(labelCanvas()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const geo = new RoundedBoxGeometry(3.6, 2.42, 0.16, 2, 0.08);
  const mat = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.75, sheen: 0.6, sheenColor: new THREE.Color('#ff8a98'), emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0 });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.matrixAutoUpdate = false; return m;
}
// опоры: абстрактные стопы в белых носках (как на её фото) — голень-цилиндр, стопа, пятка, манжета; без тела
export function buildCapsule(maps) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const nm = maps.normal.clone(); nm.repeat.set(2.2, 3.2); nm.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({ color: '#F6F2EF', roughness: 0.92, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7), sheen: 0.8, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5, emissive: COL.pink, emissiveIntensity: 0 });
  const B = -CAP_H / 2; // низ (на мате)
  // стопа: Lathe-профиль «пятка → подъём → носок», вытянутый вдоль z
  const prof = [[0, 0], [1.6, 0.05], [2.5, 0.35], [2.85, 1.1], [2.8, 2.0], [2.35, 2.8], [1.4, 3.35], [0, 3.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const footGeo = new THREE.LatheGeometry(prof, 40);
  const foot = new THREE.Mesh(footGeo, mat); foot.scale.set(1, 0.92, 3.1); foot.position.set(0, B, 4.4); foot.castShadow = foot.receiveShadow = true;
  const heel = new THREE.Mesh(new THREE.SphereGeometry(2.9, 32, 16), mat); heel.scale.set(1, 1.05, 1); heel.position.set(0, B + 2.9, -0.4); heel.castShadow = true;
  // короткая голень-носок, сужается к лодыжке
  const legH = 7.2, leg = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.95, legH, 40, 1, true), mat); leg.position.y = B + 2.9 + legH / 2; leg.castShadow = leg.receiveShadow = true;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(2.72, 2.68, 2.2, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: '#EEE7E3', roughness: 0.9, normalMap: nm, sheen: 0.6, sheenColor: new THREE.Color('#fff'), side: THREE.DoubleSide }));
  cuff.position.y = leg.position.y + legH / 2 - 1.0; cuff.castShadow = true;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: '#D6CDC9', roughness: 1 }));
  inside.rotation.x = -Math.PI / 2; inside.position.y = leg.position.y + legH / 2 - 0.4;
  inner.add(foot, heel, leg, cuff, inside); g.userData.mat = mat; return g;
}
// мягкая контактная тень под петлёй (запечённый AO-блоб)
export function buildContact() {
  const c = cnv(256, 256), x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(60,20,30,.55)'); gr.addColorStop(0.55, 'rgba(60,20,30,.22)'); gr.addColorStop(1, 'rgba(60,20,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.7 }));
  m.rotation.x = -Math.PI / 2; m.position.y = MAT_Y + 0.03; m.renderOrder = 1; return m;
}

/* ---------- зал ---------- */
export function buildRoom({ mobile = false, env }) {
  const room = new THREE.Group();
  const oak = oakMaps();
  const oakMap = tex(oak.map, { repeat: [3, 3], srgb: true }), oakR = tex(oak.rough, { repeat: [3, 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), new THREE.MeshPhysicalMaterial({ map: oakMap, roughnessMap: oakR, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3, color: '#ffffff' }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = WALL_Z + 360; floor.receiveShadow = true; room.add(floor);
  // мат: светло-розовый, микропора
  const foam = tex(noiseNormal(256, 1.2, 3), { repeat: [14, 6] });
  const mat = new THREE.Mesh(new RoundedBoxGeometry(176, MAT_Y, 64, 3, 0.45), new THREE.MeshPhysicalMaterial({ color: '#F0C3CF', roughness: 0.92, normalMap: foam, normalScale: new THREE.Vector2(0.35, 0.35), sheen: 0.4, sheenColor: new THREE.Color('#fff') }));
  mat.position.y = MAT_Y / 2; mat.receiveShadow = true; room.add(mat);
  // стена (за зеркалом), тёплая штукатурка
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(900, 420), new THREE.MeshStandardMaterial({ color: '#EADFD9', roughness: 0.95 }));
  wall.position.set(0, 210, WALL_Z); wall.receiveShadow = true; room.add(wall);
  // плинтус
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(900, 6, 1.2), new THREE.MeshStandardMaterial({ color: '#F4EEEA', roughness: 0.7 }));
  skirting.position.set(0, 3, WALL_Z + 0.6); room.add(skirting);
  // станок + кронштейны
  const oakBar = new THREE.MeshPhysicalMaterial({ map: oakMap, color: '#e8c9a8', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 260, 24), oakBar); bar.rotation.z = Math.PI / 2; bar.position.set(0, 92, WALL_Z + 14); bar.castShadow = true; room.add(bar);
  const brk = new THREE.MeshStandardMaterial({ color: '#2a2224', roughness: 0.4, metalness: 0.6 });
  for (const x of [-110, 0, 110]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 14), brk); b.position.set(x, 92, WALL_Z + 7); room.add(b); }
  // шторы: бархат, складки в геометрии + покачивание в шейдере
  const curtains = [];
  const velvet = (side) => {
    const W = 96, Hh = 320, segX = mobile ? 90 : 160, geo = new THREE.PlaneGeometry(W, Hh, segX, 1);
    const P = geo.attributes.position; const r = rng(side > 0 ? 21 : 22);
    const ph = Array.from({ length: 9 }, () => r() * 6);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), t = (x + W / 2) / W;
      const z = 4.6 * Math.sin(t * Math.PI * 13 + ph[0]) + 1.9 * Math.sin(t * Math.PI * 29 + ph[1]) + 0.8 * Math.sin(t * Math.PI * 47 + ph[2]);
      P.setZ(i, z);
    }
    geo.translate(0, Hh / 2, 0); geo.computeVertexNormals();
    const m = new THREE.MeshPhysicalMaterial({ color: '#8E1424', roughness: 0.78, sheen: 1, sheenColor: new THREE.Color(COL.red).multiplyScalar(1.6), sheenRoughness: 0.32, anisotropy: 0.5, envMapIntensity: 0.6 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = m.userData.uTime; sh.uniforms.uSway = m.userData.uSway;
      sh.vertexShader = 'uniform float uTime; uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = clamp(1.0 - position.y / 320.0, 0.0, 1.0);
        transformed.z += (sin(position.x * 0.09 + uTime * 0.7) * 0.8 + sin(uTime * 1.9 + position.x * 0.05) * 3.2 * uSway) * hgt * hgt;
        transformed.x += sin(uTime * 1.4 + position.y * 0.02) * 1.6 * uSway * hgt * hgt;`);
    };
    m.userData.uTime = { value: 0 }; m.userData.uSway = { value: 0 };
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.position.set(side * 118, 0, WALL_Z + 9); room.add(mesh); curtains.push(mesh);
    // карниз
  };
  velvet(-1); velvet(1);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 420, 12), brk); rail.rotation.z = Math.PI / 2; rail.position.set(0, 318, WALL_Z + 9); room.add(rail);
  return { room, floor, mat, wall, curtains, bar };
}

/* ---------- зеркало: виртуальная камера → render target ---------- */
export function buildMirror(w, h) {
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 0 });
  const tm = new THREE.Matrix4();
  const mat = new THREE.ShaderMaterial({
    uniforms: { tMirror: { value: rt.texture }, uTM: { value: tm }, uTint: { value: new THREE.Color(COL.mirror) }, uCamPos: { value: new THREE.Vector3() } },
    vertexShader: `uniform mat4 uTM; varying vec4 vP; varying vec3 vW; void main(){ vP = uTM * vec4(position,1.0); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D tMirror; uniform vec3 uTint; uniform vec3 uCamPos; varying vec4 vP; varying vec3 vW;
      void main(){ vec3 c = texture2DProj(tMirror, vP).rgb;
        vec3 v = normalize(uCamPos - vW); float f = pow(1.0 - abs(v.z), 3.0);
        c = c * mix(uTint, vec3(1.0), 0.55) * 0.95 + uTint * 0.02 + f * 0.05;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const frame = new THREE.Group();
  const fm = new THREE.MeshStandardMaterial({ color: '#B9B4B6', roughness: 0.3, metalness: 0.7 }), seamM = new THREE.MeshStandardMaterial({ color: '#CFCBCD', roughness: 0.3, metalness: 0.5 });
  const seams = [];
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) > w / 3 ? 1.2 : 0.25, h, 0.3), Math.abs(x) > w / 3 ? fm : seamM); s.position.set(x, 0, 0.3); frame.add(s); seams.push(s); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.8, 0.6), fm); top.position.set(0, h / 2, 0.3); frame.add(top);
  mesh.add(frame);
  return { mesh, rt, tm, mat };
}

export function buildDigits() {
  const t = new THREE.CanvasTexture(digitsCanvas()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(72, 22.5), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.62, 0.02, 0.06), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  m.position.set(0, 15, -14); m.renderOrder = -1; return m;
}

export function buildTextures(size) {
  const k = knitMaps(size);
  return { normal: tex(k.normal, { repeat: [1, 1] }), albedo: tex(k.albedo, { repeat: [1, 1], srgb: true }), threads: tex(threadsAlpha()) };
}
