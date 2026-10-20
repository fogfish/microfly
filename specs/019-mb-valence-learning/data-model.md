# Data Model: Mushroom-Body Valence Learning

Phase 1 of [plan.md](plan.md). The entities from [spec.md](spec.md) "Key Entities", with fields, validation and
state. The formats are fixed in [contracts/](contracts/); this file says what each piece holds and how pieces relate.

```text
extract/configs/forager-brain-mb.json ──extract──► forager-brain-mb.brain (container v4, kind forager-wide)
                                                     │ sha256
              forager-brain-mb.learning.json ────────┤ (learning-v1: groups, MBON roles)
              forager-brain-mb.decoder.json  ────────┘ (decoder-v1 + optional learning.naive)
                                                     │
world-forager-learning.json ── flies.brain.{snapshot, decoder, learning, lif.plasticity, lif.pathwayGain}
                            ── flies.stimuli["odour:food-a" | "odour:food-b" | "reinforcement:*"]
                            ── edibles[].scent, flies.food.outcome, flies.body.learning (W16)
                            ── experiment.{seeds, heldOut, schedule, arms}
```

## Odour set

A food odour with its receptor glomeruli and its input pair.

| Field      | Type            | Rule                                                                      |
| ---------- | --------------- | ------------------------------------------------------------------------- |
| `pair`     | id              | `odour-food-a` or `odour-food-b` in the shipped config                    |
| `sense`    | id              | `odour:food-a` / `odour:food-b`; the world stimulus key                   |
| `types`    | ORN type list   | A: DM1, DM2, DM4. B: VA2, DP1m, VM5d                                      |
| `label`    | string          | "Fruit odour", "Floral odour"                                             |

Validation: no ORN type appears in two pairs (`E-POOL-OVERLAP` at extraction). Each pair resolves to one left and
one right channel (existing `E-PAIR`).

## Scent (on a flower)

| Field                | Type                     | Rule                                                               |
| -------------------- | ------------------------ | ------------------------------------------------------------------ |
| `edibles[i].scent`   | `"fruit"` \| `"floral"`  | Optional. Absent: the flower emits no scent-specific odour          |
| `flies.stimuli[s].scents` | scent list          | Which scents the field for sense `s` is built from                 |
| `flies.food.outcome` | `{ <scent>: "punish" }`  | Optional. Eating a flower of that scent fires `eat:<scent>`        |

A scent is orthogonal to `kind` (small, medium, large), which keeps its meaning: size and capacity (spec 018).
The field builder normalises each scent's field to [0, 1] (ADR 010 W15).

## Neuron group (learning sidecar)

| Group      | Selector                                       | Count in the wide brain |
| ---------- | ---------------------------------------------- | ----------------------- |
| `kc`       | `class: Kenyon_Cell`                           | 4,064                   |
| `reward`   | `class: DAN`, `typePrefixes: [PAM]`            | 316                     |
| `punish`   | `class: DAN`, `typePrefixes: [PPL1]`           | 16                      |
| `approach` | MBON types with `role: approach`               | by the sidecar          |
| `avoid`    | MBON types with `role: avoid`                  | by the sidecar          |

Each MBON entry has `{ type, role, cite }`. The groups resolve to sorted neuron index arrays at load, against the
manifest's `class`/`type`, with ties broken on `bodyId` (AGENTS Python rule, mirrored). An empty group gives
`E-LEARN-GROUP-EMPTY`. Unlisted MBON types are reported, not used.

## LIF parameters (additions to `LIF_V1_DEFAULTS`)

| Name          | Default | Shape                                                              | Validation                            |
| ------------- | ------- | ------------------------------------------------------------------ | ------------------------------------- |
| `pathwayGain` | `null`  | `{ routes: [{from, to, gain}], otherExcitatoryInto: [], otherGain }` | known classes, finite ≥ 0, no repeat  |
| `plasticity`  | `null`  | `{ tauElig, tauRate, tauBaseline, threshold, etaReward, etaPunish, wMin, tauForget, dopamine }` | τ > 0, eta ≥ 0, 0 ≤ wMin < 1, threshold ≥ 0, dopamine ∈ {pool, shuffled}; any missing key takes its documented default |

`plasticity` set without a learning sidecar gives an error: `E-LEARN-MISSING`, "plasticity needs flies.brain.learning".

## Synapse modifier state (per fly, in the worker)

| Field        | Type                   | Meaning                                                         |
| ------------ | ---------------------- | --------------------------------------------------------------- |
| `slot`       | `Uint32Array(m)`       | Edge positions with pre ∈ kc and target ∈ approach ∪ avoid      |
| `slotPre`    | `Uint32Array(m)`       | The KC index of each slot (for its trace)                       |
| `slotGroup`  | `Uint8Array(m)`        | 0 approach, 1 avoid                                             |
| `wmod`       | `Float64Array(m)`      | In [wMin, 1], starts at 1                                       |
| `elig`       | `Float64Array(n)`      | KC trace; used only at KC indices                               |
| `rate`, `baseline` | `Float64Array(2)` | reward, punish                                                 |
| `ring`       | `Float64Array(2·4000)` | Shuffled mode only                                              |
| `stepCount`  | integer                | Drives the 10-step recovery and the shuffle lag redraws         |

m ≈ 33.5K × (fraction of MBONs with a role). The state lives only in the worker and is never sent in full.

**Lifecycle.** It is created at `init` with every `wmod` at 1. It changes only inside `step`. It is lost on `stop`.
There is no save or restore: a reloaded fly is naive.

## Teaching signal

| Source                | Kind      | Drives                         | Label     |
| --------------------- | --------- | ------------------------------ | --------- |
| connectome (measured) | carried   | reward/punish group rates      | connectome |
| `reinforcement:reward` on `eat` | injected | `reinforcement-reward-*` channels | injected |
| `reinforcement:punish` on `escape`, `heatContact`, `eat:<scent>` | injected | `reinforcement-punish-*` channels | injected |

An injected event sets the channel value to 1 for `pulseTicks` ticks (default 10), then 0.

## Learned valence (decoder, main thread)

| Field            | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `rApp_p`, `rAvoid_p` | EMA (τ 300 ticks) of MBON group rates while pair p's input ≥ 0.05      |
| `bal_p`          | `(rApp − rAvoid)/(rApp + rAvoid + ε)`                                      |
| `bal⁰_p`         | naive balance, from `decoder.learning.naive[p]` (C2), else the first 300 ticks of presence |
| `ℓ_p`            | `clamp(1 + kValence·(bal_p − bal⁰_p), 0.5, 1.5)`; 1 when learning is off   |

`v_p` (declared) × `ℓ_p` replaces `v_p` in W13 for food pairs. W16 uses `ℓ` of the dominant food pair.

## Regime gate result

| Field                          | Type                                |
| ------------------------------ | ----------------------------------- |
| `snapshot.sha256`, `lif`       | provenance                          |
| `seeds`                        | calibration seeds used              |
| `perOdour[A|B].activeFraction` | mean, min, max over trials          |
| `perOdour[A|B].reliability`    | mean pairwise Pearson               |
| `overlapAB`                    | Pearson of mean vectors             |
| `rateCorrelationAB`            | secondary                           |
| `verdict`                      | `pass` \| `fail`                    |
| `remedy`                       | `null` or the `pathwayGain` block tried and its own measures |
| `randomGraph`                  | the same measures, reported         |

## Experiment arm and schedule

| Arm         | Brain                    | `plasticity`              |
| ----------- | ------------------------ | ------------------------- |
| `plastic`   | forager-brain-mb         | on, `dopamine: pool`      |
| `frozen`    | forager-brain-mb         | `null`                    |
| `shuffled`  | forager-brain-mb         | on, `dopamine: shuffled`  |
| `random`    | rewired forager-brain-mb | on, `dopamine: pool`      |

Every arm uses the same decoder rule, body layer, W16 setting and spawn per seed.

**Schedule.** `pretest → train → posttest → forget → decaytest`, each phase a tick count. The training phase's
punished or exclusive scent is declared per experiment (`B-punished`, `A-punished`, `A-only`).

**Per-visit record.** `{ arm, seed, phase, scent, enterTick, exitTick, eatTicks }`. A visit starts when the fly
enters a flower's `reach` and ends when it leaves.

Metrics: visits per scent, median stay ticks per visit, eat fraction per visit, choice ratio, each with a bootstrap
95 % CI over seeds.
