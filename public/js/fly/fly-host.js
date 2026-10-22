// Browser host for the flies. One module Worker per toy fly, lockstep ticks per fly, pause while
// the tab is hidden, and per-fly errors. Pure logic lives in body.js, stimulus.js, protocol.js and
// activity.js; this file only wires them to Workers and the clock.

import * as P from '../brain/protocol.js';
import * as P3 from '../brain/protocol-v3.js';
import { checkBrainVersion, parseSnapshot } from '../brain/snapshot.js';
import { BASELINE_CAPABILITIES, TOY_CAPABILITIES, withDerivedSignals } from '../brain/capabilities.js';
import { createActivity } from '../brain/activity.js';
import { neuronPositions, somaPositions } from '../brain/layout.js';
import { stepBody } from './body.js';
import { createBaselineMotor } from './baseline.js';
import { contactWithId, senseAt, sitePoint } from './stimulus.js';
import { resolveFlies } from './fly-config.js';
import { stimulusPoints } from './fly-world.js';
import { createFood } from './food.js';
import { applyForagerMotor, forageEnv, initForagerFly, senseForagerFly } from './forager-step.js';
import { forageEnvWide, isBodyFree, refreshConspecifics, senseForagerFlyWide, updateEventPulses } from './forager-step-wide.js';
import { createDecoderState, decodeTick, loadDecoder, pairOf } from './decoder.js';
import { loadLearning } from '../brain/learning.js';
import { initBodyLayerFly, stepBodyLayer } from './body-layer.js';
import { hunger as hungerOf } from './energy.js';

const HISTORY = 200;
const NO_SPIKES = new Uint32Array(0);
const WORKER_URL = new URL('../brain/fly.worker.js', import.meta.url);
const MODE_LABEL = {
  toy: 'toy (synthetic test fixture)',
  baseline: 'baseline (random walk, no brain)',
};

// Fetches and checks the snapshot named by flies.brain.snapshot, before any fly starts (FR-019, FR-021).
// root is the web root the path is relative to. Throws an Error that names the file and the problem.
// Returns { url, release, createdAt, neuronCount, capabilities, neurons } for the workers and the panel.
// neurons is { soma, superclass } per neuron, from the header; a null soma gets a seeded position.
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

  const bytes = await response.arrayBuffer();
  let snapshot;
  try {
    snapshot = parseSnapshot(bytes);
  } catch (e) {
    throw new Error(`snapshot ${path} is not usable: ${e.message}`);
  }
  // The brain version of the world must match the container version of the file, before any fly starts (FR-003),
  // and its declared kind (channel-declaration-v5.md).
  checkBrainVersion(brain.version ?? 'v0', snapshot.version, snapshot.kind, `${path}`);

  // decoder-v1's own snapshot cross-check (contracts/decoder-v1.md rule 1), computed here so the decoder never
  // re-fetches the (potentially large) .brain file itself.
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const { provenance } = snapshot.manifest;
  return {
    url: url.href,
    version: snapshot.version,
    sha256,
    release: provenance?.datasetRelease ?? 'unknown release',
    createdAt: provenance?.createdAt ?? 'unknown date',
    neuronCount: snapshot.neuronCount,
    capabilities: withDerivedSignals(snapshot.capabilities, snapshot.manifest),
    neurons: snapshot.manifest.neurons.map((n) => ({
      soma: n.soma ?? null, superclass: n.superclass ?? null, origin: n.origin ?? null, transmitter: n.transmitter ?? null,
      bodyId: n.bodyId ?? null, type: n.type ?? null, class: n.class ?? null,
    })),
    // Raw passthrough; the panel model (model.js) is where this is gated on capabilities.signals, per
    // panel-provenance-signals.md's rule against re-deciding on the header directly.
    provenance: {
      selection: snapshot.manifest.selection, admission: snapshot.manifest.admission,
      minSynapses: snapshot.manifest.minSynapses,
    },
    fidelity: snapshot.manifest.fidelity ?? null,
  };
}

// Fetches and checks the decoder-v1 sidecar named by flies.brain.decoder (contracts/decoder-v1.md), for a "v3"
// fly, before any fly starts. snapshot: loadSnapshot's return (sha256, neuronCount, capabilities).
export async function loadDecoderFile(brain, root, snapshot) {
  const senses = [...new Set(snapshot.capabilities.channels.inputs.map((ch) => pairOf(ch.id)))];
  // ADR 012 R12: a decoder's `song` pool needs the snapshot to actually declare a `song` output.
  const hasSongOutput = snapshot.capabilities.channels.outputs.some((ch) => ch.drive === 'song');
  return loadDecoder(brain.decoder, root, {
    sha256: snapshot.sha256, neuronCount: snapshot.neuronCount, senses, hasSongOutput,
  });
}

// Fetches and parses the learning-v1 sidecar named by flies.brain.learning (contracts/worker-protocol-v3-
// learning.md), before any fly starts. null when the world declares none (plasticity then stays off). The
// worker resolves this parsed object's groups itself, against its own copy of the snapshot manifest.
export async function loadLearningFile(brain, root, snapshot) {
  if (brain.learning === undefined) return null;
  return loadLearning(brain.learning, root, { sha256: snapshot.sha256 });
}

// The declaration a fly's brain makes (channel-declaration.md): the snapshot's for connectome flies,
// the toy declaration or its override for toy flies, and the baseline one for random-walk flies.
function declarationOf(state, f, snapshot) {
  if (state.mode === 'baseline') return BASELINE_CAPABILITIES;
  if (snapshot) return snapshot.capabilities;
  return f.brain?.capabilities ?? TOY_CAPABILITIES;
}

// world: from buildWorld. flies: from spawnFlies. snapshot: from loadSnapshot, or null for toy brains.
// Returns one FlyRecord per fly.
// FlyRecord: { state, worker, status, error, pending, history, motorSource, brainLabel, capabilities,
//              checks, neuronCount, activity, positions, drawn }
export function startFlies({ config, world, flies, onUpdate, snapshot = null, decoder = null, learning = null, mbon = null, onFlowers = null }) {
  const f = resolveFlies(config);
  // The forager brain (version v1, v2 or v3) runs on protocol 3. Its toy flies are the only ones that use the
  // brain. v2 (ADR 007) and v3 (ADR 010) are both the wide-I/O interface generation, same v1 runner and sense
  // generation, dispatched by brain.version below; v3 additionally replaces the motor path with the decoder +
  // body layer (research.md §2).
  const isWide = f.brain?.version === 'v2' || f.brain?.version === 'v3';
  const isDemo = f.brain?.version === 'v3';
  const forager = (f.brain?.version === 'v1' || isWide) && snapshot !== null;
  const brainLabel = forager
    ? `${isDemo ? 'v3 demo' : isWide ? 'v2 wide-I/O' : 'v1'} forager brain (snapshot release ${snapshot.release}, created ${snapshot.createdAt})`
    : snapshot
      ? `connectome snapshot (${snapshot.release}, created ${snapshot.createdAt})`
      : null;
  const points = stimulusPoints(world);
  // Every forager (toy) fly calls regrow() each tick, so the table is told how many share it (food.js createFood).
  const flowers = forager ? createFood(world, f, { sharers: flies.filter((s) => s.mode === 'toy').length }) : null;
  // The live flower table, for the odour overlay (main.js), null for a world with no forager brain.
  onFlowers?.(flowers);
  const forageEnvironment = forager
    ? (isWide ? forageEnvWide(f, world, flowers, snapshot.capabilities) : forageEnv(f, world, flowers, snapshot.capabilities))
    : null;
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

  // Soma positions are per brain, not per tick. A connectome brain shares one layout across its flies.
  // Returns { drawn, positions }: drawn lists the neuron index of each point (FR-030: a snapshot brain draws
  // only neurons with a soma); null means every neuron is drawn, as in a toy brain.
  const layouts = new Map();
  const positionsFor = (state, neuronCount) => {
    const key = snapshot && state.mode === 'toy' ? 'snapshot' : `toy:${state.brainSeed}`;
    if (!layouts.has(key)) {
      if (snapshot && state.mode === 'toy') {
        layouts.set(key, somaPositions(snapshot.neurons));
      } else {
        const neurons = Array.from({ length: neuronCount }, () => ({ soma: null }));
        layouts.set(key, { drawn: null, positions: neuronPositions(neurons, state.brainSeed) });
      }
    }
    return layouts.get(key);
  };

  const records = flies.map((state) => {
    const isForager = forager && state.mode === 'toy';
    if (isForager) initForagerFly(state, f.body.energy.initial);
    const isDemoFly = isForager && isDemo;
    // D31: the panel's decoder section (panel/sections/decoder.js) is gated on this signal, not on brain.version
    // directly (registry.js's isRequirementMet convention, panel-provenance-signals.md's own additive-signals rule).
    const declared = declarationOf(state, f, snapshot);
    const capabilities = isDemoFly ? { ...declared, signals: [...declared.signals, 'decoder'] } : declared;
    if (isDemoFly) initBodyLayerFly(state, state.brainSeed);
    const neuronCount = state.mode === 'baseline'
      ? 0
      : (snapshot && state.mode === 'toy' ? snapshot.neuronCount : f.brain?.neuronCount);
    const outputs = capabilities.channels.outputs;
    return {
      state,
      worker: null,
      status: 'starting',
      error: null,
      pending: false,
      forager: isForager,
      demo: isDemoFly,
      // mbon (ADR 011, data-model.md "Learned valence"): null keeps every food pair's learned gain undefined
      // (sumByValence's default of 1), so learning off is bit-for-bit today's behaviour.
      decoderState: isDemoFly ? createDecoderState(decoder, capabilities.channels.inputs, mbon) : null,
      // The decoder-v1 file itself (contracts/decoder-v1.md), not just the per-tick decode: the panel's decoder
      // section (D31) reports each sense's pool size, which decodeTick's per-tick return does not carry.
      decoderFile: isDemoFly ? decoder : null,
      history: [],
      motorSource: state.mode === 'baseline' ? createBaselineMotor(state.brainSeed) : null,
      brainLabel: state.mode === 'toy' && brainLabel ? brainLabel : MODE_LABEL[state.mode],
      capabilities,
      checks: {
        neuronCount,
        outputCount: outputs.length,
        leftIndex: outputs.findIndex((ch) => ch.drive === 'left'),
        rightIndex: outputs.findIndex((ch) => ch.drive === 'right'),
      },
      neuronCount,
      activity: state.mode === 'baseline' ? null : createActivity(neuronCount),
      ...(state.mode === 'baseline' ? { positions: null, drawn: null } : positionsFor(state, neuronCount)),
      // Per-neuron identity (bodyId/type/class/origin/transmitter), for the brain activity view's legend and
      // hover/selection (panel-provenance-signals.md); null for a toy/baseline brain with no snapshot.
      neurons: snapshot && state.mode === 'toy' ? snapshot.neurons : null,
      provenance: snapshot && state.mode === 'toy' ? snapshot.provenance : null,
      fidelity: snapshot && state.mode === 'toy' ? snapshot.fidelity : null,
      // ADR 011 (contracts/world-config-v3-learning.md "events"): the senses this world drives from a world
      // event rather than the connectome carrying the signal itself, for the panel's "injected" tag (Phase 8).
      injectedSenses: Object.entries(f.stimuli ?? {})
        .filter(([, spec]) => spec.from === 'events')
        .map(([sense, spec]) => ({ sense, events: spec.events })),
      // The latest motor.learning (contracts/worker-protocol-v3-learning.md), kept for Phase 8's panel. null
      // until the first motor reply; absent again (not zeros) whenever plasticity is off, so "learning off" is
      // distinguishable from a real zero reading.
      learning: null,
    };
  });

  const senseOf = (s) => senseAt(points, s.body.x, s.body.y, f.stimulus);

  // One forager tick: the motor reply drives the body, the flower and the energy, and goes into the history (ADR 003).
  // For a "v3" fly, the decoder (D27–D29) and body layer (W12–W14) replace applyForagerMotor (research.md §2):
  // this is the one call site where decoded signals, not a hand-wired formula, drive the body.
  function applyForagerTick(r, msg) {
    // ADR 012 R10 (flies.body.solid): a per-fly env wrapping the shared forageEnvironment with this fly's own
    // isBodyFree hook (body.js free()). Off (solid false/absent) is a no-op: the plain forageEnvironment, same
    // object every tick.
    const envForBody = f.body?.solid
      ? { ...forageEnvironment, isBodyFree: isBodyFree(forageEnvironment.conspecifics, r.state.id, f.body.bodyRadius) }
      : forageEnvironment;
    if (r.demo) {
      const decoded = decodeTick(r.decoderState, { spikes: msg.spikes, inputs: msg.inputs }, decoder);
      // ADR 012 R12/W17 (renderer.js): the wing's side, read by the renderer only — never by locomotion.
      r.state.contactPheromoneSide = decoded.senses['contact-pheromone']?.side;
      // ADR 012 (contracts/world-config-v3-social.md "Telemetry"): which other fly's body this fly's own
      // front-leg sites currently touch, for the panel — not read by sensing (contactAt already gives the
      // sensed, emission-weighted value) or by the body layer.
      const legSite = f.body.sites?.['front-leg'];
      if (legSite && f.body.bodyRadius && forageEnvironment.conspecifics) {
        const conspecifics = forageEnvironment.conspecifics;
        r.state.contactWith = contactWithId(sitePoint(r.state.body, legSite, 'L'), conspecifics, r.state.id, f.body.bodyRadius)
          ?? contactWithId(sitePoint(r.state.body, legSite, 'R'), conspecifics, r.state.id, f.body.bodyRadius);
      }
      const { eating, ateScent, escapeStarted } = stepBodyLayer(r.state, decoded, { locomotion: f.body.locomotion, escape: f.body.escape, backup: f.body.backup, motor: f.body.motor, song: f.body.song }, envForBody);
      // ADR 011 (contracts/world-config-v3-learning.md "events"): this tick's own outcome drives next tick's
      // reinforcement:reward/punish pulses (the sense for tick t+1 is built before tick t+1's body layer runs,
      // so an event can only be read one tick after it happens).
      updateEventPulses(r.state, envForBody, { eating, ateScent, escapeStarted, inputs: msg.inputs });
      // contracts/worker-protocol-v3-learning.md: present only when plasticity is on; r.learning mirrors that
      // (undefined/absent reads as "learning off" on the panel, never a stale value from a previous tick).
      r.learning = msg.learning ?? null;
      r.activity?.recordTick(msg.spikes, performance.now());
      r.history.push({
        tick: r.state.tick, inputs: msg.inputs, sensory: msg.inputs[0], hunger: hungerOf(r.state.energy),
        energy: r.state.energy, speed: r.state.body.speed, eating, outputs: msg.outputs, spikes: msg.spikes, decoded,
        // model.js's `forager`/`diagnostic` detection keys on `drives` (the v1/v2 applyForagerMotor entry shape);
        // a v3 fly has no raw turnLeft/turnRight (steering is continuous heading change, not a discrete output),
        // so only forward/backward/feed carry over, from the decoded named pools' homeostasis-corrected drive
        // (D29), not msg.outputs' raw instantaneous value.
        drives: { forward: decoded.named.forward?.drive ?? 0, backward: decoded.named.backward?.drive ?? 0, feed: decoded.named.feed?.drive ?? 0 },
      });
      if (r.history.length > HISTORY) r.history.shift();
      r.state.tick++;
      r.pending = false;
      onUpdate();
      return;
    }
    const entry = applyForagerMotor(r.state, msg, envForBody);
    r.activity?.recordTick(msg.spikes, performance.now());
    r.history.push({ ...entry, sensory: entry.inputs[0] });
    if (r.history.length > HISTORY) r.history.shift();
    r.pending = false;
    onUpdate();
  }

  // Applies one movement step for the fly's current tick, then records it for the panel
  function applyTick(r, { sensory, left, right, outputs, spikes }) {
    const s = r.state;
    s.sensory = sensory;
    s.motor = { left, right };
    stepBody(s.body, s.motor, env);

    r.activity?.recordTick(spikes, performance.now());
    r.history.push({ tick: s.tick, sensory, left, right, outputs, spikes });
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
      case 'motor': {
        if (msg.tick !== r.state.tick) {
          fail(r, `motor tick ${msg.tick} does not match expected tick ${r.state.tick}`);
          return;
        }
        if (r.forager) {
          const forageProblem = P3.validateMessage(msg, 'toHost') ?? P3.validateMotorV3(msg, r.checks);
          if (forageProblem) {
            fail(r, forageProblem);
            return;
          }
          applyForagerTick(r, msg);
          return;
        }
        const problem = P.validateMessage(msg, 'toHost') ?? P.validateMotor(msg, r.checks);
        if (problem) {
          fail(r, problem);
          return;
        }
        applyTick(r, msg);
        return;
      }
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
    // D32: the runtime hunger-threshold override is a world-config key, not a brain-section one (research.md
    // §6), so it is folded into the worker's brain payload here rather than carried on f.brain itself.
    // init.brain.learning (contracts/worker-protocol-v3-learning.md): the parsed object replaces the world's
    // own path string, mirroring how snapshot.url replaces flies.brain.snapshot above.
    const brain = snapshot && r.state.mode === 'toy'
      ? { ...f.brain, snapshot: snapshot.url, ...(learning ? { learning } : {}), ...(isDemo ? { modulators: f.modulators } : {}) }
      : f.brain;
    if (r.forager) {
      worker.postMessage(P3.init({ flyId: r.state.id, seed: r.state.brainSeed, brain }));
      return;
    }
    worker.postMessage(P.init({ flyId: r.state.id, seed: r.state.brainSeed, brain }));
  }

  // Sends the next sense for a due fly. Baseline flies have no worker, so they step at once.
  function dispatch(r) {
    const s = r.state;
    if (s.mode === 'baseline') {
      const { left, right } = r.motorSource.next();
      const outputs = Float32Array.from(r.capabilities.channels.outputs, (ch) => (ch.drive === 'left' ? left : right));
      applyTick(r, { sensory: senseOf(s), left, right, outputs, spikes: NO_SPIKES });
      return;
    }
    r.pending = true;
    if (r.forager) {
      const sense = isWide ? senseForagerFlyWide(s, forageEnvironment) : senseForagerFly(s, forageEnvironment);
      r.worker.postMessage(sense.message);
      return;
    }
    r.worker.postMessage(P.sense({ tick: s.tick, sensory: senseOf(s) }));
  }

  // One pass per animation frame. A fly is due when its tick is below floor(elapsed × tickHz).
  // A slow fly falls behind on its own and never stalls the others.
  function pump() {
    // ADR 012 R8: refreshed once a tick, before any fly senses, so every "flies"-sourced sampler and the
    // solid-body hook both read this tick's live positions.
    if (isWide && forageEnvironment) refreshConspecifics(forageEnvironment, records.map((r) => r.state));
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
