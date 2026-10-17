---

description: "Task list for Hunger-Sensitive Feeding and Food Depletion"
---

# Tasks: Hunger-Sensitive Feeding and Food Depletion

**Input**: Design documents from `/specs/018-hunger-sensitivity-feeding/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/world-config-food-feeding.md](contracts/world-config-food-feeding.md), [quickstart.md](quickstart.md)

**Tests**: Included. The contract (`contracts/world-config-food-feeding.md`, "Contract tests" section) and this
project's own gate (AGENTS.md: "before calling a feature done: `npm test` passes") both call for them; they extend
this repo's existing `tests/*.test.mjs` suite (Node's built-in test runner, no new framework).

**Organization**: Tasks are grouped by user story (spec.md: US1/US2 are P1, US3 is P2) so each can be implemented,
tested, and demoed independently.

**Scope note carried over from plan.md/contracts**: everything below lives in `public/js/fly/*.js` and
`public/js/world/validate.js`. No task touches `public/js/brain/*.js` (LIF core, channel gains, decoder) — see
`research.md` D1–D2 for why each mechanism is placed where it is.

**Scope correction found while breaking down US3** (see T020 note): `flies.food.feedMotion` is implemented for the
v3 body layer (`body-layer.js`) only. In v1/v2 (`forager-step.js`'s `applyForagerMotor`), `eating` is derived
*after* that tick's body move from the speed the move already produced (`canEat`'s `speed < eatSpeed` gate) —
there is no point at which to apply a pause/slow override without reordering sense→move→gate for those versions,
which is a bigger structural change than this feature asks for. v1/v2 keep today's `eatSpeed`-gated behavior
unchanged; T020 updates the plan/contract text to say so explicitly.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Each task names its exact file path(s)

## Phase 1: Setup

**Purpose**: A manual-verification fixture shared by every story's quickstart step; no dependencies, no new tooling.

- [X] T001 [P] Create `public/world/world-forager-food-feeding-demo.json` as a copy of `public/world/world-forager.json`
      with every new `flies.food` key set per the contract's Example (`hungerSensitivity: { threshold: 0.4, gain: 1.8 }`,
      `feedMotion: "slow"`, `feedSlowSpeed: 0.1`, `capacity: { small: 1, medium: 2, large: 3 }`, `recovery: 30`), for use
      in `quickstart.md` steps 2–3.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared-file change every later story's default behavior relies on.

**⚠️ CRITICAL**: Complete before US2 or US3 implementation tasks (US1 does not depend on this).

- [X] T002 In `public/js/fly/fly-config.js`, add `feedMotion: 'pause'` and `recovery: 30` to the existing
      `FOOD_DEFAULTS` object (`public/js/fly/fly-config.js:8-10`), so `resolveFlies`'s existing
      `food: { ...FOOD_DEFAULTS, ...f.food }` merge (line 56) gives every world these two defaults without further
      code changes. Do not add defaults for `hungerSensitivity`, `capacity`, or `feedSlowSpeed` — per data-model.md,
      "absent" must mean "feature off," not a merged default object.

**Checkpoint**: Foundation ready — US1, US2, US3 can now proceed (US2/US3 benefit from T002; US1 does not need it).

---

## Phase 3: User Story 1 - A hungry fly finds food faster (Priority: P1) 🎯 MVP

**Goal**: A fly whose hunger is at/above a declared threshold senses food odor at a higher gain than a well-fed
fly, so it reliably turns toward food from farther away once it's hungry.

**Independent Test**: Place a fly at a fixed distance from a food resource with energy above the threshold, then
below it; confirm the sensed odor input value is larger in the second case, with no change to array shape/order.

### Tests for User Story 1 ⚠️

> Write these first; confirm they fail against the current (pre-filter) code before implementing.

- [X] T003 [P] [US1] Add validation test cases to `tests/validate-flies.test.mjs`: a valid
      `flies.food.hungerSensitivity: { threshold: 0.4, gain: 1.8 }` loads with no error; `threshold` missing, `< 0`,
      or `>= 1` gives `flies.food.hungerSensitivity.threshold must be a number from 0 to less than 1`; `gain` missing
      or `< 1` gives `flies.food.hungerSensitivity.gain must be a number of 1 or more`; the key is absent by default
      and causes no error on every existing fixture world.
- [X] T004 [P] [US1] Add sensor-filter unit tests to `tests/forager-step.test.mjs`: with no `hungerSensitivity`
      configured, `senseForagerFly`'s `left`/`right` inputs are unchanged from today; with it configured and
      `fly.energy` such that `hunger < threshold`, inputs are unchanged; with `hunger >= threshold`, `left`/`right`
      are exactly the unscaled value × `gain`; in every case the `inputs` array keeps its existing length (4) and
      order (`left, right, taste, taste`).
- [X] T005 [P] [US1] Add the equivalent sensor-filter unit tests to `tests/forager-step-wide.test.mjs` for
      `senseForagerFlyWide`: the filter applies only to input channels whose declared `sense` is the food-odor
      sense (`odour:food`), leaves every other channel (taste/contact, danger, water, forest-edge) untouched, and
      preserves `values`'s length and per-channel order.

### Implementation for User Story 1

- [X] T006 [US1] In `public/js/world/validate.js`, extend `validateFlyFood` (around line 897) to validate the
      optional `flies.food.hungerSensitivity` object per T003's rules: must be an object with `threshold` (a number
      in `[0, 1)`) and `gain` (a number `>= 1`); emit the exact failure messages from T003/the contract. Absent
      `hungerSensitivity` is valid and produces no error (depends on T003 to drive the expected messages).
- [X] T007 [US1] In `public/js/fly/forager-step.js`'s `senseForagerFly` (line 49), after computing `left`/`right`
      from `senseBilateralField`, apply the hunger filter: if `env.foodConfig.hungerSensitivity` is set and
      `hungerOf(fly.energy) >= env.foodConfig.hungerSensitivity.threshold`, multiply `left` and `right` by
      `env.foodConfig.hungerSensitivity.gain` before building `inputs`. Leave `taste` unscaled (the filter is an
      odor-sensitivity effect, per spec US1; taste is a contact reading, not an odor one). (depends on T006)
- [X] T008 [US1] In `public/js/fly/forager-step-wide.js`'s `senseForagerFlyWide` (line 119), apply the same filter
      to any input channel whose `ch.sense === 'odour:food'` (and, per `declaredSpec`, is in field mode or point
      mode — the filter applies to the sampled value either way), using `env.foodConfig.hungerSensitivity` and the
      already-computed `hunger` value, before the existing bilateral-contrast step (line 129) runs on the scaled
      values. (depends on T006)
- [X] T009 [US1] Run `tests/validate-flies.test.mjs`, `tests/forager-step.test.mjs`, `tests/forager-step-wide.test.mjs`
      (`npm test`) and confirm T003–T005 now pass. (depends on T006, T007, T008)
- [ ] T010 [US1] Manually verify via `quickstart.md` step 3 "Hunger sensitivity", using
      `public/world/world-forager-food-feeding-demo.json` from T001: a fly's path visibly turns toward food sooner
      once hungry than it did while sated, with no console errors. (depends on T001, T007, T008)

**Checkpoint**: User Story 1 is fully functional and testable on its own — a hungry fly senses food odor more
strongly, with no change to the brain, the worker protocol, or any world that doesn't set `hungerSensitivity`.

---

## Phase 4: User Story 2 - Feeding wears down a food resource until it recovers (Priority: P1)

**Goal**: A food resource holds a size-derived number of completed feedings (small = 1, medium = 2, large = 3);
each completed feeding lowers its remaining availability and the odor it gives off; once exhausted, it is
unfeedable and silent until a configurable recovery delay (default 30 s) passes, then returns to full.

**Independent Test**: Seed one resource per size, feed each to satiation the declared number of times, confirm
each reaches zero availability after exactly its declared count and stays unfeedable/silent until `recovery`
seconds have passed with no console errors.

### Tests for User Story 2 ⚠️

> Write these first; confirm they fail against the current (continuous-only) `food.js` before implementing.

- [X] T011 [P] [US2] Add validation test cases to `tests/validate-flies.test.mjs`: a valid
      `flies.food.capacity: { small: 1, medium: 2, large: 3 }` with `recovery: 30` loads with no error; `capacity`
      missing any of `small`/`medium`/`large`, or with a non-positive-integer value, or with an extra/unknown key,
      gives `flies.food.capacity must have "small", "medium" and "large", each a positive integer`; `recovery` set
      without `capacity` gives `flies.food.recovery is only valid when flies.food.capacity is set`; `recovery < 0`
      gives `flies.food.recovery must be a number of 0 or more`; both keys absent is valid (today's continuous
      model) and causes no error on every existing fixture world.
- [X] T012 [P] [US2] Create `tests/food-capacity.test.mjs` covering `public/js/fly/food.js`'s capacity model: a
      `createFood` built with `flies.food.capacity = { small: 1, medium: 2, large: 3 }` gives a small-kind cell
      `remainingUnits === 1`, medium `=== 2`, large `=== 3`; completing one feeding (the new unit-charge call, see
      T014) on a small cell drops it to 0 and `fraction()` to 0; on a medium cell it drops to 1 (fraction 0.5) after
      one and 0 after two; a `'walked'`-outcome feeding changes nothing; a depleted cell's `fraction()` stays 0 for
      `recovery` seconds (test with `recovery: 0`, the default `30`, and a longer custom value) and becomes exactly
      1 again once elapsed, via the existing `regrow(seconds, exceptCell)` call now also advancing recovery.
- [X] T013 [P] [US2] Add bout-close charging tests to `tests/forager-step.test.mjs` (v1 `applyForagerMotor`) and
      `tests/body-layer.test.mjs` (v3 `stepBodyLayer`): with the capacity model active, a bout that closes `'sated'`
      or `'empty'` charges exactly one unit at close, not per tick while eating; a bout that closes `'walked'`
      charges nothing; with the capacity model inactive (no `flies.food.capacity`), behavior is byte-identical to
      today's continuous `consumeRate × dt` drain.

### Implementation for User Story 2

- [X] T014 [US2] In `public/js/fly/food.js`'s `createFood`, add the capacity model from data-model.md: when
      `config.food.capacity` is set, derive each stimulus cell's `capacity` from its existing `kind`
      (`world.stimulusCells`'s `{ kind, reach }`, already `"small"`/`"medium"`/`"large"`) via
      `config.food.capacity[kind]`, track `remainingUnits` (init `capacity`) and `recoveryUntil` (init `null`) per
      cell alongside the existing `stock` map; add a `completeFeeding(cx, cy)` method that decrements
      `remainingUnits` by 1 (floor 0) and, on reaching 0, sets `recoveryUntil = now + config.food.recovery`
      (`config.food.recovery ?? 30`, read at call time, not cached, so T002's default applies); make `fraction(cx,
      cy)` and `stockAt(cx, cy)` read from the capacity fields when the model is active for that world, else keep
      today's `stock / full`. Extend the existing `regrow(seconds, exceptCell)` to also advance every capacity-model
      cell's recovery countdown and reset `remainingUnits = capacity` (clearing `recoveryUntil`) once elapsed — no
      new call site is introduced; `regrow` is already called every tick by both motor-control files below.
      (depends on T002 for the `recovery` default, T011/T012 for the expected shape)
- [X] T015 [US2] In `public/js/world/validate.js`, extend `validateFlyFood` to validate the optional
      `flies.food.capacity`/`flies.food.recovery` per T011's rules. (depends on T011)
- [X] T016 [US2] In `public/js/fly/forager-step.js`'s `applyForagerMotor` (line 70), move the resource-depletion
      side effect: keep `fly.energy = eat(...)` and the legacy `flowers.consume(cx, cy, foodConfig.consumeRate *
      dt)` call exactly as they are today for cells not using the capacity model; for a capacity-model cell, drop
      the per-tick `consume` call and instead call `flowers.completeFeeding(cx, cy)` once, in the existing
      `} else if (fly.bout) { fly.bouts.push(closeBout(...)); ... }` branch (line 92), when the just-closed bout's
      `endedBy !== 'walked'`. (depends on T014)
- [X] T017 [US2] Apply the same change to `public/js/fly/body-layer.js`'s `stepBodyLayer` (the `flowers.consume(fx,
      fy, foodConfig.consumeRate * dt)` call at line 206, and the bout-close branch at lines 213–218). (depends on
      T014)
- [X] T018 [US2] Run `tests/validate-flies.test.mjs`, `tests/food-capacity.test.mjs`, `tests/forager-step.test.mjs`,
      `tests/body-layer.test.mjs` (`npm test`) and confirm T011–T013 now pass. (depends on T015, T016, T017)
- [ ] T019 [US2] Manually verify via `quickstart.md` step 3 "Depletion and recovery", using
      `public/world/world-forager-food-feeding-demo.json` from T001: small/medium/large resources empty after
      exactly 1/2/3 feedings, fade visually as capacity drops, and reappear at full strength `recovery` seconds
      after emptying, with no console errors. (depends on T001, T016, T017)

**Checkpoint**: User Stories 1 AND 2 both work independently — hunger raises odor sensitivity, and feeding now
measurably wears a resource down and lets it recover, with every pre-existing world (no `capacity` key) unchanged.

---

## Phase 5: User Story 3 - Feeding affects how a fly moves (Priority: P2)

**Goal**: A world can declare whether a feeding fly pauses in place or moves at a reduced, declared speed while
it eats, so feeding reads as a distinct, observable behavior.

**Independent Test**: Configure `feedMotion: "pause"` and confirm a feeding v3 fly's speed is 0 for the whole
bout; configure `"slow"` and confirm it holds at `feedSlowSpeed` for the whole bout; both return to normal
movement the tick the bout closes.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Add validation test cases to `tests/validate-flies.test.mjs`: `flies.food.feedMotion:
      "pause"` and `"slow"` (with `feedSlowSpeed`) load with no error; any other string gives `flies.food.feedMotion
      must be "pause" or "slow"`; `feedMotion: "slow"` without `feedSlowSpeed` gives `flies.food.feedSlowSpeed is
      required when flies.food.feedMotion is "slow"`; a negative `feedSlowSpeed` gives `flies.food.feedSlowSpeed …
      must be a number of 0 or more`; both keys absent defaults to `"pause"` (T002) with no error.
- [X] T021 [P] [US3] Add feed-motion unit tests to `tests/body-layer.test.mjs`: with `feedMotion: "pause"` (or
      absent, the default from T002), a feeding fly's `target.speed` is 0 for the whole bout, matching today's
      behavior exactly; with `feedMotion: "slow"` and a given `feedSlowSpeed`, a feeding fly's `target.speed` equals
      `feedSlowSpeed` for the whole bout; in both cases, normal locomotion (`walk(...)`) resumes the tick the bout
      closes.

### Implementation for User Story 3

- [X] T022 [US3] In `public/js/world/validate.js`, extend `validateFlyFood` to validate the optional
      `flies.food.feedMotion`/`flies.food.feedSlowSpeed` per T020's rules. (depends on T020)
- [X] T023 [US3] In `public/js/fly/body-layer.js`'s `stepBodyLayer` (line 154), change the `eating` branch from the
      hard-coded `target = { heading: body.heading, speed: 0 }` to: `speed: foodConfig.feedMotion === 'slow' ?
      foodConfig.feedSlowSpeed : 0` (default `'pause'` behavior, i.e. `0`, preserved from T002's default).
      (depends on T022)
- [X] T024 [US3] Update this feature's own docs to record the v1/v2 scope decision found while writing T022/T023:
      amend `contracts/world-config-food-feeding.md`'s `feedMotion`/`feedSlowSpeed` rows to state "v3 (`body-
      layer.js`) only — v1/v2 keep their existing `eatSpeed`-gated behavior, since `applyForagerMotor` determines
      `eating` only after that tick's move (see `research.md` for the sensor/motor placement rationale)," and amend
      `plan.md`'s Project Structure note for `forager-step.js` to drop the now-inaccurate "applies the feed-motion
      choice" clause. (no code dependency; can run alongside T023)
- [X] T025 [US3] Run `tests/validate-flies.test.mjs` and `tests/body-layer.test.mjs` (`npm test`) and confirm
      T020–T021 now pass. (depends on T022, T023)
- [ ] T026 [US3] Manually verify via `quickstart.md` step 3 "Feed motion", using
      `public/world/world-forager-food-feeding-demo.json` from T001 (set to `feedMotion: "slow"`): a feeding v3 fly
      visibly keeps inching forward instead of stopping dead, for the whole bout, then resumes normal speed.
      (depends on T001, T023)

**Checkpoint**: All three user stories are independently functional — US1 (sensitivity), US2 (depletion/recovery),
and US3 (feed motion) each work alone and together, with no pre-existing world's behavior changed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression gate across all three stories together, per AGENTS.md's own "before a feature is
done" checklist.

- [X] T027 Run the full suite: `npm test` (depends on all prior phases).
- [ ] T028 Start the static server (`cd public && python3 -m http.server 8000`) and run at least one fly on
      `public/world/world-forager.json` (no new keys — today's behavior) and on
      `public/world/world-forager-food-feeding-demo.json` (every new key set), confirming no console errors in
      either case, per `quickstart.md` step 4. (depends on T027)
- [X] T029 [P] Spot-check every other shipped world under `public/world/*.json` still loads without a validation
      error (none of them need to change for this feature). (depends on T015, T022)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 can start immediately.
- **Foundational (Phase 2)**: No dependency on Setup; T002 blocks US2's and US3's default behavior (not US1).
- **User Story 1 (Phase 3)**: Depends only on Setup (T001, for its manual-verification step). Can start immediately
  in parallel with Phase 2.
- **User Story 2 (Phase 4)**: Depends on Foundational (T002) for the `recovery` default.
- **User Story 3 (Phase 5)**: Depends on Foundational (T002) for the `feedMotion` default.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — a hungry fly's odor sensitivity is independent of the food-resource
  model and the feed-motion choice.
- **US2 (P1)**: No dependency on US1 or US3 — depletion/recovery is independent of odor sensitivity and feed
  motion (though a "slow" feed in US3 and a depleting resource in US2 are both visible on the same fly, neither
  reads the other's state).
- **US3 (P2)**: No dependency on US1 or US2, for the same reason.

### Within Each User Story

- Tests (T003–T005, T011–T013, T020–T021) are written first and must fail before their implementation tasks.
- Validation (`validate.js`) before the runtime code that relies on the resolved config being well-formed.
- `food.js` model changes (US2's T014) before the motor-control call sites that use it (T016, T017).
- Automated test run before the manual quickstart check, in every story.

### Parallel Opportunities

- T001 (Setup) and T002 (Foundational) touch different files and can run in parallel.
- T003, T004, T005 (US1 tests) touch different files and can run in parallel.
- T011, T012, T013 (US2 tests) touch different files and can run in parallel.
- T020, T021 (US3 tests) touch different files and can run in parallel.
- Once Phase 2 is done, US1, US2, and US3 can be staffed and implemented in parallel by different people — they
  touch an overlapping set of files (`validate.js`, `forager-step.js`, `body-layer.js`) but different, named
  sections of each, per the Independent Test criteria above.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Validation test cases for flies.food.hungerSensitivity in tests/validate-flies.test.mjs"
Task: "Sensor-filter unit tests for senseForagerFly in tests/forager-step.test.mjs"
Task: "Sensor-filter unit tests for senseForagerFlyWide in tests/forager-step-wide.test.mjs"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002).
3. Complete Phase 3: User Story 1 (T003–T010).
4. Complete Phase 4: User Story 2 (T011–T019).
5. **STOP and VALIDATE**: both P1 stories now hold — hunger drives foraging, and feeding measurably depletes and
   recovers a resource. This is the spec's MVP; US3 is a P2 observability refinement on top of it.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → test independently → demo (hunger raises odor sensitivity).
3. Add User Story 2 → test independently → demo (MVP complete: both P1 stories).
4. Add User Story 3 → test independently → demo (feed motion becomes configurable).
5. Phase 6 Polish closes out the feature.

### Parallel Team Strategy

With multiple developers, once Phase 2 (T002) is done:
   - Developer A: User Story 1 (T003–T010)
   - Developer B: User Story 2 (T011–T019)
   - Developer C: User Story 3 (T020–T026)

Each story integrates independently; T015/T022 (both extending `validateFlyFood`) and T016/T017 (US2) vs. T023
(US3, a different branch of the same `stepBodyLayer` function) are the only same-file touch points — small,
named, non-overlapping edits per the task descriptions above.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to US1/US2/US3 for traceability.
- Every task names the exact function and, where useful, the line number it amends as of this plan's research.
- Verify each story's tests fail before implementing that story.
- No task in this file touches `public/js/brain/*.js`, `extract/`, or any `.brain` snapshot.
