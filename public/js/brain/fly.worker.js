// Module Worker shell. All logic lives in worker-core.js and snapshot.js (tested in Node).
// The only work done here is fetching a snapshot named by URL in `init` and parsing it, before
// the core sees the message. The host sends nothing else until `ready`, so nothing is queued.

import { createWorkerCore } from './worker-core.js';
import { parseSnapshot } from './snapshot.js';
import { error } from './protocol.js';

const core = createWorkerCore();

async function resolveInit(msg) {
  const url = msg.brain.snapshot;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`snapshot ${url} could not be loaded (HTTP ${response.status})`);
  const snapshot = parseSnapshot(await response.arrayBuffer());
  return { ...msg, brain: { ...msg.brain, snapshot } };
}

self.onmessage = async (e) => {
  let msg = e.data;
  if (msg?.type === 'init' && typeof msg.brain?.snapshot === 'string') {
    try {
      msg = await resolveInit(msg);
    } catch (err) {
      self.postMessage(error({ flyId: msg.flyId, message: err.message }));
      return;
    }
  }
  const { reply, transfer } = core.handle(msg);
  if (reply) self.postMessage(reply, transfer ?? []);
};
