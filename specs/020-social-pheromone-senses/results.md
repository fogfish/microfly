# Results: Social and Pheromone Senses

Raw `social-arms.mjs` output for each run referenced below is kept alongside this file: `results.json` /
`results-raw.md` (main map, held-out), `results-tilemap.json` / `results-tilemap-raw.md` (tilemap, held-out),
`results-no-social.json` / `results-no-social-raw.md` (main map, held-out, `--no-social-stimuli`), and
`calibration-baseline-results.json` / `.md` (main map, calibration seeds, referenced from `calibration.md`).

## Regression (T046, SC-006)

Full suite run on calibration-seed-only tests (no held-out seed is touched by any of these):

| Suite | Command | Tests | Pass | Fail | Notes |
|---|---|---|---|---|---|
| JS unit | `npm test` | 899 | 877 | 22 | All 22 pre-existing: fixtures (`world-forager-bad.json`, `world-forager-11k-bad.json`) removed by `53b651b (fix) worlds remove the road`, before this branch (`eeb5858`) started. Confirmed absent at the branch point with `git show eeb5858:public/world/world-forager-bad.json`. |
| World generation | `node --test public/tests/*.test.js` | 94 | 90 | 4 | All 4 pre-existing: missing `public/world/world-forager-demo-tilemap.json` fixture, also absent at the branch point. |
| Slow | `npm run test:slow` | 5 | 3 | 0 (2 todo) | `tests/slow/social-two-fly.test.mjs` (SC-003) passes in full (3/3). `tests/slow/forager-brake.test.mjs` has 2 known-failing cases marked `# BUG-002: fails until T112 fixes the brake` (documented, unrelated pre-existing finding), 1 passes. |
| Extractor | `.venv/bin/python -m unittest discover -s tests -t .` | 295 | 295 | 0 (1 skip) | All pass. |

No failure traces to a file this feature touched. This feature adds no regression.

## T047: Forager measures with social stimuli removed vs the MB baseline (early look, calibration seeds)

Calibration-seed early look (5 seeds × 6 flies × 3000 ticks) via `scripts/forager-arms.mjs`'s `runForagerArms`/
`v3Verdicts` (ADR 010 Part K's existing v3-arm machinery), comparing the social world with its `from: "flies"`
stimuli neutralised against the MB world with learning off:

| Metric | Social (no social stimuli) | MB baseline |
|---|---|---|
| find (hungry, 95% CI) | 96.7% [90.0%, 100.0%] | 90.0% [76.7%, 100.0%] |
| feed within 50 ticks | 54% | 42% |
| escape/turn within 20 ticks | 15% | 10% |
| avoid danger | 7.7% | 10.3% |
| avoid heat | 7.3% | 9.7% |

The social brain's spread sits in the same band as the MB baseline's on every metric, including the two that
already fail for the MB brain itself (feed-within-window, escape-within-window — pre-existing findings of the
shared v3 forager/body-layer stack, not something this feature changed). The held-out verdict (T066, below)
checks this for real.

## T048: Every shipped world loads clean (browser)

CDP-driven headless Chrome, one representative world per brain generation, each left running ~4s after
navigation:

| Generation | World | Console errors (filtered: the known headless-WebGL-only noise, `calibration.md`) |
|---|---|---|
| mock | `world/world.json` | 0 |
| v0 | `world/world-connectome.json` | 0 |
| v1 | `world/world-forager.json` | 0 |
| wide (v2) | `world/world-forager-wide.json` | 0 |
| demo (v3) | `world/world-forager-demo.json` | 0 |
| learning | `world/world-forager-learning.json` | 0 |
| learning-tilemap | `world/world-forager-learning-tilemap.json` | 0 |

(`world/world-forager-social.json` and `world/world-forager-social-tilemap.json` are covered separately:
`calibration.md`'s T045 entry, and both load cleanly through every held-out run below — 60 seed-runs with no
crash.) Every old world still starts a fly with no console error.

## SC-004: Held-out verdict (T061)

30 held-out seeds, 6 flies, 3000 ticks, both maps. Full per-arm detail in `results-raw.md` /
`results-tilemap-raw.md`. **Verdict: not met, on either map** — recorded as a finding, with the null arms, per
FR-023.

### Main map (`world-forager-social.json`)

| Arm | Time near (≤2 tiles) | Contact rate (per fly/min) |
|---|---|---|
| social | 3.6% [2.7%, 4.3%] | 0.200 [0.138, 0.264] |
| ablated | 4.0% [3.1%, 5.0%] | 0.218 [0.167, 0.276] |
| random-graph | 2.7% [1.9%, 3.7%] | 0.100 [0.073, 0.129] |
| random-walk | 4.3% [2.9%, 5.8%] | 0.142 [0.096, 0.191] |

- **Contact rate beats random-graph** (0.138 > 0.129, non-overlapping) but **not random-walk** (overlaps
  [0.096, 0.191]).
- **Time near beats neither** null arm (every interval overlaps every other).
- SC-004 requires *both* metrics to beat *both* arms with non-overlapping intervals. One of four comparisons
  clears that bar; the other three do not.

### Tilemap (`world-forager-social-tilemap.json`)

| Arm | Time near (≤2 tiles) | Contact rate (per fly/min) |
|---|---|---|
| social | 5.7% [4.7%, 6.8%] | 0.349 [0.269, 0.429] |
| ablated | 5.2% [4.2%, 6.4%] | 0.307 [0.247, 0.376] |
| random-graph | 2.9% [2.4%, 3.5%] | 0.313 [0.240, 0.391] |
| random-walk | 10.4% [9.0%, 11.8%] | 0.889 [0.776, 1.029] |

- **Time near beats random-graph** here (4.7 > 3.5, non-overlapping) but **random-walk is far ahead of social
  on both metrics** (10.4% / 0.889 vs social's 5.7% / 0.349, non-overlapping the other way): on the smaller
  map, flies taking a pure random walk cross paths with each other *more* than flies running the real brain.
  SC-004's directional claim ("the social brain... exceed[s]... random-walk") is directly contradicted here.

### Ablated comparison

On the main map, **lesioning the social input neurons does not reduce time-near or contact-rate** — `ablated`
reads slightly *higher* than `social` on both (4.0% vs 3.6%, 0.218 vs 0.200; the tilemap shows the same pattern,
5.2% vs 5.7% and 0.307 vs 0.349, within noise of each other either way). Whatever small edge `social` shows
over `random-graph` on the main map's contact rate does not disappear, or even move, when the pheromone
pathway is cut — so that edge is **not shown to be pheromonal** (it most likely comes from the shared
topology/fill the lesion does not touch, same as the random-graph arm's own null baseline differs from
random-walk's for non-pheromonal reasons — different body/physics interaction under a wired vs. unwired
network, not a sensed signal).

### Why: this is exactly ADR 012's measured consequence, not a new failure

Both social senses measured `valence: "none"` at Gate C (ADR 012 "Claims and valence"). `body-layer.js`'s
`sumByValence` multiplies every steering term by `VALENCE_SIGN[sense.valence]`, which is `0` for `"none"` — so
neither social sense contributes any turn or speed term, structurally, in any arm or on any map
(`calibration.md` "T053"). The small, inconsistent differences between arms above (a contact-rate edge on one
map, a time-near edge on the other, both erased or reversed elsewhere) are the shape expected from shared
body/topology effects with **no steering mechanism behind them** — not evidence of a pheromonal approach that
calibration or seed choice failed to surface.

### Sex split

Every metric above splits near-evenly by the other fly's sex on both maps (e.g. main map `social`: time-near
3.7% for a female neighbour vs 3.2% for a male, contact rate 0.102 vs 0.098) — no sex-specific effect is
visible, consistent with the emission profile (female emits both senses, male emits `odour:conspecific` only)
not translating into steering for the same structural reason. Full breakdown in `results-raw.md` /
`results-tilemap-raw.md`.

### Song

`songPerContact` and `songPerTickAlone` are both `0` in every arm, on both maps, across all 30 held-out seeds —
pIP10 never fires during a contact event or otherwise, consistent with its direct spiking measurement (0 Hz
under bilateral stimulation, ADR 012 "Claims and valence"). No fly in this feature's held-out runs is ever
drawn singing.

### Following index

`followingIndex` sits near 0 for every arm on both maps (main map: social −0.048, ablated −0.067, random-graph
−0.036, random-walk 0.067; tilemap similar), with no consistent sign — no arm shows a follower-like heading
correlation. This matches the expected null: following requires a steering response to a sensed neighbour,
which `valence: "none"` removes.

## SC-005: Regression with social stimuli off (T066)

`node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out --no-social-stimuli
--arms=social --out=results-no-social.json`, 30 held-out seeds:

All three runs use `scripts/social-arms.mjs`'s own metric definitions (find/feeding/approach/escape), so the
MB column is directly comparable, not read off a different metric suite:

| Metric | Social, stimuli OFF | Social, stimuli ON | MB brain, held-out (own baseline) |
|---|---|---|---|
| find rate | 95.6% [92.2%, 98.3%] | 96.1% [93.3%, 98.9%] | 95.0% [91.7%, 97.8%] |
| feeding | 49.0% | 48.9% | 43.5% |
| approach (fruit) | median 1042, 129/38 | median 1011.5, 130/37 | median 1094, 131/36 |
| approach (floral) | median 834, 129/36 | median 888, 138/27 | median 980, 130/35 |
| danger escape/turn | 15.5% (43/277) | 12.5% (34/272) | 19.4% (61/314) |

**Holds.** All three columns sit in the same band on every measure — find-rate CIs overlap heavily, feeding
43.5–49.0%, approach medians 834–1094 ticks with no systematic direction, danger escape 12.5–19.4% (the widest
spread, but escape-or-turn-within-window already fails its own 90% bar for *both* the MB brain and the social
brain on calibration seeds, T047 — a pre-existing weak point of the shared v3 body-layer stack, not something
this feature moved). Stimuli-off and stimuli-on within the social world are themselves statistically
indistinguishable (overlapping CIs, near-identical point estimates) — exactly the expected consequence of
`valence: "none"`: the social senses reach the brain but drive nothing, so removing them changes nothing
measurable. Raw run: `results-mb-baseline-heldout.md` / `.json`
(`node scripts/social-arms.mjs --world=world/world-forager-learning.json --seeds=held-out --arms=social`, the
same CLI run directly against the MB world — spec 019's own `results.md` covers only the conditioning-probe
shift, not this forager behavioural spread, so there was no existing number to read against).
