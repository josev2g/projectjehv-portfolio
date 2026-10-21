// S1: Jose's turn, drawn frame by frame from scroll position.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { progressToFrame, drawnFrame, fitContain, activeBeat } from './beats.js';

const PIN_LENGTH = '+=400%';

const loadImage = src => new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const wait = ms => new Promise(r => setTimeout(r, ms));

// Every 8th file first, then every 4th, 2nd, then the rest, so any scroll position has a near frame early.
function loadOrder(n) {
  const seen = new Uint8Array(n), order = [];
  for (const s of [8, 4, 2, 1]) for (let j = 0; j < n; j += s) if (!seen[j]) { seen[j] = 1; order.push(j); }
  return order;
}

export async function initTurn(section, { mobile, reducedMotion }) {
  const manifest = await (await fetch('assets/frames/manifest.json')).json();
  const kind = mobile ? 'mobile' : 'desktop', step = manifest[kind].step;
  const files = Math.ceil(manifest.count / step);
  const imgs = new Array(files), loaded = new Uint8Array(files);
  const canvas = section.querySelector('.turn-canvas'), ctx = canvas.getContext('2d');
  const lines = [...section.querySelectorAll('[data-beat]')];
  const giant = section.querySelector('.giant');
  const listeners = [];
  const slow = new URLSearchParams(location.search).has('slow');
  // target = frame the scroll asks for; shown = frame actually drawn (they differ while frames load)
  let target = 0, shown = -1, rect = { x: 0, y: 0, w: 0, h: 0 }, beatId = null;

  const url = j => `assets/frames/${kind}/f_${String(j).padStart(3, '0')}.webp`;

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const f = drawnFrame(target, loaded, step);
    if (f < 0) return;
    const img = imgs[f / step], cw = canvas.clientWidth, ch = canvas.clientHeight;
    rect = fitContain(img.naturalWidth, img.naturalHeight, cw, ch, 1);
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    shown = f;
    setBeat();
    for (const cb of listeners) cb(shown);
  }

  function setBeat() {
    const id = activeBeat(shown, manifest)?.id ?? null;
    if (id === beatId) return;
    beatId = id;
    section.dataset.beat = id ?? '';
    for (const el of lines) el.classList.toggle('on', el.dataset.beat.split(' ').includes(id));
  }

  imgs[0] = await loadImage(url(0));
  if (imgs[0]) loaded[0] = 1;
  resize();
  addEventListener('resize', resize);

  if (reducedMotion) {
    section.classList.add('still');
    for (const el of lines) el.classList.add('on');
  } else {
    ScrollTrigger.create({
      trigger: section, start: 'top top', end: PIN_LENGTH, pin: true,
      onUpdate: st => {
        target = progressToFrame(st.progress, manifest.count);
        if (giant) giant.style.transform = `translate(calc(-50% - ${st.progress * 6}%), -50%)`;
        draw();
      },
    });
    (async () => {
      for (const j of loadOrder(files)) {
        if (loaded[j]) continue;
        if (slow) await wait(100);
        const img = await loadImage(url(j));
        if (img) { imgs[j] = img; loaded[j] = 1; }
        if (Math.abs(j * step - target) < Math.abs(shown - target)) draw(); // a closer frame arrived
      }
    })();
  }

  return {
    manifest,
    getFrame: () => shown,
    // On-screen (viewport) rect of the drawn frame, for mapping hand positions.
    getImageRect: () => { const c = canvas.getBoundingClientRect(); return { x: c.left + rect.x, y: c.top + rect.y, w: rect.w, h: rect.h }; },
    onFrame: cb => listeners.push(cb),
  };
}
