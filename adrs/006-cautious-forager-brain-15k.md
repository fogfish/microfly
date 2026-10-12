# ADR 006: Cautious forager brain (~15K neurons): six bilateral senses, pathway × output selection, synapse-count weights

- **Status:** Proposed
- **Date:** 2026-10-10
- **Supersedes:** nothing. Extends [ADR 003](003-hungry-forager-brain.md) (D1–D7, L1–L5, W1–W5),
  [ADR 004](004-output-pool-synaptic-scale.md) (L6) and [ADR 005](005-dynamical-regime.md) (D4′, L7, L7′, L8, the
  staged A1/A2/B calibration). The v1 forager brain and its world stay valid and loadable.
- **Numbering:** extraction decisions continue at **D8** (ADR 003 used D1–D7, ADR 005 reused D4′/D6), LIF mechanisms
  at **L9** (L1–L8 are taken), world and contract decisions at **W6**.
- **Inputs:** `malecns.md` §4–§6, §10, §12–§14; ADR 003–005 and their annexes; `specs/008-hungry-forager-brain/
  calibration.md` (2026-10-09 entries); `specs/008-hungry-forager-brain/bugs/BUG-002.md` (the brake);
  `.specify/memory/constitution.md`; the measurements in [Annex A](#annex-a-measurements), taken for this ADR.
- **Intended consumer:** `/speckit-specify` for the next brain generation (extractor, runner, world, contracts),
  and [ADR 007](007-sighted-learning-forager-brain-30k.md), which builds the 30K brain on the rules defined here.

## Context

The v1 forager brain (3,408 neurons, 205,129 edges) is at the limit of what its rules allow. ADR 005 Annex B and the
2026-10-09 calibration record the end state: on held-out seeds it finds food (51.7 % against 23.3 % for the random
walk), but it never brakes on a flower, so it never eats; and its rest is either silent or ignited, never quiet and
reactive. Both were left to "the next brain generation". This ADR is that generation. Its measurements (Annex A) find
that the two failures are properties of the **interface and the selection**, not of the LIF parameters:

1. **The "taste" pool is mostly legs.** ADR 003 D1 selects taste by subclass *or* the type prefix `LgLG`. `LgLG` is
   **leg** gustatory: every one of the 487 admitted `LgLG` bodies has `subclass = leg bristle` and enters through a leg
   nerve (Annex A2). Of the 668 bodies in the shipped taste pools, 487 (73 %) are leg GRNs from all six legs and
   only 181 are labellar or taste-peg neurons. (`malecns.md` §14 lists `LgLG` as labellar; that line is wrong.)
2. **There is no brake path in the shipped subgraph.** A signed linear probe (Annex A4) gives mouth taste → forward
   **0.0000** in the shipped brain, while the leg members drive forward **+0.0005**. The world feeds one taste value to
   the whole pool, so taste *raises* forward, which is what ADR 005 B.4 observed in the LIF.
3. **Leg taste has no route.** Leg GRNs end in the ventral nerve cord. The shipped brain holds 82 VNC interneurons
   and 126 ascending neurons, so most of its taste pool feeds a truncated graph.
4. **Rest-stabilising inhibition is under-sampled.** The shipped brain holds 52 of the 372 admissible antennal-lobe
   local neurons (ALLN). ADR 005 B.3 suspected exactly this as the reason no quiet, reactive rest exists.
5. **Admission throws populations away.** The ADR 002 rule reads only `predicted_nt`. That keeps 1 of 4,064 Kenyon
   cells (predicted dopamine), 25 of 708 VNC motor neurons and 2,487 of 2,950 CX neurons. The dataset's own
   `consensus_nt` column names KCs acetylcholine (4,064/4,064) and recovers most of the rest (Annex A1).
6. **The world has more than the fly can sense.** Spiders, lanterns, water and walls exist in `world-forager.json`
   and `layout.js`, but the fly senses only flower odour and flower taste.

This ADR defines a brain of **about 15,000 connectome neurons** with **12 input channels** (six bilateral senses) and
**6 output channels**. It defines the selection rule that makes the brake appear from data, the weight and input
encoding that a brain of this size needs, and the world and contract changes.

## Behaviour loop

```text
                     hunger h (body)
                        │ gain (ADR 003 D5)
                        ▼
 food odour L/R ─► ORN pools ──┐                         ┌─► DNa01/DNa02 L ─┐ turn
 danger odour L/R ► ORN_V/DA2 ─┤                         ├─► DNa01/DNa02 R ─┘
 heat L/R ──────► TRN_VP2 ─────┤   ~14K interneurons      ├─► DNp09, DNg100 ──── forward
 mouth taste L/R ► labellar ───┼─► AL, LH, SEZ, VNC, AN ──┼─► MDN ───────────── backward
 leg taste L/R ──► front-leg ──┤   (pathway × output       ├─► MN9 ───────────── feed
 touch L/R ──────► front-leg ──┘    flow selection)       └─► DNp01 (GF) ────── escape
                   tactile
 world: flower under mouth, slow, feed > threshold ──► eat ──► energy ↑ ──► h ↓
        escape > threshold ──► jump (physics)
```

1. **Find:** as v1, food odour steers. Front-leg taste reaches a flower half a body length before the mouth.
2. **Brake and eat:** mouth taste inhibits the forward DNs and excites MN9 (measured sign, Annex A4). Leg taste drives
   backing and turning toward its side, which keeps the fly on the flower.
3. **Avoid:** danger odour (spiders) and heat (lanterns) reach the steering DNs. Their sign is a Gate C result, not
   an assumption. The connectome gives heat an avoidance sign (Annex A4).
4. **Touch:** a blocked front leg turns the fly. The measured sign is toward the touched side, a finding Gate C
   checks against wall-following.
5. **Escape:** the giant fibre (DNp01) is an output. In this brain its input comes from touch and taste paths only.
   Its visual input arrives with ADR 007.

## Decisions: extraction

### D8. Input pools: six bilateral senses, chosen by declared filters

| Channel pair | Filter (config) | Admitted per side | Side rule | Source of the role |
|---|---|---|---|---|
| `odour-food-*` | `class = olfactory`, `type ∈ ORN_{DM1, DM2, DM4, VA2, VM2, DP1m}`, `rootSide` | 138 / 138 | matched per type | ADR 003 D1 (unchanged list) |
| `odour-danger-*` | `class = olfactory`, `type ∈ {ORN_V, ORN_DA2}`, `rootSide` | 36 / 36 | matched per type | CO₂ (Suh et al. 2004), geosmin (Stensmyr et al. 2012) |
| `heat-*` | `type = TRN_VP2`, `rootSide` | 3 / 3 | matched | arista hot cells (Gallio et al. 2011; Marin et al. 2020) |
| `taste-mouth-*` | `class = gustatory`, `subclass ∈ {labellar bristle, taste peg}`, `rootSide` | 106 / 106 | none | labellum and taste pegs |
| `taste-leg-*` | `class = gustatory`, `subclass = leg bristle`, `entryNerve = ProLN`, `rootSide` | 123 / 126 | none | front-leg GRNs (Thoma et al. 2016: leg sugar GRNs stop walking) |
| `touch-*` | `class = mechanosensory_tactile`, `entryNerve = ProLN`, `rootSide` | 93 / 93 | matched | front-leg bristles |

- **`typePrefixes: ["LgLG"]` is dropped** from the mouth pool (Context 1). Mid- and hind-leg GRNs are not inputs:
  in the world all legs stand on the same cell as the mouth, and in the shipped brain they are the members that
  drive forward up (Annex A4). The exclusion rule (D12) keeps them, like every sensory body, out of the
  interneurons too.
- **A body may be in one pool only** (`E-CONFIG`, as today). The prototype checks this; the ADR 003 pools did not
  overlap only because there was one taste pair.
- **Heat pools are three neurons a side.** That is the anatomy (three hot cells per arista), not a sampling
  artefact. Per neuron, heat reaches the outputs ten times more strongly than odour (Annex A5).
- Hygrosensory pools (VP4 dry, VP5/VP1 moist) were measured and **left out**: their left/right steering contrast is
  zero within 12 hops (Annex A4). Without a thirst state and a drinking rule they would only add noise. ADR 007 Q
  records them.

### D9. Output pools: six channels, larger pools where the data has them

| Output | Pool | Drive | Neurons | Role source |
|---|---|---|---|---|
| `turn-left` / `turn-right` | `type ∈ {DNa01, DNa02}`, `somaSide` | `turnLeft` / `turnRight` | 2 / 2 | ADR 003 D2 |
| `forward` | `type ∈ {DNp09, DNg100}` | `forward` | 4 | DNp09: ADR 003 D2. DNg100: forward-walking candidate (Q2) |
| `backward` | `type = MDN` | `backward` | 4 | ADR 003 D2 |
| `feed` | `type = MN9` | `feed` | 2 | ADR 003 D2 |
| `escape` | `type = DNp01` (giant fibre) | `escape` (new) | 2 | von Reyn et al. 2014 |

The ADR 003 output admission rule stays (an output needs only incoming edges, `sign = 0`). Under D10 it is needed
less: MN9 L is now admitted with `consensus_nt = acetylcholine`.

### D10. Admission: transmitter source in a declared order

New config key, default absent (ADR 002 behaviour):

```jsonc
"transmitterSource": ["ground_truth", "consensus_nt", "predicted_nt"]
```

The first column, in order, that names a transmitter in `transmitterSign` gives the sign. `predicted_nt` keeps its
`minConfidence` test; `ground_truth` and `consensus_nt` carry no confidence and are taken as given. The chosen column is
written per neuron (`transmitterSource`) so every sign stays traceable (Principle III).

Measured effect (Annex A1): 143,219 → **155,771** admitted bodies. Kenyon cells 1 → 4,064, CX 2,487 → 2,841, ALLN 329 →
372, VNC motor neurons 25 → 326. Dopamine, octopamine and serotonin bodies (839) still have no fast sign and stay
out; ADR 007 gives dopamine a modulatory role.

### D11. Interneurons: pathway × output pair budgets

ADR 003 D3 ranks interneurons per input pathway against **one** backward flow to all outputs pooled. That pooled flow
is dominated by the outputs with the most input (MDN: 842 edges against MN9's 193 in Gate A), so a small output's
specific upstream circuit has no guaranteed place. With six pathways and six outputs the rule becomes a grid:

```text
F_p(i) = forward flow from input pathway p         (ADR 003 D3, steps = flowSteps)
B_o(i) = backward flow to output group o           (turn, forward, backward, feed, escape)
score_{p,o}(i) = √(F_p(i) · B_o(i))
interneurons = ⋃_{p,o} top_k(score_{p,o})  (ties on ascending bodyId)  ∪ anchors (D12) − exclusions (D12)
```

`budget.perPair = k`. At **k = 2,400** with `flowSteps = 6`: **15,351 neurons, 2,034,266 edges** (Annex A3). Every output
pool then receives 90–98 % of its real admitted input synapses from the selection, except `escape` (68 %), whose
missing input is visual (ADR 007).

**The brake comes from this rule, not from a dedicated term.** A signed "brake budget" (neurons with taste flow and
net-inhibitory backward flow to `forward`) was prototyped. At k = 2,400 it adds 3 neurons and changes nothing measurable:
the pair `(taste-mouth, forward)` already selects them (Annex A4, ablation). It is not part of this design (Alternatives).

### D12. Anchors and whole-or-none exclusions

```jsonc
"anchors":  [ { "class": "ALLN" } ],
"excludeInterneuronClasses": ["olfactory", "gustatory", "hygrosensory", "thermosensory", "mechanosensory",
                              "mechanosensory_tactile", "mechanosensory_proprioceptive", "chemosensory",
                              "unknown_sensory", "Kenyon_Cell"],
"excludeInterneuronSuperclassSuffix": "_sensory"
```

- **Anchors** are whole populations admitted regardless of score. The only anchor here is the antennal-lobe local
  neuron class (372 bodies; the shipped brain has 52). It tests ADR 005 B.3's hypothesis that a quiet, reactive rest
  needs the AL's own inhibition. An anchor is config; Gate B's rest gate decides whether it stays.
- **The mushroom body enters whole or not at all.** Once D10 admits Kenyon cells, flow pulls in 1,190 of 4,064 KCs
  and 59 of 97 MBONs at this budget (Annex A3). A random third of the KCs with no APL feedback and no plasticity is
  a block of odour-driven excitation with no function. KCs are excluded here; ADR 007 adds the MB whole.

### D13. Weights: synapse count, and a declared edge threshold

New `weightRule` value **`synapseCount`**, beside `postFraction` and `postFractionAbsolute` (an added value, not a
version bump, the ADR 005 D4′ precedent):

```text
weight(i→j) = sign(i) × synapses(i→j)
```

`synapticScale` then means **potential per synapse**. This is the rule of the only published LIF model that runs the
whole fly brain and predicts sensorimotor activation, including sugar GRN → MN9 (Shiu et al. 2024, FlyWire, 127K neurons).
It removes the per-neuron normalisation that ADR 004 and ADR 005 spent two features compensating for (one scale for a
2-neuron output against a recurrent bulk). `postFractionAbsolute` = `synapseCount / realInput(j)`, so the two rules
differ only by a per-target factor; both stay selectable, and Gate B calibrates `synapseCount` first, with
`postFractionAbsolute` as the comparison arm.

New config key `minSynapses` (default 1, today's behaviour): edges below it are dropped before weights are computed.
This is declared pruning (Principle IV). At 15K: `minSynapses: 2` keeps 94.1 % of synapses on 60 % of the edges and cuts
step cost by about a third (Annex A3, A6). **The 15K config uses 1**: the cost fits (L11), and the 1-synapse edges are
6 % of the drive. ADR 007 uses 2.

### D14. Extraction config (format 4) and failure codes

```jsonc
{
  "formatVersion": 4,
  "kind": "forager",
  "datasetRelease": "male-cns-v1.0", "edgeVariant": "traced-only", "expect": { … as today … },
  "transmitterSign": { "acetylcholine": 1, "gaba": -1, "glutamate": -1 },
  "transmitterSource": ["ground_truth", "consensus_nt", "predicted_nt"],
  "minConfidence": 0.5,
  "inputs":  { "odour-food-left": { … D8 … }, …, "touch-right": { … } },          // 12 channels
  "sideMatch": { "odour-food": true, "odour-danger": true, "heat": true, "taste-mouth": false,
                 "taste-leg": false, "touch": true },
  "outputs": { "turn-left": { … }, …, "escape": { "types": ["DNp01"], "drive": "escape" } },
  "pathways": { "odour-food": ["odour-food-left", "odour-food-right"], …, "touch": ["touch-left", "touch-right"] },
  "outputGroups": { "turn": ["turn-left", "turn-right"], "forward": ["forward"], "backward": ["backward"],
                    "feed": ["feed"], "escape": ["escape"] },
  "flowSteps": 6,
  "budget": { "perPair": 2400 },
  "anchors": [ { "class": "ALLN" } ],
  "excludeInterneuronClasses": [ … D12 … ], "excludeInterneuronSuperclassSuffix": "_sensory",
  "weightRule": "synapseCount", "minSynapses": 1,
  "modulators": [ hunger → odour-food (0.5–1.5), hunger → taste-mouth, taste-leg (0.1–1.5) ],
  "capabilities": { "channels": { "inputs": [ { "id": …, "side": …, "sense": … } ], "outputs": [ … ] } },
  "neuronCountRange": [12000, 18000]
}
```

`formatVersion: 3` configs keep their ADR 003 meaning. New failure codes:

| Code | Condition |
|---|---|
| `E-POOL-OVERLAP` | A body matches two input or output pools (today folded into `E-CONFIG`). |
| `E-ANCHOR-EMPTY` | An anchor matches no admitted body. |
| `E-TRANSMITTER-SOURCE` | `transmitterSource` names a column that is absent, or is empty. |
| `E-PAIR-EMPTY` | A (pathway, output group) pair has no candidate with a positive score. |

## Decisions: LIF core and runner

Every mechanism is off by default. `tests/lif-golden.test.mjs` passes unchanged (G1).

### L9. Poisson input encoding (runner, default `"current"`)

Today an input neuron receives a constant current `gain × value` (ADR 003 L4). Every member of a pool gets the same
drive, so the pool's only variability is L7 noise, which ignited the bulk (ADR 005 B.3). Real receptor neurons fire
irregularly, with a spontaneous rate at rest and a graded rate under stimulus. New runner parameters:

```jsonc
"input": { "encoding": "poisson", "rate": [0.005, 0.15], "weight": 1.2 }
// per LIF step and input neuron:  p = r0 + (r1 − r0) × clamp(gain_c(h) × value_c, 0, 1)
//                                  external[i] = weight × Bernoulli(p)          (one draw per neuron per step)
```

- **Rest is spontaneous, not tonic or silent.** At `value = 0`, ORNs fire at `r0`. With dt read as 1 ms, 0.005 is
  5 Hz, the order of measured ORN spontaneous rates (de Bruyne et al. 2001). `r1 = 0.15` is the 150 Hz class of
  sensory drive Shiu et al. 2024 used to activate sensory neurons.
- **One PRNG stream per fly**, created from the brain seed and separate from the jitter and noise streams (as ADR 005
  G14 keeps those two apart). The same seed gives the same spikes (Principle V).
- `weight` is chosen so that one input spike is one supra-threshold event for the receptor neuron itself.
- `"encoding": "current"` is exactly ADR 003 L4. L9 lives in the runner (`fly-brain-v2.js`), so the LIF core is not
  touched.

L9 replaces L7′'s job ("input-only noise as the source of spontaneous activity") with a mechanism that does not have a
sharp ignition threshold in its amplitude (ADR 005 B.3, run 5: 0.07 silent, 0.08 ignited). L7/L7′ stay available.

### L10. Region groups and per-group gain (core, default off)

The 15K brain spans the antennal lobe, lateral horn, SEZ, VNC and the DNs. ADR 005 showed that the network ignites at
the gain the DNs need; with five regions, the first question is *where* it ignites. The snapshot gains a per-neuron
`group` (container v5, W9), derived from data:

| Group | Rule (first match) |
|---|---|
| `input` | member of an input pool |
| `output` | member of an output pool |
| `al` | `class ∈ {ALLN, ALPN, ALIN, ALON}` |
| `vnc` | `superclass ∈ {vnc_intrinsic, vnc_motor, vnc_efferent, ascending_neuron}` |
| `dn` | `superclass = descending_neuron` |
| `central` | everything else |

The runner reports activity per group (telemetry, calibration diagnostics). The core gains one optional parameter,
`groupGain: { "<group>": g }` (default `{}`): edges into a neuron of a listed group use `synapticScale × g`, resolved once
in `createNetwork` into a per-neuron scale, the same pattern and the same single branch as L6. **Use is gated by
evidence:** the calibration may set `groupGain` only for a group whose rest activity fails the A1 rest gate while the
other groups pass. L6 (`outputScale`) is the `output` row of the same idea and stays as it is.

### L11. Time base made explicit (parameters, no new mechanism)

`dt` has been "time units". Read as 1 ms (so `tau 20` is the usual 20 ms membrane constant), the shipped
`stepsPerTick 5` runs 5 ms of brain per 50 ms world tick, a 10× slow-down that calibration absorbed silently. This ADR
documents the unit and sets the 15K starting point from published values instead of a blind grid:

| Parameter | Start | Reason |
|---|---|---|
| `dt` | 1 (ms) | documented unit |
| `tau` | 20 | Shiu et al. 2024 |
| `refractorySteps` | 2 | 2.2 ms (Shiu et al. 2024) |
| `tauSyn` (L1) | 5 | 5 ms synaptic decay (Shiu et al. 2024) |
| `synapticScale` | 0.04 | 0.275 mV per synapse against a 7 mV rest-to-threshold gap (Shiu et al. 2024), threshold = 1 |
| `stepsPerTick` | 10 | 10 ms brain per tick (5× slow-down) |

Real time (`stepsPerTick 50`) costs 30–47 ms per tick at 15K (Annex A6), the whole 50 ms budget, so it is out of reach.
The Shiu values above are quoted from the paper's methods and must be checked against it before calibration starts (Q1).

### Cost (measured, Annex A6)

Node 25, Apple M2 Pro, `lif-v1.js` unchanged, shipped LIF settings:

| Brain | Neurons | Edges | Activity | ms per LIF step | ms per tick at 10 steps |
|---|---|---|---|---|---|
| v1 shipped | 3,408 | 205,129 | 2–11 % | 0.05–0.11 | 0.5–1.1 |
| 15K, `minSynapses 1` | 15,354 | 2,035,233 | 7–12 % | 0.19–0.94 | 1.9–9.4 |
| 15K, `minSynapses 2` | 15,354 | 1,228,273 | 6–11 % | 0.20–0.62 | 2.0–6.2 |

A world tick has 50 ms. Six flies on six workers fit with five times headroom at the worst measured point, so **the LIF
core needs no performance work at 15K**. Memory: about 16–24 MB of CSR arrays plus the snapshot buffer per worker.
The real cost is headless: one `compare-baseline` arm (30 seeds × 6 flies × 3,000 ticks) takes 55–85 minutes on one
thread, against about 5 today (W10).

## Decisions: body, world and contracts

### W6. Stimuli are declared sources; channels declare what they sense

The world must not hard-code "input 0 is left odour" (`senseForagerFly` does today). Each input channel in the
snapshot declares a `sense` and a body `site`; the world config declares which objects emit which stimulus:

```jsonc
// snapshot channel (container v5)
{ "id": "odour-danger-left", "side": "L", "sense": "odour:danger", "site": "antenna" }
// world config, flies.stimuli
"stimuli": {
  "odour:food":   { "from": "edibles", "reach": "byKind", "scaleBy": "stock" },     // ADR 003 W3, spec 009
  "odour:danger": { "from": "dangers", "kinds": ["spider"],  "radius": 4 },
  "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
  "taste":        { "from": "edibles", "scaleBy": "stock" },
  "touch":        { "from": "blocked" }
},
"body": { "sites": { "antenna": 0.5, "mouth": 0, "front-leg": 0.4 } }
```

Every sense reuses `falloff` (`stimulus.js`). The mapping is data on both sides (Principle VI). A sense that a brain
declares and the world does not define is a validation error at load, not a silent zero.

### W7. Front legs touch and taste ahead of the mouth

`front-leg` sites sit `offset` tiles ahead of the body and to each side. `taste-leg-*` reads the flower stock at its
leg cell. `touch-*` is 1 when its leg cell is not walkable (water, solid object, map edge), else 0. Leg taste is
therefore lateralised and arrives before mouth taste, which is when a real fly starts to stop.

### W8. Escape is physics

When the `escape` drive is above `body.escape.threshold` and the fly is not in `cooldown`, the body moves `distance`
tiles along its heading in one tick (blocked moves stop at the first non-walkable cell, as `pick` does). The world never
decides when to escape (Principle VI). Defaults: threshold 0.5, distance 1.5, cooldown 2 s.

### W9. Contract versions

| Contract | Change |
|---|---|
| Snapshot container → **v5** | Channel `sense` and `site`; output drive `escape`; per-neuron `group` (L10) and `transmitterSource` (D10); `weightRule: synapseCount`; header `minSynapses`, `anchors`. v4 and v3 files are still read. |
| Brain runner | New `fly-brain-v2.js` (world `brain.version: "v2"`) for v5 snapshots: L9, L10, generic channels. `fly-brain-v1.js` is unchanged. |
| LIF core | `lif-v1.js` gains L10 (`groupGain`). Contract `lif-v1.md` gains the row and the no-op guarantee. |
| Worker protocol | **Unchanged (v3).** `sense.inputs` is already one value per declared input, in declaration order; `motor.outputs` gains `escape` by declaration. |
| World config | `flies.stimuli`, `flies.body.sites`, `flies.body.escape`; `brain.input` (L9). |
| Experiment metrics | New metrics of Gate C (below). |

The mock, v0 and v1 brains and their worlds keep working with no file change.

### W10. Experiments run seeds in parallel

`compare-baseline.mjs` and `calibrate-forager.mjs` run seeds on Node `worker_threads`, one seed per thread, merging
results in seed order so the report is identical to a serial run. This is a script change (Node only), not an app
dependency, and it is the difference between an hour and ten minutes per arm.

## Algorithm (extractor, format 4)

1. Validate the config (`E-CONFIG`, `E-TRANSMITTER-SOURCE`, `E-MODULATOR`). Check files and row counts.
2. Read annotations with `entryNerve` added to the forager columns, and the neurotransmitter table with
   `ground_truth` and `consensus_nt`. Admit under D10, plus outputs under the ADR 003 output rule.
3. Stream traced-only edges restricted to admitted bodies (measured: 24.9M edges, 157K bodies with outputs and
   modulatory bodies included; Annex A1). Drop edges below `minSynapses`.
4. Resolve pools (`E-POOL-EMPTY`, `E-POOL-OVERLAP`), side-match (`E-SIDE-IMBALANCE`), resolve anchors (`E-ANCHOR-EMPTY`).
5. Forward flow per pathway, backward flow per output group (`flowSteps`). Pair scores, pair budgets (`E-PAIR-EMPTY`),
   union, anchors, exclusions.
6. Induced subgraph, outputs' outgoing edges dropped, `E-OUTPUT-UNREACHED`, `E-NODE-RANGE`.
7. Weights (D13), groups (L10), indices (container v5 order: inputs in channel order, outputs, interneurons by
   `bodyId`). Write atomically. Self-check (`E-NONDETERMINISTIC`). Every sort has an explicit key ending in `bodyId`.

The prototype of steps 3–6 runs in about 10 s and 2.7 GB resident on the full admitted graph (Annex A3); the current
extractor's 3 GB / 60 s profile (Gate A of spec 008) is the reference.

## Calibration protocol

ADR 005 Annex B's staged protocol, with three changes:

1. **Start from L11's published values**, not from the v1 grid. The grid is centred on them (`synapticScale` ×{0.5, 1, 2,
   4}, `tauSyn` {2, 5}, `input.rate[1]` {0.08, 0.15, 0.3}, `stepsPerTick` {5, 10}).
2. **A1 gates are per group** (L10): rest activity ≥ 0.002 and ≤ 0.1 in every group; odour response above rest in
   `al` and `central`; and two new A1 gates, measured brain-only on a clamped input: **brake** (mouth taste lowers the
   raw `forward` input) and **feed** (mouth taste raises `feed` above its rest value).
3. **Two weight-rule arms** (`synapseCount` and `postFractionAbsolute`) go through A1; the one with more robust A1 points
   goes to B. Both are recorded.

Calibration seeds only for every stage; held-out seeds for the verdict, as ADR 004 Annex A.3 requires.

## Acceptance

- **Gate A, extractor.** A v5 container with 12,000–18,000 neurons on v1.0 with the D14 config; matched sides where
  declared; no pool overlap; every output reached; report printed (per-pool counts, per-pair budget fill, admission
  source counts, coverage of each output's real input); byte-identical rerun. Python unit tests on the labelled
  synthetic fixture for each new code, D10's order, pair budgets and anchors; JS reader tests for v5.
- **Gate B, simulator.** Golden test unchanged. Unit tests for L9 (rate mapping, reproducibility, stream independence)
  and L10 (no-op default, per-group scale). In the browser: six 15K flies at 20 Hz keep the main thread responsive,
  with the measured tick cost recorded.
- **Gate C, behaviour,** per arm (15K brain, size-matched random graph, v1 forager, random walk), held-out seeds:
  1. **Find, approach, eat, leave, hunger dependence**: ADR 003 metrics 1–5, unchanged.
  2. **Brake:** median `forward` drive with mouth taste on a flower ÷ off flowers, hungry flies. Must be < 1 and lower
     than the random-graph arm. **Eat must pass**: this is the metric the v1 brain could not pass.
  3. **Avoid:** fraction of ticks within 1.5 tiles of a spider, and within 1.5 tiles of a lantern, against the random
     walk. Reported with its sign; not required to pass (the sign is a finding).
  4. **Touch:** fraction of ticks with a blocked move, against the random walk.
  5. **Escape:** escape events per minute within the danger radius against outside it.
  6. **Rest:** activity per group with no stimulus; ADR 005's quiet-and-reactive question answered with a number.

As always, a failed behaviour metric is a finding. The fix is config or parameters, recorded with the run.

## Constitution fit

| Principle | Fit |
|---|---|
| I. Static web | No new dependency. Snapshots stay static files (about 25 MB raw, about 15 MB gzip; ADR 007 W14 adds gzip transport). |
| II. One fly, one worker | Unchanged. Protocol v3 unchanged. |
| III. Dataset brains | Every weight is a synapse count with a dataset sign. D10 uses dataset columns only and records which one. Anchors are whole dataset classes. No hand-wired edge: the brake is selected by flow. |
| IV. Config extraction | Pools, anchors, budgets, transmitter order and edge threshold are config. Determinism kept. |
| V. Pure LIF | L10 is the only core change, off by default. L9 is in the runner, seeded. |
| VI. Embodied | Stimuli and body sites are declared data. Eating and escape are physics gated by brain outputs. |
| VII. Simplicity | One new core parameter. The signed brake budget was measured redundant and dropped. |

## Consequences

- **The brake becomes reachable from data.** In the probe, mouth taste → forward turns from 0.0000 to −0.0006 and
  mouth taste → feed triples. Whether the LIF expresses it is Gate C.
- **The interface quadruples** (4 → 12 inputs, 5 → 6 outputs) without hard-coding: the world reads channel
  declarations.
- **A known mislabel is corrected.** The v1 brain's "taste" pool is three-quarters legs; its calibration results
  should be read with that in mind. `malecns.md` §14's `LgLG` line needs a fix.
- **Bigger artefacts.** About 25 MB per snapshot raw. Every re-extraction adds that to git history, so re-extraction
  should follow a calibration decision, not precede it.
- **Slower experiments,** an order of magnitude per arm, mitigated by W10.
- **Three ADR 003 assumptions are carried on:** the food glomeruli (ADR 003 Q1), taste without a sugar label (Q2),
  and glutamate as inhibitory (Q3). One is added: the forward role of DNg100 (Q2 below).

## Alternatives considered

- **Scale the v1 rule to 15K** (per-pathway budgets against pooled backward flow). Rejected: it keeps the mislabelled
  taste pool and has no guarantee for small outputs.
- **A signed brake budget** (taste flow × net-inhibitory backward flow to `forward`). Built and measured: redundant at
  this size (3 extra neurons, identical probe). Kept out (Principle VII). It may matter at small budgets.
- **Hand-wire BUG-002's ten brake neurons.** Rejected by Principle III, and the reverted BUG-002 attempt showed why.
- **Partial mushroom body.** Measured (1,190 KCs come in by flow) and rejected (D12).
- **Include the optic lobe.** 87,544 admitted `ol_intrinsic` bodies. Out of reach at any of these sizes; ADR 007 enters
  vision at the projection neurons instead.

## Open questions

- **Q1. Shiu et al. 2024 values.** L11 quotes them from the paper's methods. Confirm each before Gate B, and the
  1 ms reading of `dt`.
- **Q2. DNg100 as a forward DN.** Included as a candidate. If Gate A's report or the literature check does not
  support it, `forward` falls back to DNp09 alone (a config change).
- **Q3. Steering DN set.** DNg13 and other DNs have been linked to turning in recent work. They are not in the pools
  until confirmed; adding them is a config change, measured against `turn-*` noise.
- **Q4. Touch sign.** The probe says a touched left leg turns the fly left (into the obstacle). Is that real (wall
  following, Gate C metric 4) or an artefact of the linear probe?
- **Q5. Mid- and hind-leg taste.** Left out because they drive forward up in the v1 brain. If eating needs a
  sustained "on food" signal after the front legs leave the flower, they come back as their own channel.
- **Q6. Is the ALLN anchor needed?** Gate B's rest gate with and without it answers this.
- ~~**Q7. Does the sign-aware D11 fix (A4) need scoping, an inhibitory closure, or wider anchors?**~~ **Resolved**
  (A7): a per-region inhibitory-closure budget, for `central` (`250`) and `dn` (`50`) only — not `vnc` (measured
  never actually thinned by A4), not a per-neuron or global-budget shape (both measured and rejected), and not
  class anchoring beyond `al`'s existing ALLN (no comparably bounded inhibitory class exists for the other
  regions). Re-extracted; see A7 for the full measurement and the real-brain wiring test that set `dn`'s budget.

## Related

- [ADR 003](003-hungry-forager-brain.md): pools, flow ranking, modulators, world loop.
- [ADR 004](004-output-pool-synaptic-scale.md), [ADR 005](005-dynamical-regime.md): output scale, regime, staged calibration.
- [ADR 007](007-sighted-learning-forager-brain-30k.md): the 30K brain built on this one.
- `specs/008-hungry-forager-brain/bugs/BUG-002.md`: the brake diagnosis.
- Shiu, P.K. et al. (2024) A Drosophila computational brain model reveals sensorimotor processing. *Nature* 634, 210–219.

## Amendment 2026-10-10

Recorded during implementation of feature 013 (`specs/013-forager-brain-15k-lif-v2/`), bug
[BUG-001](../specs/013-forager-brain-15k-lif-v2/bugs/BUG-001.md). The decisions above are kept as written. The
changes below take precedence where they differ.

### A4. D11's pair-grid score has no sign term, and D9's `forward` pool is net-inhibitory in the shipped brain

D11 (lines 126–145) ranks every `(pathway, outputGroup)` candidate by `score_{p,o}(i) = √(F_p(i)·B_o(i))` — flow
*magnitude*, with no sign. D11's own prose states a signed "brake budget" ablation "changes nothing measurable,"
but that ablation tested whether *adding* sign-aware candidates changes the selection, not whether the *existing*
selection leaves an output pool's net weight positive. It does not, for `forward`.

**Measured** (`/microfly-calibrate`'s world-stage runs,
`.claude/skills/microfly-calibrate/runs/v2-world-2026-10-10/world.json` and
`v2-narrow-2026-10-10/regime.json`): the shipped brain's `forward` pool (D9: `DNp09`, `DNg100`, 4 neurons) has a
**net inhibitory** total admitted synaptic weight from the rest of the selected subgraph, **−867 signed
weight/neuron**. Every other output pool is net excitatory: `turn-left` +4084, `turn-right` +3874, `backward`
+1093 per neuron. `forward`'s own dedicated pair-grid candidates (the `(pathway, forward)` pairs) score lower
than `turn`'s dedicated candidates (max 0.0213 vs. 0.0369) — a real ~1.7× gap, not large enough alone to explain
a net-negative sum — so most of what the induced-subgraph rule actually delivers to `DNp09`/`DNg100` is
incidental input from neurons admitted to drive `turn`/`backward`/`escape`, and that incidental population is
net-inhibitory. No `synapticScale`/`tauSyn`/`groupGain`/`outputScale` setting can correct this: all four scale or
filter an already-fixed, signed weighted sum, none can flip its sign. Every calibration run tried
(`v2-auto-2026-10-10/auto.json`'s full grid scan included) found `find.rate: 0`, `walked: 0`.

**Q2 is superseded in part**: Q2 asked whether Gate A's report or a literature check supports `DNg100` as a
forward DN, with DNp09-alone as the fallback if not. That question is moot until D11/D9 is fixed — DNp09 alone
is still fed by the same sign-blind selection and the same incidental-inhibition mechanism, so falling back to
DNp09 alone does not by itself fix this bug.

**Decision (user sign-off 2026-10-10): both (a) and (b).**

**(a) `score_{p,o}(i)` is now sign-aware**, for every `(pathway, outputGroup)` pair, not `forward` alone.
`selection_forager_v2.py` gains `_signed_flow`: the same iterative propagation D11's `B_o(i)` already used, but
each hop multiplies by the transmitting neuron's resolved sign, so a path through an even number of inhibitory
synapses nets positive and an odd one nets negative, instead of the original `_flow`'s magnitude-only
reachability. `score_{p,o}(i) = √(F_p(i)·B_o_signed(i))` when `B_o_signed(i) > 0`, else `0` — a net-inhibitory
candidate can no longer out-rank a net-excitatory one for that pair. `top_by_score` already dropped non-positive
scores (pre-existing code, unchanged), so this is a minimal, scoped change: `F_p(i)` (the pathway side) stays
unsigned, `group_flow` (unsigned, the header's `flowOutput` field) is kept alongside the new signed variant used
only for scoring.

**(b) resolves Q2 directly, rather than widening the pool with unverified types.** A read-only measurement
against the full admitted MaleCNS v1.0 connectome (not just the narrow v2 selection) found `DNg100` itself net
inhibitory even before the v2 subgraph narrows anything — **−2397 signed weight/neuron**, direct 1-hop, against
`DNp09`'s **+1897/neuron** (consistent with Bidaye et al. 2020's literature role for DNp09). Several other DN
types scored far higher on this same measure (e.g. `DNp103`, `DNp06`, `DNb05`, `DNp03`, `DNp04`, all
+4000–12,000/neuron), but none has a literature-documented forward-walking role found in Namiki et al. 2018's
catalog or Cande et al. 2018's optogenetic screen — adding them would be a connectome-only guess, not the
literature-grounded addition this amendment asked for. **D9's `forward` pool is narrowed to `DNp09` alone**
(`extract/configs/forager-brain-15k.json`'s `outputs.forward.types`), the fallback Q2 itself already named. Widening
the pool with a verified additional type is left to a future, separately-scoped connectome search (the same
precedent BUG-002/ADR 004 set for an unverified brake-neuron addition), not blocking this fix.

**Standing check added**: every output pool's net admitted synaptic weight per neuron, signed, is now part of the
extractor's report (FR-032/SC-012), and a pool with a non-positive net sum stops extraction with a named failure
(`E-OUTPUT-SIGN`) instead of shipping silently.

**Status**: (a) and (b) implemented in `selection_forager_v2.py` and `forager-brain-15k.json`
(`specs/013-forager-brain-15k-lif-v2/tasks.md` T092). Re-extraction (T094) and a fresh `/microfly-calibrate` pass
(T095, in a separate session per AGENTS.md) are still needed before SC-007/US1's held-out verdicts can be taken.

## Amendment 2026-10-11

Recorded during implementation of feature 013 (`specs/013-forager-brain-15k-lif-v2/`), bug
[BUG-002](../specs/013-forager-brain-15k-lif-v2/bugs/BUG-002.md). The Calibration protocol section above is kept as
written. The changes below take precedence where they differ.

### A5. The Calibration protocol's A1 gates (point 2) are mis-specified in seven ways

Point 2 states the A1 gates as "rest activity ≥ 0.002 and ≤ 0.1 in every group; odour response above rest in `al`
and `central`; ... **brake** (mouth taste lowers the raw `forward` input) and **feed** (mouth taste raises `feed`
above its rest value)." Five `/microfly-calibrate --stage=auto` runs against the post-BUG-001 brain (16,127
neurons) scored 0 of 342 valid grid points against this text and found no robust pass
(`specs/013-forager-brain-15k-lif-v2/calibration.md`'s "no A1 pass, one near-miss" section). BUG-002 found the text
above, and the `microfly-calibrate` skill's `engine.mjs`/`profiles/v2.mjs` that implement it, wrong in seven ways,
not the brain's regime:

1. **No `output` exemption.** `output` neurons have no outgoing edges (D3), so their rest activity cannot affect
   any other region, and A2 overrides their gain unconditionally afterward. Gating A1 on it anyway rejects
   candidates for a property A2 fixes regardless. Re-scoring the five existing checkpoints (no new simulation)
   with this gate removed finds 6 points whose only failing gate was `output`'s ceiling, none robust.
2. **No stated unit.** "Rest activity" is ambiguous between a per-LIF-step rate and a per-tick union of spikes; the
   grid varies `stepsPerTick` {5, 10}, so the two readings are different requirements at different grid points.
   Gate on a per-LIF-step rate.
3. **The floor over-applies.** "≥ 0.002 ... in every group" contradicts the zero-basal-firing regime L11 itself
   quotes from Shiu et al. 2024 for every other group but `input` (whose own floor has its own justification, ADR
   005 Annex B.3). The floor applies to `input` only; the other groups get a reactivity gate instead (point 2
   restated below).
4. **Brake and feed are under-specified.** "Mouth taste lowers the raw `forward` input" does not say against what
   baseline. The implemented probe compared taste alone against odour alone, which only shows a fly tasting food
   with no odour present has nothing to brake — not that an approaching fly brakes on contact. Both gates compare
   an odour-plus-taste condition against odour alone.
5. **No steering gate.** Point 2 never gates `lateral` (odour-side steering), so a candidate with no left/right
   response could still pass every stated gate.
6. **A2 never fits against rest.** The Calibration protocol does not require the fitted `outputScale.forward` to
   leave near-zero forward drive with no stimulus present; A2's readout fit adds a check against the `rest`
   condition for this.
7. **No return-to-rest check.** Gate C item 6 asks a brain's rest activity be reported; A1 has no equivalent check
   that activity *returns* to rest once a stimulus already probed is removed, so a runaway/bistable regime is
   indistinguishable from a reactive-then-quiet one at this stage.

**Point 2, restated** (supersedes the text quoted above): A1 gates are per group (L10), each measured brain-only on
a clamped input, as a per-LIF-step rate: rest activity ≥ 0.002 and ≤ 0.1 in `input`; ≤ 0.1 in every other group (no
floor); odour response above rest in `al` and `central`; steering (`lateral`, odour-left vs. odour-right) away from
zero; **brake** (mouth taste added to food odour lowers the raw `forward` input, against food odour alone) and
**feed** (the same addition raises `feed` above its food-odour-alone value); and **settle** (activity returns to
its rest level once a probed stimulus is removed, in every group). `output` is exempt from every A1 gate; its gain
is fit in A2 instead, which additionally requires near-zero fitted forward drive at `rest`.

**Status**: implemented (`specs/013-forager-brain-15k-lif-v2/tasks.md` T099) and unit-tested
(`tests/calibrate-engine.test.mjs`). The five existing checkpoints were re-scored (T100): the gates that are pure
functions of stored data (the `output` exemption, the `input`-only floor, the per-step rate, steering, odour-gain)
move 0/342 to 45/342 passing (34 robust) — but `brake`/`feed` (recorded under the pre-fix taste-alone probe) and
the settle gate (never probed before this amendment) cannot be re-scored from storage and need a fresh probe.
Recorded in `specs/013-forager-brain-15k-lif-v2/calibration.md` (T101). A fresh `/microfly-calibrate --stage=auto`
pass against the fixed tooling, in a separate session per AGENTS.md, is still needed before SC-007/US1's held-out
verdicts can be taken.

### A6. L11's `synapticScale` quoted Shiu et al.'s synaptic weight without finishing their own conversion to net charge, and resolves Q1 for this row

L11's starting value, `synapticScale: 0.04`, is derived as "0.275 mV per synapse against a 7 mV rest-to-threshold
gap (Shiu et al. 2024), threshold = 1" — `0.275 / 7 ≈ 0.0393`, rounded to `0.04`. This skips a step in Shiu et
al.'s own model (`github.com/philshiu/Drosophila_brain_model`, `model.py`): `dv/dt = (v0 − v + g)/t_mbr`, with
`g += w` on a synaptic event and `g` itself decaying with `τ = 5 ms` (the same `τ` L11 already quotes for
`tauSyn`), `t_mbr = 20 ms`. The quoted `w = 0.275 mV` is the step added to the intermediate variable `g`, not the
net charge delivered to `v` — `g` drains into `v` scaled by `1/t_mbr` over its own `τ`-ms decay, so the net charge
per synaptic event is `w · τ / t_mbr = 0.275 × 5 / 20 = 0.06875 mV`, not `0.275 mV` directly. Against the same
7 mV gap: `0.06875 / 7 ≈ 0.0098`, not `0.0393`. **`0.04` is ≈4.08× the corrected value.**

This matters in `lif-v1.js` specifically because its synaptic filter (`syn[i] = syn[i] * decaySyn + input[i] *
(1 - decaySyn)`) is an exponential moving average with unit area: summed over all future steps, one arrival's
total contribution to `drive` equals the arrival itself, regardless of `tauSyn`. Unlike Shiu et al.'s two-variable
(`g`, `v`) pair, this core's `synapticScale` already *is* the net charge per synapse — there is no second,
separate division by a membrane time constant left for the model to apply. L11's derivation reproduced Shiu et
al.'s pre-decay `w` and divided it by 7 mV as if it already were net charge, stopping one conversion step short of
what their own model does with that weight.

**This is the check Q1 asks for** ("L11 quotes [Shiu et al.'s values] from the paper's methods and must be
checked against it before calibration starts"), and it fails for `synapticScale`. **Q1 is resolved for this row**:
`synapticScale`'s corrected starting value is `≈ 0.0098`. `tau`, `refractorySteps` and `tauSyn` are not re-derived
here and keep their stated values.

Independent of this correction, five `/microfly-calibrate --stage=auto` runs (342 points, re-scored under A5)
have never varied `tauAdapt`/`adaptStep` (L2), `thresholdJitter` (L3) or `inhibitoryScale` (L8) — all already
implemented in `lif-v1.js`, off by default, and the standard remedies for an all-or-nothing ignition cliff instead
of a gradual transition (the shipped v1 brain's own cost-table baseline, Annex A6, already uses non-zero
`tauAdapt 20`/`adaptStep 0.05`). At the single best point found across all five runs (`synapticScale 0.006`,
`groupGain.al 0.4`), food odour (0.5) raises `central`'s activity from 0.0530 (rest) to 0.2979 (odour) — the whole
network moving roughly together, the expected signature of a model with nothing to damp runaway recurrent
excitation locally.

**Decision**: `synapticScale`'s corrected value is adopted, and the Calibration protocol's grid is widened to
include the three mechanisms above, centred as `synapticScale 0.0098 × {¼, ½, 1}`, `inhibitoryScale`
`{1, 1.5, 2, 3}`, `tauAdapt {50, 100, 200}` paired with its own `adaptStep` value, and `thresholdJitter`
`{0, 0.1, 0.2}`.

**Status**: `.claude/skills/microfly-calibrate/scripts/profiles/v2.mjs` updated to match (L11's constant and the
`axes`/`brainOf()` it builds grid points from), unit-tested in `tests/calibrate-profile-v2.test.mjs`
(`specs/013-forager-brain-15k-lif-v2/tasks.md` T102–T103). No `--stage=auto` search has been run against the
widened grid yet (T104) — per AGENTS.md this must happen in a separate session, not during implementation.

### A7. A4's sign-aware D11 fix (BUG-001) thinned recurrent inhibition network-wide, not only at `forward`

[BUG-004](../specs/013-forager-brain-15k-lif-v2/bugs/BUG-004.md) measured both shipped snapshots directly
(`public/brains/forager-brain-15k.brain` before and after A4): A4's decision (a) — making `score_{p,o}(i)`
sign-aware "for every `(pathway, outputGroup)` pair, not `forward` alone" — removed recurrent inhibition from the
selection broadly, not only from the paths that reach `forward`. Per-L10-region inhibitory ÷ excitatory admitted
synapse-weight ratio, pre- vs. post-A4:

| Region | Pre-A4 | Post-A4 |
|---|---|---|
| overall | 0.704 | **0.523** |
| `al` | 0.366 | 0.361 |
| `central` | 0.739 | **0.477** |
| `dn` | 0.735 | **0.496** |
| `input` | 0.852 | 0.874 |
| `output` | 0.818 | **0.187** |
| `vnc` | 0.922 | 0.904 |

`al` alone barely moved, because its dominant inhibitory source (the ALLN class) is a D12 anchor, exempt from
D11's scoring entirely — direct, already-shipped evidence that anchoring (not scoring) is what protects a
region's inhibitory supply. Every other region's inhibitory population is admitted only through D11's scored
pair-grid, which the sign-aware rule now systematically disadvantages: `budget.perPair` is a fixed-size top-k, so
zeroing every candidate with non-positive signed backward flow to a group does not shrink the selection, it
reallocates each pair's budget toward excitatory candidates (admitted interneurons: excitatory +34 %, inhibitory
+10 %, same total budget). `calibration.md`'s own sweeps show the behavioural consequence: the pre-A4 brain's
A1-robust point sat at `synapticScale 0.011`; the post-A4 brain is silent at `0.0025` and "ignites everything at
once" by `0.003` — roughly a 3.7× drop in the scale that first saturates the network, sharpening the ignition
cliff A5/A6 already diagnosed as missing local damping, now with a structural cause behind it.

`E-OUTPUT-SIGN` (FR-032/SC-012, the standing check A4 itself added) cannot see this: it is a static, per-output,
sign-only check, and every pool it tests reports positive on the post-A4 brain. It was scoped, correctly, to
BUG-001's own symptom ("can this pool ever register positive drive") and was never meant to bound the selected
population's overall inhibitory share — a different, network-level property.

**Decision (user sign-off 2026-10-11): resolve Q7 now, ahead of a fresh calibration pass.** A4's own decision for
BUG-001 was not re-litigated: the standing check (FR-033/SC-013: a per-region report line and `E-INHIBITION-DRIFT`
against a declared, per-region tolerance) was added regardless, but the user chose to pick and implement a D11
fix immediately rather than wait for a `/microfly-calibrate` pass to show parameters alone cannot compensate (the
condition this Amendment originally stated as the trigger). The search still was not run in this session — AGENTS.md's
separation holds regardless of this choice — the decision was simply to stop waiting on its result before fixing
a structural property that measurement had already confirmed.

**Q7 is resolved as (b), scoped per region, not (a) or (c), and not uniformly:**

- **(c), anchoring, was measured and rejected beyond `al`.** A real-dataset measurement of each region's
  dominant inhibitory *class* found none for `vnc`/`dn`/`central`: `al`'s ALLN is 67.6% of its inhibitory weight,
  but `central`'s single largest contributing type (`Mi4`, an optic-lobe cell type) is 2.7%, and the top 15 types
  combined reach only ~19% — inhibition there is spread across hundreds of small, distinct cell types with no
  bounded class to anchor. Anchoring enough types to matter would mean admitting thousands of bodies, well past
  `neuronCountRange`.
- **(a), scoping the signed score to direct output inputs, was not needed once (b) was measured working.**
- **(b), an inhibitory-closure budget, works — but only when scoped per L10 region, not per neuron and not as one
  global budget.** Both of those shapes were tried first and rejected by direct measurement (see
  `specs/013-forager-brain-15k-lif-v2/contracts/extract-config-forager-v2.md`'s Decision section for the numbers):
  a per-neuron budget adds ~11,000 bodies at `k = 1` (almost every neuron's strongest real inhibitory partner is
  distinct); a single global top-k hub ranking over-corrects `vnc` while leaving `output` under-corrected, because
  regions need very different budgets to reach their own real ratio.
- **`vnc` needs no fix at all.** Measured with zero closure, `vnc`'s selected ratio (`0.904`) already sits *above*
  its real-admitted baseline (`0.735`) — confirming what this Amendment's own pre/post-A4 table already showed
  (`vnc: 0.92 → 0.90`, the smallest move of the four scored regions): `vnc` was never meaningfully thinned by A4.
  Closure there only pushes it further from its real baseline.

**Implemented** (`specs/013-forager-brain-15k-lif-v2/tasks.md` T105, T107): `selection_forager_v2.py` gains the
per-region `inhibitionCoverage` report/check (FR-033/SC-013) and a per-region `inhibitoryClosure` admission step
— for each configured region, rank real-admitted inhibitory candidates by synapse weight already delivered into
that region's already-selected targets, and admit the top-k unconditionally, after D11's pair-grid and D12's
anchors, before D12's exclusions apply. `extract/configs/forager-brain-15k.json` declares
`"ieDriftTolerance": {"central": 0.15, "dn": 0.15}` and `"inhibitoryClosure": {"central": 250, "dn": 50}`
(`al`/`input`/`output`/`vnc` get neither — out of scope per the measurements above, and `output`'s own net sign
stays separately guaranteed by `E-OUTPUT-SIGN`/FR-032).

`dn`'s budget was tuned down from an initially tighter `100` (drift `0.008` against real) to `50` (drift
`0.022`): `100` broke a real-brain wiring test (`tests/forager-v2-brake.test.mjs` — leg taste very slightly
lowered `backward` drive below its no-taste baseline), because `dn`'s closure candidates overlap the circuitry
feeding `backward` (MDN) closely enough that too large a budget there measurably changes it. `50` keeps that test
passing. `central: 250` needed no such trade-off (drift `0.004`, no wiring test affected).

**Status**: done. Real extraction re-run: **16,427 neurons, 2,078,088 edges, self-check `identical`**;
`inhibitory/excitatory ratio, selected vs. real admitted: central 0.633/0.637, dn 0.687/0.665` (both within
tolerance), every output pool still net-positive (`feed +195.5`, the tightest margin, was `+253` before any of
BUG-001/BUG-004's fixes). `npm test`: 553/559, the same 6 pre-existing, feature-unrelated `activity.test.mjs`
failures as every prior checkpoint on this branch — no new failures. `public/brains/forager-brain-15k.brain` is
replaced in the working tree (not yet committed to git — left for the user, per this project's commit
convention). T096/T097 (and transitively T053/T057/T085) stay blocked: this fix resolves Q7, it does not run
`/microfly-calibrate` — that pass (T106) is still needed, now against this newest brain, before any LIF-parameter
setting can be taken.

## Annex A: measurements

All numbers come from `data/malecns` (v1.0, traced-only edges), measured on 2026-10-09 with read-only scratch scripts
(numpy, pyarrow, pandas in a throwaway environment; the extractor's environment was not changed). The prototype follows
D8–D13 and the algorithm above; it is not the extractor.

### A1. Admission (D10)

| Population | `predicted_nt` only (today) | `ground_truth` → `consensus_nt` → `predicted_nt` | Traced |
|---|---|---|---|
| All bodies | 143,219 | **155,771** | 165,122 |
| Kenyon cells | 1 | 4,064 | 4,064 |
| CX | 2,487 | 2,841 | 2,950 |
| ALLN | 329 | 372 | 420 |
| MBON | 95 | 97 | 97 |
| DAN | 0 | 0 (dopamine) | 340 |
| `vnc_motor` | 25 | 326 | 708 |
| `cb_motor` | 21 | 32 | 107 |
| `cb_intrinsic` | 26,383 | 31,048 | 32,160 |
| `ol_intrinsic` | 81,726 | 87,544 | 89,390 |

Kenyon cells: `predicted_nt` dopamine 4,058 of 4,064 (cell-type prediction dopamine, confidence 0.73–0.77), `consensus_nt`
acetylcholine 4,064. R1–R6: `predicted_nt` unclear 747, histamine 647; `ground_truth` histamine 1,394.
Bodies with dopamine, octopamine or serotonin as the chosen transmitter: 839. Edge table restricted to admitted,
modulatory and output bodies: 157,065 bodies, 24,876,525 edges, 120.4M synapses.

### A2. Pools

| Population (admitted under D10) | Left | Right | Note |
|---|---|---|---|
| Food-glomerulus ORNs, side-matched | 138 | 138 | ADR 003 had 131 under the old admission |
| ORN_V + ORN_DA2, side-matched | 36 | 36 | ORN_V is 13 L against 38 R before matching |
| TRN_VP2 (hot) | 3 | 3 | TRN: VP1m 5/6, VP2 4/3, VP3a 3/3, VP3b 0/1 |
| Labellar bristle + taste peg | 106 | 106 | labellar 60/65, taste peg 26/30 under the old admission |
| Leg bristle GRNs, ProLN | 123 | 126 | all legs: ProLN 249, MesoLN 201, MetaLN 237 |
| Tactile, ProLN, side-matched | 93 | 93 | 136 L, 89 R before matching (old admission) |
| HRN VP4 (dry) / VP5 + VP1d + VP1l (moist) | 13 / 14 | 13 / 14 | not used (D8) |

`LgLG` (old admission): 487 bodies, all `subclass = leg bristle` (ProLN 143, MesoLN 159, MetaLN 185). The ADR 003 taste
pool: 668 = labellar 125 + taste peg 56 + leg 487.

Output types (all traced, L/R): DNa01, DNa02, DNp01, DNp09, DNg100 1/1 each, acetylcholine; MDN 2/2; MN9 2 (consensus
acetylcholine). DNg13 1/1 (acetylcholine) measured, not pooled (Q3).

### A3. Selection sweep (D11, `flowSteps` 6, KCs excluded, ALLN anchored, no brake budget)

| `perPair` | Neurons | Edges ≥ 1 syn | Edges ≥ 2 syn | In-degree median / p95 / max | Inflow coverage mean / median | Exc / inh |
|---|---|---|---|---|---|---|
| 500 | 5,810 | 459,057 | 292,001 | 68 / 236 / 703 | 0.402 / 0.363 | 3,611 / 2,199 |
| 1,000 | 8,889 | 863,955 | 534,981 | 82 / 269 / 720 | 0.462 / 0.441 | 5,328 / 3,561 |
| 1,500 | 11,446 | 1,289,418 | 786,697 | 93 / 305 / 865 | 0.512 / 0.503 | 6,754 / 4,692 |
| 2,000 | 13,724 | 1,708,920 | 1,035,510 | 101 / 331 / 1,022 | 0.556 / 0.561 | 8,018 / 5,706 |
| **2,400** | **15,351** | **2,034,266** | **1,227,737** | 107 / 349 / 1,136 | 0.588 / 0.602 | 8,901 / 6,450 |
| 3,000 | 17,668 | 2,539,636 | 1,526,314 | 116 / 377 / 1,278 | 0.632 / 0.664 | 10,175 / 7,493 |

Inflow coverage = selected ÷ real admitted input synapses per non-input neuron (ADR 005 A.1 measured the same ratio,
0.478 mean, for the v1 brain under the old admission). At 2,400: inputs 1,001, outputs 16, interneurons 14,334.
Synapse share kept by `minSynapses` 2 / 3 / 5: 0.941 / 0.890 / 0.813.

Composition at 2,400: `cb_intrinsic` 9,363, `vnc_intrinsic` 2,246, ascending 899, ALPN 533, descending 525, gustatory
461 (inputs), ALLN 372, olfactory 348 (inputs), tactile 186 (inputs), visual projection 136, MBON 67, `vnc_motor` 60,
`cb_motor` 32, SEZPN 27. **With KCs not excluded:** 16,314 neurons, of which 1,190 KCs and 59 MBONs.

Real admitted input of each output pool captured at 2,400: turn-left 0.907, turn-right 0.913, forward 0.893,
backward 0.978, feed 0.971, escape 0.677. Inhibitory neurons with a direct edge onto `forward`: 783.

Prototype run time: about 10 s, 2.7 GB peak resident (flows on the full admitted graph).

### A4. Signed probes

Linear signed propagation on the selected subgraph: weights `sign(i) × synapses(i→j) ÷ real admitted input(j)`,
8 steps from a unit vector on the source pool, outputs as sinks, mean arrival per output neuron summed over steps.
It ignores thresholds, so it shows **which paths exist and their sign**, not firing.

**Brake and feed.** Net (inhibitory component in brackets):

| Source → | forward | feed | backward |
|---|---|---|---|
| v1, whole taste pool | +0.0006 (−0.0002) | +0.0012 (−0.0014) | +0.0003 |
| v1, mouth members (181) | **+0.0000** (−0.0000) | +0.0012 | −0.0001 |
| v1, leg members (487) | **+0.0005** (−0.0002) | +0.0000 | +0.0003 |
| v1, front-leg members (143) | −0.0001 | −0.0000 | +0.0005 |
| 15K, `taste-mouth` | **−0.0006** (−0.0008) | **+0.0035** (−0.0021) | −0.0000 |
| 15K, `taste-leg` | −0.0000 | −0.0007 | +0.0017 |
| 15K, `taste-mouth`, brake budget 0 (ablation) | −0.0006 (−0.0008) | +0.0035 | −0.0000 |

**Steering contrast** (left pool's turnL − turnR, minus the right pool's):

| Source | v1 | 15K |
|---|---|---|
| food odour | +0.00008 | +0.00010 |
| danger odour | — | −0.00000 |
| heat | — | −0.00006 (away) |
| mouth taste | (pooled taste +0.00180) | +0.00014 |
| leg taste | — | +0.00241 (toward) |
| touch | — | +0.00179 (toward) |
| humidity (moist / dry) | — | −0.00002 / +0.00001 |

### A5. Reach (12 steps, sum of |net| over outputs; unsigned = same with |weights|)

| Pool | Size | Signed | Unsigned | Unsigned per neuron |
|---|---|---|---|---|
| food odour | 276 | 0.00041 | 0.0109 | 3.9e-5 |
| danger odour | 72 | 0.00006 | 0.0023 | 3.2e-5 |
| heat | 6 | 0.00018 | 0.0019 | 3.1e-4 |
| mouth taste | 212 | 0.00573 | 0.1969 | 9.3e-4 |
| leg taste | 249 | 0.00563 | 0.0962 | 3.9e-4 |
| touch | 186 | 0.00326 | 0.0311 | 1.7e-4 |

Danger odour is as strong per neuron as food odour; its pool is smaller. Odour paths reach the outputs at hop 2–3.

### A6. Cost (`lif-v1.js`, Node 25, Apple M2 Pro, 500 steps after 100 warm-up)

Settings: `tauAdapt` 20, `adaptStep` 0.05, `noiseAmplitude` 0.08, `noiseBulkScale` 0; constant drive on input pools;
weights `postFractionAbsolute`.

| Graph | `synapticScale` | Drive | Activity | ms / step |
|---|---|---|---|---|
| v1 shipped | 10 / 25 / 50 | 0.06 | 1.9 / 6.6 / 10.8 % | 0.053 / 0.080 / 0.107 |
| 15K ≥ 1 syn | 10 / 25 / 50 | 0.02 | 0.0 / 7.2 / 11.0 % | 0.188 / 0.713 / 0.931 |
| 15K ≥ 1 syn | 10 / 25 / 50 | 0.06 | 0.8 / 7.5 / 11.5 % | 0.239 / 0.677 / 0.939 |
| 15K ≥ 2 syn | 10 / 25 / 50 | 0.02 | 0.0 / 6.0 / 10.3 % | 0.196 / 0.449 / 0.612 |
| 15K ≥ 2 syn | 10 / 25 / 50 | 0.06 | 0.7 / 6.6 / 10.5 % | 0.226 / 0.466 / 0.622 |

The 15K graph shows the same pattern ADR 005 found: silent at scale 10, about 11 % active at scale 50 whatever the drive.

### A7. Snapshot size

About 10 bytes per edge (target, weight, synapse count) plus about 290 bytes of header per neuron (the v1 header is
979,544 bytes for 3,408 neurons): **about 25 MB** at `minSynapses` 1, 17 MB at 2. The CSR arrays gzip to 62 % of their size.
