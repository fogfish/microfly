// Contract test (research.md R10): the existing generic panel sections already render an arbitrary channel
// count from the declaration, with zero new production code for this feature. A forager-wide (twelve-input/
// six-output) capabilities declaration renders its L/R pairs on one row each: six input rows and five output
// rows (the turn pair shares one), including a non-zero escape row; a four-input/five-output (11K) declaration
// renders two input rows and four output rows, no escape (BUG-001 pairing, panel-sections.md Channel rows).
//
// public/js/ui/panel/channels.js (mountChannelRows/updateChannelRows) reads and writes the DOM, which Node has
// no built-in implementation of; this file stubs the small subset of the DOM API that module actually calls
// (createElement, append, replaceChildren, children, querySelector(All) by class, dataset, style, textContent)
// rather than adding a DOM library dependency (constitution I: no new dependency).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusModel } from '../public/js/ui/panel/model.js';

// Class selectors (".x") and the one attribute selector the channel rows use ('[data-part="k"]').
function selectorMatcher(selector) {
  const attr = /^\[data-(\w+)="(.*)"\]$/.exec(selector);
  if (attr) {
    const key = attr[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
    return (el) => el.dataset[key] === attr[2];
  }
  const cls = selector.replace(/^\./, '');
  return (el) => typeof el.className === 'string' && el.className.split(' ').includes(cls);
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    this.textContent = '';
    this.children = [];
    this.dataset = {};
    this.style = {};
  }

  append(...nodes) { this.children.push(...nodes); }

  replaceChildren(...nodes) { this.children = nodes; }

  querySelectorAll(selector) {
    const matches = selectorMatcher(selector);
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (matches(child)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

globalThis.document = { createElement: (tag) => new FakeElement(tag) };

const { mountChannelRows, updateChannelRows } = await import('../public/js/ui/panel/channels.js');

function pair(id, label, side, sense, site) {
  return { id, label, side, range: [0, 1], sense, site };
}

const WIDE_CAPABILITIES = {
  channels: {
    inputs: [
      pair('odour-food-left', 'Food odour left', 'L', 'odour:food', 'antenna'),
      pair('odour-food-right', 'Food odour right', 'R', 'odour:food', 'antenna'),
      pair('odour-danger-left', 'Danger odour left', 'L', 'odour:danger', 'antenna'),
      pair('odour-danger-right', 'Danger odour right', 'R', 'odour:danger', 'antenna'),
      pair('heat-left', 'Heat left', 'L', 'heat', 'antenna'),
      pair('heat-right', 'Heat right', 'R', 'heat', 'antenna'),
      pair('taste-mouth-left', 'Mouth taste left', 'L', 'taste', 'mouth'),
      pair('taste-mouth-right', 'Mouth taste right', 'R', 'taste', 'mouth'),
      pair('taste-leg-left', 'Leg taste left', 'L', 'taste', 'front-leg'),
      pair('taste-leg-right', 'Leg taste right', 'R', 'taste', 'front-leg'),
      pair('touch-left', 'Touch left', 'L', 'touch', 'front-leg'),
      pair('touch-right', 'Touch right', 'R', 'touch', 'front-leg'),
    ],
    outputs: [
      { id: 'turn-left', label: 'Turn left', side: 'L', range: [0, 1], drive: 'turnLeft' },
      { id: 'turn-right', label: 'Turn right', side: 'R', range: [0, 1], drive: 'turnRight' },
      { id: 'forward', label: 'Forward', side: 'both', range: [0, 1], drive: 'forward' },
      { id: 'backward', label: 'Backward', side: 'both', range: [0, 1], drive: 'backward' },
      { id: 'feed', label: 'Feed', side: 'both', range: [0, 1], drive: 'feed' },
      { id: 'escape', label: 'Escape', side: 'both', range: [0, 1], drive: 'escape' },
    ],
  },
};

const ELEVEN_K_CAPABILITIES = {
  channels: {
    inputs: [
      { id: 'odour-left', label: 'Odour left', side: 'L', range: [0, 1] },
      { id: 'odour-right', label: 'Odour right', side: 'R', range: [0, 1] },
      { id: 'taste-left', label: 'Taste left', side: 'L', range: [0, 1] },
      { id: 'taste-right', label: 'Taste right', side: 'R', range: [0, 1] },
    ],
    outputs: [
      { id: 'turn-left', label: 'Turn left', side: 'L', range: [0, 1], drive: 'turnLeft' },
      { id: 'turn-right', label: 'Turn right', side: 'R', range: [0, 1], drive: 'turnRight' },
      { id: 'forward', label: 'Forward', side: 'both', range: [0, 1], drive: 'forward' },
      { id: 'backward', label: 'Backward', side: 'both', range: [0, 1], drive: 'backward' },
      { id: 'feed', label: 'Feed', side: 'both', range: [0, 1], drive: 'feed' },
    ],
  },
};

function record(capabilities, entry) {
  return {
    state: { id: 0 },
    brainLabel: 'test',
    capabilities,
    neuronCount: 0,
    activity: null,
    positions: null,
    history: entry ? [entry] : [],
  };
}

test('a forager-wide fixture renders six input rows and five output rows, including a non-zero escape row', () => {
  const inputs = Float32Array.from({ length: 12 }, (_, i) => (i + 1) / 20);
  const outputs = Float32Array.of(0.1, 0.2, 0.3, 0.4, 0.5, 0.63); // escape (last) is non-zero
  const entry = { tick: 1, inputs, outputs, spikes: new Uint32Array(0), hunger: 0.4, energy: 0.3, eating: false, drives: {} };
  const model = buildStatusModel(record(WIDE_CAPABILITIES, entry), 0);
  assert.equal(model.inputs.length, 12);
  assert.equal(model.outputs.length, 6);

  const inputContainer = document.createElement('div');
  mountChannelRows(inputContainer, model.inputs);
  assert.equal(inputContainer.children.length, 6);
  assert.equal(inputContainer.children[0].querySelector('.channel-label').textContent, 'Food odour');
  assert.equal(inputContainer.children[0].querySelector('.value-L').textContent, '0.05');
  assert.equal(inputContainer.children[0].querySelector('.value-R').textContent, '0.10');

  const outputContainer = document.createElement('div');
  mountChannelRows(outputContainer, model.outputs);
  assert.equal(outputContainer.children.length, 5);
  assert.equal(outputContainer.children[0].querySelector('.channel-label').textContent, 'Turn');
  const escapeRow = outputContainer.children[4];
  assert.equal(escapeRow.querySelector('.channel-label').textContent, 'Escape');
  assert.equal(escapeRow.querySelector('.value-R').textContent, '0.63');
  assert.equal(escapeRow.querySelector('.value-L').textContent, '');

  // updateChannelRows writes in place (BUG-002): no new element, and the value text changes.
  const updatedOutputs = Float32Array.of(0.1, 0.2, 0.3, 0.4, 0.5, 0.91);
  const updatedEntry = { ...entry, outputs: updatedOutputs };
  const updatedModel = buildStatusModel(record(WIDE_CAPABILITIES, updatedEntry), 0);
  updateChannelRows(outputContainer, updatedModel.outputs);
  assert.equal(outputContainer.children.length, 5, 'no new row is built on update');
  assert.equal(outputContainer.children[4].querySelector('.value-R').textContent, '0.91');
});

test('a four-input/five-output (11K) fixture still renders exactly two input and four output rows, no escape (regression guard)', () => {
  const entry = {
    tick: 1, inputs: Float32Array.of(0.2, 0.3, 0.4, 0.5), outputs: Float32Array.of(0.1, 0.2, 0.3, 0.4, 0.5),
    spikes: new Uint32Array(0), hunger: 0.4, energy: 0.3, eating: false, drives: {},
  };
  const model = buildStatusModel(record(ELEVEN_K_CAPABILITIES, entry), 0);
  assert.equal(model.inputs.length, 4);
  assert.equal(model.outputs.length, 5);

  const inputContainer = document.createElement('div');
  mountChannelRows(inputContainer, model.inputs);
  assert.equal(inputContainer.children.length, 2);

  const outputContainer = document.createElement('div');
  mountChannelRows(outputContainer, model.outputs);
  assert.equal(outputContainer.children.length, 4);
  assert.ok(!model.outputs.some((row) => row.channel.id === 'escape'), 'no escape row for this declaration');
});
