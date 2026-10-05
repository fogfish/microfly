// Pure message handler for one fly's worker (contracts/worker-protocol-v2.md). No Worker global,
// so Node tests exercise the same code the browser runs through fly.worker.js.

import { createFlyBrain } from './fly-brain.js';
import { error, motor, ready, transferables, validateMessage } from './protocol.js';

export function createWorkerCore() {
  let brain = null;
  let flyId = null;
  let lastTick = -1;
  let failed = false;

  // Returns { reply, transfer }. reply is null when nothing is sent back.
  function handle(msg) {
    // After an error the worker stays silent (protocol: the host has marked the fly as error)
    if (failed) return { reply: null, transfer: [] };

    const problem = validateMessage(msg, 'toWorker');
    if (problem) return fail(msg?.flyId ?? flyId, null, problem);

    switch (msg.type) {
      case 'init': {
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

  function reply(msg) {
    return { reply: msg, transfer: [] };
  }

  function fail(id, tick, message) {
    failed = true;
    return reply(error({ flyId: id, tick, message }));
  }

  return { handle };
}
