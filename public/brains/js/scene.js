// three.js scene for the brain inspector. Neurons are points, body edges are one LineSegments
// object, and group mode draws one sphere per group with one curve per group pair. Imports only
// three and its vendored OrbitControls; nothing from inspector/.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { sceneTransform, toScene } from './model.js';

const BACKGROUND = '#0e1016';
const DEFAULT_POSITION = [260, 170, 260];
const MIN_ALPHA = 0.15;
const ALPHA_SPAN = 0.8;
const POINT_SIZE = 6;   // px. The reference uses 1 for ~100k points; a brain has ~10 to 1,000 neurons.
const CURVE_LIFT = 0.22;
const CURVE_SEGMENTS = 28;
const RANK_SEED = 12345;

// A seeded PRNG (mulberry32 style): a stable rank per neuron, so a lower density keeps a stable subset.
function seededRanks(n) {
  const out = new Float32Array(n);
  let s = RANK_SEED;
  for (let i = 0; i < n; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return out;
}

function labelSprite(text, colour) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 36px -apple-system, system-ui, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 16;
  canvas.width = width;
  canvas.height = 52;
  ctx.font = font;
  ctx.fillStyle = 'rgba(14,16,22,0.75)';
  ctx.fillRect(0, 0, width, 52);
  ctx.fillStyle = colour;
  ctx.fillText(text, 8, 38);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const k = 0.12;
  sprite.scale.set(width * k, 52 * k, 1);
  return sprite;
}

// Quadratic curve between two scene points, lifted in y (reference curvePoints).
function curvePoints(a, b) {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.y += a.distanceTo(b) * CURVE_LIFT;
  return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(CURVE_SEGMENTS);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
  camera.position.set(...DEFAULT_POSITION);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.6;

  const content = new THREE.Group();
  scene.add(content);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 3;

  // Per brain: the transform, the drawable neurons and their dataset somas, scene position per neuron.
  let transform = null;
  let drawable = [];           // drawable index → neuron index
  let somas = [];              // drawable index → dataset position
  let scenePos = [];           // neuron index → scene position
  let ranks = new Float32Array(0);
  let pointStyle = null;       // { colours, visible, density } from setPoints
  let points = null;
  let pointNeuron = [];        // point index → neuron index
  let edgeLines = null;
  let groupObjects = [];       // spheres, labels and links of the group graph
  let groupSpheres = [];       // { mesh, name }
  let groupPos = new Map();    // group name → scene position
  let frame = 0;

  const fit = () => {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  function release(object) {
    if (!object) return;
    content.remove(object);
    object.geometry?.dispose();
    object.material?.dispose();
  }

  function clearGroupGraph() {
    for (const object of groupObjects) {
      content.remove(object);
      object.geometry?.dispose();
      if (object.material) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    }
    groupObjects = [];
    groupSpheres = [];
    groupPos = new Map();
  }

  // The neurons as points, from the current colours, visibility and density. Returns the count kept.
  function rebuildPoints() {
    release(points);
    points = null;
    pointNeuron = [];
    if (!transform || !pointStyle) return 0;

    const { colours, visible, density } = pointStyle;
    const kept = [];
    for (let k = 0; k < drawable.length; k++) {
      if (visible[k] && colours[k] && ranks[k] < density) kept.push(k);
    }
    const pos = new Float32Array(kept.length * 3);
    const col = new Float32Array(kept.length * 3);
    kept.forEach((k, p) => {
      pos.set(scenePos[drawable[k]], 3 * p);
      const c = new THREE.Color(colours[k]);
      col.set([c.r, c.g, c.b], 3 * p);
      pointNeuron[p] = drawable[k];
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: POINT_SIZE, sizeAttenuation: false, vertexColors: true,
    }));
    content.add(points);
    return kept.length;
  }

  // Sets the brain: its transform from the drawable positions, and every drawable neuron as a point.
  // Replaces the previous brain, including its edges and group graph.
  function setBrain(snapshot, drawableIndices) {
    release(edgeLines);
    edgeLines = null;
    clearGroupGraph();

    const neurons = snapshot.manifest.neurons;
    drawable = drawableIndices.slice();
    somas = drawable.map((i) => neurons[i].soma);
    transform = sceneTransform(somas);
    scenePos = new Array(snapshot.neuronCount);
    drawable.forEach((i, k) => {
      scenePos[i] = toScene(somas[k], transform);
    });
    ranks = seededRanks(drawable.length);
    pointStyle = {
      colours: drawable.map(() => '#ffffff'),
      visible: new Uint8Array(drawable.length).fill(1),
      density: 1,
    };
    rebuildPoints();
  }

  // Per drawable neuron: colours (hex), visible (0 or 1), density (0 to 1). Returns the points drawn.
  function setPoints({ colours, visible, density }) {
    pointStyle = { colours, visible, density };
    return rebuildPoints();
  }

  // Body edges from {source, target, synapses, colours} with neuron indices and a hex colour per edge.
  // One material cannot vary opacity per segment, so each colour is blended toward the background by
  // the reference's formula 0.15 + 0.8 · log10(s+1) / log10(max+1).
  function setEdges({ source, target, synapses, colours }) {
    release(edgeLines);
    edgeLines = null;
    const count = source.length;
    if (count === 0 || !transform) return;

    let max = 1;
    for (let k = 0; k < count; k++) max = Math.max(max, synapses[k]);
    const bg = new THREE.Color(BACKGROUND);
    const line = new Float32Array(count * 6);
    const colour = new Float32Array(count * 6);
    for (let k = 0; k < count; k++) {
      line.set([...scenePos[source[k]], ...scenePos[target[k]]], 6 * k);
      const alpha = MIN_ALPHA + ALPHA_SPAN * Math.log10(synapses[k] + 1) / Math.log10(max + 1);
      const c = bg.clone().lerp(new THREE.Color(colours[k]), Math.min(alpha, 1));
      colour.set([c.r, c.g, c.b, c.r, c.g, c.b], 6 * k);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(line, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    edgeLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
    content.add(edgeLines);
  }

  // Group graph: nodes [{ name, centroid (dataset coordinates), count, colour, label }] and links
  // [{ source, target, colour, opacity }] between node names. Pass null to remove it.
  function setGroupGraph(graph) {
    clearGroupGraph();
    if (!graph || !transform) return;

    const maxCount = Math.max(1, ...graph.nodes.map((node) => node.count));
    for (const node of graph.nodes) {
      const at = new THREE.Vector3(...toScene(node.centroid, transform));
      groupPos.set(node.name, at);
      const radius = 2 + 5 * Math.log10(node.count + 1) / Math.log10(maxCount + 1);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 18, 14),
        new THREE.MeshBasicMaterial({ color: node.colour }),
      );
      mesh.position.copy(at);
      content.add(mesh);
      groupObjects.push(mesh);
      groupSpheres.push({ mesh, name: node.name });
      if (node.label) {
        const label = labelSprite(node.name, node.colour);
        label.position.copy(at).add(new THREE.Vector3(0, radius + 4, 0));
        content.add(label);
        groupObjects.push(label);
      }
    }
    for (const link of graph.links) {
      const a = groupPos.get(link.source);
      const b = groupPos.get(link.target);
      if (!a || !b) continue;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curvePoints(a, b)),
        new THREE.LineBasicMaterial({ color: link.colour, transparent: true, opacity: link.opacity, depthWrite: false }),
      );
      content.add(line);
      groupObjects.push(line);
    }
  }

  // Removes the brain from the view; used when a brain fails to load so no old view stays up.
  function clear() {
    release(points);
    points = null;
    pointNeuron = [];
    release(edgeLines);
    edgeLines = null;
    clearGroupGraph();
    transform = null;
    drawable = [];
    somas = [];
    scenePos = [];
    pointStyle = null;
  }

  function setPointsVisible(visible) {
    if (points) points.visible = visible;
  }

  function setEdgesVisible(visible) {
    if (edgeLines) edgeLines.visible = visible;
  }

  function setAutoRotate(on) {
    controls.autoRotate = on;
  }

  function resetView() {
    camera.position.set(...DEFAULT_POSITION);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  // What is under the pointer: { type: 'group', name } for a group sphere, { type: 'neuron', index }
  // for a point, or null. Group spheres take precedence over points.
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const sphere = raycaster.intersectObjects(groupSpheres.map((s) => s.mesh), false)[0];
    if (sphere) {
      const hit = groupSpheres.find((s) => s.mesh === sphere.object);
      return { type: 'group', name: hit.name };
    }
    if (points) {
      const hit = raycaster.intersectObject(points, false)[0];
      if (hit) return { type: 'neuron', index: pointNeuron[hit.index] };
    }
    return null;
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', fit);
    clear();
    controls.dispose();
    renderer.dispose();
  }

  window.addEventListener('resize', fit);
  fit();
  animate();

  return {
    setBrain,
    setPoints,
    setEdges,
    setGroupGraph,
    clear,
    setPointsVisible,
    setEdgesVisible,
    setAutoRotate,
    resetView,
    pick,
    dispose,
  };
}
