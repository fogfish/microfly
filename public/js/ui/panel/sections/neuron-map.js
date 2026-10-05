// Brain activity section: a three.js point cloud of the selected brain. A neuron brightens on a spike and
// fades over about a second (brain/activity.js). The section redraws on each tick, and runs its own
// animation frames only while some neuron is still fading (panel-sections.md, Neuron map). Browser only.

import { createPointCloud } from '../../../viz/point-cloud.js';
import { WINDOW_TICKS } from '../counts.js';

const BASE_COLOUR = [0.55, 0.8, 1];
// Per box element: the current mount (one point cloud for the fly it was built for).
const mounts = new WeakMap();

export const neuronMapSection = {
  id: 'neuron-map',
  title: 'Brain activity',
  requires: { signal: 'spikes' },
  unmet: 'This brain exposes no spike signal',
  render(body, model) {
    const mount = mountFor(body, model);
    mount.counts.textContent = `${model.neuronCount} neurons, ${model.activeCount} active in the last ${WINDOW_TICKS} ticks`;
    mount.cloud.resize();
    const now = performance.now();
    mount.cloud.update(model.activity.brightness(now, mount.buffer));
    if (model.activity.isFading(now)) startLoop(body, mount, model.activity);
  },
};

// Builds the point cloud for this fly, or keeps the one already there. A new fly replaces it.
function mountFor(body, model) {
  const current = mounts.get(body);
  if (current && current.flyId === model.flyId && body.contains(current.canvas)) return current;
  if (current) disposeMount(current);

  const canvas = document.createElement('canvas');
  canvas.className = 'neuron-canvas';
  const counts = document.createElement('p');
  counts.className = 'neuron-counts';
  body.replaceChildren(canvas, counts);

  const cloud = createPointCloud(canvas);
  cloud.setPoints(model.positions, BASE_COLOUR);
  const mount = {
    flyId: model.flyId, canvas, counts, cloud, buffer: new Float32Array(model.neuronCount), loop: 0,
  };
  mounts.set(body, mount);
  return mount;
}

// Redraws each frame until no neuron is fading. The next spike restarts it through render.
function startLoop(body, mount, activity) {
  if (mount.loop) return;
  const frame = () => {
    if (mounts.get(body) !== mount || !body.contains(mount.canvas)) {
      mount.loop = 0;
      return;
    }
    const now = performance.now();
    mount.cloud.update(activity.brightness(now, mount.buffer));
    mount.loop = activity.isFading(now) ? requestAnimationFrame(frame) : 0;
  };
  mount.loop = requestAnimationFrame(frame);
}

function disposeMount(mount) {
  cancelAnimationFrame(mount.loop);
  mount.loop = 0;
  mount.cloud.dispose();
}
