import test from 'node:test'; import assert from 'node:assert/strict';
import graph from '../js/graph-data.js';

test('graph keeps the real structure', () => {
  assert.equal(graph.nodes.length, 38);
  assert.equal(graph.edges.length, 86);
});

test('graph references are valid', () => {
  const n = graph.nodes.length;
  for (const [a, b] of graph.edges) assert.ok(a >= 0 && a < n && b >= 0 && b < n, `${a}-${b}`);
  for (const node of graph.nodes) assert.ok(node.c >= 0 && node.c < graph.clusters.length);
});

test('graph carries structure only, no labels', () => {
  for (const node of graph.nodes) assert.deepEqual(Object.keys(node).sort(), ['c', 'id']);
  assert.deepEqual(graph.clusters, ['Career and brand', 'Events client', 'Franchise client', 'Photography client', 'GHL standards', 'Meta Ads', 'Claude workflow']);
});
