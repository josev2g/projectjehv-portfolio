// Pure 2D layout of the second brain graph (used by the orb and the no-WebGL SVG).
// Simple spring + repulsion layout in [-1, 1], run once.
export function forceLayout(graph) {
  const n = graph.nodes.length, p = Array.from({ length: n }, (_, i) => [Math.cos(i * 2.4) * 0.6, Math.sin(i * 2.4) * 0.6]);
  for (let it = 0; it < 300; it++) {
    const f = p.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], d2 = dx * dx + dy * dy + 1e-4, k = 0.012 / d2;
      f[i][0] += dx * k; f[i][1] += dy * k; f[j][0] -= dx * k; f[j][1] -= dy * k;
    }
    for (const [a, b] of graph.edges) {
      const dx = p[b][0] - p[a][0], dy = p[b][1] - p[a][1];
      f[a][0] += dx * 0.012; f[a][1] += dy * 0.012; f[b][0] -= dx * 0.012; f[b][1] -= dy * 0.012;
    }
    p.forEach((q, i) => { q[0] += Math.max(-0.05, Math.min(0.05, f[i][0])) - q[0] * 0.02; q[1] += Math.max(-0.05, Math.min(0.05, f[i][1])) - q[1] * 0.02; });
  }
  const m = Math.max(...p.flat().map(Math.abs));
  return p.map(([x, y]) => [x / m, y / m]);
}
