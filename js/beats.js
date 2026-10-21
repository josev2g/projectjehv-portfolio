// Pure timeline helpers for the turn sequence. No DOM access, so node --test can cover them.

// Beats in source-video seconds (Take 1). Ranges are [from, to); the last one includes its end.
export const BEATS = [
  { id: 'front', from: 1.0, to: 3.0 },
  { id: 'turn', from: 3.0, to: 10.0 },
  { id: 'back', from: 10.0, to: 11.0 },
  { id: 'cupped', from: 11.0, to: 12.5 },
  { id: 'palms', from: 12.5, to: 13.5 },
  { id: 'reach', from: 13.5, to: 14.7 },
  { id: 'frame', from: 14.7, to: 18.5 },
];

const clamp01 = v => Math.min(1, Math.max(0, v));

export const progressToFrame = (progress, count) => Math.round(clamp01(progress) * (count - 1));

export const frameToSeconds = (frame, manifest) => manifest.srcStart + frame / manifest.fps;

export function activeBeat(frame, manifest) {
  const s = frameToSeconds(frame, manifest), last = BEATS[BEATS.length - 1];
  return BEATS.find(b => s >= b.from && s < b.to) ?? (s === last.to ? last : null);
}

export function beatProgress(frame, beatId, manifest) {
  const b = BEATS.find(x => x.id === beatId);
  return clamp01((frameToSeconds(frame, manifest) - b.from) / (b.to - b.from));
}

// Closest loaded index to target; ties go to the lower index; -1 when nothing is loaded.
export function nearestLoaded(target, loaded) {
  for (let d = 0; d < loaded.length; d++) {
    if (loaded[target - d]) return target - d;
    if (loaded[target + d]) return target + d;
  }
  return -1;
}

// Contain-fit a sw x sh image into dw x dh. anchorY 1 = sit on the bottom edge.
export function fitContain(sw, sh, dw, dh, anchorY = 1) {
  const k = Math.min(dw / sw, dh / sh), w = sw * k, h = sh * k;
  return { x: (dw - w) / 2, y: (dh - h) * anchorY, w, h };
}

// Per-frame orb anchor from raw hand detections: midpoint of the hands seen,
// gaps filled linearly (ends copy the nearest seen frame), then a centered moving average.
export function smoothHands(raw, win = 5) {
  const pts = raw.map(({ l, r }) => {
    if (l && r) return { x: (l[0] + r[0]) / 2, y: (l[1] + r[1]) / 2, spread: Math.hypot(l[0] - r[0], l[1] - r[1]) };
    const h = l || r;
    return h ? { x: h[0], y: h[1], spread: 0 } : null;
  });
  const seen = pts.flatMap((p, i) => (p ? [i] : []));
  if (!seen.length) return pts;
  const filled = pts.map((p, i) => {
    if (p) return p;
    const a = seen.findLast(j => j < i), b = seen.find(j => j > i);
    if (a === undefined) return pts[b];
    if (b === undefined) return pts[a];
    const t = (i - a) / (b - a), A = pts[a], B = pts[b];
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, spread: A.spread + (B.spread - A.spread) * t };
  });
  const half = Math.floor(win / 2);
  return filled.map((_, i) => {
    const w = filled.slice(Math.max(0, i - half), i + half + 1), n = w.length;
    const avg = k => w.reduce((s, p) => s + p[k], 0) / n;
    return { x: avg('x'), y: avg('y'), spread: avg('spread') };
  });
}
