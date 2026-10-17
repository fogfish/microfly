# Phase 1 Data Model: Demo Forager

Entities from [spec.md](spec.md)'s Key Entities section, made concrete against the real modules each will live in
(see [research.md](research.md) for why each module was chosen).

## Pool

A named set of neuron indices, selected once by the C2 calibration stage and shipped inside the `decoder-v1` file
([contracts/decoder-v1.md](contracts/decoder-v1.md)).

| Field | Type | Notes |
|---|---|---|
| `name` | string | One of `side.<pair>.L`, `side.<pair>.R`, `drive.<pair>`, `alarm`, `feed`, `forward`, `backward` (ADR 010 D27). |
| `members` | `number[]` | Neuron indices into the snapshot, sorted by `\|s\|` descending, ties on `bodyId` ascending (D27 determinism rule). |

**Validation**: every index in range `[0, neuronCount)`; a `side` pool absent for a pair is represented by omitting
that key, never by an empty array with a lie attached (spec FR-007, Story 5 Scenario 2).

## Declared sense

One of the twelve input pairs the wide brain already declares (`odour-food`, `odour-danger`, `heat`, `taste-mouth`,
`taste-leg`, `touch`), carrying its declared valence.

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `"odour-food"`. |
| `valence` | `"approach" \| "avoid" \| "none"` | Declared in the `decoder-v1` file (D28), shown on the panel (D31), never learned. |

## Decoded sense signal (per-tick, in-memory only — not persisted)

Computed every tick in `public/js/fly/decoder.js`, per declared sense, from the homeostatic baseline and the
tick's spike indices.

| Field | Type | Formula (D29) |
|---|---|---|
| `drive` | number ≥ 0 | `max(0, r(drive.p) − rest(drive.p))`, smoothed τ = 3 ticks. |
| `side` | number in [-1, 1] or absent | `(r̂(side.L) − r̂(side.R)) / (r̂(side.L) + r̂(side.R) + ε)`; absent when no `side` pool exists for `p`. |
| `weight` | number in [0, 1) | `drive / (drive + floor)`; 0 when the pool is silent. |
| `trend` | number | `(drive − slow) / (slow + ε)`, `slow` an EMA with τ = 30 ticks. |

## Homeostatic baseline (per pool, persisted only for the lifetime of a running fly)

| Field | Type | Update rule (D33) |
|---|---|---|
| `rest` | number | EMA, τ = 2,000 ticks. Updates only while the pool's sense is quiet (its input channel(s) < 0.05). |
| `balance` | number (`side` pools only) | `slow(r(side.L)) / slow(r(side.R))`, same quiet-only update rule. Seeded from C2's own measurement so it is correct from tick 0. |

**State transition**: "quiet" → "active" freezes both fields; "active" → "quiet" resumes their EMA update. Never
reset mid-run.

## Body layer parameters (declared in world config, `flies.body.locomotion`/`flies.body.escape`/`flies.body.backup`)

| Field | Type | Used by |
|---|---|---|
| `baseSpeed`, `speedGain`, `maxSpeed`, `surgeGain`, `wander` | number | W12 walking/speed formula. |
| `turnGain`, `castGain`, `castMin`, `castMax` | number | W13 tropotaxis/klinotaxis formula. |
| `escape.threshold`, `escape.distance`, `escape.cooldown` | number | W14 escape (reuses `applyEscape`'s existing shape, `enabled` default `true` for `v3`). |
| `backup.threshold`, `backup.ticks` | number | W14 backing up (new). |

## Hunger threshold modulator (world config, `flies.modulators.hunger`)

| Field | Type | Notes |
|---|---|---|
| `threshold` | number in [0, 1), default 0.4 | D32. Reshapes the existing linear modulator gain in `fly-brain-v1.js`; see research.md §6. |

## Calibration run (C1–C3, `calibrate.mjs --version=demo-v3`)

| Field | Type | Notes |
|---|---|---|
| `stage` | `"c1" \| "c2" \| "c3" \| "all"` | New dispatch values alongside the existing `regime\|classify\|auto\|world`. |
| `gate` | per-stage pass/fail record | C1: rest 1–10%, no ignition, every pair's drive rises ≥ 3 Hz. C2: 70% sign-reproduction on the held-back seed. C3: reported, not gated. |
| `budgetMinutes` | number, hard cap | Existing `--budget-minutes` flag, now hard-enforced end-to-end for `--stage=all` (R4/K7). |
| `errorCode` | string, on failure | `E-DECODE-<pool>` for a C2 pool that fails its reproduction check (D27), among others named in ADR 010 Part L. |

## Experiment arm (Part K)

| Field | Type | Notes |
|---|---|---|
| `name` | `"brain" \| "random-walk" \| "random-graph"` | B / RW / RG. |
| `bodyLayer` | reference | Identical object across all three arms (constitution VI: "MUST be identical across every arm"). |
| `decoderSource` | reference | B and RG run the *same* C2-derived decoder rule against their own snapshot (RW has no decoder: signals zeroed). |

## Acceptance report (Part K / FR-022–FR-024)

| Field | Type | Notes |
|---|---|---|
| `requirement` | `"R1" … "R5"` | |
| `metric` | `"K1" … "K9"` | |
| `verdict` | `"pass" \| "fail"` | Measured, never adjusted after the fact (constitution "Demo Acceptance", AGENTS.md "Behaviour failures are findings"). |
| `arms` | per-arm numbers | B, RW, RG all reported; RG's pass on a gating metric (K9) is stated, not hidden (FR-024). |
