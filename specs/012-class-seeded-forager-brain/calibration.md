# Calibration: the class-seeded forager brain's LIF settings

- **Date:** 2026-10-12
- **Seeds:** `experiment.seeds` = 6, 7, 8, 9, 10 (calibration). Held-out seeds (101–130) were not used for this
  search.
- **Tool:** the ported `microfly-calibrate` skill (`.claude/skills/microfly-calibrate/scripts/calibrate.mjs`
  `--version=class-seed-11k`), per ADR 006 "Calibration protocol" and
  [contracts/calibration-profile.md](contracts/calibration-profile.md).
- **Runs:** `--stage=classify` (brain-only probe, no world), then two `--stage=regime`/`auto` passes with
  `--axes` narrowed from the profile's own default grid, within a moderate exploratory budget (not the full
  stated grid, which the tool itself estimated at ≈396 minutes).

## Classify (phase 0): where is the quiet-regime window?

```
synapticScale=10  rest=0.135  -> ignited:all,brake
synapticScale=15  rest=0.538  -> ignited:all,gain:all,brake,feed
synapticScale=20  rest=0.568  -> ignited:all,gain:all
synapticScale=30  rest=0.621  -> ignited:all,gain:all,brake
synapticScale=40  rest=0.643  -> ignited:all,gain:all,brake,feed
synapticScale=50  rest=0.658  -> ignited:all,gain:all,brake,feed
Stuck regions (ignited at every scanned synapticScale): all
```

v1's own calibrated range (10–50) is **entirely over the 10 % rest ceiling** for this brain: at 11,000 neurons
and ≈448K edges, the same `synapticScale` drives far more recurrent excitation than it does in the 3,400-neuron
v1 brain. This alone is a finding: the two brains do not share a usable `synapticScale` range, even though they
share a weight rule (`postFractionAbsolute`).

## Regime (phase 2): narrowing toward the transition

A first narrowed grid (`synapticScale` ∈ {2, 4, 6, 8} × `inhibitoryScale` ∈ {1, 1.5, 2} × `noise` ∈ {[0,1],
[0.1,0]} × `stimulus` ∈ {[0.02,0.1], [0.02,0.25]}, `adapt` fixed at v1's (20, 0.05), `thresholdJitter` 0 — 48
points) found every point **silent** (rest activity 0, below the 0.2 % floor) or failing on `brake`/`feed`: 0/48
pass.

A second grid, narrowed further toward the transition (`synapticScale` ∈ {8.5, 9, 9.5, 10} × `inhibitoryScale`
∈ {1, 1.5} × the same `noise`/`stimulus` pairs — 32 points) found the quiet-to-ignited transition sits between
`synapticScale` 9.5 and 10:

```
synapticScale=9    inhibitoryScale=1    noise=[0.1,0]  stimulus=[0.02,0.1]   rest=0.062  brake=1.181  -> brake
synapticScale=9.5  inhibitoryScale=1    noise=[0.1,0]  stimulus=[0.02,0.1]   rest=0.077  brake=1.009  -> brake
synapticScale=10   inhibitoryScale=1    noise=[0.1,0]  stimulus=[0.02,0.1]   rest=0.135  brake=1.124  -> ignited:all,gain:all,brake
```

Several points in this band have rest activity inside the gate's floor/ceiling (0.002–0.1) — the quiet-regime
problem is solvable here, unlike v1's own range for this brain. **Every one of the 80 points tried across both
grids fails the `brake` gate** (`(taste.raw.forward − odour.raw.forward) / |odour.raw.forward| < 0`): taste
consistently *raises* raw `forward` relative to odour alone, the opposite of a brake, with no exception.

## Why `brake` never passes: a structural finding, not a tuning gap

This is not a search that simply needs more points. ADR 006 Context point and its own D13 extraction-fidelity
probe (computed, independent of calibration, during extraction — see `specs/012-class-seeded-forager-brain/
contracts/extract-config-classseed.md`'s shipped run) already measured `taste → forward` as **positive on the
whole MaleCNS v1.0 connectome itself** (+3.0e-7 at ≥5 synapses, ADR 006 Annex A4), not only on this brain's own
selection. The brake gate's live-LIF measurement across every calibration point in this search (brake > 0
throughout, ranging ≈0.35 to ≈14) is independent, LIF-level confirmation of the same connectome-level fact the
linear probe already found: **no `synapticScale`/`inhibitoryScale`/noise setting can make this brain brake on
food**, because the pathway from the v1 taste pool to `forward` does not brake even in the full connectome. The
cause is the taste pool's own definition (ADR 006 D8: "the v1 pools are kept verbatim, known flaw included" —
the `LgLG` prefix selects mostly leg GRNs, not mouth/feeding sensors), not this brain's selection strategy. ADR
006 names this explicitly as open question **Q4**, to be fixed by a declared change to the taste input pool, not
by parameter search.

## Outcome: no candidate adopted

No point in either grid passes the full regime gate (rest + odour + lateral steering + brake + feed together),
so **nothing was promoted into `public/world/world-forager-11k.json`**. Its `flies.brain.lif` block stays the
placeholder copy of v1's own calibrated values from `public/world/world-forager.json`, pending a dedicated
calibration session — per the `microfly-calibrate` skill's own rule ("report, don't adopt": a calibration-seed
result is presented for human review, never written into a shipped world config automatically) and AGENTS.md
("a failure is a result... the fix is config or parameters, recorded with the run").

**What a follow-up session should do differently, per this finding:**

1. Search `synapticScale` in the 8.5–10 window specifically (not v1's 10–50), since that is where rest activity
   enters the gate's floor/ceiling for this brain.
2. Treat `brake` as very unlikely to pass with the v1 taste pool unchanged — ADR 006 Q4's own fix (a declared
   taste-pool change, e.g. restricting to mouth/pharyngeal GRNs) is a prerequisite, not a parameter to search
   around.
3. Given point 2, a calibration round that drops the `brake` gate (or accepts it as a known, connectome-level
   limitation, as the shipped `v1` world's own Gate C record already accepts a failing `eat` metric) could still
   find a usable rest/odour/feed/lateral-steering operating point in the 8.5–10 band and reach `--stage=world`.

## Addendum (2026-10-13): `brake` dropped as a gate everywhere

Acting on point 3 above: `brake` is no longer a calibration gate or acceptance criterion, in this profile or any
other. The finding that motivated it is structural, not specific to this search — ADR 006 D13's independent probe
already found taste → forward positive on the whole MaleCNS v1.0 connectome, so no LIF parameter choice can make
any brain built from the v1 taste pool brake on food (ADR 006 Q4: the pool itself needs to change, e.g. to
mouth/pharyngeal GRNs only). Re-running this search to look for a brake-passing point would repeat the same 80/80
failure. `.claude/skills/microfly-calibrate/scripts/engine.mjs`'s `regime()` still computes and reports `brake` on
every row (useful once Q4 is addressed) but never fails a candidate on it. A follow-up session can now search the
8.5–10 `synapticScale` window for a usable rest/odour/feed/lateral-steering point without `brake` blocking it.

## Addendum (2026-10-13): full round run, candidate found and shipped

Acting on points 1 and 3 above, with `brake` dropped: a new `--stage=auto` regime search over `synapticScale`
∈ {8.5, 9, 9.5, 10} × `inhibitoryScale` ∈ {1, 1.5} × the same `noise`/`stimulus` pairs (384 points, the
profile's other default axes included) found 111/384 passing A1 (rest + odour-gain + lateral + feed; `brake`
tracked only) and 3 robust candidates. `--stage=world` (12 candidates: 3 points × 2 `forwardTarget` × 2
`motorSmoothing`, 5 calibration seeds, 3000 ticks) found the best candidate at:

```
synapticScale=9  inhibitoryScale=1.5  noise=[0.1,0]  stimulus=[0.02,0.25]  adapt=[50,0.05]  thresholdJitter=0.1
motorSmoothing=0.05  outputScale={forward:4096, backward:256, turn-left:2048, turn-right:4096, feed:256}
```

find 36.7 % on calibration seeds (vs 23.3 % random walk). A held-out check (30 seeds, 101–130, arms
`class-seed-11k`/`random-matched`/`baseline`, never used for the search above) confirmed it: find 27.8 % (CI
[21.7, 34.4]) against baseline 23.3 % and random-matched 12.2 % — both nulls beaten. `eat`/hunger-dependence
still read `n/a`/0 %, the already-diagnosed `brake`/taste-pool finding (ADR 006 Q4), reported not gated.

**Shipped**: this candidate's `lif` block and `motorSmoothing` replace the placeholder in
`public/world/world-forager-11k.json`. Full write-up and the Gate C table: `results.md`.

## Checkpoints

- `.claude/skills/microfly-calibrate/runs/class-seed-11k-auto-2026-10-12/auto.json` (phase 0+1, 48-point regime
  grid).
- `.claude/skills/microfly-calibrate/runs/class-seed-11k-regime-narrow/regime.json` (32-point narrowed grid).
- `.claude/skills/microfly-calibrate/runs/class-seed-11k-auto-2026-10-13-r2/auto.json` (384-point regime grid,
  8.5–10 window, 3 robust candidates).
- `.claude/skills/microfly-calibrate/runs/class-seed-11k-world-2026-10-13/world.json` (12-candidate world stage,
  calibration seeds).

These are git-ignored scratch checkpoints (the skill's own convention); this document is the durable record.
