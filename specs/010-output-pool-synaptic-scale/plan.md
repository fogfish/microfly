# Implementation Plan: Output-pool synaptic scale (`outputScale`)

**Branch**: `010-output-pool-synaptic-scale` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-output-pool-synaptic-scale/spec.md`, designed by
[ADR 004](../../adrs/004-output-pool-synaptic-scale.md).

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`forward` and `feed` are pinned near the firing ceiling almost everywhere, independent of input, because one
global `synapticScale` must be pushed high enough to drag a 2-neuron, concentrated-fan-in readout across
threshold — and that same multiplier pushes the much larger recurrent interneuron bulk into permanent
saturation (ADR 004). The fix is a second LIF-core parameter, `outputScale` (default `null`, a no-op), that
replaces `synapticScale` only for edges whose target is a declared output-role neuron. The LIF core stays
generic: it is handed an `outputNeurons` index list (already available from the snapshot's `capabilities.
channels.outputs[*].neurons`) and knows nothing about "forward" or "feed" by name. This plan covers `lif-v1.js`,
`fly-brain-v1.js`, the world-config LIF-key allow-list, and the `lif-v1.md` contract — not the actual recalibrated
values for the forager brain, which is a separate follow-on sweep (ADR 004 §"Recalibration protocol").

**Bugfix (2026-10-07, BUG-002)**: the live world's shipped `outputScale: 5` fixed `forward`/`turn-*` saturation
but, because one scale applied to every output channel alike, also starved `feed` below its firing threshold —
exactly the risk ADR 004's own "Open questions" section flagged and left unresolved. `outputScale` MUST also
accept a per-channel form (an object keyed by output-channel id) so `feed` can be calibrated independently of
`forward`/`turn`/`backward` (spec FR-010–FR-012). This changes two things the original plan assumed: (1)
`createNetwork`'s caller now needs channel-grouped neuron membership, not just a flat `outputNeurons` list, so
`fly-brain-v1.js` must pass the output channels' own `id`s and neuron lists, not a flattened array; (2)
`validate.js` DOES need a code change — its generic LIF-key loop assumed every `lif.<key>` value is a plain
number, which an object-valued `outputScale` is not (see Project Structure below).

## Technical Context

**Language/Version**: Plain ES modules (native, no transpilation), run in evergreen browsers and Node 20+ (built-in
test runner). Matches the rest of `public/js/brain/`.

**Primary Dependencies**: None new. Reuses `public/js/world/prng.js` (already imported by `lif-v1.js` for L3
jitter); no new vendored library.

**Storage**: N/A — this is an in-memory simulation parameter, not persisted data. World config JSON files
(`public/world/*.json`) are the only place it is set outside tests.

**Testing**: `node --test tests/*.test.mjs` (Node's built-in runner, no install), per `AGENTS.md`. New assertions
land in `tests/lif-v1.test.mjs` (core mechanism, synthetic graphs) and `tests/fly-brain-v1.test.mjs` (integration,
skipped when `public/brains/forager-brain.brain` is absent). `tests/lif-golden.test.mjs` must keep passing
unmodified (G1 regression).

**Target Platform**: Browser (evergreen Chrome/Firefox/Safari) for the app; Node 20+ for the test suite. No
server-side runtime.

**Project Type**: Single static web app (`public/`) plus a Python extractor (`extract/`) in the same repo. This
feature touches only the web app's brain core — no extractor change.

**Performance Goals**: No regression to LIF step throughput beyond one additional comparison per synapse delivery
in the hot loop (`step`'s inner `for (let k = offsets[i]; k < offsets[i+1]; k++)`), per ADR 004's own cost claim
and spec SC-005. No new per-step allocation.

**Constraints**: Must preserve G1 (bit-exact to `lif-v0.js` with default parameters, `tests/lif-golden.test.mjs`)
unconditionally — `outputScale: null` must be a true no-op. Must not require a world file to ever write
`"outputScale": null` (the generic `isNum` check in `validate.js` would reject literal `null`; omission already
yields the off-default, per the ADR's explicit note).

**Scale/Scope**: One new parameter (`outputScale`) and one new per-neuron mask (`outputMask`, `Uint8Array(n)`)
sized to the network's neuron count (2,878 neurons, 205,129 edges for the shipped forager brain). No change to
snapshot format, worker protocol, or extraction.

**Scale/Scope (BUG-002 amendment)**: `outputScale` resolves at `createNetwork` time to two more per-neuron
structures, both `n`-sized and built once (no per-step allocation, preserving SC-005): `outputOverride`
(`Uint8Array(n)`, 1 where this neuron's incoming edges should use the resolved per-neuron scale instead of
`synapticScale`) and `outputScaleOf` (`Float64Array(n)`, the resolved scale itself, meaningful only where
`outputOverride` is set). For a plain-number `outputScale` (today's form), every declared output neuron gets
`outputOverride = 1` and `outputScaleOf = outputScale`, identical to the pre-bugfix behavior. For an object-valued
`outputScale` (keyed by output-channel id), each neuron is resolved once against its own channel membership, in
the brain's declared channel order (FR-012): the first channel it belongs to that has an explicit entry sets
`outputScaleOf`/`outputOverride = 1`; a neuron whose channel(s) have no explicit entry keeps `outputOverride = 0`
(falls back to `synapticScale`, FR-010). The hot loop's per-edge branch is unchanged in shape — still one
comparison, reading `outputOverride`/`outputScaleOf` in place of `outputMask`/the scalar `outputScale`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Static Web, Zero Build | Plain ES module change to an existing file; no new dependency, no build step. | PASS |
| II. One Fly, One Worker | Change is entirely inside the LIF core and its caller, both of which already run inside the fly worker. No main-thread computation, no new protocol message. | PASS |
| III. Connectome-Grounded Brain Snapshots | No change to how weights, signs, or neuron identity are derived. `outputNeurons` is read from the snapshot's existing `role: 'output'` classification — not hand-picked. | PASS |
| IV. Configurable, Reproducible Extraction | No extractor change. The same snapshot and the same `brain.lif` config still give byte-identical/deterministic results. | PASS |
| V. Faithful, Inspectable LIF Simulation | `outputScale` is named, documented in `LIF_V1_DEFAULTS`, and validated by `resolveParams`, same discipline as `tauSyn`/`tauAdapt`/`thresholdJitter`. Determinism (same seed → same spikes) is unaffected: the mask is built once in `createNetwork` from `graph.outputNeurons`, no new randomness. The per-channel resolution (BUG-002) is likewise built once, deterministically, from the brain's own declared channel order — no randomness, no step-time recomputation. | PASS |
| VI. Living World, Embodied Flies | The stimulus→sensory and motor→action mapping is untouched; this only changes how strongly synapses landing on already-declared output neurons are scaled. No behavior is hidden in world code — `outputNeurons` flows from `capabilities.channels.outputs`, a snapshot-declared structure. Per-channel values are likewise keyed by the snapshot's own channel ids, not hand-picked. | PASS |
| VII. Simplicity | One parameter, one mask, one branch in an existing hot loop. No new abstraction layer. The per-channel extension (BUG-002) adds one more precomputed per-neuron array and one more `createNetwork`-time resolution pass — still no new abstraction layer, still one branch per edge in `step`. | PASS |

No violations. Complexity Tracking table is not needed.

**Bugfix (2026-10-07, BUG-002)**: re-checked after the per-channel extension — still no violations. The extra
resolution work is one-time (`createNetwork`), not per-step, so Principle V's determinism and SC-005's throughput
goal both hold unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/010-output-pool-synaptic-scale/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This feature is a small, surgical change inside the existing single-project web app (`AGENTS.md`'s `public/`
layout); no new directory or project boundary is introduced.

```text
public/js/brain/
├── lif-v1.js            # LIF core: LIF_V1_DEFAULTS gains outputScale; resolveParams validates it;
│                         #   createNetwork builds outputMask from graph.outputNeurons; step()'s spike-delivery
│                         #   line picks outputScale vs. synapticScale per edge target
│                         #   BUG-002: resolveParams also accepts an object-valued outputScale (keyed by output-
│                         #   channel id) and validates each entry is a finite number ≥ 0; createNetwork resolves
│                         #   graph.outputChannels (channel-grouped, declared order) into outputOverride/
│                         #   outputScaleOf once, and is where an outputScale entry naming a channel id absent from
│                         #   graph.outputChannels is rejected (FR-011) — the core has no other source of truth for
│                         #   which channel ids exist, the same trust/validation split G8 already uses; step()'s
│                         #   branch reads outputOverride/outputScaleOf instead of outputMask/the bare scalar
└── fly-brain-v1.js       # Forager brain runner: passes outputNeurons (flattened from
                          #   capabilities.channels.outputs[*].neurons) into createNetwork's graph argument
                          #   BUG-002: also passes outputChannels (capabilities.channels.outputs[*].{id, neurons},
                          #   in declaration order) so lif-v1.js can resolve a per-channel outputScale

public/js/world/
└── validate.js           # BUG-002: DOES need a code change, superseding the original "no change expected" note
                           #   below. flies.brain.lif.outputScale may now be a plain number (existing isNum check,
                           #   unchanged) or a plain object keyed by output-channel id, each entry validated like
                           #   any LIF number. validate.js does NOT check channel-id legitimacy against the real
                           #   brain — for a snapshot brain it never reads the .brain file at all (it already skips
                           #   capabilities validation when isSnapshot, leaving that to runtime); the unknown-
                           #   channel-id check (FR-011's other half) happens in createNetwork (lif-v1.js), which
                           #   does have the real snapshot's channel ids by the time it runs
                           # (superseded) No code change expected — outputScale becomes a legal flies.brain.lif key
                           #   automatically, since its allow-list is derived from LIF_V1_DEFAULTS; verified,
                           #   not modified (ADR 004, "World config")

specs/008-hungry-forager-brain/contracts/
└── lif-v1.md              # Contract gains the outputScale row, the outputMask construction, and the
                            #   no-op guarantee, same shape as the existing tauSyn/tauAdapt/thresholdJitter rows
                            #   BUG-002: contract amended again for the per-channel form, outputChannels, and
                            #   outputOverride/outputScaleOf, plus guarantees G9 (per-channel isolation) and
                            #   G10 (per-channel validation)

tests/
├── lif-v1.test.mjs         # New group L6: (a) default no-op, (b) isolation (synthetic graph, one output vs.
│                           #   one non-output target), (c) validation rejects invalid outputScale
│                           #   BUG-002: new L6(d)–(f): per-channel isolation (two output channels, two different
│                           #   explicit scales, a third channel falls back to synapticScale), the shared-neuron
│                           #   first-explicit-channel-wins tie-break, and validation of per-channel entries
├── fly-brain-v1.test.mjs   # New integration test: lower mean spike rate on forward/feed with outputScale set
│                           #   vs. null, skipped when public/brains/forager-brain.brain is absent
│                           #   BUG-002: new integration test — an object-valued outputScale raises feed's mean
│                           #   spike rate relative to the shared outputScale: 5 while forward's stays low
├── validate-flies.test.mjs # BUG-002: new cases — an object-valued flies.brain.lif.outputScale with valid numeric
│                           #   entries validates with no errors; a non-numeric entry is rejected, naming the
│                           #   channel (shape/numeric only — channel-id legitimacy is a createNetwork check, not
│                           #   validate.js's, since validate.js never reads a snapshot's real channel ids)
└── lif-golden.test.mjs     # Regression only — must pass unmodified (G1)
```

**Structure Decision**: single-project, in-place modification of two existing modules
(`public/js/brain/lif-v1.js`, `public/js/brain/fly-brain-v1.js`) plus their existing contract and test files. No
new top-level directory, no new runtime dependency, no change to the snapshot format or the worker protocol.
`lif-v0.js` and `mock`/`v0` brains are untouched, per the ADR's own "old brains keep working" constraint.
**(BUG-002 amendment)**: `public/js/world/validate.js` is added to this list — it now needs a real code change
(above), not just verification — and `tests/validate-flies.test.mjs` is added as a touched test file. Still no new
top-level directory, no new runtime dependency.

## Complexity Tracking

*No Constitution Check violations — this section is not needed.*

**Bugfix**: 2026-10-07 — BUG-002 Updated from bugfix patch. One shared `outputScale` for every output channel
could not satisfy both `forward` and `feed` at once (confirmed on the live world). `outputScale` must also accept
a per-channel form; `fly-brain-v1.js` must pass channel-grouped membership, not just a flat neuron list; and
`validate.js` needs a real code change, not just verification, to accept and validate an object-valued entry.
