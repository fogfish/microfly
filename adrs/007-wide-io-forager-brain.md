# ADR 007: Wide-I/O forager brain (brain v2): six bilateral senses and six outputs on the 11K class-seeded topology

- **Status:** Proposed
- **Date:** 2026-10-13
- **Supersedes:** nothing. Answers [ADR 006](006-class-seeded-forager-brain.md) Q4 (the I/O experiment) and Q6 in part.
  It reuses the withdrawn cautious-forager ADR (branch `013-forager-brain-15k-lif-v2`) only for its world mechanics
  (W6–W8 there), not for its selection, weights or LIF changes.
- **Extends:** [ADR 003](003-hungry-forager-brain.md) (D1, D2, D5, W1–W4), [ADR 006](006-class-seeded-forager-brain.md)
  (D8–D14, W6–W7). The v1 forager brain, the 11K brain and their worlds stay valid and loadable.
- **Numbering:** extraction decisions continue at **D15**, world and contract decisions at **W8**. This ADR adds **no LIF
  mechanism** (see "Decisions: LIF core and runner").
- **Inputs:** ADR 003, 005 and 006 with their annexes; `malecns.md` §4, §6, §10, §14; `extract/configs/forager-brain-11k.json`;
  `public/brains/forager-brain-11k.brain`; branch 013 commit `0b6e055` (declared senses, body sites, escape physics);
  `.specify/memory/constitution.md`; the measurements in [Annex A](#annex-a-measurements), taken for this ADR.
- **Intended consumer:** `/speckit-specify` for the I/O feature (extractor filters and probe, channel declaration, host
  sensing, world config, experiment metrics).

## Context

The 11K brain (ADR 006) fixed the topology and kept v1's interface: two odour channels, two taste channels and five
motor outputs. ADR 006 left the interface to "the I/O experiment that follows" (Q4) and named its first number to check:
the taste → forward sign once the taste pool is fixed. This ADR is that experiment. Its purpose is **wider I/O, not a
more complex brain**: the central class list, the fill rule, the weight rule, the LIF core and the runner stay as they are.

The requested interface is 12 inputs (food odour, danger odour, heat, mouth taste, leg taste and touch, each L/R) and 6
outputs (turn L/R, forward, backward, feed, escape). The requested behaviours are:

1. **Find:** as v1, food odour steers. Front-leg taste reaches a flower half a body length before the mouth.
2. **Brake and eat:** mouth taste inhibits forward and excites feed. Leg taste drives backing and turning toward its
   side, which keeps the fly on the flower.
3. **Avoid:** danger odour (spiders) and heat (lanterns) reach the steering.
4. **Touch:** a blocked front leg turns the fly. The measured sign is toward the touched side.
5. **Escape:** the giant fibre (DNp01) is an output. In this brain its input comes from touch and taste paths only.

Each claim was checked against the connectome before the design was written. The method is ADR 006 D13's signed
linear probe, run on three graphs: the whole traced graph at ≥ 5 synapses, the shipped 11K node set, and a prototype
of the brain proposed here (Annex A). The probe shows which signed routes exist, not what the LIF will do. Its result:
**seven of the nine claims hold, and two do not.**

| # | Claim | Probe, proposed brain / whole graph | Verdict |
|---|---|---|---|
| 1 | Food odour steers toward | contrast +1.21e-7 / +8.76e-7 (13.8 %) | **holds** (as ADR 006) |
| 2a | Mouth taste lowers forward | −2.05e-7 / −4.47e-7 | **holds**: the brake exists once the legs leave the pool |
| 2b | Mouth taste raises feed | +1.30e-5 / +1.71e-5 | **holds** |
| 2c | Leg taste drives backing | +8.14e-6 / +1.46e-5 | **holds**; leg taste also lowers forward (−4.3e-7 / −7.1e-7) |
| 2d | Leg taste turns **toward** its side | −2.57e-6 / −9.40e-7 (away) | **does not hold** for food-taste GRNs. Toward (+2.1e-5) only with the ppk23/ppk25 pheromone neurons in the pool (D16) |
| 3a | Danger odour reaches steering, away | −2.95e-7 / −4.78e-7 | **holds**, but the sign is toward at ≤ 4 hops (Annex A5) |
| 3b | Heat reaches steering, away | −2.34e-5 / −2.67e-5 | **holds**, strongest steering input per neuron |
| 4 | Touch turns toward the touched side | +1.30e-5 / +1.65e-5 | **holds**, as claimed |
| 5 | Touch and taste drive the giant fibre | touch −5.6e-8 / −5.3e-7; mouth −2.5e-7 / −3.6e-7; leg −3.9e-8 / +4.9e-7 | **does not hold**. LC4 and LPLC2 (visual) alone carry 31 % of DNp01's normalised input; no tactile or gustatory neuron synapses onto it |

Three more measurements shape the design:

- **Three of the six senses are not in the 11K brain.** Danger ORNs, heat receptors and front-leg touch neurons are sensory
  classes. ADR 006 excludes them from fill, and they are not pools, so the shipped snapshot has none of them (Annex A1, A3).
  **This feature needs a re-extraction.** The topology rule does not change, and 10,410 of 11,000 neurons stay the same.
- **Front-leg taste cannot be told apart by `type`.** `LgLG1a`–`LgLG4` occur on all three leg pairs. Only `entryNerve =
  ProLN` separates the front legs, and the snapshot does not carry that column (Annex A1).
- **The mid- and hind-leg GRNs are what made v1's taste raise forward.** In the whole graph they give forward +1.7e-6 and a
  contralateral turn, while front-leg GRNs give forward −8.9e-7 and backing (Annex A2). Removing them from the pools is
  what makes the brake appear. It answers ADR 006's Consequence "taste raises forward even on the whole graph": that
  was the pool definition, not the connectome.

## Behaviour loop

```text
                         hunger h (body)
                            │ gain (ADR 003 D5)
                            ▼
 food odour L/R ──► ORN DM1…DP1m (138/138) ─┐                                   ┌─► DNa01/DNa02 L ─┐ turn
 danger odour L/R ► ORN_V (16/16) ──────────┤  ADR 006 topology, unchanged:     ├─► DNa01/DNa02 R ─┘
 heat L/R ────────► TRN_VP2 (3/3) ──────────┤  AL, MB, all 1,314 DNs            ├─► DNp09 ──────────── forward
 mouth taste L/R ─► labellar + taste peg ───┼─► + fill by shared weight ────────┼─► MDN ────────────── backward
                    (112/111)               │  (11,000 neurons)                 ├─► MN9 ────────────── feed
 leg taste L/R ───► front-leg GRN, no ppk ──┤                                   └─► DNp01 (GF) ─────── escape
                    (80/84)                 │                                         (read out; physics off, D17)
 touch L/R ───────► front-leg tactile (95/95)┘
 world: mouth on a flower, slow, feed > threshold ──► eat ──► energy ↑ ──► h ↓
        front-leg cells: taste the flower ahead / touch a blocked cell
```

## Decisions: extraction

### D15. Twelve input channels, chosen by declared filters

| Channel pair | Filter (config) | Per side (L / R) | Side rule | Source of the role |
|---|---|---|---|---|
| `odour-food-*` | `class = olfactory`, `type ∈ ORN_{DM1, DM2, DM4, VA2, VM2, DP1m}`, `rootSide` | 138 / 138 | matched per type | ADR 003 D1, unchanged |
| `odour-danger-*` | `class = olfactory`, `type = ORN_V`, `rootSide` | 16 / 16 | matched per type | CO₂ avoidance (Suh et al. 2004) |
| `heat-*` | `class = thermosensory`, `type = TRN_VP2`, `rootSide` | 3 / 3 | matched | arista hot cells (Gallio et al. 2011) |
| `taste-mouth-*` | `class = gustatory`, `subclass ∈ {labellar bristle, taste peg}`, `rootSide` | 112 / 111 | none | labellum and taste pegs |
| `taste-leg-*` | `class = gustatory`, `subclass = leg bristle`, `entryNerve = ProLN`, `receptorType ∉ {putative_ppk23, putative_ppk25}`, `rootSide` | 80 / 84 | none | front-leg GRNs |
| `touch-*` | `class = mechanosensory_tactile`, `entryNerve = ProLN`, `rootSide` | 95 / 95 | matched per type | front-leg bristles |

- **New filter keys**, all optional, with their absence meaning "no filter": `entryNerves` (a list), `excludeReceptorTypes`
  (a list), and `pair` (the channel pair a side-matched channel belongs to). Today side matching groups channels by
  `class` (`CLASS_TO_PATHWAY` in `selection_class_seed.py`). With two olfactory pairs that is ambiguous, so `sideMatch`
  is keyed by `pair` in a format-5 config. Format-4 configs keep the class grouping.
- **Side matching drops real neurons, and this is recorded.** ORN_V has 16 left and 39 right traced bodies, because the
  left antenna is less reconstructed (ADR 003 D1). TRN_VP2 has 4 and 3. Touch drops 56 left and 20 right bodies whose
  `type` has no partner on the other side. Mouth and leg taste are not matched: their sides are balanced, and the world
  never gives them different values from a reconstruction bias.
- **A body is in one pool only** (`E-CONFIG`, as today). The six pairs are disjoint by their filters.
- **The pools are seeds** (ADR 006 D14: "input and output pools are seeds automatically"). Sensory neurons outside the
  pools stay excluded from fill. The 547 GRNs that v1's pools held and these pools do not (411 mid- and hind-leg, 136
  front-leg ppk23/ppk25) therefore leave the brain.

### D16. Mappings measured and excluded

These were candidates for the requested channels. Each was measured and left out (Annex A2, A5, A6). Each exclusion is
config, so it can be reversed by a config change and a re-extraction.

| Candidate | Why it was a candidate | Measured | Decision |
|---|---|---|---|
| `ORN_DA2` in `odour-danger` | geosmin, an innate aversive odour (Stensmyr et al. 2012) | contrast −1.6e-8 (3 % of ORN_V's); forward **+2.3e-7**, backward −2.6e-7 | **excluded.** It adds neurons that do not steer and that raise forward. With it, the pair's contrast in the brain falls from −3.1e-7 to −1.8e-7 |
| `putative_ppk23`, `putative_ppk25` in `taste-leg` | they are 136 of the 300 front-leg GRNs | contrast **+5.5e-5** (all of the "toward" turn); forward −1.1e-6 | **excluded.** These are male foreleg pheromone receptors, which in a male CNS drive courtship. Feeding them the flower stock would make food taste act through the courtship circuit. Without them, the toward-turn of claim 2d is gone; the measured sign is away (−2.6e-6). That is a finding, not something to fix |
| Mid- and hind-leg GRNs in `taste-leg` | v1's `LgLG` prefix took all six legs | contrast **−5.6e-6** (away), forward **+1.7e-6** | **excluded.** They drive forward up and are the cause of v1's missing brake. In the world they would sit at the mouth cell or behind it, so they cannot sense ahead either |
| `LgLG` as one leg channel (remap only, no re-extraction) | the shipped 11K brain already holds them | forward **+6.3e-7** in the 11K node set | **excluded**, for the same reason |
| Hygrosensory and cold receptors | in the dataset; not requested | — | not proposed; the requested interface has no thirst or cold source |

### D17. Six output channels; escape is read out but has no confirmed driver

| Output | Pool | Drive | Neurons | Role source |
|---|---|---|---|---|
| `turn-left` / `turn-right` | `type ∈ {DNa01, DNa02}`, `somaSide` | `turnLeft` / `turnRight` | 2 / 2 | ADR 003 D2 |
| `forward` | `type = DNp09` | `forward` | 2 | ADR 003 D2 |
| `backward` | `type = MDN` | `backward` | 4 | ADR 003 D2 |
| `feed` | `type = MN9` | `feed` | 2 | ADR 003 D2 |
| `escape` | `type = DNp01` (giant fibre) | `escape` (new) | 2 | von Reyn et al. 2014 |

- **DNp01 is already in the brain** as a descending-neuron seed. Declaring it an output drops its outgoing edges
  (ADR 003 D2), which changes the CSR. That alone needs a re-extraction, but no new neuron.
- **Claim 5 fails in the connectome itself, not only in the cut.** DNp01's real ≥ 5 input is 31 % visual projection
  neurons, and its two strongest signed partner types are LC4 and LPLC2. Mechanosensory input (JO) is 1.9 %. No tactile
  or gustatory neuron synapses onto it. Over 8 hops, touch and mouth taste reach it with a **negative** sign in the
  whole graph and in the brain. Leg taste is positive in the whole graph (+4.9e-7) but negative in the brain (−3.9e-8).
  Heat is the reverse: negative in the whole graph (−2.3e-6) and positive in the brain (+8.9e-7). That is a selection
  artefact, and an escape gated on it would make lanterns trigger jumps for a reason the connectome does not support
  (Annex A7).
- **Decision: the `escape` channel is declared and read out, but its physics is off by default** (W10,
  `body.escape.enabled: false`). The readout costs nothing. It shows on the panel and in the experiment as telemetry,
  and the snapshot is ready for the ADR that adds the visual looming input. Escape is **excluded from the behaviour
  claims** of this ADR. Turning the physics on is a world-config change, gated on a Gate C finding (Q4).
- `forward` keeps only 26 % of DNp09's real input (ADR 006 Q1, unchanged). Widening it is an output change that belongs
  with Q6 of ADR 006. It is not done here, so that the brake can be judged on the pool v1 used.

### D18. Topology: ADR 006 D8–D12 unchanged; only the pools move

The central seed classes, `fill.neuronCount = 11000`, the fill exclusions, `allTraced` admission, `minSynapses: 5` and
`postFractionAbsolute` are copied verbatim from `forager-brain-11k.json`. The input and output pools are the only
difference. Measured on the prototype (Annex A4):

| | Shipped 11K | This ADR |
|---|---|---|
| Seeds (central + pools + outputs) | 8,127 | 7,852 (6,959 + 905) |
| Fill | 2,873 | 3,148 |
| Edges ≥ 5 | 448,322 | 458,548 |
| Output input captured, turn / fwd / back / feed / escape | 0.70 / 0.25 / 0.77 / 0.92 / 0.42 | 0.72 / 0.26 / 0.80 / 0.92 / 0.44 |
| Neurons shared with shipped 11K | — | 10,410 (590 in, 590 out) |

The 590 neurons that leave are 547 GRNs (D15) and 43 fill neurons (ascending 30, VNC 13). The 590 that join are 190
touch neurons, 32 ORN_V, 6 TRN_VP2, 44 front-leg GRNs that v1's `LgLG` prefix missed (`LgAG*` 29, untyped and `SN*` 15)
and 318 fill neurons (`cb_intrinsic` 179, ascending 64, VNC 61, visual projection 10, …). The rule is the same; the brain
is a new cut.

### D19. The fidelity probe covers every channel; its checks are declared in config

ADR 006 D13 hard-codes two checks on two probe pools (odour-L/R, one taste pool). With 12 channels, the probe runs
**every declared input pair against every output** on the brain and on the whole graph, and prints the 12 × 6 table. Which
pairs must agree is config:

```jsonc
"fidelity": {
  "require": true, "steps": 8,
  "checks": [
    { "kind": "contrast", "pair": "odour-food",  "minFraction": 0.1 },   // ADR 006 check 1
    { "kind": "sign",     "from": "taste-mouth", "to": "feed" },         // ADR 006 check 2, on the mouth pool
    { "kind": "sign",     "from": "taste-mouth", "to": "forward" },      // the brake (claim 2a)
    { "kind": "sign",     "from": "taste-leg",   "to": "backward" },     // claim 2c
    { "kind": "contrast", "pair": "heat",        "minFraction": 0.1 },   // claim 3b
    { "kind": "contrast", "pair": "touch",       "minFraction": 0.1 }    // claim 4
  ]
}
```

- `contrast` is D13's (L→turn-left − L→turn-right) − (R→turn-left − R→turn-right). It must have the whole graph's sign
  and at least `minFraction` of its magnitude. `sign` requires the pool-mean values to share a sign.
- At 11,000 all six pass: contrast 13.8 %; mouth → feed and mouth → forward agree; leg → backward agrees; heat 88 %;
  touch 79 % (Annex A4).
- **Not gated, but reported:** danger contrast (the sign depends on hop count, Annex A5), leg contrast (away in both
  graphs), and every pair → escape (D17). Gating the danger contrast would gate on a probe artefact either way.
- A format-4 config without `checks` runs ADR 006's two checks, as today.

### D20. Extraction config (format 5) and failure codes

```jsonc
{
  "formatVersion": 5,
  "kind": "forager-wide",
  "selection": "classSeed",
  // datasetRelease, edgeVariant, expect, admission, transmitterColumn, transmitterSign, defaultSign, minSynapses,
  // seeds, fill, weightRule, neuronCountRange: verbatim from forager-brain-11k.json (D18)
  "inputs": {
    "odour-food-left":    { "pair": "odour-food",   "class": "olfactory", "types": ["ORN_DM1", …, "ORN_DP1m"], "rootSide": "L" },
    "odour-danger-left":  { "pair": "odour-danger", "class": "olfactory", "types": ["ORN_V"], "rootSide": "L" },
    "heat-left":          { "pair": "heat", "class": "thermosensory", "types": ["TRN_VP2"], "rootSide": "L" },
    "taste-mouth-left":   { "pair": "taste-mouth", "class": "gustatory", "subclasses": ["labellar bristle", "taste peg"], "rootSide": "L" },
    "taste-leg-left":     { "pair": "taste-leg", "class": "gustatory", "subclasses": ["leg bristle"], "entryNerves": ["ProLN"],
                            "excludeReceptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "L" },
    "touch-left":         { "pair": "touch", "class": "mechanosensory_tactile", "entryNerves": ["ProLN"], "rootSide": "L" }
    // … and the six -right channels
  },
  "sideMatch": { "odour-food": true, "odour-danger": true, "heat": true, "taste-mouth": false, "taste-leg": false, "touch": true },
  "outputs": { /* ADR 006's five, verbatim */ "escape": { "types": ["DNp01"], "drive": "escape" } },
  "modulators": [
    { "id": "hunger", "range": [0, 1], "gain": [0.5, 1.5], "targets": ["odour-food-left", "odour-food-right"] },
    { "id": "hunger-taste", "source": "hunger", "gain": [0.1, 1.5],
      "targets": ["taste-mouth-left", "taste-mouth-right", "taste-leg-left", "taste-leg-right"] }
  ],
  "capabilities": { "channels": { "inputs": [ { "id": …, "side": …, "range": [0, 1], "sense": …, "site": … } ], "outputs": [ … ] } },
  "fidelity": { … D19 … }
}
```

- **Hunger modulates food and both tastes, not danger, heat or touch.** Starvation is known to raise food-receptor gain
  (ADR 003 D5). No hunger effect on those three is claimed.
- Filter keys on a body without that column value (e.g. `entryNerve` null) do not match. Annotation reads add
  `entryNerve` to `FORAGER_ANNOTATION_COLUMNS`.
- New failure codes:

| Code | Condition |
|---|---|
| `E-PAIR` | A side-matched or probe-checked `pair` does not have exactly one L and one R channel. |
| `E-FIDELITY` | Now raised by any failed check in `fidelity.checks`; the message names the check and both values. |

ADR 003 and 006 codes still apply. `E-SIDE-IMBALANCE` now covers every matched pair.

## Decisions: LIF core and runner

**No LIF mechanism is added, and `lif-v1.js` is not changed.** "Brain v2" names the interface generation (12 declared
senses, 6 drives). It is not a new core. The reasons:

1. **The core and the runner are already generic over channels.** `fly-brain-v1.js` drives any number of input pools,
   applies any number of modulators, and reads out any number of output pools by declaration. `lif-v1.js` resolves a
   per-channel `outputScale` map, which takes an `escape` key with no change.
2. **Every claim that fails, fails in the linear probe on the whole connectome** (D16, D17). No LIF mechanism can create
   a signed route the graph does not have. Adding one would be a workaround for data (AGENTS.md: "Behaviour failures
   are findings").
3. **ADR 006 lesson 6: change one thing.** This experiment changes the interface. The topology rule, the core and the
   calibration protocol stay fixed, so a Gate C failure can be pinned on the interface.

The withdrawn ADR's L9 (Poisson input), L10 (group gain) and L11 (time base) stay out. If calibration finds that the
3-neuron heat pool cannot be driven without igniting its neighbours, the knob is world config (`stimuli.heat.gain`),
not the core.

What does change in the runtime is outside the core: the host's sensing (W8, W9), the escape physics (W10), and the
version gate (W11). `tests/lif-golden.test.mjs` passes unchanged.

## Decisions: body, world and contracts

### W8. Each channel declares what it senses and where

The host must stop hard-coding "inputs are odour L, odour R, taste, taste" (`senseForagerFly`). Each input channel in
a `forager-wide` snapshot declares a `sense` and a body `site`; the world declares where each sense comes from. This
is withdrawn ADR W6, reduced to the six senses requested:

```jsonc
// snapshot channel
{ "id": "heat-left", "side": "L", "range": [0, 1], "sense": "heat", "site": "antenna" }
// world config, flies
"stimuli": {
  "odour:food":   { "from": "edibles", "scaleBy": "stock" },                      // today's odour, spec 009 reach
  "odour:danger": { "from": "dangers", "kinds": ["spider"],  "radius": 4 },
  "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
  "taste":        { "from": "edibles", "scaleBy": "stock", "contact": true },     // stock of the flower under the site
  "touch":        { "from": "blocked", "contact": true }                          // 1 when the site cell is not walkable
},
"body": { "sites": { "antenna": { "forward": 0, "lateral": 0.5 },
                     "mouth":   { "forward": 0, "lateral": 0 },
                     "front-leg": { "forward": 0.5, "lateral": 0.25 } } }
```

| Channel pair | `sense` | `site` |
|---|---|---|
| `odour-food-*` | `odour:food` | `antenna` |
| `odour-danger-*` | `odour:danger` | `antenna` |
| `heat-*` | `heat` | `antenna` (the hot cells sit in the arista) |
| `taste-mouth-*` | `taste` | `mouth` |
| `taste-leg-*` | `taste` | `front-leg` |
| `touch-*` | `touch` | `front-leg` |

- Distance senses reuse `falloff` (`stimulus.js`); contact senses read one cell. A sense that a snapshot declares and
  the world does not define is a load error, not a silent zero.
- **`mouth` has no lateral offset, so `taste-mouth-left` and `-right` always carry the same value.** The labellum is one
  organ at the world's resolution. The pair is kept so the channel count and the data stay symmetric. Its L/R
  contrast (+1.2e-6) can never be expressed, and no claim relies on it.
- The world never reads a channel's meaning from its index or id. The mapping is data on both sides (Principle VI).

### W9. Front legs taste and touch ahead of the mouth

The front-leg site sits 0.5 tiles ahead of the body centre, half the 1-tile body, and 0.25 tiles to each side.
`taste-leg-*` reads the flower stock under its leg cell, and `touch-*` is 1 when its leg cell is not walkable (water,
solid object or map edge). Leg taste is lateral and arrives a tick or more before mouth taste on approach. That gives
the brain its earliest on-food signal, and the measured leg routes (brake −4.3e-7, backing +8.1e-6) act on it.
Eating stays ADR 003 W2: the mouth cell, slow, and `feed` above threshold.

### W10. Escape is physics, off by default

When `body.escape.enabled` is true, the escape drive exceeds `body.escape.threshold`, and the fly is not in its
`cooldown`, the body moves `distance` tiles along its heading in one tick. A blocked move stops at the first non-walkable
cell, as `pick` does. The default is **`enabled: false`** (D17). With it off, the `escape` drive is computed, shown and
logged, and moves nothing. Defaults when on: threshold 0.5, distance 1.5, cooldown 2 s (withdrawn ADR W8).

### W11. Contract versions

| Contract | Change |
|---|---|
| Snapshot container | **Stays v4.** The header `kind` is `forager-wide`. No section changes. |
| Channel declaration → **v5** | For kind `forager-wide`: inputs carry `sense` and `site` (R8 allows them); outputs carry exactly the six drives `turnLeft`, `turnRight`, `forward`, `backward`, `feed`, `escape` (R7, via `KIND_DRIVES`). Kind `forager` keeps v4 rules, so an old world cannot load a wide snapshot by mistake. Python (`capabilities.py`) and JS (`capabilities.js`) validators change together. |
| Extract config → **format 5** | D15 filter keys, `pair`, `sideMatch` by pair, `fidelity.checks` (D19), kind `forager-wide`. Format 4 is unchanged. |
| World config | `flies.stimuli`, `flies.body.sites`, `flies.body.escape` (W8–W10); `brain.version: "v2"`. |
| Brain version | `"v2"` requires a `forager-wide` snapshot and selects the declared-sense host path (W8). It runs `fly-brain-v1.js` and `lif-v1.js` unchanged; `fly-brain.js` maps `v2` to the v1 runner. `validate.js` accepts `v2` with `LIF_V1_DEFAULTS`. |
| Worker protocol | **Unchanged (v3).** `sense.inputs` already has one value per declared input in declaration order; `motor.outputs` gains `escape` by declaration. |
| LIF core | **Unchanged** (`lif-v1.md`). |
| Experiment metrics | Gate C additions below. |

The mock, v0, v1 and 11K brains and their worlds load with no file change. Branch 013's commit `0b6e055` implements
W8–W10 for a different snapshot shape. It is a reference to port, with its tests, not code to merge.

## Calibration protocol

ADR 006's protocol (ADR 005 Annex B, staged A1 → A2 → B, `/microfly-calibrate` in its own session), starting from the
11K world's calibrated LIF block, with two additions:

1. **A1 probes the new pools brain-only**, as clamped inputs with A5's odour-plus-X design: **brake** (mouth taste plus
   food odour lowers raw `forward` against food odour alone), **feed** (the same raises `feed`), **back** (leg taste raises
   `backward`), **avoid** (heat-L raises turn-right over turn-left) and **touch** (touch-L raises turn-left). Only the
   directions D19 gates are gated. Danger and escape are recorded.
2. **A2 fits `outputScale.escape`** like any output, so the readout has a range on the panel. That fit carries no
   behaviour claim.

Calibration seeds only; held-out seeds for the verdict.

## Acceptance

- **Gate A, extractor.** A v4 container of kind `forager-wide` with 10,000–12,000 neurons, from the D20 config on v1.0.
  The pools match D15's filters and counts; matched pairs are equal; no pool overlaps; all six outputs are reached;
  every D19 check passes and the full 12 × 6 table is printed and stored; the rerun is byte-identical. Python unit tests
  on the labelled fixture cover `entryNerves`, `excludeReceptorTypes`, `pair` side matching, `E-PAIR`, and each check
  kind against a hand-computed probe. JS and Python tests cover channel declaration v5 (both kinds).
- **Gate B, simulator.** `tests/lif-golden.test.mjs` passes unchanged. Host tests: each W8 sense against a placed source;
  the leg site samples ahead of the mouth; touch is 1 on water, solid objects and the map edge; escape moves nothing
  with `enabled: false` and jumps once per cooldown with `true`. Six wide flies at 20 Hz keep the main thread
  responsive.
- **Gate C, behaviour,** on held-out seeds. Arms: (1) this brain; (2) the shipped 11K brain; (3) a size-matched random
  graph of this brain; (4) the random walk. Metrics:
  1. ADR 003 metrics 1–5 (find, approach, eat, leave, hunger dependence).
  2. **Brake:** median `forward` drive with the mouth on a flower ÷ off flowers, hungry flies. It must be < 1 and lower
     than arm 3's. **Eat must pass for this arm.** This is the metric neither v1 nor 11K could pass, and the interface
     change is meant to fix it.
  3. **Stay:** ticks on a flower per visit, against arm 2.
  4. **Avoid:** fraction of ticks within 1.5 tiles of a spider, and of a lantern, against the random walk. Reported with
     its sign. Heat must not be closer than the random walk; danger is reported only (Annex A5).
  5. **Touch:** turn direction in the 10 ticks after a one-sided touch, against the random walk. The probe predicts a
     turn toward the touched side.
  6. **Escape (telemetry):** mean `escape` drive within the danger radius against outside it. Reported only.

  As always, a failed metric is a finding, and the fix is config or parameters, recorded with the run.

## Constitution fit

| Principle | Fit |
|---|---|
| I. Static web | No dependency. One snapshot of about 8 MB, the same as 11K. |
| II. One fly, one worker | Unchanged; protocol v3 unchanged. |
| III. Dataset brains | Every pool is a dataset filter. Every exclusion (D16) is a declared filter value with a measured reason. Escape's missing driver is reported, not wired around. No edge is hand-wired. |
| IV. Config extraction | Pools, pairs, side matching and the fidelity checks are config. Deterministic; sorts end in `bodyId`. |
| V. Pure LIF | No change to the core. |
| VI. Embodied | Senses and body sites are declared data on both sides. Eating and escape are physics gated by brain outputs; escape physics is off by a declared world value. |
| VII. Simplicity | No LIF mechanism, no new selection rule. Three filter keys and a declared check list. |

## Consequences

- **The brake becomes testable.** For the first time the brain's mouth pool has a negative route to `forward` in both
  the brain and the whole graph. Whether the LIF expresses it is Gate C.
- **Two requested behaviours are not supported by the connectome as specified.** Leg taste turns away from its side
  (food-taste GRNs), and the giant fibre has no excitatory route from touch or taste. Both are kept in the brain and
  measured, and neither is claimed.
- **The interface triples** (4 → 12 inputs, 5 → 6 outputs) without hard-coded channel indices in the world.
- **One known mislabel is fixed at the source.** `malecns.md` §14 already says `LgLG` is leg taste. ADR 003's taste
  pool mixed 667 leg GRNs from all six legs into "taste".
- **Re-extraction is required** (Annex A3). The new snapshot shares 94.6 % of its neurons with the shipped 11K brain;
  the 11K brain stays as arm 2.
- **Heat is three neurons a side.** It is the strongest steering input per unit of pool drive (contrast about 190× food's
  in the brain), so it may need a lower world gain than odour. That is calibration, not design.

## Alternatives considered

- **Remap only, no re-extraction** (split the shipped taste pools into mouth and `LgLG`, declare DNp01 an output). This
  gives 6 of the 12 channels. Danger, heat and touch have no neurons in the shipped brain, and `LgLG` raises forward
  (D16). Declaring DNp01 an output drops its outgoing edges, so even that part rewrites the CSR. Rejected as the design;
  it would still make a clean single-variable ablation of the mouth split, if Gate C needs one.
- **Keep ppk23/ppk25 in leg taste** to obtain the requested toward-turn. Rejected (D16). It is one config line if the
  project decides that pheromone-driven orientation is an acceptable stand-in.
- **Gate escape on heat**, the only pool positive to DNp01 in the brain. Rejected: the whole graph says negative (D17).
- **Escape through other takeoff-related DNs** (DNp02, DNp06 receive heat +5.9e-5 and +3.7e-5). Not proposed: their role
  as escape outputs is not established here, and choosing an output because it responds to the input we want would be
  selecting for the result.
- **12,000 neurons.** Measured: food contrast rises from 13.8 % to 28 % of the whole graph and forward capture from
  0.26 to 0.32; every claim keeps its verdict (Annex A4). Not needed to pass D19. It is ADR 006's size knob, kept for a
  later step.
- **The withdrawn L9–L11** (Poisson input, group gain, time base). Out of scope (Decisions: LIF core and runner).

## Open questions

- **Q1. Leg taste lowers feed.** Front-leg GRNs without ppk give feed −4.1e-6 in the brain and −6.9e-6 in the whole graph.
  The release does not label taste modality, so bitter neurons may be mixed in (ADR 003 Q2). If eating fails while the legs are on
  the flower, the leg pool's modality is the first suspect, not the LIF.
- **Q2. Danger's sign depends on depth.** ORN_V turns toward at 3–4 hops and away from 6 hops on. In the LIF the short
  routes arrive first. Gate C metric 4 reports which one wins.
- **Q3. `putative_IR52b` front-leg GRNs** (24 / 22) have a positive contrast in the whole graph (+1.2e-5) and a negative one
  in the brain (−1.4e-7). They stay in the pool; if leg turning matters later, this is the subgroup to examine.
- **Q4. The giant fibre's driver.** LC4 and LPLC2 are the visual looming inputs, so the escape physics can be turned on
  once the brain is given vision. Until then the readout is telemetry.
- **Q5. Forward pool** (ADR 006 Q1) is unchanged at 26 % capture, and the brake is small against it (−2.1e-7). If A2 again
  needs an extreme `outputScale.forward`, a forward pool chosen from data (ADR 006 Q6) is the next output change.
- **Q6. Side-matched touch drops 76 bodies.** Matching by `type` when many front-leg tactile bodies are untyped or
  one-sided loses a quarter of the population. Unmatched touch (151 / 115) is the alternative, at the cost of a side bias.

## Related

- [ADR 003](003-hungry-forager-brain.md): pools, modulators, eating rule.
- [ADR 006](006-class-seeded-forager-brain.md): the topology this ADR keeps; D13 probe; Q4, Q6.
- Branch `013-forager-brain-15k-lif-v2`: withdrawn ADR 006 W6–W8 and commit `0b6e055` (declared senses, sites, escape).
- `specs/008-hungry-forager-brain/contracts/channel-declaration-v4.md`, `specs/012-class-seeded-forager-brain/contracts/extract-config-classseed.md`.

## Annex A: measurements

All numbers come from `data/malecns` (v1.0, traced-only edges, `Traced` bodies only), measured on 2026-10-13 with
read-only scratch scripts. They used the extractor's own `dataset`, `admission.admit_all_traced`, `seed_bodies` and
`fill_candidates`, imported from `extract/` in a throwaway environment (`numpy`, `pyarrow`, `pandas`); the extractor's
environment was not changed. The thresholded graph has 6,235,649 edges, which matches ADR 006 A1. Weights are D12's, signs
D10's. Probe values are D13's: 8 steps, pool mass 1/|pool|, outputs as sinks, the mean over an output pool, and L/R means
for single numbers. "Contrast" is D13's formula; > 0 means a turn toward the stimulated side.

### A1. Populations (traced)

| Population | L | R | Notes |
|---|---|---|---|
| `ORN_V` | 16 | 39 | matched 16 / 16 |
| `ORN_DA2` | 21 | 20 | 7 more `unknown`; excluded (D16) |
| `TRN_VP2` | 4 | 3 | matched 3 / 3; `TRN_VP1m` 5/6 and `TRN_VP3a` 3/3 not used |
| Labellar bristle + taste peg | 112 | 111 | all have `entryNerve = MxLbN`; all already in the 11K brain |
| Leg-bristle GRNs, `ProLN` | 149 | 151 | receptorType: none 118, ppk23 71, ppk25 65, IR52b 46 |
| ditto without ppk23/ppk25 | 80 | 84 | the `taste-leg` pool |
| Leg-bristle GRNs, `MesoLN` / `MetaLN` | 233 | 235 | mid and hind legs; 411 of them in the 11K brain |
| `LgLG*` types by nerve | | | `LgLG1a–4` on ProLN, MesoLN and MetaLN; `LgLG5–8` on ProLN only |
| Tactile, `ProLN` | 151 | 115 | subclass `leg` 27/15 and `mechanosensory bristle` 124/100; matched by type 95 / 95 |
| `DNp01` | 1 | 1 | bodies 10010 (L), 10001 (R); interneurons in the 11K brain |

The shipped 11K snapshot holds 276 ORNs (the food pools) and 890 GRNs (223 mouth, 667 `LgLG`), and no thermosensory or
tactile neuron. Its neuron records carry `class`, `type`, `somaSide`, `superclass`, `transmitter` and `origin`, but not
`subclass`, `rootSide`, `entryNerve` or `receptorType`.

### A2. Probe, whole traced graph at ≥ 5 (and the shipped 11K node set where the pool exists)

| Pool | Contrast | Forward | Backward | Feed | Escape |
|---|---|---|---|---|---|
| food odour | +8.76e-7 (11K +1.16e-7) | −4.7e-7 | −5.2e-7 | −6.9e-9 | −2.4e-7 |
| ORN_V + DA2 | −2.21e-7 | −3.9e-7 | +3.8e-7 | +2.8e-8 | −2.6e-7 |
| ORN_V | −4.78e-7 | −1.15e-6 | +1.17e-6 | +3.1e-8 | −5.0e-7 |
| ORN_DA2 | −1.6e-8 | +2.3e-7 | −2.6e-7 | +2.6e-8 | −6.0e-8 |
| TRN_VP2 | −2.67e-5 | −1.63e-5 | +6.6e-6 | −1.5e-6 | −2.3e-6 |
| mouth | +1.21e-6 | −4.5e-7 (11K −1.9e-7) | −2.1e-7 | +1.71e-5 (11K +1.26e-5) | −3.6e-7 |
| front leg, all | +2.43e-5 | −8.9e-7 | +1.11e-5 | −4.1e-6 | +6.0e-7 |
| front leg, no ppk | −9.4e-7 | −7.1e-7 | +1.46e-5 | −6.9e-6 | +4.9e-7 |
| front leg, ppk only | +5.5e-5 | −1.1e-6 | +7.0e-6 | −6.7e-7 | +7.3e-7 |
| mid + hind leg | −5.59e-6 | +1.74e-6 | +4.2e-6 | −2.0e-6 | +5.7e-7 |
| `LgLG*`, all legs | +8.0e-6 (11K +5.9e-6) | +5.4e-7 (11K +6.3e-7) | +5.6e-7 | −3.1e-7 | +3.5e-7 |
| v1 taste pool | +6.3e-6 | +2.9e-7 | +3.7e-7 | +4.1e-6 | +1.7e-7 |
| touch, matched | +1.65e-5 | −1.6e-7 | +3.1e-6 | +1.1e-6 | −5.3e-7 |
| touch, unmatched | +1.43e-5 | −1.2e-7 | +2.5e-6 | +1.0e-6 | −4.6e-7 |
| JO wind/gravity (not a channel) | +1.9e-6 | −1.5e-6 | +1.1e-7 | +1.7e-7 | −1.5e-6 |

The v1 taste pool's forward value (+2.9e-7) is ADR 006's +3.0e-7. It splits into mouth −4.5e-7 and legs +5.4e-7.

### A3. What a remap of the shipped snapshot can and cannot do

| Feature | Neurons in shipped 11K | Needs re-extraction |
|---|---|---|
| Mouth taste L/R | yes (by `type` prefix `LB`, `*_tpGRN`, inside the taste pools) | the pools change, so the header changes; the node set and CSR are identical (same seed union) |
| Front-leg taste L/R | partly (129 / 127 of the ProLN GRNs, ppk included); not separable without `entryNerve` | **yes** |
| Danger odour, heat, touch | none | **yes** |
| Escape output | DNp01 present | **yes**: as an output it loses its outgoing edges |
| Mid-leg, hind-leg and ppk GRNs out | present (547), would stay as undriven sensory neurons | **yes**, to free their 547 places |

### A4. Proposed brain (D15–D18), brain / whole graph

| Pool (L/R mean) | Contrast | Forward | Backward | Feed | Escape |
|---|---|---|---|---|---|
| `odour-food` | +1.21e-7 / +8.76e-7 | +2.7e-9 / −4.7e-7 | −4.8e-7 / −5.2e-7 | −4.5e-8 / −6.9e-9 | −9.9e-8 / −2.4e-7 |
| `odour-danger` | −2.95e-7 / −4.78e-7 | −1.2e-7 / −1.2e-6 | +7.3e-7 / +1.2e-6 | +8.6e-9 / +3.1e-8 | −4.7e-8 / −5.0e-7 |
| `heat` | −2.34e-5 / −2.67e-5 | −7.2e-7 / −1.6e-5 | +5.8e-6 / +6.6e-6 | −8.0e-7 / −1.5e-6 | **+8.9e-7 / −2.3e-6** |
| `taste-mouth` | +1.18e-6 / +1.21e-6 | **−2.1e-7 / −4.5e-7** | +1.1e-7 / −2.1e-7 | **+1.30e-5 / +1.71e-5** | −2.5e-7 / −3.6e-7 |
| `taste-leg` | **−2.57e-6 / −9.40e-7** | −4.3e-7 / −7.1e-7 | **+8.1e-6 / +1.5e-5** | −4.1e-6 / −6.9e-6 | −3.9e-8 / +4.9e-7 |
| `touch` | **+1.30e-5 / +1.65e-5** | +1.0e-8 / −1.6e-7 | +1.4e-6 / +3.1e-6 | +1.8e-7 / +1.1e-6 | −5.6e-8 / −5.3e-7 |

At 11,000: 7,852 seeds, 3,148 fill (`cb_intrinsic` 1,950, `ascending_neuron` 561, `vnc_intrinsic` 545, `visual_projection`
59, `visual_centrifugal` 14, `vnc_efferent` 13, `efferent_ascending` 3), 458,548 edges. At 12,000: 4,148 fill, 527,636
edges, food contrast +2.46e-7 (28 %), captured turn / fwd / back / feed / escape 0.77 / 0.32 / 0.85 / 0.93 / 0.49, and
every other value keeps its sign.

A variant with `ORN_DA2` in the danger pool (36 / 36) gives a danger contrast of −1.76e-7 and backward +8.3e-8, against
−3.11e-7 and +7.0e-7 with ORN_V alone (both measured on the prototype with ppk still in the leg pool).

### A5. Sign against hop count (whole graph; proposed brain in brackets)

| Pool | 3 | 4 | 6 | 8 | 12 |
|---|---|---|---|---|---|
| food contrast | +6.1e-7 | +7.8e-7 | +8.6e-7 | +8.8e-7 | +8.8e-7 |
| danger contrast | **+2.1e-7** (+1.5e-7) | **+3.0e-7** (+2.0e-7) | −4.5e-7 (−3.1e-7) | −4.8e-7 (−3.0e-7) | −4.9e-7 (−3.0e-7) |
| heat contrast | −1.9e-5 | −2.2e-5 | −2.7e-5 | −2.7e-5 | −2.7e-5 |
| touch contrast | +1.5e-5 | +1.6e-5 | +1.7e-5 | +1.7e-5 | +1.7e-5 |
| mouth → forward | −6.1e-8 | −2.5e-7 | −3.9e-7 | −4.5e-7 | −4.9e-7 |
| mouth → feed | +8.7e-6 | +1.9e-5 | +1.9e-5 | +1.7e-5 | +1.7e-5 |
| leg (no ppk) → backward | +7.7e-6 | +9.7e-6 | +1.3e-5 | +1.5e-5 | +1.6e-5 |
| leg (no ppk) contrast | −6.6e-7 | −9.7e-7 | −8.9e-7 | −9.4e-7 | −1.1e-6 |

Danger is the only pool whose sign changes with depth. Every gated D19 value keeps its sign from 3 to 12 hops.

### A6. Front-leg receptor subgroups (whole graph / proposed brain)

| Subgroup | L / R | Contrast | Forward | Backward | Feed |
|---|---|---|---|---|---|
| no `receptorType` | 56 / 62 | −6.3e-6 / −3.5e-6 | −5.4e-7 / −5.6e-7 | +2.1e-5 / +1.2e-5 | −9.8e-6 / −5.7e-6 |
| `putative_IR52b` | 24 / 22 | +1.2e-5 / −1.4e-7 | −1.2e-6 / −1.0e-7 | −5.6e-7 / −3.8e-7 | +1.3e-7 / +4.2e-8 |
| `putative_ppk23` + `ppk25` | 136 total | +5.5e-5 / +5.0e-5¹ | −1.1e-6 / +5.0e-7¹ | +7.0e-6 / +6.2e-6¹ | −6.7e-7 / −2.9e-7¹ |

¹ The proposed brain holds no ppk neurons, so these brain values come from the prototype variant with the whole
front-leg pool (ppk included) as seeds, at 11,000 neurons.

### A7. The giant fibre (DNp01)

Real ≥ 5 input: 35,729 synapses. By superclass: `cb_intrinsic` 51.4 %, `visual_projection` 31.4 %, `descending_neuron` 7.7 %,
`ascending_neuron` 4.1 %, `vnc_intrinsic` 3.0 %, `cb_sensory` (JO) 1.9 %. Strongest signed partner types (summed normalised
weight over both GFs): LC4 0.353, LPLC2 0.272, DNp70 0.079, PVLP122 0.069, SAD064 0.068, PVLP123 0.035, PVLP151 0.033,
DNpe042 0.028, PVLP062 0.027, JO-B1_a 0.027. Captured in the shipped 11K brain: 42 %; in the proposed brain: 44 %. No
tactile or gustatory body is a direct partner. Probe values from every channel are in A2 and A4 (column "Escape").
