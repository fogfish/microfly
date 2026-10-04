// Browser host for the flies. One module Worker per toy fly, lockstep ticks per fly, pause while
// the tab is hidden, and per-fly errors. Pure logic lives in body.js, stimulus.js and protocol.js;
// this file only wires them to Workers and the clock.

import * as P from '../brain/protocol.js';
import { parseSnapshot } from '../brain/snapshot.js';
import { stepBody } from './body.js';
import { createBaselineMotor } from './baseline.js';
import { senseAt } from './stimulus.js';
import { resolveFlies } from './fly-config.js';

const HISTORY = 200;
const EMPTY = new Uint8Array(0);
const WORKER_URL = new URL('../brain/fly.worker.js', import.meta.url);
const MODE_LABEL = {
  toy: 'toy (synthetic test fixture)',
  baseline: 'baseline (random walk, no brain)',
};

// Fetches and checks the snapshot named by flies.brain.snapshot, before any fly starts (FR-019, FR-021).
// root is the web root the path is relative to. Throws an Error that names the file and the problem.
// Returns { url, release, createdAt, neuronCount } for the workers and the panel.
export async function loadSnapshot(brain, root) {
  const path = brain.snapshot;
  const url = new URL(path, root);
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new Error(`snapshot ${path} could not be loaded (network error: ${e.message})`);
  }
  if (!response.ok) throw new Error(`snapshot ${path} could not be loaded (HTTP ${response.status})`);

  let snapshot;
  try {
    snapshot = parseSnapshot(await response.arrayBuffer());
  } catch (e) {
    throw new Error(`snapshot ${path} is not usable: ${e.message}`);
  }
  for (const neuron of brain.telemetry ?? []) {
    if (neuron >= snapshot.neuronCount) {
      throw new Error(`flies.brain.telemetry ${neuron} is not below the snapshot's neuronCount ${snapshot.neuronCount}`);
    }
  }
  const { provenance } = snapshot.manifest;
  return {
    url: url.href,
    release: provenance?.datasetRelease ?? 'unknown release',
    createdAt: provenance?.createdAt ?? 'unknown date',
    neuronCount: snapshot.neuronCount,
  };
}

// world: from buildWorld. flies: from spawnFlies. snapshot: from loadSnapshot, or null for toy brains.
// Returns one FlyRecord per fly.
// FlyRecord: { state, worker, status, error, pending, history, telemetry, motorSource, brainLabel }
export function startFlies({ config, world, flies, onUpdate, snapshot = null }) {
  const f = resolveFlies(config);
  const brainLabel = snapshot
    ? `connectome snapshot (${snapshot.release}, created ${snapshot.createdAt})`
    : null;
  const points = [...world.stimulusCells.keys()].map((idx) => ({
    x: (idx % world.width) + 0.5,
    y: Math.floor(idx / world.width) + 0.5,
  }));
  const env = {
    dt: 1 / f.tickHz,
    maxSpeed: f.body.maxSpeed,
    turnRate: f.body.turnRate,
    width: world.width,
    height: world.height,
    isWalkable: world.walkable,
    isStimulusCell: world.isStimulusCell,
  };
  const elapsed = createClock();

  const records = flies.map((state) => ({
    state,
    worker: null,
    status: 'starting',
    error: null,
    pending: false,
    history: [],
    telemetry: f.brain?.telemetry ?? [],
    motorSource: state.mode === 'baseline' ? createBaselineMotor(state.brainSeed) : null,
    brainLabel: state.mode === 'toy' && brainLabel ? brainLabel : MODE_LABEL[state.mode],
  }));

  const senseOf = (s) => senseAt(points, s.body.x, s.body.y, f.stimulus);

  // Applies one movement step for the fly's current tick, then records it for the readout
  function applyTick(r, { sensory, left, right, selected }) {
    const s = r.state;
    s.sensory = sensory;
    s.motor = { left, right };
    stepBody(s.body, s.motor, env);

    r.history.push({ tick: s.tick, sensory, left, right, selected });
    if (r.history.length > HISTORY) r.history.shift();
    s.tick++;
    r.pending = false;
    onUpdate();
  }

  function fail(r, message) {
    r.status = 'error';
    r.error = message;
    r.pending = false;
    r.worker?.terminate();
    r.worker = null;
    onUpdate();
  }

  function onMessage(r, msg) {
    if (r.status === 'error' || r.status === 'stopped') return;
    switch (msg.type) {
      case 'ready':
        r.status = 'running';
        onUpdate();
        return;
      case 'motor':
        if (msg.tick !== r.state.tick) {
          fail(r, `motor tick ${msg.tick} does not match expected tick ${r.state.tick}`);
          return;
        }
        applyTick(r, msg);
        return;
      case 'error':
        fail(r, msg.message);
        return;
    }
  }

  function startWorker(r) {
    const worker = new Worker(WORKER_URL, { type: 'module' });
    r.worker = worker;
    worker.onmessage = (e) => onMessage(r, e.data);
    worker.onerror = (e) => fail(r, e.message || 'worker failed');
    // A snapshot is fetched by each worker from its absolute URL (R7); toy brains are built in place.
    const brain = snapshot && r.state.mode === 'toy' ? { ...f.brain, snapshot: snapshot.url } : f.brain;
    worker.postMessage(P.init({ flyId: r.state.id, seed: r.state.brainSeed, brain }));
  }

  // Sends the next sense for a due fly. Baseline flies have no worker, so they step at once.
  function dispatch(r) {
    const s = r.state;
    if (s.mode === 'baseline') {
      applyTick(r, { ...r.motorSource.next(), sensory: senseOf(s), selected: EMPTY });
      return;
    }
    r.pending = true;
    r.worker.postMessage(P.sense({ tick: s.tick, sensory: senseOf(s) }));
  }

  // One pass per animation frame. A fly is due when its tick is below floor(elapsed × tickHz).
  // A slow fly falls behind on its own and never stalls the others.
  function pump() {
    const due = Math.floor((elapsed() / 1000) * f.tickHz);
    let live = false;
    for (const r of records) {
      if (r.status === 'error' || r.status === 'stopped') continue;
      live = true;
      if (r.status !== 'running' || r.pending || r.state.tick >= due) continue;
      dispatch(r);
    }
    if (live) requestAnimationFrame(pump);
  }

  for (const r of records) {
    if (r.state.mode === 'baseline') {
      r.status = 'running';
      continue;
    }
    try {
      startWorker(r);
    } catch (e) {
      fail(r, e.message);
    }
  }
  requestAnimationFrame(pump);

  return records;
}

export function stopFlies(records) {
  for (const r of records) {
    if (r.worker) {
      r.worker.postMessage(P.stop());
      r.worker.terminate();
      r.worker = null;
    }
    r.status = 'stopped';
    r.pending = false;
  }
}

// Milliseconds of visible time. Hidden time does not count, so there is no catch-up burst on resume.
function createClock() {
  let visibleMs = 0;
  let since = document.hidden ? null : performance.now();
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) {
      if (since !== null) visibleMs += now - since;
      since = null;
    } else {
      since = now;
    }
  });
  return () => visibleMs + (since === null ? 0 : performance.now() - since);
}
