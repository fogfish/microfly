# Phase 0 Research: Class-Seeded Forager Brain

No `[NEEDS CLARIFICATION]` markers were left in the spec, so this phase resolves design choices the spec and ADR
006 leave to the plan, rather than open unknowns. Each item names what was decided, why, and what else was
considered.

## 1. How the new brain is reached

- **Decision**: the new brain is selected purely by pointing a new world file (`world-forager-11k.json`) at a
  new snapshot, still under `flies.brain.version: "v1"`. No new version value is added.
- **Rationale**: ADR 006 W6 states explicitly that the runner, the LIF core, the worker protocol and the channel
  declaration are unchanged from v1 — "This is the point of lesson 6." The spec's own FR-001/FR-002 and the
  user's instruction both require the existing `mock`/`v0`/`v1` mechanism to stay exactly as it is.
- **Alternatives considered**: a new version value (`v2`, or a size-qualified value). Rejected — it would imply
  a new container, protocol or LIF generation, none of which this feature changes, and it is exactly the path the
  now-withdrawn 15K/30K brains took (ADR 006's own "Supersedes" note) before being abandoned.

## 2. Extractor: a second selection strategy, not a branch inside the first

- **Decision**: add `extract/malecns_brain/selection_class_seed.py`, a new module implementing D8 (whole-class
  seeding, no budget), D9 (fill by total shared synapse weight with the seed set, ties on ascending `bodyId`),
  D10 (`allTraced` admission with a configurable transmitter-sign rule), D11 (the `minSynapses` edge threshold,
  applied before scoring, selection and weights) and D13 (the fidelity probe). `selection.py` dispatches to it
  when a config's `selection` key is `"classSeed"`, leaving `selection_forager.py` (the existing flow-ranked
  strategy) untouched for `"forager"`/absent.
- **Rationale**: ADR 006 lesson 6 ("change only the topology") and lesson 2 ("select whole functional classes,
  fill by plain connectivity, not by an objective") describe a selection philosophy that has nothing in common
  with the existing pathway-flow, per-output-budget strategy beyond reading the same dataset tables. Branching
  inside `selection_forager.py` would risk the shipped forager brain's extraction while testing the new one, the
  opposite of constitution Principle VII ("add complexity only when a real need appears" — here the need is two
  genuinely different algorithms, not one algorithm with a flag).
- **Alternatives considered**: a `mode` flag inside `selection_forager.py` switching between flow-ranking and
  class-seeding. Rejected for the reason above. A fully separate extractor binary. Rejected — unnecessary; the
  surrounding pipeline (dataset reads, admission, container writing, error codes) is already shared and config-
  driven (constitution IV), and only the neuron-choice step itself differs.

## 3. Fidelity probe: a linear propagation computed with `numpy`

- **Decision**: implement D13 exactly as stated — `x₀ = 1/|pool|` on each declared input pool, `r = Σ_{t=1..8} Aᵗ
  x₀` on the signed, normalised adjacency `A` (outputs as sinks), `value(pool→output)` the mean of `r` over the
  output pool — run twice (on the selected brain and on the whole thresholded traced graph) and compared per
  ADR 006's two checks (steering sign/magnitude, feeding sign). Implemented with `numpy` sparse matrix–vector
  steps (`bincount`-based, as the ADR's own measurement scripts used), inside the extractor, before any snapshot
  is written when `fidelity.require` is true.
- **Rationale**: this is not a new design question — ADR 006 D13 already specifies the algorithm and its two
  gates, and Annex A3/A4 give worked numbers to check an implementation against. Running it before the file is
  written (not as an afterthought script) is what FR-012/FR-013 and the lesson in ADR 006 Context point 7
  ("calibration ran before anyone checked the extraction... check extraction fidelity before calibration")
  require.
- **Alternatives considered**: a separate, standalone probe script run manually after extraction. Rejected — it
  would let a bad brain ship un-gated when `fidelity.require` is true, reintroducing the exact failure mode ADR
  006 names as the root cause of the withdrawn 15K brain's wasted calibration effort.

## 4. Snapshot additions stay optional, no version bump

- **Decision**: the three header additions (`minSynapses`, `selection`, `admission`) and two per-neuron additions
  (`transmitter`, `origin`) plus the optional `fidelity` report are added to container v4 as optional fields. The
  JS reader (`snapshot.js`) validates the fields it knows and passes through/ignores the rest, following the
  precedent already set for `soma`/`superclass` (spec 004, `snapshot-header-additions.md`).
- **Rationale**: ADR 006 W7 states this directly ("needs no container version bump") and the precedent already
  exists in this codebase for exactly this kind of additive change. It keeps `mock`, `v0` and the shipped `v1`
  forager brain's snapshots loading with no change in behaviour (spec FR-017, SC-007).
- **Alternatives considered**: a container v5. Rejected — nothing about the existing required fields or binary
  layout changes; a version bump would be a larger, unjustified move per constitution Principle VII, and would
  force every reader to special-case a version that differs from v4 only in optional metadata.

## 5. Side panel: derived capability signals, not a new mechanism

- **Decision**: when a snapshot's header carries the new provenance fields, or any neuron carries `origin`, the
  loader derives corresponding entries in `capabilities.signals` (e.g. `"provenance"`, `"fidelity"`, `"origin"`),
  the same array the panel's existing `registry.js` already gates sections on via `requires.signal`. One new
  section module (`provenance.js`) is registered with `requires: { signal: 'provenance' }` (and a second,
  `requires: { signal: 'fidelity' }`, if the two are shown separately); the brain activity view reads `origin`/
  `transmitter` per neuron when present to colour or label seed vs. fill neurons, guarded the same way the
  existing `soma`-position filtering already is.
- **Rationale**: the project's own stated invariant (`README.md`: "A new channel does not need UI changes") is
  achieved today through exactly this capability-gated pattern (`panel-sections.md` contract, spec 006). Reusing
  it for the new, non-channel data is the smallest change that keeps the invariant true for sections too, and
  guarantees spec FR-023/SC-007 (brains without the new fields render unchanged) for free, since `signals` simply
  does not contain the new entries for them.
- **Alternatives considered**: a brain-specific tab shown only for this one snapshot file. Rejected — it would
  not generalise to a third brain generation that also wants to show provenance, and would violate the
  capability-declared-in-data principle (constitution VI) this project already follows for channels.

## 6. Calibration skill: port the generic parts only, write one new profile

- **Decision**: port `.claude/skills/microfly-calibrate/SKILL.md`, `scripts/calibrate.mjs`, `scripts/engine.mjs`
  and `scripts/profiles/v1.mjs` from branch `013-forager-brain-15k-lif-v2` to `main`, reworded where the text
  assumes the withdrawn 15K brain exists (the `--version=v1|v2` help text, the "Extending to a new brain version"
  section's example). Port `tests/calibrate-engine.test.mjs` unchanged — it exercises `engine.mjs`'s pure gate
  functions against a synthetic fixture and imports nothing brain-specific. Add one new file,
  `scripts/profiles/class-seed-11k.mjs`, for this brain. Do **not** port `scripts/profiles/v2.mjs`,
  `tests/calibrate-profile-v2.test.mjs`, `specs/013-forager-brain-15k-lif-v2/calibration.md`, or the per-neuron
  `group`/region machinery (`REGIONS` in `public/js/ui/panel/counts.js`, `regionTotals`/`regionFractionsOf` in
  `scripts/forager-arms.mjs`) that `v2.mjs` depends on.
- **Rationale**: verified directly — `main` has no `fly-brain-v2.js`, no container v5, no per-neuron `group`
  field and no `REGIONS` export; `v2.mjs` imports all of these and targets the withdrawn 15K brain's own LIF
  mechanisms (Poisson input encoding, a `tauSyn`/synaptic-current rescaling bug fix specific to that brain's `L11`
  constant). ADR 006 (this feature's governing one) explicitly keeps the LIF core, runner, protocol and snapshot
  format at their v1 values (W6), so this brain has no `group` field and needs no region-based gating — it fits
  `v1.mjs`'s single-pseudo-region shape, not `v2.mjs`'s. Porting `v2.mjs` verbatim would import modules that do
  not exist on `main` and would be dead code for a brain generation this feature does not build. The user's own
  instruction says "extract only the skills... and adopt it for the purpose of calibrating for the newly
  extract[ed] brain," i.e. bring the reusable tool and build a new profile with it, not bring the other brain's
  profile.
- **Alternatives considered**: porting the whole branch-013 skill directory unmodified (simpler to execute, but
  leaves broken imports and a profile for a brain this feature never introduces); writing a calibration profile
  from scratch without reusing `engine.mjs` (rejected — `engine.mjs` already implements the exact staged A1/A2/B
  procedure ADR 005 Annex B and ADR 006's "Calibration protocol" describe, so re-deriving it is the premature
  abstraction `AGENTS.md` and constitution VII both warn against).

## 7. New calibration profile's shape: v1's structure, ADR 006's own stated grid

- **Decision**: `profiles/class-seed-11k.mjs` follows `v1.mjs`'s shape — single pseudo-region `"all"`
  (`regionFractions` returns one fraction, since this brain has no per-neuron `group` field either), channels read
  generically from `capabilities.channels` (so a future re-declaration does not silently misalign, as `v2.mjs`
  already improved on `v1.mjs`'s hard-coded 4-channel layout) — but widens the grid per ADR 006's own
  "Calibration protocol" section: start from v1's calibrated LIF block as the reference point; add
  `inhibitoryScale`, the `(tauAdapt, adaptStep)` adaptation pair and `thresholdJitter` as grid axes, carrying over
  branch 013's corrected gates (`output` exempt from the rest/ceiling gate, a per-step rate basis); use the world
  stage's `--top=3` to try more than one A2 operating point (`forwardTarget` × `motorSmoothing`).
- **Rationale**: this is not a new calibration design — it is ADR 006's "Calibration protocol" section (four
  numbered points) and the two corrected-gate bug fixes (BUG-002, BUG-003) it names as already-decided, applied
  through the generic engine. `v1.mjs` is the closer structural match (no groups) even though the *axes* it
  widens with come from the lessons recorded against `v2.mjs`'s bugs.
- **Alternatives considered**: starting the grid from scratch. Rejected — ADR 006 states "Start from v1's
  calibrated LIF block, because the weight rule is the same." Reusing `v2.mjs`'s `groupGain`/region axis.
  Rejected — this brain has no `group` field to gain against; `classify`'s `groupGainAxisFor` degenerates to `null`
  exactly as it already does in `v1.mjs`.
- **Naming note**: the profile's `id` is `class-seed-11k`, not `v2` or `v1b` — the CLI's `--version=<id>` flag
  selects an engine-level profile, which is a different axis from the worker-protocol/container "version" used
  elsewhere in this project (`v0`/`v1`). Calling it `v2` here would wrongly suggest a new protocol generation,
  which FR-001 explicitly rules out. `SKILL.md`'s text is reworded to make this distinction explicit.

## 8. Comparison script: extend the existing arms, not a new script

- **Decision**: `scripts/forager-arms.mjs` gains the class-seeded brain and the "v1 selection under D10–D12"
  arm (ADR 006 Gate C arm 3, `forager-brain-v1-rules.json`) as named arms, reusing the existing
  `runForagerArms`/`armMetrics`/`printForagerTable`/`verdicts` functions and the existing size-matched
  random-graph and random-walk arms unchanged.
- **Rationale**: spec FR-024/FR-025 and SC-005 ask for the existing five forager metrics over the same held-out
  seeds for every arm; this machinery already exists, is already tested, and already implements "report, don't
  hide or hand-wire" (constitution, "Working on brains"). A second script would duplicate it.
- **Alternatives considered**: a one-off script under `scripts/`. Rejected per constitution Principle VII and the
  precedent `scripts/compare-baseline.mjs` already sets for reusing `forager-arms.mjs` across brains.
