// Section registry: requirements, error isolation (panel-sections.md, Registry rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disposeSection, mountSection, selectSections, unmetSections, updateSection } from '../public/js/ui/panel/registry.js';

const section = (id, requires, mount = () => ({}), extra = {}) => ({ id, title: id, requires, mount, ...extra });
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

test('a thrown error in mount gives ok false with the title and the message, and the next section still mounts', () => {
  const calls = [];
  const broken = section('broken', {}, () => {
    throw new Error('boom');
  }, { title: 'Brain activity' });
  const healthy = section('action', {}, () => {
    calls.push('action');
    return {};
  });

  const first = mountSection(broken, {}, {});
  const second = mountSection(healthy, {}, {});

  assert.deepEqual(first, { ok: false, error: 'Brain activity: boom' });
  assert.equal(second.ok, true);
  assert.deepEqual(calls, ['action']);
});

test('an error in update gives ok false, and the next section still updates', () => {
  const calls = [];
  const broken = mountSection(section('broken', {}, () => ({
    update() {
      throw new Error('bad value');
    },
  }), { title: 'Inputs' }), {}, {}).mounted;
  const healthy = mountSection(section('action', {}, () => ({ update: (m) => calls.push(m.tick) })), {}, {}).mounted;

  assert.deepEqual(updateSection(broken, { tick: 1 }), { ok: false, error: 'Inputs: bad value' });
  assert.deepEqual(updateSection(healthy, { tick: 1 }), { ok: true });
  assert.deepEqual(calls, [1]);
});

test('dispose runs once per mount, even when called twice', () => {
  let disposed = 0;
  const { mounted } = mountSection(section('map', {}, () => ({ dispose: () => disposed++ })), {}, {});
  disposeSection(mounted);
  disposeSection(mounted);
  assert.equal(disposed, 1);
});

test('a section whose mount returns no handle is accepted, and update and dispose do nothing', () => {
  const { ok, mounted } = mountSection(section('plain', {}, () => undefined), {}, {});
  assert.equal(ok, true);
  assert.deepEqual(updateSection(mounted, {}), { ok: true });
  assert.deepEqual(disposeSection(mounted), { ok: true });
});

test('a section whose requirement names an unknown signal is not selected until the declaration lists it', () => {
  const membrane = section('membrane', { signal: 'membrane' });
  assert.deepEqual(selectSections([membrane], withSignals(['spikes'])), []);
  assert.deepEqual(selectSections([membrane], withSignals(['spikes', 'membrane'])), [membrane]);
});
