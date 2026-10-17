# Quickstart: Demo Forager

Validates the feature end to end, after implementation, against [spec.md](spec.md)'s Success Criteria and
[ADR 010](../../adrs/010-demo-forager.md) Part K. Assumes `npm test` and the Python extractor's tests already pass
(AGENTS.md "Before calling a feature done").

## 1. Calibrate (R4 / K7)

```bash
cd .claude/skills/microfly-calibrate/scripts
time node calibrate.mjs --version=demo-v3 --stage=all --budget-minutes=30
```

Expected: C1, C2 and C3 each print a pass or a named failure (`E-DECODE-<pool>` etc.), a `decoder.json` checkpoint
and `public/brains/forager-brain-wide.decoder.json` are written, and the command exits in ≤ 30 minutes
(`time`'s `real` line is the K7 number to record).

If C1 or C2 fails: this is a finding (AGENTS.md "Behaviour failures are findings"), not something to patch around.
Record the failing gate and its numbers before changing anything.

## 2. Run the demo world (constitution's run check)

```bash
cd public && python3 -m http.server 8000
```

Open `http://localhost:8000/?world=world/world-forager-demo.json`. Expected: 6 flies run, no console errors.

## 3. Watch R1–R3 and the decoder panel (Stories 1, 2, 3, 5)

- Start a hungry fly (hunger ≥ 0.4) away from food: it should turn toward and reach food, then feed. A sated fly
  near the same food should not head for it.
- Walk a fly into a danger ring: it should escape or turn away within ~1 second (20 ticks at 20 Hz).
- Open the side panel for a running fly: each declared sense shows side/drive/trend/valence/pool size, labelled as
  a decoded readout (D31).

## 4. Run the held-out acceptance pass (Part K, Stories 1–6)

```bash
node scripts/forager-arms.mjs --world=world/world-forager-demo.json --seeds=held-out --arms=v3,baseline,random-matched-wide
```

Expected output: a table with K1–K6 and K9 per arm (brain / random-walk / random-graph), each stated as pass or
fail against the gates in [spec.md](spec.md)'s Success Criteria — never adjusted after the fact.

## 5. Repeat on the second map (R5 / K8, Story 4)

```bash
node scripts/forager-arms.mjs --world=world/world-forager-demo-tilemap.json --seeds=held-out --arms=v3,baseline,random-matched-wide
```

Same calibration (`forager-brain-wide.decoder.json`), no `calibrate.mjs` re-run. Expected: K1–K6 pass on this map
too, confirming W15 (field builders normalise per-sense regardless of map size/source count).

## Pass/fail record

Write the run's numbers into `specs/017-demo-forager/results.md` (one row per K-metric, both maps, both calibration
and held-out seed sets named) — following the `calibration.md`/`results.md` convention from prior brain
generations (AGENTS.md "Working on brains").
