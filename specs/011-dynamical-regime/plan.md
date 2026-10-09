# Implementation Plan: Dynamical Regime for the Forager Brain

**Branch**: `011-dynamical-regime` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-dynamical-regime/spec.md`, designed by
[ADR 005](../../adrs/005-dynamical-regime.md).

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`calibration.md` and ADR 004 both found that no sweep of `synapticScale` (and, later, `outputScale`) ever produces
graded, non-saturated activity on the forager brain's principal pathway. ADR 005 traces this to three structural
causes a parameter sweep cannot reach, and fixes all three together with one recalibration pass:

1. `postFraction` (ADR 003 D4) normalises each neuron's input weights over its *selected* presynaptic neurons, not
   its real, dataset-admitted ones — a neuron with 20 of 1,000 real inputs selected still gets a full weight budget
   of 1. Fix: a new weight rule, `postFractionAbsolute`, normalising over the real admitted total instead
   (`selection_forager.py`).
2. No per-neuron noise or heterogeneity exists, so identically-driven, identically-initialized pools fire in
   lockstep — effectively one random draw per pool, not per neuron. Fix: a new LIF-core mechanism, `noiseAmplitude`
   (L7), default off, that adds independent per-neuron, per-step noise from its own seeded, reproducible stream.
3. Sensory resting plus hunger gain already drives ORNs several multiples of threshold with no odour present, so
   the whole odour gradient collapses to about three firing-rate levels before any odour is sensed. Fix: recalibrate
   `stimulus.resting`/`gain` (and `tau`/`vThreshold` if needed) so rest sits sub-threshold; L7's noise then supplies
   the low, non-tonic background firing this implies.
4. `synapticScale` has no in-between setting today because issues 1–3 make every neuron's drive uniform and
   deterministic before scale is even chosen. Once 1–3 land, a recalibration sweep (extending ADR 004's protocol
   with saturation, pool-synchrony and sensory-gradient diagnostics) looks for a `(synapticScale, outputScale,
   noiseAmplitude)` point with real headroom, validated on held-out seeds before being shipped.

This plan covers the extractor's weight-rule change, `lif-v1.js`'s new noise mechanism, the contract amendments both
require, and the recalibration protocol and its diagnostics — not the final calibrated numbers themselves, which are
a dated calibration-record entry produced by running that protocol (ADR 005 "Recalibration protocol"), the same
division of labor ADR 004 used for `outputScale`.

## Technical Context

**Language/Version**: Plain ES modules (native, no transpilation) for the browser/worker side, run in evergreen
browsers and Node 20+ (built-in test runner); Python 3 with pinned `pyarrow`/`numpy` for the extractor. Matches
`public/js/brain/` and `extract/malecns_brain/`.

**Primary Dependencies**: None new on either side. Reuses `public/js/world/prng.js` (already imported by `lif-v1.js`
for L3 `thresholdJitter`) for the new L7 noise stream, and `numpy`'s existing `bincount`/`searchsorted` machinery
already used by `selection_forager.py`'s flow and weight computation.

**Storage**: N/A for the LIF mechanism (in-memory simulation parameter). The weight-rule change affects the
generated `.brain` snapshot file (`public/brains/forager-brain.brain`, a committed small reference snapshot per
`AGENTS.md`); the MaleCNS dataset it is extracted from lives at `data/malecns` (git-ignored, present in this
environment) and is never committed.

**Testing**: `npm test` (`node --test tests/*.test.mjs`, no install) for the LIF core, brain runner, and world
validation; `cd extract && .venv/bin/python -m unittest discover -s tests -t .` for the extractor's weight-rule and
config-dispatch changes. New assertions land in `tests/lif-v1.test.mjs` (L7, synthetic graphs), a Python test module
under `extract/tests/` for the new `weightRule` value, and `extract/tests/` config-dispatch tests for the extended
`extract-config-forager.md` key. `tests/lif-golden.test.mjs` must keep passing unmodified (G1 regression,
`noiseAmplitude: 0` is a true no-op).

**Target Platform**: Browser (evergreen Chrome/Firefox/Safari) for the app and the worker; Node 20+ for the JS test
suite; the Python extractor runs as a CLI tool, any platform with the pinned dependencies. No server-side runtime.

**Project Type**: Single static web app (`public/`) plus a Python extractor (`extract/`) in the same repository.
This feature touches both: the extractor's weight computation, and the web app's LIF core, brain runner, and world
config validation.

**Performance Goals**: No regression to LIF step throughput beyond one additional per-neuron random draw and add
per step when `noiseAmplitude > 0` (skipped entirely, including the draw, when it is 0 — the default). No new
per-step allocation (the noise term is computed into the existing membrane-update expression, not a new buffer). No
regression to extraction runtime: the weight-rule fix reuses arrays already computed for the flow ranking
(`pre_i`, `post_i`, `syn`), adding one more `bincount` over the full admitted-body universe, not a new dataset pass.

**Constraints**: Must preserve G1 (bit-exact to `lif-v0.js` with default parameters, `tests/lif-golden.test.mjs`)
unconditionally — `noiseAmplitude: 0` must be a true no-op, same discipline as every other L-mechanism. Must keep
every snapshot built under `weightRule: "postFraction"` reading exactly as it does today — the new value is an
addition, not a redefinition (`AGENTS.md`'s contract rule: version-bump only an incompatible change, and this one
is additive). The extraction's determinism requirement (same config + dataset → byte-identical snapshot, aside from
`provenance.createdAt`) must hold under the new rule too.

**Scale/Scope**: One new extractor weight rule (`postFractionAbsolute`), one new LIF-core parameter
(`noiseAmplitude`) and its per-step PRNG stream, sized to the network's neuron count (2,878 neurons, 205,129 edges
for the shipped forager brain — unchanged counts, since neither change alters selection, only weight values and
per-step dynamics). No change to snapshot binary layout, container version, worker protocol, or the extract config's
`formatVersion`/`kind` dispatch.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Static Web, Zero Build | Plain ES module change to an existing file (`lif-v1.js`) and plain Python changes to an existing module (`selection_forager.py`, `config.py`, `container.py`); no new dependency, no build step. | PASS |
| II. One Fly, One Worker | `noiseAmplitude` is entirely inside the LIF core, which already runs inside the fly worker. No main-thread computation, no new worker-protocol message. | PASS |
| III. Connectome-Grounded Brain Snapshots | `postFractionAbsolute` still derives every weight from real synapse counts (`synapses(i→j)`) and a real admitted total (`Σ synapses(k→j)` over real, dataset-admitted presynaptic bodies) — it changes *which* total is the denominator, not the data source. No hand-wired connection is introduced anywhere in this feature. | PASS |
| IV. Configurable, Reproducible Extraction | `weightRule` stays a declarative config key (`extract/configs/forager-brain.json`); the same config and dataset still give a byte-identical snapshot apart from `provenance.createdAt` — the new rule is computed the same deterministic way as the old one, just over a different (already-available) array. | PASS |
| V. Faithful, Inspectable LIF Simulation | `noiseAmplitude` is named, documented in `LIF_V1_DEFAULTS`, validated by `resolveParams`, and off by default (ADR 005 L7). Determinism holds: the same seed gives the same noise sequence (its own dedicated `createPrng(seed)` stream), so "same seed + params → same spikes" is unaffected, just extended to cover the new stochastic term reproducibly. | PASS |
| VI. Living World, Embodied Flies | No change to how stimulus maps to sensory neurons or motor output maps to action — `stimulus.resting`/`gain` recalibration (D6) is a declared world-config value, not hidden world-code behaviour, same as every prior calibration pass. | PASS |
| VII. Simplicity | One new LIF parameter, one new extractor weight-rule value, both reusing existing machinery (`prng.js`, `bincount` over an array already computed). No new abstraction layer, no new dependency. | PASS |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-dynamical-regime/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — amendment documents; the canonical contract
│   │                     #   files they amend live under specs/008-hungry-forager-brain/contracts/ (AGENTS.md:
│   │                     #   "The latest are in specs/008-hungry-forager-brain/contracts/") and are updated in
│   │                     #   place during /speckit-implement, per the same division of labor spec 010 used for
│   │                     #   lif-v1-outputscale.md → lif-v1.md.
│   ├── lif-v1-noise.md            # L7 noiseAmplitude: parameter table addition, createNetwork/step amendment,
│   │                               #   new guarantees G11–G14
│   └── weight-rule-absolute.md    # postFractionAbsolute: extract-config-forager.md key amendment, container-v4.md
│                                   #   CSR-rule amendment, the exact selection_forager.py denominator change
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This feature is a surgical change inside the existing single-project layout (`AGENTS.md`'s `public/` + `extract/`
split); no new directory or project boundary is introduced.

```text
extract/malecns_brain/
├── selection_forager.py   # select_forager: total_in's denominator changes from bincount(dst, weights=raw, …)
│                           #   (inside-filtered, selected-only) to bincount(post_i, weights=syn, minlength=n)
│                           #   (every real, admitted presynaptic edge into the post neuron), looked up per inside
│                           #   edge as total_in_full[post_i[inside]]. No change to pre_i/post_i/syn themselves —
│                           #   they already span the full admitted-body universe (ADR 005 D4′).
├── config.py               # weightRule check accepts "postFraction" or "postFractionAbsolute" (was: exactly
│                           #   "postFraction")
└── container.py            # _check_forager's weightRule check accepts both values; _check_inflow's "≤ 1"
                             #   invariant is unchanged and still holds under the new rule

extract/configs/
└── forager-brain.json      # weightRule: "postFractionAbsolute" (recalibration step 1, ADR 005)

public/js/brain/
├── lif-v1.js               # LIF_V1_DEFAULTS gains noiseAmplitude: 0; resolveParams validates it (finite, ≥ 0);
│                           #   createNetwork builds a second, independent createPrng(seed) stream (not reused from
│                           #   thresholdJitter's) stored on net, consumed only when noiseAmplitude > 0; step()'s
│                           #   membrane-update line adds the per-neuron, per-step noise term before the threshold
│                           #   comparison
└── fly-brain-v1.js         # No change expected — noiseAmplitude becomes a legal flies.brain.lif key automatically
                             #   (validate.js derives its allow-list from LIF_V1_DEFAULTS, same mechanism as every
                             #   prior scalar L-parameter)

public/js/world/
└── validate.js             # No change expected — noiseAmplitude is a plain number like synapticScale/tauAdapt;
                             #   the existing generic isNum check on LIF keys already covers it

public/js/brain/
└── snapshot.js              # checkForager (or the equivalent header-check function) accepts weightRule ∈
                              #   {"postFraction", "postFractionAbsolute"} — was: exactly "postFraction"

public/world/
└── world-forager.json       # Recalibrated flies.stimulus.resting/gain and flies.brain.lif (synapticScale,
                              #   outputScale, new noiseAmplitude) — written only after the recalibration protocol's
                              #   held-out validation passes (ADR 005 "Recalibration protocol" step 6); not part of
                              #   this plan's own deliverable, tracked as its own calibration-record entry

specs/008-hungry-forager-brain/contracts/
├── lif-v1.md                # Gains the noiseAmplitude row, the dedicated-PRNG construction, and guarantees
│                             #   G11–G14, same shape as the existing tauSyn/tauAdapt/thresholdJitter/outputScale
│                             #   rows — updated per contracts/lif-v1-noise.md (this feature's amendment doc)
├── extract-config-forager.md # weightRule row's allowed value becomes "postFraction" | "postFractionAbsolute" —
│                             #   updated per contracts/weight-rule-absolute.md
└── container-v4.md           # weightRule header rule and the CSR section's weight formula gain the
                              #   postFractionAbsolute case — updated per contracts/weight-rule-absolute.md

specs/008-hungry-forager-brain/
└── calibration.md            # New dated entry: the ADR 005 recalibration sweep, its three diagnostics, and its
                               #   held-out verdict (ADR 005 "Recalibration protocol" step 5)

extract/tests/
└── (new test module)         # weightRule "postFractionAbsolute": a neuron with some real inputs excluded from
                               #   selection gets a smaller, not rescaled-up, total weight; "postFraction" is
                               #   unaffected and byte-identical to before; an unknown weightRule value is still
                               #   E-CONFIG

tests/
├── lif-v1.test.mjs            # New group L7: (a) default no-op — identical spike trains with noiseAmplitude
│                               #   absent vs. 0; (b) reproducibility — same seed, same noiseAmplitude > 0 ⇒
│                               #   identical spike trains across two runs; (c) desynchrony — a synthetic pool of
│                               #   identically-driven, identically-initialized neurons does not spike in lockstep
│                               #   when noiseAmplitude > 0, and does (every step, together) when it is 0;
│                               #   (d) independence — toggling thresholdJitter on/off does not change the noise
│                               #   draw sequence, and vice versa; (e) validation rejects a negative or non-numeric
│                               #   noiseAmplitude with the exact message
├── fly-brain-v1.test.mjs      # New integration test (skipped when public/brains/forager-brain.brain is absent):
│                               #   a sensory pool's per-neuron spike pattern under constant input desynchronizes
│                               #   with noiseAmplitude > 0 relative to noiseAmplitude: 0
└── lif-golden.test.mjs        # Regression only — must pass unmodified (G1)
```

**Structure Decision**: single-project, in-place modification of existing modules on both sides of the repository
split (`extract/malecns_brain/selection_forager.py`, `config.py`, `container.py` on the Python side;
`public/js/brain/lif-v1.js`, `snapshot.js` on the JS side) plus their existing contract and test files. No new
top-level directory, no new runtime dependency, no change to the snapshot's binary layout or container version.
`lif-v0.js`, `mock`, and `v0` brains are untouched. `world-forager.json`'s actual recalibrated values are a
follow-on calibration-record entry (ADR 005's protocol), not a file this plan edits directly — the same division
`010`'s plan used between the `outputScale` mechanism and its own recalibration sweep.

## Complexity Tracking

*No Constitution Check violations — this section is not needed.*
