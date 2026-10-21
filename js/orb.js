// The glowing orb (Jose's second brain). One fixed, transparent three.js canvas in CSS-pixel space.
import * as THREE from 'three';
import { forceLayout } from './graph-layout.js';

const PALETTE = [0x60BCE7, 0xAAA4EF, 0x46EFE6, 0x566FC9].map(c => new THREE.Color(c));
const lerp = (a, b, t) => a + (b - a) * t;

const POINT_VERT = /* glsl */`
  attribute vec3 color; attribute float size;
  uniform float uPixel, uR, uAlpha;
  varying vec3 vColor; varying float vA;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float front = clamp((world.z / max(uR, 1.0) + 1.0) * 0.5, 0.0, 1.0);
    vColor = color; vA = uAlpha * (0.3 + 0.7 * front);
    gl_PointSize = size * uPixel * (0.7 + 0.6 * front);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const POINT_FRAG = /* glsl */`
  varying vec3 vColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d); a *= a;
    gl_FragColor = vec4(vColor, a * vA);
  }`;

function fibonacciSphere(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    out.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
  }
  return out;
}

function pointsMaterial(pixel) {
  return new THREE.ShaderMaterial({
    vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, uniforms: { uPixel: { value: pixel }, uR: { value: 1 }, uAlpha: { value: 1 } },
  });
}

function pointCloud(pos, sizes, pixel) {
  const g = new THREE.BufferGeometry(), n = pos.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) PALETTE[i % PALETTE.length].toArray(col, i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  return new THREE.Points(g, pointsMaterial(pixel));
}

function nearLinks(pos, maxD2) {
  const n = pos.length / 3, seg = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = pos[i * 3] - pos[j * 3], dy = pos[i * 3 + 1] - pos[j * 3 + 1], dz = pos[i * 3 + 2] - pos[j * 3 + 2];
    if (dx * dx + dy * dy + dz * dz < maxD2) seg.push(...pos.slice(i * 3, i * 3 + 3), ...pos.slice(j * 3, j * 3 + 3));
  }
  return new Float32Array(seg);
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(70,239,230,.9)'); grd.addColorStop(.25, 'rgba(96,188,231,.45)');
  grd.addColorStop(.6, 'rgba(86,111,201,.15)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function webglOk() {
  if (new URLSearchParams(location.search).has('nowebgl')) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function createOrb({ canvas, mobile, reducedMotion, graph } = {}) {
  if (!webglOk()) return null;
  canvas ??= Object.assign(document.createElement('canvas'), { id: 'orb-canvas' });
  if (!canvas.isConnected) document.body.appendChild(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch { canvas.remove(); return null; }
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  camera.position.z = 1000;
  const root = new THREE.Group(); scene.add(root);

  // decorative sphere
  const N = mobile ? 350 : 900, sphere = fibonacciSphere(N);
  const dust = pointCloud(sphere, new Float32Array(N).map((_, i) => (i % 29 === 0 ? 5 : 2.2)), dpr);
  const linkMat = new THREE.LineBasicMaterial({ color: 0x60BCE7, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
  const links = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(nearLinks(sphere, mobile ? 0.05 : 0.02), 3)), linkMat);
  const sphereGroup = new THREE.Group(); sphereGroup.add(dust, links); root.add(sphereGroup);

  // graph nodes: sit on the sphere, unfold into a flat layout in the 'graph' state
  let graphPts = null, graphLines = null, graphFrom = null, graphTo = null;
  const graphGroup = new THREE.Group(); root.add(graphGroup);
  if (graph) {
    const n = graph.nodes.length;
    graphFrom = fibonacciSphere(n);
    graphTo = new Float32Array(n * 3);
    forceLayout(graph).forEach(([x, y], i) => graphTo.set([x, y, 0], i * 3));
    graphPts = pointCloud(graphFrom.slice(), new Float32Array(n).fill(12), dpr);
    const col = graphPts.geometry.attributes.color;
    graph.nodes.forEach((nd, i) => PALETTE[nd.c % PALETTE.length].toArray(col.array, i * 3));
    graphLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(graph.edges.length * 6), 3)),
      new THREE.LineBasicMaterial({ color: 0xAAA4EF, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    graphGroup.add(graphPts, graphLines);
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  root.add(glow);

  // burst particles (pixel space, around the orb center)
  const B = mobile ? 120 : 260, bPos = new Float32Array(B * 3), bVel = new Float32Array(B * 3);
  const burstPts = pointCloud(bPos, new Float32Array(B).fill(2.6), dpr);
  scene.add(burstPts);
  let burstAge = 99;

  let W = 1, H = 1;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    Object.assign(camera, { left: 0, right: W, top: 0, bottom: -H }); camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  // named states -> {x, y, r, alpha, graph}
  const anchor = { x: 0, y: 0, r: 0 };
  const STATES = {
    hidden: () => ({ x: anchor.x, y: anchor.y, r: 0, alpha: 0, graph: 0 }),
    hands: () => ({ x: anchor.x, y: anchor.y, r: anchor.r, alpha: anchor.r > 0.5 ? 1 : 0, graph: 0 }),
    side: () => ({ x: W * (mobile ? 0.62 : 0.68), y: H * (mobile ? 0.74 : 0.47), r: Math.min(W, H) * (mobile ? 0.3 : 0.36), alpha: mobile ? 0.55 : 1, graph: 0 }),
    corner: () => ({ x: W * (mobile ? 0.88 : 0.94), y: H * (mobile ? 0.13 : 0.14), r: Math.min(W, H) * (mobile ? 0.06 : 0.045), alpha: 0.75, graph: 0 }),
    graph: () => ({ x: W * (mobile ? 0.5 : 0.66), y: H * (mobile ? 0.7 : 0.5), r: Math.min(W, H) * (mobile ? 0.34 : 0.36), alpha: 1, graph: 1 }),
    cta: () => ({ x: W * 0.5, y: H * 0.5, r: Math.min(W, H) * 0.3, alpha: 1.25, graph: 0 }),
  };
  let from = 'hidden', to = 'hidden', t = 1, settled = 'hidden';
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / W - 0.5; mouse.y = e.clientY / H - 0.5; });

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    const a = STATES[from](), b = STATES[to](), k = t;
    const s = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: lerp(a.r, b.r, k), alpha: lerp(a.alpha, b.alpha, k), graph: lerp(a.graph, b.graph, k) };
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    const visible = s.alpha > 0.01 && s.r > 0.5;
    root.visible = visible;
    root.position.set(s.x, -s.y, 0);
    const spin = reducedMotion ? 0.6 : time * 0.18;
    sphereGroup.rotation.set(0.35 + mouse.sy * 0.5, spin + mouse.sx * 0.8, 0);
    sphereGroup.scale.setScalar(s.r * (1 + s.graph * 0.7) * (1 + Math.sin(time * 1.2) * 0.015));
    dust.material.uniforms.uR.value = s.r * (1 + s.graph * 0.7);
    dust.material.uniforms.uAlpha.value = s.alpha * (1 - s.graph * 0.8);
    linkMat.opacity = 0.14 * s.alpha * (1 - s.graph);
    glow.scale.setScalar(s.r * 2.8);
    glow.material.opacity = Math.min(1, 0.6 * s.alpha * (1 - s.graph * 0.6) + (burstAge < 0.6 ? (0.6 - burstAge) : 0));

    if (graphPts) {
      graphGroup.rotation.set(lerp(0.35 + mouse.sy * 0.5, 0, s.graph), lerp(spin + mouse.sx * 0.8, 0, s.graph), 0);
      graphGroup.scale.setScalar(s.r);
      const pos = graphPts.geometry.attributes.position.array, ease = s.graph * s.graph * (3 - 2 * s.graph);
      for (let i = 0; i < pos.length; i++) pos[i] = lerp(graphFrom[i], graphTo[i], ease);
      graphPts.geometry.attributes.position.needsUpdate = true;
      const lp = graphLines.geometry.attributes.position.array;
      graph.edges.forEach(([e0, e1], i) => { lp.set(pos.subarray(e0 * 3, e0 * 3 + 3), i * 6); lp.set(pos.subarray(e1 * 3, e1 * 3 + 3), i * 6 + 3); });
      graphLines.geometry.attributes.position.needsUpdate = true;
      graphPts.material.uniforms.uR.value = s.r;
      graphPts.material.uniforms.uAlpha.value = s.alpha;
      graphLines.material.opacity = 0.12 + 0.3 * s.graph;
    }

    burstAge += dt;
    burstPts.visible = burstAge < 1.6;
    if (burstPts.visible) {
      for (let i = 0; i < B * 3; i++) bPos[i] += bVel[i] * dt;
      burstPts.position.set(s.x, -s.y, 0);
      burstPts.material.uniforms.uAlpha.value = Math.max(0, 1 - burstAge / 1.6);
      burstPts.material.uniforms.uR.value = 1e4;
      burstPts.geometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  frame();

  return {
    // from defaults to the last fully reached state, so a section can blend in from wherever the orb was
    setState(name, progress = 1, fromName = settled) {
      from = fromName; to = name; t = Math.min(1, Math.max(0, progress));
      if (t === 1) settled = name; else if (t === 0) settled = fromName;
    },
    setAnchor(x, y, size) { anchor.x = x; anchor.y = y; anchor.r = size / 2; },
    burst(strength = 1) {
      if (reducedMotion) return;
      burstAge = 0;
      for (let i = 0; i < B; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u), sp = (120 + Math.random() * 380) * strength;
        bPos.set([0, 0, 0], i * 3);
        bVel.set([Math.cos(th) * rr * sp, u * sp, Math.sin(th) * rr * sp], i * 3);
      }
    },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); canvas.remove(); },
  };
}
