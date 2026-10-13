# ADR 006: Class-seeded forager brain (~11K neurons): whole functional classes, every traced neuron, ≥ 5 synapses, normalised weights

- **Status:** Proposed
- **Date:** 2026-10-12
- **Supersedes:** the withdrawn ADR 006 "Cautious forager brain (~15K neurons)" and ADR 007 "Sighted learning
  forager brain (~30K)". Both are kept only on branch `013-forager-brain-15k-lif-v2`, where the 15K brain failed
  calibration (see Context). Nothing from that branch is on `main`, so this ADR builds on `main`.
- **Extends:** [ADR 003](003-hungry-forager-brain.md) (D1–D7, W1–W5), [ADR 004](004-output-pool-synaptic-scale.md)
  (L6) and [ADR 005](005-dynamical-regime.md) (D4′, L7, L7′, L8, the staged A1/A2/B calibration). The v1 forager
  brain and its world stay valid and loadable.
- **Numbering:** extraction decisions continue at **D8** and world decisions at **W6**. The withdrawn ADR also used
  D8–D14, but those numbers never reached `main`. This ADR adds no LIF mechanism.
- **Inputs:** `FLY-NOTE-v2.md` (root-cause analysis of the 15K failure); branch 013's `specs/013-forager-brain-15k-lif-v2/
  calibration.md`, `gate-c.md` and BUG-001 to BUG-004; `malecns.md` §4–§6, §10, §12–§14; `extract/configs/
  forager-brain.json`; `.specify/memory/constitution.md`; the measurements in [Annex A](#annex-a-measurements), taken for
  this ADR.
- **Intended consumer:** `/speckit-specify` for the next brain generation (extractor and its config, one world file,
  the fidelity probe, the comparison arms).

## Context

The 15K brain on branch 013 did not reach a regime that beats the random walk. After four extraction bugs, a gate
rewrite and more than 900 calibration grid points, its best candidates found food in 0–10 % of runs on calibration
seeds. The random walk scored 23.3 %, and the v1 brain scored 51.7 % on held-out seeds. Learnings traces this to
the extraction pipeline, not to the LIF parameters. This ADR takes these lessons from it, checked against the
dataset (Annex A):

1. **Raw synapse counts with one global scale cannot work.** Under `synapseCount`, per-neuron inflow spanned 94×
   between the median and the maximum. Hubs ignite first, so the usable `synapticScale` window shrank to 0.0012–0.00245,
   and A2 pushed `outputScale` to the top of its ladder (8192) on almost every output. The branch's most robust A1 result
   (39 of 90 points, 10 robust, against at best 26 of 192 and 2 robust on raw counts) came after a switch to
   normalised weights (1.9× spread). **Lesson: weights are normalised.**
2. **Selection by sensor→output flow builds a biased core.** Scoring by pathway × output pair, made sign-aware for
   BUG-001, thinned inhibition (BUG-004). The fix was another budget (`inhibitoryClosure`), and each patch moved the
   selection again. **Lesson: select whole functional classes, and fill by plain connectivity, not by an objective.**
3. **Admission removed whole populations.** Neurons without an ACh, GABA or glutamate label were dropped with all their
   synapses: dopaminergic, octopaminergic, serotonergic and unclear bodies, about 22,000 traced bodies (Annex A1). Paths
   through them were cut and every neighbour's inflow shrank unevenly. **Lesson: keep every traced neuron and give it a
   sign.**
4. **The mushroom body was excluded.** Its 4,064 Kenyon cells, the APL feedback neuron and the DANs make up the
   brain's largest sparse, input-normalised circuit. **Lesson: the MB enters whole.**
5. **1–4 synapse edges were kept.** They are the least reliable part of the reconstruction and add diffuse recurrent
   excitation. **Lesson: `minSynapses: 5`**, the FlyWire convention, which keeps 24 % of edges and 72 % of synapses
   (Annex A1).
6. **v1 → v2 changed at least eight things at once.** The selection, admission, KC exclusion, weight rule,
   `minSynapses`, input encoding, time base and output set all changed together, so no failure could be pinned on one
   of them. **Lesson: change only the topology.** This ADR keeps the inputs, outputs, LIF core, runner, protocol and
   world of v1.
7. **Calibration ran before anyone checked the extraction.** Every bug on branch 013 surfaced as a calibration
   failure, days later. **Lesson: check extraction fidelity before calibration, without the world** (D13).

Two further changes the note proposes are **out of scope** here: a tonic baseline current with noise (note §3.5), and
readouts from larger populations (§3.6). Both change the LIF regime or the interface, and this experiment keeps both
fixed. They are recorded as Q5 and Q6.

## Behaviour loop

Unchanged from ADR 003. The brain between the pools changes; the pools do not.

```text
            hunger h (body)
                 │ gain (ADR 003 D5)
                 ▼
 odour L ──► ORN_L pool ─┐   AL (all PN, LN)                 ┌─► DNa01/DNa02 L ─┐ turn
 odour R ──► ORN_R pool ─┼─► MB (all KC, MBON, DAN, APL) ────┼─► DNa01/DNa02 R ─┘
 taste L ──► GRN_L pool ─┤   all 1,314 DNs                   ├─► DNp09 ─────────── forward
 taste R ──► GRN_R pool ─┘   + ~2,900 neurons by shared      ├─► MDN ───────────── backward
                              weight (LH, SEZ, VNC, AN)      └─► MN9 ───────────── feed
 world: on a flower, slow, feed > threshold ──► eat ──► energy ↑ ──► h ↓
```

## Decisions: extraction

### D8. Seeds are whole functional classes; the class list is fixed

A **seed class** is every `Traced` body that matches a declared filter, with no budget and no sampling. The seed set is:

| Seed                             | Filter                                                | Bodies                                 |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Antennal-lobe projection neurons | `class = ALPN`                                        | 686                                    |
| Antennal-lobe local neurons      | `class = ALLN`                                        | 420                                    |
| Other antennal-lobe neurons      | `class ∈ {ALIN, ALON}`                                | 38                                     |
| Kenyon cells                     | `class = Kenyon_Cell`                                 | 4,064                                  |
| MB output neurons                | `class = MBON`                                        | 97                                     |
| Dopaminergic neurons             | `class = DAN`                                         | 340                                    |
| Descending neurons               | `superclass = descending_neuron`                      | 1,314 (10 of them are output pools)    |
| Input pools                      | `forager-brain.json` `inputs`, verbatim (ADR 003 D1)  | odour 138 + 138, taste 442 + 448       |
| Output pools                     | `forager-brain.json` `outputs`, verbatim (ADR 003 D2) | 12 (MN9 is the 2 outside the DN class) |
| **Total**                        |                                                       | **8,127**                              |

- **The class list is the stable part of this design.** Later work on this topology changes the neuron count (D9) or
  adds channels. It does not add, drop or sample central classes. Every brain built on this ADR can be compared with
  every other at the level of whole classes.
- **The sensory and motor classes outside the channels are not seeds.** The other ORNs, GRNs, JO neurons and motor
  neurons can only be silent or sinks here. The world drives only the declared pools (Principle VI), and motor neurons
  have almost no outgoing synapses (`malecns.md` §6). They enter whole, as channels, in the I/O experiment that follows
  this one (Q4).
- **Lateral-horn neurons are not a seed class at this size.** As a seed at a fixed total, LHN (2,028 bodies by
  `type` prefix `LH`) displaces fill, and the fidelity probe gets worse: at 12K the odour steering contrast is
  −6.7e-8 with LHN seeded, against +2.4e-7 without (Annex A4). Fill brings in 172 LHNs on connectivity alone. LHN as a
  seed class is Q3, for a larger size.
- **The v1 pools are kept verbatim, known flaw included.** The taste pool's `LgLG` prefix selects leg GRNs, which make
  up most of the pool (withdrawn ADR 006, Context 1). Fixing that is a change to the inputs, so it belongs to the I/O
  experiment (Q4). Under D10's admission the pools grow from v1's 131 + 131 odour and 317 + 351 taste neurons to
  138 + 138 and 442 + 448. The filters are the same; only admission changes (Annex A2).

### D9. Fill: shared synapse weight with the seeds, to one declared neuron count

```text
shared(i) = Σ_{s ∈ seeds} [ syn(i→s) + syn(s→i) ]        over edges with syn ≥ minSynapses (D11)
fill      = top (neuronCount − |seeds|) non-seed candidates by shared(i), ties on ascending bodyId
brain     = induced subgraph on seeds ∪ fill, outputs' outgoing edges dropped (ADR 003 D2)
```

- **Candidates** are every traced body except sensory neurons (`class` in the sensory list of ADR 003 D3,
  `superclass` ending in `_sensory`) and motor neurons (`superclass ∈ {vnc_motor, cb_motor}`) that are not output pools.
  The world never drives sensory neurons, and motor neurons cannot influence any other neuron. Both would spend budget
  and do nothing.
- **`neuronCount` is the only size control.** It is **11,000**: 8,127 seeds and 2,873 fill. That is the smallest
  round size at which the fidelity probe (D13) passes. Below 10,500 the odour steering contrast has the wrong sign,
  and at 9,000 taste → feed has too (Annex A3).
- No flow, no pathway, no output-specific score. The rule is D11's threshold applied to the scoring
  as well.

Measured at 11,000 (Annex A3): **448,305 edges**, median in-degree 20 (p95 124). Fill is mostly central brain (1,774
`cb_intrinsic`, with 172 LHNs among them), plus 527 ascending neurons, 497 VNC interneurons and 49 visual projection
neurons. The APL and DPM neurons arrive by fill. Of each output pool's real input (≥ 5 synapses), the brain holds
turn 70 %, backward 77 % and feed 92 %, but forward only 25 % (Q1).

### D10. Admission: every traced neuron; GABA and glutamate inhibit, everything else excites

```jsonc
"admission": "allTraced",
"transmitterColumn": "consensus_nt",
"transmitterSign": { "gaba": -1, "glutamate": -1 },
"defaultSign": 1
```

- Every `Traced` body is admissible: **165,122**, against 143,219 under the ADR 002 rule (Annex A1). Nothing is
  removed for its transmitter.
- The sign comes from `consensus_nt`, which equals `ground_truth` on all 85,484 bodies that have one and is far less
  often `unclear` than `predicted_nt` (`malecns.md` §10). It names all 4,064 KCs acetylcholine, where `predicted_nt`
  calls 4,058 of them dopamine.
- A transmitter listed in `transmitterSign` takes that sign. Every other value takes `defaultSign`: acetylcholine,
  dopamine, octopamine, serotonin, histamine, `unclear` and null. Histamine is fast-inhibitory in the fly, but in this
  brain it covers 4 bodies (Annex A3) and its inhibitory population, the photoreceptors, is not in the brain.
- **Modulatory transmitters as fast excitation is a model choice, not a fact.** The 344 dopaminergic bodies (the DANs)
  then excite KCs and MBONs. The alternative, dropping them, cuts the MB loop and the inflow of every MB neuron. That
  is the failure in lesson 3. Q2 tracks whether a modulatory role is needed.
- Each neuron records `transmitter` (the `consensus_nt` value) in the snapshot, so every sign traces back to a dataset
  column (Principle III). Every neuron gets ±1, so ADR 003 D2's output sign 0 no longer occurs. Outputs still lose
  their outgoing edges.

### D11. Edge threshold: `minSynapses: 5`

Edges with fewer than 5 synapses are dropped when the edge table is read, before scoring (D9), selection and weights
(D12). They are absent from every later step, as though the connectome were thresholded at 5. Measured: the traced
graph falls from 25,563,096 to 6,235,649 edges and keeps 72.3 % of its synapses (Annex A1). This is declared pruning
(Principle IV). The default stays 1, so v1's config is unaffected.

### D12. Weights: `postFractionAbsolute` over the thresholded real input

```text
weight(i→j) = sign(i) × syn(i→j) / Σ_{k traced, syn(k→j) ≥ minSynapses} syn(k→j)
```

This is ADR 005 D4′ with two of its inputs set by D10 and D11. The admitted set becomes every traced body, and the
denominator sees only edges at or above the threshold. With `minSynapses: 1` and the ADR 002 admission it is exactly
v1's rule, so **no new `weightRule` value is needed**. The container's invariant (absolute inflow ≤ 1) still holds,
because the selected edges are a subset of the denominator's edges.

Measured at 11,000 (Annex A5): normalised absolute inflow per neuron has median 0.81, p99 1.00 and max ÷ median 1.2×.
The raw counts span 397×. Every neuron's input now sums to the true fraction of its thresholded connectome input that
the brain holds. Mean coverage is 0.73, against 0.48 in v1, where the denominator counted all edges.

### D13. Extraction-fidelity probe (reported, and gated by config)

Before any LIF run, the extractor compares the brain with the connectome it was cut from:

```text
A = signed, normalised weights (D10, D12) on graph G, outputs as sinks
x₀ = 1/|pool| on an input pool;  r = Σ_{t=1..8} Aᵗ x₀;  value(pool → output) = mean of r over the output pool
G ∈ { the selected brain, the whole traced graph at ≥ minSynapses }
```

It is a linear propagation that ignores thresholds. It shows **which signed routes exist**, not what the LIF will do. It
runs with `numpy` (`bincount` matrix–vector steps, eight per pool) on the 6.2M-edge thresholded graph. The report
prints both values for every (input pool, output) pair. With `fidelity: { "require": true }` the extractor fails with
`E-FIDELITY` unless:

1. **Steering:** the odour steering contrast, (odour-L → turn-left − odour-L → turn-right) − (odour-R → turn-left −
   odour-R → turn-right), has the sign of the whole graph and is at least 10 % of its magnitude.
2. **Feeding:** taste → feed has the sign of the whole graph.

At 11,000, contrast is +1.16e-7 against +8.76e-7 (13 %), and taste → feed is +3.1e-6 against +4.1e-6. Both pass. At
10,000 check 1 fails, and at 9,000 both fail (Annex A3). **Measured mismatches at 11,000 are findings, not gates:**

- odour → turn-right is negative in the brain and positive in the whole graph, for both odour sides;
- odour → forward is about 0, where the whole graph gives −4.5e-7;
- the whole graph itself gives taste → forward **+3.0e-7**: no linear brake exists even in the full connectome, with this
  taste pool (Q4).

Branch 013 had no such check. Its bugs showed up as calibration failures, days after extraction.

### D14. Extraction config (format 4) and failure codes

```jsonc
{
  "formatVersion": 4,
  "kind": "forager",
  "selection": "classSeed",
  "datasetRelease": "male-cns-v1.0", "edgeVariant": "traced-only", "expect": { … as forager-brain.json … },
  "admission": "allTraced", "transmitterColumn": "consensus_nt",
  "transmitterSign": { "gaba": -1, "glutamate": -1 }, "defaultSign": 1,
  "minSynapses": 5,
  "seeds": [
    { "class": ["ALPN", "ALLN", "ALIN", "ALON", "Kenyon_Cell", "MBON", "DAN"] },
    { "superclass": ["descending_neuron"] }
  ],
  "fill": { "neuronCount": 11000,
            "excludeClasses": [ … sensory classes, ADR 003 D3 … ], "excludeSuperclassSuffix": "_sensory",
            "excludeSuperclasses": ["vnc_motor", "cb_motor"] },
  "inputs": { … forager-brain.json, verbatim … }, "sideMatch": { … verbatim … },
  "outputs": { … verbatim … }, "modulators": [ … verbatim … ], "capabilities": { … verbatim … },
  "weightRule": "postFractionAbsolute",
  "fidelity": { "require": true, "steps": 8, "minContrastFraction": 0.1 },
  "neuronCountRange": [10000, 12000]
}
```

Input and output pools are seeds automatically. `minConfidence`, `pathways`, `flowSteps`, `budget` and `outputAdmission`
do not apply to `classSeed` and are an `E-CONFIG` if present. Format 3 configs keep their ADR 003 meaning.

| Code                   | Condition                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `E-SEED-EMPTY`         | A seed filter matches no traced body.                                                                 |
| `E-SEED-OVERFLOW`      | The seeds, pools included, exceed `fill.neuronCount`.                                                 |
| `E-TRANSMITTER-COLUMN` | `transmitterColumn` is not a column of the neurotransmitter table.                                    |
| `E-FIDELITY`           | `fidelity.require` is true and probe check 1 or 2 fails. The message names the check and both values. |

ADR 003's codes still apply (`E-POOL-EMPTY`, `E-SIDE-IMBALANCE`, `E-OUTPUT-UNREACHED`, `E-NODE-RANGE`, `E-MODULATOR`,
`E-NONDETERMINISTIC`, …). `E-SIGN` no longer occurs under `allTraced`.

## Decisions: LIF, runner, body and world

None of these change. This is the point of lesson 6.

### W6. One new world file, everything else as v1

`public/world/world-forager-11k.json` is `world-forager.json` with `brain.snapshot` pointing at
`brains/forager-brain-11k.brain`, and `brain.version: "v1"`. The runner (`fly-brain-v1.js`), the LIF core (`lif-v1.js`),
worker protocol v3, channel declaration v4, the body, the stimulus and the eating rule are unchanged. Its `lif` block is
the calibration's result, not a copy of v1's.

### W7. Snapshot: container v4, three optional additions

| Addition                                | Where      | Rule                                                                             |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `minSynapses`, `selection`, `admission` | header     | Recorded for provenance. Optional; absent means v1 behaviour (1, flow, ADR 002). |
| `transmitter`                           | per neuron | The `consensus_nt` value behind `sign` (D10). Optional, string or null.          |
| `origin`                                | per neuron | `"seed:<class or superclass>"`, `"fill"`, or absent for pool neurons. Optional.  |
| `fidelity`                              | header     | The D13 table. Optional.                                                         |

The JS reader validates the fields it knows and ignores the rest (`snapshot.js`, the snapshot-header-additions
precedent), so this needs **no container version bump**. `container-v4.md` and `extract-config-forager.md` gain the rows,
with writer and reader contract tests on both sides (AGENTS.md, Contracts).

### Cost and size (estimates, measured at Gate B)

| Brain                  | Neurons | Edges             | Per LIF step                | Snapshot                             |
| ---------------------- | ------- | ----------------- | --------------------------- | ------------------------------------ |
| v1 (shipped, measured) | 3,408   | 205,129 (all ≥ 1) | 0.05–0.11 ms                | 3.0 MB                               |
| this ADR               | 11,000  | 448,305 (≥ 5)     | ≈ 0.1–0.25 ms (edges × 2.2) | ≈ 8 MB (4.5 MB CSR, ≈ 3.5 MB header) |
| withdrawn 15K          | 16,427  | 2,078,088 (≥ 1)   | 0.19–0.94 ms                | ≈ 25 MB                              |

Six flies fit in the world tick with a wide margin, and headless experiments stay close to v1's run time.

## Calibration protocol

ADR 005 Annex B's staged A1 → A2 → B protocol, run with `/microfly-calibrate` in its own session (AGENTS.md), on
calibration seeds only:

1. **Gate A first.** No calibration starts until the extractor passes Gate A, the fidelity probe included.
2. **Start from v1's calibrated LIF block**, because the weight rule is the same (`postFractionAbsolute`). Branch 013's
   normalised trial brain found its A1 transition between `synapticScale` 5 and 10 in a scan of 1–50, which is v1's
   range.
3. **Use branch 013's corrected gates (BUG-002) and widened axes (BUG-003)**: `inhibitoryScale`, adaptation and
   `thresholdJitter` in the grid, `output` exempt from the rest gate, a per-step rate. They are properties of the
   calibration tool, not of the 15K brain.
4. **World stage with more than one A2 operating point** (`--top=3`, the default `forwardTarget` × `motorSmoothing`
   sweep). Branch 013's last run stopped after a single combination.

The skill, its engine and `scripts/compare-connectivity.mjs` exist only on branch 013. This feature brings them to
`main` with the v1 profile and drops the v2 profile, which belongs to the withdrawn brain.

## Acceptance

- **Gate A, extractor.** A v4 container with 10,000–12,000 neurons from the D14 config on v1.0. Seed classes are
  complete (every matching traced body present). Pools match `forager-brain.json`'s filters, sides are matched, and every
  output is reached. **The fidelity probe passes** (D13 checks 1–2), and its full table is printed and stored. The rerun
  is byte-identical. Python unit tests on the labelled synthetic fixture cover each new code, `allTraced` with
  `defaultSign`, the threshold applied before scoring, the D12 denominator, fill ties on `bodyId`, and the probe
  against a hand-computed fixture. JS reader tests cover the W7 additions.
- **Gate B, simulator.** `tests/lif-golden.test.mjs` passes unchanged (no LIF change). In the browser, six 11K flies at
  20 Hz keep the main thread responsive. The measured tick cost replaces the estimate above.
- **Gate C, behaviour,** on held-out seeds, ADR 003 metrics 1–5. Arms:
  1. this brain;
  2. **v1**, shipped;
  3. **v1 selection under D10–D12** (`forager-brain-v1-rules.json`: v1's flow selection, with `allTraced`,
     `minSynapses: 5` and the D12 denominator). It separates the selection rule from the edge and sign rules, which is
     the ablation `FLY-NOTE-v2.md` §3.1 asks for. Its probe passes at 3,644 neurons (Annex A4);
  4. a size-matched random graph of this brain;
  5. the random walk.

  Find must beat the random walk and the random graph. Arm 3 is reported, not gated. As always, a failed metric is a
  finding, and the fix is config or parameters, recorded with the run.

## Constitution fit

| Principle               | Fit                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static web           | No new dependency. One snapshot of ≈ 8 MB.                                                                                                                                                                                                              |
| II. One fly, one worker | Unchanged; protocol v3 unchanged.                                                                                                                                                                                                                       |
| III. Dataset brains     | Weights are synapse counts. Every sign comes from a dataset column through a rule stated in config (`transmitterSign`, `defaultSign`), recorded per neuron. Seeds are whole dataset classes. Fill is a plain connectivity score. No edge is hand-wired. |
| IV. Config extraction   | Seeds, fill size, exclusions, threshold, admission and the fidelity gate are config. No sampling, so no seed is needed. Deterministic, with explicit sort keys ending in `bodyId`.                                                                      |
| V. Pure LIF             | Unchanged.                                                                                                                                                                                                                                              |
| VI. Embodied            | Unchanged. The pools and the stimulus mapping are v1's.                                                                                                                                                                                                 |
| VII. Simplicity         | One selection rule with one size knob replaces flow, pair budgets, anchors and inhibitory closure. No LIF mechanism added.                                                                                                                              |

## Consequences

- **Size becomes a single number checked by data.** A larger brain on the same topology changes `fill.neuronCount`, and
  D13 says whether the result still carries the connectome's routes. The class list stays.
- **The mushroom body is in the brain, whole, for the first time.** It has no plasticity, so it does not learn. It is a
  sparse, APL-inhibited, odour-driven circuit whose outputs reach the DNs. Learning is a later ADR.
- **The brain is excitation-heavy, as the real neurons it holds are.** The selection's inhibitory/excitatory ratio is
  0.49, against 0.46 for the real input of the same neurons. The whole traced brain's 0.60 is not the right
  comparison, because 4,064 KCs are cholinergic (Annex A3).
- **The forward pool is the weak point.** DNp09 keeps 25 % of its real input, and 26 % of that input is visual, which
  this brain never has (Q1).
- **A finding in the full connectome, independent of selection:** with the v1 taste pool, taste raises forward in the
  linear probe, even on the whole graph. If the 11K brain does not brake, the cause is the pool definition or a
  non-linear effect, not the selection (Q4).
- **Bigger snapshot**, ≈ 8 MB against 3 MB. Re-extract after calibration decisions, not before them.

## Alternatives considered

- **Every listed class whole (~16K).** All 13 classes give 14,342 seeds and 530,540 edges at 16K (Annex A2). That was
  rejected for this step: it is the failed brain's size, and most of the extra seeds are sensory and motor neurons that
  this I/O cannot drive or read. It returns naturally when the I/O experiment declares those classes as channels.
- **~9K, accepting the wrong-sign probe.** Rejected: at 9,000 the odour steering contrast is −4.0e-8 and taste → feed is
  −1.2e-6, the opposite of the whole graph. Calibrating such a brain repeats branch 013.
- **LHN as a seed at 11–12K.** Measured worse (D8, Annex A4).
- **Flow × output pair selection (withdrawn ADR 006 D11).** It failed (Context 2).
- **`synapseCount` weights.** They failed (Context 1).
- **smallfly's controller** (speed floor, wander noise, hand-coded cast and surge, forced eating, steering read from the
  ORNs). Rejected by Principle VI. It is the reason smallfly's brain does not need to converge.

## Open questions

- **Q1. Forward input.** DNp09 keeps 25 % of its real input at 11K (39 % at 14K). If A2 again needs extreme
  `outputScale` on `forward`, options are a larger `neuronCount`, or a `forward` pool chosen from data (Q6), both config.
- **Q2. Modulators as excitation.** DANs, octopaminergic and serotonergic neurons excite. If MB activity dominates the
  rest gate, a modulatory or zero sign for `dopamine` (via `transmitterSign`) is the measured alternative. Their bodies
  stay as nodes either way.
- **Q3. LHN as a seed class.** It helps once the fill no longer has to pay for it, which means a larger size. Check
  with D13 at 13–14K.
- **Q4. The I/O experiment (next).** On this topology: fix the taste pool (mouth versus leg), and declare new channels
  from sensory classes not yet in the brain (danger ORNs, heat, JO) and new outputs. Each adds its pool neurons as
  whole classes and leaves the central seed classes as they are. The probe's taste → forward sign is the first number
  to check after fixing the pool.
- **Q5. Tonic baseline and noise** (`FLY-NOTE-v2.md` §3.5). This is the regime smallfly runs in. It is a LIF and runner
  change, kept out so that this experiment isolates topology.
- **Q6. Larger output pools from data** (§3.6). A functionally decoded set of side-selective DNs, chosen by a declared
  rule. This is an output change, so it belongs with Q4.
- **Q7. The probe is linear.** It is necessary, not sufficient. A non-linear probe (Shiu et al. 2024's GRN → MN9
  activation on the subgraph against the whole brain) would need a sugar label (ADR 003 Q2) and a whole-brain LIF run.

## Related

- [ADR 003](003-hungry-forager-brain.md): pools, modulators, world loop, the format 3 config this extends.
- [ADR 005](005-dynamical-regime.md): `postFractionAbsolute`, the staged calibration.
- `FLY-NOTE-v2.md`: root causes of the 15K failure.
- Branch `013-forager-brain-15k-lif-v2`: the withdrawn ADR 006 and 007, `calibration.md`, BUG-001 to BUG-004, the
  calibration skill.
- smallfly, `scripts/select_subgraph.py` and `export_graph.py`: the seed-and-fill rule and the sign rule this ADR adopts.
- Shiu, P.K. et al. (2024) A Drosophila computational brain model reveals sensorimotor processing. *Nature* 634, 210–219.

## Annex A: measurements

All numbers come from `data/malecns` (v1.0, traced-only edges, `Traced` bodies only), measured on 2026-10-12 with
read-only scratch scripts (`numpy`, `pyarrow`, `pandas`, `scipy`, in a throwaway environment; the extractor's
environment was not changed). The prototype follows D8–D13. It is not the extractor. Edges are between traced bodies,
self-loops dropped.

### A1. Admission and threshold

|                                                                              | Value                                                                                                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Traced bodies                                                                | 165,122                                                                                                                    |
| Admitted under ADR 002 (`predicted_nt` ∈ {ACh, GABA, Glu}, confidence ≥ 0.5) | 143,219                                                                                                                    |
| `consensus_nt` on traced bodies                                              | ACh 103,718; Glu 29,296; GABA 22,055; histamine 5,910; unclear 3,100; null 502; dopamine 392; octopamine 101; serotonin 48 |
| Traced edges / synapses                                                      | 25,563,096 / 124,024,573                                                                                                   |
| Edges ≥ 5 synapses                                                           | 6,235,649 (24.4 % of edges, 72.3 % of synapses)                                                                            |
| I/E (synapse-weighted) of the whole traced graph at ≥ 5                      | 0.60                                                                                                                       |

### A2. Class counts (traced)

| Class (smallfly mask)            | Bodies             |     | Class                                 | Bodies     |
| -------------------------------- | ------------------ | --- | ------------------------------------- | ---------- |
| ORN (`olfactory`)                | 2,639              |     | DN (`descending_neuron*`)             | 1,314      |
| ALPN                             | 686                |     | `vnc_motor`                           | 708        |
| ALLN                             | 420                |     | `cb_motor`                            | 107        |
| ALIN + ALON                      | 38                 |     | GRN (`gustatory`)                     | 1,428      |
| LHN (`type` LH*, `cb_intrinsic`) | 2,028              |     | JO (`mechanosensory`, `wind_gravity`) | 475        |
| Kenyon cells                     | 4,064              |     | MBON                                  | 97         |
| DAN                              | 340 (dopamine 338) |     | **All 13**                            | **14,342** |

All 13 classes as seeds: 357,651 edges ≥ 5 among themselves, I/E 0.23. Filled to 16,000: 530,540 edges, I/E 0.40, fill
1,658. Filled to 20,000: 834,722 edges. KC `somaSide` L 2,019 and R 2,045. MN9 (2 bodies, `cb_motor`) is
acetylcholine under `consensus_nt`.

Pools under D10 with the v1 filters: food-glomerulus ORNs side-matched 138 / 138; taste (labellar, taste peg or
`LgLG`) 442 / 448; outputs DNa01 + DNa02 2 / 2, DNp09 2, MDN 4, MN9 2.

### A3. Fill sweep (central seeds + v1 pools = 8,127)

Captured = share of the output pool's real ≥ 5 input held in the brain. I/E is for edges onto non-input neurons, with
the real input of the same neurons in brackets. Probe values are D13's (brain / whole graph at ≥ 5: contrast +8.76e-7,
taste → feed +4.1e-6, taste → forward +3.0e-7).

| Neurons    | Fill      | Edges ≥ 5   | I/E (real)      | turn / fwd / back / feed captured | Odour contrast | Taste → feed | Taste → fwd |
| ---------- | --------- | ----------- | --------------- | --------------------------------- | -------------- | ------------ | ----------- |
| 8,127      | 0         | 204,871     | —               | 0.10 / 0.00 / 0.13 / 0.22         | —              | —            | —           |
| 9,000      | 873       | 305,541     | 0.38 (0.41)     | 0.47 / 0.10 / 0.36 / 0.64         | −4.0e-8        | −1.2e-6      | −2.0e-9     |
| 10,000     | 1,873     | 377,736     | 0.45 (0.44)     | 0.64 / 0.18 / 0.67 / 0.89         | −5.7e-8        | +1.9e-6      | +3.1e-8     |
| 10,500     | 2,373     | 412,788     | —               | 0.68 / 0.22 / 0.72 / 0.91         | +6.4e-8        | +2.6e-6      | +1.5e-7     |
| **11,000** | **2,873** | **448,305** | **0.49 (0.46)** | **0.70 / 0.25 / 0.77 / 0.92**     | **+1.16e-7**   | **+3.1e-6**  | **+4.2e-7** |
| 12,000     | 3,873     | 517,300     | 0.51 (0.48)     | 0.76 / 0.31 / 0.84 / 0.93         | +2.4e-7        | +3.7e-6      | +7.0e-7     |
| 14,000     | 5,873     | 649,584     | 0.53 (0.50)     | 0.84 / 0.39 / 0.91 / 0.93         | +4.2e-7        | +4.3e-6      | +9.7e-7     |

At 11,000: in-degree median / p95 / max 20 / 124 / 2,408; 7 non-input neurons with no input edge; minimum shared weight
of a fill neuron 565. Composition: pools 1,178, ALPN 686, ALLN 420, ALIN + ALON 38, KC 4,064, MBON 97, DAN 340, DN (not
outputs) 1,304, fill 2,873. Fill by superclass: `cb_intrinsic` 1,774, `ascending_neuron` 527, `vnc_intrinsic` 497,
`visual_projection` 49, `visual_centrifugal` 14, `vnc_efferent` 10, `efferent_ascending` 2. LHNs in the brain (by fill)
172 of 2,028; APL 2; DPM 2. `consensus_nt` in the brain: ACh 8,049, GABA 1,559, Glu 694, dopamine 344, unclear 319,
octopamine 27, serotonin 4, histamine 4. The shortest excitatory path from odour to every output is 3–4 hops, and from
taste 2–3.

DNp09's real ≥ 5 input: 13,131 synapses from 744 partners; `cb_intrinsic` 71 %, `visual_projection` 26 %,
`ascending_neuron` 2 %.

### A4. Probe at 11,000, per pair, and comparison arms

Brain / whole graph at ≥ 5:

| Source → | turn-left         | turn-right        | forward           | backward          | feed              |
| -------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| odour-L  | +3.0e-7 / +1.3e-6 | −1.5e-7 / +1.3e-7 | +8.9e-9 / −4.5e-7 | −4.6e-7 / −4.9e-7 | −3.6e-8 / +4.7e-9 |
| odour-R  | +1.5e-7 / +7.7e-7 | −1.9e-7 / +4.8e-7 | −1.1e-8 / −5.0e-7 | −5.1e-7 / −5.4e-7 | −4.9e-8 / −1.9e-8 |
| taste    | +1.7e-6 / +1.9e-6 | +1.3e-6 / +1.5e-6 | +4.2e-7 / +3.0e-7 | +5.6e-7 / +3.7e-7 | +3.1e-6 / +4.1e-6 |

| Node set                                 | Neurons | Odour contrast | Taste → feed | Taste → forward |
| ---------------------------------------- | ------- | -------------- | ------------ | --------------- |
| Whole traced graph, ≥ 5                  | 165,122 | +8.76e-7       | +4.1e-6      | +3.0e-7         |
| v1 node set under D10–D12 (Gate C arm 3) | 3,644   | +6.72e-7       | +4.3e-6      | +1.2e-6         |
| This ADR, 11K                            | 11,000  | +1.16e-7       | +3.1e-6      | +4.2e-7         |
| LHN as a seed, 10,155 (no fill)          | 10,155  | −4.3e-8        | −5.6e-8      | −9.2e-9         |
| LHN as a seed, 11,000                    | 11,000  | −6.2e-8        | −1.2e-6      | +3.7e-10        |
| LHN as a seed, 12,000                    | 12,000  | −6.7e-8        | +1.9e-6      | +2.5e-8         |

At ≥ 1 synapse the same pattern holds (whole graph +5.2e-7, v1 node set +4.1e-7, 9,000 −2.7e-8, 12,000 +1.7e-7), so the
threshold does not cause the 9K failure; the thin fill does. The v1 node set, chosen by flow to the outputs, is more
faithful per neuron, which is what flow selection optimises. It is the reason for arm 3.

In the whole graph the odour → turn-left flow is diffuse: the 300 intermediate neurons with the highest forward ×
backward flow carry 31 % of it. The ones with the most flow are AL local neurons (`lLN2F`, `il3LN6`), PNs and the APL.

### A5. Normalised inflow (D12)

| Brain               | Rule                        | Median abs inflow | Max ÷ median               |
| ------------------- | --------------------------- | ----------------- | -------------------------- |
| v1 shipped          | `postFractionAbsolute`, ≥ 1 | 0.46              | 2.2×                       |
| withdrawn 15K       | `synapseCount`, ≥ 1         | 378               | 94×                        |
| withdrawn 15K trial | `postFractionAbsolute`, ≥ 1 | 0.54              | 1.9×                       |
| **this ADR, 11K**   | `postFractionAbsolute`, ≥ 5 | **0.81**          | **1.2×** (raw counts 397×) |

Coverage of the real input of non-input neurons at 11K: mean 0.73 and median 0.81 against the ≥ 5 graph; mean 0.41
against all traced edges.

### A6. v1 shipped brain, for reference

3,408 neurons; 205,129 edges, of which 71,690 (34.9 %) are ≥ 5 synapses; 1,857,265 synapses; I/E 0.64. Largest classes:
gustatory 668, ALPN 297, olfactory 262, ALLN 52, ALON 14, MBON 9, SEZPN 9.
