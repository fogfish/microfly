// Point cloud of one brain with three.js (browser only). One Points object; each neuron's colour is the base
// colour times its brightness, written to a colour attribute. Orbit controls come from the vendored
// OrbitControls. The background matches the brain inspector, so the two views look alike.
import * as THREE from 'three';
import { OrbitControls } from '../../brains/vendor/three/OrbitControls.js';

const BACKGROUND = 0x0e1016;
const POINT_SIZE = 0.025;
const DISTANCE = 2.2;

// Point clouds whose WebGL context is alive (BUG-002, FR-020: at most one brain map). Safari allows few
// live contexts per page and drops the oldest, so a cloud that is never disposed blanks the next one.
let live = 0;

export function livePointClouds() {
  return live;
}

export function createPointCloud(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  live += 1;
  let disposed = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BACKGROUND, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera.position.set(0, 0, DISTANCE);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.addEventListener('change', draw);

  let geometry = null;
  let material = null;
  let colours = null;
  let base = new Float32Array([1, 1, 1]);
  let pointsObject = null;

  function draw() {
    renderer.render(scene, camera);
  }

  // A per-point base colour (specs/012-class-seeded-forager-brain contracts/panel-provenance-signals.md: seed
  // vs fill, independent of the spike-brightness envelope). baseColour is [r, g, b] (every point the same,
  // the pre-existing shape) or a Float32Array of r, g, b per point.
  function expandBase(baseColour, pointCount) {
    if (baseColour.length === pointCount * 3) return baseColour;
    const out = new Float32Array(pointCount * 3);
    for (let i = 0; i < pointCount; i++) {
      out[3 * i] = baseColour[0]; out[3 * i + 1] = baseColour[1]; out[3 * i + 2] = baseColour[2];
    }
    return out;
  }

  // positions: Float32Array of x, y, z per neuron. baseColour: see expandBase.
  function setPoints(positions, baseColour) {
    clearPoints();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    colours = new THREE.BufferAttribute(new Float32Array(positions.length), 3);
    geometry.setAttribute('color', colours);
    material = new THREE.PointsMaterial({ size: POINT_SIZE, vertexColors: true, sizeAttenuation: true });
    pointsObject = new THREE.Points(geometry, material);
    pointsObject.rotation.x = Math.PI;
    scene.add(pointsObject);
    base = expandBase(baseColour, positions.length / 3);
    draw();
  }

  // brightness: Float32Array, one value per neuron, from activity.brightness().
  function update(brightness) {
    if (!colours) return;
    const out = colours.array;
    for (let n = 0; n < brightness.length; n++) {
      const b = brightness[n];
      out[3 * n] = base[3 * n] * b;
      out[3 * n + 1] = base[3 * n + 1] * b;
      out[3 * n + 2] = base[3 * n + 2] * b;
    }
    colours.needsUpdate = true;
    draw();
  }

  // The drawn-point index nearest (clientX, clientY) in canvas CSS pixels, or null. Used to show a neuron's
  // identity on click (panel-provenance-signals.md); rotation.x (set in setPoints) is applied automatically
  // since the raycaster intersects the actual Points object, not raw positions.
  function pick(clientX, clientY) {
    if (!pointsObject) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = POINT_SIZE * 2;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(pointsObject);
    return hits.length ? hits[0].index : null;
  }

  // Sizes the drawing buffer to the canvas box. The CSS sets the box, so only the buffer changes here.
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    if (renderer.domElement.width === Math.floor(width * renderer.getPixelRatio()) && camera.aspect === width / height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }

  function clearPoints() {
    if (!geometry) return;
    scene.clear();
    geometry.dispose();
    material.dispose();
    geometry = null;
    material = null;
    colours = null;
    pointsObject = null;
  }

  // Frees the WebGL context. A second call does nothing.
  function dispose() {
    if (disposed) return;
    disposed = true;
    live -= 1;
    clearPoints();
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { setPoints, update, resize, dispose, pick };
}
