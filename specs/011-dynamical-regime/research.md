# Phase 0 Research: Dynamical Regime for the Forager Brain

No `[NEEDS CLARIFICATION]` markers remain in `spec.md`, and this feature's "unknowns" are not technology choices
(the stack is fixed by `AGENTS.md`: plain ES modules, Python + `pyarrow`/`numpy`, no new dependency) but three
mechanism-design questions the ADR resolves. This document records why each decision in ADR 005 is the one taken,
and what else was considered, per the Phase 0 template.

## Decision 1: Fix the weight-rule denominator in `selection_forager.py`, not by adding a second extraction pass

**Decision**: Change which already-computed array backs `total_in` — from the `inside`-filtered (selected-only)
edge set to `post_i` (every real, admitted presynaptic edge into the post neuron) — rather than re-reading the
dataset or adding a new per-neuron in-degree table.

**Rationale**: `select_forager` already computes `pre_i, post_i, syn` as dense indices into the *admitted*-body
universe (`ids`, every body that passed dataset admission, before the final budgeted selection narrows it down) —
this is already "every real, dataset-admitted synapse," the exact population the user's issue 2 asks the
denominator to be computed over. No new data access, no new pass over the Feather files, no change to extraction
runtime beyond one more `bincount` call over an array already in memory.

**Alternatives considered**:
- *Re-scan the raw edge table for each neuron's true in-degree, independent of admission.* Rejected: "real" in this
  spec's sense is bounded by what the pipeline already admits (dataset release, `edgeVariant`, `minConfidence`) —
  going further back to literally every synapse the raw Feather file records, including ones that would never be
  admitted as edges for any other reason, would make the weight rule depend on a population the rest of the
  extractor doesn't otherwise recognize as real, and would require a second full pass over files up to 13 GB
  (`AGENTS.md`'s "never load a large file whole" — a second unfiltered pass risks exactly that).
- *Keep `postFraction`'s name and redefine it in place.* Rejected: `AGENTS.md`'s contract rule requires bumping or
  otherwise marking an incompatible change and keeping the old reader; silently changing what a already-shipped,
  versioned config key means (without changing its spelling) would make an old config's declared `"postFraction"`
  ambiguous between the old and new semantics. A new value (`"postFractionAbsolute"`) keeps both meanings
  distinguishable and both readable.

## Decision 2: Per-neuron noise as a new scalar LIF parameter (`noiseAmplitude`), not per-channel or per-pool

**Decision**: One global `noiseAmplitude`, uniform-distributed, drawn from its own dedicated `createPrng(seed)`
stream, independent of `thresholdJitter`'s.

**Rationale**: The spec's FR-004 (pool desynchrony) and FR-006 (sub-threshold sensory rest) are the same underlying
need — independent per-neuron variability — applied to two different populations (sensory pools and the recurrent
bulk) that already coexist in one network. A single scalar is the simplest mechanism that can satisfy both
(ADR 005's own "Simplicity" principle check), and the recalibration protocol explicitly tests whether one value
is enough before anything more granular is considered (ADR 005's first "Open question").

**Alternatives considered**:
- *Gaussian noise (Box-Muller from the existing uniform PRNG).* Rejected for this pass: the project's existing
  per-neuron variability (`thresholdJitter`, L3) is already uniform-distributed (`2 × rand() − 1`), so a uniform
  noise term matches the established pattern and needs no new PRNG primitive. Nothing in the spec requires a
  specific distribution shape — only that "no stimulus" is quiet-and-noisy rather than silent-or-tonic (FR-006) and
  that identical drive does not produce identical spike timing (FR-004), both of which a uniform term satisfies.
  Revisiting the distribution shape is a smaller follow-on if calibration shows a specific need for it.
- *Reusing `thresholdJitter`'s existing PRNG stream for noise too.* Rejected: it would make the noise sequence
  depend on whether `thresholdJitter` is also enabled (since both would draw from the same stream in the same
  construction/step order), which is a surprising coupling between two otherwise-independent parameters and would
  complicate testing each in isolation (G5's existing jitter-only test, and the new G11–G14 noise tests, would no
  longer be independent of each other). A second, dedicated stream from the same seed costs one more `createPrng`
  call and keeps the two mechanisms orthogonal.
- *A noise term folded into the synaptic current (`tauSyn`'s `syn[j]`) rather than the membrane potential
  directly.* Rejected: `external[i]` (where sensory drive and, by extension, where sub-threshold rest behaviour
  needs to show up) is added to the membrane update directly, bypassing the `syn`/`tauSyn` path entirely (`lif-v1.js`
  `step`'s `v[i] += ... + drive + external[i]`). Adding noise to `syn` would miss `external`-driven neurons
  entirely, including every sensory input neuron this ADR's issue 3 is about.

## Decision 3: Sensory resting/gain recalibration, not a new "sub-threshold" sensory mechanism

**Decision**: Fix the sub-threshold-at-rest requirement (FR-006) by recalibrating `stimulus.resting`/`gain` (and,
if needed, `tau`/`vThreshold`) as world-config values, with L7's noise supplying the low background firing rate —
no new LIF parameter or sensory-encoding mechanism beyond noise itself.

**Rationale**: The project's own convention (`AGENTS.md`'s "Behaviour comes from the brain" / "Separate calibration
and evaluation seeds") treats numeric operating points as calibration, not code — `calibration.md` and ADR 004 both
recalibrated existing parameters rather than inventing new ones to fix a saturation problem. `stimulus.resting`,
`stimulus.gain`, `tau`, and `vThreshold` are already named, documented, and validated (Principle V); the ADR 005
derivation (`τ · resting · g0 ≤ vThreshold`) is a target for calibration to hit with the parameters that already
exist, not a gap in the mechanism set.

**Alternatives considered**:
- *A dedicated "sensory floor" LIF parameter distinct from `vThreshold`.* Rejected: would duplicate what
  `resting`/`gain`/`tau`/`vThreshold` already jointly control, adding a parameter whose effect is redundant with
  existing ones — against Principle VII (Simplicity) and the spec's own instruction to treat the numeric targets as
  calibration starting points (spec Assumptions), not fixed requirements needing new knobs.

## Decision 4: No format/container version bump for either change

**Decision**: `postFractionAbsolute` is a new accepted value for the existing `weightRule` key; `noiseAmplitude` is
a new accepted key under `flies.brain.lif`. Neither changes the snapshot's binary layout, the container version, or
the extract config's `formatVersion`/`kind` dispatch.

**Rationale**: Both are backward-compatible additions — an old snapshot or config declaring `"postFraction"`, or a
world file that never sets `noiseAmplitude`, is read and simulated exactly as before. This is the same shape of
change ADR 004's `outputScale` was (a new key, no version bump) and its BUG-002 amendment (a new accepted shape for
an existing key, also no version bump) — both precedents the contract amendments in this feature's `contracts/`
folder follow directly.

**Alternatives considered**:
- *Bump the container to version 5 "to be safe."* Rejected: `AGENTS.md`'s rule is to bump only an *incompatible*
  change and to keep the old reader either way; an unnecessary bump would force every existing reader path (and
  the version-dispatch tests in `container-v4.md`/`snapshot.js`) to grow a new branch for a change that does not,
  in fact, break anything old.
