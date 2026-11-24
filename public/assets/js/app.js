// app.js — index: честный прелоадер (бархатный занавес) → сцена «De Band», скролл = одна timeline pose(p),
// выноски, шаги на опорах, таймер «Monday 18:00» + главы, магниты, ?demo=1, ?p=, ?pre=1.
import { initCommon, Q, REDUCED, MOBILE, STILL, cursor, rekPlay, ss, gsapP, I } from './common.js';
import { pose, SEGS, FOCUS, MAGNETS, clamp, sss, segAt } from './choreo.js';

initCommon();
const DEMO = Q.get('demo') === '1';
const PFIX = Q.has('p') ? clamp(parseFloat(Q.get('p')) || 0) : null;
const CLEAN = Q.has('clean');
const body = document.body, pre = document.getElementById('pre'), preN = document.getElementById('pre-n');
const canvas = document.getElementById('stage'), spacer = document.getElementById('spacer'), footer = document.querySelector('.ft');
const panels = [...document.querySelectorAll('.copy .pnl, .copy .cue')].map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b, h: el.querySelector('.rek'), o: -1 }));
const track = document.querySelector('.tmr-track'), nowEl = document.getElementById('tmr-now'), chapBtns = [...document.querySelectorAll('.tmr-track button')];
const steps = [...document.querySelectorAll('.step')];
if (CLEAN) { const s = document.createElement('style'); s.textContent = '.hd,.copy,.cos,.cur,.ft{display:none!important}'; document.head.appendChild(s); }

/* ---------- честный прелоадер ---------- */
let actual = 0, shown = 0;
const add = (v) => { actual = Math.min(1, actual + v); };
const PRE = Q.get('pre') === '1';
const firstVisit = PRE || !ss.get('se-pre');
const skipPre = !PRE && (REDUCED || PFIX != null || (location.hash && SEGS.some((s) => '#' + s.id === location.hash)));
let preDone = false, skipReq = false; const preT0 = performance.now(); let lastPre = preT0;
function preTick(now) {
  if (preDone) return;
  const dt = Math.min(1 / 30, (now - lastPre) / 1000); lastPre = now; // медленный кадр двигает максимум на 1/30 с
  shown += (actual - shown) * Math.min(1, dt * 7);
  if (actual - shown < 0.004) shown = actual;
  preN.textContent = String(Math.round(shown * 100)).padStart(3, '0');
  requestAnimationFrame(preTick);
}
if (!skipPre) requestAnimationFrame(preTick);
if (!firstVisit && !skipPre) pre.classList.add('quick');
const askSkip = () => { if (performance.now() - preT0 > 1000) skipReq = true; };
addEventListener('wheel', askSkip, { passive: true }); addEventListener('touchstart', askSkip, { passive: true });
addEventListener('keydown', (e) => { if (e.code === 'Space') askSkip(); });
document.fonts.ready.then(() => add(0.1));

/* ---------- сцена ---------- */
let S = null;
const state = { p: PFIX ?? 0, target: PFIX ?? 0, drop: skipPre ? 1 : 0, demo: { t: 0, p: 0, done: false, duration: 0 } };
window.__demo = state.demo;
async function boot() {
  await new Promise((r) => requestAnimationFrame(() => r()));
  try {
    const mod = await import('./scene.js');
    S = await mod.createScene({ canvas, mode: 'full', mobile: MOBILE, still: STILL, qFixed: Q.get('q'), step: async (v) => { add(v * 0.8 / 0.75); await new Promise((r) => setTimeout(r, 0)); } });
  } catch (err) {
    console.warn('3D unavailable:', err && err.message);
    const po = document.querySelector('.poster'); po.src = po.dataset.src; po.hidden = false; document.querySelector('.nogl').hidden = false; canvas.hidden = true;
    actual = 1; finishPre(true); requestAnimationFrame(loop); return;
  }
  S.st.reduced = REDUCED; window.__scene = S;
  addEventListener('resize', () => S.resize());
  // «сцена рисует ровно»: 24 кадра < 34 мс или максимум 4 с
  let good = 0; const t0 = performance.now(); let last = t0;
  await new Promise((res) => {
    const f = (now) => {
      const dt = now - last; last = now;
      S.frame(Math.min(dt / 1000, 1 / 30), poseNow(state.p));
      if (dt < 34) { good++; add(0.1 / 24); }
      if (good >= 24 || now - t0 > 4000 || skipPre) { actual = 1; res(); } else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  finishPre(false);
  requestAnimationFrame(loop);
}
function finishPre(noGL) {
  const go = async () => {
    if (!skipPre) preN.textContent = '100';
    preDone = true;
    const gsap = await gsapP();
    body.classList.remove('is-locked'); ss.set('se-pre', '1');
    if (PFIX != null) jumpTo(PFIX);
    else if (location.hash) { const i = SEGS.findIndex((x) => '#' + x.id === location.hash); if (i >= 0) jumpTo(FOCUS[i]); }
    if (skipPre || noGL) { pre.remove(); state.drop = 1; return; }
    setTimeout(() => {
      pre.classList.add('out');
      gsap.to(state, { drop: 1, duration: skipReq ? 0.01 : 1.8, ease: 'power2.out', delay: 0.25 });
      setTimeout(() => pre.remove(), 1700);
    }, firstVisit ? 260 : 0);
  };
  if (skipReq || skipPre || noGL) go(); else waitShown(go);
}
function waitShown(cb) { const ch = () => (shown >= 0.995 || skipReq) ? cb() : requestAnimationFrame(ch); ch(); }

/* ---------- скролл → p ---------- */
const range = () => Math.max(1, spacer.offsetHeight - innerHeight);
const scrollP = () => clamp(scrollY / range());
function jumpTo(p) { scrollTo({ top: p * range(), behavior: 'instant' }); state.target = state.p = p; }
let glide = null;
function glideTo(p) {
  const from = scrollY, to = p * range(), dist = Math.abs(p - scrollP());
  const dur = REDUCED ? 0.01 : 0.9 + 2.2 * dist; const t0 = performance.now();
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  glide = (now) => { const k = Math.min(1, (now - t0) / 1000 / dur); scrollTo({ top: from + (to - from) * ease(k), behavior: 'instant' }); if (k >= 1) glide = null; };
}
chapBtns.forEach((b, i) => b.addEventListener('click', () => glideTo(FOCUS[i])));
document.querySelectorAll('.copy a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const i = SEGS.findIndex((x) => '#' + x.id === a.getAttribute('href')); if (i >= 0) { e.preventDefault(); glideTo(FOCUS[i]); } }));
let scrollTimer = 0;
addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  if (DEMO || STILL || REDUCED || glide) return;
  scrollTimer = setTimeout(() => {
    const p = scrollP(); if (p >= 0.999 || scrollY > range()) return;
    const m = MAGNETS.find((m) => Math.abs(m - p) < 0.02 && Math.abs(m - p) > 0.002);
    if (m != null) glideTo(m);
  }, 200);
}, { passive: true });
['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => { glide = null; }, { passive: true }));

/* ---------- demo director ---------- */
const DKEYS = [[0, 0], [3.5, 0], [6.5, 0.15], [9, 0.165], [12.5, 0.28], [14.5, 0.285], [19, 0.43], [20.5, 0.435], [24, 0.575], [26, 0.58], [29, 0.70], [31, 0.705], [35, 0.83], [37, 0.835], [41, 0.985], [44, 1]];
state.demo.duration = DKEYS.at(-1)[0] + 2.6;
function demoP(t) { if (t <= 0) return 0; for (let i = 1; i < DKEYS.length; i++) if (t <= DKEYS[i][0]) { const a = DKEYS[i - 1], b = DKEYS[i]; return a[1] + (b[1] - a[1]) * sss((t - a[0]) / (b[0] - a[0])); } return 1; }

/* ---------- pose + UI ---------- */
function poseNow(p) { const P = pose(p); P.drop = state.drop; return P; }
const COS = { shell: [0.215, 0.33], core: [0.228, 0.33], seam: [0.241, 0.33], label: [0.254, 0.33] };
const coEls = [...document.querySelectorAll('.co')].map((el) => ({ el, k: el.dataset.co, seg: COS[el.dataset.co], o: 0 }));
function updCallouts(P) {
  if (!S || MOBILE) return;
  const pts = [];
  for (const c of coEls) {
    const a = S.st.anchors[c.k]; if (!a) continue;
    const f = 0.012, o = clamp((P.p - c.seg[0]) / f) * clamp((c.seg[1] - P.p) / f);
    const [x, y, vis] = S.projectW(a[0], a[1], a[2]);
    pts.push({ c, x, y, o: vis ? o : 0 });
  }
  const colR = Math.min(innerWidth - 290, Math.max(0, ...pts.filter((q) => q.o > 0).map((q) => q.x)) + 60);
  pts.sort((a, b) => a.y - b.y);
  let lastY = -1e9;
  for (const q of pts) {
    const el = q.c.el;
    if (q.o <= 0) { if (q.c.o !== 0) { el.style.opacity = 0; q.c.o = 0; } continue; }
    let y = Math.max(q.y, lastY + 58); lastY = y;
    el.style.opacity = q.o.toFixed(3); q.c.o = q.o;
    el.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px)`;
    el.querySelector('.co-box').style.transform = `translateY(${(y - q.y).toFixed(1)}px)`;
    el.style.setProperty('--lead', Math.max(28, colR - q.x).toFixed(0) + 'px');
    el.classList.toggle('on', Math.round(P.layerFocus) === ['shell', 'core', 'seam', 'label'].indexOf(q.c.k));
  }
}
function updSteps(p) {
  if (!S || MOBILE || p < 0.62 || p > 0.745) return;
  steps.forEach((el, i) => {
    const c = S.st.capsWorld[i]; const [x, y] = S.projectW(c[0], c[1] + 4, c[2]);
    const w = el.offsetWidth, h = el.offsetHeight;
    const tx = i === 0 ? Math.max(24, Math.min(innerWidth / 2 - w - 40, x + 70)) : Math.min(innerWidth - w - 24, Math.max(innerWidth / 2 + 40, x - w - 70));
    el.style.transform = `translate(${tx.toFixed(0)}px,${Math.max(innerHeight * 0.34, Math.min(innerHeight - h - 40, y - h / 2)).toFixed(0)}px)`;
  });
}
let curSeg = null;
function updUI(P) {
  const p = P.p;
  for (const pn of panels) {
    const f = 0.01;
    const o = (pn.a < 0 ? 1 : clamp((p - pn.a + f * 0.5) / f)) * (pn.b > 1 ? 1 : clamp((pn.b + f * 0.5 - p) / f));
    const oo = pn.a < 0 ? o * clamp(state.drop * 2.2 - 0.5) : o;
    if (Math.abs(oo - pn.o) > 0.001) { pn.el.style.opacity = oo.toFixed(3); pn.el.classList.toggle('vis', oo > 0.01); pn.o = oo; }
    if (pn.h && state.drop > 0.5) { const want = oo > 0.6 ? 1 : oo < 0.02 ? -1 : 0; if (want && want !== pn.dir) { pn.dir = want; rekPlay(pn.h, want); } }
  }
  if (track) track.style.setProperty('--p', p.toFixed(4));
  const s = segAt(p);
  if (s !== curSeg) {
    curSeg = s; const i = SEGS.indexOf(s);
    if (nowEl && I.chap) nowEl.textContent = I.chap[i];
    chapBtns.forEach((b, j) => { b.classList.toggle('on', j <= i); b.setAttribute('aria-current', j === i ? 'step' : 'false'); });
    if (!STILL && !DEMO && state.drop >= 1 && scrollY < range()) history.replaceState(null, '', '#' + s.id);
  }
  updCallouts(P); updSteps(p);
}

/* ---------- loop ---------- */
let last = performance.now(), frames = 0, fpsT = last, idleT = 0, skip = false;
window.__fps = 0;
addEventListener('pointermove', (e) => {
  if (!S || e.pointerType === 'touch') return;
  const over = !e.target.closest('a,button,.hd,.ft,.menu,.pnl');
  S.pointer(e.clientX, e.clientY, over && scrollY < range() + 10); idleT = 0;
}, { passive: true });
addEventListener('pointerleave', () => S && S.pointer(-9999, -9999, false));
// touch: drag = тянуть ленту
addEventListener('pointerdown', (e) => { if (S && e.pointerType === 'touch' && !e.target.closest('a,button')) { S.pointer(e.clientX, e.clientY, true); idleT = 0; } }, { passive: true });
addEventListener('pointermove', (e) => { if (S && e.pointerType === 'touch' && e.buttons) S.pointer(e.clientX, e.clientY, true); }, { passive: true });
addEventListener('pointerup', (e) => { if (S && e.pointerType === 'touch') S.pointer(-9999, -9999, false); }, { passive: true });
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frames++; if (now - fpsT > 1000) { window.__fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  if (document.hidden) return;
  if (glide) glide(now);
  if (DEMO) {
    state.demo.t += dt;
    if (state.drop >= 1) { const td = Math.max(0, state.demo.t - 2.4); state.target = demoP(td); state.demo.done = td >= DKEYS.at(-1)[0]; }
    state.p = state.target;
  } else if (PFIX != null) { state.p = state.target = PFIX; }
  else {
    state.target = scrollP();
    state.p += (state.target - state.p) * (1 - Math.exp(-5 * dt));
    if (Math.abs(state.target - state.p) < 1e-5) state.p = state.target;
  }
  state.demo.p = state.p;
  const P = poseNow(state.p);
  updUI(P);
  if (S) cursor.overBand = S.st.hover;
  idleT += dt;
  const covered = footer.getBoundingClientRect().top <= 0;
  const idle = !DEMO && idleT > 2.5 && Math.abs(state.target - state.p) < 1e-4 && state.drop >= 1 && !S?.st.hover;
  skip = idle ? !skip : false; // покой → 30 fps
  if (S && !covered && !skip) S.frame(idle ? dt * 2 : dt, P);
}
addEventListener('scroll', () => { idleT = 0; }, { passive: true });
boot();
