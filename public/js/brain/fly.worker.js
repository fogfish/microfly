// Module Worker shell. All logic lives in worker-core.js (tested in Node).

import { createWorkerCore } from './worker-core.js';

const core = createWorkerCore();

self.onmessage = (e) => {
  const { reply, transfer } = core.handle(e.data);
  if (reply) self.postMessage(reply, transfer ?? []);
};
