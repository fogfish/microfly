# Results: Food Odour Recalibration

## Baseline (before change)

Tree: branch `009-food-odour-recalibration` before any change in this feature (commit c2ae5be plus the uncommitted spec files).

### Test counts

| Suite | Command | Pass | Fail |
|---|---|---|---|
| Node unit tests | `node --test tests/*.test.mjs` (the `npm test` glob) | 354 | 6 |
| Slow behaviour | `node --test tests/slow/*.test.mjs` (`npm run test:slow`) | 0 | 0 (1 TODO, BUG-002 SC-011 "fails until T112") |
| Browser-module tests | `node --test public/tests/*.test.js` | 80 | 0 |

The 6 failing unit tests are in `tests/activity.test.mjs` (envelope and fading checks), failing before this change.

### Behaviour: `compare-baseline.mjs --world=world/world-forager.json --seeds=held-out`

```text
world world/world-forager.json, seeds held-out (30), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             8.3 %    [4.4 %, 12.2 %]       198       n/a/n/a           0.0 %    n/a         0         30
v1               42.2 %   [35.6 %, 49.4 %]      1339      1/1               99.1 %   16.7 %      343       30
random-matched   3.9 %    [1.1 %, 7.2 %]        216       1/1               71.1 %   -1.7 %      96        30
baseline         27.2 %   [21.1 %, 33.9 %]      835       n/a/n/a           0.0 %    n/a         0         30

PASS      find               v1 find rate exceeds the random walk: v1 42.2 %, baseline 27.2 %
FAIL      eat                median bout is longer for hungry starts than for sated starts: hungry 1, sated 1 ticks
PASS      hunger dependence  find rate is higher for hungry starts: 16.7 %
MEASURED  approach           measured (no threshold in the spec): median 1339 ticks, 11 included, 21 excluded
MEASURED  leave              measured (no threshold in the spec): walked 99.1 %
```

The `eat` metric fails on the current map (hungry and sated median bouts are both 1 tick). This is a finding, recorded and not tuned (AGENTS.md).

### Behaviour: calibration seeds

```text
world world/world-forager.json, seeds calibration (5), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             6.7 %    [0.0 %, 16.7 %]       n/a       n/a/n/a           0.0 %    n/a         0         5
v1               50.0 %   [30.0 %, 70.0 %]      579.50    1/3.50            33.3 %   16.7 %      124       5
random-matched   6.7 %    [0.0 %, 16.7 %]       n/a       n/a/n/a           0.0 %    0.0 %       2         5
baseline         26.7 %   [13.3 %, 43.3 %]      n/a       n/a/n/a           0.0 %    n/a         0         5

PASS      find               v1 find rate exceeds the random walk: v1 50.0 %, baseline 26.7 %
FAIL      eat                median bout is longer for hungry starts than for sated starts: hungry 1, sated 3.50 ticks
PASS      hunger dependence  find rate is higher for hungry starts: 16.7 %
MEASURED  approach           measured (no threshold in the spec): median 579.50 ticks, 2 included, 1 excluded
MEASURED  leave              measured (no threshold in the spec): walked 33.3 %

contacts are printed for information and do not decide the verdict (FR-028).
```

Calibration seeds (5) are for tuning; the same `eat` failure appears here. Nothing was tuned.

## After change

Tree: this feature's implementation (spec 009 tasks T001–T044), before any commit.

### Test counts

| Suite | Command | Pass | Fail |
|---|---|---|---|
| Node unit tests | `node --test tests/*.test.mjs` (the `npm test` glob) | 409 | 6 |
| Slow behaviour | `node --test tests/slow/*.test.mjs` | 0 | 0 (2 TODO) |
| Browser-module tests | `node --test public/tests/*.test.js` | 80 | 0 |
| LIF golden | `node --test tests/lif-golden.test.mjs` | 1 | 0 |

The 6 unit failures are the same `tests/activity.test.mjs` checks that failed before this change. `npm test` is therefore not green, and this is not caused by the feature.

Slow suite finding: `tests/slow/forager-brake.test.mjs` "every eating tick is below the eating speed and has taste input above 0" passed in the baseline and now fails with "the fleet eats" (no fly eats on the held-out seeds). Both slow tests are marked TODO (BUG-002). The map change is the cause to investigate; nothing was tuned to hide it.

### Food placement

`node scripts/food-placement.mjs 6`: 1 395 of 1 536 cells walkable, one walkable component, odour-free share 49.8 %, reaches small 6, medium 8.44, large 11.81 cells. Matches research R2.

### Behaviour: `compare-baseline.mjs --world=world/world-forager.json --seeds=held-out`

```text
world world/world-forager.json, seeds held-out (30), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             3.3 %    [1.1 %, 6.1 %]        165       n/a/n/a           0.0 %    n/a         0         30
v1               22.2 %   [15.6 %, 27.8 %]      1439      n/a/1             100.0 %  19.4 %      356       30
random-matched   3.3 %    [1.1 %, 6.1 %]        257.50    1/13              97.4 %   1.1 %       61        30
baseline         15.6 %   [10.0 %, 21.1 %]      983       n/a/n/a           0.0 %    n/a         0         30

PASS      find               v1 find rate exceeds the random walk: v1 22.2 %, baseline 15.6 %
FAIL      eat                median bout is longer for hungry starts than for sated starts: hungry n/a, sated 1 ticks
PASS      hunger dependence  find rate is higher for hungry starts: 19.4 %
MEASURED  approach           measured (no threshold in the spec): median 1439 ticks, 25 included, 116 excluded
MEASURED  leave              measured (no threshold in the spec): walked 100.0 %

contacts are printed for information and do not decide the verdict (FR-028).
```

### Behaviour: calibration seeds

```text
world world/world-forager.json, seeds calibration (5), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             3.3 %    [0.0 %, 10.0 %]       621       n/a/n/a           0.0 %    n/a         0         5
v1               33.3 %   [16.7 %, 50.0 %]      895.50    n/a/n/a           0.0 %    13.3 %      17        5
random-matched   0.0 %    [0.0 %, 0.0 %]        n/a       n/a/n/a           0.0 %    -6.7 %      0         5
baseline         10.0 %   [0.0 %, 20.0 %]       n/a       n/a/n/a           0.0 %    n/a         0         5

PASS      find               v1 find rate exceeds the random walk: v1 33.3 %, baseline 10.0 %
FAIL      eat                median bout is longer for hungry starts than for sated starts: hungry n/a, sated n/a ticks
PASS      hunger dependence  find rate is higher for hungry starts: 13.3 %
MEASURED  approach           measured (no threshold in the spec): median 895.50 ticks, 6 included, 15 excluded
MEASURED  leave              measured (no threshold in the spec): walked 0.0 %

contacts are printed for information and do not decide the verdict (FR-028).
```

Reading: the v1 brain still beats the random walk on held-out seeds (22.2 % against 15.6 %), but its find rate fell from 42.2 % to 22.2 %, and the size-matched random graph is at 3.3 %. The `eat` check fails before and after the change. Nothing was tuned: the placement was chosen from geometry (research R2), and the radius of 6 is the recorded config change (FR-017). Any further calibration is a separate, recorded step on calibration seeds only.

### Smoke check

Headless Google Chrome loaded `?world=world/world-forager.json` from the static server: canvas, layers panel and six fly entries rendered, and no console errors were logged. Not yet done: the odour layer toggled on and one fly seen running (T046), and the visual check of the fly sprite at zoom 2 and 4 (T036).

### T046 — Smoke test (quickstart §3)

Headless Chromium (Playwright `chromium` 1.63, driven from a scratch script, not committed) loaded
`http://localhost:8000/?world=world/world-forager.json` from `python3 -m http.server` in `public/`. Selected Fly 0
(World tab, fly list), switched to the World tab, clicked the `ODOUR` arcade switch (`aria-checked` went `false` →
`true`), and let the fly run for several seconds. Console (`console` events) and `pageerror` listeners were attached
for the whole run; `response` listener confirmed no HTTP status ≥ 400. Result: **0 console errors, 0 failed
requests** across page load, fly selection, layer toggle and the running period. The fly's own telemetry (Action
section: Energy, Hunger, Speed, Feed, Forward, Backward, Eating; Brain activity counts) updated continuously,
confirming the fly was ticking while the layer was on.

### T036 — Visual check of the fly sprite (quickstart §4)

The live world canvas did not show a moving fly sprite inside the headless session despite the simulation visibly
running (panel telemetry changed tick to tick; `requestAnimationFrame` fired at ~60 fps; zero console errors; no
failed requests for the atlas or world JSON) — two full-map scans (zoom 1, nearly the whole 48×32 grid) with a
per-pixel diff over 5 s found zero changed pixels on `#world`, and a scan for the `fly`/`fly-baseline` palette colours
(`#ff3b3b`, `#d9a441`, `#1b1b1b`, `#dfe9f5` and the baseline equivalents) found none on screen. This looks like a
headless-Chromium rendering quirk around this canvas rather than an app bug — the fly list, Action bars (see BUG-003)
and brain activity point cloud all render and update normally in the same session, console is clean, and
`tests/fly-sprite.test.mjs` (T035) already passes. Recorded here rather than silently assumed: **a human should
confirm the fly is visible and moves in a real browser tab** before fully trusting this check.

To still verify the sprite itself (shape, palette, not rotated), the exact pixel-decode logic from
`public/js/render/sprites.js` (`renderPixels`: one `fillRect` per non-`.` character, using the sprite's own palette)
was run standalone against `world.sprites.fly` and `world.sprites["fly-baseline"]` from `world-forager.json`, scaled
to 1×, 2× and 4× with `imageSmoothingEnabled = false` (nearest-neighbour), matching the renderer's own zoom handling.
Both sprites: exactly 32×32, head (red eyes `#ff3b3b`, black thorax `#1b1b1b`) at the top of the grid and not rotated,
a tapering abdomen below with alternating tan (`#d9a441`) and dark bands, and a pair of light, roughly symmetric
"wing" shapes (`#dfe9f5`) flanking the body — matches FR (contracts/fly-sprite.md §1–§3) and the quickstart's palette
description. Subjectively, the silhouette (wide pale wings flanking a banded abdomen) reads first as a bee or generic
flying insect rather than specifically a fruit fly; the quickstart's acceptance bar ("names it as a fly or an
insect") is met, but a stricter "fruit fly" read is not guaranteed. This is a design judgement, not a defect — no
code or config was changed for it.

## After BUG-001 fix (multiple food instances per class)

Tree: this feature's implementation plus the BUG-001 fix (spec 009 tasks T001–T060), before any commit.

BUG-001: the reporter found only one food object per size class (three total) and asked for several instances per
class so that odour covers 60–70% of the map (instead of the ~50% the one-per-class placement reached), allowing
instances to be placed near each other to raise local odour. `FR-001`, `FR-006`, `FR-008` and `SC-001`/`SC-002` were
revised (one or more per class; 30–40% odour-free instead of 30–70%) and `FR-020` was added (same-class overlap is
allowed). See `bugs/BUG-001.md`.

### Food placement

`node scripts/food-placement.mjs 6`: phase 1 (research R2, unchanged) finds the base triple — 1 395 of 1 536 cells
walkable, one walkable component, odour-free share 49.8%, reaches small 6, medium 8.44, large 11.81 cells. Phase 2
(new, BUG-001) greedily adds instances until the free share falls inside 30–40%: 2 rounds added one extra `small`
and one extra `medium`, for 5 instances total (2 small, 2 medium, 1 large), landing at **odour-free share 33.3%**
(odour covers 66.7% of walkable cells), 0 stranded cells. Also fixed a half-cell coordinate bug inherited from the
original script: it reported `x - 0.5, y - 0.5` instead of the exact cell centre (`x, y`) it evaluated the geometry
against; the shipped worlds already used the correct centre (e.g. `10.5, 20.5`), so this was a latent script bug,
not a map bug.

Final placement, applied identically to all five shipped worlds (confirmed byte-identical `grid`/`waterBodies`/
`groves`/`scatter`/`objects` beforehand, so one search applies to all):

| Kind | Sprite | x | y | Reach |
|---|---|---|---|---|
| large | `jungle-plant-015` | 10.5 | 20.5 | 11.81 |
| medium | `jungle-plant-010` | 32.5 | 19.5 | 8.44 |
| small | `red_flower_plant` | 21.5 | 3.5 | 6.00 |
| small | `red_flower_plant` | 4.5 | 5.5 | 6.00 |
| medium | `jungle-plant-010` | 42.5 | 7.5 | 8.44 |

### Test counts

| Suite | Command | Pass | Fail |
|---|---|---|---|
| Node unit tests | `node --test tests/*.test.mjs` (the `npm test` glob) | 410 | 6 |
| Slow behaviour | `node --test tests/slow/*.test.mjs` | 0 | 0 (2 TODO) |
| Browser-module tests | `node --test public/tests/*.test.js` | 80 | 0 |
| LIF golden | `node --test tests/lif-golden.test.mjs` | 1 | 0 |

The 6 unit failures are the same `tests/activity.test.mjs` checks that failed before this feature and before the
BUG-001 fix; unrelated to food placement. The 2 slow-suite TODOs are the pre-existing BUG-002 items. `tests/odour-food.test.mjs` (FR-001, SC-002, FR-008 checks rewritten for one-or-more-per-kind and allowed overlap) and
`public/tests/spread.test.js` (same rewrite) pass on all shipped worlds, as does the new `validate-v3.test.mjs`
check that more than one edible of the same kind is accepted.

### Behaviour: `compare-baseline.mjs --world=world/world-forager.json --seeds=held-out`

```text
world world/world-forager.json, seeds held-out (30), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             5.6 %    [2.8 %, 8.9 %]        191       n/a/n/a           0.0 %    n/a         0         30
v1               36.1 %   [29.4 %, 42.8 %]      1402.50   2/1               99.7 %   21.7 %      433       30
random-matched   4.4 %    [1.7 %, 7.8 %]        202.50    1/12              99.5 %   0.6 %       62        30
baseline         23.3 %   [16.7 %, 29.4 %]      928       n/a/n/a           0.0 %    n/a         0         30

PASS      find               v1 find rate exceeds the random walk: v1 36.1 %, baseline 23.3 %
PASS      eat                median bout is longer for hungry starts than for sated starts: hungry 2, sated 1 ticks
PASS      hunger dependence  find rate is higher for hungry starts: 21.7 %
MEASURED  approach           measured (no threshold in the spec): median 1402.50 ticks, 36 included, 82 excluded
MEASURED  leave              measured (no threshold in the spec): walked 99.7 %

contacts are printed for information and do not decide the verdict (FR-028).
```

### Behaviour: calibration seeds

```text
world world/world-forager.json, seeds calibration (5), 6 flies per cohort, 3000 ticks per fly

arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             6.7 %    [0.0 %, 16.7 %]       621       n/a/n/a           0.0 %    n/a         0         5
v1               43.3 %   [26.7 %, 63.3 %]      1687      n/a/n/a           0.0 %    10.0 %      46        5
random-matched   3.3 %    [0.0 %, 10.0 %]       n/a       n/a/n/a           0.0 %    -3.3 %      1         5
baseline         23.3 %   [6.7 %, 40.0 %]       n/a       n/a/n/a           0.0 %    n/a         0         5

PASS      find               v1 find rate exceeds the random walk: v1 43.3 %, baseline 23.3 %
FAIL      eat                median bout is longer for hungry starts than for sated starts: hungry n/a, sated n/a ticks
PASS      hunger dependence  find rate is higher for hungry starts: 10.0 %
MEASURED  approach           measured (no threshold in the spec): median 1687 ticks, 5 included, 10 excluded
MEASURED  leave              measured (no threshold in the spec): walked 0.0 %

contacts are printed for information and do not decide the verdict (FR-028).
```

Reading: with 5 food instances instead of 3, the v1 brain's held-out find rate rose from 22.2% (one-per-class) to
**36.1%**, still clear of the random walk (23.3%) and the size-matched random graph (4.4%). More strikingly, the
`eat` metric — which **failed both before this feature and after the original one-per-class fix** — now **passes**
on held-out seeds: hungry flies have a longer median eating bout (2 ticks) than sated flies (1 tick). On the small
calibration set (5 seeds) `eat` still reads `n/a` for both cohorts (too few eating bouts in only 5 seeds to get a
median), so the pass is a held-out-scale effect, not a calibration artefact. Nothing was tuned to produce this: the
added instances and their positions came from the geometry-only placement search (food-placement.mjs), run without
reference to behaviour, and `radius` (6) is unchanged from the original feature. This is recorded as a finding
(AGENTS.md): more food, geometrically placed for coverage, happened to be enough for the existing brain and
calibration to clear the `eat` bar that one-per-class food could not.

### Smoke test (BUG-001)

Headless Chromium (Playwright `chromium` 1.63, driven from a scratch script, not committed), serving `public/` with
`python3 -m http.server`, loaded `?world=world/world-forager.json`. Switched to the World tab, selected Fly 0,
clicked the `ODOUR` arcade switch (`aria-label="Odour layer"`, `aria-checked` went `false` → `true`), and let it run
for several seconds. `console`, `pageerror` and `response` listeners were attached for the whole run. Result:
**0 console errors, 0 failed requests**, the odour switch stayed `aria-checked="true"`, and a two-point snapshot of
the fly's Action panel text showed it changed between the two reads, confirming the fly kept ticking with five food
sources and the denser odour field live. `public/world/world-forager.json` served from the app matches the
migrated file: `version 3`, 5 `edibles` (`large`, `medium`, `small`, `small`, `medium`).

## BUG-002: Male/Female Fly Sprites And Wing Orientation

### T062 — Sprite art

The four 32 × 32 sprites (`fly-female`, `fly-female-baseline`, `fly-male`, `fly-male-baseline`) were generated
programmatically (ellipse masks for head/eyes/thorax/abdomen/wings, scratch script, not committed) from
`fruit-fly.jpeg`'s proportions: female gets a longer abdomen with five evenly spaced dark bands reaching the tip;
male gets a shorter, more compact abdomen ending in one solid dark band. Both sexes share the same head, thorax,
wing and leg geometry. Wings are two horizontal ellipses rooted at the thorax (rows 9–14) spanning the full 32-pixel
width, so their long axis runs across the body's vertical long axis — roughly a right angle — instead of flanking
the body lengthwise as the old `fly`/`fly-baseline` art did (contracts/fly-sprite.md §3). Written into the `sprites`
map of all five world files, replacing `fly`/`fly-baseline`.

### T063/T064 — Per-fly sex (open decision D4, confirmed as planned)

`flies.sex` (new, optional array, one `"female"`/`"male"` entry per fly index) was added to `public/js/world/validate.js`
(length must equal `flies.count`; each entry must be a known sex; the `fly-<sex>` and `fly-<sex>-baseline` sprites
must exist), `public/js/fly/fly-config.js` (`resolveFlies` carries `sex` through), and `public/js/fly/fly-world.js`
(`spawnFlies` picks `fly-<sex>` or `fly-<sex>-baseline` by mode when `sex[i]` is set, falling back to the existing
single `flies.sprite`/`baselineSprite` when it is not — so a world without `flies.sex` still loads). All five world
files now set `flies.sex` to an alternating `["female","male","female","male","female","male"]` mix for their six
flies, and `flies.sprite`/`baselineSprite` point at the female pair as the fallback default.

### T065 — Tests

`tests/fly-sprite.test.mjs` was rewritten for the four ids: shape/palette validity, each sex's normal/baseline pair
sharing pixels with a different palette (FR-016), female and male sprites differing in shape (FR-021), and a wing
geometry check (wing pixels present near both far edges of the thorax row, the signature of wings projecting
sideways rather than running lengthwise). `tests/fly-world.test.mjs` gained two tests: `spawnFlies` picks the right
sprite per declared sex and mode, and falls back to `flies.sprite`/`baselineSprite` when `flies.sex` is absent.
`tests/validate-flies.test.mjs` gained three tests for `flies.sex` (wrong length, invalid entry, a sex with no
matching sprite pair) and one existing test (`count above 64 is rejected`) was adjusted to delete `flies.sex` first,
since it is unrelated to the count bound under test. `public/tests/banned-art.test.js`'s 32×32 size check now covers
all four ids. Full suite: `npm test` 439/6 (6 pre-existing failures in `tests/activity.test.mjs`, unrelated — same
count as BUG-001's T058 run), `node --test public/tests/*.test.js` 80/0, and the directly affected suites
(`tests/lif-golden.test.mjs`, `tests/fly-world.test.mjs`, `tests/odour-food.test.mjs`, `tests/validate-v3.test.mjs`,
`tests/fly-sprite.test.mjs`, `tests/validate-flies.test.mjs`) all green.

### T066 — Visual check (quickstart §4, redone)

Headless Chromium (Playwright `chromium` 1.63, driven from a scratch script, not committed), serving `public/` with
`python3 -m http.server`, loaded `?world=world/world-forager.json`. The world config fetched by the page itself
confirmed the four new sprite ids and `flies.sex` as migrated. Each of the four sprites was rendered with the exact
`renderPixels` pixel-decode logic from `public/js/render/sprites.js` and checked: 401 non-transparent pixels for
each female sprite, 344 for each male sprite (female/male differ, baseline/normal within a sex match), and a wing
pixel present at both far edges of the thorax row (column 2–3 and 28–29) for all four — confirming the wings
project laterally rather than flanking the body lengthwise. 0 console errors, 0 failed requests.

As in BUG-001's T036, **the live `#world` canvas did not visibly render any fly** in this headless session (a
six-pixel wheel-zoom plus a full canvas scan for the exact sprite palette colours found zero matching pixels),
while the fly list, panel telemetry and the sprite-decode check above all behaved normally — the same
headless-Chromium quirk recorded before, not a regression from this change. **A human should confirm the female and
male sprites are visible, distinguishable, and not rotated in a real browser tab** (quickstart §4) before this task
is considered fully closed.
