# Quickstart: Validating the Sketch-Based World Map

Run this after implementation to confirm the feature against spec.md's Success Criteria. No build step —
everything runs through the static server and the Node test runner, per the constitution.

## Prerequisites

- Node.js 20+ on `PATH` (for `npm test`).
- Python 3 (for `python3 -m http.server`).
- A browser with the DevTools console open, to confirm no console errors (constitution's run check).

## 1. Unit and world-generation tests

```bash
npm test                              # tests/*.test.mjs — includes the new danger/heat/food field tests,
                                       # the new flies.stimuli "water"/"forestEdge" tests, and the layers tests
node --test public/tests/*.test.js    # ground/layout/validate/spread DOM-free world-generation tests
```

Expected: all pass, including (new or extended):
- `tests/danger-field.test.mjs`, `tests/heat-field.test.mjs` — step shape (1/0.5/0.25/0), no overshoot on a
  contiguous source (research.md R2).
- `tests/food-field.test.mjs` — 3×3 core, irregular falloff, max-not-sum overlap (research.md R4).
- `tests/stimulus-declared.test.mjs`, `tests/world-compat-wide.test.mjs` — new `field` sense mode and
  `from: "water"`/`"forestEdge"`.
- `tests/layers.test.mjs`, `tests/heatmap.test.mjs` — four independent overlay toggles.
- `public/tests/ground.test.js`, `public/tests/layout.test.js`, `public/tests/spread.test.js` — `edgeForest`
  ground kind, `forestEdge` logic mask, universal touch coverage.

## 2. Run the app and open every shipped world

```bash
cd public && python3 -m http.server 8000
```

Open each, confirming it loads with **no console errors** and a fly runs (constitution run check, SC-007):

| World | URL |
|---|---|
| Base map (mock brain) | `http://localhost:8000/?world=world/world.json` |
| Connectome brain | `http://localhost:8000/?world=world/world-connectome.json` |
| Antennal-lobe brain | `http://localhost:8000/?world=world/world-antennal-lobe.json` |
| Forager (v1) | `http://localhost:8000/?world=world/world-forager.json` |
| Class-seeded forager (11k) | `http://localhost:8000/?world=world/world-forager-11k.json` |
| Wide-I/O forager (v2) | `http://localhost:8000/?world=world/world-forager-wide.json` |

For each: the terrain/water layout on screen is the same sketched map (SC-001), not six different maps.

## 3. Visual check against the sketch (SC-001, SC-002)

With any world open, compare the rendered map to `world_map.jpg` side by side:
- Every landmass and body of water matches the sketch in shape and relative position.
- No title banner, legend/symbol box, or animal figure appears anywhere on the map.
- Every sketched building location shows only tent/bone decoration (no building sprite — there is none in
  the atlas).
- The sketched bridge location is plain terrain, no bridge asset.

## 4. Overlay toggles (SC-006)

Open the World tab in the side panel. Four switches are present: **Food odour**, **Danger odour**, **Heat
odour**, **Grid**.

- Toggle each on alone, off alone, and in every combination (including all four at once) — the map's
  overlay content changes to match exactly which switches are on, with no interaction between them.
- With **Danger odour** on: the overlay is brightest in a ring along the map's forest edge, half as bright
  one tile in, a quarter as bright two tiles in, and absent over the interior and over non-edge forest
  patches (SC-002 of spec.md).
- With **Heat odour** on: the overlay is brightest over every water tile, with the same 100/50/25% ring
  shape, and there is at least one visibly dark (zero-heat) land route between the two areas the sketch's
  water divides (SC-003).
- With **Food odour** on: each food cluster shows a solid bright 3×3 core, an irregular (not circular or
  square) stepped-down halo around it, and neighbouring clusters' halos visibly touch or overlap, forming
  one connected trail across the map (SC-004).
- With **Grid** on: tile boundaries are visible as thin lines over the whole map, independent of whichever
  odour overlays are also on.

## 5. Behavioural spot-checks (SC-005, SC-007)

- Start a fly (any world) and let it run. Steer it (or watch it) into several different decorative objects
  — a tree, a rock, a tent, a bone/skull pile — and confirm each registers a left/right touch in the side
  panel's input row for `touch` (SC-005).
- Let a wide-I/O (`v2`) fly run long enough to approach the edge forest and the water: its `odour:danger`
  and `heat` input rows in the panel rise as it nears the forest edge / water and fall back as it withdraws,
  tracking the overlay shown in step 4.

## 6. Full test suite, one more time

```bash
npm test && node --test public/tests/*.test.js
```

Expected: all green. This is the same command the "Before calling a feature done" checklist in `AGENTS.md`
requires before this feature is considered complete.
