import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initTurn } from './turn.js';
import { createOrb } from './orb.js';
import { activeBeat, beatProgress, smoothHands } from './beats.js';
import { forceLayout } from './graph-layout.js';
import { initReveals } from './reveal.js';
import { initMotion } from './motion.js';
import graph from './graph-data.js';

gsap.registerPlugin(ScrollTrigger);
// ScrollTrigger's own resize refresh does not always fire (seen with viewport changes mid-pin), so refresh ourselves.
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200); });

const mobile = matchMedia('(max-width: 767px)').matches;
// ?still previews the reduced-motion version without changing OS settings
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still');
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(1, Math.max(0, v));
const easeOut = t => 1 - (1 - t) ** 3;
const ORB = mobile ? 64 : 96; // orb diameter in Jose's hands, px

// Sections fade in only once this module runs; if a CDN import fails they simply stay visible.
document.documentElement.classList.add('reveal');
initReveals(document, { reducedMotion });
initMotion(document, { reducedMotion });

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const hero = document.getElementById('hero');
const turn = await initTurn(hero, { mobile, reducedMotion });
// Reduced motion gets the calm static glows instead of a moving orb.
const orb = reducedMotion ? null : createOrb({ mobile, reducedMotion, graph });
if (!orb) { document.documentElement.classList.add('no-webgl'); drawGraphSvg(document.querySelector('.graph-fallback')); }

// Every "Book a call" link opens the Calendly pop-up over the page (falls back to the link if Calendly did not load).
const CALENDLY = 'https://calendly.com/josev2g-va/discovery-call?hide_gdpr_banner=1';
document.addEventListener('click', e => {
  const a = e.target.closest('a[href="#book"], a[data-calendly]');
  if (!a || !window.Calendly) return;
  e.preventDefault();
  window.Calendly.initPopupWidget({ url: CALENDLY });
});

// S1: the orb is born in Jose's hands, grows, and the workflow cards fly out of them.
const rawHands = await (await fetch('assets/frames/hands.json')).json();
const hands = smoothHands(rawHands, 5);
// the raised hand, for the last beat where one hand presents and the other drops
// (only two-hand frames count; with one hand we cannot tell which one is raised, so those frames are interpolated)
const upper = smoothHands(rawHands.map(({ l, r }) => ({ l: l && r ? (l[1] < r[1] ? l : r) : null, r: null })), 7);
const cards = [...hero.querySelectorAll('.flow-card')];
const ORDER = ['front', 'turn', 'back', 'cupped', 'palms', 'reach', 'frame'];
let lastBeat = 'front';

function heroFrame(frame, active = true) {
  const m = turn.manifest, beat = activeBeat(frame, m)?.id ?? 'frame', idx = ORDER.indexOf(beat);
  const bp = id => beatProgress(frame, id, m);
  const h = hands[frame], u = upper[frame], rect = turn.getImageRect();
  const toUpper = beat === 'frame' && u ? easeOut(clamp01(bp('frame') * 3)) : 0;
  const hx = h ? lerp(h.x, u?.x ?? h.x, toUpper) : 0, hy = h ? lerp(h.y, u?.y ?? h.y, toUpper) : 0;

  let size = 0;
  if (beat === 'cupped') size = 18 * easeOut(bp('cupped'));
  else if (beat === 'palms') size = lerp(18, ORB, easeOut(bp('palms')));
  else if (beat === 'reach' || beat === 'frame') size = ORB * (1 + 0.15 * toUpper);
  const x = rect.x + hx * rect.w, y = rect.y + hy * rect.h - size * 0.55 * toUpper; // hover just above the raised palm
  // only the pinned hero owns the orb; further down, the section triggers do
  if (orb && h && active) { orb.setAnchor(x, y, size); orb.setState('hands'); }

  if (orb && active && beat !== lastBeat) {
    if (beat === 'cupped' && lastBeat === 'back') orb.burst(0.25);
    if (beat === 'palms' && lastBeat === 'cupped') orb.burst(1);
  }
  lastBeat = beat;

  // cards: fly from the hand to a stack on the left during 'reach', fade early in 'frame'
  const p = idx < 5 ? 0 : idx > 5 ? 1 : bp('reach'), fade = beat === 'frame' ? clamp01(bp('frame') * 4) : 0;
  const tx = innerWidth * (mobile ? 0.06 : 0.07), ty0 = innerHeight * (mobile ? 0.42 : 0.17), gap = mobile ? 50 : 60;
  cards.forEach((el, k) => {
    const local = clamp01((p - k * 0.12) / 0.5), e = easeOut(local);
    const cx = lerp(x, tx, e), cy = lerp(y, ty0 + k * gap, e);
    el.style.transform = `translate(${cx}px, ${cy}px) translate(${lerp(-50, 0, e)}%, -50%) scale(${lerp(0.4, 1, e)})`;
    el.style.opacity = local > 0 ? Math.min(1, local * 3) * (1 - fade) : 0;
  });
}

if (!reducedMotion) {
  turn.onFrame(heroFrame);
  heroFrame(0);
}

// The orb's journey: each [data-orb] section blends the orb from the previous section's state into its own.
const stops = [...document.querySelectorAll('[data-orb]')];
if (orb) stops.forEach((sec, i) => {
  const from = i === 0 ? 'hands' : stops[i - 1].dataset.orb, to = sec.dataset.orb;
  ScrollTrigger.create({ trigger: sec, start: 'top 85%', end: 'top 25%', onUpdate: st => orb.setState(to, st.progress, from) });
});

// Links like /#book from the All Work page: the browser jumped before the 400% hero pin existed, so jump again now.
const target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (target) {
  const go = () => {
    ScrollTrigger.refresh();
    const y = target.getBoundingClientRect().top + scrollY;
    lenis?.resize(); // Lenis measured the page before the pin spacer existed and would stop short
    lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
  };
  // the browser does its own (wrong) hash jump at load, so go after it
  document.readyState === 'complete' ? setTimeout(go) : addEventListener('load', () => setTimeout(go), { once: true });
}

function drawGraphSvg(svg) {
  if (!svg) return;
  const pts = forceLayout(graph), colors = ['#60BCE7', '#AAA4EF', '#46EFE6', '#566FC9'];
  const line = ([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}"/>`;
  const dot = (p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r=".035" fill="${colors[graph.nodes[i].c % colors.length]}"/>`;
  svg.setAttribute('viewBox', '-1.1 -1.1 2.2 2.2');
  svg.innerHTML = `<g stroke="rgba(170,164,239,.35)" stroke-width=".006">${graph.edges.map(line).join('')}</g>${pts.map(dot).join('')}`;
}
