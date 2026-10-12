# Calibration: the 15K cautious forager brain's LIF settings (ADR 006 L11)

- **Date:** 2026-10-10
- **Seeds:** exploratory only (7, 42). No `experiment.seeds`/held-out run was used for this pass; this is a
  first calibration-seed look, not a verdict (ADR 006's own Calibration protocol: "calibration seeds only for
  every stage; held-out seeds for the verdict").
- **Brain:** `public/brains/forager-brain-15k.brain`, extracted from the real dataset (12,996 neurons, 1,565,493
  edges at `minSynapses: 1`; see T023's commit message for the full report). `weightRule: synapseCount`.

## Starting point (L11)

`dt` 1, `tau` 20, `refractorySteps` 2, `tauSyn` 5, `synapticScale` 0.04, `stepsPerTick` 10 — the values ADR 006
L11 quotes from Shiu et al. 2024, shipped as-is in `world-forager-15k.json` (no tuning yet).

**Measured** (seed 7, 1,000 ticks, fly away from any flower, no stimulus): mean activity **26.5 %** of neurons
per LIF step. ADR 005's A1 rest gate wants 0.2–10 %. This is well above it — the network is ignited, not quiet,
at the starting `synapticScale`.

## Exploratory sweep (not a staged calibration)

A quick sweep of `synapticScale` alone (seed 42, fly 3.5 tiles from the large flower, 500–2,000 ticks per
point), everything else at the L11 starting values:

| `synapticScale` | mean activity | `forward` output | fly moves toward the flower? |
|---|---|---|---|
| 0.02 | ~23 % | 0 | no (turns in place) |
| 0.04 (shipped) | ~26–28 % | 0 | no |
| 0.05–0.07 | ~30–32 % | ≈ 0 | erratic (wanders toward the world edge on some seeds) |
| 0.08–0.16 | ~34–38 % | 0.1–0.4 | sometimes — one run reached and passed the flower; not reproduced cleanly across nearby scales |

**Finding.** As in ADR 005's own history with the v1 brain (Annex B), this subgraph does not show a clean
monotone path from "silent" to "a stable walking/foraging regime" as `synapticScale` rises — the measured
`forward`/`feed` outputs are noisy and not consistently responsive to distance-to-flower across this narrow
sweep. A real calibration needs the full staged protocol ADR 006 describes (per-group A1 gates — rest,
odour-above-rest in `al`/`central`, the brake and feed gates on a clamped input — then B on held-out seeds, and
the `synapseCount` vs `postFractionAbsolute` comparison), which was not run here: it is a multi-round search over
`synapticScale` × `tauSyn` × `input.rate[1]` × `stepsPerTick`, each round needing its own held-out verification,
the same shape of effort spec 008's own `calibration.md` records (five grid rounds for a brain 4.5× smaller and
far cheaper to step).

## What this means for the shipped world file

`world/world-forager-15k.json` ships the L11 starting values unmodified, labelled as a starting point, not a
calibrated setting (`public/world/README.md`'s convention for an uncalibrated brain). The wiring this feature
delivers — six senses reaching the network, the pair-grid-selected brake/feed/escape pathways, Poisson input
encoding, `groupGain`, the escape physics and cooldown, the panel's region-activity section, and the experiment
script's five new metrics — is all in place and exercised by the test suite (`npm test`) against the real
extracted brain. The *behavioural* acceptance criteria that depend on a calibrated network (SC-007's brake ratio,
US1's find-rate parity with v1, Gate C's held-out comparison) are not yet verified and are the next piece of
work, scoped the same way spec 008 scoped its own calibration pass: as follow-up work on top of a feature that is
otherwise complete, not a blocker folded into this implementation pass.

## Next steps (not done here)

1. Run ADR 006's A1 gates per group (`input`, `output`, `al`, `vnc`, `dn`, `central`) on a clamped input, across
   a `synapticScale` × `tauSyn` × `input.rate[1]` × `stepsPerTick` grid centred on the L11 values.
2. Compare the `synapseCount` and `postFractionAbsolute` weight rules through A1; take the more robust one to B.
3. Verify the brake (SC-007) and find-rate-parity (US1) criteria on held-out seeds, recording the run exactly as
   this document's "Interim choice" sections (`specs/008-hungry-forager-brain/calibration.md`) do for v1.

## Update 2026-10-11 — [BUG-001](bugs/BUG-001.md) fixed, brain re-extracted

Everything above this line was measured against the **pre-fix** brain (12,996 neurons). `/microfly-calibrate`'s
own runs (`.claude/skills/microfly-calibrate/runs/v2-*-2026-10-10/`) found `find.rate: 0`/`walked: 0` at every
point in that brain's exploratory sweep, at both the calibrated-quiet end (`synapticScale` 0.011) and the
saturated end. The root cause was not a parameter: `forward`'s pair-grid selection (D11) was sign-blind, so the
induced subgraph it chose was net inhibitory (**−867 signed weight/neuron**) regardless of scale.

The fix (ADR 006 Amendment 2026-10-10; `specs/013-forager-brain-15k-lif-v2/tasks.md` T091–T094) makes D11's
score sign-aware and narrows `forward` to `DNp09` alone (dropping `DNg100`, itself measured net-inhibitory on the
full connectome). The brain was re-extracted: **16,127 neurons, 1,839,129 edges**, every output pool's net
weight/neuron now positive (`forward +3719`, `turn-left +9152`, `turn-right +9329`, `backward +2431`,
`feed +253`, `escape +7911`). `public/brains/forager-brain-15k.brain` was replaced with this new extraction.

**None of the numbers above (26.5% rest activity, the `synapticScale` sweep table) apply to the new brain** —
its neuron count, edge count and admitted interneuron population are all different now. A fresh
`/microfly-calibrate` pass on the new snapshot is still needed before SC-007 (brake) and US1 (find-rate parity)
can be verified; this document's "Next steps" above are otherwise still the right next actions, just against the
new file.

## Update 2026-10-11 — `/microfly-calibrate --stage=auto` on the post-BUG-001 brain: no A1 pass, one near-miss

Five `--stage=auto` runs against the re-extracted brain (16,127 neurons), all calibration-seed only, no held-out
seeds touched. **0 of 342 valid A1 grid points pass** (robust, >= 50% of axis-neighbours also passing). No
world-stage run was attempted — there is no A1-passing candidate to carry into it.

1. **Plain `synapticScale` grid** (`runs/v2-auto-20261011/auto.json`, 48 points, scale 0.002–0.02 ×
   `tauSyn` × `inputRateHigh` × `stepsPerTick`): a cliff, not a ramp. At 0.002 the network is silent
   (`output`/`vnc`/`central` quiet, only `al` flickers on at some `stepsPerTick`). At >= 0.005 everything —
   `output`, `al`, `vnc`, `dn`, `central` — is ignited together, with `gain:al`/`gain:central` also failing.
   0/48 pass.
2. **Narrowed scale grid** (`runs/v2-auto-narrow-20261011/auto.json`, 60 points, scale 0.0025–0.0045): same
   cliff at finer resolution. 0.0025 leaves `al` ignited alone while the rest stay silent; >= 0.003 ignites
   everything at once. 0/60 pass.
3. **Tooling bug found and fixed**: `calibrate.mjs`'s phase-2 axes merge applied
   `profile.groupGainAxisFor(stuck)` *after* `--axes`, and that function returns the truthy `[{}]` (not `null`)
   whenever classify finds no "stuck" region — silently discarding any `groupGain` the operator passed via
   `--axes`. `al` never satisfies classify's strict "ignited at every scanned scale" test, so this fired every
   time. Fixed in `.claude/skills/microfly-calibrate/scripts/calibrate.mjs` (explicit `--axes` override now wins).
   A `groupGain.al` run taken before this fix (`runs/v2-auto-algain-20261011/`) is invalid and is not used below.
4. **`groupGain.al` grid, post-fix** (`runs/v2-auto-algain-fixed-20261011/auto.json`, 144 points, scale
   {0.005, 0.01, 0.02} × `al` gain {0.1, 0.2, 0.3, 0.5}): suppressing `al`'s own gain does not decouple it from
   the rest of the network. At scale 0.005, `al` gain 0.1–0.3 leaves *everything* silent (`output`, `vnc`, `dn`,
   `central` included) — not just `al`. `al` gain 0.5 re-ignites everything together, same as before. Reading:
   `al` looks upstream of the rest of this circuit's activity rather than merely more excitable than it; there is
   no tested point where `al` is calm and downstream regions are still responsive. 0/144 pass.
5. **Fine grid around the transition** (`runs/v2-auto-algain-fine-20261011/auto.json`, 90 points, scale
   0.005–0.01 step 0.001 × `al` gain {0.3, 0.35, 0.4, 0.45, 0.5}, `tauSyn`=5, `stepsPerTick`=10 pinned,
   `inputRateHigh` kept at {0.08, 0.15, 0.3} to confirm robustness): **one consistent near-miss**. At
   `synapticScale=0.006, groupGain.al=0.4`, the only failing gate at *all three* `inputRateHigh` values is
   `ignited:output` — `al`, `vnc`, `dn` and `central` all sit inside the 0.2–10% rest band
   (`profiles/v2.mjs` `gates.restFloor`/`restCeiling`). Every neighbouring `al` gain (0.35 or 0.45) at the same
   scale fails on 3–4 regions at once; this point is a genuine local minimum, not noise. 0/90 pass, but this is
   the closest point found across all five runs.

**Finding.** A single global `synapticScale` cannot place `al` and the rest of the network in their quiet bands
at the same time — `al` drives the others rather than merely co-exciting with them. The best lead so far
(`synapticScale=0.006`, `groupGain.al=0.4`) leaves only `output`'s own rest activity slightly over the 0.1
ceiling; nothing else is close. The untried next lever is a `groupGain.output` axis (mirroring `groupGain.al`)
scanned near this point, to see whether `output` alone can be brought down without disturbing `al`/`vnc`/`dn`/
`central`. No shipped world config, extractor config, or this document's "shipped" status was changed by any of
these runs — `world/world-forager-15k.json` still ships the unmodified L11 starting values.

**This "Finding" turned out to be about the gates, not the brain** — see
[BUG-002](bugs/BUG-002.md) and the next section.

## Update 2026-10-11 — BUG-002: the A1 gates above were mis-specified; re-scored, no new simulation

[BUG-002](bugs/BUG-002.md) found the `--stage=auto` gates used for every run above wrong in seven ways: `output`
was rest-gated even though A2 overrides its gain regardless and output neurons have no outgoing edges to affect
anything else (D3); the 0.2–10% band was read off a per-tick union of spikes, which is not the same quantity at
`stepsPerTick` 5 and 10; the same floor forced `al`/`vnc`/`dn`/`central` away from the zero-basal-firing regime
L11 itself cites from Shiu et al. 2024; `brake`/`feed` compared taste alone against odour alone instead of
odour-plus-taste against odour; steering (`lateral`) was computed but never gated; A2 never checked that the
fitted forward gain leaves near-zero drive at rest; and there was no check that activity returns to rest once a
stimulus is removed. ADR 006 gained `## Amendment 2026-10-11` (A5) restating the gates; `engine.mjs` and
`profiles/v2.mjs` were fixed to match.

**Re-scored the same 342 rows from the five runs above, with no new simulation**, using the stored per-tick
`rest`/`odour`/`lateral` fields (`rescoreStoredRow()`, `engine.mjs`): the `output` exemption, the `input`-only
floor, the per-step rate conversion, the steering gate and the odour-gain gate are all pure functions of what a
checkpoint already stores, so this is a replay, not a search. **`brake`/`feed` cannot be re-scored this way** —
the old rows were probed with the taste-alone condition BUG-002 found wrong, not the corrected odour-plus-taste
one, and the **settle** gate was never probed at all before A5. Both need a fresh probe.

- **45 of 342 rows now pass** the gates that are re-scorable from storage (floor/ceiling/output-exemption/
  lateral/odour-gain) — against 0 of 342 under the original gates, confirming the "Finding" above was measuring
  mis-specified gates, not an uncalibratable brain.
- **34 of those 45 are robust** (>= 50% of each point's own axis-neighbours, within the same run's grid, also
  partial-pass), concentrated around **`synapticScale 0.005, tauSyn 2–5, groupGain.al 0.1–0.2`** (`runs/
  v2-auto-algain-fixed-20261011/auto.json`), where `al`/`vnc`/`dn`/`central` sit at or near true silence at rest
  (no floor applies to them under A5) while still clearing the `al`/`central` odour-gain gate and the new
  steering gate — the single most robust point is `synapticScale 0.005, tauSyn 5, inputRateHigh 0.08,
  stepsPerTick 10, groupGain.al 0.1` (robustness 1.0, every tested neighbour also partial-passes). A second,
  smaller cluster survives from the fine grid at `synapticScale 0.005–0.006, groupGain.al 0.3–0.45` (the old
  near-miss region), now passing cleanly once the `output` exemption and per-step rate are applied.
- **None of these 45/34 are a verdict.** Their stored `brake`/`feedContrast` values (echoed in the checkpoints)
  were measured under the taste-alone condition and must be ignored — recomputing them needs the corrected
  odour-plus-taste probe, i.e. a fresh `regime()` call. The settle gate has never been evaluated for any of these
  points either.

**What this does and does not establish.** It establishes that the brain is not stuck on an all-or-nothing
ignition cliff once `output` is correctly exempted and the floor is scoped to `input` — a materially different
picture from "0/342, no robust point" above. It does not establish a calibrated setting: brake, feed and settle
are exactly the gates this brain generation exists to pass (SC-007), and none of the 45/34 candidates has been
checked against them.

**Next step, not done here**: superseded by [BUG-003](bugs/BUG-003.md) — the narrowing below was itself centred on
an uncorrected `synapticScale` and missed three mechanisms. See the next section.

## Update 2026-10-11 — BUG-003: L11's `synapticScale` was derived with the wrong unit, and the grid never varied the mechanisms that damp an ignition cliff

[BUG-003](bugs/BUG-003.md) found that, independent of BUG-002's gate fix, the search itself was centred and scoped
wrong. ADR 006 L11's `synapticScale` (`0.04`, from `0.275 mV / 7 mV`) quoted Shiu et al. 2024's synaptic weight
without finishing their own model's conversion to net charge (`w · τ / t_mbr`, since `w` is a step on their
model's intermediate decaying variable `g`, not a direct addition to membrane potential): the corrected value is
`0.06875 / 7 ≈ 0.0098`, about 4× lower than `0.04`. ADR 006 gained `### A6` under `## Amendment 2026-10-11`
resolving Q1 for this row.

Separately, every `--stage=auto` run so far (all five, re-scored under A5 above) varied only `synapticScale`,
`tauSyn`, `inputRateHigh`, `stepsPerTick` and `groupGain` — never `tauAdapt`/`adaptStep` (L2), `thresholdJitter`
(L3) or `inhibitoryScale` (L8), despite all four already existing in `lif-v1.js`, off by default, as the standard
remedies for the ignition cliff these runs keep finding. The shipped v1 brain's own cost-table baseline (ADR 006
Annex A6) already uses non-zero `tauAdapt 20`/`adaptStep 0.05`. At the single best point found across all five
runs (`synapticScale 0.006, groupGain.al 0.4`), food odour (0.5) raises `central`'s activity from 0.0530 (rest) to
0.2979 (odour) — a whole-network jump, the expected signature of a model with no local damping.

`.claude/skills/microfly-calibrate/scripts/profiles/v2.mjs` is updated (`specs/013-forager-brain-15k-lif-v2/
tasks.md` T103): `synapticScale`'s axis is re-centred on `0.0098 × {¼, ½, 1}` (`[0.00245, 0.0049, 0.0098]`,
numerically close to the already-widened range above, so the BUG-002 finding's shape still stands), and three new
axes are added — `inhibitoryScale: [1, 1.5, 2, 3]`, `adapt: [[0,0],[50,0.05],[100,0.05],[200,0.05]]` (paired
`[tauAdapt, adaptStep]`), `thresholdJitter: [0, 0.1, 0.2]`. Unit-tested in `tests/calibrate-profile-v2.test.mjs`;
no new simulation has been run against this widened grid.

**Next step, not done here**: run `/microfly-calibrate --stage=auto` on the corrected, widened
`profiles/v2.mjs`. The three new axes multiply the grid size considerably (`inhibitoryScale` ×4, `adapt` ×4,
`thresholdJitter` ×3 on top of the existing 36 points = up to 1,728), so the user should narrow with `--axes`
and/or `--shard` and expect to need a time/compute budget larger than any run so far — ask before starting. This
is the first live probe of brake/feed/settle under the corrected A5 protocol (BUG-002) and the corrected
`synapticScale`/damping-mechanism search (BUG-003) together. Per `AGENTS.md`, this must run in a separate session
from a coding/implementation session — tell the user to run `/microfly-calibrate` there before SC-007/US1's
held-out verdicts can be taken.

## Update 2026-10-11 — BUG-004: A4's sign-aware D11 fix thinned recurrent inhibition network-wide; resolved and re-extracted

[BUG-004](bugs/BUG-004.md) found that A4 (BUG-001's own fix) made D11's score sign-aware for every
`(pathway, outputGroup)` pair, not only `forward`'s, thinning recurrent inhibition across the whole selection:
inhibitory/excitatory admitted weight ratio 0.70→0.52 overall, `central` 0.74→0.48, `dn` 0.74→0.50 (pre/post-A4,
selected subgraph). **By user sign-off, this was resolved immediately rather than waiting for the
`/microfly-calibrate` pass BUG-004's own Recommended Fix proposed as the trigger** — the pass below is still
needed, now against the newest brain, but it no longer decides whether a D11 fix happens.

Measured against the real dataset before choosing a fix: `al`'s anchor precedent (ALLN, 67.6% of its inhibitory
weight) does not generalise — `central`'s dominant inhibitory class is 2.7%, spread across hundreds of small
cell types, with nothing bounded to anchor. A per-neuron closure budget and a single global top-k budget were
both tried and rejected (the first adds ~11,000 bodies at `k = 1`; the second over-corrects `vnc` while
under-correcting `output`). `vnc` itself needs no fix — measured with zero closure, its selected ratio (`0.904`)
already exceeds its real baseline (`0.735`), confirming it was never actually thinned by A4.

The shipped fix: a per-region `inhibitoryClosure` budget, `{"central": 250, "dn": 50}` (ADR 006 A7). `dn`'s
budget was tuned down from an initially tighter `100` (drift `0.008` against its real ratio) after it broke
`tests/forager-v2-brake.test.mjs` (leg taste very slightly lowered `backward` drive below its no-taste baseline);
`50` keeps that test passing at drift `0.022`. `central: 250` needed no such trade-off (drift `0.004`).

**Re-extracted**: 16,427 neurons (was 16,127 pre-fix), 2,078,088 edges, self-check `identical`.
`inhibitory/excitatory ratio, selected vs. real admitted: al 0.371/0.214, central 0.633/0.637, dn 0.687/0.665,
input 0.875/0.800, output 0.318/0.618, vnc 0.958/0.735` — `central`/`dn` both within their declared `0.15`
tolerance; `al`/`input`/`output`/`vnc` are reported but not gated (out of this fix's scope, per the measurements
above). Every output pool stays net-positive (`feed +195.5`/neuron, the tightest margin — was `+253` before
BUG-001/BUG-004). `npm test`: 553/559, the same 6 pre-existing, feature-unrelated `activity.test.mjs` failures as
every prior checkpoint on this branch — no new failures, including the `forager-v2-brake.test.mjs` wiring test
that caught the `dn: 100` regression during tuning.

**Next step, not done here**: none of the numbers in this feature's "Update 2026-10-11 — BUG-002/BUG-003"
sections above apply to this newest brain — its neuron count, edge count and admitted interneuron population
have changed again. Run `/microfly-calibrate --stage=auto` on the corrected, widened `profiles/v2.mjs` (BUG-003)
against *this* snapshot, in a separate session per AGENTS.md — this coding session has not run that search.

## Update 2026-10-11 — `/microfly-calibrate --stage=auto` + `--stage=world` on the post-BUG-004 brain: still no candidate that beats the random walk

Ran the search BUG-004's own "Next step" above asked for, against the post-BUG-004 brain (16,427 neurons). All
runs are calibration-seed only (seeds 6–10); no held-out seed was touched.

1. **Full widened grid is too expensive.** The corrected `profiles/v2.mjs` grid (`synapticScale` ×3, `tauSyn` ×2,
   `inputRateHigh` ×3, `stepsPerTick` ×2, `inhibitoryScale` ×4, `adapt` ×4, `thresholdJitter` ×3 = 1,728 points)
   estimates ~486 minutes — refused against a 60-minute budget. Narrowed to `stepsPerTick: [10]`,
   `inhibitoryScale: [1,2]`, `adapt: [[0,0],[100,0.05]]`, `thresholdJitter: [0,0.1]` (144–192 points per run,
   ~40–55 min) for everything below; `synapticScale`/`tauSyn`/`inputRateHigh` kept at the corrected profile's full
   resolution.
2. **`synapticScale 0.0049/0.0098` (`runs/v2-auto-2026-10-11/auto.json`, 144 points): 4/144 pass, 0 robust.**
   `gain:al`/`gain:central` dominate (103/144 rows) — the same ignition-cliff shape BUG-003 was meant to fix,
   still present at the corrected centre value.
3. **Widened down to `synapticScale` {0.0003, 0.000613, 0.00123, 0.00245}** (`runs/v2-auto-widened-2026-10-11/
   auto.json`, 192 points): **4/192 pass, 0 robust**, but the shape is now clear and U-shaped, not a cliff:

   | `synapticScale` | pass | dominant failure |
   |---|---|---|
   | 0.0003 | 0/48 | `brake`, `feed`, `lateral` on **every** row — too quiet, no behavioural response to anything |
   | 0.000613 | 0/48 | same — too quiet |
   | 0.00123 | 0/48 | `feed` (48), `brake` (41), `lateral` (27) — mixed |
   | 0.00245 | 4/48 | `gain:al`/`gain:central` mostly resolved (7/48); `feed` now dominates (39/48) |

   So `al`/`central` over-ignition (the BUG-003-era problem) and global silence are two ends of the same narrow
   window — the only even partially viable `synapticScale` band found across every run this feature has done is
   **~0.0012–0.00245**, a 4–8× narrower target than ADR 006's own literal starting grid.
4. **By user decision (2026-10-11), `feed` was demoted from a blocking A1 gate.** Every failure at
   `synapticScale 0.00245` traced to `feedContrast` sitting at exactly **0** (not negative — flat: the `feed`
   output never differs between the taste and odour-only probe conditions at this scale), a separate, open
   problem from the brake/lateral movement gates. `engine.mjs` gained `gates.requireFeed` (default `true`, so
   v1's profile — which does not set it — is unaffected); `profiles/v2.mjs` sets `requireFeed: false`, commented
   with this finding. Unit tests (`tests/calibrate-engine.test.mjs`, `tests/calibrate-profile-v2.test.mjs`)
   still pass unchanged.
5. **Re-ran the same 192-point grid with `requireFeed: false`** (`runs/v2-auto-nofeed-2026-10-11/auto.json`):
   **26/192 pass, 2 robust** — both at `synapticScale 0.00245, tauSyn 5, inputRateHigh 0.15, inhibitoryScale 1,
   adapt [100,0.05]`, differing only in `thresholdJitter` (0 vs 0.1): `brake` -1.0/-2.1, `lateral` -1.24/0.85.
6. **`--stage=world` on both candidates** (`runs/v2-world-2026-10-11/world.json`; 5 calibration seeds, 3,000
   ticks, 2 candidates × `forwardTarget` {0.3, 0.5} × `motorSmoothing` {0.05, 0.02} = 8 runs) — **all 8 do worse
   than the random-walk null arm**:

   | `thresholdJitter` | find rate (best of 4 fwd/ms combos) | random-walk baseline |
   |---|---|---|
   | 0 | 10.0% | **23.3%** (findCI [6.7%, 40%]) |
   | 0.1 | 6.7% | **23.3%** |

   Neither `forwardTarget` nor `motorSmoothing` recovers it; every one of the 8 variants is below the baseline's
   point estimate. A2's fitted `outputScale` sits at **8192** (the top of the 14-value `readoutScales` ladder) for
   `forward`/`turn-left`/`turn-right`/`feed`/`escape` alike, with only `backward` left near its no-op value (2) —
   i.e. A2 needed near-maximum amplification on almost every channel to reach its target operating point, which
   reads as "the underlying drive is weak/noisy, not cleanly directional" rather than "a well-separated signal
   that just needs scaling." `feedContrast` stayed exactly 0 as expected (the gate is exempted, not fitted).
   `walked: 0` and `approach` fully excluded (`15/15`) on **every** row, including the random-walk baseline itself
   — a metric-definition quirk affecting this whole run, not a signal specific to these candidates.

**Finding.** Across this session's full span — `synapticScale` 0.0003–0.0392, `inhibitoryScale` 1–3, four
`adapt` settings, three `thresholdJitter` settings, `tauSyn` {2,5}, `inputRateHigh` {0.08,0.15,0.3},
`stepsPerTick` {5,10} — no setting of this brain's shipped LIF mechanisms, even after explicitly deprioritising
`feed` to isolate movement, produced world-stage behaviour better than a random walk on calibration seeds. The
two best A1-robust, movement-only candidates are **worse** than chance at finding food. Combined with A2 needing
near-ceiling gain on nearly every output channel to hit its target, this looks less like an unfound LIF operating
point and more like a question about how much usable, directional odour→motor signal this particular 15K
selection carries at all — a question the LIF parameter space searched here cannot answer.

No shipped file changed as a result of this update: `world/world-forager-15k.json`, `extract/configs/
forager-brain-15k.json` and this document's "shipped" status are all unmodified. The `requireFeed` gate lives
only in `.claude/skills/microfly-calibrate/scripts/` (engine.mjs + profiles/v2.mjs), not in any shipped contract.

**Next step, not done here**: before spending more LIF-parameter budget, check whether this is a topology
problem rather than a parameter problem — e.g. compare signed shortest-path weight/length from AL odour-responsive
neurons to the `forward`/`turn-left`/`turn-right`/`escape` output pools against the same measurement on v1's
(successfully calibrated) brain, directly from the snapshot's edge list, no simulation needed. If that path is
long, sparse, or dominated by local recurrent loops relative to v1, the fix is in `extract/configs/
forager-brain-15k.json`/`selection_forager_v2.py`'s selection criteria (which neurons/edges the 15K budget keeps),
not in another LIF calibration pass — consistent with AGENTS.md's "brains come from the dataset... never
hand-wire a connection to fix behaviour" and "extraction is config, not code."

## Update 2026-10-11 — connectivity diagnostic (`scripts/compare-connectivity.mjs`): path length is not the
problem; the un-normalised `synapseCount` weight rule is the leading suspect

Built `scripts/compare-connectivity.mjs` (pure graph analysis over a `.brain`'s CSR edge list, no simulation) to
test the "topology problem" lead from the update above, comparing v2 (`forager-brain-15k.brain`) against v1
(`forager-brain.brain`, already calibrated).

**Path length: refuted as the explanation.** Excitatory-only shortest-path hop count from odour-sensing input
neurons to every motor drive is as short or shorter in v2 than in v1 (`turnLeft` 2 vs 3, `backward` 2 vs 3,
others tied), 100% of each pool reachable. Both brains are **100% excitatorily reachable from odour at the whole-
network scale**, and 100% of every motor pool's direct inflow comes from an odour-reachable source — but this is
true of v1 too, so it does not distinguish why v2 fails and v1 doesn't. A short, fully-reachable excitatory path
exists in both; the extraction did not cut it.

**What does differ: the weight rule, and it is a large, measured difference.** `forager-brain.brain` (v1) uses
`weightRule: postFractionAbsolute` — normalised by the writer so every neuron's total absolute inflow weight is
`<= 1` (`snapshot.js`'s own CSR invariant check). `forager-brain-15k.brain` (v2) uses `weightRule: synapseCount`
— explicitly **not** normalised (`container-v5.md`'s own documented exemption from that check). Measured
per-neuron total `|inflow|` weight:

| | v1 (`postFractionAbsolute`) | v2 (`synapseCount`) |
|---|---|---|
| mean | 0.478 | 853.5 |
| median | 0.461 | 378.0 |
| p99 | 1.000 | 6,646.0 |
| max | 1.000 (by construction) | 35,605.0 |
| coefficient of variation | 0.55 | 1.70 |
| max ÷ median | 2.2× | **94.2×** |

v1's normalisation bounds every neuron's total drive-at-saturation to within a 2.2× band; v2's raw synapse counts
span a 94× band between a typical neuron and its most-connected ones, with no per-neuron correction. A single
global `synapticScale` has to sit below the threshold-crossing point for the highest-inflow neurons while still
clearing it for the median one — exactly the shape of every symptom found this session: the U-shaped window
(Update above) is narrow because there is no scale that works for both ends of a 94× spread; `al`/`central`
over-ignite together rather than gradually (their member neurons likely sit toward the high-inflow tail); A2
needing **8192**, the ceiling of its 14-value ladder, on almost every channel (Update above) reads as "amplify a
signal drowned in per-neuron gain variance" rather than "scale a clean one."

**This closes a loop opened on day one.** This document's original "Next steps" (top of file, item 2) already
named exactly this comparison — `synapseCount` vs `postFractionAbsolute` — as undone work, before any of the
BUG-001 through BUG-004 extraction fixes existed. It was never run until now.

**Next step, not done here**: a trial re-extraction of the 15K selection with `weightRule: postFractionAbsolute`
(already a validated option for the forager-v2 config schema, `extract/malecns_brain/config.py` — a one-line
change to `extract/configs/forager-brain-15k.json`, no code change), to a **separate output file**, not
overwriting the shipped `forager-brain-15k.brain`. Re-run this same connectivity script against it to confirm the
dynamic-range narrows, then a cheap `--stage=classify`/`--stage=regime` pass (not the full world-stage search) to
see whether the quiet-but-responsive window widens before committing any more A2/world budget. This needs the
user's sign-off before running (it invokes the Python extractor against the real dataset) and, if it looks
promising, its own held-out verification later — same rule as every other candidate in this document.

## Update 2026-10-12 — Gate B's two-arm comparison (D13), run and closed: `postFractionAbsolute` tried, rolled back

By user instruction, ran the `postFractionAbsolute` trial ADR 006 D13 itself asked for ("Gate B calibrates
`synapseCount` first, with `postFractionAbsolute` as the comparison arm... the one with more robust A1 points
[wins]") — the comparison this document's very first "Next steps" named and nothing had run until now. This is
not a reversal of D13's reasoning (the old per-neuron-normalisation pain it cites, one scale for a 2-neuron output
against a recurrent bulk, predates this brain generation's A2 `outputScale` fit, which already scales each output
channel independently of `weightRule` — the extraction log below shows no sign of that old distortion recurring).

**Procedure.** `forager-brain-15k.brain` (the `synapseCount` arm) archived unchanged to
`forager-brain-15k-v2-20261009.brain`; `extract/configs/forager-brain-15k.json`'s `weightRule` switched to
`postFractionAbsolute` (selection config — `inhibitoryClosure`/`ieDriftTolerance`/D11 scoring all operate on raw
signed synapse counts regardless of `weightRule`, confirmed in `selection_forager_v2.py`, so this is a pure
weight-formula swap, not a different selection) and re-extracted in place: same 16,427 neurons, 2,078,088 edges,
self-check `identical`; every output pool still net-positive (`turn-left +0.37`, `turn-right +0.37`,
`forward +0.42`, `backward +0.39`, `feed +0.045`, `escape +0.38`).

1. **`scripts/compare-connectivity.mjs` confirmed the dynamic range collapsed** as predicted: per-neuron total
   `|inflow|` weight max÷median dropped from **94.2×** (`synapseCount`) to **1.9×** (`postFractionAbsolute`,
   tighter even than v1's 2.2×). Topology (hop counts, reachability) unchanged, as expected — only the weight
   formula changed, not the selection.
2. **`--stage=classify` found a real A1 pass for the first time all weekend.** The old `synapticScale` axis
   (0.0003–0.0392) is meaningless against normalised weights (everything reads silent — median per-neuron inflow
   dropped from 378 to 0.539, a ~700× shift); scanning 1–50 (v1's own calibrated range, now a good prior since
   both brains share the same weight rule) found a transition between 5 and 10, and at `synapticScale=6` (the
   reference point, `tauSyn=5`, `inputRateHigh=0.15`) **every A1 gate passed** — `al` 0.6%, `vnc` 1.7%, `dn` 1.1%,
   `central` 1.3%, all inside the quiet band, brake/lateral/feed/settle all clear. The transition itself is a
   ramp (`al` 0.6%→0.8%→18.5%→42%→50% from scale 6→8), not the hard wall every `synapseCount` run hit.
3. **`--stage=regime` on a 90-point grid** (`runs/v2-regime-postfrac-2026-10-11/regime.json`; `synapticScale`
   {5,5.5,6,6.5,7} × `tauSyn` {2,5} × `inputRateHigh` {0.08,0.15,0.3} × `inhibitoryScale` {1,1.5,2}, `stepsPerTick`
   10, `requireFeed: false` per the prior update): **39/90 pass**, **10 robust** (≥50% of axis-neighbours also
   passing) — against `synapseCount`'s best-ever result of 26/192 pass, 2 robust, on a grid more than twice the
   size. Top candidate: `synapticScale 6, tauSyn 2, inputRateHigh 0.08, inhibitoryScale 2` (robustness 0.80,
   `brake -0.49`, `lateral 0.33`).
4. **`--stage=world`, one candidate, one `forwardTarget`/`motorSmoothing` combo (0.3/0.05), 5 calibration seeds,
   3,000 ticks** (`runs/v2-world-postfrac-2026-10-11/world.json`): **find rate 0.0%** against the random-walk
   baseline's 23.3% — worse than the best `synapseCount`-arm candidate (10%) from the prior update. A2 fit
   `forward`'s `outputScale` to **1** (the bottom of the ladder, not the ceiling this time — consistent with
   normalised weights giving output neurons a reasonable, not vanishingly weak, raw drive) and `backward` to
   **256**; one plausible reading is that this specific forward/backward balance barely moves the fly forward at
   all, but only one combination was tested before the time budget ran out.

**Decision (user instruction, 60–90 minute budget): rolled back.** Only one world-stage combination was
validated — a stronger A1/regime result than any `synapseCount` run, but the one world-stage test available
within budget did not beat the random walk, and the time budget for this exploratory pass closed before a second
combination (a different `forwardTarget`, or the next robust candidate down the list) could be tried.
`extract/configs/forager-brain-15k.json`'s `weightRule` is reverted to `synapseCount`; `forager-brain-15k.brain`
is restored byte-identical to the archived `synapseCount` extraction (checksums match). The `postFractionAbsolute`
trial brain is kept, not discarded, at `public/brains/forager-brain-15k-postfrac-trial-20261011.brain` for future
debugging — it is the one artifact in this whole investigation that produced an actual A1 pass and double-digit
robust points, and the open question is narrow and specific: **does a different A2 operating point (another
`forwardTarget`, or one of the other 9 robust candidates) do better**, not whether the regime itself is viable.

**This is not a closed verdict on D13 either way** — it is a time-boxed, single-path validation that ran out of
budget one step before a real answer. The next session with more time should pick up exactly here: re-run
`--stage=world` against `runs/v2-regime-postfrac-2026-10-11/regime.json` with `--top=3` and the default
`forwardTargets`/`motorSmoothing` sweep (not just one combination), using the preserved trial brain
(`forager-brain-15k-postfrac-trial-20261011.brain`) rather than re-extracting — swap it in as
`forager-brain-15k.brain` (and the config's `weightRule`) temporarily, or point `--world` at a config that
references it directly.
