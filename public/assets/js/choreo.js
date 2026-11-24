// choreo.js — хореография «De Band». Чистые функции от progress p (0..1): без DOM, без состояния, без three.
// bandShape(p) → 64 контрольные точки центральной линии петли + направление ширины; pose(p) → опоры, камера, свет.
export const N = 64;
export const SEGS = [
  { id: 'rest',    t0: 0.00, t1: 0.08 },
  { id: 'warmup',  t0: 0.08, t1: 0.20 },
  { id: 'layers',  t0: 0.20, t1: 0.34 },
  { id: 'twist',   t0: 0.34, t1: 0.48 },
  { id: 'monday',  t0: 0.48, t1: 0.62 },
  { id: 'steps',   t0: 0.62, t1: 0.74 },
  { id: 'release', t0: 0.74, t1: 0.86 },
  { id: 'loop',    t0: 0.86, t1: 1.00 },
];
export const FOCUS = [0, 0.165, 0.28, 0.43, 0.575, 0.70, 0.83, 0.985];
export const MAGNETS = FOCUS;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const ss = (x) => x * x * (3 - 2 * x);
export const sss = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (p, a, b) => ss(seg(p, a, b));
const bump = (p, a, b) => Math.sin(Math.PI * seg(p, a, b));
// затухающая пружина 0→1 (перелёт и откат), ровно 1 на s=1
const spr = (s) => 1 - Math.exp(-4.2 * s) * Math.cos(2.4 * Math.PI * s);
export const spring = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : spr(s) + (1 - spr(1)) * s);

export const MAT_Y = 1;           // верх мата, см
export const BAND_W = 7.8, BAND_T = 0.5;
export const CAP_R = 3.2, CAP_H = 15.4;

/* ---------- ключевые формы петли (x,y,z см; w — направление ширины) ---------- */
const TAU = Math.PI * 2;
function rest(out) {
  // тканевая петля на мате в 3/4: кольцо-лента, наклонённое к камере (задний край приподнят), мягкий перекрут ширины
  const b = 0.46, cb = Math.cos(b), sb = Math.sin(b), h = MAT_Y + 0.35 + 9.0 * sb + (BAND_W / 2) * cb * 0.9;
  for (let i = 0; i < N; i++) {
    const th = TAU * i / N;
    const x = 10.2 * Math.sin(th) + 0.35 * Math.sin(2 * th), z = 9.0 * Math.cos(th) + 0.4 * Math.sin(3 * th + 0.4);
    const dx = 10.2 * Math.cos(th) + 0.7 * Math.cos(2 * th), dz = -9.0 * Math.sin(th) + 1.2 * Math.cos(3 * th + 0.4);
    let ox = dz, oz = -dx; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const flop = Math.pow(Math.max(0, Math.cos(th)), 3);                       // передний край мягко оседает наружу
    const tw = 0.22 * Math.sin(2 * th + 0.5) + 0.55 * flop;                     // перекрут ширины
    const lx = x, ly = 0.15 * Math.sin(3 * th + 1.1), lz = z;
    const wx = Math.sin(tw) * ox, wy = Math.cos(tw), wz = Math.sin(tw) * oz;
    out.pos[i * 3] = lx; out.pos[i * 3 + 1] = h + ly * cb - lz * sb; out.pos[i * 3 + 2] = ly * sb + lz * cb;
    out.w[i * 3] = wx; out.w[i * 3 + 1] = wy * cb - wz * sb; out.w[i * 3 + 2] = wy * sb + wz * cb;
  }
  return out;
}
// «стадион» вокруг двух опор x=±d (обхват r), наклон ширины phi (0 — стоит стенкой, 90° — лежит)
function stadium(out, d, r, y, phi) {
  const L = 4 * d + TAU * r, cp = Math.cos(phi), sp = Math.sin(phi);
  for (let i = 0; i < N; i++) {
    let s = (i / N) * L, x, z, ox, oz;
    // старт: середина передней прямой, движение к +x
    if (s < d) { x = s; z = r; ox = 0; oz = 1; }
    else if ((s -= d) < Math.PI * r) { const a = s / r; x = d + r * Math.sin(a); z = r * Math.cos(a); ox = Math.sin(a); oz = Math.cos(a); }
    else if ((s -= Math.PI * r) < 2 * d) { x = d - s; z = -r; ox = 0; oz = -1; }
    else if ((s -= 2 * d) < Math.PI * r) { const a = s / r; x = -d - r * Math.sin(a); z = -r * Math.cos(a); ox = -Math.sin(a); oz = -Math.cos(a); }
    else { s -= Math.PI * r; x = -d + s; z = r; ox = 0; oz = 1; }
    out.pos[i * 3] = x; out.pos[i * 3 + 1] = y; out.pos[i * 3 + 2] = z;
    out.w[i * 3] = -sp * ox; out.w[i * 3 + 1] = cp; out.w[i * 3 + 2] = -sp * oz;
  }
  return out;
}
// восьмёрка, лежит на мате (ширина в плоскости, лицом вверх), перекрестье — один слой над другим
function eight(out) {
  for (let i = 0; i < N; i++) {
    const th = TAU * i / N;
    out.pos[i * 3] = 19 * Math.sin(th); out.pos[i * 3 + 1] = MAT_Y + 0.3 + 0.42 * (1 + Math.cos(th)); out.pos[i * 3 + 2] = 15 * Math.sin(th) * Math.cos(th);
  }
  inPlaneW(out, 0, 1, 0);
  return out;
}
// знак ∞ в вертикальной плоскости над матом, лицом к камере
function inf(out) {
  for (let i = 0; i < N; i++) {
    const th = TAU * i / N;
    out.pos[i * 3] = 20 * Math.sin(th); out.pos[i * 3 + 1] = 19 + 17 * Math.sin(th) * Math.cos(th); out.pos[i * 3 + 2] = 1.3 * Math.cos(th);
  }
  inPlaneW(out, 0, 0, 1);
  return out;
}
// ширина = B × T (лежит в плоскости с нормалью B)
function inPlaneW(out, bx, by, bz) {
  const P = out.pos;
  for (let i = 0; i < N; i++) {
    const a = ((i + N - 1) % N) * 3, b = ((i + 1) % N) * 3;
    const tx = P[b] - P[a], ty = P[b + 1] - P[a + 1], tz = P[b + 2] - P[a + 2];
    let wx = by * tz - bz * ty, wy = bz * tx - bx * tz, wz = bx * ty - by * tx; const l = Math.hypot(wx, wy, wz) || 1;
    out.w[i * 3] = wx / l; out.w[i * 3 + 1] = wy / l; out.w[i * 3 + 2] = wz / l;
  }
}
const mk = () => ({ pos: new Float64Array(N * 3), w: new Float64Array(N * 3) });
const K = { a: mk(), b: mk(), c: mk() };
function mix(out, a, b, k) {
  for (let i = 0; i < N * 3; i++) { out.pos[i] = a.pos[i] + (b.pos[i] - a.pos[i]) * k; out.w[i] = a.w[i] + (b.w[i] - a.w[i]) * k; }
  return out;
}
// пол-оборота левой половины петли вокруг оси x: так петля становится «восьмёркой» (твист), без схлопывания
function twist(out, alpha, yc) {
  if (!alpha) return out;
  for (let i = 0; i < N; i++) {
    const x = out.pos[i * 3], s = ss(clamp((2 - x) / 8)), a = alpha * s, c = Math.cos(a), sn = Math.sin(a);
    const y = out.pos[i * 3 + 1] - yc, z = out.pos[i * 3 + 2];
    out.pos[i * 3 + 1] = yc + y * c - z * sn; out.pos[i * 3 + 2] = y * sn + z * c;
    const wy = out.w[i * 3 + 1], wz = out.w[i * 3 + 2];
    out.w[i * 3 + 1] = wy * c - wz * sn; out.w[i * 3 + 2] = wy * sn + wz * c;
  }
  return out;
}
export const camFar = (asp) => (asp < 1 ? 1 + (1 - asp) * 1.7 : asp > 1.9 ? 0.95 : 1);

// капсулы-«стопы»: x-разлёт по фазам
export function capsX(p) {
  if (p < 0.34) return lerp(5, 16, ramp(p, 0.12, 0.19));
  if (p < 0.48) return lerp(16, 12.5, ramp(p, 0.35, 0.42));
  return lerp(12.5, 30, ramp(p, 0.48, 0.55));
}

// форма петли от p → out {pos, w} (Float64Array N*3). Обратима: зависит только от p.
export function bandShape(p, out = mk()) {
  p = clamp(p);
  if (p < 0.34) {
    const k = ramp(p, 0.115, 0.18);
    if (k <= 0) return rest(out);
    rest(K.a); stadium(K.b, capsX(p), CAP_R + 0.25, MAT_Y + 4.2, 0);
    return mix(out, K.a, K.b, k);
  }
  if (p < 0.48) {
    stadium(K.a, capsX(p), CAP_R + 0.25, MAT_Y + 4.2, 0); twist(K.a, Math.PI * ramp(p, 0.345, 0.4), MAT_Y + 4.2); eight(K.b);
    return mix(out, K.a, K.b, ramp(p, 0.375, 0.43));
  }
  if (p < 0.745) {
    const k = ramp(p, 0.48, 0.55);
    if (k <= 0) return eight(out);
    eight(K.a); stadium(K.b, capsX(p), CAP_R + 0.25, MAT_Y + 4.2, 0.9); twist(K.b, Math.PI * (1 - ramp(p, 0.5, 0.58)), MAT_Y + 4.2);
    return mix(out, K.a, K.b, k);
  }
  if (p < 0.865) {
    // отпускание: пружинный откат к покою (перелёт через «покой» и обратно)
    stadium(K.a, 30, CAP_R + 0.25, MAT_Y + 4.2, 0.9); rest(K.b);
    mix(out, K.a, K.b, spring(seg(p, 0.745, 0.835)));
    for (let i = 1; i < N * 3; i += 3) out.pos[i] = Math.max(out.pos[i], MAT_Y + 0.4); // перелёт пружины не уходит в мат
    return out;
  }
  rest(K.a); inf(K.b);
  return mix(out, K.a, K.b, ramp(p, 0.87, 0.955));
}
export function bandLength(pos) {
  let L = 0;
  for (let i = 0; i < N; i++) { const a = i * 3, b = ((i + 1) % N) * 3; L += Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]); }
  return L;
}
export const REST_LEN = bandLength(rest(mk()).pos);

/* ---------- камера: ключи [p, pos, target, fov], Catmull-Rom ---------- */
const CAM = [
  [0.00, [-17, 25, 72], [-13, 13, 0], 30],
  [0.06, [-16, 24.5, 70], [-12.5, 12.5, 0], 30],
  [0.13, [12, 34, 64], [11, 11, 0], 32],
  [0.19, [14, 32, 62], [12, 11, 0], 32],
  [0.27, [34, 44, 54], [9, 13, -2], 34],
  [0.33, [36, 40, 50], [6, 10, -2], 34],
  [0.37, [44, 20, 34], [0, 4, 0], 36],
  [0.42, [0, 26, 50], [0, 3, 0], 36],
  [0.47, [-44, 20, 36], [0, 4, 0], 36],
  [0.55, [0, 9, 60], [0, 11.5, -8], 38],
  [0.62, [0, 10, 60], [0, 11.5, -8], 38],
  [0.68, [0, 15, 62], [0, 12, 0], 38],
  [0.78, [-5, 19, 50], [8, 8, -4], 36],
  [0.84, [-3, 19, 52], [7, 8.5, -4], 35],
  [0.93, [0, 24, 84], [0, 25, -2], 34],
  [1.00, [0, 24, 86], [0, 25, -2], 34],
];
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function camera(p) {
  p = clamp(p);
  let i = 0; while (i < CAM.length - 2 && p > CAM[i + 1][0]) i++;
  const a = CAM[Math.max(0, i - 1)], b = CAM[i], c = CAM[i + 1], d = CAM[Math.min(CAM.length - 1, i + 2)];
  const t = sss(clamp((p - b[0]) / (c[0] - b[0])));
  const v = (k, j) => cr(a[k][j], b[k][j], c[k][j], d[k][j], t);
  return { pos: [v(1, 0), v(1, 1), v(1, 2)], target: [v(2, 0), v(2, 1), v(2, 2)], fov: lerp(b[3], c[3], t) };
}

/* ---------- поза всего, кроме формы петли ---------- */
export function pose(p) {
  p = clamp(p);
  const cx = capsX(p);
  const capBase = MAT_Y + CAP_H / 2;
  const descend = 1 - ramp(p, 0.085, 0.13);
  const fly = ramp(p, 0.726, 0.742);
  const nod0 = bump(p, 0.632, 0.668), nod1 = bump(p, 0.676, 0.712);
  const hop = 16 * bump(p, 0.34, 0.41) + 10 * bump(p, 0.49, 0.585);
  const caps = [
    { x: -cx, y: capBase + 64 * descend + 80 * fly + 3.2 * nod0 + hop, z: 0, glow: nod0 },
    { x: cx, y: capBase + 64 * descend + 80 * fly + 3.2 * nod1, z: 0, glow: nod1 },
  ];
  const capsOn = p > 0.07 && p < 0.79 ? 1 : 0;
  const explode = ramp(p, 0.205, 0.255) * (1 - ramp(p, 0.315, 0.345));
  const layerFocus = clamp((p - 0.235) / (0.315 - 0.235)) * 3;
  const digits = ramp(p, 0.485, 0.53) * (1 - ramp(p, 0.605, 0.635));
  const sway = bump(p, 0.745, 0.9);                    // шторы колышутся от отпускания
  const warm = ramp(p, 0.86, 0.96);                    // вечерний свет на финале
  const flow = ramp(p, 0.9, 0.97);                     // шов бежит по ∞
  const breathe = (1 - ramp(p, 0.08, 0.12)) + ramp(p, 0.93, 1);
  const labelGlow = 0.25 * ramp(p, 0.93, 1);
  // шторы: полуприкрыты в hero, раздвигаются на разминке, на финале снова сходятся за ∞ (curtain call)
  const gapL = lerp(lerp(96, 74, ramp(p, 0.07, 0.2)), 38, ramp(p, 0.86, 0.97));
  const gapR = lerp(lerp(24, 74, ramp(p, 0.07, 0.2)), 38, ramp(p, 0.86, 0.97));
  return { p, gapL, gapR, caps, capsOn, explode, layerFocus, digits, sway, warm, flow, breathe, labelGlow, cam: camera(p) };
}
export const segAt = (p) => SEGS.find((s) => p < s.t1) || SEGS[SEGS.length - 1];

