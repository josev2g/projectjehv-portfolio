// Page-wide motion: headline word rise, typed labels, glow cursor, magnetic buttons, tilt cards,
// drifting background particles, scroll-reactive marquee and the 3-step flow line. No library needed.
const r2 = v => Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
const clamp01 = v => Math.min(1, Math.max(0, v));

// px, py = pointer position inside the element (0..1). Top edge lifts toward the viewer, the far side turns away.
export const tiltAngles = (px, py, max) => ({ rx: r2((0.5 - py) * 2 * max), ry: r2((px - 0.5) * 2 * max) });

// 0 when the element's top is at 80% of the viewport, 1 at 30%.
export const viewProgress = (top, vh) => clamp01((0.8 * vh - top) / (0.5 * vh));

export const magnetOffset = (mx, my, cx, cy, k) => ({ x: r2((mx - cx) * k), y: r2((my - cy) * k) });

function splitWords(el) {
  let i = 0;
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span'), inner = document.createElement('span');
          w.className = 'w'; inner.textContent = part; inner.style.setProperty('--i', i++);
          w.append(inner); frag.append(w);
        }
        child.replaceWith(frag);
      } else walk(child);
    }
  };
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  walk(el);
  el.classList.add('split');
}

function typeLabels(labels) {
  const io = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      const text = target.dataset.text;
      let n = 0;
      target.classList.add('typing');
      const tick = setInterval(() => {
        target.textContent = text.slice(0, ++n);
        if (n >= text.length) { clearInterval(tick); setTimeout(() => target.classList.remove('typing'), 900); }
      }, 32);
    }
  });
  for (const el of labels) {
    el.dataset.text = el.textContent;
    el.setAttribute('aria-label', el.textContent);
    el.textContent = '';
    io.observe(el);
  }
}

function glowCursor(root) {
  const glow = root.createElement('div'), dot = root.createElement('div');
  glow.className = 'cursor-glow'; dot.className = 'cursor-dot';
  root.body.append(glow, dot);
  const m = { x: innerWidth / 2, y: innerHeight / 2 }, g = { ...m };
  let big = false;
  addEventListener('pointermove', e => {
    m.x = e.clientX; m.y = e.clientY;
    dot.style.transform = `translate(${m.x}px, ${m.y}px)`;
    const over = !!e.target.closest?.('a, button, .card, img[data-zoom]');
    if (over !== big) { big = over; root.body.classList.toggle('cursor-big', big); }
  }, { passive: true });
  root.addEventListener('pointerleave', () => root.body.classList.add('cursor-out'));
  root.addEventListener('pointerenter', () => root.body.classList.remove('cursor-out'));
  (function loop() {
    g.x += (m.x - g.x) * 0.14; g.y += (m.y - g.y) * 0.14;
    glow.style.transform = `translate(${g.x}px, ${g.y}px)`;
    requestAnimationFrame(loop);
  })();
}

function magnetic(buttons) {
  for (const b of buttons) {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect(), o = magnetOffset(e.clientX, e.clientY, r.left + r.width / 2, r.top + r.height / 2, 0.3);
      b.style.translate = `${o.x}px ${o.y}px`;
    });
    b.addEventListener('pointerleave', () => { b.style.translate = ''; });
  }
}

function tiltCards(cards) {
  for (const c of cards) {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const { rx, ry } = tiltAngles(px, py, 6);
      c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      c.style.setProperty('--mx', `${px * 100}%`); c.style.setProperty('--my', `${py * 100}%`);
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  }
}

function particles(root) {
  const cv = root.createElement('canvas'), ctx = cv.getContext('2d');
  cv.className = 'bg-particles'; cv.setAttribute('aria-hidden', 'true');
  root.body.prepend(cv);
  const COLORS = ['96,188,231', '170,164,239', '70,239,230'];
  let W = 0, H = 0, ps = [];
  const resize = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round(Math.min(90, W * H / 16000));
    ps = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.25 - 0.05, c: COLORS[Math.floor(Math.random() * 3)], a: Math.random() * 0.5 + 0.15 }));
  };
  resize(); addEventListener('resize', resize);
  let lastY = scrollY;
  (function loop() {
    const dy = scrollY - lastY; lastY = scrollY;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy - dy * 0.15 * p.r; // bigger dots drift faster with scroll: cheap parallax
      if (p.y < -5) p.y += H + 10; if (p.y > H + 5) p.y -= H + 10; if (p.x < -5) p.x += W + 10; if (p.x > W + 5) p.x -= W + 10;
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    requestAnimationFrame(loop);
  })();
}

function scrollMarquee(track) {
  const anim = track.getAnimations?.()[0];
  if (!anim) return;
  let lastY = scrollY, speed = 1;
  (function loop() {
    const v = Math.abs(scrollY - lastY); lastY = scrollY;
    speed += (1 + Math.min(v / 6, 6) - speed) * 0.08;
    anim.playbackRate = speed;
    requestAnimationFrame(loop);
  })();
}

function flowLine(flow) {
  const update = () => flow.style.setProperty('--p', viewProgress(flow.getBoundingClientRect().top, innerHeight));
  addEventListener('scroll', update, { passive: true }); update();
}

export function initMotion(root, { reducedMotion }) {
  const flow = root.querySelector('.flow');
  if (reducedMotion) { flow?.style.setProperty('--p', 1); return; }
  root.querySelectorAll('.sec h2, .hero-copy h1, .work-hero h1').forEach(splitWords);
  // the page titles are on screen at load, so their words rise right away
  setTimeout(() => root.querySelectorAll('.hero-copy h1, .work-hero h1').forEach(h => h.classList.add('in')), 80);
  typeLabels([...root.querySelectorAll('.eyebrow')]);
  if (flow) flowLine(flow);
  const marquee = root.querySelector('.marquee .track');
  if (marquee) scrollMarquee(marquee);
  particles(root);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    glowCursor(root);
    magnetic(root.querySelectorAll('.pill'));
    tiltCards(root.querySelectorAll('.card'));
  }
}
