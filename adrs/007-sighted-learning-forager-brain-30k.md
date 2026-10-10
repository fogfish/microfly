# ADR 007: Sighted, learning forager brain (30K+ neurons): visual feature entry, a whole mushroom body, dopamine-gated plasticity

- **Status:** Proposed
- **Date:** 2026-10-10
- **Supersedes:** nothing. Builds on [ADR 006](006-cautious-forager-brain-15k.md) and keeps every rule of it (D8–D14,
  L9–L11, W6–W10) unless a decision below says otherwise. ADR 006, v1, v0 and mock brains stay loadable.
- **Numbering:** extraction **D15–D23**, LIF **L12–L14**, world and contracts **W11–W16**.
- **Inputs:** ADR 003 Q6 (learning), ADR 006 and its Annex A; `malecns.md` §6, §13–§14; the measurements in
  [Annex B](#annex-b-measurements), taken for this ADR on the same data and prototype as ADR 006.
- **Intended consumer:** `/speckit-specify` for the 30K brain, and the constitution amendment it needs (see
  [Constitution fit](#constitution-fit)).

## Context

The 15K brain (ADR 006) senses the world through chemistry, heat and touch, and it is a reflex machine: the same
stimulus always means the same thing. Three gaps remain, and the measurements say which can be closed at 30K and which
cannot.

1. **The fly is blind.** Spiders, other flies and trees are the most visible things in the world. In the 15K brain the
   escape output (DNp01, the giant fibre) receives only 68 % of its real input, and the missing part is visual. Two
   visual projection neuron (VPN) families, entered as pools, are the strongest steering and escape inputs measured in
   any brain so far (Annex B3):
   - **loom** (LPLC2, LC4) → escape: net **+0.354**, about 100× any other pathway into any output;
   - **object** (LC11, LC10a) → steering contrast **+0.0171** (turn toward), 170× food odour's +0.0001.
2. **The fly cannot learn.** Which flower is worth visiting is fixed by wiring. The mushroom body is the fly's
   learning centre, and with ADR 006 D10 it is finally admissible: 4,064 Kenyon cells (1 before), 97 MBONs and the APL.
   Its learning sites are KC → MBON synapses (61,210 edges), and its teachers are dopaminergic neurons (DANs). The DAN
   compartments are clean in the data: for the median MBON type, one DAN type provides 70 % of its DAN input (Annex B4).
   The LIF has no plasticity (ADR 003 Q6).
3. **Taste does not reach the teachers.** Forward flow from mouth taste to the reward DANs (PAM) is 0.0013, *lower*
   than to the punishment DANs (PPL, 0.0015), and odour reaches PAM 22× more strongly than taste does (Annex B5). The
   reward signal of sugar ingestion is largely non-synaptic or outside this graph, so it cannot be assumed to emerge.

What the measurements rule out at this size:

- **Heading and landmark navigation (CX).** Even with the CX core anchored (EPG, Delta7, PFL1–3, hDeltaB, ExR1), flow
  selects only 163–195 CX neurons of 2,841, and the landmark entry (MeTu1) reaches the outputs 50× more weakly than
  objects. The CX is not on the short paths from senses to these outputs. It needs its own ADR, with self-motion
  input.
- **Humidity and thirst.** Hygrosensory pools have zero lateral steering contrast (ADR 006 A4). Without a thirst state
  and a drinking rule they add nothing.
- **Retinotopic vision.** VPN bodies carry no optic-lobe column (`assignedOlHex` is null for all 30 largest VPN types),
  so vision enters per eye, not per column (Q2).

This ADR defines a brain of **about 31,000 neurons** that adds two bilateral visual channels, splits food odour into
three flower identities, adds the whole mushroom body with modulatory DANs, and gives the LIF one plasticity rule.

## Behaviour loop

```text
 flower odour  small/medium/large L/R ─► ORN ─► PN ─┬─► LH ─────────────── innate (ADR 006 paths)
                                                    └─► KC (4,064) ──► MBON (97) ──► DN
                                                         ▲   APL ┘   ▲ plastic KC→MBON (L13)
 ingestion × nutrition (body) ─► reward ─► PAM DANs ──── dopamine per compartment (L12)
 loom L/R   ─► LPLC2, LC4 ──────► DNp01 (GF) ──────────────────────────► escape
 object L/R ─► LC11, LC10a ─────► steering DNs ────────────────────────► turn toward
 + every ADR 006 channel and output
```

1. A hungry fly explores. All three flower kinds smell attractive through the innate (LH) path.
2. It eats from a flower. The body reports ingestion × the flower kind's `nutrition` as a reward signal, which drives
   PAM DANs (W13).
3. DAN activity depresses the KC → MBON synapses that were active just before (L13). The MBONs that respond to that
   flower's odour change their output, and the change reaches the DNs through the connectome.
4. After visits to a nutritious flower and to a decoy that tastes the same but feeds nothing, the fly's choice
   between their odours shifts. Whether, and in which direction, is Gate C.
5. An approaching spider looms. The giant fibre fires and the fly jumps (ADR 006 W8). Other flies are objects; the
   brain turns toward them.

## Decisions: extraction

### D15. Visual entry at the visual projection neurons, per eye

| Channel pair | Pool | Per side (somaSide L / R) | Feature (W11) | Source of the role |
|---|---|---|---|---|
| `loom-*` | `type ∈ {LPLC2, LC4}` | 165 / 146 | expansion of angular size | von Reyn et al. 2017; Ache et al. 2019 |
| `object-*` | `type ∈ {LC11, LC10a}` | 203 / 215 | small object in view | Keleş & Frye 2017 (LC11); Ribeiro et al. 2018 (LC10a) |

- **The optic lobe is out of reach** (87,544 admitted `ol_intrinsic` bodies). The world computes the feature that these
  VPN types are reported to encode, and drives the pool. This is the same kind of declared assumption as ADR 003's food
  glomeruli, made at a different layer: the input neurons are dataset neurons, the mapping is data, and the
  constitution text about "sensory neurons" needs the clarification below.
- **The side is `somaSide`.** VPNs have no `rootSide`. A lobula VPN's soma sits on the side of its eye, so the left
  pool is the left eye (Q1).
- **No side matching.** The eyes are equally reconstructed here (LC4 71/55 is the largest gap) and every VPN pool
  member gets the same drive, so imbalance shows only as a gain difference, measured in Gate A.
- Flow brings in 2,475 `ol_intrinsic` and 3,750 VPN interneurons at this budget, mostly feedback partners of the input
  VPNs. They are selected by the same pair rule (ADR 006 D11), not anchored.

### D16. Food odour splits into flower identities

ADR 006's `odour-food-*` pools become three pairs, one per flower kind, using the same six glomeruli:

| Channel pair | Glomeruli | Per side, side-matched |
|---|---|---|
| `odour-small-*` | DM1, DM4 | 50 |
| `odour-medium-*` | VA2, DM2 | 57 |
| `odour-large-*` | VM2, DP1m | 31 |

Together they are ADR 006's 138 per side, so the innate path is unchanged in total. The assignment of glomeruli to
kinds is a world-design choice (each kind needs a distinct odour code for the KCs to separate), not a claim about
those flowers. It is config.

### D17. The mushroom body is anchored whole

```jsonc
"anchors": [ { "class": "ALLN" }, { "class": "Kenyon_Cell" }, { "class": "MBON" }, { "type": "APL" } ]
```

4,064 KCs, 97 MBONs and 2 APL neurons (GABA). ADR 006 D12's KC exclusion is lifted for this kind. The APL is the KCs'
global feedback inhibition, which keeps odour codes sparse (Lin et al. 2014). Without it the 4,064 KCs, which also make
642,933 KC → KC edges among themselves, have no brake. DPM (2 bodies, predicted dopamine) is left out (Q5).

### D18. Dopaminergic neurons are modulatory, not fast

DANs have no fast sign. A new admission path admits bodies of declared classes whose chosen transmitter (ADR 006 D10) is
a declared modulator:

```jsonc
"modulatory": { "classes": ["DAN"], "transmitters": ["dopamine"] }
```

A modulatory neuron is a normal LIF neuron for its **inputs** (it receives fast edges and spikes). Its **outgoing**
synapses are not fast edges. They are written to a separate section that says how much each DAN talks to each MBON:

```text
c(k→j) = synapses(DAN k → MBON j) ÷ Σ_k' synapses(DAN k' → MBON j)       for every MBON j with DAN input
```

Measured: 332 DANs (PAM 311, PPL 21) with traced edges, 3,126 DAN → MBON edges (39,646 synapses). Every one of the 37 MBON
types receives DAN input. DAN → KC synapses (128,416 edges) are real but not used by the first plasticity rule (Q6).
81 % of all synapses into DANs come from neurons this selection already holds, so DAN activity is mostly connectome-driven,
apart from the reward drive (D20).

### D19. Plastic edges are declared, and they are KC → MBON

Every selected edge whose source is a Kenyon cell and whose target is an MBON is flagged plastic, with its compartment
being its target MBON. Measured: 61,210 edges (51,085 at `minSynapses` 2). No other edge is plastic. The rule is config:

```jsonc
"plastic": [ { "preClass": "Kenyon_Cell", "postClass": "MBON" } ]
```

### D20. Reward is a declared internal drive onto PAM DANs

Because taste flow does not reach PAM preferentially (Context 3), sugar reward is declared, the way ADR 003 D5 declared
hunger:

```jsonc
"internalInputs": [ { "id": "reward", "label": "Reward", "source": "ingestion",
                      "pool": { "class": "DAN", "typePrefixes": ["PAM"] }, "range": [0, 1] } ]
```

The body reports `ingestion × nutrition` per tick (W13). The runner drives the PAM pool with it, through L9's encoding.
Literature puts appetitive reinforcement in PAM DANs (Liu et al. 2012; Burke et al. 2012). Which PAM types carry it is
config. The default is all of them; narrowing it is Q4. **Comparison arm:** the same brain with `internalInputs: []`, where
reward can only arrive through the connectome. If that arm learns too, the declared drive is unnecessary.

Punishment (PPL1) has no declared drive in this ADR. Heat and danger reach PPL only weakly by flow (0.0009, 0.0031). This
brain learns from reward only.

### D21. Edge threshold 2 synapses

`minSynapses: 2`. At this size it keeps 92.7 % of synapses on 58 % of the edges (4,660,974 → 2,704,789), halves the step
cost (Annex B6) and cuts KC → KC edges from 642,933 to 254,220 (13.8 % → 9.4 % of all edges).

### D22. KC → KC edges are kept, and gated

KC → KC synapses exist in the data (mostly axo-axonic) and are acetylcholine by consensus. In the LIF they are recurrent
excitation inside a population of 4,064. They are kept (Principle III), and Gate B measures **KC sparseness**: the
fraction of KCs that spike during an odour presentation must be 2–15 % (sparse coding, Honegger et al. 2011). If no A1
point passes with them, the config may drop that edge class with
`"dropEdges": [ { "preClass": "Kenyon_Cell", "postClass": "Kenyon_Cell" } ]`, recorded with the run that motivated it.
That is declared pruning (Principle IV), not hand-wiring.

### D23. Budget point and config

ADR 006's format 4 with the additions above, `"kind": "forager-learning"`:

```jsonc
{
  "formatVersion": 4, "kind": "forager-learning",
  "inputs": { …ADR 006 channels, with odour-food split per D16…, "loom-left": { "types": ["LPLC2", "LC4"], "somaSide": "L" }, … },
  "outputs": { …ADR 006 outputs… },
  "pathways": { …, "loom": [ … ], "object": [ … ] },
  "budget": { "perPair": 3000 },
  "anchors": [ …D17… ],
  "excludeInterneuronClasses": [ …ADR 006 D12 without Kenyon_Cell… ],
  "modulatory": { …D18… }, "plastic": [ …D19… ], "internalInputs": [ …D20… ],
  "weightRule": "synapseCount", "minSynapses": 2,
  "neuronCountRange": [25000, 40000]
}
```

At `perPair` 3,000: **31,360 neurons, 2,704,789 edges** at `minSynapses` 2 (Annex B2). New failure codes:

| Code | Condition |
|---|---|
| `E-MODULATORY-EMPTY` | The modulatory rule admits no body, or no modulatory body has a synapse onto a selected neuron. |
| `E-PLASTIC-EMPTY` | A `plastic` rule matches no selected edge. |
| `E-COMPARTMENT` | A plastic edge's target receives no modulatory input, so it could never learn. Reported per MBON. Fatal only if every target fails. |
| `E-INTERNAL-POOL` | An `internalInputs` pool matches no admitted body. |

## Decisions: LIF core and runner

All three mechanisms are off by default; `tests/lif-golden.test.mjs` passes unchanged.

### L12. Modulator concentration per compartment (`tauModulator`, default 0 = off)

`createNetwork` accepts an optional modulatory CSR (`modOffsets`, `modTargets`, `modWeights` = `c(k→j)` of D18). Each step,
after spikes are known:

```text
m[j] ← m[j] × exp(−dt / tauModulator) + Σ_{k spiking, modulatory} c(k→j)        for every compartment target j
```

`m` is a per-neuron Float64Array, non-zero only on MBONs. A modulatory neuron has no fast outgoing edges, so it never
adds to `v`. With `tauModulator = 0` the CSR is ignored and nothing is allocated.

### L13. Dopamine-gated depression at plastic edges (`learningRate`, default 0 = off)

The best-established rule at this synapse: pairing KC activity with DAN activity depresses the KC → MBON synapse
(Hige et al. 2015), with compartment-specific time courses (Aso & Rubin 2016). Per plastic edge `e = (KC i → MBON j)`:

```text
eligibility[e] ← eligibility[e] × exp(−dt / tauEligibility) + spike[i]
w[e]           ← w[e] − learningRate × m[j] × eligibility[e] + (w0[e] − w[e]) × dt / tauRecovery
w[e]           ← clamp(w[e], 0, w0[e])                       (KC → MBON weights are excitatory)
```

| Parameter | Default | Meaning |
|---|---|---|
| `learningRate` | 0 | depression per unit of dopamine and eligibility; 0 is off |
| `tauEligibility` | 0 | KC activity trace (ms); must be > 0 when learning is on |
| `tauRecovery` | 0 | slow return to the dataset weight; 0 means no recovery |

- **Off means bit-exact.** At `learningRate` 0 the weight array is the snapshot's, untouched, and the update loop does not
  run (G1 holds).
- **On means a private copy.** The weights become a Float64 copy (as L8 already does for `inhibitoryScale ≠ 1`). Plastic
  edges are a list of CSR indices, so the spike loop is unchanged; the update visits 51,085 edges per step.
- **Deterministic.** No randomness, so the same seed and inputs give the same learned weights (Principle V).
- **Bounded.** Weights move only down from the dataset value and recover toward it. A plastic weight can never exceed
  what the connectome says.
- Learned state lives in the worker for the fly's life and is not saved. A new fly starts from the dataset weights.

### L14. Learning telemetry (runner)

Every tick the runner reports, per MBON type, the mean of `w / w0` over its plastic edges (37 numbers), and the mean `m`
per MBON type. The panel and the inspector can then show *what* the fly learned, not only that it behaves differently
(Principle V, telemetry).

### Cost (measured, Annex B6)

| Graph | Edges | ms per LIF step | ms per tick at 10 steps |
|---|---|---|---|
| 30K, `minSynapses` 1 | 4,664,257 | 0.38–2.48 | 3.8–24.8 |
| **30K, `minSynapses` 2** | **2,706,667** | 0.38–1.52 | 3.8–15.2 |

The L13 update adds about 51K multiply-adds per step, under 0.1 ms. At the worst measured point a tick costs 15 ms of
the 50 ms budget, so six flies on six workers still fit and the LIF core needs no performance rewrite. Memory per
worker: about 33 MB of CSR (Float64 weights when learning is on) plus the snapshot buffer, roughly 70 MB, about 420 MB for six
flies. Headless: one held-out arm takes 1.7–2.3 hours on one thread, and 15–20 minutes with ADR 006 W10 on eight.

## Decisions: body, world and contracts

### W11. Visual features per eye

Each eye covers the azimuths on its own side of the heading, 0° to 180° (the 360° split; binocular overlap is ignored).
For every visible thing within `vision.range` tiles (dangers, other flies, solid objects; no occlusion, Q3):

```text
α(t)        = 2 × atan(size / (2 × distance))                 angular size
loom_eye    = clamp(loomGain × Σ max(0, α(t) − α(t − 1)) / dt, 0, 1)
object_eye  = clamp(objectGain × Σ α(t) over things with α < objectMaxAngle, 0, 1)
```

Spiders are static. They loom because the fly walks toward them, which is when a real fly's giant fibre fires. Other
flies are the main objects. Sizes and gains are world config (`flies.stimuli.vision:*`), and their senses are declared by
the snapshot channels (`"sense": "vision:loom"`, `"vision:object"`; ADR 006 W6).

### W12. Flower identities and nutrition

Each edible kind declares its odour sense and a `nutrition ∈ [0, 1]` (default 1). The learning world (`world-learning.json`)
gives one kind `nutrition: 0`: it smells and tastes like food, the fly can eat it, and it feeds nothing. Energy intake
(ADR 003 W1) is multiplied by `nutrition`. `world-forager.json` keeps every kind at 1, so it stays a non-learning world.

### W13. Ingestion is a body signal

The body reports `ingestion = eating ? nutrition : 0` per tick. The world never decides what the fly learns; it reports
what the fly ate, as it reports hunger.

### W14. Snapshots are served gzip-compressed

A ~36 MB snapshot (27 MB of edges at 10 bytes each, plus about 9 MB of header for 31K neurons) is shipped as `.brain.gz`
and decompressed in the worker with `DecompressionStream('gzip')`. That is a browser built-in (and Node ≥ 18), so no
dependency and no build step. `python3 -m http.server` serves the file as-is. The CSR arrays compress to 65 % of their size
(Annex B7). The container format is unchanged; `.brain` files still load.

### W15. Contract versions

| Contract | Change |
|---|---|
| Snapshot container → **v6** | Neuron role `modulatory`; modulatory-edge section (`c(k→j)`); plastic-edge list; `internalInputs`; vision senses. v5, v4 and v3 still read. |
| Brain runner | `fly-brain-v2.js` (ADR 006) reads v5 and v6: internal inputs (D20), L14 telemetry. |
| LIF core | `lif-v1.js` gains L12 and L13, off by default. `lif-v1.md` gains their rows and the no-op guarantees. |
| Worker protocol → **v4** | `sense.state` carries `reward` (ingestion); `motor` carries the optional `learning` summary (L14). v3 kept for v1 and ADR 006 brains. |
| World config | `flies.stimuli.vision:*`, edible `nutrition`, `world-learning.json`. |
| Experiment metrics | Learning and vision metrics (Gate C). |

### W16. The brain inspector shows compartments

The inspector groups neurons by `group` (ADR 006 L10) and adds MB groups (KC, MBON, DAN, APL). With L14 telemetry it can
colour MBONs by learned depression. Format path unchanged; the inspector already draws 143K points.

## Calibration protocol

ADR 006's protocol, plus:

1. **A1 adds two gates:** KC sparseness 2–15 % under each flower odour (D22), and odour separability: the overlap of
   active KC sets between two flower kinds is below 50 %. Without it, the KCs cannot tell the kinds apart and learning
   cannot be specific.
2. **Learning is calibrated last**, on the A1-robust points: `learningRate` × `tauEligibility` × `tauRecovery`, on
   calibration seeds of `world-learning.json`. The selection criterion is the Gate C learning index on calibration
   seeds. The **plasticity-off arm** (`learningRate` 0) runs on the same seeds every time.
3. **Vision gains** (`loomGain`, `objectGain`) are set in A2 like output scales: the loom pool's rate at a set approach
   speed, the object pool's rate at a set angular size.

## Acceptance

- **Gate A, extractor.** A v6 container with 25,000–40,000 neurons; MB complete (4,064 KCs, 97 MBONs, APL); every
  plastic target with modulatory input reported; byte-identical rerun; unit tests on the labelled synthetic fixture for
  D15–D22 and each new code.
- **Gate B, simulator.** Golden test unchanged. L12/L13 unit tests: no-op default (bit-exact, no allocation); depression
  only when KC and dopamine coincide within `tauEligibility`; recovery to `w0`; bounds; same seed, same learned weights.
  KC sparseness and odour separability pass at the chosen point. In the browser: six 30K flies at 20 Hz, tick cost and
  worker memory recorded, gzip snapshot loading.
- **Gate C, behaviour,** held-out seeds, arms: 30K brain, 30K with `learningRate` 0, 30K with no reward drive, 15K brain
  (ADR 006), size-matched random graph, random walk:
  1. Every ADR 006 metric.
  2. **Loom escape:** escape events per minute while approaching a spider (closing distance within `vision.range`)
     against other times. Must exceed the random-graph arm.
  3. **Object orienting:** heading change toward other flies when one is in view, against the random walk. Reported.
  4. **Learning index** in `world-learning.json`: (visits to the nutritious kind − visits to the decoy) ÷ all visits,
     in the second half of the run minus the first half. It must be higher than the `learningRate` 0 arm. This is the
     learning claim, and it is a claim only against that arm.
  5. **Rest per group,** including KC activity at rest.

## Constitution fit

| Principle | Fit |
|---|---|
| I. Static web | gzip via a browser built-in; no new file type the static server cannot serve. |
| II. One fly, one worker | Unchanged. Each fly learns alone; no learned state crosses workers. |
| III. Dataset brains | **Needs an amendment.** Initial weights come from synapse counts, but L13 changes KC → MBON weights at runtime. The DAN modulatory role uses dataset transmitters and synapse counts only. |
| IV. Config extraction | Vision pools, anchors, modulatory and plastic rules, internal inputs are config. Deterministic. |
| V. Pure LIF | L12/L13 are pure, seeded (no randomness at all), off by default, with telemetry (L14). |
| VI. Embodied | **Needs a clarification.** Stimuli map to declared pools, but the visual pools are not sensory neurons. The world computes a per-eye feature (W11) and never steers. Reward is a body signal, like hunger. |
| VII. Simplicity | One plasticity rule, on one edge class. CX, humidity and retinotopy are deferred on measured grounds. |

**Proposed amendment (MINOR, 1.x → 1.(x+1)), to be ratified before `/speckit-plan`:**

- Principle III, add: *"Weights may change at runtime only on edges the snapshot declares plastic, only by a rule named
  and versioned in the LIF contract, and only within bounds set by the dataset weight. The snapshot's weights are the
  initial state and are never rewritten."*
- Principle VI, change "sensory neurons" to *"declared input neurons: sensory neurons, or, where the circuit upstream
  of them is outside the brain, the neurons it projects to, with the computed feature stated in the world config."*

## Consequences

- **The fly can see danger and other flies.** The strongest measured pathway in the project (loom → giant fibre) becomes
  usable, and the escape output finally gets the input it is built for.
- **Behaviour can change within a run,** for reasons the inspector can show (L14). It also makes runs harder to compare:
  every Gate C learning claim is relative to the plasticity-off arm on the same seeds.
- **New assumptions on record:** VPN features and their per-eye split (D15, W11); odour identities per flower kind
  (D16); reward through PAM as a declared drive (D20); depression-only plasticity (L13).
- **Calibration gets longer:** two more A1 gates and a learning stage. Headless runs depend on ADR 006 W10.
- **Artefacts grow** to about 36 MB raw per snapshot, about 23 MB as gzip.
- **Protocol v4 and container v6** are new, with the older versions kept.

## Alternatives considered

- **A reduced optic lobe** (a subset of columns). Rejected: the column structure is the computation, VPN bodies have no
  column labels to sample by, and 87K bodies do not fit.
- **The CX for navigation.** Measured and deferred (Context).
- **Learning everywhere** (Hebbian on all edges). Rejected: no data for the sign or rule outside the MB, and it would
  let behaviour drift away from the connectome everywhere (Principle III).
- **DANs as fast inhibitory or excitatory edges.** Rejected: dopamine acts through receptors on a slow time scale, and
  `predicted_nt` gives no fast sign. ADR 003 D5 made the same choice for the peptidergic hunger cells.
- **Reward from the connectome only.** Kept as a comparison arm (D20), not as the default, because taste does not reach
  PAM preferentially in this graph.

## Open questions

- **Q1. Eye side of VPNs.** `somaSide` is taken as the eye's side. Check that LPLC2 and LC4 dendrites are in the
  ipsilateral lobula plate and lobula before Gate A (from synapse positions in `syn-partners`).
- **Q2. Retinotopy.** Per-eye pools ignore where in the field an object is. A frontal/lateral split could come from the
  centroid of each VPN's input synapses (`syn-points`, batched read). That is a later refinement.
- **Q3. Occlusion.** W11 ignores it. Trees hide spiders in a real meadow.
- **Q4. Which PAM types carry sugar reward.** All 311 PAMs are driven by default. Narrowing to the appetitive types is a
  config change.
- **Q5. DPM.** Two bodies, predicted dopamine (its real transmitter is debated). Left out.
- **Q6. DAN → KC synapses.** 128,416 edges are not used by L13. Some models put the dopamine action on the KC axon. If
  learning fails at the MBON-side rule, the compartment could be defined through DAN → KC instead.
- **Q7. APL as a spiking neuron.** The real APL is non-spiking and graded. If the KC sparseness gate fails with a
  spiking APL, a graded-output mechanism for declared neurons is the next LIF question.
- **Q8. Male-specific circuits.** The dataset is male; 2,611 bodies are `fru_high`. The world has female and male flies.
  Courtship is out of scope here.

## Related

- [ADR 006](006-cautious-forager-brain-15k.md): every extraction, runner and world rule this ADR extends.
- [ADR 003](003-hungry-forager-brain.md): Q6 (learning), D5 (declared modulation precedent).
- `malecns.md` §6 and §13: mushroom body, VPN families.
- Hige, T. et al. (2015) Heterosynaptic plasticity underlies aversive olfactory learning in *Drosophila*. *Neuron* 88.
- Aso, Y. & Rubin, G.M. (2016) Dopaminergic neurons write and update memories with cell-type-specific rules. *eLife* 5.

## Annex B: measurements

Same data, date (2026-10-09), environment and prototype as ADR 006 Annex A, with the 30K pools, anchors (ALLN, KC, MBON,
APL, and the CX core types listed in Context; 4,696 bodies) and `perPair` budgets.

### B1. Visual pools and retinotopy

| Type | Traced | Admitted | somaSide L / R | Transmitter |
|---|---|---|---|---|
| LPLC2 | 185 | 185 | 94 / 91 | ACh |
| LC4 | 126 | 126 | 71 / 55 | ACh |
| LC11 | 143 | 143 | 68 / 75 | ACh |
| LC10a | 275 | 275 | 135 / 140 | ACh |
| MeTu1 (landmark, not used) | 250 | 249 | 125 / 124 | ACh |

`assignedOlHex1` is null for every body of the 30 largest `visual_projection` types (0 of 30 types with any coverage).

### B2. Selection sweep (no brake budget)

| `perPair` | Neurons | Edges ≥ 1 | Edges ≥ 2 | In-degree median / p95 / max | Inflow coverage mean / median | Exc / inh |
|---|---|---|---|---|---|---|
| 2,000 | 25,652 | 3,535,861 | 2,041,764 | 116 / 363 / 2,619 | 0.602 / 0.627 | 16,933 / 8,719 |
| **3,000** | **31,360** | **4,660,974** | **2,704,789** | 121 / 402 / 2,663 | 0.641 / 0.696 | 20,155 / 11,205 |
| 4,500 | 38,323 | 6,122,284 | 3,569,297 | 128 / 437 / 2,736 | 0.693 / 0.783 | 24,149 / 14,174 |

Composition at 3,000: `cb_intrinsic` 13,810, KC 4,064, `visual_projection` 3,750, `vnc_intrinsic` 2,906, `ol_intrinsic`
2,475, ascending 1,090, descending 725, ALPN 552, gustatory 461, ALLN 372, olfactory 348, tactile 186, CX 169, MBON 97.
Synapse share kept at ≥ 2 synapses: 0.927. A signed brake budget of 1,500 adds 11 neurons (31,371), redundant as at
15K. In that run, the output pools' real input captured is: turn 0.969 / 0.974, forward 0.969, backward 0.990, feed
0.974, **escape 0.973** (0.677 at 15K).

### B3. Signed probes (method: ADR 006 A4)

| Source | Turn contrast (L − R) | Into escape | Into forward | Reach, signed (12 steps) |
|---|---|---|---|---|
| loom | −0.00315 (away) | **+0.3538** | +0.0052 | 0.365 |
| object | **+0.01713** (toward) | −0.0003 | +0.0044 | 0.028 |
| landmark (MeTu1) | +0.00013 | — | — | 0.00057 |
| food odour (reference) | +0.00010 | −0.0000 | −0.0000 | 0.00049 |
| mouth taste | +0.00014 | −0.0001 | −0.0006 | 0.00573 |

Loom and object reach outputs at hop 1, every other channel at hop 2–3. For every ADR 006 channel, the turn contrast and
the brake/feed probe agree with the 15K selection within 0.00001; unsigned reach is 10–80 % higher (for example food
odour 0.0109 → 0.0196), because the larger graph adds parallel paths. Adding the MB and vision does not change the sign
of any 15K path.

### B4. Mushroom body wiring (traced-only, admitted and modulatory bodies)

| Quantity | Value |
|---|---|
| KC → MBON edges / synapses | 61,210 / 463,640 (51,085 edges at ≥ 2) |
| KC → KC edges | 642,933 (254,220 at ≥ 2); 13.8 % of 30K edges (9.4 % at ≥ 2) |
| APL → KC edges in the 30K selection | 4,633 |
| DAN → MBON edges / synapses | 3,126 / 39,646 |
| DAN → KC edges / synapses | 128,416 / 224,343 |
| MBON types with DAN input | 37 of 37 |
| Share of the top DAN type in an MBON type's DAN input | median 0.70 |
| DANs with traced edges | PAM 311, PPL 21 |
| Synapses into DANs from 30K-selected neurons | 80.8 % |
| Synapses into DANs directly from GRNs | 0 |
| Transmitters | KC: `predicted_nt` dopamine 4,058, `consensus_nt` ACh 4,064. DAN: `ground_truth` dopamine 338. APL: GABA. DPM: predicted dopamine. |

### B5. Forward flow into DANs and MBONs (6 steps, mean per neuron)

| Source | PAM | PPL | MBON |
|---|---|---|---|
| food odour | 0.0288 | 0.0222 | 0.0295 |
| danger odour | 0.0037 | 0.0031 | 0.0036 |
| heat | 0.0008 | 0.0009 | 0.0008 |
| mouth taste | 0.0013 | 0.0015 | 0.0011 |
| leg taste | 0.0016 | 0.0020 | 0.0011 |
| loom | 0.0003 | 0.0007 | 0.0004 |
| object | 0.0011 | 0.0014 | 0.0008 |
| humidity | 0.0022 | 0.0024 | 0.0022 |

### B6. Cost (method and settings: ADR 006 A6)

| Graph | `synapticScale` | Drive | Activity | ms / step |
|---|---|---|---|---|
| 30K ≥ 1 syn | 10 / 25 / 50 | 0.02 | 0.0 / 8.7 / 11.4 % | 0.383 / 1.999 / 2.427 |
| 30K ≥ 1 syn | 10 / 25 / 50 | 0.06 | 2.5 / 8.8 / 11.4 % | 0.864 / 1.962 / 2.476 |
| 30K ≥ 2 syn | 10 / 25 / 50 | 0.02 | 0.0 / 7.3 / 11.0 % | 0.383 / 1.109 / 1.517 |
| 30K ≥ 2 syn | 10 / 25 / 50 | 0.06 | 0.9 / 8.0 / 11.0 % | 0.501 / 1.211 / 1.501 |

### B7. Size

CSR arrays (offsets, targets, weights) at ≥ 2 synapses: 21,655,936 bytes raw, 14,032,223 gzip −9 (65 %). For comparison, the
15K arrays at ≥ 1 synapse: 16,182,792 raw, 9,953,744 gzip (62 %). The snapshot also holds synapse counts (2 bytes per edge)
and the JSON header, which compresses better than the arrays.
