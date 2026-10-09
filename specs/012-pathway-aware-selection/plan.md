# Implementation Plan: Pathway-aware interneuron selection (taste → forward inhibitory bias)

**Branch**: `012-pathway-aware-selection` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-pathway-aware-selection/spec.md`. Additional direction from the
`/speckit-plan` invocation: implement inside the extraction scripts only, adjust the testing gates, and add a
direct comparison against the currently-shipped forager brain topology, reporting whether any significant
difference exists.

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution
workflow.

## Summary

Today `select_forager` (`extract/malecns_brain/selection_forager.py`) ranks every interneuron candidate by
`√(F_pathway(i) · B(i))`: forward flow from one pathway's sensory seeds, times backward flow to *any* output pool
— reachability only, blind to which output or whether the edge into it excites or inhibits. This plan adds one new
config key, `pathwayBias` (a list of `{id, pathway, intoOutput}` rules), and changes `B(i)` to be computed
per-pathway: the elementwise maximum of today's plain backward flow and, for each rule naming that pathway, a
second backward flow seeded only from the bodies with dataset-resolved `sign == -1` that feed directly into the
rule's `intoOutput` pool. No new tunable weight, no change to `weightRule`/`transmitterSign`/`budget`, no
container-format or LIF/worker change — the entire change is inside `extract/`, its config, its contract, and its
tests, exactly as the plan invocation asked. `forager-brain.json` ships one rule: `taste` → `forward`'s inhibitory
in-edges, the "slow down and eat" brake left open by `010-output-pool-synaptic-scale`. A new comparison script
reconstructs today's shipped topology in-process (`pathwayBias: []`, guaranteed byte-equivalent by contract) and
diffs it against the rule-bearing extraction, feeding Gate A's record; Gate B and Gate C are re-run to confirm no
regression follows from the admitted-neuron-set change.

## Technical Context

**Language/Version**: Python 3 (whatever `extract/.venv` pins — no new dependency), matching the rest of
`extract/malecns_brain/`.

**Primary Dependencies**: `numpy` only (already used by `selection_forager.py`'s `_flow`). No new package.

**Storage**: N/A — in-memory extraction state over Feather-sourced dataset reads; no change to the `.brain`
container format (version 4 stays as is) and no new persisted file beyond the usual report/gate markdown.

**Testing**: `cd extract && .venv/bin/python -m unittest discover -s tests -t .`, per `AGENTS.md`. New assertions
land in `tests/test_config_forager.py` (schema) and `tests/test_selection_forager.py` (ranking/admission), both
against the existing synthetic fixture (`tests/fixtures/forager-synthetic.json`) extended with a labelled
inhibitory edge into one of its output pools — no Feather files, no real dataset, per Constitution III's rule that
synthetic fixtures are for tests only. A new, non-`unittest` script, `tests/compare_forager_topology.py` (same
category as the existing `tests/bench_forager.py`), needs the real dataset (`MALECNS_DIR`) and is run manually for
Gate A, not part of `unittest discover`.

**Target Platform**: Python 3 CLI (`python -m malecns_brain extract`), run from a developer machine or CI with
access to the MaleCNS dataset. No browser or worker involvement at all in this feature.

**Project Type**: Single-repo static web app + Python extractor (per `AGENTS.md` layout). This feature touches
only the extractor side (`extract/`) and its contract/spec documentation — no file under `public/` changes.

**Performance Goals**: No new per-step hot loop (this runs once, at extraction time, not in the browser). The
added backward-flow computation is one more `_flow` call per declared rule (one call for the shipped config),
each costing the same as today's existing backward-flow call — negligible next to the Gate A extraction time
already recorded (~60 s, `specs/008-hungry-forager-brain/gate-a.md`).

**Constraints**: Must preserve FR-007/contract P1 exactly: an empty or omitted `pathwayBias` must reproduce
today's shipped topology byte-for-byte (apart from `provenance.createdAt`). Must not alter `weightRule`,
`transmitterSign`, `outputAdmission`, or `budget` semantics (FR-005, FR-006). Must not change the container format
version (still v4) or any JS reader.

**Scale/Scope**: One new config key, one new seed-set computation per declared rule (one rule shipped), one new
report line per rule, one new comparison script. No change to the ~3,400-neuron, ~205,000-edge scale of the
shipped forager brain beyond whatever the re-ranking itself produces within the unchanged budget.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Static Web, Zero Build | No `public/` or build-step change at all; this is a Python extractor change only. | PASS |
| II. One Fly, One Worker | Not touched — no worker, protocol, or main-thread code changes. | PASS |
| III. Connectome-Grounded Brain Snapshots | The new scoring term uses only the dataset-resolved `sign` already assigned at admission (`transmitterSign`/`minConfidence`) and existing synapse-derived flow; it invents no connection and sets no weight or sign itself. The new synthetic test fixture extension is labelled as synthetic, consistent with existing fixtures. | PASS |
| IV. Configurable, Reproducible Extraction | `pathwayBias` is config, not code — no pathway/output name is hard-coded in `selection_forager.py` (FR-001). Same config + dataset still gives a byte-identical snapshot; an empty rule list is a defined no-op (FR-007). | PASS |
| V. Faithful, Inspectable LIF Simulation | Not touched — no LIF parameter, core, or worker change. | PASS |
| VI. Living World, Embodied Flies | The pathway→output mapping stays declared in config (`pathwayBias`), not hidden in world or extractor code; the world and its stimulus/motor mapping are unchanged. | PASS |
| VII. Simplicity | No new tunable constant (research.md D1): the boost is an elementwise `max` of two already-computed-shape flow arrays, reusing `_flow` unchanged. No new abstraction layer; no new ADR file (research.md D7) — documented as an amendment to ADR 003 D3, the same convention ADR 005 used for D4′. | PASS |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-pathway-aware-selection/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── extract-config-forager.md   # Phase 1 output: amendment merged into
│                                    #   specs/008-hungry-forager-brain/contracts/extract-config-forager.md
│                                    #   during implementation
├── gate-a.md              # NEW (implementation): extraction report + topology comparison
├── gate-b.md              # NEW (implementation): simulator timing re-confirmation
├── gate-c.md              # NEW (implementation): held-out-seed behaviour re-run
└── tasks.md               # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

This feature is a small, surgical change confined to the Python extractor; no new top-level directory, no new
dependency, no change under `public/`.

```text
extract/malecns_brain/
├── config.py              # FORAGER_KEYS gains "pathwayBias"; new PATHWAY_BIAS_KEYS = {"id", "pathway",
│                           #   "intoOutput"}, reusing MODULATOR_ID's id shape; validate_forager() gains
│                           #   _check_pathway_bias(config["pathwayBias"], config["pathways"], config["outputs"]),
│                           #   same E-CONFIG style as pathways/modulators validation — no new failure code
└── selection_forager.py   # select_forager(): after computing b_flow (today's plain backward flow), compute one
                            #   RuleBackwardFlow per declared pathwayBias rule — find bodies with sign == -1 that
                            #   have an edge into the rule's output pool (from the already-restricted pre_i/post_i,
                            #   before the output-outgoing-edge drop touches anything relevant here), then
                            #   _flow(post_i, pre_i, syn, n, seeds=that set, steps=flowSteps) — the same _flow
                            #   call shape as today's b_flow, just a different seed set. Group rules by `pathway`
                            #   and take the elementwise max with b_flow to get PathwayEffectiveBackwardFlow per
                            #   pathway (data-model.md); score_odour/score_taste use their own pathway's array in
                            #   place of the single shared b_flow. Module docstring gains a line citing "ADR 003
                            #   D3′" per the repo's decision-citation convention

extract/configs/
└── forager-brain.json     # Gains "pathwayBias": [{"id": "taste-forward-brake", "pathway": "taste",
                            #   "intoOutput": "forward"}]

specs/008-hungry-forager-brain/contracts/
└── extract-config-forager.md   # Amended in place per specs/012-.../contracts/extract-config-forager.md (P1–P5,
                                 #   the new key row, the updated report line) — the "latest" contract AGENTS.md
                                 #   points to stays current

extract/tests/
├── test_config_forager.py       # New cases: pathwayBias omitted/empty validates and is a no-op; a rule naming
│                                 #   an undeclared pathway or output id fails E-CONFIG naming that id; a
│                                 #   duplicate or malformed pathwayBias[*].id fails E-CONFIG
├── test_selection_forager.py     # New cases (fixture extended with a labelled inhibitory edge into one output
│                                 #   pool): a body reachable only through that inhibitory edge is admitted with
│                                 #   the rule declared and is not admitted without it, within the same budget
│                                 #   (FR-003/FR-006); a rule naming an output pool with zero inhibitory in-edges
│                                 #   boosts nothing and is not an error; a candidate with zero forward reachability
│                                 #   stays unadmitted regardless of rule-seeded backward flow (FR-004)
├── fixtures/forager-synthetic.json   # Extended (not replaced): one more interneuron body and one more signed
│                                 #   edge, labelled synthetic as today, so the new inhibitory-in-edge path exists
│                                 #   without touching the dataset (Constitution III)
├── test_forager_determinism.py   # Verified unmodified — still passes (byte-identical reruns) with the new key
│                                 #   present
└── compare_forager_topology.py   # NEW: Gate-A-style script (not a unittest, same category as bench_forager.py).
                                   #   Needs MALECNS_DIR. Runs select_forager twice in one process — pathwayBias
                                   #   forced to [] (today's shipped topology, per contract P1) vs. as shipped —
                                   #   and prints the TopologyDiff (data-model.md): added/removed bodyIds per
                                   #   pathway budget, edge-count delta, and a sanity check that every added body's
                                   #   RuleBackwardFlow is actually positive. Feeds gate-a.md's comparison section
```

**Structure Decision**: single-project, in-place modification of two existing Python modules
(`config.py`, `selection_forager.py`), one config file, one existing contract document, and the existing test
suite plus one new Gate-A-style script — matching exactly what the plan invocation asked ("implement ... within
the extraction scripts"). No change to the container format, the browser app, the worker protocol, or any `public/
js/` file. `smallest-functional-brain.json` and `antennal-lobe-brain.json` (format 2) are untouched and keep
producing byte-identical output, since `pathwayBias` only exists in the format-3 forager schema.

## Complexity Tracking

*No Constitution Check violations — this section is not needed.*
