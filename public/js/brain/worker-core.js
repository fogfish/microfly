// Pure message handler for one fly's worker (contracts/worker-protocol-v2.md and worker-protocol-v3.md). No Worker
// global, so Node tests exercise the same code the browser runs through fly.worker.js. Routing is by msg.v:
// 2 → the v0 handler (mock and v0 flies); 3 → the v1 handler (forager flies).

import { createFlyBrain } from './fly-brain.js';
import { error, motor, ready, transferables, validateMessage } from './protocol.js';
import * as P3 from './protocol-v3.js';

const MISMATCH = 'brain version does not match the message protocol';

export function createWorkerCore() {
  let brain = null;
  let flyId = null;
  let lastTick = -1;
  let failed = false;

  // Returns { reply, transfer }. reply is null when nothing is sent back.
  function handle(msg) {
    // After an error the worker stays silent (protocol: the host has marked the fly as error)
    if (failed) return { reply: null, transfer: [] };
    return msg?.v === P3.PROTOCOL_VERSION_V3 ? handleV1(msg) : handleV0(msg);
  }

  // Protocol 2: mock and v0 brains. A version 4 snapshot is not read by this protocol.
  function handleV0(msg) {
    const problem = validateMessage(msg, 'toWorker');
    if (problem) return fail(msg?.flyId ?? flyId, null, problem);

    switch (msg.type) {
      case 'init': {
        if (msg.brain.snapshot?.version === 4) return fail(msg.flyId, null, MISMATCH);
        try {
          brain = createFlyBrain(msg.brain, msg.seed);
        } catch (e) {
          return fail(msg.flyId, null, e.message);
        }
        flyId = msg.flyId;
        lastTick = -1;
        return reply(ready({ flyId, neuronCount: brain.neuronCount, capabilities: brain.capabilities }));
      }

      case 'sense': {
        if (!brain) return fail(flyId, msg.tick, 'sense received before init');
        const expected = lastTick + 1;
        if (msg.tick !== expected) {
          return fail(flyId, msg.tick, `sense tick ${msg.tick} out of order (expected ${expected})`);
        }
        const out = brain.step(msg.sensory);
        lastTick = msg.tick;
        const m = motor({
          tick: msg.tick, sensory: out.sensory, left: out.left, right: out.right, outputs: out.outputs, spikes: out.spikes,
        });
        return { reply: m, transfer: transferables(m) };
      }

      case 'stop':
        brain = null;
        return { reply: null, transfer: [] };
    }
  }

  // Protocol 3: forager (v1) brains. The init checks the brain version against the snapshot, then the sense runs one
  // brain tick and the reply is a protocol 3 motor.
  function handleV1(msg) {
    const failV3 = (id, tick, message) => {
      failed = true;
      return reply(P3.error({ flyId: id, tick, message }));
    };
    const problem = P3.validateMessage(msg, 'toWorker');
    if (problem) return failV3(msg?.flyId ?? flyId, null, problem);

    switch (msg.type) {
      case 'init': {
        if (msg.brain.snapshot?.version !== 4) return failV3(msg.flyId, null, MISMATCH);
        try {
          brain = createFlyBrain({ ...msg.brain, version: 'v1' }, msg.seed);
        } catch (e) {
          return failV3(msg.flyId, null, e.message);
        }
        flyId = msg.flyId;
        lastTick = -1;
        return reply(P3.ready({ flyId, neuronCount: brain.neuronCount, capabilities: brain.capabilities }));
      }

      case 'sense': {
        if (!brain) return failV3(flyId, msg.tick, 'sense received before init');
        const expected = lastTick + 1;
        if (msg.tick !== expected) {
          return failV3(flyId, msg.tick, `sense tick ${msg.tick} out of order (expected ${expected})`);
        }
        const problemSense = P3.validateSenseV3(msg, { inputCount: brain.capabilities.channels.inputs.length });
        if (problemSense) return failV3(flyId, msg.tick, problemSense);
        const out = brain.step({ inputs: msg.inputs, hunger: msg.state.hunger });
        lastTick = msg.tick;
        const m = P3.motor({ tick: msg.tick, inputs: out.inputs, outputs: out.outputs, spikes: out.spikes });
        return { reply: m, transfer: P3.transferables(m) };
      }

      case 'stop':
        brain = null;
        return { reply: null, transfer: [] };
    }
  }

  function reply(msg) {
    return { reply: msg, transfer: [] };
  }

  function fail(id, tick, message) {
    failed = true;
    return reply(error({ flyId: id, tick, message }));
  }

  return { handle };
}
