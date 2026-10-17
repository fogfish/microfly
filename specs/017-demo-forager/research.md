# Phase 0 Research: Demo Forager

Every item below was a genuine design choice not pinned down word-for-word by [ADR 010](../../adrs/010-demo-forager.md)
or [spec.md](spec.md). Each is resolved against the current codebase (verified by reading the named files directly,
not guessed), so Phase 1 can proceed with no `NEEDS CLARIFICATION` markers.

## 1. Does the worker protocol need a version change?

**Decision**: No. `flies.brain.version: "v3"` keeps using `protocol-v3.js` unchanged.

**Rationale**: `public/js/brain/protocol-v3.js:19-21` already sends `spikes` (a `Uint32Array` of ascending fired
neuron indices) on every `motor` message, validated and transferred. ADR 010 D27/D28's claim ("protocol v3 already
carries spikes… no protocol change") is confirmed against the real code, not assumed.

**Alternatives considered**: A new protocol v4 carrying pre-aggregated per-pool rates instead of raw spikes —
rejected: it would move decoding (which pools, what rates) into the worker, violating Principle II ("the main
thread MUST NOT run neural computation" cuts both ways — the worker must not pre-digest the main thread's job
either) and ADR 010's explicit "decoder runs on the main thread… that is motor decoding, not neural computation."

## 2. Where does the decoder run and read its pools from?

**Decision**: A new main-thread module, `public/js/fly/decoder.js`, loaded once per fly from the `decoder-v1` JSON
file named by `flies.brain.decoder` in world config. It is called from `fly-host.js`'s existing `case 'motor':`
branch (`public/js/fly/fly-host.js:210+`), which already receives `msg.spikes` and `msg.outputs` on the main thread —
this is the one place in the current code that already sees spikes outside the worker.

**Rationale**: `fly-host.js` is the only existing main-thread consumer of raw spikes (today only to feed
`r.activity?.recordTick(msg.spikes, …)` for the brain-activity view). Routing decoded signals through the same
message handler keeps Principle II's worker/main-thread boundary exactly where it already is, and needs no new
worker message.

**Alternatives considered**: Decoding inside `forager-step-wide.js` — rejected: that module's `stepForagerFlyWide`
runs synchronously against a `brain.step()` call used by the calibration CLI and `compare-baseline.mjs`, not by the
live worker-per-fly runtime; wiring the decoder there would miss the real worker path and only exercise the
calibration-time shortcut.

## 3. Where does the `decoder-v1` sidecar file live and how is it loaded?

**Decision**: `public/brains/<snapshot-name>.decoder.json`, next to the `.brain` file it names, loaded by a small
reader in `public/js/fly/decoder.js` (not `snapshot.js`, which stays pure per its own header comment: "no DOM, no
fetch"). The world config's new `flies.brain.decoder` key is a path, resolved by the same loader that already
resolves `flies.brain.snapshot` (`public/js/config/load-world.js` / `fly-config.js`).

**Rationale**: `public/brains/brains.json` is the closest existing precedent for a JSON file living alongside
`.brain` files, but it is a single shared manifest read by the brain-picker UI, not a per-snapshot sidecar read by
the simulation. No existing pattern needs to be disturbed; this is a new, additive file kind.

## 4. How does C1–C3 calibration fit into the existing `calibrate.mjs` CLI?

**Decision**: Add a new stage value, `--stage=all` (plus the individual `--stage=c1|c2|c3` for iterating on one
stage), to the existing dispatcher in `.claude/skills/microfly-calibrate/scripts/calibrate.mjs` (today:
`regime|classify|auto|world`). The three stages' measurement logic lives in a **new** module,
`scripts/decoder-engine.mjs`, alongside the existing `engine.mjs` — not inside it.

**Rationale**: `engine.mjs`'s existing exports (`probe`, `regime`, `readout`, `runRegimeGrid`, `robustCandidates`,
`runWorldStage`) are built entirely around the A1/A2/B grid-search-and-fit protocol ADR 010 explicitly retires for
`v3` ("the ADR 005–008 grid work is retired for v3"). C2 needs a primitive none of those provide — per-neuron
spike-rate measurement across left-only/right-only/bilateral conditions, to compute each candidate neuron's
selectivity `s = (rL − rR)/(rL + rR)` — not a per-region activity fraction. Forcing that into `engine.mjs` would mix
two different calibration eras in one file; a sibling module keeps each readable and keeps `v1`/`v2`'s existing
calibration path (and its tests) untouched, honouring AGENTS.md's "old brains keep working."

**Alternatives considered**: A wholly separate CLI script outside `calibrate.mjs` — rejected: ADR 010 Part H names
the one command as `calibrate.mjs --version=demo-v3 --stage=all` explicitly (R4's own acceptance test quotes this
literal invocation), so the entry point must be the existing CLI, not a new binary.

## 5. What is the "second map" for R5?

**Decision**: Build the R5 second map on the project's **older tile-section generator**
(`public/js/world/{ground,water,shore,scatter,layout}.js`, the "format 005 contract" the current `public/world/
README.md` still references as the alternative to `map`), not a second sketch-map `map` block.

**Rationale**: Every currently-shipped, loadable world (`world.json`, `world-forager.json`, `world-forager-11k.json`,
`world-forager-wide.json`, `world-connectome.json`, `world-antennal-lobe.json`) was confirmed by direct inspection
to carry the **same** `map` block (format `arcade-world` v3, the Lake Joy / Lake Byte sketch map, spec 014) — "every
64 × 40 world carries the same `map`; only `edibles` and `flies` differ by brain" (`public/world/README.md`). There
is currently no second *real* map to compare against; only two deliberately-broken fixtures
(`world-forager-bad.json`, `world-forager-11k-bad.json`) use the tile-section shape, and only to exercise version-
mismatch error paths. The tile-section generator modules are still present and tested
(`ground.test.js`, `water.test.js`, `shore.test.js`, `scatter.test.js`, `layout.test.js` under `public/tests/`), so
composing one real tile-section world is a config-only task (W15: "a new map needs no recalibration" — it also
needs no new generator code), not a new rendering feature.

**Alternatives considered**: Hand-editing a second sketch-map `map` block with a different layout — rejected as
higher-risk for this feature's purpose: R5 exists to show the decoder/body layer are map-agnostic, which is better
demonstrated by two **structurally different** map systems (sketch vs. tile-section) than by two hand-drawn
variants of the same system, and the tile-section path is already built and tested.

## 6. Does `flies.modulators.hunger.threshold` require a capabilities/container schema change?

**Decision**: No schema change. The threshold is purely a **world-config** override, read and applied at runtime in
`public/js/brain/fly-brain-v1.js` (the shared `v1`/`v2`/`v3` modulator-gain computation), without touching
`checkModulators` in `snapshot.js` or the `channel-declaration-v5.md` contract.

**Rationale**: Direct inspection of `fly-brain-v1.js:42-62` shows the gain today is
`gain *= g0 + (g1 - g0) * modulatorValue(mod, hunger)`, where `modulatorValue` is linear in hunger (`m = h` for a
range modulator). D32's ramp is `m' = h < threshold ? 0 : (h − threshold)/(1 − threshold)` substituted for `m` — a
local change to one function, parameterised by a threshold value the runtime already has in hand from world config.
`checkModulators` (`snapshot.js:131-155`) has no `threshold` field today and ADR 010 D26 states no extraction change
is needed for this feature; adding a container-schema field would contradict that and would require a new container
or capabilities version per AGENTS.md's contract rule ("bump its version when the change is incompatible") for a
change that does not need to be incompatible. ADR 010 Part J's shorthand ("Capabilities v5 + optional modulator
threshold, Additive") is reconciled here as: the field is additive **if** ever written into a snapshot, but this
feature does not write it — it is supplied purely from world config, exactly as D32's own "Where it is set" sentence
states.

**Alternatives considered**: Writing `threshold` into the snapshot's modulator declaration and bumping
`extract/malecns_brain` accordingly — rejected: contradicts D26 ("no extraction change in this ADR") for no benefit,
since the per-world override already satisfies every requirement (R1, R5) and keeps `forager-brain-wide.brain`
byte-identical to what ADR 009 already shipped.

## 7. Where does the body layer (W12–W14) replace the current motor math, without breaking `v0`/`v1`/`v2`?

**Decision**: A new module, `public/js/fly/body-layer.js`, used only when `flies.brain.version === "v3"`. The
existing `stepForagerBody`/`applyEscape` (`public/js/fly/body.js:42-58, 84-102`) and
`applyForagerMotor`/`driveValues` (`public/js/fly/forager-step.js:35-64`) are left untouched for `v0`/`v1`/`v2`.

**Rationale**: Direct inspection confirms today's forager body is a single linear combination
(`v = maxSpeed × (forward − backward)`, `ω = turnRate × sign × (turnLeft − turnRight)`) with no rhythm, no
steering law and no backing-up — W12 (rhythm), W13 (tropotaxis+klinotaxis) and W14's backup half are all genuinely
new mechanics, not extensions of the existing formula; only W14's escape jump already exists
(`applyEscape`, `body.js:42-58`) and is reused as-is. AGENTS.md's "old brains keep working" and the spec's own scope
(Story 1–7 all describe `v3`-only behaviour) both point to a new, additive code path keyed on the brain version,
exactly as `v1`→`v2` was added alongside `v0`/`v1` rather than rewriting them.

## 8. Which existing null-arm generator serves as RG (the matched random graph) for Part K?

**Decision**: Reuse `scripts/forager-arms.mjs`'s `rewire(snapshot, seed)` (degree-preserving rewrite of the actual
wide-brain connectome, lines 36-48), already wired through its `wideStyleArms` dispatch as the pattern
`"random-matched-wide"`. The same decoder derivation (C2) and the same new body layer run against this rewired
snapshot, per Principle III's new bullet ("the same rule MUST be applied to every null-arm brain").

**Rationale**: `forager-arms.mjs` already implements exactly the RG arm ADR 010 Part K (K9) wants, under this name,
for the wide brain specifically (as opposed to `snapshot.js`'s `matchedRandomBrain`, which is a smaller
degree/size-matched *toy* brain used for the `mock`/`v0`-style arms in `compare-baseline.mjs`, not the connectome).
No new null-brain generator is needed.

**Alternatives considered**: None — this is a straight reuse, confirmed to already exist and already be the
degree-preserving kind ADR 010 Part K and the spec's Edge Cases describe.
