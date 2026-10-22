# Implementation Plan: Social and Pheromone Senses

**Branch**: `020-social-pheromone-senses` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-social-pheromone-senses/spec.md`

## Summary

The 136 front-leg ppk23/ppk25 GRNs that ADR 007 D16 kept out of leg taste get their own sense, `contact-pheromone`.
The fly-odour receptor neurons (DA1, VA1v, VA1d) become `odour-conspecific`. A new extraction config,
`forager-brain-social`, built on the 14.5K MB brain, adds both pairs. It seeds the social pathway that the dataset
annotates (pC1, which holds P1 in this release; mAL; vAB3 as `AN09B017e/f/g`; pIP10) and declares a `song` output on
pIP10 (research §0, R1–R5, R12).

The world makes every fly a moving odour source and senses leg-on-body contact, both on the main thread (R8). A
per-fly sex tag chooses what the fly emits (R9). Valence is **not declared up front**. A linear claim table and the
D27 spiking probe measure whether each social sense turns the fly toward or away, and ADR 012 records the answer
(R7).

A lockstep runner then measures social approach in four arms: full brain, pheromone-ablated brain, random graph and
random walk (R11, R13, R14). Food and danger are re-checked for regressions, because the social PNs share the AL and
LH with the food PNs (R15).

Work runs in this order, and each step gates the next:

1. Extraction and fidelity.
2. Claim table and C2 probe. Record ADR 012 (SC-002) before any world code is merged.
3. World senses, overlay and panel.
4. Calibration on calibration seeds.
5. Experiment on held-out seeds.

## Technical Context

**Language/Version**:
- Plain ES modules (browser and Node 20+), no transpiler.
- Python 3 for the extractor.

**Primary Dependencies**:
- No new dependencies.
- Reuses `stimulus.js` (`falloff`, `sitePoint`, `bilateralContrast`), `forager-step-wide.js`, `decoder.js`,
  `body-layer.js`, `metrics.js` (`bootstrapCI`), `scripts/forager-arms.mjs` (`rewire`, spawn), the
  `microfly-calibrate` C1/C2 stages, `scripts/connectivity-audit.py`, and `render/heatmap.js`.
- Python: the pinned `pyarrow` and `numpy`.

**Storage**: Static files only.
- `extract/configs/forager-brain-social.json`.
- `public/brains/forager-brain-social.{brain,decoder.json}` and a `brains.json` entry.
- `public/world/world-forager-social.json`.
- Results under `specs/020-social-pheromone-senses/`: `extraction-report.md`, `fidelity.md`, `claims.md`,
  `calibration.md`, `results.md` and the JSON files they summarise.

**Testing**:
- `npm test` and `npm run test:slow`.
- Extractor `unittest`.
- New tests:
  - extractor: config keys, `E-SEED-EMPTY` per type, resolved `E-POOL-OVERLAP`, capabilities v6 writer;
  - JS: capabilities v6 reader, `from: "flies"` sampler (side, self-exclusion, sex emission, contact side), `lesion`,
    social metrics, world validation, body layer W17;
  - a slow two-fly lockstep test (SC-003).

**Target Platform**:
- Evergreen browsers: one module worker per fly (unchanged).
- Node for the probes and experiments.

**Project Type**: Static web app, Python extractor, Node experiment scripts.

**Performance Goals**:
- The conspecific field costs about 150 distance evaluations a tick for 6 flies.
- The overlay repaints at most 64 × 40 × 6 samples, on the food overlay's throttle.
- No visible drop in frame rate with 6 flies (SC-007).
- The worker step grows with about 5 % more neurons, the 14.5K → about 15.2K extraction (R5).

**Constraints**:
- Same config and dataset give a byte-identical snapshot (Principle IV).
- With defaults, the LIF core is unchanged; this feature touches no `lif-*.js` file.
- Old brains and worlds keep loading (mock, v0, v1, v2, v3 and the learning worlds).
- Tuning uses calibration seeds; verdicts use held-out seeds.

**Scale/Scope**:
- About 723 neurons added (R5): 2 input pairs, 1 output and 4 seed filters.
- 1 new world.
- 4 experiment arms × the held-out seeds × 2 maps (the social world and the learning tilemap with social stimuli).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | How this plan complies |
|---|---|
| I. Static web, zero build | Plain ES modules and JSON. No library. The overlay reuses `heatmap.js`. |
| II. One fly, one worker | Brains stay in their workers. The conspecific field and contact are world sensing on the main thread, like every other stimulus (R8). Protocol v3 already carries inputs, outputs and spikes, and the `song` output travels as one more output value. **No protocol change.** |
| III. Connectome-grounded snapshots | Every pool and seed is a dataset filter (`class`, `type`, `receptorType`, `entryNerve`). Each type name was checked against the annotations (research §0). P1 and vAB3 are mapped to the dataset's own names, and the mapping is stated. No edge is hand-wired. The ablated arm and the random graph are labelled derived arms (R11). |
| IV. Configurable, reproducible extraction | The new config only adds keys. Format 5 gains optional `types`/`typePrefixes` seeds and `receptorTypes`, and the old configs extract byte-identically. Errors are named: `E-SEED-EMPTY`, and `E-POOL-OVERLAP` on resolved pools (R3, R4). |
| V. Faithful LIF | No change to `lif-v0.js` or `lif-v1.js`. The golden tests stay as they are. |
| VI. Living world, embodied flies | Both senses are declared channels with named dataset neurons and declared stimulus mappings (`from: "flies"`). They act only through decoded pools. Valence is declared in data **after** measurement, with a fixed sign (R7). The body layer reads no other fly. Solid bodies are world physics, shared by every arm (R10). Wing extension (W17) is a reflex on the decoded `song` pool only. The sex tag changes emission only (R9). |
| VII. Simplicity | One sampler source, one lesion helper, one runner. No new dependency, mechanism or protocol version. |
| Demo acceptance / workflow | Calibration seeds for tuning, held-out seeds for verdicts. Null arms (random graph, random walk) are reported. A failed target is a recorded finding (FR-023). |

**Contract versioning**:
- **Channel declaration v6.** It adds an optional `song` drive. The v5 reader is kept, and a v5 snapshot loads
  unchanged.
- **World config v3.** The social keys are optional additions with no version bump, the same pattern as the learning
  additions.
- **Decoder v1.** The social pairs and the `song` named pool are additive.
- **Extract config format 5.** Its optional keys are additive.

**Result: PASS.** Nothing goes in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/020-social-pheromone-senses/
├── plan.md                 # this file
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── extract-config-social.md      # format-5 additions (seeds by type, receptorTypes, song, resolved overlap)
│   ├── channel-declaration-v6.md     # optional song drive; v5 reader kept
│   ├── world-config-v3-social.md     # from:"flies", sexes, bodyRadius, solid, overlay, song reflex
│   ├── decoder-v1-social.md          # social pairs, song pool, measured valence
│   └── social-experiment.md          # runner CLI, arms, metrics, result files
├── extraction-report.md    # implementation output
├── fidelity.md / claims.md / calibration.md / results.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
extract/
├── configs/forager-brain-social.json          # new
├── malecns_brain/config.py                    # seeds types/typePrefixes; inputs receptorTypes; song output
├── malecns_brain/selection_class_seed.py      # type seeds, receptorTypes filter, resolved E-POOL-OVERLAP
├── malecns_brain/capabilities.py              # v6 writer (song drive)
└── tests/                                     # new cases for each of the above

scripts/
├── connectivity-audit.py                      # run as is for the social pairs (+ VL2a variant)
└── social-arms.mjs                            # new: lockstep runner, lesion(), four arms

.claude/skills/microfly-calibrate/scripts/profiles/social-v3.mjs   # new C1/C2 profile

public/
├── brains/forager-brain-social.{brain,decoder.json}, brains.json
├── world/world-forager-social.json, world/README.md
├── world/validate.js                          # sexes, from:"flies", bodyRadius, solid, song keys
├── js/brain/capabilities.js                   # v6 reader
├── js/fly/stimulus.js                         # conspecificAt(), contactAt() pure helpers
├── js/fly/forager-step-wide.js                # samplerFor "flies", self id, env.conspecifics
├── js/fly/fly-config.js                       # defaults for sexes/bodyRadius/solid/song
├── js/fly/fly-host.js                         # refresh env.conspecifics per pump; solid-body move check
├── js/fly/body-layer.js                       # W17 song reflex (state only)
├── js/fly/decoder.js                          # named song pool
├── js/fly/metrics.js                          # NN distance, time near, contacts, following, song bouts
├── js/render/renderer.js / sprites.js         # wing-extension drawing
├── js/main.js                                 # odour-conspecific overlay
└── js/ui/panel/…                              # sex tag (male connectome), social inputs + valence, song

tests/   # capabilities-v6, stimulus-conspecific, social-metrics, social-lesion, world-social, body-layer-song
tests/slow/social-two-fly.test.mjs
adrs/012-social-pheromone-senses.md            # new decision record
```

**Structure Decision**: Use the existing layout. Every change sits next to the code it extends, and the only new
modules are the config, the runner, the calibration profile and the world.

## Phases and gates

| Phase | Output | Gate |
|---|---|---|
| A. Extraction | config, snapshot, `extraction-report.md` (counts per pool and side, unknown-side drops, share of the MB brain's neurons kept) | Byte-identical re-extraction. Leg-taste pool identical to the MB brain's (SC-001). Every seed type matched. |
| B. Fidelity | `fidelity.md`: conspecific and contact contrast, brain over whole graph, plus the VL2a variant; audit sections coverage/paths/bridges/readout | Recorded. A fraction under 0.1 is a finding, not a retry with bridges. |
| C. Claims and C2 | `claims.md` (linear signs), `forager-brain-social.decoder.json` (C2 with social pairs and song), ADR 012 valence | ADR 012 written with valence per pair (SC-002) **before** world code merges. |
| D. World | `from: "flies"` sampler, sexes, overlay, panel, W17, solid option | Two-fly test (SC-003). Old worlds load. |
| E. Calibration | `calibration.md` on calibration seeds | Each value has the run that motivated it. |
| F. Experiment | `results.md` from `social-arms.mjs` on held-out seeds | SC-004 verdict. SC-005 food and danger regression. Ablated arm reported. |

## Risks

- **Shared AL and LH circuits leak into the food readout (R15).** The D27 specificity gate now counts the social pairs.
  Food pools are re-derived, and food and danger metrics are re-run with the social stimuli removed and on.
- **The fill re-ranks (R5).** The new seeds change D9's ranking. The extraction report lists how much of the MB brain
  stays. The fidelity table must keep every existing check passing.
- **No side pool for either social pair.** That is likely, given food (3/4 side-selective neurons). Steering then
  comes from klinotaxis on `drive` alone, as for food. It is reported, not worked around.
- **pIP10 is silent.** Song is then never drawn, and that is a finding (spec edge case).
- **Valence comes out `none`.** The sense still reaches the brain but gives no steering term. Any social approach
  then has to come through `forward`, `backward` or `alarm`, and the results say which.

## Constitution Check (post-design)

Re-checked against [data-model.md](data-model.md) and [contracts/](contracts/). The design adds no LIF mechanism, no
protocol message and no dependency. Every new world key is optional, and every new sense, output and seed is a
declared dataset filter. **PASS.**

## Complexity Tracking

None.
