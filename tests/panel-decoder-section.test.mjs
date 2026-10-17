// Decoder section (D31, ADR 010 Part E/K): renders side/drive/trend/valence/pool-size per declared sense,
// labelled as a decoded readout, updates every tick, and shows "absent" rather than 0 for a sense with no side
// pool. Minimal DOM stub (the same approach as tests/panel-provenance-signals.test.mjs): decoder.js's mount only
// calls createElement/replaceChildren/appendChild and dom.js's setText/textEl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSections, unmetSections } from '../public/js/ui/panel/registry.js';
import { decoderSection } from '../public/js/ui/panel/sections/decoder.js';

class FakeElement {
  constructor(tag) { this.tagName = tag; this.className = ''; this.textContent = ''; this.hidden = false; this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener() {}
}
globalThis.document = { createElement: (tag) => new FakeElement(tag) };

const POOLS = {
  'drive.odour-food': [1, 2, 3], 'side.odour-food.L': [1, 2], 'side.odour-food.R': [3],
  'drive.odour-danger': [4],
};

function model(overrides = {}) {
  return {
    decoded: {
      senses: {
        'odour-food': { side: 0.5, drive: 0.8, trend: 0.1, valence: 'approach' },
        'odour-danger': { side: undefined, drive: 0.2, trend: 0, valence: 'avoid' },
      },
      named: {},
    },
    decoderPools: POOLS,
    ...overrides,
  };
}

test('the decoder section mounts only when the "decoder" signal is present', () => {
  const noSignal = { signals: ['spikes'], channels: { inputs: [], outputs: [] } };
  const withSignal = { signals: ['spikes', 'decoder'], channels: { inputs: [], outputs: [] } };
  assert.deepEqual(selectSections([decoderSection], noSignal), []);
  assert.deepEqual(selectSections([decoderSection], withSignal), [decoderSection]);
  assert.deepEqual(unmetSections([decoderSection], noSignal), []);
});

test('renders side, drive, trend, valence and pool size for every declared sense, labelled as decoded', () => {
  const body = document.createElement('div');
  const { } = decoderSection.mount(body, model());
  const [label, rows] = body.children;
  assert.match(label.textContent, /decoded readout/i);

  const danger = rows.children.find((r) => r.children[0].textContent === 'odour-danger');
  const food = rows.children.find((r) => r.children[0].textContent === 'odour-food');
  assert.ok(food, 'odour-food row must be rendered');
  assert.ok(danger, 'odour-danger row must be rendered');

  const foodText = food.children[1].textContent;
  assert.match(foodText, /side 0\.50/);
  assert.match(foodText, /drive 0\.80/);
  assert.match(foodText, /trend 0\.10/);
  assert.match(foodText, /approach/);
  assert.match(foodText, /pool 6/); // drive.odour-food (3) + side.L (2) + side.R (1)
});

test('a sense with no side pool shows "absent", not a fabricated 0', () => {
  const body = document.createElement('div');
  decoderSection.mount(body, model());
  const [, rows] = body.children;
  const danger = rows.children.find((r) => r.children[0].textContent === 'odour-danger');
  assert.match(danger.children[1].textContent, /side absent/);
});

test('update() re-renders every tick, reflecting the latest decoded values', () => {
  const body = document.createElement('div');
  const m = model();
  const { update } = decoderSection.mount(body, m);
  update({
    ...m,
    decoded: { senses: { ...m.decoded.senses, 'odour-food': { ...m.decoded.senses['odour-food'], drive: 0.95 } }, named: {} },
  });
  const [, rows] = body.children;
  const food = rows.children.find((r) => r.children[0].textContent === 'odour-food');
  assert.match(food.children[1].textContent, /drive 0\.95/);
});
