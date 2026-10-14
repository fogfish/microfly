# Calibration: the wide-I/O forager brain's LIF settings

**Status: adopted with caution (2026-10-14).** See "2026-10-14 session" below for the full record. The
placeholder history below is kept for context.

## 2026-10-14 session: engine bug fix, regime + world search, held-out result, cautious adoption

**Bug found and fixed first.** `scripts/engine.mjs`'s `runWorldStage` dispatched `--stage=world`'s per-tick run
on `profile.brainVersion` ("v2") as the arm name for `scripts/forager-arms.mjs`'s `runForagerArms`. That function
only recognises the literal arm name `"wide"` for this brain (a different namespace from `flies.brain.version`);
`"v2"` silently fell through to the unrelated `runV0Fly` fallback with `v0Snapshot: undefined`, so every prior
`--stage=world` run for this profile reported a flat 0% find rate regardless of the candidate's real behaviour
(`v1.mjs`/`class-seed-11k.mjs` never hit this because their `brainVersion` ("v1") happens to also be a valid arm
name). Fixed by adding an explicit `armName` field to the profile contract
([contracts/calibration-profile.md](../012-class-seeded-forager-brain/contracts/calibration-profile.md)):
`wide-io.mjs` now sets `armName: 'wide'`; `engine.mjs` uses `profile.armName ?? profile.brainVersion`. Every
pre-fix `--stage=world` result for this profile (including an initial 12-candidate run that showed 0% across the
board) is void and was discarded.

**A1 regime grid** (ADR 007 "Calibration protocol" points 1-2): 8-way sharded `--stage=regime` over the full
grid (`synapticScale` 10-50, `inhibitoryScale` 1-3, `noise`, `adapt`, `thresholdJitter`; 2880 points) —
`brake` not gated (ADR 006 Q4 precedent), `feed` not gated (same precedent as `class-seed-11k`'s own sweep).
`classify` found no stuck regions.

**B, world stage** (post-fix, calibration seeds only, 5 seeds × 6 flies × 3000 ticks, random-walk baseline
23.3% find rate / 7 of 30): 12 robust A1-passing candidates tried. All 8 at `synapticScale=10` underperformed
baseline (6.7%-23.3%). All 4 at `synapticScale=15` beat it (23.3%-46.7%). Best:

```
synapticScale=15, inhibitoryScale=1.5, noiseAmplitude=0.2, noiseBulkScale=0, tauSyn=0,
tauAdapt=100, adaptStep=0.1, thresholdJitter=0.1, motorSmoothing=0.05,
outputScale={ forward: 8192, backward: 64, turn-left: 2048, turn-right: 8192, escape: 2048, feed: 128 }
```
→ **find 46.7% vs. random-walk 23.3%** (calibration seeds).

**Radius experiment**: widening `stimuli['odour:food'].radius` from 6 to 10 tiles improved the shipped
placeholder config (43.3%→46.7%) and a weak `synapticScale=10` candidate (10.0%→23.3%, reaching baseline), but
**hurt the best `synapticScale=15` candidate** (46.7%→30.0%). Not uniformly beneficial — kept radius at 6 for
the adopted candidate; the radius question is an open map-design item, not resolved here.

**Held-out verification** (30 held-out seeds, 180 trials, never touched by the search above): **find 29.4% vs.
random-walk 23.3%, 95% CI [23.3%, 35.6%]**. The confidence interval's lower bound sits exactly at the baseline
rate — the calibration-seed result (46.7%) does not fully hold up; this is a real but much smaller and
statistically uncertain edge over random walk, not a clean, confident pass.

**Adoption decision (human call, 2026-10-14)**: adopted into `world-forager-wide.json` despite the uncertain
held-out margin, because the current world cannot yet support a confident verdict either way — stimuli radius
beyond the shipped 6 tiles is untested map territory (see the radius experiment above), and danger/escape
physics are not yet implemented in the simulator (`flies.body.escape.enabled: false`, ADR 007 D17), so neither
the `avoidSpider`/`avoidLantern`/`escape` metrics nor a wider-radius world can currently discriminate a better
brain from a worse one. Given that, "better than every other tried candidate, modestly above baseline, direction
unclear only because the harness can't yet see all of this brain's behaviour" was judged worth shipping now
rather than blocking on a world rework. **Next step, before any further calibration search**: rebuild
`world-forager-wide.json`'s map/stimuli so odour/danger are reachable at realistic distances and implement the
escape/danger physics the body/world config already declare, then restart calibration (this session's regime
checkpoints are stale once the world's stimulus geometry changes, since A1 is brain-only and radius-independent,
but the world-stage/held-out numbers above are specific to the old map and must be re-run).

**Follow-up not done in this session**: `results.md`'s Gate C comparison was run against the placeholder LIF
block (as it says) and has not been re-run against the adopted config above — it still describes pre-calibration
behaviour and should be refreshed before being cited as this brain's current standing.

## Placeholder history (superseded 2026-10-14, kept for context)

**Former status: not yet calibrated.** `world-forager-wide.json`'s `flies.brain.lif` is a placeholder — a copy of the
11K world's own calibrated block (ADR 007 "Calibration protocol" point 2: "start from the 11K world's
calibrated LIF block, because the weight rule is the same"). This is deliberate, per research.md R11 of this
spec: calibration is a separate, human-reviewed `/microfly-calibrate` session, not part of `/speckit-implement`.

- **Tool**: the `microfly-calibrate` skill's `wide-io` profile
  (`.claude/skills/microfly-calibrate/scripts/profiles/wide-io.mjs`), per ADR 007 "Calibration protocol" and
  [contracts/calibration-profile.md](../012-class-seeded-forager-brain/contracts/calibration-profile.md).
- **One sanity probe run during implementation** (not a calibration search — a single point, to confirm the
  profile loads and runs through the real engine): `--stage=regime` at the 11K world's own calibrated point
  (`synapticScale=9, inhibitoryScale=1.5, noiseAmplitude=0.1, tauAdapt=50, adaptStep=0.05, thresholdJitter=0.1`,
  `stimulus=[0, 0.5]`) gives `rest={"all":0}`, failing `silent:all` — this brain is too quiet at the 11K brain's
  own calibrated `synapticScale`. That is an expected finding, not a bug: the two brains share a weight rule but
  not a neuron count large enough to assume the same gain works (the same finding `specs/012-class-seeded-
  forager-brain/calibration.md`'s classify phase already recorded for `v1`'s range against the 11K brain). It is
  recorded here so the next session does not have to re-derive it; the real regime grid search has not run.
- **What the next `/microfly-calibrate` session needs to do** (ADR 007 "Calibration protocol"):
  1. A1, brain-only: scan `synapticScale` (classify) to find this brain's own quiet-regime window, the same
     first step `class-seed-11k`'s own calibration took.
  2. A1 extension (this profile's own `conditions()` entries, beyond the generic `rest`/`odour`/`taste`/`left`/
     `right` engine.mjs reads): `odourFoodPlusMouth`/`odour` for **brake** and **feed**, `legTaste` for **back**,
     `heatLeft` for **avoid**, `touchLeft` for **touch**, `dangerLeft` recorded only. Only the D19-gated
     directions (brake is explicitly *not* gated, matching `class-seed-11k`'s own precedent) decide pass/fail.
  3. A2: fit `outputScale` for all six outputs, including `escape` (no behaviour claim attached to that fit).
  4. B: the fitted candidates, run on calibration seeds only; a human reviews before anything is adopted into
     `world-forager-wide.json` or this file.
- **Held-out verification and the Gate C comparison** (`results.md`) were run with the **placeholder** LIF block
  above, since they do not depend on calibration having happened — they are the pre-calibration baseline, and
  the metrics they report may change substantially once this brain is actually calibrated. A failing or
  near-zero metric in that run is a finding about the placeholder, not a verdict on the brain.
