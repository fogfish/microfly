// Point cloud of one brain with three.js (browser only). One Points object; each neuron's colour is the base
// colour times its brightness, written to a colour attribute. Orbit controls come from the vendored
// OrbitControls. The background matches the brain inspector, so the two views look alike.
import * as THREE from 'three';
import { OrbitControls } from '../../brains/vendor/three/OrbitControls.js';

const BACKGROUND = 0x0e1016;
const POINT_SIZE = 0.07;
const DISTANCE = 4.5;

export function createPointCloud(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
  let base = [1, 1, 1];

  function draw() {
    renderer.render(scene, camera);
  }

  // positions: Float32Array of x, y, z per neuron. baseColour: [r, g, b] in 0..1.
  function setPoints(positions, baseColour) {
    clearPoints();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    colours = new THREE.BufferAttribute(new Float32Array(positions.length), 3);
    geometry.setAttribute('color', colours);
    material = new THREE.PointsMaterial({ size: POINT_SIZE, vertexColors: true, sizeAttenuation: true });
    scene.add(new THREE.Points(geometry, material));
    base = baseColour;
    draw();
  }

  // brightness: Float32Array, one value per neuron, from activity.brightness().
  function update(brightness) {
    if (!colours) return;
    const out = colours.array;
    for (let n = 0; n < brightness.length; n++) {
      const b = brightness[n];
      out[3 * n] = base[0] * b;
      out[3 * n + 1] = base[1] * b;
      out[3 * n + 2] = base[2] * b;
    }
    colours.needsUpdate = true;
    draw();
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
  }

  function dispose() {
    clearPoints();
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { setPoints, update, resize, dispose };
}
