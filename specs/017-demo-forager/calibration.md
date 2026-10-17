# Calibration (T030): the demo forager brain's C1/C2/C3 run — demo-v3

**Date:** 2026-10-17. **Command:** `node calibrate.mjs --version=demo-v3 --stage=c1 --budget-minutes=30`, plus
several ad-hoc extensions of the same probe once the shipped grid failed (below). **Snapshot:**
`public/brains/forager-brain-wide.brain` (ADR 009 wide brain, 14,500 neurons, 730,859 edges, unchanged).

## C1 — regime: FAIL on the ADR 010 grid, and on every wider grid tried

### The shipped-grid run

`synapticScale {3,4,5,6} × baselineCurrent {0,0.02,0.04,0.06}`, 2 seeds, 300 ticks (world's own
`inhibitoryScale: 1.5, noiseAmplitude: 0.2, noiseBulkScale: 0, thresholdJitter: 0.1, tauAdapt: 100, adaptStep:
0.1` held fixed). Full output below (rest = fraction of all 14,500 neurons firing per tick; rise = Hz rise of
the ~1,316-candidate population — every descending neuron plus the six named outputs — under bilateral
full-strength stimulus of that pair, over its own rest):

| synapticScale | baselineCurrent | rest | odour-food | odour-danger | heat | taste-mouth | taste-leg | touch |
|---|---|---|---|---|---|---|---|---|
| 3 | 0 | 0.0002 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 0.02 | 0.0009 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 0.04 | 0.0057 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 3 | 0.06 | 0.0236 | 0 | 0 | 0 | 0 | 0 | -0.01 |
| 4 | 0 | 0.0003 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 0.02 | 0.0011 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 4 | 0.04 | 0.0087 | -0.02 | -0.01 | -0.02 | 0.01 | -0.02 | 0 |
| 4 | 0.06 | 0.0252 | 0 | -0.01 | 0 | 0 | 0 | 0 |
| 5 | 0 | 0.0003 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 5 | 0.02 | 0.0020 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 5 | 0.04 | 0.0114 | 0.01 | -0.03 | -0.01 | 0.02 | 0.01 | -0.01 |
| 5 | 0.06 | 0.0270 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 6 | 0 | 0.0004 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 6 | 0.02 | 0.0048 | 0 | 0 | 0 | 0.01 | 0 | 0 |
| 6 | 0.04 | 0.0145 | 0.01 | -0.01 | 0.01 | 0.02 | -0.01 | 0.01 |
| 6 | 0.06 | 0.0288 | 0 | 0 | 0 | 0.01 | 0 | 0 |

Wall clock: 2 min 36 s. No point passes: the rest gate (1–10 %) is reachable (scale 3–6, baseline 0.04–0.06),
but every pair's candidate-population drive rise is noise-level (≤ 0.04 Hz), far under the 3 Hz gate.

### Widening the grid (ADR 010 Part L: grid-widening fallback)

Three further probes, outside the shipped grid, before concluding this is a finding rather than a narrow miss:

1. **Higher `synapticScale` (10, 15, 20), `baselineCurrent` ≤ 0.04, same base block.** Rest activity rises
   smoothly (0.6 % → 6.5 %), but every pair's rise stays under 0.1 Hz — no improvement.
2. **Direct single-condition probe at the world's own shipped point (`synapticScale: 15, baselineCurrent:
   0.03`, same block), comparing the *whole-network* activity fraction against the *candidate-only* fraction,
   rest vs. bilateral odour-food stimulus, 300 ticks:** the whole network responds clearly (3.4 % → 6.1 % at
   scale 15; 6.0 % → 8.4 % at scale 20; 9.7 % → 11.5 % at scale 30) — stimulus plainly reaches *something* — but
   the named output pool's own mean rate is flat or lower under stimulus (1.36 % → 1.31 % at scale 15), and the
   full ~1,316-candidate population is likewise flat (1.73 % → 1.75 % at scale 15; 2.33 % → 2.47 % at scale 20).
3. **Much higher `synapticScale` (60, 100) with `inhibitoryScale: 1`:** the network ignites outright (59–62 %
   of all neurons firing per tick, 40 % of candidates) — well past the ignition gate — and even there the
   candidate population's rate does not rise with stimulus (40.2 % → 39.2 % at scale 60); if anything it falls
   slightly, consistent with extra inhibitory drive outrunning the stimulus-specific signal once the network is
   this active.

**Finding:** across quiet, intermediate and ignited regimes alike, the measured descending-neuron-plus-output
candidate population's spiking does not carry a pair-specific signal large enough to clear C1's 3 Hz gate, on
this snapshot, with this LIF core. This reproduces the failure mode ADR 010's own Context section names from
doc/research.md §1 ("the motor pools get little input... whatever the readout gain") and §1.2 ("the readout is
where the signal is not") — the problem ADR 009's output-partner seeds narrowed for *static* synaptic input
share (its own "97–100 % of real input, food contrast 92 %" is a connectome-structure measurement, not a live
LIF response) but which this run shows is not yet resolved for the *simulated, spiking* response the decoder
needs.

### Extended search (same session, at the user's explicit request to keep looking)

A wider, more systematic search before concluding the grid itself — not just the ADR 010 starting point —
has no viable point, covering `synapticScale` 3–100, `inhibitoryScale` {0.5, 1.0, 1.5}, `baselineCurrent`
0–0.06, `noiseAmplitude` {0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8} × `noiseBulkScale` {0, 1}, `thresholdJitter` {0,
0.1}, `tauSyn` {0, 5, 10}, and `(tauAdapt, adaptStep)` ∈ {(100, 0.1), (20, 0.3), (300, 0.05)}, with settle
windows from 300 to 1,000 ticks:

- **Structure is not the problem.** A breadth-first search from every input neuron reaches 1,315 of 1,316
  candidates within 4 hops (51 at hop 1, 643 at hop 2, 1,267 at hop 3) — the wiring exists; the dynamics do not
  carry a usable signal across it.
- **The rest-ceiling and the signal-floor sit on opposite sides of the same knob.** With `inhibitoryScale:
  1.5` (the world's own shipped value), rest activity stays in the required 1–10 % window only for
  `synapticScale` 30–34; every point in that narrow window gives a candidate-population drive rise under 0.15
  Hz for every pair (1/20th of the 3 Hz gate). Pushing `synapticScale` past ~35 does raise the candidate
  response — up to 14 Hz at `synapticScale: 80` — but the *whole-network* rest activity jumps with it, past
  10 % at `synapticScale` 36+ (inhibitoryScale 1.5) and straight to 20–47 % at `inhibitoryScale` 1.0 or 0.5
  (even at `synapticScale: 25`). The transition is sharp, not gradual: at `inhibitoryScale: 0.5,
  synapticScale: 35`, rest activity is exactly 0 % at `baselineCurrent: 0.025` and 23 % at `baselineCurrent:
  0.026` — a step, not a ramp, with no intermediate point to land the gate in.
- **No single pair is the exception.** At the best-behaved point found outside the rest-ceiling-respecting
  window (`synapticScale: 25, inhibitoryScale: 0.5, baselineCurrent: 0.03`, rest already over the 10 %
  ceiling at 7.4 % of candidates / higher at the whole-network level), the six pairs' candidate-population rise
  were: odour-food 0.14 Hz, odour-danger 0.02 Hz, heat −0.04 Hz, taste-mouth 0.13 Hz, taste-leg −0.03 Hz, touch
  −0.06 Hz — all near zero, three of six slightly negative.
- **Not a mean-cancellation artefact.** The per-candidate (not population-mean) distribution of rate changes
  under odour-food bilateral stimulus, at the world's own shipped point (`synapticScale: 15`), tops out at a
  0.55 Hz change for the single most-responsive candidate out of 1,316 — not 3 Hz hiding inside a wash of
  opposite-signed responses.
- **tauSyn and weaker adaptation do not help.** `tauSyn: 5` or `10` *shrinks* the in-range window (rest
  crosses the ceiling at a lower `synapticScale`); a weaker/slower adaptation (`tauAdapt: 300, adaptStep:
  0.05`) extends the in-range window by about two `synapticScale` points but the candidate rise inside it
  stays within ±0.16 Hz of zero.

**Per AGENTS.md "Behaviour failures are findings"**: this is recorded as the result, not hand-tuned or papered
over. No point was found — in the ADR 010 grid, in a substantially wider search across every LIF axis the
contract exposes, or at the extremes of the regime (fully silent through fully ignited) — where the candidate
population's bilateral drive rise clears 3 Hz for any of the six declared pairs while rest activity stays in
the required 1–10 % window. The two requirements pull in opposite directions on every knob tried: this
reproduces, now with direct live-simulation evidence rather than only the prior grid-search record doc/
research.md cites, ADR 010's own stated root cause ("one global scale cannot serve every pathway... at a
quiet setting the bulk carries correct, sense-specific steering, but the motor pools get little input... at a
louder setting the bulk ignites and the signal is lost") — for the *candidate population as a whole*, not only
the few named output neurons the original research path read. C2 (pool selection) and C3 (closed-loop smoke)
were not run: both depend on C1's chosen point, and ADR 010 Part H's own dispatch rule ("stop at the first
failing gate... do not continue") applies.

## C2 — decode

**Status (2026-10-17): run anyway, at the user's explicit request, to unblock the app** (the C1 gate above was
never cleared by any point tried). This is **not** a validated calibration — it is recorded here so nobody later
mistakes the shipped `public/brains/forager-brain-wide.decoder.json` for one.

Point used: `synapticScale: 5, baselineCurrent: 0.04` (the shipped C1 grid's best in-range point by average
per-candidate drive rise — `c1.json`'s checkpoint, not a new search).

**Correction (2026-10-17, same day): `flies.brain.lif.outputScale` was missing from both demo worlds' LIF
blocks and from `contracts/world-config-v3.md`'s own worked example** — a real bug, not part of the C1 finding
above. `v2`'s working config (`world-forager-wide.json`) sets `outputScale: { feed: 128, forward: 8192,
backward: 64, "turn-left": 2048, "turn-right": 8192, escape: 2048 }`, a per-named-output-channel synaptic-weight
gain (`lif-v1.js` L6) the output pool needs to be responsive at all; without it those six neurons receive only
the bulk `synapticScale` and barely fire. This is what made the panel's Outputs section show no activity. Fixed
in `world-forager-demo.json`, `world-forager-demo-tilemap.json` and the contract's worked example (all now carry
the same values `v2` does — nothing about `v3` changes which neurons are named outputs or their topology, so
there is no reason for a different gain). The decoder below was regenerated with it included.

C2's own gates (ADR 010 Part H defaults: `sideThreshold: 0.3, sideMinRiseHz: 2, driveRiseHz: 3,
driveSelectivityRatio: 2, reproductionFraction: 0.7`) were relaxed, re-tuned after the `outputScale` fix (adding
it changes which candidates are noisy vs. reproducible — the first attempt's looser gates started giving
`E-DECODE-*` errors once it was added), to `sideThreshold: 0.15, sideMinRiseHz: 0.3, driveRiseHz: 1,
driveSelectivityRatio: 1.2` — the loosest point found that still gives **zero** `E-DECODE-*` errors (every
selected candidate's sign still reproduces on the held-back seed; weaker-than-designed signal, not noise dressed
up as signal).

Result: `pools: { drive.taste-mouth: 2, feed: 2, forward: 2, backward: 4, alarm: 2 }`. No `side.*` pool exists
for any sense, and no `drive` pool exists for `odour-food`, `odour-danger`, `heat`, `touch` or `taste-leg` —
a diagnostic run with much looser gates (`sideThreshold: 0.05`, down to `reproductionFraction: 0.5`) did turn up
apparently-selective candidates for `odour-food`/`odour-danger`/`heat`/`touch`, but **every one failed held-back-
seed reproduction** (`E-DECODE-side.odour-food.L` etc.) — confirming this is noise, not a weak real signal,
exactly as the per-candidate check in the C1 section above already found. `feed`/`forward`/`backward`/`alarm`
are the snapshot's own named output neurons (`decoder-engine.mjs`'s `outputNeurons()`), always present regardless
of data, and now correctly weight-boosted via `outputScale`; `alarm`'s union only picks up the escape-output
neurons here (`drive.odour-danger`/`drive.heat` are both absent). With `outputScale` in place, a 200-tick check
of the raw brain (no stimulus) shows every output channel reaching a meaningful peak value (0.13–0.40 over the
window, up from effectively flat beforehand) and ~3.9% of all 14,500 neurons spiking per tick on average — the
Outputs panel section should now show real bars, even though the senses behind steering still mostly cannot.

**Practical consequence**: `odour-food`, `odour-danger`, `heat`, `touch` and `taste-leg` decode to `side:
undefined, drive: 0, weight: 0, trend: ≈0` for the whole run — no tropotaxis, no klinotaxis modulation, no
odour-driven approach or avoidance at all. Only contact chemosensation (`taste-mouth`, i.e. a fly already on
food) and the brain's own `feed`/`forward`/`backward`/`alarm` output neurons (now properly weight-boosted) drive
any behaviour. A 500-tick, 1-seed smoke run (`v3` vs. `baseline` arms, `world-forager-demo.json`, pre-
`outputScale`-fix) completed with no crash: find rate 0% in that short window, and 0/6 danger-ring encounters
resolved within 20 ticks (escape not stimulus-responsive, as expected). **R1/R2/R3 should not be expected to
pass** with this decoder — it exists to let the app run and the UI/mechanism be exercised, not as a demo-ready
brain.

## C3 — smoke

Not run as part of `calibrate.mjs` (blocked on C1/C2's formal gates, per the stop-at-first-failing-gate rule). A
500-tick ad-hoc smoke run is recorded above instead, run directly against the file this section produced.

## C2 re-run and C3 after BUG-001 (2026-10-17)

See `bugs/BUG-001.md`. Four code bugs had kept the demo fly from smelling food, eating, holding its heading and
reacting to danger. With them fixed, C2 was re-run under ADR 010 Amendment A1.

### Whole-brain probe (motivates A1)

World LIF block (`synapticScale` 15, `baselineCurrent` 0.03), seeds 1–2, held-back seed 4, 400 ticks, every
non-input neuron. A neuron counts when its rise is ≥ 0.05 spikes/tick, ≥ 2× its rise under any other pair, and
reproduced on seed 4:

| Pair | `drive` neurons | of which DNs | side L / R (\|s\| > 0.3, reproduced) |
|---|---|---|---|
| odour-food | 1,623 | 0 | 3 / 6 |
| odour-danger | 12 | 0 | 2 / 3 |
| heat | 36 | 0 | 6 / 14 |
| taste-mouth | 68 | 9 | 9 / 12 |

### C2

`calibrate.mjs --version=demo-v3 --stage=c2`, world LIF block (so the decoder now matches the world; the previous
file was probed at 5 / 0.04), **D27's default gates, not relaxed**, `candidates: "non-input"`. 0.7 min. Passes with
no `E-DECODE-*`:

`drive.odour-food` 201, `drive.odour-danger` 5, `drive.heat` 14, `drive.taste-mouth` 26, `drive.taste-leg` 4,
`drive.touch` 5, `side.heat.R` 9, `side.taste-mouth.R` 6 (each without its L partner, so unused), `feed` 2,
`forward` 2, `backward` 4, `alarm` 21.

### Threshold probes (motivate the v3 unit thresholds)

Open loop, demo world brain and modulators, seeds 1–2, 600 ticks, decoded with `decodeTick`.

- **Feed (MN9) under mouth taste.** P(`feed` drive ≥ 0.1) per tick: 0.14 off food, 0.15 sated on food, 0.23
  starving on food; P(≥ 0.5) ≤ 0.01 everywhere. `feedThreshold` 0.5 → **0.1**.
- **Alarm.** P(drive ≥ 0.4) per tick: union 0.028 at rest, 0.025 at the danger edge (not specific);
  `drive.odour-danger` 0.001 at rest, 0.011 / 0.048 / 0.196 at danger rings 2 / 1 / 0, 0.000 under food odour;
  `drive.heat` 0.057 at rest vs 0.108 at full heat (burst tail). Alarm reads the danger pool (A1);
  `escape.threshold` 0.5 → **0.4**.
- Mean decoded drive per pair is specific: food odour moves only `drive.odour-food` (0.06 → 0.13), touch only
  `drive.touch` (0.01 → 0.20), danger only `drive.odour-danger` (0.03 → 0.26), heat only `drive.heat` (0.05 → 0.19).

### C3 smoke

`--stage=c3`, calibration seeds 6–8, 1,500 ticks, hungry start. 3.4 min. Reported, not tuned on.

| Map | Arm | Find [95 % CI] | Ticks in danger / heat ring |
|---|---|---|---|
| sketch | v3 | 22.2 % [5.6, 44.4] | 29.1 % / 31.2 % |
| sketch | random walk | 38.9 % [16.7, 61.1] | 38.4 % / 39.8 % |
| tilemap | v3 | 11.1 % [0.0, 27.8] | 2.0 % / 30.4 % |
| tilemap | random walk | 11.1 % [0.0, 27.8] | 53.3 % / 23.0 % |

**Reading.** Danger avoidance comes from the brain: on the tilemap the fly spends 2 % of ticks in danger rings
against 53 % for the random walk. Food is now perceived and graded by the brain, and flies that reach food eat,
but approach is no better than the random walk. The body layer's locomotion values (`wander` 0.4 rad/s,
`castGain` 1, `castMax` 1) leave klinotaxis almost no turning to modulate. That is the next finding to address; no
stage of Part H calibrates them.

## Eat probe (BUG-002, 2026-10-17)

Open loop, demo world brain and modulators, seeds 1–3, 600 ticks, food odour 1 on both antennae, taste 1 on mouth
and legs when "on food", decoded with `decodeTick`. Motivates ADR 010 Amendment A2 and `feedThreshold` 0.12.

| Condition | MN9 feed drive (τ 3) | `drive.taste-mouth` mean | P(taste-mouth ≥ 0.12) |
|---|---|---|---|
| off food, energy 0.3 | 0.032 | 0.020 | 0.04 |
| on food, energy 0.9 | 0.037 | 0.041 | 0.10 |
| on food, energy 0.6 (hunger threshold) | 0.037 | 0.041 | 0.10 |
| on food, energy 0.45 | 0.035 | 0.110 | 0.41 |
| on food, energy 0.3 | 0.046 | 0.172 | 0.76 |
| on food, energy 0.05 | 0.051 | 0.205 | 0.90 |

MN9 smoothed over τ = 20 is no better (0.011 off food vs 0.029 starving, overlapping).

### C3 after BUG-002

`--stage=c3`, seeds 6–8, 1,500 ticks, hungry start, 3.2 min. "Find" is now entering a flower's eating area
(`reach` 1) for both arms, so it is not comparable with the table above.

| Map | Arm | Find [95 % CI] | Ticks in danger / heat ring |
|---|---|---|---|
| sketch | v3 | 55.6 % [33.3, 77.8] | 29.0 % / 38.7 % |
| sketch | random walk | 61.1 % [38.9, 83.3] | 38.4 % / 39.8 % |
| tilemap | v3 | 38.9 % [16.7, 61.1] | 2.1 % / 27.9 % |
| tilemap | random walk | 33.3 % [11.1, 55.6] | 53.3 % / 23.0 % |

Approach is still at the random walk's level (open finding: locomotion values).

## BUG-003 probes (2026-10-17)

- **Antenna L/R difference**, closed loop, 3 flies × 1,000 ticks, food odour present: per-cell sampling, median
  |L − R| 0.003 / 0.093 / 0.096 (one fly at 0 on 41 % of ticks); interpolate, 0.034 / 0.050 / 0.093; interpolate +
  contrast (common 0.5, gain 5), 0.302 / 0.223 / 0.247.
- **Heat noise**: correlation of τ = 3 heat drive with the whole-brain rate deviation, 0.87 at rest. Subtracting it
  fails under sustained stimulus (food odour alone reads 0.21), so it is not used.
- **Escape integration**, open loop, seeds 1–4, stimulus on after 200 quiet ticks, alarm = max(danger, heat) each
  EMA τ = 20, threshold 0.18: escape episodes per 1,000 ticks at rest 2.8, under food 2.5, under touch 2.8; first
  escape after 5–13 ticks at danger 1, 6–9 at danger 0.5, 6–7 at heat 1, 16–48 at heat 0.5.
- **Side minimum 3 (declined)**: C2 with `minSideMembers: 3`, other D27 gates unchanged, gives `side.odour-food` L 3 /
  R 4 with no `E-DECODE`. Seeds 6–8, 1,500 ticks: find 66.7 % [44.4, 88.9] vs RW 55.6 % (sketch), 61.1 % [38.9,
  83.3] vs 38.9 % (tilemap). Not shipped: D27 keeps 5 (user decision).
- **Shipped decoder** after BUG-003, same seeds: see `bugs/BUG-003.md` "Result".

## Motor stage (BUG-004, 2026-10-17)

Calibration seeds 6–8, 1,500 ticks, shipped decoder; values as `maxTurnRate / escapeTurnRate / maxAccel /
sprintSpeed`.

| Map | Motor | Find | Danger / heat ticks | K4 |
|---|---|---|---|---|
| sketch | none | 38.9 % | 46.8 % / 6.3 % | 10/24 |
| sketch | 4 / 10 / 6 / 3 | 44.4 % | 40.3 % / 15.4 % | 5/21 |
| sketch | 4 / 15 / 12 / 3 (shipped) | 50.0 % | 39.7 % / 14.8 % | 6/16 |
| tilemap | none | 22.2 % | 27.7 % / 2.5 % | 12/19 |
| tilemap | 4 / 10 / 6 / 3 | 16.7 % | 5.5 % / 5.9 % | 8/24 |
| tilemap | 4 / 15 / 12 / 3 (shipped) | 22.2 % | 3.9 % / 5.7 % | 14/29 |

Two settings tried, on calibration seeds only. The shipped one is the faster escape; 15 rad/s is within fly body
saccade rates (about 17 rad/s).
