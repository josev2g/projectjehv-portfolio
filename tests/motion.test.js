import test from 'node:test'; import assert from 'node:assert/strict';
import { tiltAngles, viewProgress, magnetOffset } from '../js/motion.js';

test('tiltAngles is flat at the center and maxed at the edges', () => {
  assert.deepEqual(tiltAngles(0.5, 0.5, 6), { rx: 0, ry: 0 });
  assert.deepEqual(tiltAngles(1, 0, 6), { rx: 6, ry: 6 });   // top right: top edge lifts toward viewer, right edge turns away
  assert.deepEqual(tiltAngles(0, 1, 6), { rx: -6, ry: -6 });
});

test('viewProgress goes 0 to 1 as an element scrolls from 80% to 30% of the viewport', () => {
  assert.equal(viewProgress(900, 1000), 0);     // still below the start line
  assert.equal(viewProgress(550, 1000), 0.5);
  assert.equal(viewProgress(100, 1000), 1);
});

test('magnetOffset pulls toward the cursor but never past the strength', () => {
  assert.deepEqual(magnetOffset(100, 50, 100, 50, 0.3), { x: 0, y: 0 });
  assert.deepEqual(magnetOffset(140, 60, 100, 50, 0.3), { x: 12, y: 3 });
});
