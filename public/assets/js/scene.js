// scene.js — renderer, зал, петля «De Band» (геометрия пересобирается каждый кадр из bandShape(p)), зеркало,
// postFX (grade: AgX-тон, виньетка .15, зерно 3%), уровни качества, адаптивный DPR, курсор «Pull».
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { N, BAND_W, BAND_T, REST_LEN, bandShape, camFar } from './choreo.js';
import { COL, WALL_Z, buildBand, buildCore, buildSeam, buildLabel, buildCapsule, buildContact, buildRoom, buildMirror, buildDigits, buildTextures } from './band.js';

const DBG = new URLSearchParams(location.search).getAll('dbg');
export const QUALITY = [
  { seg: 384, seam: 150, dpr: 2.0, shadow: 2048, mirror: 0.6, msaa: 4, knit: 1024 },
  { seg: 288, seam: 130, dpr: 1.6, shadow: 2048, mirror: 0.45, msaa: 4, knit: 1024 },
  { seg: 224, seam: 110, dpr: 1.25, shadow: 1024, mirror: 0.4, msaa: 4, knit: 1024 },
];
const MOBILE = { seg: 224, seam: 110, dpr: 1.75, shadow: 1024, mirror: 0.45, msaa: 4, knit: 512 };
const LITE = { seg: 288, seam: 130, dpr: 1.75, shadow: 1024, mirror: 0.5, msaa: 4, knit: 1024 };
const LITE_M = { seg: 192, seam: 100, dpr: 1.75, shadow: 1024, mirror: 0.45, msaa: 4, knit: 512 };

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.03 }, uVig: { value: 0.15 }, uAspect: { value: 1 }, uWarm: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig,uAspect,uWarm; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = max(mix(vec3(l), c, 1.16), 0.0);
      c *= mix(vec3(1.0), vec3(1.06,0.99,0.92), uWarm);
      vec2 q = (vUv-0.5)*vec2(uAspect,1.0); float d = length(q);
      c *= 1.0 - uVig*smoothstep(0.25, 0.95, d)*2.0;
      float n = h(floor(vUv*uRes) + fract(uTime)*91.7) - 0.5;
      c += n*uGrain*(0.15 + l*0.5);
      gl_FragColor = vec4(max(c, 0.0), 1.0); }`,
};

export async function createScene({ canvas, mode = 'full', mobile = false, still = false, qFixed = null, step = async () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('no-webgl2');
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(COL.sock, 1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#EFE5DF');
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1600);
  const levels = mode === 'lite' ? [mobile ? LITE_M : LITE] : mobile ? [MOBILE] : QUALITY;
  let level = qFixed != null ? Math.min(+qFixed, levels.length - 1) : 0;
  const Q = () => levels[level];

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  await step(0.1, 'env');
  await document.fonts.load('300 200px Unbounded').catch(() => {}); await document.fonts.load('600 60px Unbounded').catch(() => {});
  const maps = buildTextures(levels[0].knit);
  await step(0.2, 'knit');

  const { room, curtains } = buildRoom({ mobile, env: scene.environment });
  scene.add(room);
  const mirror = buildMirror(220, 150); mirror.rt.samples = 4; mirror.mesh.position.set(0, 3 + 75, WALL_Z + 0.4); scene.add(mirror.mesh);
  const wallMesh = room.children.find((m) => m.geometry?.parameters?.width === 900 && m.geometry?.parameters?.height === 420);
  await step(0.15, 'room');

  const obj = new THREE.Group(); scene.add(obj);
  const maxSeg = levels[0].seg;
  const band = buildBand({ segments: maxSeg, maps }); obj.add(band);
  const core = buildCore(maxSeg, maps.threads); core.visible = false; obj.add(core);
  const seam = buildSeam(levels[0].seam); obj.add(seam);
  const label = buildLabel(); obj.add(label);
  const caps = [buildCapsule(maps), buildCapsule(maps)]; caps.forEach((c) => { c.visible = false; obj.add(c); });
  const digits = buildDigits(); scene.add(digits);
  const contact = buildContact(); obj.add(contact);
  await step(0.15, 'band');

  // свет: тёплое окно (key + мягкая тень), холодный fill от зеркала, небо
  const key = new THREE.DirectionalLight('#FFF0E0', 2.6); key.position.set(-70, 120, 80); key.castShadow = true;
  key.shadow.camera.left = -48; key.shadow.camera.right = 48; key.shadow.camera.top = 48; key.shadow.camera.bottom = -48; key.shadow.camera.near = 40; key.shadow.camera.far = 320;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#D8E4FF', 0.55); fill.position.set(40, 50, -90); scene.add(fill);
  const hemi = new THREE.HemisphereLight('#FFF6EE', '#C8996A', 0.7); scene.add(hemi);

  // post
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: levels[0].msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new OutputPass());

  const st = {
    w: 1, h: 1, dprScale: 1, frameAvg: 16, slowT: 0, fastT: 0, time: 0, reduced: false, interactive: !still,
    ptr: { x: -9999, y: -9999, on: false, nx: 0, ny: 0, down: false },
    pull: { gi: -1, tx: 0, ty: 0, tz: 0, dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0 }, hover: false,
    tilt: { x: 0, y: 0, vx: 0, vy: 0 }, anchors: {}, capsWorld: [[0, 0, 0], [0, 0, 0]], override: null,
  };
  function applyLevel() {
    const q = Q();
    band.geometry.setDrawRange(0, q.seg * band.userData.K * 6);
    core.geometry.setDrawRange(0, q.seg * 6);
    seam.count = q.seam;
    key.shadow.mapSize.set(q.shadow, q.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== q.msaa) { t.samples = q.msaa; t.dispose(); }
    resize();
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    st.w = w; st.h = h;
    const dpr = Math.max(0.6, Math.min(devicePixelRatio || 1, Q().dpr) * st.dprScale);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = w / h; grade.uniforms.uRes.value.set(w * dpr, h * dpr);
    const mq = Q().mirror; mirror.rt.setSize(Math.max(2, Math.round(w * dpr * mq)), Math.max(2, Math.round(h * dpr * mq)));
  }

  /* ---------- петля: контрольные точки → Catmull-Rom → сечение ---------- */
  const ctrl = { pos: new Float64Array(N * 3), w: new Float64Array(N * 3) };
  const CP = new Float64Array(N * 3), CW = new Float64Array(N * 3);
  const C = new Float32Array((maxSeg + 1) * 3), T = new Float32Array((maxSeg + 1) * 3), W = new Float32Array((maxSeg + 1) * 3), NN = new Float32Array((maxSeg + 1) * 3);
  const crv = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const XS = [[-0.47, 0.5, 0, 1], [-0.2, 0.56, 0, 1], [0.2, 0.56, 0, 1], [0.47, 0.5, 0, 1], [0.5, 0.2, 0.8, 0.6], [0.5, -0.2, 0.8, -0.6], [0.47, -0.5, 0, -1], [0.2, -0.56, 0, -1], [-0.2, -0.56, 0, -1], [-0.47, -0.5, 0, -1], [-0.5, -0.2, -0.8, -0.6], [-0.5, 0.2, -0.8, 0.6]];
  const pinkA = new THREE.Color(COL.pink), pinkB = new THREE.Color(COL.pinkHi);
  const m4 = new THREE.Matrix4(), vT = new THREE.Vector3(), vW = new THREE.Vector3(), vN = new THREE.Vector3(), vP = new THREE.Vector3();
  let bandLen = REST_LEN;
  function buildBandGeo(P, dt) {
    const M = Q().seg, ud = band.userData, R = ud.R, K = ud.K;
    // контрольные точки + дыхание + тяга курсора
    const S = ctrl.pos, Wc = ctrl.w;
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < N; i++) { cx += S[i * 3]; cy += S[i * 3 + 1]; cz += S[i * 3 + 2]; } cx /= N; cy /= N; cz /= N;
    const br = still || st.reduced ? 0 : 0.016 * Math.sin(st.time * 1.7) * P.breathe;
    const pl = st.pull;
    for (let i = 0; i < N; i++) {
      let x = S[i * 3], y = S[i * 3 + 1], z = S[i * 3 + 2];
      x += (x - cx) * br; z += (z - cz) * br; if (P.p > 0.86) y += (y - cy) * br;
      if (pl.gi >= 0 || Math.abs(pl.dx) + Math.abs(pl.dy) + Math.abs(pl.dz) > 1e-3) {
        let du = Math.abs(i - (pl.gi < 0 ? pl.last : pl.gi)) / N; du = Math.min(du, 1 - du); const f = Math.exp(-(du * du) / 0.0045);
        x += pl.dx * f; y += pl.dy * f; z += pl.dz * f;
      }
      CP[i * 3] = x; CP[i * 3 + 1] = Math.max(y, 1.15); CP[i * 3 + 2] = z;
      CW[i * 3] = Wc[i * 3]; CW[i * 3 + 1] = Wc[i * 3 + 1]; CW[i * 3 + 2] = Wc[i * 3 + 2];
    }
    // Catmull-Rom (замкнутая)
    for (let j = 0; j <= M; j++) {
      const t = (j % M) * N / M, i = Math.floor(t), f = t - i;
      const a = ((i + N - 1) % N) * 3, b = (i % N) * 3, c = ((i + 1) % N) * 3, d = ((i + 2) % N) * 3;
      for (let k = 0; k < 3; k++) { C[j * 3 + k] = crv(CP[a + k], CP[b + k], CP[c + k], CP[d + k], f); W[j * 3 + k] = CW[b + k] + (CW[c + k] - CW[b + k]) * f; }
    }
    let L = 0;
    for (let j = 0; j < M; j++) {
      const a = ((j + M - 1) % M) * 3, b = ((j + 1) % M) * 3;
      vT.set(C[b] - C[a], C[b + 1] - C[a + 1], C[b + 2] - C[a + 2]); const tl = vT.length() || 1; L += tl / 2; vT.divideScalar(tl);
      vW.set(W[j * 3], W[j * 3 + 1], W[j * 3 + 2]); vW.addScaledVector(vT, -vT.dot(vW)).normalize();
      vN.crossVectors(vT, vW);
      T[j * 3] = vT.x; T[j * 3 + 1] = vT.y; T[j * 3 + 2] = vT.z; W[j * 3] = vW.x; W[j * 3 + 1] = vW.y; W[j * 3 + 2] = vW.z; NN[j * 3] = vN.x; NN[j * 3 + 1] = vN.y; NN[j * 3 + 2] = vN.z;
    }
    for (let k = 0; k < 3; k++) { T[M * 3 + k] = T[k]; W[M * 3 + k] = W[k]; NN[M * 3 + k] = NN[k]; }
    bandLen = L;
    { let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, sy = 0; for (let j = 0; j < M; j += 4) { const x = C[j * 3], y = C[j * 3 + 1], z = C[j * 3 + 2]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); mny = Math.min(mny, y); sy += y; }
      sy /= Math.ceil(M / 4); const near = Math.max(0, 1 - (sy - 4) / 10);
      contact.position.set((mnx + mxx) / 2, 1.03, (mnz + mxz) / 2); contact.scale.set(Math.max(4, mxx - mnx) * 1.25, Math.max(4, mxz - mnz) * 1.35 + 4, 1); contact.material.opacity = 0.75 * near; contact.visible = near > 0.02; }
    const ratio = L / REST_LEN, ws = Math.min(1, Math.max(0.7, 1 / Math.sqrt(Math.max(ratio, 1)))) * BAND_W;
    band.material.color.copy(pinkA).lerp(pinkB, Math.min(1, Math.max(0, (ratio - 1) / 1.1)));
    const pos = ud.pos, nor = ud.nor, th = BAND_T;
    for (let j = 0; j <= M; j++) {
      const cx_ = C[j * 3], cy_ = C[j * 3 + 1], cz_ = C[j * 3 + 2];
      for (let k = 0; k < R; k++) {
        const x = XS[k % K], o = (j * R + k) * 3, a = x[0] * ws, b = x[1] * th;
        pos[o] = cx_ + W[j * 3] * a + NN[j * 3] * b; pos[o + 1] = cy_ + W[j * 3 + 1] * a + NN[j * 3 + 1] * b; pos[o + 2] = cz_ + W[j * 3 + 2] * a + NN[j * 3 + 2] * b;
        nor[o] = W[j * 3] * x[2] + NN[j * 3] * x[3]; nor[o + 1] = W[j * 3 + 1] * x[2] + NN[j * 3 + 1] * x[3]; nor[o + 2] = W[j * 3 + 2] * x[2] + NN[j * 3 + 2] * x[3];
      }
    }
    const g = band.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    g.attributes.position.updateRanges = [{ start: 0, count: (M + 1) * R * 3 }]; g.attributes.normal.updateRanges = [{ start: 0, count: (M + 1) * R * 3 }];
    // слои при разлёте
    const e = P.explode;
    core.visible = e > 0.01;
    if (core.visible) {
      const cp = core.userData.pos, cn = core.userData.nor, lift = 8 * e, hw = ws * 0.42;
      for (let j = 0; j <= M; j++) for (let k = 0; k < 2; k++) {
        const o = (j * 2 + k) * 3, s = k ? hw : -hw;
        cp[o] = C[j * 3] + W[j * 3] * s; cp[o + 1] = C[j * 3 + 1] + W[j * 3 + 1] * s + lift; cp[o + 2] = C[j * 3 + 2] + W[j * 3 + 2] * s;
        cn[o] = NN[j * 3]; cn[o + 1] = NN[j * 3 + 1]; cn[o + 2] = NN[j * 3 + 2];
      }
      core.geometry.attributes.position.needsUpdate = true; core.geometry.attributes.normal.needsUpdate = true;
    }
    // шов-строчка
    const SC = seam.count, flowOff = still || st.reduced ? 0 : (st.flowT || 0), slen = (L / SC) * 0.52, liftS = 15 * e;
    for (let k = 0; k < SC; k++) {
      let u = ((k + 0.5) / SC + flowOff) % 1; if (u < 0) u += 1;
      const j = Math.min(M - 1, Math.floor(u * M));
      vT.set(T[j * 3], T[j * 3 + 1], T[j * 3 + 2]); vW.set(W[j * 3], W[j * 3 + 1], W[j * 3 + 2]); vN.set(NN[j * 3], NN[j * 3 + 1], NN[j * 3 + 2]);
      vP.set(C[j * 3], C[j * 3 + 1], C[j * 3 + 2]).addScaledVector(vN, th * 0.58 + 0.04).addScaledVector(vW, -ws * 0.3); vP.y += liftS;
      vT.multiplyScalar(slen); vW.multiplyScalar(0.13); vN.multiplyScalar(0.12); m4.makeBasis(vT, vW, vN); m4.setPosition(vP);
      seam.setMatrixAt(k, m4);
    }
    seam.instanceMatrix.needsUpdate = true;
    // этикетка
    const jl = Math.round(0.985 * M) % M;
    vT.set(T[jl * 3], T[jl * 3 + 1], T[jl * 3 + 2]); vW.set(W[jl * 3], W[jl * 3 + 1], W[jl * 3 + 2]); vN.set(NN[jl * 3], NN[jl * 3 + 1], NN[jl * 3 + 2]);
    vP.set(C[jl * 3], C[jl * 3 + 1], C[jl * 3 + 2]).addScaledVector(vN, th * 0.5 + 0.09); vP.y += 21 * e;
    label.matrix.makeBasis(vT, vW, vN).setPosition(vP); label.matrixWorldNeedsUpdate = true;
    // якоря выносок (мировые координаты, без учёта наклона obj — учитываются в project)
    const jr = Math.round(0.25 * M);
    st.anchors.shell = [C[jr * 3] + 2.6, C[jr * 3 + 1] - 1.5, C[jr * 3 + 2]];
    st.anchors.core = [C[jr * 3] + 2, C[jr * 3 + 1] + 8 * e, C[jr * 3 + 2]];
    st.anchors.seam = [C[jr * 3] + 1, C[jr * 3 + 1] + 15 * e + 0.5, C[jr * 3 + 2]];
    st.anchors.label = [vP.x + 1.8, vP.y + 1, vP.z];
  }

  /* ---------- зеркало ---------- */
  const vcam = new THREE.PerspectiveCamera(); const tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  function renderMirror(target) {
    const zp = WALL_Z + 0.4;
    vcam.copy(camera);
    vcam.position.set(camera.position.x, camera.position.y, 2 * zp - camera.position.z);
    vcam.up.set(0, 1, 0); vcam.lookAt(target.x, target.y, 2 * zp - target.z);
    vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix);
    mirror.tm.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(mirror.mesh.matrixWorld);
    mirror.mesh.visible = false; if (wallMesh) wallMesh.visible = false; digits.visible = false;
    renderer.setRenderTarget(mirror.rt); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(null);
    mirror.mesh.visible = true; if (wallMesh) wallMesh.visible = true; digits.visible = digitsOn;
    mirror.mat.uniforms.uCamPos.value.copy(camera.position);
  }

  applyLevel();
  // прогрев шейдеров (часть честного счётчика)
  caps.forEach((c) => (c.visible = true)); core.visible = true;
  bandShape(0, ctrl); buildBandGeo({ p: 0, explode: 0, breathe: 0 }, 0.016);
  camera.position.set(0, 25, 60); camera.lookAt(0, 5, 0); camera.updateMatrixWorld();
  renderer.compile(scene, camera); renderer.shadowMap.needsUpdate = true; composer.render(0.016);
  caps.forEach((c) => (c.visible = false)); core.visible = false;
  await step(0.15, 'compile');

  /* ---------- курсор ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), v3 = new THREE.Vector3();
  function pointer(cx, cy, active) {
    const p = st.ptr; if (!st.interactive) return;
    const r = canvas.getBoundingClientRect();
    p.x = cx - r.left; p.y = cy - r.top; p.on = active;
    p.nx = (p.x / r.width) * 2 - 1; p.ny = -(p.y / r.height) * 2 + 1;
  }
  function projectW(x, y, z) {
    v3.set(x, y, z).applyMatrix4(obj.matrixWorld).project(camera);
    return [(v3.x * 0.5 + 0.5) * st.w, (-v3.y * 0.5 + 0.5) * st.h, v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1];
  }
  function updatePull(dt) {
    const pl = st.pull, p = st.ptr; pl.gi = -1; st.hover = false;
    if (p.on && st.interactive && !st.reduced) {
      let best = 1e9, bi = -1;
      for (let i = 0; i < N; i += 1) { const [sx, sy] = projectW(ctrl.pos[i * 3], ctrl.pos[i * 3 + 1], ctrl.pos[i * 3 + 2]); const d = Math.hypot(sx - p.x, sy - p.y); if (d < best) { best = d; bi = i; } }
      const lim = Math.max(56, Math.min(st.w, st.h) * 0.075);
      if (best < lim) {
        pl.gi = bi; pl.last = bi; st.hover = true;
        const bx = ctrl.pos[bi * 3], by = ctrl.pos[bi * 3 + 1], bz = ctrl.pos[bi * 3 + 2];
        camera.getWorldDirection(tmp); plane.setFromNormalAndCoplanarPoint(tmp, tgt.set(bx, by, bz));
        ndc.set(p.nx, p.ny); ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          const dx = hit.x - bx, dy = hit.y - by, dz = hit.z - bz, l = Math.hypot(dx, dy, dz), m = Math.min(1, 6 / (l || 1));
          pl.tx = dx * m * 0.9; pl.ty = Math.max(-2, dy * m * 0.9); pl.tz = dz * m * 0.9;
        }
      }
    }
    if (pl.gi < 0) { pl.tx = pl.ty = pl.tz = 0; }
    // пружина k 190 / d 19
    for (const ax of ['x', 'y', 'z']) { const v = 'v' + ax, d = 'd' + ax, t = 't' + ax; pl[v] += ((pl[t] - pl[d]) * 190 - pl[v] * 19) * dt; pl[d] += pl[v] * dt; }
  }

  /* ---------- применение позы ---------- */
  let digitsOn = false;
  const warmA = new THREE.Color('#FFF0E0'), warmB = new THREE.Color('#FFC890');
  function apply(P, dt) {
    bandShape(P.p, ctrl);
    if (st.override?.shape) st.override.shape(ctrl, st.time);
    updatePull(dt);
    st.flowT = (st.flowT || 0) + dt * 0.02 * (P.flow || 0);
    if (!DBG.includes('noband') || !st.built) { buildBandGeo(P, dt); st.built = 1; }
    caps.forEach((c, i) => {
      c.visible = P.capsOn > 0 && P.caps[i].y < 120;
      c.position.set(P.caps[i].x, P.caps[i].y, P.caps[i].z);
      c.userData.mat.emissiveIntensity = 0.32 * P.caps[i].glow;
      st.capsWorld[i] = [P.caps[i].x, P.caps[i].y + 9, P.caps[i].z];
    });
    label.material.emissiveIntensity = P.labelGlow || 0;
     digits.material.opacity = (P.digits || 0) * (st.w / st.h < 1 ? 0 : 1); digitsOn = digits.visible = digits.material.opacity > 0.003;
    curtains.forEach((c, i) => { const side = i ? 1 : -1, gap0 = (i ? P.gapR : P.gapL) ?? 60, gap = st.w / st.h < 1 && mode === 'full' ? gap0 + (3 - gap0) * (P.digits || 0) : gap0, sx = Math.min(1.15, Math.max(0.8, (190 - gap) / 96)); c.scale.x = sx; c.position.x = side * (gap + 48 * sx); });
    curtains.forEach((c) => { c.material.userData.uTime.value = st.time; c.material.userData.uSway.value = still ? 0 : 0.12 + (P.sway || 0); });
    key.color.copy(warmA).lerp(warmB, P.warm || 0); key.intensity = 2.6 - 0.5 * (P.warm || 0);
    hemi.intensity = 0.7 - 0.12 * (P.warm || 0); grade.uniforms.uWarm.value = 0.6 * (P.warm || 0);
    // камера: портрет — дальше и по центру
    const asp = st.w / st.h, far = camFar(asp);
    let c = P.cam;
    if (asp < 1 && mode === 'full' && P.digits > 0) { // портрет, «18:00»: петля и цифры в центре кадра
      const k = P.digits, mx = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
      c = { pos: mx(c.pos, [0, 14 + 4 / far, -6 + 66 / far]), target: mx(c.target, [0, 14, -6]), fov: c.fov };
    }
    const par = st.reduced || still ? 0 : 1, intro = 1 - (P.drop ?? 1);
    const tx = asp < 1 ? c.target[0] * 0.25 : c.target[0], ty = c.target[1] + (asp < 1 && mode === 'full' ? (-15 - 5 * (1 - Math.min(1, P.p / 0.08)) + 9 * (P.warm || 0)) * (1 - (P.digits || 0)) : 0), tz = c.target[2];
    camera.position.set(tx + (c.pos[0] - c.target[0]) * far + st.ptr.nx * 1.6 * par, ty + (c.pos[1] - c.target[1]) * far + st.ptr.ny * 1.0 * par + intro * 8, tz + (c.pos[2] - c.target[2]) * far - intro * 14);
    camera.fov = c.fov; camera.updateProjectionMatrix();
    tgt.set(tx, ty, tz); camera.lookAt(tgt); camera.updateMatrixWorld();
    if (digits.visible) { digits.position.y = asp < 1 ? 27 : 15; }
    if (digits.visible) { const vis = 2 * camera.position.distanceTo(digits.position) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * asp; digits.scale.setScalar(Math.min(1, vis * 0.86 / 72)); }
    key.target.position.set(tx * 0.5, 0, 0); key.position.set(-70 + tx * 0.5, 120, 80);
    return tgt.clone();
  }

  function frame(dt, P) {
    dt = Math.min(dt, 1 / 20);
    if (!still) st.time += dt;
    grade.uniforms.uTime.value = still ? 0.5 : st.time;
    // наклон объекта к курсору (k 38 / d 8.5)
    const T_ = st.tilt, on = st.interactive && !st.reduced ? 1 : 0;
    T_.vx += ((st.ptr.ny * 0.04 * on - T_.x) * 38 - T_.vx * 8.5) * dt; T_.vy += ((st.ptr.nx * 0.06 * on - T_.y) * 38 - T_.vy * 8.5) * dt; T_.x += T_.vx * dt; T_.y += T_.vy * dt;
    obj.rotation.set(-T_.x * 0.3, T_.y + (P.flow || 0) * 0.14 * Math.sin(st.time * 0.45) * (still || st.reduced ? 0 : 1), 0);
    obj.updateMatrixWorld();
    const target = apply(P, dt);
    renderer.shadowMap.needsUpdate = !DBG.includes('noshadow') || !key.shadow.map;
    if (!DBG.includes('nomirror')) renderMirror(target);
    if (DBG.includes('nopost')) renderer.render(scene, camera); else composer.render(dt);
    if (!still && qFixed == null) {
      st.frameAvg += (dt * 1000 - st.frameAvg) * 0.08;
      if (st.frameAvg > 36) { st.slowT += dt; st.fastT = 0; } else if (st.frameAvg < 15) { st.fastT += dt; st.slowT = 0; } else { st.slowT = st.fastT = 0; }
      if (st.slowT > 1) { st.slowT = 0; if (st.dprScale > 0.64) { st.dprScale -= 0.12; resize(); } else if (level < levels.length - 1) { level++; st.dprScale = 0.9; applyLevel(); } }
      if (st.fastT > 4 && st.dprScale < 1) { st.fastT = 0; st.dprScale = Math.min(1, st.dprScale + 0.06); resize(); }
    }
  }
  return {
    renderer, scene, camera, st, frame, resize, pointer, projectW,
    tap(cx, cy) { pointer(cx, cy, true); },
    get level() { return level; }, get dpr() { return renderer.getPixelRatio(); }, get bandLen() { return bandLen; },
  };
}
