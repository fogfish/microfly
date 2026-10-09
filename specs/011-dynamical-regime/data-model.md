# Phase 1 Data Model: Dynamical Regime for the Forager Brain

This feature adds no new persisted entity or file format — it changes how two existing entities' values are
computed, and adds one new parameter to a third. There is no database and no new message crossing the worker
protocol boundary (Principle II).

## Brain Snapshot (`.brain` file, container version 4, `kind: "forager"`)

Existing entity (`container-v4.md`), unchanged in binary layout. Affected fields:

| Field | Before this feature | After this feature |
|---|---|---|
| `header.weightRule` | Always `"postFraction"`. | `"postFraction"` (legacy, unchanged meaning) or `"postFractionAbsolute"` (new). Exactly one, same as before. |
| `weights` (CSR section, float32 × E) | `sign(i) × synapses(i→j) / Σ synapses(k→j)`, sum over **selected** presynaptic `k`. | Under `"postFractionAbsolute"`: `sign(i) × synapses(i→j) / Σ synapses(k→j)`, sum over every **admitted** presynaptic `k` with a real edge into `j` (selected or not). Under `"postFraction"`: unchanged. |
| `synapses` (CSR section, uint16 × E) | Raw synapse counts, as read from the dataset. | Unchanged — the denominator change affects only the derived `weights` section, never the stored raw counts, so the rule can still change without re-reading the dataset (ADR 003 D4's own stated property, preserved). |

Invariant `_check_inflow` ("a neuron's absolute input weights sum to at most 1") holds under both rules — the new
rule can only make a selected neuron's total *smaller*, never larger, than 1.

## Dynamical Parameter Set (`flies.brain.lif`, world config; `LIF_V1_DEFAULTS`, LIF core)

Existing entity (`lif-v1.md`), gains one field:

| Field | Type | Default | Rule |
|---|---|---|---|
| `noiseAmplitude` | number | `0` | Finite, ≥ 0. Half-width of the uniform per-neuron, per-step membrane noise term, in the same potential units as `vThreshold`. `0` is a no-op (no draw made). |

No other `LIF_V1_DEFAULTS` field changes shape or default. `stimulus.resting`, `stimulus.gain`, and the snapshot's
`modulators[*].gain` (already-existing fields in `flies.stimulus` and the snapshot header) are the recalibration
targets for sub-threshold sensory rest (ADR 005 D6) — no new field, new calibrated values only, recorded in a
calibration-record entry (below), not in this data model.

## Network (in-memory, `createNetwork`'s return value, `lif-v1.js`)

Existing entity, gains two fields, both built once in `createNetwork` (not per step) when `noiseAmplitude > 0`:

| Field | Type | Meaning |
|---|---|---|
| `noiseRand` | function (`() => number`, from `createPrng`) | The dedicated noise PRNG's `next`, independent of the jitter PRNG used for `thresholdJitter`. `undefined`/unused when `noiseAmplitude === 0`. |

No new field is needed to store per-step noise values themselves — the term is computed and added inline during
`step`, the same way `external[i]` already is, with no new per-neuron buffer (preserving the "no new allocation"
performance constraint).

## Calibration Record (`specs/008-hungry-forager-brain/calibration.md`, append-only)

Existing entity (a Markdown document, not a typed structure), gains one new dated section per ADR 005's
recalibration protocol, in the same shape as its existing entries:

- **Seeds**: calibration seeds used for the sweep, held-out seeds used for the final verdict (never mixed).
- **Grid**: the swept parameters (`synapticScale`, `outputScale`, `noiseAmplitude`, `stimulus.resting`/`gain`) and
  their tested values.
- **Diagnostics**: three result columns beyond the existing find/eat metrics — the saturation diagnostic
  (`far-forward`/`far-feed`, ADR 004's own), the pool-synchrony diagnostic (fraction of steps a representative
  sensory pool spikes in unison), and the sensory-gradient diagnostic (firing rate at several fixed odour
  intensities).
- **Choice and held-out verdict**: the selected setting and its pass/fail result on held-out seeds (ADR 005
  "Recalibration protocol" steps 4–5), in the same shape as ADR 004 Annex A.3's table.

This record is produced by *running* the recalibration protocol (a task-level, empirical activity), not authored as
part of this plan.
