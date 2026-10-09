# Phase 0 Research: Pathway-aware interneuron selection

All items below were open design choices, not unknowns about the stack — the extractor's language, tests and
dataset access are fixed by the rest of `extract/` (see plan.md Technical Context). No `NEEDS CLARIFICATION`
markers remain.

## D1: How the boost combines with the existing reachability score

**Decision**: No new tunable weight. For each declared pathway-bias rule, compute a second backward-flow array
using `_flow` (`selection_forager.py`) unchanged, but seeded only from the bodies with `sign == -1` that have a
direct edge into the rule's output pool (instead of today's seed — every body in every output pool). Combine it
with today's backward flow by taking the elementwise maximum, per pathway, before the existing
`score = √(F_pathway · B)` line runs. A pathway with no declared rule keeps exactly `B` it has today (max of one
array with itself).

**Rationale**: `max` is monotonic by construction — a candidate's score can only go up, never down (spec FR-003),
without picking a blending coefficient that would have no dataset justification. Because the score is still
`√(F · B)`, a candidate with zero forward reachability (`F = 0`) still scores zero no matter how large its
rule-seeded backward flow is (spec FR-004) — admission still requires genuine reachability from the pathway, the
rule only changes which backward target counts.

**Alternatives considered**:
- *Weighted additive term* (`score + λ · ruleScore`): rejected — `λ` would be a hand-picked constant with no
  connection to synapse counts or transmitter predictions, in tension with "weight and sign come entirely from the
  dataset" and Constitution III.
- *A second, separate ranking channel with its own budget*: rejected — spec FR-006 requires the existing `budget`
  values to keep their current meaning; a second channel would need a new budget decision this feature does not
  own.

## D2: What counts as an "inhibitory in-edge"

**Decision**: An edge counts as inhibitory into output pool `O` if its presynaptic body's `sign` (already resolved
at admission time, from `transmitterSign` and `minConfidence`, in `admission.py`) is `-1`, and the edge's
postsynaptic body is a member of `O`.

**Rationale**: sign in this model is a property of the presynaptic *neuron* (one predicted transmitter per traced
body), not of the individual synapse — the same field already decides every outgoing edge's sign in the existing
weight computation (`weights = sign_of[src] * raw / denom`, ADR 003 D4). Reusing `bodies[b]["sign"]` needs no new
dataset column and cannot disagree with the sign the container actually writes.

**Alternatives considered**: re-deriving a sign from the raw `predicted_nt` rows at the edge level — rejected, this
would duplicate the confidence/mapping rule admission already applies and could disagree with it at the margins.

## D3: Where the new backward-flow seeds come from

**Decision**: Reuse `_flow` unchanged. The only new step is computing the seed set once per rule: the admitted
bodies with `sign == -1` that have at least one edge (in the already-restricted `pre_i`/`post_i` arrays, before the
outputs'-outgoing-edges drop) landing on a body in the rule's `intoOutput` pool.

**Rationale**: `_flow` is already tested (golden selection tests) and this keeps the change to "a different seed
set", not a new propagation rule. It also means an output pool with zero inhibitory in-edges yields an empty seed
set, and `_flow` with no seeds returns all zeros — exactly the "no candidate boosted, not an error" edge case the
spec calls for.

**Alternatives considered**: discounting excitatory hops at every step of the propagation, not just the final edge
into the output — rejected as scope creep past the request's own wording ("...into another output pool's
*inhibitory* in-edges"), and untestable against a clean dataset-derived definition.

## D4: Config schema shape

**Decision**: `pathwayBias`: a list (possibly empty) of objects `{id, pathway, intoOutput}`. `id` follows the same
`[a-z][a-z0-9-]*` shape already used for `modulators[*].id`. `pathway` must be a key of `config.pathways`;
`intoOutput` must be a key of `config.outputs`. Validated with the existing `E-CONFIG` failure code — no new code
is introduced.

**Rationale**: Mirrors `modulators`' existing list-of-rules shape and validation style (`_check_modulators`), and
the existing precedent that `pathways.{pathway}` and `modulators[*].targets` are already cross-checked against
sibling keys with `E-CONFIG`, not a dedicated code.

**Alternatives considered**: a single rule object instead of a list — rejected, spec FR-001 requires "zero or
more", and a dict key keyed by pathway id would make two rules into the same output ambiguous without an array.

## D5: Config/contract versioning

**Decision**: No `formatVersion` bump. `pathwayBias` is an additive key inside format 3, kind `forager`; an absent
or empty list is defined to be a no-op (spec FR-007), so no existing reader becomes incompatible.

**Rationale**: Follows the ADR 005 D4′ precedent — `weightRule: "postFractionAbsolute"` was added to the same
format 3 schema as "a backward-compatible addition, not a redefinition" (contract, `weightRule` row), without a
version bump. The container format (version 4) is untouched: no new field is written to the `.brain` file itself,
only the extractor's own input config and its printed report change.

**Alternatives considered**: bumping to format 4 — rejected, no reader is broken, and AGENTS.md ties a version bump
to incompatible changes specifically.

## D6: How to compare against the currently-shipped topology

**Decision**: A new Gate-A-style script, `extract/tests/compare_forager_topology.py` (same category as the
existing `tests/bench_forager.py`: run manually against the real dataset, not part of `unittest discover`). It
loads the dataset and the restricted edge table once, runs `select_forager` twice in the same process — once with
`config["pathwayBias"]` forced to `[]`, once with the config as shipped — and diffs the two neuron sets.

**Rationale**: Spec FR-007 guarantees the empty-rule run reproduces today's shipped topology exactly (apart from
provenance), so this is a faithful "current topology" baseline without writing a second reader for the `.brain`
container binary (which today only has a reader in `public/js/brain/`, not in `extract/`). One dataset load serves
both runs.

**Alternatives considered**: parsing `public/brains/forager-brain.brain` directly in Python and diffing its neuron
table — rejected, it would duplicate container-reading logic for no accuracy gain over the guaranteed-equivalent
in-process rerun.

## D7: Whether this needs a new ADR

**Decision**: No new `adrs/*.md` file. The change is documented as an amendment to ADR 003 D3 (cited as "D3′" in
code comments and the contract, the same convention ADR 005 used for D4′) plus this feature's own spec/plan.

**Rationale**: `AGENTS.md` ties a new ADR to "one per brain generation"; this is not a new brain, it is a scoring
refinement to the existing forager generation's D3 rule, the same scope ADR 005 covered for D4 without a new ADR
file of its own for that specific sub-rule.
