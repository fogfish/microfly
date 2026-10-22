---

description: "Task list for Social and Pheromone Senses"
---

# Tasks: Social and Pheromone Senses

**Input**: Design documents from `/specs/020-social-pheromone-senses/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. AGENTS.md "Contracts" requires contract tests on both sides of every changed contract
(extract config, channel declaration v6, world config, decoder). The plan lists the tests, and SC-003 needs a two-fly
test.

**Organization**: Tasks are grouped by the spec's user stories. The plan's gates apply:
- **Gate C:** no task in Phase 5 (US3, world) or later may merge until T030 records the ADR 012 valence table.
- **Calibration seeds** (`experiment.seeds`) are used for every probe and tuning task. Held-out seeds
  (`experiment.heldOut`) are used only by the verdict tasks T061 and T066.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 from spec.md
- Every task names its file path or paths

---

## Phase 1: Setup (Governance)

**Purpose**: Open the decision record that every later phase writes into.

- [X] T001 Create `adrs/012-social-pheromone-senses.md`. Set status "Proposed", date 2026-10-21, branch
  `020-social-pheromone-senses`. Reference ADR 007 D16, ADR 009 D24, ADR 010 D27/D33 and ADR 011. Continue decision
  numbering after ADR 011's last D-number. Write the Context section:
  - D16 excluded the 136 front-leg ppk23/ppk25 GRNs, and this ADR gives them their own sense rather than reversing D16;
  - only the male CNS exists, so females are male brains with a tag.

  Add empty placeholder sections, each filled by its own task:
  - "Neuron selection and seeds" (T016);
  - "Fidelity" (T020);
  - "Claims and valence" (T030);
  - "Calibration" (T055);
  - "Results" (T062).

  Add the literature list from research.md R17.
- [X] T002 [P] Add the type-name mapping to ADR 012 "Neuron selection and seeds", copied from research.md §0.2:
  - P1 → `pC1_*`, with no `P1` type or synonym in v1.0;
  - vAB3 → `AN09B017e/f/g`, through the synonym "Yu 2010: vAB3";
  - mAL → the prefixes `mAL4`, `mAL5`, `mAL6`, `mAL_`, excluding the non-dimorphic `mALB*` and `mALD*`;
  - vPR6 and dPR1 exist but are not seeded, because they are VNC neurons downstream of the pIP10 sink.

**Checkpoint**: ADR 012 exists, and every later result has a section to land in.

---

## Phase 2: Foundational (Extractor and Reader Capabilities)

**Purpose**: The config keys and the channel declaration v6 that the new brain needs. **Blocks every user story.**
Contracts: [extract-config-social.md](contracts/extract-config-social.md) and
[channel-declaration-v6.md](contracts/channel-declaration-v6.md).

### Tests (write first and see them fail)

- [X] T003 [P] Add seed-filter cases to `extract/tests/test_config_forager_wide.py`:
  - `{ "types": [...] }` and `{ "typePrefixes": [...] }` are valid;
  - a filter with two of `class` / `superclass` / `types` / `typePrefixes` fails with "seeds[i] needs exactly one of
    class, superclass, types or typePrefixes";
  - an empty list or a non-string entry fails;
  - an unknown key in a type filter fails.
- [X] T004 [P] Add input-filter cases to `extract/tests/test_config_forager_wide.py`:
  - `receptorTypes` must be a non-empty list of strings;
  - declaring both `receptorTypes` and `excludeReceptorTypes` on one input raises `E-CONFIG`;
  - an output with `drive: "song"` is valid once and fails when declared twice.
- [X] T005 [P] Add selection cases to `extract/tests/test_selection_class_seed_wide.py`, using the forager-wide
  fixture from `extract/tests/make_forager_wide_fixture.py`, extended with typed bodies and receptor types:
  - a `types` seed adds the matching bodies with origin `seed:type`, and a body already tagged by a class seed keeps
    `seed:<class>`;
  - a `types` entry that matches nothing raises `E-SEED-EMPTY` naming the type;
  - a `typePrefixes` filter that matches nothing raises `E-SEED-EMPTY`;
  - `receptorTypes` keeps only the listed receptor types;
  - two pairs that share a `bodyId` after resolution raise `E-POOL-OVERLAP` naming both pairs and the smallest shared
    id;
  - `taste-leg` (`excludeReceptorTypes`) next to `contact-pheromone` (`receptorTypes`) with the same subclass passes.
- [X] T006 [P] Add v6 cases to `extract/tests/test_capabilities_v5.py`, or a new `extract/tests/test_capabilities_v6.py`:
  - a config with a `song` output writes header `capabilities.declaration: 6` with `song` among the drives;
  - a config without one writes no `declaration` field, so the v5 bytes are unchanged.
- [X] T007 [P] Create `tests/capabilities-v6.test.mjs`:
  - a v6 declaration with one `song` drive passes `validateCapabilitiesV6`;
  - two `song` drives fail;
  - `song` without `declaration: 6` fails v5;
  - an unknown `declaration` value is rejected with "unsupported channel declaration <v>";
  - every shipped `public/brains/*.brain` of kind `forager-wide` still validates.

### Implementation

- [X] T008 In `extract/malecns_brain/config.py`:
  - extend `_check_seed_filters` so a filter holds exactly one of `class`, `superclass`, `types` or `typePrefixes`
    (non-empty string lists), with `partnersOf` unchanged;
  - add `receptorTypes` to `WIDE_INPUT_KEYS`, and reject it next to `excludeReceptorTypes`;
  - allow output `drive: "song"` at most once;
  - make `_check_pool_overlap` skip a pair of pairs when either declares a receptor filter (research R3).
- [X] T009 In `extract/malecns_brain/selection_class_seed.py`:
  - resolve `types` and `typePrefixes` seeds over admitted bodies, with origin `seed:type` unless a class or
    superclass seed already tagged the body;
  - raise `E-SEED-EMPTY` per unmatched filter and per unmatched `types` entry;
  - apply the `receptorTypes` include filter in input-pool resolution;
  - after every input pool is resolved, raise `E-POOL-OVERLAP` if any `bodyId` is in two pools, naming the pairs and
    the smallest shared id.

  Sort with explicit keys and break ties on `bodyId` (AGENTS.md Code style).
- [X] T010 In `extract/malecns_brain/capabilities.py`:
  - add `FORAGER_WIDE_OPTIONAL_DRIVES = ("song",)`;
  - add a v6 validator, which is v5's R10 plus at most one `song`;
  - write `capabilities.declaration = 6` only when the config declares a `song` output.

  Register `E-SEED-EMPTY` in `extract/malecns_brain/errors.py` if it is missing there.
- [X] T011 In `public/js/brain/capabilities.js`, add `validateCapabilitiesV6`: v5's rules, R10 with an optional single
  `song`. In `public/js/brain/snapshot.js`, dispatch `forager-wide` snapshots on `manifest.capabilities.declaration`:
  - absent goes to v5;
  - `6` goes to v6;
  - anything else is rejected.

  Keep the v5 path byte-for-byte as it is.
- [X] T012 Re-extract `extract/configs/forager-brain-mb.json` to a temp path and check that its sha256 equals the
  shipped `public/brains/forager-brain-mb.brain`, apart from `provenance.createdAt`. Record the check in
  `specs/020-social-pheromone-senses/extraction-report.md`.

**Checkpoint**: The extractor accepts the social keys, the old configs extract unchanged, and both sides read v6.

---

## Phase 3: User Story 1 - The Brain Gets Two Social Senses From Its Own Pheromone Neurons (Priority: P1) 🎯 MVP

**Goal**: A reproducible `forager-brain-social` snapshot with the `odour-conspecific` and `contact-pheromone` pairs,
the social pathway seeds and a `song` output. Leg taste is identical to the MB brain's.

**Independent Test**: Extract twice and compare the bytes. List the channels and their counts. Diff the `taste-leg`
`bodyId` sets against `forager-brain-mb.brain` (quickstart A).

- [X] T013 [US1] Create `extract/configs/forager-brain-social.json` as a copy of `forager-brain-mb.json`, then:
  - add the seed filters `{ "typePrefixes": ["pC1_", "mAL4", "mAL5", "mAL6", "mAL_"] }` and
    `{ "types": ["AN09B017e", "AN09B017f", "AN09B017g", "pIP10"] }` before `partnersOf`;
  - add inputs `odour-conspecific-left/right`: pair `odour-conspecific`, class `olfactory`,
    `types ["ORN_DA1", "ORN_VA1v", "ORN_VA1d"]`, `rootSide` L/R;
  - add inputs `contact-pheromone-left/right`: pair `contact-pheromone`, class `gustatory`,
    `subclasses ["leg bristle"]`, `entryNerves ["ProLN"]`, `receptorTypes ["putative_ppk23", "putative_ppk25"]`,
    `rootSide` L/R;
  - set `sideMatch` true for both pairs;
  - add output `"song": { "types": ["pIP10"], "drive": "song" }`;
  - add capability channels with sense `odour:conspecific` on site `antenna`, and sense `contact:pheromone` on site
    `front-leg`, both with range [0, 1], plus the output channel `song`;
  - add `fidelity.checks` `{ "kind": "contrast", "pair": "odour-conspecific", "minFraction": 0.1 }` and the same for
    `contact-pheromone`.

  Leave `taste-leg` and the hunger modulators unchanged (FR-004, FR-018).
- [X] T014 [US1] Set `fill.neuronCount` in `extract/configs/forager-brain-social.json` (research R5):
  - run the extractor once with a provisional value, and read the seed and pool total from its report;
  - set `fill.neuronCount` to that total plus the MB brain's fill size, so the fill stays the same size;
  - set `neuronCountRange` to bracket the result, starting from [14700, 15800].
- [X] T015 [US1] Extract `public/brains/forager-brain-social.brain` (quickstart A), and extract a second copy to a
  temp path. Check the bytes are identical apart from `provenance.createdAt`, and record the hash.
- [X] T016 [US1] Write `specs/020-social-pheromone-senses/extraction-report.md`, and copy its summary into ADR 012
  "Neuron selection and seeds". Include:
  - per pool and side, the neuron count and the unknown-side drops (expected: contact 69 L / 67 R, conspecific 89 L /
    254 R);
  - per seed filter and type, the bodies added;
  - the share of the MB brain's 14,500 `bodyId`s the new cut keeps;
  - the `taste-leg` `bodyId` set diff against `forager-brain-mb.brain`, which must be empty (SC-001);
  - a statement that no ppk23/ppk25 body is in `taste-leg`, and no other receptor type is in `contact-pheromone`.
- [X] T017 [P] [US1] Add a `public/brains/brains.json` entry for `forager-brain-social.brain`, with label and
  description, so the brain inspector lists it. The seed groups show as `seed:type`.
- [X] T018 [P] [US1] Create `tests/snapshot-social.test.mjs`, a contract test on the JS side. Parse
  `public/brains/forager-brain-social.brain` and check:
  - `declaration` 6;
  - the four social channels with their senses and sites;
  - a `song` output;
  - the disjoint input pools;
  - the `taste-leg` membership identical to `forager-brain-mb.brain`.

**Checkpoint**: The social snapshot exists, is reproducible, and leaves leg taste as it was.

---

## Phase 4: User Story 2 - A Probe Shows What the Social Senses Do in the Brain (Priority: P1)

**Goal**: The fidelity numbers, the linear claim table and the D27 C2 decoder for the social brain, with each social
pair's valence decided by the data and recorded in ADR 012 (SC-002).

**Independent Test**: `fidelity.md`, `claims.md` and `forager-brain-social.decoder.json` exist. ADR 012 holds the
valence table with its sources. The random-graph numbers are reported next to the brain's.

- [X] T019 [US2] Run `scripts/connectivity-audit.py` (quickstart B) on the social config and snapshot, with
  `--sections coverage,paths,bridges,readout`. Run it again with `ORN_VL2a` added to a temporary copy of the config
  (the R2 variant; do not ship that copy). Save the raw output to
  `specs/020-social-pheromone-senses/fidelity-audit.txt`.
- [X] T020 [US2] Write `specs/020-social-pheromone-senses/fidelity.md`, and its summary to ADR 012 "Fidelity". From the
  snapshot header `fidelity` block and T019, record:
  - the conspecific and contact L/R turn contrast, as brain, whole graph and fraction, plus the VL2a variant;
  - every pre-existing check (food A/B, heat, touch, mouth and leg signs), with its MB-brain value and its new value;
  - the coverage of the `song` pool's input;
  - the top missing bridges for each social pair.

  A fraction under 0.1 is recorded as a finding. No bridge is added.
- [X] T021 [US2] Write `specs/020-social-pheromone-senses/claims.md`, a claim table in ADR 007 style. For
  `odour-conspecific` and `contact-pheromone`, read from the fidelity table (`table` in the snapshot header):
  - the turn-contrast sign (toward or away);
  - the forward, backward, feed, escape and song signs, as brain and whole-graph values.

  Each row reads "holds", "does not hold" or "mixed" for the approach reading and for the avoid reading.
- [X] T022 [P] [US2] Create `.claude/skills/microfly-calibrate/scripts/profiles/social-v3.mjs` from `forager-mb.mjs` and
  `demo-v3.mjs`:
  - snapshot `brains/forager-brain-social.brain`;
  - the MB world's shipped `brain.lif` block as the starting point;
  - the C2 condition set: rest, then left-only, right-only and bilateral for every input pair, including both social
    pairs;
  - candidates `non-input`;
  - the named pools `feed`, `forward`, `backward`, `escape`, `song`;
  - valence for the social pairs read from `claims.md` by the R7 rule, written with
    `valenceSource: { "<pair>": "claims.md#<row>" }`. Pre-existing pairs keep their MB-decoder valence.
- [X] T023 [US2] In `.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs`, emit the named `song` pool when the
  snapshot declares a `song` output, with its rest in `homeostasis` (D33). The D27 gates stay unchanged (decoder
  contract).
- [X] T024 [P] [US2] Extend `tests/decoder-engine.test.mjs`:
  - a fixture snapshot with a `song` output gives a `song` pool;
  - D27's specificity gate drops a food-pool candidate that responds as strongly to a conspecific pair (research R15).
- [X] T025 [US2] Use the `microfly-calibrate` skill on profile `social-v3` to run stage C1 in confirm-only mode on
  calibration seeds, then stage C2. The skill asks for a budget first. Write
  `public/brains/forager-brain-social.decoder.json`. If C1 fails at the MB block, run the C1 grid on calibration
  seeds and record the run. An `E-DECODE-*` for a social pool is a finding, written to `claims.md`, not a retry.
- [X] T026 [US2] Run the same C2 rule against `rewire(socialSnapshot, 0x52470001)`, from
  `scripts/forager-arms.mjs`. Write `public/brains/forager-brain-social.rg.decoder.json`, and record the random
  graph's social pool sizes and rises in `claims.md`.
- [X] T027 [US2] In `public/js/fly/decoder.js`, read the `song` named pool and return
  `named.song = { r, rest, drive }`. Reject a decoder `song` pool when the snapshot has no `song` output, with
  "decoder: song pool needs a snapshot song output". Accept `valenceSource`.
- [X] T028 [P] [US2] Extend `tests/decoder.test.mjs`:
  - the social decoder loads against the social snapshot;
  - a `song` pool against `forager-brain-mb.brain` is rejected;
  - `named.song.drive` follows the pool rate.
- [X] T029 [US2] Add the C2 spiking results to `claims.md`. For each social pair, record the `drive` pool size and its
  rise over rest, and the `side` pools with their selectivity, or why none passed. For `song`, record its rise under
  each condition. Show the random-graph values next to these.
- [X] T030 [US2] Fill ADR 012 "Claims and valence". For each social pair, write the declared valence (`approach`,
  `avoid` or `none`), the R7 rule that chose it, and the rows of `claims.md` it came from. Note whether cVA
  (`odour-conspecific`) came out aversive as the literature predicts. **This is Gate C: world code may merge only
  after this task.**

**Checkpoint**: The brain's own response to the social senses is measured and declared, and the decoder is ready.

---

## Phase 5: User Story 3 - Flies Smell and Touch Each Other in the World (Priority: P1)

**Goal**: Every fly is a moving conspecific odour source, front-leg contact fires `contact-pheromone`, the sex tag
sets emission, and there is an overlay, a panel view and the song reflex. Contract:
[world-config-v3-social.md](contracts/world-config-v3-social.md).

**Independent Test**: A two-fly test and the browser check (quickstart D, SC-003).

### Tests (write first and see them fail)

- [X] T031 [P] [US3] Create `tests/stimulus-conspecific.test.mjs`, testing the pure helpers in `stimulus.js`:
  - `conspecificAt(at, flies, selfId, spec, emits)` is higher on the side of the other fly and grows as the distance
    shrinks;
  - it returns 0 with no other fly in `radius`, and 0 for self only;
  - it is capped at 1 when several flies stack;
  - emission scales per sex, and a dead fly emits 0;
  - `contactAt(at, flies, selfId, bodyRadius, emits)` returns 1 × `emits` inside the radius and 0 outside, uses the
    maximum over flies, and excludes self.
- [X] T032 [P] [US3] Create `tests/world-social.test.mjs`, testing `public/world/validate.js` on each key:
  - `from: "flies"` in odour and contact mode, with `radius > 0`; `interpolate` or `scaleBy` with `from: "flies"`
    fails with `does not apply to from "flies"`;
  - `flies.sexes` with `default`, the allowed sexes, `emits` keys that must be `from: "flies"` stimuli, and values in
    [0, 1]; an unknown `flies.sex[i]` fails with `flies.sex[<i>]: unknown sex "<v>"`;
  - `flies.body.bodyRadius > 0` with default 0.35, `solid` boolean with default false;
  - `flies.body.song { threshold, tau }` fails with `flies.body.song needs a snapshot song output` when the snapshot
    has no `song`;
  - `world-forager.json`, `world-forager-demo.json` and `world-forager-learning.json` still validate.
- [X] T033 [P] [US3] Create `tests/body-layer-song.test.mjs`, for W17. The integrator is
  `song ← song + (max(0, r − rest) − song) / tau`, and `fly.singing` is true while `song ≥ threshold`. Check that:
  - singing changes no heading or speed;
  - W17 is off when `flies.body.song` is absent.
- [X] T034 [P] [US3] Create `tests/slow/social-two-fly.test.mjs` (SC-003). Two flies have scripted positions and
  headings, each with its own sampler.
  - **Odour side:** across sampled ticks with B in range and off A's midline, A's conspecific input is higher on B's
    side on 100 % of them.
  - **Contact side:** across ticks with A's left front-leg site inside B's `bodyRadius`, only A's left contact fires,
    on 100 % of them. B's contact fires only when B's own leg site is inside A.

### Implementation

- [X] T035 [P] [US3] In `public/js/fly/stimulus.js`, add the pure helpers `conspecificAt` and `contactAt` (data-model
  "Conspecific odour field" and "Contact"). They reuse `falloff` and skip `id === selfId` and `!alive`. The module
  stays pure (no DOM).
- [X] T036 [US3] In `public/js/fly/forager-step-wide.js`:
  - add `from: "flies"` to `samplerFor`. It returns a sampler with `pointsFor(selfId)`, `contactAtPoint(at, selfId)`
    and `isFlies: true`, reading the live `env.conspecifics` array, emission from the resolved `flies.sexes`, and
    `bodyRadius`;
  - in `senseForagerFlyWide`, route `from: "flies"` channels to `conspecificAt` or `contactAt` with `fly.id`, before
    `declaredSpec`;
  - leave every other source unchanged. `bilateralContrast` applies to the conspecific pair as declared;
  - in `forageEnvWide`, create `env.conspecifics = []`, and export `refreshConspecifics(env, flies)`, which writes
    `{ id, x, y, heading, sex, alive }` for each fly.
- [X] T037 [US3] In `public/js/fly/fly-config.js`, resolve the defaults:
  - `flies.sexes` absent means every fly emits 1 for every `from: "flies"` stimulus;
  - `default` applies to flies with no `sex[i]`;
  - `body.bodyRadius` defaults to 0.35 and `body.solid` to false;
  - `body.song` stays undefined unless declared.

  Each fly state carries its resolved `sex`. In `public/js/fly/fly-world.js` `spawnFlies`, add `sex` to each fly state
  and keep the sprite choice unchanged.
- [X] T038 [US3] In `public/world/validate.js`, add every rule tested in T032, with the exact messages from the
  contract.
- [X] T039 [US3] In `public/js/fly/fly-host.js`, call `refreshConspecifics` once per `pump()` pass, before any
  `dispatch`. Dead and stopped flies have `alive: false`. With `flies.body.solid`, refuse a body step that would bring
  two body centres closer than `2 × bodyRadius`: apply it in the same place blocked cells are refused, via a world
  physics hook passed to the body step, never inside `body-layer.js`. The `from: "blocked"` touch sampler also
  returns 1 when its site lies inside another body (research R10).
- [X] T040 [US3] In `public/js/fly/body-layer.js`, add W17. Per-fly `fly.bodyLayer.song = 0` in `initBodyLayerFly`,
  with the integrator and `fly.singing` from T033, read only from `decoded.named.song`. It is off when
  `cfg.song` is absent. Add a header comment citing ADR 012 W17.
- [X] T041 [P] [US3] In `public/js/render/renderer.js` and `public/js/render/sprites.js`, draw one extended wing while
  `fly.singing`. Put it on the side of the larger `side.contact-pheromone` value if that pool exists, and on the left
  otherwise. It is drawing only.
- [X] T042 [P] [US3] In `public/js/main.js`, add the `odour-conspecific` overlay:
  - a fifth switch in the World tab, off on load, shown only when the world declares `odour:conspecific`;
  - the per-cell field from `conspecificAt` at cell centres with no `selfId`, using live fly positions;
  - repainted on the existing food-overlay throttle, with ramp prefix `--odour-social`;
  - the `--odour-social-low/-mid/-high/-alpha` tokens added to the app stylesheet, light and dark.
- [X] T043 [P] [US3] In `public/js/ui/panel/sections/inputs.js` and `public/js/ui/panel/sections/decoder.js`, show for
  the selected fly:
  - the sex tag, as "female (male connectome)" or "male";
  - the L/R `odour:conspecific` and `contact:pheromone` inputs, labelled with the ADR 012 valence;
  - `contactWith`;
  - `song` drive, rest and singing in the decoder section.

  Extend `tests/panel-inputs-v1.test.mjs` and `tests/panel-decoder-section.test.mjs` for these rows.
- [X] T044 [US3] Create `public/world/world-forager-social.json` from `world-forager-learning.json`:
  - 6 flies, `sex` alternating female/male, `brain.version` v3;
  - snapshot and decoder `brains/forager-brain-social.*`, learning off;
  - the stimuli `odour:conspecific` (`from: "flies"`, radius 3, contrast common 0.5 gain 5) and `contact:pheromone`
    (`from: "flies"`, contact), placeholders for T051–T054;
  - `flies.sexes` from research R9;
  - `body.bodyRadius` 0.35, `solid` false, and `song` with placeholder threshold and tau;
  - `experiment.seeds` and `heldOut` that do not overlap.

  Document the world in `public/world/README.md`.
- [X] T045 [US3] Run the app (`cd public && python3 -m http.server 8000`) with `?world=world/world-forager-social.json`,
  and walk through quickstart D steps 1–5. Note in `specs/020-social-pheromone-senses/calibration.md` that the console
  showed no errors with 6 flies, and how the frame rate compared with social stimuli removed (SC-007, SC-008).

**Checkpoint**: Flies sense one another in the browser through declared channels. Old worlds are unchanged.

---

## Phase 6: User Story 5 - Foraging and Learning Still Work With Flies Around (Priority: P1)

**Goal**: No regression in food, danger, feeding or learning (SC-005, SC-006). Placed after US3 because the "social
stimuli on" check needs the world.

**Independent Test**: The test suites pass, the old worlds load, and the forager acceptance on the social brain with
social stimuli removed stays within the MB brain's spread.

- [X] T046 [US5] Run `npm test`, `npm run test:slow`, `node --test public/tests/*.test.js` and the extractor tests. Fix
  only real regressions in code touched by this feature. Record the pass in
  `specs/020-social-pheromone-senses/results.md` "Regression".
- [X] T047 [US5] On calibration seeds, run `node scripts/forager-arms.mjs` on `world-forager-social.json` with its
  `from: "flies"` stimuli removed (a temp world copy), arm v3, and record the forager measures. Do the same on
  `world-forager-learning.json` with learning off, for the MB baseline. The aim is to see the spread early, not to
  decide; the held-out verdict is T066.
- [X] T048 [P] [US5] Load every shipped world in the browser (mock, v0, v1, wide, demo, learning, learning-tilemap) and
  note in `results.md` that each one runs without console errors.

**Checkpoint**: The forager is intact on calibration seeds. The held-out verdict follows in T066.

---

## Phase 7: User Story 4 - Social Behaviour Is Measured Against Null Arms (Priority: P2)

**Goal**: A lockstep four-arm experiment with the R14 metrics, calibrated on calibration seeds and judged on held-out
seeds (SC-004). Contract: [social-experiment.md](contracts/social-experiment.md).

**Independent Test**: `node scripts/social-arms.mjs … --seeds=held-out` writes `results.json` and `results.md` with
every metric, its CI and the verdict.

### Tests (write first and see them fail)

- [X] T049 [P] [US4] Create `tests/social-metrics.test.mjs`, with scripted two- and three-fly trajectories:
  - `nnMedian`, and `timeNear` with a 2-tile threshold;
  - contact events (onset, duration, side, other sex);
  - `followingIndex`, which is near 1 for a follower directly behind and near 0 for independent random headings;
  - `songPerContact` against `songPerTickAlone`;
  - the sex split.
- [X] T050 [P] [US4] Create `tests/social-lesion.test.mjs`:
  - `lesion(snapshot, channelIds)` sets to 0 only the out-edge weights of the listed channels' input neurons, and
    keeps offsets, targets, neuron count and every other weight;
  - lockstep stepping gives identical telemetry when two flies' step order is swapped.

### Implementation

- [X] T051 [P] [US4] In `public/js/fly/metrics.js`, add the pure functions `nnDistances`, `timeNear`,
  `contactEvents`, `followingIndex`, `songBouts` and `socialSummary` (research R14). Confidence intervals use the
  existing `bootstrapCI`.
- [X] T052 [US4] Create `scripts/social-arms.mjs` (the contract CLI):
  - **Arms:** `social`, `ablated` (an exported `lesion()`), `random-graph` (`rewire` from `scripts/forager-arms.mjs`
    with `forager-brain-social.rg.decoder.json`) and `random-walk` (baseline motor).
  - **Loop:** per tick, `refreshConspecifics`, then `stepForagerFlyV3` for every fly in id order, then telemetry.
  - **Shared setup:** one shared body-layer config object, the same `spawnFlies` and the same sexes.
  - **Flags:** `--seeds=held-out|calibration|list` with the existing held-out overlap refusal, `--no-social-stimuli`
    and `--out`.
  - **Output:** `results.json` and `results.md`, shaped as in the contract.
- [X] T053 [US4] Calibrate on **calibration seeds only** with `scripts/social-arms.mjs --seeds=calibration`, in this
  order:
  1. conspecific `radius` and `contrast`;
  2. `bodyRadius`;
  3. emission per sex;
  4. `song.threshold` and `song.tau`, from the `song` pool's rest and contact rise in `claims.md`;
  5. `solid`, on against off.

  Record each value and the run behind it in `specs/020-social-pheromone-senses/calibration.md`. Change only social
  world keys and existing named LIF parameters of `world-forager-social.json`. Leave the forager and learning worlds
  alone (FR-017).
- [X] T054 [US4] Write the calibrated values into `public/world/world-forager-social.json`, replacing the T044
  placeholders.
- [X] T055 [US4] Fill ADR 012 "Calibration": the calibrated values, the run that motivated each, and the W17 reflex
  declaration (threshold, tau, drawing only).
- [X] T056 [P] [US4] Update the tilemap variant: add the same social stimuli and sexes to a copy,
  `public/world/world-forager-social-tilemap.json`, built from `world-forager-learning-tilemap.json`, so the
  experiment runs on two maps (plan Scale/Scope).
- [X] T057 [P] [US4] Add `public/world/world-forager-social.json` and `world-forager-social-tilemap.json` to the
  load-and-validate list in `tests/world-compat.test.mjs`, so both new worlds are checked on every `npm test`.
- [X] T058 [P] [US4] Add `test:social` to `package.json` scripts, running `tests/social-*.test.mjs` and
  `tests/slow/social-two-fly.test.mjs`. Add no install step and no build step.
- [X] T059 [US4] Re-run `npm test` with the new tests. The metrics, lesion and lockstep tests pass.
- [X] T060 [US4] Run a dry run on one calibration seed for each arm. Check that `results.json` has every metric for
  every arm, the sex split and the forager block.
- [X] T061 [US4] **Verdict run on held-out seeds**, on both maps:
  `node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out
  --arms=social,ablated,random-graph,random-walk --out=specs/020-social-pheromone-senses/results.json`. Run the
  same for the tilemap world, writing `results-tilemap.json`.
- [X] T062 [US4] Write `specs/020-social-pheromone-senses/results.md` and ADR 012 "Results":
  - the SC-004 verdict: `social` time near and contact rate greater than `random-graph` and `random-walk`, with 95 %
    CIs that do not overlap;
  - the `ablated` arm comparison, stating whether the effect is pheromonal;
  - the sex split;
  - song per contact against song per tick alone;
  - the following index.

  A failed target is written as a finding (FR-023). Any effect that a null arm also shows is stated.

**Checkpoint**: Social behaviour is measured against all null arms on held-out seeds.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T063 [P] Update `README.md`:
  - add the two social senses with their declared valence ("declared" wording, Principle VI);
  - add the sex-tag limitation ("male brain wearing a name tag");
  - add the `song` reflex and the social world URL.
- [X] T064 [P] Update `AGENTS.md`:
  - add `forager-brain-social` and `world-forager-social.json` to Layout and Commands;
  - point "latest contracts" at `specs/020-social-pheromone-senses/contracts/` for the extract config, the channel
    declaration v6 and the world additions.
- [X] T065 [P] Add a spec 020 entry to `specs/CHANGELOG.md` with the specify, plan and tasks prompts, as earlier
  features do.
- [X] T066 **Held-out regression verdict (SC-005)**: run
  `node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out --no-social-stimuli
  --arms=social --out=specs/020-social-pheromone-senses/results-no-social.json`. Compare find rate, feeding, food-A
  and food-B approach and danger escape with the MB brain's held-out spread from spec 019's results. Write the
  comparison to `results.md` "Regression", and record any drift as a finding in ADR 012.
- [X] T067 Set ADR 012 status to "Accepted" or "Accepted with findings", and summarise SC-001 to SC-008 pass/fail with
  links.
- [X] T068 Run quickstart.md end to end once more and fix any step that no longer matches the shipped files.

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (ADR) ─▶ Phase 2 (extractor/reader) ─▶ Phase 3 US1 (snapshot) ─▶ Phase 4 US2 (fidelity, claims, C2, ADR valence)
                                                                              │  Gate C (T030)
                                                                              ▼
                                                       Phase 5 US3 (world) ─▶ Phase 6 US5 (regression, calibration seeds)
                                                                              ▼
                                                                    Phase 7 US4 (runner, calibration, held-out verdict)
                                                                              ▼
                                                                    Phase 8 (docs, held-out regression, ADR close)
```

### Story dependencies

- **US1** needs only Phase 2.
- **US2** needs US1's snapshot.
- **US3** needs US2's decoder and the T030 valence.
- **US5** needs US3's world for the "on" condition. The "off" check uses `forager-arms.mjs`.
- **US4** needs US3: the sampler, `refreshConspecifics` and the world.

### Within each story

Tests come before implementation, and each test must fail first. Pure helpers come before callers
(`stimulus.js` → `forager-step-wide.js` → `fly-host.js`). Config comes before extraction, and extraction before
reports.

## Parallel Opportunities

- **Phase 2:** T003–T007 are all different test files, so they can run in parallel. T010 and T011 (Python and JS
  capabilities) can run in parallel after T008 and T009.
- **US1:** T017 and T018 can run in parallel after T015.
- **US2:** T022, T024 and T028 can run in parallel. T019 (audit) can run alongside T022–T024.
- **US3:** T031–T034 can run in parallel. After T036, the tasks T041, T042 and T043 (renderer, overlay, panel) can
  run in parallel.
- **US4:** T049 and T050 can run in parallel, and T051 can run alongside T052's scaffolding. T056 and T058 can run in
  parallel.
- **Polish:** T063, T064 and T065 can run in parallel.

### Parallel example: User Story 3

```text
Task: "T031 tests/stimulus-conspecific.test.mjs"
Task: "T032 tests/world-social.test.mjs"
Task: "T033 tests/body-layer-song.test.mjs"
Task: "T034 tests/slow/social-two-fly.test.mjs"
# then, after T035–T040:
Task: "T041 renderer wing extension"
Task: "T042 odour-conspecific overlay in main.js"
Task: "T043 panel sex tag / social inputs / song"
```

## Implementation Strategy

### MVP first (US1 + US2)

1. Phases 1–2: ADR skeleton and extractor keys.
2. US1: the reproducible social snapshot, with leg taste unchanged.
3. US2: fidelity, claims, C2 and the ADR 012 valence.
4. **Stop and review.** This is the network-first result: does the connectome carry the pheromone senses to the
   outputs, and with which sign? A negative answer is a complete, publishable finding.

### Incremental delivery

5. US3: flies sense each other in the browser (demo-visible).
6. US5: regression check on calibration seeds.
7. US4: calibration, then the held-out verdict.
8. Polish: docs, the held-out regression verdict, and the ADR close.

## Notes

- Never tune on held-out seeds (T061 and T066 are the only held-out runs).
- No hand-wired edge, decoder shortcut or body rule may make a social sense act (FR-008, Principle VI).
- Commit per phase with the `(fea) …` prefix.
