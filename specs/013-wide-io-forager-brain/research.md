# Research: Wide-I/O Forager Brain (Brain v2)

Every design question below was either settled by ADR 007 directly (cited) or resolved by reading the exact code
this feature touches. None needed new investigation beyond that: ADR 007's Annex A already measured the dataset
populations and connectome routes that would otherwise be "unknowns" in a Technical Context sense.

## R1. Channel-declaration dispatch: a new version, gated by `kind`, not a global bump

**Decision**: Add `validateCapabilitiesV5`/`validate_capabilities_v5` (JS/Python) that applies only when the
container header's `kind` is `"forager-wide"`. `KIND_DRIVES` gains a `"forager-wide"` entry (the six drives).
`kind: "forager"` snapshots keep running through the existing `validateCapabilitiesV4`/`validate_capabilities_v4`
unchanged.

**Rationale**: ADR 007 W11 states this explicitly: "Kind `forager` keeps v4 rules, so an old world cannot load a
wide snapshot by mistake." Dispatching on `kind` (a value already in every v4 header) rather than bumping a global
channel-declaration version number means a `v1` world's `checkBrainVersion` call and a `forager`-kind snapshot are
untouched by this feature — no existing test or shipped file changes meaning.

**Alternatives considered**: Bumping the shared `validateCapabilitiesV4` in place to accept optional `sense`/`site`
fields and a variable drive set. Rejected: it would let a `forager`-kind snapshot silently accept the new fields,
and it would require `KIND_DRIVES` lookups to tolerate a drive count that depends on data rather than on `kind`,
weakening the exact-match check R7 already relies on for every existing brain.

## R2. Container header: new `kind` value, same binary container version

**Decision**: The snapshot stays container version 4 (`FORMAT_VERSION_V4`); only `header.kind` is new
(`"forager-wide"`). `container.py`'s `_check_forager` gets a sibling `_check_forager_wide`, dispatched by
`header.get("kind")`; `snapshot.js`'s `checkForager` gets the matching `checkForagerWide`.

**Rationale**: ADR 007 W11: "Snapshot container: Stays v4." The binary layout (magic, section table, CSR arrays) is
unchanged; only the header's declared shape differs per `kind`, exactly as `kind: "forager"` already differs from
the version-3 toy/baseline shape. This keeps `write_container`'s/`parseSnapshot`'s shared section-table code
untouched.

**Alternatives considered**: A new container version 5. Rejected: nothing about the binary layout changes, so a
version bump would only exist to signal a header-shape change already signalled by `kind` — the exact mechanism
the existing code uses to distinguish v3-toy from v4-forager headers without a version bump between them.

## R3. Brain version `"v2"`: a new world-facing value mapped to the existing `v1` runner

**Decision**: `fly-brain.js`'s dispatcher gains `if (version === 'v2') return createV1FlyBrain(...)`, reusing
`fly-brain-v1.js`/`lif-v1.js` with no change. `snapshot.js`'s `checkBrainVersion` is extended to also check the
snapshot's declared `kind` against the brain version's expected kind (`v0` → none checked, `v1` → `"forager"`,
`v2` → `"forager-wide"`), so a `v2` world given a `forager`-kind snapshot (or vice versa) fails loudly at load,
before any fly starts — not three sense-array-length errors later.

**Rationale**: ADR 007, "Decisions: LIF core and runner": "`fly-brain.js` maps `v2` to the v1 runner." The runner is
already generic over however many input/output channels the parsed snapshot declares (verified by reading
`fly-brain-v1.js`: it builds `outputNeurons`/`outputChannels`/`inputNeurons` from `capabilities.channels` with no
hard-coded count). No new runner file is needed. The extra kind check in `checkBrainVersion` is new: today it only
compares container *version* numbers, which would stay 4-vs-4 for a `v1`/`forager-wide` mismatch and so would not
catch it — the spec's edge case ("a version-v2 world names a snapshot that is not wide-I/O") needs this.

**Alternatives considered**: Leaving the kind check out of `checkBrainVersion` and relying on the worker protocol's
`sense.inputs.length` mismatch to catch a `v1`/`forager-wide` mismatch at the first tick. Rejected: it would still
work for *this* direction (4 ≠ 12), but a `v2` world given an old `forager`-kind 11K snapshot (12 ≠ 4, also caught)
is not the only case — a future snapshot could coincidentally declare the same channel count under the wrong kind,
and the failure should name the mismatch before any worker starts, as every other version mismatch already does.

## R4. Extraction: extend the existing `classSeed` strategy, not a new selection module

**Decision**: Format 5 (`"kind": "forager-wide"`, `"selection": "classSeed"`) is handled inside
`selection_class_seed.py`, extending `resolve_pools`, `_match_sides` and the fidelity probe in place. No new
`selection_*.py` module is added.

**Rationale**: ADR 007 D18: "ADR 006 D8–D12 unchanged; only the pools move." The whole-class-seed-plus-shared-weight
-fill algorithm is identical to the 11K brain's; only the input/output pool definitions and the probe's check list
differ, and both are already config-driven. This is the mirror image of the 11K feature's own plan decision (a new
module, because *its* selection philosophy was new relative to the flow-ranked one) — copying that pattern here
would duplicate `seed_bodies`/`fill_candidates`/the weight computation for a config-only difference, against
constitution VII and ADR 006 lesson 6 ("change one thing").

**Alternatives considered**: A new `selection_class_seed_wide.py` that imports and thinly wraps the existing module.
Rejected as needless indirection: every function it would wrap (`seed_bodies`, `fill_candidates`, the weighting) is
untouched by this feature; only `resolve_pools`'s side-matching grouping and the probe need a branch, and both
already take the parsed `config` as their first argument, so the branch belongs where the behaviour is, not behind
a new file boundary.

## R5. Side matching: group by declared `pair` (format 5) or by `class` (format 4), not a third scheme

**Decision**: `resolve_pools`/`_match_sides` in `selection_class_seed.py` groups input channels for side matching by
`config["inputs"][cid]["pair"]` when a format-5 config declares `pair` on its inputs, falling back to the existing
`CLASS_TO_PATHWAY` (`class` → `"odour"`/`"taste"`) grouping when it does not (format 4, unchanged). `config
["sideMatch"]` is then keyed by pair name in format 5, by pathway name in format 4.

**Rationale**: ADR 007 D15: "With two olfactory pairs [food odour and danger odour] [grouping by class] is
ambiguous, so `sideMatch` is keyed by `pair` in a format-5 config. Format-4 configs keep the class grouping." This
is stated as a deliberate, backward-compatible branch, not a replacement — the 11K config has no `pair` key and so
takes the old path untouched.

**Alternatives considered**: Requiring every config (format 4 and 5) to declare `pair` and dropping
`CLASS_TO_PATHWAY`. Rejected: it would touch the shipped, already-correct `forager-brain-11k.json` for no behaviour
change, against the "format 4 is unchanged" guarantee this plan's Constitution Check and spec FR-014 depend on.

## R6. New filter keys (`entryNerves`, `excludeReceptorTypes`) live in the shared `_matches_input`

**Decision**: `selection_forager._matches_input` (imported by both selection modules) gains two optional checks:
a body matches an `entryNerves` filter only if its `entryNerve` is in the list (when the key is present), and is
excluded by `excludeReceptorTypes` only if its `receptorType` is in that list (when present). Both default to "no
filter" when absent, matching every existing config exactly. `admission.py`'s `_pool_fields` and
`dataset.FORAGER_ANNOTATION_COLUMNS` gain `entryNerve` so the column reaches the body record at all (ADR 007 D15:
"the snapshot does not carry that column" today).

**Rationale**: ADR 007 D15 declares these as new, optional filter keys, "all optional, with their absence meaning
'no filter'" — explicitly designed to be additive to the one function every input filter already goes through.
`_matches_input` is shared by the flow-ranked and class-seeded strategies alike, so adding the checks there, rather
than duplicating the function, keeps both strategies able to use the new keys if a future config needs them.

**Alternatives considered**: A `classSeed`-only filter function. Rejected: the dataset columns and the filter
semantics are strategy-agnostic (any input pool might one day need `entryNerve`), and `_matches_input` already
takes the full body record and spec, so the two new checks are two more guard clauses, not a new code path.

## R7. Fidelity probe: a per-pair check list, reported over every individual channel

**Decision**: The probe computes the full report table over every individual declared channel (the twelve input
channel ids, not six merged pairs) against every declared output — a direct generalisation of the existing
per-pool propagation loop (`_propagate`) to iterate over `config["inputs"]` directly instead of the three
hard-coded probe pools (`odour-L`, `odour-R`, `taste`). Separately, `config["fidelity"]["checks"]` names which
*pairs* (not individual channels) must pass, as either a `contrast` check (the L/R split of one pair against
`turn-left`/`turn-right`, generalising today's steering check) or a `sign` check (one pair's merged L+R pool against
one named output, generalising today's feeding check).

**Rationale**: ADR 007 D19: "the probe runs every declared input pair against every output on the brain and on the
whole graph, and prints the 12 × 6 table," while D20's example config shows `checks` entries naming a `pair` (for
`contrast`) or a `from`/`to` pair-and-output pair (for `sign`) — not every possible combination is gated, only the
six listed, matching the seven-of-nine claims that "hold" in ADR 007's Context table. The full table is reporting;
the `checks` list is gating. This is the same two-tier shape (full report vs. two gated checks) the 11K brain's
probe already has, widened from a fixed pool/check list to a declared one.

**Alternatives considered**: Gating on every pair automatically (no declared `checks` list). Rejected explicitly by
ADR 007 D19: "Not gated, but reported: danger contrast ..., leg contrast ..., and every pair → escape," because two
of the nine original behavioural claims do not hold in the connectome (D16, D17) and gating on them would be
"gating on a probe artefact," which the ADR calls out by name as the wrong move.

## R8. Host sensing: a new, parallel module for declared sense/site, `v1`'s hard-coded path untouched

**Decision**: Add `public/js/fly/forager-step-wide.js` with `senseForagerFlyWide`/`forageEnvWide`, built the same
way as the existing `forager-step.js` pair but reading each input channel's declared `sense` and `site` (snapshot
side) against the world's `flies.stimuli` and `flies.body.sites` (world side) instead of calling `senseBilateral`
with a single hard-coded antenna offset and one hard-coded taste duplicate. `forager-step.js` itself —
`senseForagerFly`, and the `v1` parts of `applyForagerMotor`/`driveValues`/`initForagerFly` — is not edited beyond
the escape-drive generalisation in R9, which is a no-op for any brain whose declaration has no `escape` channel.

**Rationale**: ADR 007 W8: "The host must stop hard-coding 'inputs are odour L, odour R, taste, taste'
(`senseForagerFly`). Each input channel in a `forager-wide` snapshot declares a `sense` and a body `site`; the
world declares where each sense comes from." Reading `senseForagerFly` confirms the hard-coding is real and
contained to one function (`senseBilateral(env.flowers.points(), ...)` plus one duplicated taste read) — it is not
spread across the host. Keeping `v1`'s function untouched is required by spec FR-004/ADR 007's own "no edit to
`v1`'s path" framing, and by `tests/lif-golden.test.mjs`-style determinism expectations: the 11K and shipped v1
brains must produce the same sense values after this feature as before it, which a shared, branching function could
accidentally regress.

**Alternatives considered**: Generalising `senseForagerFly` in place to loop over declared channels for every
brain, including `v1`. Rejected: `v1`'s snapshot has no `sense`/`site` declaration (channel-declaration v4 has no
such fields, R1), so a single generalised function would need a fallback path for exactly the four-channel
hard-coded case anyway — at which point it is two functions wearing one name, with a higher risk of a 11K/v1
regression than two named functions.

## R9. Escape physics: one new, declaratively-gated step in `body.js`, read generically from `forager-step.js`

**Decision**: `body.js` gains a pure function (e.g. `applyEscape(body, drives, env)`) that moves the fly once along
its heading when `env.escape?.enabled`, `drives.escape` exceeds `env.escape.threshold`, and the fly's cooldown has
elapsed; otherwise it is a no-op. `forager-step.js`'s shared `applyForagerMotor`/`initForagerFly` call it
unconditionally with `env.escape` defaulting to `undefined` (so every existing `v1`/11K call site, which passes no
`escape` key, is unaffected) and read `drives.escape` only if the declaration has it (`drives.escape ?? 0`, as the
existing code already does for every optional drive).

**Rationale**: ADR 007 W10: "When `body.escape.enabled` is true, ... the body moves ... in one tick. ... The default
is `enabled: false`. With it off, the `escape` drive is computed, shown and logged, and moves nothing." Putting the
gate in `body.js` (next to `stepForagerBody`) rather than in `forager-step-wide.js` lets both `v1`-shaped and
`v2`-shaped callers share one escape step later if a future brain adds escape without the full wide interface,
without needing a second copy of the cooldown bookkeeping.

**Alternatives considered**: Implementing escape only inside `forager-step-wide.js`, specific to the wide brain.
Rejected: the physics (threshold, distance, cooldown, one jump per cooldown) has nothing to do with the sensing
side this feature is otherwise splitting out (R8); keeping it in `body.js` next to `stepForagerBody` matches where
every other drive-to-motion rule already lives.

## R10. Side panel: no new code — the existing generic sections already cover an arbitrary channel count

**Decision**: No new panel section module is written. `inputs.js`/`outputs.js` (`requires: { channels: 'inputs' |
'outputs' }`) and `channels.js`'s `mountChannelRows`/`updateChannelRows` already render one row per entry of
`model.inputs`/`model.outputs`, each built in `model.js` from `record.capabilities.channels.inputs/outputs` with no
assumption about length; `channel-rows.js`'s bar math is per-row, not per-brain. A new contract test
(`panel-wide-channels.test.mjs`) asserts twelve input rows and six output rows render correctly, including the
`escape` row showing its live value while `flies.body.escape.enabled` is `false`, purely to document that this is
covered by existing code, not to add behaviour.

**Rationale**: Reading `model.js`, `inputs.js`, `outputs.js` and `channel-rows.js` shows every value that would
need to vary with channel count (row count, label, side, range-based bar width) is already read from the
declaration at render time; nothing is hard-coded to four inputs or five outputs. Spec FR-021/FR-022/FR-023 and
SC-006/SC-007 are therefore satisfied by the existing architecture once the snapshot's v5 declaration carries
correct `label`/`side`/`range` per channel — which is an extraction-config concern (R1), not a panel one.

**Alternatives considered**: A dedicated "wide channels" section, parallel to `provenance.js` (the 11K feature's
own new section, needed because that feature added genuinely new *kinds* of data — provenance, fidelity, origin —
the panel had never shown). Rejected: this feature adds more *channels*, a shape the panel already handles
generically; there is no new kind of information to render, so a new section would be an unused abstraction against
constitution VII.

## R11. Calibration: out of band, via the existing `/microfly-calibrate` skill

**Decision**: This feature adds the profile skeleton (`.claude/skills/microfly-calibrate/scripts/profiles/
wide-io.mjs`, following `class-seed-11k.mjs`'s shape) wired to the engine, but does not tune or ship final LIF/gain
values as part of `/speckit-implement`. ADR 007's "Calibration protocol" (starting from the 11K world's calibrated
block, A1 probing the new pools, A2 fitting `outputScale.escape`) runs afterward, in its own `/microfly-calibrate`
session, exactly as the 11K brain's calibration did.

**Rationale**: The project's own skill (`microfly-calibrate`) "always asks the brain version and a time/compute
budget before running anything, and never promotes a result into the shipped world config or calibration.md
without the user reviewing it first" — calibration is explicitly a separate, reviewed step, not an implementation
task. The 11K feature's own plan treated calibration the same way (port the engine, add one profile, tune later).

**Alternatives considered**: Running calibration inline as part of this feature's tasks. Rejected: it would bypass
the skill's own review gate and this project's standing rule (AGENTS.md: "Behaviour failures are findings," judged
on a run the user reviews) — and Gate C's held-out verdict (spec User Story 6) depends on calibration values this
plan has no basis to choose ahead of a real run.
