# Implementation Plan: Cautious Forager Brain (15K, LIF v2)

**Branch**: `013-forager-brain-15k-lif-v2` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-forager-brain-15k-lif-v2/spec.md`, designed by
[ADR 006](../../adrs/006-cautious-forager-brain-15k.md), plus planning input: "Write an utility to parse malecns
dataset, extract the brain as defined by ADR 006-cautious-forager-brain-15k.md. Preserve compatibility of the
simulator with previous versions allowing user to choose between previous versions. Integrate new sensors with UI."

## Summary

Build the ADR 006 brain (~15K neurons, 12 inputs, 6 outputs) end to end, beside `mock`, `v0` and `v1`, which must stay
exactly as they are.

- **Extractor** (Python): a new extraction-config `formatVersion: 4` (kind `forager`, distinct from today's
  `formatVersion: 3` used by the v1 config) drives a new selection module implementing D8–D13: six bilateral senses,
  pathway × output-group pair budgets, transmitter-source fallback admission, anchors/exclusions, and
  `synapseCount` weights. It writes a new **container version 5** (ADR 006 W9) — this is a different axis from the
  extraction-config format number and this plan keeps the two distinct throughout.
- **Simulator** (browser, pure JS): `lif-v0.js`, `fly-brain-v0.js`, `lif-v1.js` and `fly-brain-v1.js` are untouched in
  behaviour. `lif-v1.js` gains one off-by-default parameter, `groupGain` (L10), shared with a new runner,
  `fly-brain-v2.js`, which also owns Poisson input encoding (L9, its own seeded stream) and reads the sixth output,
  `escape`. A pre-existing wrinkle in `worker-core.js` (`handleV1` hard-codes brain version `'v1'` and container
  version `4`) is generalised so protocol v3 can carry a v2 brain too — the protocol itself does not change.
- **World and body**: senses and body sites become declared data (`flies.stimuli`, `flies.body.sites`, ADR 006 W6–W7)
  instead of the four-input constant `senseForagerFly` has today; a new escape jump (W8) is added to `body.js`,
  gated by the brain's `escape` output and a cooldown held by the host. v1 worlds keep their existing hard-coded
  sense path untouched.
- **Choice**: the existing single config key, `flies.brain.version`, gains a fourth value, `v2`. Existing `mock`,
  `v0` and `v1` world files work unchanged.
- **Panel**: the existing generic per-declaration channel rows (`channels.js`) already render any number of inputs
  and outputs with no change, so the 12-input/6-output panel for v2 needs no new row-rendering code — only a new
  **region-activity** section (FR-030), gated by a capability that only v5 containers carry, so v0/v1 panels are
  unaffected by construction.
- **Comparison**: the experiment script gains the `v2` arm and the brake/avoid/touch/escape/rest metrics (ADR 006
  Gate C), reported — not gated — against the random-graph and random-walk arms.

Design decisions and their reasons are in [research.md](research.md). Entities are in [data-model.md](data-model.md).
Formats are in [contracts/](contracts/). The runnable guide is [quickstart.md](quickstart.md).

**Bugfix**: 2026-10-10 — [BUG-001](bugs/BUG-001.md) found that Phase 1's D11 pair-grid selection (R4) admits a
`forward` output pool whose net synaptic weight is inhibitory, so no `v2` world can walk forward at any LIF
setting. Phase 1 is reopened (T091–T097): a design decision (sign-aware D11 score vs. a widened D9 `forward`
pool), a code fix, a re-extraction and a fresh calibration pass are all needed before Phases 3/4/11 (US1/US2/US9)
can be re-validated. See the new Risk entry below.

## Technical Context

**Language/Version**: JavaScript ES2022 (browser ES modules, Node 20+ for tests). Python 3.14 with the extractor's
own environment (`extract/.venv`).

**Primary Dependencies**: None new. Browser: Canvas 2D, Web Workers, typed arrays, three.js (vendored, unchanged).
Python: `pyarrow`, `numpy` (already pinned in `extract/requirements.txt`).

**Storage**: A new snapshot file, `public/brains/forager-brain-15k.brain` (committed, ~25 MB raw at `minSynapses: 1`,
per ADR 006 A7). Dataset is external (`data/malecns`, not committed, configured by `MALECNS_DIR`).

**Testing**:
- JavaScript: `npm test` (Node built-in runner, `tests/*.test.mjs`). Must stay green for every existing test.
- Python: `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract`. Must stay green for every
  existing test.
- Golden and equality tests: `tests/lif-golden.test.mjs` (imports only `lif-v0.js`, untouched by construction);
  `tests/lif-v1.test.mjs`'s G1 guarantee (bit-exact with every v1 mechanism off), extended with the same guarantee
  for `groupGain: {}`.
- Gate A (extractor counts/determinism/report), Gate B (browser tick cost), Gate C (behaviour metrics) are recorded
  runs, described in [quickstart.md](quickstart.md), per ADR 006's Acceptance section.

**Target Platform**: Evergreen browsers (module workers, typed arrays). Extractor: macOS and Linux with Python 3.14.

**Project Type**: Static web app (browser simulator) plus a Python extraction pipeline. The app stays buildless
(Principle I).

**Performance Goals**:
- Extraction: the ADR 006 config completes on the full dataset in the same order of time as the existing forager
  config (ADR 006 Annex A3: ~10 s, 2.7 GB peak resident for the prototype's selection step; the shipping extractor's
  streamed-edge pass is the Gate A reference and is measured, not assumed).
- Simulator: six v2 flies at the configured tick rate keep the main thread responsive (ADR 006 Gate B); measured
  per-tick cost is recorded (ADR 006 Annex A6 found 1.9–9.4 ms per tick at `stepsPerTick: 10`, well inside a 50 ms
  world tick).

**Constraints**:
- No neural computation on the main thread (Principle II).
- No change to a `mock`/`v0`/`v1` result: existing files, worlds, golden test and experiment arms stay byte- and
  value-identical (spec FR-014, SC-004, SC-005).
- Dataset rows are streamed and column-selected, never loaded whole (Principle IV); the ADR 006 edge table is an
  order of magnitude larger than v1's (2.0M vs 0.2M edges), so this constraint is load-bearing, not incidental.
- Every sort and every tie has an explicit key ending in `bodyId` (determinism; self-check re-run byte-compares).
- The world never steers, stops or feeds a fly (Principle VI); braking, avoiding, touch response and escaping must
  all arise from the brain's outputs, read through declared channels (spec FR-023, FR-025).

**Scale/Scope**:
- ADR 006 brain: 12,000–18,000 neurons, ~2.0M edges at `minSynapses: 1` (ADR 006 Annex A3, `perPair: 2400`).
- Twelve input channels (six bilateral senses), six output channels (five existing drives plus `escape`).
- Six flies by default, as today; the panel's new region-activity section groups neurons into six regions (input,
  output, antennal lobe, ventral nerve cord, descending neurons, the rest — ADR 006 L10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` (version 1.0.0, principles I–VII).

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Static Web, Zero Build | Pass | No build step, no new runtime dependency. The 15K snapshot and its world file are static files. |
| II. One Fly, One Worker | Pass | Each v2 fly keeps its own worker. Escape cooldown state lives in the host (the world's owner), not in a worker. Protocol stays v3, already documented. |
| III. Connectome-Grounded Brain Snapshots | Pass | Container v5 records provenance, config hash and dataset release as v4 does. Weights are synapse counts (D13); sign comes from a declared, ordered transmitter-source column (D10), recorded per neuron for traceability. The new labelled synthetic test fixture stays out of `public/brains/`. |
| IV. Configurable, Reproducible Extraction | Pass | Every pool, budget, anchor, exclusion, transmitter-source order and edge threshold is config (D8–D13). Same config and dataset give byte-identical output apart from `createdAt` (self-check, unchanged mechanism). Edges stream column-selected and filtered to admitted ids, as today, at ten times the row count. |
| V. Faithful, Inspectable LIF Simulation | Pass | `groupGain` is named in `LIF_V1_DEFAULTS`, validated, and off by default; the runner's Poisson encoding is seeded from its own reproducible stream, independent of jitter/noise. The core stays pure (L9 lives in the runner, per ADR 006 L9's own statement). Telemetry gains per-region activity and the escape output. |
| VI. Living World, Embodied Flies | Pass | Senses and body sites are declared data (`flies.stimuli`, `flies.body.sites`, W6–W7), read by the brain through channels; the world never decides braking, avoidance, touch response or escape — those are the brain's outputs, physically realised (W8) with no scripted override. |
| VII. Simplicity | Pass with justification | See Complexity Tracking: one new extraction-config format, one new container version, one new runner, and declared-sense/body-site machinery are the minimum that keeps `mock`/`v0`/`v1` available unchanged while making the comparison possible. |

**Result**: no unjustified violation.

### Gate notes

- **Principle III, synthetic fixtures**: `extract/tests/fixtures/forager-15k-synthetic.json` and a matching small
  `.brain` test fixture are labelled synthetic in their names and headers, and are never written to `public/brains/`.
- **Principle VI, escape gate**: the escape jump fires only when the brain's own `escape` output crosses a
  configured threshold outside cooldown (FR-024); the world supplies the threshold and the physics, not the
  decision to escape.

## Re-check after Phase 1 design

All contract amendments keep the v0/v1/mock formats untouched — the new container version, extraction-config
format, runner and world-config sections are additive, dispatched by the existing `flies.brain.version` switch
point and the existing `format_of`/container-version checks generalised to a third value. No new unjustified
complexity was added in design. **Result: pass.**

## Project Structure

### Documentation (this feature)

```text
specs/013-forager-brain-15k-lif-v2/
├── spec.md                              # /speckit-specify output
├── plan.md                              # this file
├── research.md                          # Phase 0 decisions R1–R12
├── data-model.md                        # Phase 1 entities and state rules
├── quickstart.md                        # Phase 1 runnable validation guide
├── contracts/                           # amendment documents; the canonical files they amend live under
│   │                                     #   specs/008-hungry-forager-brain/contracts/ and specs/006-fly-status-
│   │                                     #   panel/contracts/ (AGENTS.md: "The latest are in specs/008-...") and
│   │                                     #   are updated in place during /speckit-implement, the division of
│   │                                     #   labor specs 010 and 011 already used.
│   ├── extract-config-forager-v2.md     # amends extract-config-forager.md: formatVersion 4, D8–D14 keys, codes
│   ├── container-v5.md                  # amends container-v4.md: group/transmitterSource/sense/site fields
│   ├── channel-declaration-v5.md        # amends channel-declaration-v4.md: sense/site, 6-drive escape tuple
│   ├── lif-v1-groupgain.md              # amends lif-v1.md: L10 groupGain, no-op-default guarantee
│   ├── world-config-forager-v2.md       # amends world-config-forager.md: stimuli, body.sites, body.escape, brain.input
│   ├── experiment-metrics-v2.md         # amends experiment-metrics.md: brake/avoid/touch/escape/rest, v2 arm
│   └── panel-sections-v2.md             # amends specs/006's panel-sections.md: region-activity section, escape label
├── checklists/requirements.md
└── tasks.md                              # /speckit-tasks output (not created here)
```

### Source Code (repository root)

This feature is a surgical addition inside the existing single-project layout (`AGENTS.md`'s `extract/` + `public/`
split); no new directory or project boundary is introduced.

```text
extract/
├── configs/
│   ├── smallest-functional-brain.json    # unchanged (format 2, container 3)
│   ├── forager-brain.json                # unchanged (format 3, container 4)
│   └── forager-brain-15k.json             # NEW (format 4, kind forager, container 5) — ADR 006 D14
├── malecns_brain/
│   ├── __main__.py                       # CHANGED: dispatch on formatVersion 4; report_forager_v2
│   ├── config.py                         # CHANGED: formatVersion ∈ {2,3,4}; FORAGER_KEYS_V2; transmitterSource/
│   │                                      #   anchors/excludeInterneuronClasses/minSynapses/outputGroups/
│   │                                      #   budget.perPair schema; E-TRANSMITTER-SOURCE on config read
│   ├── dataset.py                        # CHANGED: NEUROTRANSMITTER_COLUMNS gains ground_truth, consensus_nt;
│   │                                      #   FORAGER_ANNOTATION_COLUMNS gains entryNerve (D8 taste-leg/touch)
│   ├── admission.py                      # CHANGED: resolve_transmitter_sign(row, source_order) — D10 ordered
│   │                                      #   column fallback, used beside the existing predicted_nt-only path
│   │                                      #   (admission.py's v1 function stays as is for format 3)
│   ├── selection_forager_v2.py           # NEW: D8 six-sense pools incl. side-match flags per pool; D9 six
│   │                                      #   outputs; D11 pathway×outputGroup pair-grid scoring/budgets; D12
│   │                                      #   anchors/whole-class exclusions; D13 synapseCount weights +
│   │                                      #   minSynapses; per-neuron region (L10 taxonomy, container field)
│   ├── selection_forager.py               # unchanged (format 3, container v4)
│   ├── capabilities.py                   # CHANGED: validate_capabilities_v5 (R1–R8 plus sense/site, 6-drive
│   │                                      #   FORAGER_DRIVES_V2 tuple incl. "escape")
│   ├── container.py                       # CHANGED: FORMAT_VERSION_V5 = 5; SUPPORTED_VERSIONS = (3,4,5);
│   │                                      #   _check_forager_v2 (group/transmitterSource per neuron, anchors/
│   │                                      #   minSynapses header, weightRule accepts "synapseCount")
│   └── errors.py                          # CHANGED: E-POOL-OVERLAP, E-ANCHOR-EMPTY, E-TRANSMITTER-SOURCE,
│                                           #   E-PAIR-EMPTY
└── tests/
    ├── fixtures/
    │   └── forager-15k-synthetic.json     # NEW: labelled synthetic six-sense pools, pair grid, anchor, codes
    ├── test_selection_forager_v2.py       # NEW
    ├── test_forager_v2_failures.py        # NEW: one test per new + reused failure code
    ├── test_container_v5.py               # NEW: write/read, invariants, group/transmitterSource/escape fields
    ├── test_capabilities_v5.py            # NEW: sense/site rules, 6-drive tuple
    ├── test_config_forager_v2.py          # NEW: formatVersion 4 dispatch, schema keys, E-TRANSMITTER-SOURCE
    ├── test_forager_v2_determinism.py     # NEW: byte-identical rerun apart from createdAt
    └── bench_forager_v2.py                # NEW: Gate A timing/memory at 15K scale

public/
├── brains/
│   ├── forager-brain-15k.brain            # NEW (generated by the extractor, committed)
│   └── brains.json                        # CHANGED: adds the 15K entry (manifest version 1 unchanged)
├── world/
│   ├── world-forager-15k.json             # NEW: v2 world — brain.version "v2", stimuli, body.sites, body.escape
│   ├── world-forager-15k-bad.json         # NEW: test fixture, v2 naming a v4 (not v5) file (must refuse)
│   └── README.md                          # CHANGED: v2 row in the brain-version table; 15K calibration section
├── tests/
│   └── forager-v2-timing.html             # NEW: Gate B browser harness (six v2 flies, tick timings)
└── js/
    ├── brain/
    │   ├── lif-v1.js                      # CHANGED: LIF_V1_DEFAULTS gains groupGain: {} (L10); resolveParams
    │   │                                   #   validates it as {group: nonNegativeNumber}; createNetwork resolves
    │   │                                   #   graph.neuronGroup × groupGain into a per-neuron scale array once;
    │   │                                   #   step()'s single edge-delivery line looks it up (same pattern as
    │   │                                   #   outputScale/outputOverride, line ~205) — a no-op when {} (G1-style)
    │   ├── fly-brain.js                    # CHANGED: dispatcher gains `if (version === 'v2') return
    │   │                                   #   createV2FlyBrain(...)`, importing fly-brain-v2.js
    │   ├── fly-brain-v2.js                 # NEW: runner for container v5 — Poisson input encoding (L9, its own
    │   │                                   #   seeded PRNG stream, independent of jitter/noise), stepsPerTick loop
    │   │                                   #   over lif-v1.js with graph.neuronGroup threaded through, EMA output
    │   │                                   #   tracking generalised to 6 channels incl. escape
    │   ├── fly-brain-v1.js                 # unchanged
    │   ├── protocol-v3.js                  # unchanged (sense.inputs/motor.outputs already generic by declared
    │   │                                   #   length; no protocol version bump — ADR 006 W9)
    │   ├── worker-core.js                  # CHANGED: handleV1 generalised to read msg.brain.version instead of
    │   │                                   #   hard-coding 'v1', and to accept the container version
    │   │                                   #   checkBrainVersion's map says matches that version (4 for v1, 5 for
    │   │                                   #   v2), instead of a local hard-coded 4 — a bug-fix-shaped
    │   │                                   #   generalisation, not a new protocol branch
    │   ├── capabilities.js                 # CHANGED: v5 rules beside v4; v3/v4 unchanged
    │   └── snapshot.js                     # CHANGED: FORMAT_VERSIONS gains 5; checkBrainVersion map gains v2:5;
    │                                       #   a version-5 branch (group/transmitterSource/sense/site/escape
    │                                       #   checks); shared CSR/section code untouched
    ├── fly/
    │   ├── stimulus.js                     # CHANGED: resolveDeclaredStimulus(sense, site, flies.stimuli) added
    │   │                                   #   beside the existing senseBilateral/senseAt (v0/v1 paths untouched);
    │   │                                   #   reuses the existing falloff()
    │   ├── body.js                         # CHANGED: resolveBodySites (W7 antenna/mouth/front-leg offsets) and
    │   │                                   #   jumpForagerBody (W8 escape physics: fixed distance along heading,
    │   │                                   #   stop at first non-walkable cell) added; stepForagerBody unchanged
    │   ├── forager-step.js                 # CHANGED: senseForagerFlyV2 added (declared per-channel sense/site
    │   │                                   #   loop) beside the unchanged senseForagerFly; applyForagerMotor
    │   │                                   #   gains an escape branch reading drives.escape against threshold and
    │   │                                   #   cooldown
    │   ├── metrics.js                      # CHANGED: brake/avoid/touch/escape/rest metric functions (pure),
    │   │                                   #   beside the unchanged find/approach/eat/leave metrics
    │   ├── fly-config.js                   # CHANGED: defaults for body.sites, body.escape, stimuli, brain.input
    │   │                                   #   merged only when declared; resolveBrainVersion untouched
    │   ├── fly-world.js                    # CHANGED: reads flies.stimuli source declarations (dangers, as well
    │   │                                   #   as edibles) into the per-tick stimulus lookup
    │   └── fly-host.js                     # CHANGED: protocol-v3 dispatch for 'v2' (reuses the v1 path, generic
    │                                       #   by declared length); escape cooldown state per fly
    ├── ui/panel/
    │   ├── model.js                        # CHANGED: diagnostic block reads drives.escape when present (v2 only,
    │   │                                   #   guarded, no change to the v1 diagnostic shape)
    │   ├── action.js                       # CHANGED: an escape label case alongside the existing forageAction
    │   │                                   #   cases, driven by a per-tick escaped flag from fly-host.js
    │   ├── channels.js, channel-rows.js    # unchanged — already render any declared channel count/order (FR-029)
    │   └── sections/
    │       ├── region-activity.js          # NEW: one row per declared region (input/output/al/vnc/dn/central),
    │       │                               #   requires: {groups: true} (unmet for v0/v1 → no row, FR-031)
    │       └── index.js                    # CHANGED: registers region-activity in SECTIONS
    └── world/
        └── validate.js                     # CHANGED: BRAIN_VERSIONS gains 'v2'; flies.stimuli, flies.body.sites,
                                             #   flies.body.escape, brain.input schema validation; undeclared-sense
                                             #   error (FR-021); v2 gated against LIF_V1_DEFAULTS as v1 is

scripts/
└── compare-baseline.mjs                    # CHANGED: --brains accepts v2; brake/avoid/touch/escape/rest columns
                                             #   per arm, random-graph and random-walk arms unchanged

tests/
├── lif-golden.test.mjs                     # unchanged (imports lif-v0.js only)
├── lif-v1.test.mjs                         # CHANGED: appends the groupGain: {} no-op guarantee (G1-style)
├── lif-v1-groupgain.test.mjs               # NEW: per-group scale, graph.neuronGroup wiring
├── fly-brain-v2.test.mjs                   # NEW: Poisson rate mapping, reproducibility, stream independence (L9)
├── snapshot-v5.test.mjs                    # NEW: parse, roles, group/transmitterSource, escape drive, dispatch
├── capabilities-v5.test.mjs                # NEW: sense/site rules, 6-drive messages
├── worker-core-v2.test.mjs                 # NEW: a v2 message round-trips under protocol v3 with container v5;
│                                           #   a stale message forcing 'v1' semantics on a v5 container is rejected
├── stimulus-declared.test.mjs              # NEW: declared sense/site mapping, undeclared-sense world-start error
├── body-escape.test.mjs                    # NEW: jump distance, cooldown, stop-at-first-non-walkable
├── fly-config-brain-v2.test.mjs            # NEW: version inference untouched; v2 defaults; mismatch refusal
├── metrics-v2.test.mjs                     # NEW: brake/avoid/touch/escape/rest (pure functions)
├── panel-region-activity.test.mjs          # NEW: section renders for v2 capabilities, absent for v0/v1
└── …existing tests                          # unchanged expected values
```

**Structure decision**: `lif-v1.js` gains the one new core parameter in place (ADR 006 W9 says so explicitly: "LIF
core: `lif-v1.js` gains L10"), because L10 is a shared mechanism, not a v2-only model — the same single-branch
pattern L6 (`outputScale`) already established keeps it a no-op for every existing caller. Everything else that is
v2-specific gets its own file beside the v1 equivalent (`fly-brain-v2.js`, `senseForagerFlyV2`,
`selection_forager_v2.py`, container/capabilities `_v5`/`_v2` functions), following the same "two files, not one
branched file" precedent spec 008 used to keep v0 byte-identical — here it keeps v1 byte-identical instead. The one
exception that is a genuine bug fix rather than new functionality is `worker-core.js`'s `handleV1`: it already
hard-codes assumptions (`version:'v1'`, container version 4) that would silently miscompute for a v2 brain sharing
its protocol, so it is generalised rather than duplicated a third time.

## Phases

The plan is ordered so each phase leaves `mock`/`v0`/`v1` green. `tasks.md` (from `/speckit-tasks`) turns these into
tasks.

1. **Extractor, six-sense selection (format 4, container v5)**: `dataset.py` column additions, `admission.py`'s
   transmitter-source fallback, `selection_forager_v2.py` (D8–D13), `errors.py`'s four new codes, `container.py`/
   `capabilities.py` v5 support. Synthetic fixture and failure-code tests first, then the real v1.0 run (Gate A).
   **Reopened by BUG-001**: D11's score (`selection_forager_v2.py`'s pair-grid step) must become sign-aware for
   `forward`, or D9's `forward` pool must widen, before the real run (T023) can be trusted; FR-032/SC-012 add a
   net-sign check and report line to this phase.
2. **LIF core, L10**: `groupGain` added to `lif-v1.js` with the no-op-default guarantee proven before anything else
   touches it (same order spec 008 used for G1).
3. **Runner, protocol dispatch and worker fix**: `fly-brain-v2.js` (L9 Poisson encoding, `graph.neuronGroup`
   threading, 6-channel EMA output tracking), `fly-brain.js` dispatcher, the `worker-core.js` generalisation, v5
   parse in `snapshot.js`.
4. **Body, world and declared senses**: `flies.stimuli`/`flies.body.sites` validation and resolution,
   `senseForagerFlyV2`, `jumpForagerBody` and its cooldown, `fly-host.js` wiring. Sense/escape unit tests before the
   host wiring, as spec 008 ordered eating tests before host wiring.
5. **Panel**: region-activity section (new), escape diagnostic and action label, `brains.json`/world config entries.
   Verified in a real browser session per the Run check (AGENTS.md), not only by unit test.
6. **Experiment**: `v2` arm, brake/avoid/touch/escape/rest metrics in `metrics.js`, `compare-baseline.mjs` columns.
   Gate C run on held-out seeds.
7. **Calibration and Gate B**: calibration on calibration seeds only (ADR 006's three calibration-protocol changes:
   start from L11's published values, per-group A1 gates plus the brake/feed clamp gates, the two-weight-rule arm
   comparison), recorded with the run; browser timing harness for the six-fly tick-cost measurement.

## Risks

- **Flow selection at 15K is an order of magnitude more expensive to compute and to re-run deterministically**
  (ADR 006 Annex A3/A6: ~10 s / 2.7 GB for the prototype's flow step alone, against v1's near-instant equivalent).
  Mitigation: the streamed-edge, column-selected pattern Principle IV already requires; Gate A measures the
  shipping extractor's actual cost, not the prototype's.
- **`escape` as a sixth drive touches every place that currently assumes five forager drives**
  (`KIND_DRIVES`/`FORAGER_DRIVES`, `validateMotorV3`'s length check, the panel's diagnostic). Mitigation: the length
  checks are already generic (confirmed by inspection), so the risk is narrowed to the two explicit 5-tuples in
  `capabilities.py`/`capabilities.js`, each given its own v5 variant rather than mutated in place.
- **`worker-core.js`'s `handleV1` hard-codes `'v1'` and container version 4.** Left unfixed, a v2 brain sharing
  protocol v3 would silently run as if it were v1 (wrong container-version check, wrong brain constructed).
  Mitigation: Phase 3 fixes this before any v2 brain is wired end to end, with a dedicated regression test
  (`worker-core-v2.test.mjs`) asserting both that v2 now works and that a v1 message still resolves to v1.
- **Declaring senses as data is a bigger change than it looks**: `senseForagerFly`'s four-input construction and
  `stimulus.js`'s single bilateral-odour function are the only sense code that exists today; six senses with
  per-channel site offsets is new machinery, not a parameter change. Mitigation: build it as `senseForagerFlyV2`,
  a sibling, not a rewrite, so v1's existing path and tests are provably untouched; unit-test the mapping before
  wiring it into the host (Phase 4 ordering).
- **Cost of ~15K neurons / ~2M edges per LIF step in the browser** may approach the tick budget on slower hardware
  even though ADR 006 Annex A6 measured headroom on an M2 Pro. Mitigation: the measured per-tick cost is recorded
  (Gate B); `stepsPerTick` and the edge threshold (`minSynapses`) are both config, so either can be turned down
  without a code change if headroom is missing.
- **Avoidance, touch and escape have no required pass/fail threshold** (ADR 006 Gate C: avoid is reported with its
  sign, not gated). Mitigation: this is intentional scope, not a gap — SC-007/SC-008 define what must be reported,
  and the spec's Assumptions section states this explicitly, so no later reviewer should read a "weak" avoid number
  as a bug.
- **Experiment runtime grows roughly an order of magnitude per arm** (ADR 006 W10 estimates 55–85 minutes for one
  full held-out-seed arm at 15K, against ~5 minutes today). Mitigation: out of this feature's required scope (the
  spec has no requirement for parallel seed execution); `compare-baseline.mjs`'s worker-threads parallelisation
  (W10) is deferred as a follow-up, run serially if needed for this feature's acceptance.
- **D11's pair-grid score ranks by flow magnitude only, with no sign term** ([BUG-001](bugs/BUG-001.md), found
  during calibration, not anticipated here): the induced subgraph it selects can leave an output pool net
  inhibitory, which no LIF parameter can correct. Measured: `forward` (`DNp09`/`DNg100`) at −867 signed
  weight/neuron, against `turn-left` +4084, `turn-right` +3874, `backward` +1093. Mitigation: ADR 006 needs an
  amendment (sign-aware scoring, or a widened `forward` pool per D9/spec Q2) before Phase 1's extraction can be
  trusted; FR-032/SC-012 add a standing check so the next brain generation catches this at Gate A, not after a
  multi-round calibration search.

## Complexity Tracking

> Constitution Check violations and the reasons they are needed.

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| VII: a second forager selection module (`selection_forager_v2.py`) beside `selection_forager.py` | D11's pathway×output-group pair-grid budget and D8's six-sense pools are a different algorithm from the existing per-pathway top-k over one pooled backward flow; the v1 format must keep producing its existing container unchanged. | Branching the existing module by format version risks changing v1's selected neuron set and breaking SC-002/byte-identical output. |
| VII: a second runner (`fly-brain-v2.js`) and dispatcher branch | Poisson input encoding (L9) and 6-channel output tracking are not expressible by `fly-brain-v1.js`'s constant-current, 5-channel contract without changing it for v1 too. | Generalising `fly-brain-v1.js` in place would change its tested contract and risk v1's bit-exact behaviour. |
| VII: container version 5 beside version 3/4 | The ADR 006 header carries `group`, `transmitterSource`, channel `sense`/`site`, and a sixth drive, none of which version 4 can express. | Changing version 4 would invalidate the existing v1 brain file and its tests (spec FR-005/SC-002). |
| VII: a second extraction-config format (4) beside format 3 | The user requires the extractor to keep producing every earlier format while adding the new one (spec FR-006). | A separate tool per format would duplicate the CLI, provenance and self-check, already rejected once in spec 008's own Complexity Tracking. |
| VII: declared-sense/body-site machinery (`flies.stimuli`, `flies.body.sites`) new to the world config | Six senses with per-channel body sites cannot be expressed by the existing single hard-coded bilateral-odour function without the world hard-coding "input 0 is left odour" — exactly what ADR 006 W6 rules out. | Hard-coding six senses by position, as today's four are, would make every future brain generation repeat the same rewrite ADR 006 itself exists to fix. |
| VII: escape physics (`jumpForagerBody`) new to `body.js` | Escape is a new, qualitatively different action (a one-tick jump with cooldown), not an extension of the existing continuous `forward`/`backward`/`turn` motion model. | Folding it into `stepForagerBody` as a fifth continuous drive would misrepresent the giant-fibre reflex ADR 006 W8 models as a discrete event. |
| Generalising `worker-core.js`'s `handleV1` (not a new file) | This is the one place a pre-existing hard-coded assumption (`'v1'`, container version 4) blocks the feature outright; duplicating it a third time for v2 would leave the same latent bug for the next brain generation. | A third near-identical `handleV2` branch would triple the code this bug lives in instead of fixing it once. |
