import test from 'node:test'; import assert from 'node:assert/strict';
import { progressToFrame, activeBeat, beatProgress, nearestLoaded, drawnFrame, fitContain, smoothHands } from '../js/beats.js';

const M = { fps: 10, srcStart: 1.0 };

test('progressToFrame clamps and rounds', () => {
  assert.equal(progressToFrame(-0.2, 175), 0);
  assert.equal(progressToFrame(1.7, 175), 174);
  assert.equal(progressToFrame(0.5, 175), 87);
});

test('activeBeat maps frames to beats', () => {
  assert.equal(activeBeat(0, M).id, 'front');      // 1.0 s
  assert.equal(activeBeat(95, M).id, 'back');      // 10.5 s
  assert.equal(activeBeat(105, M).id, 'back');     // 11.5 s
  assert.equal(activeBeat(115, M).id, 'cupped');   // 12.5 s
  assert.equal(activeBeat(150, M).id, 'frame');    // 16.0 s
  assert.equal(activeBeat(999, M), null);
});

test('beatProgress is 0..1 inside a beat', () => {
  assert.equal(beatProgress(108, 'cupped', M), 0);   // 11.8 s
  assert.equal(beatProgress(119, 'cupped', M), 1);   // 12.9 s
  assert.equal(beatProgress(0, 'cupped', M), 0);
});

test('nearestLoaded picks closest loaded frame', () => {
  const l = new Uint8Array(10); l[2] = 1; l[7] = 1;
  assert.equal(nearestLoaded(4, l), 2);
  assert.equal(nearestLoaded(5, l), 7);
  assert.equal(nearestLoaded(7, l), 7);
  assert.equal(nearestLoaded(3, new Uint8Array(10)), -1);
});

test('fitContain keeps aspect and sits on the bottom', () => {
  assert.deepEqual(fitContain(1000, 1500, 1920, 1080), { x: 600, y: 0, w: 720, h: 1080 });
  assert.deepEqual(fitContain(1000, 1500, 375, 812), { x: 0, y: 249.5, w: 375, h: 562.5 });
});

test('smoothHands fills gaps instead of jumping', () => {
  const raw = [{ l: [0.4, 0.5], r: [0.6, 0.5] }, { l: null, r: null }, { l: null, r: null }, { l: [0.5, 0.8], r: [0.7, 0.8] }];
  const s = smoothHands(raw, 1);
  assert.deepEqual(s.map(p => +p.x.toFixed(3)), [0.5, 0.533, 0.567, 0.6]);
  assert.ok(s.every(p => p !== null));
  assert.equal(+s[0].spread.toFixed(2), 0.2);
});

test('smoothHands handles one hand and all-missing input', () => {
  assert.deepEqual(smoothHands([{ l: null, r: [0.3, 0.3] }], 1), [{ x: 0.3, y: 0.3, spread: 0 }]);
  assert.deepEqual(smoothHands([{ l: null, r: null }, { l: null, r: null }]), [null, null]);
});

test('drawnFrame is the frame actually on screen, in desktop frame space', () => {
  const l = new Uint8Array(10); l[0] = 1; l[4] = 1;           // files loaded
  assert.equal(drawnFrame(9, l, 1), 4);                       // desktop: nearest loaded file
  assert.equal(drawnFrame(17, l, 2), 8);                      // mobile: file 4 = desktop frame 8
  assert.equal(drawnFrame(3, new Uint8Array(10), 1), -1);     // nothing loaded yet
});
