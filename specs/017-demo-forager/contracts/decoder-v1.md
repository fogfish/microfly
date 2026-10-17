# Contract: `decoder-v1` (the decoded-readout sidecar file)

**Owner**: `public/js/fly/decoder.js` (reader, and the per-tick decode, D29) and
`.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs`'s C2 stage (writer, D27–D28). **New contract** — ADR
010 Part D/J. Applies only to `flies.brain.version: "v3"`.

## File location and naming

`public/brains/<snapshot-basename>.decoder.json`, next to the `.brain` file it names (research.md §3). World config
names it explicitly with `flies.brain.decoder` (a path, resolved the same way as `flies.brain.snapshot`); it is
never inferred from the snapshot's own name, so a world can point two different worlds at the same snapshot with
different decoders if a future calibration run ever produces one.

## Shape

```json
{
  "format": "decoder", "version": 1,
  "snapshot": { "file": "forager-brain-wide.brain", "sha256": "…" },
  "lif": { "...": "the calibrated LIF block C2 ran with" },
  "probe": { "seeds": [1, 2, 3], "heldBack": 4, "ticks": 400, "rule": "D27", "candidates": "non-input" },
  "pools": {
    "side.odour-food.L": [/* neuron indices, sorted by |s| desc, ties on bodyId asc */],
    "side.odour-food.R": [],
    "drive.odour-food": [],
    "drive.odour-danger": [],
    "drive.heat": [],
    "alarm": [],
    "feed": [],
    "forward": [],
    "backward": []
  },
  "valence": {
    "odour-food": "approach", "odour-danger": "avoid", "heat": "avoid",
    "touch": "avoid", "taste-leg": "approach", "taste-mouth": "none"
  },
  "homeostasis": {
    "rest": { "side.odour-food.L": 0.01, "side.odour-food.R": 0.01, "drive.odour-food": 0.02, "alarm": 0.0, "feed": 0.0, "forward": 0.05, "backward": 0.0 }
  },
  "provenance": { "createdAt": "…", "tool": "calibrate.mjs C2", "configHash": "…" }
}
```

`homeostasis.rest` carries the C2-measured rest-condition rate of every pool named in `pools` (D33's "rest rate"), one
entry per pool name, keyed exactly like `pools`. There is no separate `balance` field: a pair's L/R balance is the
ratio `rest["side.<pair>.L"] / rest["side.<pair>.R"]`, so seeding `rest` for both sides seeds the balance too (data-
model.md's Homeostatic baseline entity). A pool absent from `homeostasis.rest` seeds its own rest at 0.

`probe.candidates` (optional, additive; BUG-001) names the D27 candidate scope C2 selected from: `"descending"`
(every descending neuron plus the named outputs, D27 as first written; the meaning when the key is absent) or
`"non-input"` (every neuron outside the sensory input pools, plus the named outputs; D27 as amended). Readers do not
branch on it; it is provenance.

A `side.<pair>.L`/`.R` pair MAY both be absent (fewer than 5 side-selective members found, D27) — the pair then
steers by klinotaxis alone (W13); the reader exposes this as an absent key, not an empty array, so a consumer
cannot mistake "no side pool" for "side pool with zero members disagreeing."

## Reader rules (`public/js/fly/decoder.js`)

Reject at load, before any fly starts, exactly as `snapshot.js`'s existing version/kind checks do:

1. `snapshot.sha256` does not match the loaded `.brain` file's own hash → `decoder <path> was built for a
   different snapshot (expected <sha>, got <sha>)`.
2. Any pool member index is `< 0` or `>= neuronCount` → `decoder <path> pool "<name>" has an out-of-range index`.
3. A `pools` key naming a pair not among the snapshot's declared senses → `decoder <path> names unknown pair
   "<pair>"`.
4. `valence[<sense>]` is not one of `approach`/`avoid`/`none` → `decoder <path> has an invalid valence for
   "<sense>"`.

## Decode rules (per tick, `decodeTick`)

- Every pool's population rate is smoothed with τ = 3 ticks **before** its rest is subtracted (D29), so a pool at
  rest decodes to drive ≈ 0. Rest (τ = 2,000) learns from the raw rate, only while the pool's sense is quiet (D33).
- `alarm`'s drive is the larger of `drive.odour-danger`'s and `drive.heat`'s drives when either pool exists, else the
  union's `r − rest` (D27 as amended, A1/A3, BUG-001/BUG-003; the union is ADR 010 Part L's fallback).
- `feed`'s drive is `drive.taste-mouth`'s drive when that pool exists, else the named feed pool's (D30 as amended,
  A2, BUG-002).

## Writer rules (C2, `decoder-engine.mjs`)

- Deterministic for the same snapshot, calibrated LIF block and seeds: pool membership and order MUST NOT depend
  on object/array iteration order — sort explicitly by `\|s\|` descending, ties on `bodyId` ascending (D27, mirrors
  AGENTS.md's Python sort rule applied here in JS).
- A pool MUST reproduce its sign on the held-back seed (`probe.heldBack`) for at least 70% of its members, or C2
  fails with `E-DECODE-<pool>` and writes no file (D27, Part L).
- The identical rule runs against the matched random-graph snapshot (RG arm) to produce its own `decoder-v1` file,
  satisfying Principle III's "same rule MUST be applied to every null-arm brain."
- `homeostasis.rest` is measured under the same rest condition as C2's probe (no stimulus), one value per pool
  named in `pools`, so the fly is unbiased from tick 0 (D33).

## Compatibility

New file kind; nothing existing reads or writes it. `v0`/`v1`/`v2` worlds have no `flies.brain.decoder` key and are
unaffected.
