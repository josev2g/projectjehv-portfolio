import test from 'node:test'; import assert from 'node:assert/strict';
import { forceLayout } from '../js/graph-layout.js';
import graph from '../js/graph-data.js';

test('forceLayout gives one point per node inside [-1, 1]', () => {
  const p = forceLayout(graph);
  assert.equal(p.length, graph.nodes.length);
  assert.ok(p.flat().every(v => Number.isFinite(v) && Math.abs(v) <= 1));
  assert.equal(Math.max(...p.flat().map(Math.abs)), 1); // normalized to fill the box
});

test('forceLayout is deterministic', () => {
  assert.deepEqual(forceLayout(graph), forceLayout(graph));
});

test('forceLayout spreads nodes apart', () => {
  const p = forceLayout(graph);
  let min = Infinity;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) min = Math.min(min, Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]));
  assert.ok(min > 0.02, `closest pair ${min}`);
});
