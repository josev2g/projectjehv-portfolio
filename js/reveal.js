// Fade-and-rise for [data-reveal], count-up for [data-count]; each runs once when it scrolls into view.
export function initReveals(root, { reducedMotion }) {
  const reveals = [...root.querySelectorAll('[data-reveal]')];
  const counters = [...root.querySelectorAll('[data-count]')];
  const final = el => `${el.dataset.count}${el.dataset.suffix ?? ''}`;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
    counters.forEach(el => { el.textContent = final(el); });
    return;
  }

  function count(el) {
    const to = Number(el.dataset.count), start = performance.now(), dur = 1400;
    const tick = now => {
      const t = Math.min(1, (now - start) / dur), e = 1 - (1 - t) ** 3;
      el.textContent = `${Math.round(to * e)}${el.dataset.suffix ?? ''}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const io = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      if (target.dataset.count) count(target); else target.classList.add('in');
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  counters.forEach(el => { el.textContent = `0${el.dataset.suffix ?? ''}`; io.observe(el); });
  reveals.forEach(el => io.observe(el));
}
