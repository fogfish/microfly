// L12 plasticity rule tests on a labelled-synthetic fixture (contracts/lif-v1-plasticity.md, ADR 011). 3 KCs, 1
// approach MBON, 1 avoid MBON, 1 PAM (reward), 1 PPL1 (punish). Plus resolveParams rejections for the plasticity
// block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, resolveParams, step } from '../public/js/brain/lif-v1.js';

// 0,1,2 KCs; 3 approach MBON; 4 avoid MBON; 5 reward DAN (PAM); 6 punish DAN (PPL1).
const TOY = {
  neuronCount: 7,
  edges: [
    { pre: 0, post: 3, weight: 0.5 }, { pre: 0, post: 4, weight: 0.5 },
    { pre: 1, post: 3, weight: 0.4 }, { pre: 1, post: 4, weight: 0.4 },
    { pre: 2, post: 3, weight: 0.3 }, { pre: 2, post: 4, weight: 0.3 },
  ],
  learning: {
    kc: Uint32Array.from([0, 1, 2]),
    reward: Uint32Array.from([5]),
    punish: Uint32Array.from([6]),
    approach: Uint32Array.from([3]),
    avoid: Uint32Array.from([4]),
  },
};

function drive(net, { kc = 0, reward = 0, punish = 0 } = {}) {
  const external = new Float64Array(net.n);
  external[0] = kc; external[1] = kc; external[2] = kc;
  external[5] = reward;
  external[6] = punish;
  return external;
}

test('reward depresses only KC->avoid edges of KCs that spiked', () => {
  const net = createNetwork(TOY, { vThreshold: 0.5, plasticity: { tauElig: 5, etaReward: 1, threshold: 0 } }, 1);
  for (let t = 0; t < 300; t++) step(net, drive(net, { kc: 1, reward: 1 }));
  for (let j = 0; j < net.plastic.slot.length; j++) {
    if (net.plastic.slotGroup[j] === 0) assert.equal(net.plastic.wmod[j], 1, 'approach slot must not be touched by reward');
    else assert.ok(net.plastic.wmod[j] < 1, 'avoid slot of a spiking KC must be depressed by reward');
  }
});

test('punishment depresses only KC->approach edges', () => {
  const net = createNetwork(TOY, { vThreshold: 0.5, plasticity: { tauElig: 5, etaPunish: 1, threshold: 0 } }, 1);
  for (let t = 0; t < 300; t++) step(net, drive(net, { kc: 1, punish: 1 }));
  for (let j = 0; j < net.plastic.slot.length; j++) {
    if (net.plastic.slotGroup[j] === 1) assert.equal(net.plastic.wmod[j], 1, 'avoid slot must not be touched by punishment');
    else assert.ok(net.plastic.wmod[j] < 1, 'approach slot of a spiking KC must be depressed by punishment');
  }
});

test('wmod recovers toward 1 without further pairing', () => {
  const net = createNetwork(TOY, { vThreshold: 0.5, plasticity: { tauElig: 5, etaReward: 1, threshold: 0, tauForget: 50 } }, 2);
  for (let t = 0; t < 300; t++) step(net, drive(net, { kc: 1, reward: 1 }));
  const avoidSlot = net.plastic.slotGroup.indexOf(1);
  const depressed = net.plastic.wmod[avoidSlot];
  assert.ok(depressed < 1, 'pairing must depress the avoid slot');
  for (let t = 0; t < 2000; t++) step(net, drive(net, {}));
  assert.ok(net.plastic.wmod[avoidSlot] > depressed, 'wmod must recover toward 1 once pairing stops');
});

test('a tonic (constant-rate) DAN gives D = 0 once its baseline settles', () => {
  const net = createNetwork(TOY, { vThreshold: 0.5, plasticity: { tauRate: 20, tauBaseline: 200 } }, 3);
  for (let t = 0; t < 2000; t++) step(net, drive(net, { reward: 0.6 }));
  assert.ok(net.learning.dReward < 1e-6, `a constant-rate DAN should settle to D≈0, got ${net.learning.dReward}`);
});

test('resolveParams rejects a non-object plasticity', () => {
  assert.throws(() => resolveParams({ plasticity: 'nope' }), {
    message: 'LIF parameter "plasticity" must be null or an object',
  });
});

test('resolveParams rejects an unknown plasticity key', () => {
  assert.throws(() => resolveParams({ plasticity: { notAKey: 1 } }), {
    message: 'unknown LIF parameter "plasticity.notAKey"',
  });
});

test('resolveParams rejects a non-positive tau', () => {
  for (const key of ['tauElig', 'tauRate', 'tauBaseline', 'tauForget']) {
    assert.throws(() => resolveParams({ plasticity: { [key]: 0 } }), {
      message: `LIF parameter "plasticity.${key}" must be greater than 0`,
    });
  }
});

test('resolveParams rejects a negative eta', () => {
  for (const key of ['etaReward', 'etaPunish']) {
    assert.throws(() => resolveParams({ plasticity: { [key]: -1 } }), {
      message: `LIF parameter "plasticity.${key}" must be 0 or more`,
    });
  }
});

test('resolveParams rejects a negative threshold', () => {
  assert.throws(() => resolveParams({ plasticity: { threshold: -1 } }), {
    message: 'LIF parameter "plasticity.threshold" must be 0 or more',
  });
});

test('resolveParams rejects wMin outside [0, 1)', () => {
  assert.throws(() => resolveParams({ plasticity: { wMin: 1 } }), {
    message: 'LIF parameter "plasticity.wMin" must be from 0 to less than 1',
  });
  assert.throws(() => resolveParams({ plasticity: { wMin: -0.1 } }), {
    message: 'LIF parameter "plasticity.wMin" must be from 0 to less than 1',
  });
});

test('resolveParams rejects an unknown dopamine mode', () => {
  assert.throws(() => resolveParams({ plasticity: { dopamine: 'other' } }), {
    message: 'LIF parameter "plasticity.dopamine" must be "pool" or "shuffled"',
  });
});
