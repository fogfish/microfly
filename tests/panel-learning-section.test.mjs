// Learning section (ADR 011, Phase 8; contracts/worker-protocol-v3-learning.md, world-config-v3-learning.md):
// per-food-pair learned gain next to the declared valence, dopamine drive and mean synapse weight per MBON
// group, "learning off" when plasticity is off (motor.learning absent, not zero), and an "injected" tag per
// world-event-driven reinforcement channel. Minimal DOM stub, the same approach as
// tests/panel-decoder-section.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSections, unmetSections } from '../public/js/ui/panel/registry.js';
import { learningSection } from '../public/js/ui/panel/sections/learning.js';

class FakeElement {
  constructor(tag) { this.tagName = tag; this.className = ''; this.textContent = ''; this.hidden = false; this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener() {}
}
globalThis.document = { createElement: (tag) => new FakeElement(tag) };

function model(overrides = {}) {
  return {
    learning: [0.02, 0.01, 0.78, 0.93], // dReward, dPunish, wmodApproach, wmodAvoid
    decoded: {
      senses: {
        'odour-food-a': { valence: 'approach', learnedGain: 1.3 },
        'odour-food-b': { valence: 'approach', learnedGain: 0.72 },
        'odour-danger': { valence: 'avoid' }, // not a food pair: no learnedGain
      },
      named: {},
    },
    injectedSenses: [
      { sense: 'reinforcement:reward', events: ['eat'] },
      { sense: 'reinforcement:punish', events: ['escape', 'heatContact', 'eat:floral'] },
    ],
    ...overrides,
  };
}

test('the learning section mounts only when the "decoder" signal is present', () => {
  const noSignal = { signals: ['spikes'], channels: { inputs: [], outputs: [] } };
  const withSignal = { signals: ['spikes', 'decoder'], channels: { inputs: [], outputs: [] } };
  assert.deepEqual(selectSections([learningSection], noSignal), []);
  assert.deepEqual(selectSections([learningSection], withSignal), [learningSection]);
  assert.deepEqual(unmetSections([learningSection], noSignal), []);
});

test('shows "learning off" when plasticity is off (learning is null, not zero numbers)', () => {
  const body = document.createElement('div');
  learningSection.mount(body, model({ learning: null }));
  const [learningRows] = body.children;
  assert.equal(learningRows.children.length, 1);
  assert.equal(learningRows.children[0].textContent, 'learning off');
});

test('shows dopamine drive, mean synapse weight, and learned gain per declared valence for every food pair', () => {
  const body = document.createElement('div');
  learningSection.mount(body, model());
  const [learningRows] = body.children;
  const text = learningRows.children.map((r) => r.textContent).join('\n');
  assert.match(text, /reward 0\.02/);
  assert.match(text, /punish 0\.01/);
  assert.match(text, /approach 0\.78/);
  assert.match(text, /avoid 0\.93/);
  assert.match(text, /odour-food-a: approach × 1\.30, learned/);
  assert.match(text, /odour-food-b: approach × 0\.72, learned/);
  assert.equal(text.includes('odour-danger'), false, 'only food pairs get a learned-gain row');
});

test('an "injected" tag is shown for every world-event-driven reinforcement channel', () => {
  const body = document.createElement('div');
  learningSection.mount(body, model());
  const [, , injected] = body.children;
  const text = injected.children.map((r) => r.textContent).join('\n');
  assert.match(text, /reinforcement:reward: injected on eat/);
  assert.match(text, /reinforcement:punish: injected on escape, heatContact, eat:floral/);
});

test('with no injected channels, says so plainly', () => {
  const body = document.createElement('div');
  learningSection.mount(body, model({ injectedSenses: [] }));
  const [, , injected] = body.children;
  assert.match(injected.children[0].textContent, /no injected channels/i);
});

test('update() re-renders every tick, reflecting the latest learning values', () => {
  const body = document.createElement('div');
  const m = model();
  const { update } = learningSection.mount(body, m);
  update({ ...m, learning: [0.5, 0.4, 0.1, 0.2] });
  const [learningRows] = body.children;
  assert.match(learningRows.children[0].textContent, /reward 0\.50/);
});
