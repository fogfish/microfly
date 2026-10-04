# Research: Toy LIF Fly Network

**Feature**: `002-toy-lif-fly-network` | **Date**: 2026-10-04

Every decision below was needed to make the plan concrete. None was left as NEEDS CLARIFICATION. Each lists the decision, the reason, and the alternatives that were rejected. Where the ADR left a question open, the decision says so.

## R1: Module boundary: pure logic versus browser shell

**Decision**: Everything that does not touch the DOM, `Worker` or `fetch` is pure: LIF core, graph, fly brain, protocol, worker handler, stimulus, body, baseline, fly world. Browser-only code is `fly-host.js`, `fly.worker.js`, `fly-panel.js`, and the changes to renderer, input and main.

**Rationale**: The ADR requires the LIF core to be testable on its own (Principle V). Keeping the worker's behaviour in a pure handler means the contract can be tested in Node on both sides (Dev Workflow rule for protocol changes). The experiment script can reuse the exact pure code the browser runs.

**Alternatives considered**: Putting the handler inside the worker file. Rejected: it cannot be imported by Node tests without a Worker global.

## R2: Worker scheduling: lockstep per fly, not a global barrier

**Decision**: Each fly has its own brain-tick counter. A fly sends `sense(t)` only after it has received `motor(t-1)` (one message in flight per fly). The host decides when a fly is due from a wall clock target (`floor(elapsed × tickHz)`), so a slow worker falls behind without stalling the others. Ticks advance only while the tab is visible.

**Rationale**: For a fixed sequence of tick indices, the spike sequence depends only on the sensory values, and the sensory values depend only on the fly's own earlier motor outputs. Thus results do not depend on message timing, which keeps Principle V. A global barrier would also meet this, but a slow worker would stall every fly and the world, which conflicts with FR-016.

**Alternatives considered**: Free-running workers that reply with whatever latest sensor value they have. Rejected: spike sequences would depend on timing and could not be reproduced (SC-002).

## R3: Config versioning: optional `flies` section, version stays 1

**Decision**: `flies` is an optional top-level field in `world.json`. The config stays `version: 1`. If `flies` is absent, the app shows no flies and behaves exactly as feature 001.

**Rationale**: Contract `world-config.md` (feature 001) allows an optional field within version 1 if the app ignores it when absent. Adding a field does not rename or change the meaning of any existing field. This matches how `groups` was introduced in BUG-001 and avoids breaking the default world.

**Alternatives considered**: `version: 2`. Rejected: no existing meaning changes, and a bump would force every config to be edited.

## R4: Sensory input and the fruit stimulus

**Decision**: The sensory value is `clamp(gain × intensity, 0, max)`, where `intensity = Σ over stimulus objects of max(0, 1 − d / radius)` and `d` is the distance in tiles from the fly to the object's cell centre. The stimulus objects are listed by rule id in `flies.stimulus.objects` (default `apple` and `cherry`; honey is excluded because the spec names fruit only). Only rules with `kind: "edible"` are allowed.

**Rationale**: The ADR's sensory input is "fruit intensity for the fly's position", with no formula given. A linear falloff within a radius is the smallest rule that gives a gradient, which a turning rule can follow. Declaring it in data satisfies Principle VI.

**Alternatives considered**: Nearest-fruit distance only. Rejected: it gives no signal when two fruit are equidistant and is less smooth. Gaussian falloff. Rejected: extra parameter with no benefit at this scale.

## R5: Motor mapping and wheel speeds (ADR open question 1 and 2)

**Decision**: The network has three designated neurons: sensory = 0, LEFT motor = 1, RIGHT motor = 2. Each motor output is an exponential moving average per tick: `rate += motorSmoothing × (spike − rate)`, with `motorSmoothing` in config (default 0.05, about one second at 20 Hz). Wheel speeds are `v = maxSpeed × (L + R) / 2` and `ω = turnRate × (R − L)`.

**Rationale**: ADR decided two outputs (open question 1). Its toy annex sets LEFT and RIGHT as two motor neurons with EMA rates driving wheel speeds (open question 2 is deferred, but the toy needs a direct mapping). Designating fixed indices keeps the protocol simple. The random graph decides whether these neurons are wired; that is the wiring question the ADR's Stage 2 metric tests.

**Alternatives considered**: Choosing motor neurons at random from the graph. Rejected: not reproducible across config changes, and harder to inspect in telemetry.

**Risk**: With random wiring, neurons 1 and 2 may have no inbound edges and never fire. The ADR treats that as a wiring failure to fix (growth loop), not a dataset issue. The experiment script will report per-fly motor activity so this can be seen.

## R6: Body: motion, walkability and collision

**Decision**: Position is continuous in tile units. Each brain tick the body integrates `heading += ω × dt`, then moves `(cos h, sin h) × v × dt`. A tile is walkable when its terrain has `walkable: true` and no `kind: "scenery"` object is in it. If the full move is blocked, the body tries x-only, then y-only (sliding). If still blocked, the fly stays put. Positions are clamped to the world bounds.

**Rationale**: `walkable` already exists in `world.json` for terrain (water and rock are not walkable). Scenery objects (trees, rocks, bushes) already exist as `kind: "scenery"`, so flies collide with them without new config. Sliding avoids flies sticking on walls.

**Alternatives considered**: Turning around on collision. Rejected: it adds a hidden behaviour not in the ADR; the brain's turning output should be the only steering.

## R7: Random-walk baseline

**Decision**: A baseline fly uses the same body and stimulus-free contact code, but its LEFT and RIGHT motor values are drawn each tick from a seeded PRNG (`uniform [0, 1]`) instead of from a brain. No worker is started for baseline flies.

**Rationale**: The ADR's acceptance metric compares the wiring against "a random-walk baseline in the same world". Using the same body means the only difference is the motor source, so the comparison isolates the brain.

**Alternatives considered**: Pure random heading change. Rejected: different body, so the comparison would not isolate the brain.

## R8: Fruit contact definition

**Decision**: A contact is counted when a fly's current cell (`floor(x)`, `floor(y)`) changes to a cell containing a stimulus object. Staying on the same fruit does not add more contacts. Eating does not remove the fruit (eating is out of scope, as in feature 001).

**Rationale**: Counting entries gives one event per visit, is easy to test, and does not depend on speed.

**Alternatives considered**: Counting every tick on fruit. Rejected: it measures time-on-fruit, not finding fruit. Removing fruit on contact. Rejected: changes the world and makes the comparison depend on order.

## R9: Spawn

**Decision**: Fly `i` spawns at the `i`-th cell chosen by a PRNG seeded from `flies.seed` XOR `0x51ED270B`. The cell must be walkable and free of scenery. Heading is also drawn from that PRNG. If 200 attempts fail, `spawnFlies` throws `no walkable cell for fly i`; the app shows the message in the fly panel and starts no flies.

**Rationale**: Reproducible (SC-002, Principle IV). The salt keeps the spawn stream separate from the terrain and object stream: both start from `config.seed`, so without the salt the first spawn draws replay the cells just placed as scenery and every spawn fails.

## R10: Brain seeds

**Decision**: Fly `i` uses brain seed `(flies.seed + (i + 1) × 0x9E3779B1) >>> 0`, passed through `createPrng` for the graph. Baseline motor seed is the same value XOR `0xB5297A4D`, so baseline and toy streams differ.

**Rationale**: Each fly gets a different network (spec Story 1, scenario 3), and the same `flies.seed` always gives the same six networks.

## R11: Telemetry transport

**Decision**: Every brain tick the worker posts `{ tick, sensory, left, right, selected }`, where `selected` is a `Uint8Array` of spikes for `brain.telemetry` neurons (default `[0, 1, 2]`). The host keeps the last 200 ticks per fly in a ring buffer for the readout. The `selected` buffer is transferred, not copied.

**Rationale**: At 20 Hz with six flies, this is about 120 small messages per second. Typed arrays with transfer keep the cost low (Constitution II: messages SHOULD use transferable objects).

**Alternatives considered**: Sending all spikes. Rejected: 40 neurons is cheap, but the readout only needs selected neurons, and the constitution asks for selected-neuron telemetry.

## R12: Acceptance metric and experiment

**Decision**: `scripts/compare-baseline.mjs` loads `world.json`, validates it, generates the world, and for each seed in `flies.experiment.seeds` runs `flies.experiment.ticks` brain ticks for every toy fly and every baseline fly, in the same world, using the pure code. It prints contacts per seed and the totals, and the difference. It exits with code 0 whatever the result, and prints the verdict (`toy > baseline` or not), so it can be used as a metric rather than a test gate.

**Rationale**: The ADR's acceptance metric is a comparison over several seeds, which fits an experiment rather than a unit test. Running it in Node avoids a browser and uses the same code as the worker.

**Alternatives considered**: Making the metric a `node --test` gate. Rejected: the outcome depends on wiring and is not a correctness property; a failing gate would block unrelated work.
