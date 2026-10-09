# Feature Specification: Pathway-aware interneuron selection (taste → forward inhibitory bias)

**Feature Branch**: `012-pathway-aware-selection`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Make interneuron selection pathway-aware, not just reachability-aware. Add a scoring term to the extractor (a versioned change to `extract/configs/forager-brain.json`'s schema + the selection code it drives) that boosts flow score for candidates lying on a path from one declared pathway's inputs (taste/feed) into another output pool's *inhibitory* in-edges (forward). Weight and sign still come entirely from the dataset — this only changes which real, traced neurons get admitted under the existing budget. Needs a contract update (`contracts/extract-config-forager.md`), extractor tests, and a fresh Gate A/B/C."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The extractor prefers neurons that complete a known inhibitory circuit, not just any reachable one (Priority: P1)

Today the extractor ranks interneuron candidates by how strongly they sit on *some* path from a pathway's sensory inputs to *any* output pool, regardless of what that output does or whether the edge into it excites or inhibits. A body that happens to be the real, traced link in a specific known circuit — for example, taste sensing feeding into the neurons that would normally inhibit forward locomotion, so the fly slows down near food — competes for budget on equal footing with a body that merely touches some unrelated reachable output. A researcher extracting the forager brain needs the selection to recognise and favour the first kind of body, without inventing a connection, without touching any weight or sign, and without changing how many interneurons the budget allows.

**Why this priority**: This is the only story in the feature — it is the mechanism the request asks for. Without it, the forager brain's interneuron population is assembled blind to which specific circuits it completes, even when the dataset contains the real neurons for a known, behaviourally important circuit (the taste-to-forward "slow down and eat" brake flagged as open future work in `010-output-pool-synaptic-scale`).

**Independent Test**: Extract the forager brain twice from the same dataset snapshot — once with the pathway-bias rule declared, once without (or with an older-format config) — and confirm: (a) without the rule, the output is unchanged from today; (b) with the rule, the set of admitted taste interneurons differs, the taste budget count stays the same, and every synapse weight and sign in the result still traces back to the dataset.

**Acceptance Scenarios**:

1. **Given** a forager config that declares no pathway-bias rule, **When** the brain is extracted, **Then** the result (neurons, edges, weights, signs) is byte-identical to today's extraction, apart from `provenance.createdAt`.
2. **Given** the forager config declaring a pathway-bias rule from the `taste` pathway into the `forward` output pool's inhibitory in-edges, **When** the brain is extracted, **Then** at least one interneuron that lies on that path and was not previously admitted by reachability alone is now admitted, within the same, unchanged taste budget.
3. **Given** a candidate body with zero general reachability flow (no path to any output at all), **When** it is evaluated under a declared pathway-bias rule, **Then** it is still not admitted — the new term boosts ranking among reachable candidates, it does not create admission from nothing.
4. **Given** a pathway-bias rule that names a pathway id or an output id the config does not declare, **When** the config is loaded, **Then** extraction stops before any file is written and the error names the offending id.
5. **Given** the forager brain extracted with the declared rule, **When** its weights and signs are checked against the dataset's synapse counts and predicted transmitters, **Then** every one matches the existing dataset-derived rule (ADR 003 D4, ADR 005 D4′) with no value set by the new scoring term itself.
6. **Given** two separate extraction runs of the same config and dataset snapshot, **When** their outputs are compared, **Then** they are identical apart from `provenance.createdAt` (the existing self-check and byte-reproducibility guarantee holds unchanged).

### Edge Cases

- A declared rule's output pool has no inhibitory in-edges at all in the dataset (every incoming synapse is excitatory): no candidate is boosted, selection proceeds exactly as without the rule, and this is reported as a dataset finding, not a configuration error.
- A candidate lies on the declared path for one pathway (e.g. `taste`) but not another (e.g. `odour`): the boost applies only within the budget of the rule's own declared pathway, never spilling into a different pathway's ranking.
- Two declared rules both touch the same candidate: their boosts combine deterministically, and the result still never ranks that candidate below where it would sit with no rule declared at all.
- A rule is declared for a pathway/output pair other than taste/forward (e.g. a future brain's `odour`-into-`backward` rule): the schema and selection logic support it without any extractor code change naming specific pathway or output ids.
- The rule causes a body that was previously admitted by general reachability alone to fall out of budget because a better-scoring, path-specific candidate took its slot: this is the intended effect, not a regression, and is visible in the per-run report.
- An older-format config (format 2, or format 3 without the new key) is extracted: behaviour is identical to today, and the new mechanism never engages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extractor's config schema MUST support declaring zero or more pathway-bias rules, each naming an existing declared pathway (`pathways` key) and an existing declared output pool (`outputs` key), without either name ever being hard-coded in extractor code.
- **FR-002**: For each declared pathway-bias rule, the extractor MUST compute, for every interneuron candidate, how strongly that candidate lies on a forward path from the rule's pathway inputs into edges whose dataset-derived sign is inhibitory and whose target is a body in the rule's output pool.
- **FR-003**: This path strength MUST only ever increase a candidate's existing flow-based ranking score for the rule's pathway budget — a candidate with zero path strength MUST keep exactly the score it has without the rule.
- **FR-004**: A candidate with zero general reachability flow MUST NOT become admissible solely because of path strength; admission still requires a positive overall score, as today.
- **FR-005**: The new scoring term MUST NOT change how any synapse's weight or sign is computed or validated — `weightRule`, `transmitterSign`, and `outputAdmission` behave exactly as they do today; weight and sign continue to come only from synapse counts and predicted transmitters in the dataset.
- **FR-006**: The number of interneurons admitted per pathway budget MUST remain governed by the existing `budget` values; this feature changes only which bodies occupy the ranked slots within that unchanged count.
- **FR-007**: A config that declares no pathway-bias rule MUST produce a selection byte-identical (apart from `provenance.createdAt`) to the same config's output before this feature existed, for every shipped config (`smallest-functional-brain.json`, `antennal-lobe-brain.json`, and `forager-brain.json` with the rule removed).
- **FR-008**: A pathway-bias rule naming a pathway id or output id the config does not declare MUST fail extraction before any file is written, with the error naming the offending id.
- **FR-009**: `extract/configs/forager-brain.json` MUST declare one pathway-bias rule: the `taste` pathway's inputs into the `forward` output pool's inhibitory in-edges.
- **FR-010**: The config schema change MUST be introduced as a versioned, backward-compatible amendment that keeps the existing format-3 forager reader working unchanged for any config that omits the new key.
- **FR-011**: `contracts/extract-config-forager.md` MUST be updated in the same change to document the new key, its validation rule, and any new failure code it introduces.
- **FR-012**: The extractor's per-run report MUST additionally print, for each declared pathway-bias rule: how many admitted interneurons it gave a positive boost to, and how many of those would not have been admitted by general reachability alone.
- **FR-013**: Extractor tests MUST cover at least: a synthetic fixture where a body on the declared path would miss its budget under reachability-only scoring but is admitted once the rule is declared; a config that omits the rule producing output unchanged from before the feature; and a config naming an undeclared pathway or output id failing with a named error before any file is written.
- **FR-014**: After implementation, Gate A (extractor structural checks), Gate B (simulator timing), and Gate C (held-out-seed behaviour) MUST be re-run on the re-extracted forager brain and the results recorded; a regression on any gate is reported as a finding, not absorbed by further tuning of the new term.

### Key Entities

- **Pathway-bias rule**: A config-declared mapping from one existing pathway (its input bodies) to one existing output pool, meaning candidates on an inhibitory-in-edge path from that pathway into that pool receive a ranking boost. Declared generically by id, not hard-coded to any specific brain's pathway or output names.
- **Path strength**: A per-candidate, dataset-derived measure of how strongly a body sits on a forward path from a rule's pathway seeds into inhibitory-signed edges terminating in the rule's output pool. Computed the same way the existing forward/backward flow is computed (ADR 003 D3) — same determinism, same seed-based propagation — restricted to the rule's declared pathway and to inhibitory-signed target edges.
- **Candidate score**: The existing per-pathway ranking score (today: reachability from the pathway's seeds combined with reachability to any output), now combined with path strength from any rule whose pathway matches the candidate's budget.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no pathway-bias rule declared, every existing shipped brain configuration extracts to output that is byte-identical (apart from `provenance.createdAt`) to its pre-feature extraction, 100% of the time.
- **SC-002**: Re-extracting the forager brain with its declared taste→forward rule changes the set of admitted taste interneurons compared to the pre-feature extraction, while the taste budget's admitted count stays exactly the same.
- **SC-003**: 100% of synapse weights and signs in the re-extracted forager brain trace to dataset synapse counts and predicted transmitters under the existing rule — none are introduced or altered by the new scoring term.
- **SC-004**: 100% of configs declaring a pathway-bias rule with an undeclared pathway or output id are caught and stopped before any file is written.
- **SC-005**: Gate A's structural checks (neuron count in range, every output pool reached, side balance, sign validity, within-run and across-run byte reproducibility) all pass on the re-extracted forager brain.
- **SC-006**: Gate C's forager behaviour metrics are measured on held-out seeds after re-extraction and reported alongside the pre-feature baseline and both null arms (random walk, size-matched random graph), stating plainly whether each metric improved, regressed, or stayed the same.

## Assumptions

- The concrete rule shipped for `forager-brain.json` is the `taste` pathway into the `forward` output pool's inhibitory in-edges — the "slow down and eat" brake explicitly flagged as out-of-scope future work in `010-output-pool-synaptic-scale`'s spec and ADR 004's open questions. This feature makes the real, traced neurons for that circuit available to the budget; it does not itself retune the LIF or world behaviour that would make the fly act on it.
- "Feed" in the request's phrasing refers to the feeding-relevant role of the `taste` pathway, not a new, separate input pathway — no new input pathway is introduced by this feature.
- "Forward" in the request's phrasing names the forager's `forward` output pool and the path direction (pathway input → output), consistent with the extractor's existing forward/backward flow terminology (ADR 003 D3) — this feature does not introduce a new flow algorithm, only a path-restricted variant of the existing one.
- The exact numeric combination of path strength and the existing reachability score (e.g. additive vs. multiplicative) is an implementation detail for the plan to choose, constrained only by FR-003 (never decreases a candidate's score) and FR-004 (zero general reachability still excludes a candidate).
- This feature changes only which interneurons are selected; it does not add, remove, or resize any input or output pool, and does not change any budget value.
- Re-tuning LIF parameters or world calibration to exploit the newly admitted neurons is separate follow-on work, out of scope here — matching how `010-output-pool-synaptic-scale` scoped its own mechanism separately from calibration.
