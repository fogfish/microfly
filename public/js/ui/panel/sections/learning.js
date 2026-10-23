// Learning section (ADR 011, Phase 8; contracts/worker-protocol-v3-learning.md, world-config-v3-learning.md).
// Mounted only for a "v3" fly (the 'decoder' signal, same gate as the decoder section). Shows, per food pair,
// the declared valence next to its learned gain (decoder.js's ℓ_p); the dopamine drive and mean synapse
// modifier per MBON group (the worker's motor.learning); and an "injected" tag on every reinforcement channel
// this world drives from a world event rather than the connectome carrying it. With plasticity off, shows
// "learning off" instead of numbers that look learned (motor.learning is absent, not zero, in that case).
// Each number has a bar, and the gain and synapse modifier have a sparkline of recent samples (viz.js). The
// marker on a gain or modifier bar is 1.0, which means unchanged.
import { setText, textEl } from '../dom.js';
import { buildBar, buildSparkline, pushSample } from '../viz.js';

const DECIMALS = 2;
const fmt = (v) => (v === undefined || v === null ? 'n/a' : v.toFixed(DECIMALS));

// The learned gain is clamped to [0.5, 1.5] by decoder.js; 1.0 leaves the declared valence unchanged.
const GAIN_LO = 0.5;
const GAIN_HI = 1.5;
const GAIN_BASELINE = 1;
// The synapse modifier lies in [wMin, 1]; 1 means the connectome weight, unchanged.
const WMOD_LO = 0;
const WMOD_HI = 1;
// The dopamine scale never shrinks below this, so small reinforcement is still visible.
const DOPAMINE_FLOOR = 0.1;

// Food pairs are the only ones decoder.js computes a learned gain for (isFoodPair: starts with "odour-food").
function foodPairs(decoded) {
  if (!decoded) return [];
  return Object.keys(decoded.senses)
    .filter((pair) => pair.startsWith('odour-food'))
    .sort();
}

function renderInjected(container, injectedSenses) {
  container.replaceChildren();
  if (!injectedSenses || injectedSenses.length === 0) {
    container.appendChild(textEl('p', 'No injected channels — every declared sense is connectome-carried.'));
    return;
  }
  for (const { sense, events } of injectedSenses) {
    const row = textEl('p', `${sense}: injected on ${events.join(', ')}`);
    row.className = 'learning-injected-row';
    container.appendChild(row);
  }
}

// A text line, followed by its bars and sparkline in a sibling block. The text stays a direct child, so the
// line reads the same to a screen reader and to the tests.
function appendLine(container, text, viz) {
  container.appendChild(textEl('p', text));
  const stack = document.createElement('div');
  stack.className = 'viz-stack';
  for (const el of viz) stack.appendChild(el);
  container.appendChild(stack);
}

function labelled(label, el) {
  const row = document.createElement('div');
  row.className = 'viz-row';
  row.appendChild(textEl('span', label));
  row.appendChild(el);
  return row;
}

function renderLearning(container, learning, decoded, histories) {
  container.replaceChildren();
  if (learning === undefined) return;
  if (learning === null) {
    container.appendChild(textEl('p', 'learning off'));
    return;
  }
  const [dReward, dPunish, wmodApproach, wmodAvoid] = learning;

  // Dopamine: one scale for both channels, sized to the larger value seen so far.
  const dopScale = Math.max(DOPAMINE_FLOOR, ...histories.reward, ...histories.punish);
  appendLine(
    container,
    `dopamine: reward ${fmt(dReward)} · punish ${fmt(dPunish)}`,
    [
      labelled('reward', buildBar({ value: dReward, lo: 0, hi: dopScale, fillClass: 'viz-fill-reward', label: `reward ${fmt(dReward)}` })),
      labelled('punish', buildBar({ value: dPunish, lo: 0, hi: dopScale, fillClass: 'viz-fill-punish', label: `punish ${fmt(dPunish)}` })),
    ],
  );

  // Mean synapse modifier per MBON group: how far the learning has weakened each group's connections.
  appendLine(
    container,
    `mean synapse weight: approach ${fmt(wmodApproach)} · avoid ${fmt(wmodAvoid)}`,
    [
      labelled('approach', buildBar({
        value: wmodApproach, lo: WMOD_LO, hi: WMOD_HI, marker: WMOD_HI, fillClass: 'viz-fill-wmod', label: `approach ${fmt(wmodApproach)}`,
      })),
      labelled('avoid', buildBar({
        value: wmodAvoid, lo: WMOD_LO, hi: WMOD_HI, marker: WMOD_HI, fillClass: 'viz-fill-wmod', label: `avoid ${fmt(wmodAvoid)}`,
      })),
      labelled('history', buildSparkline(histories.wmodApproach, {
        lo: WMOD_LO, hi: WMOD_HI, baseline: WMOD_HI, label: 'approach synapse weight history',
      })),
    ],
  );

  // Learned gain per food pair, next to its declared valence.
  for (const pair of foodPairs(decoded)) {
    const sense = decoded.senses[pair];
    const gain = sense.learnedGain;
    const text = `${pair}: ${sense.valence}${gain !== undefined ? ` × ${fmt(gain)}, learned` : ' (not learned)'}`;
    const history = histories.gain.get(pair) ?? [];
    appendLine(container, text, [
      labelled('gain', buildBar({
        value: gain, lo: GAIN_LO, hi: GAIN_HI, marker: GAIN_BASELINE, fillClass: 'viz-fill-gain', label: `${pair} gain ${fmt(gain)}`,
      })),
      labelled('history', buildSparkline(history, {
        lo: GAIN_LO, hi: GAIN_HI, baseline: GAIN_BASELINE, label: `${pair} gain history`,
      })),
    ]);
  }
}

export const learningSection = {
  id: 'learning',
  title: 'Learning',
  requires: { signal: 'decoder' },
  mount(body, model) {
    const learning = document.createElement('div');
    learning.className = 'learning-rows';
    const injectedLabel = textEl('p', 'Injected channels');
    injectedLabel.className = 'learning-label';
    const injected = document.createElement('div');
    injected.className = 'learning-injected';
    body.replaceChildren(learning, injectedLabel, injected);

    // Samples kept for this mount (one fly). Each update adds one sample per series that has a value.
    const histories = { reward: [], punish: [], wmodApproach: [], wmodAvoid: [], gain: new Map() };
    const update = (m) => {
      if (Array.isArray(m.learning)) {
        pushSample(histories.reward, m.learning[0]);
        pushSample(histories.punish, m.learning[1]);
        pushSample(histories.wmodApproach, m.learning[2]);
        pushSample(histories.wmodAvoid, m.learning[3]);
      }
      for (const pair of foodPairs(m.decoded)) {
        if (!histories.gain.has(pair)) histories.gain.set(pair, []);
        pushSample(histories.gain.get(pair), m.decoded.senses[pair].learnedGain);
      }
      renderLearning(learning, m.learning, m.decoded, histories);
      renderInjected(injected, m.injectedSenses);
    };
    update(model);
    return { update };
  },
};
