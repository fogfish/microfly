# Phase 1 Data Model: Pathway-aware interneuron selection

No persisted storage and no container-format change — this is in-memory extraction state, scoped to one run of
`select_forager` (`extract/malecns_brain/selection_forager.py`). Entities are described in terms of the existing
dense-id arrays (`ids`, length `n` = every admitted body) the function already builds.

## PathwayBiasRule (config-declared)

| Field | Type | Rule |
|---|---|---|
| `id` | string | `[a-z][a-z0-9-]*`, unique within `pathwayBias` (same shape as `modulators[*].id`). |
| `pathway` | string | Must be a key of `config.pathways` (`"odour"` or `"taste"`). |
| `intoOutput` | string | Must be a key of `config.outputs`. |

Declared in `extract/configs/forager-brain.json`'s top-level `pathwayBias` list (default `[]`, meaning "no rule").
Shipped forager config declares exactly one: `{"id": "taste-forward-brake", "pathway": "taste", "intoOutput":
"forward"}`.

## InhibitorySeedSet (derived, per rule)

The dense indices (same index space as `ids`) of admitted bodies with `sign == -1` that have at least one edge
landing on a body in `rule.intoOutput`'s pool, read from the already-restricted `pre_i`/`post_i` arrays (after
dead/invalid edges are dropped, before outputs' own outgoing edges are dropped — those two filters do not touch
edges *into* an output). Empty when the output pool has no inhibitory in-edges in the dataset; never an error.

## RuleBackwardFlow (derived, per rule)

`Float64Array(n)`, the output of the existing `_flow(post_i, pre_i, syn, n, seeds=InhibitorySeedSet(rule),
steps=config.flowSteps)` — the same propagation `_flow` already runs for the plain backward flow `b_flow`, only
the seed set differs. All zeros when `InhibitorySeedSet(rule)` is empty.

## PathwayEffectiveBackwardFlow (derived, per pathway)

`Float64Array(n)`: elementwise `max(b_flow, RuleBackwardFlow(r₁), RuleBackwardFlow(r₂), …)` over every rule `r`
whose `pathway` equals this pathway. Equal to plain `b_flow` when no rule names this pathway — the identity case
that keeps FR-007 (no rule ⇒ byte-identical output) true by construction, not by a separate code path.

## PathwayScore (derived, per pathway — replaces today's `score_odour`/`score_taste`)

`score_pathway(i) = √(F_pathway(i) · PathwayEffectiveBackwardFlow_pathway(i))`. Same formula shape as ADR 003 D3
step 3, with the backward-flow term now pathway-specific instead of shared across both pathways. Feeds directly
into the existing `top_by_score(scores, budget[pathway])` call — no change to that function or to `budget`'s
meaning (FR-006).

## Per-run report addition (derived, for `report_forager` in `__main__.py`)

For each declared rule: `{boosted: int, admittedOnlyByRule: int}` —
- `boosted`: count of admitted interneurons whose `RuleBackwardFlow(rule)` at their own index is the strict
  maximum picked in `PathwayEffectiveBackwardFlow` (i.e. the rule, not the plain output reachability, is why their
  score is what it is).
- `admittedOnlyByRule`: of those, how many fall *outside* the top-`budget[pathway]` set that plain `b_flow` alone
  would have produced — i.e. would not have been admitted without this rule (spec FR-012).

## TopologyDiff (derived, `compare_forager_topology.py` only — not written to any file read by the app)

A report-only record, not part of the container or any persisted schema:

| Field | Meaning |
|---|---|
| `addedBodies` | `bodyId`s admitted with the rule that were not admitted with `pathwayBias: []` on the same dataset load. |
| `removedBodies` | The reverse: admitted without the rule, displaced with it. |
| `perPathwayCounts` | `len(addedBodies)` / `len(removedBodies)` split by which budget (`odour`/`taste`) each body was ranked under. |
| `edgeCountDelta` | `edgeCount` with the rule minus `edgeCount` without it. |
| `ruleExplained` | For each body in `addedBodies`: whether its `RuleBackwardFlow` for the declared rule is strictly positive (a sanity check that the diff is actually explained by the new term, not an unrelated side effect). |

Consumed only by `specs/012-pathway-aware-selection/gate-a.md`'s comparison section — never read by the extractor,
the browser app, or any test assertion beyond the comparison script itself.
