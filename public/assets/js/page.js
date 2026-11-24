// page.js — внутренние страницы: облегчённая сцена той же ленты (свой фрагмент/поза на каждой странице)
// + движение секций: word-by-word (classes), колода (classes), неделя-маска и кинетика цены (schedule),
// Rek-скраб цитаты и этикетка с tilt (coach), форма → WhatsApp с лентой-прогрессом (register).
import { initCommon, REDUCED, MOBILE, STILL, FINE, cursor, I, gsapP, rekPlay } from './common.js';
import { pose, clamp, ss as smooth } from './choreo.js';
initCommon();
const page = document.body.dataset.page;
const canvas = document.querySelector('.stage-lite');
const hero = document.querySelector('.ihero');
const secP = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); const h = el.offsetHeight - innerHeight; return h > 0 ? clamp(-r.top / h) : clamp(1 - r.bottom / (innerHeight + el.offsetHeight)); };
const lerp = (a, b, k) => a + (b - a) * k;
const lerpA = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

/* ---------- позы страниц ---------- */
const REG = { f: 0, ft: 0, done: 0, dt: 0 };
const CFG = {
  classes: (lp, t) => { // макро: камера скользит вдоль натянутой ленты, шов проходит перед объективом
    const P = pose(0.17); P.breathe = 0;
    const x = lerp(-15, 9, smooth(lp));
    P.cam = { pos: [x, 9.5 + Math.sin(t * 0.3) * 0.4, 15.5], target: [x + 5, 5.2, 2.6], fov: 36 };
    return P;
  },
  schedule: (lp, t) => { // лента — линия недели, низкая камера
    const P = pose(0.6); P.digits = 0; P.capsOn = 1; P.gapL = 96; P.gapR = 36;
    P.cam = { pos: [4 + Math.sin(t * 0.12) * 3, 12 - lp * 3, 64 - lp * 6], target: [4, 10.5, -4], fov: 40 };
    return P;
  },
  coach: (lp, t) => { // ∞ крупно у этикетки
    const P = pose(1); P.flow = 1;
    P.cam = { pos: [-12 + Math.sin(t * 0.18) * 2, 21, 36 - lp * 6], target: [-3, 18.5, 0], fov: 34 };
    return P;
  },
  register: (lp, t) => {
    const k = smooth(REG.done), P = pose(lerp(0.105 + 0.085 * REG.f, 1, k));
    P.cam = { pos: lerpA([3, 24, 40], [0, 21, 58], k), target: lerpA([0, 6.5, 0], [0, 18, -2], k), fov: 38 };
    return P;
  },
  '404': (lp, t) => { // перетянуто: лента на пределе, шов краснеет
    const P = pose(0.6); P.digits = 0;
    P.cam = { pos: [26 + Math.sin(t * 0.2) * 2, 10, 34], target: [-6, 6, 0], fov: 42 };
    P.caps.forEach((c) => (c.glow = 0.5 + 0.5 * Math.sin(t * 2.4)));
    return P;
  },
};

/* ---------- classes: слова загораются скроллом; колода вопросов ---------- */
function initWBW() {
  const el = document.querySelector('[data-wbw]'); if (!el) return;
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) { const frag = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) frag.append(' '); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.append(s); } }); n.replaceWith(frag); }
    else walk(n);
  });
  walk(el);
  const ws = [...el.querySelectorAll('.w')];
  const upd = () => { const r = el.getBoundingClientRect(); const k = REDUCED ? 1 : clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)); const n = Math.round(k * ws.length); ws.forEach((w, i) => w.classList.toggle('on', i < n)); };
  addEventListener('scroll', upd, { passive: true }); upd();
}
function initDeck() {
  const deck = document.querySelector('.deck'); if (!deck) return;
  const cards = [...deck.querySelectorAll('.card')], btns = [...document.querySelectorAll('.qlist button')];
  let order = cards.map((_, i) => i);
  const paint = () => { order.forEach((ci, d) => { const c = cards[ci]; c.style.setProperty('--d', Math.min(d, 3)); c.style.visibility = d > 3 ? 'hidden' : 'visible'; c.setAttribute('aria-hidden', d ? 'true' : 'false'); }); btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === order[0]))); };
  const show = (i) => {
    if (order[0] === i) return;
    const top = cards[order[0]];
    if (REDUCED) { order = [i, ...order.filter((x) => x !== i)]; paint(); return; }
    top.classList.add('fly');
    setTimeout(() => { top.classList.remove('fly'); order = [i, ...order.filter((x) => x !== i)]; paint(); }, 260);
  };
  btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
  deck.querySelector('.deck-next').addEventListener('click', () => show(order[1]));
  paint();
}
/* ---------- schedule: неделя рисуется маской, петля едет к понедельнику; цена навстречу ---------- */
function initWeek() {
  const tr = document.querySelector('[data-track]'); if (!tr) return;
  const loopEl = tr.querySelector('.track-loop'), mon = tr.querySelector('.days li.mon i');
  let k = 0, kt = 0;
  const upd = () => { const r = tr.getBoundingClientRect(); kt = REDUCED ? 1 : clamp((innerHeight * 0.8 - r.top) / (innerHeight * 0.55)); };
  const tick = () => {
    k += (kt - k) * 0.1;
    tr.style.setProperty('--k', k.toFixed(4));
    const W = tr.offsetWidth, mx = mon.getBoundingClientRect().left - tr.getBoundingClientRect().left + mon.offsetWidth / 2;
    loopEl.style.setProperty('--x', (Math.min(k * W, mx)).toFixed(1));
    requestAnimationFrame(tick);
  };
  addEventListener('scroll', upd, { passive: true }); upd(); tick();
  // ближайший понедельник (из «Every Monday 18:00»)
  const d = new Date(); const add = (8 - d.getDay()) % 7 || (d.getHours() >= 18 ? 7 : 0); d.setDate(d.getDate() + add);
  const el = document.getElementById('next-mon');
  if (el) el.textContent = d.toLocaleDateString(I.lang === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ', 18:00';
}
function initKinetic() {
  const sec = document.querySelector('[data-kin]'); if (!sec) return;
  const upd = () => { const r = sec.getBoundingClientRect(); const k = REDUCED ? 1 : clamp((innerHeight - r.top) / (innerHeight * 1.1)); sec.style.setProperty('--k', smooth(k).toFixed(4)); };
  addEventListener('scroll', upd, { passive: true }); upd();
}
/* ---------- coach: цитата тянется скроллом; этикетка наклоняется ---------- */
function initQuote() {
  const sec = document.querySelector('[data-quote]'); if (!sec) return;
  const q = sec.querySelector('.q-t'); q.innerHTML = `<span class="q-band">${q.innerHTML}</span>`;
  const upd = () => { const r = sec.getBoundingClientRect(); const k = REDUCED ? 1 : clamp((innerHeight * 0.95 - r.top) / (innerHeight * 0.9)); const e = smooth(k); q.style.setProperty('--qls', (-0.09 + 0.09 * e).toFixed(4)); q.style.setProperty('--qk', e.toFixed(4)); };
  addEventListener('scroll', upd, { passive: true }); upd();
}
function initTag() {
  const c = document.querySelector('.tag-card'); if (!c || !FINE || REDUCED) return;
  c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg'); c.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); });
  c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
}
/* ---------- register: форма → готовый текст → wa.me ---------- */
function initForm() {
  const form = document.getElementById('reg-form'); if (!form) return;
  const sel = document.getElementById('f-day'), done = document.getElementById('done'), txt = document.getElementById('done-txt'), wa = document.getElementById('done-wa'), cap = document.getElementById('reg-cap');
  const loc = I.lang === 'nl' ? 'nl-NL' : 'en-GB';
  const d = new Date(); const add = (8 - d.getDay()) % 7 || (d.getHours() >= 18 ? 7 : 0); d.setDate(d.getDate() + add);
  for (let i = 0; i < 4; i++) { const o = document.createElement('option'); const di = new Date(d); di.setDate(d.getDate() + 7 * i); o.value = di.toISOString().slice(0, 10); o.textContent = di.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }); sel.insertBefore(o, sel.lastElementChild); }
  sel.selectedIndex = 0;
  const steps = [...document.querySelectorAll('.reg-steps li')];
  const prog = () => {
    const name = form.elements.name.value.trim().length >= 2 ? 1 : 0, exp = form.querySelector('[name=exp]:checked') ? 1 : 0, day = 1, note = form.elements.note.value.trim() ? 1 : 0;
    REG.ft = (name * 0.45 + exp * 0.35 + day * 0.1 + note * 0.1);
  };
  form.addEventListener('input', (e) => { e.target.closest('.fld')?.classList.remove('bad'); prog(); });
  form.addEventListener('change', (e) => { e.target.closest('.fld')?.classList.remove('bad'); prog(); });
  const label = () => { const el = form.querySelector('[name=exp]:checked'); return el ? el.nextElementSibling.textContent : ''; };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let bad = null;
    const nm = form.elements.name; const okN = nm.value.trim().length >= 2; nm.closest('.fld').classList.toggle('bad', !okN); if (!okN) bad = nm;
    const exp = form.querySelector('[name=exp]'), okE = !!form.querySelector('[name=exp]:checked'); exp.closest('.fld').classList.toggle('bad', !okE); if (!okE && !bad) bad = exp;
    if (bad) { bad.focus(); return; }
    const dayTxt = sel.value === 'any' ? I.msg_any : `${I.msg_on} ${sel.selectedOptions[0].textContent} ${I.msg_at}`;
    const note = form.elements.note.value.trim();
    const msg = `${I.msg_hi} ${dayTxt}.\n${I.msg_name}: ${nm.value.trim()}\n${I.msg_exp}: ${label()}` + (note ? `\n${I.msg_note}: ${note}` : '');
    const url = `${I.wa}?text=${encodeURIComponent(msg)}`;
    txt.textContent = msg; wa.href = url;
    form.hidden = true; done.hidden = false; done.focus(); steps.forEach((s, i) => s.classList.toggle('on', i === 1));
    done.querySelectorAll('.rek').forEach((h) => rekPlay(h, 1));
    REG.dt = 1;
    window.__lastWa = url;
    try { window.open(url, '_blank', 'noopener'); } catch {}
  });
  document.getElementById('done-edit').addEventListener('click', () => { done.hidden = true; form.hidden = false; REG.dt = 0; steps.forEach((s, i) => s.classList.toggle('on', i === 0)); form.elements.name.focus(); });
  setInterval(() => { if (cap) cap.textContent = REG.done > 0.5 ? '∞' : Math.round(REG.f * 100) + '%'; }, 200);
  prog();
}
initWBW(); initDeck(); initWeek(); initKinetic(); initQuote(); initTag(); initForm();

/* ---------- сцена ---------- */
async function boot() {
  if (!canvas) return;
  let S;
  try {
    const m = await import('./scene.js');
    S = await m.createScene({ canvas, mode: 'lite', mobile: MOBILE, still: STILL });
  } catch (err) {
    console.warn('3D unavailable:', err && err.message);
    canvas.hidden = true; const po = canvas.parentElement.querySelector('.poster'); if (po) { po.src = po.dataset.src; po.hidden = false; } return;
  }
  S.st.reduced = REDUCED; window.__scene = S;
  const cfg = CFG[page] || CFG.coach;
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  addEventListener('resize', () => S.resize());
  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const over = !e.target.closest('a,button,.ihero-copy'); S.pointer(e.clientX, e.clientY, over); });
  host.addEventListener('pointerleave', () => { S.pointer(-9999, -9999, false); cursor.overBand = false; });
  host.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') S.pointer(e.clientX, e.clientY, true); });
  host.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') S.pointer(-9999, -9999, false); });
  let last = performance.now(), lp = secP(hero), time = 0, frames = 0, fpsT = last; window.__fps = 0;
  const drop = { v: STILL || REDUCED ? 1 : 0 };
  if (drop.v < 1) gsapP().then((g) => g.to(drop, { v: 1, duration: 1.6, ease: 'power2.out', delay: 0.15 }));
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    frames++; if (now - fpsT > 1000) { window.__fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
    const k = 1 - Math.exp(-dt * 3); REG.f += (REG.ft - REG.f) * k; REG.done += (REG.dt - REG.done) * (1 - Math.exp(-dt * 1.6));
    lp += (secP(hero) - lp) * (STILL ? 1 : 1 - Math.exp(-5 * dt));
    if (!visible || document.hidden) return;
    const P = cfg(lp, STILL ? 0 : time); P.drop = drop.v;
    cursor.overBand = S.st.hover;
    S.frame(dt, P);
  };
  requestAnimationFrame(loop);
}
boot();
