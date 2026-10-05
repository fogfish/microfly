// Section registry: requirements, error isolation (panel-sections.md, Registry rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSection, selectSections, unmetSections } from '../public/js/ui/panel/registry.js';

const section = (id, requires, render = () => {}, extra = {}) => ({ id, title: id, requires, render, ...extra });
const withSignals = (signals) => ({ signals, channels: { inputs: [], outputs: [{ id: 'o', side: 'L' }] } });

test('a section that requires a signal is not selected when the declaration lacks it', () => {
  const map = section('neuron-map', { signal: 'spikes' });
  assert.deepEqual(selectSections([map], withSignals([])), []);
});

test('a section that requires a signal is selected when the declaration lists it', () => {
  const map = section('neuron-map', { signal: 'spikes' });
  assert.deepEqual(selectSections([map], withSignals(['spikes'])), [map]);
});

test('a channel section is selected only when the declaration has channels of that kind', () => {
  const inputs = section('channels-input', { channels: 'inputs' });
  const outputs = section('channels-output', { channels: 'outputs' });
  assert.deepEqual(selectSections([inputs, outputs], withSignals([])), [outputs]);
});

test('a section with no requirement is always selected, and the order is the registry order', () => {
  const action = section('action', {});
  const map = section('neuron-map', { signal: 'spikes' });
  const outputs = section('channels-output', { channels: 'outputs' });
  assert.deepEqual(selectSections([action, map, outputs], withSignals(['spikes'])).map((s) => s.id), ['action', 'neuron-map', 'channels-output']);
});

test('a section with a message for a missing requirement is reported as unmet', () => {
  const map = section('neuron-map', { signal: 'spikes' }, () => {}, { unmet: 'This brain exposes no spike signal' });
  assert.deepEqual(unmetSections([map], withSignals([])), [map]);
  assert.deepEqual(unmetSections([map], withSignals(['spikes'])), []);
});

test('a thrown error gives ok false with the title and the message, and the next section still runs', () => {
  const calls = [];
  const broken = section('broken', {}, () => {
    throw new Error('boom');
  }, { title: 'Brain activity' });
  const healthy = section('action', {}, () => calls.push('action'));

  const first = runSection(broken, {}, {});
  const second = runSection(healthy, {}, {});

  assert.deepEqual(first, { ok: false, error: 'Brain activity: boom' });
  assert.deepEqual(second, { ok: true });
  assert.deepEqual(calls, ['action']);
});

test('a section whose requirement names an unknown signal is not selected until the declaration lists it', () => {
  const membrane = section('membrane', { signal: 'membrane' });
  assert.deepEqual(selectSections([membrane], withSignals(['spikes'])), []);
  assert.deepEqual(selectSections([membrane], withSignals(['spikes', 'membrane'])), [membrane]);
});
