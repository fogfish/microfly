# Phase 0 Research: Hunger-Sensitive Feeding and Food Depletion

No NEEDS CLARIFICATION markers were left in the Technical Context — this is a small, additive change inside a
well-understood part of the existing codebase. This document instead records the design decisions needed to honor
the user's explicit constraint ("implement as parameters of the world simulation, sensor filters and motor
control; do not change the brain or the LIF parameters") without colliding with mechanisms that already exist
nearby and look superficially similar.

## D1: Where the hunger→sensitivity link lives

**Decision**: Add a *new*, world-config-declared multiplier applied inside `senseForagerFly`
(`public/js/fly/forager-step.js`) and `senseForagerFlyWide` (`public/js/fly/forager-step-wide.js`) — the two
functions that build the `inputs` Float32Array *before* it is handed to `brain.step({ inputs, hunger })`. The
multiplier scales the food-odor-related sensed values (the bilateral odor inputs, and optionally taste) when the
fly's hunger (`hungerOf(fly.energy)`, already computed in both functions) is at or above a declared threshold.

**Rationale**: Both functions already run entirely on the main thread, already compute `hunger` locally, and
already own the exact value that becomes the brain's sensory input — scaling it there is the one place that
touches neither the worker boundary nor any file under `public/js/brain/`. It is also the literal reading of
"sensor filter": a filter applied to what a sensor reports, before the signal reaches the nervous system, exactly
like a real olfactory receptor's own sensitization.

**Alternatives considered**:
- *Extend the existing `flies.modulators.hunger.threshold` (D32, ADR 010) gain ramp inside `fly-brain-v1.js`.*
  Rejected: that mechanism lives inside the brain's `channelGains` function and directly shapes what reaches the
  LIF network's synapses — exactly the file the user asked not to touch. Reusing its *name* would also wrongly
  imply the two are the same mechanism; they are not (D32 is a brain-internal gain ramp over all gain-bearing
  channels; this feature is a world-side pre-brain filter over food-odor channels only). The spec's Assumptions
  section already reads "hunger" as the existing low-energy state, which this decision honors without touching
  D32 at all.
- *Scale the odor at its source in `food-field.js`/`stimulus.js` regardless of which fly is sensing it.* Rejected:
  odor strength at a point in space must stay fly-independent (two flies standing in the same place must sense
  the same physical concentration); hunger is a per-fly property, so the filter must apply per-fly, at the point
  each fly's own sensed value is computed, not at the shared field.
- *Pass hunger into the worker as an extra gain and let the brain apply it.* Rejected for the same reason as the
  first alternative — it is still a brain-side change.

**Config key**: `flies.food.hungerSensitivity: { threshold, gain }` (new; distinct from `flies.modulators.hunger`).
`threshold` is a hunger value in `[0, 1)` (same convention as `flies.modulators.hunger.threshold`); `gain` is the
multiplier (≥ 1) applied to the odor inputs once hunger reaches it. Absent → no multiplier, i.e. today's behavior
for every existing world, byte-for-byte.

## D2: Where the pause-vs-slow feeding motion lives

**Decision**: A new `flies.food.feedMotion` key (`"pause"` default, or `"slow"` with `feedSlowSpeed`) read by the
two places that already move the body while a fly eats: `stepBodyLayer`'s eating branch (`body-layer.js`, v3 —
today always sets `target = { heading, speed: 0 }`) and `applyForagerMotor` (`forager-step.js`, v1/v2 — today
does not override speed at all while eating, relying on `canEat`'s pre-condition that the fly is already slower
than `eatSpeed`).

**Rationale**: Both are motor-control code (they call `stepForagerBody`/`motorStep`, i.e. the functions that turn
a target heading/speed into a new body position), already gated on the brain-decided `eating` flag, never
deciding *whether* to feed — only *how the body carries itself* while the brain has already decided to feed.
Declaring the choice in `flies.food` keeps it next to the other feeding parameters and out of `public/js/brain/`.

**Alternatives considered**:
- *A single project-wide constant.* Rejected: AGENTS.md hard rule 6 requires motor mappings to be declared in
  data, not hidden in code, and different worlds/brain generations plausibly want different feel.
- *Derive the choice from food size (e.g., small = pause, large = slow).* Rejected: the spec's Assumptions
  section already settles this as a world-level configuration choice, not a size-derived one — nothing in the
  user's request ties movement style to resource size.

## D3: Where the per-size feeding capacity and recovery timer live

**Decision**: Extend `createFood` (`public/js/fly/food.js`) with an optional capacity model, selected when a world
sets `flies.food.capacity` (e.g. `{ small: 1, medium: 2, large: 3 }`) and/or `flies.food.recovery` (seconds,
default 30 when `capacity` is set). Each stimulus cell already carries its `kind` (`fly-world.js`'s
`stimulusCells`, already `"small"`/`"medium"`/`"large"` per `flies.stimulus.objects`/edible declarations) — the
capacity model looks up a cell's remaining feeding units by that existing `kind`, instead of (or alongside) the
existing single float `stock`. `fraction()` becomes `remainingUnits / capacityForKind` for cells in the new model,
so every existing consumer of `fraction()` (odor strength in `food-field.js`, taste in `senseForagerFly*`) keeps
working unchanged — they already only ever read a `[0, 1]` fraction, never the raw stock number.

**Rationale**: `food.js` is already the single owner of flower/resource runtime state (AGENTS.md: pure, no DOM).
Adding the capacity/recovery model here, rather than in `fly-world.js` (static world geometry) or `fly-host.js`
(worker orchestration), keeps resource state in the one module everything else already reads through
(`stockAt`, `fraction`, `consume`, `regrow`, `points`). A world that does not set the new keys gets `createFood`'s
existing continuous behavior untouched.

**Alternatives considered**:
- *Replace `stock`/`regrowth`/`consumeRate` outright with the capacity model.* Rejected: breaks every shipped
  world and the forager calibration contract (`world-config-forager.md`'s `flies.food` table) without a version
  bump, and AGENTS.md requires keeping old readers working. Making the model opt-in avoids a contract version
  bump entirely — the old keys keep their old meaning when the new keys are absent.
- *Model capacity as a literal queue of "bites" consumed per tick while eating (continuous drain, just
  quantized).* Rejected by the spec itself: a "completed feeding" is the unit (Assumptions section), not a
  tick-rate drain (superseded: see D4 amendment).

**Config keys**: `flies.food.capacity: { small, medium, large }` (positive integers; default when present but a
kind is omitted is an error — see data-model.md), `flies.food.recovery` (seconds ≥ 0, default 30).

## D4: How eating depletes a capacity-model flower (amended)

**Decision (amended after the first implementation)**: a capacity-model flower drains continuously while it is being
eaten, by the same `consumeRate × dt` per eating tick as the legacy model. It does not regrow while partly eaten. At 0
it stays empty for `flies.food.recovery` seconds, then returns to full. The bout-close charge described in the first
version of this decision was removed: the odour must dim while the fly feeds, not after it.

**Rationale**: the user's requirement is that food stays dimmed until it is consumed to 0, and then recovers after the
recovery time. Only the regrowth rule and the recovery countdown differ from the legacy model, so the call sites
(`forager-step.js`, `body-layer.js`) are unchanged.

## D5: Backward compatibility and contract versioning

**Decision**: No version bump to `world-config-forager.md` or `world-config-v3.md`. All five new keys
(`hungerSensitivity`, `feedMotion`, `feedSlowSpeed`, `capacity`, `recovery`) are optional additions under
`flies.food`, each independently off/no-op when absent, following the exact pattern `flies.modulators.hunger`,
`flies.body.motor`, and `flies.body.crossWater` already use in `fly-config.js`. A new contract document
(`contracts/world-config-food-feeding.md`) is added rather than rewriting the existing table, and is linked from
it as an amendment, mirroring how `world-config-wide-io.md` and `world-config-v3.md` amend
`world-config-forager.md` today.

**Rationale**: AGENTS.md: "Old brains keep working... mock, v0 and v1 brains and their worlds must all still
load," and the contract rule that an incompatible change needs a version bump and a kept old reader. Since
nothing existing changes meaning, there is nothing to bump.
