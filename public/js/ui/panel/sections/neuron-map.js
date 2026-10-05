// Brain activity section: a three.js point cloud of the selected brain. A neuron brightens on a spike and
// fades over about a second (brain/activity.js). Browser only.
//
// Lifecycle (BUG-002, FR-020, panel-sections.md Neuron map): the point cloud is created once in mount and
// freed in dispose, so at most one WebGL context is alive. The animation loop is the only path that draws
// it. It runs while some neuron is fading and the canvas is visible, and stops while the Fly pane is
// hidden. A resize observer sizes the drawing buffer and redraws when the pane is shown again or the
// window is resized. update writes the counts and restarts the loop; it builds nothing.

import { createPointCloud, livePointClouds } from '../../../viz/point-cloud.js';
import { WINDOW_TICKS } from '../counts.js';
import { setText } from '../dom.js';

const BASE_COLOUR = [0.55, 0.8, 1];

export const neuronMapSection = {
  id: 'neuron-map',
  title: 'Brain activity',
  requires: { signal: 'spikes' },
  unmet: 'This brain exposes no spike signal',
  mount(body, model) {
    if (livePointClouds() > 0) {
      console.error(`Brain activity: ${livePointClouds()} point cloud(s) still alive before mounting fly ${model.flyId}`);
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'neuron-canvas';
    const counts = document.createElement('p');
    counts.className = 'neuron-counts';
    body.replaceChildren(canvas, counts);

    const cloud = createPointCloud(canvas);
    cloud.setPoints(model.positions, BASE_COLOUR);
    const buffer = new Float32Array(model.neuronCount);
    // One brightness per drawn point. A snapshot brain draws a subset of the neurons (FR-030), so the
    // per-neuron brightness is picked through model.drawn; with no list, every neuron is a point.
    const drawn = model.drawn;
    const pointBrightness = new Float32Array(model.coveredCount);
    const brightnessOfPoints = (all) => {
      if (!drawn) return all;
      for (let k = 0; k < drawn.length; k++) pointBrightness[k] = all[drawn[k]];
      return pointBrightness;
    };
    let activity = model.activity;
    let loop = 0;
    // True when the canvas shows an old frame (just mounted, resized or shown again).
    let stale = true;

    const visible = () => canvas.clientWidth > 0 && canvas.clientHeight > 0;

    const frame = () => {
      loop = 0;
      if (!visible()) {
        stale = true;
        return;
      }
      const now = performance.now();
      cloud.update(brightnessOfPoints(activity.brightness(now, buffer)));
      stale = false;
      if (activity.isFading(now)) loop = requestAnimationFrame(frame);
    };

    const start = () => {
      if (loop || !visible()) return;
      if (stale || activity.isFading(performance.now())) loop = requestAnimationFrame(frame);
    };

    const observer = new ResizeObserver(() => {
      if (!visible()) return;
      cloud.resize();
      stale = true;
      start();
    });
    observer.observe(canvas);

    const update = (m) => {
      activity = m.activity;
      const left = m.leftOut > 0 ? `${m.leftOut} without a soma position not drawn, ` : '';
      setText(counts, `${m.neuronCount} neurons, ${left}${m.activeCount} active in the last ${WINDOW_TICKS} ticks`);
      start();
    };
    update(model);

    return {
      update,
      dispose() {
        observer.disconnect();
        cancelAnimationFrame(loop);
        loop = 0;
        cloud.dispose();
      },
    };
  },
};
