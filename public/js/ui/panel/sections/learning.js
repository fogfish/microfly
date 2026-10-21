// Learning section (ADR 011, Phase 8; contracts/worker-protocol-v3-learning.md, world-config-v3-learning.md).
// Mounted only for a "v3" fly (the 'decoder' signal, same gate as the decoder section). Shows, per food pair,
// the declared valence next to its learned gain (decoder.js's ℓ_p); the dopamine drive and mean synapse
// modifier per MBON group (the worker's motor.learning); and an "injected" tag on every reinforcement channel
// this world drives from a world event rather than the connectome carrying it. With plasticity off, shows
// "learning off" instead of numbers that look learned (motor.learning is absent, not zero, in that case).
import { setText, textEl } from '../dom.js';

const DECIMALS = 2;
const fmt = (v) => (v === undefined || v === null ? 'n/a' : v.toFixed(DECIMALS));

// Food pairs are the only ones decoder.js computes a learned gain for (isFoodPair: starts with "odour-food").
function foodPairRows(decoded) {
  if (!decoded) return [];
  return Object.keys(decoded.senses)
    .filter((pair) => pair.startsWith('odour-food'))
    .sort()
    .map((pair) => {
      const sense = decoded.senses[pair];
      const gain = sense.learnedGain;
      return `${pair}: ${sense.valence}${gain !== undefined ? ` × ${fmt(gain)}, learned` : ' (not learned)'}`;
    });
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

function renderLearning(container, learning, decoded) {
  container.replaceChildren();
  if (learning === undefined) return;
  if (learning === null) {
    container.appendChild(textEl('p', 'learning off'));
    return;
  }
  const [dReward, dPunish, wmodApproach, wmodAvoid] = learning;
  container.appendChild(textEl('p', `dopamine: reward ${fmt(dReward)} · punish ${fmt(dPunish)}`));
  container.appendChild(textEl('p', `mean synapse weight: approach ${fmt(wmodApproach)} · avoid ${fmt(wmodAvoid)}`));
  for (const row of foodPairRows(decoded)) container.appendChild(textEl('p', row));
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

    const update = (m) => {
      renderLearning(learning, m.learning, m.decoded);
      renderInjected(injected, m.injectedSenses);
    };
    update(model);
    return { update };
  },
};
