# Quickstart: Validating Hunger-Sensitive Feeding and Food Depletion

Prerequisites: Node 20+ (for `npm test`), no install step (AGENTS.md: no `npm install`, no bundler).

## 1. Unit tests (fast, run first)

```bash
npm test
```

Expect the existing suite plus the new tests this feature adds (see
[contracts/world-config-food-feeding.md](contracts/world-config-food-feeding.md)'s "Contract tests" section) to
pass, and `tests/lif-golden.test.mjs` in particular to still pass unchanged — it is the regression guard that
`public/js/brain/*.js` was not touched.

## 2. World-config validation, by hand

Add the new `flies.food` keys (see the contract's Example) to a copy of `public/world/world-forager.json` (or a
scratch world file) and confirm:

- Omitting all five new keys loads with no validation errors and no behavior change (compare a run's energy/bout
  history before and after this feature with the keys absent — should be identical for the same seed).
- A malformed value for each new key (e.g. `"feedMotion": "stop"`, `"capacity": { "small": 1 }` missing
  `medium`/`large`) produces the exact failure message documented in the contract, not a silent fallback.

## 3. Run the app and watch one fly

```bash
cd public && python3 -m http.server 8000
```

Open `http://localhost:8000/?world=world/world-forager.json` (or a scratch world with the new keys set) and,
using the side panel (`public/js/ui/`) that already shows energy/hunger/eating state:

- **Hunger sensitivity**: with `hungerSensitivity` set, watch a fly's path change — once its energy crosses the
  threshold, it should start turning toward a food resource from farther away than it did while sated. No console
  errors; no change to the brain's own telemetry (spike counts, firing rates) beyond the different input values
  it was given.
- **Feed motion**: with `feedMotion: "slow"` and a `feedSlowSpeed` clearly below `baseSpeed`, a feeding fly should
  keep inching forward instead of stopping dead, for the whole bout, then resume normal speed.
- **Depletion and recovery**: with `capacity` set, watch a small resource empty after one fly feeds to satiation
  once, a medium one after two, a large one after three — and watch each one's visual odor/marker fade with its
  remaining capacity, then reappear at full strength `recovery` seconds (default 30) after it emptied.

## 4. Regression check (AGENTS.md "before a feature is done")

- `npm test` passes.
- The app starts with the static server and runs at least one fly with no console errors, both with the new
  `flies.food` keys present and with them entirely absent (old worlds).
- Every shipped world under `public/world/*.json` still loads (none of them need to change for this feature to
  ship, since every new key is optional).
