# Research: Hungry Forager Brain

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Each entry gives the decision, why it was made, and what was rejected. Dataset counts are the ADR 003
Annex A measurements; Gate A re-measures them with the real extractor, so nothing here depends on them
being exact.

## R1. Versioning of the simulator: rename the v0 LIF, add v1 beside it

**Decision**: `public/js/brain/lif.js` is renamed to `lif-v0.js` with no change to its code. The new core is
`lif-v1.js`. `fly-brain.js` becomes a dispatcher that picks `fly-brain-v0.js` (today's runner, toy and ADR 002
snapshots) or `fly-brain-v1.js` (forager runner) from `flies.brain.version`. The worker protocol stays at version
2 in `protocol.js` (already the v0 protocol) and gains `protocol-v3.js`.

**Why**: The user asked for `lif-v0.js` by name. Renaming, not copying, leaves one v0 implementation. The
golden test then tests the same code that the v0 path runs. The dispatcher keeps the existing import
sites (`createFlyBrain`, `BRAIN_DEFAULTS`) unchanged.

**Alternatives considered**:
- Keep `lif.js` and add `lif-v0.js` as a re-export. Rejected: two names for one module, and the golden test would
  not prove anything about the file that actually runs.
- Copy the whole simulator into a `v0/` folder. Rejected: duplicates the fly, world and panel code, which
  does not change between versions.
- Put v1 behind a flag inside `lif.js`. Rejected: ADR 003 L1–L3 add state arrays, and a flag would fork
  the hot loop anyway. Separate files keep the v0 loop byte-identical.

## R2. LIF v1 with defaults off reproduces v0 exactly

**Decision**: `lif-v1.js` exports `LIF_V1_DEFAULTS` = the v0 defaults plus `tauSyn: 0`, `tauAdapt: 0`,
`adaptStep: 0`, `thresholdJitter: 0`, `stepsPerTick: 1` (the last one is read by the runner, not the core).
`step` has two branches. `tauSyn === 0` writes `syn[j] = arrive[j]` and uses the v0 update order. The
adaptation term is skipped when `tauAdapt === 0`. The v0 golden drive is then reproduced bit for bit, which
a test checks against `tests/fixtures/toy-golden.json`.

**Why**: ADR 003 L1 and L2 say the defaults must be the v0 model. A bit-exact check is the only test that
proves it. Using separate `syn` and `a` arrays only when the feature is on keeps the cost of v0 unchanged.

**Measured risk**: float order. The v1 update adds `syn[j]` and `external[j]` in a different order from
v0. The plan puts the v0 branch in the same expression order as `lif-v0.js` and checks equality with `===`
on the golden trace, not with a tolerance.

## R3. Pool inputs need a per-channel value, not the single sensory number

**Decision**: The worker protocol v3 `sense` carries `inputs: Float32Array` in declaration order. The
runner writes `external[i] = clamp(resting_c + gain_c(h) × value_c, 0, max_c)` for each neuron `i` of pool `c`
(ADR 003 L4). The host builds `inputs` from the world: two odour values from the antenna samples and two taste
values from the stock under the fly. The panel reads `history.inputs[k]` for channel `k` and falls back to
`sensory` for v0 and mock.

**Why**: The world already produces numbers per fly (`senseAt`). What changes is that there are four of them,
not one, and the brain applies hunger, not the world. Keeping gain in the brain means the world stays free of
brain knowledge, and the modulator declaration is read from the snapshot (Principle VI).

**Where the resting level comes from**: the resting level is `flies.stimulus.resting` for odour, and 0 for
taste. ADR 003 L4 writes `resting_c` without saying where it comes from. Declaring it per channel in the snapshot
would add a field that the channel-declaration rules reject (rule 18). So it stays a world value.

**Alternatives considered**:
- Let the world apply hunger gain and send the final drive. Rejected: the world would then know the brain's
  gain table, and the modulator declaration in the snapshot would be dead data.
- One summed odour value (as v0). Rejected: the ADR's whole point is left/right contrast (ADR 003 Context).

## R4. Snapshot container v4: same binary layout, new header rules

**Decision**: Version 4 keeps the v3 binary layout (magic, version, header length, JSON header, CSR sections)
and changes the header. Roles are `input`, `output`, `interneuron` with a `channel` field. Input and output
channels carry `neurons` (a list of indices) in place of `neuron`. The header adds `kind` (`"forager"`),
`modulators` and `weightRule`. The readers in Python and JS dispatch on the version number and share the section
code. v3 files keep their exact rules and messages.

**Why**: Only the header changes, so the section reader is shared. A `kind` field is explicit, so the browser does
not have to guess the brain type from the drive names.

**Alternatives considered**:
- Infer the kind from the presence of a `forward` drive. Rejected: an implicit rule that a future kind would break.
- A new binary layout for multi-neuron pools. Rejected: the CSR arrays already hold any neuron-to-neuron graph,
  and pools are index lists in the header.

## R5. Channel declaration for v4: pools, drives and the kind's drive set

**Decision**: v4 inputs are `{id, label, side, neurons, range}`. v4 outputs are `{id, label, side, neurons, range,
drive}`. `drive` is one of `turnLeft`, `turnRight`, `forward`, `backward`, `feed` (forager) or `left`, `right`
(tank). The header `kind` decides the allowed set. A forager must declare all five drives, each once. A tank
declares `left` and `right` once each, as today. Rule 15 (inputs read neuron 0) is replaced by: every index in
`neurons` is below `neuronCount`, and the pools of different inputs do not share a neuron.

**Why**: The panel and the inspector both read this declaration, so changing its shape once is cheaper than
a per-brain panel. The drive set is fixed by `kind`, which keeps the body's motor mapping (ADR 003 W4) a
lookup, not a branch on brain names.

**Note on the rule change**: The v3 declaration rules stay for v3 files, so this does not loosen the
existing validator. The v4 rules are a new function in each language, checked against the same message
text (see [contracts/channel-declaration-v4.md](contracts/channel-declaration-v4.md)).

## R6. Hunger, eating and the stock: the world owns the stock

**Decision**: The stock of each flower lives in a new pure module `public/js/fly/food.js`, held by the host
(main thread) for the world. It exposes `stockAt(cx, cy)`, `consume(cx, cy, amount)`, `regrow(dtSeconds)` and
the full stock per flower. The body's energy lives in the fly state, changed by `energy.js`. The eating
decision (W2) is one pure function `canEat(cell, speed, feed, cfg)` in `energy.js`.

**Why**: The world owns flowers (Principle VI), and flies interact only through the world (Principle II), so a
flower's stock cannot be in a worker. Keeping the three conditions in one pure function makes the rule testable
and lets the experiment script use it without a DOM.

**Addition beyond ADR 003**: The ADR says eating "lowers" the stock but gives no rate. This plan adds
`flies.food.consumeRate` (stock per second while eating). The default is set in calibration (Q5). Without a rate,
the stock could not fall and flowers could not run out, which W2 requires.

**Speed definition**: `speed` is the distance the body moved in the tick divided by `dt`, in tiles per second. It
is measured by the host, not reported by the worker, so a worker cannot claim it is stopped.

## R7. Bilateral odour: two antenna samples, weighted by stock

**Decision**: For each fly, the host samples the odour at `pos ± antennaOffset × perpendicular(heading)`. Each
sample is `Σ falloff(d, radius) × stock / full` over the flowers. The v1 radius default is 8 tiles, set in the
v1 world config. The v0 path keeps `stimulus.radius` = 3 and `senseAt`, unchanged.

**Why**: ADR 003 W3 requires the two points and stock weighting. The sample is the existing `falloff`, shared
with the odour layer (specs/007). `falloff` is linear, so the left-right difference is small, which the ADR
accepts, and the brain's contrast (adaptation and lateral inhibition) is what makes it usable.

**Alternative considered**: a steeper falloff (quadratic). Rejected for this plan: it changes the odour layer that
the user already sees, and ADR 003 names only the radius change. Calibration can revisit it (Q5).

## R8. Forager body: forward and backward speed, turning from the turn pair

**Decision**: `body.js` keeps `stepBody` (tank drive) unchanged. A new `stepForagerBody(body, drives, env)` takes
`forward`, `backward`, `turnLeft`, `turnRight` in [0, 1] and applies ADR 003 W4:
`v = maxSpeed × clamp(forward − backward, −1, 1)` and `ω = turnRate × s × (turnLeft − turnRight)`. The sign `s`
is fixed by a unit test that puts an odour source on the fly's left and checks that a `turnLeft`-only drive
turns toward it. `s` is set by that test, not by reading the formula.

**Why**: The body is a pure function, so the sign question from ADR 003 W4 has a direct test. The tank body is not
touched, so v0 motion is identical.

## R9. Multi-stepping: `stepsPerTick` runs inside the runner

**Decision**: The v1 runner loops `lifStep` `stepsPerTick` times per sense message, with the same external drive,
and averages the outputs over the steps. Output EMAs update once per LIF step (ADR 003 L5). The worker sends one motor
message per tick, as before.

**Why**: Keeps the worker protocol at one message per tick (the host's tick accounting depends on that). The
LIF core does not know about ticks.

**Cost check**: ADR 003 estimates about 0.4M neuron updates per second for six flies at `stepsPerTick = 5`.
Gate B measures the real cost. The plan records the measured budget, and a lower `stepsPerTick` is a config
change, not a design change.

## R10. Extraction config: one file per format, dispatch on `formatVersion` and `kind`

**Decision**: Two config shapes are accepted by one loader. `formatVersion: 2` with no `kind` is the ADR 002
small brain and writes container version 3. `formatVersion: 3` with `kind: "forager"` is the ADR 003 brain and
writes container version 4. Any other combination stops with `E-CONFIG` and writes no file. The existing
`extract/configs/*.json` keep their meaning.

**Why**: The user asked for the extractor to produce multiple brain formats. A dispatch on the declared format
keeps one command (`python -m malecns_brain extract --config ...`) and makes each output reproducible from
its config.

**Alternative considered**: a separate command per format. Rejected: duplicates the CLI, and the
provenance and the self-check are the same for both.

**Config carries `capabilities`**: The forager config includes a `capabilities` block for the labels the panel
shows. The extractor checks its ids and drives against the `inputs` and `outputs` pool declarations and stops
with `E-CONFIG` on a mismatch, so the labels cannot drift from the pools.

## R11. Selection for the forager: flow ranking with numpy

**Decision**: The forager selection (`selection_forager.py`) uses the ADR 003 D3 steps: forward flow from the input
pools for `flowSteps` steps with `Wᶠ`, backward flow to the output pools with `Wᵇ`, score `√(F·B)` per pathway,
keep the top budget per pathway, union with ties on the smallest `bodyId`, exclude the sensory classes and superclasses,
induced subgraph, output outgoing edges dropped. The flow runs on the restricted edge table with float64 vectors
(one value per admitted body), using the edge arrays from `dataset.stream_edges`.

**Why**: The flow is linear in the edge table, so it is a few sparse matrix-vector products per step. numpy's
`bincount` with weights does this without a sparse-matrix dependency, which the constitution's simplicity
principle favours.

**Determinism**: every sort uses an explicit key ending in `bodyId`. The flow iteration count is fixed (`flowSteps`), not
run to convergence, so the result does not depend on a float tolerance.

**Memory**: the restricted edge table is the cost. ADR 003 Annex A does not report peak memory, so this is not measured yet.
The 22,082,410 traced-only edges, before restriction, are the upper bound. Keeping `int32` for ids and `uint16` for
synapse counts (the container already caps synapses at 65,535) gives about 10 bytes per edge, about 220 MB at the full
count, against about 530 MB for an `int64` table. The restricted table is smaller. Gate A records the peak resident
size; `extract/tests/bench_full_admitted.py` is the starting point for that measurement.

## R12. Output admission: outputs keep their edges even with a low-confidence transmitter

**Decision**: An output body is admitted when it is Traced and in an output pool, whatever its transmitter. If the
transmitter is unmapped or below `minConfidence`, its sign is 0 and its outgoing edges are dropped (ADR 003 D2).
Input and interneuron bodies keep the ADR 002 D4 rule, unchanged.

**Why**: MN9 L (body 10331) is `unclear` at 0.49 and would otherwise be lost, leaving the feeding output with one side.

**Alternative considered**: lowering `minConfidence` globally. Rejected: it would admit low-confidence interneurons, which
ADR 002 excludes on purpose.

## R13. Experiment: arms share one world and seeds, eating metrics are per bout

**Decision**: `scripts/compare-baseline.mjs` gains `--brains=` (default: every arm whose snapshot exists) and the
forager metrics. Arms: `mock` (toy), `v0` (small snapshot), `v1` (forager snapshot), `random-matched` (size-matched to
the v1 graph, with v1 LIF and runner), and `baseline` (random walk). Metrics run over held-out seeds, separate from
calibration seeds (ADR 003 Q5). Eating bouts are counted on the host from `eat` events.

**Why**: The user's goal is comparison. One script with one set of seeds and one world is the only way the arms
are comparable. The random-matched arm is the control that separates the connectome from a random graph of the
same size (ADR 003 Gate C).

**Calibration seeds**: the existing experiment seeds (1–5) stay the calibration set. The held-out set is 30 seeds
(as in the ADR 002 sweep), defined in the experiment config and recorded with each run.

## R14. Brain choice in the world config

**Decision**: `flies.brain.version` ∈ `mock`, `v0`, `v1`. When it is absent, the version is inferred (spec FR-002):
no `snapshot` → `mock`, `snapshot` present → `v0`. A `v1` snapshot is checked against the container version (4) and a
`v0` one against version 3. `flies.brain.version` set to `v1` with a version 3 file (or the reverse) stops the world with
a message naming both (spec FR-003). `world-forager.json` is the new world file. `world.json`,
`world-connectome.json` and `world-antennal-lobe.json` keep their content.

**Why**: One key chooses the whole brain stack (LIF, runner, protocol, snapshot reader), so the choice cannot be split
across keys that disagree.

## R15. Panel: the action label and the energy row

**Decision**: The Action section keeps its label. For the forager the label comes from the drives: `Eat` when the
fly is eating this tick, else `Forward`, `Turn left`, `Turn right`, `Backward`, or `Idle` by the existing thresholds.
The Action section also shows energy and hunger as a bar pair (ADR 003 W1). The bar is a new row component, not a
change to the channel rows. Tank flies keep the existing label.

**Why**: The panel reads outputs by declaration (Principle VI), so the action derives from the declared drives.
Energy is a body value, not a brain output, so it gets its own row and is not declared as a channel.

## R16. Brain inspector: forager snapshots read through the same parser

**Decision**: `public/brains/js/main.js` already calls `parseSnapshot`. It gets the version dispatch for free. The
manifest (`brains.json`) adds the forager entry. Pools are shown as groups by `channel` (ADR 003 W5), using the
existing group rendering with `channel` as the key.

**Why**: The inspector must keep reading every snapshot, and the parser is the one place that knows the versions.

## R17. Unknowns this plan does not resolve

- **Calibration values** (`synapticScale` under `postFraction`, `tauSyn`, `tauAdapt`, `adaptStep`, `thresholdJitter`,
  `stepsPerTick`, the modulator gains, `consumeRate`, `regrowth`, `eatSpeed`): set by calibration on calibration seeds.
  Calibration is a task in `tasks.md`, not design work.
- **Glomeruli, sugar and glutamate sign** (ADR 003 Q1–Q3): config choices, recorded with the first run.
- **Feeding output thin (MN9)** (ADR 003 Q4): measured in Gate A; the fix is a config change.
- **Learning** (ADR 003 Q6): out of scope.

## Sources

- [ADR 003](../../adrs/003-hungry-forager-brain.md), decisions D1–D7, L1–L5, W1–W5 and Annex A.
- [ADR 002](../../adrs/002-smallest-functional-brain.md) and specs 006/007 contracts (snapshot v3, protocol v2,
  channel declaration).
- Dataset schema read on 2026-10-05 from `data/malecns` with pyarrow 25.0.1: annotations carry `class`, `subclass`,
  `rootSide`, `receptorType`, `somaLocation`, `status`, `type`; neurotransmitters carry `predicted_nt`,
  `predicted_nt_confidence`; the traced-only edges carry `body_pre`, `body_post`, `weight`.
- Baseline: `npm test` passes 257 of 257 before any change (2026-10-05).
