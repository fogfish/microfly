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

// const BASE_COLOUR = [0.55, 0.8, 1];
// const BASE_COLOUR = [0.3, 0.9, 1];
const BASE_COLOUR = [0.1, 0.4, 1];
// Seed-vs-fill colour channel (specs/012-class-seeded-forager-brain contracts/panel-provenance-signals.md),
// independent of the spike-brightness envelope above: shown only when capabilities.signals has "origin".
const SEED_COLOUR = [0.95, 0.65, 0.15];
const FILL_COLOUR = [0.25, 0.85, 0.45];

// One base colour per drawn point: the uniform BASE_COLOUR unless the model carries per-neuron origin data.
function baseColoursFor(model) {
  if (!model.neurons || !model.capabilities.signals.includes('origin')) return BASE_COLOUR;
  const indices = model.drawn ?? Array.from({ length: model.neuronCount }, (_, i) => i);
  const out = new Float32Array(indices.length * 3);
  indices.forEach((neuronIndex, k) => {
    const origin = model.neurons[neuronIndex]?.origin ?? null;
    const colour = origin == null ? BASE_COLOUR : origin === 'fill' ? FILL_COLOUR : SEED_COLOUR;
    out[3 * k] = colour[0]; out[3 * k + 1] = colour[1]; out[3 * k + 2] = colour[2];
  });
  return out;
}

function identityLine(neuron) {
  if (!neuron) return '';
  const parts = [`body ${neuron.bodyId}`, neuron.type, neuron.class].filter(Boolean);
  if (neuron.transmitter) parts.push(`transmitter ${neuron.transmitter}`);
  return parts.join(' · ');
}


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
    const hasOrigin = model.capabilities.signals.includes('origin');
    const legend = document.createElement('ul');
    legend.className = 'neuron-legend';
    if (hasOrigin) {
      legend.innerHTML = '<li class="seed">Seed</li><li class="fill">Fill</li>';
    }
    const identity = document.createElement('p');
    identity.className = 'neuron-identity';
    body.replaceChildren(canvas, counts, ...(hasOrigin ? [legend, identity] : []));

    const cloud = createPointCloud(canvas);
    cloud.setPoints(model.positions, baseColoursFor(model));
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
    // Click-to-identify (panel-provenance-signals.md): a picked point's bodyId/type/class, plus transmitter
    // when the brain carries per-neuron origin data. Independent of the spike-brightness/colour channels above.
    const onClick = (event) => {
      const picked = cloud.pick(event.clientX, event.clientY);
      if (picked == null || !model.neurons) return;
      const neuronIndex = drawn ? drawn[picked] : picked;
      setText(identity, identityLine(model.neurons[neuronIndex]));
    };
    if (hasOrigin) canvas.addEventListener('click', onClick);

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
        if (hasOrigin) canvas.removeEventListener('click', onClick);
        cancelAnimationFrame(loop);
        loop = 0;
        cloud.dispose();
      },
    };
  },
};
