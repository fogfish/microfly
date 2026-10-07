# Quickstart: Food Odour Recalibration

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

How to check the change, step by step. Each step names the success criterion it covers.

## 1. Geometry (SC-001, SC-002, SC-003)

```bash
node scripts/food-placement.mjs 6
```

Expected: `freeShare` about 0.50, one walkable component, and the large, medium and small positions as in [research.md](research.md) R2. The script checks geometry only. It does not run the app.

Then the automated checks:

```bash
node --test tests/odour-food.test.mjs
```

## 2. Map rules (SC-004, SC-007)

```bash
npm test
```

Expected: every world file validates. `world-forager-bad.json` still refuses, and now names the snapshot version, not the format version.

Check that the removed and food sprites are gone from decor:

```bash
grep -l "jungle-plant-016\|jungle-plant-017\|jungle-bush-018" public/world/*.json   # expect no output
```

## 3. Odour in the app (SC-001, SC-005)

```bash
cd public && python3 -m http.server 8000
```

Open `http://localhost:8000/?world=world/world-forager.json`, then:

1. Turn on the odour layer (panel, World pane, Layers).
2. Expect three soft patches, one on each food unit. The large patch is the widest, the small the narrowest.
3. Expect a visible band of no odour across the meadow, and a route from the flies to each patch.
4. Open the browser console. Expect no errors.

## 4. Fly sprite (SC-005)

Open `http://localhost:8000/?world=world/world-forager.json` and zoom to 2 and to 4. Check:

- The fly is one cell in size (32 px at zoom 1).
- It reads as a fruit fly: round tan abdomen with dark bands, dark thorax, two red eyes, clear wings.
- A reviewer who has not read the spec names it as a fly or an insect.

## 5. Behaviour (SC-006), recorded not tuned

```bash
node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out
node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=calibration
```

Record both outputs and the brain, random walk and size-matched random graph in `specs/009-food-odour-recalibration/results.md`. Do not change values to pass a metric. A failed metric is a finding (AGENTS.md).

## 6. Python and the rest

The extractor is not touched. Run the extractor tests only if a Python file changes:

```bash
cd extract && .venv/bin/python -m unittest discover -s tests -t .
```

Before calling the feature done: `npm test` passes, the app runs one fly with no console errors, and step 5 is recorded.
