// common.js — шапка/меню, курсор «Pull», заголовки «Rek», шторка «Curtain call», футер «Monday loop».
export const Q = new URLSearchParams(location.search);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(pointer: fine)').matches;
export const MOBILE = matchMedia('(max-width: 760px)').matches || (matchMedia('(pointer: coarse)').matches && innerWidth < 1024);
export const STILL = Q.has('p') || Q.has('still');
export const I = JSON.parse(document.getElementById('i18n')?.textContent || '{}');
export const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
export const gsapP = () => new Promise((r) => { const ch = () => window.gsap ? r(window.gsap) : setTimeout(ch, 16); ch(); });

/* ---------- Rek ---------- */
const OUT = { '--ls': -0.12, '--sx': 0.86, '--u': 0 }, IN = { '--ls': -0.01, '--sx': 1, '--u': 1 };
const setV = (el, v) => { for (const k in v) el.style.setProperty(k, v[k]); };
export function rekInit(el) {
  if (el._rek) return; el._rek = { state: 'out' };
  if (REDUCED || STILL) { el._rek.state = 'in'; setV(el, IN); return; }
  setV(el, OUT);
}
export async function rekPlay(el, dir = 1) {
  rekInit(el); if (REDUCED || STILL) return;
  const want = dir > 0 ? 'in' : 'out'; if (el._rek.state === want) return; el._rek.state = want;
  const gsap = await gsapP(); gsap.killTweensOf(el);
  const o = { ls: parseFloat(el.style.getPropertyValue('--ls')), sx: parseFloat(el.style.getPropertyValue('--sx')), u: parseFloat(el.style.getPropertyValue('--u')) };
  const T = dir > 0 ? IN : OUT;
  const upd = () => setV(el, { '--ls': o.ls.toFixed(4), '--sx': o.sx.toFixed(4), '--u': o.u.toFixed(4) });
  if (dir > 0) {
    gsap.to(o, { ls: T['--ls'], sx: T['--sx'], duration: 1.25, ease: 'elastic.out(1,0.5)', onUpdate: upd, onStart: () => gsap.killTweensOf(el) });
    gsap.to(o, { u: 1, duration: 0.9, delay: 0.1, ease: 'power3.inOut', onUpdate: upd });
  } else {
    gsap.to(o, { ls: T['--ls'], sx: T['--sx'], u: 0, duration: 0.45, ease: 'power2.in', onUpdate: upd });
  }
}
function initRek() {
  const all = [...document.querySelectorAll('.rek')]; all.forEach(rekInit);
  const io = new IntersectionObserver((es) => es.forEach((e) => rekPlay(e.target, e.isIntersecting ? 1 : -1)), { threshold: 0.4 });
  all.forEach((h) => { if (!h.closest('.copy')) io.observe(h); });
  const rv = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.2 });
  document.querySelectorAll('[data-reveal]').forEach((el) => rv.observe(el));
}

/* ---------- header + menu ---------- */
function initHeader() {
  const btn = document.querySelector('.menu-btn'), menu = document.getElementById('menu'); if (!btn) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open; btn.querySelector('span').textContent = open ? I.close : I.menu;
    document.documentElement.style.overflow = open ? 'hidden' : ''; document.body.classList.toggle('menu-open', open);
    if (open) menu.querySelector('a')?.focus();
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
}

/* ---------- cursor Pull ---------- */
export const cursor = { overBand: false };
function initCursor() {
  const el = document.querySelector('.cur'); if (!el || !FINE) return;
  let x = -100, y = -100, rx = -100, ry = -100;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    el.classList.toggle('link', !!e.target.closest('a,button,label.opt,select,input,textarea'));
    el.classList.toggle('dark', !!e.target.closest('.ft,.facts,.price,.menu,.tag-card'));
  });
  const dot = el.querySelector('.cur-dot'), ring = el.querySelector('.cur-ring'), tx = el.querySelector('.cur-t');
  const loop = () => {
    rx += (x - rx) * 0.24; ry += (y - ry) * 0.24;
    dot.style.transform = `translate(${x}px,${y}px)`; ring.style.transform = `translate(${rx}px,${ry}px)`; tx.style.transform = `translate(${rx}px,${ry}px)`;
    el.classList.toggle('pull', cursor.overBand && !el.classList.contains('link'));
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- Curtain call ---------- */
function initCurtain() {
  const cc = document.querySelector('.cc'); if (!cc) return;
  const L = cc.querySelector('.cc-l'), R = cc.querySelector('.cc-r');
  const open = async () => {
    const gsap = await gsapP();
    cc.classList.add('run'); document.documentElement.classList.remove('cc-in');
    gsap.set([L, R], { x: 0 });
    gsap.timeline({ onComplete: () => { cc.classList.remove('run'); gsap.set(L, { x: '-101%' }); gsap.set(R, { x: '101%' }); } })
      .to(L, { x: '-101%', duration: 0.9, ease: 'power3.inOut' }, 0.05).to(R, { x: '101%', duration: 0.9, ease: 'power3.inOut' }, 0.05)
      .fromTo([L, R], { backgroundPositionX: '0px, 0px' }, { backgroundPositionX: '0px, 18px', duration: 0.9, ease: 'sine.inOut' }, 0.05);
  };
  if (document.documentElement.classList.contains('cc-in')) { ss.del('se-cc'); if (REDUCED) document.documentElement.classList.remove('cc-in'); else requestAnimationFrame(() => setTimeout(open, 40)); }
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || !/(\.html|\/)$/.test(u.pathname)) return;
    if (u.pathname === location.pathname) return;
    e.preventDefault();
    if (REDUCED) { location.href = u.href; return; }
    const gsap = await gsapP();
    cc.classList.add('run');
    gsap.timeline({ onComplete: () => { ss.set('se-cc', '1'); location.href = u.href; } })
      .fromTo(L, { x: '-101%' }, { x: 0, duration: 0.6, ease: 'power3.in' }, 0).fromTo(R, { x: '101%' }, { x: 0, duration: 0.6, ease: 'power3.in' }, 0)
      .fromTo([L, R], { backgroundPositionX: '0px, 0px' }, { backgroundPositionX: '0px, -14px', duration: 0.6, ease: 'sine.inOut' }, 0);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { cc.classList.remove('run'); L.style.transform = ''; R.style.transform = ''; } });
}

/* ---------- footer: петля стягивается вокруг «Monday 18:00» ---------- */
function initFooter() {
  const box = document.querySelector('.ft-loop'); if (!box) return;
  const band = box.querySelector('.ft-band'), seam = box.querySelector('.ft-seam'), tag = box.querySelector('.ft-tag');
  let k = REDUCED ? 1 : 0, kt = k, raf = 0;
  const draw = () => {
    const w = box.offsetWidth, h = box.offsetHeight, r = Math.min(h / 2, 48);
    const sag = (1 - k) * h * 0.5, bulge = (1 - k) * 26;
    const x0 = -bulge, x1 = w + bulge, y0 = 0 - sag * 0.15, y1 = h + sag * 0.15;
    // верх и низ провисают, пока петля не натянута
    const d = `M ${x0 + r} ${y0} Q ${w / 2} ${y0 + sag} ${x1 - r} ${y0} Q ${x1} ${y0} ${x1} ${y0 + r} L ${x1} ${y1 - r} Q ${x1} ${y1} ${x1 - r} ${y1} Q ${w / 2} ${y1 - sag * 0.6} ${x0 + r} ${y1} Q ${x0} ${y1} ${x0} ${y1 - r} L ${x0} ${y0 + r} Q ${x0} ${y0} ${x0 + r} ${y0} Z`;
    band.setAttribute('d', d);
    seam.setAttribute('d', `M ${x0 + r} ${y0 - 0.5} Q ${w / 2} ${y0 + sag - 0.5} ${x1 - r} ${y0 - 0.5}`);
    tag.setAttribute('x', x1 - r - 60); tag.setAttribute('y', y1 - 12);
  };
  const tick = () => { k += (kt - k) * 0.08; draw(); if (Math.abs(kt - k) > 0.001) raf = requestAnimationFrame(tick); else { k = kt; draw(); raf = 0; } };
  const upd = () => {
    const r = box.getBoundingClientRect(); kt = REDUCED ? 1 : Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + innerHeight * 0.35)));
    if (!raf) raf = requestAnimationFrame(tick);
  };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', () => { draw(); upd(); }); document.fonts.ready.then(() => { draw(); upd(); }); draw(); upd();
}

export function initCommon() { initHeader(); initCursor(); initCurtain(); initFooter(); initRek(); }
