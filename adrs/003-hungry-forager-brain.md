# ADR 003: Hungry forager brain (bilateral smell and taste → ~4K connectome neurons → steering, walking and feeding)

- **Status:** Proposed
- **Date:** 2026-10-05
- **Supersedes:** nothing. Extends [ADR 001](001-lif-toy-network-and-fly-integration.md) (LIF core, protocol) and [ADR 002](002-smallest-functional-brain.md) (extraction rules). ADR 002 brains stay valid and loadable.
- **Inputs:** `malecns.md` §4–§6, §10, §12–§14; ADR 001; ADR 002 and its amendment; `.specify/memory/constitution.md` (Principles I–VII); `specs/006-fly-status-panel/contracts/snapshot-format-v3.md`, `worker-protocol-v2.md`, `channel-declaration.md`; the measurements in [Annex A](#annex-a-measurements).
- **Intended consumer:** `/speckit-specify` for the forager feature (extractor, LIF core, world and protocol changes), and anyone reading the forager's wiring.

## Context

The fly should behave like a hungry animal. It should smell food from a distance, walk toward it, stop on it,
eat for a while, and leave when it is full. The current brains cannot do this, and the reason is the
interface, not the wiring:

- **One sensory number, no side.** The world sends one odour value to neuron 0 (`capabilities` rule 15).
  Both readouts receive the same signal, so the brain cannot tell left from right. A 504-run sweep over
  ADR 002 configs found no brain that reaches food with more flies than a random walk. The best was 28
  of 180 flies against 46 for the random walk (Annex A, A1).
- **No internal state.** Nothing in the fly changes with feeding, so "hungry" and "full" cannot be told apart.
- **No eating.** The world counts contacts (cell entries). A fly that circles one flower scores well.
  This rewards spinning, not eating.
- **One-hop wiring.** ADR 002 keeps sensory → one interneuron → readout. Real paths from smell and taste
  to the descending neurons are 2–4 synapses long (Annex A, A3).
- **Lockstep dynamics.** With delta synapses and no adaptation, a strongly connected subgraph fires in
  lockstep at the refractory ceiling. The readouts then carry an on/off signal and no gradient
  (measured on the 11- and 35-neuron brains; Annex A, A1).

This ADR defines a brain of **about 4,000 connectome neurons**. Its inputs are bilateral and fed by the
world, and hunger modulates them. Its outputs are steering, walking and feeding. It names the LIF
extensions such a brain needs, and the world and protocol changes that give the fly hunger and eating.

## Behaviour loop (what the parts are for)

```text
            hunger h (body: 1 − energy)
                 │ gain on receptor input (D5)
                 ▼
 odour L ──► ORN_L pool ─┐                      ┌─► DNa01/DNa02 L ─┐ turn
 odour R ──► ORN_R pool ─┼─► AL, LH, SEZ, ... ──┼─► DNa01/DNa02 R ─┘
 taste L ──► GRN_L pool ─┤   (~3K interneurons) ├─► DNp09 L+R ─────── forward
 taste R ──► GRN_R pool ─┘                      ├─► MDN ───────────── backward
                                                └─► MN9 ───────────── feed (proboscis)
                                                          │
 world: on a flower, slow, and feed > threshold ──► eat ──► energy ↑ ──► h ↓
```

1. **Follow:** hunger raises odour gain. The two antennae sample the odour at two points, so ORN_L and ORN_R
   receive different drive near a flower. The connectome turns that difference into a difference
   between left and right steering DNs.
2. **Stop and eat:** on a flower the leg and labellar taste neurons fire. Hunger also raises taste gain.
   The taste pathways drive MN9 (feeding) and must lower the forward command. The world lets the fly eat
   only while it is slow, its feeding output is above threshold, and it is on a flower.
3. **Leave:** eating fills energy and lowers hunger. Taste and odour gain fall back, feeding drops
   below threshold, and the walking command takes over again. Adaptation (L2) makes a constant odour fade,
   so a sated fly is not pulled back to the same flower at once.

The brain implements every step except hunger bookkeeping and eating physics. Those belong to the body
and the world (Principle VI).

## Decisions: extraction

### D1. Inputs are neuron pools, chosen by declared filters, matched by side

An input channel drives a **pool** of neurons, not neuron 0. Four channels:

| Channel | Pool filter (config) | Admitted, per side |
|---|---|---|
| `odour-left` / `odour-right` | `class = olfactory`, `type ∈ ORN_{DM1, DM2, DM4, VA2, VM2, DP1m}`, `rootSide = L` / `R` | 131 / 131 after matching |
| `taste-left` / `taste-right` | `class = gustatory`, `subclass ∈ {labellar bristle, taste peg}` or `type` prefix `LgLG`, `rootSide = L` / `R` | 317 / 351 |

- **Side comes from `rootSide`.** ORN and GRN bodies have no `somaSide` (their somata are outside the CNS),
  but `rootSide` is set: ORN L 884, R 1,344, unknown 411; GRN L 713, R 715 (Annex A, A2).
- **Side matching.** The left antenna is less reconstructed than the right (ORN L 814 vs R 1,272 admitted).
  Unmatched pools would bias every fly to one side. For each `type`, the extractor keeps the first
  `min(|L|, |R|)` bodies of each side, by ascending `bodyId`. The config can switch this off
  (`sideMatch: false`) for taste, where the sides are already balanced.
- **The odour glomeruli are an assumption.** DM1, DM2, DM4, VA2, VM2 and DP1m are taken from the literature on
  vinegar and fruit attraction (e.g. Semmelhack & Wang 2009). `malecns.md` does not state ORN tuning. The
  list is config, not code (Q1).
- **The taste pools do not separate sugar.** No annotation names sugar receptors. `receptorType` only has
  `putative_ppk23`, `putative_ppk25` and `putative_IR52b` (Annex A, A2). The pools are therefore "contact
  taste on the labellum and front legs" until a sugar mapping is chosen (Q2).
- Input bodies are admitted under ADR 002 D4 like any other body.

### D2. Outputs are neuron pools with a declared motor role

| Output | Pool | Drive | Source of the role |
|---|---|---|---|
| `turn-left` / `turn-right` | `type ∈ {DNa01, DNa02}`, `somaSide = L` / `R` | turn | steering DNs (literature, e.g. Rayshubskiy et al. 2020) |
| `forward` | `type = DNp09` (L and R) | forward | forward-walking DN (literature, Bidaye et al. 2020) |
| `backward` | `type = MDN` | backward | "moonwalker" DN (literature, Bidaye et al. 2014) |
| `feed` | `type = MN9` | feed | proboscis motor neuron (literature, Gordon & Scott 2009) |

All of these types exist as traced bodies (Annex A, A2). Each output value is the EMA of the **mean**
spike rate of its pool (D9 in protocol terms).

**Output admission rule (amends ADR 002 D4 for outputs only).** An output body only needs incoming
edges. Its own transmitter does not affect the simulation, so an output may be admitted with an
unmapped or low-confidence transmitter. It then gets `sign = 0`, and its outgoing edges are dropped.
This is needed because MN9 L (body 10331) has `predicted_nt = unclear` (0.49) and would otherwise be lost.
Inputs and interneurons keep ADR 002 D4 unchanged.

### D3. Interneurons: flow-ranked, budgeted, from both pathways

ADR 002's two-hop sandwich is replaced, for this brain kind, by a ranking over the admitted graph:

1. **Forward flow** from a set of pools `P`: `x₀ = 1` on `P`, then `steps` times
   `x ← min(1, Wᶠ x)`, where `Wᶠ[j,i] = synapses(i→j) / total input synapses of j`. `F(i)` is the maximum of
   `x(i)` over the steps.
2. **Backward flow** to the output pools, computed the same way on reversed edges with
   `Wᵇ[i,j] = synapses(i→j) / total output synapses of i`. This gives `B(i)`.
3. **Score** per pathway: `odour(i) = √(F_odour(i) · B(i))` and `taste(i) = √(F_taste(i) · B(i))`.
4. **Budget:** keep the top `budget.odour` interneurons by odour score and the top `budget.taste` by taste
   score. Take the union, with ties broken on ascending `bodyId`. Neurons in a sensory class or superclass
   (`olfactory`, `gustatory`, `*_sensory`, …) are **excluded** from the interneuron pool, because the world
   never drives them and they would sit silent.
5. The brain is the **induced subgraph** on inputs ∪ outputs ∪ interneurons (ADR 002 D3), minus the
   outgoing edges of outputs (D2).

The ranking is a variant of the information-flow ranking used on FlyWire. Steering is not hand-picked:
every node is there because synapse counts carry flow from a declared input to a declared output.

**Default budget: 1,500 odour + 1,500 taste.** Measured in Annex A, A4: 3,882 neurons, 222,046 edges.
This includes the 830 input-pool and 11 output-pool bodies, and the sensory neurons that this rule's
exclusion step will remove. At this budget every output pool receives input: DNa01 395 edges, DNa02 458,
DNp09 278, MDN 1,018, MN9 18. MN9's input is thin. That is a result to watch, not a reason to hand-wire (Q4).

### D4. Weights: normalised per target neuron

ADR 002 D5 (`min(synapses, cap) / cap`) does not scale. In the selected graph the median in-degree is 42
and the maximum 710 (Annex A, A4). With capped weights, high-fan-in neurons saturate whatever
`synapticScale` is chosen. New rule, `weightRule: "postFraction"`:

```text
weight(i→j) = sign(i) × synapses(i→j) / Σₖ synapses(k→j)    (sum over selected presynaptic k)
```

Each neuron's input weights then sum to at most 1 in magnitude. `synapticScale` keeps one meaning across
neurons: "the potential added when every input fires at once". Raw synapse counts are still stored
(container `synapses` section), so the rule can change without re-reading the dataset. `weightRule: "cap"`
keeps ADR 002 behaviour.

### D5. Hunger is neuromodulation of receptor gain, declared in the snapshot

The hunger-signalling cells exist in the dataset: IPC 16, DH44 6, Hugin-RG 4. But 70 of the 72
`cb_endocrine` bodies have `predicted_nt = unclear`, and their real action is peptidergic and slow
(Annex A, A2). A signed fast synapse would misrepresent them, so they are **not** wired as synapses.

Hunger instead acts where the literature puts its best-known effects: it raises receptor-level gain.
Starvation raises sugar GRN sensitivity through dopamine (Inagaki et al. 2012) and DM1 ORN output through
sNPF (Root et al. 2011). The snapshot declares the effect:

```jsonc
"modulators": [
  { "id": "hunger", "label": "Hunger", "range": [0, 1],
    "targets": ["odour-left", "odour-right"], "gain": [0.5, 1.5] },   // gain = g0 + (g1 − g0) × h
  { "id": "hunger-taste", "source": "hunger",
    "targets": ["taste-left", "taste-right"], "gain": [0.1, 1.5] }
]
```

The input drive of each target pool is multiplied by its gain before it reaches the neurons (L4). The
gain values are config, chosen in calibration (Q5). A sated fly (`h = 0`) still smells and tastes, but
weakly. This is why it leaves.

### D6. Extraction config (format 3)

```jsonc
{
  "formatVersion": 3,
  "kind": "forager",
  "datasetRelease": "male-cns-v1.0", "edgeVariant": "traced-only", "expect": { … as ADR 002 … },
  "transmitterSign": { "acetylcholine": 1, "gaba": -1, "glutamate": -1 },
  "minConfidence": 0.5,
  "inputs": {
    "odour-left":  { "class": "olfactory", "types": ["ORN_DM1","ORN_DM2","ORN_DM4","ORN_VA2","ORN_VM2","ORN_DP1m"], "rootSide": "L" },
    "odour-right": { "class": "olfactory", "types": ["ORN_DM1","ORN_DM2","ORN_DM4","ORN_VA2","ORN_VM2","ORN_DP1m"], "rootSide": "R" },
    "taste-left":  { "class": "gustatory", "subclasses": ["labellar bristle","taste peg"], "typePrefixes": ["LgLG"], "rootSide": "L" },
    "taste-right": { "class": "gustatory", "subclasses": ["labellar bristle","taste peg"], "typePrefixes": ["LgLG"], "rootSide": "R" }
  },
  "sideMatch": { "odour": true, "taste": false },
  "outputs": {
    "turn-left":  { "types": ["DNa01","DNa02"], "somaSide": "L", "drive": "turnLeft" },
    "turn-right": { "types": ["DNa01","DNa02"], "somaSide": "R", "drive": "turnRight" },
    "forward":    { "types": ["DNp09"], "drive": "forward" },
    "backward":   { "types": ["MDN"], "drive": "backward" },
    "feed":       { "types": ["MN9"], "drive": "feed" }
  },
  "pathways": { "odour": ["odour-left","odour-right"], "taste": ["taste-left","taste-right"] },
  "flowSteps": 5,
  "budget": { "odour": 1500, "taste": 1500 },
  "excludeInterneuronClasses": ["olfactory","gustatory"], "excludeInterneuronSuperclassSuffix": "_sensory",
  "weightRule": "postFraction",
  "modulators": [ … D5 … ],
  "expectedNeuronCount": null,
  "neuronCountRange": [2000, 6000]
}
```

`kind: "forager"` selects D1–D5. A config without `kind`, or with `formatVersion: 2`, is an ADR 002
config and is handled as today. The extractor reports, per pool and per output, the counts, the side
balance, the edges into each output and the weight range, in the style of the ADR 002 report.

### D7. New failure codes

| Code | Condition |
|---|---|
| `E-POOL-EMPTY` | An input or output pool matches no admitted body (no Traced body, for outputs). |
| `E-SIDE-IMBALANCE` | After side matching, an L/R input pair differs in size, or a side is empty. |
| `E-OUTPUT-UNREACHED` | An output pool receives no edge from the selected interneurons or inputs. |
| `E-NODE-RANGE` | The neuron count is outside `neuronCountRange`. |
| `E-MODULATOR` | A modulator targets an undeclared input, or its gain is not two finite numbers ≥ 0. |

ADR 002's codes still apply where they make sense (`E-CONFIG`, `E-DATASET-*`, `E-DUP-*`, `E-SIGN` for
non-output bodies, `E-OVERFLOW`, `E-NONDETERMINISTIC`).

## Decisions: LIF core

Every extension below is **off by default**. With defaults, `step` gives the same spike train as today,
and `tests/lif-golden.test.mjs` must keep passing unchanged. All parameters are named in `LIF_DEFAULTS`,
validated in `resolveParams`, and documented (Principle V).

### L1. Exponential synaptic current (`tauSyn`, default 0)

Today a spike adds `w × synapticScale` to the target's potential on the next step and is then gone.
With thousands of converging inputs this delta synapse causes the measured lockstep. New state
`syn: Float64Array(n)`:

```text
arrive[j] = Σ (w × synapticScale) over spikes arriving at j this step
syn[j]    ← syn[j] × exp(−dt / tauSyn) + arrive[j] × (1 − exp(−dt / tauSyn))    // tauSyn > 0
v[j]      ← v[j] + (dt / tau)(vRest − v[j]) + syn[j] + external[j] − a[j]
```

The `(1 − exp(−dt / tauSyn))` factor keeps a sustained input at the same steady level as today, but
spread over time. `tauSyn = 0` is a separate branch, `syn[j] = arrive[j]`, and is exactly today's update:
the arriving sum is added once, and nothing carries over.

### L2. Spike-frequency adaptation (`tauAdapt`, `adaptStep`, defaults 0)

State `a: Float64Array(n)`: `a ← a × exp(−dt / tauAdapt)` each step, and `a ← a + adaptStep` on a spike.
`a` is subtracted from the update (L1). ORNs and many central neurons adapt. The forager needs this in
two places:

- **Change detection:** an adapting receptor pool responds more to rising odour than to a constant one.
  This gives the brain a temporal gradient in addition to the left/right one.
- **Leaving:** the constant odour of the flower the fly sits on fades, so a sated fly is not held there.

### L3. Threshold heterogeneity (`thresholdJitter`, default 0)

`vThreshold_i = vThreshold × (1 + thresholdJitter × u_i)`, where `u_i ∈ [−1, 1]` is drawn once per neuron
from a seeded PRNG. `createNetwork(graph, overrides, seed)` takes the fly's `brainSeed`, as the toy brain
already does. Identical pools (131 ORNs with the same drive) then stop firing in perfect synchrony. Two
flies with the same snapshot become individuals, and each is still reproducible from its seed
(Principle V). The jitter is a model parameter, not a dataset value. The snapshot does not change.

### L4. Pool inputs and modulation (brain runner, not the LIF core)

`lif.step(net, external)` already takes a full `Float64Array(n)`, so the core needs no change. The
runner (`fly-brain.js`) writes, for each input channel `c` and each neuron `i` in its pool:

```text
external[i] = clamp(resting_c + gain_c(h) × value_c, 0, max_c)
```

`gain_c(h)` comes from the snapshot's `modulators` (D5), and is 1 for a channel no modulator targets.

### L5. Several LIF steps per world tick (`stepsPerTick`, default 1)

The world ticks at 20 Hz. Odour-to-DN paths are 3–5 synapses long (A3), and each synapse costs one step.
With one step per tick, a turn would lag the odour by 150–250 ms of world time. `stepsPerTick` runs the
LIF core k times per sense message with the same external drive. Output EMAs update every step.
`dt` keeps its meaning (time per LIF step), and `motorSmoothing` is per step.

**Cost estimate.** 3.9K neurons and 222K edges. If 5–10 % of neurons spike per step, one step costs about
4K neuron updates plus 11–22K edge additions. At `stepsPerTick = 5`, 20 Hz and 6 flies (one worker each),
that is roughly 0.4M updates and 1–2M additions per second per core. The 35-neuron brain costs a few
hundred per tick. Gate B measures this; the estimate only says the design is not out of reach.

## Decisions: body, world and contracts

### W1. Hunger lives in the body

The body gets `energy ∈ [0, 1]`, starting at `flies.body.energy.initial` (default 0.3). Every tick it
loses `metabolism × dt`, and it gains `intake × dt` while eating. Hunger is `h = 1 − energy`. Energy at 0 does
not kill the fly (out of scope). The energy and hunger values are shown in the fly panel as a signal.

### W2. Eating is physics, not behaviour

A fly eats on a tick only when all three hold:

1. its cell is a stimulus cell (a flower);
2. its speed is below `flies.food.eatSpeed`, i.e. it has stopped or nearly stopped;
3. its `feed` output is above `flies.food.feedThreshold`.

The world never stops, turns or holds the fly. If the brain does not slow down on food, the fly does not
eat (Principle VI). Each flower has a `stock` that eating lowers and that regrows at `regrowth` per second.
An empty flower gives no taste and no odour, so flowers deplete and flies move on.

### W3. Bilateral odour and contact taste

- **Odour:** sampled at two antenna points, `±antennaOffset` across the heading, using the existing
  `fruitIntensity` falloff weighted by each flower's stock. The default `radius` grows from 3 to 8 tiles, so
  food can be smelled from a distance. The left-right difference near a flower is small (linear falloff
  slope `1/radius` per tile), which is why the brain needs contrast (AL lateral inhibition, L2 adaptation).
- **Taste:** `taste-left` and `taste-right` get the stock of the flower under the fly when it stands on one,
  and 0 otherwise. Both legs touch the same cell, so the two values are equal. They are separate channels
  so a later finer grid can tell them apart.

### W4. Motor mapping by declared drives

Outputs declare a `drive`: `turnLeft`, `turnRight`, `forward`, `backward`, `feed` (forager), or `left`,
`right` (existing tank drive). The body uses whichever set the brain declares:

```text
forager:  v = maxSpeed × clamp(forward − backward, −1, 1)
          ω = turnRate × s × (turnLeft − turnRight)    // left DNs active → the fly turns to its own left
tank:     unchanged (v = maxSpeed × (left + right)/2, ω = turnRate × (right − left))
```

`s = ±1` is fixed by a unit test that places an odour source on the fly's left and checks that a
`turnLeft`-only drive brings the heading toward it. The world is drawn with y pointing down, so the sign
cannot be read off the formula. The existing tank drive has the same ambiguity: in `body.js`, a faster
left value lowers the heading, while `action.js` labels that case "Turn right". The same test settles
which of the two is right.

Output rates are bounded by `1 / (refractorySteps + 1)`. Each forager drive declares a `range`, the rate
that maps to 1, so the body sees values in [0, 1] (`channel-declaration.md` already has `range`).

### W5. Contract versions

| Contract | Change |
|---|---|
| Snapshot container → **v4** | Header `capabilities`: input channels carry `neurons` (index list) in place of `neuron: 0`. Outputs carry `neurons` and a forager `drive`. New `modulators`. `weightRule` in the header. Neuron `role` ∈ `input`, `output`, `interneuron`, with a `channel` field. Index order: input pools in channel order, output pools in channel order, then interneurons by ascending `bodyId`. v3 files are still read (one input at neuron 0, `left`/`right` at 1 and 2). |
| Worker protocol → **v3** | `sense` carries `inputs: Float32Array` (one value per declared input, in declaration order) and `state: { hunger }`. `motor` is unchanged in shape. Its `outputs` now include `feed`, and `left`/`right` become optional (present only for tank-drive brains). |
| World config (`flies`) | New `body.energy` (`initial`, `metabolism`, `intake`), `food` (`eatSpeed`, `feedThreshold`, `stock`, `regrowth`), `stimulus.antennaOffset`. `brain.lif` accepts the L1–L3 parameters, and `brain.stepsPerTick` is new. |
| Brain inspector | Unchanged format path. The manifest lists the forager brain. Pools can be shown as groups by `channel`. |

The 11- and 35-neuron brains keep working with no file changes (v3 reader, tank drive, single input).

## Algorithm (extractor, forager kind)

1. Validate the config (`E-CONFIG`, `E-MODULATOR`). Check the dataset files and row counts as ADR 002 does.
2. Read annotations with the additional columns `rootSide` and `subclass`, then the neurotransmitters.
   Admit bodies as in ADR 002 D4, plus outputs under the D2 output rule.
3. Stream the traced-only edges restricted to admitted bodies (unchanged; 22,082,410 edges measured).
4. Resolve the input pools, apply side matching (`E-POOL-EMPTY`, `E-SIDE-IMBALANCE`), then the output pools.
5. Compute forward flow per pathway and backward flow to all outputs (D3). Rank, apply the budgets, apply
   the exclusions.
6. Build the induced subgraph, drop the outputs' outgoing edges, and check that every output is reached
   (`E-OUTPUT-UNREACHED`) and that the count is in range (`E-NODE-RANGE`).
7. Compute weights (D4). Assign indices (W5). Write the v4 container atomically.
8. Self-check as ADR 002 does (`E-NONDETERMINISTIC`). Every sort has an explicit key and every tie
   breaks on `bodyId`.

The flow ranking on the full admitted table ran in seconds in the Annex A prototype. Memory is the
restricted edge table, as ADR 002 research R2 describes.

## Acceptance

- **Gate A, extractor.** On v1.0 with the D6 config: a v4 container with 2,000–6,000 neurons, matched odour
  sides, every output reached, the report printed, and a byte-identical rerun. Unit tests on a labelled
  synthetic fixture cover each new failure code and the output admission rule.
- **Gate B, simulator.** The golden LIF test passes unchanged. New unit tests cover L1–L3 (decay
  constants, adaptation, reproducible jitter) and L4–L5 (pool drive, gain, step count). In the browser, six
  forager flies at 20 Hz with the chosen `stepsPerTick` keep the main thread responsive. The tick budget
  is measured and recorded.
- **Gate C, behaviour.** The experiment script gains forager metrics, reported per arm (forager,
  size-matched random graph, antennal-lobe brain, random walk) over held-out seeds:
  1. **Find:** fraction of flies that reach a flower within the run, which must exceed the random walk.
     No current brain does (Annex A, A1).
  2. **Approach:** median time to first flower for flies that start more than one odour radius away.
  3. **Eat:** median bout length (consecutive eating ticks). It must be longer for hungry flies
     (`initial = 0.1`) than for sated ones (`initial = 0.9`).
  4. **Leave:** fraction of eating bouts that end with the fly walking off before the flower is empty.
  5. **Hunger dependence:** flower-finding rate is higher for hungry than for sated flies.

  Contacts are still printed, but they no longer define the verdict. Spinning on one flower must not
  count as success.

As in ADR 002, Gate C is a result and not a precondition for shipping. If the forager fails a metric, the
fix is a config or LIF-parameter change, recorded with the run that motivated it. The data is not
hand-wired around the failure.

## Consequences

- The brain is **large and still traceable.** About 4K neurons, each with `bodyId`, `type`, its pool or
  flow score, and raw synapse counts. The point-cloud inspector already handles 143K points.
- **Behaviour can now be wrong for informative reasons.** If the fly does not stop on food, the connectome
  path from taste to DNp09 does not carry a stop signal at this budget and these signs. That is a finding
  about the subgraph, visible in the inspector.
- **More assumptions are written down:** food glomeruli (D1), taste pools without a sugar label (D1),
  DN and MN roles (D2), hunger as receptor gain (D5), the eating rule (W2). Each is one config value.
- **The LIF core grows by three optional mechanisms.** With defaults off it is the same model. With them
  on, it is still a pure, seeded, single-module LIF.
- **Contracts move a version** (container v4, protocol v3), with readers for the old versions kept.
- **Cost:** a ~2–3 MB snapshot per brain (about 10 bytes per edge, plus a JSON header for ~4K neurons),
  fetched once per worker from the browser cache.

## Open questions

- **Q1. Food glomeruli.** DM1, DM2, DM4, VA2, VM2, DP1m are chosen from the vinegar and fruit literature, not
  from the dataset. Confirm or replace the list before Gate C.
- **Q2. Sugar GRNs.** The release does not label taste modality. Candidates: map labellar types (`LB*`,
  `flywireType`) to FlyWire's sugar GRN annotation, or keep "all contact taste" and accept that bitter
  inputs are mixed in. Bitter mixed in would lower feeding, so this matters for Gate C metric 3.
- **Q3. Glutamate sign.** Still ADR 002 Q1. With 1,100+ inhibitory neurons in the selection (Annex A, A4)
  it matters more here.
- **Q4. Thin feeding output.** MN9 receives 18 edges at the default budget and one MN9 body is on each
  side. If `feed` stays silent, options are a larger taste budget, adding the MN9-presynaptic DNs as a
  `feed` pool, or a separate taste → `feed` flow budget. Each is a config change.
- **Q5. Gains and LIF values.** `synapticScale` under `postFraction`, `tauSyn`, `tauAdapt`, `adaptStep`,
  `thresholdJitter`, `stepsPerTick` and the modulator gains are set by calibration on seeds kept separate
  from the Gate C seeds, the method used for the antennal-lobe brain.
- **Q6. Learning.** The mushroom body (4,064 KCs, 316 PAM, 97 MBON) is mostly outside this selection. Odour
  memory of where food was is a later ADR. It needs plasticity, which this LIF does not have.

## Related

- [ADR 001](001-lif-toy-network-and-fly-integration.md): LIF core and protocol this ADR extends.
- [ADR 002](002-smallest-functional-brain.md): admission, signs, container and failure codes reused here.
- `malecns.md`: §4 annotations (`rootSide`, `subclass`, `receptorType`), §6 classes, §10 connectivity,
  §12 caveats, §14 type families.
- `specs/006-fly-status-panel/contracts/`: snapshot v3, worker protocol v2, channel declaration (amended by W5).
- `extract/configs/antennal-lobe-brain.json`: the best single-input brain, kept as the comparison arm.

## Annex A: measurements

All numbers come from the v1.0 release in `data/malecns`, restricted as ADR 002 D4 restricts it:
143,219 admitted bodies and 22,082,410 traced-only edges. They were measured with read-only scratch
scripts on 2026-10-05.

**A1. Single-input brains (motivation).** World `world-connectome.json` map, 6 flies, 3,000 ticks.
The sweep covered 14 topologies (ALPN or ORN entry, 8 to 77 interneurons, synapse cap 3/5/10) × `synapticScale`
0.3–0.85 × `tau` 10/20/40 × `refractorySteps` 1/2, which is 504 runs on 11 seeds. The best configurations were
then checked on 30 held-out seeds (180 flies):

| Brain | Contacts | Flies reaching a flower | Path per fly (tiles) |
|---|---|---|---|
| random walk | 60 | 46 | 134 |
| ALPN, 11 neurons (ADR 002) | 47 | 9 | 22 |
| ORN, 35 neurons (`antennal-lobe-brain`) | 259 | 27 | 157 |
| ALPN, 80 neurons | 281 | 28 | 37 |

The 35-neuron brain's odour → motor curve is flat: about 1 tile/s and a turn radius of about 0.9 tiles at every odour
level. Its contacts come from looping, not from following the odour.

**A2. Populations.**

| Population | Traced | Notes |
|---|---|---|
| ORN (`class = olfactory`) | 2,639 | `rootSide` L 884, R 1,344, unknown 411; admitted L 814, R 1,272 |
| Food-glomerulus ORNs, side-matched | 131 + 131 | DM1 35, DM2 21, DM4 15, VA2 31, VM2 15, DP1m 14 per side |
| GRN (`class = gustatory`) | 1,428 | `rootSide` L 713, R 715; subclasses: leg 768, wing 385, labellar 163, taste peg 60, pharyngeal 48 |
| Contact-taste pools (D1) | 317 L, 351 R | admitted |
| `cb_endocrine` | 72 | IPC 16, DH44 6, Hugin-RG 4, …; 70 with `predicted_nt = unclear` |
| DNa01, DNa02, DNp09 | 2 each (L, R) | acetylcholine, confidence ≥ 0.94, admitted |
| MDN | 4 (2 L, 2 R) | acetylcholine, admitted |
| MN9 | 2 | R 16949 admitted (ACh 0.57); L 10331 `unclear` 0.49, not admitted under ADR 002 D4 |

**A3. Path lengths.** Neurons reached with ≥ 3 synapses per edge: from all admitted ORNs, 1,080 at one
hop and 8,859 at two. Into DNa02, 1,354 at one hop back and 42,335 at two. Into MN9, 38 and 2,344.
Neurons within two hops of the smell/taste inputs and two hops of the DNa02 and MN9 outputs: 16,647.
This is why a ranking with a budget is needed in place of an exhaustive sandwich.

**A4. Prototype of D3** (forward and backward flow, 5 steps, budgets split evenly between odour and taste;
the sensory exclusion of D3 step 4 was **not** applied in this prototype, so the counts include non-input
ORNs and GRNs):

| Interneuron budget | Neurons | Edges | In-degree median / p95 / max | Exc / inh | Edges into DNa01, DNa02, DNp09, MDN, MN9 |
|---|---|---|---|---|---|
| 2,000 | 2,907 | 137,114 | 34 / 129 / 579 | 2,104 / 803 | 296, 348, 202, 835, 14 |
| **3,000** | **3,882** | **222,046** | 42 / 154 / 710 | 2,761 / 1,121 | 395, 458, 278, 1,018, 18 |
| 5,000 | 5,824 | 445,074 | 57 / 202 / 934 | 4,055 / 1,769 | 571, 665, 444, 1,381, 29 |

Composition at 3,000: `cb_intrinsic` 1,681, ALPN 300, ascending neurons 143, `vnc_intrinsic` 112, DNs 57,
ALLN 51, visual projection 41, plus the sensory bodies that the exclusion rule will remove.
