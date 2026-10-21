import { initReveals } from './reveal.js';

// Full-screen viewer for img[data-zoom]: wheel or buttons to zoom, drag to pan, pinch on phones, Esc or backdrop to close.
export function initZoom(root) {
  const box = root.createElement('div');
  box.className = 'zoom';
  box.hidden = true;
  box.innerHTML = `<div class="zoom-stage"><img alt=""></div>
    <p class="zoom-caption"></p>
    <div class="zoom-tools"><button type="button" data-z="-1" aria-label="Zoom out">−</button><button type="button" data-z="0" aria-label="Reset zoom">100%</button><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-close aria-label="Close">✕</button></div>`;
  root.body.appendChild(box);
  const stage = box.querySelector('.zoom-stage'), img = stage.querySelector('img'), cap = box.querySelector('.zoom-caption');
  const label = box.querySelector('[data-z="0"]');
  let zoom = 1, drag = null, last = null;

  const setZoom = z => { zoom = Math.min(5, Math.max(1, z)); img.style.width = `${zoom * 100}%`; label.textContent = `${Math.round(zoom * 100)}%`; };
  const close = () => { box.hidden = true; root.body.classList.remove('zoom-open'); last?.focus(); };
  function open(src, alt) {
    last = root.activeElement;
    img.src = src; img.alt = alt; cap.textContent = alt; setZoom(1);
    box.hidden = false; root.body.classList.add('zoom-open');
    box.querySelector('[data-close]').focus();
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('img[data-zoom]');
    if (t) open(t.currentSrc || t.src, t.alt);
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches?.('img[data-zoom]')) open(e.target.currentSrc || e.target.src, e.target.alt);
    if (e.key === 'Escape' && !box.hidden) close();
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b?.hasAttribute('data-close') || e.target === box) return close();
    if (b) setZoom(b.dataset.z === '0' ? 1 : zoom + Number(b.dataset.z) * 0.5);
  });
  stage.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  stage.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2.5));
  stage.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; stage.setPointerCapture(e.pointerId); } });
  stage.addEventListener('pointermove', e => { if (drag) { stage.scrollLeft = drag.l - (e.clientX - drag.x); stage.scrollTop = drag.t - (e.clientY - drag.y); } });
  stage.addEventListener('pointerup', () => { drag = null; });
}

document.documentElement.classList.add('reveal');
initReveals(document, { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
initZoom(document);
