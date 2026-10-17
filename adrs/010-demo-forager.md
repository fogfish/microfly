# ADR 010: Demo forager: connectome brain, decoded readout, declared body layer, online homeostasis

- **Status:** Proposed. Requires constitution v2.0.0 (Part A) before any code lands.
- **Date:** 2026-10-17
- **Target:** `main`. Branch `015-steering-calibration` is **not merged**; it stays as a failed experiment. Part 0
  lists the few changes to carry over from it.
- **Supersedes:**
  - ADR 006 lesson 2 ("no selection by objective"), for **readout** neurons only. It still applies to interneurons.
  - ADR 007 D17/W10 (escape physics off by default), for brain version `v3`.
  - ADR 005/006/007 "Calibration protocol" (A1/A2/B grid search), for `v3`. Earlier brain versions keep theirs.
- **Keeps:** the connectome brain and its extraction rules (D8–D13, D15–D20), the LIF core (`lif-v1.js`, bit-identical
  with defaults), one worker per fly, protocol v3, the mock/v0/v1/v2 brains and worlds.
- **Inputs:** [doc/research.md](../doc/research.md): the connectivity audit, the readout scan, the failed 14.5K
  calibration.
- **Numbering:** decisions D26–D34, world decisions W12–W15, LIF decision L10. D21–D25 are on the 015 branch
  (ADR 008/009); D24–D25 come to main with ADR 009 (Part 0).

## Requirements

| Id  | Level  | Requirement                                                               | Measured by (Part K)                              |
| --- | ------ | ------------------------------------------------------------------------- | ------------------------------------------------- |
| R1  | MUST   | A fly whose hunger is above a threshold moves towards food and reaches it | Find rate and approach, hungry vs sated           |
| R2  | MUST   | A fly reacts to danger and escapes it                                     | Escape trigger and exit time per danger encounter |
| R3  | SHOULD | A fly avoids heat                                                         | Time in heat rings against the random walk        |
| R4  | SHOULD | Calibration takes 30 minutes or less, in one command                      | Wall clock of `calibrate.mjs --stage=all`         |
| R5  | SHOULD | The world map can change without recalibration                            | R1–R3 hold on two maps with one calibration       |
| R6  | MAY    | Real-time learning from world feedback is used where it removes a problem | Part G                                            |

## Context

Two weeks of calibration produced no fly that finds food (doc/research.md §1). The reasons are now measured:

1. **One global scale cannot serve every pathway.** At a quiet setting the bulk carries correct, sense-specific
   steering, but the motor pools get little input: forward drive saturates at 0.05, whatever the readout gain. At a
   louder setting the bulk ignites and the signal is lost. 960 grid points gave one robust candidate, and in the world
   it found food 0 % of the time against 30 % for the random walk.
2. **The readout is where the signal is not.** Food's L/R contrast on DNa01 ranks 230th of 472 bilateral DN types;
   danger's ranks 401st. It lands on DNp29, DNc01, DNp32 and DNb05, which the brain contains and never reads.
   One neuron per side is also a noisy readout.
3. **The brain is asked to do the nerve cord's job.** Walking rhythm is generated in the ventral nerve cord, which
   the cut does not contain as a motor circuit. Requiring every step to come from DNp09 spikes demands more than
   the biology does.
4. **Every problem had to be solved in one place.** The constitution allows tuning only the brain's global LIF
   parameters, so readout, body and signal-size problems were all pushed into the grid search.

Past research (doc/research.md §3) moves towards food because it decodes steering from DNs it measured to be side-selective, gives the body its own walking and search strategy, and tunes each stage with its own probe. It has no null-graph control and states that it is "a connectome-shaped toy". This ADR takes its working structure and keeps microfly's rigour: declared, versioned, reproducible stages, and null arms that run the same decoder and
body.

## Design

```text
world ──stimulus──► input channels (declared, as v2) ──► LIF brain, 14.5K connectome (L10 tonic current)
                     ▲ hunger gate (D32)                         │ spikes (protocol v3, unchanged)
                     │                                           ▼
                     │                            decoder (main thread, declared, D27–D31)
                     │                              • population pools picked by a brain-only probe
                     │                              • online homeostasis: rest rate and L/R balance (D33)
                     │                              • per-sense: side asymmetry, drive, drive trend
                     │                                           ▼
                     │                            body layer: nerve-cord stand-in (W12–W14)
                     │                              • walking rhythm, exploration noise
                     │                              • tropotaxis (L/R) + klinotaxis (trend) per declared valence
                     │                              • escape reflex, feeding, backing up
                     └──────────────── body moves in the world (physics unchanged) ◄────────┘
```

**Where decisions are made.** The brain decides:
- which side a stimulus is on (pool asymmetry);
- how strong the stimulus is (pool drive), including whether food is noticed at all, since hunger gates food input;
- when to feed (MN9);
- when to escape (DNp01 and the alarm pool).

Data declares only whether each sense is approached or avoided (its **valence**). The body layer turns the
brain's numbers into motion and never reads the stimulus.

This is a smaller claim than "the brain does everything". It is stated in the README and on the panel (D31).

## Part 0: carry over from branch 015

Port to `main` as their own commits, before this ADR's feature work:

| Change                                                                                  | Why                                                                                    | Files                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec 012 BUG-001: CSR indexed like the neuron records, reader check N5/N6               | Every class-seeded snapshot on `main` wires its senses and motors to unrelated neurons | `selection_class_seed.py` (order), `snapshot.js` (N6), `container-v4.md`, `test_class_seed_csr_order.py`, `snapshot-shipped-csr.test.mjs`, `bugs/BUG-001.md`, re-extracted `forager-brain-11k.brain` |
| Spec 013 BUG-001, measurement part: touch metric sign, hazard locator for field sources | Touch and avoid metrics are wrong or blind on the sketch map                           | `metrics.js`, `forager-arms.mjs`, `metrics-wide.test.mjs`, `forager-arms-hazard.test.mjs`                                                                                                            |
| ADR 009: output-partner seeds, wide brain at 14,500                                     | The readout keeps 97–100 % of its real input; food contrast 92 %                       | ADR 009, `config.py`, `selection_class_seed.py`, `forager-brain-wide.json`, extractor tests, both contracts, re-extracted `forager-brain-wide.brain`                                                 |
| Connectivity audit and research note                                                    | The diagnostics this ADR rests on                                                      | `scripts/connectivity-audit.py`, `doc/research.md`                                                                                                                                                   |

**Not ported:**
- ADR 008, which is recorded in doc/research.md instead;
- the `wide-io` profile's D21/D22 grid;
- the calibration engine's steering gates;
- the `calibration.md`/`results.md` logs of the 015 runs.

## Part A: constitution v2.0.0

MAJOR: Principle VI is redefined. Applied with `/speckit-constitution` before any code.

### VI. Living World, Embodied Flies (replaces the current text)

> Flies MUST live and interact in an interactive environment rendered by the same web app.
>
> - The world owns physics, objects, other flies and the user's interactions. Flies perceive the world only
>   through declared sensory inputs and act on it only through a declared decoder and body layer.
> - **The brain decides:** which side a stimulus is on, how strong it is, when to feed and when to escape. These MUST
>   be read from simulated neurons.
> - **A body layer MAY supply what the extracted brain does not contain**, as a stand-in for the ventral nerve cord:
>   a walking rhythm and base speed, exploration noise, and fixed reflex laws (tropotaxis, klinotaxis, escape, backing
>   up) applied to decoded brain signals. The body layer MUST be declared in data, MUST NOT read the stimulus or the
>   world state other than the body's own physics, and MUST be identical across every arm of an experiment.
> - **Each sense's valence** (approach or avoid) MAY be declared in data. It MUST be shown on the panel and in the
>   README as declared, not learned.
> - The mapping from world stimuli to sensory neurons, from neurons to decoded signals, and from decoded signals to
>   body commands MUST be declared in data, not hidden in world code.
> - Scripted behaviour MUST NOT override decoded brain signals, except in labelled debug or baseline modes.

### III. Connectome-Grounded Brain Snapshots (one bullet added)

> - **Readout pools MAY be selected by a declared response rule** (for example, side selectivity under a brain-only
>   probe) measured on calibration seeds only. The rule, its seeds and its result MUST be recorded with provenance
>   next to the snapshot, and the same rule MUST be applied to every null-arm brain.

### V. Faithful, Inspectable LIF Simulation (one bullet added)

> - **Online plasticity is allowed** where a decision record defines it: named, bounded, off by default in the LIF
>   core, deterministic given the seed, and visible in telemetry.

### New section: Demo acceptance

> A brain generation is **demo-complete** when its declared behaviour requirements pass on held-out seeds, on at least
> two maps, with one calibration. The random walk (same body layer) and the matched random graph (same decoder rule
> and body layer) MUST be reported alongside. A null arm that also passes MUST be stated in the results, not hidden.

### AGENTS.md hard rules (follow-on)

- Rule 6 becomes: "Direction, strength, feeding and escape come from the brain. The body layer may walk, explore and
  apply declared reflex laws to decoded signals; it never reads the stimulus."
- "Behaviour failures are findings" stays.
- Add: "A decoder rule is applied identically to null-arm brains."

## Part B: brain

### D26. The demo brain is the ADR 009 wide brain, unchanged

The ADR 009 cut, at 14,500 neurons and 731K edges with 12 inputs and 6 outputs. No extraction change in this ADR.

- **Inputs:** odour-food, odour-danger, heat, taste-mouth, taste-leg and touch, each L/R.
- **Named outputs:** turn L/R, forward, backward, feed and escape. They stay in the snapshot for v2 and for the
  panel. The decoder (Part D) reads them as part of its pools.

## Part C: LIF

### L10. Tonic background current, `baselineCurrent`

A constant input current added to every bulk neuron each step, with input pools and output pools treated alike.
Default `0`, so `lif-v1.js` matches `lif-v0.js` bit for bit and `tests/lif-golden.test.mjs` is unchanged. Validated
as a finite number ≥ 0.

**Why.** ADR 008 measured that a silent bulk passes no proportional signal: sub-threshold neurons do not pass a
signal in proportion, and silent inhibitory neurons do not inhibit. Its fix was noise in the bulk. A tonic current
puts every neuron near threshold more cheaply and more stably, so a small input changes firing probability in
proportion. It should runs with exactly this (`baseline` 0.03 against threshold 1).

`noiseAmplitude`/`noiseBulkScale` (ADR 005) stay and are combined with it.

**Not added:** per-class or per-type gains. They are the research path (doc/research.md §2.1), deferred until a
feasibility test shows the connectome adds something over the random graph.

**`outputScale` is not used by `v3`.** The decoder reads spike rates of populations, normalised online (D33), so no
per-output gain is fitted. The parameter stays valid for v1/v2.

## Part D: decoder

The decoder runs on the main thread. It turns spike indices into rates; that is motor decoding, not neural
computation, so Principle II holds. Protocol v3 already carries `spikes` every tick: **no protocol change**.

### D27. Pools are selected by a brain-only spiking probe

The pools come from calibration stage C2 (Part H), on calibration seeds only, with the calibrated LIF block. The
candidates are every descending neuron plus the named output neurons (about 1,320). **Amended (A1 below):** every
neuron outside the sensory input pools, plus the named outputs.

| Pool                   | Rule                                                                                                                                                                                                                       | Used for                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `side.<pair>.L` / `.R` | Selectivity `s = (rL − rR)/(rL + rR)`, with `rL`, `rR` the rates under left-only and right-only stimulus of the pair at full strength. `s > 0.3` goes to `.L`, `s < −0.3` to `.R`; the mean rate must be ≥ 2 Hz above rest | Which side the stimulus is on             |
| `drive.<pair>`         | Rate rises ≥ 3 Hz under bilateral stimulus of the pair over rest, and is ≥ 2× its rise under any other pair (sense-specific)                                                                                               | How strong the stimulus is, and its trend |
| `alarm`                | Union of `drive.odour-danger`, `drive.heat` and the named `escape` pool (DNp01)                                                                                                                                            | Escape trigger                            |
| `feed`                 | The named `feed` pool (MN9)                                                                                                                                                                                                | Feeding                                   |
| `forward` / `backward` | The named pools (DNp09, MDN)                                                                                                                                                                                               | Speed modulation and backing up           |

- A pool must reproduce its selection on a held-back calibration seed: at least 70 % of members keep their sign.
  Otherwise C2 fails with a named error (`E-DECODE-<pool>`) and calibration stops. That is a finding, not a retry.
- A pair with no `side` pool (fewer than 5 members a side) still steers by klinotaxis (W13). Its `side` term is 0.
- **Ties and order:** members sorted by `|s|`, ties on `bodyId`, so the selection is deterministic.

### D28. The decoder file, contract `decoder-v1`

`public/brains/<snapshot>.decoder.json`, written by C2:

```json
{
  "format": "decoder", "version": 1,
  "snapshot": { "file": "forager-brain-wide.brain", "sha256": "…" },
  "lif": { "…": "the calibrated block the probe ran with" },
  "probe": { "seeds": [1, 2, 3], "heldBack": 4, "ticks": 400, "rule": "D27" },
  "pools": { "side.odour-food.L": [/* neuron indices */], "drive.heat": [], "alarm": [] },
  "valence": { "odour-food": "approach", "odour-danger": "avoid", "heat": "avoid",
               "touch": "avoid", "taste-leg": "approach", "taste-mouth": "none" },
  "provenance": { "createdAt": "…", "tool": "calibrate.mjs C2", "configHash": "…" }
}
```

The world names it with `flies.brain.decoder`. A reader rejects:
- a snapshot hash mismatch;
- an index out of range;
- an unknown pair;
- a valence outside `approach | avoid | none`.

### D29. Per-sense signals

Every tick, for each pair `p`, with population rates `r` in spikes per neuron per tick, smoothed with τ = 3 ticks:

```text
drive_p  = max(0, r(drive.p) − rest(drive.p))                               rest: D33
side_p   = (r̂(side.p.L) − r̂(side.p.R)) / (r̂(side.p.L) + r̂(side.p.R) + ε)   r̂: balance-corrected (D33)
weight_p = drive_p / (drive_p + floor_p)                                     a silent pool does not steer
trend_p  = (drive_p − slow_p) / (slow_p + ε),   slow_p: EMA with τ = 30 ticks
```

### D30. Feeding

The fly eats when it stands on food and `r(feed) − rest(feed) ≥ feedThreshold`. There is no hunger override.
Hunger acts only through the brain's input (D32).

### D31. The panel shows the decoder

For each pair: `side`, `drive`, `trend`, declared valence, and pool sizes. The view names it a decoded readout.

## Part E: body layer (nerve-cord stand-in)

Declared in the world config, `flies.body.locomotion` (world-config v3). The same body runs every arm.

### W12. Walking rhythm and speed

```text
speed = clamp(baseSpeed + speedGain · (r(forward) − rest(forward)), 0, maxSpeed) · (1 + surgeGain · max(0, trend_approach))
```

`baseSpeed` > 0: the fly walks without being driven, as the nerve cord does. Exploration is a heading random walk
with amplitude `wander`. The brain modulates speed and direction; it never has to produce every step.

### W13. Steering law: tropotaxis plus klinotaxis, signed by valence

```text
v_p   = +1 approach, −1 avoid, 0 none
turn  = turnGain · Σ_p v_p · weight_p · side_p                         tropotaxis: L/R comparison
cast  = clamp(1 − castGain · Σ_p v_p · trend_p, castMin, castMax)      klinotaxis: rising approach → straight,
heading += (turn + wander · cast · noise) · dt                           rising avoid → turn more
```

Klinotaxis is the backbone. It needs only the **magnitude** of each sense in the brain (`drive`), which survives far
better than the L/R contrast (doc/research.md §1). It also works when the antenna separation gives too little L/R
difference at long range. Tropotaxis adds direction close to the source. Both read decoded brain signals only.

### W14. Escape reflex and backing up

- **Escape.** When `r(alarm) − rest(alarm) ≥ escape.threshold`, the body jumps `escape.distance` away from the side
  `side_danger` (or `side_heat`) points to, or backwards if neither side pool exists, then waits `escape.cooldown`.
  **On by default for v3.**
- **Backing up.** When `r(backward) − rest(backward) ≥ backup.threshold`, the body reverses for `backup.ticks`.

### W15. Maps

The decoder is brain-only, and the body layer has no map-specific parameter. A new map needs no recalibration
(R5). Stimulus fields MUST be normalised to [0, 1] per sense by the field builders (`food-field.js`,
`danger-field.js`, `heat-field.js`), so a different map size or source count does not change input scale. Spec 017
checks each builder and fixes any that is not.

## Part F: hunger

### D32. A hunger threshold on the food senses

The modulator declaration gets an optional `threshold` (contract capabilities v5, additive; absent = today's linear
curve):

```text
gain(h) = gainMin                                       if h < threshold
        = gainMin + (gainMax − gainMin) · (h − threshold) / (1 − threshold)   otherwise
```

- **Targets:**
  - `odour-food-*`: `gainMin` 0, so a sated fly's brain does not receive food odour;
  - `taste-*`: `gainMin` 0.1.
- **Where it is set:** in the world config, as `flies.modulators.hunger.threshold`, default 0.4. This overrides the
  snapshot's curve without re-extraction.

R1 then follows from the brain:
- **Sated:** no food drive, no food steering, and the fly explores.
- **Hungry:** food drive rises near food, klinotaxis and tropotaxis bring the fly to it, taste drives MN9, and the
  fly feeds.

This matches the biology: in flies, hunger raises the gain of food-odour receptor neurons.

## Part G: learning from world feedback

### D33. Online homeostasis in the decoder (relied on)

For every pool:
- a **rest rate**, an EMA with τ = 2,000 ticks;
- for each `side` pair, an **L/R balance** `b_p = slow(r(side.L)) / slow(r(side.R))`.

Both update **only while the pool's sense is quiet**: the pair's input channels are below 0.05, or, for `alarm`,
`feed`, `forward` and `backward`, while every sense is quiet.

`r̂(side.L) = r(side.L) / b_p`. C2 seeds the initial values, so the fly behaves from tick 0.

This removes:
- per-pool balance calibration;
- the rest turn bias (ADR 008 Q1);
- slow drift when the map or the fly's history changes the bulk.

It cannot cancel a stimulus, because it never updates while that stimulus is present. Telemetry shows rest and
balance per pool.

### D34. Mushroom-body valence learning (optional, not on the MUST path)

A three-factor rule on KC→MBON synapses, gated by DAN drive:
- PAM is driven while the fly eats (reward);
- PPL1 is driven on an escape or on heat contact (punishment).

The learned MBON valence scales `v_p` for odour pairs within [0.5, 1.5]. It is off by default, implemented as a LIF
plasticity option (Principle V, new bullet), and is its own feature after the demo.

**Why it is not on the MUST path.** Learning needs experience, but R2 must hold on the first encounter. Research also
shows the risk: tonic dopamine counted as punishment until a baseline-and-threshold rule was added.

## Part H: calibration, at most 30 minutes

One command: `calibrate.mjs --version=demo-v3 --stage=all`. Brain-only except C3. Calibration seeds only.
Costs are measured on the 14.5K brain: about 21 ms per tick with 5 LIF steps.

| Stage     | What                                                                                                                                                                                                                                                                                                                                  | Size                                    | Estimate (one core)         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------- |
| C1 regime | Grid `synapticScale` {3, 4, 5, 6} × `baselineCurrent` {0, 0.02, 0.04, 0.06}. Gates: rest activity 1–10 % of neurons per tick, no ignition (activity returns to rest within 100 ticks after the stimulus ends), every pair's `drive` candidates rise ≥ 3 Hz. Pick the passing point with the lowest rest activity, ties on lower scale | 16 points × 2 seeds × 300 ticks         | ~3.5 min (1 min on 4 cores) |
| C2 decode | Rest, then each pair left-only, right-only and bilateral, on 3 seeds plus the held-back seed. Select pools (D27), seed rest/balance (D33), write `decoder.json`                                                                                                                                                                       | 19 conditions × 4 seeds × 400 ticks     | ~10 min                     |
| C3 smoke  | Closed loop, calibration seeds, both maps: brain arm and random walk, hungry start. Report R1–R3 quick metrics. Pass/fail is reported, never tuned on                                                                                                                                                                                 | 2 maps × 3 seeds × 1,500 ticks × 2 arms | ~6 min                      |
| **Total** |                                                                                                                                                                                                                                                                                                                                       |                                         | **~20 min, under 30 (R4)**  |

**What is removed:**
- A2 `outputScale` fitting, because the decoder normalises online;
- robustness over grid neighbours, because C1 is a 16-point regime check, not a search;
- world-stage candidate sweeps.

**If C1 or C2 fails:**
- the run stops with the failing gate and its numbers;
- `--budget-minutes=30` is a hard cap;
- held-out verification (Part K) is a separate command, as now.

## Part J: contracts and versions

| Contract            | Change                                                                                                                                                                  | Compatibility                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Constitution        | v2.0.0 (Part A)                                                                                                                                                         | Major                             |
| Brain version       | New `flies.brain.version: "v3"`: wide snapshot + decoder + body layer                                                                                                   | v0/v1/v2 unchanged and still load |
| Snapshot            | None (container v4, kind `forager-wide`)                                                                                                                                | —                                 |
| `decoder-v1`        | New (D28), JS reader and C2 writer tests                                                                                                                                | New                               |
| World config        | `world-config-v3`: `flies.brain.decoder`, `flies.body.locomotion`, `flies.body.escape` (enabled default true), `flies.body.backup`, `flies.modulators.hunger.threshold` | v2 world files unchanged          |
| Capabilities        | v5 + optional modulator `threshold` (D32)                                                                                                                               | Additive                          |
| LIF params          | `baselineCurrent` (L10), default 0                                                                                                                                      | Golden test unchanged             |
| Worker protocol     | None (v3 already carries spikes)                                                                                                                                        | —                                 |
| Calibration profile | New `profiles/demo-v3.mjs` with stages C1–C3                                                                                                                            | Other profiles untouched          |

**New world:** `world-forager-demo.json` on the sketch map, plus a second map for R5 (the current layout).

## Part K: acceptance (demo-complete)

On **held-out seeds**, on **both maps**, with **one** calibration. Arms:
- **B:** the brain;
- **RW:** random walk, same body layer, decoder signals zeroed;
- **RG:** the matched random graph, same C2 rule and body layer.

| Id      | Metric                                                                            | Pass                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1 (R1) | Find rate within 3,000 ticks, hunger ≥ threshold at start                         | B's 95 % CI lower bound > RW's upper bound                                                                                                                    |
| K2 (R1) | Same, hunger below threshold                                                      | B not above RW (hunger dependence)                                                                                                                            |
| K3 (R1) | Feeding once on food, hungry                                                      | ≥ 80 % of arrivals feed within 50 ticks                                                                                                                       |
| K4 (R2) | Per encounter (entering a danger ring ≤ 1): escape or a turn away within 20 ticks | ≥ 90 % of encounters                                                                                                                                          |
| K5 (R2) | Ticks inside danger rings                                                         | B ≤ 50 % of RW                                                                                                                                                |
| K6 (R3) | Ticks inside heat rings                                                           | B < RW (SHOULD)                                                                                                                                               |
| K7 (R4) | `--stage=all` wall clock                                                          | ≤ 30 min (SHOULD)                                                                                                                                             |
| K8 (R5) | K1–K5 on the second map without recalibrating                                     | Pass (SHOULD)                                                                                                                                                 |
| K9      | RG on K1, K4                                                                      | **Reported, not gating.** If RG passes too, the results say the behaviour comes from the decoder and body on any graph with this I/O, not from the connectome |

**Run check (constitution):** the static server starts, the demo world runs 6 flies, and there are no console errors.

## Part L: risks and fallbacks

| Risk                                                 | Sign                             | Fallback, in order                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `side` pool for food (too few side-selective DNs) | C2 `E-DECODE-side.odour-food`    | Klinotaxis alone (W13) carries R1; `side` term 0                                                                                                     |
| No `drive` pool for danger                           | C2 `E-DECODE-drive.odour-danger` | `alarm` from the named escape pool and `drive.heat`; if both fail, R2 fails: a finding                                                               |
| Bulk ignites at every `baselineCurrent`              | C1 no point                      | Add `baselineCurrent` 0.01 and `synapticScale` 2 to the grid (still under 30 min)                                                                    |
| Input too weak at the antenna separation             | `drive.odour-food` rise < 3 Hz   | An optional declared stimulus contrast gain, off by default                                                                                          |
| RG passes K1/K4                                      | K9                               | Report it. The demo still works; the claim narrows. The per-type fitting path (doc/research.md §2.1) is how the connectome would earn back the claim |

## Amendment A1 (2026-10-17, spec 017 BUG-001): readout candidates and the alarm read

**Finding.** On the 14.5K brain, no descending neuron carries a sense-specific response large enough for D27, at any
LIF point tried (specs/017-demo-forager/calibration.md, C1). The signal is in the central brain: on calibration
seeds, with the held-back seed reproducing, 1,623 neurons respond specifically to food odour, 12 to danger, 36 to
heat and 68 to mouth taste (9 of them DNs). Side-selective neurons are rare (3–14 a side).

**Decisions.**
- **D27 candidates:** every neuron that is not in a sensory input pool, plus the named outputs. Input-pool neurons
  stay excluded: their rate is the stimulus, and the body layer must not read the stimulus (Principle VI). The scope
  is recorded as `probe.candidates` in the decoder file, and the RG arm's C2 runs the same scope (Principle III).
  D27's gates are unchanged.
- **`alarm` read:** when `drive.odour-danger` exists, alarm's drive is that pool's drive; the union is the Part L
  fallback. A union's rate is a member-weighted mean, so the 5-neuron danger pool was lost under 14 heat neurons whose
  tail is burst noise (P(drive ≥ 0.4) per tick: union 0.028 at rest vs 0.025 at the danger edge; danger pool 0.001
  vs 0.196). Heat is avoided through klinotaxis (W13), not escape.
- **Units:** for v3, `feedThreshold`, `escape.threshold` and `backup.threshold` compare `r̄ − rest` in spikes per
  neuron per tick, and are set from a recorded probe, not from v2's normalised outputs.

**Consequence for the claim.** The brain still decides side (where a pool exists), strength, feeding and escape,
but the strength signal is read from central-brain neurons, upstream of the descending pathway. The README and panel
say "decoded readout"; they should not say "descending readout".

## Amendment A2 (2026-10-17, spec 017 BUG-002): the eating area and the feed read

- **Eating area.** "Stands on food" (D30) is the flower's eating area: every cell within Chebyshev distance
  `flies.food.reach` of the flower's cell. The demo worlds set 1, the 3×3 core where the food odour field is 100 %
  (`food-field.js`); 0 keeps the v1/v2 own-cell rule. Taste contact, eating and the find metric of every arm read
  the same area (`fly-world.js` `flowerAt`). Before, taste and eating needed the flower's one centre cell, smaller
  than its sprite, so a fly touching the flower neither tasted nor ate.
- **Feed read.** When `drive.taste-mouth` exists, feed's drive is that pool's drive; the named feed pool (MN9) is
  the fallback. MN9 barely follows taste in this cut (decoded drive 0.032 off food vs 0.051 starving on food), so
  eating flickered for single ticks. The taste-mouth pool is hunger-gated in the brain by D32's taste gain:
  P(drive ≥ 0.12) per tick is 0.10 sated, 0.41 at the hunger threshold, 0.76 hungry, 0.90 starving.
  `feedThreshold` 0.12.
- **No hunger-driven speed law.** A hungry fly in the area stops on most ticks because the brain feeds; a sated one
  walks on. The body layer does not read energy (D30, Principle VI).

## Amendment A3 (2026-10-17, spec 017 BUG-003): odour filters, flying over water, heat escapes like danger

- **Odour filters (Part L's "declared stimulus contrast gain", now implemented).** `flies.stimuli[sense].interpolate`
  reads a field bilinearly between cell centres; `flies.stimuli[sense].contrast: { common, gain }` maps each L/R pair
  to `clamp(common·m ± gain·d)`, `m`, `d` the pair's mean and half-difference. Both off by default. The antennae sit 1
  tile apart and the fields step once per tile, so read per cell L = R on 41 % of ticks; the demo worlds' food odour
  (interpolate, common 0.5, gain 5) has a median L/R difference of 0.22–0.30, against 0.05–0.09.
- **The filter does not steer by itself.** D27 needs 5 side-selective neurons a side; the brain has 3 left / 4 right
  for food odour, so no `side.odour-food` pool exists and tropotaxis has nothing to read. Lowering the minimum to 3
  was measured (find rate above the random walk on both maps) and **declined**: D27 keeps 5.
- **Flying over water.** `flies.body.crossWater` (v3): water is walkable for the body, not solid objects; touch does
  not fire on water; flies spawn on dry land. Every arm shares the world physics.
- **Heat escapes like danger.** `alarm` is the larger of `drive.odour-danger` and `drive.heat` (A1 read danger
  only). Heat's τ = 3 tail is network-burst noise (correlation 0.87 with whole-brain rate), so the escape reflex
  integrates alarm over `escape.tau` ticks before the threshold (W14; default 1, none). Demo worlds: tau 20,
  threshold 0.18: about one false escape per 18 s at rest, and escape within 5–13 ticks at danger rings 0–1 and
  6–7 ticks on water (heat 1).

## Amendment A4 (2026-10-17, spec 017 BUG-004): the motor stage

**Problem.** The v3 body applied every command at once. An escape set the heading in one tick (a 180° flip with no
danger side pool) and moved the fly `escape.distance` (1.5 tiles) in one tick; a walking step is about 0.03 tiles.
The world's `flies.body.turnRate` was not read by v3.

**Decision.** `flies.body.motor: { maxTurnRate, escapeTurnRate, maxAccel, sprintSpeed }` (v3, optional) adds a motor
stage between the W12–W14 commands and the body. The reflex laws give a target heading and a signed target speed;
the body turns towards the heading by at most the turn rate per second, the shorter way round, and changes speed by
at most `maxAccel` per second. Forward speed is scaled by cos(heading error), so a fly turns before it runs.
- **Escape** is a motor programme: the brain's alarm (trigger, threshold, cooldown unchanged) sets an escape heading;
  the fly turns at `escapeTurnRate` and sprints at `sprintSpeed` until it has covered `escape.distance` (at most
  100 ticks). No eating during a sprint.
- **Backing up and feeding** ramp speed instead of switching it.
- The stage reads only the body's own state. It never changes what the brain decided, only how fast the body carries
  it out. It is identical for every arm. Absent, commands apply at once (the pre-A4 behaviour, kept for comparison).

**Values.** Demo worlds: `maxTurnRate` 4 (the world's `turnRate`), `escapeTurnRate` 15 (fly body saccades reach
about 17 rad/s), `maxAccel` 12, `sprintSpeed` 3 (`maxSpeed`). Largest turn 0.75 rad and largest step 0.17–0.24 tiles
per tick, against 3.14 rad and 1.5 tiles before (above `sprintSpeed` only through W12's surge, which multiplies
speed after the `maxSpeed` clamp; it ramps, so it is not a jump).

**Cost.** A turn-and-sprint leaves a danger ring later than a teleport: K4 (exit within 20 ticks) falls from
42 % / 63 % to 38 % / 48 % (sketch / tilemap, calibration seeds 6–8), while ticks in danger fall from 47 % / 28 % to
40 % / 4 % (calibration.md).

## Amendment A5 (2026-10-17, spec 017 BUG-005): fewer false escapes, a varied escape turn

**Finding.** Every 180° turn was an escape (322 of 322 over both maps), and every escape reversed the fly: no
danger side pool exists, and heat has only `side.heat.R`, so the side was always unknown (W14 Edge Case). About half
of the escapes on the sketch map and a quarter on the tilemap fired with no danger or heat input at all, from
whole-brain bursts.

**Decisions.**
- `escape.threshold` 0.18 → **0.22** (the integrated alarm, A3). Escapes with no danger or heat input fall from
  77 / 40 to 7 / 9 (sketch / tilemap, 6 flies × 3,000 ticks); 0.25 also removes most real escapes.
- **`escape.turn: { min, max }`** (radians, W14): when the side is unknown, the escape turns by an angle drawn
  uniformly from [min, max], left or right at random, from the fly's seeded stream. Absent: reverse (π), as before.
  Demo worlds: 90°–135°.

**Effect** (calibration seeds 6–8; sketch / tilemap): find 50 % / 22 % → 83 % / 50 % (random walk 56 % / 39 %);
ticks in danger 40 % / 4 % → 21 % / 10 % (random walk 62 % / 66 %); ticks in heat 15 % / 6 % → 19 % / 15 %
(random walk 15 % / 7 %); K4 38 % / 48 % → 19 % / 28 %. **Heat avoidance is lost**: the smaller turn lets a fly at
the shore turn along it. A 120°–180° range did not recover it (14 % / 10 %) and lost food and K4. Aiming escapes away
from heat needs a heat side pool on both sides (D27).

## Implementation order

1. **Spec 016:** Part 0 ports. Bug fixes only; `npm test` and extractor tests green.
2. **`/speckit-constitution`:** v2.0.0, Part A.
3. **Spec 017, demo forager:**
   1. L10;
   2. decoder-v1 reader and the C2 writer;
   3. decoder and body layer (W12–W14);
   4. hunger threshold (D32);
   5. homeostasis (D33);
   6. world-config v3 and the demo world;
   7. `profiles/demo-v3.mjs`;
   8. panel (D31);
   9. Part K run.
4. **Spec 018 (optional):** mushroom-body learning (D34).
5. **Research, separate:** the per-type fitting test (doc/research.md §2.1).

## Constitution fit (after v2.0.0)

| Principle                   | Fit                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static web               | No build. The decoder and body are plain ES modules. No new browser dependency                                                            |
| II. One fly, one worker     | The LIF stays in the worker. The decoder reads spikes on the main thread; no neural computation there                                     |
| III. Connectome-grounded    | Weights, signs and identities unchanged. Readout pools come from a declared rule, recorded with provenance and applied to RG too          |
| IV. Reproducible extraction | No extraction change. `decoder.json` is deterministic for the same snapshot, LIF block and seeds                                          |
| V. LIF                      | One new named parameter, default off, golden test unchanged. Homeostasis lives in the decoder, visible in telemetry                       |
| VI. Embodied flies (v2)     | The brain decides side, strength, feeding and escape; the body layer is declared and identical across arms; valence is declared and shown |
| VII. Simplicity             | Three small modules (decoder, body layer, demo profile) replace the A1/A2/B grid. Calibration drops from hours to ~20 min                 |

## Consequences

- The demo claim becomes: **the connectome localises and grades stimuli, decides feeding and escape, and hunger gates food perception; a declared nerve-cord stand-in walks.** This is less than "the brain does everything" and more than implemented-in-code, because the null arms run the same decoder and body.
- Calibration is a 20-minute regime check plus a decode, not a search. A map change needs none.
- The ADR 005–008 grid work is retired for `v3`. Its profiles stay for v1/v2 reproducibility.
- If K9 shows the random graph doing as well, that is the most important result of the project, and it points to
  the per-type fitting path.

## Alternatives considered

- **More grid calibration (ADR 008 path).** Rejected: two weeks, one robust point, 0 % find rate (doc/research.md §1.3).
- **Per-type parameter fitting now.** Deferred: the strongest scientific path, but days of offline tooling, a new
  dependency, and no guarantee of R1/R2 by itself. It is the follow-up if K9 shows RG ≈ B.
- **Readout by name with more neurons (all DNa types).** Rejected: the signal lands elsewhere (DNa01 ranks 230th of
  472). Name-based pools would re-run the same failure.
- **Learning valence instead of declaring it (D34 on the MUST path).** Rejected for R1/R2: requires surviving the first
  danger encounter. Kept as an optional feature.
